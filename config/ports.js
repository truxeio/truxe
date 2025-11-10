/**
 * Truxe Centralized Port Management System
 * 
 * Single source of truth for all port assignments across environments.
 * Implements intelligent port allocation, conflict detection, and environment isolation.
 * 
 * @author DevOps Engineering Team
 * @version 2.0.0
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Port Configuration Schema
 * Defines port ranges and service allocations for each environment
 */
const PORT_CONFIG = {
  environments: {
    development: {
      name: 'Development',
      base_port: 87000,
      range: { start: 87000, end: 87099 },
      description: 'Local development environment with hot-reload capabilities',
      services: {
        // Core Services (87000-87019)
        health: 87000,
        api: 87001,
        database: 87032,      // External host port
        redis: 87079,         // External host port

        // Development Tools (87020-87039)
        mailhog_smtp: 87025,
        mailhog_web: 87825,   // Kept higher for distinction
        docs: 87002,

        // Monitoring & Observability (87040-87059)
        monitoring: 87090,
        grafana: 87091,
        prometheus: 87092,
        jaeger: 87093,

        // Additional Services (87060-87079)
        webhook_relay: 87060,
        file_server: 87061,
        backup_service: 87062,

        // Testing Services (87080-87099)
        test_runner: 87080,
        mock_server: 87081,
        load_tester: 87082,
      }
    },

    testing: {
      name: 'Testing',
      base_port: 87100,
      range: { start: 87100, end: 87199 },
      description: 'Automated testing environment with isolated test data',
      services: {
        // Core Services (87100-87119)
        health: 87100,
        api: 87101,
        database: 87132,      // External host port
        redis: 87179,         // External host port

        // Development Tools (87120-87139)
        mailhog_smtp: 87125,
        mailhog_web: 87925,   // Kept higher for distinction
        docs: 87102,

        // Monitoring & Observability (87140-87159)
        monitoring: 87190,
        grafana: 87191,
        prometheus: 87192,
        jaeger: 87193,

        // Additional Services (87160-87179)
        webhook_relay: 87160,
        file_server: 87161,
        backup_service: 87162,

        // Testing Services (87180-87199)
        test_runner: 87180,
        mock_server: 87181,
        load_tester: 87182,
        e2e_runner: 87183,
        selenium_hub: 87184,
      }
    },

    staging: {
      name: 'Staging',
      base_port: 87200,
      range: { start: 87200, end: 87299 },
      description: 'Pre-production staging environment for integration testing',
      services: {
        // Core Services (87200-87219)
        health: 87200,
        api: 87201,
        database: 87232,      // External host port
        redis: 87279,         // External host port

        // Development Tools (87220-87239)
        mailhog_smtp: 87225,
        docs: 87202,

        // Monitoring & Observability (87240-87259)
        monitoring: 87290,
        grafana: 87291,
        prometheus: 87292,
        jaeger: 87293,

        // Additional Services (87260-87279)
        webhook_relay: 87260,
        file_server: 87261,
        backup_service: 87262,

        // Testing Services (87280-87299)
        test_runner: 87280,
        mock_server: 87281,
        load_tester: 87282,
      }
    },

    production: {
      name: 'Production',
      base_port: 87300,
      range: { start: 87300, end: 87399 },
      description: 'Production environment with standard ports and reverse proxy',
      services: {
        // Core Services (87300-87319)
        health: 87300,
        api: 87301,           // External host port (behind reverse proxy)
        api_internal: 3001,   // Internal container port
        database: 87332,      // External host port
        database_internal: 5432, // Internal container port
        redis: 87379,         // External host port
        redis_internal: 6379, // Internal container port

        // HTTPS & SSL
        https: 443,           // Standard HTTPS (reverse proxy)

        // Monitoring & Observability (87340-87359)
        monitoring: 87390,    // External host port
        grafana: 87391,       // External host port
        prometheus: 87392,    // External host port
        jaeger: 87393,        // External host port

        // Additional Production Services (87360-87379)
        webhook_relay: 87360,
        file_server: 87361,
        backup_service: 87362,

        // Health Checks & Status (87380-87399)
        health_check: 87390,
        status_page: 87391
      }
    }
  },
  
  /**
   * Port Conflict Detection Configuration
   */
  conflict_detection: {
    enabled: true,
    check_system_ports: true,
    check_running_processes: true,
    timeout_ms: 5000,
    reserved_ranges: [
      { start: 1, end: 1023, description: 'System reserved ports (root required)' },
      { start: 1024, end: 4999, description: 'Registered ports (IANA assigned)' },
      { start: 3000, end: 3010, description: 'Common development ports (React, etc.)' },
      { start: 8000, end: 8010, description: 'Common web server ports' },
      { start: 9000, end: 9010, description: 'Common application ports' },
      { start: 5000, end: 5010, description: 'Common development server ports' }
    ],
    system_ports: [22, 25, 53, 80, 110, 143, 443, 993, 995]
  },
  
  /**
   * Port Validation Rules
   */
  validation: {
    require_range_compliance: true,
    allow_port_override: false,
    max_port_gap: 100,
    min_port_separation: 1,
    validate_on_startup: true,
    fail_on_conflict: true,
    auto_resolve_conflicts: false
  },
  
  /**
   * Service Internal Port Mappings
   * Maps service names to their internal container ports
   */
  internal_ports: {
    api: 3001,
    database: 5432,
    redis: 6379,
    mailhog_smtp: 1025,
    mailhog_web: 8025,
    docs: 80,
    monitoring: 3000,
    grafana: 3000,
    prometheus: 9090,
    jaeger: 14268,
    webhook_relay: 8080,
    file_server: 8081,
    backup_service: 8082,
    test_runner: 3000,
    mock_server: 3001,
    load_tester: 3002,
    e2e_runner: 3003,
    selenium_hub: 4444,
    health_check: 8090,
    status_page: 8091
  },
  
  /**
   * Fallback Port Strategy
   */
  fallback: {
    enabled: true,
    max_attempts: 10,
    increment: 1,
    respect_range_limits: true,
    skip_reserved: true
  }
};

