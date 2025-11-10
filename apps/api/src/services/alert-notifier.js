/**
 * Alert Notifier Service
 *
 * Enterprise-grade alert notification fan-out covering Email, Slack, and PagerDuty.
 * Features:
 * - 5 minute deduplication window with automatic cleanup
 * - Async dispatch via BullMQ when enabled (fallback to in-process async execution)
 * - Exponential backoff retries with channel health tracking
 * - Rich channel formatting (HTML emails, Slack attachments, PagerDuty incidents)
 * - Channel health monitoring and aggregated metrics
 * - Test utility for admin diagnostics
 */

import { createHash, randomUUID } from 'crypto'
import config from '../config/index.js'
import queueManager from './queue-manager.js'
import emailService from './email.js'

const PAGERDUTY_EVENTS_API_URL = 'https://events.pagerduty.com/v2/enqueue'

/**
 * Convenience sleep helper used for retry backoff
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Map internal severity naming to PagerDuty compliant severities
 */
function mapSeverityToPagerDuty(severity) {
  const normalized = (severity || 'info').toLowerCase()
  switch (normalized) {
    case 'critical':
    case 'error':
      return 'critical'
    case 'warning':
      return 'warning'
    case 'info':
    default:
      return 'info'
  }
}

/**
 * Resolve Slack attachment color by severity
 */
function slackColorForSeverity(severity) {
  const normalized = (severity || 'info').toLowerCase()
  return {
    critical: '#d73a49',
    error: '#d73a49',
    warning: '#f9c513',
    info: '#0366d6',
    success: '#28a745',
  }[normalized] || '#6a737d'
}

/**
 * Alert Notifier Service
 */
export class AlertNotifierService {
  constructor() {
    this.config = config.alertNotifications || { enabled: false }
    this.features = config.features || {}

    this.metrics = {
      totalAlerts: 0,
      deduplicated: 0,
      queued: 0,
      dispatched: 0,
      channelSuccess: {
        email: 0,
        slack: 0,
        pagerDuty: 0,
      },
      channelFailures: {
        email: 0,
        slack: 0,
        pagerDuty: 0,
      },
      lastDispatchAt: null,
    }

    this.channelHealth = {
      email: this.createChannelHealth('email'),
      slack: this.createChannelHealth('slack'),
      pagerDuty: this.createChannelHealth('pagerDuty'),
    }

    this.recentAlerts = new Map()
    this.cleanupInterval = null

    this.initialize()
  }

