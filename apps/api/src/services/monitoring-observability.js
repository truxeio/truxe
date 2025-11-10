/**
 * Truxe Monitoring & Observability Service
 * 
 * Enterprise-grade monitoring, logging, and observability system providing
 * Application Performance Monitoring (APM), business metrics, error tracking,
 * infrastructure monitoring, and comprehensive alerting for production environments.
 * 
 * @author Observability Engineering Team
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { createLogger, format, transports } from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';
import prometheus from 'prom-client';
import config from '../config/index.js';

/**
 * Alert Severity Levels
 */
export const AlertSeverity = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical',
  FATAL: 'fatal'
};

/**
 * Metric Types
 */
export const MetricType = {
  COUNTER: 'counter',
  GAUGE: 'gauge',
  HISTOGRAM: 'histogram',
  SUMMARY: 'summary'
};

/**
 * Business Event Types
 */
export const BusinessEventType = {
  USER_REGISTRATION: 'user_registration',
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  MAGIC_LINK_SENT: 'magic_link_sent',
  MAGIC_LINK_VERIFIED: 'magic_link_verified',
  SESSION_CREATED: 'session_created',
  SESSION_REVOKED: 'session_revoked',
  ORGANIZATION_CREATED: 'organization_created',
  ORGANIZATION_UPDATED: 'organization_updated',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  SECURITY_VIOLATION: 'security_violation',
  ERROR_OCCURRED: 'error_occurred'
};

/**
 * Monitoring & Observability Service
 */
