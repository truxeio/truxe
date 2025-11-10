/**
 * Truxe Database Connection Configuration
 * 
 * Provides optimized PostgreSQL connection pooling with comprehensive
 * error handling, monitoring, and security features.
 * 
 * Features:
 * - Optimized connection pooling for 100+ concurrent connections
 * - Automatic retry logic with exponential backoff
 * - Connection health monitoring and recovery
 * - Row Level Security (RLS) session management
 * - Comprehensive error handling and logging
 * - Performance metrics and monitoring
 * - Graceful shutdown handling
 */

const { Pool } = require('pg');
const EventEmitter = require('events');

// Connection pool configurations for different environments
const POOL_CONFIGS = {
  development: {
    min: 2,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    acquireTimeoutMillis: 30000,
  },
  test: {
    min: 1,
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
    acquireTimeoutMillis: 10000,
  },
  production: {
    min: 10,
    max: 100,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
    acquireTimeoutMillis: 60000,
  },
};

// Default configuration
const DEFAULT_CONFIG = {
  // Connection retry settings
  retryAttempts: 3,
  retryDelay: 1000, // Initial delay in ms
  retryBackoffMultiplier: 2,
  
  // Health check settings
  healthCheckInterval: 30000, // 30 seconds
  healthCheckTimeout: 5000,   // 5 seconds
  
  // Monitoring settings
  enableMetrics: true,
  metricsInterval: 60000, // 1 minute
  
  // Security settings
  enableRLS: true,
  statementTimeout: 30000, // 30 seconds
  lockTimeout: 10000,      // 10 seconds
};

/**
 * Enhanced PostgreSQL connection pool with monitoring and error handling
 */
