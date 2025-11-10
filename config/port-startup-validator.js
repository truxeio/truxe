/**
 * Truxe Pre-Startup Port Validation System
 * 
 * Comprehensive port validation that runs before service startup to prevent conflicts.
 * Provides detailed validation reports, automatic conflict resolution, and startup readiness checks.
 * 
 * @author DevOps Engineering Team
 * @version 3.0.0
 */

import { portConflictDetector } from './port-conflict-detector.js';
import portManager from './ports.js';
import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Validation Result Types
 */
export const ValidationResult = {
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
};

/**
 * Pre-Startup Port Validation System
 */
export class PortStartupValidator {
  constructor() {
    this.validationRules = new Map();
    this.validationHistory = [];
    this.setupDefaultRules();
  }

  /**
   * Setup default validation rules
   */
  setupDefaultRules() {
    // Port availability validation
    this.addRule('port_availability', {
      priority: 1,
      description: 'Check if required ports are available',
      validator: this.validatePortAvailability.bind(this),
      required: true,
      auto_fix: true
    });

    // Port range compliance validation
    this.addRule('range_compliance', {
      priority: 2,
      description: 'Validate ports are within environment ranges',
      validator: this.validateRangeCompliance.bind(this),
      required: true,
      auto_fix: false
    });

    // Reserved port validation
    this.addRule('reserved_ports', {
      priority: 3,
      description: 'Check for reserved port conflicts',
      validator: this.validateReservedPorts.bind(this),
      required: true,
      auto_fix: false
    });

    // Duplicate port validation
    this.addRule('duplicate_ports', {
      priority: 4,
      description: 'Check for duplicate port assignments',
      validator: this.validateDuplicatePorts.bind(this),
      required: true,
      auto_fix: false
    });

    // Service dependency validation
    this.addRule('service_dependencies', {
      priority: 5,
      description: 'Validate service port dependencies',
      validator: this.validateServiceDependencies.bind(this),
      required: true,
      auto_fix: false
    });

    // System resource validation
    this.addRule('system_resources', {
      priority: 6,
      description: 'Check system resource availability',
      validator: this.validateSystemResources.bind(this),
      required: false,
      auto_fix: false
    });

    // Docker compatibility validation
    this.addRule('docker_compatibility', {
      priority: 7,
      description: 'Validate Docker port mapping compatibility',
      validator: this.validateDockerCompatibility.bind(this),
      required: false,
      auto_fix: false
    });
  }

  /**
   * Add custom validation rule
   */
  addRule(name, rule) {
    this.validationRules.set(name, {
      name,
      ...rule,
      enabled: true
    });
  }

  /**
   * Remove validation rule
   */
  removeRule(name) {
    this.validationRules.delete(name);
  }

  /**
   * Enable/disable validation rule
   */
  toggleRule(name, enabled) {
    const rule = this.validationRules.get(name);
    if (rule) {
      rule.enabled = enabled;
    }
  }

