/**
 * Monitoring and Alerting Service
 * 
 * Provides comprehensive monitoring for:
 * - Rate limiting violations and patterns
 * - Security threat detection and analysis
 * - Performance metrics and SLA monitoring
 * - Real-time alerting and notifications
 * - Health status aggregation
 */

import Redis from 'ioredis'
import config from '../config/index.js'

/**
 * Monitoring Service Class
 */
export class MonitoringService {
  constructor() {
    this.redis = new Redis(config.redis.url, {
      keyPrefix: config.redis.keyPrefix + 'monitoring:',
      retryDelayOnFailover: config.redis.retryDelayOnFailover,
      maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
      lazyConnect: true,
    })
    
    // Metrics storage
    this.metrics = {
      // Rate limiting metrics
      rateLimitViolations: 0,
      blockedRequests: 0,
      ddosAttacksDetected: 0,
      
      // Security metrics
      securityThreats: 0,
      criticalThreats: 0,
      ipBlocks: 0,
      
      // Performance metrics
      averageResponseTime: 0,
      requestCount: 0,
      errorRate: 0,
      
      // System health
      systemStatus: 'healthy',
      lastHealthCheck: Date.now(),
      
      // Alerts
      activeAlerts: 0,
      alertsSent: 0
    }
    
    // Alert thresholds
    this.alertThresholds = {
      rateLimitViolationsPerMinute: 100,
      ddosAttacksPerHour: 5,
      securityThreatsPerMinute: 50,
      errorRatePercent: 5,
      averageResponseTimeMs: 1000,
      blockedRequestsPerMinute: 200
    }
    
    // Alert channels configuration
    this.alertChannels = {
      webhook: process.env.ALERT_WEBHOOK_URL,
      email: process.env.ALERT_EMAIL,
      slack: process.env.SLACK_WEBHOOK_URL
    }
    
    // Start monitoring
    this.startMonitoring()
  }
  
  /**
   * Record rate limiting event
   */
  async recordRateLimitEvent(eventData) {
    try {
      const {
        type, // 'violation', 'block', 'ddos'
        ip,
        userId,
        endpoint,
        limitType,
        count,
        limit,
        timestamp = Date.now()
      } = eventData
      
      // Update metrics
      this.metrics.rateLimitViolations++
      if (type === 'block') {
        this.metrics.blockedRequests++
      }
      if (type === 'ddos') {
        this.metrics.ddosAttacksDetected++
      }
      
      // Store detailed event
      const eventKey = `rate_limit_event:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`
      await this.redis.setex(eventKey, 86400, JSON.stringify({ // Store for 24 hours
        type,
        ip,
        userId,
        endpoint,
        limitType,
        count,
        limit,
        timestamp
      }))
      
      // Update time-series data
      await this.updateTimeSeries('rate_limit_violations', timestamp)
      
      // Check alert thresholds
      await this.checkRateLimitAlerts()
      
    } catch (error) {
      console.error('Failed to record rate limit event:', error.message)
    }
  }
  
  /**
   * Record security threat event
   */
  async recordSecurityEvent(eventData) {
    try {
      const {
        type, // 'threat_detected', 'ip_blocked', 'attack_pattern'
        riskLevel, // 'low', 'medium', 'high', 'critical'
        ip,
        userAgent,
        threats,
        endpoint,
        timestamp = Date.now()
      } = eventData
      
      // Update metrics
      this.metrics.securityThreats++
      if (riskLevel === 'critical') {
        this.metrics.criticalThreats++
      }
      
      // Store detailed event
      const eventKey = `security_event:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`
      await this.redis.setex(eventKey, 86400, JSON.stringify({ // Store for 24 hours
        type,
        riskLevel,
        ip,
        userAgent: userAgent?.substring(0, 200), // Truncate long user agents
        threats,
        endpoint,
        timestamp
      }))
      
      // Update time-series data
      await this.updateTimeSeries('security_threats', timestamp)
      if (riskLevel === 'critical') {
        await this.updateTimeSeries('critical_threats', timestamp)
      }
      
      // Check alert thresholds
      await this.checkSecurityAlerts(eventData)
      
    } catch (error) {
      console.error('Failed to record security event:', error.message)
    }
  }
  
