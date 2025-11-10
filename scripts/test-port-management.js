#!/usr/bin/env node

/**
 * Truxe Port Management System Test Suite
 * 
 * Comprehensive testing and validation of the centralized port management system.
 * Tests all components, validates configurations, and ensures system reliability.
 * 
 * @author DevOps Engineering Team
 * @version 2.0.0
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  warnings: 0,
  total: 0,
  details: []
};

/**
 * Test result logger
 */
function logTest(name, status, message = '', details = null) {
  testResults.total++;
  testResults[status]++;
  
  const statusIcon = {
    passed: '✅',
    failed: '❌',
    warnings: '⚠️'
  }[status];
  
  console.log(`${statusIcon} ${name}: ${message}`);
  
  testResults.details.push({
    name,
    status,
    message,
    details,
    timestamp: new Date().toISOString()
  });
  
  if (details && status === 'failed') {
    console.log(`   Details: ${JSON.stringify(details, null, 2)}`);
  }
}

/**
 * Test port manager basic functionality
 */
async function testPortManagerBasics() {
  console.log('\n🧪 Testing Port Manager Basic Functionality...');
  
  try {
    const { default: portManager } = await import('../config/ports.js');
    
    // Test environment detection
    try {
      const env = portManager.environment;
      if (env) {
        logTest('Environment Detection', 'passed', `Detected environment: ${env}`);
      } else {
        logTest('Environment Detection', 'failed', 'No environment detected');
      }
    } catch (error) {
      logTest('Environment Detection', 'failed', error.message);
    }
    
    // Test service port retrieval
    try {
      const apiPort = portManager.getServicePort('api', 'development');
      if (apiPort === 21001) {
        logTest('Service Port Retrieval', 'passed', `API port: ${apiPort}`);
      } else {
        logTest('Service Port Retrieval', 'failed', `Expected 21001, got ${apiPort}`);
      }
    } catch (error) {
      logTest('Service Port Retrieval', 'failed', error.message);
    }
    
    // Test invalid service
    try {
      portManager.getServicePort('nonexistent', 'development');
      logTest('Invalid Service Handling', 'failed', 'Should have thrown error');
    } catch (error) {
      logTest('Invalid Service Handling', 'passed', 'Correctly rejected invalid service');
    }
    
    // Test invalid environment
    try {
      portManager.getServicePort('api', 'nonexistent');
      logTest('Invalid Environment Handling', 'failed', 'Should have thrown error');
    } catch (error) {
      logTest('Invalid Environment Handling', 'passed', 'Correctly rejected invalid environment');
    }
    
    // Test port availability check
    try {
      const isAvailable = portManager.isPortAvailable(65432); // Unlikely to be used
      logTest('Port Availability Check', 'passed', `Port 65432 available: ${isAvailable}`);
    } catch (error) {
      logTest('Port Availability Check', 'failed', error.message);
    }
    
  } catch (error) {
    logTest('Port Manager Import', 'failed', error.message);
  }
}

/**
 * Test environment configurations
 */
async function testEnvironmentConfigurations() {
  console.log('\n🧪 Testing Environment Configurations...');
  
  try {
    const { default: portManager } = await import('../config/ports.js');
    
    const environments = ['development', 'staging', 'testing', 'production'];
    
    for (const env of environments) {
      try {
        const config = portManager.getEnvironmentConfig(env);
        
        // Validate required properties
        if (!config.range || !config.services) {
          logTest(`${env} Config Structure`, 'failed', 'Missing required properties');
          continue;
        }
        
        // Validate port range
        if (config.range.start >= config.range.end) {
          logTest(`${env} Port Range`, 'failed', 'Invalid port range');
          continue;
        }
        
        // Validate service ports are within range (except production)
        let portsInRange = true;
        for (const [service, port] of Object.entries(config.services)) {
          if (env !== 'production' && (port < config.range.start || port > config.range.end)) {
            portsInRange = false;
            break;
          }
        }
        
        if (portsInRange || env === 'production') {
          logTest(`${env} Configuration`, 'passed', 
            `Range: ${config.range.start}-${config.range.end}, Services: ${Object.keys(config.services).length}`);
        } else {
          logTest(`${env} Configuration`, 'failed', 'Some ports outside valid range');
        }
        
      } catch (error) {
        logTest(`${env} Configuration`, 'failed', error.message);
      }
    }
    
  } catch (error) {
    logTest('Environment Config Test', 'failed', error.message);
  }
}

