/**
 * Production Integration Service
 * 
 * Comprehensive production hardening integration that orchestrates all
 * production services including error handling, security hardening,
 * performance optimization, monitoring, and disaster recovery.
 * 
 * @author Production Engineering Team
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { ProductionErrorHandler } from './production-error-handler.js';
import { PerformanceOptimizer } from './performance-optimizer.js';
import { MonitoringObservabilityService } from './monitoring-observability.js';
// import { DisasterRecoveryService } from '../../scripts/disaster-recovery.js';
import config from '../config/index.js';

/**
 * Production Integration Service
 */
export class ProductionIntegrationService extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      // Error handling
      enableErrorHandler: options.enableErrorHandler !== false,
      errorHandlerOptions: options.errorHandlerOptions || {},
      
      // Performance optimization
      enablePerformanceOptimizer: options.enablePerformanceOptimizer !== false,
      performanceOptions: options.performanceOptions || {},
      
      // Monitoring and observability
      enableMonitoring: options.enableMonitoring !== false,
      monitoringOptions: options.monitoringOptions || {},
      
      // Disaster recovery
      enableDisasterRecovery: options.enableDisasterRecovery !== false,
      disasterRecoveryOptions: options.disasterRecoveryOptions || {},
      
      // Integration settings
      startupTimeout: options.startupTimeout || 30000, // 30 seconds
      shutdownTimeout: options.shutdownTimeout || 15000, // 15 seconds
      healthCheckInterval: options.healthCheckInterval || 30000, // 30 seconds
      
      ...options
    };

    this.services = new Map();
    this.isInitialized = false;
    this.isShuttingDown = false;
    this.healthStatus = 'initializing';
    this.lastHealthCheck = null;
    
    // Service initialization order (dependencies matter)
    this.initializationOrder = [
      'errorHandler',
      'performanceOptimizer', 
      'monitoring',
      'disasterRecovery'
    ];
  }

  /**
   * Initialize all production services
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    console.log('🚀 Initializing production hardening services...');
    const startTime = Date.now();

    try {
      // Initialize services in order
      for (const serviceName of this.initializationOrder) {
        await this.initializeService(serviceName);
      }

      // Start health monitoring
      this.startHealthMonitoring();

      // Mark as initialized
      this.isInitialized = true;
      this.healthStatus = 'healthy';
      
      const initTime = Date.now() - startTime;
      console.log(`✅ Production hardening services initialized in ${initTime}ms`);
      
      this.emit('initialized', { initTime, services: Array.from(this.services.keys()) });
      
      // Log successful initialization
      if (this.services.has('monitoring')) {
        const monitoring = this.services.get('monitoring');
        monitoring.logEvent('info', 'Production services initialized', {
          initializationTime: initTime,
          services: Array.from(this.services.keys()),
          environment: process.env.NODE_ENV || 'production'
        });
      }

      return true;
    } catch (error) {
      console.error('❌ Failed to initialize production services:', error);
      this.healthStatus = 'unhealthy';
      this.emit('initialization_error', error);
      throw error;
    }
  }

  /**
   * Initialize individual service
   */
  async initializeService(serviceName) {
    console.log(`  📦 Initializing ${serviceName}...`);
    
    try {
      let service;
      
      switch (serviceName) {
        case 'errorHandler':
          if (this.options.enableErrorHandler) {
            service = new ProductionErrorHandler(this.options.errorHandlerOptions);
            await service.initialize?.();
          }
          break;
          
        case 'performanceOptimizer':
          if (this.options.enablePerformanceOptimizer) {
            service = new PerformanceOptimizer(this.options.performanceOptions);
            await service.initialize?.();
          }
          break;
          
        case 'monitoring':
          if (this.options.enableMonitoring) {
            service = new MonitoringObservabilityService(this.options.monitoringOptions);
            await service.initialize?.();
          }
          break;
          
        case 'disasterRecovery':
          // Disaster recovery service disabled
          break;
          
        default:
          throw new Error(`Unknown service: ${serviceName}`);
      }
      
      if (service) {
        this.services.set(serviceName, service);
        
        // Set up service event listeners
        this.setupServiceEventListeners(serviceName, service);
        
        console.log(`    ✅ ${serviceName} initialized`);
      } else {
        console.log(`    ⏭️  ${serviceName} disabled`);
      }
    } catch (error) {
      console.error(`    ❌ Failed to initialize ${serviceName}:`, error);
      throw new Error(`Service initialization failed: ${serviceName} - ${error.message}`);
    }
  }

  /**
   * Set up event listeners for service
   */
  setupServiceEventListeners(serviceName, service) {
    service.on('error', (error) => {
      console.error(`Service error in ${serviceName}:`, error);
      this.emit('service_error', { serviceName, error });
      
      // Log to monitoring if available
      const monitoring = this.services.get('monitoring');
      if (monitoring) {
        monitoring.logEvent('error', `Service error in ${serviceName}`, {
          serviceName,
          error: error.message,
          stack: error.stack
        });
      }
    });

    service.on('warning', (warning) => {
      console.warn(`Service warning in ${serviceName}:`, warning);
      this.emit('service_warning', { serviceName, warning });
    });

    // Service-specific event handling
    if (serviceName === 'errorHandler') {
      service.on('circuit_breaker_opened', (data) => {
        console.warn(`🔴 Circuit breaker opened for ${data.serviceName}`);
        this.emit('circuit_breaker_opened', data);
      });

      service.on('circuit_breaker_closed', (data) => {
        console.log(`🟢 Circuit breaker closed for ${data.serviceName}`);
        this.emit('circuit_breaker_closed', data);
      });
    }

    if (serviceName === 'performanceOptimizer') {
      service.on('slow_query_detected', (data) => {
        console.warn(`🐌 Slow query detected: ${data.executionTime}ms`);
        this.emit('slow_query_detected', data);
      });

      service.on('cache_miss_threshold_exceeded', (data) => {
        console.warn(`📉 Cache miss threshold exceeded: ${data.missRate}%`);
        this.emit('cache_performance_warning', data);
      });
    }

    if (serviceName === 'monitoring') {
      service.on('alert_triggered', (alert) => {
        console.warn(`🚨 Alert triggered: ${alert.type}`);
        this.emit('alert_triggered', alert);
      });
    }

    if (serviceName === 'disasterRecovery') {
      service.on('backup_completed', (backup) => {
        console.log(`💾 Backup completed: ${backup.id}`);
        this.emit('backup_completed', backup);
      });

      service.on('backup_failed', (error) => {
        console.error(`💥 Backup failed:`, error);
        this.emit('backup_failed', error);
      });
    }
  }

  /**
   * Start health monitoring
   */
  startHealthMonitoring() {
    setInterval(async () => {
      try {
        const healthStatus = await this.performHealthCheck();
        this.lastHealthCheck = new Date();
        
        if (healthStatus.status !== this.healthStatus) {
          const previousStatus = this.healthStatus;
          this.healthStatus = healthStatus.status;
          
          console.log(`🏥 Health status changed: ${previousStatus} → ${this.healthStatus}`);
          this.emit('health_status_changed', { 
            previous: previousStatus, 
            current: this.healthStatus,
            details: healthStatus 
          });
        }
      } catch (error) {
        console.error('Health check failed:', error);
        this.healthStatus = 'unhealthy';
      }
    }, this.options.healthCheckInterval);
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck() {
    const healthChecks = {};
    let overallStatus = 'healthy';
    
    // Check each service
    for (const [serviceName, service] of this.services) {
      try {
        if (typeof service.getHealthStatus === 'function') {
          healthChecks[serviceName] = await service.getHealthStatus();
        } else {
          healthChecks[serviceName] = { status: 'healthy', message: 'No health check available' };
        }
        
        if (healthChecks[serviceName].status !== 'healthy') {
          overallStatus = 'degraded';
        }
      } catch (error) {
        healthChecks[serviceName] = { 
          status: 'unhealthy', 
          message: error.message,
          error: true 
        };
        overallStatus = 'unhealthy';
      }
    }

    // Check system resources
    const systemHealth = await this.checkSystemHealth();
    healthChecks.system = systemHealth;
    
    if (systemHealth.status !== 'healthy') {
      overallStatus = systemHealth.status === 'degraded' ? 'degraded' : 'unhealthy';
    }

    return {
      status: overallStatus,
      timestamp: new Date(),
      services: healthChecks,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'production'
    };
  }

  /**
   * Check system health
   */
  async checkSystemHealth() {
    const memoryUsage = process.memoryUsage();
    const memoryUsagePercent = memoryUsage.heapUsed / memoryUsage.heapTotal;
    
    let status = 'healthy';
    const issues = [];
    
    // Memory check
    if (memoryUsagePercent > 0.9) {
      status = 'unhealthy';
      issues.push('High memory usage (>90%)');
    } else if (memoryUsagePercent > 0.8) {
      status = 'degraded';
      issues.push('Elevated memory usage (>80%)');
    }
    
    // Uptime check
    const uptimeHours = process.uptime() / 3600;
    if (uptimeHours < 0.01) { // Less than 36 seconds
      status = 'starting';
      issues.push('System recently started');
    }

    return {
      status,
      issues,
      memory: {
        usage: memoryUsage,
        usagePercent: Math.round(memoryUsagePercent * 100)
      },
      uptime: process.uptime(),
      pid: process.pid
    };
  }

  /**
   * Get service by name
   */
  getService(serviceName) {
    return this.services.get(serviceName);
  }

  /**
   * Get error handler
   */
  getErrorHandler() {
    return this.services.get('errorHandler');
  }

  /**
   * Get performance optimizer
   */
  getPerformanceOptimizer() {
    return this.services.get('performanceOptimizer');
  }

  /**
   * Get monitoring service
   */
  getMonitoringService() {
    return this.services.get('monitoring');
  }

  /**
   * Get disaster recovery service (disabled)
   */
  getDisasterRecoveryService() {
    return null;
  }

  /**
   * Get production status dashboard
   */
  getProductionDashboard() {
    const dashboard = {
      status: this.healthStatus,
      initialized: this.isInitialized,
      lastHealthCheck: this.lastHealthCheck,
      services: {},
      systemInfo: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        pid: process.pid,
        environment: process.env.NODE_ENV || 'production',
        nodeVersion: process.version
      }
    };

    // Get service-specific dashboards
    for (const [serviceName, service] of this.services) {
      if (typeof service.getDashboard === 'function') {
        dashboard.services[serviceName] = service.getDashboard();
      } else if (typeof service.getStatus === 'function') {
        dashboard.services[serviceName] = service.getStatus();
      } else {
        dashboard.services[serviceName] = { status: 'active' };
      }
    }

    return dashboard;
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    console.log('🛑 Shutting down production services...');
    
    const shutdownPromises = [];
    
    // Shutdown services in reverse order
    const shutdownOrder = [...this.initializationOrder].reverse();
    
    for (const serviceName of shutdownOrder) {
      const service = this.services.get(serviceName);
      if (service && typeof service.shutdown === 'function') {
        console.log(`  📦 Shutting down ${serviceName}...`);
        shutdownPromises.push(
          Promise.race([
            service.shutdown(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error(`${serviceName} shutdown timeout`)), 
              this.options.shutdownTimeout)
            )
          ]).catch(error => {
            console.error(`Failed to shutdown ${serviceName}:`, error);
          })
        );
      }
    }

    try {
      await Promise.all(shutdownPromises);
      console.log('✅ Production services shutdown complete');
    } catch (error) {
      console.error('❌ Some services failed to shutdown cleanly:', error);
    }

    this.emit('shutdown_complete');
  }
}

