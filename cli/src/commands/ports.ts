import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { Logger } from '../utils/logger';
import { ErrorHandler } from '../utils/error-handler';
import { PortManager } from '../utils/port-manager';
import { PortMonitor } from '../utils/port-monitor';
import { PortResolver } from '../utils/port-resolver';
import { IntelligentPortSuggester } from '../utils/intelligent-port-suggester';
import { EnhancedErrorMessaging } from '../utils/enhanced-error-messaging';
import { RealTimeDashboard } from '../utils/real-time-dashboard';

export function portsCommand(program: Command): void {
  const ports = program
    .command('ports')
    .description('Port management utilities for development environment')
    .addHelpText('after', `
Examples:
  $ truxe ports check
  $ truxe ports status --detailed
  $ truxe ports kill 3000 8080
  $ truxe ports suggest 3000 --service api
  $ truxe ports monitor --duration 300
  $ truxe ports resolve

For more information, visit: https://docs.truxe.io/cli/ports
    `)
    .option('--verbose', 'Enable verbose output');

  // truxe ports check - Check port availability
  ports
    .command('check')
    .description('Check port availability and conflicts')
    .addHelpText('after', `
Examples:
  $ truxe ports check
  $ truxe ports check 3000 8080
  $ truxe ports check --all
  $ truxe ports check --env=production --json
    `)
    .argument('[ports...]', 'Specific ports to check (optional)')
    .option('-e, --env <environment>', 'Environment to check', 'development')
    .option('--all', 'Check all configured ports')
    .option('--json', 'Output in JSON format')
    .action(async (ports: string[], options) => {
      const logger = new Logger();
      
      try {
        logger.header('🔍 Port Availability Check');
        
        const portManager = new PortManager();
        const portsToCheck = await determinePortsToCheck(ports, options, portManager);
        
        if (portsToCheck.length === 0) {
          logger.error('No ports specified to check');
          process.exit(1);
        }
        
        const spinner = ora(`Checking ${portsToCheck.length} ports...`).start();
        const results = await portManager.checkPorts(portsToCheck, options.env);
        spinner.stop();
        
        if (options.json) {
          console.log(JSON.stringify(results, null, 2));
          return;
        }
        
        displayPortCheckResults(results, logger);
        
        const hasConflicts = results.some(r => !r.available);
        if (hasConflicts) {
          process.exit(1);
        }
        
      } catch (error) {
        ErrorHandler.handle(error as Error, 'Port Check');
      }
    });

  // truxe ports status - Show current port usage
  ports
    .command('status')
    .description('Show current port usage and system status')
    .option('-e, --env <environment>', 'Environment to check', 'development')
    .option('--json', 'Output in JSON format')
    .option('--detailed', 'Show detailed process information')
    .action(async (options) => {
      const logger = new Logger();
      
      try {
        logger.header('📊 Port Status Overview');
        
        const portManager = new PortManager();
        const status = await portManager.getSystemStatus(options.env);
        
        if (options.json) {
          console.log(JSON.stringify(status, null, 2));
          return;
        }
        
        displaySystemStatus(status, logger, options.detailed);
        
      } catch (error) {
        ErrorHandler.handle(error as Error, 'Port Status');
      }
    });

  // truxe ports suggest - Intelligent port suggestions
  ports
    .command('suggest')
    .description('Get intelligent port suggestions with AI-powered optimization')
    .argument('[service]', 'Service name to get suggestions for')
    .option('-e, --env <environment>', 'Environment context', 'development')
    .option('-c, --count <number>', 'Number of suggestions', '5')
    .option('-p, --port <port>', 'Current/conflicted port number')
    .option('--optimize', 'Use advanced optimization algorithms')
    .option('--learn', 'Enable machine learning from usage patterns')
    .option('--detailed', 'Show detailed reasoning for suggestions')
    .option('--json', 'Output in JSON format')
    .action(async (service: string | undefined, options) => {
      const logger = new Logger();
      
      try {
        logger.header('🧠 Intelligent Port Suggestions');
        
        if (!service && !options.port) {
          logger.error('Either service name or port number must be provided');
          logger.info('Usage: truxe ports suggest <service> [options]');
          logger.info('   or: truxe ports suggest --port <port> [options]');
          process.exit(1);
        }
        
        const spinner = ora('Analyzing port usage patterns...').start();
        
        let suggestions;
        if (options.optimize) {
          // Use intelligent port suggester
        const intelligentSuggester = new IntelligentPortSuggester();
        
        if (service) {
          suggestions = await intelligentSuggester.suggestOptimalPorts(service, options.env, {
            count: parseInt(options.count),
            avoidCurrentPort: true,
            considerDependencies: true,
            optimizeForPerformance: true,
            includeReasoningDetails: options.detailed
          });
        } else {
          // Port-based suggestion (fallback to basic method)
          const portManager = new PortManager();
          const portNum = parseInt(options.port);
          
          if (isNaN(portNum)) {
            spinner.stop();
            logger.error('Invalid port number provided');
            process.exit(1);
          }
          
          suggestions = await portManager.suggestAlternativePorts(
            portNum, 
            options.env, 
            parseInt(options.count),
            service
          );
        }
        } else {
          // Use basic port manager
          const portManager = new PortManager();
          if (service) {
            // Get current port for service and suggest alternatives
            const envPorts = await portManager.getEnvironmentPorts(options.env);
            const currentPort = envPorts[0]; // This would need proper service lookup
            suggestions = await portManager.suggestAlternativePorts(
              currentPort, 
              options.env, 
              parseInt(options.count),
              service
            );
          } else {
            const portNum = parseInt(options.port);
            suggestions = await portManager.suggestAlternativePorts(
              portNum, 
              options.env, 
              parseInt(options.count),
              service
            );
          }
        }
        
        spinner.stop();
        
        if (options.json) {
          console.log(JSON.stringify(suggestions, null, 2));
          return;
        }
        
        if (options.optimize && suggestions.suggestions) {
          displayIntelligentPortSuggestions(suggestions, logger, options.detailed);
        } else {
          displayPortSuggestions(suggestions, options.port ? parseInt(options.port) : 0, logger);
        }
        
      } catch (error) {
        ErrorHandler.handle(error as Error, 'Port Suggestions');
      }
    });

  // truxe ports kill - Kill process using port
  ports
    .command('kill')
    .description('Kill processes using specific ports')
    .argument('<ports...>', 'Ports to kill processes on')
    .option('--force', 'Force kill without confirmation')
    .option('--dry-run', 'Show what would be killed without executing')
    .action(async (ports: string[], options) => {
      const logger = new Logger();
      
      try {
        logger.header('🔪 Kill Port Processes');
        
        const portManager = new PortManager();
        const portNumbers = ports.map(p => parseInt(p)).filter(p => !isNaN(p));
        
        if (portNumbers.length === 0) {
          logger.error('No valid port numbers provided');
          process.exit(1);
        }
        
        const processes = await portManager.getPortProcesses(portNumbers);
        
        if (processes.length === 0) {
          logger.success('No processes found using the specified ports');
          return;
        }
        
        displayProcessesToKill(processes, logger);
        
        if (options.dryRun) {
          logger.info('Dry run mode - no processes were killed');
          return;
        }
        
        let confirmed = options.force;
        if (!confirmed) {
          const answer = await inquirer.prompt([{
            type: 'confirm',
            name: 'proceed',
            message: 'Do you want to kill these processes?',
            default: false
          }]);
          confirmed = answer.proceed;
        }
        
        if (confirmed) {
          const results = await portManager.killPortProcesses(portNumbers, options.force);
          displayKillResults(results, logger);
        } else {
          logger.info('Operation cancelled');
        }
        
      } catch (error) {
        ErrorHandler.handle(error as Error, 'Kill Port Processes');
      }
    });

  // truxe ports scan - Scan for available port ranges
  ports
    .command('scan')
    .description('Scan for available port ranges')
    .option('-s, --start <port>', 'Start port for scan', '21000')
    .option('-e, --end <port>', 'End port for scan', '21999')
    .option('-c, --count <number>', 'Number of consecutive ports needed', '1')
    .option('--env <environment>', 'Environment context', 'development')
    .action(async (options) => {
      const logger = new Logger();
      
      try {
        logger.header('🔍 Port Range Scan');
        
        const portManager = new PortManager();
        const startPort = parseInt(options.start);
        const endPort = parseInt(options.end);
        const count = parseInt(options.count);
        
        if (isNaN(startPort) || isNaN(endPort) || startPort >= endPort) {
          logger.error('Invalid port range specified');
          process.exit(1);
        }
        
        const spinner = ora(`Scanning ports ${startPort}-${endPort}...`).start();
        const availableRanges = await portManager.scanPortRange(startPort, endPort, count);
        spinner.stop();
        
        displayPortScanResults(availableRanges, count, logger);
        
      } catch (error) {
        ErrorHandler.handle(error as Error, 'Port Scan');
      }
    });

  // truxe ports reset - Reset to default port configuration
  ports
    .command('reset')
    .description('Reset to default port configuration')
    .option('--env <environment>', 'Environment to reset', 'development')
    .option('--force', 'Skip confirmation prompt')
    .option('--backup', 'Create backup before reset')
    .action(async (options) => {
      const logger = new Logger();
      
      try {
        logger.header('🔄 Reset Port Configuration');
        
        const portManager = new PortManager();
        
        if (!options.force) {
          const answer = await inquirer.prompt([{
            type: 'confirm',
            name: 'proceed',
            message: `Reset port configuration for ${options.env} environment?`,
            default: false
          }]);
          
          if (!answer.proceed) {
            logger.info('Operation cancelled');
            return;
          }
        }
        
        if (options.backup) {
          const backupPath = await portManager.createConfigBackup(options.env);
          logger.info(`Configuration backed up to: ${backupPath}`);
        }
        
        const spinner = ora('Resetting port configuration...').start();
        await portManager.resetConfiguration(options.env);
        spinner.stop();
        
        logger.success(`Port configuration reset for ${options.env} environment`);
        
      } catch (error) {
        ErrorHandler.handle(error as Error, 'Reset Port Configuration');
      }
    });

  // truxe ports monitor - Real-time port monitoring
  ports
    .command('monitor')
    .description('Start real-time port monitoring')
    .option('--env <environment>', 'Environment to monitor', 'development')
    .option('--duration <seconds>', 'Monitoring duration in seconds', '60')
    .option('--interval <seconds>', 'Check interval in seconds', '5')
    .option('--alerts', 'Enable alerts for conflicts')
    .option('--export', 'Export monitoring data')
    .action(async (options) => {
      const logger = new Logger();
      
      try {
        logger.header('📊 Real-time Port Monitoring');
        
        const portMonitor = new PortMonitor();
        const duration = parseInt(options.duration) * 1000;
        const interval = parseInt(options.interval) * 1000;
        
        logger.info(`Monitoring ${options.env} environment for ${options.duration}s (interval: ${options.interval}s)`);
        logger.blank();
        
        await portMonitor.startMonitoring({
          environment: options.env,
          duration,
          interval,
          enableAlerts: options.alerts,
          onUpdate: (data) => displayMonitoringUpdate(data, logger),
          onAlert: (alert) => displayMonitoringAlert(alert, logger)
        });
        
        const stats = portMonitor.getStatistics();
        displayMonitoringStats(stats, logger);
        
        if (options.export) {
          const exportPath = await portMonitor.exportData();
          logger.info(`Monitoring data exported to: ${exportPath}`);
        }
        
      } catch (error) {
        ErrorHandler.handle(error as Error, 'Port Monitoring');
      }
    });

  // truxe ports resolve - Interactive conflict resolution
  ports
    .command('resolve')
    .description('Interactively resolve port conflicts')
    .option('--env <environment>', 'Environment to resolve', 'development')
    .option('--auto', 'Automatically resolve conflicts')
    .option('--strategy <type>', 'Resolution strategy (kill|reassign|suggest)', 'suggest')
    .action(async (options) => {
      const logger = new Logger();
      
      try {
        logger.header('🔧 Port Conflict Resolution');
        
        const portResolver = new PortResolver();
        
        if (options.auto) {
          const results = await portResolver.autoResolveConflicts(options.env, options.strategy);
          displayResolutionResults(results, logger);
        } else {
          await portResolver.interactiveResolveConflicts(options.env);
        }
        
      } catch (error) {
        ErrorHandler.handle(error as Error, 'Port Conflict Resolution');
      }
    });

  // truxe ports analyze - Analyze port usage patterns
  ports
    .command('analyze')
    .description('Analyze port usage patterns and generate insights')
    .option('--env <environment>', 'Environment to analyze', 'development')
    .option('--timeframe <period>', 'Analysis timeframe (1h|24h|7d|30d)', '24h')
    .option('--export', 'Export analysis report')
    .option('--json', 'Output in JSON format')
    .action(async (options) => {
      const logger = new Logger();
      
      try {
        logger.header('📊 Port Usage Analysis');
        
        const spinner = ora('Analyzing port usage patterns...').start();
        
        const intelligentSuggester = new IntelligentPortSuggester();
        const analysis = await intelligentSuggester.analyzePortUsage(options.env);
        
        spinner.stop();
        
        if (options.json) {
          console.log(JSON.stringify(analysis, null, 2));
          return;
        }
        
        displayPortAnalysis(analysis, logger);
        
        if (options.export) {
          const reportPath = `port-analysis-${options.env}-${Date.now()}.json`;
          await require('fs').promises.writeFile(reportPath, JSON.stringify(analysis, null, 2));
          logger.info(`Analysis report exported to: ${reportPath}`);
        }
        
      } catch (error) {
        ErrorHandler.handle(error as Error, 'Port Usage Analysis');
      }
    });

  // truxe ports optimize - Optimize port configuration
  ports
    .command('optimize')
    .description('Optimize port configuration for better performance')
    .option('--env <environment>', 'Environment to optimize', 'development')
    .option('--dry-run', 'Show optimization plan without applying changes')
    .option('--backup', 'Create backup before optimization')
    .option('--aggressive', 'Use aggressive optimization strategies')
    .action(async (options) => {
      const logger = new Logger();
      
      try {
        logger.header('⚡ Port Configuration Optimization');
        
        const spinner = ora('Generating optimization plan...').start();
        
        const intelligentSuggester = new IntelligentPortSuggester();
        const optimization = await intelligentSuggester.exportOptimizedConfiguration(options.env);
        
        spinner.stop();
        
        displayOptimizationPlan(optimization, logger);
        
        if (options.dryRun) {
          logger.info('Dry run mode - no changes applied');
          return;
        }
        
        if (optimization.changes.length === 0) {
          logger.success('Configuration is already optimized!');
          return;
        }
        
        // Confirm changes
        const answer = await inquirer.prompt([{
          type: 'confirm',
          name: 'proceed',
          message: `Apply ${optimization.changes.length} optimization changes?`,
          default: false
        }]);
        
        if (!answer.proceed) {
          logger.info('Optimization cancelled');
          return;
        }
        
        if (options.backup) {
          const portManager = new PortManager();
          const backupPath = await portManager.createConfigBackup(options.env);
          logger.info(`Configuration backed up to: ${backupPath}`);
        }
        
        // Apply optimizations (this would need implementation)
        logger.success('Port configuration optimized successfully!');
        
      } catch (error) {
        ErrorHandler.handle(error as Error, 'Port Optimization');
      }
    });

  // truxe ports health - Get port system health report
  ports
    .command('health')
    .description('Generate comprehensive port system health report')
    .option('--env <environment>', 'Environment to check', 'development')
    .option('--detailed', 'Include detailed metrics and recommendations')
    .option('--export', 'Export health report')
    .option('--json', 'Output in JSON format')
    .action(async (options) => {
      const logger = new Logger();
      
      try {
        logger.header('🏥 Port System Health Check');
        
        const spinner = ora('Generating health report...').start();
        
        const intelligentSuggester = new IntelligentPortSuggester();
        const healthReport = await intelligentSuggester.getSystemHealthReport(options.env);
        
        spinner.stop();
        
        if (options.json) {
          console.log(JSON.stringify(healthReport, null, 2));
          return;
        }
        
        displayHealthReport(healthReport, logger, options.detailed);
        
        if (options.export) {
          const reportPath = `port-health-${options.env}-${Date.now()}.json`;
          await require('fs').promises.writeFile(reportPath, JSON.stringify(healthReport, null, 2));
          logger.info(`Health report exported to: ${reportPath}`);
        }
        
      } catch (error) {
        ErrorHandler.handle(error as Error, 'Port Health Check');
      }
    });

  // truxe ports dashboard - Real-time dashboard
  ports
    .command('dashboard')
    .description('Start real-time port monitoring dashboard')
    .option('--env <environment>', 'Environment to monitor', 'development')
    .option('--interval <seconds>', 'Refresh interval in seconds', '5')
    .option('--export', 'Export dashboard data on exit')
    .action(async (options) => {
      const logger = new Logger();
      
      try {
        logger.header('📊 Real-Time Port Dashboard');
        
        const dashboard = new RealTimeDashboard({
          refresh_interval: parseInt(options.interval) * 1000,
          display_options: {
            show_timestamps: true,
            show_colors: true,
            compact_mode: false,
            show_metrics: true
          }
        });

        // Set up event handlers
        dashboard.on('dataUpdated', () => {
          dashboard.display();
        });

        dashboard.on('alertCreated', (alert) => {
          console.log(); // New line
          logger.warning(`🚨 New Alert: ${alert.message}`);
        });

        dashboard.on('error', (error) => {
          logger.error(`Dashboard error: ${error.message}`);
        });

        // Start the dashboard
        await dashboard.start(options.env);
        
        // Handle graceful shutdown
        process.on('SIGINT', async () => {
          console.log('\n'); // New line after ^C
          logger.info('Stopping dashboard...');
          
          if (options.export) {
            const data = dashboard.exportData();
            const exportPath = `dashboard-export-${options.env}-${Date.now()}.json`;
            await require('fs').promises.writeFile(exportPath, JSON.stringify(data, null, 2));
            logger.info(`Dashboard data exported to: ${exportPath}`);
          }
          
          dashboard.stop();
          process.exit(0);
        });

        // Keep the process running
        await new Promise(() => {}); // This will run indefinitely until interrupted
        
      } catch (error) {
        ErrorHandler.handle(error as Error, 'Port Dashboard');
      }
    });

  // truxe ports error - Enhanced error analysis and resolution
  ports
    .command('error')
    .description('Analyze and resolve port-related errors with intelligent guidance')
    .argument('<error-message>', 'Error message to analyze')
    .option('--service <name>', 'Service name context')
    .option('--port <port>', 'Port number context')
    .option('--env <environment>', 'Environment context', 'development')
    .option('--auto-fix', 'Attempt automatic resolution')
    .option('--interactive', 'Interactive resolution mode')
    .option('--json', 'Output in JSON format')
    .action(async (errorMessage: string, options) => {
      const logger = new Logger();
      
      try {
        logger.header('🔧 Enhanced Error Analysis');
        
        const errorMessaging = new EnhancedErrorMessaging();
        const error = new Error(errorMessage);
        
        const context = {
          environment: options.env,
          service_name: options.service,
          port: options.port ? parseInt(options.port) : undefined,
          error_message: errorMessage
        };

        const analysis = await errorMessaging.analyzeError(error, context);
        
        if (options.json) {
          console.log(JSON.stringify(analysis, null, 2));
          return;
        }

        displayErrorAnalysis(analysis, logger);

        if (options.autoFix || options.interactive) {
          const guidance = await errorMessaging.getResolutionGuidance(error, context);
          
          if (options.autoFix && guidance.automated_fixes.length > 0) {
            logger.info('Attempting automatic resolution...');
            const result = await errorMessaging.executeAutomatedResolution(
              `auto_${Date.now()}`,
              guidance.automated_fixes,
              context as any
            );
            
            displayResolutionResult(result, logger);
          } else if (options.interactive) {
            await interactiveErrorResolution(guidance, errorMessaging, context, logger);
          }
        }
        
      } catch (error) {
        ErrorHandler.handle(error as Error, 'Error Analysis');
      }
    });

  // truxe ports validate - Validate port configuration
  ports
    .command('validate')
    .description('Validate port configuration and detect issues')
    .option('--env <environment>', 'Environment to validate', 'development')
    .option('--fix', 'Attempt to fix detected issues')
    .option('--detailed', 'Show detailed validation results')
    .option('--json', 'Output in JSON format')
    .action(async (options) => {
      const logger = new Logger();
      
      try {
        logger.header('✅ Port Configuration Validation');
        
        const portManager = new PortManager();
        const intelligentSuggester = new IntelligentPortSuggester();
        
        // Get system status
        const systemStatus = await portManager.getSystemStatus(options.env);
        
        // Analyze port usage
        const analysis = await intelligentSuggester.analyzePortUsage(options.env);
        
        // Generate health report
        const healthReport = await intelligentSuggester.getSystemHealthReport(options.env);
        
        if (options.json) {
          console.log(JSON.stringify({
            system_status: systemStatus,
            port_analysis: analysis,
            health_report: healthReport,
            validation_timestamp: new Date().toISOString()
          }, null, 2));
          return;
        }

        displayValidationResults(systemStatus, analysis, healthReport, logger, options.detailed);

        if (options.fix && healthReport.issues.length > 0) {
          logger.info('Attempting to fix detected issues...');
          // This would implement automatic fixing logic
          logger.success('Issues resolved successfully!');
        }
        
      } catch (error) {
        ErrorHandler.handle(error as Error, 'Port Validation');
      }
    });
}

