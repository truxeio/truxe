#!/usr/bin/env node

/**
 * Truxe Port Management CLI
 * 
 * Comprehensive command-line interface for all port management operations.
 * Provides easy access to validation, conflict resolution, monitoring, and reporting.
 * 
 * @author DevOps Engineering Team
 * @version 3.0.0
 */

import { portStartupValidator } from '../config/port-startup-validator.js';
import { portConflictResolver } from '../config/port-conflict-resolver.js';
import { portConflictDetector } from '../config/port-conflict-detector.js';
import { portMonitor } from '../config/port-monitor.js';
import portManager from '../config/ports.js';
import { StartupValidationCLI } from './startup-validator.js';
import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Port Management CLI
 */
class PortManagementCLI {
  constructor() {
    this.commands = new Map();
    this.setupCommands();
  }

  /**
   * Setup available commands
   */
  setupCommands() {
    // Validation commands
    this.commands.set('validate', {
      description: 'Run comprehensive port validation',
      usage: 'validate [environment] [options]',
      handler: this.handleValidate.bind(this)
    });

    this.commands.set('check', {
      description: 'Quick port conflict check',
      usage: 'check [environment] [ports...]',
      handler: this.handleCheck.bind(this)
    });

    // Resolution commands
    this.commands.set('resolve', {
      description: 'Resolve port conflicts automatically',
      usage: 'resolve [environment] [options]',
      handler: this.handleResolve.bind(this)
    });

    this.commands.set('kill', {
      description: 'Kill processes using specific ports',
      usage: 'kill <port1> [port2...] [options]',
      handler: this.handleKill.bind(this)
    });

    // Monitoring commands
    this.commands.set('monitor', {
      description: 'Start port monitoring',
      usage: 'monitor [environment] [options]',
      handler: this.handleMonitor.bind(this)
    });

    this.commands.set('status', {
      description: 'Show current port status',
      usage: 'status [environment]',
      handler: this.handleStatus.bind(this)
    });

    // Reporting commands
    this.commands.set('report', {
      description: 'Generate port usage reports',
      usage: 'report [type] [options]',
      handler: this.handleReport.bind(this)
    });

    this.commands.set('history', {
      description: 'Show port usage history',
      usage: 'history [port] [timeframe]',
      handler: this.handleHistory.bind(this)
    });

    // Configuration commands
    this.commands.set('config', {
      description: 'Manage port configuration',
      usage: 'config <action> [options]',
      handler: this.handleConfig.bind(this)
    });

    this.commands.set('docker', {
      description: 'Docker integration commands',
      usage: 'docker <action> [options]',
      handler: this.handleDocker.bind(this)
    });

    // Utility commands
    this.commands.set('test', {
      description: 'Test port management system',
      usage: 'test [component]',
      handler: this.handleTest.bind(this)
    });

    this.commands.set('help', {
      description: 'Show help information',
      usage: 'help [command]',
      handler: this.handleHelp.bind(this)
    });
  }

