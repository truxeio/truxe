#!/usr/bin/env node

/**
 * Truxe Environment Management CLI
 * 
 * Command-line interface for managing environment-specific port ranges,
 * validation, and monitoring.
 * 
 * @author DevOps Engineering Team
 * @version 1.0.0
 */

import { program } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import environment manager
import environmentManager from '../config/environment-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CLI Configuration
const CLI_VERSION = '1.0.0';

/**
 * CLI Helper Functions
 */
class EnvironmentCLI {
  constructor() {
    this.manager = environmentManager;
  }

  /**
   * Display status information
   */
  async displayStatus() {
    try {
      const status = this.manager.getSystemStatus();
      
      console.log(chalk.blue.bold('\n🔍 Truxe Environment Management Status\n'));
      
      // System Status
      console.log(chalk.white.bold('System Status:'));
      console.log(`  Status: ${this.getStatusColor(status.status)}${status.status}${chalk.reset()}`);
      console.log(`  Initialized: ${status.initialized ? chalk.green('✓') : chalk.red('✗')}`);
      console.log(`  Current Environment: ${chalk.cyan(status.current_environment)}`);
      console.log(`  Timestamp: ${status.timestamp}\n`);
      
      // Port Manager Status
      const portStatus = status.port_manager;
      console.log(chalk.white.bold('Port Manager:'));
      console.log(`  Status: ${this.getStatusColor(portStatus.status)}${portStatus.status}${chalk.reset()}`);
      console.log(`  Port Range: ${chalk.yellow(portStatus.port_range.start)}-${chalk.yellow(portStatus.port_range.end)}`);
      console.log(`  Services: ${portStatus.total_services}`);
      console.log(`  Utilization: ${chalk.cyan(portStatus.port_utilization)}%`);
      console.log(`  Conflicts: ${portStatus.conflicts.length > 0 ? chalk.red(portStatus.conflicts.length) : chalk.green('0')}`);
      console.log(`  Validation Issues: ${portStatus.validation_issues.length > 0 ? chalk.red(portStatus.validation_issues.length) : chalk.green('0')}\n`);
      
      // Isolation Status
      const isolationStatus = status.isolation_validator;
      console.log(chalk.white.bold('Isolation Validator:'));
      console.log(`  Recent Violations: ${isolationStatus.recent_violations.length > 0 ? chalk.red(isolationStatus.recent_violations.length) : chalk.green('0')}`);
      console.log(`  Security Tokens: ${isolationStatus.security_tokens_active ? chalk.green('Active') : chalk.gray('Inactive')}`);
      console.log(`  Validation Cache: ${isolationStatus.validation_cache_size} entries\n`);
      
      // Monitor Status
      const monitorStatus = status.monitor;
      console.log(chalk.white.bold('Monitor:'));
      console.log(`  Monitoring: ${monitorStatus.is_monitoring ? chalk.green('Active') : chalk.red('Inactive')}`);
      console.log(`  Active Intervals: ${monitorStatus.active_intervals.length}`);
      console.log(`  Metrics Collected: ${monitorStatus.metrics_collected}`);
      console.log(`  Alerts: ${monitorStatus.alerts_count}`);
      console.log(`  Reports: ${monitorStatus.reports_count}`);
      console.log(`  Last Scan: ${monitorStatus.last_scan || chalk.gray('Never')}\n`);
      
    } catch (error) {
      console.error(chalk.red(`❌ Error getting status: ${error.message}`));
      process.exit(1);
    }
  }

  /**
   * Get color for status
   */
  getStatusColor(status) {
    switch (status) {
      case 'healthy':
      case 'running':
        return chalk.green;
      case 'degraded':
      case 'issues_detected':
        return chalk.yellow;
      case 'error':
      case 'failed':
        return chalk.red;
      default:
        return chalk.gray;
    }
  }

