#!/usr/bin/env node

/**
 * Truxe Error System Integration Script
 * 
 * Integration script that demonstrates and tests the comprehensive error messaging system.
 * Provides CLI commands for error handling, troubleshooting, validation, and health checking.
 * 
 * @author DevOps Engineering Team
 * @version 4.0.0
 */

import { fileURLToPath } from 'url';
import path from 'path';
import chalk from 'chalk';
import { Command } from 'commander';
import inquirer from 'inquirer';

// Import error system components
import { errorMessagingSystem } from '../config/error-messaging-system.js';
import { 
  PortConflictError, 
  PermissionDeniedError, 
  ConfigurationError,
  NetworkError,
  ResourceLimitationError,
  ServiceStartupError,
  ValidationError,
  smartErrorHandler 
} from '../config/structured-error-classes.js';
import { resolutionGuidanceEngine } from '../config/resolution-guidance-system.js';
import { automatedTroubleshootingEngine } from '../config/automated-troubleshooting-engine.js';
import { configurationValidator, healthCheckAutomation } from '../config/validation-automation-system.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * CLI Program Setup
 */
const program = new Command();

program
  .name('truxe-error-system')
  .description('Truxe Error Messaging and Troubleshooting System')
  .version('4.0.0');

/**
 * Error Analysis Command
 */
program
  .command('analyze')
  .description('Analyze and process an error with full context')
  .option('-e, --error <error>', 'Error message to analyze')
  .option('-c, --category <category>', 'Error category')
  .option('-s, --severity <severity>', 'Error severity')
  .option('-f, --format <format>', 'Output format (console, json, markdown)', 'console')
  .option('--auto-troubleshoot', 'Run automated troubleshooting')
  .option('--interactive', 'Run in interactive mode')
  .action(async (options) => {
    try {
      console.log(chalk.bold.blue('\n🔍 Truxe Error Analysis System'));
      console.log('═'.repeat(60));

      let error;
      
      if (options.error) {
        // Create error from command line input
        error = new Error(options.error);
        if (options.category) error.category = options.category;
        if (options.severity) error.severity = options.severity;
      } else {
        // Interactive error input
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'message',
            message: 'Enter the error message:',
            validate: input => input.length > 0 || 'Error message is required'
          },
          {
            type: 'list',
            name: 'category',
            message: 'Select error category:',
            choices: [
              'port_conflict',
              'permission',
              'configuration',
              'network',
              'resource',
              'validation',
              'startup',
              'runtime'
            ]
          }
        ]);

        error = new Error(answers.message);
        error.category = answers.category;
      }

      // Process the error
      const result = await errorMessagingSystem.processError(error, {
        autoTroubleshoot: options.autoTroubleshoot,
        interactive: options.interactive,
        format: options.format
      });

      // Display results
      if (options.format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else if (options.format === 'markdown') {
        console.log(result.formatted_message);
      } else {
        console.log(result.formatted_message);
        
        if (result.troubleshooting_result) {
          console.log(chalk.bold.green('\n✅ Troubleshooting completed'));
          console.log(`Success: ${result.troubleshooting_result.success}`);
          console.log(`Fixes applied: ${result.troubleshooting_result.applied_fixes.length}`);
        }
      }

    } catch (error) {
      console.error(chalk.red(`❌ Error analysis failed: ${error.message}`));
      process.exit(1);
    }
  });

/**
 * Troubleshooting Command
 */
