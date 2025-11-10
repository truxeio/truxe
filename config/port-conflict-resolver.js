/**
 * Truxe Port Conflict Resolution Engine
 * 
 * Intelligent conflict resolution system with automated fixes, user-friendly error messages,
 * and comprehensive resolution strategies for all types of port conflicts.
 * 
 * @author DevOps Engineering Team
 * @version 3.0.0
 */

import { portConflictDetector } from './port-conflict-detector.js';
import { portStartupValidator } from './port-startup-validator.js';
import portManager from './ports.js';
import { execSync, spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Resolution Strategy Types
 */
export const ResolutionStrategy = {
  AUTOMATIC: 'automatic',
  INTERACTIVE: 'interactive',
  MANUAL: 'manual',
  FALLBACK: 'fallback'
};

/**
 * Resolution Action Types
 */
export const ResolutionAction = {
  KILL_PROCESS: 'kill_process',
  STOP_CONTAINER: 'stop_container',
  CHANGE_PORT: 'change_port',
  USE_FALLBACK: 'use_fallback',
  MODIFY_CONFIG: 'modify_config',
  WAIT_FOR_RELEASE: 'wait_for_release'
};

/**
 * Enhanced Error Message Generator
 */
class ErrorMessageGenerator {
  constructor() {
    this.messageTemplates = new Map();
    this.setupMessageTemplates();
  }

  setupMessageTemplates() {
    // Port conflict templates
    this.messageTemplates.set('port_in_use', {
      title: '🚫 Port Conflict Detected',
      message: (data) => `Port ${data.port} is already in use by ${data.process_name} (PID: ${data.pid})`,
      severity: 'error',
      actionable: true
    });

    this.messageTemplates.set('docker_conflict', {
      title: '🐳 Docker Container Conflict',
      message: (data) => `Port ${data.port} is used by Docker container "${data.container_name}"`,
      severity: 'warning',
      actionable: true
    });

    this.messageTemplates.set('reserved_port', {
      title: '⚠️ Reserved Port Usage',
      message: (data) => `Port ${data.port} is in reserved range: ${data.description}`,
      severity: 'warning',
      actionable: false
    });

    this.messageTemplates.set('duplicate_assignment', {
      title: '🔄 Duplicate Port Assignment',
      message: (data) => `Port ${data.port} is assigned to multiple services: ${data.services.join(', ')}`,
      severity: 'critical',
      actionable: true
    });

    this.messageTemplates.set('startup_failure', {
      title: '🚨 Service Startup Failure',
      message: (data) => `Cannot start ${data.service} on port ${data.port}: ${data.reason}`,
      severity: 'critical',
      actionable: true
    });
  }

  generateErrorMessage(type, data, includeResolution = true) {
    const template = this.messageTemplates.get(type);
    if (!template) {
      return {
        title: '❌ Unknown Error',
        message: 'An unknown port-related error occurred',
        severity: 'error',
        actionable: false
      };
    }

    const errorMessage = {
      title: template.title,
      message: template.message(data),
      severity: template.severity,
      actionable: template.actionable,
      timestamp: new Date().toISOString(),
      data: data
    };

    if (includeResolution && template.actionable) {
      errorMessage.resolution_steps = this.generateResolutionSteps(type, data);
    }

    return errorMessage;
  }

  generateResolutionSteps(type, data) {
    const steps = [];

    switch (type) {
      case 'port_in_use':
        steps.push({
          step: 1,
          action: 'Identify the conflicting process',
          command: `lsof -ti:${data.port} | xargs ps -p`,
          description: 'Check what process is using the port'
        });

        if (data.risk_level === 'low') {
          steps.push({
            step: 2,
            action: 'Stop the conflicting process',
            command: `kill -15 ${data.pid}`,
            description: 'Gracefully terminate the process',
            risk: 'low'
          });
        } else {
          steps.push({
            step: 2,
            action: 'Consider alternative solutions',
            description: 'Process may be critical - consider using a different port',
            risk: data.risk_level
          });
        }
        break;

      case 'docker_conflict':
        steps.push({
          step: 1,
          action: 'Stop the conflicting container',
          command: `docker stop ${data.container_name}`,
          description: 'Stop the Docker container using this port'
        });

        steps.push({
          step: 2,
          action: 'Remove container if no longer needed',
          command: `docker rm ${data.container_name}`,
          description: 'Remove the container if it\'s not needed'
        });
        break;

      case 'duplicate_assignment':
        steps.push({
          step: 1,
          action: 'Review port configuration',
          description: 'Check port assignments in configuration files'
        });

        steps.push({
          step: 2,
          action: 'Assign unique ports',
          description: `Assign different ports to: ${data.services.join(', ')}`
        });
        break;

      case 'startup_failure':
        steps.push({
          step: 1,
          action: 'Run port conflict detection',
          command: 'npm run port:check',
          description: 'Check for port conflicts before starting services'
        });

        steps.push({
          step: 2,
          action: 'Resolve conflicts automatically',
          command: 'npm run port:resolve',
          description: 'Attempt automatic conflict resolution'
        });
        break;
    }

    return steps;
  }
}

/**
 * Port Conflict Resolution Engine
 */
export class PortConflictResolver {
  constructor() {
    this.errorGenerator = new ErrorMessageGenerator();
    this.resolutionStrategies = new Map();
    this.resolutionHistory = [];
    this.setupResolutionStrategies();
  }

  setupResolutionStrategies() {
    // Automatic resolution strategies
    this.resolutionStrategies.set(ResolutionAction.KILL_PROCESS, {
      name: 'Kill Conflicting Process',
      description: 'Terminate the process using the required port',
      risk_levels: ['low', 'medium'],
      executor: this.killProcess.bind(this),
      reversible: false
    });

    this.resolutionStrategies.set(ResolutionAction.STOP_CONTAINER, {
      name: 'Stop Docker Container',
      description: 'Stop the Docker container using the required port',
      risk_levels: ['low', 'medium'],
      executor: this.stopContainer.bind(this),
      reversible: true
    });

    this.resolutionStrategies.set(ResolutionAction.USE_FALLBACK, {
      name: 'Use Fallback Port',
      description: 'Use an alternative available port',
      risk_levels: ['none', 'low'],
      executor: this.useFallbackPort.bind(this),
      reversible: true
    });

    this.resolutionStrategies.set(ResolutionAction.CHANGE_PORT, {
      name: 'Change Service Port',
      description: 'Modify service configuration to use a different port',
      risk_levels: ['low', 'medium'],
      executor: this.changeServicePort.bind(this),
      reversible: true
    });

    this.resolutionStrategies.set(ResolutionAction.WAIT_FOR_RELEASE, {
      name: 'Wait for Port Release',
      description: 'Wait for the port to become available',
      risk_levels: ['none'],
      executor: this.waitForPortRelease.bind(this),
      reversible: false
    });
  }

  /**
   * Comprehensive conflict resolution
   */
  async resolveConflicts(environment = 'development', options = {}) {
    const {
      strategy = ResolutionStrategy.INTERACTIVE,
      autoApprove = false,
      maxRetries = 3,
      timeout = 30000,
      dryRun = false
    } = options;

    console.log(`🔧 Starting port conflict resolution for ${environment} environment...`);

    const resolutionResult = {
      environment,
      strategy,
      timestamp: new Date().toISOString(),
      dry_run: dryRun,
      conflicts_detected: 0,
      conflicts_resolved: 0,
      conflicts_failed: 0,
      actions_taken: [],
      errors: [],
      recommendations: [],
      final_status: 'unknown'
    };

    try {
      // Step 1: Detect conflicts
      console.log('📋 Step 1: Detecting port conflicts...');
      const envConfig = portManager.getEnvironmentConfig(environment);
      const servicePorts = Object.values(envConfig.services);
      
      const conflictResults = await portConflictDetector.detectPortConflicts(servicePorts, {
        includeProcessDetails: true,
        timeout: timeout / 2
      });

      resolutionResult.conflicts_detected = conflictResults.conflicts_detected;

      if (conflictResults.conflicts_detected === 0) {
        console.log('✅ No port conflicts detected!');
        resolutionResult.final_status = 'no_conflicts';
        return resolutionResult;
      }

      console.log(`⚠️  Found ${conflictResults.conflicts_detected} port conflicts`);

      // Step 2: Generate resolution plan
      console.log('📋 Step 2: Generating resolution plan...');
      const resolutionPlan = await this.generateResolutionPlan(conflictResults, environment);
      
      // Step 3: Execute resolution plan
      console.log('📋 Step 3: Executing resolution plan...');
      
      for (const action of resolutionPlan.actions) {
        try {
          console.log(`   Executing: ${action.description}`);

          // Generate user-friendly error message
          const errorMessage = this.errorGenerator.generateErrorMessage(
            action.conflict_type,
            action.conflict_data,
            true
          );

          console.log(`   ${errorMessage.title}`);
          console.log(`   ${errorMessage.message}`);

          // Show resolution steps
          if (errorMessage.resolution_steps) {
            console.log('   📝 Resolution steps:');
            errorMessage.resolution_steps.forEach(step => {
              console.log(`      ${step.step}. ${step.action}`);
              if (step.command) {
                console.log(`         Command: ${step.command}`);
              }
              if (step.risk) {
                console.log(`         Risk: ${step.risk}`);
              }
            });
          }

          // Ask for approval if interactive
          if (strategy === ResolutionStrategy.INTERACTIVE && !autoApprove) {
            const approved = await this.askForApproval(action, errorMessage);
            if (!approved) {
              console.log('   ⏭️  Skipped by user');
              continue;
            }
          }

          // Execute action (unless dry run)
          if (!dryRun) {
            const actionResult = await this.executeResolutionAction(action);
            
            if (actionResult.success) {
              console.log(`   ✅ ${action.description} - Success`);
              resolutionResult.conflicts_resolved++;
            } else {
              console.log(`   ❌ ${action.description} - Failed: ${actionResult.error}`);
              resolutionResult.conflicts_failed++;
              resolutionResult.errors.push({
                action: action.description,
                error: actionResult.error
              });
            }

            resolutionResult.actions_taken.push({
              ...action,
              result: actionResult,
              timestamp: new Date().toISOString()
            });
          } else {
            console.log(`   🔍 DRY RUN: Would execute ${action.description}`);
            resolutionResult.actions_taken.push({
              ...action,
              dry_run: true,
              timestamp: new Date().toISOString()
            });
          }

        } catch (error) {
          console.log(`   ❌ Failed to execute ${action.description}: ${error.message}`);
          resolutionResult.conflicts_failed++;
          resolutionResult.errors.push({
            action: action.description,
            error: error.message
          });
        }
      }

      // Step 4: Verify resolution
      console.log('📋 Step 4: Verifying conflict resolution...');
      
      if (!dryRun) {
        const verificationResults = await portConflictDetector.detectPortConflicts(servicePorts);
        
        if (verificationResults.conflicts_detected === 0) {
          console.log('🎉 All conflicts resolved successfully!');
          resolutionResult.final_status = 'resolved';
        } else {
          console.log(`⚠️  ${verificationResults.conflicts_detected} conflicts remain unresolved`);
          resolutionResult.final_status = 'partially_resolved';
          
          // Generate recommendations for remaining conflicts
          resolutionResult.recommendations = await this.generateRecommendations(
            verificationResults,
            environment
          );
        }
      } else {
        resolutionResult.final_status = 'dry_run_completed';
      }

      // Add to resolution history
      this.resolutionHistory.push({
        timestamp: resolutionResult.timestamp,
        environment,
        conflicts_detected: resolutionResult.conflicts_detected,
        conflicts_resolved: resolutionResult.conflicts_resolved,
        final_status: resolutionResult.final_status
      });

      return resolutionResult;

    } catch (error) {
      console.error(`❌ Resolution process failed: ${error.message}`);
      resolutionResult.final_status = 'failed';
      resolutionResult.errors.push({
        stage: 'resolution_process',
        error: error.message
      });
      return resolutionResult;
    }
  }

  /**
   * Generate resolution plan
   */
  async generateResolutionPlan(conflictResults, environment) {
    const plan = {
      environment,
      timestamp: new Date().toISOString(),
      total_conflicts: conflictResults.conflicts_detected,
      actions: [],
      estimated_time_seconds: 0,
      risk_assessment: 'low'
    };

    for (const [port, result] of Object.entries(conflictResults.ports)) {
      if (!result.available) {
        // Process conflicts
        for (const process of result.processes) {
          const action = {
            type: ResolutionAction.KILL_PROCESS,
            port: parseInt(port),
            service: Object.keys(portManager.getEnvironmentConfig(environment).services)
              .find(key => portManager.getEnvironmentConfig(environment).services[key] === parseInt(port)),
            description: `Stop process ${process.name} (PID: ${process.pid}) using port ${port}`,
            risk_level: this.assessProcessRisk(process),
            conflict_type: 'port_in_use',
            conflict_data: {
              port: parseInt(port),
              process_name: process.name,
              pid: process.pid,
              risk_level: this.assessProcessRisk(process)
            },
            process_info: process,
            estimated_time: 5
          };

          plan.actions.push(action);
          plan.estimated_time_seconds += action.estimated_time;

          // Update risk assessment
          if (action.risk_level === 'high' || action.risk_level === 'critical') {
            plan.risk_assessment = 'high';
          } else if (action.risk_level === 'medium' && plan.risk_assessment === 'low') {
            plan.risk_assessment = 'medium';
          }
        }

        // Container conflicts
        for (const container of result.containers) {
          const action = {
            type: ResolutionAction.STOP_CONTAINER,
            port: parseInt(port),
            service: Object.keys(portManager.getEnvironmentConfig(environment).services)
              .find(key => portManager.getEnvironmentConfig(environment).services[key] === parseInt(port)),
            description: `Stop Docker container ${container.name} using port ${port}`,
            risk_level: 'low',
            conflict_type: 'docker_conflict',
            conflict_data: {
              port: parseInt(port),
              container_name: container.name
            },
            container_info: container,
            estimated_time: 10
          };

          plan.actions.push(action);
          plan.estimated_time_seconds += action.estimated_time;
        }

        // If no processes or containers, suggest fallback port
        if (result.processes.length === 0 && result.containers.length === 0) {
          const action = {
            type: ResolutionAction.USE_FALLBACK,
            port: parseInt(port),
            service: Object.keys(portManager.getEnvironmentConfig(environment).services)
              .find(key => portManager.getEnvironmentConfig(environment).services[key] === parseInt(port)),
            description: `Use fallback port for service on port ${port}`,
            risk_level: 'low',
            conflict_type: 'port_in_use',
            conflict_data: {
              port: parseInt(port),
              reason: 'Port unavailable, no specific process identified'
            },
            estimated_time: 2
          };

          plan.actions.push(action);
          plan.estimated_time_seconds += action.estimated_time;
        }
      }
    }

    // Sort actions by risk level and estimated time
    plan.actions.sort((a, b) => {
      const riskOrder = { 'none': 0, 'low': 1, 'medium': 2, 'high': 3, 'critical': 4 };
      const riskDiff = riskOrder[a.risk_level] - riskOrder[b.risk_level];
      
      if (riskDiff === 0) {
        return a.estimated_time - b.estimated_time;
      }
      
      return riskDiff;
    });

    return plan;
  }

  /**
   * Execute resolution action
   */
  async executeResolutionAction(action) {
    const strategy = this.resolutionStrategies.get(action.type);
    
    if (!strategy) {
      return {
        success: false,
        error: `Unknown resolution action: ${action.type}`
      };
    }

    try {
      return await strategy.executor(action);
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Kill process resolution
   */
  async killProcess(action) {
    const process = action.process_info;
    
    try {
      // First try graceful shutdown
      execSync(process.getGracefulShutdownCommand(), { timeout: 5000 });
      
      // Wait a moment and check if process is gone
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const stillRunning = await process.isRunning();
      if (!stillRunning) {
        return {
          success: true,
          method: 'graceful_shutdown',
          pid: process.pid
        };
      }

      // If still running, try force kill
      execSync(process.getKillCommand(), { timeout: 5000 });
      
      return {
        success: true,
        method: 'force_kill',
        pid: process.pid
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to kill process ${process.pid}: ${error.message}`
      };
    }
  }

  /**
   * Stop container resolution
   */
  async stopContainer(action) {
    const container = action.container_info;
    
    try {
      execSync(`docker stop ${container.name}`, { timeout: 15000 });
      
      return {
        success: true,
        method: 'docker_stop',
        container: container.name
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to stop container ${container.name}: ${error.message}`
      };
    }
  }

  /**
   * Use fallback port resolution
   */
  async useFallbackPort(action) {
    try {
      const fallbackPort = portManager.findFallbackPort(action.port, action.environment || 'development');
      
      return {
        success: true,
        method: 'fallback_port',
        original_port: action.port,
        fallback_port: fallbackPort
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to find fallback port: ${error.message}`
      };
    }
  }

  /**
   * Change service port resolution
   */
  async changeServicePort(action) {
    // This would modify configuration files
    // For now, just return success with recommendation
    return {
      success: true,
      method: 'config_change_recommended',
      service: action.service,
      port: action.port,
      recommendation: `Modify ${action.service} configuration to use a different port`
    };
  }

  /**
   * Wait for port release resolution
   */
  async waitForPortRelease(action, maxWaitTime = 30000) {
    const startTime = Date.now();
    const checkInterval = 2000;
    
    while (Date.now() - startTime < maxWaitTime) {
      const available = portManager.isPortAvailable(action.port);
      
      if (available) {
        return {
          success: true,
          method: 'wait_for_release',
          port: action.port,
          wait_time_ms: Date.now() - startTime
        };
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    
    return {
      success: false,
      error: `Port ${action.port} did not become available within ${maxWaitTime}ms`
    };
  }

  /**
   * Ask for user approval (interactive mode)
   */
  async askForApproval(action, errorMessage) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      const riskColor = {
        'none': '',
        'low': '\x1b[32m',    // Green
        'medium': '\x1b[33m', // Yellow
        'high': '\x1b[31m',   // Red
        'critical': '\x1b[35m' // Magenta
      };

      const resetColor = '\x1b[0m';

      console.log(`\n${errorMessage.title}`);
      console.log(`${errorMessage.message}`);
      console.log(`\nProposed action: ${action.description}`);
      console.log(`Risk level: ${riskColor[action.risk_level]}${action.risk_level.toUpperCase()}${resetColor}`);
      
      if (errorMessage.resolution_steps) {
        console.log('\nThis will execute:');
        errorMessage.resolution_steps.forEach(step => {
          if (step.command) {
            console.log(`  ${step.step}. ${step.command}`);
          }
        });
      }

      rl.question('\nDo you want to proceed? (y/N): ', (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });
  }

  /**
   * Assess process risk level
   */
  assessProcessRisk(process) {
    const lowRiskProcesses = ['node', 'npm', 'yarn', 'webpack', 'vite', 'next', 'serve'];
    const mediumRiskProcesses = ['apache', 'nginx', 'httpd', 'postgres', 'mysql', 'redis', 'mongodb'];
    const highRiskProcesses = ['systemd', 'kernel', 'init', 'launchd', 'svchost', 'explorer'];

    const processName = process.name.toLowerCase();

    if (highRiskProcesses.some(name => processName.includes(name))) {
      return 'critical';
    } else if (mediumRiskProcesses.some(name => processName.includes(name))) {
      return 'medium';
    } else if (lowRiskProcesses.some(name => processName.includes(name))) {
      return 'low';
    }

    return 'medium'; // Default to medium risk
  }

  /**
   * Generate recommendations for unresolved conflicts
   */
  async generateRecommendations(conflictResults, environment) {
    const recommendations = [];

    for (const [port, result] of Object.entries(conflictResults.ports)) {
      if (!result.available) {
        recommendations.push({
          type: 'manual_intervention',
          port: parseInt(port),
          message: `Port ${port} still has conflicts that require manual intervention`,
          suggestions: [
            'Check if the process is critical and cannot be stopped',
            'Consider using a different port for this service',
            'Investigate why automatic resolution failed',
            'Contact system administrator if needed'
          ]
        });
      }
    }

    return recommendations;
  }

  /**
   * Get resolution history
   */
  getResolutionHistory() {
    return this.resolutionHistory;
  }

  /**
   * Export resolution report
   */
  async exportResolutionReport(resolutionResult, format = 'json') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `port-resolution-${resolutionResult.environment}-${timestamp}.${format}`;
    const filepath = path.join(__dirname, '..', 'reports', filename);

    // Ensure reports directory exists
    await fs.mkdir(path.dirname(filepath), { recursive: true });

    if (format === 'json') {
      await fs.writeFile(filepath, JSON.stringify(resolutionResult, null, 2));
    } else if (format === 'markdown') {
      const markdown = this.generateMarkdownReport(resolutionResult);
      await fs.writeFile(filepath, markdown);
    }

    return filepath;
  }

  /**
   * Generate markdown report
   */
  generateMarkdownReport(resolutionResult) {
    return `
# Port Conflict Resolution Report

**Environment:** ${resolutionResult.environment}  
**Timestamp:** ${resolutionResult.timestamp}  
**Strategy:** ${resolutionResult.strategy}  
**Final Status:** ${resolutionResult.final_status}

## Summary

- **Conflicts Detected:** ${resolutionResult.conflicts_detected}
- **Conflicts Resolved:** ${resolutionResult.conflicts_resolved}
- **Conflicts Failed:** ${resolutionResult.conflicts_failed}
- **Actions Taken:** ${resolutionResult.actions_taken.length}

## Actions Executed

${resolutionResult.actions_taken.map(action => `
### ${action.description}

- **Type:** ${action.type}
- **Port:** ${action.port}
- **Risk Level:** ${action.risk_level}
- **Result:** ${action.result ? (action.result.success ? '✅ Success' : '❌ Failed') : '🔍 Dry Run'}
${action.result && action.result.error ? `- **Error:** ${action.result.error}` : ''}
`).join('')}

## Errors

${resolutionResult.errors.length > 0 ? 
  resolutionResult.errors.map(error => `- **${error.action}:** ${error.error}`).join('\n') : 
  'No errors occurred during resolution.'}

## Recommendations

${resolutionResult.recommendations.length > 0 ? 
  resolutionResult.recommendations.map(rec => `
### ${rec.type}

**Port:** ${rec.port}  
**Message:** ${rec.message}

**Suggestions:**
${rec.suggestions.map(s => `- ${s}`).join('\n')}
`).join('') : 
  'No additional recommendations.'}
    `;
  }
}

// Export singleton instance
export const portConflictResolver = new PortConflictResolver();
export { ErrorMessageGenerator };
export default portConflictResolver;
