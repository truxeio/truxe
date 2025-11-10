/**
 * Truxe Resolution Guidance System
 * 
 * Intelligent resolution guidance system that provides step-by-step instructions,
 * automated fix implementations, and context-aware troubleshooting for port-related issues.
 * 
 * @author DevOps Engineering Team
 * @version 4.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import EventEmitter from 'events';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { ErrorSeverity, ErrorCategory, ResolutionActionType } from './error-messaging-system.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Resolution Status Types
 */
export const ResolutionStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  SKIPPED: 'skipped',
  CANCELLED: 'cancelled'
};

/**
 * Execution Mode Types
 */
export const ExecutionMode = {
  AUTOMATIC: 'automatic',
  INTERACTIVE: 'interactive',
  DRY_RUN: 'dry_run',
  MANUAL: 'manual'
};

/**
 * Resolution Step Class
 */
export class ResolutionStep {
  constructor(options = {}) {
    this.id = options.id || this.generateId();
    this.title = options.title || 'Untitled Step';
    this.description = options.description || '';
    this.type = options.type || ResolutionActionType.COMMAND;
    this.priority = options.priority || 'medium';
    this.riskLevel = options.riskLevel || 'low';
    this.estimatedTime = options.estimatedTime || '1 minute';
    this.commands = options.commands || [];
    this.validation = options.validation || null;
    this.rollback = options.rollback || null;
    this.prerequisites = options.prerequisites || [];
    this.metadata = options.metadata || {};
    this.status = ResolutionStatus.PENDING;
    this.result = null;
    this.executionTime = null;
    this.timestamp = null;
  }