  /**
   * Record webhook delivery metrics
   */
  async recordWebhookDelivery(deliveryData) {
    try {
      const {
        success,
        status,
        duration,
        endpointId,
        eventType,
        timestamp = Date.now()
      } = deliveryData
      
      // Update webhook-specific metrics
      if (success) {
        this.metrics.webhookDeliveries = (this.metrics.webhookDeliveries || 0) + 1
        this.metrics.successfulWebhookDeliveries = (this.metrics.successfulWebhookDeliveries || 0) + 1
      } else {
        this.metrics.failedWebhookDeliveries = (this.metrics.failedWebhookDeliveries || 0) + 1
      }
      
      // Store time-series data
      await this.updateTimeSeries('webhook_deliveries', timestamp)
      if (success) {
        await this.updateTimeSeries('successful_webhook_deliveries', timestamp)
      } else {
        await this.updateTimeSeries('failed_webhook_deliveries', timestamp)
      }
      
      // Store delivery time metrics
      if (duration) {
        await this.updateTimeSeries('webhook_delivery_times', timestamp, duration)
      }
      
      // Store event type metrics
      if (eventType) {
        await this.updateTimeSeries(`webhook_events_${eventType}`, timestamp)
      }
      
      this.emit('webhook_delivery', {
        success,
        status,
        duration,
        endpointId,
        eventType,
        timestamp
      })
      
    } catch (error) {
      console.error('Failed to record webhook delivery metric:', error.message)
    }
  }
  
  /**
   * Record performance metrics
   */
  async recordPerformanceMetric(metricData) {
    try {
      const {
        responseTime,
        statusCode,
        endpoint,
        timestamp = Date.now()
      } = metricData
      
      // Update running averages
      this.metrics.requestCount++
      this.metrics.averageResponseTime = (
        (this.metrics.averageResponseTime * (this.metrics.requestCount - 1) + responseTime) /
        this.metrics.requestCount
      )
      
      // Update error rate
      if (statusCode >= 400) {
        this.metrics.errorRate = (
          (this.metrics.errorRate * (this.metrics.requestCount - 1) + 1) /
          this.metrics.requestCount
        ) * 100
      }
      
      // Store time-series data
      await this.updateTimeSeries('response_times', timestamp, responseTime)
      await this.updateTimeSeries('request_count', timestamp)
      
      if (statusCode >= 400) {
        await this.updateTimeSeries('error_count', timestamp)
      }
      
      // Check performance alerts
      await this.checkPerformanceAlerts()
      
    } catch (error) {
      console.error('Failed to record performance metric:', error.message)
    }
  }
  
  /**
   * Update time-series data in Redis
   */
  async updateTimeSeries(metric, timestamp, value = 1) {
    try {
      const minute = Math.floor(timestamp / 60000) * 60000
      const hour = Math.floor(timestamp / 3600000) * 3600000
      const day = Math.floor(timestamp / 86400000) * 86400000
      
      // Store minute-level data (keep for 1 hour)
      const minuteKey = `timeseries:${metric}:minute:${minute}`
      await this.redis.incrby(minuteKey, value)
      await this.redis.expire(minuteKey, 3600)
      
      // Store hour-level data (keep for 24 hours)
      const hourKey = `timeseries:${metric}:hour:${hour}`
      await this.redis.incrby(hourKey, value)
      await this.redis.expire(hourKey, 86400)
      
      // Store day-level data (keep for 30 days)
      const dayKey = `timeseries:${metric}:day:${day}`
      await this.redis.incrby(dayKey, value)
      await this.redis.expire(dayKey, 2592000)
      
    } catch (error) {
      console.error('Failed to update time series:', error.message)
    }
  }
  
  /**
   * Get time-series data
   */
  async getTimeSeries(metric, granularity = 'minute', count = 60) {
    try {
      const now = Date.now()
      const interval = granularity === 'minute' ? 60000 : granularity === 'hour' ? 3600000 : 86400000
      
      const data = []
      
      for (let i = count - 1; i >= 0; i--) {
        const timestamp = Math.floor((now - (i * interval)) / interval) * interval
        const key = `timeseries:${metric}:${granularity}:${timestamp}`
        const value = await this.redis.get(key)
        
        data.push({
          timestamp,
          value: parseInt(value) || 0
        })
      }
      
      return data
    } catch (error) {
      console.error('Failed to get time series:', error.message)
      return []
    }
  }
  