program
  .command('troubleshoot')
  .description('Run automated troubleshooting for common issues')
  .option('-t, --type <type>', 'Error type to troubleshoot')
  .option('-s, --strategy <strategy>', 'Troubleshooting strategy (conservative, balanced, aggressive)', 'balanced')
  .option('--auto-apply', 'Automatically apply fixes')
  .option('--interactive', 'Run in interactive mode')
  .option('--dry-run', 'Show what would be done without applying changes')
  .action(async (options) => {
    try {
      console.log(chalk.bold.blue('\n🔧 Truxe Automated Troubleshooting'));
      console.log('═'.repeat(60));

      let error;
      
      if (options.type) {
        // Create error based on type
        switch (options.type) {
          case 'port_conflict':
            error = new PortConflictError(3000);
            break;
          case 'permission':
            error = new PermissionDeniedError(80);
            break;
          case 'configuration':
            error = new ConfigurationError('config/ports.js', 'Invalid syntax');
            break;
          case 'network':
            error = new NetworkError('localhost', 3000);
            break;
          case 'resource':
            error = new ResourceLimitationError('file_descriptors');
            break;
          default:
            error = new Error('Generic error for troubleshooting');
        }
      } else {
        // Interactive error selection
        const { errorType } = await inquirer.prompt([{
          type: 'list',
          name: 'errorType',
          message: 'Select error type to troubleshoot:',
          choices: [
            { name: 'Port Conflict', value: 'port_conflict' },
            { name: 'Permission Denied', value: 'permission' },
            { name: 'Configuration Error', value: 'configuration' },
            { name: 'Network Error', value: 'network' },
            { name: 'Resource Limitation', value: 'resource' }
          ]
        }]);

        switch (errorType) {
          case 'port_conflict':
            error = new PortConflictError(3000);
            break;
          case 'permission':
            error = new PermissionDeniedError(80);
            break;
          case 'configuration':
            error = new ConfigurationError('config/ports.js');
            break;
          case 'network':
            error = new NetworkError('localhost', 3000);
            break;
          case 'resource':
            error = new ResourceLimitationError('file_descriptors');
            break;
        }
      }

      // Run troubleshooting
      if (options.interactive) {
        const result = await automatedTroubleshootingEngine.runInteractiveTroubleshooting(error);
        console.log(chalk.green(`\n✅ Interactive troubleshooting completed: ${result.success}`));
      } else {
        const result = await automatedTroubleshootingEngine.runTroubleshooting(error, {
          strategy: options.strategy,
          autoApply: options.autoApply && !options.dryRun,
          context: { dryRun: options.dryRun }
        });
        
        console.log(chalk.green(`\n✅ Automated troubleshooting completed`));
        console.log(`Success: ${result.success}`);
        console.log(`Fixes suggested: ${result.suggested_fixes.length}`);
        console.log(`Fixes applied: ${result.applied_fixes.length}`);
      }

    } catch (error) {
      console.error(chalk.red(`❌ Troubleshooting failed: ${error.message}`));
      process.exit(1);
    }
  });

/**
 * Validation Command
 */
program
  .command('validate')
  .description('Validate system configuration')
  .option('-f, --file <file>', 'Specific configuration file to validate')
  .option('-r, --rules <rules>', 'Comma-separated list of rules to run')
  .option('--auto-fix', 'Automatically fix validation issues')
  .option('--stop-on-error', 'Stop validation on first error')
  .action(async (options) => {
    try {
      console.log(chalk.bold.blue('\n✅ Truxe Configuration Validation'));
      console.log('═'.repeat(60));

      const config = {};
      const validationOptions = {
        autoFix: options.autoFix,
        stopOnError: options.stopOnError
      };

      if (options.rules) {
        validationOptions.rules = options.rules.split(',').map(r => r.trim());
      }

      // Load configuration if file specified
      if (options.file) {
        try {
          const fs = await import('fs/promises');
          const content = await fs.readFile(options.file, 'utf8');
          Object.assign(config, JSON.parse(content));
          console.log(chalk.blue(`📁 Loaded configuration from ${options.file}`));
        } catch (error) {
          console.log(chalk.yellow(`⚠️  Could not load ${options.file}: ${error.message}`));
        }
      }

      // Run validation
      const result = await configurationValidator.validateConfiguration(config, validationOptions);

      // Display results
      console.log(chalk.bold('\n📊 Validation Results:'));
      console.log(`   Rules Checked: ${result.rules_checked}`);
      console.log(`   Passed: ${chalk.green(result.rules_passed)}`);
      console.log(`   Failed: ${chalk.red(result.rules_failed)}`);
      console.log(`   Skipped: ${chalk.yellow(result.rules_skipped)}`);
      console.log(`   Success Rate: ${result.summary.success_rate}%`);

      if (result.errors.length > 0) {
        console.log(chalk.red('\n❌ Errors:'));
        result.errors.forEach((error, index) => {
          console.log(chalk.red(`   ${index + 1}. ${error.rule_name}: ${error.reason}`));
          if (error.suggestions.length > 0) {
            console.log(chalk.gray('      Suggestions:'));
            error.suggestions.forEach(suggestion => {
              console.log(chalk.gray(`        • ${suggestion}`));
            });
          }
        });
      }

      if (result.warnings.length > 0) {
        console.log(chalk.yellow('\n⚠️  Warnings:'));
        result.warnings.forEach((warning, index) => {
          console.log(chalk.yellow(`   ${index + 1}. ${warning.rule_name}: ${warning.reason}`));
        });
      }

      if (result.fixes_applied.length > 0) {
        console.log(chalk.green('\n🔧 Fixes Applied:'));
        result.fixes_applied.forEach((fix, index) => {
          console.log(chalk.green(`   ${index + 1}. ${fix.rule_name}: ${fix.reason}`));
        });
      }

      if (!result.valid) {
        process.exit(1);
      }

    } catch (error) {
      console.error(chalk.red(`❌ Validation failed: ${error.message}`));
      process.exit(1);
    }
  });