/**
 * Centralized Port Management Class
 * Provides comprehensive port allocation, validation, and conflict detection
 */
class PortManager {
  constructor(configOverride = null) {
    this.config = configOverride || PORT_CONFIG;
    this.environment = this.detectEnvironment();
    this.cache = new Map();
    this.conflictCache = new Map();
    this.lastValidation = null;
  }

  /**
   * Detect current environment from various sources
   */
  detectEnvironment() {
    // Priority order: explicit env var, NODE_ENV, process args, default
    return (
      process.env.TRUXE_ENV ||
      process.env.NODE_ENV ||
      process.argv.find(arg => arg.startsWith('--env='))?.split('=')[1] ||
      'development'
    );
  }

  /**
   * Get environment configuration
   */
  getEnvironmentConfig(env = this.environment) {
    const envConfig = this.config.environments[env];
    if (!envConfig) {
      throw new Error(`Environment '${env}' not found in port configuration. Available: ${Object.keys(this.config.environments).join(', ')}`);
    }
    return envConfig;
  }

  /**
   * Get port for a specific service with fallback support
   */
  getServicePort(serviceName, env = this.environment, enableFallback = true) {
    const cacheKey = `${env}:${serviceName}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const envConfig = this.getEnvironmentConfig(env);
    let port = envConfig.services[serviceName];
    
    if (!port) {
      throw new Error(`Service '${serviceName}' not found in ${env} environment. Available services: ${Object.keys(envConfig.services).join(', ')}`);
    }

    // Apply fallback strategy if enabled and port is in use
    if (enableFallback && this.config.fallback.enabled && !this.isPortAvailable(port)) {
      port = this.findFallbackPort(port, env);
    }

    // Cache the result
    this.cache.set(cacheKey, port);
    return port;
  }

  /**
   * Find an available fallback port
   */
  findFallbackPort(originalPort, env = this.environment) {
    const envConfig = this.getEnvironmentConfig(env);
    const { max_attempts, increment, respect_range_limits, skip_reserved } = this.config.fallback;
    
    let currentPort = originalPort;
    let attempts = 0;

    while (attempts < max_attempts) {
      currentPort += increment;
      
      // Check range limits
      if (respect_range_limits && (currentPort < envConfig.range.start || currentPort > envConfig.range.end)) {
        throw new Error(`No available ports in range ${envConfig.range.start}-${envConfig.range.end} for fallback`);
      }

      // Skip reserved ports if configured
      if (skip_reserved && this.isPortReserved(currentPort)) {
        attempts++;
        continue;
      }

      // Check availability
      if (this.isPortAvailable(currentPort)) {
        console.warn(`⚠️  Port ${originalPort} unavailable, using fallback port ${currentPort}`);
        return currentPort;
      }

      attempts++;
    }

    throw new Error(`Failed to find available fallback port after ${max_attempts} attempts starting from ${originalPort}`);
  }

  /**
   * Check if a port is available on the system
   */
  isPortAvailable(port) {
    try {
      // Use lsof to check if port is in use and get process info
      const result = execSync(`lsof -ti:${port}`, { 
        stdio: 'pipe', 
        timeout: this.config.conflict_detection.timeout_ms 
      });
      
      const pid = result.toString().trim();
      if (!pid) return true;
      
      // Check if the process using the port is a Truxe service
      try {
        const psResult = execSync(`ps -p ${pid} -o comm=`, { 
          stdio: 'pipe', 
          timeout: 5000 
        });
        const processName = psResult.toString().trim().toLowerCase();
        
        // If it's a Docker process or Truxe-related process, consider it as "available" for our purposes
        if (processName.includes('docker') || 
            processName.includes('truxe') || 
            processName.includes('postgres') || 
            processName.includes('redis') ||
            processName.includes('mailhog')) {
          return true; // Consider Truxe services as "available" for conflict detection
        }
        
        return false; // Port is in use by external process
      } catch (psError) {
        // If we can't determine the process, assume it's a conflict
        return false;
      }
    } catch (error) {
      return true; // Port is available
    }
  }

  /**
   * Check if a port is in reserved ranges
   */
  isPortReserved(port) {
    for (const range of this.config.conflict_detection.reserved_ranges) {
      if (port >= range.start && port <= range.end) {
        return true;
      }
    }
    return this.config.conflict_detection.system_ports.includes(port);
  }

  /**
   * Comprehensive port conflict detection
   */
  detectConflicts(env = this.environment) {
    const cacheKey = `conflicts:${env}`;
    
    // Check cache (valid for 30 seconds)
    if (this.conflictCache.has(cacheKey)) {
      const cached = this.conflictCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 30000) {
        return cached.conflicts;
      }
    }

    const envConfig = this.getEnvironmentConfig(env);
    const conflicts = [];

    console.log(`🔍 Scanning for port conflicts in ${env} environment...`);

    // Check service port availability
    for (const [serviceName, port] of Object.entries(envConfig.services)) {
      if (!this.isPortAvailable(port)) {
        conflicts.push({
          type: 'port_in_use',
          service: serviceName,
          port: port,
          severity: 'high',
          message: `Port ${port} is already in use by another process`
        });
      }
    }

    // Check for reserved port violations
    if (this.config.conflict_detection.check_system_ports) {
      for (const [serviceName, port] of Object.entries(envConfig.services)) {
        if (this.isPortReserved(port)) {
          const reservedRange = this.config.conflict_detection.reserved_ranges.find(
            range => port >= range.start && port <= range.end
          );
          
          conflicts.push({
            type: 'reserved_port',
            service: serviceName,
            port: port,
            severity: 'medium',
            message: `Port ${port} is in reserved range: ${reservedRange?.description || 'System reserved'}`
          });
        }
      }
    }

    // Check for duplicate port assignments
    const portUsage = {};
    for (const [serviceName, port] of Object.entries(envConfig.services)) {
      if (portUsage[port]) {
        portUsage[port].push(serviceName);
      } else {
        portUsage[port] = [serviceName];
      }
    }

    for (const [port, services] of Object.entries(portUsage)) {
      if (services.length > 1) {
        conflicts.push({
          type: 'duplicate_assignment',
          port: parseInt(port),
          services: services,
          severity: 'critical',
          message: `Port ${port} is assigned to multiple services: ${services.join(', ')}`
        });
      }
    }

    // Cache results
    this.conflictCache.set(cacheKey, {
      conflicts,
      timestamp: Date.now()
    });

    return conflicts;
  }

  /**
   * Validate port configuration comprehensively
   */
  validateConfiguration(env = this.environment) {
    const envConfig = this.getEnvironmentConfig(env);
    const issues = [];

    console.log(`🔧 Validating port configuration for ${env} environment...`);

    // Range compliance validation
    if (this.config.validation.require_range_compliance) {
      for (const [serviceName, port] of Object.entries(envConfig.services)) {
        if (port < envConfig.range.start || port > envConfig.range.end) {
          issues.push({
            type: 'range_violation',
            service: serviceName,
            port: port,
            severity: 'high',
            expected_range: envConfig.range,
            message: `Port ${port} is outside allowed range ${envConfig.range.start}-${envConfig.range.end}`
          });
        }
      }
    }

    // Port separation validation
    const ports = Object.values(envConfig.services).sort((a, b) => a - b);
    for (let i = 1; i < ports.length; i++) {
      const gap = ports[i] - ports[i - 1];
      if (gap < this.config.validation.min_port_separation) {
        issues.push({
          type: 'insufficient_separation',
          ports: [ports[i - 1], ports[i]],
          gap: gap,
          severity: 'low',
          message: `Ports ${ports[i - 1]} and ${ports[i]} have insufficient separation (${gap})`
        });
      }
    }

    // Service coverage validation
    const requiredServices = ['api', 'database', 'redis'];
    for (const service of requiredServices) {
      if (!envConfig.services[service]) {
        issues.push({
          type: 'missing_service',
          service: service,
          severity: 'critical',
          message: `Required service '${service}' is not configured`
        });
      }
    }

    this.lastValidation = {
      environment: env,
      timestamp: Date.now(),
      issues: issues
    };

    return issues;
  }

  /**
   * Generate Docker Compose port mappings
   */
  generateDockerComposePorts(env = this.environment) {
    const envConfig = this.getEnvironmentConfig(env);
    const portMappings = {};

    for (const [serviceName, externalPort] of Object.entries(envConfig.services)) {
      const internalPort = this.config.internal_ports[serviceName] || 3000;
      portMappings[serviceName] = {
        external: externalPort,
        internal: internalPort,
        mapping: `${externalPort}:${internalPort}`
      };
    }

    return portMappings;
  }

  /**
   * Get all ports for an environment
   */
  getAllPorts(env = this.environment) {
    const envConfig = this.getEnvironmentConfig(env);
    return {
      environment: env,
      range: envConfig.range,
      services: envConfig.services,
      total_ports: Object.keys(envConfig.services).length,
      port_utilization: this.calculatePortUtilization(env)
    };
  }

  /**
   * Calculate port utilization percentage
   */
  calculatePortUtilization(env = this.environment) {
    const envConfig = this.getEnvironmentConfig(env);
    const totalRange = envConfig.range.end - envConfig.range.start + 1;
    const usedPorts = Object.keys(envConfig.services).length;
    return Math.round((usedPorts / totalRange) * 100 * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Generate environment variables for port configuration
   */
  generateEnvironmentVariables(env = this.environment) {
    const envConfig = this.getEnvironmentConfig(env);
    const envVars = {};

    // Environment metadata
    envVars.TRUXE_ENV = env;
    envVars.TRUXE_PORT_RANGE_START = envConfig.range.start;
    envVars.TRUXE_PORT_RANGE_END = envConfig.range.end;

    // Service ports
    for (const [serviceName, port] of Object.entries(envConfig.services)) {
      const envVarName = `TRUXE_${serviceName.toUpperCase()}_PORT`;
      envVars[envVarName] = port;
    }

    return envVars;
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.cache.clear();
    this.conflictCache.clear();
    this.lastValidation = null;
  }

  /**
   * Get system status report
   */
  getSystemStatus(env = this.environment) {
    const envConfig = this.getEnvironmentConfig(env);
    const conflicts = this.detectConflicts(env);
    const issues = this.validateConfiguration(env);
    
    return {
      environment: env,
      timestamp: new Date().toISOString(),
      status: conflicts.length === 0 && issues.length === 0 ? 'healthy' : 'issues_detected',
      port_range: envConfig.range,
      total_services: Object.keys(envConfig.services).length,
      port_utilization: this.calculatePortUtilization(env),
      conflicts: conflicts,
      validation_issues: issues,
      cache_stats: {
        port_cache_size: this.cache.size,
        conflict_cache_size: this.conflictCache.size
      }
    };
  }
}

// Export singleton instance and class
const portManager = new PortManager();

export default portManager;
export { PortManager, PORT_CONFIG };
