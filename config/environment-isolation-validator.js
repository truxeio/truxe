/**
 * Truxe Environment Isolation Validator
 * 
 * Provides comprehensive validation and safeguards to ensure complete
 * isolation between development, staging, testing, and production environments.
 * 
 * @author DevOps Engineering Team
 * @version 1.0.0
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import EventEmitter from 'events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Environment Isolation Rules and Policies
 */
const ISOLATION_POLICIES = {
  // Strict isolation rules
  strict_isolation: {
    enabled: true,
    prevent_cross_environment_access: true,
    enforce_range_boundaries: true,
    require_environment_confirmation: true,
    block_production_from_development: true,
    validate_service_mappings: true
  },
  
  // Environment-specific access controls
  access_controls: {
    development: {
      can_access: ['development'],
      cannot_access: ['staging', 'testing', 'production'],
      requires_confirmation: false,
      allows_port_override: true,
      allows_fallback: true
    },
    staging: {
      can_access: ['development', 'staging'],
      cannot_access: ['production'],
      requires_confirmation: false,
      allows_port_override: false,
      allows_fallback: false
    },
    testing: {
      can_access: ['development', 'testing'],
      cannot_access: ['staging', 'production'],
      requires_confirmation: false,
      allows_port_override: false,
      allows_fallback: false
    },
    production: {
      can_access: ['production'],
      cannot_access: ['development', 'staging', 'testing'],
      requires_confirmation: true,
      allows_port_override: false,
      allows_fallback: false
    }
  },
  
  // Port range isolation rules
  port_isolation: {
    enforce_boundaries: true,
    allow_range_overlap: false,
    validate_service_ports: true,
    check_system_conflicts: true,
    reserved_port_protection: true
  },
  
  // Security policies
  security: {
    require_environment_tokens: false,
    validate_process_ownership: true,
    check_file_permissions: true,
    audit_environment_switches: true,
    encrypt_sensitive_configs: false
  },
  
  // Validation thresholds
  thresholds: {
    max_port_conflicts: 0,
    max_isolation_violations: 0,
    max_cross_environment_attempts: 5,
    validation_timeout_ms: 10000
  }
};

/**
 * Environment Isolation Validator Class
 * Enforces strict isolation between environments
 */
class EnvironmentIsolationValidator extends EventEmitter {
  constructor(portManager, policies = ISOLATION_POLICIES) {
    super();
    this.portManager = portManager;
    this.policies = policies;
    this.violationHistory = [];
    this.accessAttempts = new Map();
    this.validationCache = new Map();
    this.securityTokens = new Map();
    
    // Initialize validation
    this.initializeValidator();
  }

  /**
   * Initialize the validator
   */
  initializeValidator() {
    console.log('🔒 Initializing Environment Isolation Validator...');
    
    // Generate security tokens if required
    if (this.policies.security.require_environment_tokens) {
      this.generateEnvironmentTokens();
    }
    
    // Setup validation hooks
    this.setupValidationHooks();
    
    console.log('✅ Environment Isolation Validator initialized');
  }

  /**
   * Generate security tokens for environments
   */
  generateEnvironmentTokens() {
    const environments = ['development', 'staging', 'testing', 'production'];
    
    for (const env of environments) {
      const token = crypto.randomBytes(32).toString('hex');
      this.securityTokens.set(env, token);
      
      // Set environment variable for token
      process.env[`TRUXE_${env.toUpperCase()}_TOKEN`] = token;
    }
    
    console.log('🔑 Environment security tokens generated');
  }

  /**
   * Setup validation hooks with port manager
   */
  setupValidationHooks() {
    // Hook into environment changes
    this.portManager.on('environmentChanged', (data) => {
      this.validateEnvironmentSwitch(data.previous, data.current);
    });
    
    // Hook into port access attempts
    this.portManager.on('portAccessAttempt', (data) => {
      this.validatePortAccess(data.service, data.port, data.environment);
    });
  }

