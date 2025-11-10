#!/usr/bin/env node

/**
 * Truxe Configuration Management System
 * 
 * Centralized configuration management with environment validation,
 * secret generation, and deployment preparation.
 * 
 * @author DevOps Engineering Team
 * @version 2.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.dirname(__dirname);

class ConfigurationManager {
  constructor() {
    this.environments = ['development', 'staging', 'testing', 'production'];
    this.requiredSecrets = [
      'db_password',
      'redis_password',
      'jwt_private_key',
      'jwt_public_key',
      'grafana_admin_password'
    ];
    this.configPaths = {
      ports: path.join(PROJECT_ROOT, 'config', 'ports.json'),
      envTemplate: path.join(PROJECT_ROOT, 'env.template'),
      secretsDir: path.join(PROJECT_ROOT, 'secrets')
    };
  }

  /**
   * Initialize configuration for a specific environment
   */
  async initializeEnvironment(env = 'development') {
    console.log(`🚀 Initializing ${env} environment...`);

    try {
      await this.validateEnvironment(env);
      await this.createDirectories();
      await this.generateSecrets(env);
      await this.createEnvironmentFile(env);
      await this.validateConfiguration(env);
      
      console.log(`✅ ${env} environment initialized successfully`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to initialize ${env} environment:`, error.message);
      return false;
    }
  }

  /**
   * Validate environment name
   */
  async validateEnvironment(env) {
    if (!this.environments.includes(env)) {
      throw new Error(`Invalid environment: ${env}. Must be one of: ${this.environments.join(', ')}`);
    }
  }

  /**
   * Create necessary directories
   */
  async createDirectories() {
    const directories = [
      'secrets',
      'data',
      'data/postgres',
      'data/redis',
      'data/prometheus',
      'data/grafana',
      'data/consul',
      'data/traefik',
      'logs',
      'logs/traefik',
      'logs/api',
      'config/consul',
      'config/traefik',
      'config/redis',
      'deploy/monitoring/rules'
    ];

    for (const dir of directories) {
      const fullPath = path.join(PROJECT_ROOT, dir);
      try {
        await fs.access(fullPath);
      } catch {
        await fs.mkdir(fullPath, { recursive: true });
        console.log(`📁 Created directory: ${dir}`);
      }
    }
  }

  /**
   * Generate secrets for the environment
   */
  async generateSecrets(env) {
    console.log('🔐 Generating secrets...');

    const secretsDir = this.configPaths.secretsDir;
    
    // Generate database password
    await this.generateSecret('db_password.txt', this.generatePassword(32));
    
    // Generate Redis password
    await this.generateSecret('redis_password.txt', this.generatePassword(32));
    
    // Generate Grafana admin password
    await this.generateSecret('grafana_admin_password.txt', this.generatePassword(16));
    
    // Generate JWT keys
    await this.generateJWTKeys();
    
    // Generate email API key (placeholder)
    await this.generateSecret('email_api_key.txt', this.generatePassword(32));
    
    // Generate AWS secret key (placeholder)
    await this.generateSecret('aws_secret_key.txt', this.generatePassword(40));

    console.log('✅ Secrets generated successfully');
  }

  /**
   * Generate a secure password
   */
  generatePassword(length = 32) {
    return crypto.randomBytes(length).toString('base64').slice(0, length);
  }

  /**
   * Generate a secret file
   */
  async generateSecret(filename, content) {
    const filePath = path.join(this.configPaths.secretsDir, filename);
    
    try {
      await fs.access(filePath);
      console.log(`⚠️  Secret already exists: ${filename}`);
    } catch {
      await fs.writeFile(filePath, content, { mode: 0o600 });
      console.log(`🔑 Generated secret: ${filename}`);
    }
  }

  /**
   * Generate JWT key pair
   */
  async generateJWTKeys() {
    const privateKeyPath = path.join(this.configPaths.secretsDir, 'jwt-private-key.pem');
    const publicKeyPath = path.join(this.configPaths.secretsDir, 'jwt-public-key.pem');

    try {
      await fs.access(privateKeyPath);
      await fs.access(publicKeyPath);
      console.log('⚠️  JWT keys already exist');
    } catch {
      // Generate RSA key pair
      execSync(`openssl genrsa -out "${privateKeyPath}" 2048`, { stdio: 'ignore' });
      execSync(`openssl rsa -in "${privateKeyPath}" -pubout -out "${publicKeyPath}"`, { stdio: 'ignore' });
      
      // Set proper permissions
      await fs.chmod(privateKeyPath, 0o600);
      await fs.chmod(publicKeyPath, 0o644);
      
      console.log('🔑 Generated JWT key pair');
    }
  }

  /**
   * Create environment file from template
   */
  async createEnvironmentFile(env) {
    const envFilePath = path.join(PROJECT_ROOT, `.env.${env}`);
    
    try {
      await fs.access(envFilePath);
      console.log(`⚠️  Environment file already exists: .env.${env}`);
      return;
    } catch {
      // Read template
      const template = await fs.readFile(this.configPaths.envTemplate, 'utf8');
      
      // Replace environment-specific values
      let envContent = template
        .replace(/TRUXE_ENV=development/g, `TRUXE_ENV=${env}`)
        .replace(/NODE_ENV=development/g, `NODE_ENV=${env}`);

      // Update port ranges based on environment
      const portConfig = JSON.parse(await fs.readFile(this.configPaths.ports, 'utf8'));
      const envPorts = portConfig.environments[env];
      
      if (envPorts) {
        for (const [service, port] of Object.entries(envPorts.services)) {
          const envVar = `TRUXE_${service.toUpperCase().replace(/_/g, '_')}_PORT`;
          envContent = envContent.replace(
            new RegExp(`${envVar}=\\d+`, 'g'),
            `${envVar}=${port}`
          );
        }
      }

      // Environment-specific adjustments
      if (env === 'production') {
        envContent = envContent
          .replace(/LOG_LEVEL=info/g, 'LOG_LEVEL=warn')
          .replace(/# ENABLE_CLUSTERING=true/g, 'ENABLE_CLUSTERING=true')
          .replace(/# CLUSTER_WORKERS=2/g, 'CLUSTER_WORKERS=2')
          .replace(/# SECURITY_HEADERS=true/g, 'SECURITY_HEADERS=true');
      } else if (env === 'development') {
        envContent = envContent
          .replace(/LOG_LEVEL=info/g, 'LOG_LEVEL=debug')
          .replace(/DISABLE_RATE_LIMITING=true/g, 'DISABLE_RATE_LIMITING=true');
      }

      await fs.writeFile(envFilePath, envContent);
      console.log(`📝 Created environment file: .env.${env}`);
    }
  }

  /**
   * Validate configuration
   */
  async validateConfiguration(env) {
    console.log('🔍 Validating configuration...');

    // Check if all required secrets exist
    for (const secret of this.requiredSecrets) {
      const secretPath = path.join(this.configPaths.secretsDir, `${secret}.txt`);
      try {
        await fs.access(secretPath);
      } catch {
        if (secret.includes('key')) {
          // Check for .pem files
          const pemPath = path.join(this.configPaths.secretsDir, `${secret}.pem`);
          try {
            await fs.access(pemPath);
          } catch {
            throw new Error(`Missing secret: ${secret}`);
          }
        } else {
          throw new Error(`Missing secret: ${secret}`);
        }
      }
    }

    // Validate port configuration
    const portConfig = JSON.parse(await fs.readFile(this.configPaths.ports, 'utf8'));
    if (!portConfig.environments[env]) {
      throw new Error(`Port configuration missing for environment: ${env}`);
    }

    console.log('✅ Configuration validation passed');
  }

  /**
   * Display environment status
   */
  async showStatus(env = 'development') {
    console.log(`\n📊 Truxe Configuration Status - ${env.toUpperCase()}`);
    console.log('='.repeat(60));

    try {
      // Environment file status
      const envFilePath = path.join(PROJECT_ROOT, `.env.${env}`);
      try {
        await fs.access(envFilePath);
        console.log(`✅ Environment file: .env.${env}`);
      } catch {
        console.log(`❌ Environment file: .env.${env} (missing)`);
      }

      // Secrets status
      console.log('\n🔐 Secrets Status:');
      for (const secret of this.requiredSecrets) {
        let secretPath = path.join(this.configPaths.secretsDir, `${secret}.txt`);
        if (secret.includes('key')) {
          secretPath = path.join(this.configPaths.secretsDir, `${secret}.pem`);
        }
        
        try {
          await fs.access(secretPath);
          console.log(`  ✅ ${secret}`);
        } catch {
          console.log(`  ❌ ${secret} (missing)`);
        }
      }

      // Port configuration
      console.log('\n🔌 Port Configuration:');
      const portConfig = JSON.parse(await fs.readFile(this.configPaths.ports, 'utf8'));
      const envPorts = portConfig.environments[env];
      
      if (envPorts) {
        console.log(`  Range: ${envPorts.range.start} - ${envPorts.range.end}`);
        for (const [service, port] of Object.entries(envPorts.services)) {
          console.log(`  ${service.padEnd(15)}: ${port}`);
        }
      }

      // Directory status
      console.log('\n📁 Directory Status:');
      const directories = ['secrets', 'data', 'logs', 'config'];
      for (const dir of directories) {
        const dirPath = path.join(PROJECT_ROOT, dir);
        try {
          await fs.access(dirPath);
          console.log(`  ✅ ${dir}/`);
        } catch {
          console.log(`  ❌ ${dir}/ (missing)`);
        }
      }

    } catch (error) {
      console.error(`❌ Error checking status: ${error.message}`);
    }

    console.log('='.repeat(60));
  }

  /**
   * Clean up environment
   */
  async cleanup(env) {
    console.log(`🧹 Cleaning up ${env} environment...`);

    const envFilePath = path.join(PROJECT_ROOT, `.env.${env}`);
    
    try {
      await fs.unlink(envFilePath);
      console.log(`🗑️  Removed: .env.${env}`);
    } catch {
      console.log(`⚠️  Environment file not found: .env.${env}`);
    }

    console.log('✅ Cleanup completed');
  }

  /**
   * Generate deployment configuration
   */
  async generateDeploymentConfig(env) {
    console.log(`🚀 Generating deployment configuration for ${env}...`);

    const deploymentConfig = {
      environment: env,
      timestamp: new Date().toISOString(),
      version: process.env.BUILD_VERSION || 'latest',
      services: {},
      secrets: {},
      networks: {},
      volumes: {}
    };

    // Load port configuration
    const portConfig = JSON.parse(await fs.readFile(this.configPaths.ports, 'utf8'));
    const envPorts = portConfig.environments[env];

    // Generate service configuration
    for (const [service, port] of Object.entries(envPorts.services)) {
      deploymentConfig.services[service] = {
        port: port,
        health_check: this.getHealthCheckConfig(service),
        dependencies: this.getServiceDependencies(service)
      };
    }

    // Save deployment configuration
    const deployConfigPath = path.join(PROJECT_ROOT, `deployment-${env}.json`);
    await fs.writeFile(deployConfigPath, JSON.stringify(deploymentConfig, null, 2));
    
    console.log(`📝 Deployment configuration saved: deployment-${env}.json`);
  }

  /**
   * Get health check configuration for service
   */
  getHealthCheckConfig(service) {
    const healthChecks = {
      api: { endpoint: '/health/ready', timeout: '10s', interval: '30s' },
      database: { type: 'tcp', timeout: '5s', interval: '10s' },
      redis: { type: 'tcp', timeout: '3s', interval: '10s' },
      prometheus: { endpoint: '/-/healthy', timeout: '10s', interval: '30s' },
      grafana: { endpoint: '/api/health', timeout: '10s', interval: '30s' }
    };

    return healthChecks[service] || { type: 'tcp', timeout: '5s', interval: '30s' };
  }

  /**
   * Get service dependencies
   */
  getServiceDependencies(service) {
    const dependencies = {
      api: ['database', 'redis', 'consul'],
      prometheus: ['api', 'consul'],
      grafana: ['prometheus'],
      'port-monitor': ['consul', 'prometheus']
    };

    return dependencies[service] || [];
  }
}

// CLI Interface
async function main() {
  const configManager = new ConfigurationManager();
  const command = process.argv[2];
  const env = process.argv[3] || 'development';

  switch (command) {
    case 'init':
      await configManager.initializeEnvironment(env);
      break;
    
    case 'status':
      await configManager.showStatus(env);
      break;
    
    case 'cleanup':
      await configManager.cleanup(env);
      break;
    
    case 'deploy-config':
      await configManager.generateDeploymentConfig(env);
      break;
    
    case 'secrets':
      await configManager.generateSecrets(env);
      break;
    
    default:
      console.log(`
🔧 Truxe Configuration Manager

Usage:
  node config-manager.js init [environment]         - Initialize environment
  node config-manager.js status [environment]       - Show configuration status
  node config-manager.js cleanup [environment]      - Clean up environment
  node config-manager.js deploy-config [environment] - Generate deployment config
  node config-manager.js secrets [environment]      - Generate secrets

Environments: development, staging, testing, production
Default: development
      `);
      break;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default ConfigurationManager;
