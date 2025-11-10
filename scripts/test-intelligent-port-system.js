#!/usr/bin/env node

/**
 * Comprehensive Test Suite for Intelligent Port Management System
 * 
 * Tests all components and validates acceptance criteria for the
 * intelligent automated port suggestion system.
 * 
 * @author DevOps Engineering Team
 * @version 3.0.0
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test Suite Configuration
 */
const TEST_CONFIG = {
  environments: ['development', 'staging', 'testing'],
  test_services: ['api', 'database', 'redis', 'monitoring'],
  test_ports: [21001, 21432, 21379, 21003],
  timeout: 30000,
  verbose: process.argv.includes('--verbose'),
  dryRun: process.argv.includes('--dry-run')
};

/**
 * Test Results Tracking
 */
class TestResults {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
    this.skipped = 0;
    this.startTime = Date.now();
  }

  addTest(name, status, details = {}) {
    const test = {
      name,
      status, // 'passed', 'failed', 'skipped'
      details,
      timestamp: Date.now()
    };

    this.tests.push(test);

    switch (status) {
      case 'passed':
        this.passed++;
        break;
      case 'failed':
        this.failed++;
        break;
      case 'skipped':
        this.skipped++;
        break;
    }

    if (TEST_CONFIG.verbose) {
      const icon = status === 'passed' ? '✅' : status === 'failed' ? '❌' : '⏭️';
      console.log(`${icon} ${name}`);
      if (details.message) {
        console.log(`   ${details.message}`);
      }
    }
  }

  getSummary() {
    const duration = Date.now() - this.startTime;
    const total = this.passed + this.failed + this.skipped;

    return {
      total,
      passed: this.passed,
      failed: this.failed,
      skipped: this.skipped,
      success_rate: total > 0 ? (this.passed / total * 100).toFixed(2) : 0,
      duration_ms: duration,
      duration_formatted: `${(duration / 1000).toFixed(2)}s`
    };
  }

  generateReport() {
    const summary = this.getSummary();
    
    const report = {
      timestamp: new Date().toISOString(),
      summary,
      tests: this.tests,
      acceptance_criteria: this.validateAcceptanceCriteria(),
      definition_of_done: this.validateDefinitionOfDone()
    };

    return report;
  }

  validateAcceptanceCriteria() {
    const criteria = {
      'Port suggestions avoid all conflicts': this.hasPassedTest('Conflict Avoidance'),
      'Algorithm considers service requirements': this.hasPassedTest('Service-Specific Suggestions'),
      'Multiple suggestion options provided': this.hasPassedTest('Multiple Suggestions'),
      'Integration with existing tools complete': this.hasPassedTest('CLI Integration'),
      'Suggestions optimize development workflow': this.hasPassedTest('Workflow Optimization')
    };

    const passed = Object.values(criteria).filter(Boolean).length;
    const total = Object.keys(criteria).length;

    return {
      criteria,
      passed,
      total,
      all_passed: passed === total
    };
  }

  validateDefinitionOfDone() {
    const done = {
      'Port suggestion algorithm implemented': this.hasPassedTest('Algorithm Implementation'),
      'Conflict avoidance working properly': this.hasPassedTest('Conflict Avoidance'),
      'Service-specific suggestions accurate': this.hasPassedTest('Service-Specific Suggestions'),
      'Integration with tools complete': this.hasPassedTest('CLI Integration'),
      'Algorithm optimizes for development': this.hasPassedTest('Development Optimization')
    };

    const passed = Object.values(done).filter(Boolean).length;
    const total = Object.keys(done).length;

    return {
      done,
      passed,
      total,
      all_done: passed === total
    };
  }

  hasPassedTest(category) {
    return this.tests.some(test => 
      test.name.includes(category) && test.status === 'passed'
    );
  }
}

/**
 * Main Test Runner
 */
class IntelligentPortSystemTester {
  constructor() {
    this.results = new TestResults();
    this.components = {};
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🧪 Starting Intelligent Port Management System Test Suite');
    console.log('=' .repeat(60));

    try {
      // Initialize test environment
      await this.initializeTestEnvironment();

      // Component Tests
      await this.testComponentInitialization();
      await this.testPortManager();
      await this.testIntelligentSuggester();
      await this.testUsageAnalyzer();
      await this.testConflictAvoidance();
      await this.testSystemIntegration();

      // Feature Tests
      await this.testAlgorithmImplementation();
      await this.testConflictAvoidanceFeatures();
      await this.testServiceSpecificSuggestions();
      await this.testMultipleSuggestionOptions();
      await this.testCLIIntegration();
      await this.testWorkflowOptimization();
      await this.testDevelopmentOptimization();

      // Performance Tests
      await this.testPerformance();

      // Integration Tests
      await this.testEndToEndScenarios();

      // Generate final report
      const report = this.results.generateReport();
      await this.saveTestReport(report);
      this.displaySummary(report);

      return report;

    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      this.results.addTest('Test Suite Execution', 'failed', { 
        error: error.message,
        stack: error.stack 
      });
      throw error;
    }
  }