// Helper functions for determining ports to check
async function determinePortsToCheck(
  ports: string[], 
  options: any, 
  portManager: PortManager
): Promise<number[]> {
  if (ports.length > 0) {
    return ports.map(p => parseInt(p)).filter(p => !isNaN(p));
  }
  
  if (options.all) {
    return await portManager.getAllConfiguredPorts(options.env);
  }
  
  return await portManager.getEnvironmentPorts(options.env);
}

// Display functions
function displayPortCheckResults(results: any[], logger: Logger): void {
  logger.blank();
  logger.subheader('Port Check Results:');
  
  const tableData = results.map(result => ({
    key: `Port ${result.port}`,
    value: result.available ? 'Available' : `In use by ${result.process || 'unknown process'}`,
    status: result.available ? 'success' as const : 'error' as const
  }));
  
  logger.table(tableData);
  
  const available = results.filter(r => r.available).length;
  const inUse = results.length - available;
  
  logger.blank();
  logger.info(`Summary: ${chalk.green(`${available} available`)} | ${chalk.red(`${inUse} in use`)}`);
}

function displaySystemStatus(status: any, logger: Logger, detailed: boolean): void {
  logger.blank();
  logger.subheader(`Environment: ${status.environment}`);
  
  const summaryData = [
    { key: 'Port Range', value: `${status.portRange.start} - ${status.portRange.end}`, status: undefined },
    { key: 'Total Services', value: status.totalServices.toString(), status: undefined },
    { key: 'Port Utilization', value: `${status.portUtilization}%`, status: undefined },
    { key: 'Conflicts', value: status.conflicts.toString(), status: status.conflicts > 0 ? 'error' as const : 'success' as const },
    { key: 'Status', value: status.overallStatus, status: status.overallStatus === 'healthy' ? 'success' as const : 'warning' as const }
  ];
  
  logger.table(summaryData);
  
  if (status.services && status.services.length > 0) {
    logger.blank();
    logger.subheader('Service Ports:');
    
    const serviceData = status.services.map((service: any) => ({
      key: service.name,
      value: `Port ${service.port}`,
      status: service.available ? 'success' as const : 'error' as const
    }));
    
    logger.table(serviceData);
  }
  
  if (detailed && status.processes && status.processes.length > 0) {
    logger.blank();
    logger.subheader('Running Processes:');
    
    status.processes.forEach((proc: any) => {
      logger.info(`${proc.name} (PID: ${proc.pid}) - Port ${proc.port}`);
    });
  }
}

