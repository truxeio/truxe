/**
 * Truxe Automated Troubleshooting Engine
 * 
 * Advanced automated troubleshooting system that provides intelligent fix suggestions,
 * automated problem resolution, and comprehensive system health monitoring for
 * port-related issues and general system problems.
 * 
 * @author DevOps Engineering Team
 * @version 4.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import EventEmitter from 'events';
import chalk from 'chalk';
import { ErrorSeverity, ErrorCategory, ResolutionActionType } from './error-messaging-system.js';
import { ResolutionPlan, ResolutionStep, ExecutionMode } from './resolution-guidance-system.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Troubleshooting Strategy Types
 */
export const TroubleshootingStrategy = {
  CONSERVATIVE: 'conservative',    // Safe, non-destructive actions only
  BALANCED: 'balanced',           // Mix of safe and medium-risk actions
  AGGRESSIVE: 'aggressive',       // All available actions including high-risk
  DIAGNOSTIC_ONLY: 'diagnostic_only' // Information gathering only
};

/**
 * Fix Confidence Levels
 */
export const FixConfidence = {
  VERY_LOW: 0.1,
  LOW: 0.3,
  MEDIUM: 0.5,
  HIGH: 0.7,
  VERY_HIGH: 0.9
};

/**
 * System Health Status
 */
export const HealthStatus = {
  HEALTHY: 'healthy',
  WARNING: 'warning',
  CRITICAL: 'critical',
  UNKNOWN: 'unknown'
};

/**
 * Automated Fix Class
 */
export class AutomatedFix {
  constructor(options = {}) {
    this.id = options.id || this.generateId();
    this.title = options.title || 'Automated Fix';
    this.description = options.description || '';
    this.category = options.category || ErrorCategory.RUNTIME;
    this.confidence = options.confidence || FixConfidence.MEDIUM;
    this.riskLevel = options.riskLevel || 'medium';
    this.estimatedTime = options.estimatedTime || '1 minute';
    this.prerequisites = options.prerequisites || [];
    this.actions = options.actions || [];
    this.validation = options.validation || null;
    this.rollback = options.rollback || null;
    this.metadata = options.metadata || {};
    this.applied = false;
    this.result = null;
  }

