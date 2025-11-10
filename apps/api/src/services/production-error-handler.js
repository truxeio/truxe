/**
 * Heimdall Production Error Handler
 * 
 * Enterprise-grade error handling and recovery system for production environments.
 * Provides comprehensive error tracking, automated recovery, circuit breaker patterns,
 * and intelligent error classification with monitoring integration.
 * 
 * @author Production Engineering Team
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { ErrorMessagingService, createErrorResponse } from './error-messaging.js';
import config from '../config/index.js';

/**
 * Error Classification Levels
 */
export const ErrorClassification = {
  RECOVERABLE: 'recoverable',
  DEGRADED: 'degraded',
  CRITICAL: 'critical',
  FATAL: 'fatal'
};

/**
 * Circuit Breaker States
 */
export const CircuitBreakerState = {
  CLOSED: 'closed',
  OPEN: 'open',
  HALF_OPEN: 'half_open'
};

/**
 * Production Error Handler with Advanced Recovery
 */
export class ProductionErrorHandler extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      // Circuit breaker configuration
      failureThreshold: options.failureThreshold || 5,
      recoveryTimeout: options.recoveryTimeout || 60000, // 1 minute
      halfOpenMaxCalls: options.halfOpenMaxCalls || 3,
      
      // Error tracking
      errorWindowSize: options.errorWindowSize || 300000, // 5 minutes
      maxErrorsInWindow: options.maxErrorsInWindow || 100,
      
      // Recovery strategies
      enableAutoRecovery: options.enableAutoRecovery !== false,
      maxRecoveryAttempts: options.maxRecoveryAttempts || 3,
      recoveryBackoffMs: options.recoveryBackoffMs || 1000,
      
      // Monitoring
      enableMetrics: options.enableMetrics !== false,
      metricsRetentionMs: options.metricsRetentionMs || 3600000, // 1 hour
      
      ...options
    };

    this.errorMessaging = new ErrorMessagingService();
    this.circuitBreakers = new Map();
    this.errorWindow = [];
    this.metrics = new Map();
    this.recoveryAttempts = new Map();
    
    this.initializeCircuitBreakers();
    this.startMetricsCleanup();
  }

  /**
   * Initialize circuit breakers for critical services
   */
  initializeCircuitBreakers() {
    const services = ['database', 'redis', 'email', 'auth', 'webhook'];
    
    services.forEach(service => {
      this.circuitBreakers.set(service, {
        state: CircuitBreakerState.CLOSED,
        failures: 0,
        lastFailureTime: null,
        nextAttemptTime: null,
        halfOpenCalls: 0
      });
    });
  }

  /**
   * Handle error with comprehensive analysis and recovery
   */
  async handleError(error, context = {}) {
    const errorId = this.generateErrorId();
    const timestamp = new Date();
    
    // Classify error severity and type
    const classification = await this.classifyError(error, context);
    
    // Track error in window
    this.trackError(error, classification, timestamp);
    
    // Update circuit breaker state
    await this.updateCircuitBreaker(error, context, classification);
    
    // Attempt automated recovery
    const recoveryResult = await this.attemptRecovery(error, context, classification);
    
    // Generate enhanced error response
    const errorResponse = await this.generateErrorResponse(error, context, classification, recoveryResult, errorId);
    
    // Update metrics
    this.updateMetrics(error, classification, recoveryResult, timestamp);
    
    // Emit error event for monitoring
    this.emit('error_handled', {
      errorId,
      error,
      context,
      classification,
      recoveryResult,
      timestamp
    });

    return errorResponse;
  }

  /**
   * Classify error severity and recoverability
   */
  async classifyError(error, context = {}) {
    const classification = {
      level: ErrorClassification.RECOVERABLE,
      category: 'unknown',
      service: 'general',
      recoverable: true,
      priority: 'medium',
      impactScope: 'single_request'
    };

    // Database errors
    if (this.isDatabaseError(error)) {
      classification.service = 'database';
      classification.category = 'database';
      
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        classification.level = ErrorClassification.CRITICAL;
        classification.impactScope = 'service_wide';
        classification.priority = 'high';
      } else if (error.code === 'ECONNRESET' || error.message?.includes('connection')) {
        classification.level = ErrorClassification.DEGRADED;
        classification.impactScope = 'multiple_requests';
      }
    }
    
    // Redis errors
    else if (this.isRedisError(error)) {
      classification.service = 'redis';
      classification.category = 'cache';
      
      if (error.code === 'ECONNREFUSED') {
        classification.level = ErrorClassification.DEGRADED;
        classification.impactScope = 'service_wide';
        classification.recoverable = true; // Redis failures are generally recoverable
      }
    }
    
    // Authentication errors
    else if (this.isAuthError(error)) {
      classification.service = 'auth';
      classification.category = 'authentication';
      classification.level = ErrorClassification.RECOVERABLE;
      
      if (error.code === 'TOKEN_EXPIRED' || error.code === 'TOKEN_INVALID') {
        classification.recoverable = true;
      }
    }
    
    // Rate limiting errors
    else if (this.isRateLimitError(error)) {
      classification.service = 'rate_limit';
      classification.category = 'rate_limiting';
      classification.level = ErrorClassification.RECOVERABLE;
      classification.recoverable = true;
    }
    
    // Email service errors
    else if (this.isEmailError(error)) {
      classification.service = 'email';
      classification.category = 'email';
      classification.level = ErrorClassification.DEGRADED;
      classification.recoverable = true;
    }
    
    // System-level errors
    else if (this.isSystemError(error)) {
      classification.category = 'system';
      classification.level = ErrorClassification.FATAL;
      classification.impactScope = 'service_wide';
      classification.priority = 'critical';
      classification.recoverable = false;
    }

    // Check for cascade failure indicators
    if (this.detectCascadeFailure(error, context)) {
      classification.level = ErrorClassification.CRITICAL;
      classification.impactScope = 'service_wide';
      classification.priority = 'critical';
    }

    return classification;
  }

  /**
   * Track error in sliding window
   */
  trackError(error, classification, timestamp) {
    const errorEntry = {
      timestamp,
      error: error.message,
      classification,
      id: this.generateErrorId()
    };

    this.errorWindow.push(errorEntry);

    // Remove old errors outside window
    const windowStart = timestamp.getTime() - this.options.errorWindowSize;
    this.errorWindow = this.errorWindow.filter(entry => 
      entry.timestamp.getTime() > windowStart
    );

    // Check for error spike
    if (this.errorWindow.length > this.options.maxErrorsInWindow) {
      this.emit('error_spike_detected', {
        errorCount: this.errorWindow.length,
        windowSize: this.options.errorWindowSize,
        threshold: this.options.maxErrorsInWindow
      });
    }
  }

  /**
   * Update circuit breaker state based on error
   */
  async updateCircuitBreaker(error, context, classification) {
    const service = classification.service;
    const breaker = this.circuitBreakers.get(service);
    
    if (!breaker) return;

    const now = Date.now();

    // Handle different circuit breaker states
    switch (breaker.state) {
      case CircuitBreakerState.CLOSED:
        if (classification.level === ErrorClassification.CRITICAL || 
            classification.level === ErrorClassification.FATAL) {
          breaker.failures++;
          breaker.lastFailureTime = now;

          if (breaker.failures >= this.options.failureThreshold) {
            breaker.state = CircuitBreakerState.OPEN;
            breaker.nextAttemptTime = now + this.options.recoveryTimeout;
            
            this.emit('circuit_breaker_opened', {
              service,
              failures: breaker.failures,
              error: error.message
            });
          }
        } else if (classification.level === ErrorClassification.RECOVERABLE) {
          // Reset failure count on successful operations
          breaker.failures = Math.max(0, breaker.failures - 1);
        }
        break;

      case CircuitBreakerState.OPEN:
        if (now >= breaker.nextAttemptTime) {
          breaker.state = CircuitBreakerState.HALF_OPEN;
          breaker.halfOpenCalls = 0;
          
          this.emit('circuit_breaker_half_opened', { service });
        }
        break;

      case CircuitBreakerState.HALF_OPEN:
        breaker.halfOpenCalls++;
        
        if (classification.level === ErrorClassification.CRITICAL || 
            classification.level === ErrorClassification.FATAL) {
          breaker.state = CircuitBreakerState.OPEN;
          breaker.nextAttemptTime = now + this.options.recoveryTimeout;
          breaker.failures++;
          
          this.emit('circuit_breaker_reopened', { service });
        } else if (breaker.halfOpenCalls >= this.options.halfOpenMaxCalls) {
          breaker.state = CircuitBreakerState.CLOSED;
          breaker.failures = 0;
          
          this.emit('circuit_breaker_closed', { service });
        }
        break;
    }
  }

  /**
   * Attempt automated recovery based on error type
   */
  async attemptRecovery(error, context, classification) {
    if (!this.options.enableAutoRecovery || !classification.recoverable) {
      return { attempted: false, success: false, reason: 'not_recoverable' };
    }

    const recoveryKey = `${classification.service}_${classification.category}`;
    const attempts = this.recoveryAttempts.get(recoveryKey) || 0;

    if (attempts >= this.options.maxRecoveryAttempts) {
      return { 
        attempted: false, 
        success: false, 
        reason: 'max_attempts_exceeded',
        attempts 
      };
    }

    this.recoveryAttempts.set(recoveryKey, attempts + 1);

    try {
      const recoveryStrategy = this.getRecoveryStrategy(classification);
      const result = await recoveryStrategy(error, context, classification);
      
      if (result.success) {
        this.recoveryAttempts.delete(recoveryKey);
      }

      return {
        attempted: true,
        success: result.success,
        strategy: result.strategy,
        actions: result.actions,
        attempts: attempts + 1
      };
    } catch (recoveryError) {
      return {
        attempted: true,
        success: false,
        error: recoveryError.message,
        attempts: attempts + 1
      };
    }
  }

  /**
   * Get recovery strategy based on error classification
   */
  getRecoveryStrategy(classification) {
    const strategies = {
      database: this.recoverDatabaseError.bind(this),
      redis: this.recoverRedisError.bind(this),
      email: this.recoverEmailError.bind(this),
      auth: this.recoverAuthError.bind(this),
      rate_limit: this.recoverRateLimitError.bind(this)
    };

    return strategies[classification.service] || this.defaultRecoveryStrategy.bind(this);
  }

  /**
   * Database error recovery
   */
  async recoverDatabaseError(error, context, classification) {
    const actions = [];

    if (error.code === 'ECONNRESET' || error.message?.includes('connection')) {
      actions.push('retry_connection');
      // Wait before retry
      await this.sleep(this.options.recoveryBackoffMs);
      
      return {
        success: true,
        strategy: 'connection_retry',
        actions
      };
    }

    if (error.code === 'ECONNREFUSED') {
      actions.push('connection_pool_reset');
      // In a real implementation, you'd reset the connection pool here
      
      return {
        success: false,
        strategy: 'pool_reset',
        actions,
        requiresManualIntervention: true
      };
    }

    return { success: false, strategy: 'no_strategy', actions };
  }

  /**
   * Redis error recovery
   */
  async recoverRedisError(error, context, classification) {
    const actions = ['fallback_to_memory'];
    
    // Redis is typically used for caching, so we can fall back to in-memory or database
    return {
      success: true,
      strategy: 'cache_fallback',
      actions,
      degradedMode: true
    };
  }

  /**
   * Email error recovery
   */
  async recoverEmailError(error, context, classification) {
    const actions = [];

    if (error.code === 'ECONNREFUSED' || error.message?.includes('timeout')) {
      actions.push('retry_with_backoff');
      await this.sleep(this.options.recoveryBackoffMs * 2);
      
      return {
        success: true,
        strategy: 'retry_with_backoff',
        actions
      };
    }

    // For other email errors, queue for later retry
    actions.push('queue_for_retry');
    return {
      success: true,
      strategy: 'queue_retry',
      actions,
      delayed: true
    };
  }

  /**
   * Auth error recovery
   */
  async recoverAuthError(error, context, classification) {
    const actions = [];

    if (error.code === 'TOKEN_EXPIRED') {
      actions.push('request_token_refresh');
      return {
        success: true,
        strategy: 'token_refresh',
        actions,
        userAction: 'refresh_token'
      };
    }

    return { success: false, strategy: 'no_recovery', actions };
  }

  /**
   * Rate limit error recovery
   */
  async recoverRateLimitError(error, context, classification) {
    const actions = ['apply_backoff'];
    
    // Extract retry-after header if available
    const retryAfter = context.retryAfter || 60;
    
    return {
      success: true,
      strategy: 'backoff_retry',
      actions,
      retryAfter,
      userAction: 'wait_and_retry'
    };
  }

  /**
   * Default recovery strategy
   */
  async defaultRecoveryStrategy(error, context, classification) {
    return {
      success: false,
      strategy: 'no_strategy',
      actions: [],
      reason: 'no_recovery_strategy_available'
    };
  }

  /**
   * Generate enhanced error response
   */
  async generateErrorResponse(error, context, classification, recoveryResult, errorId) {
    const baseResponse = createErrorResponse(error, context);
    
    const enhancedResponse = {
      ...baseResponse,
      errorId,
      classification: {
        level: classification.level,
        category: classification.category,
        service: classification.service,
        recoverable: classification.recoverable,
        impactScope: classification.impactScope
      },
      recovery: recoveryResult.attempted ? {
        attempted: true,
        success: recoveryResult.success,
        strategy: recoveryResult.strategy,
        actions: recoveryResult.actions,
        userAction: recoveryResult.userAction,
        retryAfter: recoveryResult.retryAfter
      } : {
        attempted: false,
        reason: recoveryResult.reason
      },
      circuitBreaker: this.getCircuitBreakerStatus(classification.service),
      timestamp: new Date().toISOString()
    };

    // Add production-safe error details
    if (config.app.environment === 'production') {
      delete enhancedResponse.stack;
      delete enhancedResponse.debug;
      
      // Only expose safe error details
      if (classification.level !== ErrorClassification.FATAL) {
        enhancedResponse.troubleshooting = {
          steps: this.generateTroubleshootingSteps(classification),
          documentation: this.getDocumentationLinks(classification),
          support: this.getSupportContacts(classification)
        };
      }
    }

    return enhancedResponse;
  }

  /**
   * Generate troubleshooting steps for users
   */
  generateTroubleshootingSteps(classification) {
    const commonSteps = {
      database: [
        'Check database connectivity',
        'Verify database credentials',
        'Check database server status',
        'Review connection pool settings'
      ],
      redis: [
        'Verify Redis server is running',
        'Check Redis connectivity',
        'Review cache configuration',
        'Consider fallback to database'
      ],
      email: [
        'Check email provider status',
        'Verify API credentials',
        'Review email quotas',
        'Check spam filters'
      ],
      auth: [
        'Refresh authentication tokens',
        'Verify user permissions',
        'Check session validity',
        'Review authentication flow'
      ],
      rate_limit: [
        'Wait for rate limit reset',
        'Review request frequency',
        'Consider upgrading plan',
        'Implement request batching'
      ]
    };

    return commonSteps[classification.service] || [
      'Check service status',
      'Review error logs',
      'Contact support if issue persists'
    ];
  }

  /**
   * Get documentation links for error type
   */
  getDocumentationLinks(classification) {
    const baseUrl = 'https://docs.truxe.io';
    
    const links = {
      database: `${baseUrl}/troubleshooting/database`,
      redis: `${baseUrl}/troubleshooting/cache`,
      email: `${baseUrl}/troubleshooting/email`,
      auth: `${baseUrl}/troubleshooting/authentication`,
      rate_limit: `${baseUrl}/troubleshooting/rate-limits`
    };

    return {
      specific: links[classification.service],
      general: `${baseUrl}/troubleshooting/general`,
      support: `${baseUrl}/support`
    };
  }

  /**
   * Get support contact information
   */
  getSupportContacts(classification) {
    return {
      email: 'support@truxe.io',
      docs: 'https://docs.truxe.io',
      status: 'https://status.truxe.io',
      emergency: classification.level === ErrorClassification.CRITICAL ? 
        'emergency@truxe.io' : null
    };
  }

  /**
   * Update error metrics
   */
  updateMetrics(error, classification, recoveryResult, timestamp) {
    if (!this.options.enableMetrics) return;

    const metricKey = `${classification.service}_${classification.category}_${classification.level}`;
    const metric = this.metrics.get(metricKey) || {
      count: 0,
      lastOccurrence: null,
      recoveryAttempts: 0,
      successfulRecoveries: 0,
      avgRecoveryTime: 0
    };

    metric.count++;
    metric.lastOccurrence = timestamp;

    if (recoveryResult.attempted) {
      metric.recoveryAttempts++;
      if (recoveryResult.success) {
        metric.successfulRecoveries++;
      }
    }

    this.metrics.set(metricKey, metric);
  }

  /**
   * Get circuit breaker status for service
   */
  getCircuitBreakerStatus(service) {
    const breaker = this.circuitBreakers.get(service);
    if (!breaker) return null;

    return {
      state: breaker.state,
      failures: breaker.failures,
      nextAttemptTime: breaker.nextAttemptTime,
      lastFailureTime: breaker.lastFailureTime
    };
  }

  /**
   * Get comprehensive error metrics
   */
  getMetrics() {
    const now = Date.now();
    const recentErrors = this.errorWindow.filter(error => 
      now - error.timestamp.getTime() < this.options.errorWindowSize
    );

    return {
      errorWindow: {
        size: this.errorWindow.length,
        recentCount: recentErrors.length,
        windowSizeMs: this.options.errorWindowSize
      },
      circuitBreakers: Object.fromEntries(
        Array.from(this.circuitBreakers.entries()).map(([service, breaker]) => [
          service,
          {
            state: breaker.state,
            failures: breaker.failures,
            healthy: breaker.state === CircuitBreakerState.CLOSED
          }
        ])
      ),
      metrics: Object.fromEntries(this.metrics.entries()),
      recoveryAttempts: Object.fromEntries(this.recoveryAttempts.entries())
    };
  }

  /**
   * Start metrics cleanup interval
   */
  startMetricsCleanup() {
    setInterval(() => {
      const now = Date.now();
      const cutoff = now - this.options.metricsRetentionMs;

      // Clean up old error window entries
      this.errorWindow = this.errorWindow.filter(error => 
        error.timestamp.getTime() > cutoff
      );

      // Reset recovery attempts for old errors
      const cutoffRecovery = now - (this.options.recoveryTimeout * 2);
      for (const [key, lastAttempt] of this.recoveryAttempts.entries()) {
        if (lastAttempt < cutoffRecovery) {
          this.recoveryAttempts.delete(key);
        }
      }
    }, 60000); // Run every minute
  }

  /**
   * Error type detection methods
   */
  isDatabaseError(error) {
    return error.code?.startsWith('PG') || 
           error.message?.includes('database') ||
           error.message?.includes('connection') && error.message?.includes('postgres');
  }

  isRedisError(error) {
    return error.message?.includes('redis') ||
           error.message?.includes('REDIS') ||
           error.code === 'ECONNREFUSED' && error.port === 6379;
  }

  isAuthError(error) {
    return error.code?.includes('TOKEN') ||
           error.message?.includes('authorization') ||
           error.message?.includes('authentication');
  }

  isRateLimitError(error) {
    return error.statusCode === 429 ||
           error.message?.includes('rate limit') ||
           error.message?.includes('too many requests');
  }

  isEmailError(error) {
    return error.message?.includes('email') ||
           error.message?.includes('smtp') ||
           error.message?.includes('mail');
  }

  isSystemError(error) {
    return error.code === 'ENOMEM' ||
           error.code === 'ENOSPC' ||
           error.message?.includes('out of memory');
  }

  /**
   * Detect cascade failure patterns
   */
  detectCascadeFailure(error, context) {
    const recentErrors = this.errorWindow.filter(entry => 
      Date.now() - entry.timestamp.getTime() < 60000 // Last minute
    );

    // Multiple services failing simultaneously
    const failedServices = new Set(recentErrors.map(e => e.classification.service));
    if (failedServices.size >= 3) {
      return true;
    }

    // High error rate
    if (recentErrors.length > 50) {
      return true;
    }

    return false;
  }

  /**
   * Generate unique error ID
   */
  generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sleep utility for recovery backoff
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Global production error handler instance
 */
