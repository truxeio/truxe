/**
 * Queue Monitoring and Alerting Service
 *
 * Monitors queue health and sends alerts when issues are detected.
 *
 * Alert Types:
 * - Queue depth alerts (>1000 jobs waiting)
 * - Failed job alerts (>10 failures)
 * - Worker down alerts (no active workers)
 * - Stale job alerts (jobs stuck for >30 min)
 */

import config from '../config/index.js'
import queueManager from './queue-manager.js'
import alertNotifier from './alert-notifier.js'

export class QueueMonitoringService {
  constructor() {
    this.enabled = config.features.useBullMQQueues || false
    this.alerts = []
    this.alertThresholds = {
      queueDepth: 1000,
      failedJobs: 10,
      staleJobMinutes: 30,
      workerInactiveMinutes: 5,
    }
    this.monitoringInterval = null
    this.checkIntervalMs = 60000 // Check every minute

    console.log(`Queue monitoring service initialized (enabled: ${this.enabled})`)
  }

  /**
   * Start monitoring
   */
  start() {
    if (!this.enabled) {
      console.log('Queue monitoring disabled (USE_BULLMQ_QUEUES=false)')
      return
    }

    // Run initial check
    this.checkQueues()

    // Schedule recurring checks
    this.monitoringInterval = setInterval(() => {
      this.checkQueues()
    }, this.checkIntervalMs)

    console.log(`✅ Queue monitoring started (interval: ${this.checkIntervalMs / 1000}s)`)
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
      console.log('Queue monitoring stopped')
    }
  }

  /**
   * Check all queues for issues
   */
  async checkQueues() {
    try {
      const allMetrics = await queueManager.getAllQueueMetrics()

      for (const metrics of allMetrics) {
        // Check queue depth
        if (metrics.waiting > this.alertThresholds.queueDepth) {
          this.createAlert({
            type: 'queue_depth',
            severity: 'warning',
            queueName: metrics.name,
            message: `Queue '${metrics.name}' has ${metrics.waiting} jobs waiting (threshold: ${this.alertThresholds.queueDepth})`,
            metrics: {
              waiting: metrics.waiting,
              threshold: this.alertThresholds.queueDepth,
            },
          })
        }

        // Check failed jobs
        if (metrics.failed > this.alertThresholds.failedJobs) {
          this.createAlert({
            type: 'failed_jobs',
            severity: 'error',
            queueName: metrics.name,
            message: `Queue '${metrics.name}' has ${metrics.failed} failed jobs (threshold: ${this.alertThresholds.failedJobs})`,
            metrics: {
              failed: metrics.failed,
              threshold: this.alertThresholds.failedJobs,
            },
          })
        }

        // Check if queue is paused unexpectedly
        if (metrics.paused && metrics.waiting > 0) {
          this.createAlert({
            type: 'queue_paused',
            severity: 'warning',
            queueName: metrics.name,
            message: `Queue '${metrics.name}' is paused with ${metrics.waiting} jobs waiting`,
            metrics: {
              waiting: metrics.waiting,
              paused: true,
            },
          })
        }

        // Check for no active workers
        if (metrics.waiting > 0 && metrics.active === 0) {
          this.createAlert({
            type: 'no_workers',
            severity: 'critical',
            queueName: metrics.name,
            message: `Queue '${metrics.name}' has ${metrics.waiting} jobs but no active workers`,
            metrics: {
              waiting: metrics.waiting,
              active: metrics.active,
            },
          })
        }
      }

      // Clean old alerts (older than 1 hour)
      this.cleanOldAlerts()
    } catch (error) {
      console.error('Queue monitoring check failed:', error.message)
    }
  }

  /**
   * Create an alert
   * @param {Object} alert - Alert details
   */
  createAlert(alert) {
    const existingAlert = this.alerts.find(
      a => a.type === alert.type && a.queueName === alert.queueName && a.resolved === false
    )

    if (existingAlert) {
      // Update existing alert
      existingAlert.count = (existingAlert.count || 1) + 1
      existingAlert.lastOccurrence = new Date().toISOString()
      existingAlert.metrics = alert.metrics
    } else {
      // Create new alert
      const newAlert = {
        id: `${alert.type}-${alert.queueName}-${Date.now()}`,
        ...alert,
        count: 1,
        createdAt: new Date().toISOString(),
        lastOccurrence: new Date().toISOString(),
        resolved: false,
      }

      this.alerts.push(newAlert)

      // Log alert
      this.logAlert(newAlert)

      // Send notification (integrate with monitoring service)
      this.sendNotification(newAlert)
    }
  }

  /**
   * Log alert to console
   */
  logAlert(alert) {
    const severityEmoji = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌',
      critical: '🚨',
    }

    console.log(`\n${severityEmoji[alert.severity]} Queue Alert [${alert.severity.toUpperCase()}]`)
    console.log(`  Type: ${alert.type}`)
    console.log(`  Queue: ${alert.queueName}`)
    console.log(`  Message: ${alert.message}`)
    console.log(`  Time: ${alert.createdAt}`)
    console.log()
  }

  /**
   * Send notification (placeholder for integration)
   */
  async sendNotification(alert) {
    try {
      const result = await alertNotifier.notify({
        ...alert,
        source: 'queue-monitoring',
        tags: ['queue-monitoring', alert.severity],
      })

      if (result?.queued) {
        console.log(`📬 Alert queued for notification delivery (job: ${result.jobId})`)
      } else if (result?.skipped) {
        console.log(`ℹ️ Alert notification skipped (${result.reason})`)
      }
    } catch (error) {
      console.error('Failed to send notification:', error.message)
    }
  }

  /**
   * Resolve an alert
   * @param {string} alertId - Alert ID
   */
  resolveAlert(alertId) {
    const alert = this.alerts.find(a => a.id === alertId)
    if (alert) {
      alert.resolved = true
      alert.resolvedAt = new Date().toISOString()
      console.log(`✅ Alert resolved: ${alertId}`)
    }
  }

  /**
   * Clean old alerts (older than 1 hour)
   */
  cleanOldAlerts() {
    const oneHourAgo = Date.now() - 3600000
    const before = this.alerts.length

    this.alerts = this.alerts.filter(alert => {
      const alertTime = new Date(alert.lastOccurrence).getTime()
      return alertTime > oneHourAgo || !alert.resolved
    })

    const removed = before - this.alerts.length
    if (removed > 0) {
      console.log(`🧹 Cleaned ${removed} old alerts`)
    }
  }

  /**
   * Get all alerts
   * @param {Object} options - Filter options
   * @returns {Array} List of alerts
   */
  getAlerts(options = {}) {
    let alerts = [...this.alerts]

    // Filter by resolved status
    if (options.resolved !== undefined) {
      alerts = alerts.filter(a => a.resolved === options.resolved)
    }

    // Filter by severity
    if (options.severity) {
      alerts = alerts.filter(a => a.severity === options.severity)
    }

    // Filter by queue
    if (options.queueName) {
      alerts = alerts.filter(a => a.queueName === options.queueName)
    }

    // Sort by severity and time
    const severityOrder = { critical: 0, error: 1, warning: 2, info: 3 }
    alerts.sort((a, b) => {
      if (a.severity !== b.severity) {
        return severityOrder[a.severity] - severityOrder[b.severity]
      }
      return new Date(b.lastOccurrence) - new Date(a.lastOccurrence)
    })

    return alerts
  }

  /**
   * Get alert statistics
   * @returns {Object} Alert statistics
   */
  getAlertStats() {
    const stats = {
      total: this.alerts.length,
      active: this.alerts.filter(a => !a.resolved).length,
      resolved: this.alerts.filter(a => a.resolved).length,
      bySeverity: {
        critical: this.alerts.filter(a => a.severity === 'critical' && !a.resolved).length,
        error: this.alerts.filter(a => a.severity === 'error' && !a.resolved).length,
        warning: this.alerts.filter(a => a.severity === 'warning' && !a.resolved).length,
        info: this.alerts.filter(a => a.severity === 'info' && !a.resolved).length,
      },
      byType: {},
    }

    // Count by type
    this.alerts.forEach(alert => {
      if (!alert.resolved) {
        stats.byType[alert.type] = (stats.byType[alert.type] || 0) + 1
      }
    })

    return stats
  }

  /**
   * Update alert thresholds
   * @param {Object} thresholds - New threshold values
   */
  updateThresholds(thresholds) {
    this.alertThresholds = {
      ...this.alertThresholds,
      ...thresholds,
    }

    console.log('Alert thresholds updated:', this.alertThresholds)
  }

  /**
   * Get current thresholds
   * @returns {Object} Current threshold values
   */
  getThresholds() {
    return { ...this.alertThresholds }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      if (!this.enabled) {
        return {
          status: 'disabled',
          message: 'Queue monitoring is disabled',
        }
      }

      const stats = this.getAlertStats()
      const isHealthy = stats.bySeverity.critical === 0 && stats.bySeverity.error < 5

      return {
        status: isHealthy ? 'healthy' : 'degraded',
        monitoring: {
          enabled: true,
          intervalSeconds: this.checkIntervalMs / 1000,
        },
        alerts: stats,
        thresholds: this.alertThresholds,
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
      }
    }
  }
}

// Create singleton instance
const queueMonitoringService = new QueueMonitoringService()

// Export singleton
export default queueMonitoringService