/**
 * Health Check Command
 */
program
  .command('health')
  .description('Run system health checks')
  .option('-c, --check <check>', 'Specific health check to run')
  .option('-s, --schedule', 'Start scheduled health checks')
  .option('--stop-schedule', 'Stop scheduled health checks')
  .option('-r, --report', 'Generate health report')
  .option('-f, --format <format>', 'Report format (json, markdown)', 'json')
  .action(async (options) => {
    try {
      console.log(chalk.bold.blue('\n🏥 Truxe Health Check System'));
      console.log('═'.repeat(60));

      if (options.schedule) {
        healthCheckAutomation.startAllSchedules();
        console.log(chalk.green('✅ Started all scheduled health checks'));
        return;
      }

      if (options.stopSchedule) {
        healthCheckAutomation.stopAllSchedules();
        console.log(chalk.yellow('⏸️  Stopped all scheduled health checks'));
        return;
      }

      if (options.check) {
        // Run specific health check
        const result = await healthCheckAutomation.runHealthCheck(options.check);
        console.log(chalk.bold('\n📊 Health Check Result:'));
        console.log(`   Status: ${result.healthy ? chalk.green('Healthy') : chalk.red('Unhealthy')}`);
        console.log(`   Message: ${result.message}`);
        console.log(`   Execution Time: ${result.execution_time}ms`);
        
        if (result.details && Object.keys(result.details).length > 0) {
          console.log('   Details:');
          Object.entries(result.details).forEach(([key, value]) => {
            console.log(`     ${key}: ${value}`);
          });
        }
      } else {
        // Run all health checks
        const { summary, results } = await healthCheckAutomation.runAllHealthChecks();
        
        if (options.report) {
          const reportPath = await healthCheckAutomation.exportHealthReport(options.format);
          console.log(chalk.green(`\n📄 Health report exported to: ${reportPath}`));
        }
      }

    } catch (error) {
      console.error(chalk.red(`❌ Health check failed: ${error.message}`));
      process.exit(1);
    }
  });

/**
 * Test Command
 */
