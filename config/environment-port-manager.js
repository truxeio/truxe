/**
 * Truxe Environment-Specific Port Range Management System
 * 
 * Provides comprehensive environment isolation, automatic detection, and 
 * cross-environment conflict prevention for port management.
 * 
 * @author DevOps Engineering Team
 * @version 3.0.0
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import EventEmitter from 'events';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Enhanced Environment-Specific Port Configuration
 * Implements strict port range isolation and environment detection
 */
const ENVIRONMENT_PORT_CONFIG = {
  environments: {
    development: {
      name: 'Development',
      code: 'dev',
      base_port: 21000,
      range: { start: 21000, end: 21999 },
      total_ports: 1000,
      description: 'Local development environment with hot-reload capabilities',
      isolation_level: 'strict',
      auto_resolve_conflicts: true,
      allow_fallback: true,
      priority: 1,
      services: {
        // Core Services (21000-21099)
        api: 21001,
        database: 21432,
        redis: 21379,
        
        // Development Tools (21100-21199)
        mailhog_smtp: 21025,
        mailhog_web: 21825,
        docs: 21002,
        hot_reload: 21100,
        dev_server: 21101,
        
        // Monitoring & Observability (21200-21299)
        monitoring: 21003,
        grafana: 21004,
        prometheus: 21005,
        jaeger: 21006,
        
        // Additional Services (21300-21399)
        webhook_relay: 21301,
        file_server: 21302,
        backup_service: 21303,
        
        // Testing Services (21400-21499)
        test_runner: 21401,
        mock_server: 21402,
        load_tester: 21403,
        
        // Reserved for Future Use (21500-21999)
        reserved_1: 21501,
        reserved_2: 21502,
        reserved_3: 21503
      },
      environment_variables: {
        NODE_ENV: 'development',
        TRUXE_ENV: 'development',
        DEBUG: 'truxe:*',
        LOG_LEVEL: 'debug'
      }
    },
    
    staging: {
      name: 'Staging',
      code: 'stg',
      base_port: 22000,
      range: { start: 22000, end: 22999 },
      total_ports: 1000,
      description: 'Pre-production staging environment for integration testing',
      isolation_level: 'strict',
      auto_resolve_conflicts: false,
      allow_fallback: false,
      priority: 2,
      services: {
        // Core Services (22000-22099)
        api: 22001,
        database: 22432,
        redis: 22379,
        
        // Development Tools (22100-22199)
        mailhog_smtp: 22025,
        mailhog_web: 22825,
        docs: 22002,
        
        // Monitoring & Observability (22200-22299)
        monitoring: 22003,
        grafana: 22004,
        prometheus: 22005,
        jaeger: 22006,
        
        // Additional Services (22300-22399)
        webhook_relay: 22301,
        file_server: 22302,
        backup_service: 22303,
        
        // Testing Services (22400-22499)
        test_runner: 22401,
        mock_server: 22402,
        load_tester: 22403,
        integration_tests: 22404,
        
        // Reserved for Future Use (22500-22999)
        reserved_1: 22501,
        reserved_2: 22502,
        reserved_3: 22503
      },
      environment_variables: {
        NODE_ENV: 'staging',
        TRUXE_ENV: 'staging',
        LOG_LEVEL: 'info'
      }
    },
    
    testing: {
      name: 'Testing',
      code: 'test',
      base_port: 23000,
      range: { start: 23000, end: 23999 },
      total_ports: 1000,
      description: 'Automated testing environment with isolated test data',
      isolation_level: 'maximum',
      auto_resolve_conflicts: false,
      allow_fallback: false,
      priority: 3,
      services: {
        // Core Services (23000-23099)
        api: 23001,
        database: 23432,
        redis: 23379,
        
        // Development Tools (23100-23199)
        mailhog_smtp: 23025,
        mailhog_web: 23825,
        docs: 23002,
        
        // Monitoring & Observability (23200-23299)
        monitoring: 23003,
        grafana: 23004,
        prometheus: 23005,
        jaeger: 23006,
        
        // Additional Services (23300-23399)
        webhook_relay: 23301,
        file_server: 23302,
        backup_service: 23303,
        
        // Testing Services (23400-23499)
        test_runner: 23401,
        mock_server: 23402,
        load_tester: 23403,
        e2e_runner: 23404,
        selenium_hub: 23405,
        test_db: 23406,
        
        // Reserved for Future Use (23500-23999)
        reserved_1: 23501,
        reserved_2: 23502,
        reserved_3: 23503
      },
      environment_variables: {
        NODE_ENV: 'test',
        TRUXE_ENV: 'testing',
        LOG_LEVEL: 'warn'
      }
    },
    
    production: {
      name: 'Production',
      code: 'prod',
      base_port: 80,
      range: { start: 80, end: 65535 },
      total_ports: 65456,
      description: 'Production environment with standard ports and reverse proxy',
      isolation_level: 'maximum',
      auto_resolve_conflicts: false,
      allow_fallback: false,
      priority: 4,
      services: {
        // Standard Production Ports
        api: 80,           // Behind reverse proxy
        api_internal: 3001, // Internal API port
        database: 5432,    // Standard PostgreSQL
        redis: 6379,       // Standard Redis
        
        // HTTPS & SSL
        https: 443,
        
        // Monitoring & Observability
        monitoring: 9090,   // Prometheus standard
        grafana: 3000,     // Grafana standard
        jaeger: 14268,     // Jaeger standard
        
        // Additional Production Services
        webhook_relay: 8080,
        file_server: 8081,
        backup_service: 8082,
        
        // Health Checks & Status
        health_check: 8090,
        status_page: 8091
      },
      environment_variables: {
        NODE_ENV: 'production',
        TRUXE_ENV: 'production',
        LOG_LEVEL: 'error'
      }
    }
  },
  
  /**
   * Environment Detection Configuration
   */
  detection: {
    sources: [
      'TRUXE_ENV',           // Primary environment variable
      'NODE_ENV',               // Standard Node.js environment
      'ENVIRONMENT',            // Generic environment variable
      'DEPLOY_ENV',             // Deployment-specific variable
      'APP_ENV'                 // Application-specific variable
    ],
    fallback: 'development',
    validation: {
      enabled: true,
      strict_mode: true,
      require_explicit_production: true
    },
    auto_detection: {
      enabled: true,
      docker_compose_file: true,
      git_branch: true,
      hostname_patterns: true,
      port_usage_analysis: true
    }
  },
  
  /**
   * Environment Isolation Configuration
   */
  isolation: {
    enforce_range_boundaries: true,
    prevent_cross_environment_access: true,
    validate_environment_consistency: true,
    block_production_access_from_dev: true,
    require_environment_confirmation: {
      production: true,
      staging: false,
      testing: false,
      development: false
    },
    cross_environment_warnings: true,
    isolation_breach_alerts: true
  },
  
  /**
   * Port Range Validation Rules
   */
  validation: {
    require_range_compliance: true,
    allow_port_override: false,
    max_port_gap: 100,
    min_port_separation: 1,
    validate_on_startup: true,
    fail_on_conflict: true,
    auto_resolve_conflicts: false,
    check_system_availability: true,
    validate_service_mappings: true,
    enforce_service_standards: true
  },
  
  /**
   * Monitoring and Alerting Configuration
   */
  monitoring: {
    enabled: true,
    port_usage_tracking: true,
    environment_switching_logs: true,
    conflict_detection_interval: 30000, // 30 seconds
    health_check_interval: 60000,       // 1 minute
    metrics_collection: true,
    alert_thresholds: {
      port_utilization: 80,              // Alert at 80% utilization
      conflict_count: 3,                 // Alert after 3 conflicts
      environment_switches: 10           // Alert after 10 switches per hour
    },
    log_retention_days: 30
  }
};