class DatabasePool extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.environment = process.env.NODE_ENV || 'development';
    this.pool = null;
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingClients: 0,
      totalQueries: 0,
      totalErrors: 0,
      averageQueryTime: 0,
      lastHealthCheck: null,
      healthCheckStatus: 'unknown',
    };
    
    this.healthCheckTimer = null;
    this.metricsTimer = null;
    this.isShuttingDown = false;
    
    this.initialize();
  }

  /**
   * Initialize the database pool with optimized settings
   */
  initialize() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    const poolConfig = {
      connectionString: databaseUrl,
      ...POOL_CONFIGS[this.environment],
      
      // Application settings
      application_name: `truxe_${this.environment}`,
      
      // SSL configuration
      ssl: this.environment === 'production' ? {
        rejectUnauthorized: false,
        sslmode: 'require'
      } : false,
      
      // Connection settings
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      
      // Query settings
      statement_timeout: this.config.statementTimeout,
      lock_timeout: this.config.lockTimeout,
      idle_in_transaction_session_timeout: 60000,
    };

    this.pool = new Pool(poolConfig);
    this.setupEventHandlers();
    this.startHealthChecks();
    this.startMetricsCollection();
    
    this.emit('initialized', { environment: this.environment, config: poolConfig });
  }

  /**
   * Set up event handlers for pool monitoring
   */
  setupEventHandlers() {
    // Connection events
    this.pool.on('connect', (client) => {
      this.metrics.totalConnections++;
      this.emit('connect', { totalConnections: this.metrics.totalConnections });
      
      // Set up client for RLS if enabled
      if (this.config.enableRLS) {
        this.setupRLSClient(client);
      }
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

    // Error handling
    this.pool.on('error', (error, client) => {
      this.metrics.totalErrors++;
      this.emit('error', { error, metrics: this.metrics });
      
      // Log error details
      console.error('Database pool error:', {
        message: error.message,
        code: error.code,
        severity: error.severity,
        detail: error.detail,
        timestamp: new Date().toISOString(),
      });
    });
  }

  /**
   * Set up Row Level Security for a client connection
   */
  async setupRLSClient(client) {
    try {
      await client.query('SET row_security = on');
      await client.query('SET app.current_user_id = NULL');
      await client.query('SET app.current_org_id = NULL');
    } catch (error) {
      console.error('Failed to setup RLS for client:', error.message);
    }
  }

  /**
   * Start health check monitoring
   */
  startHealthChecks() {
    if (!this.config.healthCheckInterval) return;

    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  /**
   * Perform database health check
   */
  async performHealthCheck() {
    const startTime = Date.now();
    
    try {
      const client = await this.pool.connect();
      
      try {
        // Simple health check query
        await client.query('SELECT 1 as health_check');
        
        const duration = Date.now() - startTime;
        this.metrics.lastHealthCheck = new Date();
        this.metrics.healthCheckStatus = 'healthy';
        
        this.emit('healthCheck', {
          status: 'healthy',
          duration,
          timestamp: this.metrics.lastHealthCheck,
        });
        
      } finally {
        client.release();
      }
      
    } catch (error) {
      this.metrics.healthCheckStatus = 'unhealthy';
      this.emit('healthCheck', {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date(),
      });
      
      console.error('Database health check failed:', error.message);
    }
  }

  /**
   * Start metrics collection
   */
  startMetricsCollection() {
    if (!this.config.enableMetrics || !this.config.metricsInterval) return;

    this.metricsTimer = setInterval(() => {
      this.collectMetrics();
    }, this.config.metricsInterval);
  }

  /**
   * Collect and emit current metrics
   */
  collectMetrics() {
    const poolMetrics = {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };

    this.metrics.idleConnections = poolMetrics.idleCount;
    this.metrics.waitingClients = poolMetrics.waitingCount;

    this.emit('metrics', {
      ...this.metrics,
      pool: poolMetrics,
      timestamp: new Date(),
    });
  }

  /**
   * Execute a query with automatic retry and error handling
   */
  async query(text, params = [], options = {}) {
    const startTime = Date.now();
    const maxRetries = options.retries || this.config.retryAttempts;
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.pool.query(text, params);
        
        // Update metrics
        const duration = Date.now() - startTime;
        this.metrics.totalQueries++;
        this.updateAverageQueryTime(duration);
        
        this.emit('query', {
          duration,
          rowCount: result.rowCount,
          attempt: attempt + 1,
        });
        
        return result;
        
      } catch (error) {
        lastError = error;
        this.metrics.totalErrors++;
        
        // Don't retry certain types of errors
        if (this.isNonRetryableError(error) || attempt === maxRetries) {
          this.emit('queryError', {
            error,
            attempt: attempt + 1,
            duration: Date.now() - startTime,
          });
          throw error;
        }
        
        // Wait before retrying with exponential backoff
        const delay = this.config.retryDelay * Math.pow(this.config.retryBackoffMultiplier, attempt);
        await this.sleep(delay);
        
        this.emit('queryRetry', {
          error,
          attempt: attempt + 1,
          nextDelay: delay,
        });
      }
    }
    
    throw lastError;
  }

  /**
   * Execute a transaction with automatic retry and error handling
   */
  async transaction(callback, options = {}) {
    const client = await this.pool.connect();
    const startTime = Date.now();
    
    try {
      await client.query('BEGIN');
      
      // Set up RLS context if provided
      if (options.userId) {
        await client.query('SET LOCAL app.current_user_id = $1', [options.userId]);
      }
      if (options.orgId) {
        await client.query('SET LOCAL app.current_org_id = $1', [options.orgId]);
      }
      
      const result = await callback(client);
      await client.query('COMMIT');
      
      const duration = Date.now() - startTime;
      this.emit('transaction', { status: 'committed', duration });
      
      return result;
      
    } catch (error) {
      await client.query('ROLLBACK');
      
      const duration = Date.now() - startTime;
      this.emit('transaction', { status: 'rolled_back', duration, error });
      
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get a client from the pool for advanced operations
   */
  async getClient() {
    return await this.pool.connect();
  }

  /**
   * Set RLS context for subsequent queries
   */
  async setRLSContext(userId, orgId = null) {
    if (!this.config.enableRLS) {
      throw new Error('RLS is not enabled for this pool');
    }

    const queries = [`SET app.current_user_id = '${userId}'`];
    if (orgId) {
      queries.push(`SET app.current_org_id = '${orgId}'`);
    }

    for (const query of queries) {
      await this.query(query);
    }
  }

  /**
   * Clear RLS context
   */
  async clearRLSContext() {
    if (!this.config.enableRLS) return;

    await this.query('SET app.current_user_id = NULL');
    await this.query('SET app.current_org_id = NULL');
  }

  /**
   * Get current pool metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      pool: {
        totalCount: this.pool.totalCount,
        idleCount: this.pool.idleCount,
        waitingCount: this.pool.waitingCount,
      },
      timestamp: new Date(),
    };
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
   * Update average query time metric
   */
  updateAverageQueryTime(duration) {
    const totalQueries = this.metrics.totalQueries;
    const currentAverage = this.metrics.averageQueryTime;
    
    this.metrics.averageQueryTime = 
      (currentAverage * (totalQueries - 1) + duration) / totalQueries;
  }

  /**
   * Sleep utility for retry delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Graceful shutdown
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
    
    // Close pool
    if (this.pool) {
      await this.pool.end();
    }
    
    this.emit('closed');
  }
}

// Singleton instance
let defaultPool = null;

/**
 * Get or create the default database pool
 */
function getPool(config = {}) {
  if (!defaultPool) {
    defaultPool = new DatabasePool(config);
    
    // Handle graceful shutdown
    const shutdown = async () => {
      console.log('Shutting down database pool...');
      await defaultPool.close();
      process.exit(0);
    };
    
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }
  
  return defaultPool;
}

/**
 * Create a new database pool instance
 */
function createPool(config = {}) {
  return new DatabasePool(config);
}

/**
 * Utility function for quick queries
 */
async function query(text, params = []) {
  const pool = getPool();
  return await pool.query(text, params);
}

/**
 * Utility function for transactions
 */
async function transaction(callback, options = {}) {
  const pool = getPool();
  return await pool.transaction(callback, options);
}

module.exports = {
  DatabasePool,
  getPool,
  createPool,
  query,
  transaction,
  POOL_CONFIGS,
  DEFAULT_CONFIG,
};