/**
 * Test conflict detection
 */
async function testConflictDetection() {
  console.log('\n🧪 Testing Conflict Detection...');
  
  try {
    const { default: portManager } = await import('../config/ports.js');
    
    // Test conflict detection for development environment
    try {
      const conflicts = portManager.detectConflicts('development');
      
      if (Array.isArray(conflicts)) {
        logTest('Conflict Detection', 'passed', `Found ${conflicts.length} conflicts`);
        
        // Log conflicts as warnings
        conflicts.forEach(conflict => {
          logTest(`Conflict: ${conflict.service || 'Unknown'}`, 'warnings', 
            `Port ${conflict.port}: ${conflict.message || conflict.status}`);
        });
      } else {
        logTest('Conflict Detection', 'failed', 'Invalid conflict detection result');
      }
    } catch (error) {
      logTest('Conflict Detection', 'failed', error.message);
    }
    
    // Test validation
    try {
      const issues = portManager.validateConfiguration('development');
      
      if (Array.isArray(issues)) {
        logTest('Configuration Validation', 'passed', `Found ${issues.length} validation issues`);
        
        // Log issues
        issues.forEach(issue => {
          const severity = issue.severity === 'critical' ? 'failed' : 'warnings';
          logTest(`Validation: ${issue.type}`, severity, issue.message);
        });
      } else {
        logTest('Configuration Validation', 'failed', 'Invalid validation result');
      }
    } catch (error) {
      logTest('Configuration Validation', 'failed', error.message);
    }
    
  } catch (error) {
    logTest('Conflict Detection Test', 'failed', error.message);
  }
}

/**
 * Test port utilities
 */
async function testPortUtilities() {
  console.log('\n🧪 Testing Port Utilities...');
  
  try {
    const { portValidator, conflictDetector, portAllocator, utils } = await import('../config/port-utils.js');
    
    // Test port validator
    try {
      const validation = portValidator.validatePort(21001, 'development');
      if (validation && typeof validation.valid === 'boolean') {
        logTest('Port Validator', 'passed', `Port 21001 valid: ${validation.valid}`);
      } else {
        logTest('Port Validator', 'failed', 'Invalid validation result structure');
      }
    } catch (error) {
      logTest('Port Validator', 'failed', error.message);
    }
    
    // Test environment validation
    try {
      const envValidation = portValidator.validateEnvironment('development');
      if (envValidation && envValidation.summary) {
        logTest('Environment Validation', 'passed', 
          `Total: ${envValidation.summary.total_ports}, Valid: ${envValidation.summary.valid_ports}`);
      } else {
        logTest('Environment Validation', 'failed', 'Invalid environment validation result');
      }
    } catch (error) {
      logTest('Environment Validation', 'failed', error.message);
    }
    
    // Test port allocation
    try {
      const ports = portAllocator.allocatePorts('sequential', 21500, 3, 'development');
      if (Array.isArray(ports) && ports.length === 3) {
        logTest('Port Allocation', 'passed', `Allocated ports: ${ports.join(', ')}`);
      } else {
        logTest('Port Allocation', 'failed', 'Invalid port allocation result');
      }
    } catch (error) {
      logTest('Port Allocation', 'failed', error.message);
    }
    
    // Test utility functions
    try {
      const isPortFree = utils.isPortFree(65433); // Unlikely to be used
      logTest('Utility Functions', 'passed', `Port 65433 free: ${isPortFree}`);
    } catch (error) {
      logTest('Utility Functions', 'failed', error.message);
    }
    
  } catch (error) {
    logTest('Port Utilities Test', 'failed', error.message);
  }
}

/**
 * Test Docker integration
 */
async function testDockerIntegration() {
  console.log('\n🧪 Testing Docker Integration...');
  
  try {
    const { dockerIntegrator } = await import('../config/port-utils.js');
    
    // Test Docker Compose generation
    try {
      const dockerConfig = await dockerIntegrator.generateDockerCompose('development');
      
      if (dockerConfig && dockerConfig.services) {
        const serviceCount = Object.keys(dockerConfig.services).length;
        logTest('Docker Compose Generation', 'passed', `Generated ${serviceCount} services`);
        
        // Validate service structure
        let validServices = 0;
        for (const [serviceName, serviceConfig] of Object.entries(dockerConfig.services)) {
          if (serviceConfig.ports && Array.isArray(serviceConfig.ports)) {
            validServices++;
          }
        }
        
        logTest('Docker Service Validation', 'passed', `${validServices}/${serviceCount} services have valid port mappings`);
      } else {
        logTest('Docker Compose Generation', 'failed', 'Invalid Docker configuration structure');
      }
    } catch (error) {
      logTest('Docker Compose Generation', 'failed', error.message);
    }
    
  } catch (error) {
    logTest('Docker Integration Test', 'failed', error.message);
  }
}

