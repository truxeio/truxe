/**
 * Truxe Port Management Utilities
 * 
 * Advanced utilities for port validation, conflict detection, and system integration.
 * Provides comprehensive tooling for port management across all environments.
 * 
 * @author DevOps Engineering Team
 * @version 2.0.0
 */

import { execSync, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import portManager from './ports.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Advanced Port Validation Utilities
 */
export class PortValidator {
  constructor() {
    this.validationRules = new Map();
    this.setupDefaultRules();
  }

  /**
   * Setup default validation rules
   */
  setupDefaultRules() {
    // Port range validation
    this.addRule('range', (port, env) => {
      const envConfig = portManager.getEnvironmentConfig(env);
      return port >= envConfig.range.start && port <= envConfig.range.end;
    }, 'Port must be within environment range');

    // System port validation
    this.addRule('system', (port) => {
      return port >= 1024; // Non-privileged ports only
    }, 'Port must be non-privileged (>= 1024)');

    // Reserved port validation
    this.addRule('reserved', (port) => {
      return !portManager.isPortReserved(port);
    }, 'Port must not be in reserved ranges');

    // Availability validation
    this.addRule('available', (port) => {
      return portManager.isPortAvailable(port);
    }, 'Port must be available');
  }

  /**
   * Add custom validation rule
   */
  addRule(name, validator, message) {
    this.validationRules.set(name, { validator, message });
  }

  /**
   * Validate a single port
   */
  validatePort(port, env = 'development', rules = ['range', 'system', 'reserved']) {
    const results = {
      port,
      environment: env,
      valid: true,
      errors: [],
      warnings: []
    };

    for (const ruleName of rules) {
      const rule = this.validationRules.get(ruleName);
      if (!rule) {
        results.warnings.push(`Unknown validation rule: ${ruleName}`);
        continue;
      }

      try {
        if (!rule.validator(port, env)) {
          results.valid = false;
          results.errors.push({
            rule: ruleName,
            message: rule.message,
            port
          });
        }
      } catch (error) {
        results.warnings.push(`Rule '${ruleName}' failed: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Validate all ports in an environment
   */
  validateEnvironment(env = 'development') {
    const envConfig = portManager.getEnvironmentConfig(env);
    const results = {
      environment: env,
      timestamp: new Date().toISOString(),
      summary: {
        total_ports: 0,
        valid_ports: 0,
        invalid_ports: 0,
        warnings: 0
      },
      services: {}
    };

    for (const [serviceName, port] of Object.entries(envConfig.services)) {
      const validation = this.validatePort(port, env);
      results.services[serviceName] = validation;
      
      results.summary.total_ports++;
      if (validation.valid) {
        results.summary.valid_ports++;
      } else {
        results.summary.invalid_ports++;
      }
      results.summary.warnings += validation.warnings.length;
    }

    return results;
  }
}

/**
 * Advanced Conflict Detection System
 */
export class ConflictDetector {
  constructor() {
    this.detectionMethods = new Map();
    this.setupDefaultMethods();
  }

  /**
   * Setup default detection methods
   */
  setupDefaultMethods() {
    this.addMethod('lsof', this.detectWithLsof.bind(this));
    this.addMethod('netstat', this.detectWithNetstat.bind(this));
    this.addMethod('ss', this.detectWithSS.bind(this));
    this.addMethod('docker', this.detectDockerPorts.bind(this));
  }

  /**
   * Add custom detection method
   */
  addMethod(name, detector) {
    this.detectionMethods.set(name, detector);
  }

  /**
   * Detect conflicts using lsof
   */
  async detectWithLsof(port) {
    try {
      const result = execSync(`lsof -ti:${port}`, { 
        encoding: 'utf8', 
        timeout: 5000,
        stdio: 'pipe'
      });
      
      if (result.trim()) {
        const pids = result.trim().split('\n');
        const processes = [];
        
        for (const pid of pids) {
          try {
            const processInfo = execSync(`ps -p ${pid} -o pid,ppid,comm,args --no-headers`, {
              encoding: 'utf8',
              timeout: 2000
            });
            processes.push({
              pid: parseInt(pid),
              info: processInfo.trim()
            });
          } catch (error) {
            // Process might have ended
            processes.push({
              pid: parseInt(pid),
              info: 'Process ended'
            });
          }
        }
        
        return {
          method: 'lsof',
          port,
          in_use: true,
          processes
        };
      }
      
      return { method: 'lsof', port, in_use: false };
    } catch (error) {
      return { method: 'lsof', port, in_use: false, error: error.message };
    }
  }

  /**
   * Detect conflicts using netstat
   */
  async detectWithNetstat(port) {
    try {
      const result = execSync(`netstat -tlnp 2>/dev/null | grep :${port}`, { 
        encoding: 'utf8', 
        timeout: 5000 
      });
      
      return {
        method: 'netstat',
        port,
        in_use: result.trim().length > 0,
        details: result.trim()
      };
    } catch (error) {
      return { method: 'netstat', port, in_use: false };
    }
  }

  /**
   * Detect conflicts using ss (socket statistics)
   */
  async detectWithSS(port) {
    try {
      const result = execSync(`ss -tlnp | grep :${port}`, { 
        encoding: 'utf8', 
        timeout: 5000 
      });
      
      return {
        method: 'ss',
        port,
        in_use: result.trim().length > 0,
        details: result.trim()
      };
    } catch (error) {
      return { method: 'ss', port, in_use: false };
    }
  }

  /**
   * Detect Docker container port usage
   */
  async detectDockerPorts(port) {
    try {
      const result = execSync(`docker ps --format "table {{.Names}}\\t{{.Ports}}" | grep :${port}`, { 
        encoding: 'utf8', 
        timeout: 5000 
      });
      
      return {
        method: 'docker',
        port,
        in_use: result.trim().length > 0,
        containers: result.trim().split('\n').filter(line => line.trim())
      };
    } catch (error) {
      return { method: 'docker', port, in_use: false };
    }
  }

  /**
   * Comprehensive conflict detection using multiple methods
   */
  async detectConflicts(ports, methods = ['lsof', 'docker']) {
    const results = {
      timestamp: new Date().toISOString(),
      methods_used: methods,
      conflicts: [],
      summary: {
        total_ports_checked: Array.isArray(ports) ? ports.length : 1,
        conflicts_found: 0,
        methods_succeeded: 0,
        methods_failed: 0
      }
    };

    const portsToCheck = Array.isArray(ports) ? ports : [ports];

    for (const port of portsToCheck) {
      const portResults = {
        port,
        conflict_detected: false,
        detection_results: []
      };

      for (const methodName of methods) {
        const method = this.detectionMethods.get(methodName);
        if (!method) {
          portResults.detection_results.push({
            method: methodName,
            error: 'Method not found'
          });
          results.summary.methods_failed++;
          continue;
        }

        try {
          const detection = await method(port);
          portResults.detection_results.push(detection);
          
          if (detection.in_use) {
            portResults.conflict_detected = true;
          }
          
          results.summary.methods_succeeded++;
        } catch (error) {
          portResults.detection_results.push({
            method: methodName,
            port,
            error: error.message
          });
          results.summary.methods_failed++;
        }
      }

      if (portResults.conflict_detected) {
        results.conflicts.push(portResults);
        results.summary.conflicts_found++;
      }
    }

    return results;
  }
}

/**
 * Port Allocation Strategy Manager
 */
export class PortAllocator {
  constructor() {
    this.allocationStrategies = new Map();
    this.setupDefaultStrategies();
  }

  /**
   * Setup default allocation strategies
   */
  setupDefaultStrategies() {
    this.addStrategy('sequential', this.sequentialAllocation.bind(this));
    this.addStrategy('random', this.randomAllocation.bind(this));
    this.addStrategy('service_based', this.serviceBasedAllocation.bind(this));
    this.addStrategy('load_balanced', this.loadBalancedAllocation.bind(this));
  }

  /**
   * Add custom allocation strategy
   */
  addStrategy(name, strategy) {
    this.allocationStrategies.set(name, strategy);
  }

  /**
   * Sequential port allocation
   */
  sequentialAllocation(startPort, count, env = 'development') {
    const envConfig = portManager.getEnvironmentConfig(env);
    const ports = [];
    let currentPort = startPort;

    for (let i = 0; i < count; i++) {
      while (currentPort <= envConfig.range.end) {
        if (portManager.isPortAvailable(currentPort) && !portManager.isPortReserved(currentPort)) {
          ports.push(currentPort);
          currentPort++;
          break;
        }
        currentPort++;
      }

      if (currentPort > envConfig.range.end) {
        throw new Error(`Cannot allocate ${count} ports starting from ${startPort} in ${env} environment`);
      }
    }

    return ports;
  }

  /**
   * Random port allocation within range
   */
  randomAllocation(count, env = 'development') {
    const envConfig = portManager.getEnvironmentConfig(env);
    const ports = [];
    const maxAttempts = 1000;

    for (let i = 0; i < count; i++) {
      let attempts = 0;
      let port;

      do {
        port = Math.floor(Math.random() * (envConfig.range.end - envConfig.range.start + 1)) + envConfig.range.start;
        attempts++;
      } while (
        attempts < maxAttempts &&
        (!portManager.isPortAvailable(port) || portManager.isPortReserved(port) || ports.includes(port))
      );

      if (attempts >= maxAttempts) {
        throw new Error(`Failed to allocate random port after ${maxAttempts} attempts`);
      }

      ports.push(port);
    }

    return ports;
  }

  /**
   * Service-based allocation (groups services by type)
   */
  serviceBasedAllocation(services, env = 'development') {
    const envConfig = portManager.getEnvironmentConfig(env);
    const serviceGroups = {
      core: ['api', 'database', 'redis'],
      tools: ['mailhog_smtp', 'mailhog_web', 'docs'],
      monitoring: ['monitoring', 'grafana', 'prometheus', 'jaeger'],
      testing: ['test_runner', 'mock_server', 'load_tester']
    };

    const allocations = {};
    let currentPort = envConfig.range.start;

    for (const [groupName, groupServices] of Object.entries(serviceGroups)) {
      const groupOffset = {
        core: 0,
        tools: 100,
        monitoring: 200,
        testing: 400
      }[groupName] || 500;

      currentPort = envConfig.range.start + groupOffset;

      for (const service of services.filter(s => groupServices.includes(s))) {
        while (currentPort <= envConfig.range.end) {
          if (portManager.isPortAvailable(currentPort) && !portManager.isPortReserved(currentPort)) {
            allocations[service] = currentPort;
            currentPort++;
            break;
          }
          currentPort++;
        }
      }
    }

    return allocations;
  }

  /**
   * Load-balanced allocation (distributes ports evenly)
   */
  loadBalancedAllocation(services, env = 'development') {
    const envConfig = portManager.getEnvironmentConfig(env);
    const totalRange = envConfig.range.end - envConfig.range.start + 1;
    const step = Math.floor(totalRange / services.length);
    
    const allocations = {};
    
    for (let i = 0; i < services.length; i++) {
      const targetPort = envConfig.range.start + (i * step);
      let port = targetPort;

      // Find nearest available port
      while (port <= envConfig.range.end) {
        if (portManager.isPortAvailable(port) && !portManager.isPortReserved(port)) {
          allocations[services[i]] = port;
          break;
        }
        port++;
      }

      if (port > envConfig.range.end) {
        // Try going backwards from target
        port = targetPort - 1;
        while (port >= envConfig.range.start) {
          if (portManager.isPortAvailable(port) && !portManager.isPortReserved(port)) {
            allocations[services[i]] = port;
            break;
          }
          port--;
        }
      }
    }

    return allocations;
  }

  /**
   * Allocate ports using specified strategy
   */
  allocatePorts(strategy, ...args) {
    const strategyFn = this.allocationStrategies.get(strategy);
    if (!strategyFn) {
      throw new Error(`Unknown allocation strategy: ${strategy}`);
    }

    return strategyFn(...args);
  }
}

/**
 * Docker Compose Integration Utilities
 */
export class DockerComposeIntegrator {
  constructor() {
    this.templatePath = path.join(__dirname, '../docker-compose.template.yml');
    this.outputPath = path.join(__dirname, '../docker-compose.yml');
  }

  /**
   * Generate Docker Compose configuration with current ports
   */
  async generateDockerCompose(env = 'development') {
    const portMappings = portManager.generateDockerComposePorts(env);
    const envVars = portManager.generateEnvironmentVariables(env);

    const dockerComposeConfig = {
      version: '3.8',
      services: {},
      volumes: {
        postgres_data: { driver: 'local' },
        redis_data: { driver: 'local' }
      },
      networks: {
        'truxe-network': { driver: 'bridge' }
      },
      secrets: {
        jwt_private_key: { file: './secrets/jwt-private-key.pem' },
        jwt_public_key: { file: './secrets/jwt-public-key.pem' }
      }
    };

    // Generate service configurations
    for (const [serviceName, portConfig] of Object.entries(portMappings)) {
      if (serviceName.startsWith('reserved_')) continue;

      dockerComposeConfig.services[serviceName] = this.generateServiceConfig(
        serviceName, 
        portConfig, 
        env,
        envVars
      );
    }

    return dockerComposeConfig;
  }

  /**
   * Generate individual service configuration
   */
  generateServiceConfig(serviceName, portConfig, env, envVars) {
    const baseConfigs = {
      api: {
        build: { context: './api', dockerfile: 'Dockerfile' },
        container_name: `truxe-api-${env}`,
        environment: {
          NODE_ENV: env,
          PORT: portConfig.internal,
          DATABASE_URL: `postgresql://truxe.io_password_change_me@database:5432/truxe_${env}`,
          REDIS_URL: 'redis://:dev_redis_password@redis:6379',
          JWT_ISSUER: `truxe-${env}`,
          JWT_PRIVATE_KEY_FILE: '/run/secrets/jwt_private_key',
          JWT_PUBLIC_KEY_FILE: '/run/secrets/jwt_public_key'
        },
        depends_on: {
          database: { condition: 'service_healthy' },
          redis: { condition: 'service_healthy' }
        },
        secrets: ['jwt_private_key', 'jwt_public_key'],
        healthcheck: {
          test: [`CMD`, `curl`, `-f`, `http://localhost:${portConfig.internal}/health`],
          interval: '30s',
          timeout: '10s',
          retries: 3
        }
      },
      
      database: {
        build: { context: './database', dockerfile: 'Dockerfile' },
        container_name: `truxe-db-${env}`,
        environment: {
          POSTGRES_DB: `truxe_${env}`,
          POSTGRES_USER: 'truxe',
          POSTGRES_PASSWORD: 'dev_password_change_me',
          POSTGRES_HOST_AUTH_METHOD: 'md5'
        },
        volumes: [
          'postgres_data:/var/lib/postgresql/data',
          './database/migrations:/docker-entrypoint-initdb.d:ro'
        ],
        healthcheck: {
          test: ['CMD-SHELL', 'pg_isready -U truxe -d truxe.io'],
          interval: '10s',
          timeout: '5s',
          retries: 5
        }
      },
      
      redis: {
        image: 'redis:7-alpine',
        container_name: `truxe-redis-${env}`,
        volumes: ['redis_data:/data'],
        command: 'redis-server --appendonly yes --requirepass dev_redis_password',
        healthcheck: {
          test: ['CMD', 'redis-cli', 'ping'],
          interval: '10s',
          timeout: '3s',
          retries: 3
        }
      }
    };

    const config = baseConfigs[serviceName] || {
      image: `truxe-${serviceName}:latest`,
      container_name: `truxe-${serviceName}-${env}`
    };

    // Add common properties
    config.ports = [`${portConfig.external}:${portConfig.internal}`];
    config.networks = ['truxe-network'];
    config.restart = 'unless-stopped';

    return config;
  }

  /**
   * Write Docker Compose file
   */
  async writeDockerCompose(config, outputPath = this.outputPath) {
    const yaml = this.convertToYaml(config);
    await fs.writeFile(outputPath, yaml, 'utf8');
    return outputPath;
  }

  /**
   * Convert configuration object to YAML format
   */
  convertToYaml(obj, indent = 0) {
    const spaces = '  '.repeat(indent);
    let yaml = '';

    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) {
        yaml += `${spaces}${key}: null\n`;
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        yaml += `${spaces}${key}:\n`;
        yaml += this.convertToYaml(value, indent + 1);
      } else if (Array.isArray(value)) {
        yaml += `${spaces}${key}:\n`;
        for (const item of value) {
          if (typeof item === 'object') {
            yaml += `${spaces}  -\n`;
            yaml += this.convertToYaml(item, indent + 2);
          } else {
            yaml += `${spaces}  - ${item}\n`;
          }
        }
      } else {
        yaml += `${spaces}${key}: ${value}\n`;
      }
    }

    return yaml;
  }
}

