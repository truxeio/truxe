/**
 * Truxe Validation Automation System
 * 
 * Comprehensive configuration validation and health checking automation system
 * that ensures system integrity, validates configurations, and provides
 * automated health monitoring with intelligent alerting.
 * 
 * @author DevOps Engineering Team
 * @version 4.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import EventEmitter from 'events';
import chalk from 'chalk';
import cron from 'node-cron';
import { ErrorSeverity, ErrorCategory } from './error-messaging-system.js';
import { ValidationError, ConfigurationError, ErrorFactory } from './structured-error-classes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Validation Rule Types
 */
export const ValidationRuleType = {
  REQUIRED: 'required',
  TYPE: 'type',
  RANGE: 'range',
  FORMAT: 'format',
  CUSTOM: 'custom',
  DEPENDENCY: 'dependency'
};

/**
 * Validation Severity Levels
 */
export const ValidationSeverity = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
};

/**
 * Health Check Types
 */
export const HealthCheckType = {
  CONFIGURATION: 'configuration',
  CONNECTIVITY: 'connectivity',
  RESOURCES: 'resources',
  SERVICES: 'services',
  SECURITY: 'security',
  PERFORMANCE: 'performance'
};

/**
 * Validation Rule Class
 */
export class ValidationRule {
  constructor(options = {}) {
    this.id = options.id || this.generateId();
    this.name = options.name || 'Unnamed Rule';
    this.description = options.description || '';
    this.type = options.type || ValidationRuleType.CUSTOM;
    this.severity = options.severity || ValidationSeverity.ERROR;
    this.field = options.field || null;
    this.validator = options.validator || (() => ({ valid: true }));
    this.fixer = options.fixer || null;
    this.dependencies = options.dependencies || [];
    this.metadata = options.metadata || {};
    this.enabled = options.enabled !== false;
  }