program
  .command('test')
  .description('Test the error messaging system with various scenarios')
  .option('-s, --scenario <scenario>', 'Specific test scenario to run')
  .option('--all', 'Run all test scenarios')
  .action(async (options) => {
    try {
      console.log(chalk.bold.blue('\n🧪 Truxe Error System Test Suite'));
      console.log('═'.repeat(60));

      const testScenarios = {
        port_conflict: async () => {
          console.log(chalk.blue('\n📋 Testing Port Conflict Scenario'));
          const error = new PortConflictError(3000, { name: 'node', pid: 1234 });
          return await errorMessagingSystem.processError(error, {
            autoTroubleshoot: true,
            format: 'console'
          });
        },

        permission_denied: async () => {
          console.log(chalk.blue('\n📋 Testing Permission Denied Scenario'));
          const error = new PermissionDeniedError(80, 'bind');
          return await errorMessagingSystem.processError(error, {
            autoTroubleshoot: true,
            format: 'console'
          });
        },

        configuration_error: async () => {
          console.log(chalk.blue('\n📋 Testing Configuration Error Scenario'));
          const error = new ConfigurationError('config/ports.js', 'Invalid JSON syntax');
          return await errorMessagingSystem.processError(error, {
            autoTroubleshoot: true,
            format: 'console'
          });
        },

        network_error: async () => {
          console.log(chalk.blue('\n📋 Testing Network Error Scenario'));
          const error = new NetworkError('localhost', 3000, 'connect');
          return await errorMessagingSystem.processError(error, {
            autoTroubleshoot: true,
            format: 'console'
          });
        },

        resource_limitation: async () => {
          console.log(chalk.blue('\n📋 Testing Resource Limitation Scenario'));
          const error = new ResourceLimitationError('file_descriptors', 1024, 1024);
          return await errorMessagingSystem.processError(error, {
            autoTroubleshoot: true,
            format: 'console'
          });
        },

        validation_error: async () => {
          console.log(chalk.blue('\n📋 Testing Validation Error Scenario'));
          const error = new ValidationError('port', 80, 'Port is reserved');
          return await errorMessagingSystem.processError(error, {
            autoTroubleshoot: true,
            format: 'console'
          });
        },

        smart_error_detection: async () => {
          console.log(chalk.blue('\n📋 Testing Smart Error Detection'));
          const rawError = new Error('listen EADDRINUSE :::3000');
          rawError.code = 'EADDRINUSE';
          
          const structuredError = smartErrorHandler.handleError(rawError);
          return await errorMessagingSystem.processError(structuredError, {
            autoTroubleshoot: true,
            format: 'console'
          });
        },

        resolution_plan: async () => {
          console.log(chalk.blue('\n📋 Testing Resolution Plan Generation'));
          const error = new PortConflictError(3000);
          const plan = resolutionGuidanceEngine.generateResolutionPlan(error, { port: 3000 });
          
          console.log(chalk.green(`✅ Generated resolution plan: ${plan.title}`));
          console.log(`   Steps: ${plan.steps.length}`);
          console.log(`   Estimated time: ${plan.estimatedTotalTime} minutes`);
          
          return { success: true, plan };
        }
      };

      if (options.scenario) {
        if (testScenarios[options.scenario]) {
          const result = await testScenarios[options.scenario]();
          console.log(chalk.green(`\n✅ Test scenario '${options.scenario}' completed`));
        } else {
          console.log(chalk.red(`❌ Unknown test scenario: ${options.scenario}`));
          console.log('Available scenarios:', Object.keys(testScenarios).join(', '));
          process.exit(1);
        }
      } else if (options.all) {
        console.log(chalk.blue('\n🚀 Running all test scenarios...'));
        
        let passed = 0;
        let failed = 0;
        
        for (const [name, test] of Object.entries(testScenarios)) {
          try {
            await test();
            passed++;
            console.log(chalk.green(`   ✅ ${name}: PASSED`));
          } catch (error) {
            failed++;
            console.log(chalk.red(`   ❌ ${name}: FAILED - ${error.message}`));
          }
        }
        
        console.log(chalk.bold('\n📊 Test Results:'));
        console.log(`   Passed: ${chalk.green(passed)}`);
        console.log(`   Failed: ${chalk.red(failed)}`);
        console.log(`   Total: ${passed + failed}`);
        
        if (failed > 0) {
          process.exit(1);
        }
      } else {
        console.log('Available test scenarios:');
        Object.keys(testScenarios).forEach(scenario => {
          console.log(`   • ${scenario}`);
        });
        console.log('\nUse --scenario <name> to run a specific test or --all to run all tests');
      }

    } catch (error) {
      console.error(chalk.red(`❌ Test failed: ${error.message}`));
      process.exit(1);
    }
  });

/**
 * Statistics Command
 */
