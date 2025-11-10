/**
 * Truxe Environment Manager
 * 
 * Main integration point for comprehensive environment-specific port range management.
 * Coordinates port management, isolation validation, and monitoring systems.
 * 
 * @author DevOps Engineering Team
 * @version 1.0.0
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import EventEmitter from 'events';

// Import our environment management modules
import { EnvironmentPortManager } from './environment-port-manager.js';
import EnvironmentIsolationValidator from './environment-isolation-validator.js';
import EnvironmentPortMonitor from './environment-port-monitor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Main Environment Manager Class
 * Orchestrates all environment management components
 */
class EnvironmentManager extends EventEmitter {
  constructor() {
    super();
    
    // Initialize components
    this.portManager = new EnvironmentPortManager();
    this.isolationValidator = new EnvironmentIsolationValidator(this.portManager);
    this.monitor = new EnvironmentPortMonitor(this.portManager, this.isolationValidator);
    
    // State tracking
    this.isInitialized = false;
    this.currentStatus = 'initializing';
    this.lastHealthCheck = null;
    
    // Initialize the system
    this.initialize();
  }

  /**
   * Initialize the environment management system
   */
  async initialize() {
    try {
      console.log('🚀 Initializing Truxe Environment Management System...');
      
      // Detect and validate current environment
      const environment = this.portManager.detectAndSetEnvironment();
      console.log(`📍 Current environment: ${environment}`);
      
      // Perform initial validation
      await this.performInitialValidation();
      
      // Start monitoring if enabled
      if (this.shouldStartMonitoring()) {
        this.monitor.startMonitoring();
      }
      
      // Setup event handlers
      this.setupEventHandlers();
      
      this.isInitialized = true;
      this.currentStatus = 'running';
      
      console.log('✅ Environment Management System initialized successfully');
      this.emit('initialized', { 
        environment: environment,
        timestamp: new Date().toISOString() 
      });
      
    } catch (error) {
      this.currentStatus = 'error';
      console.error('❌ Failed to initialize Environment Management System:', error.message);
      this.emit('initializationError', error);
      throw error;
    }
  }

  /**
   * Perform initial validation of the environment
   */
  async performInitialValidation() {
    console.log('🔍 Performing initial environment validation...');
    
    const currentEnv = this.portManager.currentEnvironment;
    
    // Validate port configuration
    const configIssues = this.portManager.validateConfiguration(currentEnv);
    if (configIssues.length > 0) {
      console.warn(`⚠️  Found ${configIssues.length} configuration issues`);
      for (const issue of configIssues) {
        console.warn(`  - ${issue.type}: ${issue.message}`);
      }
    }
    
    // Detect port conflicts
    const conflicts = this.portManager.detectConflicts(currentEnv);
    if (conflicts.length > 0) {
      console.warn(`⚠️  Found ${conflicts.length} port conflicts`);
      for (const conflict of conflicts) {
        console.warn(`  - ${conflict.type}: ${conflict.message}`);
      }
    }
    
    // Validate environment isolation
    const isolation = this.isolationValidator.validateEnvironmentIsolation(currentEnv);
    if (isolation.violations.length > 0) {
      console.warn(`⚠️  Found ${isolation.violations.length} isolation violations`);
      for (const violation of isolation.violations) {
        console.warn(`  - ${violation.type}: ${violation.message}`);
      }
    }
    
    // Check if we should fail on critical issues
    const criticalIssues = [
      ...configIssues.filter(i => i.severity === 'critical'),
      ...conflicts.filter(c => c.severity === 'critical'),
      ...isolation.violations.filter(v => v.severity === 'critical')
    ];
    
    if (criticalIssues.length > 0) {
      throw new Error(`Critical issues detected: ${criticalIssues.length} issues must be resolved before starting`);
    }
    
    console.log('✅ Initial validation completed');
  }

