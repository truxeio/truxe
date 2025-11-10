#!/usr/bin/env node

/**
 * Truxe Startup Validation Script
 * 
 * Pre-startup validation script that integrates with Docker Compose and other startup processes.
 * Ensures all port conflicts are resolved before services start.
 * 
 * @author DevOps Engineering Team
 * @version 3.0.0
 */

import { portStartupValidator } from '../config/port-startup-validator.js';
import { portConflictResolver } from '../config/port-conflict-resolver.js';
import { portMonitor } from '../config/port-monitor.js';
import portManager from '../config/ports.js';
import { execSync, spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Startup Validation CLI
 */
class StartupValidationCLI {
  constructor() {
    this.environment = process.env.NODE_ENV || process.env.TRUXE_ENV || 'development';
    this.verbose = false;
    this.dryRun = false;
    this.autoResolve = false;
    this.exitOnFailure = true;
  }

  /**
   * Parse command line arguments
   */
  parseArguments() {
    const args = process.argv.slice(2);
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      switch (arg) {
        case '--env':
        case '-e':
          this.environment = args[++i];
          break;
        case '--verbose':
        case '-v':
          this.verbose = true;
          break;
        case '--dry-run':
        case '-d':
          this.dryRun = true;
          break;
        case '--auto-resolve':
        case '-a':
          this.autoResolve = true;
          break;
        case '--no-exit':
          this.exitOnFailure = false;
          break;
        case '--help':
        case '-h':
          this.showHelp();
          process.exit(0);
          break;
        default:
          if (arg.startsWith('--')) {
            console.error(`Unknown option: ${arg}`);
            this.showHelp();
            process.exit(1);
          }
          break;
      }
    }
  }

  /**
   * Show help message
   */
  showHelp() {
    console.log(`
🚀 Truxe Startup Validation Tool

Usage: node startup-validator.js [options]

Options:
  -e, --env <environment>     Environment to validate (default: development)
  -v, --verbose              Enable verbose output
  -d, --dry-run              Perform validation without making changes
  -a, --auto-resolve         Automatically resolve conflicts when possible
      --no-exit              Don't exit on validation failure
  -h, --help                 Show this help message

Examples:
  node startup-validator.js --env production --verbose
  node startup-validator.js --auto-resolve --dry-run
  node startup-validator.js --env staging --no-exit

Environment Variables:
  NODE_ENV                   Default environment
  TRUXE_ENV              Override environment
  TRUXE_STARTUP_TIMEOUT   Validation timeout (default: 30000ms)
  TRUXE_AUTO_RESOLVE      Enable auto-resolve (true/false)
    `);
  }

  /**
   * Main validation process
   */
  async run() {
    this.parseArguments();

    console.log('🔍 Truxe Startup Validation');
    console.log('=' .repeat(50));
    console.log(`Environment: ${this.environment}`);
    console.log(`Dry Run: ${this.dryRun ? 'Yes' : 'No'}`);
    console.log(`Auto Resolve: ${this.autoResolve ? 'Yes' : 'No'}`);
    console.log('=' .repeat(50));

    const startTime = Date.now();
    let validationResult = null;
    let resolutionResult = null;

    try {
      // Step 1: Pre-startup validation
      console.log('\n📋 Step 1: Running pre-startup validation...');
      
      validationResult = await portStartupValidator.validateStartup(this.environment, {
        autoFix: this.autoResolve && !this.dryRun,
        failFast: false,
        includeOptional: true,
        timeout: parseInt(process.env.TRUXE_STARTUP_TIMEOUT) || 30000
      });

      this.displayValidationResults(validationResult);

      // Step 2: Conflict resolution if needed
      if (!validationResult.startup_readiness.can_start) {
        console.log('\n🔧 Step 2: Resolving port conflicts...');
        
        resolutionResult = await portConflictResolver.resolveConflicts(this.environment, {
          strategy: this.autoResolve ? 'automatic' : 'interactive',
          autoApprove: this.autoResolve,
          dryRun: this.dryRun,
          timeout: 30000
        });

        this.displayResolutionResults(resolutionResult);

        // Step 3: Re-validate after resolution
        if (!this.dryRun && resolutionResult.conflicts_resolved > 0) {
          console.log('\n🔍 Step 3: Re-validating after conflict resolution...');
          
          validationResult = await portStartupValidator.validateStartup(this.environment, {
            autoFix: false,
            failFast: false,
            includeOptional: false,
            timeout: 15000
          });

          this.displayValidationResults(validationResult, true);
        }
      }

      // Step 4: Generate startup readiness report
      const readinessReport = this.generateStartupReadinessReport(
        validationResult,
        resolutionResult,
        Date.now() - startTime
      );

      this.displayStartupReadiness(readinessReport);

      // Step 5: Export reports if requested
      if (this.verbose || !readinessReport.ready_for_startup) {
        await this.exportReports(validationResult, resolutionResult);
      }

      // Step 6: Exit with appropriate code
      if (this.exitOnFailure && !readinessReport.ready_for_startup) {
        console.log('\n❌ Startup validation failed. Services should not be started.');
        process.exit(1);
      } else if (readinessReport.ready_for_startup) {
        console.log('\n✅ Startup validation passed. Services are ready to start.');
        process.exit(0);
      } else {
        console.log('\n⚠️  Startup validation completed with warnings.');
        process.exit(0);
      }

    } catch (error) {
      console.error(`\n💥 Startup validation failed with error: ${error.message}`);
      
      if (this.verbose) {
        console.error('Stack trace:', error.stack);
      }

      if (this.exitOnFailure) {
        process.exit(1);
      }
    }
  }

  /**
   * Display validation results
   */
  displayValidationResults(validationResult, isRevalidation = false) {
    const prefix = isRevalidation ? '   Re-validation' : '   Validation';
    
    console.log(`${prefix} Status: ${this.getStatusIcon(validationResult.status)} ${validationResult.status.toUpperCase()}`);
    console.log(`${prefix} Ready: ${validationResult.startup_readiness.can_start ? '✅' : '❌'}`);
    console.log(`${prefix} Time: ${validationResult.validation_time_ms}ms`);
    
    if (validationResult.rules_executed > 0) {
      console.log(`${prefix} Rules: ${validationResult.rules_passed}/${validationResult.rules_executed} passed`);
    }

    if (validationResult.summary.critical_issues > 0) {
      console.log(`   🚨 Critical Issues: ${validationResult.summary.critical_issues}`);
    }
    
    if (validationResult.summary.errors > 0) {
      console.log(`   ❌ Errors: ${validationResult.summary.errors}`);
    }
    
    if (validationResult.summary.warnings > 0) {
      console.log(`   ⚠️  Warnings: ${validationResult.summary.warnings}`);
    }

    // Show detailed results if verbose or there are issues
    if (this.verbose || !validationResult.startup_readiness.can_start) {
      console.log('\n   📋 Detailed Results:');
      
      for (const result of validationResult.results) {
        const icon = this.getStatusIcon(result.status);
        console.log(`      ${icon} ${result.rule_description}: ${result.message}`);
        
        if (result.suggestions && result.suggestions.length > 0 && this.verbose) {
          result.suggestions.forEach(suggestion => {
            console.log(`         💡 ${suggestion.description}`);
          });
        }
      }
    }

    // Show recommended actions
    if (validationResult.startup_readiness.recommended_actions.length > 0) {
      console.log('\n   📝 Recommended Actions:');
      
      for (const action of validationResult.startup_readiness.recommended_actions) {
        const priorityIcon = {
          'critical': '🚨',
          'high': '⚠️',
          'medium': '📋',
          'low': '💡'
        }[action.priority] || '📋';
        
        console.log(`      ${priorityIcon} ${action.action}: ${action.message}`);
      }
    }
  }

  /**
   * Display resolution results
   */
  displayResolutionResults(resolutionResult) {
    console.log(`   Resolution Status: ${this.getResolutionStatusIcon(resolutionResult.final_status)} ${resolutionResult.final_status}`);
    console.log(`   Conflicts Detected: ${resolutionResult.conflicts_detected}`);
    console.log(`   Conflicts Resolved: ${resolutionResult.conflicts_resolved}`);
    
    if (resolutionResult.conflicts_failed > 0) {
      console.log(`   Resolution Failures: ${resolutionResult.conflicts_failed}`);
    }

    if (resolutionResult.actions_taken.length > 0) {
      console.log('\n   🔧 Actions Taken:');
      
      for (const action of resolutionResult.actions_taken) {
        const success = action.result ? action.result.success : action.dry_run;
        const icon = success ? '✅' : '❌';
        const dryRunText = action.dry_run ? ' (DRY RUN)' : '';
        
        console.log(`      ${icon} ${action.description}${dryRunText}`);
        
        if (!success && action.result && action.result.error && this.verbose) {
          console.log(`         Error: ${action.result.error}`);
        }
      }
    }

    if (resolutionResult.recommendations.length > 0) {
      console.log('\n   💡 Additional Recommendations:');
      
      for (const rec of resolutionResult.recommendations) {
        console.log(`      • ${rec.message}`);
        
        if (rec.suggestions && this.verbose) {
          rec.suggestions.forEach(suggestion => {
            console.log(`        - ${suggestion}`);
          });
        }
      }
    }
  }

  /**
   * Generate startup readiness report
   */
  generateStartupReadinessReport(validationResult, resolutionResult, totalTimeMs) {
    const report = {
      timestamp: new Date().toISOString(),
      environment: this.environment,
      total_validation_time_ms: totalTimeMs,
      ready_for_startup: false,
      confidence_level: 'low',
      blocking_issues: [],
      warnings: [],
      recommendations: [],
      next_steps: []
    };

    // Determine readiness
    if (validationResult.startup_readiness.can_start) {
      report.ready_for_startup = true;
      report.confidence_level = validationResult.summary.warnings === 0 ? 'high' : 'medium';
    } else {
      report.ready_for_startup = false;
      report.blocking_issues = validationResult.startup_readiness.blocking_issues;
    }

    // Add warnings
    report.warnings = validationResult.results
      .filter(r => r.status === 'warning')
      .map(r => r.message);

    // Compile recommendations
    if (validationResult.summary.suggestions) {
      report.recommendations.push(...validationResult.summary.suggestions);
    }

    if (resolutionResult && resolutionResult.recommendations) {
      report.recommendations.push(...resolutionResult.recommendations);
    }

    // Generate next steps
    if (report.ready_for_startup) {
      if (report.warnings.length > 0) {
        report.next_steps.push('Consider addressing warnings for optimal performance');
      }
      report.next_steps.push('Services can be started safely');
    } else {
      report.next_steps.push('Resolve blocking issues before starting services');
      
      if (resolutionResult && resolutionResult.conflicts_failed > 0) {
        report.next_steps.push('Manual intervention may be required for some conflicts');
      }
    }

    return report;
  }

  /**
   * Display startup readiness
   */
  displayStartupReadiness(report) {
    console.log('\n🎯 Startup Readiness Report');
    console.log('-' .repeat(30));
    
    const readyIcon = report.ready_for_startup ? '✅' : '❌';
    const confidenceColor = {
      'high': '\x1b[32m',    // Green
      'medium': '\x1b[33m',  // Yellow
      'low': '\x1b[31m'      // Red
    }[report.confidence_level] || '';
    
    console.log(`Ready for Startup: ${readyIcon} ${report.ready_for_startup ? 'YES' : 'NO'}`);
    console.log(`Confidence Level: ${confidenceColor}${report.confidence_level.toUpperCase()}\x1b[0m`);
    console.log(`Total Time: ${report.total_validation_time_ms}ms`);

    if (report.blocking_issues.length > 0) {
      console.log('\n🚫 Blocking Issues:');
      report.blocking_issues.forEach(issue => {
        console.log(`   • ${issue.message}`);
      });
    }

    if (report.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      report.warnings.forEach(warning => {
        console.log(`   • ${warning}`);
      });
    }

    if (report.next_steps.length > 0) {
      console.log('\n📝 Next Steps:');
      report.next_steps.forEach((step, index) => {
        console.log(`   ${index + 1}. ${step}`);
      });
    }
  }

  /**
   * Export reports
   */
  async exportReports(validationResult, resolutionResult) {
    try {
      const reportsDir = path.join(__dirname, '..', 'reports');
      await fs.mkdir(reportsDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      // Export validation report
      if (validationResult) {
        const validationPath = await portStartupValidator.exportValidationReport(
          validationResult,
          'json'
        );
        console.log(`\n📄 Validation report exported: ${validationPath}`);
      }

      // Export resolution report
      if (resolutionResult) {
        const resolutionPath = await portConflictResolver.exportResolutionReport(
          resolutionResult,
          'json'
        );
        console.log(`📄 Resolution report exported: ${resolutionPath}`);
      }

    } catch (error) {
      console.warn(`⚠️  Failed to export reports: ${error.message}`);
    }
  }

  /**
   * Get status icon
   */
  getStatusIcon(status) {
    const icons = {
      'success': '✅',
      'warning': '⚠️',
      'error': '❌',
      'critical': '🚨'
    };
    return icons[status] || '❓';
  }

  /**
   * Get resolution status icon
   */
  getResolutionStatusIcon(status) {
    const icons = {
      'resolved': '✅',
      'partially_resolved': '⚠️',
      'failed': '❌',
      'no_conflicts': '✅',
      'dry_run_completed': '🔍'
    };
    return icons[status] || '❓';
  }
}

// Docker Compose integration functions
export class DockerComposeIntegration {
  /**
   * Pre-startup hook for Docker Compose
   */
  static async preStartupHook(environment = 'development') {
    console.log('🐳 Docker Compose Pre-Startup Hook');
    
    const cli = new StartupValidationCLI();
    cli.environment = environment;
    cli.autoResolve = process.env.TRUXE_AUTO_RESOLVE === 'true';
    cli.dryRun = false;
    cli.exitOnFailure = true;
    
    await cli.run();
  }

  /**
   * Generate Docker Compose with port validation
   */
  static async generateValidatedDockerCompose(environment = 'development') {
    console.log('🔧 Generating validated Docker Compose configuration...');
    
    // Run validation first
    const validationResult = await portStartupValidator.validateStartup(environment);
    
    if (!validationResult.startup_readiness.can_start) {
      throw new Error('Cannot generate Docker Compose: port validation failed');
    }

    // Generate Docker Compose configuration
    const envConfig = portManager.getEnvironmentConfig(environment);
    const portMappings = portManager.generateDockerComposePorts(environment);

    return {
      validation_passed: true,
      port_mappings: portMappings,
      environment_config: envConfig
    };
  }

  /**
   * Monitor Docker Compose services
   */
  static async monitorDockerServices(environment = 'development', duration = 60000) {
    console.log('📊 Starting Docker service monitoring...');
    
    const envConfig = portManager.getEnvironmentConfig(environment);
    const servicePorts = Object.values(envConfig.services);

    await portMonitor.startMonitoring(servicePorts, {
      frequency: 5000,
      environment,
      enableAlerts: true
    });

    // Monitor for specified duration
    await new Promise(resolve => setTimeout(resolve, duration));

    const stats = portMonitor.getPortStatistics();
    portMonitor.stopMonitoring();

    return stats;
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = new StartupValidationCLI();
  cli.run().catch(error => {
    console.error('Startup validation failed:', error.message);
    process.exit(1);
  });
}

export { StartupValidationCLI };
export default StartupValidationCLI;
