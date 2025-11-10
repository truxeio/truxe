/**
 * OAuth Token Metrics Service
 * 
 * Tracks and monitors OAuth token operations:
 * - Token generation rates
 * - Refresh token usage patterns
 * - Failed authentication attempts
 * - Anomaly detection
 * - Performance metrics
 * 
 * Metrics Categories:
 * - Counters: Total operations over time
 * - Gauges: Current state values
 * - Histograms: Distribution of values
 * - Rates: Operations per time window
 */

import Redis from 'ioredis';
import config from '../../config/index.js';

export class TokenMetricsService {
  constructor() {
    this.redis = new Redis(config.redis.url, {
      keyPrefix: config.redis.keyPrefix + 'token_metrics:',
      retryDelayOnFailover: config.redis.retryDelayOnFailover,
      maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
      lazyConnect: true,
    });
    
    this.redis.on('error', (error) => {
      console.error('Token metrics Redis error:', error.message);
    });
    
    this.redis.on('connect', () => {
      console.log('Token metrics Redis connected');
    });
    
    // Anomaly detection thresholds
    this.anomalyThresholds = {
      tokenGenerationSpikeMultiplier: 3, // 3x baseline
      failedAttemptsThreshold: 10, // Failed attempts per minute
      refreshRateAnomalyMultiplier: 5, // 5x normal refresh rate
      suspiciousPatternThreshold: 20, // Similar requests in short time
      responseTimeThreshold: 1000, // Milliseconds
    };
    
    // Baseline metrics (updated periodically)
    this.baseline = {
      avgTokensPerMinute: 10,
      avgRefreshesPerMinute: 5,
      avgResponseTime: 100,
      lastUpdate: Date.now(),
    };
    
    // Start background monitoring
    this.startMonitoring();
  }
  
  // ============================================================================
  // COUNTERS - Track total occurrences
  // ============================================================================
  
  /**
   * Increment counter metric
   */
  async incrementCounter(metricName, value = 1, tags = {}) {
    try {
      const key = this.buildMetricKey('counter', metricName, tags);
      await this.redis.incrby(key, value);
      
      // Also track in current time window
      const windowKey = this.buildTimeWindowKey('counter', metricName, tags);
      await this.redis.incrby(windowKey, value);
      await this.redis.expire(windowKey, 3600); // 1 hour TTL
    } catch (error) {
      console.error('Failed to increment counter:', error.message);
    }
  }
  
  /**
   * Track token generation
   */
  async trackTokenGeneration({ clientId, userId, scope, success = true, errorType = null }) {
    await this.incrementCounter('tokens_generated', 1, { 
      success: success.toString(), 
      client_id: clientId 
    });
    
    if (success) {
      await this.incrementCounter('tokens_by_scope', 1, { scope });
      await this.incrementCounter('tokens_by_client', 1, { client_id: clientId });
    } else {
      await this.incrementCounter('token_generation_errors', 1, { 
        error_type: errorType || 'unknown',
        client_id: clientId 
      });
    }
    
    // Track scopes separately
    if (scope) {
      const scopes = scope.split(' ');
      for (const scopeItem of scopes) {
        await this.incrementCounter('scope_usage', 1, { scope: scopeItem });
      }
    }
  }
  
  /**
   * Track token refresh
   */
  async trackTokenRefresh({ clientId, userId, success = true, errorType = null }) {
    await this.incrementCounter('tokens_refreshed', 1, { 
      success: success.toString(),
      client_id: clientId 
    });
    
    if (!success) {
      await this.incrementCounter('token_refresh_errors', 1, { 
        error_type: errorType || 'unknown',
        client_id: clientId 
      });
    }
  }
  
  /**
   * Track token introspection
   */
  async trackTokenIntrospection({ clientId, active, tokenType = 'access_token' }) {
    await this.incrementCounter('tokens_introspected', 1, { 
      client_id: clientId,
      active: active.toString(),
      token_type: tokenType
    });
  }
  