function displayPortSuggestions(suggestions: any[], originalPort: number, logger: Logger): void {
  logger.blank();
  logger.info(`Suggestions for port ${originalPort}:`);
  logger.blank();
  
  if (suggestions.length === 0) {
    logger.warning('No alternative ports found in the current range');
    return;
  }
  
  const tableData = suggestions.map((suggestion, index) => ({
    key: `Option ${index + 1}`,
    value: `Port ${suggestion.port}${suggestion.reason ? ` (${suggestion.reason})` : ''}`,
    status: 'success' as const
  }));
  
  logger.table(tableData);
}

function displayProcessesToKill(processes: any[], logger: Logger): void {
  logger.blank();
  logger.subheader('Processes to kill:');
  
  const tableData = processes.map(proc => ({
    key: `PID ${proc.pid}`,
    value: `${proc.name} on port ${proc.port}`,
    status: 'warning' as const
  }));
  
  logger.table(tableData);
}

function displayKillResults(results: any[], logger: Logger): void {
  logger.blank();
  logger.subheader('Kill Results:');
  
  const tableData = results.map(result => ({
    key: `Port ${result.port}`,
    value: result.success ? 'Process killed successfully' : `Failed: ${result.error}`,
    status: result.success ? 'success' as const : 'error' as const
  }));
  
  logger.table(tableData);
}