  /**
   * Comprehensive Environment Isolation Validation
   */
  validateEnvironmentIsolation(targetEnvironment, sourceEnvironment = null) {
    const validationId = crypto.randomUUID();
    const startTime = Date.now();
    
    console.log(`🔍 Validating environment isolation: ${sourceEnvironment || 'unknown'} → ${targetEnvironment}`);
    
    const validation = {
      id: validationId,
      timestamp: new Date().toISOString(),
      source_environment: sourceEnvironment,
      target_environment: targetEnvironment,
      status: 'pending',
      violations: [],
      warnings: [],
      checks_performed: [],
      duration_ms: 0
    };

    try {
      // 1. Environment Access Control Validation
      this.validateEnvironmentAccess(targetEnvironment, sourceEnvironment, validation);
      
      // 2. Port Range Boundary Validation
      this.validatePortRangeBoundaries(targetEnvironment, validation);
      
      // 3. Cross-Environment Conflict Detection
      this.validateCrossEnvironmentConflicts(targetEnvironment, validation);
      
      // 4. Service Mapping Validation
      this.validateServiceMappings(targetEnvironment, validation);
      
      // 5. Security Policy Validation
      this.validateSecurityPolicies(targetEnvironment, validation);
      
      // 6. System Resource Validation
      this.validateSystemResources(targetEnvironment, validation);
      
      // Determine final status
      validation.status = validation.violations.length === 0 ? 'passed' : 'failed';
      validation.duration_ms = Date.now() - startTime;
      
      // Cache validation result
      this.cacheValidationResult(validationId, validation);
      
      // Record validation attempt
      this.recordValidationAttempt(validation);
      
      console.log(`${validation.status === 'passed' ? '✅' : '❌'} Environment isolation validation ${validation.status}: ${validation.violations.length} violations, ${validation.warnings.length} warnings`);
      
      return validation;
      
    } catch (error) {
      validation.status = 'error';
      validation.error = error.message;
      validation.duration_ms = Date.now() - startTime;
      
      console.error('❌ Environment isolation validation failed:', error.message);
      throw error;
    }
  }

  /**
   * Validate environment access permissions
   */
  validateEnvironmentAccess(targetEnvironment, sourceEnvironment, validation) {
    validation.checks_performed.push('environment_access');
    
    if (!sourceEnvironment) {
      validation.warnings.push({
        type: 'unknown_source_environment',
        message: 'Source environment not specified',
        severity: 'low'
      });
      return;
    }

    const accessControl = this.policies.access_controls[sourceEnvironment];
    if (!accessControl) {
      validation.violations.push({
        type: 'invalid_source_environment',
        message: `Source environment '${sourceEnvironment}' not recognized`,
        severity: 'high'
      });
      return;
    }

    // Check if target environment is accessible from source
    if (!accessControl.can_access.includes(targetEnvironment)) {
      validation.violations.push({
        type: 'environment_access_denied',
        message: `Access to '${targetEnvironment}' is not allowed from '${sourceEnvironment}'`,
        severity: 'critical',
        source: sourceEnvironment,
        target: targetEnvironment
      });
    }

    // Check if target environment is explicitly blocked
    if (accessControl.cannot_access.includes(targetEnvironment)) {
      validation.violations.push({
        type: 'environment_access_blocked',
        message: `Access to '${targetEnvironment}' is explicitly blocked from '${sourceEnvironment}'`,
        severity: 'critical',
        source: sourceEnvironment,
        target: targetEnvironment
      });
    }

    // Check confirmation requirements
    if (accessControl.requires_confirmation && targetEnvironment === 'production') {
      if (!process.env.TRUXE_PRODUCTION_CONFIRMED) {
        validation.violations.push({
          type: 'missing_production_confirmation',
          message: 'Production environment access requires TRUXE_PRODUCTION_CONFIRMED=true',
          severity: 'critical'
        });
      }
    }
  }