  /**
   * List available environments
   */
  async listEnvironments() {
    try {
      const environments = this.manager.portManager.getValidEnvironments();
      const currentEnv = this.manager.portManager.currentEnvironment;
      
      console.log(chalk.blue.bold('\n📋 Available Environments\n'));
      
      for (const env of environments) {
        const envConfig = this.manager.portManager.getEnvironmentConfig(env);
        const isCurrent = env === currentEnv;
        const prefix = isCurrent ? chalk.green('→ ') : '  ';
        const envName = isCurrent ? chalk.green.bold(env) : chalk.white(env);
        
        console.log(`${prefix}${envName}`);
        console.log(`    Name: ${envConfig.name}`);
        console.log(`    Port Range: ${chalk.yellow(envConfig.range.start)}-${chalk.yellow(envConfig.range.end)}`);
        console.log(`    Services: ${Object.keys(envConfig.services).length}`);
        console.log(`    Description: ${chalk.gray(envConfig.description)}\n`);
      }
      
    } catch (error) {
      console.error(chalk.red(`❌ Error listing environments: ${error.message}`));
      process.exit(1);
    }
  }

  /**
   * Switch environment
   */
  async switchEnvironment(targetEnv, options = {}) {
    try {
      const { force = false, validate = true } = options;
      const currentEnv = this.manager.portManager.currentEnvironment;
      
      if (currentEnv === targetEnv) {
        console.log(chalk.yellow(`Already in ${targetEnv} environment`));
        return;
      }
      
      // Confirm production switch
      if (targetEnv === 'production' && !force) {
        const confirm = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirmed',
          message: chalk.red.bold('⚠️  You are switching to PRODUCTION environment. Are you sure?'),
          default: false
        }]);
        