  /**
   * Track token revocation
   */
  async trackTokenRevocation({ clientId, tokenType = 'access_token', success = true }) {
    await this.incrementCounter('tokens_revoked', 1, { 
      success: success.toString(),
      client_id: clientId,
      token_type: tokenType
    });
  }
  
  /**
   * Track failed authentication
   */
  async trackFailedAuth({ clientId, reason, ip = null }) {
    await this.incrementCounter('auth_failures', 1, { 
      reason,
      client_id: clientId 
    });
    
    if (ip) {
      await this.incrementCounter('auth_failures_by_ip', 1, { ip });
    }
  }
  
  // ============================================================================
  // GAUGES - Track current state
  // ============================================================================
  
  /**
   * Set gauge value
   */
  async setGauge(metricName, value, tags = {}) {
    try {
      const key = this.buildMetricKey('gauge', metricName, tags);
      await this.redis.set(key, value);
      await this.redis.expire(key, 3600); // 1 hour TTL
    } catch (error) {
      console.error('Failed to set gauge:', error.message);
    }
  }
  
  /**
   * Track active tokens
   */
  async trackActiveTokens(count) {
    await this.setGauge('active_tokens', count);
  }
  
  /**
   * Track active refresh tokens
   */
  async trackActiveRefreshTokens(count) {
    await this.setGauge('active_refresh_tokens', count);
  }
  
  // ============================================================================
  // HISTOGRAMS - Track distributions
  // ============================================================================
  
  /**
   * Record histogram value
   */
  async recordHistogram(metricName, value, tags = {}) {
    try {
      const key = this.buildMetricKey('histogram', metricName, tags);
      const timestamp = Date.now();
      
      // Store as sorted set with timestamp as score
      await this.redis.zadd(key, timestamp, `${timestamp}:${value}`);
      
      // Keep only last hour of data
      const oneHourAgo = timestamp - 3600000;
      await this.redis.zremrangebyscore(key, 0, oneHourAgo);
    } catch (error) {
      console.error('Failed to record histogram:', error.message);
    }
  }
  
  /**
   * Track operation duration
   */
  async trackDuration(operation, durationMs, tags = {}) {
    await this.recordHistogram('operation_duration', durationMs, { 
      operation,
      ...tags 
    });
    
    // Also update average response time for baseline
    await this.updateBaseline('avgResponseTime', durationMs);
  }
  
  // ============================================================================
  // RATES - Track operations per time window
  // ============================================================================
  
  /**
   * Get rate (operations per minute)
   */
  async getRate(metricName, tags = {}, windowMinutes = 1) {
    try {
      const now = Date.now();
      const windowStart = now - (windowMinutes * 60 * 1000);
      
      const key = this.buildMetricKey('histogram', metricName, tags);
      const count = await this.redis.zcount(key, windowStart, now);
      
      return count / windowMinutes;
    } catch (error) {
      console.error('Failed to get rate:', error.message);
      return 0;
    }
  }
  
  /**
   * Get token generation rate
   */
  async getTokenGenerationRate(clientId = null, windowMinutes = 1) {
    const tags = clientId ? { client_id: clientId } : {};
    const key = this.buildTimeWindowKey('counter', 'tokens_generated', tags);
    
    try {
      const count = await this.redis.get(key) || 0;
      return parseInt(count) / windowMinutes;
    } catch (error) {
      console.error('Failed to get token generation rate:', error.message);
      return 0;
    }
  }
  
  /**
   * Get refresh rate
   */
  async getRefreshRate(clientId = null, windowMinutes = 1) {
    const tags = clientId ? { client_id: clientId } : {};
    const key = this.buildTimeWindowKey('counter', 'tokens_refreshed', tags);
    
    try {
      const count = await this.redis.get(key) || 0;
      return parseInt(count) / windowMinutes;
    } catch (error) {
      console.error('Failed to get refresh rate:', error.message);
      return 0;
    }
  }
  