  generateId() {
    return `fix_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Apply the automated fix
   */
  async apply(context = {}, dryRun = false) {
    if (this.applied && !dryRun) {
      throw new Error('Fix has already been applied');
    }

    const startTime = Date.now();
    const result = {
      fixId: this.id,
      success: false,
      dryRun,
      startTime: new Date().toISOString(),
      actions: [],
      validationResult: null,
      executionTime: null,
      error: null
    };

    try {
      // Check prerequisites
      for (const prereq of this.prerequisites) {
        const prereqResult = await this.checkPrerequisite(prereq, context);
        if (!prereqResult.success) {
          throw new Error(`Prerequisite failed: ${prereqResult.message}`);
        }
      }

      // Execute actions
      for (const action of this.actions) {
        const actionResult = await this.executeAction(action, context, dryRun);
        result.actions.push(actionResult);
        
        if (!actionResult.success && !action.optional) {
          throw new Error(`Action failed: ${actionResult.error}`);
        }
      }

      // Validate fix if not dry run
      if (!dryRun && this.validation) {
        result.validationResult = await this.validation(result, context);
        if (!result.validationResult.success) {
          throw new Error(`Fix validation failed: ${result.validationResult.message}`);
        }
      }

      result.success = true;
      if (!dryRun) {
        this.applied = true;
      }

    } catch (error) {
      result.error = error.message;
      result.success = false;
    }

    result.executionTime = Date.now() - startTime;
    this.result = result;
    return result;
  }

  /**
   * Check prerequisite
   */
  async checkPrerequisite(prereq, context) {
    try {
      if (typeof prereq === 'function') {
        return await prereq(context);
      } else if (prereq.type === 'command') {
        execSync(prereq.command, { stdio: 'pipe', timeout: 5000 });
        return { success: true };
      } else if (prereq.type === 'file_exists') {
        await fs.access(prereq.path);
        return { success: true };
      } else if (prereq.type === 'port_available') {
        const isAvailable = await this.checkPortAvailable(prereq.port);
        return { 
          success: isAvailable, 
          message: isAvailable ? 'Port is available' : `Port ${prereq.port} is in use`
        };
      }
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Execute action
   */
  async executeAction(action, context, dryRun) {
    const actionResult = {
      type: action.type,
      description: action.description,
      success: false,
      dryRun,
      output: null,
      error: null
    };

    if (dryRun) {
      actionResult.success = true;
      actionResult.output = 'Dry run - action would be executed';
      return actionResult;
    }

    try {
      switch (action.type) {
        case 'command':
          actionResult.output = execSync(action.command, {
            encoding: 'utf8',
            timeout: action.timeout || 30000
          });
          actionResult.success = true;
          break;

        case 'file_operation':
          await this.executeFileOperation(action, context);
          actionResult.success = true;
          actionResult.output = 'File operation completed';
          break;

        case 'service_operation':
          await this.executeServiceOperation(action, context);
          actionResult.success = true;
          actionResult.output = 'Service operation completed';
          break;

        case 'environment_change':
          await this.executeEnvironmentChange(action, context);
          actionResult.success = true;
          actionResult.output = 'Environment change completed';
          break;

        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }
    } catch (error) {
      actionResult.error = error.message;
    }

    return actionResult;
  }

  /**
   * Execute file operation
   */
  async executeFileOperation(action, context) {
    switch (action.operation) {
      case 'create':
        await fs.writeFile(action.path, action.content || '');
        break;
      case 'delete':
        await fs.unlink(action.path);
        break;
      case 'copy':
        await fs.copyFile(action.source, action.destination);
        break;
      case 'move':
        await fs.rename(action.source, action.destination);
        break;
      case 'backup':
        const backupPath = `${action.path}.backup.${Date.now()}`;
        await fs.copyFile(action.path, backupPath);
        break;
      default:
        throw new Error(`Unknown file operation: ${action.operation}`);
    }
  }

  /**
   * Execute service operation
   */
  async executeServiceOperation(action, context) {
    const commands = {
      start: `systemctl start ${action.service}`,
      stop: `systemctl stop ${action.service}`,
      restart: `systemctl restart ${action.service}`,
      reload: `systemctl reload ${action.service}`,
      enable: `systemctl enable ${action.service}`,
      disable: `systemctl disable ${action.service}`
    };

    const command = commands[action.operation];
    if (!command) {
      throw new Error(`Unknown service operation: ${action.operation}`);
    }

    execSync(command, { timeout: 30000 });
  }

  /**
   * Execute environment change
   */
  async executeEnvironmentChange(action, context) {
    if (action.operation === 'set_env_var') {
      process.env[action.variable] = action.value;
    } else if (action.operation === 'update_env_file') {
      const envPath = action.path || '.env';
      let envContent = '';
      
      try {
        envContent = await fs.readFile(envPath, 'utf8');
      } catch (error) {
        // File doesn't exist, create new
      }

      const lines = envContent.split('\n');
      const existingIndex = lines.findIndex(line => line.startsWith(`${action.variable}=`));
      
      if (existingIndex >= 0) {
        lines[existingIndex] = `${action.variable}=${action.value}`;
      } else {
        lines.push(`${action.variable}=${action.value}`);
      }

      await fs.writeFile(envPath, lines.join('\n'));
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
   * Rollback the fix
   */
  async rollback(context = {}) {
    if (!this.applied) {
      return { success: false, message: 'Fix was not applied' };
    }

    if (!this.rollback) {
      return { success: false, message: 'No rollback procedure defined' };
    }

    try {
      const rollbackResult = await this.rollback(this.result, context);
      if (rollbackResult.success) {
        this.applied = false;
      }
      return rollbackResult;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

/**
 * System Health Monitor
 */
export class SystemHealthMonitor {
  constructor() {
    this.healthChecks = new Map();
    this.lastHealthCheck = null;
    this.healthHistory = [];
    this.setupHealthChecks();
  }

  /**
   * Setup health check functions
   */
  setupHealthChecks() {
    // Port availability check
    this.healthChecks.set('port_availability', async () => {
      const commonPorts = [3000, 3001, 8000, 8080, 5000];
      const conflicts = [];
      
      for (const port of commonPorts) {
        const isAvailable = await this.checkPortAvailable(port);
        if (!isAvailable) {
          conflicts.push(port);
        }
      }

      return {
        status: conflicts.length === 0 ? HealthStatus.HEALTHY : HealthStatus.WARNING,
        message: conflicts.length === 0 
          ? 'All common ports are available'
          : `Ports in use: ${conflicts.join(', ')}`,
        data: { conflicts, total_checked: commonPorts.length }
      };
    });

    // System resources check
    this.healthChecks.set('system_resources', async () => {
      try {
        const memInfo = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        // Check memory usage (warning if > 80% of heap limit)
        const heapUsedPercent = (memInfo.heapUsed / memInfo.heapTotal) * 100;
        
        let status = HealthStatus.HEALTHY;
        let message = 'System resources are healthy';
        
        if (heapUsedPercent > 80) {
          status = HealthStatus.CRITICAL;
          message = `High memory usage: ${heapUsedPercent.toFixed(1)}%`;
        } else if (heapUsedPercent > 60) {
          status = HealthStatus.WARNING;
          message = `Moderate memory usage: ${heapUsedPercent.toFixed(1)}%`;
        }

        return {
          status,
          message,
          data: {
            memory: memInfo,
            cpu: cpuUsage,
            heap_used_percent: heapUsedPercent
          }
        };
      } catch (error) {
        return {
          status: HealthStatus.UNKNOWN,
          message: `Failed to check system resources: ${error.message}`,
          data: { error: error.message }
        };
      }
    });

    // File system check
    this.healthChecks.set('file_system', async () => {
      try {
        const checks = [
          { path: 'package.json', required: true },
          { path: 'config/ports.js', required: false },
          { path: 'docker-compose.yml', required: false },
          { path: '.env', required: false }
        ];

        const results = [];
        let criticalMissing = 0;

        for (const check of checks) {
          try {
            await fs.access(check.path);
            results.push({ path: check.path, exists: true, required: check.required });
          } catch (error) {
            results.push({ path: check.path, exists: false, required: check.required });
            if (check.required) {
              criticalMissing++;
            }
          }
        }

        const status = criticalMissing > 0 ? HealthStatus.CRITICAL : HealthStatus.HEALTHY;
        const message = criticalMissing > 0 
          ? `${criticalMissing} critical files missing`
          : 'All critical files present';

        return { status, message, data: { checks: results, critical_missing: criticalMissing } };
      } catch (error) {
        return {
          status: HealthStatus.UNKNOWN,
          message: `File system check failed: ${error.message}`,
          data: { error: error.message }
        };
      }
    });

    // Docker health check
    this.healthChecks.set('docker_health', async () => {
      try {
        // Check if Docker is available
        execSync('docker --version', { stdio: 'pipe', timeout: 5000 });
        
        // Check running containers
        const containerOutput = execSync('docker ps --format "{{.Names}}:{{.Status}}"', {
          encoding: 'utf8',
          timeout: 10000
        });

        const containers = containerOutput.trim().split('\n')
          .filter(line => line.trim())
          .map(line => {
            const [name, status] = line.split(':');
            return { name, status, healthy: status.includes('Up') };
          });

        const unhealthyContainers = containers.filter(c => !c.healthy);
        
        let status = HealthStatus.HEALTHY;
        let message = 'Docker is healthy';
        
        if (unhealthyContainers.length > 0) {
          status = HealthStatus.WARNING;
          message = `${unhealthyContainers.length} containers not running`;
        }

        return {
          status,
          message,
          data: {
            docker_available: true,
            containers,
            total_containers: containers.length,
            unhealthy_containers: unhealthyContainers.length
          }
        };
      } catch (error) {
        return {
          status: HealthStatus.WARNING,
          message: 'Docker not available or not running',
          data: { docker_available: false, error: error.message }
        };
      }
    });

    // Network connectivity check
    this.healthChecks.set('network_connectivity', async () => {
      try {
        const targets = [
          { host: 'localhost', description: 'Local connectivity' },
          { host: '8.8.8.8', description: 'Internet connectivity' }
        ];

        const results = [];
        
        for (const target of targets) {
          try {
            execSync(`ping -c 1 -W 3 ${target.host}`, { 
              stdio: 'pipe', 
              timeout: 5000 
            });
            results.push({ ...target, reachable: true });
          } catch (error) {
            results.push({ ...target, reachable: false, error: error.message });
          }
        }

        const unreachableCount = results.filter(r => !r.reachable).length;
        
        let status = HealthStatus.HEALTHY;
        let message = 'Network connectivity is good';
        
        if (unreachableCount === results.length) {
          status = HealthStatus.CRITICAL;
          message = 'No network connectivity';
        } else if (unreachableCount > 0) {
          status = HealthStatus.WARNING;
          message = 'Limited network connectivity';
        }

        return { status, message, data: { targets: results, unreachable_count: unreachableCount } };
      } catch (error) {
        return {
          status: HealthStatus.UNKNOWN,
          message: `Network check failed: ${error.message}`,
          data: { error: error.message }
        };
      }
    });
  }

  /**
   * Run comprehensive health check
   */
  async runHealthCheck() {
    const healthResult = {
      timestamp: new Date().toISOString(),
      overall_status: HealthStatus.HEALTHY,
      checks: {},
      summary: {
        total_checks: this.healthChecks.size,
        healthy: 0,
        warning: 0,
        critical: 0,
        unknown: 0
      },
      recommendations: []
    };

    console.log(chalk.blue('🔍 Running comprehensive system health check...'));

    for (const [checkName, checkFunction] of this.healthChecks) {
      try {
        console.log(chalk.gray(`   Checking ${checkName}...`));
        const result = await checkFunction();
        healthResult.checks[checkName] = result;
        
        // Update summary
        healthResult.summary[result.status]++;
        
        // Update overall status (worst case)
        if (this.getStatusPriority(result.status) > this.getStatusPriority(healthResult.overall_status)) {
          healthResult.overall_status = result.status;
        }

        // Display result
        const statusIcon = this.getStatusIcon(result.status);
        const statusColor = this.getStatusColor(result.status);
        console.log(`   ${statusIcon} ${checkName}: ${statusColor(result.message)}`);

      } catch (error) {
        healthResult.checks[checkName] = {
          status: HealthStatus.UNKNOWN,
          message: `Health check failed: ${error.message}`,
          data: { error: error.message }
        };
        healthResult.summary.unknown++;
        console.log(`   ❓ ${checkName}: ${chalk.gray(`Check failed: ${error.message}`)}`);
      }
    }

    // Generate recommendations
    healthResult.recommendations = this.generateHealthRecommendations(healthResult);

    // Store in history
    this.lastHealthCheck = healthResult;
    this.healthHistory.push({
      timestamp: healthResult.timestamp,
      overall_status: healthResult.overall_status,
      summary: healthResult.summary
    });

    // Keep only last 50 health checks
    if (this.healthHistory.length > 50) {
      this.healthHistory = this.healthHistory.slice(-50);
    }

    return healthResult;
  }

  /**
   * Get status priority for comparison
   */
  getStatusPriority(status) {
    const priorities = {
      [HealthStatus.HEALTHY]: 0,
      [HealthStatus.WARNING]: 1,
      [HealthStatus.CRITICAL]: 2,
      [HealthStatus.UNKNOWN]: 3
    };
    return priorities[status] || 0;
  }

  /**
   * Get status icon
   */
  getStatusIcon(status) {
    const icons = {
      [HealthStatus.HEALTHY]: '✅',
      [HealthStatus.WARNING]: '⚠️',
      [HealthStatus.CRITICAL]: '🚨',
      [HealthStatus.UNKNOWN]: '❓'
    };
    return icons[status] || '❓';
  }

  /**
   * Get status color function
   */
  getStatusColor(status) {
    const colors = {
      [HealthStatus.HEALTHY]: chalk.green,
      [HealthStatus.WARNING]: chalk.yellow,
      [HealthStatus.CRITICAL]: chalk.red,
      [HealthStatus.UNKNOWN]: chalk.gray
    };
    return colors[status] || chalk.gray;
  }

  /**
   * Generate health recommendations
   */
  generateHealthRecommendations(healthResult) {
    const recommendations = [];

    // Port conflicts
    if (healthResult.checks.port_availability?.status === HealthStatus.WARNING) {
      recommendations.push({
        category: 'port_management',
        priority: 'medium',
        title: 'Resolve port conflicts',
        description: 'Some common ports are in use',
        action: 'Run port conflict resolution: npm run port:resolve'
      });
    }

    // High memory usage
    if (healthResult.checks.system_resources?.status === HealthStatus.CRITICAL) {
      recommendations.push({
        category: 'performance',
        priority: 'high',
        title: 'Reduce memory usage',
        description: 'System memory usage is critically high',
        action: 'Restart services or increase system resources'
      });
    }

    // Missing critical files
    if (healthResult.checks.file_system?.status === HealthStatus.CRITICAL) {
      recommendations.push({
        category: 'configuration',
        priority: 'high',
        title: 'Restore missing files',
        description: 'Critical configuration files are missing',
        action: 'Restore from backup or reinitialize configuration'
      });
    }

    // Docker issues
    if (healthResult.checks.docker_health?.status === HealthStatus.WARNING) {
      recommendations.push({
        category: 'docker',
        priority: 'medium',
        title: 'Fix Docker containers',
        description: 'Some Docker containers are not running',
        action: 'Restart Docker services: docker-compose up -d'
      });
    }

    // Network issues
    if (healthResult.checks.network_connectivity?.status !== HealthStatus.HEALTHY) {
      recommendations.push({
        category: 'network',
        priority: 'high',
        title: 'Fix network connectivity',
        description: 'Network connectivity issues detected',
        action: 'Check network configuration and firewall settings'
      });
    }

    return recommendations;
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
}

/**
 * Intelligent Fix Suggester
 */
export class IntelligentFixSuggester {
  constructor() {
    this.fixTemplates = new Map();
    this.learningData = new Map();
    this.setupFixTemplates();
  }

  /**
   * Setup fix templates for different error categories
   */
  setupFixTemplates() {
    // Port conflict fixes
    this.fixTemplates.set(ErrorCategory.PORT_CONFLICT, (error, context) => {
      const fixes = [];
      const port = context.port || this.extractPortFromError(error);

      if (port) {
        // Fix 1: Kill conflicting process
        fixes.push(new AutomatedFix({
          title: 'Terminate conflicting process',
          description: `Stop the process using port ${port}`,
          category: ErrorCategory.PORT_CONFLICT,
          confidence: FixConfidence.HIGH,
          riskLevel: 'medium',
          estimatedTime: '30 seconds',
          prerequisites: [
            {
              type: 'command',
              command: process.platform === 'win32' 
                ? `netstat -ano | findstr :${port}`
                : `lsof -ti:${port}`
            }
          ],
          actions: [
            {
              type: 'command',
              description: 'Identify and terminate conflicting process',
              command: process.platform === 'win32'
                ? `for /f "tokens=5" %a in ('netstat -ano ^| findstr :${port}') do taskkill /PID %a /F`
                : `kill -9 $(lsof -ti:${port})`,
              timeout: 10000
            }
          ],
          validation: async (result, ctx) => {
            const isAvailable = await this.checkPortAvailable(port);
            return {
              success: isAvailable,
              message: isAvailable ? 'Port is now available' : 'Port is still in use'
            };
          }
        }));

        // Fix 2: Use alternative port
        fixes.push(new AutomatedFix({
          title: 'Configure alternative port',
          description: `Switch to port ${port + 1}`,
          category: ErrorCategory.PORT_CONFLICT,
          confidence: FixConfidence.VERY_HIGH,
          riskLevel: 'low',
          estimatedTime: '1 minute',
          actions: [
            {
              type: 'environment_change',
              description: 'Update PORT environment variable',
              operation: 'set_env_var',
              variable: 'PORT',
              value: (port + 1).toString()
            },
            {
              type: 'environment_change',
              description: 'Update .env file',
              operation: 'update_env_file',
              variable: 'PORT',
              value: (port + 1).toString()
            }
          ]
        }));
      }

      return fixes;
    });

    // Permission denied fixes
    this.fixTemplates.set(ErrorCategory.PERMISSION, (error, context) => {
      const fixes = [];
      const port = context.port || this.extractPortFromError(error);

      if (port && port < 1024) {
        // Fix: Use non-privileged port
        fixes.push(new AutomatedFix({
          title: 'Switch to non-privileged port',
          description: `Change from privileged port ${port} to ${port + 3000}`,
          category: ErrorCategory.PERMISSION,
          confidence: FixConfidence.VERY_HIGH,
          riskLevel: 'low',
          estimatedTime: '30 seconds',
          actions: [
            {
              type: 'environment_change',
              description: 'Set non-privileged port',
              operation: 'set_env_var',
              variable: 'PORT',
              value: (port + 3000).toString()
            }
          ]
        }));
      } else {
        // Fix: Check and fix permissions
        fixes.push(new AutomatedFix({
          title: 'Fix file permissions',
          description: 'Ensure proper file and directory permissions',
          category: ErrorCategory.PERMISSION,
          confidence: FixConfidence.MEDIUM,
          riskLevel: 'low',
          estimatedTime: '1 minute',
          actions: [
            {
              type: 'command',
              description: 'Fix current directory permissions',
              command: 'chmod 755 .',
              optional: true
            },
            {
              type: 'command',
              description: 'Fix node_modules permissions',
              command: 'chmod -R 755 node_modules',
              optional: true
            }
          ]
        }));
      }

      return fixes;
    });

    // Configuration error fixes
    this.fixTemplates.set(ErrorCategory.CONFIGURATION, (error, context) => {
      const fixes = [];

      // Fix 1: Validate and fix configuration
      fixes.push(new AutomatedFix({
        title: 'Validate configuration files',
        description: 'Check and fix configuration syntax',
        category: ErrorCategory.CONFIGURATION,
        confidence: FixConfidence.HIGH,
        riskLevel: 'low',
        estimatedTime: '1 minute',
        actions: [
          {
            type: 'command',
            description: 'Validate package.json',
            command: 'cat package.json | jq .',
            optional: true
          },
          {
            type: 'command',
            description: 'Validate docker-compose.yml',
            command: 'docker-compose config',
            optional: true
          }
        ]
      }));

      // Fix 2: Reset to default configuration
      fixes.push(new AutomatedFix({
        title: 'Reset to default configuration',
        description: 'Restore default configuration files',
        category: ErrorCategory.CONFIGURATION,
        confidence: FixConfidence.MEDIUM,
        riskLevel: 'medium',
        estimatedTime: '2 minutes',
        prerequisites: [
          {
            type: 'file_exists',
            path: 'config/ports.js.example'
          }
        ],
        actions: [
          {
            type: 'file_operation',
            description: 'Backup current configuration',
            operation: 'backup',
            path: 'config/ports.js'
          },
          {
            type: 'file_operation',
            description: 'Copy default configuration',
            operation: 'copy',
            source: 'config/ports.js.example',
            destination: 'config/ports.js'
          }
        ],
        rollback: async (result, ctx) => {
          // Restore from backup
          const backupFiles = result.actions
            .filter(a => a.type === 'file_operation' && a.operation === 'backup')
            .map(a => `${a.path}.backup.${Date.now()}`);
          
          if (backupFiles.length > 0) {
            await fs.copyFile(backupFiles[0], 'config/ports.js');
            return { success: true, message: 'Configuration restored from backup' };
          }
          return { success: false, message: 'No backup available' };
        }
      }));

      return fixes;
    });

    // Network error fixes
    this.fixTemplates.set(ErrorCategory.NETWORK, (error, context) => {
      const fixes = [];

      // Fix 1: Reset network configuration
      fixes.push(new AutomatedFix({
        title: 'Reset network configuration',
        description: 'Restart network services',
        category: ErrorCategory.NETWORK,
        confidence: FixConfidence.MEDIUM,
        riskLevel: 'medium',
        estimatedTime: '2 minutes',
        actions: [
          {
            type: 'command',
            description: 'Flush DNS cache',
            command: process.platform === 'win32' 
              ? 'ipconfig /flushdns'
              : 'sudo systemctl restart systemd-resolved',
            optional: true
          },
          {
            type: 'command',
            description: 'Reset network interfaces',
            command: process.platform === 'win32'
              ? 'netsh winsock reset'
              : 'sudo systemctl restart NetworkManager',
            optional: true
          }
        ]
      }));

      return fixes;
    });

    // Resource limitation fixes
    this.fixTemplates.set(ErrorCategory.RESOURCE, (error, context) => {
      const fixes = [];

      // Fix 1: Increase file descriptor limit
      fixes.push(new AutomatedFix({
        title: 'Increase file descriptor limit',
        description: 'Raise system file descriptor limits',
        category: ErrorCategory.RESOURCE,
        confidence: FixConfidence.HIGH,
        riskLevel: 'low',
        estimatedTime: '30 seconds',
        actions: [
          {
            type: 'command',
            description: 'Set file descriptor limit',
            command: 'ulimit -n 4096',
            optional: false
          }
        ],
        validation: async (result, ctx) => {
          try {
            const output = execSync('ulimit -n', { encoding: 'utf8' });
            const limit = parseInt(output.trim());
            return {
              success: limit >= 4096,
              message: `File descriptor limit is now ${limit}`
            };
          } catch (error) {
            return { success: false, message: 'Failed to verify limit' };
          }
        }
      }));

      // Fix 2: Clean up temporary files
      fixes.push(new AutomatedFix({
        title: 'Clean up temporary files',
        description: 'Free up disk space by removing temporary files',
        category: ErrorCategory.RESOURCE,
        confidence: FixConfidence.MEDIUM,
        riskLevel: 'low',
        estimatedTime: '2 minutes',
        actions: [
          {
            type: 'command',
            description: 'Clean npm cache',
            command: 'npm cache clean --force',
            optional: true
          },
          {
            type: 'command',
            description: 'Remove node_modules',
            command: 'rm -rf node_modules',
            optional: true
          },
          {
            type: 'command',
            description: 'Reinstall dependencies',
            command: 'npm install',
            optional: true
          }
        ]
      }));

      return fixes;
    });
  }

  /**
   * Suggest fixes for an error
   */
  suggestFixes(error, context = {}, strategy = TroubleshootingStrategy.BALANCED) {
    const category = error.category || ErrorCategory.RUNTIME;
    const template = this.fixTemplates.get(category);

    let fixes = [];
    if (template) {
      fixes = template(error, context);
    }

    // Filter fixes based on strategy
    fixes = this.filterFixesByStrategy(fixes, strategy);

    // Sort by confidence and risk level
    fixes.sort((a, b) => {
      // Higher confidence first
      const confidenceDiff = b.confidence - a.confidence;
      if (confidenceDiff !== 0) return confidenceDiff;

      // Lower risk first
      const riskOrder = { 'low': 0, 'medium': 1, 'high': 2, 'critical': 3 };
      return (riskOrder[a.riskLevel] || 1) - (riskOrder[b.riskLevel] || 1);
    });

    return fixes;
  }

  /**
   * Filter fixes by troubleshooting strategy
   */
  filterFixesByStrategy(fixes, strategy) {
    switch (strategy) {
      case TroubleshootingStrategy.CONSERVATIVE:
        return fixes.filter(fix => 
          fix.riskLevel === 'low' || fix.riskLevel === 'none'
        );

      case TroubleshootingStrategy.BALANCED:
        return fixes.filter(fix => 
          fix.riskLevel !== 'critical' && fix.confidence >= FixConfidence.MEDIUM
        );

      case TroubleshootingStrategy.AGGRESSIVE:
        return fixes; // All fixes

      case TroubleshootingStrategy.DIAGNOSTIC_ONLY:
        return fixes.filter(fix => 
          fix.actions.every(action => action.type === 'command' && action.optional)
        );

      default:
        return fixes;
    }
  }

  /**
   * Extract port number from error message
   */
  extractPortFromError(error) {
    const message = error.message || error.toString();
    const portMatch = message.match(/:(\d+)/);
    return portMatch ? parseInt(portMatch[1]) : null;
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
   * Learn from fix application results
   */
  recordFixResult(fix, result, context = {}) {
    const learningKey = `${fix.category}_${fix.title}`;
    
    if (!this.learningData.has(learningKey)) {
      this.learningData.set(learningKey, {
        applications: 0,
        successes: 0,
        failures: 0,
        contexts: []
      });
    }

    const data = this.learningData.get(learningKey);
    data.applications++;
    
    if (result.success) {
      data.successes++;
    } else {
      data.failures++;
    }

    data.contexts.push({
      timestamp: new Date().toISOString(),
      success: result.success,
      context,
      executionTime: result.executionTime
    });

    // Keep only last 100 contexts
    if (data.contexts.length > 100) {
      data.contexts = data.contexts.slice(-100);
    }

    // Update fix confidence based on success rate
    const successRate = data.successes / data.applications;
    if (data.applications >= 5) {
      fix.confidence = Math.max(FixConfidence.VERY_LOW, 
        Math.min(FixConfidence.VERY_HIGH, successRate));
    }
  }

  /**
   * Get learning statistics
   */
  getLearningStatistics() {
    const stats = {
      total_fixes_tracked: this.learningData.size,
      total_applications: 0,
      total_successes: 0,
      overall_success_rate: 0,
      fix_performance: {}
    };

    for (const [key, data] of this.learningData) {
      stats.total_applications += data.applications;
      stats.total_successes += data.successes;
      
      stats.fix_performance[key] = {
        applications: data.applications,
        success_rate: data.applications > 0 ? data.successes / data.applications : 0,
        average_execution_time: data.contexts.length > 0 
          ? data.contexts.reduce((sum, ctx) => sum + (ctx.executionTime || 0), 0) / data.contexts.length
          : 0
      };
    }

    stats.overall_success_rate = stats.total_applications > 0 
      ? stats.total_successes / stats.total_applications 
      : 0;

    return stats;
  }
}

/**
 * Main Automated Troubleshooting Engine
 */
export class AutomatedTroubleshootingEngine extends EventEmitter {
  constructor() {
    super();
    this.healthMonitor = new SystemHealthMonitor();
    this.fixSuggester = new IntelligentFixSuggester();
    this.executionHistory = [];
  }

  /**
   * Run comprehensive troubleshooting
   */
  async runTroubleshooting(error, options = {}) {
    const {
      strategy = TroubleshootingStrategy.BALANCED,
      autoApply = false,
      maxFixes = 3,
      includeHealthCheck = true,
      context = {}
    } = options;

    console.log(chalk.bold.blue('\n🔧 Starting Automated Troubleshooting'));
    console.log('═'.repeat(60));

    const troubleshootingResult = {
      timestamp: new Date().toISOString(),
      error: {
        message: error.message || error.toString(),
        category: error.category || ErrorCategory.RUNTIME,
        severity: error.severity || ErrorSeverity.ERROR
      },
      strategy,
      health_check: null,
      suggested_fixes: [],
      applied_fixes: [],
      success: false,
      recommendations: []
    };

    try {
      // Step 1: Run health check if requested
      if (includeHealthCheck) {
        console.log(chalk.blue('\n📊 Running system health check...'));
        troubleshootingResult.health_check = await this.healthMonitor.runHealthCheck();
        
        // Add health-based recommendations
        if (troubleshootingResult.health_check.recommendations) {
          troubleshootingResult.recommendations.push(...troubleshootingResult.health_check.recommendations);
        }
      }

      // Step 2: Suggest fixes
      console.log(chalk.blue('\n🔍 Analyzing error and suggesting fixes...'));
      const suggestedFixes = this.fixSuggester.suggestFixes(error, context, strategy);
      troubleshootingResult.suggested_fixes = suggestedFixes.slice(0, maxFixes);

      if (troubleshootingResult.suggested_fixes.length === 0) {
        console.log(chalk.yellow('   No automated fixes available for this error'));
        troubleshootingResult.recommendations.push({
          category: 'manual_intervention',
          priority: 'high',
          title: 'Manual troubleshooting required',
          description: 'No automated fixes available',
          action: 'Review error details and consult documentation'
        });
        return troubleshootingResult;
      }

      console.log(chalk.green(`   Found ${troubleshootingResult.suggested_fixes.length} potential fixes`));

      // Step 3: Apply fixes if auto-apply is enabled
      if (autoApply) {
        console.log(chalk.blue('\n🚀 Applying automated fixes...'));
        
        for (const fix of troubleshootingResult.suggested_fixes) {
          console.log(chalk.blue(`\n   Applying: ${fix.title}`));
          console.log(chalk.gray(`   Description: ${fix.description}`));
          console.log(chalk.gray(`   Confidence: ${Math.round(fix.confidence * 100)}%`));
          console.log(chalk.gray(`   Risk Level: ${fix.riskLevel}`));

          try {
            const result = await fix.apply(context, false);
            troubleshootingResult.applied_fixes.push({
              fix_id: fix.id,
              title: fix.title,
              result
            });

            // Record result for learning
            this.fixSuggester.recordFixResult(fix, result, context);

            if (result.success) {
              console.log(chalk.green(`   ✅ Fix applied successfully`));
              troubleshootingResult.success = true;
              break; // Stop after first successful fix
            } else {
              console.log(chalk.red(`   ❌ Fix failed: ${result.error}`));
            }
          } catch (error) {
            console.log(chalk.red(`   ❌ Fix application failed: ${error.message}`));
            troubleshootingResult.applied_fixes.push({
              fix_id: fix.id,
              title: fix.title,
              result: { success: false, error: error.message }
            });
          }
        }
      } else {
        // Just show what would be done
        console.log(chalk.blue('\n📋 Suggested fixes (not applied):'));
        troubleshootingResult.suggested_fixes.forEach((fix, index) => {
          console.log(chalk.blue(`\n   ${index + 1}. ${fix.title}`));
          console.log(chalk.gray(`      ${fix.description}`));
          console.log(chalk.gray(`      Confidence: ${Math.round(fix.confidence * 100)}%`));
          console.log(chalk.gray(`      Risk Level: ${fix.riskLevel}`));
          console.log(chalk.gray(`      Estimated Time: ${fix.estimatedTime}`));
        });
      }

      // Step 4: Generate final recommendations
      if (!troubleshootingResult.success) {
        troubleshootingResult.recommendations.push({
          category: 'next_steps',
          priority: 'medium',
          title: 'Try manual fixes',
          description: 'Apply suggested fixes manually or with confirmation',
          action: 'Run troubleshooting in interactive mode'
        });
      }

      // Store in execution history
      this.executionHistory.push(troubleshootingResult);

      // Emit completion event
      this.emit('troubleshooting_completed', troubleshootingResult);

      return troubleshootingResult;

    } catch (error) {
      console.log(chalk.red(`\n❌ Troubleshooting failed: ${error.message}`));
      troubleshootingResult.error = error.message;
      return troubleshootingResult;
    }
  }

  /**
   * Run interactive troubleshooting
   */
  async runInteractiveTroubleshooting(error, context = {}) {
    const inquirer = await import('inquirer');
    
    console.log(chalk.bold.blue('\n🔧 Interactive Troubleshooting Mode'));
    console.log('═'.repeat(60));

    // Get suggested fixes
    const fixes = this.fixSuggester.suggestFixes(error, context, TroubleshootingStrategy.BALANCED);
    
    if (fixes.length === 0) {
      console.log(chalk.yellow('No automated fixes available for this error'));
      return { success: false, message: 'No fixes available' };
    }

    // Show fixes and let user choose
    const choices = fixes.map((fix, index) => ({
      name: `${fix.title} (Confidence: ${Math.round(fix.confidence * 100)}%, Risk: ${fix.riskLevel})`,
      value: index,
      short: fix.title
    }));

    choices.push({ name: 'Skip automated fixes', value: -1 });

    const { selectedFixIndex } = await inquirer.default.prompt([{
      type: 'list',
      name: 'selectedFixIndex',
      message: 'Choose a fix to apply:',
      choices
    }]);

    if (selectedFixIndex === -1) {
      console.log(chalk.yellow('Automated fixes skipped'));
      return { success: false, message: 'Skipped by user' };
    }

    const selectedFix = fixes[selectedFixIndex];
    
    // Show fix details and confirm
    console.log(chalk.blue(`\nSelected Fix: ${selectedFix.title}`));
    console.log(chalk.gray(`Description: ${selectedFix.description}`));
    console.log(chalk.gray(`Estimated Time: ${selectedFix.estimatedTime}`));
    console.log(chalk.gray(`Risk Level: ${selectedFix.riskLevel}`));

    const { confirmApply } = await inquirer.default.prompt([{
      type: 'confirm',
      name: 'confirmApply',
      message: 'Apply this fix?',
      default: true
    }]);

    if (!confirmApply) {
      console.log(chalk.yellow('Fix application cancelled'));
      return { success: false, message: 'Cancelled by user' };
    }

    // Apply the fix
    console.log(chalk.blue('\n🚀 Applying fix...'));
    try {
      const result = await selectedFix.apply(context, false);
      
      // Record result for learning
      this.fixSuggester.recordFixResult(selectedFix, result, context);

      if (result.success) {
        console.log(chalk.green('✅ Fix applied successfully!'));
      } else {
        console.log(chalk.red(`❌ Fix failed: ${result.error}`));
      }

      return result;
    } catch (error) {
      console.log(chalk.red(`❌ Fix application failed: ${error.message}`));
      return { success: false, error: error.message };
    }
  }

  /**
   * Get troubleshooting statistics
   */
  getTroubleshootingStatistics() {
    const stats = {
      total_sessions: this.executionHistory.length,
      successful_sessions: 0,
      health_checks_run: 0,
      fixes_applied: 0,
      successful_fixes: 0,
      categories: {},
      fix_statistics: this.fixSuggester.getLearningStatistics()
    };

    this.executionHistory.forEach(session => {
      if (session.success) {
        stats.successful_sessions++;
      }
      
      if (session.health_check) {
        stats.health_checks_run++;
      }
      
      stats.fixes_applied += session.applied_fixes.length;
      stats.successful_fixes += session.applied_fixes.filter(f => f.result.success).length;
      
      const category = session.error.category;
      stats.categories[category] = (stats.categories[category] || 0) + 1;
    });

    stats.success_rate = stats.total_sessions > 0 
      ? Math.round((stats.successful_sessions / stats.total_sessions) * 100)
      : 0;

    return stats;
  }

  /**
   * Export troubleshooting report
   */
  async exportTroubleshootingReport(format = 'json') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `troubleshooting-report-${timestamp}.${format}`;
    const filepath = path.join(__dirname, '..', 'reports', filename);

    // Ensure reports directory exists
    await fs.mkdir(path.dirname(filepath), { recursive: true });

    const report = {
      generated_at: new Date().toISOString(),
      statistics: this.getTroubleshootingStatistics(),
      recent_sessions: this.executionHistory.slice(-10),
      health_monitor_history: this.healthMonitor.healthHistory.slice(-10)
    };

    if (format === 'json') {
      await fs.writeFile(filepath, JSON.stringify(report, null, 2));
    } else if (format === 'markdown') {
      const markdown = this.generateMarkdownReport(report);
      await fs.writeFile(filepath, markdown);
    }

    return filepath;
  }

  /**
   * Generate markdown report
   */
  generateMarkdownReport(report) {
    return `
# Automated Troubleshooting Report

**Generated:** ${report.generated_at}

## Statistics

- **Total Sessions:** ${report.statistics.total_sessions}
- **Successful Sessions:** ${report.statistics.successful_sessions}
- **Success Rate:** ${report.statistics.success_rate}%
- **Health Checks Run:** ${report.statistics.health_checks_run}
- **Fixes Applied:** ${report.statistics.fixes_applied}
- **Successful Fixes:** ${report.statistics.successful_fixes}

## Error Categories

${Object.entries(report.statistics.categories).map(([category, count]) => 
  `- **${category}:** ${count} sessions`
).join('\n')}

## Fix Performance

- **Total Fixes Tracked:** ${report.statistics.fix_statistics.total_fixes_tracked}
- **Total Applications:** ${report.statistics.fix_statistics.total_applications}
- **Overall Success Rate:** ${Math.round(report.statistics.fix_statistics.overall_success_rate * 100)}%

## Recent Sessions

${report.recent_sessions.map(session => `
### Session ${session.timestamp}

- **Error:** ${session.error.message}
- **Category:** ${session.error.category}
- **Success:** ${session.success ? '✅' : '❌'}
- **Fixes Applied:** ${session.applied_fixes.length}
`).join('')}
`;
  }
}

// Export singleton instance
export const automatedTroubleshootingEngine = new AutomatedTroubleshootingEngine();

export {
  AutomatedFix,
  SystemHealthMonitor,
  IntelligentFixSuggester,
  TroubleshootingStrategy,
  FixConfidence,
  HealthStatus
};