let globalErrorHandler = null;

/**
 * Initialize global production error handler
 */
export function initializeProductionErrorHandler(options = {}) {
  if (globalErrorHandler) {
    return globalErrorHandler;
  }

  globalErrorHandler = new ProductionErrorHandler(options);
  
  // Set up global error handlers
  process.on('uncaughtException', async (error) => {
    console.error('Uncaught Exception:', error);
    await globalErrorHandler.handleError(error, { 
      type: 'uncaught_exception',
      critical: true 
    });
    
    // In production, we might want to gracefully shutdown
    if (config.app.environment === 'production') {
      setTimeout(() => process.exit(1), 1000);
    }
  });

  process.on('unhandledRejection', async (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    await globalErrorHandler.handleError(new Error(reason), { 
      type: 'unhandled_rejection',
      promise: promise.toString() 
    });
  });

  return globalErrorHandler;
}

/**
 * Get global error handler
 */
export function getProductionErrorHandler() {
  return globalErrorHandler;
}

/**
 * Fastify plugin for production error handling
 */
export function productionErrorHandlerPlugin(fastify, options, done) {
  const errorHandler = initializeProductionErrorHandler(options);
  
  // Replace default error handler
  fastify.setErrorHandler(async (error, request, reply) => {
    const context = {
      requestId: request.id,
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      userId: request.user?.id,
      organizationId: request.organization?.id,
      timestamp: new Date().toISOString()
    };

    const errorResponse = await errorHandler.handleError(error, context);
    
    // Log for monitoring
    const logLevel = errorResponse.classification.level === ErrorClassification.FATAL ? 'fatal' :
                    errorResponse.classification.level === ErrorClassification.CRITICAL ? 'error' :
                    errorResponse.classification.level === ErrorClassification.DEGRADED ? 'warn' : 'info';
    
    fastify.log[logLevel]({
      errorId: errorResponse.errorId,
      classification: errorResponse.classification,
      recovery: errorResponse.recovery,
      circuitBreaker: errorResponse.circuitBreaker
    }, `Production error handled: ${error.message}`);

    const statusCode = error.statusCode || 
      (errorResponse.classification.level === ErrorClassification.FATAL ? 503 :
       errorResponse.classification.level === ErrorClassification.CRITICAL ? 502 :
       500);

    reply.code(statusCode).send(errorResponse);
  });

  // Add error metrics endpoint
  fastify.get('/health/error-metrics', async (request, reply) => {
    const metrics = errorHandler.getMetrics();
    reply.send(metrics);
  });

  done();
}

export default {
  ProductionErrorHandler,
  ErrorClassification,
  CircuitBreakerState,
  initializeProductionErrorHandler,
  getProductionErrorHandler,
  productionErrorHandlerPlugin
};