/**
 * Environment-Specific Port Range Manager
 * Provides comprehensive environment isolation and port management
 */
class EnvironmentPortManager extends EventEmitter {
  constructor(configOverride = null) {
    super();
    this.config = configOverride || ENVIRONMENT_PORT_CONFIG;
    this.currentEnvironment = null;
    this.environmentHistory = [];
    this.portUsageCache = new Map();
    this.conflictCache = new Map();
    this.cache = new Map();
    this.monitoringInterval = null;
    this.lastValidation = null;
    this.isolationViolations = [];
    
    // Initialize environment detection
    this.detectAndSetEnvironment();
    
    // Start monitoring if enabled
    if (this.config.monitoring.enabled) {
      this.startMonitoring();
    }
    
    // Bind event handlers
    this.setupEventHandlers();
  }

  /**
   * Comprehensive Environment Detection
   * Uses multiple sources and validation methods
   */
  detectAndSetEnvironment() {
    const detectedEnv = this.detectEnvironment();
    const validatedEnv = this.validateEnvironment(detectedEnv);
    
    if (this.currentEnvironment !== validatedEnv) {
      const previousEnv = this.currentEnvironment;
      this.currentEnvironment = validatedEnv;
      
      // Record environment switch
      this.recordEnvironmentSwitch(previousEnv, validatedEnv);
      
      // Emit environment change event
      this.emit('environmentChanged', {
        previous: previousEnv,
        current: validatedEnv,
        timestamp: new Date().toISOString()
      });
      
      console.log(`🔄 Environment switched: ${previousEnv || 'none'} → ${validatedEnv}`);
    }
    
    return validatedEnv;
  }