  /**
   * Initialize background timers for deduplication cleanup
   */
  initialize() {
    if (!this.isEnabled()) {
      return
    }

    const intervalMs = Math.max(60000, Math.min(this.config.deduplicationWindowMs || 300000, 300000))
    this.cleanupInterval = setInterval(() => {
      this.pruneDeduplicationWindow()
    }, intervalMs)

    this.cleanupInterval.unref?.()

    process.on('exit', () => {
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval)
      }
    })
  }

  /**
   * Determine if the alert notifier is globally enabled
   */
  isEnabled() {
    return Boolean(this.config?.enabled)
  }

  /**
   * Create initial channel health record
   */
  createChannelHealth(channelName) {
    const isChannelEnabled = this.isChannelEnabled(channelName)
    return {
      channel: channelName,
      status: isChannelEnabled ? 'idle' : 'disabled',
      lastSuccessAt: null,
      lastFailureAt: null,
      lastError: null,
      consecutiveFailures: 0,
      averageLatencyMs: null,
    }
  }

  /**
   * Test if specific channel is enabled and minimally configured
   */
  isChannelEnabled(channelName) {
    const channels = this.config?.channels || {}
    const channelConfig = channels[channelName] || {}
    return Boolean(channelConfig.enabled)
  }

  /**
   * Main entry point for dispatching an alert
   * @param {Object} alert - Alert payload
   * @param {Object} options - Additional options
   */
  async notify(alert = {}, options = {}) {
    if (!this.isEnabled() && !options.force) {
      return {
        skipped: true,
        reason: 'disabled',
      }
    }

    const normalizedAlert = this.normalizeAlert(alert, options)
    const dedupKey = this.getDeduplicationKey(normalizedAlert)

    if (!options.skipDedup && this.isDuplicate(dedupKey)) {
      this.metrics.deduplicated++
      return {
        skipped: true,
        reason: 'deduplicated',
        alertId: normalizedAlert.id,
      }
    }

    if (!options.skipDedup) {
      this.recentAlerts.set(dedupKey, normalizedAlert.timestamp)
    }

    this.metrics.totalAlerts++

    if (this.shouldUseQueue() && !options.bypassQueue) {
      const job = await queueManager.addJob(
        'alert-notifications',
        {
          alert: normalizedAlert,
          metadata: {
            enqueuedAt: Date.now(),
            dedupKey,
          },
        },
        {
          attempts: Math.max(1, this.config.maxRetries || 3),
          backoff: {
            type: 'exponential',
            delay: Math.max(1000, this.config.retryDelayMs || 2000),
          },
          priority: normalizedAlert.severity === 'critical' ? 1 : 5,
        },
      )

      this.metrics.queued++
      return {
        queued: true,
        jobId: job.id,
        alertId: normalizedAlert.id,
      }
    }

    // Fire the dispatch asynchronously to avoid blocking callers
    setImmediate(async () => {
      try {
        await this.dispatchAlert(normalizedAlert, { origin: 'direct' })
      } catch (error) {
        console.error('Failed to dispatch alert notification:', error)
      }
    })

    return {
      dispatched: true,
      alertId: normalizedAlert.id,
    }
  }

  /**
   * Process a queued notification job (invoked from BullMQ worker)
   */
  async processQueuedNotification(jobPayload = {}) {
    if (!this.isEnabled()) {
      return {
        skipped: true,
        reason: 'disabled',
      }
    }

    const { alert } = jobPayload
    if (!alert) {
      throw new Error('Alert payload missing from job')
    }

    return await this.dispatchAlert(alert, { origin: 'queue' })
  }

  /**
   * Execute notification across configured channels
   */
  async dispatchAlert(alert, context = {}) {
    const channels = this.resolveChannels(alert)
    if (channels.length === 0) {
      return {
        dispatched: false,
        reason: 'no_channels',
      }
    }

    this.metrics.dispatched++
    this.metrics.lastDispatchAt = new Date().toISOString()

    const results = await Promise.allSettled(
      channels.map(channel => this.sendWithRetry(channel, alert, context)),
    )

    return {
      dispatched: true,
      channels: results.map((result, index) => ({
        channel: channels[index],
        status: result.status,
        data: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason?.message || String(result.reason) : null,
      })),
    }
  }

  /**
   * Resolve active channels for a given alert
   */
  resolveChannels(alert) {
    const channels = []

    if (this.shouldSendEmail(alert)) {
      channels.push('email')
    }

    if (this.shouldSendSlack(alert)) {
      channels.push('slack')
    }

    if (this.shouldSendPagerDuty(alert)) {
      channels.push('pagerDuty')
    }

    return channels
  }

  /**
   * Determine if email channel should be used for the alert
   */
  shouldSendEmail(alert) {
    if (!this.isChannelEnabled('email')) return false

    const recipients = this.config.channels?.email?.recipients || []
    if (!recipients.length) {
      this.markChannelFailure('email', new Error('Email channel misconfigured: no recipients'))
      return false
    }

    // Email reserved for critical incidents by default
    return (alert.severity || '').toLowerCase() === 'critical'
  }

  /**
   * Determine if Slack channel should be used for the alert
   */
  shouldSendSlack(alert) {
    if (!this.isChannelEnabled('slack')) return false
    if (!this.config.channels?.slack?.webhookUrl) {
      this.markChannelFailure('slack', new Error('Slack channel misconfigured: webhook URL missing'))
      return false
    }

    return true
  }

  /**
   * Determine if PagerDuty channel should be used for the alert
   */
  shouldSendPagerDuty(alert) {
    if (!this.isChannelEnabled('pagerDuty')) return false
    if (!this.config.channels?.pagerDuty?.integrationKey) {
      this.markChannelFailure('pagerDuty', new Error('PagerDuty channel misconfigured: integration key missing'))
      return false
    }

    return (alert.severity || '').toLowerCase() === 'critical'
  }

  /**
   * Send notification through a specific channel with retry handling
   */
  async sendWithRetry(channel, alert, context = {}) {
    const maxRetries = Math.max(1, this.config.maxRetries || 3)
    let attempt = 0
    let delay = Math.max(1000, this.config.retryDelayMs || 2000)
    const maxDelay = Math.max(delay, this.config.retryBackoffMs || delay * 3)

    while (attempt < maxRetries) {
      attempt++
      const start = Date.now()
      try {
        let result

        switch (channel) {
          case 'email':
            result = await this.sendEmailNotification(alert, context)
            break
          case 'slack':
            result = await this.sendSlackNotification(alert, context)
            break
          case 'pagerDuty':
            result = await this.sendPagerDutyNotification(alert, context)
            break
          default:
            throw new Error(`Unsupported notification channel: ${channel}`)
        }

        const latency = Date.now() - start
        this.markChannelSuccess(channel, latency)
        this.metrics.channelSuccess[channel]++
        return result
      } catch (error) {
        this.markChannelFailure(channel, error)
        this.metrics.channelFailures[channel]++

        if (attempt >= maxRetries) {
          throw error
        }

        await sleep(delay)
        delay = Math.min(delay * 2, maxDelay)
      }
    }
  }

  /**
   * Send HTML email notification
   */
  async sendEmailNotification(alert, context = {}) {
    const recipients = this.config.channels?.email?.recipients || []
    if (!recipients.length) {
      throw new Error('Email notification skipped: no recipients configured')
    }

    const subject = `${this.subjectPrefix(alert)} ${alert.message || alert.type}`
    const html = this.renderEmailTemplate(alert, context)
    const text = this.renderEmailText(alert, context)

    return await emailService.sendEmail({
      to: recipients.join(','),
      subject,
      html,
      text,
      template: 'alert-notification',
      data: {
        severity: alert.severity,
        type: alert.type,
        source: alert.source,
        queueName: alert.queueName,
      },
    })
  }

  /**
   * Send Slack notification via webhook
   */
  async sendSlackNotification(alert, context = {}) {
    const webhookUrl = this.config.channels?.slack?.webhookUrl
    if (!webhookUrl) {
      throw new Error('Slack webhook URL not configured')
    }

    const payload = this.buildSlackPayload(alert, context)
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const bodyText = await response.text().catch(() => 'unknown')
      throw new Error(`Slack webhook failed: ${response.status} ${response.statusText} - ${bodyText}`)
    }

    return {
      status: 'sent',
    }
  }

  /**
   * Send PagerDuty incident event
   */
  async sendPagerDutyNotification(alert, context = {}) {
    const integrationKey = this.config.channels?.pagerDuty?.integrationKey
    if (!integrationKey) {
      throw new Error('PagerDuty integration key not configured')
    }

    const payload = this.buildPagerDutyPayload(alert, context)
    const response = await fetch(PAGERDUTY_EVENTS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        routing_key: integrationKey,
        event_action: 'trigger',
        payload,
        dedup_key: alert.id,
        links: context.links || [],
      }),
    })

    if (!response.ok) {
      const bodyText = await response.text().catch(() => 'unknown')
      throw new Error(`PagerDuty API failed: ${response.status} ${response.statusText} - ${bodyText}`)
    }

    return {
      status: 'triggered',
    }
  }

  /**
   * Build Slack webhook payload
   */
  buildSlackPayload(alert, context = {}) {
    const severity = (alert.severity || 'info').toLowerCase()
    const color = slackColorForSeverity(severity)
    const channel = this.config.channels?.slack?.channel

    const fields = [
      {
        title: 'Severity',
        value: severity.toUpperCase(),
        short: true,
      },
      {
        title: 'Source',
        value: alert.source || 'queue-monitoring',
        short: true,
      },
    ]

    if (alert.queueName) {
      fields.push({
        title: 'Queue',
        value: alert.queueName,
        short: true,
      })
    }

    if (alert.count) {
      fields.push({
        title: 'Occurrences',
        value: String(alert.count),
        short: true,
      })
    }

    return {
      username: 'Truxe Alerts',
      icon_emoji: severity === 'critical' ? ':rotating_light:' : ':warning:',
      channel,
      attachments: [
        {
          fallback: `${severity.toUpperCase()} alert: ${alert.message}`,
          color,
          title: `${severity.toUpperCase()} | ${alert.type || 'Alert'}`,
          text: alert.message,
          ts: Math.floor(new Date(alert.createdAt || Date.now()).getTime() / 1000),
          fields,
          footer: 'Truxe Alerting',
          footer_icon: 'https://raw.githubusercontent.com/github/explore/main/topics/alert/alert.png',
        },
      ],
    }
  }

  /**
   * Build PagerDuty payload
   */
  buildPagerDutyPayload(alert, context = {}) {
    const severity = mapSeverityToPagerDuty(alert.severity)

    return {
      summary: `${severity.toUpperCase()} | ${alert.type || 'Alert'} - ${alert.message}`,
      source: this.config.channels?.pagerDuty?.source || 'heimdall-api',
      severity,
      component: alert.source || 'queue-monitoring',
      group: alert.queueName || 'queues',
      class: alert.type || 'generic',
      custom_details: {
        message: alert.message,
        queue: alert.queueName,
        metrics: alert.metrics || {},
        context,
        createdAt: alert.createdAt || new Date().toISOString(),
      },
    }
  }

  /**
   * Render HTML email template
   */
  renderEmailTemplate(alert, context = {}) {
    const severity = (alert.severity || 'info').toLowerCase()
    const color = slackColorForSeverity(severity)
    const timestamp = new Date(alert.createdAt || Date.now()).toLocaleString()

    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; background-color: #f6f8fa;">
        <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e1e4e8; overflow: hidden;">
          <div style="background: ${color}; padding: 16px 24px; color: #ffffff;">
            <h2 style="margin: 0; font-size: 20px;">${severity.toUpperCase()} Alert: ${alert.type || 'Queue Incident'}</h2>
          </div>
          <div style="padding: 24px;">
            <p style="font-size: 16px; color: #24292e; margin-top: 0;">${alert.message}</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
              <tbody>
                ${this.renderEmailRow('Severity', severity.toUpperCase())}
                ${this.renderEmailRow('Queue', alert.queueName || 'N/A')}
                ${this.renderEmailRow('Occurrences', alert.count ? String(alert.count) : '1')}
                ${this.renderEmailRow('Source', alert.source || 'queue-monitoring')}
                ${this.renderEmailRow('Timestamp', timestamp)}
              </tbody>
            </table>
            ${alert.metrics ? this.renderMetricsTable(alert.metrics) : ''}
            <p style="font-size: 12px; color: #586069; margin-top: 24px;">
              Sent by Truxe Alerting • Environment: ${config.app.environment}
            </p>
          </div>
        </div>
      </div>
    `
  }

  /**
   * Render plain text fallback for email
   */
  renderEmailText(alert) {
    const severity = (alert.severity || 'info').toUpperCase()
    const timestamp = new Date(alert.createdAt || Date.now()).toISOString()

    return [
      `${severity} Alert: ${alert.type || 'Queue Incident'}`,
      '',
      alert.message,
      '',
      `Severity: ${severity}`,
      `Queue: ${alert.queueName || 'N/A'}`,
      `Occurrences: ${alert.count ? String(alert.count) : '1'}`,
      `Source: ${alert.source || 'queue-monitoring'}`,
      `Timestamp: ${timestamp}`,
      '',
      'Sent by Truxe Alerting',
    ].join('\n')
  }

  /**
   * Render HTML metrics table
   */
  renderMetricsTable(metrics) {
    const rows = Object.entries(metrics || {}).map(([key, value]) => {
      return this.renderEmailRow(this.toTitleCase(key), String(value))
    }).join('')

    if (!rows) return ''

    return `
      <h3 style="font-size: 14px; color: #24292e; margin-top: 24px;">Metrics</h3>
      <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
        <tbody>
          ${rows}
        </tbody>
      </table>
    `
  }

  /**
   * Render simple key/value row for email content
   */
  renderEmailRow(key, value) {
    return `
      <tr>
        <td style="width: 160px; font-size: 13px; color: #586069; padding: 6px 0; font-weight: 600;">${key}</td>
        <td style="font-size: 13px; color: #24292e; padding: 6px 0;">${value}</td>
      </tr>
    `
  }

  /**
   * Convert snake_case or camelCase to Title Case
   */
  toTitleCase(value) {
    return value
      .replace(/([A-Z])/g, ' $1')
      .replace(/[_-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\w\S*/g, word => word.charAt(0).toUpperCase() + word.substr(1))
  }

  /**
   * Generate subject prefix based on severity
   */
  subjectPrefix(alert) {
    const severity = (alert.severity || 'info').toLowerCase()
    switch (severity) {
      case 'critical':
        return '🚨 CRITICAL'
      case 'error':
        return '❌ ERROR'
      case 'warning':
        return '⚠️ WARNING'
      default:
        return 'ℹ️ INFO'
    }
  }

  /**
   * Mark channel success
   */
  markChannelSuccess(channel, latencyMs) {
    const health = this.channelHealth[channel]
    if (!health) return

    health.status = 'healthy'
    health.lastSuccessAt = new Date().toISOString()
    health.consecutiveFailures = 0
    health.lastError = null
    health.lastFailureAt = null

    if (typeof latencyMs === 'number') {
      const previous = health.averageLatencyMs
      health.averageLatencyMs = previous == null
        ? latencyMs
        : Math.round(previous * 0.7 + latencyMs * 0.3)
    }
  }

  /**
   * Mark channel failure
   */
  markChannelFailure(channel, error) {
    const health = this.channelHealth[channel]
    if (!health) return

    health.status = this.isChannelEnabled(channel) ? 'degraded' : 'disabled'
    health.lastFailureAt = new Date().toISOString()
    health.lastError = error?.message || String(error)
    health.consecutiveFailures = (health.consecutiveFailures || 0) + 1
  }

  /**
   * Check if BullMQ should be used
   */
  shouldUseQueue() {
    return Boolean(this.features?.useBullMQQueues)
  }

  /**
   * Normalize alert payload
   */
  normalizeAlert(alert, options = {}) {
    const now = Date.now()
    return {
      id: alert.id || `alert-${now}-${randomUUID()}`,
      type: alert.type || 'queue.alert',
      severity: (alert.severity || 'info').toLowerCase(),
      message: alert.message || 'No message provided',
      source: alert.source || 'queue-monitoring',
      queueName: alert.queueName,
      metrics: alert.metrics || {},
      count: alert.count || 1,
      createdAt: alert.createdAt || new Date(now).toISOString(),
      timestamp: now,
      tags: alert.tags || options.tags || [],
    }
  }

  /**
   * Compute deduplication key for alert
   */
  getDeduplicationKey(alert) {
    const hash = createHash('sha1')
    hash.update(alert.type || '')
    hash.update(alert.queueName || '')
    hash.update(alert.severity || '')
    hash.update(alert.message || '')
    if (alert.metrics) {
      hash.update(JSON.stringify(alert.metrics))
    }
    return hash.digest('hex')
  }

  /**
   * Determine if alert already dispatched in deduplication window
   */
  isDuplicate(dedupKey) {
    if (!dedupKey) return false
    const existing = this.recentAlerts.get(dedupKey)
    if (!existing) return false

    const windowMs = this.config.deduplicationWindowMs || 300000
    return Date.now() - existing < windowMs
  }

  /**
   * Cleanup deduplication map
   */
  pruneDeduplicationWindow() {
    const windowMs = this.config.deduplicationWindowMs || 300000
    const cutoff = Date.now() - windowMs

    for (const [key, timestamp] of this.recentAlerts.entries()) {
      if (timestamp < cutoff) {
        this.recentAlerts.delete(key)
      }
    }
  }

  /**
   * Execute a synthetic alert to verify channels
   */
  async testNotifications(options = {}) {
    const severity = options.severity || 'critical'

    const testAlert = this.normalizeAlert({
      id: `alert-test-${Date.now()}`,
      type: 'alert.notifier.test',
      severity,
      message: options.message || 'Test alert notification from Heimdall',
      source: options.source || 'alert-notifier',
      queueName: options.queueName || 'diagnostics',
      metrics: {
        environment: config.app.environment,
        initiatedBy: options.initiatedBy || 'admin-test-endpoint',
        timestamp: new Date().toISOString(),
      },
      count: 1,
    }, { skipDedup: true })

    return await this.dispatchAlert(testAlert, { origin: 'test' })
  }

  /**
   * Retrieve service status
   */
  getStatus() {
    return {
      enabled: this.isEnabled(),
      deduplicationWindowMs: this.config.deduplicationWindowMs || 300000,
      maxRetries: this.config.maxRetries || 3,
      retryDelayMs: this.config.retryDelayMs || 2000,
      retryBackoffMs: this.config.retryBackoffMs || 10000,
      metrics: this.metrics,
      channelHealth: this.channelHealth,
      channels: {
        email: {
          enabled: this.isChannelEnabled('email'),
          recipients: (this.config.channels?.email?.recipients || []).length,
        },
        slack: {
          enabled: this.isChannelEnabled('slack'),
          webhookConfigured: Boolean(this.config.channels?.slack?.webhookUrl),
          channel: this.config.channels?.slack?.channel || null,
        },
        pagerDuty: {
          enabled: this.isChannelEnabled('pagerDuty'),
          integrationKeyConfigured: Boolean(this.config.channels?.pagerDuty?.integrationKey),
          source: this.config.channels?.pagerDuty?.source || null,
          service: this.config.channels?.pagerDuty?.service || null,
        },
      },
    }
  }
}

// Create singleton instance
const alertNotifier = new AlertNotifierService()

export default alertNotifier