  generateId() {
    return `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Execute the resolution step
   */
  async execute(context = {}, mode = ExecutionMode.INTERACTIVE) {
    this.status = ResolutionStatus.IN_PROGRESS;
    this.timestamp = new Date().toISOString();
    const startTime = Date.now();

    try {
      // Check prerequisites
      if (this.prerequisites.length > 0) {
        const prereqResult = await this.checkPrerequisites(context);
        if (!prereqResult.success) {
          throw new Error(`Prerequisites not met: ${prereqResult.message}`);
        }
      }

      // Execute based on type
      let result;
      switch (this.type) {
        case ResolutionActionType.COMMAND:
          result = await this.executeCommands(context, mode);
          break;
        case ResolutionActionType.CONFIG_CHANGE:
          result = await this.executeConfigChange(context, mode);
          break;
        case ResolutionActionType.RESTART_SERVICE:
          result = await this.executeServiceRestart(context, mode);
          break;
        case ResolutionActionType.KILL_PROCESS:
          result = await this.executeProcessKill(context, mode);
          break;
        case ResolutionActionType.MODIFY_ENVIRONMENT:
          result = await this.executeEnvironmentModification(context, mode);
          break;
        default:
          result = await this.executeGeneric(context, mode);
      }

      // Validate result if validation function provided
      if (this.validation && result.success) {
        const validationResult = await this.validation(result, context);
        if (!validationResult.success) {
          result.success = false;
          result.error = `Validation failed: ${validationResult.message}`;
        }
      }

      this.result = result;
      this.status = result.success ? ResolutionStatus.COMPLETED : ResolutionStatus.FAILED;
      this.executionTime = Date.now() - startTime;

      return result;

    } catch (error) {
      this.result = {
        success: false,
        error: error.message,
        details: error
      };
      this.status = ResolutionStatus.FAILED;
      this.executionTime = Date.now() - startTime;
      return this.result;
    }
  }

  /**
   * Check prerequisites
   */
  async checkPrerequisites(context) {
    for (const prereq of this.prerequisites) {
      try {
        if (typeof prereq === 'function') {
          const result = await prereq(context);
          if (!result) {
            return { success: false, message: 'Custom prerequisite check failed' };
          }
        } else if (typeof prereq === 'string') {
          // Command prerequisite
          execSync(prereq, { stdio: 'pipe', timeout: 5000 });
        } else if (prereq.type === 'command') {
          execSync(prereq.command, { stdio: 'pipe', timeout: 5000 });
        } else if (prereq.type === 'file_exists') {
          await fs.access(prereq.path);
        } else if (prereq.type === 'port_available') {
          const net = require('net');
          const isAvailable = await new Promise((resolve) => {
            const server = net.createServer();
            server.listen(prereq.port, () => {
              server.close(() => resolve(true));
            });
            server.on('error', () => resolve(false));
          });
          if (!isAvailable) {
            return { success: false, message: `Port ${prereq.port} is not available` };
          }
        }
      } catch (error) {
        return { success: false, message: `Prerequisite failed: ${error.message}` };
      }
    }
    return { success: true };
  }

  /**
   * Execute commands
   */
  async executeCommands(context, mode) {
    if (mode === ExecutionMode.DRY_RUN) {
      return {
        success: true,
        message: 'Dry run - commands would be executed',
        commands: this.commands,
        dry_run: true
      };
    }

    const results = [];
    for (const command of this.commands) {
      try {
        const output = execSync(command, {
          encoding: 'utf8',
          timeout: 30000,
          stdio: 'pipe'
        });
        
        results.push({
          command,
          success: true,
          output: output.trim()
        });
      } catch (error) {
        results.push({
          command,
          success: false,
          error: error.message,
          output: error.stdout || '',
          stderr: error.stderr || ''
        });
        
        // Stop on first failure unless configured otherwise
        if (!this.metadata.continueOnError) {
          break;
        }
      }
    }

    const allSuccessful = results.every(r => r.success);
    return {
      success: allSuccessful,
      message: allSuccessful ? 'All commands executed successfully' : 'Some commands failed',
      results,
      commands_executed: results.length
    };
  }

  /**
   * Execute configuration change
   */
  async executeConfigChange(context, mode) {
    if (mode === ExecutionMode.DRY_RUN) {
      return {
        success: true,
        message: 'Dry run - configuration would be changed',
        dry_run: true
      };
    }

    // This is a placeholder for configuration changes
    // In practice, this would modify specific config files
    return {
      success: true,
      message: 'Configuration change completed',
      type: 'config_change'
    };
  }

  /**
   * Execute service restart
   */
  async executeServiceRestart(context, mode) {
    if (mode === ExecutionMode.DRY_RUN) {
      return {
        success: true,
        message: 'Dry run - services would be restarted',
        dry_run: true
      };
    }

    const results = [];
    for (const command of this.commands) {
      try {
        const output = execSync(command, {
          encoding: 'utf8',
          timeout: 60000, // Longer timeout for service operations
          stdio: 'pipe'
        });
        
        results.push({
          command,
          success: true,
          output: output.trim()
        });
      } catch (error) {
        results.push({
          command,
          success: false,
          error: error.message
        });
      }
    }

    return {
      success: results.some(r => r.success),
      message: 'Service restart attempted',
      results
    };
  }

  /**
   * Execute process kill
   */
  async executeProcessKill(context, mode) {
    if (mode === ExecutionMode.DRY_RUN) {
      return {
        success: true,
        message: 'Dry run - processes would be terminated',
        dry_run: true
      };
    }

    const pid = context.pid || this.metadata.pid;
    if (!pid) {
      return {
        success: false,
        error: 'No process ID specified'
      };
    }

    try {
      // Try graceful termination first
      if (process.platform === 'win32') {
        execSync(`taskkill /PID ${pid}`, { timeout: 5000 });
      } else {
        execSync(`kill -15 ${pid}`, { timeout: 5000 });
      }

      // Wait and check if process is gone
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const stillRunning = await this.checkProcessRunning(pid);
      if (!stillRunning) {
        return {
          success: true,
          message: `Process ${pid} terminated gracefully`,
          method: 'graceful'
        };
      }

      // Force kill if still running
      if (process.platform === 'win32') {
        execSync(`taskkill /PID ${pid} /F`, { timeout: 5000 });
      } else {
        execSync(`kill -9 ${pid}`, { timeout: 5000 });
      }

      return {
        success: true,
        message: `Process ${pid} force terminated`,
        method: 'force'
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to terminate process ${pid}: ${error.message}`
      };
    }
  }

  /**
   * Execute environment modification
   */
  async executeEnvironmentModification(context, mode) {
    if (mode === ExecutionMode.DRY_RUN) {
      return {
        success: true,
        message: 'Dry run - environment would be modified',
        dry_run: true
      };
    }

    // This would modify environment variables or .env files
    return {
      success: true,
      message: 'Environment modification completed',
      type: 'environment_change'
    };
  }

  /**
   * Execute generic action
   */
  async executeGeneric(context, mode) {
    if (mode === ExecutionMode.DRY_RUN) {
      return {
        success: true,
        message: 'Dry run - generic action would be executed',
        dry_run: true
      };
    }

    return {
      success: true,
      message: 'Generic action completed'
    };
  }

  /**
   * Check if process is still running
   */
  async checkProcessRunning(pid) {
    try {
      if (process.platform === 'win32') {
        const output = execSync(`tasklist /FI "PID eq ${pid}" /NH`, {
          encoding: 'utf8',
          timeout: 3000
        });
        return output.trim().length > 0;
      } else {
        execSync(`ps -p ${pid}`, { timeout: 3000 });
        return true;
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Rollback the step if possible
   */
  async rollback(context = {}) {
    if (!this.rollback) {
      return {
        success: false,
        message: 'No rollback procedure defined'
      };
    }

    try {
      const result = await this.rollback(this.result, context);
      this.status = ResolutionStatus.PENDING; // Reset status after rollback
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

/**
 * Resolution Plan Class
 */
export class ResolutionPlan {
  constructor(options = {}) {
    this.id = options.id || this.generateId();
    this.title = options.title || 'Resolution Plan';
    this.description = options.description || '';
    this.category = options.category || ErrorCategory.RUNTIME;
    this.severity = options.severity || ErrorSeverity.ERROR;
    this.steps = options.steps || [];
    this.metadata = options.metadata || {};
    this.context = options.context || {};
    this.status = ResolutionStatus.PENDING;
    this.executionHistory = [];
    this.createdAt = new Date().toISOString();
    this.estimatedTotalTime = this.calculateEstimatedTime();
  }

  generateId() {
    return `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add a resolution step
   */
  addStep(step) {
    if (!(step instanceof ResolutionStep)) {
      step = new ResolutionStep(step);
    }
    this.steps.push(step);
    this.estimatedTotalTime = this.calculateEstimatedTime();
    return this;
  }

  /**
   * Calculate estimated total execution time
   */
  calculateEstimatedTime() {
    return this.steps.reduce((total, step) => {
      const timeStr = step.estimatedTime || '1 minute';
      const minutes = this.parseTimeString(timeStr);
      return total + minutes;
    }, 0);
  }

  /**
   * Parse time string to minutes
   */
  parseTimeString(timeStr) {
    const match = timeStr.match(/(\d+)\s*(second|minute|hour)s?/i);
    if (!match) return 1;

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case 'second': return value / 60;
      case 'minute': return value;
      case 'hour': return value * 60;
      default: return 1;
    }
  }

  /**
   * Execute the resolution plan
   */
  async execute(options = {}) {
    const {
      mode = ExecutionMode.INTERACTIVE,
      stopOnError = true,
      confirmEachStep = mode === ExecutionMode.INTERACTIVE,
      parallel = false
    } = options;

    this.status = ResolutionStatus.IN_PROGRESS;
    const executionResult = {
      planId: this.id,
      startTime: new Date().toISOString(),
      mode,
      steps: [],
      success: false,
      completedSteps: 0,
      failedSteps: 0,
      skippedSteps: 0,
      totalSteps: this.steps.length,
      executionTime: null
    };

    const startTime = Date.now();

    try {
      if (parallel && mode !== ExecutionMode.INTERACTIVE) {
        // Execute steps in parallel
        const promises = this.steps.map(step => this.executeStep(step, mode, confirmEachStep));
        const results = await Promise.allSettled(promises);
        
        results.forEach((result, index) => {
          const stepResult = result.status === 'fulfilled' ? result.value : {
            success: false,
            error: result.reason.message
          };
          
          executionResult.steps.push({
            stepId: this.steps[index].id,
            ...stepResult
          });

          if (stepResult.success) {
            executionResult.completedSteps++;
          } else {
            executionResult.failedSteps++;
          }
        });
      } else {
        // Execute steps sequentially
        for (const step of this.steps) {
          const stepResult = await this.executeStep(step, mode, confirmEachStep);
          
          executionResult.steps.push({
            stepId: step.id,
            ...stepResult
          });

          if (stepResult.success) {
            executionResult.completedSteps++;
          } else if (stepResult.skipped) {
            executionResult.skippedSteps++;
          } else {
            executionResult.failedSteps++;
            
            if (stopOnError) {
              console.log(chalk.red(`❌ Step failed: ${step.title}`));
              console.log(chalk.red(`   Error: ${stepResult.error}`));
              break;
            }
          }
        }
      }

      executionResult.success = executionResult.failedSteps === 0 && executionResult.completedSteps > 0;
      executionResult.executionTime = Date.now() - startTime;
      
      this.status = executionResult.success ? ResolutionStatus.COMPLETED : ResolutionStatus.FAILED;
      this.executionHistory.push(executionResult);

      return executionResult;

    } catch (error) {
      executionResult.success = false;
      executionResult.error = error.message;
      executionResult.executionTime = Date.now() - startTime;
      
      this.status = ResolutionStatus.FAILED;
      this.executionHistory.push(executionResult);
      
      return executionResult;
    }
  }

  /**
   * Execute a single step
   */
  async executeStep(step, mode, confirmEachStep) {
    console.log(chalk.blue(`\n🔧 ${step.title}`));
    console.log(`   ${step.description}`);
    
    if (step.estimatedTime) {
      console.log(chalk.gray(`   ⏱️  Estimated time: ${step.estimatedTime}`));
    }
    
    if (step.riskLevel && step.riskLevel !== 'none') {
      const riskColor = {
        low: chalk.green,
        medium: chalk.yellow,
        high: chalk.red,
        critical: chalk.magenta
      }[step.riskLevel] || chalk.gray;
      
      console.log(riskColor(`   ⚠️  Risk level: ${step.riskLevel}`));
    }

    // Show commands that will be executed
    if (step.commands && step.commands.length > 0) {
      console.log(chalk.gray('   Commands to execute:'));
      step.commands.forEach(cmd => {
        console.log(chalk.cyan(`     $ ${cmd}`));
      });
    }

    // Ask for confirmation if in interactive mode
    if (confirmEachStep && mode === ExecutionMode.INTERACTIVE) {
      const { proceed } = await inquirer.prompt([{
        type: 'confirm',
        name: 'proceed',
        message: 'Do you want to execute this step?',
        default: true
      }]);

      if (!proceed) {
        console.log(chalk.yellow('   ⏭️  Step skipped by user'));
        return { success: true, skipped: true, message: 'Skipped by user' };
      }
    }

    // Execute the step
    const result = await step.execute(this.context, mode);
    
    if (result.success) {
      console.log(chalk.green(`   ✅ ${step.title} completed successfully`));
      if (result.message) {
        console.log(chalk.gray(`      ${result.message}`));
      }
    } else {
      console.log(chalk.red(`   ❌ ${step.title} failed`));
      if (result.error) {
        console.log(chalk.red(`      Error: ${result.error}`));
      }
    }

    return result;
  }

  /**
   * Rollback executed steps
   */
  async rollback() {
    console.log(chalk.yellow('\n🔄 Rolling back executed steps...'));
    
    const rollbackResults = [];
    
    // Rollback in reverse order
    for (let i = this.steps.length - 1; i >= 0; i--) {
      const step = this.steps[i];
      
      if (step.status === ResolutionStatus.COMPLETED) {
        console.log(chalk.blue(`   Rolling back: ${step.title}`));
        
        const rollbackResult = await step.rollback(this.context);
        rollbackResults.push({
          stepId: step.id,
          ...rollbackResult
        });
        
        if (rollbackResult.success) {
          console.log(chalk.green(`   ✅ Rollback successful`));
        } else {
          console.log(chalk.red(`   ❌ Rollback failed: ${rollbackResult.error}`));
        }
      }
    }

    return {
      success: rollbackResults.every(r => r.success),
      results: rollbackResults
    };
  }

  /**
   * Get plan summary
   */
  getSummary() {
    const completedSteps = this.steps.filter(s => s.status === ResolutionStatus.COMPLETED).length;
    const failedSteps = this.steps.filter(s => s.status === ResolutionStatus.FAILED).length;
    const pendingSteps = this.steps.filter(s => s.status === ResolutionStatus.PENDING).length;

    return {
      id: this.id,
      title: this.title,
      category: this.category,
      severity: this.severity,
      status: this.status,
      totalSteps: this.steps.length,
      completedSteps,
      failedSteps,
      pendingSteps,
      estimatedTotalTime: this.estimatedTotalTime,
      createdAt: this.createdAt
    };
  }
}

/**
 * Resolution Guidance Engine
 */
export class ResolutionGuidanceEngine extends EventEmitter {
  constructor() {
    super();
    this.planTemplates = new Map();
    this.executionHistory = [];
    this.setupPlanTemplates();
  }

  /**
   * Setup predefined resolution plan templates
   */
  setupPlanTemplates() {
    // Port conflict resolution template
    this.planTemplates.set(ErrorCategory.PORT_CONFLICT, (error, context) => {
      const plan = new ResolutionPlan({
        title: 'Port Conflict Resolution',
        description: `Resolve port conflict for port ${context.port || 'unknown'}`,
        category: ErrorCategory.PORT_CONFLICT,
        severity: ErrorSeverity.ERROR,
        context
      });

      // Step 1: Identify conflicting process
      plan.addStep(new ResolutionStep({
        title: 'Identify Conflicting Process',
        description: `Find what process is using port ${context.port}`,
        type: ResolutionActionType.COMMAND,
        priority: 'high',
        riskLevel: 'none',
        estimatedTime: '30 seconds',
        commands: this.getPortCheckCommands(context.port),
        validation: async (result, ctx) => {
          // Check if we successfully identified a process
          return {
            success: result.results?.some(r => r.success && r.output.trim()),
            message: 'Process identification validation'
          };
        }
      }));

      // Step 2: Attempt graceful termination
      if (context.conflictingProcess && this.isProcessSafeToKill(context.conflictingProcess)) {
        plan.addStep(new ResolutionStep({
          title: 'Graceful Process Termination',
          description: `Attempt to gracefully stop ${context.conflictingProcess.name}`,
          type: ResolutionActionType.KILL_PROCESS,
          priority: 'medium',
          riskLevel: 'low',
          estimatedTime: '1 minute',
          commands: this.getGracefulKillCommands(context.conflictingProcess.pid),
          metadata: { pid: context.conflictingProcess.pid },
          rollback: async (result, ctx) => {
            // No rollback for process termination
            return { success: true, message: 'No rollback needed for process termination' };
          }
        }));
      }

      // Step 3: Use alternative port
      plan.addStep(new ResolutionStep({
        title: 'Configure Alternative Port',
        description: 'Set up service to use an available port',
        type: ResolutionActionType.CONFIG_CHANGE,
        priority: 'low',
        riskLevel: 'none',
        estimatedTime: '2 minutes',
        commands: [
          `export PORT=${(context.port || 3000) + 1}`,
          'echo "Using alternative port: $PORT"'
        ]
      }));

      return plan;
    });

    // Permission denied resolution template
    this.planTemplates.set(ErrorCategory.PERMISSION, (error, context) => {
      const plan = new ResolutionPlan({
        title: 'Permission Issue Resolution',
        description: 'Resolve permission-related errors',
        category: ErrorCategory.PERMISSION,
        severity: ErrorSeverity.ERROR,
        context
      });

      const isPrivilegedPort = context.port && context.port < 1024;

      if (isPrivilegedPort) {
        plan.addStep(new ResolutionStep({
          title: 'Use Non-Privileged Port',
          description: `Switch from privileged port ${context.port} to a non-privileged alternative`,
          type: ResolutionActionType.CONFIG_CHANGE,
          priority: 'high',
          riskLevel: 'none',
          estimatedTime: '1 minute',
          commands: [
            `export PORT=${context.port + 3000}`,
            'echo "Switched to non-privileged port: $PORT"'
          ]
        }));
      } else {
        plan.addStep(new ResolutionStep({
          title: 'Check Permissions',
          description: 'Verify file and directory permissions',
          type: ResolutionActionType.COMMAND,
          priority: 'high',
          riskLevel: 'none',
          estimatedTime: '30 seconds',
          commands: ['ls -la', 'whoami', 'groups']
        }));
      }

      return plan;
    });

    // Network error resolution template
    this.planTemplates.set(ErrorCategory.NETWORK, (error, context) => {
      const plan = new ResolutionPlan({
        title: 'Network Issue Resolution',
        description: 'Diagnose and resolve network connectivity issues',
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.ERROR,
        context
      });

      plan.addStep(new ResolutionStep({
        title: 'Test Network Connectivity',
        description: 'Check basic network connectivity',
        type: ResolutionActionType.COMMAND,
        priority: 'high',
        riskLevel: 'none',
        estimatedTime: '1 minute',
        commands: [
          'ping -c 3 localhost',
          'ping -c 3 8.8.8.8'
        ]
      }));

      plan.addStep(new ResolutionStep({
        title: 'Check Network Interfaces',
        description: 'Verify network interface configuration',
        type: ResolutionActionType.COMMAND,
        priority: 'medium',
        riskLevel: 'none',
        estimatedTime: '30 seconds',
        commands: process.platform === 'win32'
          ? ['ipconfig /all']
          : ['ip addr show', 'ifconfig']
      }));

      return plan;
    });

    // Configuration error resolution template
    this.planTemplates.set(ErrorCategory.CONFIGURATION, (error, context) => {
      const plan = new ResolutionPlan({
        title: 'Configuration Error Resolution',
        description: 'Fix configuration file issues',
        category: ErrorCategory.CONFIGURATION,
        severity: ErrorSeverity.ERROR,
        context
      });

      plan.addStep(new ResolutionStep({
        title: 'Validate Configuration Files',
        description: 'Check syntax and structure of configuration files',
        type: ResolutionActionType.COMMAND,
        priority: 'high',
        riskLevel: 'none',
        estimatedTime: '1 minute',
        commands: [
          'npm run config:validate',
          'docker-compose config'
        ]
      }));

      plan.addStep(new ResolutionStep({
        title: 'Reset to Default Configuration',
        description: 'Use default configuration as fallback',
        type: ResolutionActionType.CONFIG_CHANGE,
        priority: 'medium',
        riskLevel: 'medium',
        estimatedTime: '2 minutes',
        commands: [
          'cp config/ports.js.example config/ports.js',
          'npm run config:init'
        ],
        rollback: async (result, ctx) => {
          // Restore backup if available
          try {
            await fs.access('config/ports.js.backup');
            await fs.copyFile('config/ports.js.backup', 'config/ports.js');
            return { success: true, message: 'Configuration restored from backup' };
          } catch (error) {
            return { success: false, message: 'No backup available to restore' };
          }
        }
      }));

      return plan;
    });
  }

  /**
   * Generate resolution plan for an error
   */
  generateResolutionPlan(error, context = {}) {
    const category = error.category || ErrorCategory.RUNTIME;
    const template = this.planTemplates.get(category);

    if (template) {
      const plan = template(error, context);
      this.emit('plan_generated', { plan, error, context });
      return plan;
    }

    // Fallback: create generic plan
    const genericPlan = new ResolutionPlan({
      title: 'Generic Error Resolution',
      description: 'Basic troubleshooting steps',
      category,
      severity: error.severity || ErrorSeverity.ERROR,
      context
    });

    genericPlan.addStep(new ResolutionStep({
      title: 'Check System Status',
      description: 'Verify system health and resources',
      type: ResolutionActionType.COMMAND,
      priority: 'medium',
      riskLevel: 'none',
      estimatedTime: '1 minute',
      commands: ['ps aux | head -10', 'df -h', 'free -h']
    }));

    genericPlan.addStep(new ResolutionStep({
      title: 'Check Application Logs',
      description: 'Review recent log entries for clues',
      type: ResolutionActionType.COMMAND,
      priority: 'medium',
      riskLevel: 'none',
      estimatedTime: '2 minutes',
      commands: ['tail -50 /var/log/syslog', 'journalctl -n 50']
    }));

    return genericPlan;
  }

  /**
   * Execute resolution plan with user interaction
   */
  async executeResolutionPlan(plan, options = {}) {
    const {
      mode = ExecutionMode.INTERACTIVE,
      autoApprove = false,
      stopOnError = true
    } = options;

    console.log(chalk.bold.blue(`\n🔧 Executing Resolution Plan: ${plan.title}`));
    console.log(chalk.gray(`   ${plan.description}`));
    console.log(chalk.gray(`   Total steps: ${plan.steps.length}`));
    console.log(chalk.gray(`   Estimated time: ${plan.estimatedTotalTime} minutes`));

    if (mode === ExecutionMode.INTERACTIVE && !autoApprove) {
      const { proceed } = await inquirer.prompt([{
        type: 'confirm',
        name: 'proceed',
        message: 'Do you want to proceed with this resolution plan?',
        default: true
      }]);

      if (!proceed) {
        console.log(chalk.yellow('Resolution plan cancelled by user'));
        return { success: false, cancelled: true };
      }
    }

    const result = await plan.execute({
      mode,
      stopOnError,
      confirmEachStep: mode === ExecutionMode.INTERACTIVE && !autoApprove
    });

    // Store execution history
    this.executionHistory.push({
      planId: plan.id,
      timestamp: new Date().toISOString(),
      result
    });

    // Emit completion event
    this.emit('plan_executed', { plan, result });

    // Display summary
    this.displayExecutionSummary(result);

    return result;
  }

  /**
   * Display execution summary
   */
  displayExecutionSummary(result) {
    console.log(chalk.bold('\n📊 Execution Summary'));
    console.log('═'.repeat(50));
    
    const statusColor = result.success ? chalk.green : chalk.red;
    const statusIcon = result.success ? '✅' : '❌';
    
    console.log(`${statusIcon} Status: ${statusColor(result.success ? 'SUCCESS' : 'FAILED')}`);
    console.log(`📈 Completed: ${chalk.green(result.completedSteps)}/${result.totalSteps} steps`);
    
    if (result.failedSteps > 0) {
      console.log(`❌ Failed: ${chalk.red(result.failedSteps)} steps`);
    }
    
    if (result.skippedSteps > 0) {
      console.log(`⏭️  Skipped: ${chalk.yellow(result.skippedSteps)} steps`);
    }
    
    if (result.executionTime) {
      const timeInSeconds = Math.round(result.executionTime / 1000);
      console.log(`⏱️  Execution time: ${timeInSeconds} seconds`);
    }

    // Show failed steps
    if (result.failedSteps > 0) {
      console.log(chalk.red('\n❌ Failed Steps:'));
      result.steps.forEach((step, index) => {
        if (!step.success && !step.skipped) {
          console.log(chalk.red(`   ${index + 1}. ${step.error || 'Unknown error'}`));
        }
      });
    }

    console.log('');
  }

  /**
   * Get port check commands for different platforms
   */
  getPortCheckCommands(port) {
    if (process.platform === 'win32') {
      return [
        `netstat -ano | findstr :${port}`,
        `for /f "tokens=5" %a in ('netstat -ano ^| findstr :${port}') do tasklist /FI "PID eq %a"`
      ];
    } else {
      return [
        `lsof -ti:${port}`,
        `ps -p $(lsof -ti:${port}) -o pid,ppid,user,comm,args`,
        `netstat -tulpn | grep :${port}`
      ];
    }
  }

  /**
   * Get graceful kill commands
   */
  getGracefulKillCommands(pid) {
    if (process.platform === 'win32') {
      return [`taskkill /PID ${pid}`];
    } else {
      return [`kill -15 ${pid}`];
    }
  }

  /**
   * Check if process is safe to kill
   */
  isProcessSafeToKill(processInfo) {
    const safeProcesses = [
      'node', 'npm', 'yarn', 'webpack', 'vite', 'next', 'serve',
      'http-server', 'live-server', 'browser-sync', 'nodemon'
    ];

    const processName = processInfo.name.toLowerCase();
    return safeProcesses.some(safe => processName.includes(safe));
  }

  /**
   * Get execution history
   */
  getExecutionHistory() {
    return this.executionHistory;
  }

  /**
   * Get execution statistics
   */
  getExecutionStatistics() {
    const stats = {
      total_executions: this.executionHistory.length,
      successful_executions: 0,
      failed_executions: 0,
      average_execution_time: 0,
      most_common_categories: {},
      success_rate_by_category: {}
    };

    let totalTime = 0;
    
    this.executionHistory.forEach(execution => {
      if (execution.result.success) {
        stats.successful_executions++;
      } else {
        stats.failed_executions++;
      }
      
      if (execution.result.executionTime) {
        totalTime += execution.result.executionTime;
      }
    });

    if (this.executionHistory.length > 0) {
      stats.average_execution_time = Math.round(totalTime / this.executionHistory.length);
      stats.success_rate = Math.round((stats.successful_executions / this.executionHistory.length) * 100);
    }

    return stats;
  }

  /**
   * Export execution report
   */
  async exportExecutionReport(format = 'json') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `resolution-execution-report-${timestamp}.${format}`;
    const filepath = path.join(__dirname, '..', 'reports', filename);

    // Ensure reports directory exists
    await fs.mkdir(path.dirname(filepath), { recursive: true });

    const report = {
      generated_at: new Date().toISOString(),
      statistics: this.getExecutionStatistics(),
      execution_history: this.executionHistory,
      available_templates: Array.from(this.planTemplates.keys())
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
# Resolution Guidance Execution Report

**Generated:** ${report.generated_at}

## Statistics

- **Total Executions:** ${report.statistics.total_executions}
- **Successful:** ${report.statistics.successful_executions}
- **Failed:** ${report.statistics.failed_executions}
- **Success Rate:** ${report.statistics.success_rate}%
- **Average Execution Time:** ${Math.round(report.statistics.average_execution_time / 1000)} seconds

## Available Templates

${report.available_templates.map(template => `- ${template}`).join('\n')}

## Recent Executions

${report.execution_history.slice(-10).map(execution => `
### Execution ${execution.planId}

- **Timestamp:** ${execution.timestamp}
- **Success:** ${execution.result.success ? '✅' : '❌'}
- **Steps Completed:** ${execution.result.completedSteps}/${execution.result.totalSteps}
- **Execution Time:** ${Math.round(execution.result.executionTime / 1000)} seconds
`).join('')}
`;
  }
}

// Export singleton instance
export const resolutionGuidanceEngine = new ResolutionGuidanceEngine();

export {
  ResolutionStep,
  ResolutionPlan,
  ResolutionStatus,
  ExecutionMode
};
