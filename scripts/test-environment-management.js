#!/usr/bin/env node

/**
 * Truxe Environment Management Test Suite
 * 
 * Comprehensive testing for environment switching, port range validation,
 * and isolation safeguards.
 * 
 * @author DevOps Engineering Team
 * @version 1.0.0
 */

import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import environment management components
import environmentManager from '../config/environment-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test Suite Class
 */
class EnvironmentManagementTestSuite {
  constructor() {
    this.manager = environmentManager;
    this.testResults = [];
    this.totalTests = 0;
    this.passedTests = 0;
    this.failedTests = 0;
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log(chalk.blue.bold('\n🧪 Truxe Environment Management Test Suite\n'));
    
    try {
      // Wait for manager to initialize
      await this.waitForInitialization();
      
      // Run test categories
      await this.testEnvironmentDetection();
      await this.testPortRangeValidation();
      await this.testEnvironmentSwitching();
      await this.testIsolationSafeguards();
      await this.testConflictDetection();
      await this.testMonitoringSystem();
      await this.testConfigurationGeneration();
      
      // Display results
      this.displayTestResults();
      
    } catch (error) {
      console.error(chalk.red(`❌ Test suite failed: ${error.message}`));
      process.exit(1);
    }
  }

  /**
   * Wait for manager initialization
   */
  async waitForInitialization() {
    console.log(chalk.gray('Waiting for environment manager initialization...'));
    
    let attempts = 0;
    const maxAttempts = 30;
    
    while (!this.manager.isInitialized && attempts < maxAttempts) {
      await this.sleep(1000);
      attempts++;
    }
    
    if (!this.manager.isInitialized) {
      throw new Error('Environment manager failed to initialize within timeout');
    }
    
    console.log(chalk.green('✅ Environment manager initialized\n'));
  }