export class MonitoringObservabilityService extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      // Logging configuration
      logLevel: options.logLevel || 'info',
      enableStructuredLogging: options.enableStructuredLogging !== false,
      enableElasticsearch: options.enableElasticsearch || false,
      elasticsearchUrl: options.elasticsearchUrl || 'http://localhost:9200',
      
      // Metrics configuration
      enablePrometheus: options.enablePrometheus !== false,
      metricsPrefix: options.metricsPrefix || 'truxe_',
      collectDefaultMetrics: options.collectDefaultMetrics !== false,
      
      // APM configuration
      enableAPM: options.enableAPM !== false,
      apmServiceName: options.apmServiceName || 'truxe-api',
      apmServiceVersion: options.apmServiceVersion || '1.0.0',
      
      // Business metrics
      enableBusinessMetrics: options.enableBusinessMetrics !== false,
      businessMetricsRetention: options.businessMetricsRetention || 86400000, // 24 hours
      
      // Alerting configuration
      enableAlerting: options.enableAlerting !== false,
      alertingChannels: options.alertingChannels || ['log', 'webhook'],
      webhookUrl: options.webhookUrl,
      slackWebhookUrl: options.slackWebhookUrl,
      
      // Infrastructure monitoring
      enableInfrastructureMonitoring: options.enableInfrastructureMonitoring !== false,
      monitoringInterval: options.monitoringInterval || 30000, // 30 seconds
      
      ...options
    };

    this.logger = null;
    this.prometheusRegistry = null;
    this.metrics = new Map();
    this.businessEvents = [];
    this.alerts = [];
    this.healthChecks = new Map();
    
    this.initialize();
  }

  /**
   * Initialize monitoring and observability
   */
  async initialize() {
    try {
      // Initialize structured logging
      await this.initializeLogging();
      
      // Initialize Prometheus metrics
      if (this.options.enablePrometheus) {
        await this.initializePrometheus();
      }
      
      // Initialize APM
      if (this.options.enableAPM) {
        await this.initializeAPM();
      }
      
      // Initialize business metrics
      if (this.options.enableBusinessMetrics) {
        await this.initializeBusinessMetrics();
      }
      
      // Initialize infrastructure monitoring
      if (this.options.enableInfrastructureMonitoring) {
        await this.initializeInfrastructureMonitoring();
      }
      
      // Start monitoring loops
      this.startMonitoring();
      
      this.emit('initialized');
      this.logger?.info('Monitoring and observability service initialized');
    } catch (error) {
      this.emit('initialization_error', error);
      console.error('Failed to initialize monitoring service:', error);
      throw error;
    }
  }

  /**
   * Initialize structured logging
   */
  async initializeLogging() {
    const loggerTransports = [
      new transports.Console({
        format: format.combine(
          format.colorize(),
          format.timestamp(),
          format.errors({ stack: true }),
          format.printf(({ timestamp, level, message, ...meta }) => {
            return `${timestamp} [${level}]: ${message} ${
              Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
            }`;
          })
        )
      })
    ];

    // Add file transports if logs directory is writable
    try {
      const fs = await import('fs');
      const path = await import('path');
      const logsDir = path.resolve(process.cwd(), 'logs');

      // Try to create logs directory if it doesn't exist
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      // Add file transports
      loggerTransports.push(
        new transports.File({
          filename: 'logs/error.log',
          level: 'error',
          format: format.combine(
            format.timestamp(),
            format.errors({ stack: true }),
            format.json()
          )
        }),
        new transports.File({
          filename: 'logs/combined.log',
          format: format.combine(
            format.timestamp(),
            format.errors({ stack: true }),
            format.json()
          )
        })
      );
    } catch (error) {
      console.warn('File logging disabled - logs directory not writable:', error.message);
      console.warn('Continuing with console logging only');
    }

    // Add Elasticsearch transport if enabled
    if (this.options.enableElasticsearch) {
      loggerTransports.push(
        new ElasticsearchTransport({
          level: 'info',
          clientOpts: {
            node: this.options.elasticsearchUrl
          },
          index: `truxe-logs-${new Date().toISOString().slice(0, 10)}`,
          transformer: (logData) => {
            return {
              '@timestamp': new Date().toISOString(),
              severity: logData.level,
              message: logData.message,
              service: 'truxe-api',
              environment: config.app.environment,
              ...logData.meta
            };
          }
        })
      );
    }

    this.logger = createLogger({
      level: this.options.logLevel,
      format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.json()
      ),
      transports: loggerTransports,
      exceptionHandlers: [
        new transports.File({ filename: 'logs/exceptions.log' })
      ],
      rejectionHandlers: [
        new transports.File({ filename: 'logs/rejections.log' })
      ]
    });
  }

  /**
   * Initialize Prometheus metrics
   */
  async initializePrometheus() {
    this.prometheusRegistry = new prometheus.Registry();
    
    // Collect default metrics if enabled
    if (this.options.collectDefaultMetrics) {
      prometheus.collectDefaultMetrics({
        register: this.prometheusRegistry,
        prefix: this.options.metricsPrefix
      });
    }

    // Initialize custom metrics
    this.initializeCustomMetrics();
  }

  /**
   * Initialize custom Prometheus metrics
   */
  initializeCustomMetrics() {
    // HTTP request metrics
    this.metrics.set('http_requests_total', new prometheus.Counter({
      name: `${this.options.metricsPrefix}http_requests_total`,
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.prometheusRegistry]
    }));

    this.metrics.set('http_request_duration', new prometheus.Histogram({
      name: `${this.options.metricsPrefix}http_request_duration_seconds`,
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.prometheusRegistry]
    }));

    // Authentication metrics
    this.metrics.set('auth_requests_total', new prometheus.Counter({
      name: `${this.options.metricsPrefix}auth_requests_total`,
      help: 'Total authentication requests',
      labelNames: ['type', 'status'],
      registers: [this.prometheusRegistry]
    }));

    this.metrics.set('active_sessions', new prometheus.Gauge({
      name: `${this.options.metricsPrefix}active_sessions`,
      help: 'Number of active user sessions',
      registers: [this.prometheusRegistry]
    }));

    // Database metrics
    this.metrics.set('db_queries_total', new prometheus.Counter({
      name: `${this.options.metricsPrefix}db_queries_total`,
      help: 'Total database queries',
      labelNames: ['operation', 'status'],
      registers: [this.prometheusRegistry]
    }));

    this.metrics.set('db_query_duration', new prometheus.Histogram({
      name: `${this.options.metricsPrefix}db_query_duration_seconds`,
      help: 'Database query duration in seconds',
      labelNames: ['operation'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2],
      registers: [this.prometheusRegistry]
    }));

    this.metrics.set('db_connections_active', new prometheus.Gauge({
      name: `${this.options.metricsPrefix}db_connections_active`,
      help: 'Active database connections',
      registers: [this.prometheusRegistry]
    }));

    // Cache metrics
    this.metrics.set('cache_operations_total', new prometheus.Counter({
      name: `${this.options.metricsPrefix}cache_operations_total`,
      help: 'Total cache operations',
      labelNames: ['operation', 'result'],
      registers: [this.prometheusRegistry]
    }));

    this.metrics.set('cache_hit_ratio', new prometheus.Gauge({
      name: `${this.options.metricsPrefix}cache_hit_ratio`,
      help: 'Cache hit ratio',
      registers: [this.prometheusRegistry]
    }));

    // Business metrics
    this.metrics.set('users_registered_total', new prometheus.Counter({
      name: `${this.options.metricsPrefix}users_registered_total`,
      help: 'Total users registered',
      registers: [this.prometheusRegistry]
    }));

    this.metrics.set('magic_links_sent_total', new prometheus.Counter({
      name: `${this.options.metricsPrefix}magic_links_sent_total`,
      help: 'Total magic links sent',
      registers: [this.prometheusRegistry]
    }));

    // Error metrics
    this.metrics.set('errors_total', new prometheus.Counter({
      name: `${this.options.metricsPrefix}errors_total`,
      help: 'Total errors',
      labelNames: ['type', 'severity'],
      registers: [this.prometheusRegistry]
    }));

    // Rate limiting metrics
    this.metrics.set('rate_limit_exceeded_total', new prometheus.Counter({
      name: `${this.options.metricsPrefix}rate_limit_exceeded_total`,
      help: 'Total rate limit exceeded events',
      labelNames: ['endpoint', 'limit_type'],
      registers: [this.prometheusRegistry]
    }));
  }

  /**
   * Initialize APM
   */
  async initializeAPM() {
    // This would integrate with APM services like Elastic APM, New Relic, or Datadog
    // For now, we'll implement basic APM functionality
    
    this.apmTraces = [];
    this.apmMetrics = {
      serviceName: this.options.apmServiceName,
      serviceVersion: this.options.apmServiceVersion,
      environment: config.app.environment,
      startTime: Date.now()
    };
  }

  /**
   * Initialize business metrics
   */
  async initializeBusinessMetrics() {
    // Set up business event tracking
    this.businessMetrics = {
      dailyActiveUsers: new Set(),
      monthlyActiveUsers: new Set(),
      organizationsCreated: 0,
      magicLinksSuccess: 0,
      magicLinksFailure: 0,
      averageSessionDuration: 0,
      errorRate: 0
    };

    // Clean up old business events periodically
    setInterval(() => {
      this.cleanupBusinessEvents();
    }, 3600000); // Every hour
  }

  /**
   * Initialize infrastructure monitoring
   */
  async initializeInfrastructureMonitoring() {
    // Register health checks
    this.registerHealthCheck('database', this.checkDatabaseHealth.bind(this));
    this.registerHealthCheck('redis', this.checkRedisHealth.bind(this));
    this.registerHealthCheck('memory', this.checkMemoryHealth.bind(this));
    this.registerHealthCheck('disk', this.checkDiskHealth.bind(this));
    
    // Start infrastructure monitoring
    setInterval(() => {
      this.runHealthChecks();
    }, this.options.monitoringInterval);
  }

  /**
   * Start monitoring loops
   */
  startMonitoring() {
    // Business metrics collection
    setInterval(() => {
      this.collectBusinessMetrics();
    }, 60000); // Every minute

    // Alert processing
    setInterval(() => {
      this.processAlerts();
    }, 30000); // Every 30 seconds
  }

  /**
   * Log structured event
   */
  logEvent(level, message, metadata = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: 'truxe-api',
      environment: config.app.environment,
      requestId: metadata.requestId,
      userId: metadata.userId,
      organizationId: metadata.organizationId,
      ip: metadata.ip,
      userAgent: metadata.userAgent,
      ...metadata
    };

    if (this.logger) {
      this.logger.log(level, message, logEntry);
    }

    // Emit event for real-time processing
    this.emit('log_event', logEntry);
  }

  /**
   * Track business event
   */
  trackBusinessEvent(eventType, data = {}) {
    const event = {
      type: eventType,
      timestamp: Date.now(),
      data: {
        userId: data.userId,
        organizationId: data.organizationId,
        sessionId: data.sessionId,
        ip: data.ip,
        userAgent: data.userAgent,
        ...data
      }
    };

    this.businessEvents.push(event);
    
    // Update business metrics
    this.updateBusinessMetrics(eventType, data);
    
    // Update Prometheus metrics
    this.updatePrometheusBusinessMetrics(eventType, data);
    
    this.emit('business_event', event);
    
    this.logEvent('info', `Business event: ${eventType}`, {
      eventType,
      userId: data.userId,
      organizationId: data.organizationId
    });
  }

  /**
   * Record metric
   */
  recordMetric(metricName, value, labels = {}) {
    const metric = this.metrics.get(metricName);
    if (!metric) {
      this.logEvent('warning', `Unknown metric: ${metricName}`);
      return;
    }

    try {
      if (metric.constructor.name === 'Counter') {
        metric.inc(labels, value || 1);
      } else if (metric.constructor.name === 'Gauge') {
        metric.set(labels, value);
      } else if (metric.constructor.name === 'Histogram' || metric.constructor.name === 'Summary') {
        metric.observe(labels, value);
      }
    } catch (error) {
      this.logEvent('error', `Failed to record metric ${metricName}`, { error: error.message });
    }
  }

  /**
   * Create alert
   */
  createAlert(severity, title, message, metadata = {}) {
    const alert = {
      id: this.generateAlertId(),
      severity,
      title,
      message,
      timestamp: Date.now(),
      status: 'active',
      metadata: {
        service: 'truxe-api',
        environment: config.app.environment,
        ...metadata
      }
    };

    this.alerts.push(alert);
    
    this.logEvent(severity, `Alert: ${title}`, {
      alertId: alert.id,
      alertTitle: title,
      alertMessage: message,
      ...metadata
    });

    this.emit('alert_created', alert);
    
    // Send alert through configured channels
    this.sendAlert(alert);
    
    return alert;
  }

  /**
   * Send alert through configured channels
   */
  async sendAlert(alert) {
    const channels = this.options.alertingChannels;
    
    for (const channel of channels) {
      try {
        switch (channel) {
          case 'webhook':
            if (this.options.webhookUrl) {
              await this.sendWebhookAlert(alert);
            }
            break;
          case 'slack':
            if (this.options.slackWebhookUrl) {
              await this.sendSlackAlert(alert);
            }
            break;
          case 'log':
            this.logEvent('info', 'Alert sent to log channel', { alert });
            break;
        }
      } catch (error) {
        this.logEvent('error', `Failed to send alert via ${channel}`, {
          error: error.message,
          alertId: alert.id
        });
      }
    }
  }

  /**
   * Send webhook alert
   */
  async sendWebhookAlert(alert) {
    const payload = {
      type: 'alert',
      alert,
      timestamp: new Date().toISOString()
    };

    const response = await fetch(this.options.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Webhook alert failed: ${response.status}`);
    }
  }

  /**
   * Send Slack alert
   */
  async sendSlackAlert(alert) {
    const color = {
      [AlertSeverity.INFO]: '#36a64f',
      [AlertSeverity.WARNING]: '#ffaa00',
      [AlertSeverity.ERROR]: '#ff0000',
      [AlertSeverity.CRITICAL]: '#8B0000',
      [AlertSeverity.FATAL]: '#000000'
    }[alert.severity] || '#cccccc';

    const payload = {
      attachments: [{
        color,
        title: `🚨 ${alert.title}`,
        text: alert.message,
        fields: [
          {
            title: 'Severity',
            value: alert.severity.toUpperCase(),
            short: true
          },
          {
            title: 'Service',
            value: alert.metadata.service,
            short: true
          },
          {
            title: 'Environment',
            value: alert.metadata.environment,
            short: true
          },
          {
            title: 'Time',
            value: new Date(alert.timestamp).toISOString(),
            short: true
          }
        ],
        footer: 'Truxe Monitoring',
        ts: Math.floor(alert.timestamp / 1000)
      }]
    };

    const response = await fetch(this.options.slackWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Slack alert failed: ${response.status}`);
    }
  }

  /**
   * Register health check
   */
  registerHealthCheck(name, checkFunction) {
    this.healthChecks.set(name, {
      name,
      check: checkFunction,
      lastRun: null,
      lastResult: null,
      status: 'unknown'
    });
  }

  /**
   * Run all health checks
   */
  async runHealthChecks() {
    const results = {};
    
    for (const [name, healthCheck] of this.healthChecks.entries()) {
      try {
        const startTime = Date.now();
        const result = await healthCheck.check();
        const duration = Date.now() - startTime;
        
        healthCheck.lastRun = Date.now();
        healthCheck.lastResult = result;
        healthCheck.status = result.healthy ? 'healthy' : 'unhealthy';
        
        results[name] = {
          ...result,
          duration,
          lastChecked: healthCheck.lastRun
        };
        
        // Create alert if health check fails
        if (!result.healthy && healthCheck.status !== 'unhealthy') {
          this.createAlert(
            AlertSeverity.ERROR,
            `Health check failed: ${name}`,
            result.message || `${name} health check failed`,
            { healthCheck: name, details: result }
          );
        }
      } catch (error) {
        healthCheck.lastRun = Date.now();
        healthCheck.status = 'error';
        
        results[name] = {
          healthy: false,
          message: error.message,
          error: true,
          lastChecked: healthCheck.lastRun
        };
        
        this.logEvent('error', `Health check error: ${name}`, {
          error: error.message,
          healthCheck: name
        });
      }
    }
    
    this.emit('health_checks_completed', results);
    return results;
  }

  /**
   * Health check implementations
   */
  async checkDatabaseHealth() {
    // This would check database connectivity
    return { healthy: true, message: 'Database connection OK' };
  }

  async checkRedisHealth() {
    // This would check Redis connectivity
    return { healthy: true, message: 'Redis connection OK' };
  }

  async checkMemoryHealth() {
    const usage = process.memoryUsage();
    const heapUsedMB = usage.heapUsed / 1024 / 1024;
    const heapTotalMB = usage.heapTotal / 1024 / 1024;
    const utilizationRate = heapUsedMB / heapTotalMB;
    
    const healthy = utilizationRate < 0.9;
    
    return {
      healthy,
      message: healthy ? 'Memory usage OK' : 'High memory usage detected',
      metrics: {
        heapUsed: heapUsedMB,
        heapTotal: heapTotalMB,
        utilizationRate
      }
    };
  }

  async checkDiskHealth() {
    // This would check disk space
    return { healthy: true, message: 'Disk space OK' };
  }

  /**
   * Update business metrics
   */
  updateBusinessMetrics(eventType, data) {
    switch (eventType) {
      case BusinessEventType.USER_REGISTRATION:
        this.businessMetrics.organizationsCreated++;
        if (data.userId) {
          this.businessMetrics.dailyActiveUsers.add(data.userId);
          this.businessMetrics.monthlyActiveUsers.add(data.userId);
        }
        break;
        
      case BusinessEventType.USER_LOGIN:
        if (data.userId) {
          this.businessMetrics.dailyActiveUsers.add(data.userId);
          this.businessMetrics.monthlyActiveUsers.add(data.userId);
        }
        break;
        
      case BusinessEventType.MAGIC_LINK_VERIFIED:
        this.businessMetrics.magicLinksSuccess++;
        break;
        
      case BusinessEventType.ERROR_OCCURRED:
        this.businessMetrics.errorRate++;
        break;
    }
  }

  /**
   * Update Prometheus business metrics
   */
  updatePrometheusBusinessMetrics(eventType, data) {
    switch (eventType) {
      case BusinessEventType.USER_REGISTRATION:
        this.recordMetric('users_registered_total', 1);
        break;
        
      case BusinessEventType.MAGIC_LINK_SENT:
        this.recordMetric('magic_links_sent_total', 1);
        break;
        
      case BusinessEventType.RATE_LIMIT_EXCEEDED:
        this.recordMetric('rate_limit_exceeded_total', 1, {
          endpoint: data.endpoint || 'unknown',
          limit_type: data.limitType || 'unknown'
        });
        break;
        
      case BusinessEventType.ERROR_OCCURRED:
        this.recordMetric('errors_total', 1, {
          type: data.errorType || 'unknown',
          severity: data.severity || 'error'
        });
        break;
    }
  }

  /**
   * Collect business metrics
   */
  collectBusinessMetrics() {
    // Update Prometheus gauges with current business metrics
    this.recordMetric('active_sessions', this.businessMetrics.dailyActiveUsers.size);
    
    // Calculate and record derived metrics
    const totalEvents = this.businessEvents.length;
    const errorEvents = this.businessEvents.filter(e => e.type === BusinessEventType.ERROR_OCCURRED).length;
    const errorRate = totalEvents > 0 ? (errorEvents / totalEvents) * 100 : 0;
    
    this.businessMetrics.errorRate = errorRate;
  }

  /**
   * Clean up old business events
   */
  cleanupBusinessEvents() {
    const cutoff = Date.now() - this.options.businessMetricsRetention;
    this.businessEvents = this.businessEvents.filter(event => event.timestamp > cutoff);
    
    // Reset daily active users (should be done daily)
    const now = new Date();
    if (now.getHours() === 0 && now.getMinutes() === 0) {
      this.businessMetrics.dailyActiveUsers.clear();
    }
    
    // Reset monthly active users (should be done monthly)
    if (now.getDate() === 1 && now.getHours() === 0 && now.getMinutes() === 0) {
      this.businessMetrics.monthlyActiveUsers.clear();
    }
  }

  /**
   * Process alerts
   */
  processAlerts() {
    // Clean up old resolved alerts
    const cutoff = Date.now() - 86400000; // 24 hours
    this.alerts = this.alerts.filter(alert => 
      alert.status === 'active' || alert.timestamp > cutoff
    );
  }

  /**
   * Get metrics for export
   */
  async getPrometheusMetrics() {
    if (!this.prometheusRegistry) {
      return '';
    }
    
    return await this.prometheusRegistry.metrics();
  }

  /**
   * Get comprehensive monitoring dashboard data
   */
  getMonitoringDashboard() {
    return {
      timestamp: Date.now(),
      service: {
        name: this.options.apmServiceName,
        version: this.options.apmServiceVersion,
        environment: config.app.environment,
        uptime: Date.now() - (this.apmMetrics?.startTime || Date.now())
      },
      businessMetrics: {
        dailyActiveUsers: this.businessMetrics.dailyActiveUsers.size,
        monthlyActiveUsers: this.businessMetrics.monthlyActiveUsers.size,
        organizationsCreated: this.businessMetrics.organizationsCreated,
        magicLinksSuccess: this.businessMetrics.magicLinksSuccess,
        errorRate: this.businessMetrics.errorRate
      },
      alerts: {
        active: this.alerts.filter(a => a.status === 'active').length,
        total: this.alerts.length,
        recent: this.alerts.slice(-10)
      },
      healthChecks: Object.fromEntries(
        Array.from(this.healthChecks.entries()).map(([name, check]) => [
          name,
          {
            status: check.status,
            lastRun: check.lastRun,
            healthy: check.status === 'healthy'
          }
        ])
      ),
      recentEvents: this.businessEvents.slice(-50)
    };
  }

  /**
   * Helper methods
   */
  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    this.businessEvents = [];
    this.alerts = [];
    this.healthChecks.clear();
    this.metrics.clear();
    
    if (this.prometheusRegistry) {
      this.prometheusRegistry.clear();
    }
    
    this.emit('cleanup_completed');
  }
}