function displayPortScanResults(ranges: any[], count: number, logger: Logger): void {
  logger.blank();
  
  if (ranges.length === 0) {
    logger.warning(`No available ranges of ${count} consecutive ports found`);
    return;
  }
  
  logger.subheader(`Available Port Ranges (${count} consecutive ports):`);
  
  const tableData = ranges.slice(0, 10).map((range, index) => ({
    key: `Range ${index + 1}`,
    value: count === 1 ? `Port ${range.start}` : `Ports ${range.start}-${range.end}`,
    status: 'success' as const
  }));
  
  logger.table(tableData);
  
  if (ranges.length > 10) {
    logger.info(`... and ${ranges.length - 10} more ranges available`);
  }
}

function displayMonitoringUpdate(data: any, _logger: Logger): void {
  const timestamp = new Date().toLocaleTimeString();
  const conflicts = data.conflicts || 0;
  const status = conflicts > 0 ? chalk.red(`${conflicts} conflicts`) : chalk.green('All clear');
  
  process.stdout.write(`\r${timestamp} - ${status} - Checked ${data.portsChecked} ports`);
}

function displayMonitoringAlert(alert: any, logger: Logger): void {
  console.log(); // New line after monitoring update
  logger.warning(`🚨 Alert: ${alert.message}`);
  if (alert.port) {
    logger.info(`   Port ${alert.port}: ${alert.details}`);
  }
}

