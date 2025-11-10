/**
 * Truxe API Startup Validation
 * 
 * Comprehensive startup validation including port management, configuration,
 * and system health checks before the API server starts.
 * 
 * @author DevOps Engineering Team
 * @version 2.0.0
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import config from './config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Port Management Validation
 */
class StartupValidator {
  constructor() {
    this.validationResults = {
      passed: [],
      warnings: [],
      errors: [],
      critical: []
    };
  }

  /**
   * Add validation result
   */
  addResult(type, category, message, details = null) {
    this.validationResults[type].push({
      category,
      message,
      details,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Validate port management configuration
   */
  async validatePortManagement() {
    console.log('🔍 Validating port management configuration...');

    try {
      // Port management is optional in production
      // Skip validation if port manager module doesn't exist
      let portManager;
      try {
        const imported = await import('../config/ports.js');
        portManager = imported.default;
      } catch (importError) {
        // Port manager module doesn't exist, skip validation
        this.addResult('warnings', 'port_management', 'Port manager module not found (optional in production)');
        return;
      }
      
      // Check if port management is enabled
      if (!config.portManagement.enabled) {
        this.addResult('warnings', 'port_management', 'Port management validation is disabled');
        return;
      }

      // Validate environment configuration
      const env = config.portManagement.environment;
      try {
        const envConfig = portManager.getEnvironmentConfig(env);
        this.addResult('passed', 'port_management', `Environment '${env}' configuration loaded successfully`);
        
        // Validate port range
        const apiPort = config.app.port;
        if (apiPort < envConfig.range.start || apiPort > envConfig.range.end) {
          this.addResult('errors', 'port_management', 
            `API port ${apiPort} is outside environment range ${envConfig.range.start}-${envConfig.range.end}`);
        } else {
          this.addResult('passed', 'port_management', `API port ${apiPort} is within valid range`);
        }
        
      } catch (error) {
        this.addResult('critical', 'port_management', `Invalid environment '${env}': ${error.message}`);
        return;
      }

      // Check for port conflicts if enabled
      if (config.portManagement.conflictCheck) {
        const conflicts = portManager.detectConflicts(env);
        
        if (conflicts.length === 0) {
          this.addResult('passed', 'port_management', 'No port conflicts detected');
        } else {
          for (const conflict of conflicts) {
            if (conflict.type === 'port_in_use' && conflict.service === 'api') {
              this.addResult('warnings', 'port_management', 
                `API port ${conflict.port} is already in use`, conflict);
            } else if (conflict.severity === 'critical') {
              this.addResult('critical', 'port_management', conflict.message, conflict);
            } else if (conflict.severity === 'high') {
              this.addResult('errors', 'port_management', conflict.message, conflict);
            } else {
              this.addResult('warnings', 'port_management', conflict.message, conflict);
            }
          }
        }
      }

      // Validate port configuration consistency
      const configuredPorts = config.portManagement.servicePorts;
      const envPorts = portManager.getEnvironmentConfig(env).services;
      
      for (const [service, configPort] of Object.entries(configuredPorts)) {
        const envPort = envPorts[service];
        if (envPort && configPort !== envPort) {
          this.addResult('warnings', 'port_management', 
            `Port mismatch for ${service}: config=${configPort}, environment=${envPort}`);
        }
      }

    } catch (error) {
      this.addResult('critical', 'port_management', 
        `Failed to load port management system: ${error.message}`);
    }
  }

  /**
   * Validate database connectivity
   */
  async validateDatabase() {
    console.log('🔍 Validating database connectivity...');

    try {
      // First check if DATABASE_URL is set
      if (!config.database.url) {
        this.addResult('critical', 'database', 'DATABASE_URL environment variable is not set');
        return;
      }

      // Validate DATABASE_URL format
      try {
        const dbUrl = new URL(config.database.url);
        console.log('DATABASE_URL validated:', {
          protocol: dbUrl.protocol,
          host: dbUrl.host,
          database: dbUrl.pathname
        });
      } catch (urlError) {
        console.error('DATABASE_URL value:', config.database.url);
        console.error('Likely cause: DB_PASSWORD environment variable is not set or empty');
        this.addResult('critical', 'database', `Invalid DATABASE_URL format: ${urlError.message}. Ensure DB_PASSWORD is set in Dokploy.`);
        return;
      }

      // Import database connection (dynamic import)
      const { default: db } = await import('./database/connection.js');

      // Test connection
      await db.raw('SELECT 1');
      this.addResult('passed', 'database', 'Database connection successful');

      // Check database version
      const result = await db.raw('SELECT version()');
      const version = result.rows[0].version;
      this.addResult('passed', 'database', `PostgreSQL version: ${version}`);

    } catch (error) {
      this.addResult('critical', 'database', `Database connection failed: ${error.message}`);
    }
  }

  /**
   * Validate Redis connectivity
   */
  async validateRedis() {
    console.log('🔍 Validating Redis connectivity...');
    
    try {
      // Create Redis client for testing
      const Redis = (await import('ioredis')).default;
      const redis = new Redis(config.redis.url);
      
      // Test connection
      await redis.ping();
      this.addResult('passed', 'redis', 'Redis connection successful');
      
      // Get Redis info
      const info = await redis.info('server');
      const version = info.match(/redis_version:([^\r\n]+)/)?.[1];
      if (version) {
        this.addResult('passed', 'redis', `Redis version: ${version}`);
      }
      
      await redis.disconnect();
      
    } catch (error) {
      this.addResult('critical', 'redis', `Redis connection failed: ${error.message}`);
    }
  }

  /**
   * Validate JWT configuration
   */
  async validateJWT() {
    console.log('🔍 Validating JWT configuration...');

    try {
      // Check if keys are loaded
      if (!config.jwt.privateKey || !config.jwt.publicKey) {
        this.addResult('critical', 'jwt', 'JWT keys are not loaded');
        return;
      }

      // Validate key format
      if (!config.jwt.privateKey.includes('-----BEGIN')) {
        this.addResult('errors', 'jwt', 'JWT private key format appears invalid');
        console.error('JWT Private Key (first 100 chars):', config.jwt.privateKey.substring(0, 100));
      } else {
        this.addResult('passed', 'jwt', 'JWT private key format is valid');
      }

      if (!config.jwt.publicKey.includes('-----BEGIN')) {
        this.addResult('errors', 'jwt', 'JWT public key format appears invalid');
        console.error('JWT Public Key (first 100 chars):', config.jwt.publicKey.substring(0, 100));
      } else {
        this.addResult('passed', 'jwt', 'JWT public key format is valid');
      }

      // Test JWT signing and verification
      const jwt = (await import('jsonwebtoken')).default;
      const testPayload = { test: true, iat: Math.floor(Date.now() / 1000) };

      console.log('JWT Config:', {
        algorithm: config.jwt.algorithm,
        issuer: config.jwt.issuer,
        audience: config.jwt.audience,
        privateKeyLength: config.jwt.privateKey?.length,
        publicKeyLength: config.jwt.publicKey?.length
      });

      const token = jwt.sign(testPayload, config.jwt.privateKey, {
        algorithm: config.jwt.algorithm,
        issuer: config.jwt.issuer,
        audience: config.jwt.audience,
        expiresIn: '1m'
      });

      const decoded = jwt.verify(token, config.jwt.publicKey, {
        algorithms: [config.jwt.algorithm],
        issuer: config.jwt.issuer,
        audience: config.jwt.audience
      });

      if (decoded.test === true) {
        this.addResult('passed', 'jwt', 'JWT signing and verification successful');
      } else {
        this.addResult('errors', 'jwt', 'JWT verification failed');
      }

    } catch (error) {
      console.error('JWT Validation Error Details:', error);
      this.addResult('critical', 'jwt', `JWT validation failed: ${error.message}`);
    }
  }

  /**
   * Validate email configuration
   */
  async validateEmail() {
    console.log('🔍 Validating email configuration...');
    
    try {
      const provider = config.email.provider;
      
      switch (provider) {
        case 'resend':
          if (!config.email.resend.apiKey) {
            this.addResult('warnings', 'email', 'Resend API key not configured');
          } else {
            this.addResult('passed', 'email', 'Resend configuration appears valid');
          }
          break;
          
        case 'ses':
          if (!config.email.ses.accessKeyId || !config.email.ses.secretAccessKey) {
            this.addResult('warnings', 'email', 'AWS SES credentials not configured');
          } else {
            this.addResult('passed', 'email', 'AWS SES configuration appears valid');
          }
          break;
          
        case 'smtp':
          if (!config.email.smtp.host) {
            this.addResult('warnings', 'email', 'SMTP host not configured');
          } else {
            this.addResult('passed', 'email', `SMTP configuration: ${config.email.smtp.host}:${config.email.smtp.port}`);
          }
          break;

        case 'brevo':
          if (!config.email.brevo.apiKey) {
            this.addResult('warnings', 'email', 'Brevo API key not configured');
          } else {
            this.addResult('passed', 'email', 'Brevo configuration appears valid');
          }
          break;

        default:
          this.addResult('warnings', 'email', `Unknown email provider: ${provider}`);
      }
      
    } catch (error) {
      this.addResult('errors', 'email', `Email validation failed: ${error.message}`);
    }
  }

  /**
   * Validate security configuration
   */
  async validateSecurity() {
    console.log('🔍 Validating security configuration...');
    
    // Check production security settings
    if (config.app.environment === 'production') {
      if (config.security.cookieSecret === 'truxe-cookie-secret-change-in-production') {
        this.addResult('critical', 'security', 'Cookie secret must be changed in production');
      }
      
      if (config.security.sessionSecret === 'truxe-session-secret-change-in-production') {
        this.addResult('critical', 'security', 'Session secret must be changed in production');
      }
      
      if (!config.database.ssl) {
        this.addResult('warnings', 'security', 'Database SSL is disabled (acceptable for internal databases)');
      }
      
      if (!config.features.helmet) {
        this.addResult('errors', 'security', 'Helmet security middleware should be enabled in production');
      }
      
      if (!config.features.rateLimiting) {
        this.addResult('errors', 'security', 'Rate limiting should be enabled in production');
      }
      
      this.addResult('passed', 'security', 'Production security validation completed');
    } else {
      this.addResult('passed', 'security', `Security validation for ${config.app.environment} environment`);
    }
  }

  /**
   * Validate system resources
   */
  async validateSystemResources() {
    console.log('🔍 Validating system resources...');
    
    try {
      const os = await import('os');
      
      // Check memory
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const memoryUsage = ((totalMemory - freeMemory) / totalMemory) * 100;
      
      if (memoryUsage > 90) {
        this.addResult('warnings', 'system', `High memory usage: ${memoryUsage.toFixed(1)}%`);
      } else {
        this.addResult('passed', 'system', `Memory usage: ${memoryUsage.toFixed(1)}%`);
      }
      
      // Check CPU load
      const loadAvg = os.loadavg();
      const cpuCount = os.cpus().length;
      const loadPercentage = (loadAvg[0] / cpuCount) * 100;
      
      if (loadPercentage > 80) {
        this.addResult('warnings', 'system', `High CPU load: ${loadPercentage.toFixed(1)}%`);
      } else {
        this.addResult('passed', 'system', `CPU load: ${loadPercentage.toFixed(1)}%`);
      }
      
      // Check disk space (if possible)
      try {
        const fs = await import('fs');
        const stats = await fs.promises.statfs('.');
        const totalSpace = stats.blocks * stats.bsize;
        const freeSpace = stats.bavail * stats.bsize;
        const usedPercentage = ((totalSpace - freeSpace) / totalSpace) * 100;
        
        if (usedPercentage > 90) {
          this.addResult('warnings', 'system', `Low disk space: ${usedPercentage.toFixed(1)}% used`);
        } else {
          this.addResult('passed', 'system', `Disk usage: ${usedPercentage.toFixed(1)}%`);
        }
      } catch (error) {
        // statfs might not be available on all systems
        this.addResult('passed', 'system', 'Disk space check not available');
      }
      
    } catch (error) {
      this.addResult('warnings', 'system', `System resource check failed: ${error.message}`);
    }
  }

  /**
   * Run all validations
   */
  async runAllValidations() {
    console.log('🚀 Starting Truxe API startup validation...\n');
    
    const validations = [
      this.validatePortManagement(),
      this.validateDatabase(),
      this.validateRedis(),
      this.validateJWT(),
      this.validateEmail(),
      this.validateSecurity(),
      this.validateSystemResources()
    ];
    
    await Promise.all(validations);
    
    return this.generateReport();
  }

  /**
   * Generate validation report
   */
  generateReport() {
    const { passed, warnings, errors, critical } = this.validationResults;
    
    console.log('\n📊 Startup Validation Report');
    console.log('=' .repeat(50));
    
    // Summary
    console.log(`✅ Passed: ${passed.length}`);
    console.log(`⚠️  Warnings: ${warnings.length}`);
    console.log(`❌ Errors: ${errors.length}`);
    console.log(`🚨 Critical: ${critical.length}`);
    
    // Details
    if (critical.length > 0) {
      console.log('\n🚨 CRITICAL ISSUES:');
      critical.forEach(issue => {
        console.log(`  • [${issue.category}] ${issue.message}`);
      });
    }
    
    if (errors.length > 0) {
      console.log('\n❌ ERRORS:');
      errors.forEach(issue => {
        console.log(`  • [${issue.category}] ${issue.message}`);
      });
    }
    
    if (warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      warnings.forEach(issue => {
        console.log(`  • [${issue.category}] ${issue.message}`);
      });
    }
    
    if (passed.length > 0 && config.app.logLevel === 'debug') {
      console.log('\n✅ PASSED:');
      passed.forEach(issue => {
        console.log(`  • [${issue.category}] ${issue.message}`);
      });
    }
    
    console.log('=' .repeat(50));
    
    // Determine overall status
    const canStart = critical.length === 0;
    const hasIssues = errors.length > 0 || warnings.length > 0;
    
    if (canStart && !hasIssues) {
      console.log('🎉 All validations passed! API is ready to start.');
      return { status: 'success', canStart: true };
    } else if (canStart && hasIssues) {
      console.log('⚠️  API can start but has issues that should be addressed.');
      return { status: 'warning', canStart: true };
    } else {
      console.log('🚨 Critical issues detected! API cannot start safely.');
      return { status: 'critical', canStart: false };
    }
  }
}

/**
 * Run startup validation
 */
export async function validateStartup() {
  const validator = new StartupValidator();
  return await validator.runAllValidations();
}

export default StartupValidator;