  // ============================================================================
  // ANOMALY DETECTION
  // ============================================================================
  
  /**
   * Detect anomalies in token operations
   */
  async detectAnomalies() {
    const anomalies = [];
    
    try {
      // Check token generation spike
      const currentRate = await this.getTokenGenerationRate(null, 1);
      if (currentRate > this.baseline.avgTokensPerMinute * this.anomalyThresholds.tokenGenerationSpikeMultiplier) {
        anomalies.push({
          type: 'token_generation_spike',
          severity: 'high',
          currentRate,
          baseline: this.baseline.avgTokensPerMinute,
          multiplier: currentRate / this.baseline.avgTokensPerMinute,
          timestamp: Date.now(),
        });
      }
      
      // Check refresh rate spike
      const refreshRate = await this.getRefreshRate(null, 1);
      if (refreshRate > this.baseline.avgRefreshesPerMinute * this.anomalyThresholds.refreshRateAnomalyMultiplier) {
        anomalies.push({
          type: 'refresh_rate_spike',
          severity: 'high',
          currentRate: refreshRate,
          baseline: this.baseline.avgRefreshesPerMinute,
          multiplier: refreshRate / this.baseline.avgRefreshesPerMinute,
          timestamp: Date.now(),
        });
      }
      
      // Check failed authentication attempts
      const failedAuthKey = this.buildTimeWindowKey('counter', 'auth_failures', {});
      const failedAttempts = parseInt(await this.redis.get(failedAuthKey) || 0);
      if (failedAttempts > this.anomalyThresholds.failedAttemptsThreshold) {
        anomalies.push({
          type: 'excessive_failed_auth',
          severity: 'critical',
          failedAttempts,
          threshold: this.anomalyThresholds.failedAttemptsThreshold,
          timestamp: Date.now(),
        });
      }
      
      // Check suspicious patterns (same client excessive requests)
      const suspiciousClients = await this.detectSuspiciousClients();
      if (suspiciousClients.length > 0) {
        anomalies.push({
          type: 'suspicious_client_activity',
          severity: 'high',
          clients: suspiciousClients,
          timestamp: Date.now(),
        });
      }
      
    } catch (error) {
      console.error('Anomaly detection failed:', error.message);
    }
    
    return anomalies;
  }
  
  /**
   * Detect suspicious client activity
   */
  async detectSuspiciousClients() {
    const suspiciousClients = [];
    
    try {
      // Get all client keys from last 5 minutes
      const pattern = `${config.redis.keyPrefix}token_metrics:counter:*:client_id:*`;
      const keys = await this.redis.keys(pattern);
      
      for (const key of keys) {
        const count = parseInt(await this.redis.get(key) || 0);
        if (count > this.anomalyThresholds.suspiciousPatternThreshold) {
          const clientId = key.split(':').pop();
          suspiciousClients.push({
            clientId,
            requestCount: count,
            timeWindow: '5 minutes',
          });
        }
      }
    } catch (error) {
      console.error('Failed to detect suspicious clients:', error.message);
    }
    
    return suspiciousClients;
  }
  
  /**
   * Update baseline metrics
   */
  async updateBaseline(metric, value) {
    try {
      // Simple moving average
      const alpha = 0.1; // Weight for new value
      this.baseline[metric] = (this.baseline[metric] * (1 - alpha)) + (value * alpha);
      this.baseline.lastUpdate = Date.now();
    } catch (error) {
      console.error('Failed to update baseline:', error.message);
    }
  }
  
  // ============================================================================
  // ALERTING
  // ============================================================================
  
  /**
   * Check if alert should be triggered
   */
  async checkAlerts() {
    const anomalies = await this.detectAnomalies();
    
    for (const anomaly of anomalies) {
      await this.triggerAlert(anomaly);
    }
    
    return anomalies;
  }
  