/**
 * Global production integration service
 */
let globalProductionService = null;

/**
 * Initialize global production integration service
 */
export function initializeProductionServices(options = {}) {
  if (globalProductionService) {
    return globalProductionService;
  }
  
  globalProductionService = new ProductionIntegrationService(options);
  return globalProductionService;
}

/**
 * Get global production integration service
 */
export function getProductionServices() {
  return globalProductionService;
}

/**
 * Fastify plugin for production integration
 */
export async function productionIntegrationPlugin(fastify, options) {
  const productionServices = initializeProductionServices(options);
  
  // Initialize all services
  await productionServices.initialize();
  
  // Add production dashboard endpoint
  fastify.get('/health/production', async (request, reply) => {
    const dashboard = productionServices.getProductionDashboard();
    reply.send(dashboard);
  });
  
  // Add health check endpoint
  fastify.get('/health/comprehensive', async (request, reply) => {
    const healthStatus = await productionServices.performHealthCheck();
    
    const statusCode = healthStatus.status === 'healthy' ? 200 :
                      healthStatus.status === 'degraded' ? 200 : 503;
                      
    reply.code(statusCode).send(healthStatus);
  });
  
  // Add individual service endpoints
  fastify.get('/health/error-handler', async (request, reply) => {
    const errorHandler = productionServices.getErrorHandler();
    if (!errorHandler) {
      return reply.code(404).send({ error: 'Error handler not enabled' });
    }
    
    const status = errorHandler.getHealthStatus?.() || { status: 'active' };
    reply.send(status);
  });
  
  fastify.get('/health/performance', async (request, reply) => {
    const optimizer = productionServices.getPerformanceOptimizer();
    if (!optimizer) {
      return reply.code(404).send({ error: 'Performance optimizer not enabled' });
    }
    
    const summary = optimizer.getPerformanceSummary?.() || { status: 'active' };
    reply.send(summary);
  });
  
  fastify.get('/health/disaster-recovery', async (request, reply) => {
    const disasterRecovery = productionServices.getDisasterRecoveryService();
    if (!disasterRecovery) {
      return reply.code(404).send({ error: 'Disaster recovery not enabled' });
    }
    
    const status = disasterRecovery.getStatus?.() || { status: 'active' };
    reply.send(status);
  });
  
  // Decorate fastify with production services
  // Note: Using 'prod' prefix to avoid conflicts with Fastify's built-in properties
  fastify.decorate('productionServices', productionServices);
  fastify.decorate('prodErrorHandler', productionServices.getErrorHandler());
  fastify.decorate('prodPerformanceOptimizer', productionServices.getPerformanceOptimizer());
  fastify.decorate('prodMonitoring', productionServices.getMonitoringService());
  fastify.decorate('prodDisasterRecovery', productionServices.getDisasterRecoveryService());
  
  // Set up graceful shutdown
  const shutdownHandler = async () => {
    console.log('Received shutdown signal, gracefully shutting down...');
    await productionServices.shutdown();
    await fastify.close();
    process.exit(0);
  };
  
  process.on('SIGTERM', shutdownHandler);
  process.on('SIGINT', shutdownHandler);
}

export default {
  ProductionIntegrationService,
  initializeProductionServices,
  getProductionServices,
  productionIntegrationPlugin
};