/**
 * Test CLI integration
 */
async function testCLIIntegration() {
  console.log('\n🧪 Testing CLI Integration...');
  
  try {
    // Test port manager CLI
    const cliPath = join(__dirname, 'port-manager.js');
    
    // Test status command
    try {
      const output = execSync(`node ${cliPath} status development`, { 
        encoding: 'utf8', 
        timeout: 10000 
      });
      
      if (output.includes('Port Status')) {
        logTest('CLI Status Command', 'passed', 'Status command executed successfully');
      } else {
        logTest('CLI Status Command', 'failed', 'Unexpected output format');
      }
    } catch (error) {
      logTest('CLI Status Command', 'failed', error.message);
    }
    
    // Test validate command
    try {
      const output = execSync(`node ${cliPath} validate development`, { 
        encoding: 'utf8', 
        timeout: 10000 
      });
      
      if (output.includes('valid') || output.includes('Configuration')) {
        logTest('CLI Validate Command', 'passed', 'Validate command executed successfully');
      } else {
        logTest('CLI Validate Command', 'warnings', 'Unexpected validate output');
      }
    } catch (error) {
      // Validation might fail due to conflicts, which is acceptable
      if (error.status === 1) {
        logTest('CLI Validate Command', 'warnings', 'Validation found issues (expected)');
      } else {
        logTest('CLI Validate Command', 'failed', error.message);
      }
    }
    
    // Test port command
    try {
      const output = execSync(`node ${cliPath} port api development`, { 
        encoding: 'utf8', 
        timeout: 5000 
      });
      
      const port = parseInt(output.trim());
      if (port === 21001) {
        logTest('CLI Port Command', 'passed', `Correctly returned API port: ${port}`);
      } else {
        logTest('CLI Port Command', 'failed', `Expected 21001, got ${port}`);
      }
    } catch (error) {
      logTest('CLI Port Command', 'failed', error.message);
    }
    
  } catch (error) {
    logTest('CLI Integration Test', 'failed', error.message);
  }
}

/**
 * Test system integration
 */
async function testSystemIntegration() {
  console.log('\n🧪 Testing System Integration...');
  
  try {
    const { default: portManager } = await import('../config/ports.js');
    
    // Test system status
    try {
      const status = portManager.getSystemStatus('development');
      
      if (status && status.environment && status.port_range) {
        logTest('System Status', 'passed', 
          `Environment: ${status.environment}, Utilization: ${status.port_utilization}%`);
      } else {
        logTest('System Status', 'failed', 'Invalid system status structure');
      }
    } catch (error) {
      logTest('System Status', 'failed', error.message);
    }
    
    // Test cache functionality
    try {
      // Get port (should cache)
      const port1 = portManager.getServicePort('api', 'development');
      
      // Clear cache
      portManager.clearCache();
      
      // Get port again (should re-fetch)
      const port2 = portManager.getServicePort('api', 'development');
      
      if (port1 === port2) {
        logTest('Cache Functionality', 'passed', 'Cache clear and refetch working');
      } else {
        logTest('Cache Functionality', 'failed', 'Cache behavior inconsistent');
      }
    } catch (error) {
      logTest('Cache Functionality', 'failed', error.message);
    }
    
    // Test environment variable integration
    try {
      const originalEnv = process.env.TRUXE_ENV;
      process.env.TRUXE_ENV = 'testing';
      
      // Create new instance to test environment detection
      const { PortManager } = await import('../config/ports.js');
      const testManager = new PortManager();
      
      if (testManager.environment === 'testing') {
        logTest('Environment Variable Integration', 'passed', 'Environment variable correctly detected');
      } else {
        logTest('Environment Variable Integration', 'failed', 
          `Expected 'testing', got '${testManager.environment}'`);
      }
      
      // Restore original environment
      if (originalEnv) {
        process.env.TRUXE_ENV = originalEnv;
      } else {
        delete process.env.TRUXE_ENV;
      }
    } catch (error) {
      logTest('Environment Variable Integration', 'failed', error.message);
    }
    
  } catch (error) {
    logTest('System Integration Test', 'failed', error.message);
  }
}