  /**
   * Check rate limiting alert thresholds
   */
  async checkRateLimitAlerts() {
    try {
      const now = Date.now()
      const oneMinuteAgo = now - 60000
      
      // Get recent violations count
      const recentViolations = await this.getTimeSeriesSum('rate_limit_violations', oneMinuteAgo, now)
      
      if (recentViolations > this.alertThresholds.rateLimitViolationsPerMinute) {
        await this.sendAlert({
          type: 'rate_limit_spike',
          severity: 'high',
          message: `High rate limit violations: ${recentViolations} in the last minute`,
          data: { violations: recentViolations, threshold: this.alertThresholds.rateLimitViolationsPerMinute }
        })
      }
      
      // Check for DDoS attacks
      const oneHourAgo = now - 3600000
      const recentDDoS = await this.getTimeSeriesSum('rate_limit_violations', oneHourAgo, now)
      
      if (recentDDoS > this.alertThresholds.ddosAttacksPerHour) {
        await this.sendAlert({
          type: 'ddos_attack',
          severity: 'critical',
          message: `Potential DDoS attack detected: ${recentDDoS} violations in the last hour`,
          data: { attacks: recentDDoS, threshold: this.alertThresholds.ddosAttacksPerHour }
        })
      }
      
    } catch (error) {
      console.error('Failed to check rate limit alerts:', error.message)
    }
  }
  
  /**
   * Check security alert thresholds
   */
  async checkSecurityAlerts(eventData) {
    try {
      // Immediate alert for critical threats
      if (eventData.riskLevel === 'critical') {
        await this.sendAlert({
          type: 'critical_security_threat',
          severity: 'critical',
          message: `Critical security threat detected from IP ${eventData.ip}`,
          data: {
            ip: eventData.ip,
            threats: eventData.threats,
            endpoint: eventData.endpoint
          }
        })
      }
      
      // Check for threat patterns
      const now = Date.now()
      const oneMinuteAgo = now - 60000
      const recentThreats = await this.getTimeSeriesSum('security_threats', oneMinuteAgo, now)
      
      if (recentThreats > this.alertThresholds.securityThreatsPerMinute) {
        await this.sendAlert({
          type: 'security_threat_spike',
          severity: 'high',
          message: `High security threat activity: ${recentThreats} threats in the last minute`,
          data: { threats: recentThreats, threshold: this.alertThresholds.securityThreatsPerMinute }
        })
      }
      
    } catch (error) {
      console.error('Failed to check security alerts:', error.message)
    }
  }
  
  /**
   * Check performance alert thresholds
   */
  async checkPerformanceAlerts() {
    try {
      // Check error rate
      if (this.metrics.errorRate > this.alertThresholds.errorRatePercent) {
        await this.sendAlert({
          type: 'high_error_rate',
          severity: 'medium',
          message: `High error rate: ${this.metrics.errorRate.toFixed(2)}%`,
          data: { errorRate: this.metrics.errorRate, threshold: this.alertThresholds.errorRatePercent }
        })
      }
      
      // Check response time
      if (this.metrics.averageResponseTime > this.alertThresholds.averageResponseTimeMs) {
        await this.sendAlert({
          type: 'slow_response_time',
          severity: 'medium',
          message: `Slow response times: ${this.metrics.averageResponseTime.toFixed(0)}ms average`,
          data: { responseTime: this.metrics.averageResponseTime, threshold: this.alertThresholds.averageResponseTimeMs }
        })
      }
      
    } catch (error) {
      console.error('Failed to check performance alerts:', error.message)
    }
  }
  
  /**
   * Send alert through configured channels
   */
  async sendAlert(alertData) {
    try {
      const alert = {
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...alertData,
        timestamp: Date.now(),
        service: 'truxe-api',
        environment: config.app.environment
      }
      
      // Store alert
      await this.redis.setex(`alert:${alert.id}`, 86400, JSON.stringify(alert))
      
      // Update metrics
      this.metrics.activeAlerts++
      this.metrics.alertsSent++
      
      // Log alert
      console.error('ALERT:', alert)
      
      // Send to webhook if configured
      if (this.alertChannels.webhook) {
        await this.sendWebhookAlert(alert)
      }
      
      // Send to Slack if configured
      if (this.alertChannels.slack) {
        await this.sendSlackAlert(alert)
      }
      
      // In production, you would also send email alerts, PagerDuty, etc.
      
    } catch (error) {
      console.error('Failed to send alert:', error.message)
    }
  }
  