  /**
   * Validate port range boundaries
   */
  validatePortRangeBoundaries(targetEnvironment, validation) {
    validation.checks_performed.push('port_range_boundaries');
    
    if (!this.policies.port_isolation.enforce_boundaries) {
      return;
    }

    const envConfig = this.portManager.getEnvironmentConfig(targetEnvironment);
    
    // Check each service port is within range
    for (const [serviceName, port] of Object.entries(envConfig.services)) {
      if (port < envConfig.range.start || port > envConfig.range.end) {
        validation.violations.push({
          type: 'port_range_boundary_violation',
          message: `Service '${serviceName}' port ${port} is outside ${targetEnvironment} range ${envConfig.range.start}-${envConfig.range.end}`,
          severity: 'high',
          service: serviceName,
          port: port,
          expected_range: envConfig.range
        });
      }
    }

    // Check for range overlaps with other environments
    if (!this.policies.port_isolation.allow_range_overlap) {
      const overlaps = this.detectRangeOverlaps(targetEnvironment);
      for (const overlap of overlaps) {
        validation.violations.push({
          type: 'port_range_overlap',
          message: `Port range overlap detected between ${targetEnvironment} and ${overlap.environment}`,
          severity: 'high',
          target_range: envConfig.range,
          overlap_range: overlap.range,
          overlap_environment: overlap.environment
        });
      }
    }
  }

  /**
   * Detect port range overlaps between environments
   */
  detectRangeOverlaps(targetEnvironment) {
    const targetConfig = this.portManager.getEnvironmentConfig(targetEnvironment);
    const overlaps = [];
    
    for (const [envName, envConfig] of Object.entries(this.portManager.config.environments)) {
      if (envName === targetEnvironment) continue;
      
      // Check for range overlap
      if (this.doRangesOverlap(targetConfig.range, envConfig.range)) {
        overlaps.push({
          environment: envName,
          range: envConfig.range
        });
      }
    }
    
    return overlaps;
  }

  /**
   * Check if two ranges overlap
   */
  doRangesOverlap(range1, range2) {
    return range1.start <= range2.end && range2.start <= range1.end;
  }

  /**
   * Validate cross-environment conflicts
   */
  validateCrossEnvironmentConflicts(targetEnvironment, validation) {
    validation.checks_performed.push('cross_environment_conflicts');
    
    const conflicts = this.portManager.checkCrossEnvironmentConflicts(targetEnvironment);
    
    for (const conflict of conflicts) {
      validation.violations.push({
        type: 'cross_environment_conflict',
        message: `Cross-environment conflict detected: ${conflict.message}`,
        severity: conflict.severity,
        conflict_details: conflict
      });
    }
  }

  /**
   * Validate service mappings
   */
  validateServiceMappings(targetEnvironment, validation) {
    validation.checks_performed.push('service_mappings');
    
    if (!this.policies.port_isolation.validate_service_ports) {
      return;
    }

    const envConfig = this.portManager.getEnvironmentConfig(targetEnvironment);
    const requiredServices = ['api', 'database', 'redis'];
    
    // Check required services are present
    for (const service of requiredServices) {
      if (!envConfig.services[service]) {
        validation.violations.push({
          type: 'missing_required_service',
          message: `Required service '${service}' not configured in ${targetEnvironment}`,
          severity: 'critical',
          service: service
        });
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
        validation.violations.push({
          type: 'duplicate_port_assignment',
          message: `Port ${port} assigned to multiple services: ${services.join(', ')}`,
          severity: 'critical',
          port: parseInt(port),
          services: services
        });
      }
    }
  }

  /**
   * Validate security policies
   */
  validateSecurityPolicies(targetEnvironment, validation) {
    validation.checks_performed.push('security_policies');
    
    // Environment token validation
    if (this.policies.security.require_environment_tokens) {
      const expectedToken = this.securityTokens.get(targetEnvironment);
      const providedToken = process.env[`TRUXE_${targetEnvironment.toUpperCase()}_TOKEN`];
      
      if (!providedToken || providedToken !== expectedToken) {
        validation.violations.push({
          type: 'invalid_environment_token',
          message: `Invalid or missing security token for ${targetEnvironment}`,
          severity: 'critical'
        });
      }
    }

    // Process ownership validation
    if (this.policies.security.validate_process_ownership) {
      const processInfo = this.getProcessInfo();
      if (processInfo.user === 'root' && targetEnvironment !== 'production') {
        validation.warnings.push({
          type: 'root_process_warning',
          message: 'Running as root user in non-production environment',
          severity: 'medium'
        });
      }
    }

    // File permissions validation
    if (this.policies.security.check_file_permissions) {
      this.validateFilePermissions(targetEnvironment, validation);
    }
  }

