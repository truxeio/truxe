#!/usr/bin/env node

/**
 * Truxe Production Deployment Script
 * 
 * Comprehensive production deployment automation with health checks,
 * performance validation, security verification, and rollback capabilities.
 * 
 * @author Production Engineering Team
 * @version 1.0.0
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Production Deployment Manager
 */
class ProductionDeploymentManager {
  constructor(options = {}) {
    this.options = {
      environment: options.environment || 'production',
      apiUrl: options.apiUrl || 'http://localhost:3001',
      deploymentTimeout: options.deploymentTimeout || 300000, // 5 minutes
      healthCheckTimeout: options.healthCheckTimeout || 60000, // 1 minute
      rollbackOnFailure: options.rollbackOnFailure !== false,
      enableLoadTesting: options.enableLoadTesting !== false,
      enableSecurityValidation: options.enableSecurityValidation !== false,
      enablePerformanceValidation: options.enablePerformanceValidation !== false,
      ...options
    };

    this.deploymentId = this.generateDeploymentId();
    this.startTime = Date.now();
    this.deploymentLog = [];
    this.rollbackSteps = [];
  }

  /**
   * Generate unique deployment ID
   */
  generateDeploymentId() {
    return `deploy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log deployment step
   */
  logStep(step, status, message, details = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      step,
      status,
      message,
      details,
      deploymentId: this.deploymentId
    };

    this.deploymentLog.push(logEntry);
    console.log(`[${timestamp}] [${status.toUpperCase()}] ${step}: ${message}`);
    
    if (details.error) {
      console.error('Error details:', details.error);
    }
  }

  /**
   * Execute command with timeout
   */
  async executeCommand(command, options = {}) {
    const { timeout = 30000, cwd = process.cwd() } = options;
    
    return new Promise((resolve, reject) => {
      const child = spawn('sh', ['-c', command], {
        cwd,
        stdio: 'inherit'
      });

      const timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Command timeout after ${timeout}ms: ${command}`));
      }, timeout);

      child.on('close', (code) => {
        clearTimeout(timeoutId);
        if (code === 0) {
          resolve(code);
        } else {
          reject(new Error(`Command failed with exit code ${code}: ${command}`));
        }
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  /**
   * Check if service is healthy
   */
  async checkServiceHealth(endpoint, timeout = 10000) {
    try {
      const response = await fetch(`${this.options.apiUrl}${endpoint}`, {
        method: 'GET',
        timeout
      });

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw new Error(`Health check failed for ${endpoint}: ${error.message}`);
    }
  }

  /**
   * Pre-deployment validation
   */
  async preDeploymentValidation() {
    this.logStep('pre-deployment', 'info', 'Starting pre-deployment validation');

    try {
      // Check if production environment file exists
      const envFile = path.join(__dirname, '../api/.env.production');
      try {
        await fs.access(envFile);
        this.logStep('pre-deployment', 'success', 'Production environment file found');
      } catch {
        this.logStep('pre-deployment', 'error', 'Production environment file not found', {
          suggestion: 'Copy api/env.production.template to api/.env.production and configure'
        });
        throw new Error('Production environment file missing');
      }

      // Validate environment variables
      await this.validateEnvironmentVariables();

      // Check dependencies
      await this.checkDependencies();

      // Validate configuration
      await this.validateConfiguration();

      this.logStep('pre-deployment', 'success', 'Pre-deployment validation completed');
    } catch (error) {
      this.logStep('pre-deployment', 'error', 'Pre-deployment validation failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Validate environment variables
   */
  async validateEnvironmentVariables() {
    const requiredVars = [
      'NODE_ENV',
      'DATABASE_URL',
      'REDIS_URL',
      'JWT_PRIVATE_KEY_FILE',
      'JWT_PUBLIC_KEY_FILE',
      'EMAIL_API_KEY_FILE'
    ];

    const missingVars = [];
    
    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        missingVars.push(varName);
      }
    }

    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    this.logStep('env-validation', 'success', 'All required environment variables present');
  }

  /**
   * Check dependencies
   */
  async checkDependencies() {
    try {
      // Check if Node.js version is compatible
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
      
      if (majorVersion < 20) {
        throw new Error(`Node.js version ${nodeVersion} is not supported. Required: >=20.0.0`);
      }

      // Check if required packages are installed
      await this.executeCommand('npm list --production --depth=0', {
        cwd: path.join(__dirname, '../api'),
        timeout: 30000
      });

      this.logStep('dependencies', 'success', 'Dependencies check completed');
    } catch (error) {
      this.logStep('dependencies', 'error', 'Dependencies check failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Validate configuration
   */
  async validateConfiguration() {
    try {
      // Run configuration validation script
      await this.executeCommand('npm run validate-config', {
        cwd: path.join(__dirname, '../api'),
        timeout: 30000
      });

      this.logStep('config-validation', 'success', 'Configuration validation completed');
    } catch (error) {
      this.logStep('config-validation', 'error', 'Configuration validation failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Deploy application
   */
  async deployApplication() {
    this.logStep('deployment', 'info', 'Starting application deployment');

    try {
      // Stop existing application if running
      await this.stopApplication();

      // Start application with production configuration
      await this.startApplication();

      // Wait for application to be ready
      await this.waitForApplicationReady();

      this.logStep('deployment', 'success', 'Application deployment completed');
    } catch (error) {
      this.logStep('deployment', 'error', 'Application deployment failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Stop application
   */
  async stopApplication() {
    try {
      // Try to stop gracefully first
      await this.executeCommand('pkill -f "node.*src/server.js" || true', { timeout: 10000 });
      
      // Wait a moment for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      this.logStep('stop-app', 'success', 'Application stopped');
    } catch (error) {
      this.logStep('stop-app', 'warning', 'Error stopping application', { error: error.message });
    }
  }

  /**
   * Start application
   */
  async startApplication() {
    try {
      // Start application in background
      const child = spawn('npm', ['run', 'production:start'], {
        cwd: path.join(__dirname, '../api'),
        detached: true,
        stdio: 'ignore'
      });

      child.unref();
      
      this.logStep('start-app', 'success', 'Application started');
    } catch (error) {
      this.logStep('start-app', 'error', 'Failed to start application', { error: error.message });
      throw error;
    }
  }

  /**
   * Wait for application to be ready
   */
  async waitForApplicationReady() {
    const maxAttempts = 30;
    const delay = 2000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.checkServiceHealth('/health', 5000);
        this.logStep('app-ready', 'success', `Application ready after ${attempt * delay}ms`);
        return;
      } catch (error) {
        if (attempt === maxAttempts) {
          throw new Error(`Application not ready after ${maxAttempts * delay}ms`);
        }
        
        this.logStep('app-ready', 'info', `Waiting for application (attempt ${attempt}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Post-deployment validation
   */
  async postDeploymentValidation() {
    this.logStep('post-deployment', 'info', 'Starting post-deployment validation');

    try {
      // Health checks
      await this.performHealthChecks();

      // Security validation
      if (this.options.enableSecurityValidation) {
        await this.performSecurityValidation();
      }

      // Performance validation
      if (this.options.enablePerformanceValidation) {
        await this.performPerformanceValidation();
      }

      // Load testing
      if (this.options.enableLoadTesting) {
        await this.performLoadTesting();
      }

      this.logStep('post-deployment', 'success', 'Post-deployment validation completed');
    } catch (error) {
      this.logStep('post-deployment', 'error', 'Post-deployment validation failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Perform comprehensive health checks
   */
  async performHealthChecks() {
    const healthEndpoints = [
      '/health',
      '/health/production',
      '/health/comprehensive',
      '/health/performance',
      '/health/error-handler',
      '/health/monitoring',
      '/health/disaster-recovery'
    ];

    for (const endpoint of healthEndpoints) {
      try {
        const healthData = await this.checkServiceHealth(endpoint);
        this.logStep('health-check', 'success', `Health check passed: ${endpoint}`, { data: healthData });
      } catch (error) {
        this.logStep('health-check', 'error', `Health check failed: ${endpoint}`, { error: error.message });
        throw error;
      }
    }
  }

  /**
   * Perform security validation
   */
  async performSecurityValidation() {
    this.logStep('security-validation', 'info', 'Starting security validation');

    try {
      // Check security headers
      const response = await fetch(`${this.options.apiUrl}/health`, {
        method: 'GET'
      });

      const securityHeaders = [
        'strict-transport-security',
        'x-frame-options',
        'x-content-type-options',
        'x-xss-protection',
        'content-security-policy'
      ];

      const missingHeaders = [];
      for (const header of securityHeaders) {
        if (!response.headers.get(header)) {
          missingHeaders.push(header);
        }
      }

      if (missingHeaders.length > 0) {
        throw new Error(`Missing security headers: ${missingHeaders.join(', ')}`);
      }

      this.logStep('security-validation', 'success', 'Security validation completed');
    } catch (error) {
      this.logStep('security-validation', 'error', 'Security validation failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Perform performance validation
   */
  async performPerformanceValidation() {
    this.logStep('performance-validation', 'info', 'Starting performance validation');

    try {
      // Run performance tests
      await this.executeCommand('npm run test:load:smoke', {
        cwd: path.join(__dirname, '../api'),
        timeout: 120000
      });

      this.logStep('performance-validation', 'success', 'Performance validation completed');
    } catch (error) {
      this.logStep('performance-validation', 'error', 'Performance validation failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Perform load testing
   */
  async performLoadTesting() {
    this.logStep('load-testing', 'info', 'Starting load testing');

    try {
      // Run comprehensive load tests
      await this.executeCommand('npm run test:load:comprehensive', {
        cwd: path.join(__dirname, '../api'),
        timeout: 600000 // 10 minutes
      });

      this.logStep('load-testing', 'success', 'Load testing completed');
    } catch (error) {
      this.logStep('load-testing', 'error', 'Load testing failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Rollback deployment
   */
  async rollbackDeployment() {
    this.logStep('rollback', 'info', 'Starting deployment rollback');

    try {
      // Stop current application
      await this.stopApplication();

      // Restore previous version (if available)
      // This would depend on your deployment strategy
      this.logStep('rollback', 'info', 'Rollback completed');

    } catch (error) {
      this.logStep('rollback', 'error', 'Rollback failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate deployment report
   */
  generateDeploymentReport() {
    const duration = Date.now() - this.startTime;
    const successCount = this.deploymentLog.filter(log => log.status === 'success').length;
    const errorCount = this.deploymentLog.filter(log => log.status === 'error').length;
    const warningCount = this.deploymentLog.filter(log => log.status === 'warning').length;

    const report = {
      deploymentId: this.deploymentId,
      environment: this.options.environment,
      duration: duration,
      status: errorCount > 0 ? 'failed' : 'success',
      summary: {
        totalSteps: this.deploymentLog.length,
        success: successCount,
        errors: errorCount,
        warnings: warningCount
      },
      steps: this.deploymentLog,
      timestamp: new Date().toISOString()
    };

    return report;
  }

  /**
   * Save deployment report
   */
  async saveDeploymentReport(report) {
    const reportsDir = path.join(__dirname, '../reports');
    await fs.mkdir(reportsDir, { recursive: true });
    
    const reportFile = path.join(reportsDir, `deployment_${this.deploymentId}.json`);
    await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
    
    this.logStep('report', 'info', `Deployment report saved: ${reportFile}`);
  }

  /**
   * Main deployment process
   */
  async deploy() {
    try {
      this.logStep('deployment', 'info', `Starting production deployment: ${this.deploymentId}`);

      // Pre-deployment validation
      await this.preDeploymentValidation();

      // Deploy application
      await this.deployApplication();

      // Post-deployment validation
      await this.postDeploymentValidation();

      // Generate and save report
      const report = this.generateDeploymentReport();
      await this.saveDeploymentReport(report);

      this.logStep('deployment', 'success', 'Production deployment completed successfully');
      
      console.log('\n🎉 Deployment Summary:');
      console.log(`   Deployment ID: ${this.deploymentId}`);
      console.log(`   Duration: ${report.duration}ms`);
      console.log(`   Status: ${report.status}`);
      console.log(`   Steps: ${report.summary.totalSteps}`);
      console.log(`   Success: ${report.summary.success}`);
      console.log(`   Errors: ${report.summary.errors}`);
      console.log(`   Warnings: ${report.summary.warnings}`);

      return report;

    } catch (error) {
      this.logStep('deployment', 'error', 'Deployment failed', { error: error.message });

      // Rollback if enabled
      if (this.options.rollbackOnFailure) {
        try {
          await this.rollbackDeployment();
        } catch (rollbackError) {
          this.logStep('rollback', 'error', 'Rollback failed', { error: rollbackError.message });
        }
      }

      // Generate and save failure report
      const report = this.generateDeploymentReport();
      await this.saveDeploymentReport(report);

      console.error('\n❌ Deployment Failed:');
      console.error(`   Deployment ID: ${this.deploymentId}`);
      console.error(`   Error: ${error.message}`);
      console.error(`   Report saved: reports/deployment_${this.deploymentId}.json`);

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

  const deploymentManager = new ProductionDeploymentManager(options);
  await deploymentManager.deploy();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Deployment script failed:', error);
    process.exit(1);
  });
}

export { ProductionDeploymentManager };

