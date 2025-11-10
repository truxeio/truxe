#!/usr/bin/env node

/**
 * Truxe Production Validation Script
 * 
 * Comprehensive production readiness validation including health checks,
 * performance validation, security verification, and compliance checks.
 * 
 * @author Production Engineering Team
 * @version 1.0.0
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Production Validation Manager
 */
class ProductionValidationManager {
  constructor(options = {}) {
    this.options = {
      apiUrl: options.apiUrl || 'http://localhost:3001',
      timeout: options.timeout || 30000,
      enablePerformanceTests: options.enablePerformanceTests !== false,
      enableSecurityTests: options.enableSecurityTests !== false,
      enableLoadTests: options.enableLoadTests !== false,
      enableComplianceChecks: options.enableComplianceChecks !== false,
      ...options
    };

    this.validationResults = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'production',
      overallStatus: 'unknown',
      checks: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        warnings: 0
      },
      performance: {
        responseTime: null,
        throughput: null,
        errorRate: null,
        uptime: null
      },
      security: {
        headers: [],
        vulnerabilities: [],
        compliance: []
      }
    };
  }

  /**
   * Add validation result
   */
  addResult(category, name, status, message, details = {}) {
    const result = {
      category,
      name,
      status,
      message,
      details,
      timestamp: new Date().toISOString()
    };

    this.validationResults.checks.push(result);
    this.validationResults.summary.total++;

    switch (status) {
      case 'passed':
        this.validationResults.summary.passed++;
        console.log(`✅ ${category}: ${name} - ${message}`);
        break;
      case 'failed':
        this.validationResults.summary.failed++;
        console.error(`❌ ${category}: ${name} - ${message}`);
        if (details.error) {
          console.error(`   Error: ${details.error}`);
        }
        break;
      case 'warning':
        this.validationResults.summary.warnings++;
        console.warn(`⚠️  ${category}: ${name} - ${message}`);
        break;
      default:
        console.log(`ℹ️  ${category}: ${name} - ${message}`);
    }
  }

  /**
   * Make HTTP request with timeout
   */
  async makeRequest(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Check service health
   */
  async checkServiceHealth() {
    console.log('\n🔍 Checking Service Health...');

    const healthEndpoints = [
      { path: '/health', name: 'Basic Health' },
      { path: '/health/production', name: 'Production Health' },
      { path: '/health/comprehensive', name: 'Comprehensive Health' },
      { path: '/health/performance', name: 'Performance Health' },
      { path: '/health/error-handler', name: 'Error Handler Health' },
      { path: '/health/monitoring', name: 'Monitoring Health' },
      { path: '/health/disaster-recovery', name: 'Disaster Recovery Health' }
    ];

    for (const endpoint of healthEndpoints) {
      try {
        const response = await this.makeRequest(`${this.options.apiUrl}${endpoint.path}`);
        
        if (response.ok) {
          const data = await response.json();
          this.addResult('health', endpoint.name, 'passed', 'Service is healthy', { 
            statusCode: response.status,
            data: data 
          });
        } else {
          this.addResult('health', endpoint.name, 'failed', `Service returned ${response.status}`, {
            statusCode: response.status,
            statusText: response.statusText
          });
        }
      } catch (error) {
        this.addResult('health', endpoint.name, 'failed', 'Service is unreachable', {
          error: error.message
        });
      }
    }
  }

  /**
   * Validate security configuration
   */
  async validateSecurity() {
    console.log('\n🔒 Validating Security Configuration...');

    try {
      const response = await this.makeRequest(`${this.options.apiUrl}/health`);
      
      // Check security headers
      const requiredHeaders = [
        'strict-transport-security',
        'x-frame-options',
        'x-content-type-options',
        'x-xss-protection',
        'content-security-policy',
        'referrer-policy'
      ];

      const securityHeaders = [];
      const missingHeaders = [];

      for (const header of requiredHeaders) {
        const value = response.headers.get(header);
        if (value) {
          securityHeaders.push({ header, value });
        } else {
          missingHeaders.push(header);
        }
      }

      if (missingHeaders.length === 0) {
        this.addResult('security', 'Security Headers', 'passed', 'All required security headers present', {
          headers: securityHeaders
        });
      } else {
        this.addResult('security', 'Security Headers', 'failed', `Missing security headers: ${missingHeaders.join(', ')}`, {
          missing: missingHeaders,
          present: securityHeaders
        });
      }

      // Check CORS configuration
      const corsOrigin = response.headers.get('access-control-allow-origin');
      const corsCredentials = response.headers.get('access-control-allow-credentials');
      
      if (corsOrigin && corsCredentials) {
        this.addResult('security', 'CORS Configuration', 'passed', 'CORS properly configured', {
          origin: corsOrigin,
          credentials: corsCredentials
        });
      } else {
        this.addResult('security', 'CORS Configuration', 'warning', 'CORS configuration may need review', {
          origin: corsOrigin,
          credentials: corsCredentials
        });
      }

      this.validationResults.security.headers = securityHeaders;

    } catch (error) {
      this.addResult('security', 'Security Validation', 'failed', 'Failed to validate security configuration', {
        error: error.message
      });
    }
  }

  /**
   * Validate performance metrics
   */
  async validatePerformance() {
    console.log('\n⚡ Validating Performance Metrics...');

    try {
      const response = await this.makeRequest(`${this.options.apiUrl}/health/performance`);
      
      if (response.ok) {
        const data = await response.json();
        
        // Check response time targets
        const p95ResponseTime = data.summary?.responseTime?.p95 || 0;
        const p99ResponseTime = data.summary?.responseTime?.p99 || 0;
        const avgResponseTime = data.summary?.responseTime?.avg || 0;

        if (p95ResponseTime <= 200) {
          this.addResult('performance', 'Response Time P95', 'passed', `P95 response time: ${p95ResponseTime}ms (target: ≤200ms)`);
        } else {
          this.addResult('performance', 'Response Time P95', 'failed', `P95 response time: ${p95ResponseTime}ms (target: ≤200ms)`);
        }

        if (p99ResponseTime <= 500) {
          this.addResult('performance', 'Response Time P99', 'passed', `P99 response time: ${p99ResponseTime}ms (target: ≤500ms)`);
        } else {
          this.addResult('performance', 'Response Time P99', 'failed', `P99 response time: ${p99ResponseTime}ms (target: ≤500ms)`);
        }

        if (avgResponseTime <= 100) {
          this.addResult('performance', 'Response Time Average', 'passed', `Average response time: ${avgResponseTime}ms (target: ≤100ms)`);
        } else {
          this.addResult('performance', 'Response Time Average', 'warning', `Average response time: ${avgResponseTime}ms (target: ≤100ms)`);
        }

        // Check error rate
        const errorRate = data.summary?.errorRate || 0;
        if (errorRate <= 0.001) {
          this.addResult('performance', 'Error Rate', 'passed', `Error rate: ${(errorRate * 100).toFixed(3)}% (target: ≤0.1%)`);
        } else {
          this.addResult('performance', 'Error Rate', 'failed', `Error rate: ${(errorRate * 100).toFixed(3)}% (target: ≤0.1%)`);
        }

        // Check throughput
        const throughput = data.summary?.throughput || 0;
        if (throughput >= 167) {
          this.addResult('performance', 'Throughput', 'passed', `Throughput: ${throughput} req/s (target: ≥167 req/s)`);
        } else {
          this.addResult('performance', 'Throughput', 'failed', `Throughput: ${throughput} req/s (target: ≥167 req/s)`);
        }

        this.validationResults.performance = {
          responseTime: { p95: p95ResponseTime, p99: p99ResponseTime, avg: avgResponseTime },
          errorRate: errorRate,
          throughput: throughput,
          uptime: data.summary?.uptime || 0
        };

      } else {
        this.addResult('performance', 'Performance Metrics', 'failed', 'Failed to retrieve performance metrics', {
          statusCode: response.status
        });
      }

    } catch (error) {
      this.addResult('performance', 'Performance Validation', 'failed', 'Failed to validate performance metrics', {
        error: error.message
      });
    }
  }

  /**
   * Run load tests
   */
  async runLoadTests() {
    console.log('\n🚀 Running Load Tests...');

    try {
      // Run smoke test
      this.addResult('load-test', 'Smoke Test', 'info', 'Running smoke test...');
      
      execSync('npm run test:load:smoke', {
        cwd: path.join(__dirname, '../api'),
        stdio: 'inherit',
        timeout: 120000
      });

      this.addResult('load-test', 'Smoke Test', 'passed', 'Smoke test completed successfully');

      // Run normal load test
      this.addResult('load-test', 'Load Test', 'info', 'Running normal load test...');
      
      execSync('npm run test:load:normal', {
        cwd: path.join(__dirname, '../api'),
        stdio: 'inherit',
        timeout: 300000
      });

      this.addResult('load-test', 'Load Test', 'passed', 'Normal load test completed successfully');

    } catch (error) {
      this.addResult('load-test', 'Load Tests', 'failed', 'Load tests failed', {
        error: error.message
      });
    }
  }

  /**
   * Validate environment configuration
   */
  async validateEnvironment() {
    console.log('\n🌍 Validating Environment Configuration...');

    // Check required environment variables
    const requiredEnvVars = [
      'NODE_ENV',
      'DATABASE_URL',
      'REDIS_URL',
      'JWT_PRIVATE_KEY_FILE',
      'JWT_PUBLIC_KEY_FILE'
    ];

    const missingVars = [];
    const presentVars = [];

    for (const varName of requiredEnvVars) {
      if (process.env[varName]) {
        presentVars.push(varName);
      } else {
        missingVars.push(varName);
      }
    }

    if (missingVars.length === 0) {
      this.addResult('environment', 'Required Environment Variables', 'passed', 'All required environment variables present', {
        variables: presentVars
      });
    } else {
      this.addResult('environment', 'Required Environment Variables', 'failed', `Missing environment variables: ${missingVars.join(', ')}`, {
        missing: missingVars,
        present: presentVars
      });
    }

    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    if (majorVersion >= 20) {
      this.addResult('environment', 'Node.js Version', 'passed', `Node.js version ${nodeVersion} is supported`);
    } else {
      this.addResult('environment', 'Node.js Version', 'failed', `Node.js version ${nodeVersion} is not supported (required: >=20.0.0)`);
    }

    // Check if running in production mode
    if (process.env.NODE_ENV === 'production') {
      this.addResult('environment', 'Production Mode', 'passed', 'Running in production mode');
    } else {
      this.addResult('environment', 'Production Mode', 'warning', `Not running in production mode (NODE_ENV=${process.env.NODE_ENV})`);
    }
  }

  /**
   * Validate database connectivity
   */
  async validateDatabase() {
    console.log('\n🗄️  Validating Database Connectivity...');

    try {
      const response = await this.makeRequest(`${this.options.apiUrl}/health`);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.database && data.database.status === 'healthy') {
          this.addResult('database', 'Database Connectivity', 'passed', 'Database is healthy and accessible', {
            status: data.database.status,
            details: data.database
          });
        } else {
          this.addResult('database', 'Database Connectivity', 'failed', 'Database is not healthy', {
            status: data.database?.status || 'unknown',
            details: data.database
          });
        }
      } else {
        this.addResult('database', 'Database Connectivity', 'failed', 'Failed to check database status', {
          statusCode: response.status
        });
      }

    } catch (error) {
      this.addResult('database', 'Database Connectivity', 'failed', 'Database connectivity check failed', {
        error: error.message
      });
    }
  }

  /**
   * Validate Redis connectivity
   */
  async validateRedis() {
    console.log('\n🔴 Validating Redis Connectivity...');

    try {
      const response = await this.makeRequest(`${this.options.apiUrl}/health`);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.redis && data.redis.status === 'healthy') {
          this.addResult('redis', 'Redis Connectivity', 'passed', 'Redis is healthy and accessible', {
            status: data.redis.status,
            details: data.redis
          });
        } else {
          this.addResult('redis', 'Redis Connectivity', 'failed', 'Redis is not healthy', {
            status: data.redis?.status || 'unknown',
            details: data.redis
          });
        }
      } else {
        this.addResult('redis', 'Redis Connectivity', 'failed', 'Failed to check Redis status', {
          statusCode: response.status
        });
      }

    } catch (error) {
      this.addResult('redis', 'Redis Connectivity', 'failed', 'Redis connectivity check failed', {
        error: error.message
      });
    }
  }

  /**
   * Validate monitoring and observability
   */
  async validateMonitoring() {
    console.log('\n📊 Validating Monitoring & Observability...');

    try {
      // Check monitoring service health
      const response = await this.makeRequest(`${this.options.apiUrl}/health/monitoring`);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.status === 'healthy') {
          this.addResult('monitoring', 'Monitoring Service', 'passed', 'Monitoring service is healthy', {
            status: data.status,
            details: data
          });
        } else {
          this.addResult('monitoring', 'Monitoring Service', 'failed', 'Monitoring service is not healthy', {
            status: data.status,
            details: data
          });
        }
      } else {
        this.addResult('monitoring', 'Monitoring Service', 'failed', 'Failed to check monitoring service status', {
          statusCode: response.status
        });
      }

      // Check Prometheus metrics endpoint
      try {
        const metricsResponse = await this.makeRequest(`${this.options.apiUrl}/metrics`);
        if (metricsResponse.ok) {
          this.addResult('monitoring', 'Prometheus Metrics', 'passed', 'Prometheus metrics endpoint is accessible');
        } else {
          this.addResult('monitoring', 'Prometheus Metrics', 'failed', 'Prometheus metrics endpoint is not accessible');
        }
      } catch (error) {
        this.addResult('monitoring', 'Prometheus Metrics', 'failed', 'Prometheus metrics endpoint check failed', {
          error: error.message
        });
      }

    } catch (error) {
      this.addResult('monitoring', 'Monitoring Validation', 'failed', 'Failed to validate monitoring configuration', {
        error: error.message
      });
    }
  }

  /**
   * Validate disaster recovery
   */
  async validateDisasterRecovery() {
    console.log('\n💾 Validating Disaster Recovery...');

    try {
      const response = await this.makeRequest(`${this.options.apiUrl}/health/disaster-recovery`);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.status === 'healthy') {
          this.addResult('disaster-recovery', 'Disaster Recovery', 'passed', 'Disaster recovery system is healthy', {
            status: data.status,
            details: data
          });
        } else {
          this.addResult('disaster-recovery', 'Disaster Recovery', 'failed', 'Disaster recovery system is not healthy', {
            status: data.status,
            details: data
          });
        }
      } else {
        this.addResult('disaster-recovery', 'Disaster Recovery', 'failed', 'Failed to check disaster recovery status', {
          statusCode: response.status
        });
      }

    } catch (error) {
      this.addResult('disaster-recovery', 'Disaster Recovery', 'failed', 'Disaster recovery validation failed', {
        error: error.message
      });
    }
  }

  /**
   * Generate validation report
   */
  generateReport() {
    const { summary } = this.validationResults;
    
    // Determine overall status
    if (summary.failed > 0) {
      this.validationResults.overallStatus = 'failed';
    } else if (summary.warnings > 0) {
      this.validationResults.overallStatus = 'warning';
    } else {
      this.validationResults.overallStatus = 'passed';
    }

    return this.validationResults;
  }

  /**
   * Save validation report
   */
  async saveReport(report) {
    const reportsDir = path.join(__dirname, '../reports');
    await fs.mkdir(reportsDir, { recursive: true });
    
    const reportFile = path.join(reportsDir, `validation_${Date.now()}.json`);
    await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
    
    console.log(`\n📄 Validation report saved: ${reportFile}`);
    return reportFile;
  }

  /**
   * Print summary
   */
  printSummary(report) {
    const { summary, overallStatus } = report;
    
    console.log('\n' + '='.repeat(60));
    console.log('🎯 PRODUCTION VALIDATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Overall Status: ${overallStatus.toUpperCase()}`);
    console.log(`Total Checks: ${summary.total}`);
    console.log(`✅ Passed: ${summary.passed}`);
    console.log(`❌ Failed: ${summary.failed}`);
    console.log(`⚠️  Warnings: ${summary.warnings}`);
    console.log('='.repeat(60));

    if (overallStatus === 'failed') {
      console.log('\n❌ Production validation FAILED. Please address the issues above.');
      process.exit(1);
    } else if (overallStatus === 'warning') {
      console.log('\n⚠️  Production validation PASSED with warnings. Review warnings above.');
    } else {
      console.log('\n✅ Production validation PASSED. System is ready for production.');
    }
  }

  /**
   * Run all validations
   */
  async validate() {
    console.log('🚀 Starting Truxe Production Validation...\n');

    try {
      // Core validations
      await this.validateEnvironment();
      await this.checkServiceHealth();
      await this.validateDatabase();
      await this.validateRedis();

      // Security validation
      if (this.options.enableSecurityTests) {
        await this.validateSecurity();
      }

      // Performance validation
      if (this.options.enablePerformanceTests) {
        await this.validatePerformance();
      }

      // Monitoring validation
      await this.validateMonitoring();

      // Disaster recovery validation
      await this.validateDisasterRecovery();

      // Load testing
      if (this.options.enableLoadTests) {
        await this.runLoadTests();
      }

      // Generate and save report
      const report = this.generateReport();
      await this.saveReport(report);

      // Print summary
      this.printSummary(report);

      return report;

    } catch (error) {
      console.error('\n❌ Validation process failed:', error.message);
      process.exit(1);
    }
  }
}

/**
 * CLI Interface
 */
async function main() {
  const args = process.argv.slice(2);
  const options = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace('--', '');
    const value = args[i + 1];
    
    if (key && value) {
      // Convert string values to appropriate types
      if (value === 'true') options[key] = true;
      else if (value === 'false') options[key] = false;
      else if (!isNaN(value)) options[key] = parseInt(value);
      else options[key] = value;
    }
  }

  const validator = new ProductionValidationManager(options);
  await validator.validate();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Validation script failed:', error);
    process.exit(1);
  });
}

export { ProductionValidationManager };