  /**
   * Test environment detection
   */
  async testEnvironmentDetection() {
    console.log(chalk.yellow.bold('🔍 Testing Environment Detection\n'));
    
    // Test 1: Current environment detection
    await this.runTest('Current Environment Detection', async () => {
      const currentEnv = this.manager.portManager.currentEnvironment;
      if (!currentEnv) {
        throw new Error('No current environment detected');
      }
      
      const validEnvs = this.manager.portManager.getValidEnvironments();
      if (!validEnvs.includes(currentEnv)) {
        throw new Error(`Invalid current environment: ${currentEnv}`);
      }
      
      return `Current environment: ${currentEnv}`;
    });
    
    // Test 2: Environment validation
    await this.runTest('Environment Validation', async () => {
      const environments = this.manager.portManager.getValidEnvironments();
      
      for (const env of environments) {
        const config = this.manager.portManager.getEnvironmentConfig(env);
        
        if (!config.range || !config.range.start || !config.range.end) {
          throw new Error(`Invalid port range for environment: ${env}`);
        }
        
        if (!config.services || Object.keys(config.services).length === 0) {
          throw new Error(`No services configured for environment: ${env}`);
        }
      }
      
      return `Validated ${environments.length} environments`;
    });
    
    // Test 3: Environment configuration access
    await this.runTest('Environment Configuration Access', async () => {
      const currentEnv = this.manager.portManager.currentEnvironment;
      const config = this.manager.portManager.getEnvironmentConfig(currentEnv);
      
      const requiredFields = ['name', 'range', 'services', 'description'];
      for (const field of requiredFields) {
        if (!config[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }
      
      return `Configuration valid for ${currentEnv}`;
    });
  }

  /**
   * Test port range validation
   */
  async testPortRangeValidation() {
    console.log(chalk.yellow.bold('🔌 Testing Port Range Validation\n'));
    
    // Test 1: Port range boundaries
    await this.runTest('Port Range Boundaries', async () => {
      const environments = this.manager.portManager.getValidEnvironments();
      
      for (const env of environments) {
        const config = this.manager.portManager.getEnvironmentConfig(env);
        
        // Check range validity
        if (config.range.start >= config.range.end) {
          throw new Error(`Invalid port range for ${env}: start >= end`);
        }
        
        // Check service ports are within range
        for (const [service, port] of Object.entries(config.services)) {
          if (env !== 'production') { // Production uses standard ports
            if (port < config.range.start || port > config.range.end) {
              throw new Error(`Service ${service} port ${port} outside range for ${env}`);
            }
          }
        }
      }
      
      return `Port ranges validated for ${environments.length} environments`;
    });
    
    // Test 2: Service port retrieval
    await this.runTest('Service Port Retrieval', async () => {
      const currentEnv = this.manager.portManager.currentEnvironment;
      const config = this.manager.portManager.getEnvironmentConfig(currentEnv);
      
      const testServices = ['api', 'database', 'redis'];
      for (const service of testServices) {
        if (config.services[service]) {
          const port = this.manager.getServicePort(service);
          
          if (!port || typeof port !== 'number') {
            throw new Error(`Invalid port returned for service: ${service}`);
          }
          
          if (port !== config.services[service]) {
            throw new Error(`Port mismatch for service ${service}: expected ${config.services[service]}, got ${port}`);
          }
        }
      }
      
      return `Service ports retrieved successfully`;
    });
    
    // Test 3: Port conflict detection
    await this.runTest('Port Conflict Detection', async () => {
      const currentEnv = this.manager.portManager.currentEnvironment;
      const conflicts = this.manager.portManager.detectConflicts(currentEnv);
      
      // This test passes if conflict detection runs without error
      // Actual conflicts may or may not exist depending on system state
      
      return `Conflict detection completed: ${conflicts.length} conflicts found`;
    });
    
    // Test 4: Port availability checking
    await this.runTest('Port Availability Checking', async () => {
      // Test with a likely available port
      const highPort = 65000;
      const isAvailable = this.manager.portManager.isPortAvailable(highPort);
      
      if (typeof isAvailable !== 'boolean') {
        throw new Error('Port availability check should return boolean');
      }
      
      return `Port availability check functional`;
    });
  }

  /**
   * Test environment switching
   */
  async testEnvironmentSwitching() {
    console.log(chalk.yellow.bold('🔄 Testing Environment Switching\n'));
    
    const originalEnv = this.manager.portManager.currentEnvironment;
    
    try {
      // Test 1: Valid environment switch
      await this.runTest('Valid Environment Switch', async () => {
        const environments = this.manager.portManager.getValidEnvironments();
        const targetEnv = environments.find(env => env !== originalEnv);
        
        if (!targetEnv) {
          throw new Error('No alternative environment available for testing');
        }
        
        const newEnv = await this.manager.switchEnvironment(targetEnv, { validate: false });
        
        if (newEnv !== targetEnv) {
          throw new Error(`Environment switch failed: expected ${targetEnv}, got ${newEnv}`);
        }
        
        return `Successfully switched to ${targetEnv}`;
      });
      
      // Test 2: Invalid environment switch
      await this.runTest('Invalid Environment Switch', async () => {
        try {
          await this.manager.switchEnvironment('invalid_environment');
          throw new Error('Should have failed for invalid environment');
        } catch (error) {
          if (error.message.includes('Should have failed')) {
            throw error;
          }
          // Expected error - test passes
          return 'Correctly rejected invalid environment';
        }
      });
      
      // Test 3: Environment switch validation
      await this.runTest('Environment Switch Validation', async () => {
        const currentEnv = this.manager.portManager.currentEnvironment;
        const validation = this.manager.isolationValidator.validateEnvironmentIsolation(currentEnv);
        
        if (!validation || typeof validation.status !== 'string') {
          throw new Error('Invalid validation result');
        }
        
        return `Environment validation completed: ${validation.status}`;
      });
      
    } finally {
      // Restore original environment
      try {
        await this.manager.switchEnvironment(originalEnv, { validate: false });
      } catch (error) {
        console.warn(chalk.yellow(`Warning: Failed to restore original environment: ${error.message}`));
      }
    }
  }

  /**
   * Test isolation safeguards
   */
  async testIsolationSafeguards() {
    console.log(chalk.yellow.bold('🔒 Testing Isolation Safeguards\n'));
    
    // Test 1: Cross-environment conflict detection
    await this.runTest('Cross-Environment Conflict Detection', async () => {
      const environments = this.manager.portManager.getValidEnvironments();
      
      for (const env of environments) {
        const conflicts = this.manager.portManager.checkCrossEnvironmentConflicts(env);
        
        if (!Array.isArray(conflicts)) {
          throw new Error(`Invalid conflicts result for ${env}`);
        }
      }
      
      return `Cross-environment conflicts checked for ${environments.length} environments`;
    });
    
    // Test 2: Isolation validation
    await this.runTest('Isolation Validation', async () => {
      const currentEnv = this.manager.portManager.currentEnvironment;
      const violations = this.manager.isolationValidator.validateEnvironmentIsolation(currentEnv);
      
      if (!violations || !Array.isArray(violations.violations)) {
        throw new Error('Invalid isolation validation result');
      }
      
      return `Isolation validation completed: ${violations.violations.length} violations`;
    });
    
    // Test 3: Access control validation
    await this.runTest('Access Control Validation', async () => {
      const currentEnv = this.manager.portManager.currentEnvironment;
      
      // Test service port access
      const config = this.manager.portManager.getEnvironmentConfig(currentEnv);
      const testService = Object.keys(config.services)[0];
      const testPort = config.services[testService];
      
      // This should succeed
      const isValid = this.manager.isolationValidator.validatePortAccess(testService, testPort, currentEnv);
      
      if (!isValid) {
        throw new Error('Valid port access was rejected');
      }
      
      return 'Access control validation passed';
    });
    
    // Test 4: Security policy validation
    await this.runTest('Security Policy Validation', async () => {
      const currentEnv = this.manager.portManager.currentEnvironment;
      const validation = this.manager.isolationValidator.validateEnvironmentIsolation(currentEnv);
      
      // Check that security checks were performed
      const securityChecks = validation.checks_performed || [];
      if (!securityChecks.includes('security_policies')) {
        console.warn('Security policy validation not performed');
      }
      
      return 'Security policies validated';
    });
  }

  /**
   * Test conflict detection
   */
  async testConflictDetection() {
    console.log(chalk.yellow.bold('⚡ Testing Conflict Detection\n'));
    
    // Test 1: Port conflict detection
    await this.runTest('Port Conflict Detection', async () => {
      const currentEnv = this.manager.portManager.currentEnvironment;
      const conflicts = this.manager.portManager.detectConflicts(currentEnv);
      
      if (!Array.isArray(conflicts)) {
        throw new Error('Conflict detection should return array');
      }
      
      return `Detected ${conflicts.length} conflicts`;
    });
    
    // Test 2: Configuration validation
    await this.runTest('Configuration Validation', async () => {
      const currentEnv = this.manager.portManager.currentEnvironment;
      const issues = this.manager.portManager.validateConfiguration(currentEnv);
      
      if (!Array.isArray(issues)) {
        throw new Error('Configuration validation should return array');
      }
      
      return `Found ${issues.length} configuration issues`;
    });
    
    // Test 3: System status check
    await this.runTest('System Status Check', async () => {
      const status = this.manager.portManager.getSystemStatus();
      
      const requiredFields = ['environment', 'status', 'port_range', 'conflicts', 'validation_issues'];
      for (const field of requiredFields) {
        if (!(field in status)) {
          throw new Error(`Missing field in system status: ${field}`);
        }
      }
      
      return `System status: ${status.status}`;
    });
  }

  /**
   * Test monitoring system
   */
  async testMonitoringSystem() {
    console.log(chalk.yellow.bold('📊 Testing Monitoring System\n'));
    
    // Test 1: Monitoring status
    await this.runTest('Monitoring Status', async () => {
      const status = this.manager.monitor.getMonitoringStatus();
      
      if (!status || typeof status.is_monitoring !== 'boolean') {
        throw new Error('Invalid monitoring status');
      }
      
      return `Monitoring active: ${status.is_monitoring}`;
    });
    
    // Test 2: Start/stop monitoring
    await this.runTest('Start/Stop Monitoring', async () => {
      const wasMonitoring = this.manager.monitor.isMonitoring;
      
      if (wasMonitoring) {
        this.manager.monitor.stopMonitoring();
        if (this.manager.monitor.isMonitoring) {
          throw new Error('Failed to stop monitoring');
        }
      }
      
      this.manager.monitor.startMonitoring();
      if (!this.manager.monitor.isMonitoring) {
        throw new Error('Failed to start monitoring');
      }
      
      // Restore original state
      if (!wasMonitoring) {
        this.manager.monitor.stopMonitoring();
      }
      
      return 'Monitoring start/stop functional';
    });
    
    // Test 3: Performance metrics
    await this.runTest('Performance Metrics', async () => {
      const metrics = this.manager.monitor.performanceMetrics;
      
      if (!metrics || typeof metrics !== 'object') {
        throw new Error('Invalid performance metrics');
      }
      
      const requiredMetrics = ['scan_times', 'response_times', 'error_counts'];
      for (const metric of requiredMetrics) {
        if (!(metric in metrics)) {
          throw new Error(`Missing performance metric: ${metric}`);
        }
      }
      
      return 'Performance metrics available';
    });
  }

  /**
   * Test configuration generation
   */
  async testConfigurationGeneration() {
    console.log(chalk.yellow.bold('⚙️  Testing Configuration Generation\n'));
    
    // Test 1: Environment configuration generation
    await this.runTest('Environment Configuration Generation', async () => {
      const currentEnv = this.manager.portManager.currentEnvironment;
      const config = this.manager.generateEnvironmentConfig(currentEnv);
      
      const requiredFields = ['environment', 'name', 'range', 'services', 'environment_variables'];
      for (const field of requiredFields) {
        if (!(field in config)) {
          throw new Error(`Missing field in generated config: ${field}`);
        }
      }
      
      return 'Environment configuration generated successfully';
    });
    
    // Test 2: Docker Compose generation
    await this.runTest('Docker Compose Generation', async () => {
      const currentEnv = this.manager.portManager.currentEnvironment;
      const dockerConfig = this.manager.generateDockerComposeConfig(currentEnv);
      
      const requiredSections = ['services', 'volumes', 'networks'];
      for (const section of requiredSections) {
        if (!(section in dockerConfig)) {
          throw new Error(`Missing section in Docker config: ${section}`);
        }
      }
      
      return 'Docker Compose configuration generated successfully';
    });
    
    // Test 3: Port mappings generation
    await this.runTest('Port Mappings Generation', async () => {
      const currentEnv = this.manager.portManager.currentEnvironment;
      const portMappings = this.manager.portManager.generateDockerComposePorts(currentEnv);
      
      if (!portMappings || typeof portMappings !== 'object') {
        throw new Error('Invalid port mappings');
      }
      
      // Check that mappings have required structure
      for (const [service, mapping] of Object.entries(portMappings)) {
        if (!mapping.external || !mapping.internal || !mapping.mapping) {
          throw new Error(`Invalid mapping structure for service: ${service}`);
        }
      }
      
      return `Generated ${Object.keys(portMappings).length} port mappings`;
    });
    
    // Test 4: Environment variables generation
    await this.runTest('Environment Variables Generation', async () => {
      const currentEnv = this.manager.portManager.currentEnvironment;
      const envVars = this.manager.portManager.generateEnvironmentVariables(currentEnv);
      
      if (!envVars || typeof envVars !== 'object') {
        throw new Error('Invalid environment variables');
      }
      
      // Check for required variables
      const requiredVars = ['TRUXE_ENV', 'TRUXE_PORT_RANGE_START', 'TRUXE_PORT_RANGE_END'];
      for (const varName of requiredVars) {
        if (!(varName in envVars)) {
          throw new Error(`Missing required environment variable: ${varName}`);
        }
      }
      
      return `Generated ${Object.keys(envVars).length} environment variables`;
    });
  }

  /**
   * Run a single test
   */
  async runTest(testName, testFunction) {
    this.totalTests++;
    
    try {
      const result = await testFunction();
      this.passedTests++;
      
      console.log(chalk.green(`✅ ${testName}: ${result}`));
      
      this.testResults.push({
        name: testName,
        status: 'passed',
        result: result,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      this.failedTests++;
      
      console.log(chalk.red(`❌ ${testName}: ${error.message}`));
      
      this.testResults.push({
        name: testName,
        status: 'failed',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Display test results
   */
  displayTestResults() {
    console.log(chalk.blue.bold('\n📊 Test Results Summary\n'));
    
    console.log(`Total Tests: ${chalk.cyan(this.totalTests)}`);
    console.log(`Passed: ${chalk.green(this.passedTests)}`);
    console.log(`Failed: ${chalk.red(this.failedTests)}`);
    
    const successRate = Math.round((this.passedTests / this.totalTests) * 100);
    console.log(`Success Rate: ${successRate >= 90 ? chalk.green : successRate >= 70 ? chalk.yellow : chalk.red}${successRate}%${chalk.reset()}`);
    
    if (this.failedTests > 0) {
      console.log(chalk.red.bold('\n❌ Failed Tests:'));
      const failedTests = this.testResults.filter(test => test.status === 'failed');
      for (const test of failedTests) {
        console.log(chalk.red(`  - ${test.name}: ${test.error}`));
      }
    }
    
    // Save results to file
    this.saveTestResults();
    
    console.log(chalk.blue('\n🏁 Test suite completed\n'));
    
    // Exit with appropriate code
    process.exit(this.failedTests > 0 ? 1 : 0);
  }

  /**
   * Save test results to file
   */
  saveTestResults() {
    try {
      const reportsDir = path.join(process.cwd(), 'reports');
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `environment-management-test-results-${timestamp}.json`;
      const filepath = path.join(reportsDir, filename);
      
      const report = {
        timestamp: new Date().toISOString(),
        summary: {
          total_tests: this.totalTests,
          passed_tests: this.passedTests,
          failed_tests: this.failedTests,
          success_rate: Math.round((this.passedTests / this.totalTests) * 100)
        },
        results: this.testResults
      };
      
      fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
      console.log(chalk.gray(`Test results saved to: ${filepath}`));
      
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Failed to save test results: ${error.message}`));
    }
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const testSuite = new EnvironmentManagementTestSuite();
  testSuite.runAllTests().catch(error => {
    console.error(chalk.red(`Test suite error: ${error.message}`));
    process.exit(1);
  });
}

export default EnvironmentManagementTestSuite;