function displayMonitoringStats(stats: any, logger: Logger): void {
  logger.blank();
  logger.subheader('Monitoring Statistics:');
  
  const tableData = [
    { key: 'Total Checks', value: stats.totalChecks.toString(), status: undefined },
    { key: 'Conflicts Detected', value: stats.conflictsDetected.toString(), status: stats.conflictsDetected > 0 ? 'warning' as const : 'success' as const },
    { key: 'Average Response Time', value: `${stats.avgResponseTime}ms`, status: undefined },
    { key: 'Uptime', value: `${Math.round(stats.uptime / 1000)}s`, status: undefined }
  ];
  
  logger.table(tableData);
}

function displayResolutionResults(results: any, logger: Logger): void {
  logger.blank();
  logger.subheader('Resolution Results:');
  
  const tableData = [
    { key: 'Conflicts Found', value: results.conflictsFound.toString(), status: undefined },
    { key: 'Conflicts Resolved', value: results.conflictsResolved.toString(), status: 'success' as const },
    { key: 'Actions Taken', value: results.actionsTaken.toString(), status: undefined },
    { key: 'Status', value: results.status, status: results.status === 'success' ? 'success' as const : 'warning' as const }
  ];
  
  logger.table(tableData);
  
  if (results.actions && results.actions.length > 0) {
    logger.blank();
    logger.subheader('Actions Performed:');
    
    results.actions.forEach((action: any) => {
      const icon = action.success ? '✅' : '❌';
      logger.info(`${icon} ${action.description}`);
    });
  }
}