  /**
   * Send webhook alert
   */
  async sendWebhookAlert(alert) {
    try {
      const response = await fetch(this.alertChannels.webhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Truxe-Monitoring/1.0'
        },
        body: JSON.stringify(alert)
      })
      
      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status} ${response.statusText}`)
      }
      
    } catch (error) {
      console.error('Failed to send webhook alert:', error.message)
    }
  }
  
  /**
   * Send Slack alert
   */
  async sendSlackAlert(alert) {
    try {
      const color = {
        'low': '#36a64f',
        'medium': '#ff9500',
        'high': '#ff0000',
        'critical': '#8b0000'
      }[alert.severity] || '#36a64f'
      
      const slackPayload = {
        username: 'Truxe Monitor',
        icon_emoji: ':shield:',
        attachments: [{
          color,
          title: `${alert.severity.toUpperCase()}: ${alert.type}`,
          text: alert.message,
          fields: [
            {
              title: 'Service',
              value: alert.service,
              short: true
            },
            {
              title: 'Environment',
              value: alert.environment,
              short: true
            },
            {
              title: 'Time',
              value: new Date(alert.timestamp).toISOString(),
              short: false
            }
          ],
          ts: Math.floor(alert.timestamp / 1000)
        }]
      }
      
      const response = await fetch(this.alertChannels.slack, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(slackPayload)
      })
      
      if (!response.ok) {
        throw new Error(`Slack webhook failed: ${response.status} ${response.statusText}`)
      }
      
    } catch (error) {
      console.error('Failed to send Slack alert:', error.message)
    }
  }
  
  /**
   * Get time-series sum for a time range
   */
  async getTimeSeriesSum(metric, startTime, endTime) {
    try {
      let sum = 0
      const interval = 60000 // 1 minute intervals
      
      for (let timestamp = startTime; timestamp < endTime; timestamp += interval) {
        const minute = Math.floor(timestamp / 60000) * 60000
        const key = `timeseries:${metric}:minute:${minute}`
        const value = await this.redis.get(key)
        sum += parseInt(value) || 0
      }
      
      return sum
    } catch (error) {
      console.error('Failed to get time series sum:', error.message)
      return 0
    }
  }
  
  /**
   * Get comprehensive monitoring dashboard data
   */
  async getDashboardData() {
    try {
      const now = Date.now()
      
      // Get recent time-series data
      const rateLimitViolations = await this.getTimeSeries('rate_limit_violations', 'minute', 60)
      const securityThreats = await this.getTimeSeries('security_threats', 'minute', 60)
      const responseTimes = await this.getTimeSeries('response_times', 'minute', 60)
      const requestCounts = await this.getTimeSeries('request_count', 'minute', 60)
      
      // Get recent alerts
      const alertKeys = await this.redis.keys('alert:*')
      const recentAlerts = []
      
      for (const key of alertKeys.slice(0, 10)) { // Limit to 10 most recent
        const alertData = await this.redis.get(key)
        if (alertData) {
          recentAlerts.push(JSON.parse(alertData))
        }
      }
      
      recentAlerts.sort((a, b) => b.timestamp - a.timestamp)
      
      return {
        metrics: this.metrics,
        timeSeries: {
          rateLimitViolations,
          securityThreats,
          responseTimes,
          requestCounts
        },
        alerts: recentAlerts,
        thresholds: this.alertThresholds,
        lastUpdated: now
      }
      
    } catch (error) {
      console.error('Failed to get dashboard data:', error.message)
      return {
        error: error.message,
        metrics: this.metrics,
        lastUpdated: Date.now()
      }
    }
  }
  
  /**
   * Start background monitoring tasks
   */
  startMonitoring() {
    // Reset metrics every hour
    setInterval(() => {
      this.metrics = {
        ...this.metrics,
        rateLimitViolations: 0,
        blockedRequests: 0,
        securityThreats: 0,
        criticalThreats: 0,
        averageResponseTime: 0,
        requestCount: 0,
        errorRate: 0,
        activeAlerts: 0
      }
    }, 3600000)
    
    // Health check every 30 seconds
    setInterval(async () => {
      try {
        await this.redis.ping()
        this.metrics.systemStatus = 'healthy'
        this.metrics.lastHealthCheck = Date.now()
      } catch (error) {
        this.metrics.systemStatus = 'unhealthy'
        console.error('Health check failed:', error.message)
      }
    }, 30000)
    
    console.log('Monitoring service started')
  }
  
  /**
   * Get service health status
   */
  async getHealthStatus() {
    try {
      await this.redis.ping()
      
      return {
        status: 'healthy',
        metrics: this.metrics,
        redis: {
          connected: true,
          lastHealthCheck: this.metrics.lastHealthCheck
        },
        alertChannels: {
          webhook: !!this.alertChannels.webhook,
          slack: !!this.alertChannels.slack,
          email: !!this.alertChannels.email
        }
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        redis: {
          connected: false
        }
      }
    }
  }
}

// Create singleton instance
const monitoringService = new MonitoringService()

// Export singleton and class
export default monitoringService