  /**
   * Parse and execute command
   */
  async run() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
      this.showMainHelp();
      return;
    }

    const command = args[0];
    const commandArgs = args.slice(1);

    if (!this.commands.has(command)) {
      console.error(`❌ Unknown command: ${command}`);
      console.log('Run "port-cli help" for available commands');
      process.exit(1);
    }

    try {
      const commandHandler = this.commands.get(command);
      await commandHandler.handler(commandArgs);
    } catch (error) {
      console.error(`❌ Command failed: ${error.message}`);
      if (process.env.DEBUG) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }

  /**
   * Handle validate command
   */
  async handleValidate(args) {
    const environment = args[0] || 'development';
    const options = this.parseOptions(args.slice(1));

    console.log(`🔍 Running port validation for ${environment} environment...`);

    const validationResult = await portStartupValidator.validateStartup(environment, {
      autoFix: options.autoFix || options.fix,
      failFast: options.failFast,
      includeOptional: !options.required,
      timeout: parseInt(options.timeout) || 30000
    });

    this.displayValidationResult(validationResult);

    if (options.export) {
      const reportPath = await portStartupValidator.exportValidationReport(validationResult, options.format || 'json');
      console.log(`📄 Report exported: ${reportPath}`);
    }

    if (!validationResult.startup_readiness.can_start && !options.noExit) {
      process.exit(1);
    }
  }

  /**
   * Handle check command
   */
  async handleCheck(args) {
    const environment = args[0] || 'development';
    let ports = args.slice(1).map(p => parseInt(p)).filter(p => !isNaN(p));

    if (ports.length === 0) {
      const envConfig = portManager.getEnvironmentConfig(environment);
      ports = Object.values(envConfig.services);
    }

    console.log(`🔍 Checking ${ports.length} ports in ${environment} environment...`);

    const results = await portConflictDetector.detectPortConflicts(ports, {
      includeProcessDetails: true
    });

    this.displayConflictResults(results);

    if (results.conflicts_detected > 0) {
      process.exit(1);
    }
  }

  /**
   * Handle resolve command
   */
  async handleResolve(args) {
    const environment = args[0] || 'development';
    const options = this.parseOptions(args.slice(1));

    console.log(`🔧 Resolving port conflicts for ${environment} environment...`);

    const resolutionResult = await portConflictResolver.resolveConflicts(environment, {
      strategy: options.strategy || 'interactive',
      autoApprove: options.auto || options.yes,
      dryRun: options.dryRun || options.dry,
      timeout: parseInt(options.timeout) || 30000
    });

    this.displayResolutionResult(resolutionResult);

    if (options.export) {
      const reportPath = await portConflictResolver.exportResolutionReport(resolutionResult, options.format || 'json');
      console.log(`📄 Report exported: ${reportPath}`);
    }
  }

  /**
   * Handle kill command
   */
  async handleKill(args) {
    const ports = args.filter(arg => !arg.startsWith('--')).map(p => parseInt(p));
    const options = this.parseOptions(args);

    if (ports.length === 0) {
      console.error('❌ No ports specified');
      process.exit(1);
    }

    console.log(`🔪 Killing processes on ports: ${ports.join(', ')}`);

    for (const port of ports) {
      try {
        const conflicts = await portConflictDetector.detectPortConflicts([port], {
          includeProcessDetails: true
        });

        const portResult = conflicts.ports[port];
        if (portResult && !portResult.available) {
          for (const process of portResult.processes) {
            try {
              const command = options.force ? process.getKillCommand() : process.getGracefulShutdownCommand();
              console.log(`   Killing process ${process.name} (PID: ${process.pid})`);
              
              if (!options.dryRun) {
                execSync(command, { timeout: 5000 });
                console.log(`   ✅ Process ${process.pid} terminated`);
              } else {
                console.log(`   🔍 DRY RUN: Would execute: ${command}`);
              }
            } catch (error) {
              console.log(`   ❌ Failed to kill process ${process.pid}: ${error.message}`);
            }
          }
        } else {
          console.log(`   ✅ Port ${port} is already available`);
        }
      } catch (error) {
        console.log(`   ❌ Failed to check port ${port}: ${error.message}`);
      }
    }
  }

  /**
   * Handle monitor command
   */
  async handleMonitor(args) {
    const environment = args[0] || 'development';
    const options = this.parseOptions(args.slice(1));

    const duration = parseInt(options.duration) || 60000;
    const frequency = parseInt(options.frequency) || 5000;

    console.log(`📊 Starting port monitoring for ${environment} environment...`);
    console.log(`Duration: ${duration}ms, Frequency: ${frequency}ms`);

    const envConfig = portManager.getEnvironmentConfig(environment);
    const ports = Object.values(envConfig.services);

    await portMonitor.startMonitoring(ports, {
      frequency,
      environment,
      enableAlerts: !options.noAlerts
    });

    // Set up event listeners
    portMonitor.on('conflict_detected', (data) => {
      console.log(`⚠️  Conflict detected on port ${data.port}`);
    });

    portMonitor.on('port_released', (data) => {
      console.log(`✅ Port ${data.port} released`);
    });

    portMonitor.on('alert', (alert) => {
      console.log(`🚨 Alert: ${alert.message}`);
    });

    // Monitor for specified duration
    await new Promise(resolve => setTimeout(resolve, duration));

    const stats = portMonitor.getPortStatistics();
    portMonitor.stopMonitoring();

    console.log('\n📊 Monitoring Summary:');
    console.log(`Total Checks: ${stats.global_stats.total_checks}`);
    console.log(`Conflicts Detected: ${stats.global_stats.conflicts_detected}`);
    console.log(`Average Response Time: ${stats.global_stats.average_response_time_ms}ms`);

    if (options.export) {
      const reportPath = await portMonitor.exportMonitoringData(options.format || 'json');
      console.log(`📄 Monitoring data exported: ${reportPath.filepath}`);
    }
  }

  /**
   * Handle status command
   */
  async handleStatus(args) {
    const environment = args[0] || 'development';
    
    console.log(`📋 Port Status for ${environment} environment:`);
    console.log('=' .repeat(60));

    const envConfig = portManager.getEnvironmentConfig(environment);
    const systemStatus = portManager.getSystemStatus(environment);

    // Display environment info
    console.log(`Environment: ${systemStatus.environment}`);
    console.log(`Port Range: ${systemStatus.port_range.start} - ${systemStatus.port_range.end}`);
    console.log(`Total Services: ${systemStatus.total_services}`);
    console.log(`Port Utilization: ${systemStatus.port_utilization}%`);
    console.log(`Status: ${systemStatus.status}`);

    // Display service ports
    console.log('\n📋 Service Ports:');
    for (const [service, port] of Object.entries(envConfig.services)) {
      const available = portManager.isPortAvailable(port);
      const status = available ? '✅ Available' : '❌ In Use';
      console.log(`  ${service.padEnd(15)} : ${port.toString().padEnd(5)} ${status}`);
    }

    // Display conflicts
    if (systemStatus.conflicts.length > 0) {
      console.log(`\n⚠️  Conflicts (${systemStatus.conflicts.length}):`);
      systemStatus.conflicts.forEach(conflict => {
        console.log(`  ${conflict.service || 'Unknown'}: Port ${conflict.port} - ${conflict.message || conflict.type}`);
      });
    }

    // Display validation issues
    if (systemStatus.validation_issues.length > 0) {
      console.log(`\n❌ Validation Issues (${systemStatus.validation_issues.length}):`);
      systemStatus.validation_issues.forEach(issue => {
        console.log(`  ${issue.service || 'System'}: ${issue.message || issue.type}`);
      });
    }

    console.log('=' .repeat(60));
  }

  /**
   * Handle report command
   */
  async handleReport(args) {
    const reportType = args[0] || 'summary';
    const options = this.parseOptions(args.slice(1));

    console.log(`📊 Generating ${reportType} report...`);

    switch (reportType) {
      case 'summary':
        await this.generateSummaryReport(options);
        break;
      case 'conflicts':
        await this.generateConflictReport(options);
        break;
      case 'monitoring':
        await this.generateMonitoringReport(options);
        break;
      case 'validation':
        await this.generateValidationReport(options);
        break;
      default:
        console.error(`❌ Unknown report type: ${reportType}`);
        console.log('Available types: summary, conflicts, monitoring, validation');
        process.exit(1);
    }
  }

  /**
   * Handle history command
   */
  async handleHistory(args) {
    const port = args[0] ? parseInt(args[0]) : null;
    const timeframe = args[1] || '24h';

    console.log(`📈 Port Usage History${port ? ` for port ${port}` : ''} (${timeframe}):`);

    if (portMonitor.getMonitoringStatus().is_monitoring) {
      const patterns = portMonitor.getUsagePatterns(timeframe);
      this.displayUsagePatterns(patterns, port);
    } else {
      console.log('⚠️  No monitoring data available. Start monitoring first with "port-cli monitor"');
    }
  }

  /**
   * Handle config command
   */
  async handleConfig(args) {
    const action = args[0];
    const options = this.parseOptions(args.slice(1));

    switch (action) {
      case 'show':
        this.showConfiguration(options.environment || 'development');
        break;
      case 'validate':
        await this.validateConfiguration(options.environment || 'development');
        break;
      case 'export':
        await this.exportConfiguration(options);
        break;
      default:
        console.error(`❌ Unknown config action: ${action}`);
        console.log('Available actions: show, validate, export');
        process.exit(1);
    }
  }

  /**
   * Handle docker command
   */
  async handleDocker(args) {
    const action = args[0];
    const options = this.parseOptions(args.slice(1));

    switch (action) {
      case 'validate':
        await this.validateDockerSetup(options);
        break;
      case 'generate':
        await this.generateDockerCompose(options);
        break;
      case 'check':
        await this.checkDockerConflicts(options);
        break;
      default:
        console.error(`❌ Unknown docker action: ${action}`);
        console.log('Available actions: validate, generate, check');
        process.exit(1);
    }
  }

  /**
   * Handle test command
   */
  async handleTest(args) {
    const component = args[0] || 'all';
    
    console.log(`🧪 Testing port management system (${component})...`);

    try {
      const testScript = path.join(__dirname, 'test-port-management.js');
      execSync(`node ${testScript}`, { stdio: 'inherit' });
    } catch (error) {
      console.error('❌ Tests failed');
      process.exit(1);
    }
  }

  /**
   * Handle help command
   */
  async handleHelp(args) {
    const command = args[0];

    if (command && this.commands.has(command)) {
      const cmd = this.commands.get(command);
      console.log(`\n📖 Help for "${command}" command:`);
      console.log(`Description: ${cmd.description}`);
      console.log(`Usage: port-cli ${cmd.usage}`);
    } else {
      this.showMainHelp();
    }
  }

  /**
   * Show main help
   */
  showMainHelp() {
    console.log(`
🚀 Truxe Port Management CLI

Usage: port-cli <command> [options]

Commands:
  validate     Run comprehensive port validation
  check        Quick port conflict check
  resolve      Resolve port conflicts automatically
  kill         Kill processes using specific ports
  monitor      Start port monitoring
  status       Show current port status
  report       Generate port usage reports
  history      Show port usage history
  config       Manage port configuration
  docker       Docker integration commands
  test         Test port management system
  help         Show help information

Examples:
  port-cli validate development --auto-fix
  port-cli check production
  port-cli resolve --strategy automatic --yes
  port-cli kill 3000 8080 --force
  port-cli monitor --duration 300000 --export
  port-cli status staging
  port-cli report conflicts --format html
  port-cli docker validate --env production

For detailed help on a specific command:
  port-cli help <command>
    `);
  }

  /**
   * Parse command options
   */
  parseOptions(args) {
    const options = {};
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg.startsWith('--')) {
        const key = arg.substring(2).replace(/-/g, '');
        const nextArg = args[i + 1];
        
        if (nextArg && !nextArg.startsWith('--')) {
          options[key] = nextArg;
          i++; // Skip next arg
        } else {
          options[key] = true;
        }
      }
    }
    
    return options;
  }

  /**
   * Display validation result
   */
  displayValidationResult(result) {
    const statusIcon = {
      'success': '✅',
      'warning': '⚠️',
      'error': '❌',
      'critical': '🚨'
    }[result.status] || '❓';

    console.log(`\n${statusIcon} Validation Result: ${result.status.toUpperCase()}`);
    console.log(`Ready for Startup: ${result.startup_readiness.can_start ? '✅ YES' : '❌ NO'}`);
    console.log(`Rules Executed: ${result.rules_executed}`);
    console.log(`Passed: ${result.rules_passed}, Failed: ${result.rules_failed}, Warnings: ${result.rules_warnings}`);
    console.log(`Validation Time: ${result.validation_time_ms}ms`);

    if (result.summary.critical_issues > 0 || result.summary.errors > 0) {
      console.log('\n🚨 Issues Found:');
      result.results.filter(r => r.status === 'error' || r.status === 'critical').forEach(issue => {
        console.log(`  • ${issue.rule_description}: ${issue.message}`);
      });
    }
  }

  /**
   * Display conflict results
   */
  displayConflictResults(results) {
    console.log(`\n📊 Conflict Detection Results:`);
    console.log(`Ports Checked: ${results.total_ports_checked}`);
    console.log(`Conflicts Found: ${results.conflicts_detected}`);

    if (results.conflicts_detected > 0) {
      console.log('\n⚠️  Port Conflicts:');
      
      for (const [port, result] of Object.entries(results.ports)) {
        if (!result.available) {
          console.log(`\n  Port ${port}:`);
          
          if (result.processes.length > 0) {
            console.log('    Processes:');
            result.processes.forEach(process => {
              console.log(`      • ${process.name} (PID: ${process.pid})`);
            });
          }
          
          if (result.containers.length > 0) {
            console.log('    Containers:');
            result.containers.forEach(container => {
              console.log(`      • ${container.name}`);
            });
          }
        }
      }
    }
  }

  /**
   * Display resolution result
   */
  displayResolutionResult(result) {
    const statusIcon = {
      'resolved': '✅',
      'partially_resolved': '⚠️',
      'failed': '❌',
      'no_conflicts': '✅'
    }[result.final_status] || '❓';

    console.log(`\n${statusIcon} Resolution Result: ${result.final_status}`);
    console.log(`Conflicts Detected: ${result.conflicts_detected}`);
    console.log(`Conflicts Resolved: ${result.conflicts_resolved}`);
    console.log(`Actions Taken: ${result.actions_taken.length}`);

    if (result.actions_taken.length > 0) {
      console.log('\n🔧 Actions Executed:');
      result.actions_taken.forEach(action => {
        const success = action.result ? action.result.success : false;
        const icon = success ? '✅' : '❌';
        console.log(`  ${icon} ${action.description}`);
      });
    }
  }

  /**
   * Generate summary report
   */
  async generateSummaryReport(options) {
    const environment = options.environment || 'development';
    const systemStatus = portManager.getSystemStatus(environment);
    
    console.log('\n📊 Port Management Summary Report');
    console.log('=' .repeat(50));
    console.log(`Environment: ${systemStatus.environment}`);
    console.log(`Timestamp: ${systemStatus.timestamp}`);
    console.log(`Overall Status: ${systemStatus.status}`);
    console.log(`Port Utilization: ${systemStatus.port_utilization}%`);
    console.log(`Total Services: ${systemStatus.total_services}`);
    console.log(`Conflicts: ${systemStatus.conflicts.length}`);
    console.log(`Validation Issues: ${systemStatus.validation_issues.length}`);
  }

  /**
   * Show configuration
   */
  showConfiguration(environment) {
    const envConfig = portManager.getEnvironmentConfig(environment);
    
    console.log(`\n⚙️  Configuration for ${environment} environment:`);
    console.log(`Name: ${envConfig.name}`);
    console.log(`Description: ${envConfig.description}`);
    console.log(`Port Range: ${envConfig.range.start} - ${envConfig.range.end}`);
    console.log(`Base Port: ${envConfig.base_port}`);
    
    console.log('\nService Ports:');
    Object.entries(envConfig.services).forEach(([service, port]) => {
      console.log(`  ${service}: ${port}`);
    });
  }

  /**
   * Display usage patterns
   */
  displayUsagePatterns(patterns, specificPort = null) {
    console.log(`\nTimeframe: ${patterns.timeframe}`);
    console.log(`Total Events: ${patterns.total_events}`);
    console.log(`Total Conflicts: ${patterns.conflict_patterns.total_conflicts}`);

    if (specificPort && patterns.port_activity[specificPort]) {
      const activity = patterns.port_activity[specificPort];
      console.log(`\nPort ${specificPort} Activity:`);
      console.log(`  Events: ${activity.events}`);
      console.log(`  Conflicts: ${activity.conflicts}`);
      console.log(`  Current Status: ${activity.last_status}`);
    } else {
      console.log('\nMost Active Ports:');
      Object.entries(patterns.port_activity)
        .sort(([,a], [,b]) => b.events - a.events)
        .slice(0, 5)
        .forEach(([port, activity]) => {
          console.log(`  Port ${port}: ${activity.events} events, ${activity.conflicts} conflicts`);
        });
    }
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = new PortManagementCLI();
  cli.run().catch(error => {
    console.error('CLI failed:', error.message);
    process.exit(1);
  });
}

export { PortManagementCLI };
export default PortManagementCLI;