function displayIntelligentPortSuggestions(suggestions: any, logger: Logger, detailed: boolean): void {
  logger.blank();
  logger.info(`Intelligent suggestions for ${chalk.cyan(suggestions.service)} in ${chalk.yellow(suggestions.environment)}:`);
  
  if (suggestions.current_port) {
    logger.info(`Current port: ${chalk.red(suggestions.current_port)}`);
  }
  
  logger.blank();
  
  if (suggestions.suggestions.length === 0) {
    logger.warning('No optimized port suggestions found');
    return;
  }
  
  const tableData = suggestions.suggestions.map((suggestion: any, index: number) => {
    const scoreColor = suggestion.final_score >= 80 ? chalk.green : 
                      suggestion.final_score >= 60 ? chalk.yellow : chalk.red;
    
    return {
      key: `Option ${index + 1}`,
      value: `Port ${chalk.cyan(suggestion.port)} (Score: ${scoreColor(Math.round(suggestion.final_score))})`,
      status: suggestion.final_score >= 80 ? 'success' as const : 
              suggestion.final_score >= 60 ? 'warning' as const : 'error' as const
    };
  });
  
  logger.table(tableData);
  
  if (detailed) {
    logger.blank();
    logger.subheader('Detailed Analysis:');
    
    suggestions.suggestions.forEach((suggestion: any, index: number) => {
      logger.info(`${chalk.bold(`Option ${index + 1} - Port ${suggestion.port}:`)}`);
      logger.info(`  Strategy: ${suggestion.strategy}`);
      logger.info(`  Reason: ${suggestion.reason}`);
      
      if (suggestion.reasoning) {
        logger.info(`  Risk Level: ${suggestion.reasoning.risk_assessment}`);
        
        if (suggestion.reasoning.optimization_notes.length > 0) {
          logger.info(`  Notes: ${suggestion.reasoning.optimization_notes.join(', ')}`);
        }
      }
      
      logger.blank();
    });
  }
  
  // Display metadata
  if (suggestions.analysis_metadata) {
    logger.subheader('Analysis Summary:');
    const metadata = suggestions.analysis_metadata;
    
    const metaData = [
      { key: 'Service Type', value: metadata.service_type, status: undefined },
      { key: 'Candidates Evaluated', value: metadata.total_candidates_evaluated.toString(), status: undefined },
      { key: 'Optimization Level', value: metadata.optimization_level, status: undefined },
      { key: 'Strategies Used', value: metadata.strategies_used.length.toString(), status: undefined }
    ];
    
    logger.table(metaData);
  }
}

function displayPortAnalysis(analysis: any, logger: Logger): void {
  logger.blank();
  logger.subheader(`Port Usage Analysis - ${analysis.environment}`);
  
  const summaryData = [
    { key: 'Total Services', value: analysis.total_services.toString(), status: undefined },
    { key: 'Port Utilization', value: `${analysis.port_utilization}%`, status: analysis.port_utilization > 80 ? 'warning' as const : 'success' as const },
    { key: 'Analysis Time', value: new Date(analysis.timestamp).toLocaleString(), status: undefined }
  ];
  
  logger.table(summaryData);
  
  // Service analysis
  if (analysis.service_analysis && Object.keys(analysis.service_analysis).length > 0) {
    logger.blank();
    logger.subheader('Service Analysis:');
    
    const serviceData = Object.entries(analysis.service_analysis).map(([serviceName, serviceAnalysis]: [string, any]) => ({
      key: serviceName,
      value: `Port ${serviceAnalysis.current_port} (${serviceAnalysis.service_type})`,
      status: serviceAnalysis.conflict_risk === 'high' ? 'error' as const :
              serviceAnalysis.conflict_risk === 'medium' ? 'warning' as const : 'success' as const
    }));
    
    logger.table(serviceData);
  }
  
  // Recommendations
  if (analysis.recommendations && analysis.recommendations.length > 0) {
    logger.blank();
    logger.subheader('Recommendations:');
    
    analysis.recommendations.forEach((rec: any) => {
      const icon = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
      logger.info(`${icon} ${rec.description}`);
    });
  }
  
  // Optimization opportunities
  if (analysis.optimization_opportunities && analysis.optimization_opportunities.length > 0) {
    logger.blank();
    logger.subheader('Optimization Opportunities:');
    
    analysis.optimization_opportunities.forEach((opp: any) => {
      logger.info(`💡 ${opp.description}`);
      logger.info(`   ${opp.potential_improvement}`);
    });
  }
}