  /**
   * Trigger alert for anomaly
   */
  async triggerAlert(anomaly) {
    // Log alert
    console.error('OAUTH TOKEN ALERT:', {
      type: anomaly.type,
      severity: anomaly.severity,
      timestamp: new Date(anomaly.timestamp).toISOString(),
      details: anomaly,
    });
    
    // Store alert in Redis for alerting system
    const alertKey = `alert:${anomaly.type}:${anomaly.timestamp}`;
    await this.redis.setex(alertKey, 3600, JSON.stringify(anomaly));
    
    // In production, integrate with alerting service (PagerDuty, Slack, etc.)
  }
  
  // ============================================================================
  // REPORTING
  // ============================================================================
  
  /**
   * Get comprehensive metrics report
   */
  async getMetricsReport(timeframe = '1h') {
    try {
      const windowMinutes = this.parseTimeframe(timeframe);
      
      // Get counters
      const tokensGenerated = await this.getCounter('tokens_generated', {});
      const tokensRefreshed = await this.getCounter('tokens_refreshed', {});
      const tokensRevoked = await this.getCounter('tokens_revoked', {});
      const authFailures = await this.getCounter('auth_failures', {});
      
      // Get rates
      const generationRate = await this.getTokenGenerationRate(null, windowMinutes);
      const refreshRate = await this.getRefreshRate(null, windowMinutes);
      
      // Get gauges
      const activeTokens = await this.getGauge('active_tokens');
      const activeRefreshTokens = await this.getGauge('active_refresh_tokens');
      
      // Get anomalies
      const anomalies = await this.detectAnomalies();
      
      return {
        timeframe,
        timestamp: new Date().toISOString(),
        counters: {
          tokensGenerated,
          tokensRefreshed,
          tokensRevoked,
          authFailures,
        },
        rates: {
          tokenGenerationPerMinute: generationRate,
          refreshPerMinute: refreshRate,
        },
        gauges: {
          activeTokens,
          activeRefreshTokens,
        },
        baseline: this.baseline,
        anomalies,
        health: anomalies.length === 0 ? 'healthy' : 'warning',
      };
    } catch (error) {
      console.error('Failed to generate metrics report:', error.message);
      return { error: error.message };
    }
  }
  
  /**
   * Get client-specific metrics
   */
  async getClientMetrics(clientId, timeframe = '1h') {
    try {
      const windowMinutes = this.parseTimeframe(timeframe);
      
      const tokensGenerated = await this.getCounter('tokens_by_client', { client_id: clientId });
      const tokensRefreshed = await this.getCounter('tokens_refreshed', { client_id: clientId });
      const authFailures = await this.getCounter('auth_failures', { client_id: clientId });
      
      const generationRate = await this.getTokenGenerationRate(clientId, windowMinutes);
      const refreshRate = await this.getRefreshRate(clientId, windowMinutes);
      
      return {
        clientId,
        timeframe,
        timestamp: new Date().toISOString(),
        tokensGenerated,
        tokensRefreshed,
        authFailures,
        generationRate,
        refreshRate,
      };
    } catch (error) {
      console.error('Failed to get client metrics:', error.message);
      return { error: error.message };
    }
  }
  
  /**
   * Get scope usage statistics
   */
  async getScopeStatistics() {
    try {
      const pattern = `${config.redis.keyPrefix}token_metrics:counter:scope_usage:scope:*`;
      const keys = await this.redis.keys(pattern);
      
      const statistics = {};
      
      for (const key of keys) {
        const scope = key.split(':').pop();
        const count = parseInt(await this.redis.get(key) || 0);
        statistics[scope] = count;
      }
      
      // Sort by usage
      const sorted = Object.entries(statistics)
        .sort(([, a], [, b]) => b - a)
        .reduce((acc, [scope, count]) => {
          acc[scope] = count;
          return acc;
        }, {});
      
      return {
        timestamp: new Date().toISOString(),
        scopes: sorted,
        totalScopes: Object.keys(sorted).length,
      };
    } catch (error) {
      console.error('Failed to get scope statistics:', error.message);
      return { error: error.message };
    }
  }
  