  /**
   * Multi-source Environment Detection
   */
  detectEnvironment() {
    // Check explicit environment variables in priority order
    for (const source of this.config.detection.sources) {
      const envValue = process.env[source];
      if (envValue && this.isValidEnvironment(envValue)) {
        console.log(`🔍 Environment detected from ${source}: ${envValue}`);
        return envValue;
      }
    }

    // Auto-detection methods
    if (this.config.detection.auto_detection.enabled) {
      // Docker Compose file detection
      if (this.config.detection.auto_detection.docker_compose_file) {
        const dockerEnv = this.detectFromDockerCompose();
        if (dockerEnv) {
          console.log(`🐳 Environment detected from Docker Compose: ${dockerEnv}`);
          return dockerEnv;
        }
      }

      // Git branch detection
      if (this.config.detection.auto_detection.git_branch) {
        const gitEnv = this.detectFromGitBranch();
        if (gitEnv) {
          console.log(`🌿 Environment detected from Git branch: ${gitEnv}`);
          return gitEnv;
        }
      }

      // Hostname pattern detection
      if (this.config.detection.auto_detection.hostname_patterns) {
        const hostnameEnv = this.detectFromHostname();
        if (hostnameEnv) {
          console.log(`🖥️  Environment detected from hostname: ${hostnameEnv}`);
          return hostnameEnv;
        }
      }

      // Port usage analysis
      if (this.config.detection.auto_detection.port_usage_analysis) {
        const portEnv = this.detectFromPortUsage();
        if (portEnv) {
          console.log(`🔌 Environment detected from port usage: ${portEnv}`);
          return portEnv;
        }
      }
    }

    console.log(`⚠️  No environment detected, using fallback: ${this.config.detection.fallback}`);
    return this.config.detection.fallback;
  }

  /**
   * Detect environment from Docker Compose file
   */
  detectFromDockerCompose() {
    try {
      const composeFiles = [
        'docker-compose.dev.yml',
        'docker-compose.staging.yml',
        'docker-compose.testing.yml',
        'docker-compose.prod.yml',
        'docker-compose.production.yml'
      ];

      for (const file of composeFiles) {
        const filePath = path.join(process.cwd(), file);
        if (fs.existsSync(filePath)) {
          if (file.includes('dev')) return 'development';
          if (file.includes('staging')) return 'staging';
          if (file.includes('testing') || file.includes('test')) return 'testing';
          if (file.includes('prod')) return 'production';
        }
      }
    } catch (error) {
      console.warn('Failed to detect environment from Docker Compose:', error.message);
    }
    return null;
  }