  /**
   * Check if monitoring should be started
   */
  shouldStartMonitoring() {
    // Start monitoring unless explicitly disabled
    return process.env.TRUXE_MONITORING_ENABLED !== 'false';
  }

  /**
   * Setup event handlers between components
   */
  setupEventHandlers() {
    // Port manager events
    this.portManager.on('environmentChanged', (data) => {
      console.log(`🔄 Environment changed: ${data.previous} → ${data.current}`);
      this.emit('environmentChanged', data);
    });
    
    // Isolation validator events
    this.isolationValidator.on('isolationValidationPerformed', (validation) => {
      if (validation.status === 'failed') {
        console.warn(`⚠️  Isolation validation failed: ${validation.violations.length} violations`);
      }
      this.emit('isolationValidation', validation);
    });
    
    // Monitor events
    this.monitor.on('alert', (alert) => {
      console.warn(`🚨 Alert: ${alert.message}`);
      this.emit('alert', alert);
    });
    
    this.monitor.on('critical', (alert) => {
      console.error(`🚨 CRITICAL: ${alert.message}`);
      this.emit('critical', alert);
    });
  }

  /**
   * Switch to a different environment
   */
  async switchEnvironment(targetEnvironment, options = {}) {
    const { force = false, validate = true } = options;
    
    try {
      console.log(`🔄 Switching to environment: ${targetEnvironment}`);
      
      // Pre-switch validation
      if (validate) {
        const validation = this.isolationValidator.validateEnvironmentSwitch(
          this.portManager.currentEnvironment,
          targetEnvironment
        );
        
        if (validation.status === 'failed' && !force) {
          throw new Error(`Environment switch validation failed: ${validation.violations.length} violations`);
        }
      }
      
      // Perform the switch
      const newEnvironment = this.portManager.switchEnvironment(targetEnvironment, force);
      
      // Post-switch validation
      if (validate) {
        await this.performInitialValidation();
      }
      
      console.log(`✅ Successfully switched to environment: ${newEnvironment}`);
      return newEnvironment;
      
    } catch (error) {
      console.error(`❌ Failed to switch environment: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get service port with comprehensive validation
   */
  getServicePort(serviceName, options = {}) {
    const {
      environment = this.portManager.currentEnvironment,
      enableFallback = false,
      validateRange = true,
      checkAvailability = true
    } = options;
    
    try {
      // Get port from port manager
      const port = this.portManager.getServicePort(serviceName, environment, {
        enableFallback,
        validateRange,
        checkAvailability
      });
      
      // Additional isolation validation
      this.isolationValidator.validatePortAccess(serviceName, port, environment);
      
      return port;
      
    } catch (error) {
      console.error(`❌ Failed to get service port for ${serviceName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate environment-specific configuration
   */
  generateEnvironmentConfig(environment = this.portManager.currentEnvironment) {
    const config = this.portManager.generateEnvironmentConfig(environment);
    
    // Add isolation and monitoring status
    config.isolation_status = this.isolationValidator.getIsolationStatus();
    config.monitoring_status = this.monitor.getMonitoringStatus();
    
    return config;
  }

  /**
   * Generate Docker Compose configuration for environment
   */
  generateDockerComposeConfig(environment = this.portManager.currentEnvironment) {
    const envConfig = this.portManager.getEnvironmentConfig(environment);
    const portMappings = this.portManager.generateDockerComposePorts(environment);
    
    return {
      version: '3.8',
      services: this.generateDockerServices(environment, portMappings),
      volumes: this.generateDockerVolumes(environment),
      networks: this.generateDockerNetworks(environment),
      secrets: this.generateDockerSecrets(environment)
    };
  }

  /**
   * Generate Docker services configuration
   */
  generateDockerServices(environment, portMappings) {
    const services = {};
    const envConfig = this.portManager.getEnvironmentConfig(environment);
    
    // API Service
    services.api = {
      build: {
        context: './api',
        dockerfile: environment === 'production' ? 'Dockerfile.production' : 'Dockerfile'
      },
      container_name: `truxe-api-${environment}`,
      environment: {
        NODE_ENV: environment,
        TRUXE_ENV: environment,
        ...envConfig.environment_variables
      },
      ports: [portMappings.api.mapping],
      networks: [`truxe-${environment}-network`],
      restart: 'unless-stopped'
    };
    
    // Database Service
    services.database = {
      image: 'postgres:15-alpine',
      container_name: `truxe-db-${environment}`,
      environment: {
        POSTGRES_DB: `truxe_${environment}`,
        POSTGRES_USER: 'truxe',
        POSTGRES_PASSWORD: `${environment}_password`
      },
      ports: [portMappings.database.mapping],
      networks: [`truxe-${environment}-network`],
      restart: 'unless-stopped'
    };
    
    // Redis Service
    services.redis = {
      image: 'redis:7-alpine',
      container_name: `truxe-redis-${environment}`,
      ports: [portMappings.redis.mapping],
      networks: [`truxe-${environment}-network`],
      restart: 'unless-stopped'
    };
    
    return services;
  }

  /**
   * Generate Docker volumes configuration
   */
  generateDockerVolumes(environment) {
    return {
      [`postgres_${environment}_data`]: { driver: 'local' },
      [`redis_${environment}_data`]: { driver: 'local' }
    };
  }

  /**
   * Generate Docker networks configuration
   */
  generateDockerNetworks(environment) {
    const networkConfig = {
      [`truxe-${environment}-network`]: {
        driver: 'bridge'
      }
    };
    
    // Add subnet for isolation
    const envConfig = this.portManager.getEnvironmentConfig(environment);
    const subnetBase = {
      development: '172.21.0.0/16',
      staging: '172.22.0.0/16',
      testing: '172.23.0.0/16',
      production: '172.80.0.0/16'
    };
    
    if (subnetBase[environment]) {
      networkConfig[`truxe-${environment}-network`].ipam = {
        config: [{ subnet: subnetBase[environment] }]
      };
    }
    
    return networkConfig;
  }

  /**
   * Generate Docker secrets configuration
   */
  generateDockerSecrets(environment) {
    const secrets = {
      jwt_private_key: { file: './secrets/jwt-private-key.pem' },
      jwt_public_key: { file: './secrets/jwt-public-key.pem' }
    };
    
    // Add environment-specific secrets
    if (environment === 'production') {
      secrets.postgres_password = { external: true };
      secrets.redis_password = { external: true };
    }
    
    return secrets;
  }

  /**
   * Perform health check
   */
  async performHealthCheck() {
    const healthCheck = {
      timestamp: new Date().toISOString(),
      environment: this.portManager.currentEnvironment,
      status: 'healthy',
      checks: [],
      issues: []
    };
    
    try {
      // Port manager health
      const portStatus = this.portManager.getSystemStatus();
      healthCheck.checks.push({
        component: 'port_manager',
        status: portStatus.status,
        details: portStatus
      });
      
      if (portStatus.status !== 'healthy') {
        healthCheck.status = 'degraded';
        healthCheck.issues.push(`Port manager: ${portStatus.conflicts.length} conflicts, ${portStatus.validation_issues.length} issues`);
      }
      
      // Isolation validator health
      const isolationStatus = this.isolationValidator.getIsolationStatus();
      healthCheck.checks.push({
        component: 'isolation_validator',
        status: isolationStatus.recent_violations.length === 0 ? 'healthy' : 'degraded',
        details: isolationStatus
      });
      
      if (isolationStatus.recent_violations.length > 0) {
        healthCheck.status = 'degraded';
        healthCheck.issues.push(`Isolation: ${isolationStatus.recent_violations.length} recent violations`);
      }
      
      // Monitor health
      const monitorStatus = this.monitor.getMonitoringStatus();
      healthCheck.checks.push({
        component: 'monitor',
        status: monitorStatus.is_monitoring ? 'healthy' : 'stopped',
        details: monitorStatus
      });
      
      if (!monitorStatus.is_monitoring) {
        healthCheck.status = 'degraded';
        healthCheck.issues.push('Monitoring is not running');
      }
      
      this.lastHealthCheck = healthCheck;
      return healthCheck;
      
    } catch (error) {
      healthCheck.status = 'error';
      healthCheck.error = error.message;
      this.lastHealthCheck = healthCheck;
      throw error;
    }
  }

  /**
   * Get comprehensive system status
   */
  getSystemStatus() {
    return {
      timestamp: new Date().toISOString(),
      initialized: this.isInitialized,
      status: this.currentStatus,
      current_environment: this.portManager.currentEnvironment,
      port_manager: this.portManager.getSystemStatus(),
      isolation_validator: this.isolationValidator.getIsolationStatus(),
      monitor: this.monitor.getMonitoringStatus(),
      last_health_check: this.lastHealthCheck
    };
  }

  /**
   * Export environment configuration to file
   */
  async exportEnvironmentConfig(environment, outputPath) {
    try {
      const config = this.generateEnvironmentConfig(environment);
      const configJson = JSON.stringify(config, null, 2);
      
      await fs.promises.writeFile(outputPath, configJson);
      console.log(`✅ Environment configuration exported to: ${outputPath}`);
      
      return outputPath;
      
    } catch (error) {
      console.error(`❌ Failed to export configuration: ${error.message}`);
      throw error;
    }
  }

  /**
   * Import environment configuration from file
   */
  async importEnvironmentConfig(configPath) {
    try {
      const configJson = await fs.promises.readFile(configPath, 'utf8');
      const config = JSON.parse(configJson);
      
      // Validate imported configuration
      this.validateImportedConfig(config);
      
      console.log(`✅ Environment configuration imported from: ${configPath}`);
      return config;
      
    } catch (error) {
      console.error(`❌ Failed to import configuration: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate imported configuration
   */
  validateImportedConfig(config) {
    const requiredFields = ['environment', 'range', 'services'];
    
    for (const field of requiredFields) {
      if (!config[field]) {
        throw new Error(`Missing required field in configuration: ${field}`);
      }
    }
    
    // Validate port range
    if (!config.range.start || !config.range.end) {
      throw new Error('Invalid port range in configuration');
    }
    
    // Validate services
    if (!config.services.api || !config.services.database || !config.services.redis) {
      throw new Error('Missing required services in configuration');
    }
  }

  /**
   * Reset environment to default state
   */
  async resetEnvironment() {
    try {
      console.log('🔄 Resetting environment to default state...');
      
      // Reset port manager
      this.portManager.resetEnvironment();
      
      // Reset isolation validator
      this.isolationValidator.resetIsolationState();
      
      // Restart monitoring if it was running
      if (this.monitor.isMonitoring) {
        this.monitor.stopMonitoring();
        this.monitor.startMonitoring();
      }
      
      // Re-initialize
      await this.initialize();
      
      console.log('✅ Environment reset completed');
      
    } catch (error) {
      console.error(`❌ Failed to reset environment: ${error.message}`);
      throw error;
    }
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown() {
    try {
      console.log('🛑 Shutting down Environment Management System...');
      
      this.currentStatus = 'shutting_down';
      
      // Stop monitoring
      this.monitor.stopMonitoring();
      
      // Cleanup components
      this.monitor.cleanup();
      this.isolationValidator.cleanup();
      this.portManager.clearCache();
      
      // Remove all listeners
      this.removeAllListeners();
      
      this.currentStatus = 'stopped';
      console.log('✅ Environment Management System shutdown completed');
      
    } catch (error) {
      console.error(`❌ Error during shutdown: ${error.message}`);
      throw error;
    }
  }
}

// Create and export singleton instance
const environmentManager = new EnvironmentManager();

export default environmentManager;
export { EnvironmentManager };