  generateId() {
    return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate a value against this rule
   */
  async validate(value, context = {}) {
    if (!this.enabled) {
      return { valid: true, skipped: true, reason: 'Rule disabled' };
    }

    try {
      // Check dependencies first
      for (const dep of this.dependencies) {
        const depResult = await this.checkDependency(dep, context);
        if (!depResult.satisfied) {
          return { 
            valid: false, 
            reason: `Dependency not satisfied: ${depResult.reason}`,
            dependency_failed: true
          };
        }
      }

      // Run the validator
      const result = await this.validator(value, context);
      
      return {
        valid: result.valid,
        reason: result.reason || (result.valid ? 'Validation passed' : 'Validation failed'),
        details: result.details || {},
        suggestions: result.suggestions || [],
        fixable: this.fixer !== null && result.fixable !== false
      };

    } catch (error) {
      return {
        valid: false,
        reason: `Validation error: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Check if a dependency is satisfied
   */
  async checkDependency(dependency, context) {
    try {
      if (typeof dependency === 'function') {
        return await dependency(context);
      } else if (dependency.type === 'file_exists') {
        await fs.access(dependency.path);
        return { satisfied: true };
      } else if (dependency.type === 'env_var') {
        const value = process.env[dependency.name];
        return { 
          satisfied: value !== undefined,
          reason: value ? 'Environment variable exists' : `Environment variable ${dependency.name} not set`
        };
      } else if (dependency.type === 'command') {
        execSync(dependency.command, { stdio: 'pipe', timeout: 5000 });
        return { satisfied: true };
      }
      
      return { satisfied: true };
    } catch (error) {
      return { satisfied: false, reason: error.message };
    }
  }

  /**
   * Attempt to fix a validation failure
   */
  async fix(value, context = {}, validationResult = {}) {
    if (!this.fixer) {
      return { fixed: false, reason: 'No fixer available for this rule' };
    }

    try {
      const fixResult = await this.fixer(value, context, validationResult);
      return {
        fixed: fixResult.fixed || false,
        newValue: fixResult.newValue,
        reason: fixResult.reason || 'Fix applied',
        actions: fixResult.actions || []
      };
    } catch (error) {
      return {
        fixed: false,
        reason: `Fix failed: ${error.message}`,
        error: error.message
      };
    }
  }
}

/**
 * Configuration Validator
 */
export class ConfigurationValidator extends EventEmitter {
  constructor() {
    super();
    this.rules = new Map();
    this.schemas = new Map();
    this.validationHistory = [];
    this.setupBuiltinRules();
    this.setupBuiltinSchemas();
  }

  /**
   * Setup built-in validation rules
   */
  setupBuiltinRules() {
    // Port validation rules
    this.addRule(new ValidationRule({
      id: 'port_range',
      name: 'Port Range Validation',
      description: 'Ensure ports are within valid ranges',
      type: ValidationRuleType.RANGE,
      severity: ValidationSeverity.ERROR,
      field: 'port',
      validator: async (port, context) => {
        const portNum = parseInt(port);
        
        if (isNaN(portNum)) {
          return { valid: false, reason: 'Port must be a number' };
        }
        
        if (portNum < 1 || portNum > 65535) {
          return { 
            valid: false, 
            reason: 'Port must be between 1 and 65535',
            suggestions: ['Use a port between 1024 and 65535 for non-privileged access']
          };
        }
        
        if (portNum < 1024 && process.getuid && process.getuid() !== 0) {
          return {
            valid: false,
            reason: 'Privileged ports (< 1024) require root access',
            suggestions: ['Use a port >= 1024', 'Run with sudo (not recommended)'],
            fixable: true
          };
        }
        
        return { valid: true };
      },
      fixer: async (port, context, validationResult) => {
        const portNum = parseInt(port);
        if (portNum < 1024) {
          return {
            fixed: true,
            newValue: portNum + 3000,
            reason: `Changed privileged port ${portNum} to ${portNum + 3000}`,
            actions: ['Updated port to non-privileged range']
          };
        }
        return { fixed: false, reason: 'No fix needed' };
      }
    }));

    this.addRule(new ValidationRule({
      id: 'port_reserved',
      name: 'Reserved Port Check',
      description: 'Check if port is reserved by system',
      type: ValidationRuleType.CUSTOM,
      severity: ValidationSeverity.WARNING,
      field: 'port',
      validator: async (port, context) => {
        const portNum = parseInt(port);
        const reservedPorts = [22, 25, 53, 80, 110, 143, 443, 993, 995];
        
        if (reservedPorts.includes(portNum)) {
          return {
            valid: false,
            reason: `Port ${portNum} is reserved for system services`,
            suggestions: [`Use port ${portNum + 3000} instead`],
            fixable: true
          };
        }
        
        return { valid: true };
      },
      fixer: async (port, context, validationResult) => {
        const portNum = parseInt(port);
        return {
          fixed: true,
          newValue: portNum + 3000,
          reason: `Changed reserved port ${portNum} to ${portNum + 3000}`,
          actions: ['Updated to non-reserved port']
        };
      }
    }));

    this.addRule(new ValidationRule({
      id: 'port_availability',
      name: 'Port Availability Check',
      description: 'Check if port is currently available',
      type: ValidationRuleType.CUSTOM,
      severity: ValidationSeverity.ERROR,
      field: 'port',
      validator: async (port, context) => {
        const portNum = parseInt(port);
        const isAvailable = await this.checkPortAvailable(portNum);
        
        if (!isAvailable) {
          return {
            valid: false,
            reason: `Port ${portNum} is already in use`,
            suggestions: [
              `Kill the process using port ${portNum}`,
              `Use port ${portNum + 1} instead`
            ],
            fixable: true
          };
        }
        
        return { valid: true };
      },
      fixer: async (port, context, validationResult) => {
        const portNum = parseInt(port);
        let alternativePort = portNum + 1;
        
        // Find next available port
        while (alternativePort <= 65535) {
          if (await this.checkPortAvailable(alternativePort)) {
            return {
              fixed: true,
              newValue: alternativePort,
              reason: `Changed to available port ${alternativePort}`,
              actions: [`Found alternative port ${alternativePort}`]
            };
          }
          alternativePort++;
        }
        
        return { fixed: false, reason: 'No alternative port found' };
      }
    }));

    // Environment validation rules
    this.addRule(new ValidationRule({
      id: 'env_required',
      name: 'Required Environment Variables',
      description: 'Check for required environment variables',
      type: ValidationRuleType.REQUIRED,
      severity: ValidationSeverity.ERROR,
      validator: async (envVars, context) => {
        const required = ['NODE_ENV', 'PORT'];
        const missing = [];
        
        for (const envVar of required) {
          if (!process.env[envVar]) {
            missing.push(envVar);
          }
        }
        
        if (missing.length > 0) {
          return {
            valid: false,
            reason: `Missing required environment variables: ${missing.join(', ')}`,
            suggestions: missing.map(v => `Set ${v} environment variable`),
            fixable: true
          };
        }
        
        return { valid: true };
      },
      fixer: async (envVars, context, validationResult) => {
        const defaults = {
          NODE_ENV: 'development',
          PORT: '3000'
        };
        
        const actions = [];
        for (const [key, value] of Object.entries(defaults)) {
          if (!process.env[key]) {
            process.env[key] = value;
            actions.push(`Set ${key}=${value}`);
          }
        }
        
        return {
          fixed: actions.length > 0,
          reason: `Set default values for missing environment variables`,
          actions
        };
      }
    }));

    // File validation rules
    this.addRule(new ValidationRule({
      id: 'config_files_exist',
      name: 'Configuration Files Exist',
      description: 'Check for required configuration files',
      type: ValidationRuleType.REQUIRED,
      severity: ValidationSeverity.ERROR,
      validator: async (files, context) => {
        const required = ['package.json'];
        const optional = ['config/ports.js', 'docker-compose.yml', '.env'];
        const missing = [];
        const missingOptional = [];
        
        for (const file of required) {
          try {
            await fs.access(file);
          } catch (error) {
            missing.push(file);
          }
        }
        
        for (const file of optional) {
          try {
            await fs.access(file);
          } catch (error) {
            missingOptional.push(file);
          }
        }
        
        if (missing.length > 0) {
          return {
            valid: false,
            reason: `Missing required files: ${missing.join(', ')}`,
            suggestions: missing.map(f => `Create ${f}`),
            details: { missing, missingOptional }
          };
        }
        
        if (missingOptional.length > 0) {
          return {
            valid: true,
            reason: 'All required files present',
            details: { missingOptional },
            suggestions: missingOptional.map(f => `Consider creating ${f}`)
          };
        }
        
        return { valid: true };
      }
    }));

    // JSON syntax validation
    this.addRule(new ValidationRule({
      id: 'json_syntax',
      name: 'JSON Syntax Validation',
      description: 'Validate JSON file syntax',
      type: ValidationRuleType.FORMAT,
      severity: ValidationSeverity.ERROR,
      validator: async (filePath, context) => {
        try {
          const content = await fs.readFile(filePath, 'utf8');
          JSON.parse(content);
          return { valid: true };
        } catch (error) {
          return {
            valid: false,
            reason: `JSON syntax error in ${filePath}: ${error.message}`,
            suggestions: [`Fix JSON syntax in ${filePath}`],
            fixable: false
          };
        }
      }
    }));
  }

  /**
   * Setup built-in validation schemas
   */
  setupBuiltinSchemas() {
    // Port configuration schema
    this.addSchema('port_config', {
      type: 'object',
      required: ['environments'],
      properties: {
        environments: {
          type: 'object',
          required: ['development'],
          properties: {
            development: {
              type: 'object',
              required: ['services', 'range'],
              properties: {
                services: {
                  type: 'object',
                  patternProperties: {
                    '^[a-zA-Z_][a-zA-Z0-9_]*$': {
                      type: 'integer',
                      minimum: 1,
                      maximum: 65535
                    }
                  }
                },
                range: {
                  type: 'object',
                  required: ['start', 'end'],
                  properties: {
                    start: { type: 'integer', minimum: 1 },
                    end: { type: 'integer', maximum: 65535 }
                  }
                }
              }
            }
          }
        }
      }
    });

    // Package.json schema
    this.addSchema('package_json', {
      type: 'object',
      required: ['name', 'version'],
      properties: {
        name: { type: 'string', minLength: 1 },
        version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+' },
        scripts: { type: 'object' },
        dependencies: { type: 'object' },
        devDependencies: { type: 'object' }
      }
    });
  }

  /**
   * Add a validation rule
   */
  addRule(rule) {
    this.rules.set(rule.id, rule);
    this.emit('rule_added', rule);
  }

  /**
   * Add a validation schema
   */
  addSchema(name, schema) {
    this.schemas.set(name, schema);
    this.emit('schema_added', { name, schema });
  }

  /**
   * Validate configuration
   */
  async validateConfiguration(config = {}, options = {}) {
    const {
      rules = Array.from(this.rules.keys()),
      stopOnError = false,
      autoFix = false,
      context = {}
    } = options;

    const validationResult = {
      timestamp: new Date().toISOString(),
      valid: true,
      rules_checked: 0,
      rules_passed: 0,
      rules_failed: 0,
      rules_skipped: 0,
      errors: [],
      warnings: [],
      fixes_applied: [],
      summary: {}
    };

    console.log(chalk.blue('🔍 Running configuration validation...'));

    for (const ruleId of rules) {
      const rule = this.rules.get(ruleId);
      if (!rule) {
        console.log(chalk.yellow(`   ⚠️  Rule not found: ${ruleId}`));
        continue;
      }

      validationResult.rules_checked++;

      try {
        console.log(chalk.gray(`   Checking: ${rule.name}`));
        
        // Get value to validate
        const value = this.getValueForRule(rule, config, context);
        
        // Run validation
        const result = await rule.validate(value, context);
        
        if (result.skipped) {
          validationResult.rules_skipped++;
          console.log(chalk.gray(`   ⏭️  Skipped: ${result.reason}`));
          continue;
        }

        if (result.valid) {
          validationResult.rules_passed++;
          console.log(chalk.green(`   ✅ ${rule.name}: Passed`));
        } else {
          validationResult.rules_failed++;
          validationResult.valid = false;
          
          const issue = {
            rule_id: rule.id,
            rule_name: rule.name,
            severity: rule.severity,
            field: rule.field,
            reason: result.reason,
            suggestions: result.suggestions || [],
            fixable: result.fixable || false,
            details: result.details || {}
          };

          if (rule.severity === ValidationSeverity.ERROR || rule.severity === ValidationSeverity.CRITICAL) {
            validationResult.errors.push(issue);
            console.log(chalk.red(`   ❌ ${rule.name}: ${result.reason}`));
          } else {
            validationResult.warnings.push(issue);
            console.log(chalk.yellow(`   ⚠️  ${rule.name}: ${result.reason}`));
          }

          // Show suggestions
          if (result.suggestions && result.suggestions.length > 0) {
            console.log(chalk.gray('      Suggestions:'));
            result.suggestions.forEach(suggestion => {
              console.log(chalk.gray(`        • ${suggestion}`));
            });
          }

          // Attempt auto-fix if enabled
          if (autoFix && result.fixable) {
            console.log(chalk.blue(`      🔧 Attempting to fix...`));
            
            const fixResult = await rule.fix(value, context, result);
            if (fixResult.fixed) {
              validationResult.fixes_applied.push({
                rule_id: rule.id,
                rule_name: rule.name,
                old_value: value,
                new_value: fixResult.newValue,
                reason: fixResult.reason,
                actions: fixResult.actions || []
              });
              
              console.log(chalk.green(`      ✅ Fixed: ${fixResult.reason}`));
              
              // Update config with fixed value
              this.setValueForRule(rule, config, fixResult.newValue);
            } else {
              console.log(chalk.red(`      ❌ Fix failed: ${fixResult.reason}`));
            }
          }

          // Stop on error if requested
          if (stopOnError && rule.severity === ValidationSeverity.ERROR) {
            console.log(chalk.red('   🛑 Stopping validation due to error'));
            break;
          }
        }
      } catch (error) {
        validationResult.rules_failed++;
        validationResult.valid = false;
        
        const issue = {
          rule_id: rule.id,
          rule_name: rule.name,
          severity: ValidationSeverity.CRITICAL,
          reason: `Validation failed: ${error.message}`,
          error: error.message
        };
        
        validationResult.errors.push(issue);
        console.log(chalk.red(`   💥 ${rule.name}: Validation error - ${error.message}`));
      }
    }

    // Generate summary
    validationResult.summary = {
      total_rules: validationResult.rules_checked,
      passed: validationResult.rules_passed,
      failed: validationResult.rules_failed,
      skipped: validationResult.rules_skipped,
      error_count: validationResult.errors.length,
      warning_count: validationResult.warnings.length,
      fixes_applied: validationResult.fixes_applied.length,
      success_rate: validationResult.rules_checked > 0 
        ? Math.round((validationResult.rules_passed / validationResult.rules_checked) * 100)
        : 0
    };

    // Store in history
    this.validationHistory.push({
      timestamp: validationResult.timestamp,
      valid: validationResult.valid,
      summary: validationResult.summary
    });

    // Keep only last 50 validations
    if (this.validationHistory.length > 50) {
      this.validationHistory = this.validationHistory.slice(-50);
    }

    // Emit completion event
    this.emit('validation_completed', validationResult);

    return validationResult;
  }

  /**
   * Get value for a validation rule
   */
  getValueForRule(rule, config, context) {
    if (rule.field) {
      // Navigate nested object path
      const path = rule.field.split('.');
      let value = config;
      
      for (const key of path) {
        value = value?.[key];
      }
      
      return value;
    }
    
    return config;
  }

  /**
   * Set value for a validation rule
   */
  setValueForRule(rule, config, newValue) {
    if (rule.field) {
      const path = rule.field.split('.');
      let current = config;
      
      // Navigate to parent object
      for (let i = 0; i < path.length - 1; i++) {
        if (!current[path[i]]) {
          current[path[i]] = {};
        }
        current = current[path[i]];
      }
      
      // Set the value
      current[path[path.length - 1]] = newValue;
    }
  }

  /**
   * Check if port is available
   */
  async checkPortAvailable(port) {
    return new Promise((resolve) => {
      const net = require('net');
      const server = net.createServer();
      
      server.listen(port, () => {
        server.close(() => resolve(true));
      });
      
      server.on('error', () => resolve(false));
    });
  }

  /**
   * Validate file against schema
   */
  async validateFileAgainstSchema(filePath, schemaName) {
    const schema = this.schemas.get(schemaName);
    if (!schema) {
      throw new Error(`Schema not found: ${schemaName}`);
    }

    try {
      const content = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(content);
      
      // Simple schema validation (in production, use a library like Ajv)
      const result = this.validateAgainstSchema(data, schema);
      
      return {
        valid: result.valid,
        errors: result.errors || [],
        filePath
      };
    } catch (error) {
      return {
        valid: false,
        errors: [`Failed to validate ${filePath}: ${error.message}`],
        filePath
      };
    }
  }

  /**
   * Simple schema validation
   */
  validateAgainstSchema(data, schema, path = '') {
    const errors = [];

    if (schema.type === 'object') {
      if (typeof data !== 'object' || data === null) {
        errors.push(`${path}: Expected object, got ${typeof data}`);
        return { valid: false, errors };
      }

      // Check required properties
      if (schema.required) {
        for (const prop of schema.required) {
          if (!(prop in data)) {
            errors.push(`${path}.${prop}: Required property missing`);
          }
        }
      }

      // Validate properties
      if (schema.properties) {
        for (const [prop, propSchema] of Object.entries(schema.properties)) {
          if (prop in data) {
            const result = this.validateAgainstSchema(
              data[prop], 
              propSchema, 
              path ? `${path}.${prop}` : prop
            );
            errors.push(...result.errors);
          }
        }
      }
    } else if (schema.type === 'string') {
      if (typeof data !== 'string') {
        errors.push(`${path}: Expected string, got ${typeof data}`);
      } else {
        if (schema.minLength && data.length < schema.minLength) {
          errors.push(`${path}: String too short (minimum ${schema.minLength})`);
        }
        if (schema.pattern && !new RegExp(schema.pattern).test(data)) {
          errors.push(`${path}: String does not match pattern ${schema.pattern}`);
        }
      }
    } else if (schema.type === 'integer') {
      if (!Number.isInteger(data)) {
        errors.push(`${path}: Expected integer, got ${typeof data}`);
      } else {
        if (schema.minimum !== undefined && data < schema.minimum) {
          errors.push(`${path}: Value ${data} is below minimum ${schema.minimum}`);
        }
        if (schema.maximum !== undefined && data > schema.maximum) {
          errors.push(`${path}: Value ${data} is above maximum ${schema.maximum}`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Get validation statistics
   */
  getValidationStatistics() {
    const stats = {
      total_validations: this.validationHistory.length,
      successful_validations: 0,
      total_rules: this.rules.size,
      total_schemas: this.schemas.size,
      recent_success_rate: 0,
      rule_performance: {}
    };

    // Calculate success rate
    stats.successful_validations = this.validationHistory.filter(v => v.valid).length;
    if (stats.total_validations > 0) {
      stats.recent_success_rate = Math.round(
        (stats.successful_validations / stats.total_validations) * 100
      );
    }

    // Rule performance (simplified)
    for (const [ruleId, rule] of this.rules) {
      stats.rule_performance[ruleId] = {
        name: rule.name,
        type: rule.type,
        severity: rule.severity,
        enabled: rule.enabled
      };
    }

    return stats;
  }
}

/**
 * Health Check Automation System
 */
export class HealthCheckAutomation extends EventEmitter {
  constructor() {
    super();
    this.healthChecks = new Map();
    this.schedules = new Map();
    this.alertThresholds = new Map();
    this.healthHistory = [];
    this.setupBuiltinHealthChecks();
  }

  /**
   * Setup built-in health checks
   */
  setupBuiltinHealthChecks() {
    // Configuration health check
    this.addHealthCheck({
      id: 'configuration_health',
      name: 'Configuration Health',
      type: HealthCheckType.CONFIGURATION,
      description: 'Validate system configuration files',
      interval: '*/15 * * * *', // Every 15 minutes
      check: async () => {
        const validator = new ConfigurationValidator();
        const result = await validator.validateConfiguration({}, {
          rules: ['port_range', 'env_required', 'config_files_exist']
        });
        
        return {
          healthy: result.valid,
          message: result.valid 
            ? 'Configuration is valid'
            : `${result.errors.length} configuration errors found`,
          details: {
            errors: result.errors.length,
            warnings: result.warnings.length,
            success_rate: result.summary.success_rate
          }
        };
      }
    });

    // Port availability health check
    this.addHealthCheck({
      id: 'port_availability',
      name: 'Port Availability',
      type: HealthCheckType.CONNECTIVITY,
      description: 'Check if required ports are available',
      interval: '*/5 * * * *', // Every 5 minutes
      check: async () => {
        const requiredPorts = [3000, 3001, 5432, 6379];
        const conflicts = [];
        
        for (const port of requiredPorts) {
          const available = await this.checkPortAvailable(port);
          if (!available) {
            conflicts.push(port);
          }
        }
        
        return {
          healthy: conflicts.length === 0,
          message: conflicts.length === 0
            ? 'All required ports are available'
            : `${conflicts.length} ports in use: ${conflicts.join(', ')}`,
          details: {
            total_ports: requiredPorts.length,
            available_ports: requiredPorts.length - conflicts.length,
            conflicted_ports: conflicts
          }
        };
      }
    });

    // System resources health check
    this.addHealthCheck({
      id: 'system_resources',
      name: 'System Resources',
      type: HealthCheckType.RESOURCES,
      description: 'Monitor system resource usage',
      interval: '*/10 * * * *', // Every 10 minutes
      check: async () => {
        const memUsage = process.memoryUsage();
        const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
        
        let healthy = true;
        let message = 'System resources are healthy';
        
        if (heapUsedPercent > 90) {
          healthy = false;
          message = `Critical memory usage: ${heapUsedPercent.toFixed(1)}%`;
        } else if (heapUsedPercent > 75) {
          message = `High memory usage: ${heapUsedPercent.toFixed(1)}%`;
        }
        
        return {
          healthy,
          message,
          details: {
            heap_used_percent: heapUsedPercent,
            heap_used_mb: Math.round(memUsage.heapUsed / 1024 / 1024),
            heap_total_mb: Math.round(memUsage.heapTotal / 1024 / 1024),
            external_mb: Math.round(memUsage.external / 1024 / 1024)
          }
        };
      }
    });

    // Service status health check
    this.addHealthCheck({
      id: 'service_status',
      name: 'Service Status',
      type: HealthCheckType.SERVICES,
      description: 'Check status of critical services',
      interval: '*/5 * * * *', // Every 5 minutes
      check: async () => {
        const services = ['docker', 'npm'];
        const serviceStatus = {};
        let healthyServices = 0;
        
        for (const service of services) {
          try {
            execSync(`${service} --version`, { stdio: 'pipe', timeout: 5000 });
            serviceStatus[service] = { available: true, status: 'running' };
            healthyServices++;
          } catch (error) {
            serviceStatus[service] = { available: false, error: error.message };
          }
        }
        
        return {
          healthy: healthyServices === services.length,
          message: `${healthyServices}/${services.length} services available`,
          details: {
            services: serviceStatus,
            healthy_count: healthyServices,
            total_count: services.length
          }
        };
      }
    });

    // Security health check
    this.addHealthCheck({
      id: 'security_status',
      name: 'Security Status',
      type: HealthCheckType.SECURITY,
      description: 'Check security-related configurations',
      interval: '0 */6 * * *', // Every 6 hours
      check: async () => {
        const securityIssues = [];
        
        // Check for default passwords/keys
        if (process.env.JWT_SECRET === 'default_secret') {
          securityIssues.push('Default JWT secret in use');
        }
        
        // Check for insecure configurations
        if (process.env.NODE_ENV === 'production' && process.env.DEBUG === 'true') {
          securityIssues.push('Debug mode enabled in production');
        }
        
        return {
          healthy: securityIssues.length === 0,
          message: securityIssues.length === 0
            ? 'No security issues detected'
            : `${securityIssues.length} security issues found`,
          details: {
            issues: securityIssues,
            issue_count: securityIssues.length
          }
        };
      }
    });
  }

  /**
   * Add a health check
   */
  addHealthCheck(healthCheck) {
    this.healthChecks.set(healthCheck.id, healthCheck);
    
    // Schedule the health check if interval is provided
    if (healthCheck.interval) {
      this.scheduleHealthCheck(healthCheck.id, healthCheck.interval);
    }
    
    this.emit('health_check_added', healthCheck);
  }

  /**
   * Schedule a health check
   */
  scheduleHealthCheck(healthCheckId, interval) {
    // Stop existing schedule if any
    if (this.schedules.has(healthCheckId)) {
      this.schedules.get(healthCheckId).stop();
    }

    // Create new schedule
    const task = cron.schedule(interval, async () => {
      await this.runHealthCheck(healthCheckId);
    }, {
      scheduled: false
    });

    this.schedules.set(healthCheckId, task);
    task.start();
    
    console.log(chalk.blue(`📅 Scheduled health check: ${healthCheckId} (${interval})`));
  }

  /**
   * Run a specific health check
   */
  async runHealthCheck(healthCheckId) {
    const healthCheck = this.healthChecks.get(healthCheckId);
    if (!healthCheck) {
      throw new Error(`Health check not found: ${healthCheckId}`);
    }

    const startTime = Date.now();
    const result = {
      id: healthCheckId,
      name: healthCheck.name,
      type: healthCheck.type,
      timestamp: new Date().toISOString(),
      healthy: false,
      message: '',
      details: {},
      execution_time: 0,
      error: null
    };

    try {
      console.log(chalk.gray(`🔍 Running health check: ${healthCheck.name}`));
      
      const checkResult = await healthCheck.check();
      
      result.healthy = checkResult.healthy;
      result.message = checkResult.message;
      result.details = checkResult.details || {};
      result.execution_time = Date.now() - startTime;

      // Log result
      const statusIcon = result.healthy ? '✅' : '❌';
      const statusColor = result.healthy ? chalk.green : chalk.red;
      console.log(`${statusIcon} ${healthCheck.name}: ${statusColor(result.message)}`);

      // Check alert thresholds
      await this.checkAlertThresholds(healthCheckId, result);

    } catch (error) {
      result.error = error.message;
      result.execution_time = Date.now() - startTime;
      
      console.log(chalk.red(`💥 Health check failed: ${healthCheck.name} - ${error.message}`));
    }

    // Store in history
    this.healthHistory.push(result);
    
    // Keep only last 1000 health check results
    if (this.healthHistory.length > 1000) {
      this.healthHistory = this.healthHistory.slice(-1000);
    }

    // Emit result
    this.emit('health_check_completed', result);

    return result;
  }

  /**
   * Run all health checks
   */
  async runAllHealthChecks() {
    console.log(chalk.bold.blue('\n🏥 Running comprehensive health checks...'));
    
    const results = [];
    for (const healthCheckId of this.healthChecks.keys()) {
      try {
        const result = await this.runHealthCheck(healthCheckId);
        results.push(result);
      } catch (error) {
        console.log(chalk.red(`Failed to run health check ${healthCheckId}: ${error.message}`));
      }
    }

    // Generate summary
    const summary = {
      timestamp: new Date().toISOString(),
      total_checks: results.length,
      healthy_checks: results.filter(r => r.healthy).length,
      unhealthy_checks: results.filter(r => !r.healthy && !r.error).length,
      failed_checks: results.filter(r => r.error).length,
      overall_health: 'healthy'
    };

    if (summary.failed_checks > 0 || summary.unhealthy_checks > summary.healthy_checks) {
      summary.overall_health = 'critical';
    } else if (summary.unhealthy_checks > 0) {
      summary.overall_health = 'warning';
    }

    console.log(chalk.bold('\n📊 Health Check Summary:'));
    console.log(`   Total Checks: ${summary.total_checks}`);
    console.log(`   Healthy: ${chalk.green(summary.healthy_checks)}`);
    console.log(`   Unhealthy: ${chalk.yellow(summary.unhealthy_checks)}`);
    console.log(`   Failed: ${chalk.red(summary.failed_checks)}`);
    
    const healthColor = {
      healthy: chalk.green,
      warning: chalk.yellow,
      critical: chalk.red
    }[summary.overall_health];
    
    console.log(`   Overall Health: ${healthColor(summary.overall_health.toUpperCase())}`);

    return { summary, results };
  }

  /**
   * Set alert threshold for a health check
   */
  setAlertThreshold(healthCheckId, threshold) {
    this.alertThresholds.set(healthCheckId, threshold);
  }

  /**
   * Check alert thresholds
   */
  async checkAlertThresholds(healthCheckId, result) {
    const threshold = this.alertThresholds.get(healthCheckId);
    if (!threshold) return;

    // Simple threshold checking (can be extended)
    if (!result.healthy && threshold.onUnhealthy) {
      await threshold.onUnhealthy(result);
    }
    
    if (result.execution_time > (threshold.maxExecutionTime || 30000)) {
      console.log(chalk.yellow(`⚠️  Health check ${healthCheckId} took ${result.execution_time}ms (threshold: ${threshold.maxExecutionTime}ms)`));
    }
  }

  /**
   * Check port availability
   */
  async checkPortAvailable(port) {
    return new Promise((resolve) => {
      const net = require('net');
      const server = net.createServer();
      
      server.listen(port, () => {
        server.close(() => resolve(true));
      });
      
      server.on('error', () => resolve(false));
    });
  }

  /**
   * Start all scheduled health checks
   */
  startAllSchedules() {
    for (const [healthCheckId, task] of this.schedules) {
      task.start();
      console.log(chalk.green(`▶️  Started health check schedule: ${healthCheckId}`));
    }
  }

  /**
   * Stop all scheduled health checks
   */
  stopAllSchedules() {
    for (const [healthCheckId, task] of this.schedules) {
      task.stop();
      console.log(chalk.yellow(`⏸️  Stopped health check schedule: ${healthCheckId}`));
    }
  }

  /**
   * Get health check statistics
   */
  getHealthStatistics() {
    const stats = {
      total_checks: this.healthChecks.size,
      total_executions: this.healthHistory.length,
      successful_executions: 0,
      failed_executions: 0,
      average_execution_time: 0,
      check_types: {},
      recent_health_trend: []
    };

    let totalExecutionTime = 0;
    
    for (const result of this.healthHistory) {
      if (result.healthy && !result.error) {
        stats.successful_executions++;
      } else {
        stats.failed_executions++;
      }
      
      totalExecutionTime += result.execution_time || 0;
      
      // Count by type
      stats.check_types[result.type] = (stats.check_types[result.type] || 0) + 1;
    }

    if (stats.total_executions > 0) {
      stats.average_execution_time = Math.round(totalExecutionTime / stats.total_executions);
      stats.success_rate = Math.round((stats.successful_executions / stats.total_executions) * 100);
    }

    // Recent trend (last 10 results)
    stats.recent_health_trend = this.healthHistory
      .slice(-10)
      .map(r => ({
        timestamp: r.timestamp,
        healthy: r.healthy,
        type: r.type
      }));

    return stats;
  }

  /**
   * Export health report
   */
  async exportHealthReport(format = 'json') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `health-report-${timestamp}.${format}`;
    const filepath = path.join(__dirname, '..', 'reports', filename);

    // Ensure reports directory exists
    await fs.mkdir(path.dirname(filepath), { recursive: true });

    const report = {
      generated_at: new Date().toISOString(),
      statistics: this.getHealthStatistics(),
      recent_results: this.healthHistory.slice(-50),
      configured_checks: Array.from(this.healthChecks.values()).map(check => ({
        id: check.id,
        name: check.name,
        type: check.type,
        description: check.description,
        interval: check.interval
      }))
    };

    if (format === 'json') {
      await fs.writeFile(filepath, JSON.stringify(report, null, 2));
    } else if (format === 'markdown') {
      const markdown = this.generateHealthMarkdownReport(report);
      await fs.writeFile(filepath, markdown);
    }

    return filepath;
  }

  /**
   * Generate markdown health report
   */
  generateHealthMarkdownReport(report) {
    return `
# System Health Report

**Generated:** ${report.generated_at}

## Statistics

- **Total Health Checks:** ${report.statistics.total_checks}
- **Total Executions:** ${report.statistics.total_executions}
- **Success Rate:** ${report.statistics.success_rate}%
- **Average Execution Time:** ${report.statistics.average_execution_time}ms

## Health Check Types

${Object.entries(report.statistics.check_types).map(([type, count]) => 
  `- **${type}:** ${count} executions`
).join('\n')}

## Configured Health Checks

${report.configured_checks.map(check => `
### ${check.name}

- **ID:** ${check.id}
- **Type:** ${check.type}
- **Description:** ${check.description}
- **Interval:** ${check.interval || 'Manual'}
`).join('')}

## Recent Results

${report.recent_results.slice(-10).map(result => `
### ${result.name} - ${result.timestamp}

- **Status:** ${result.healthy ? '✅ Healthy' : '❌ Unhealthy'}
- **Message:** ${result.message}
- **Execution Time:** ${result.execution_time}ms
${result.error ? `- **Error:** ${result.error}` : ''}
`).join('')}
`;
  }
}

// Export singleton instances
export const configurationValidator = new ConfigurationValidator();
export const healthCheckAutomation = new HealthCheckAutomation();

export {
  ValidationRule,
  ValidationRuleType,
  ValidationSeverity,
  HealthCheckType
};