  // ============================================================================
  // HELPER METHODS
  // ============================================================================
  
  /**
   * Build metric key
   */
  buildMetricKey(metricType, metricName, tags = {}) {
    const tagString = Object.entries(tags)
      .map(([key, value]) => `${key}:${value}`)
      .join(':');
    
    return tagString 
      ? `${metricType}:${metricName}:${tagString}`
      : `${metricType}:${metricName}`;
  }
  
  /**
   * Build time window key (for current minute/hour)
   */
  buildTimeWindowKey(metricType, metricName, tags = {}) {
    const now = Date.now();
    const currentMinute = Math.floor(now / 60000);
    
    const baseKey = this.buildMetricKey(metricType, metricName, tags);
    return `${baseKey}:window:${currentMinute}`;
  }
  
  /**
   * Get counter value
   */
  async getCounter(metricName, tags = {}) {
    try {
      const key = this.buildMetricKey('counter', metricName, tags);
      const value = await this.redis.get(key);
      return parseInt(value) || 0;
    } catch (error) {
      console.error('Failed to get counter:', error.message);
      return 0;
    }
  }
  
  /**
   * Get gauge value
   */
  async getGauge(metricName, tags = {}) {
    try {
      const key = this.buildMetricKey('gauge', metricName, tags);
      const value = await this.redis.get(key);
      return parseFloat(value) || 0;
    } catch (error) {
      console.error('Failed to get gauge:', error.message);
      return 0;
    }
  }
  
  /**
   * Parse timeframe to minutes
   */
  parseTimeframe(timeframe) {
    const match = timeframe.match(/^(\d+)([mhd])$/);
    if (!match) return 60; // Default 1 hour
    
    const [, value, unit] = match;
    const num = parseInt(value);
    
    switch (unit) {
      case 'm': return num;
      case 'h': return num * 60;
      case 'd': return num * 60 * 24;
      default: return 60;
    }
  }
  
  /**
   * Start background monitoring
   */
  startMonitoring() {
    // Check for anomalies every 60 seconds
    setInterval(async () => {
      try {
        await this.checkAlerts();
      } catch (error) {
        console.error('Monitoring check failed:', error.message);
      }
    }, 60000);
    
    // Update baseline metrics every 5 minutes
    setInterval(async () => {
      try {
        await this.recalculateBaseline();
      } catch (error) {
        console.error('Baseline update failed:', error.message);
      }
    }, 300000);
    
    console.log('Token metrics monitoring started');
  }
  
  /**
   * Recalculate baseline metrics
   */
  async recalculateBaseline() {
    try {
      const report = await this.getMetricsReport('5m');
      
      this.baseline.avgTokensPerMinute = report.rates.tokenGenerationPerMinute;
      this.baseline.avgRefreshesPerMinute = report.rates.refreshPerMinute;
      this.baseline.lastUpdate = Date.now();
      
      console.log('Baseline metrics updated:', this.baseline);
    } catch (error) {
      console.error('Failed to recalculate baseline:', error.message);
    }
  }
  
  /**
   * Get health status
   */
  async getHealthStatus() {
    try {
      await this.redis.ping();
      
      const anomalies = await this.detectAnomalies();
      
      return {
        status: anomalies.length === 0 ? 'healthy' : 'warning',
        redis: {
          connected: true,
        },
        anomalies: anomalies.length,
        baseline: this.baseline,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        redis: {
          connected: false,
        },
      };
    }
  }
  
  /**
   * Close Redis connection
   */
  async close() {
    await this.redis.quit();
  }
}

// Create singleton instance
const tokenMetrics = new TokenMetricsService();

export default tokenMetrics;