/**
 * Global monitoring service instance
 */
let globalMonitoringService = null;

/**
 * Initialize global monitoring service
 */
export function initializeMonitoringService(options = {}) {
  if (globalMonitoringService) {
    return globalMonitoringService;
  }
  
  globalMonitoringService = new MonitoringObservabilityService(options);
  return globalMonitoringService;
}

/**
 * Get global monitoring service
 */
export function getMonitoringService() {
  return globalMonitoringService;
}

/**
 * Fastify plugin for monitoring and observability
 */
export function monitoringPlugin(fastify, options, done) {
  const monitoring = initializeMonitoringService(options);
  
  // Add request/response monitoring
  fastify.addHook('onRequest', async (request, reply) => {
    request.startTime = process.hrtime.bigint();
    
    // Log request
    monitoring.logEvent('info', 'Request received', {
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      requestId: request.id
    });
  });
  
  fastify.addHook('onSend', async (request, reply, payload) => {
    if (request.startTime) {
      const duration = Number(process.hrtime.bigint() - request.startTime) / 1000000000; // seconds
      
      // Record HTTP metrics
      monitoring.recordMetric('http_requests_total', 1, {
        method: request.method,
        route: request.routerPath || request.url,
        status_code: reply.statusCode.toString()
      });
      
      monitoring.recordMetric('http_request_duration', duration, {
        method: request.method,
        route: request.routerPath || request.url,
        status_code: reply.statusCode.toString()
      });
      
      // Log response
      monitoring.logEvent('info', 'Request completed', {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        duration,
        requestId: request.id
      });
    }
    
    return payload;
  });
  
  // Add monitoring endpoints
  fastify.get('/metrics', async (request, reply) => {
    const metrics = await monitoring.getPrometheusMetrics();
    reply.type('text/plain').send(metrics);
  });
  
  fastify.get('/health/monitoring', async (request, reply) => {
    const dashboard = monitoring.getMonitoringDashboard();
    reply.send(dashboard);
  });
  
  fastify.get('/health/checks', async (request, reply) => {
    const results = await monitoring.runHealthChecks();
    const allHealthy = Object.values(results).every(r => r.healthy);
    
    reply.code(allHealthy ? 200 : 503).send({
      status: allHealthy ? 'healthy' : 'unhealthy',
      checks: results,
      timestamp: Date.now()
    });
  });
  
  // Decorate fastify with monitoring methods
  fastify.decorate('monitoring', monitoring);
  fastify.decorate('logEvent', monitoring.logEvent.bind(monitoring));
  fastify.decorate('trackBusinessEvent', monitoring.trackBusinessEvent.bind(monitoring));
  fastify.decorate('recordMetric', monitoring.recordMetric.bind(monitoring));
  fastify.decorate('createAlert', monitoring.createAlert.bind(monitoring));
  
  done();
}

export default {
  MonitoringObservabilityService,
  AlertSeverity,
  MetricType,
  BusinessEventType,
  initializeMonitoringService,
  getMonitoringService,
  monitoringPlugin
};