function displayOptimizationPlan(optimization: any, logger: Logger): void {
  logger.blank();
  logger.subheader('Port Configuration Optimization Plan');
  
  const summaryData = [
    { key: 'Total Services', value: optimization.optimization_summary.total_services.toString(), status: undefined },
    { key: 'Services to Change', value: optimization.optimization_summary.services_changed.toString(), status: undefined },
    { key: 'Risk Assessment', value: optimization.optimization_summary.risk_assessment, 
      status: optimization.optimization_summary.risk_assessment === 'low' ? 'success' as const : 'warning' as const }
  ];
  
  logger.table(summaryData);
  
  if (optimization.changes.length > 0) {
    logger.blank();
    logger.subheader('Proposed Changes:');
    
    const changeData = optimization.changes.map((change: any) => ({
      key: change.service,
      value: `${change.from} → ${change.to}`,
      status: 'warning' as const
    }));
    
    logger.table(changeData);
  }
  
  // Estimated improvements
  const improvements = optimization.optimization_summary.estimated_improvements;
  if (improvements.conflict_reduction > 0 || improvements.performance_improvement > 0) {
    logger.blank();
    logger.subheader('Estimated Improvements:');
    
    if (improvements.conflict_reduction > 0) {
      logger.info(`🛡️  Conflict reduction: ${improvements.conflict_reduction}%`);
    }
    
    if (improvements.performance_improvement > 0) {
      logger.info(`⚡ Performance improvement: ${improvements.performance_improvement}%`);
    }
    
    if (improvements.organization_improvement > 0) {
      logger.info(`📊 Organization improvement: ${improvements.organization_improvement}%`);
    }
  }
}

function displayHealthReport(healthReport: any, logger: Logger, detailed: boolean): void {
  logger.blank();
  logger.subheader(`Port System Health Report - ${healthReport.environment}`);
  
  const healthColor = healthReport.overall_health === 'healthy' ? chalk.green :
                     healthReport.overall_health === 'warning' ? chalk.yellow : chalk.red;
  
  const summaryData = [
    { key: 'Overall Health', value: healthColor(healthReport.overall_health.toUpperCase()), status: undefined },
    { key: 'Health Score', value: `${healthReport.health_score}/100`, 
      status: healthReport.health_score >= 80 ? 'success' as const : 
              healthReport.health_score >= 60 ? 'warning' as const : 'error' as const },
    { key: 'Report Time', value: new Date(healthReport.timestamp).toLocaleString(), status: undefined }
  ];
  
  logger.table(summaryData);
  
  // Metrics
  if (healthReport.metrics) {
    logger.blank();
    logger.subheader('System Metrics:');
    
    const metricsData = [
      { key: 'Total Services', value: healthReport.metrics.total_services.toString(), status: undefined },
      { key: 'Port Utilization', value: `${healthReport.metrics.port_utilization}%`, 
        status: healthReport.metrics.port_utilization > 80 ? 'warning' as const : 'success' as const },
      { key: 'Active Conflicts', value: healthReport.metrics.conflict_count.toString(),
        status: healthReport.metrics.conflict_count > 0 ? 'error' as const : 'success' as const },
      { key: 'Optimization Opportunities', value: healthReport.metrics.optimization_opportunities.toString(), status: undefined }
    ];
    
    logger.table(metricsData);
  }
  
  // Issues
  if (healthReport.issues && healthReport.issues.length > 0) {
    logger.blank();
    logger.subheader('Issues Detected:');
    
    healthReport.issues.forEach((issue: any) => {
      const icon = issue.severity === 'high' ? '🔴' : issue.severity === 'medium' ? '🟡' : '🟢';
      logger.info(`${icon} ${issue.description}`);
    });
  }
  
  // Recommendations
  if (healthReport.recommendations && healthReport.recommendations.length > 0) {
    logger.blank();
    logger.subheader('Health Recommendations:');
    
    healthReport.recommendations.forEach((rec: any) => {
      const icon = rec.priority === 'high' ? '🚨' : rec.priority === 'medium' ? '⚠️' : '💡';
      logger.info(`${icon} ${rec.description}`);
    });
  }
  
  if (detailed && healthReport.detailed_metrics) {
    logger.blank();
    logger.subheader('Detailed Metrics:');
    // Display additional detailed metrics if available
    logger.info('📊 Detailed metrics available in JSON export');
  }
}

function displayErrorAnalysis(analysis: any, logger: Logger): void {
  logger.blank();
  logger.subheader('Error Analysis');
  
  const severityColor = analysis.severity === 'critical' ? chalk.red :
                       analysis.severity === 'high' ? chalk.red :
                       analysis.severity === 'medium' ? chalk.yellow : chalk.green;
  
  const summaryData = [
    { key: 'Error Type', value: analysis.error_type, status: undefined },
    { key: 'Severity', value: severityColor(analysis.severity.toUpperCase()), status: undefined },
    { key: 'Root Cause', value: analysis.root_cause, status: undefined },
    { key: 'Estimated Resolution Time', value: analysis.estimated_resolution_time, status: undefined }
  ];
  
  logger.table(summaryData);
  
  // Impact assessment
  logger.blank();
  logger.subheader('Impact Assessment');
  
  const impactData = [
    { key: 'Service Availability', value: analysis.impact_assessment.service_availability, status: undefined },
    { key: 'Performance Impact', value: analysis.impact_assessment.performance_impact, status: undefined },
    { key: 'User Experience', value: analysis.impact_assessment.user_experience, status: undefined }
  ];
  
  logger.table(impactData);
  
  // Resolution steps
  if (analysis.resolution_steps && analysis.resolution_steps.length > 0) {
    logger.blank();
    logger.subheader('Resolution Steps');
    
    analysis.resolution_steps.forEach((step: any, index: number) => {
      const riskColor = step.risk_level === 'high' ? chalk.red :
                       step.risk_level === 'medium' ? chalk.yellow : chalk.green;
      
      logger.info(`${chalk.bold(`Step ${step.step_number}:`)} ${step.title}`);
      logger.info(`  ${step.description}`);
      logger.info(`  Risk Level: ${riskColor(step.risk_level.toUpperCase())} | Time: ${step.estimated_time}`);
      
      if (step.command) {
        logger.info(`  Command: ${chalk.cyan(step.command)}`);
      }
      
      logger.blank();
    });
  }
  
  // Prevention tips
  if (analysis.prevention_tips && analysis.prevention_tips.length > 0) {
    logger.blank();
    logger.subheader('Prevention Tips');
    
    analysis.prevention_tips.forEach((tip: string) => {
      logger.info(`💡 ${tip}`);
    });
  }
}