  /**
   * Get current process information
   */
  getProcessInfo() {
    return {
      pid: process.pid,
      user: process.env.USER || process.env.USERNAME || 'unknown',
      uid: process.getuid ? process.getuid() : null,
      gid: process.getgid ? process.getgid() : null
    };
  }

  /**
   * Validate file permissions for environment
   */
  validateFilePermissions(targetEnvironment, validation) {
    const sensitiveFiles = [
      'secrets/jwt-private-key.pem',
      'secrets/jwt-public-key.pem',
      '.env',
      'docker-compose.yml'
    ];

    for (const file of sensitiveFiles) {
      const filePath = path.join(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        try {
          const stats = fs.statSync(filePath);
          const mode = stats.mode & parseInt('777', 8);
          
          // Check if file is world-readable
          if (mode & parseInt('004', 8)) {
            validation.warnings.push({
              type: 'file_permission_warning',
              message: `File ${file} is world-readable`,
              severity: 'medium',
              file: file,
              permissions: mode.toString(8)
            });
          }
        } catch (error) {
          validation.warnings.push({
            type: 'file_permission_check_failed',
            message: `Failed to check permissions for ${file}: ${error.message}`,
            severity: 'low'
          });
        }
      }
    }
  }

  /**
   * Validate system resources
   */
  validateSystemResources(targetEnvironment, validation) {
    validation.checks_performed.push('system_resources');
    
    const envConfig = this.portManager.getEnvironmentConfig(targetEnvironment);
    
    // Check port availability
    const unavailablePorts = [];
    for (const [serviceName, port] of Object.entries(envConfig.services)) {
      if (!this.portManager.isPortAvailable(port)) {
        unavailablePorts.push({ service: serviceName, port });
      }
    }

    if (unavailablePorts.length > 0) {
      for (const { service, port } of unavailablePorts) {
        validation.violations.push({
          type: 'port_unavailable',
          message: `Port ${port} for service '${service}' is not available`,
          severity: 'high',
          service: service,
          port: port
        });
      }
    }

    // Check system resource limits
    this.validateSystemLimits(targetEnvironment, validation);
  }

  /**
   * Validate system limits
   */
  validateSystemLimits(targetEnvironment, validation) {
    try {
      // Check open file descriptors limit
      const ulimitResult = execSync('ulimit -n', { encoding: 'utf8' }).trim();
      const openFilesLimit = parseInt(ulimitResult);
      
      if (openFilesLimit < 1024) {
        validation.warnings.push({
          type: 'low_file_descriptor_limit',
          message: `Open files limit (${openFilesLimit}) may be too low for ${targetEnvironment}`,
          severity: 'medium',
          current_limit: openFilesLimit,
          recommended_minimum: 1024
        });
      }
    } catch (error) {
      validation.warnings.push({
        type: 'system_limit_check_failed',
        message: `Failed to check system limits: ${error.message}`,
        severity: 'low'
      });
    }
  }

  /**
   * Validate environment switch
   */
  validateEnvironmentSwitch(fromEnvironment, toEnvironment) {
    console.log(`🔒 Validating environment switch: ${fromEnvironment} → ${toEnvironment}`);
    
    // Record access attempt
    this.recordAccessAttempt(fromEnvironment, toEnvironment);
    
    // Check access attempt limits
    const attempts = this.getRecentAccessAttempts(fromEnvironment, toEnvironment);
    if (attempts.length > this.policies.thresholds.max_cross_environment_attempts) {
      throw new Error(`Too many cross-environment access attempts: ${attempts.length} attempts in the last hour`);
    }

    // Perform comprehensive validation
    const validation = this.validateEnvironmentIsolation(toEnvironment, fromEnvironment);
    
    // Check violation thresholds
    if (validation.violations.length > this.policies.thresholds.max_isolation_violations) {
      throw new Error(`Environment switch blocked: ${validation.violations.length} isolation violations detected`);
    }

    // Record violation if any
    if (validation.violations.length > 0) {
      this.recordIsolationViolation(validation);
    }

    return validation;
  }

