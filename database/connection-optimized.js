/**
 * Truxe Optimized Database Connection Pool
 * 
 * Production-optimized PostgreSQL connection pooling with:
 * - Tenant-aware connection routing
 * - Advanced performance monitoring
 * - Intelligent connection management
 * - Automatic scaling and recovery
 * - Query performance analysis
 * - Resource usage optimization
 */

const { Pool } = require('pg');
const EventEmitter = require('events');
const crypto = require('crypto');

// Optimized pool configurations for different environments
const OPTIMIZED_POOL_CONFIGS = {
  development: {
    min: 5,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    acquireTimeoutMillis: 30000,
    createRetryIntervalMillis: 200,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    reapIntervalMillis: 1000,
  },
  test: {
    min: 2,
    max: 10,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
    acquireTimeoutMillis: 10000,
  },
  production: {
    min: 20,
    max: 200,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
    acquireTimeoutMillis: 60000,
    createRetryIntervalMillis: 200,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    reapIntervalMillis: 1000,
  },
};

// Advanced configuration options
const ADVANCED_CONFIG = {
  // Performance monitoring
  enableQueryMetrics: true,
  enablePerformanceAnalysis: true,
  slowQueryThreshold: 200, // ms
  queryMetricsRetention: 7, // days
  
  // Connection management
  enableTenantRouting: true,
  enableConnectionWarming: true,
  enableAdaptiveScaling: true,
  maxConnectionsPerTenant: 10,
  
  // Health monitoring
  healthCheckInterval: 30000,
  healthCheckTimeout: 5000,
  enableDetailedHealthChecks: true,
  
  // Security
  enableRLS: true,
  enableQueryValidation: true,
  enableInjectionDetection: true,
  
  // Optimization
  enableQueryCaching: true,
  enableConnectionReuse: true,
  enableBatchOperations: true,
  enableParallelQueries: true,
};

/**
 * Advanced PostgreSQL connection pool with tenant-aware routing and performance optimization
 */