  /**
   * Comprehensive pre-startup validation
   */
  async validateStartup(environment = 'development', options = {}) {
    const {
      autoFix = false,
      failFast = false,
      includeOptional = true,
      timeout = 30000
    } = options;

    const validationResult = {
      environment,
      timestamp: new Date().toISOString(),
      status: ValidationResult.SUCCESS,
      overall_ready: true,
      validation_time_ms: 0,
      rules_executed: 0,
      rules_passed: 0,
      rules_failed: 0,
      rules_warnings: 0,
      auto_fixes_applied: 0,
      results: [],
      summary: {
        critical_issues: 0,
        errors: 0,
        warnings: 0,
        suggestions: []
      },
      startup_readiness: {
        can_start: true,
        blocking_issues: [],
        recommended_actions: []
      }
    };

    const startTime = Date.now();

    try {
      // Get environment configuration
      const envConfig = portManager.getEnvironmentConfig(environment);
      const servicePorts = envConfig.services;

      // Sort rules by priority
      const sortedRules = Array.from(this.validationRules.values())
        .filter(rule => rule.enabled && (includeOptional || rule.required))
        .sort((a, b) => a.priority - b.priority);

      console.log(`🔍 Starting pre-startup validation for ${environment} environment...`);
      console.log(`📋 Executing ${sortedRules.length} validation rules`);

      for (const rule of sortedRules) {
        validationResult.rules_executed++;
        
        console.log(`   Validating: ${rule.description}`);

        try {
          const ruleResult = await Promise.race([
            rule.validator(servicePorts, environment, envConfig),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Validation timeout')), timeout / sortedRules.length)
            )
          ]);

          ruleResult.rule_name = rule.name;
          ruleResult.rule_description = rule.description;
          ruleResult.execution_time_ms = Date.now() - startTime;

          validationResult.results.push(ruleResult);

          // Process rule result
          if (ruleResult.status === ValidationResult.SUCCESS) {
            validationResult.rules_passed++;
          } else if (ruleResult.status === ValidationResult.WARNING) {
            validationResult.rules_warnings++;
            validationResult.summary.warnings++;
          } else if (ruleResult.status === ValidationResult.ERROR) {
            validationResult.rules_failed++;
            validationResult.summary.errors++;
            validationResult.overall_ready = false;
            
            if (ruleResult.blocking) {
              validationResult.startup_readiness.can_start = false;
              validationResult.startup_readiness.blocking_issues.push(ruleResult);
            }
          } else if (ruleResult.status === ValidationResult.CRITICAL) {
            validationResult.rules_failed++;
            validationResult.summary.critical_issues++;
            validationResult.overall_ready = false;
            validationResult.startup_readiness.can_start = false;
            validationResult.startup_readiness.blocking_issues.push(ruleResult);
          }

          // Apply auto-fixes if enabled and available
          if (autoFix && rule.auto_fix && ruleResult.auto_fix_available) {
            try {
              const fixResult = await this.applyAutoFix(ruleResult, environment);
              if (fixResult.success) {
                validationResult.auto_fixes_applied++;
                ruleResult.auto_fix_applied = true;
                ruleResult.auto_fix_result = fixResult;
              }
            } catch (fixError) {
              ruleResult.auto_fix_error = fixError.message;
            }
          }

          // Collect suggestions
          if (ruleResult.suggestions) {
            validationResult.summary.suggestions.push(...ruleResult.suggestions);
          }

          // Fail fast if critical error and option enabled
          if (failFast && ruleResult.status === ValidationResult.CRITICAL) {
            break;
          }

        } catch (error) {
          validationResult.rules_failed++;
          validationResult.results.push({
            rule_name: rule.name,
            rule_description: rule.description,
            status: ValidationResult.ERROR,
            message: `Rule execution failed: ${error.message}`,
            error: error.message,
            execution_time_ms: Date.now() - startTime
          });
        }
      }

      // Determine overall status
      if (validationResult.summary.critical_issues > 0) {
        validationResult.status = ValidationResult.CRITICAL;
      } else if (validationResult.summary.errors > 0) {
        validationResult.status = ValidationResult.ERROR;
      } else if (validationResult.summary.warnings > 0) {
        validationResult.status = ValidationResult.WARNING;
      }

      validationResult.validation_time_ms = Date.now() - startTime;

      // Generate final recommendations
      this.generateStartupRecommendations(validationResult);

      // Add to validation history
      this.validationHistory.push({
        timestamp: validationResult.timestamp,
        environment,
        status: validationResult.status,
        ready: validationResult.startup_readiness.can_start,
        issues: validationResult.summary.critical_issues + validationResult.summary.errors
      });

      return validationResult;

    } catch (error) {
      validationResult.status = ValidationResult.CRITICAL;
      validationResult.overall_ready = false;
      validationResult.startup_readiness.can_start = false;
      validationResult.error = error.message;
      validationResult.validation_time_ms = Date.now() - startTime;

      return validationResult;
    }
  }

  /**
   * Validate port availability
   */
  async validatePortAvailability(servicePorts, environment, envConfig) {
    const ports = Object.values(servicePorts);
    const conflictResults = await portConflictDetector.detectPortConflicts(ports, {
      methods: portConflictDetector.getDefaultMethods(),
      includeProcessDetails: true
    });

    const conflicts = [];
    const suggestions = [];

    for (const [port, result] of Object.entries(conflictResults.ports)) {
      if (!result.available) {
        conflicts.push({
          port: parseInt(port),
          service: Object.keys(servicePorts).find(key => servicePorts[key] === parseInt(port)),
          processes: result.processes,
          containers: result.containers,
          resolution_suggestions: result.resolution_suggestions
        });

        // Add resolution suggestions
        suggestions.push(...result.resolution_suggestions.map(suggestion => ({
          ...suggestion,
          port: parseInt(port),
          service: Object.keys(servicePorts).find(key => servicePorts[key] === parseInt(port))
        })));
      }
    }

    return {
      status: conflicts.length === 0 ? ValidationResult.SUCCESS : ValidationResult.ERROR,
      message: conflicts.length === 0 
        ? 'All required ports are available'
        : `${conflicts.length} port conflicts detected`,
      blocking: conflicts.length > 0,
      auto_fix_available: conflicts.some(c => c.resolution_suggestions.some(s => s.type === 'kill_process')),
      details: {
        total_ports_checked: ports.length,
        conflicts_found: conflicts.length,
        conflicts: conflicts
      },
      suggestions: suggestions
    };
  }

  /**
   * Validate port range compliance
   */
  async validateRangeCompliance(servicePorts, environment, envConfig) {
    const violations = [];

    for (const [service, port] of Object.entries(servicePorts)) {
      if (environment !== 'production') { // Production has flexible port ranges
        if (port < envConfig.range.start || port > envConfig.range.end) {
          violations.push({
            service,
            port,
            expected_range: envConfig.range,
            violation_type: port < envConfig.range.start ? 'below_range' : 'above_range'
          });
        }
      }
    }

    return {
      status: violations.length === 0 ? ValidationResult.SUCCESS : ValidationResult.ERROR,
      message: violations.length === 0 
        ? 'All ports are within valid ranges'
        : `${violations.length} ports are outside valid ranges`,
      blocking: violations.length > 0,
      auto_fix_available: false,
      details: {
        environment_range: envConfig.range,
        violations: violations
      },
      suggestions: violations.map(v => ({
        type: 'reconfigure_port',
        description: `Move ${v.service} port ${v.port} to range ${envConfig.range.start}-${envConfig.range.end}`,
        priority: 'high'
      }))
    };
  }

  /**
   * Validate reserved ports
   */
  async validateReservedPorts(servicePorts, environment, envConfig) {
    const violations = [];
    const reservedRanges = portManager.config.conflict_detection.reserved_ranges;

    for (const [service, port] of Object.entries(servicePorts)) {
      for (const range of reservedRanges) {
        if (port >= range.start && port <= range.end) {
          violations.push({
            service,
            port,
            reserved_range: range,
            description: range.description
          });
        }
      }
    }

    return {
      status: violations.length === 0 ? ValidationResult.SUCCESS : ValidationResult.WARNING,
      message: violations.length === 0 
        ? 'No reserved port conflicts detected'
        : `${violations.length} services using reserved ports`,
      blocking: false, // Usually warnings unless critical system ports
      auto_fix_available: false,
      details: {
        violations: violations
      },
      suggestions: violations.map(v => ({
        type: 'avoid_reserved_port',
        description: `Consider moving ${v.service} from reserved port ${v.port} (${v.description})`,
        priority: 'medium'
      }))
    };
  }

  /**
   * Validate duplicate ports
   */
  async validateDuplicatePorts(servicePorts, environment, envConfig) {
    const portUsage = {};
    const duplicates = [];

    for (const [service, port] of Object.entries(servicePorts)) {
      if (portUsage[port]) {
        portUsage[port].push(service);
      } else {
        portUsage[port] = [service];
      }
    }

    for (const [port, services] of Object.entries(portUsage)) {
      if (services.length > 1) {
        duplicates.push({
          port: parseInt(port),
          services: services,
          conflict_count: services.length
        });
      }
    }

    return {
      status: duplicates.length === 0 ? ValidationResult.SUCCESS : ValidationResult.CRITICAL,
      message: duplicates.length === 0 
        ? 'No duplicate port assignments detected'
        : `${duplicates.length} duplicate port assignments found`,
      blocking: duplicates.length > 0,
      auto_fix_available: false,
      details: {
        duplicates: duplicates
      },
      suggestions: duplicates.map(d => ({
        type: 'resolve_duplicate',
        description: `Assign unique ports to services: ${d.services.join(', ')} (currently all using port ${d.port})`,
        priority: 'critical'
      }))
    };
  }

  /**
   * Validate service dependencies
   */
  async validateServiceDependencies(servicePorts, environment, envConfig) {
    const requiredServices = ['api', 'database', 'redis'];
    const missingServices = [];
    const dependencyIssues = [];

    // Check for required services
    for (const service of requiredServices) {
      if (!servicePorts[service]) {
        missingServices.push(service);
      }
    }

    // Check service-specific dependencies
    if (servicePorts.api && !servicePorts.database) {
      dependencyIssues.push({
        service: 'api',
        dependency: 'database',
        issue: 'API service requires database service'
      });
    }

    if (servicePorts.api && !servicePorts.redis) {
      dependencyIssues.push({
        service: 'api',
        dependency: 'redis',
        issue: 'API service requires Redis for session management'
      });
    }

    const totalIssues = missingServices.length + dependencyIssues.length;

    return {
      status: totalIssues === 0 ? ValidationResult.SUCCESS : ValidationResult.ERROR,
      message: totalIssues === 0 
        ? 'All service dependencies are satisfied'
        : `${totalIssues} service dependency issues detected`,
      blocking: missingServices.length > 0,
      auto_fix_available: false,
      details: {
        missing_services: missingServices,
        dependency_issues: dependencyIssues
      },
      suggestions: [
        ...missingServices.map(service => ({
          type: 'add_service',
          description: `Add required service: ${service}`,
          priority: 'critical'
        })),
        ...dependencyIssues.map(issue => ({
          type: 'resolve_dependency',
          description: issue.issue,
          priority: 'high'
        }))
      ]
    };
  }

  /**
   * Validate system resources
   */
  async validateSystemResources(servicePorts, environment, envConfig) {
    const warnings = [];
    const info = [];

    try {
      // Check available memory
      const totalMemory = require('os').totalmem();
      const freeMemory = require('os').freemem();
      const memoryUsage = ((totalMemory - freeMemory) / totalMemory) * 100;

      if (memoryUsage > 90) {
        warnings.push({
          type: 'memory',
          message: `High memory usage: ${memoryUsage.toFixed(1)}%`,
          recommendation: 'Consider freeing memory before starting services'
        });
      }

      info.push({
        type: 'memory',
        total_gb: (totalMemory / 1024 / 1024 / 1024).toFixed(2),
        free_gb: (freeMemory / 1024 / 1024 / 1024).toFixed(2),
        usage_percent: memoryUsage.toFixed(1)
      });

      // Check CPU load (Unix-like systems)
      if (process.platform !== 'win32') {
        try {
          const loadavg = require('os').loadavg();
          const cpuCount = require('os').cpus().length;
          const loadPercent = (loadavg[0] / cpuCount) * 100;

          if (loadPercent > 80) {
            warnings.push({
              type: 'cpu',
              message: `High CPU load: ${loadPercent.toFixed(1)}%`,
              recommendation: 'Consider reducing system load before starting services'
            });
          }

          info.push({
            type: 'cpu',
            cores: cpuCount,
            load_1min: loadavg[0].toFixed(2),
            load_percent: loadPercent.toFixed(1)
          });
        } catch (error) {
          // CPU load check failed
        }
      }

      // Check disk space
      try {
        const stats = await fs.stat(process.cwd());
        // Note: This is a simplified check. In production, you'd want to check actual disk usage
        info.push({
          type: 'disk',
          working_directory: process.cwd(),
          accessible: true
        });
      } catch (error) {
        warnings.push({
          type: 'disk',
          message: 'Cannot access working directory',
          recommendation: 'Check file system permissions'
        });
      }

    } catch (error) {
      warnings.push({
        type: 'system_check',
        message: `System resource check failed: ${error.message}`,
        recommendation: 'Manual system check recommended'
      });
    }

    return {
      status: warnings.length === 0 ? ValidationResult.SUCCESS : ValidationResult.WARNING,
      message: warnings.length === 0 
        ? 'System resources are adequate'
        : `${warnings.length} system resource warnings`,
      blocking: false,
      auto_fix_available: false,
      details: {
        warnings: warnings,
        system_info: info
      },
      suggestions: warnings.map(w => ({
        type: 'system_optimization',
        description: w.recommendation,
        priority: 'low'
      }))
    };
  }

  /**
   * Validate Docker compatibility
   */
  async validateDockerCompatibility(servicePorts, environment, envConfig) {
    const issues = [];
    const info = [];

    try {
      // Check if Docker is available
      execSync('docker --version', { stdio: 'ignore', timeout: 5000 });
      info.push({ docker_available: true });

      // Check if Docker daemon is running
      try {
        execSync('docker info', { stdio: 'ignore', timeout: 5000 });
        info.push({ docker_daemon_running: true });

        // Check for existing containers using our ports
        const portMappings = portManager.generateDockerComposePorts(environment);
        const conflictingContainers = [];

        for (const [service, portConfig] of Object.entries(portMappings)) {
          try {
            const result = execSync(`docker ps --format "table {{.Names}}\\t{{.Ports}}" | grep :${portConfig.external}`, {
              encoding: 'utf8',
              timeout: 3000
            });

            if (result.trim()) {
              conflictingContainers.push({
                service,
                port: portConfig.external,
                containers: result.trim().split('\n')
              });
            }
          } catch (error) {
            // No containers found for this port (expected)
          }
        }

        if (conflictingContainers.length > 0) {
          issues.push({
            type: 'docker_port_conflict',
            message: `${conflictingContainers.length} Docker containers using required ports`,
            containers: conflictingContainers
          });
        }

      } catch (error) {
        issues.push({
          type: 'docker_daemon',
          message: 'Docker daemon is not running',
          recommendation: 'Start Docker daemon before running services'
        });
      }

    } catch (error) {
      issues.push({
        type: 'docker_unavailable',
        message: 'Docker is not installed or not in PATH',
        recommendation: 'Install Docker if containerized deployment is required'
      });
    }

    return {
      status: issues.length === 0 ? ValidationResult.SUCCESS : ValidationResult.WARNING,
      message: issues.length === 0 
        ? 'Docker compatibility validated'
        : `${issues.length} Docker compatibility issues`,
      blocking: false,
      auto_fix_available: false,
      details: {
        issues: issues,
        docker_info: info
      },
      suggestions: issues.map(issue => ({
        type: 'docker_setup',
        description: issue.recommendation || `Resolve: ${issue.message}`,
        priority: 'medium'
      }))
    };
  }

  /**
   * Apply automatic fixes
   */
  async applyAutoFix(ruleResult, environment) {
    if (ruleResult.rule_name === 'port_availability') {
      // Auto-fix port conflicts by killing safe processes
      const fixResults = [];

      for (const conflict of ruleResult.details.conflicts) {
        for (const suggestion of conflict.resolution_suggestions) {
          if (suggestion.type === 'kill_process' && suggestion.risk_level === 'low') {
            try {
              execSync(suggestion.commands.graceful, { timeout: 5000 });
              
              // Wait a moment and check if process is gone
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              const stillRunning = await suggestion.process_info.isRunning();
              if (!stillRunning) {
                fixResults.push({
                  action: 'killed_process',
                  pid: suggestion.process_info.pid,
                  name: suggestion.process_info.name,
                  success: true
                });
              } else {
                // Try force kill
                execSync(suggestion.commands.force, { timeout: 5000 });
                fixResults.push({
                  action: 'force_killed_process',
                  pid: suggestion.process_info.pid,
                  name: suggestion.process_info.name,
                  success: true
                });
              }
            } catch (error) {
              fixResults.push({
                action: 'kill_process_failed',
                pid: suggestion.process_info.pid,
                name: suggestion.process_info.name,
                success: false,
                error: error.message
              });
            }
          }
        }
      }

      return {
        success: fixResults.some(r => r.success),
        actions: fixResults
      };
    }

    return { success: false, message: 'No auto-fix available for this rule' };
  }

  /**
   * Generate startup recommendations
   */
  generateStartupRecommendations(validationResult) {
    const recommendations = [];

    // Critical issues
    if (validationResult.summary.critical_issues > 0) {
      recommendations.push({
        priority: 'critical',
        action: 'DO NOT START',
        message: 'Critical issues must be resolved before startup',
        details: validationResult.startup_readiness.blocking_issues
          .filter(issue => issue.status === ValidationResult.CRITICAL)
      });
    }

    // Blocking errors
    const blockingErrors = validationResult.startup_readiness.blocking_issues
      .filter(issue => issue.status === ValidationResult.ERROR);
    
    if (blockingErrors.length > 0) {
      recommendations.push({
        priority: 'high',
        action: 'RESOLVE CONFLICTS',
        message: 'Port conflicts must be resolved before startup',
        details: blockingErrors
      });
    }

    // Warnings
    if (validationResult.summary.warnings > 0) {
      recommendations.push({
        priority: 'medium',
        action: 'REVIEW WARNINGS',
        message: 'Consider addressing warnings for optimal performance',
        details: validationResult.results.filter(r => r.status === ValidationResult.WARNING)
      });
    }

    // Success with suggestions
    if (validationResult.status === ValidationResult.SUCCESS && validationResult.summary.suggestions.length > 0) {
      recommendations.push({
        priority: 'low',
        action: 'OPTIMIZE',
        message: 'System is ready, consider optimization suggestions',
        details: validationResult.summary.suggestions
      });
    }

    validationResult.startup_readiness.recommended_actions = recommendations;
  }

  /**
   * Get validation history
   */
  getValidationHistory() {
    return this.validationHistory;
  }

  /**
   * Export validation report
   */
  async exportValidationReport(validationResult, format = 'json') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `startup-validation-${validationResult.environment}-${timestamp}.${format}`;
    const filepath = path.join(__dirname, '..', 'reports', filename);

    // Ensure reports directory exists
    await fs.mkdir(path.dirname(filepath), { recursive: true });

    if (format === 'json') {
      await fs.writeFile(filepath, JSON.stringify(validationResult, null, 2));
    } else if (format === 'html') {
      const html = this.generateHTMLReport(validationResult);
      await fs.writeFile(filepath, html);
    }

    return filepath;
  }

  /**
   * Generate HTML report
   */
  generateHTMLReport(validationResult) {
    const statusColor = {
      [ValidationResult.SUCCESS]: '#28a745',
      [ValidationResult.WARNING]: '#ffc107',
      [ValidationResult.ERROR]: '#dc3545',
      [ValidationResult.CRITICAL]: '#6f42c1'
    };

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Truxe Startup Validation Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 5px; }
        .status { display: inline-block; padding: 5px 10px; border-radius: 3px; color: white; }
        .success { background: ${statusColor[ValidationResult.SUCCESS]}; }
        .warning { background: ${statusColor[ValidationResult.WARNING]}; }
        .error { background: ${statusColor[ValidationResult.ERROR]}; }
        .critical { background: ${statusColor[ValidationResult.CRITICAL]}; }
        .rule-result { margin: 10px 0; padding: 15px; border-left: 4px solid #ddd; }
        .suggestions { background: #f8f9fa; padding: 10px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Truxe Startup Validation Report</h1>
        <p><strong>Environment:</strong> ${validationResult.environment}</p>
        <p><strong>Timestamp:</strong> ${validationResult.timestamp}</p>
        <p><strong>Status:</strong> <span class="status ${validationResult.status}">${validationResult.status.toUpperCase()}</span></p>
        <p><strong>Ready for Startup:</strong> ${validationResult.startup_readiness.can_start ? '✅ YES' : '❌ NO'}</p>
    </div>

    <h2>Summary</h2>
    <ul>
        <li>Rules Executed: ${validationResult.rules_executed}</li>
        <li>Passed: ${validationResult.rules_passed}</li>
        <li>Warnings: ${validationResult.rules_warnings}</li>
        <li>Failed: ${validationResult.rules_failed}</li>
        <li>Validation Time: ${validationResult.validation_time_ms}ms</li>
    </ul>

    <h2>Validation Results</h2>
    ${validationResult.results.map(result => `
        <div class="rule-result">
            <h3>${result.rule_description}</h3>
            <p><strong>Status:</strong> <span class="status ${result.status}">${result.status.toUpperCase()}</span></p>
            <p><strong>Message:</strong> ${result.message}</p>
            ${result.suggestions ? `
                <div class="suggestions">
                    <h4>Suggestions:</h4>
                    <ul>
                        ${result.suggestions.map(s => `<li>${s.description}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
        </div>
    `).join('')}

    <h2>Startup Readiness</h2>
    ${validationResult.startup_readiness.recommended_actions.map(action => `
        <div class="rule-result">
            <h3>${action.action}</h3>
            <p><strong>Priority:</strong> ${action.priority}</p>
            <p>${action.message}</p>
        </div>
    `).join('')}
</body>
</html>
    `;
  }
}

// Export singleton instance
export const portStartupValidator = new PortStartupValidator();
export default portStartupValidator;