  /**
   * Validate port access
   */
  validatePortAccess(serviceName, port, environment) {
    const envConfig = this.portManager.getEnvironmentConfig(environment);
    
    // Check if service exists in environment
    if (!envConfig.services[serviceName]) {
      throw new Error(`Service '${serviceName}' not configured in ${environment} environment`);
    }

    // Check if port matches expected port for service
    if (envConfig.services[serviceName] !== port) {
      throw new Error(`Port mismatch for service '${serviceName}': expected ${envConfig.services[serviceName]}, got ${port}`);
    }

    // Check port range compliance
    if (port < envConfig.range.start || port > envConfig.range.end) {
      throw new Error(`Port ${port} is outside ${environment} range ${envConfig.range.start}-${envConfig.range.end}`);
    }

    return true;
  }

  /**
   * Record access attempt
   */
  recordAccessAttempt(fromEnvironment, toEnvironment) {
    const key = `${fromEnvironment}->${toEnvironment}`;
    const attempts = this.accessAttempts.get(key) || [];
    
    attempts.push({
      timestamp: Date.now(),
      from: fromEnvironment,
      to: toEnvironment,
      process_id: process.pid
    });
    
    // Keep only last 24 hours of attempts
    const cutoff = Date.now() - (24 * 60 * 60 * 1000);
    const recentAttempts = attempts.filter(attempt => attempt.timestamp > cutoff);
    
    this.accessAttempts.set(key, recentAttempts);
  }

  /**
   * Get recent access attempts
   */
  getRecentAccessAttempts(fromEnvironment, toEnvironment, timeWindowMs = 3600000) {
    const key = `${fromEnvironment}->${toEnvironment}`;
    const attempts = this.accessAttempts.get(key) || [];
    const cutoff = Date.now() - timeWindowMs;
    
    return attempts.filter(attempt => attempt.timestamp > cutoff);
  }

  /**
   * Record isolation violation
   */
  recordIsolationViolation(validation) {
    const violation = {
      id: crypto.randomUUID(),
      timestamp: validation.timestamp,
      source_environment: validation.source_environment,
      target_environment: validation.target_environment,
      violations: validation.violations,
      process_info: this.getProcessInfo()
    };
    
    this.violationHistory.push(violation);
    
    // Keep only last 1000 violations
    if (this.violationHistory.length > 1000) {
      this.violationHistory = this.violationHistory.slice(-1000);
    }
    
    console.error(`🚨 Isolation violation recorded: ${violation.id}`);
  }

  /**
   * Cache validation result
   */
  cacheValidationResult(validationId, validation) {
    this.validationCache.set(validationId, {
      ...validation,
      cached_at: Date.now()
    });
    
    // Clean old cache entries (keep for 1 hour)
    const cutoff = Date.now() - 3600000;
    for (const [id, cached] of this.validationCache.entries()) {
      if (cached.cached_at < cutoff) {
        this.validationCache.delete(id);
      }
    }
  }

  /**
   * Record validation attempt
   */
  recordValidationAttempt(validation) {
    // Emit event for monitoring
    this.portManager.emit('isolationValidationPerformed', validation);
    
    // Log validation result
    if (validation.status === 'failed') {
      console.error(`❌ Environment isolation validation failed for ${validation.target_environment}:`);
      for (const violation of validation.violations) {
        console.error(`  - ${violation.type}: ${violation.message}`);
      }
    }
  }

  /**
   * Get isolation status report
   */
  getIsolationStatus() {
    return {
      timestamp: new Date().toISOString(),
      policies: this.policies,
      recent_violations: this.violationHistory.slice(-10),
      access_attempts: Object.fromEntries(this.accessAttempts),
      validation_cache_size: this.validationCache.size,
      security_tokens_active: this.securityTokens.size > 0
    };
  }

  /**
   * Reset isolation state
   */
  resetIsolationState() {
    this.violationHistory = [];
    this.accessAttempts.clear();
    this.validationCache.clear();
    
    console.log('🔒 Environment isolation state reset');
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.resetIsolationState();
    this.securityTokens.clear();
  }
}

export default EnvironmentIsolationValidator;
export { ISOLATION_POLICIES };