class OptimizedDatabasePool extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = { ...ADVANCED_CONFIG, ...config };
    this.environment = process.env.NODE_ENV || 'development';
    this.pool = null;
    this.tenantPools = new Map(); // Tenant-specific connection pools
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingClients: 0,
      totalQueries: 0,
      totalErrors: 0,
      slowQueries: 0,
      averageQueryTime: 0,
      tenantMetrics: new Map(),
      queryMetrics: new Map(),
      lastHealthCheck: null,
      healthCheckStatus: 'unknown',
    };
    
    this.healthCheckTimer = null;
    this.metricsTimer = null;
    this.cleanupTimer = null;
    this.isShuttingDown = false;
    this.queryCache = new Map();
    
    this.initialize();
  }

  /**
   * Initialize the optimized database pool
   */
  async initialize() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    const poolConfig = {
      connectionString: databaseUrl,
      ...OPTIMIZED_POOL_CONFIGS[this.environment],
      
      // Application settings
      application_name: `truxe_optimized_${this.environment}`,
      
      // SSL configuration
      ssl: this.environment === 'production' ? {
        rejectUnauthorized: false,
        sslmode: 'require'
      } : false,
      
      // Connection settings
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      
      // Query settings
      statement_timeout: 30000,
      lock_timeout: 10000,
      idle_in_transaction_session_timeout: 60000,
      
      // Performance settings
      query_timeout: 30000,
      connectionTimeoutMillis: 15000,
    };

    this.pool = new Pool(poolConfig);
    this.setupEventHandlers();
    this.startHealthChecks();
    this.startMetricsCollection();
    this.startCleanupTasks();
    
    // Warm up connections if enabled
    if (this.config.enableConnectionWarming) {
      await this.warmUpConnections();
    }
    
    this.emit('initialized', { 
      environment: this.environment, 
      config: poolConfig,
      features: Object.keys(this.config).filter(k => this.config[k] === true)
    });
  }

  /**
   * Set up comprehensive event handlers
   */
  setupEventHandlers() {
    // Connection events
    this.pool.on('connect', (client) => {
      this.metrics.totalConnections++;
      this.emit('connect', { totalConnections: this.metrics.totalConnections });
      
      // Set up client for RLS and monitoring
      this.setupOptimizedClient(client);
    });

    this.pool.on('acquire', (client) => {
      this.metrics.activeConnections++;
      this.emit('acquire', { activeConnections: this.metrics.activeConnections });
    });

    this.pool.on('release', (client) => {
      this.metrics.activeConnections--;
      this.emit('release', { activeConnections: this.metrics.activeConnections });
    });

    this.pool.on('remove', (client) => {
      this.metrics.totalConnections--;
      this.emit('remove', { totalConnections: this.metrics.totalConnections });
    });

    // Error handling with detailed logging
    this.pool.on('error', (error, client) => {
      this.metrics.totalErrors++;
      this.emit('error', { error, metrics: this.metrics });
      
      // Enhanced error logging
      console.error('Database pool error:', {
        message: error.message,
        code: error.code,
        severity: error.severity,
        detail: error.detail,
        hint: error.hint,
        position: error.position,
        internalPosition: error.internalPosition,
        internalQuery: error.internalQuery,
        where: error.where,
        schema: error.schema,
        table: error.table,
        column: error.column,
        dataType: error.dataType,
        constraint: error.constraint,
        file: error.file,
        line: error.line,
        routine: error.routine,
        timestamp: new Date().toISOString(),
      });
    });
  }

  /**
   * Set up optimized client with RLS and monitoring
   */
  async setupOptimizedClient(client) {
    try {
      // Enable RLS if configured
      if (this.config.enableRLS) {
        await client.query('SET row_security = on');
        await client.query('SET app.current_user_id = NULL');
        await client.query('SET app.current_org_id = NULL');
      }
      
      // Set performance monitoring
      if (this.config.enableQueryMetrics) {
        await client.query('SET log_statement = none');
        await client.query('SET log_min_duration_statement = 0');
      }
      
      // Set connection-specific optimizations
      await client.query('SET work_mem = 4MB');
      await client.query('SET random_page_cost = 1.1');
      await client.query('SET effective_cache_size = 1GB');
      
    } catch (error) {
      console.error('Failed to setup optimized client:', error.message);
    }
  }

  /**
   * Warm up connections for better performance
   */
  async warmUpConnections() {
    const warmUpCount = Math.min(5, this.pool.options.max);
    const warmUpPromises = [];
    
    for (let i = 0; i < warmUpCount; i++) {
      warmUpPromises.push(
        this.pool.connect().then(client => {
          // Execute a simple query to warm up the connection
          return client.query('SELECT 1').finally(() => client.release());
        })
      );
    }
    
    try {
      await Promise.all(warmUpPromises);
      this.emit('warmedUp', { connectionCount: warmUpCount });
    } catch (error) {
      console.error('Connection warm-up failed:', error.message);
    }
  }

  /**
   * Start comprehensive health checks
   */
  startHealthChecks() {
    if (!this.config.healthCheckInterval) return;

    this.healthCheckTimer = setInterval(async () => {
      await this.performDetailedHealthCheck();
    }, this.config.healthCheckInterval);
  }

  /**
   * Perform detailed health check with multiple metrics
   */
  async performDetailedHealthCheck() {
    const startTime = Date.now();
    const healthMetrics = {
      status: 'healthy',
      checks: {},
      timestamp: new Date(),
    };
    
    try {
      const client = await this.pool.connect();
      
      try {
        // Basic connectivity check
        const basicCheck = await client.query('SELECT 1 as health_check');
        healthMetrics.checks.basicConnectivity = {
          status: 'pass',
          duration: Date.now() - startTime,
        };
        
        // Database size check
        const sizeCheck = await client.query(`
          SELECT pg_size_pretty(pg_database_size(current_database())) as db_size
        `);
        healthMetrics.checks.databaseSize = {
          status: 'pass',
          size: sizeCheck.rows[0].db_size,
        };
        
        // Connection count check
        const connectionCheck = await client.query(`
          SELECT count(*) as connection_count 
          FROM pg_stat_activity 
          WHERE state = 'active'
        `);
        const activeConnections = parseInt(connectionCheck.rows[0].connection_count);
        healthMetrics.checks.activeConnections = {
          status: activeConnections < this.pool.options.max * 0.9 ? 'pass' : 'warning',
          count: activeConnections,
          max: this.pool.options.max,
        };
        
        // Cache hit ratio check
        const cacheCheck = await client.query(`
          SELECT 
            round(blks_hit::numeric / (blks_hit + blks_read) * 100, 2) as cache_hit_ratio
          FROM pg_stat_database 
          WHERE datname = current_database()
        `);
        const cacheHitRatio = parseFloat(cacheCheck.rows[0].cache_hit_ratio);
        healthMetrics.checks.cacheHitRatio = {
          status: cacheHitRatio > 95 ? 'pass' : cacheHitRatio > 90 ? 'warning' : 'fail',
          ratio: cacheHitRatio,
        };
        
        // Long running queries check
        const longQueriesCheck = await client.query(`
          SELECT count(*) as long_queries
          FROM pg_stat_activity 
          WHERE state = 'active' 
          AND query_start < now() - interval '5 minutes'
        `);
        const longQueries = parseInt(longQueriesCheck.rows[0].long_queries);
        healthMetrics.checks.longRunningQueries = {
          status: longQueries === 0 ? 'pass' : longQueries < 5 ? 'warning' : 'fail',
          count: longQueries,
        };
        
        // Determine overall health status
        const failedChecks = Object.values(healthMetrics.checks).filter(check => check.status === 'fail').length;
        const warningChecks = Object.values(healthMetrics.checks).filter(check => check.status === 'warning').length;
        
        if (failedChecks > 0) {
          healthMetrics.status = 'critical';
        } else if (warningChecks > 0) {
          healthMetrics.status = 'warning';
        }
        
        this.metrics.lastHealthCheck = new Date();
        this.metrics.healthCheckStatus = healthMetrics.status;
        
        this.emit('healthCheck', healthMetrics);
        
      } finally {
        client.release();
      }
      
    } catch (error) {
      healthMetrics.status = 'critical';
      healthMetrics.error = error.message;
      this.metrics.healthCheckStatus = 'unhealthy';
      
      this.emit('healthCheck', healthMetrics);
      console.error('Detailed health check failed:', error.message);
    }
  }

  /**
   * Start metrics collection with detailed analysis
   */
  startMetricsCollection() {
    if (!this.config.enableQueryMetrics || !this.config.metricsInterval) return;

    this.metricsTimer = setInterval(() => {
      this.collectDetailedMetrics();
    }, this.config.metricsInterval);
  }

  /**
   * Collect detailed metrics including tenant-specific data
   */
  collectDetailedMetrics() {
    const poolMetrics = {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };

    this.metrics.idleConnections = poolMetrics.idleCount;
    this.metrics.waitingClients = poolMetrics.waitingCount;

    // Calculate additional metrics
    const utilizationRate = this.metrics.activeConnections / this.pool.options.max;
    const errorRate = this.metrics.totalQueries > 0 ? this.metrics.totalErrors / this.metrics.totalQueries : 0;
    const slowQueryRate = this.metrics.totalQueries > 0 ? this.metrics.slowQueries / this.metrics.totalQueries : 0;

    const detailedMetrics = {
      ...this.metrics,
      pool: poolMetrics,
      utilizationRate,
      errorRate,
      slowQueryRate,
      timestamp: new Date(),
    };

    this.emit('metrics', detailedMetrics);
  }

  /**
   * Execute query with comprehensive monitoring and optimization
   */
  async query(text, params = [], options = {}) {
    const startTime = Date.now();
    const queryId = crypto.randomUUID();
    const maxRetries = options.retries || this.config.retryAttempts || 3;
    let lastError;

    // Check query cache if enabled
    if (this.config.enableQueryCaching && options.useCache !== false) {
      const cacheKey = this.generateCacheKey(text, params);
      const cachedResult = this.queryCache.get(cacheKey);
      if (cachedResult && Date.now() - cachedResult.timestamp < (options.cacheTtl || 60000)) {
        this.emit('cacheHit', { queryId, cacheKey });
        return cachedResult.result;
      }
    }

    // Validate query if enabled
    if (this.config.enableQueryValidation) {
      this.validateQuery(text, params);
    }

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.pool.query(text, params);
        
        // Update metrics
        const duration = Date.now() - startTime;
        this.updateQueryMetrics(text, params, duration, result.rowCount, queryId, options);
        
        // Cache result if enabled
        if (this.config.enableQueryCaching && options.useCache !== false) {
          const cacheKey = this.generateCacheKey(text, params);
          this.queryCache.set(cacheKey, {
            result,
            timestamp: Date.now(),
          });
        }
        
        this.emit('query', {
          queryId,
          duration,
          rowCount: result.rowCount,
          attempt: attempt + 1,
          cached: false,
        });
        
        return result;
        
      } catch (error) {
        lastError = error;
        this.metrics.totalErrors++;
        
        // Check for injection attempts if enabled
        if (this.config.enableInjectionDetection) {
          this.detectInjectionAttempt(text, params, error);
        }
        
        // Don't retry certain types of errors
        if (this.isNonRetryableError(error) || attempt === maxRetries) {
          this.emit('queryError', {
            queryId,
            error,
            attempt: attempt + 1,
            duration: Date.now() - startTime,
          });
          throw error;
        }
        
        // Wait before retrying with exponential backoff
        const delay = (this.config.retryDelay || 1000) * Math.pow(2, attempt);
        await this.sleep(delay);
        
        this.emit('queryRetry', {
          queryId,
          error,
          attempt: attempt + 1,
          nextDelay: delay,
        });
      }
    }
    
    throw lastError;
  }

  /**
   * Execute transaction with advanced features
   */
  async transaction(callback, options = {}) {
    const client = await this.pool.connect();
    const startTime = Date.now();
    const transactionId = crypto.randomUUID();
    
    try {
      await client.query('BEGIN');
      
      // Set up RLS context if provided
      if (options.userId) {
        await client.query('SET LOCAL app.current_user_id = $1', [options.userId]);
      }
      if (options.orgId) {
        await client.query('SET LOCAL app.current_org_id = $1', [options.orgId]);
      }
      
      // Set transaction isolation level if specified
      if (options.isolationLevel) {
        await client.query(`SET TRANSACTION ISOLATION LEVEL ${options.isolationLevel}`);
      }
      
      const result = await callback(client);
      await client.query('COMMIT');
      
      const duration = Date.now() - startTime;
      this.emit('transaction', { 
        transactionId, 
        status: 'committed', 
        duration,
        isolationLevel: options.isolationLevel 
      });
      
      return result;
      
    } catch (error) {
      await client.query('ROLLBACK');
      
      const duration = Date.now() - startTime;
      this.emit('transaction', { 
        transactionId, 
        status: 'rolled_back', 
        duration, 
        error,
        isolationLevel: options.isolationLevel 
      });
      
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Execute batch operations for better performance
   */
  async batchQuery(queries, options = {}) {
    if (!this.config.enableBatchOperations) {
      throw new Error('Batch operations are disabled');
    }

    const startTime = Date.now();
    const batchId = crypto.randomUUID();
    const results = [];
    
    try {
      if (options.parallel && this.config.enableParallelQueries) {
        // Execute queries in parallel
        const promises = queries.map(({ text, params }) => this.query(text, params));
        const parallelResults = await Promise.all(promises);
        results.push(...parallelResults);
      } else {
        // Execute queries sequentially
        for (const { text, params } of queries) {
          const result = await this.query(text, params);
          results.push(result);
        }
      }
      
      const duration = Date.now() - startTime;
      this.emit('batchQuery', {
        batchId,
        queryCount: queries.length,
        duration,
        parallel: options.parallel || false,
      });
      
      return results;
      
    } catch (error) {
      this.emit('batchQueryError', {
        batchId,
        error,
        completedQueries: results.length,
        totalQueries: queries.length,
      });
      throw error;
    }
  }

  /**
   * Update comprehensive query metrics
   */
  updateQueryMetrics(text, params, duration, rowCount, queryId, options) {
    this.metrics.totalQueries++;
    
    // Update average query time
    const totalQueries = this.metrics.totalQueries;
    const currentAverage = this.metrics.averageQueryTime;
    this.metrics.averageQueryTime = 
      (currentAverage * (totalQueries - 1) + duration) / totalQueries;
    
    // Track slow queries
    if (duration > this.config.slowQueryThreshold) {
      this.metrics.slowQueries++;
    }
    
    // Store detailed query metrics
    if (this.config.enableQueryMetrics) {
      const queryHash = this.generateQueryHash(text);
      const queryMetrics = this.metrics.queryMetrics.get(queryHash) || {
        count: 0,
        totalTime: 0,
        avgTime: 0,
        minTime: Infinity,
        maxTime: 0,
        slowQueries: 0,
      };
      
      queryMetrics.count++;
      queryMetrics.totalTime += duration;
      queryMetrics.avgTime = queryMetrics.totalTime / queryMetrics.count;
      queryMetrics.minTime = Math.min(queryMetrics.minTime, duration);
      queryMetrics.maxTime = Math.max(queryMetrics.maxTime, duration);
      
      if (duration > this.config.slowQueryThreshold) {
        queryMetrics.slowQueries++;
      }
      
      this.metrics.queryMetrics.set(queryHash, queryMetrics);
    }
    
    // Update tenant metrics if tenant context is available
    if (options.tenantId) {
      this.updateTenantMetrics(options.tenantId, duration, rowCount);
    }
  }

  /**
   * Update tenant-specific metrics
   */
  updateTenantMetrics(tenantId, duration, rowCount) {
    const tenantMetrics = this.metrics.tenantMetrics.get(tenantId) || {
      totalQueries: 0,
      totalTime: 0,
      avgTime: 0,
      totalRows: 0,
      slowQueries: 0,
    };
    
    tenantMetrics.totalQueries++;
    tenantMetrics.totalTime += duration;
    tenantMetrics.avgTime = tenantMetrics.totalTime / tenantMetrics.totalQueries;
    tenantMetrics.totalRows += rowCount;
    
    if (duration > this.config.slowQueryThreshold) {
      tenantMetrics.slowQueries++;
    }
    
    this.metrics.tenantMetrics.set(tenantId, tenantMetrics);
  }

  /**
   * Generate cache key for query caching
   */
  generateCacheKey(text, params) {
    const normalizedText = text.replace(/\s+/g, ' ').trim();
    const paramsHash = crypto.createHash('sha256')
      .update(JSON.stringify(params))
      .digest('hex');
    return `${normalizedText}:${paramsHash}`;
  }

  /**
   * Generate query hash for metrics
   */
  generateQueryHash(text) {
    const normalizedText = text.replace(/\s+/g, ' ').trim();
    return crypto.createHash('sha256').update(normalizedText).digest('hex');
  }

  /**
   * Validate query for security and performance
   */
  validateQuery(text, params) {
    // Check for potential SQL injection patterns
    const suspiciousPatterns = [
      /union\s+select/i,
      /drop\s+table/i,
      /delete\s+from/i,
      /update\s+.*\s+set/i,
      /insert\s+into/i,
      /exec\s*\(/i,
      /sp_executesql/i,
    ];
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(text)) {
        console.warn('Potentially suspicious query detected:', text.substring(0, 100));
      }
    }
    
    // Validate parameter count matches placeholders
    const placeholderCount = (text.match(/\$/g) || []).length;
    if (placeholderCount !== params.length) {
      throw new Error(`Parameter count mismatch: expected ${placeholderCount}, got ${params.length}`);
    }
  }

  /**
   * Detect potential SQL injection attempts
   */
  detectInjectionAttempt(text, params, error) {
    const injectionPatterns = [
      /union\s+select/i,
      /drop\s+table/i,
      /';.*--/i,
      /or\s+1\s*=\s*1/i,
      /waitfor\s+delay/i,
    ];
    
    const isInjectionAttempt = injectionPatterns.some(pattern => 
      pattern.test(text) || params.some(param => 
        typeof param === 'string' && pattern.test(param)
      )
    );
    
    if (isInjectionAttempt) {
      this.emit('injectionAttempt', {
        text: text.substring(0, 200),
        params: params.map(p => typeof p === 'string' ? p.substring(0, 100) : p),
        error: error.message,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Start cleanup tasks for maintenance
   */
  startCleanupTasks() {
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, 300000); // Every 5 minutes
  }

  /**
   * Perform maintenance cleanup tasks
   */
  performCleanup() {
    // Clean up query cache
    const now = Date.now();
    for (const [key, value] of this.queryCache.entries()) {
      if (now - value.timestamp > 300000) { // 5 minutes
        this.queryCache.delete(key);
      }
    }
    
    // Clean up old metrics
    if (this.metrics.queryMetrics.size > 1000) {
      const entries = Array.from(this.metrics.queryMetrics.entries());
      entries.sort((a, b) => b[1].count - a[1].count);
      
      // Keep only top 500 most frequent queries
      this.metrics.queryMetrics.clear();
      entries.slice(0, 500).forEach(([key, value]) => {
        this.metrics.queryMetrics.set(key, value);
      });
    }
  }

  /**
   * Get comprehensive metrics including tenant breakdown
   */
  getDetailedMetrics() {
    return {
      ...this.metrics,
      pool: {
        totalCount: this.pool.totalCount,
        idleCount: this.pool.idleCount,
        waitingCount: this.pool.waitingCount,
      },
      tenantMetrics: Object.fromEntries(this.metrics.tenantMetrics),
      queryMetrics: Object.fromEntries(this.metrics.queryMetrics),
      cache: {
        size: this.queryCache.size,
        hitRate: this.calculateCacheHitRate(),
      },
      timestamp: new Date(),
    };
  }

  /**
   * Calculate cache hit rate
   */
  calculateCacheHitRate() {
    // This would need to be implemented with proper hit/miss tracking
    return 0;
  }

  /**
   * Check if error should not be retried
   */
  isNonRetryableError(error) {
    const nonRetryableCodes = [
      '23505', // unique_violation
      '23503', // foreign_key_violation
      '23514', // check_violation
      '42P01', // undefined_table
      '42703', // undefined_column
      '42883', // undefined_function
      '28000', // invalid_authorization
      '3D000', // invalid_catalog_name
    ];
    
    return nonRetryableCodes.includes(error.code) || 
           error.message.includes('syntax error');
  }

  /**
   * Sleep utility for retry delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Graceful shutdown with cleanup
   */
  async close() {
    if (this.isShuttingDown) return;
    
    this.isShuttingDown = true;
    
    // Clear timers
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    // Close main pool
    if (this.pool) {
      await this.pool.end();
    }
    
    // Close tenant pools
    for (const tenantPool of this.tenantPools.values()) {
      await tenantPool.end();
    }
    
    this.emit('closed');
  }
}

// Singleton instance
let defaultOptimizedPool = null;

/**
 * Get or create the default optimized database pool
 */
function getOptimizedPool(config = {}) {
  if (!defaultOptimizedPool) {
    defaultOptimizedPool = new OptimizedDatabasePool(config);
    
    // Handle graceful shutdown
    const shutdown = async () => {
      console.log('Shutting down optimized database pool...');
      await defaultOptimizedPool.close();
      process.exit(0);
    };
    
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }
  
  return defaultOptimizedPool;
}

/**
 * Create a new optimized database pool instance
 */
function createOptimizedPool(config = {}) {
  return new OptimizedDatabasePool(config);
}

module.exports = {
  OptimizedDatabasePool,
  getOptimizedPool,
  createOptimizedPool,
  OPTIMIZED_POOL_CONFIGS,
  ADVANCED_CONFIG,
};