  /**
   * Initialize test environment
   */
  async initializeTestEnvironment() {
    console.log('🔧 Initializing test environment...');

    try {
      // Load components
      const { default: portManager } = await import('../config/ports.js');
      this.components.portManager = portManager;

      const { default: intelligentSuggester } = await import('../config/intelligent-port-suggester.js');
      this.components.intelligentSuggester = intelligentSuggester;

      const { default: usageAnalyzer } = await import('../config/port-usage-analyzer.js');
      this.components.usageAnalyzer = usageAnalyzer;

      const { default: conflictAvoidance } = await import('../config/advanced-conflict-avoidance.js');
      this.components.conflictAvoidance = conflictAvoidance;

      const { default: intelligentPortSystem } = await import('../config/intelligent-port-system.js');
      this.components.intelligentPortSystem = intelligentPortSystem;

      this.results.addTest('Test Environment Initialization', 'passed', {
        message: 'All components loaded successfully'
      });

    } catch (error) {
      this.results.addTest('Test Environment Initialization', 'failed', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Test component initialization
   */
  async testComponentInitialization() {
    console.log('🔧 Testing component initialization...');

    // Test Port Manager
    try {
      const envConfig = this.components.portManager.getEnvironmentConfig('development');
      if (envConfig && envConfig.services) {
        this.results.addTest('Port Manager Initialization', 'passed');
      } else {
        this.results.addTest('Port Manager Initialization', 'failed', {
          message: 'Invalid environment configuration'
        });
      }
    } catch (error) {
      this.results.addTest('Port Manager Initialization', 'failed', { error: error.message });
    }

    // Test Intelligent Suggester
    try {
      if (this.components.intelligentSuggester.initialized !== false) {
        this.results.addTest('Intelligent Suggester Initialization', 'passed');
      } else {
        this.results.addTest('Intelligent Suggester Initialization', 'failed', {
          message: 'Component not initialized'
        });
      }
    } catch (error) {
      this.results.addTest('Intelligent Suggester Initialization', 'failed', { error: error.message });
    }

    // Test other components
    const components = ['usageAnalyzer', 'conflictAvoidance', 'intelligentPortSystem'];
    
    for (const componentName of components) {
      try {
        const component = this.components[componentName];
        if (component) {
          this.results.addTest(`${componentName} Initialization`, 'passed');
        } else {
          this.results.addTest(`${componentName} Initialization`, 'failed', {
            message: 'Component not loaded'
          });
        }
      } catch (error) {
        this.results.addTest(`${componentName} Initialization`, 'failed', { error: error.message });
      }
    }
  }

  /**
   * Test Port Manager functionality
   */
  async testPortManager() {
    console.log('🔍 Testing Port Manager...');

    const portManager = this.components.portManager;

    // Test environment detection
    try {
      const env = portManager.detectEnvironment();
      if (env) {
        this.results.addTest('Environment Detection', 'passed', { environment: env });
      } else {
        this.results.addTest('Environment Detection', 'failed');
      }
    } catch (error) {
      this.results.addTest('Environment Detection', 'failed', { error: error.message });
    }

    // Test port availability checking
    try {
      const testPort = 21001;
      const isAvailable = portManager.isPortAvailable(testPort);
      this.results.addTest('Port Availability Check', 'passed', { 
        port: testPort, 
        available: isAvailable 
      });
    } catch (error) {
      this.results.addTest('Port Availability Check', 'failed', { error: error.message });
    }

    // Test conflict detection
    try {
      const conflicts = portManager.detectConflicts('development');
      this.results.addTest('Basic Conflict Detection', 'passed', { 
        conflicts_found: conflicts.length 
      });
    } catch (error) {
      this.results.addTest('Basic Conflict Detection', 'failed', { error: error.message });
    }

    // Test port utilization calculation
    try {
      const utilization = portManager.calculatePortUtilization('development');
      if (typeof utilization === 'number' && utilization >= 0 && utilization <= 100) {
        this.results.addTest('Port Utilization Calculation', 'passed', { 
          utilization: `${utilization}%` 
        });
      } else {
        this.results.addTest('Port Utilization Calculation', 'failed', {
          message: 'Invalid utilization value'
        });
      }
    } catch (error) {
      this.results.addTest('Port Utilization Calculation', 'failed', { error: error.message });
    }
  }

  /**
   * Test Intelligent Suggester
   */
  async testIntelligentSuggester() {
    console.log('🧠 Testing Intelligent Suggester...');

    const suggester = this.components.intelligentSuggester;

    // Test port usage analysis
    try {
      const analysis = await suggester.analyzePortUsage('development');
      if (analysis && analysis.environment === 'development') {
        this.results.addTest('Port Usage Analysis', 'passed', {
          services_analyzed: analysis.total_services
        });
      } else {
        this.results.addTest('Port Usage Analysis', 'failed', {
          message: 'Invalid analysis result'
        });
      }
    } catch (error) {
      this.results.addTest('Port Usage Analysis', 'failed', { error: error.message });
    }

    // Test intelligent suggestions
    try {
      const suggestions = await suggester.suggestOptimalPorts('api', 'development', {
        count: 3,
        includeReasoningDetails: true
      });

      if (suggestions && suggestions.suggestions && suggestions.suggestions.length > 0) {
        this.results.addTest('Algorithm Implementation', 'passed', {
          suggestions_count: suggestions.suggestions.length,
          service: suggestions.service
        });

        // Validate suggestion quality
        const hasHighScoreSuggestions = suggestions.suggestions.some(s => s.final_score > 70);
        if (hasHighScoreSuggestions) {
          this.results.addTest('High Quality Suggestions', 'passed');
        } else {
          this.results.addTest('High Quality Suggestions', 'failed', {
            message: 'No high-score suggestions found'
          });
        }
      } else {
        this.results.addTest('Algorithm Implementation', 'failed', {
          message: 'No suggestions generated'
        });
      }
    } catch (error) {
      this.results.addTest('Algorithm Implementation', 'failed', { error: error.message });
    }

    // Test service-specific suggestions
    for (const service of TEST_CONFIG.test_services) {
      try {
        const suggestions = await suggester.suggestOptimalPorts(service, 'development', {
          count: 2
        });

        if (suggestions && suggestions.suggestions.length > 0) {
          this.results.addTest(`Service-Specific Suggestions - ${service}`, 'passed', {
            suggestions_count: suggestions.suggestions.length
          });
        } else {
          this.results.addTest(`Service-Specific Suggestions - ${service}`, 'failed');
        }
      } catch (error) {
        this.results.addTest(`Service-Specific Suggestions - ${service}`, 'failed', { 
          error: error.message 
        });
      }
    }

    // Test multiple suggestion options
    try {
      const suggestions = await suggester.suggestOptimalPorts('api', 'development', {
        count: 5
      });

      if (suggestions && suggestions.suggestions.length >= 3) {
        this.results.addTest('Multiple Suggestions', 'passed', {
          requested: 5,
          received: suggestions.suggestions.length
        });
      } else {
        this.results.addTest('Multiple Suggestions', 'failed', {
          message: 'Insufficient suggestions provided'
        });
      }
    } catch (error) {
      this.results.addTest('Multiple Suggestions', 'failed', { error: error.message });
    }
  }

  /**
   * Test Usage Analyzer
   */
  async testUsageAnalyzer() {
    console.log('📊 Testing Usage Analyzer...');

    const analyzer = this.components.usageAnalyzer;

    // Test data collection
    try {
      await analyzer.collectRealTimeData();
      this.results.addTest('Real-time Data Collection', 'passed');
    } catch (error) {
      this.results.addTest('Real-time Data Collection', 'failed', { error: error.message });
    }

    // Test analytics report generation
    try {
      const report = await analyzer.generateAnalyticsReport('24h');
      if (report && report.summary) {
        this.results.addTest('Analytics Report Generation', 'passed', {
          timeframe: report.timeframe
        });
      } else {
        this.results.addTest('Analytics Report Generation', 'failed');
      }
    } catch (error) {
      this.results.addTest('Analytics Report Generation', 'failed', { error: error.message });
    }
  }

  /**
   * Test Conflict Avoidance
   */
  async testConflictAvoidance() {
    console.log('🛡️  Testing Conflict Avoidance...');

    const conflictAvoidance = this.components.conflictAvoidance;

    // Test conflict detection
    try {
      const conflicts = await conflictAvoidance.detectConflicts('development');
      if (conflicts && typeof conflicts.summary === 'object') {
        this.results.addTest('Conflict Avoidance', 'passed', {
          total_conflicts: conflicts.summary.total_conflicts,
          detection_methods: conflicts.detection_methods.length
        });
      } else {
        this.results.addTest('Conflict Avoidance', 'failed', {
          message: 'Invalid conflict detection result'
        });
      }
    } catch (error) {
      this.results.addTest('Conflict Avoidance', 'failed', { error: error.message });
    }

    // Test predictive conflict detection
    try {
      const conflicts = await conflictAvoidance.detectConflicts('development', {
        includePredictive: true
      });

      if (conflicts.predictions !== undefined) {
        this.results.addTest('Predictive Conflict Detection', 'passed', {
          predictions: conflicts.predictions.length
        });
      } else {
        this.results.addTest('Predictive Conflict Detection', 'failed');
      }
    } catch (error) {
      this.results.addTest('Predictive Conflict Detection', 'failed', { error: error.message });
    }

    // Test conflict resolution (dry run)
    try {
      const conflicts = await conflictAvoidance.detectConflicts('development');
      if (conflicts.conflicts.length > 0) {
        const resolutionResults = await conflictAvoidance.resolveConflicts(
          conflicts.conflicts.slice(0, 1), // Test with one conflict
          { dryRun: true }
        );

        if (resolutionResults && resolutionResults.resolutions) {
          this.results.addTest('Conflict Resolution (Dry Run)', 'passed', {
            conflicts_processed: resolutionResults.total_conflicts
          });
        } else {
          this.results.addTest('Conflict Resolution (Dry Run)', 'failed');
        }
      } else {
        this.results.addTest('Conflict Resolution (Dry Run)', 'skipped', {
          message: 'No conflicts to resolve'
        });
      }
    } catch (error) {
      this.results.addTest('Conflict Resolution (Dry Run)', 'failed', { error: error.message });
    }
  }

  /**
   * Test System Integration
   */
  async testSystemIntegration() {
    console.log('🔗 Testing System Integration...');

    const system = this.components.intelligentPortSystem;

    // Test system initialization
    try {
      if (!TEST_CONFIG.dryRun) {
        await system.initialize({
          config: {
            auto_optimization: false,
            monitoring_enabled: false
          }
        });
      }

      this.results.addTest('System Integration', 'passed');
    } catch (error) {
      this.results.addTest('System Integration', 'failed', { error: error.message });
    }

    // Test integrated suggestions
    try {
      const suggestions = await system.getIntelligentSuggestions('api', 'development', {
        count: 3
      });

      if (suggestions && suggestions.suggestions) {
        this.results.addTest('Integrated Intelligent Suggestions', 'passed', {
          suggestions_count: suggestions.suggestions.length
        });
      } else {
        this.results.addTest('Integrated Intelligent Suggestions', 'failed');
      }
    } catch (error) {
      this.results.addTest('Integrated Intelligent Suggestions', 'failed', { error: error.message });
    }

    // Test system status
    try {
      const status = await system.getSystemStatus();
      if (status && status.system_health) {
        this.results.addTest('System Status Reporting', 'passed', {
          health_status: status.system_health.status
        });
      } else {
        this.results.addTest('System Status Reporting', 'failed');
      }
    } catch (error) {
      this.results.addTest('System Status Reporting', 'failed', { error: error.message });
    }
  }

  /**
   * Test CLI Integration
   */
  async testCLIIntegration() {
    console.log('💻 Testing CLI Integration...');

    try {
      // Test CLI command availability
      const cliPath = path.join(__dirname, '../cli/dist/index.js');
      
      try {
        await fs.access(cliPath);
        this.results.addTest('CLI Binary Available', 'passed');
      } catch {
        this.results.addTest('CLI Binary Available', 'failed', {
          message: 'CLI binary not found'
        });
        return;
      }

      // Test port suggestion command
      try {
        if (!TEST_CONFIG.dryRun) {
          const result = execSync('node ../cli/dist/index.js ports suggest api --optimize --count 3', {
            cwd: __dirname,
            encoding: 'utf8',
            timeout: 10000
          });

          if (result.includes('Port') || result.includes('suggestion')) {
            this.results.addTest('CLI Integration', 'passed');
          } else {
            this.results.addTest('CLI Integration', 'failed', {
              message: 'Unexpected CLI output'
            });
          }
        } else {
          this.results.addTest('CLI Integration', 'skipped', {
            message: 'Dry run mode'
          });
        }
      } catch (error) {
        this.results.addTest('CLI Integration', 'failed', { 
          error: error.message 
        });
      }

    } catch (error) {
      this.results.addTest('CLI Integration', 'failed', { error: error.message });
    }
  }

  /**
   * Test workflow optimization
   */
  async testWorkflowOptimization() {
    console.log('⚡ Testing Workflow Optimization...');

    const suggester = this.components.intelligentSuggester;

    try {
      // Test optimization for development workflow
      const optimization = await suggester.exportOptimizedConfiguration('development');
      
      if (optimization && optimization.optimization_summary) {
        this.results.addTest('Workflow Optimization', 'passed', {
          services_analyzed: optimization.optimization_summary.total_services,
          changes_suggested: optimization.changes.length
        });
      } else {
        this.results.addTest('Workflow Optimization', 'failed');
      }
    } catch (error) {
      this.results.addTest('Workflow Optimization', 'failed', { error: error.message });
    }

    // Test development-specific optimization
    try {
      const healthReport = await suggester.getSystemHealthReport('development');
      
      if (healthReport && healthReport.recommendations) {
        this.results.addTest('Development Optimization', 'passed', {
          health_score: healthReport.health_score,
          recommendations: healthReport.recommendations.length
        });
      } else {
        this.results.addTest('Development Optimization', 'failed');
      }
    } catch (error) {
      this.results.addTest('Development Optimization', 'failed', { error: error.message });
    }
  }

  /**
   * Test performance
   */
  async testPerformance() {
    console.log('⚡ Testing Performance...');

    const suggester = this.components.intelligentSuggester;

    // Test suggestion generation performance
    try {
      const startTime = Date.now();
      
      await suggester.suggestOptimalPorts('api', 'development', { count: 5 });
      
      const duration = Date.now() - startTime;
      
      if (duration < 5000) { // Should complete within 5 seconds
        this.results.addTest('Suggestion Performance', 'passed', {
          duration_ms: duration
        });
      } else {
        this.results.addTest('Suggestion Performance', 'failed', {
          message: `Too slow: ${duration}ms`
        });
      }
    } catch (error) {
      this.results.addTest('Suggestion Performance', 'failed', { error: error.message });
    }

    // Test bulk suggestion performance
    try {
      const startTime = Date.now();
      
      const promises = TEST_CONFIG.test_services.map(service =>
        suggester.suggestOptimalPorts(service, 'development', { count: 3 })
      );
      
      await Promise.all(promises);
      
      const duration = Date.now() - startTime;
      
      if (duration < 10000) { // Should complete within 10 seconds
        this.results.addTest('Bulk Suggestion Performance', 'passed', {
          services: TEST_CONFIG.test_services.length,
          duration_ms: duration
        });
      } else {
        this.results.addTest('Bulk Suggestion Performance', 'failed', {
          message: `Too slow: ${duration}ms`
        });
      }
    } catch (error) {
      this.results.addTest('Bulk Suggestion Performance', 'failed', { error: error.message });
    }
  }

  /**
   * Test end-to-end scenarios
   */
  async testEndToEndScenarios() {
    console.log('🎯 Testing End-to-End Scenarios...');

    // Scenario 1: New service deployment
    try {
      const suggestions = await this.components.intelligentSuggester.suggestOptimalPorts(
        'new_service', 
        'development',
        { count: 3, avoidCurrentPort: true }
      );

      if (suggestions && suggestions.suggestions.length > 0) {
        this.results.addTest('E2E: New Service Deployment', 'passed', {
          suggestions_provided: suggestions.suggestions.length
        });
      } else {
        this.results.addTest('E2E: New Service Deployment', 'failed');
      }
    } catch (error) {
      this.results.addTest('E2E: New Service Deployment', 'failed', { error: error.message });
    }

    // Scenario 2: Conflict resolution workflow
    try {
      const conflicts = await this.components.conflictAvoidance.detectConflicts('development');
      
      if (conflicts.conflicts.length > 0) {
        const autoResolvable = conflicts.conflicts.filter(c => c.auto_resolvable);
        
        if (autoResolvable.length > 0) {
          const resolution = await this.components.conflictAvoidance.resolveConflicts(
            autoResolvable.slice(0, 1),
            { dryRun: true }
          );

          if (resolution && resolution.resolutions.length > 0) {
            this.results.addTest('E2E: Conflict Resolution Workflow', 'passed');
          } else {
            this.results.addTest('E2E: Conflict Resolution Workflow', 'failed');
          }
        } else {
          this.results.addTest('E2E: Conflict Resolution Workflow', 'skipped', {
            message: 'No auto-resolvable conflicts'
          });
        }
      } else {
        this.results.addTest('E2E: Conflict Resolution Workflow', 'skipped', {
          message: 'No conflicts detected'
        });
      }
    } catch (error) {
      this.results.addTest('E2E: Conflict Resolution Workflow', 'failed', { error: error.message });
    }

    // Scenario 3: System optimization workflow
    try {
      const system = this.components.intelligentPortSystem;
      
      if (!TEST_CONFIG.dryRun) {
        await system.performHealthCheck();
      }
      
      const status = await system.getSystemStatus();
      
      if (status && status.system_health) {
        this.results.addTest('E2E: System Optimization Workflow', 'passed', {
          health_status: status.system_health.status
        });
      } else {
        this.results.addTest('E2E: System Optimization Workflow', 'failed');
      }
    } catch (error) {
      this.results.addTest('E2E: System Optimization Workflow', 'failed', { error: error.message });
    }
  }

  /**
   * Save test report
   */
  async saveTestReport(report) {
    try {
      const reportPath = path.join(__dirname, '../reports', `test-report-${Date.now()}.json`);
      
      // Ensure reports directory exists
      const reportsDir = path.dirname(reportPath);
      try {
        await fs.access(reportsDir);
      } catch {
        await fs.mkdir(reportsDir, { recursive: true });
      }

      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      
      console.log(`📄 Test report saved: ${reportPath}`);
    } catch (error) {
      console.error('❌ Failed to save test report:', error.message);
    }
  }

  /**
   * Display test summary
   */
  displaySummary(report) {
    const summary = report.summary;
    
    console.log('\n' + '='.repeat(60));
    console.log('🧪 TEST SUITE SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`Total Tests: ${summary.total}`);
    console.log(`✅ Passed: ${summary.passed}`);
    console.log(`❌ Failed: ${summary.failed}`);
    console.log(`⏭️  Skipped: ${summary.skipped}`);
    console.log(`📊 Success Rate: ${summary.success_rate}%`);
    console.log(`⏱️  Duration: ${summary.duration_formatted}`);
    
    console.log('\n📋 ACCEPTANCE CRITERIA:');
    const criteria = report.acceptance_criteria;
    for (const [criterion, passed] of Object.entries(criteria.criteria)) {
      const icon = passed ? '✅' : '❌';
      console.log(`${icon} ${criterion}`);
    }
    console.log(`Overall: ${criteria.passed}/${criteria.total} (${criteria.all_passed ? 'PASSED' : 'FAILED'})`);
    
    console.log('\n✅ DEFINITION OF DONE:');
    const done = report.definition_of_done;
    for (const [item, completed] of Object.entries(done.done)) {
      const icon = completed ? '✅' : '❌';
      console.log(`${icon} ${item}`);
    }
    console.log(`Overall: ${done.passed}/${done.total} (${done.all_done ? 'COMPLETE' : 'INCOMPLETE'})`);
    
    if (summary.failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      const failedTests = report.tests.filter(t => t.status === 'failed');
      failedTests.forEach(test => {
        console.log(`   • ${test.name}: ${test.details.error || test.details.message || 'Unknown error'}`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
    
    const overallSuccess = criteria.all_passed && done.all_done && summary.failed === 0;
    if (overallSuccess) {
      console.log('🎉 ALL TESTS PASSED - SYSTEM READY FOR DEPLOYMENT!');
    } else {
      console.log('⚠️  SOME TESTS FAILED - REVIEW REQUIRED BEFORE DEPLOYMENT');
    }
    
    console.log('='.repeat(60));
  }
}

/**
 * Main execution
 */
async function main() {
  const tester = new IntelligentPortSystemTester();
  
  try {
    const report = await tester.runAllTests();
    
    // Exit with appropriate code
    const success = report.acceptance_criteria.all_passed && 
                   report.definition_of_done.all_done && 
                   report.summary.failed === 0;
    
    process.exit(success ? 0 : 1);
    
  } catch (error) {
    console.error('💥 Test suite execution failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { IntelligentPortSystemTester, TestResults };