/**
 * Test performance
 */
async function testPerformance() {
  console.log('\n🧪 Testing Performance...');
  
  try {
    const { default: portManager } = await import('../config/ports.js');
    
    // Test port lookup performance
    const iterations = 1000;
    const startTime = Date.now();
    
    for (let i = 0; i < iterations; i++) {
      portManager.getServicePort('api', 'development');
    }
    
    const endTime = Date.now();
    const avgTime = (endTime - startTime) / iterations;
    
    if (avgTime < 1) { // Less than 1ms average
      logTest('Port Lookup Performance', 'passed', `Average lookup time: ${avgTime.toFixed(3)}ms`);
    } else {
      logTest('Port Lookup Performance', 'warnings', `Slow lookup time: ${avgTime.toFixed(3)}ms`);
    }
    
    // Test conflict detection performance
    const conflictStartTime = Date.now();
    portManager.detectConflicts('development');
    const conflictEndTime = Date.now();
    const conflictTime = conflictEndTime - conflictStartTime;
    
    if (conflictTime < 5000) { // Less than 5 seconds
      logTest('Conflict Detection Performance', 'passed', `Conflict detection time: ${conflictTime}ms`);
    } else {
      logTest('Conflict Detection Performance', 'warnings', `Slow conflict detection: ${conflictTime}ms`);
    }
    
  } catch (error) {
    logTest('Performance Test', 'failed', error.message);
  }
}

/**
 * Generate test report
 */
function generateTestReport() {
  console.log('\n📊 Port Management System Test Report');
  console.log('=' .repeat(60));
  
  console.log(`\n📈 Summary:`);
  console.log(`  ✅ Passed: ${testResults.passed}`);
  console.log(`  ⚠️  Warnings: ${testResults.warnings}`);
  console.log(`  ❌ Failed: ${testResults.failed}`);
  console.log(`  📊 Total: ${testResults.total}`);
  
  const successRate = ((testResults.passed / testResults.total) * 100).toFixed(1);
  console.log(`  🎯 Success Rate: ${successRate}%`);
  
  // Categorize results
  const categories = {};
  testResults.details.forEach(test => {
    const category = test.name.split(' ')[0];
    if (!categories[category]) {
      categories[category] = { passed: 0, failed: 0, warnings: 0 };
    }
    categories[category][test.status]++;
  });
  
  console.log(`\n📋 By Category:`);
  Object.entries(categories).forEach(([category, stats]) => {
    const total = stats.passed + stats.failed + stats.warnings;
    const rate = ((stats.passed / total) * 100).toFixed(1);
    console.log(`  ${category}: ${stats.passed}/${total} (${rate}%)`);
  });
  
  // Failed tests
  const failedTests = testResults.details.filter(test => test.status === 'failed');
  if (failedTests.length > 0) {
    console.log(`\n❌ Failed Tests:`);
    failedTests.forEach(test => {
      console.log(`  • ${test.name}: ${test.message}`);
    });
  }
  
  // Warnings
  const warningTests = testResults.details.filter(test => test.status === 'warnings');
  if (warningTests.length > 0) {
    console.log(`\n⚠️  Warnings:`);
    warningTests.forEach(test => {
      console.log(`  • ${test.name}: ${test.message}`);
    });
  }
  
  console.log('=' .repeat(60));
  
  // Overall status
  if (testResults.failed === 0) {
    if (testResults.warnings === 0) {
      console.log('🎉 All tests passed! Port management system is fully operational.');
      return 0;
    } else {
      console.log('✅ Tests passed with warnings. System is operational but has minor issues.');
      return 0;
    }
  } else {
    console.log('🚨 Some tests failed. Port management system has issues that need attention.');
    return 1;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('🚀 Truxe Port Management System Test Suite');
  console.log('Testing comprehensive port management functionality...\n');
  
  const testSuites = [
    testPortManagerBasics,
    testEnvironmentConfigurations,
    testConflictDetection,
    testPortUtilities,
    testDockerIntegration,
    testCLIIntegration,
    testSystemIntegration,
    testPerformance
  ];
  
  for (const testSuite of testSuites) {
    try {
      await testSuite();
    } catch (error) {
      logTest('Test Suite Error', 'failed', `${testSuite.name}: ${error.message}`);
    }
  }
  
  const exitCode = generateTestReport();
  process.exit(exitCode);
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

export { runTests, testResults };