program
  .command('stats')
  .description('Show error system statistics')
  .option('-c, --component <component>', 'Specific component stats (errors, troubleshooting, validation, health)')
  .option('-e, --export', 'Export statistics to file')
  .option('-f, --format <format>', 'Export format (json, markdown)', 'json')
  .action(async (options) => {
    try {
      console.log(chalk.bold.blue('\n📊 Truxe Error System Statistics'));
      console.log('═'.repeat(60));

      if (!options.component || options.component === 'errors') {
        const errorStats = errorMessagingSystem.getErrorStatistics();
        console.log(chalk.bold('\n🔍 Error Processing Statistics:'));
        console.log(`   Total Errors: ${errorStats.total_errors}`);
        console.log(`   Resolution Rate: ${errorStats.resolution_rate}%`);
        
        if (Object.keys(errorStats.by_category).length > 0) {
          console.log('   By Category:');
          Object.entries(errorStats.by_category).forEach(([category, count]) => {
            console.log(`     ${category}: ${count}`);
          });
        }
        
        if (Object.keys(errorStats.by_severity).length > 0) {
          console.log('   By Severity:');
          Object.entries(errorStats.by_severity).forEach(([severity, count]) => {
            console.log(`     ${severity}: ${count}`);
          });
        }
      }

      if (!options.component || options.component === 'troubleshooting') {
        const troubleshootingStats = automatedTroubleshootingEngine.getTroubleshootingStatistics();
        console.log(chalk.bold('\n🔧 Troubleshooting Statistics:'));
        console.log(`   Total Sessions: ${troubleshootingStats.total_sessions}`);
        console.log(`   Success Rate: ${troubleshootingStats.success_rate}%`);
        console.log(`   Fixes Applied: ${troubleshootingStats.fixes_applied}`);
        console.log(`   Successful Fixes: ${troubleshootingStats.successful_fixes}`);
      }

      if (!options.component || options.component === 'validation') {
        const validationStats = configurationValidator.getValidationStatistics();
        console.log(chalk.bold('\n✅ Validation Statistics:'));
        console.log(`   Total Validations: ${validationStats.total_validations}`);
        console.log(`   Success Rate: ${validationStats.recent_success_rate}%`);
        console.log(`   Total Rules: ${validationStats.total_rules}`);
        console.log(`   Total Schemas: ${validationStats.total_schemas}`);
      }

      if (!options.component || options.component === 'health') {
        const healthStats = healthCheckAutomation.getHealthStatistics();
        console.log(chalk.bold('\n🏥 Health Check Statistics:'));
        console.log(`   Total Checks: ${healthStats.total_checks}`);
        console.log(`   Total Executions: ${healthStats.total_executions}`);
        console.log(`   Success Rate: ${healthStats.success_rate}%`);
        console.log(`   Average Execution Time: ${healthStats.average_execution_time}ms`);
      }

      if (options.export) {
        const allStats = {
          timestamp: new Date().toISOString(),
          error_stats: errorMessagingSystem.getErrorStatistics(),
          troubleshooting_stats: automatedTroubleshootingEngine.getTroubleshootingStatistics(),
          validation_stats: configurationValidator.getValidationStatistics(),
          health_stats: healthCheckAutomation.getHealthStatistics()
        };

        const fs = await import('fs/promises');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `error-system-stats-${timestamp}.${options.format}`;
        const filepath = path.join(process.cwd(), 'reports', filename);

        // Ensure reports directory exists
        await fs.mkdir(path.dirname(filepath), { recursive: true });

        if (options.format === 'json') {
          await fs.writeFile(filepath, JSON.stringify(allStats, null, 2));
        } else if (options.format === 'markdown') {
          const markdown = generateStatsMarkdown(allStats);
          await fs.writeFile(filepath, markdown);
        }

        console.log(chalk.green(`\n📄 Statistics exported to: ${filepath}`));
      }

    } catch (error) {
      console.error(chalk.red(`❌ Failed to get statistics: ${error.message}`));
      process.exit(1);
    }
  });

/**
 * Generate markdown statistics report
 */
function generateStatsMarkdown(stats) {
  return `
# Truxe Error System Statistics

**Generated:** ${stats.timestamp}

## Error Processing Statistics

- **Total Errors:** ${stats.error_stats.total_errors}
- **Resolution Rate:** ${stats.error_stats.resolution_rate}%

### By Category
${Object.entries(stats.error_stats.by_category).map(([cat, count]) => `- **${cat}:** ${count}`).join('\n')}

### By Severity
${Object.entries(stats.error_stats.by_severity).map(([sev, count]) => `- **${sev}:** ${count}`).join('\n')}

## Troubleshooting Statistics

- **Total Sessions:** ${stats.troubleshooting_stats.total_sessions}
- **Success Rate:** ${stats.troubleshooting_stats.success_rate}%
- **Fixes Applied:** ${stats.troubleshooting_stats.fixes_applied}
- **Successful Fixes:** ${stats.troubleshooting_stats.successful_fixes}

## Validation Statistics

- **Total Validations:** ${stats.validation_stats.total_validations}
- **Success Rate:** ${stats.validation_stats.recent_success_rate}%
- **Total Rules:** ${stats.validation_stats.total_rules}
- **Total Schemas:** ${stats.validation_stats.total_schemas}

## Health Check Statistics

- **Total Checks:** ${stats.health_stats.total_checks}
- **Total Executions:** ${stats.health_stats.total_executions}
- **Success Rate:** ${stats.health_stats.success_rate}%
- **Average Execution Time:** ${stats.health_stats.average_execution_time}ms
`;
}

/**
 * Main execution
 */
async function main() {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    console.error(chalk.red(`❌ Command failed: ${error.message}`));
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { program };