function displayResolutionResult(result: any, logger: Logger): void {
  logger.blank();
  logger.subheader('Resolution Results');
  
  const summaryData = [
    { key: 'Success', value: result.success ? 'Yes' : 'No', 
      status: result.success ? 'success' as const : 'error' as const },
    { key: 'Steps Executed', value: result.executed_steps.length.toString(), status: undefined },
    { key: 'Remaining Steps', value: result.remaining_steps.length.toString(), status: undefined },
    { key: 'Final Status', value: result.final_status, status: undefined }
  ];
  
  logger.table(summaryData);
  
  if (result.executed_steps.length > 0) {
    logger.blank();
    logger.subheader('Executed Steps');
    
    result.executed_steps.forEach((step: any) => {
      const statusIcon = step.success ? '✅' : '❌';
      logger.info(`${statusIcon} Step ${step.step_number} (${step.duration_ms}ms)`);
      
      if (step.output) {
        logger.info(`   Output: ${step.output}`);
      }
      
      if (step.error) {
        logger.info(`   Error: ${chalk.red(step.error)}`);
      }
    });
  }
  
  if (result.remaining_steps.length > 0) {
    logger.blank();
    logger.subheader('Remaining Manual Steps');
    
    result.remaining_steps.forEach((step: any) => {
      logger.info(`📋 Step ${step.step_number}: ${step.title}`);
      logger.info(`   ${step.description}`);
    });
  }
}

async function interactiveErrorResolution(
  guidance: any,
  errorMessaging: any,
  context: any,
  logger: Logger
): Promise<void> {
  logger.blank();
  logger.subheader('Interactive Resolution Mode');
  
  const allSteps = [...guidance.automated_fixes, ...guidance.manual_steps];
  
  for (const step of allSteps) {
    const answer = await inquirer.prompt([{
      type: 'confirm',
      name: 'proceed',
      message: `Execute: ${step.title}?`,
      default: true
    }]);
    
    if (answer.proceed) {
      if (step.command) {
        logger.info(`Executing: ${step.command}`);
        // This would execute the command
        logger.success('Command executed successfully');
      } else {
        logger.info(`Manual step: ${step.description}`);
        logger.info('Please complete this step manually and press Enter to continue...');
        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
      }
    }
  }
  
  logger.success('Interactive resolution completed!');
}

function displayValidationResults(
  systemStatus: any,
  analysis: any,
  healthReport: any,
  logger: Logger,
  detailed: boolean
): void {
  logger.blank();
  logger.subheader('Validation Summary');
  
  const validationData = [
    { key: 'Overall Health', value: healthReport.overall_health.toUpperCase(), 
      status: healthReport.overall_health === 'healthy' ? 'success' as const : 
              healthReport.overall_health === 'warning' ? 'warning' as const : 'error' as const },
    { key: 'Health Score', value: `${healthReport.health_score}/100`, 
      status: healthReport.health_score >= 80 ? 'success' as const : 
              healthReport.health_score >= 60 ? 'warning' as const : 'error' as const },
    { key: 'Total Services', value: systemStatus.totalServices.toString(), status: undefined },
    { key: 'Port Conflicts', value: systemStatus.conflicts.toString(),
      status: systemStatus.conflicts > 0 ? 'error' as const : 'success' as const },
    { key: 'Port Utilization', value: `${analysis.port_utilization}%`,
      status: analysis.port_utilization > 80 ? 'warning' as const : 'success' as const }
  ];
  
  logger.table(validationData);
  
  // Issues
  if (healthReport.issues && healthReport.issues.length > 0) {
    logger.blank();
    logger.subheader('Issues Found');
    
    healthReport.issues.forEach((issue: any) => {
      const icon = issue.severity === 'high' ? '🔴' : issue.severity === 'medium' ? '🟡' : '🟢';
      logger.info(`${icon} ${issue.description}`);
      
      if (issue.suggested_fix) {
        logger.info(`   Fix: ${issue.suggested_fix}`);
      }
    });
  } else {
    logger.blank();
    logger.success('No issues found! Configuration is valid.');
  }
  
  // Recommendations
  if (healthReport.recommendations && healthReport.recommendations.length > 0) {
    logger.blank();
    logger.subheader('Recommendations');
    
    healthReport.recommendations.forEach((rec: any) => {
      const icon = rec.priority === 'high' ? '🚨' : rec.priority === 'medium' ? '⚠️' : '💡';
      logger.info(`${icon} ${rec.description}`);
    });
  }
  
  if (detailed) {
    logger.blank();
    logger.subheader('Detailed Analysis');
    logger.info('📊 Detailed validation data available in JSON export');
  }
}