  /**
   * Detect environment from Git branch
   */
  detectFromGitBranch() {
    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', { 
        encoding: 'utf8', 
        stdio: 'pipe' 
      }).trim();
      
      if (branch.includes('main') || branch.includes('master')) return 'production';
      if (branch.includes('staging') || branch.includes('stage')) return 'staging';
      if (branch.includes('test')) return 'testing';
      if (branch.includes('dev') || branch.includes('develop')) return 'development';
    } catch (error) {
      // Git not available or not in a git repository
    }
    return null;
  }

  /**
   * Detect environment from hostname patterns
   */
  detectFromHostname() {
    try {
      const hostname = require('os').hostname().toLowerCase();
      
      if (hostname.includes('prod') || hostname.includes('production')) return 'production';
      if (hostname.includes('staging') || hostname.includes('stage')) return 'staging';
      if (hostname.includes('test')) return 'testing';
      if (hostname.includes('dev') || hostname.includes('local')) return 'development';
    } catch (error) {
      console.warn('Failed to detect environment from hostname:', error.message);
    }
    return null;
  }

  /**
   * Detect environment from port usage analysis
   */
  detectFromPortUsage() {
    try {
      // Check which port ranges are in use
      for (const [envName, envConfig] of Object.entries(this.config.environments)) {
        const portsInUse = this.getPortsInUseInRange(envConfig.range.start, envConfig.range.end);
        if (portsInUse.length > 0) {
          return envName;
        }
      }
    } catch (error) {
      console.warn('Failed to detect environment from port usage:', error.message);
    }
    return null;
  }

  /**
   * Get ports in use within a specific range
   */
  getPortsInUseInRange(startPort, endPort) {
    try {
      const result = execSync(`lsof -i :${startPort}-${endPort} -t`, { 
        encoding: 'utf8', 
        stdio: 'pipe' 
      });
      return result.trim().split('\n').filter(Boolean);
    } catch (error) {
      return [];
    }
  }

  /**
   * Validate detected environment
   */
  validateEnvironment(environment) {
    if (!this.config.detection.validation.enabled) {
      return environment;
    }

    // Check if environment is valid
    if (!this.isValidEnvironment(environment)) {
      throw new Error(`Invalid environment '${environment}'. Valid environments: ${this.getValidEnvironments().join(', ')}`);
    }

    // Strict mode validation
    if (this.config.detection.validation.strict_mode) {
      if (environment === 'production' && this.config.detection.validation.require_explicit_production) {
        if (!process.env.TRUXE_PRODUCTION_CONFIRMED) {
          throw new Error('Production environment requires explicit confirmation via TRUXE_PRODUCTION_CONFIRMED=true');
        }
      }
    }

    return environment;
  }

  /**
   * Check if environment name is valid
   */
  isValidEnvironment(environment) {
    return Object.keys(this.config.environments).includes(environment);
  }

  /**
   * Get list of valid environment names
   */
  getValidEnvironments() {
    return Object.keys(this.config.environments);
  }

  /**
   * Switch to a different environment
   */
  switchEnvironment(targetEnvironment, force = false) {
    if (!this.isValidEnvironment(targetEnvironment)) {
      throw new Error(`Invalid target environment '${targetEnvironment}'. Valid environments: ${this.getValidEnvironments().join(', ')}`);
    }

    // Environment isolation checks
    if (!force && this.config.isolation.enforce_range_boundaries) {
      const currentConfig = this.getEnvironmentConfig();
      const targetConfig = this.getEnvironmentConfig(targetEnvironment);
      
      // Check for potential conflicts
      const conflicts = this.checkCrossEnvironmentConflicts(targetEnvironment);
      if (conflicts.length > 0 && !force) {
        throw new Error(`Cannot switch to ${targetEnvironment}: ${conflicts.length} conflicts detected. Use force=true to override.`);
      }
    }

    // Production environment confirmation
    if (targetEnvironment === 'production' && this.config.isolation.require_environment_confirmation.production && !force) {
      if (!process.env.TRUXE_PRODUCTION_CONFIRMED) {
        throw new Error('Switching to production requires TRUXE_PRODUCTION_CONFIRMED=true');
      }
    }

    const previousEnvironment = this.currentEnvironment;
    this.currentEnvironment = targetEnvironment;
    
    // Clear caches when switching environments
    this.clearCaches();
    
    // Record the switch
    this.recordEnvironmentSwitch(previousEnvironment, targetEnvironment);
    
    // Emit event
    this.emit('environmentSwitched', {
      previous: previousEnvironment,
      current: targetEnvironment,
      forced: force,
      timestamp: new Date().toISOString()
    });

    console.log(`🔄 Environment switched: ${previousEnvironment} → ${targetEnvironment}${force ? ' (forced)' : ''}`);
    
    return targetEnvironment;
  }

  /**
   * Get environment configuration
   */
  getEnvironmentConfig(environment = this.currentEnvironment) {
    if (!environment) {
      throw new Error('No environment specified and no current environment set');
    }
    
    const config = this.config.environments[environment];
    if (!config) {
      throw new Error(`Environment '${environment}' not found`);
    }
    
    return config;
  }

  /**
   * Get service port with environment isolation
   */
  getServicePort(serviceName, environment = this.currentEnvironment, options = {}) {
    const { 
      enableFallback = false, 
      validateRange = true, 
      checkAvailability = true 
    } = options;

    const envConfig = this.getEnvironmentConfig(environment);
    let port = envConfig.services[serviceName];
    
    if (!port) {
      throw new Error(`Service '${serviceName}' not found in ${environment} environment`);
    }

    // Range validation
    if (validateRange && this.config.validation.require_range_compliance) {
      if (port < envConfig.range.start || port > envConfig.range.end) {
        throw new Error(`Port ${port} for service '${serviceName}' is outside ${environment} range ${envConfig.range.start}-${envConfig.range.end}`);
      }
    }

    // Availability check
    if (checkAvailability && !this.isPortAvailable(port)) {
      if (enableFallback && envConfig.allow_fallback) {
        port = this.findFallbackPort(port, environment);
      } else {
        throw new Error(`Port ${port} for service '${serviceName}' is not available`);
      }
    }

    return port;
  }

  /**
   * Check for cross-environment conflicts
   */
  checkCrossEnvironmentConflicts(targetEnvironment) {
    const conflicts = [];
    const targetConfig = this.getEnvironmentConfig(targetEnvironment);
    
    // Check against all other environments
    for (const [envName, envConfig] of Object.entries(this.config.environments)) {
      if (envName === targetEnvironment) continue;
      
      // Check for port range overlaps
      if (this.doRangesOverlap(targetConfig.range, envConfig.range)) {
        conflicts.push({
          type: 'range_overlap',
          environment: envName,
          target_range: targetConfig.range,
          conflict_range: envConfig.range,
          severity: 'high'
        });
      }
      
      // Check for specific port conflicts
      for (const [serviceName, port] of Object.entries(targetConfig.services)) {
        if (envConfig.services[serviceName] === port) {
          conflicts.push({
            type: 'port_conflict',
            service: serviceName,
            port: port,
            environment: envName,
            severity: 'critical'
          });
        }
      }
    }
    
    return conflicts;
  }

  /**
   * Check if two port ranges overlap
   */
  doRangesOverlap(range1, range2) {
    return range1.start <= range2.end && range2.start <= range1.end;
  }

  /**
   * Validate port configuration comprehensively
   */
  validateConfiguration(environment = this.currentEnvironment) {
    const envConfig = this.getEnvironmentConfig(environment);
    const issues = [];

    console.log(`🔧 Validating port configuration for ${environment} environment...`);

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

    return issues;
  }

  /**
   * Comprehensive port conflict detection
   */
  detectConflicts(environment = this.currentEnvironment) {
    const cacheKey = `conflicts:${environment}`;
    
    // Check cache (valid for 30 seconds)
    if (this.conflictCache.has(cacheKey)) {
      const cached = this.conflictCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 30000) {
        return cached.conflicts;
      }
    }

    const envConfig = this.getEnvironmentConfig(environment);
    const conflicts = [];

    console.log(`🔍 Scanning for port conflicts in ${environment} environment...`);

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
    if (this.config.validation.check_system_availability) {
      for (const [serviceName, port] of Object.entries(envConfig.services)) {
        if (this.isPortReserved(port)) {
          conflicts.push({
            type: 'reserved_port',
            service: serviceName,
            port: port,
            severity: 'medium',
            message: `Port ${port} is in reserved range`
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
   * Check if a port is available on the system
   */
  isPortAvailable(port) {
    try {
      // Use lsof to check if port is in use
      execSync(`lsof -ti:${port}`, { 
        stdio: 'ignore', 
        timeout: 5000
      });
      return false; // Port is in use
    } catch (error) {
      return true; // Port is available
    }
  }

  /**
   * Check if a port is in reserved ranges
   */
  isPortReserved(port) {
    const reservedRanges = [
      { start: 1, end: 1023, description: 'System reserved ports (root required)' },
      { start: 1024, end: 4999, description: 'Registered ports (IANA assigned)' },
      { start: 3000, end: 3010, description: 'Common development ports (React, etc.)' },
      { start: 8000, end: 8010, description: 'Common web server ports' },
      { start: 9000, end: 9010, description: 'Common application ports' },
      { start: 5000, end: 5010, description: 'Common development server ports' }
    ];
    
    for (const range of reservedRanges) {
      if (port >= range.start && port <= range.end) {
        return true;
      }
    }
    
    const systemPorts = [22, 25, 53, 80, 110, 143, 443, 993, 995];
    return systemPorts.includes(port);
  }

  /**
   * Validate environment isolation
   */
  validateEnvironmentIsolation(environment = this.currentEnvironment) {
    const violations = [];
    const envConfig = this.getEnvironmentConfig(environment);
    
    // Check range boundary enforcement
    if (this.config.isolation.enforce_range_boundaries) {
      for (const [serviceName, port] of Object.entries(envConfig.services)) {
        if (port < envConfig.range.start || port > envConfig.range.end) {
          violations.push({
            type: 'range_boundary_violation',
            service: serviceName,
            port: port,
            expected_range: envConfig.range,
            severity: 'high'
          });
        }
      }
    }
    
    // Check cross-environment access prevention
    if (this.config.isolation.prevent_cross_environment_access) {
      const crossEnvConflicts = this.checkCrossEnvironmentConflicts(environment);
      violations.push(...crossEnvConflicts);
    }
    
    this.isolationViolations = violations;
    return violations;
  }

  /**
   * Check if port is available
   */
  isPortAvailable(port) {
    try {
      execSync(`lsof -ti:${port}`, { stdio: 'ignore', timeout: 5000 });
      return false; // Port is in use
    } catch (error) {
      return true; // Port is available
    }
  }

  /**
   * Find fallback port within environment range
   */
  findFallbackPort(originalPort, environment = this.currentEnvironment) {
    const envConfig = this.getEnvironmentConfig(environment);
    const maxAttempts = 50;
    let currentPort = originalPort;
    
    for (let i = 0; i < maxAttempts; i++) {
      currentPort++;
      
      if (currentPort > envConfig.range.end) {
        throw new Error(`No available fallback ports in ${environment} range`);
      }
      
      if (this.isPortAvailable(currentPort)) {
        console.warn(`⚠️  Using fallback port ${currentPort} instead of ${originalPort}`);
        return currentPort;
      }
    }
    
    throw new Error(`Failed to find fallback port after ${maxAttempts} attempts`);
  }

  /**
   * Record environment switch for monitoring
   */
  recordEnvironmentSwitch(from, to) {
    const switchRecord = {
      from,
      to,
      timestamp: new Date().toISOString(),
      process_id: process.pid,
      user: process.env.USER || process.env.USERNAME || 'unknown'
    };
    
    this.environmentHistory.push(switchRecord);
    
    // Keep only last 100 switches
    if (this.environmentHistory.length > 100) {
      this.environmentHistory = this.environmentHistory.slice(-100);
    }
    
    // Emit monitoring event
    this.emit('environmentSwitchRecorded', switchRecord);
  }

  /**
   * Start monitoring system
   */
  startMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    this.monitoringInterval = setInterval(() => {
      this.performMonitoringCheck();
    }, this.config.monitoring.conflict_detection_interval);
    
    console.log('🔍 Port monitoring started');
  }

  /**
   * Stop monitoring system
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    console.log('🔍 Port monitoring stopped');
  }

  /**
   * Perform monitoring check
   */
  performMonitoringCheck() {
    try {
      // Check for conflicts
      const conflicts = this.checkCrossEnvironmentConflicts(this.currentEnvironment);
      
      // Check isolation violations
      const violations = this.validateEnvironmentIsolation();
      
      // Emit monitoring events
      if (conflicts.length > 0) {
        this.emit('conflictsDetected', conflicts);
      }
      
      if (violations.length > 0) {
        this.emit('isolationViolationsDetected', violations);
      }
      
      // Check alert thresholds
      this.checkAlertThresholds();
      
    } catch (error) {
      this.emit('monitoringError', error);
    }
  }

  /**
   * Check alert thresholds
   */
  checkAlertThresholds() {
    const thresholds = this.config.monitoring.alert_thresholds;
    
    // Check port utilization
    const utilization = this.calculatePortUtilization();
    if (utilization > thresholds.port_utilization) {
      this.emit('alertTriggered', {
        type: 'port_utilization',
        value: utilization,
        threshold: thresholds.port_utilization,
        severity: 'warning'
      });
    }
    
    // Check environment switches
    const recentSwitches = this.getRecentEnvironmentSwitches(3600000); // Last hour
    if (recentSwitches.length > thresholds.environment_switches) {
      this.emit('alertTriggered', {
        type: 'excessive_environment_switches',
        value: recentSwitches.length,
        threshold: thresholds.environment_switches,
        severity: 'warning'
      });
    }
  }

  /**
   * Calculate port utilization for current environment
   */
  calculatePortUtilization(environment = this.currentEnvironment) {
    const envConfig = this.getEnvironmentConfig(environment);
    const totalPorts = envConfig.range.end - envConfig.range.start + 1;
    const usedPorts = Object.keys(envConfig.services).length;
    return Math.round((usedPorts / totalPorts) * 100 * 100) / 100;
  }

  /**
   * Get recent environment switches
   */
  getRecentEnvironmentSwitches(timeWindowMs) {
    const cutoff = Date.now() - timeWindowMs;
    return this.environmentHistory.filter(
      record => new Date(record.timestamp).getTime() > cutoff
    );
  }

  /**
   * Generate environment-specific configuration
   */
  generateEnvironmentConfig(environment = this.currentEnvironment) {
    const envConfig = this.getEnvironmentConfig(environment);
    
    return {
      environment: environment,
      name: envConfig.name,
      code: envConfig.code,
      range: envConfig.range,
      services: envConfig.services,
      environment_variables: {
        ...envConfig.environment_variables,
        TRUXE_ENV: environment,
        TRUXE_PORT_RANGE_START: envConfig.range.start,
        TRUXE_PORT_RANGE_END: envConfig.range.end,
        ...this.generateServicePortVariables(environment)
      },
      docker_compose_ports: this.generateDockerComposePorts(environment),
      isolation_level: envConfig.isolation_level,
      monitoring: this.getEnvironmentMonitoringStatus(environment)
    };
  }

  /**
   * Generate service port environment variables
   */
  generateServicePortVariables(environment = this.currentEnvironment) {
    const envConfig = this.getEnvironmentConfig(environment);
    const variables = {};
    
    for (const [serviceName, port] of Object.entries(envConfig.services)) {
      const varName = `TRUXE_${serviceName.toUpperCase()}_PORT`;
      variables[varName] = port;
    }
    
    return variables;
  }

  /**
   * Generate Docker Compose port mappings
   */
  generateDockerComposePorts(environment = this.currentEnvironment) {
    const envConfig = this.getEnvironmentConfig(environment);
    const portMappings = {};
    
    // Internal port mappings (container ports)
    const internalPorts = {
      api: 3001,
      database: 5432,
      redis: 6379,
      mailhog_smtp: 1025,
      mailhog_web: 8025,
      docs: 80,
      monitoring: 3000,
      grafana: 3000,
      prometheus: 9090
    };
    
    for (const [serviceName, externalPort] of Object.entries(envConfig.services)) {
      const internalPort = internalPorts[serviceName] || 3000;
      portMappings[serviceName] = {
        external: externalPort,
        internal: internalPort,
        mapping: `${externalPort}:${internalPort}`
      };
    }
    
    return portMappings;
  }

  /**
   * Get environment monitoring status
   */
  getEnvironmentMonitoringStatus(environment = this.currentEnvironment) {
    return {
      environment: environment,
      monitoring_enabled: this.config.monitoring.enabled,
      last_check: this.lastValidation?.timestamp || null,
      conflicts: this.conflictCache.get(`conflicts:${environment}`) || [],
      violations: this.isolationViolations,
      port_utilization: this.calculatePortUtilization(environment),
      recent_switches: this.getRecentEnvironmentSwitches(3600000).length
    };
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    this.on('environmentChanged', (data) => {
      console.log(`🔄 Environment changed: ${data.previous} → ${data.current}`);
    });
    
    this.on('conflictsDetected', (conflicts) => {
      console.warn(`⚠️  ${conflicts.length} port conflicts detected`);
    });
    
    this.on('isolationViolationsDetected', (violations) => {
      console.error(`🚨 ${violations.length} isolation violations detected`);
    });
    
    this.on('alertTriggered', (alert) => {
      console.warn(`🚨 Alert: ${alert.type} - ${alert.value} exceeds threshold ${alert.threshold}`);
    });
  }

  /**
   * Clear all caches
   */
  clearCaches() {
    this.portUsageCache.clear();
    this.conflictCache.clear();
    this.lastValidation = null;
  }

  /**
   * Get comprehensive system status
   */
  getSystemStatus() {
    const currentEnv = this.currentEnvironment;
    const envConfig = this.getEnvironmentConfig(currentEnv);
    
    return {
      timestamp: new Date().toISOString(),
      current_environment: currentEnv,
      environment_config: envConfig,
      port_utilization: this.calculatePortUtilization(currentEnv),
      conflicts: this.checkCrossEnvironmentConflicts(currentEnv),
      isolation_violations: this.validateEnvironmentIsolation(currentEnv),
      monitoring_status: this.getEnvironmentMonitoringStatus(currentEnv),
      recent_switches: this.getRecentEnvironmentSwitches(3600000),
      cache_stats: {
        port_usage_cache_size: this.portUsageCache.size,
        conflict_cache_size: this.conflictCache.size
      }
    };
  }

  /**
   * Reset environment to default
   */
  resetEnvironment() {
    this.currentEnvironment = this.config.detection.fallback;
    this.clearCaches();
    this.isolationViolations = [];
    
    console.log(`🔄 Environment reset to default: ${this.currentEnvironment}`);
    
    this.emit('environmentReset', {
      environment: this.currentEnvironment,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get comprehensive system status
   */
  getSystemStatus() {
    const currentEnv = this.currentEnvironment;
    const envConfig = this.getEnvironmentConfig(currentEnv);
    const conflicts = this.detectConflicts(currentEnv);
    const issues = this.validateConfiguration(currentEnv);
    
    return {
      environment: currentEnv,
      timestamp: new Date().toISOString(),
      status: conflicts.length === 0 && issues.length === 0 ? 'healthy' : 'issues_detected',
      port_range: envConfig.range,
      total_services: Object.keys(envConfig.services).length,
      port_utilization: this.calculatePortUtilization(currentEnv),
      conflicts: conflicts,
      validation_issues: issues,
      cache_stats: {
        port_cache_size: this.cache.size,
        conflict_cache_size: this.conflictCache.size
      }
    };
  }

  /**
   * Calculate port utilization percentage
   */
  calculatePortUtilization(environment = this.currentEnvironment) {
    const envConfig = this.getEnvironmentConfig(environment);
    const totalRange = envConfig.range.end - envConfig.range.start + 1;
    const usedPorts = Object.keys(envConfig.services).length;
    return Math.round((usedPorts / totalRange) * 100 * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Clear all caches
   */
  clearCaches() {
    this.cache.clear();
    this.conflictCache.clear();
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.stopMonitoring();
    this.clearCaches();
    this.removeAllListeners();
  }
}

// Export singleton instance and class
const environmentPortManager = new EnvironmentPortManager();

export default environmentPortManager;
export { EnvironmentPortManager, ENVIRONMENT_PORT_CONFIG };