        if (!confirm.confirmed) {
          console.log(chalk.gray('Environment switch cancelled'));
          return;
        }
      }
      
      console.log(chalk.blue(`🔄 Switching from ${chalk.cyan(currentEnv)} to ${chalk.cyan(targetEnv)}...`));
      
      const newEnv = await this.manager.switchEnvironment(targetEnv, { force, validate });
      
      console.log(chalk.green(`✅ Successfully switched to ${newEnv} environment`));
      
      // Display new environment status
      await this.displayEnvironmentInfo(newEnv);
      
    } catch (error) {
      console.error(chalk.red(`❌ Failed to switch environment: ${error.message}`));
      process.exit(1);
    }
  }

  /**
   * Display environment information
   */
  async displayEnvironmentInfo(environment) {
    try {
      const envConfig = this.manager.portManager.getEnvironmentConfig(environment);
      
      console.log(chalk.blue.bold(`\n📍 Environment: ${environment}\n`));
      console.log(`Name: ${chalk.white.bold(envConfig.name)}`);
      console.log(`Port Range: ${chalk.yellow(envConfig.range.start)}-${chalk.yellow(envConfig.range.end)}`);
      console.log(`Description: ${chalk.gray(envConfig.description)}\n`);
      
      console.log(chalk.white.bold('Services:'));
      for (const [service, port] of Object.entries(envConfig.services)) {
        const available = this.manager.portManager.isPortAvailable(port);
        const status = available ? chalk.green('available') : chalk.red('in use');
        console.log(`  ${chalk.cyan(service.padEnd(20))} → ${chalk.yellow(port)} (${status})`);
      }
      
    } catch (error) {
      console.error(chalk.red(`❌ Error getting environment info: ${error.message}`));
    }
  }

  /**
   * Validate environment
   */
  async validateEnvironment(environment) {
    try {
      const targetEnv = environment || this.manager.portManager.currentEnvironment;
      
      console.log(chalk.blue(`🔍 Validating ${targetEnv} environment...\n`));
      
      // Port configuration validation
      const configIssues = this.manager.portManager.validateConfiguration(targetEnv);
      console.log(chalk.white.bold('Configuration Validation:'));
      if (configIssues.length === 0) {
        console.log(chalk.green('  ✅ No configuration issues found'));
      } else {
        console.log(chalk.red(`  ❌ Found ${configIssues.length} issues:`));
        for (const issue of configIssues) {
          console.log(`    - ${this.getSeverityColor(issue.severity)}${issue.type}: ${issue.message}${chalk.reset()}`);
        }
      }
      
      // Port conflict detection
      const conflicts = this.manager.portManager.detectConflicts(targetEnv);
      console.log(chalk.white.bold('\nConflict Detection:'));
      if (conflicts.length === 0) {
        console.log(chalk.green('  ✅ No port conflicts detected'));
      } else {
        console.log(chalk.red(`  ❌ Found ${conflicts.length} conflicts:`));
        for (const conflict of conflicts) {
          console.log(`    - ${this.getSeverityColor(conflict.severity)}${conflict.type}: ${conflict.message}${chalk.reset()}`);
        }
      }
      
      // Isolation validation
      const isolation = this.manager.isolationValidator.validateEnvironmentIsolation(targetEnv);
      console.log(chalk.white.bold('\nIsolation Validation:'));
      if (isolation.violations.length === 0) {
        console.log(chalk.green('  ✅ No isolation violations found'));
      } else {
        console.log(chalk.red(`  ❌ Found ${isolation.violations.length} violations:`));
        for (const violation of isolation.violations) {
          console.log(`    - ${this.getSeverityColor(violation.severity)}${violation.type}: ${violation.message}${chalk.reset()}`);
        }
      }
      
      console.log();
      
    } catch (error) {
      console.error(chalk.red(`❌ Validation failed: ${error.message}`));
      process.exit(1);
    }
  }

  /**
   * Get color for severity
   */
  getSeverityColor(severity) {
    switch (severity) {
      case 'critical':
        return chalk.red.bold;
      case 'high':
        return chalk.red;
      case 'medium':
        return chalk.yellow;
      case 'low':
        return chalk.gray;
      default:
        return chalk.white;
    }
  }

  /**
   * Get service port
   */
  async getServicePort(serviceName, environment) {
    try {
      const targetEnv = environment || this.manager.portManager.currentEnvironment;
      const port = this.manager.getServicePort(serviceName, { environment: targetEnv });
      
      console.log(chalk.green(`✅ ${serviceName} port in ${targetEnv}: ${chalk.yellow(port)}`));
      return port;
      
    } catch (error) {
      console.error(chalk.red(`❌ Error getting service port: ${error.message}`));
      process.exit(1);
    }
  }

  /**
   * Start monitoring
   */
  async startMonitoring() {
    try {
      if (this.manager.monitor.isMonitoring) {
        console.log(chalk.yellow('Monitoring is already running'));
        return;
      }
      
      console.log(chalk.blue('🚀 Starting environment monitoring...'));
      this.manager.monitor.startMonitoring();
      console.log(chalk.green('✅ Monitoring started successfully'));
      
    } catch (error) {
      console.error(chalk.red(`❌ Failed to start monitoring: ${error.message}`));
      process.exit(1);
    }
  }

  /**
   * Stop monitoring
   */
  async stopMonitoring() {
    try {
      if (!this.manager.monitor.isMonitoring) {
        console.log(chalk.yellow('Monitoring is not running'));
        return;
      }
      
      console.log(chalk.blue('🛑 Stopping environment monitoring...'));
      this.manager.monitor.stopMonitoring();
      console.log(chalk.green('✅ Monitoring stopped successfully'));
      
    } catch (error) {
      console.error(chalk.red(`❌ Failed to stop monitoring: ${error.message}`));
      process.exit(1);
    }
  }

  /**
   * Generate Docker Compose file
   */
  async generateDockerCompose(environment, outputPath) {
    try {
      const targetEnv = environment || this.manager.portManager.currentEnvironment;
      const config = this.manager.generateDockerComposeConfig(targetEnv);
      
      // Convert to YAML format (simplified)
      const yamlContent = this.convertToYaml(config);
      
      const outputFile = outputPath || `docker-compose.${targetEnv}.yml`;
      await fs.promises.writeFile(outputFile, yamlContent);
      
      console.log(chalk.green(`✅ Docker Compose file generated: ${outputFile}`));
      
    } catch (error) {
      console.error(chalk.red(`❌ Failed to generate Docker Compose: ${error.message}`));
      process.exit(1);
    }
  }

  /**
   * Convert config to YAML (simplified)
   */
  convertToYaml(config) {
    // This is a simplified YAML conversion
    // In production, you'd use a proper YAML library
    return `# Generated Docker Compose for ${config.environment || 'unknown'} environment
version: '${config.version}'

services:
${Object.entries(config.services || {}).map(([name, service]) => 
  `  ${name}:
    image: ${service.image || 'placeholder'}
    container_name: ${service.container_name || name}
    ports:
      - "${service.ports?.[0] || '3000:3000'}"
    networks:
      - ${service.networks?.[0] || 'default'}
    restart: ${service.restart || 'unless-stopped'}`
).join('\n\n')}

volumes:
${Object.keys(config.volumes || {}).map(name => `  ${name}:`).join('\n')}

networks:
${Object.keys(config.networks || {}).map(name => `  ${name}:`).join('\n')}
`;
  }

  /**
   * Export configuration
   */
  async exportConfig(environment, outputPath) {
    try {
      const targetEnv = environment || this.manager.portManager.currentEnvironment;
      const outputFile = outputPath || `environment-config-${targetEnv}.json`;
      
      await this.manager.exportEnvironmentConfig(targetEnv, outputFile);
      console.log(chalk.green(`✅ Configuration exported to: ${outputFile}`));
      
    } catch (error) {
      console.error(chalk.red(`❌ Failed to export configuration: ${error.message}`));
      process.exit(1);
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      console.log(chalk.blue('🔍 Performing health check...\n'));
      
      const health = await this.manager.performHealthCheck();
      
      console.log(`Overall Status: ${this.getStatusColor(health.status)}${health.status}${chalk.reset()}`);
      console.log(`Environment: ${chalk.cyan(health.environment)}`);
      console.log(`Timestamp: ${health.timestamp}\n`);
      
      console.log(chalk.white.bold('Component Checks:'));
      for (const check of health.checks) {
        const status = this.getStatusColor(check.status);
        console.log(`  ${check.component}: ${status}${check.status}${chalk.reset()}`);
      }
      
      if (health.issues.length > 0) {
        console.log(chalk.white.bold('\nIssues:'));
        for (const issue of health.issues) {
          console.log(chalk.red(`  - ${issue}`));
        }
      }
      
      console.log();
      
    } catch (error) {
      console.error(chalk.red(`❌ Health check failed: ${error.message}`));
      process.exit(1);
    }
  }

  /**
   * Reset environment
   */
  async resetEnvironment() {
    try {
      const confirm = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirmed',
        message: chalk.yellow.bold('⚠️  This will reset the environment to default state. Continue?'),
        default: false
      }]);
      
      if (!confirm.confirmed) {
        console.log(chalk.gray('Reset cancelled'));
        return;
      }
      
      console.log(chalk.blue('🔄 Resetting environment...'));
      await this.manager.resetEnvironment();
      console.log(chalk.green('✅ Environment reset completed'));
      
    } catch (error) {
      console.error(chalk.red(`❌ Failed to reset environment: ${error.message}`));
      process.exit(1);
    }
  }
}