// Export utility instances
export const portValidator = new PortValidator();
export const conflictDetector = new ConflictDetector();
export const portAllocator = new PortAllocator();
export const dockerIntegrator = new DockerComposeIntegrator();

// Export utility functions
export const utils = {
  /**
   * Quick port availability check
   */
  isPortFree: (port) => portManager.isPortAvailable(port),
  
  /**
   * Get next available port in range
   */
  getNextAvailablePort: (startPort, env = 'development') => {
    const envConfig = portManager.getEnvironmentConfig(env);
    let port = startPort;
    
    while (port <= envConfig.range.end) {
      if (portManager.isPortAvailable(port) && !portManager.isPortReserved(port)) {
        return port;
      }
      port++;
    }
    
    throw new Error(`No available ports found starting from ${startPort} in ${env} environment`);
  },
  
  /**
   * Batch port availability check
   */
  checkPortsBatch: async (ports) => {
    const results = {};
    for (const port of ports) {
      results[port] = portManager.isPortAvailable(port);
    }
    return results;
  },
  
  /**
   * Generate port report
   */
  generatePortReport: (env = 'development') => {
    const status = portManager.getSystemStatus(env);
    const validation = portValidator.validateEnvironment(env);
    
    return {
      ...status,
      validation_details: validation,
      recommendations: utils.generateRecommendations(status, validation)
    };
  },
  
  /**
   * Generate recommendations based on status and validation
   */
  generateRecommendations: (status, validation) => {
    const recommendations = [];
    
    if (status.conflicts.length > 0) {
      recommendations.push({
        type: 'conflict_resolution',
        priority: 'high',
        message: `Resolve ${status.conflicts.length} port conflicts before starting services`
      });
    }
    
    if (status.port_utilization > 80) {
      recommendations.push({
        type: 'capacity_planning',
        priority: 'medium',
        message: `Port utilization is ${status.port_utilization}%. Consider expanding port range.`
      });
    }
    
    if (validation.summary.invalid_ports > 0) {
      recommendations.push({
        type: 'configuration_fix',
        priority: 'high',
        message: `Fix ${validation.summary.invalid_ports} invalid port configurations`
      });
    }
    
    return recommendations;
  }
};
