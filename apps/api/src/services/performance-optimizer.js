/**
 * Heimdall Performance Optimizer
 * 
 * Enterprise-grade performance optimization service providing caching strategies,
 * database query optimization, connection pooling, memory management,
 * and performance monitoring for production environments.
 * 
 * @author Performance Engineering Team
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import Redis from 'ioredis';
// import { getOptimizedPool } from '../../database/connection-optimized.js';
import config from '../config/index.js';

/**
 * Cache Strategies
 */
export const CacheStrategy = {
  WRITE_THROUGH: 'write_through',
  WRITE_BEHIND: 'write_behind',
  CACHE_ASIDE: 'cache_aside',
  READ_THROUGH: 'read_through'
};

/**
 * Performance Metrics Types
 */
export const MetricType = {
  QUERY_TIME: 'query_time',
  CACHE_HIT: 'cache_hit',
  CACHE_MISS: 'cache_miss',
  CONNECTION_POOL: 'connection_pool',
  MEMORY_USAGE: 'memory_usage',
  CPU_USAGE: 'cpu_usage',
  RESPONSE_TIME: 'response_time'
};

/**
 * Performance Optimizer Service
 */
export class PerformanceOptimizer extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      // Cache configuration
      cacheEnabled: options.cacheEnabled !== false,
      cacheStrategy: options.cacheStrategy || CacheStrategy.CACHE_ASIDE,
      cacheTTL: options.cacheTTL || 3600, // 1 hour
      cachePrefix: options.cachePrefix || 'heimdall:cache:',
      
      // Database optimization
      queryTimeout: options.queryTimeout || 30000, // 30 seconds
      slowQueryThreshold: options.slowQueryThreshold || 1000, // 1 second
      enableQueryOptimization: options.enableQueryOptimization !== false,
      
      // Connection pooling
      poolMonitoringInterval: options.poolMonitoringInterval || 30000, // 30 seconds
      poolOptimizationEnabled: options.poolOptimizationEnabled !== false,
      
      // Memory management
      memoryMonitoringInterval: options.memoryMonitoringInterval || 60000, // 1 minute
      memoryThreshold: options.memoryThreshold || 0.85, // 85%
      enableGCOptimization: options.enableGCOptimization !== false,
      
      // Performance monitoring
      metricsRetentionMs: options.metricsRetentionMs || 3600000, // 1 hour
      enableRealTimeMetrics: options.enableRealTimeMetrics !== false,
      
      ...options
    };

    this.redis = null;
    this.dbPool = null;
    this.metrics = new Map();
    this.queryCache = new Map();
    this.performanceHistory = [];
    this.activeQueries = new Map();
    
    this.initialize();
  }

  /**
   * Initialize performance optimizer
   */
  async initialize() {
    try {
      // Initialize Redis for caching
      if (this.options.cacheEnabled) {
        await this.initializeCache();
      }
      
      // Initialize database pool monitoring
      if (this.options.poolOptimizationEnabled) {
        await this.initializeDatabaseOptimization();
      }
      
      // Start performance monitoring
      if (this.options.enableRealTimeMetrics) {
        this.startPerformanceMonitoring();
      }
      
      // Start memory monitoring
      if (this.options.enableGCOptimization) {
        this.startMemoryOptimization();
      }
      
      this.emit('initialized');
    } catch (error) {
      this.emit('initialization_error', error);
      throw error;
    }
  }

  /**
   * Initialize caching system
   */
  async initializeCache() {
    this.redis = new Redis(config.redis.url, {
      keyPrefix: this.options.cachePrefix,
      retryDelayOnFailover: config.redis.retryDelayOnFailover,
      maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
      lazyConnect: true,
    });

    this.redis.on('connect', () => {
      this.emit('cache_connected');
    });

    this.redis.on('error', (error) => {
      this.emit('cache_error', error);
    });

    await this.redis.connect();
  }

  /**
   * Initialize database optimization
   */
  async initializeDatabaseOptimization() {
    // Database pool disabled - using default connection
    this.dbPool = null;
    
    // Monitor connection pool
    setInterval(() => {
      this.monitorConnectionPool();
    }, this.options.poolMonitoringInterval);
  }

  /**
   * Start performance monitoring
   */
  startPerformanceMonitoring() {
    setInterval(() => {
      this.collectPerformanceMetrics();
    }, 10000); // Every 10 seconds

    // Clean up old metrics
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 300000); // Every 5 minutes
  }

  /**
   * Start memory optimization
   */
  startMemoryOptimization() {
    setInterval(() => {
      this.monitorMemoryUsage();
    }, this.options.memoryMonitoringInterval);
  }

  /**
   * Execute optimized database query
   */
  async executeOptimizedQuery(query, params = [], options = {}) {
    const queryId = this.generateQueryId();
    const startTime = process.hrtime.bigint();
    
    try {
      // Check cache first (if enabled and query is cacheable)
      if (this.options.cacheEnabled && this.isCacheableQuery(query)) {
        const cacheKey = this.generateCacheKey(query, params);
        const cachedResult = await this.getFromCache(cacheKey);
        
        if (cachedResult) {
          this.recordMetric(MetricType.CACHE_HIT, {
            queryId,
            query: this.sanitizeQuery(query),
            executionTime: Number(process.hrtime.bigint() - startTime) / 1000000 // ms
          });
          
          return cachedResult;
        }
        
        this.recordMetric(MetricType.CACHE_MISS, { queryId, query: this.sanitizeQuery(query) });
      }

      // Track active query
      this.activeQueries.set(queryId, {
        query: this.sanitizeQuery(query),
        startTime,
        params: params.length
      });

      // Execute query with optimization
      const optimizedQuery = await this.optimizeQuery(query, params, options);
      const result = await this.dbPool.query(optimizedQuery.query, optimizedQuery.params);
      
      const executionTime = Number(process.hrtime.bigint() - startTime) / 1000000; // ms
      
      // Cache result if applicable
      if (this.options.cacheEnabled && this.isCacheableQuery(query)) {
        const cacheKey = this.generateCacheKey(query, params);
        await this.setCache(cacheKey, result, options.cacheTTL);
      }
      
      // Record performance metrics
      this.recordMetric(MetricType.QUERY_TIME, {
        queryId,
        query: this.sanitizeQuery(query),
        executionTime,
        rowCount: result.rows?.length || 0,
        cached: false
      });
      
      // Check for slow queries
      if (executionTime > this.options.slowQueryThreshold) {
        this.emit('slow_query_detected', {
          queryId,
          query: this.sanitizeQuery(query),
          executionTime,
          params: params.length
        });
      }
      
      return result;
    } catch (error) {
      const executionTime = Number(process.hrtime.bigint() - startTime) / 1000000;
      
      this.emit('query_error', {
        queryId,
        query: this.sanitizeQuery(query),
        error: error.message,
        executionTime
      });
      
      throw error;
    } finally {
      this.activeQueries.delete(queryId);
    }
  }

  /**
   * Optimize query based on patterns and statistics
   */
  async optimizeQuery(query, params, options = {}) {
    let optimizedQuery = query;
    let optimizedParams = params;
    
    // Add query hints for better performance
    if (this.options.enableQueryOptimization) {
      // Add LIMIT if not present and it's a SELECT query
      if (query.trim().toLowerCase().startsWith('select') && 
          !query.toLowerCase().includes('limit') && 
          !options.skipLimit) {
        const defaultLimit = options.limit || 1000;
        optimizedQuery += ` LIMIT ${defaultLimit}`;
      }
      
      // Add query timeout
      if (options.timeout || this.options.queryTimeout) {
        const timeout = options.timeout || this.options.queryTimeout;
        optimizedQuery = `SET statement_timeout = ${timeout}; ${optimizedQuery}`;
      }
      
      // Optimize common patterns
      optimizedQuery = this.applyQueryOptimizations(optimizedQuery);
    }
    
    return {
      query: optimizedQuery,
      params: optimizedParams
    };
  }

  /**
   * Apply common query optimizations
   */
  applyQueryOptimizations(query) {
    let optimized = query;
    
    // Use EXISTS instead of IN for subqueries
    optimized = optimized.replace(
      /IN\s*\(\s*SELECT\s+/gi,
      'EXISTS (SELECT 1 FROM ('
    );
    
    // Add index hints for common patterns
    if (optimized.toLowerCase().includes('where') && 
        optimized.toLowerCase().includes('created_at')) {
      // Suggest using index on created_at for time-based queries
      optimized = optimized.replace(
        /WHERE\s+/gi,
        'WHERE /*+ INDEX(created_at) */ '
      );
    }
    
    return optimized;
  }

  /**
   * Batch execute multiple queries
   */
  async executeBatch(queries, options = {}) {
    const batchId = this.generateBatchId();
    const startTime = process.hrtime.bigint();
    
    try {
      const results = [];
      const client = await this.dbPool.connect();
      
      try {
        if (options.transaction) {
          await client.query('BEGIN');
        }
        
        for (const [query, params] of queries) {
          const result = await client.query(query, params);
          results.push(result);
        }
        
        if (options.transaction) {
          await client.query('COMMIT');
        }
        
        const executionTime = Number(process.hrtime.bigint() - startTime) / 1000000;
        
        this.recordMetric('batch_execution', {
          batchId,
          queryCount: queries.length,
          executionTime,
          transaction: options.transaction || false
        });
        
        return results;
      } catch (error) {
        if (options.transaction) {
          await client.query('ROLLBACK');
        }
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      this.emit('batch_error', {
        batchId,
        error: error.message,
        queryCount: queries.length
      });
      throw error;
    }
  }

  /**
   * Cache operations
   */
  async getFromCache(key) {
    if (!this.redis) return null;
    
    try {
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      this.emit('cache_error', { operation: 'get', key, error: error.message });
      return null;
    }
  }

  async setCache(key, value, ttl = null) {
    if (!this.redis) return false;
    
    try {
      const serialized = JSON.stringify(value);
      const cacheTTL = ttl || this.options.cacheTTL;
      
      if (cacheTTL) {
        await this.redis.setex(key, cacheTTL, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
      
      return true;
    } catch (error) {
      this.emit('cache_error', { operation: 'set', key, error: error.message });
      return false;
    }
  }

  async deleteFromCache(key) {
    if (!this.redis) return false;
    
    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      this.emit('cache_error', { operation: 'delete', key, error: error.message });
      return false;
    }
  }

  async clearCache(pattern = '*') {
    if (!this.redis) return false;
    
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      return true;
    } catch (error) {
      this.emit('cache_error', { operation: 'clear', pattern, error: error.message });
      return false;
    }
  }

  /**
   * Monitor connection pool performance
   */
  monitorConnectionPool() {
    if (!this.dbPool) return;
    
    try {
      const metrics = this.dbPool.getDetailedMetrics();
      
      this.recordMetric(MetricType.CONNECTION_POOL, {
        totalConnections: metrics.totalConnections,
        idleConnections: metrics.idleConnections,
        activeConnections: metrics.activeConnections,
        waitingClients: metrics.waitingClients,
        utilizationRate: metrics.utilizationRate,
        avgQueryTime: metrics.avgQueryTime
      });
      
      // Emit warnings for pool issues
      if (metrics.utilizationRate > 0.9) {
        this.emit('pool_high_utilization', metrics);
      }
      
      if (metrics.waitingClients > 10) {
        this.emit('pool_high_wait_queue', metrics);
      }
    } catch (error) {
      this.emit('pool_monitoring_error', error);
    }
  }

  /**
   * Monitor memory usage and optimize
   */
  monitorMemoryUsage() {
    const usage = process.memoryUsage();
    const heapUsedMB = usage.heapUsed / 1024 / 1024;
    const heapTotalMB = usage.heapTotal / 1024 / 1024;
    const utilizationRate = heapUsedMB / heapTotalMB;
    
    this.recordMetric(MetricType.MEMORY_USAGE, {
      heapUsed: heapUsedMB,
      heapTotal: heapTotalMB,
      utilizationRate,
      external: usage.external / 1024 / 1024,
      rss: usage.rss / 1024 / 1024
    });
    
    // Trigger garbage collection if memory usage is high
    if (utilizationRate > this.options.memoryThreshold) {
      this.emit('high_memory_usage', {
        heapUsed: heapUsedMB,
        heapTotal: heapTotalMB,
        utilizationRate
      });
      
      if (this.options.enableGCOptimization && global.gc) {
        global.gc();
        this.emit('garbage_collection_triggered', { utilizationRate });
      }
    }
  }

  /**
   * Collect comprehensive performance metrics
   */
  collectPerformanceMetrics() {
    const now = Date.now();
    
    // CPU usage
    const cpuUsage = process.cpuUsage();
    this.recordMetric(MetricType.CPU_USAGE, {
      user: cpuUsage.user / 1000, // Convert to ms
      system: cpuUsage.system / 1000
    });
    
    // Active queries
    const activeQueryCount = this.activeQueries.size;
    const longRunningQueries = Array.from(this.activeQueries.values())
      .filter(query => now - Number(query.startTime) / 1000000 > 5000) // > 5 seconds
      .length;
    
    this.recordMetric('active_queries', {
      count: activeQueryCount,
      longRunning: longRunningQueries
    });
    
    // Cache statistics
    if (this.redis) {
      this.collectCacheMetrics();
    }
  }

  /**
   * Collect cache performance metrics
   */
  async collectCacheMetrics() {
    try {
      const info = await this.redis.info('stats');
      const lines = info.split('\r\n');
      const stats = {};
      
      for (const line of lines) {
        const [key, value] = line.split(':');
        if (key && value) {
          stats[key] = isNaN(value) ? value : Number(value);
        }
      }
      
      if (stats.keyspace_hits !== undefined && stats.keyspace_misses !== undefined) {
        const hitRate = stats.keyspace_hits / (stats.keyspace_hits + stats.keyspace_misses);
        
        this.recordMetric('cache_performance', {
          hits: stats.keyspace_hits,
          misses: stats.keyspace_misses,
          hitRate: hitRate || 0,
          connectedClients: stats.connected_clients
        });
      }
    } catch (error) {
      this.emit('cache_metrics_error', error);
    }
  }

  /**
   * Record performance metric
   */
  recordMetric(type, data) {
    const timestamp = Date.now();
    const metric = {
      type,
      timestamp,
      data
    };
    
    // Store in memory for recent access
    if (!this.metrics.has(type)) {
      this.metrics.set(type, []);
    }
    
    this.metrics.get(type).push(metric);
    
    // Keep only recent metrics in memory
    const maxAge = timestamp - this.options.metricsRetentionMs;
    this.metrics.set(type, 
      this.metrics.get(type).filter(m => m.timestamp > maxAge)
    );
    
    this.emit('metric_recorded', metric);
  }

  /**
   * Get performance metrics
   */
  getMetrics(type = null, timeRange = 3600000) { // Default 1 hour
    const now = Date.now();
    const cutoff = now - timeRange;
    
    if (type) {
      const metrics = this.metrics.get(type) || [];
      return metrics.filter(m => m.timestamp > cutoff);
    }
    
    const allMetrics = {};
    for (const [metricType, metrics] of this.metrics.entries()) {
      allMetrics[metricType] = metrics.filter(m => m.timestamp > cutoff);
    }
    
    return allMetrics;
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary() {
    const summary = {
      timestamp: Date.now(),
      cache: {
        enabled: this.options.cacheEnabled,
        connected: this.redis?.status === 'ready'
      },
      database: {
        optimizationEnabled: this.options.enableQueryOptimization,
        activeQueries: this.activeQueries.size
      },
      memory: {
        usage: process.memoryUsage(),
        gcEnabled: this.options.enableGCOptimization
      }
    };
    
    // Add recent metrics summary
    const recentMetrics = this.getMetrics(null, 300000); // Last 5 minutes
    
    for (const [type, metrics] of Object.entries(recentMetrics)) {
      if (metrics.length > 0) {
        const latest = metrics[metrics.length - 1];
        summary[type] = {
          latest: latest.data,
          count: metrics.length,
          avgValue: this.calculateAverage(metrics)
        };
      }
    }
    
    return summary;
  }

  /**
   * Clean up old metrics
   */
  cleanupOldMetrics() {
    const cutoff = Date.now() - this.options.metricsRetentionMs;
    
    for (const [type, metrics] of this.metrics.entries()) {
      const filtered = metrics.filter(m => m.timestamp > cutoff);
      this.metrics.set(type, filtered);
    }
  }

  /**
   * Helper methods
   */
  isCacheableQuery(query) {
    const lowerQuery = query.toLowerCase().trim();
    
    // Cache SELECT queries but not INSERT/UPDATE/DELETE
    if (!lowerQuery.startsWith('select')) {
      return false;
    }
    
    // Don't cache queries with random functions or current timestamp
    const nonCacheablePatterns = [
      'random()',
      'now()',
      'current_timestamp',
      'current_time',
      'uuid_generate'
    ];
    
    return !nonCacheablePatterns.some(pattern => 
      lowerQuery.includes(pattern.toLowerCase())
    );
  }

  generateCacheKey(query, params) {
    const hash = this.simpleHash(query + JSON.stringify(params));
    return `query:${hash}`;
  }

  generateQueryId() {
    return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateBatchId() {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  sanitizeQuery(query) {
    // Remove sensitive data from query for logging
    return query.replace(/\$\d+/g, '?').substring(0, 200);
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  calculateAverage(metrics) {
    if (!metrics.length) return 0;
    
    const values = metrics.map(m => {
      if (typeof m.data === 'number') return m.data;
      if (m.data.executionTime) return m.data.executionTime;
      if (m.data.utilizationRate) return m.data.utilizationRate;
      return 0;
    });
    
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.redis) {
      await this.redis.disconnect();
    }
    
    this.metrics.clear();
    this.queryCache.clear();
    this.activeQueries.clear();
    this.performanceHistory = [];
    
    this.emit('cleanup_completed');
  }
}

/**
 * Global performance optimizer instance
 */
let globalOptimizer = null;

/**
 * Initialize global performance optimizer
 */
export function initializePerformanceOptimizer(options = {}) {
  if (globalOptimizer) {
    return globalOptimizer;
  }
  
  globalOptimizer = new PerformanceOptimizer(options);
  return globalOptimizer;
}

/**
 * Get global performance optimizer
 */
export function getPerformanceOptimizer() {
  return globalOptimizer;
}

/**
 * Fastify plugin for performance optimization
 */
export function performanceOptimizerPlugin(fastify, options, done) {
  const optimizer = initializePerformanceOptimizer(options);
  
  // Add performance monitoring to requests
  fastify.addHook('onRequest', async (request, reply) => {
    request.startTime = process.hrtime.bigint();
  });
  
  fastify.addHook('onSend', async (request, reply, payload) => {
    if (request.startTime) {
      const responseTime = Number(process.hrtime.bigint() - request.startTime) / 1000000;
      
      optimizer.recordMetric(MetricType.RESPONSE_TIME, {
        url: request.url,
        method: request.method,
        statusCode: reply.statusCode,
        responseTime
      });
    }
    
    return payload;
  });
  
  // Add performance metrics endpoint
  fastify.get('/health/performance', async (request, reply) => {
    const summary = optimizer.getPerformanceSummary();
    reply.send(summary);
  });
  
  // Add performance metrics endpoint with filters
  fastify.get('/health/performance/metrics', async (request, reply) => {
    const { type, timeRange = 3600000 } = request.query;
    const metrics = optimizer.getMetrics(type, parseInt(timeRange));
    reply.send(metrics);
  });
  
  // Decorate fastify with optimizer methods
  fastify.decorate('performanceOptimizer', optimizer);
  fastify.decorate('executeOptimizedQuery', optimizer.executeOptimizedQuery.bind(optimizer));
  fastify.decorate('executeBatch', optimizer.executeBatch.bind(optimizer));
  fastify.decorate('cache', {
    get: optimizer.getFromCache.bind(optimizer),
    set: optimizer.setCache.bind(optimizer),
    delete: optimizer.deleteFromCache.bind(optimizer),
    clear: optimizer.clearCache.bind(optimizer)
  });
  
  done();
}

export default {
  PerformanceOptimizer,
  CacheStrategy,
  MetricType,
  initializePerformanceOptimizer,
  getPerformanceOptimizer,
  performanceOptimizerPlugin
};