// Initialize CLI
const cli = new EnvironmentCLI();

// Setup CLI commands
program
  .name('truxe-env')
  .description('Truxe Environment Management CLI')
  .version(CLI_VERSION);

// Status command
program
  .command('status')
  .description('Display environment management status')
  .action(() => cli.displayStatus());

// List environments command
program
  .command('list')
  .alias('ls')
  .description('List available environments')
  .action(() => cli.listEnvironments());

// Switch environment command
program
  .command('switch <environment>')
  .description('Switch to a different environment')
  .option('-f, --force', 'Force switch without validation')
  .option('--no-validate', 'Skip validation during switch')
  .action((environment, options) => cli.switchEnvironment(environment, options));

// Environment info command
program
  .command('info [environment]')
  .description('Display environment information')
  .action((environment) => cli.displayEnvironmentInfo(environment || cli.manager.portManager.currentEnvironment));

// Validate command
program
  .command('validate [environment]')
  .description('Validate environment configuration')
  .action((environment) => cli.validateEnvironment(environment));

// Port command
program
  .command('port <service> [environment]')
  .description('Get port for a service')
  .action((service, environment) => cli.getServicePort(service, environment));

// Monitoring commands
program
  .command('monitor')
  .description('Monitoring management')
  .addCommand(
    program.createCommand('start')
      .description('Start monitoring')
      .action(() => cli.startMonitoring())
  )
  .addCommand(
    program.createCommand('stop')
      .description('Stop monitoring')
      .action(() => cli.stopMonitoring())
  );

// Generate Docker Compose command
program
  .command('generate-compose [environment]')
  .description('Generate Docker Compose file for environment')
  .option('-o, --output <path>', 'Output file path')
  .action((environment, options) => cli.generateDockerCompose(environment, options.output));

// Export configuration command
program
  .command('export [environment]')
  .description('Export environment configuration')
  .option('-o, --output <path>', 'Output file path')
  .action((environment, options) => cli.exportConfig(environment, options.output));

// Health check command
program
  .command('health')
  .description('Perform health check')
  .action(() => cli.healthCheck());

// Reset command
program
  .command('reset')
  .description('Reset environment to default state')
  .action(() => cli.resetEnvironment());

// Parse command line arguments
program.parse();

export default cli;
