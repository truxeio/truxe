/**
 * Truxe Comprehensive Error Messaging System
 * 
 * Advanced error messaging system that provides developers with clear, actionable guidance
 * for resolving port-related issues. Features context-aware error detection, automated
 * troubleshooting, and intelligent resolution suggestions.
 * 
 * @author DevOps Engineering Team
 * @version 4.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import EventEmitter from 'events';
import chalk from 'chalk';
import inquirer from 'inquirer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Error Severity Levels
 */
export const ErrorSeverity = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical',
  FATAL: 'fatal'
};

/**
 * Error Categories for Port Management
 */
export const ErrorCategory = {
  PORT_CONFLICT: 'port_conflict',
  CONFIGURATION: 'configuration',
  NETWORK: 'network',
  PERMISSION: 'permission',
  RESOURCE: 'resource',
  VALIDATION: 'validation',
  STARTUP: 'startup',
  RUNTIME: 'runtime'
};

/**
 * Resolution Action Types
 */
export const ResolutionActionType = {
  COMMAND: 'command',
  CONFIG_CHANGE: 'config_change',
  RESTART_SERVICE: 'restart_service',
  KILL_PROCESS: 'kill_process',
  MODIFY_ENVIRONMENT: 'modify_environment',
  INSTALL_DEPENDENCY: 'install_dependency',
  CHECK_DOCUMENTATION: 'check_documentation',
  CONTACT_SUPPORT: 'contact_support'
};

/**
 * Context-Aware Error Detection Engine
 */
export class ContextAwareErrorDetector extends EventEmitter {
  constructor() {
    super();
    this.contextProviders = new Map();
    this.errorPatterns = new Map();
    this.setupContextProviders();
    this.setupErrorPatterns();
  }

  /**
   * Setup context providers for different environments
   */
  setupContextProviders() {
    this.contextProviders.set('system', this.getSystemContext.bind(this));
    this.contextProviders.set('docker', this.getDockerContext.bind(this));
    this.contextProviders.set('process', this.getProcessContext.bind(this));
    this.contextProviders.set('network', this.getNetworkContext.bind(this));
    this.contextProviders.set('environment', this.getEnvironmentContext.bind(this));
    this.contextProviders.set('configuration', this.getConfigurationContext.bind(this));
  }

  /**
   * Setup error patterns for intelligent detection
   */
  setupErrorPatterns() {
    // Port conflict patterns
    this.errorPatterns.set(/EADDRINUSE.*:(\d+)/, {
      category: ErrorCategory.PORT_CONFLICT,
      severity: ErrorSeverity.ERROR,
      extractor: (match) => ({ port: parseInt(match[1]) })
    });

    this.errorPatterns.set(/listen EADDRINUSE.*:(\d+)/, {
      category: ErrorCategory.PORT_CONFLICT,
      severity: ErrorSeverity.ERROR,
      extractor: (match) => ({ port: parseInt(match[1]) })
    });

    this.errorPatterns.set(/Port (\d+) is already in use/, {
      category: ErrorCategory.PORT_CONFLICT,
      severity: ErrorSeverity.ERROR,
      extractor: (match) => ({ port: parseInt(match[1]) })
    });

    // Permission patterns
    this.errorPatterns.set(/EACCES.*permission denied/, {
      category: ErrorCategory.PERMISSION,
      severity: ErrorSeverity.ERROR,
      extractor: () => ({})
    });

    this.errorPatterns.set(/bind: permission denied/, {
      category: ErrorCategory.PERMISSION,
      severity: ErrorSeverity.ERROR,
      extractor: () => ({})
    });

    // Network patterns
    this.errorPatterns.set(/ENOTFOUND|ECONNREFUSED/, {
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.ERROR,
      extractor: () => ({})
    });

    // Configuration patterns
    this.errorPatterns.set(/Invalid configuration|Config error/, {
      category: ErrorCategory.CONFIGURATION,
      severity: ErrorSeverity.ERROR,
      extractor: () => ({})
    });

    // Resource patterns
    this.errorPatterns.set(/EMFILE|ENFILE|too many open files/, {
      category: ErrorCategory.RESOURCE,
      severity: ErrorSeverity.CRITICAL,
      extractor: () => ({})
    });
  }

  /**
   * Analyze error with full context
   */
  async analyzeError(error, additionalContext = {}) {
    const analysis = {
      timestamp: new Date().toISOString(),
      original_error: {
        message: error.message || error,
        stack: error.stack,
        code: error.code,
        errno: error.errno
      },
      detected_patterns: [],
      context: {},
      severity: ErrorSeverity.ERROR,
      category: ErrorCategory.RUNTIME,
      confidence: 0,
      suggestions: []
    };

    // Pattern matching
    const errorText = error.message || error.toString();
    for (const [pattern, config] of this.errorPatterns) {
      const match = errorText.match(pattern);
      if (match) {
        analysis.detected_patterns.push({
          pattern: pattern.toString(),
          match: match[0],
          extracted_data: config.extractor(match),
          category: config.category,
          severity: config.severity
        });
        
        // Update analysis with highest severity and most specific category
        if (this.getSeverityWeight(config.severity) > this.getSeverityWeight(analysis.severity)) {
          analysis.severity = config.severity;
        }
        analysis.category = config.category;
        analysis.confidence = Math.max(analysis.confidence, 0.8);
      }
    }

    // Gather context from all providers
    for (const [name, provider] of this.contextProviders) {
      try {
        analysis.context[name] = await provider(error, additionalContext);
      } catch (contextError) {
        analysis.context[name] = { error: contextError.message };
      }
    }

    // Generate intelligent suggestions based on patterns and context
    analysis.suggestions = await this.generateIntelligentSuggestions(analysis);

    this.emit('error_analyzed', analysis);
    return analysis;
  }

  /**
   * Get system context
   */
  async getSystemContext(error, additionalContext) {
    const context = {
      platform: process.platform,
      node_version: process.version,
      arch: process.arch,
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      cwd: process.cwd(),
      env_vars: {
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.PORT,
        TRUXE_ENV: process.env.TRUXE_ENV
      }
    };

    // Get system load if available
    try {
      if (process.platform !== 'win32') {
        const loadavg = require('os').loadavg();
        context.load_average = loadavg;
      }
    } catch (e) {
      // Ignore if not available
    }

    return context;
  }

  /**
   * Get Docker context
   */
  async getDockerContext(error, additionalContext) {
    const context = {
      docker_available: false,
      containers: [],
      networks: [],
      volumes: []
    };

    try {
      // Check if Docker is available
      execSync('docker --version', { stdio: 'pipe' });
      context.docker_available = true;

      // Get running containers
      const containersOutput = execSync('docker ps --format "{{.Names}}:{{.Ports}}"', { 
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      context.containers = containersOutput.trim().split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [name, ports] = line.split(':');
          return { name, ports };
        });

      // Get Docker networks
      const networksOutput = execSync('docker network ls --format "{{.Name}}"', {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      context.networks = networksOutput.trim().split('\n').filter(line => line.trim());

    } catch (dockerError) {
      context.docker_error = dockerError.message;
    }

    return context;
  }

  /**
   * Get process context
   */
  async getProcessContext(error, additionalContext) {
    const context = {
      pid: process.pid,
      ppid: process.ppid,
      title: process.title,
      argv: process.argv,
      running_processes: []
    };

    try {
      // Get running processes on common ports
      const commonPorts = [3000, 3001, 8000, 8080, 9000, 5000, 4000];
      
      for (const port of commonPorts) {
        try {
          let command;
          if (process.platform === 'win32') {
            command = `netstat -ano | findstr :${port}`;
          } else {
            command = `lsof -ti:${port}`;
          }
          
          const output = execSync(command, { 
            encoding: 'utf8',
            stdio: 'pipe',
            timeout: 3000
          });
          
          if (output.trim()) {
            context.running_processes.push({
              port,
              output: output.trim()
            });
          }
        } catch (e) {
          // Port not in use, which is fine
        }
      }
    } catch (processError) {
      context.process_error = processError.message;
    }

    return context;
  }

  /**
   * Get network context
   */
  async getNetworkContext(error, additionalContext) {
    const context = {
      interfaces: {},
      listening_ports: [],
      network_config: {}
    };

    try {
      const os = require('os');
      context.interfaces = os.networkInterfaces();

      // Get listening ports
      if (process.platform !== 'win32') {
        const netstatOutput = execSync('netstat -tuln', {
          encoding: 'utf8',
          stdio: 'pipe',
          timeout: 5000
        });
        
        context.listening_ports = netstatOutput.split('\n')
          .filter(line => line.includes('LISTEN'))
          .map(line => {
            const parts = line.split(/\s+/);
            return {
              protocol: parts[0],
              local_address: parts[3],
              state: parts[5]
            };
          });
      }
    } catch (networkError) {
      context.network_error = networkError.message;
    }

    return context;
  }

  /**
   * Get environment context
   */
  async getEnvironmentContext(error, additionalContext) {
    const context = {
      current_environment: process.env.NODE_ENV || 'development',
      truxe_env: process.env.TRUXE_ENV || 'development',
      config_files: [],
      package_info: {}
    };

    try {
      // Check for configuration files
      const configFiles = [
        'package.json',
        'docker-compose.yml',
        '.env',
        'config/ports.js',
        'config/environment-ports.env'
      ];

      for (const file of configFiles) {
        try {
          await fs.access(file);
          context.config_files.push(file);
        } catch (e) {
          // File doesn't exist
        }
      }

      // Get package.json info
      try {
        const packageJson = await fs.readFile('package.json', 'utf8');
        const packageData = JSON.parse(packageJson);
        context.package_info = {
          name: packageData.name,
          version: packageData.version,
          scripts: Object.keys(packageData.scripts || {}),
          dependencies: Object.keys(packageData.dependencies || {}),
          devDependencies: Object.keys(packageData.devDependencies || {})
        };
      } catch (e) {
        // No package.json or parsing error
      }
    } catch (envError) {
      context.environment_error = envError.message;
    }

    return context;
  }

  /**
   * Get configuration context
   */
  async getConfigurationContext(error, additionalContext) {
    const context = {
      port_config: {},
      environment_config: {},
      docker_config: {},
      validation_errors: []
    };

    try {
      // Try to load port configuration
      try {
        const { default: portManager } = await import('./ports.js');
        context.port_config = {
          current_environment: portManager.environment,
          available_environments: Object.keys(portManager.config.environments),
          validation_enabled: portManager.config.validation.validate_on_startup
        };
      } catch (e) {
        context.port_config_error = e.message;
      }

      // Check Docker Compose configuration
      try {
        const dockerComposeContent = await fs.readFile('docker-compose.yml', 'utf8');
        const portMatches = dockerComposeContent.match(/(\d+):\d+/g);
        if (portMatches) {
          context.docker_config.exposed_ports = portMatches.map(match => 
            parseInt(match.split(':')[0])
          );
        }
      } catch (e) {
        // No docker-compose.yml
      }

    } catch (configError) {
      context.configuration_error = configError.message;
    }

    return context;
  }

  /**
   * Generate intelligent suggestions based on analysis
   */
  async generateIntelligentSuggestions(analysis) {
    const suggestions = [];

    // Port conflict suggestions
    if (analysis.category === ErrorCategory.PORT_CONFLICT) {
      const portData = analysis.detected_patterns.find(p => p.extracted_data.port);
      if (portData) {
        const port = portData.extracted_data.port;
        
        suggestions.push({
          type: ResolutionActionType.COMMAND,
          priority: 'high',
          title: 'Check what process is using the port',
          description: `Identify the process currently using port ${port}`,
          commands: this.getPortCheckCommands(port),
          estimated_time: '30 seconds'
        });

        suggestions.push({
          type: ResolutionActionType.KILL_PROCESS,
          priority: 'medium',
          title: 'Stop the conflicting process',
          description: `Terminate the process using port ${port}`,
          commands: this.getProcessKillCommands(port),
          estimated_time: '1 minute',
          risk_level: 'medium'
        });

        suggestions.push({
          type: ResolutionActionType.CONFIG_CHANGE,
          priority: 'low',
          title: 'Use a different port',
          description: `Configure your service to use an alternative port`,
          commands: [`export PORT=${port + 1}`, `npm start`],
          estimated_time: '2 minutes',
          risk_level: 'low'
        });
      }
    }

    // Permission suggestions
    if (analysis.category === ErrorCategory.PERMISSION) {
      suggestions.push({
        type: ResolutionActionType.COMMAND,
        priority: 'high',
        title: 'Check port permissions',
        description: 'Verify if you have permission to bind to the port',
        commands: ['sudo netstat -tulpn | grep :80', 'sudo lsof -i :80'],
        estimated_time: '30 seconds'
      });

      suggestions.push({
        type: ResolutionActionType.CONFIG_CHANGE,
        priority: 'medium',
        title: 'Use a non-privileged port',
        description: 'Use a port above 1024 which doesn\'t require root privileges',
        commands: ['export PORT=3000', 'npm start'],
        estimated_time: '1 minute',
        risk_level: 'low'
      });
    }

    // Network suggestions
    if (analysis.category === ErrorCategory.NETWORK) {
      suggestions.push({
        type: ResolutionActionType.COMMAND,
        priority: 'high',
        title: 'Check network connectivity',
        description: 'Verify network interfaces and connectivity',
        commands: ['ping -c 3 localhost', 'netstat -i', 'ip addr show'],
        estimated_time: '1 minute'
      });
    }

    // Configuration suggestions
    if (analysis.category === ErrorCategory.CONFIGURATION) {
      suggestions.push({
        type: ResolutionActionType.CONFIG_CHANGE,
        priority: 'high',
        title: 'Validate configuration files',
        description: 'Check and fix configuration file syntax and values',
        commands: ['npm run config:validate', 'npm run port:check'],
        estimated_time: '2 minutes'
      });
    }

    // Resource suggestions
    if (analysis.category === ErrorCategory.RESOURCE) {
      suggestions.push({
        type: ResolutionActionType.COMMAND,
        priority: 'critical',
        title: 'Check system resources',
        description: 'Monitor system resource usage and limits',
        commands: ['ulimit -n', 'lsof | wc -l', 'free -h', 'df -h'],
        estimated_time: '1 minute'
      });

      suggestions.push({
        type: ResolutionActionType.RESTART_SERVICE,
        priority: 'medium',
        title: 'Restart system services',
        description: 'Restart services to free up resources',
        commands: ['sudo systemctl restart docker', 'sudo systemctl restart networking'],
        estimated_time: '3 minutes',
        risk_level: 'medium'
      });
    }

    // Add context-specific suggestions
    if (analysis.context.docker?.docker_available && analysis.context.docker.containers.length > 0) {
      suggestions.push({
        type: ResolutionActionType.COMMAND,
        priority: 'medium',
        title: 'Check Docker containers',
        description: 'Review running Docker containers that might be using ports',
        commands: ['docker ps', 'docker port $(docker ps -q)'],
        estimated_time: '30 seconds'
      });
    }

    // Add documentation suggestions
    suggestions.push({
      type: ResolutionActionType.CHECK_DOCUMENTATION,
      priority: 'low',
      title: 'Check documentation',
      description: 'Review port management documentation for detailed guidance',
      links: [
        'docs/05-guides/port-management-guide.md',
        'docs/05-guides/troubleshooting.md',
        'PORT-MANAGEMENT-README.md'
      ],
      estimated_time: '5 minutes'
    });

    return suggestions.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Get port check commands for different platforms
   */
  getPortCheckCommands(port) {
    if (process.platform === 'win32') {
      return [
        `netstat -ano | findstr :${port}`,
        `tasklist /FI "PID eq <PID_FROM_NETSTAT>"`
      ];
    } else {
      return [
        `lsof -ti:${port}`,
        `ps -p $(lsof -ti:${port})`,
        `netstat -tulpn | grep :${port}`
      ];
    }
  }

  /**
   * Get process kill commands for different platforms
   */
  getProcessKillCommands(port) {
    if (process.platform === 'win32') {
      return [
        `for /f "tokens=5" %a in ('netstat -ano ^| findstr :${port}') do taskkill /PID %a /F`
      ];
    } else {
      return [
        `kill -15 $(lsof -ti:${port})`,  // Graceful
        `kill -9 $(lsof -ti:${port})`    // Force (if graceful fails)
      ];
    }
  }

  /**
   * Get severity weight for comparison
   */
  getSeverityWeight(severity) {
    const weights = {
      [ErrorSeverity.INFO]: 1,
      [ErrorSeverity.WARNING]: 2,
      [ErrorSeverity.ERROR]: 3,
      [ErrorSeverity.CRITICAL]: 4,
      [ErrorSeverity.FATAL]: 5
    };
    return weights[severity] || 3;
  }
}

/**
 * Enhanced Error Message Formatter
 */
export class EnhancedErrorMessageFormatter {
  constructor() {
    this.templates = new Map();
    this.setupMessageTemplates();
  }

  /**
   * Setup message templates for different error types
   */
  setupMessageTemplates() {
    this.templates.set(ErrorCategory.PORT_CONFLICT, {
      icon: '🚫',
      title: 'Port Conflict Detected',
      color: 'red',
      format: (analysis) => {
        const portData = analysis.detected_patterns.find(p => p.extracted_data.port);
        const port = portData?.extracted_data.port || 'unknown';
        return `Port ${port} is already in use by another process`;
      }
    });

    this.templates.set(ErrorCategory.PERMISSION, {
      icon: '🔒',
      title: 'Permission Denied',
      color: 'yellow',
      format: (analysis) => 'Insufficient permissions to bind to the requested port'
    });

    this.templates.set(ErrorCategory.NETWORK, {
      icon: '🌐',
      title: 'Network Error',
      color: 'blue',
      format: (analysis) => 'Network connectivity or configuration issue detected'
    });

    this.templates.set(ErrorCategory.CONFIGURATION, {
      icon: '⚙️',
      title: 'Configuration Error',
      color: 'magenta',
      format: (analysis) => 'Invalid or missing configuration detected'
    });

    this.templates.set(ErrorCategory.RESOURCE, {
      icon: '💾',
      title: 'Resource Limitation',
      color: 'red',
      format: (analysis) => 'System resource limits exceeded'
    });

    this.templates.set(ErrorCategory.VALIDATION, {
      icon: '✅',
      title: 'Validation Error',
      color: 'yellow',
      format: (analysis) => 'Configuration validation failed'
    });

    this.templates.set(ErrorCategory.STARTUP, {
      icon: '🚀',
      title: 'Startup Error',
      color: 'red',
      format: (analysis) => 'Service failed to start properly'
    });

    this.templates.set(ErrorCategory.RUNTIME, {
      icon: '⚡',
      title: 'Runtime Error',
      color: 'red',
      format: (analysis) => 'Unexpected runtime error occurred'
    });
  }

  /**
   * Format error message with rich context
   */
  formatError(analysis, options = {}) {
    const {
      includeContext = true,
      includeSuggestions = true,
      includeCommands = true,
      colorize = true,
      format = 'console' // console, json, markdown
    } = options;

    const template = this.templates.get(analysis.category) || this.templates.get(ErrorCategory.RUNTIME);
    
    if (format === 'json') {
      return this.formatAsJSON(analysis, template);
    } else if (format === 'markdown') {
      return this.formatAsMarkdown(analysis, template);
    } else {
      return this.formatAsConsole(analysis, template, {
        includeContext,
        includeSuggestions,
        includeCommands,
        colorize
      });
    }
  }

  /**
   * Format as console output
   */
  formatAsConsole(analysis, template, options) {
    const { includeContext, includeSuggestions, includeCommands, colorize } = options;
    let output = [];

    // Header
    const headerColor = colorize ? chalk[template.color] : (text) => text;
    const errorColor = colorize ? chalk.red : (text) => text;
    const warningColor = colorize ? chalk.yellow : (text) => text;
    const infoColor = colorize ? chalk.blue : (text) => text;
    const successColor = colorize ? chalk.green : (text) => text;

    output.push('');
    output.push(headerColor(`${template.icon} ${template.title}`));
    output.push(headerColor('═'.repeat(50)));
    output.push('');

    // Main error message
    output.push(errorColor('Error: ') + template.format(analysis));
    output.push('');

    // Original error details
    if (analysis.original_error.message) {
      output.push(infoColor('Original Error:'));
      output.push(`  ${analysis.original_error.message}`);
      if (analysis.original_error.code) {
        output.push(`  Code: ${analysis.original_error.code}`);
      }
      output.push('');
    }

    // Detected patterns
    if (analysis.detected_patterns.length > 0) {
      output.push(infoColor('Detected Issues:'));
      analysis.detected_patterns.forEach((pattern, index) => {
        output.push(`  ${index + 1}. ${pattern.match}`);
        if (pattern.extracted_data && Object.keys(pattern.extracted_data).length > 0) {
          Object.entries(pattern.extracted_data).forEach(([key, value]) => {
            output.push(`     ${key}: ${value}`);
          });
        }
      });
      output.push('');
    }

    // Context information
    if (includeContext && Object.keys(analysis.context).length > 0) {
      output.push(infoColor('Context Information:'));
      
      // System context
      if (analysis.context.system) {
        output.push(`  Platform: ${analysis.context.system.platform}`);
        output.push(`  Node.js: ${analysis.context.system.node_version}`);
        output.push(`  Environment: ${analysis.context.system.env_vars.NODE_ENV || 'not set'}`);
      }

      // Process context
      if (analysis.context.process?.running_processes?.length > 0) {
        output.push(`  Active Processes on Common Ports: ${analysis.context.process.running_processes.length}`);
      }

      // Docker context
      if (analysis.context.docker?.docker_available) {
        output.push(`  Docker: Available (${analysis.context.docker.containers.length} containers running)`);
      }

      output.push('');
    }

    // Resolution suggestions
    if (includeSuggestions && analysis.suggestions.length > 0) {
      output.push(successColor('💡 Suggested Solutions:'));
      output.push('');

      analysis.suggestions.forEach((suggestion, index) => {
        const priorityColor = {
          critical: errorColor,
          high: warningColor,
          medium: infoColor,
          low: (text) => text
        }[suggestion.priority] || ((text) => text);

        output.push(priorityColor(`${index + 1}. ${suggestion.title}`));
        output.push(`   ${suggestion.description}`);
        
        if (suggestion.estimated_time) {
          output.push(`   ⏱️  Estimated time: ${suggestion.estimated_time}`);
        }
        
        if (suggestion.risk_level) {
          const riskColor = {
            low: successColor,
            medium: warningColor,
            high: errorColor
          }[suggestion.risk_level] || ((text) => text);
          output.push(`   ⚠️  Risk level: ${riskColor(suggestion.risk_level)}`);
        }

        if (includeCommands && suggestion.commands && suggestion.commands.length > 0) {
          output.push('   Commands:');
          suggestion.commands.forEach(cmd => {
            output.push(`     ${colorize ? chalk.cyan('$') : '$'} ${cmd}`);
          });
        }

        if (suggestion.links && suggestion.links.length > 0) {
          output.push('   Documentation:');
          suggestion.links.forEach(link => {
            output.push(`     📖 ${link}`);
          });
        }

        output.push('');
      });
    }

    // Footer with additional help
    output.push(infoColor('Need more help?'));
    output.push('  📚 Documentation: docs/05-guides/port-management-guide.md');
    output.push('  🔧 Run diagnostics: npm run port:diagnose');
    output.push('  🆘 Get support: npm run support');
    output.push('');

    return output.join('\n');
  }

  /**
   * Format as JSON
   */
  formatAsJSON(analysis, template) {
    return JSON.stringify({
      error: {
        category: analysis.category,
        severity: analysis.severity,
        title: template.title,
        message: template.format(analysis),
        timestamp: analysis.timestamp,
        confidence: analysis.confidence
      },
      original_error: analysis.original_error,
      detected_patterns: analysis.detected_patterns,
      context: analysis.context,
      suggestions: analysis.suggestions
    }, null, 2);
  }

  /**
   * Format as Markdown
   */
  formatAsMarkdown(analysis, template) {
    let output = [];

    // Header
    output.push(`# ${template.icon} ${template.title}`);
    output.push('');

    // Error details
    output.push('## Error Details');
    output.push('');
    output.push(`**Message:** ${template.format(analysis)}`);
    output.push(`**Category:** ${analysis.category}`);
    output.push(`**Severity:** ${analysis.severity}`);
    output.push(`**Timestamp:** ${analysis.timestamp}`);
    output.push(`**Confidence:** ${Math.round(analysis.confidence * 100)}%`);
    output.push('');

    // Original error
    if (analysis.original_error.message) {
      output.push('## Original Error');
      output.push('');
      output.push('```');
      output.push(analysis.original_error.message);
      if (analysis.original_error.stack) {
        output.push('');
        output.push(analysis.original_error.stack);
      }
      output.push('```');
      output.push('');
    }

    // Detected patterns
    if (analysis.detected_patterns.length > 0) {
      output.push('## Detected Patterns');
      output.push('');
      analysis.detected_patterns.forEach((pattern, index) => {
        output.push(`${index + 1}. **${pattern.match}**`);
        output.push(`   - Category: ${pattern.category}`);
        output.push(`   - Severity: ${pattern.severity}`);
        if (Object.keys(pattern.extracted_data).length > 0) {
          output.push('   - Extracted data:');
          Object.entries(pattern.extracted_data).forEach(([key, value]) => {
            output.push(`     - ${key}: ${value}`);
          });
        }
        output.push('');
      });
    }

    // Context
    if (Object.keys(analysis.context).length > 0) {
      output.push('## Context Information');
      output.push('');
      output.push('```json');
      output.push(JSON.stringify(analysis.context, null, 2));
      output.push('```');
      output.push('');
    }

    // Suggestions
    if (analysis.suggestions.length > 0) {
      output.push('## 💡 Suggested Solutions');
      output.push('');
      analysis.suggestions.forEach((suggestion, index) => {
        output.push(`### ${index + 1}. ${suggestion.title}`);
        output.push('');
        output.push(suggestion.description);
        output.push('');
        
        if (suggestion.estimated_time) {
          output.push(`**⏱️ Estimated time:** ${suggestion.estimated_time}`);
        }
        
        if (suggestion.risk_level) {
          output.push(`**⚠️ Risk level:** ${suggestion.risk_level}`);
        }

        if (suggestion.commands && suggestion.commands.length > 0) {
          output.push('');
          output.push('**Commands:**');
          output.push('```bash');
          suggestion.commands.forEach(cmd => output.push(cmd));
          output.push('```');
        }

        if (suggestion.links && suggestion.links.length > 0) {
          output.push('');
          output.push('**Documentation:**');
          suggestion.links.forEach(link => {
            output.push(`- [${link}](${link})`);
          });
        }

        output.push('');
      });
    }

    return output.join('\n');
  }
}

/**
 * Automated Troubleshooting Engine
 */
export class AutomatedTroubleshootingEngine extends EventEmitter {
  constructor() {
    super();
    this.troubleshooters = new Map();
    this.setupTroubleshooters();
  }

  /**
   * Setup automated troubleshooters
   */
  setupTroubleshooters() {
    this.troubleshooters.set(ErrorCategory.PORT_CONFLICT, this.troubleshootPortConflict.bind(this));
    this.troubleshooters.set(ErrorCategory.PERMISSION, this.troubleshootPermission.bind(this));
    this.troubleshooters.set(ErrorCategory.NETWORK, this.troubleshootNetwork.bind(this));
    this.troubleshooters.set(ErrorCategory.CONFIGURATION, this.troubleshootConfiguration.bind(this));
    this.troubleshooters.set(ErrorCategory.RESOURCE, this.troubleshootResource.bind(this));
  }

  /**
   * Run automated troubleshooting
   */
  async runTroubleshooting(analysis, options = {}) {
    const {
      autoFix = false,
      interactive = true,
      timeout = 30000
    } = options;

    const troubleshootingResult = {
      timestamp: new Date().toISOString(),
      category: analysis.category,
      auto_fix: autoFix,
      interactive,
      steps_executed: [],
      fixes_applied: [],
      remaining_issues: [],
      success: false
    };

    const troubleshooter = this.troubleshooters.get(analysis.category);
    if (!troubleshooter) {
      troubleshootingResult.error = `No troubleshooter available for category: ${analysis.category}`;
      return troubleshootingResult;
    }

    try {
      const result = await Promise.race([
        troubleshooter(analysis, { autoFix, interactive }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Troubleshooting timeout')), timeout)
        )
      ]);

      Object.assign(troubleshootingResult, result);
      troubleshootingResult.success = result.success || false;

    } catch (error) {
      troubleshootingResult.error = error.message;
      troubleshootingResult.success = false;
    }

    this.emit('troubleshooting_completed', troubleshootingResult);
    return troubleshootingResult;
  }

  /**
   * Troubleshoot port conflicts
   */
  async troubleshootPortConflict(analysis, options) {
    const result = {
      steps_executed: [],
      fixes_applied: [],
      remaining_issues: [],
      success: false
    };

    const portData = analysis.detected_patterns.find(p => p.extracted_data.port);
    if (!portData) {
      result.remaining_issues.push('Could not identify specific port from error');
      return result;
    }

    const port = portData.extracted_data.port;

    // Step 1: Identify process using the port
    result.steps_executed.push({
      step: 'identify_process',
      description: `Identifying process using port ${port}`,
      timestamp: new Date().toISOString()
    });

    try {
      let processInfo = null;
      
      if (process.platform === 'win32') {
        const netstatOutput = execSync(`netstat -ano | findstr :${port}`, { 
          encoding: 'utf8',
          timeout: 5000
        });
        
        if (netstatOutput.trim()) {
          const lines = netstatOutput.trim().split('\n');
          const parts = lines[0].trim().split(/\s+/);
          const pid = parts[4];
          
          const tasklistOutput = execSync(`tasklist /FI "PID eq ${pid}" /NH /FO CSV`, {
            encoding: 'utf8',
            timeout: 3000
          });
          
          const nameMatch = tasklistOutput.match(/"([^"]+)"/);
          processInfo = {
            pid: parseInt(pid),
            name: nameMatch ? nameMatch[1] : 'unknown',
            platform: 'win32'
          };
        }
      } else {
        const lsofOutput = execSync(`lsof -ti:${port}`, { 
          encoding: 'utf8',
          timeout: 5000
        });
        
        if (lsofOutput.trim()) {
          const pid = parseInt(lsofOutput.trim().split('\n')[0]);
          const psOutput = execSync(`ps -p ${pid} -o comm=`, {
            encoding: 'utf8',
            timeout: 3000
          });
          
          processInfo = {
            pid,
            name: psOutput.trim(),
            platform: process.platform
          };
        }
      }

      if (processInfo) {
        result.steps_executed.push({
          step: 'process_identified',
          description: `Found process: ${processInfo.name} (PID: ${processInfo.pid})`,
          data: processInfo
        });

        // Step 2: Assess if process can be safely terminated
        const safeToKill = this.assessProcessSafety(processInfo);
        
        result.steps_executed.push({
          step: 'safety_assessment',
          description: `Process safety assessment: ${safeToKill ? 'safe' : 'risky'}`,
          data: { safe_to_kill: safeToKill }
        });

        // Step 3: Attempt resolution
        if (options.autoFix && safeToKill) {
          try {
            // Try graceful termination first
            if (process.platform === 'win32') {
              execSync(`taskkill /PID ${processInfo.pid}`, { timeout: 5000 });
            } else {
              execSync(`kill -15 ${processInfo.pid}`, { timeout: 5000 });
            }

            // Wait and check if process is gone
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const stillRunning = await this.checkProcessRunning(processInfo.pid);
            if (!stillRunning) {
              result.fixes_applied.push({
                fix: 'graceful_termination',
                description: `Successfully terminated process ${processInfo.name} (PID: ${processInfo.pid})`,
                success: true
              });
              result.success = true;
            } else {
              // Try force kill
              if (process.platform === 'win32') {
                execSync(`taskkill /PID ${processInfo.pid} /F`, { timeout: 5000 });
              } else {
                execSync(`kill -9 ${processInfo.pid}`, { timeout: 5000 });
              }
              
              result.fixes_applied.push({
                fix: 'force_termination',
                description: `Force terminated process ${processInfo.name} (PID: ${processInfo.pid})`,
                success: true
              });
              result.success = true;
            }
          } catch (killError) {
            result.remaining_issues.push({
              issue: 'termination_failed',
              description: `Failed to terminate process: ${killError.message}`,
              suggestion: 'Manual intervention required'
            });
          }
        } else if (options.interactive) {
          // Ask user for permission
          const shouldKill = await this.askUserPermission(
            `Process ${processInfo.name} (PID: ${processInfo.pid}) is using port ${port}. Terminate it?`,
            safeToKill
          );
          
          if (shouldKill) {
            // Same termination logic as auto-fix
            // ... (implementation similar to above)
          }
        } else {
          result.remaining_issues.push({
            issue: 'manual_intervention_required',
            description: `Process ${processInfo.name} (PID: ${processInfo.pid}) needs to be terminated manually`,
            suggestion: `Run: kill -15 ${processInfo.pid} (or kill -9 ${processInfo.pid} if needed)`
          });
        }
      } else {
        result.remaining_issues.push({
          issue: 'process_not_found',
          description: `No process found using port ${port}, but port appears to be in use`,
          suggestion: 'Check for system services or try a different port'
        });
      }
    } catch (error) {
      result.remaining_issues.push({
        issue: 'identification_failed',
        description: `Failed to identify process using port ${port}: ${error.message}`,
        suggestion: 'Try manual port checking or use a different port'
      });
    }

    return result;
  }

  /**
   * Troubleshoot permission issues
   */
  async troubleshootPermission(analysis, options) {
    const result = {
      steps_executed: [],
      fixes_applied: [],
      remaining_issues: [],
      success: false
    };

    // Check if trying to bind to privileged port
    const portData = analysis.detected_patterns.find(p => p.extracted_data.port);
    const port = portData?.extracted_data.port;

    if (port && port < 1024) {
      result.steps_executed.push({
        step: 'privileged_port_detected',
        description: `Port ${port} is a privileged port (< 1024)`,
        data: { port, privileged: true }
      });

      if (options.autoFix) {
        // Suggest using a non-privileged port
        const alternativePort = port + 3000; // Common pattern
        
        result.fixes_applied.push({
          fix: 'suggest_alternative_port',
          description: `Suggested alternative port: ${alternativePort}`,
          data: { original_port: port, suggested_port: alternativePort },
          success: true
        });
        
        result.success = true;
      } else {
        result.remaining_issues.push({
          issue: 'privileged_port_access',
          description: `Port ${port} requires root/administrator privileges`,
          suggestion: `Use 'sudo' or run as administrator, or use port ${port + 3000} instead`
        });
      }
    } else {
      result.remaining_issues.push({
        issue: 'unknown_permission_issue',
        description: 'Permission denied for unknown reason',
        suggestion: 'Check file permissions and user privileges'
      });
    }

    return result;
  }

  /**
   * Troubleshoot network issues
   */
  async troubleshootNetwork(analysis, options) {
    const result = {
      steps_executed: [],
      fixes_applied: [],
      remaining_issues: [],
      success: false
    };

    // Check network connectivity
    result.steps_executed.push({
      step: 'network_connectivity_check',
      description: 'Checking network connectivity'
    });

    try {
      // Test localhost connectivity
      const net = require('net');
      const testConnection = () => {
        return new Promise((resolve) => {
          const socket = new net.Socket();
          socket.setTimeout(3000);
          
          socket.connect(80, 'localhost', () => {
            socket.destroy();
            resolve(true);
          });
          
          socket.on('error', () => {
            socket.destroy();
            resolve(false);
          });
          
          socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
          });
        });
      };

      const canConnect = await testConnection();
      
      if (canConnect) {
        result.steps_executed.push({
          step: 'connectivity_ok',
          description: 'Network connectivity appears normal'
        });
        result.success = true;
      } else {
        result.remaining_issues.push({
          issue: 'connectivity_problem',
          description: 'Network connectivity issues detected',
          suggestion: 'Check network interfaces and firewall settings'
        });
      }
    } catch (error) {
      result.remaining_issues.push({
        issue: 'network_test_failed',
        description: `Network test failed: ${error.message}`,
        suggestion: 'Manual network diagnostics required'
      });
    }

    return result;
  }

  /**
   * Troubleshoot configuration issues
   */
  async troubleshootConfiguration(analysis, options) {
    const result = {
      steps_executed: [],
      fixes_applied: [],
      remaining_issues: [],
      success: false
    };

    // Check for common configuration files
    const configFiles = [
      'package.json',
      'docker-compose.yml',
      '.env',
      'config/ports.js'
    ];

    for (const file of configFiles) {
      try {
        await fs.access(file);
        result.steps_executed.push({
          step: 'config_file_found',
          description: `Found configuration file: ${file}`
        });

        // Basic validation
        if (file.endsWith('.json')) {
          const content = await fs.readFile(file, 'utf8');
          JSON.parse(content); // Will throw if invalid JSON
          
          result.steps_executed.push({
            step: 'json_validation_passed',
            description: `${file} has valid JSON syntax`
          });
        }
      } catch (error) {
        if (error.code !== 'ENOENT') {
          result.remaining_issues.push({
            issue: 'config_file_invalid',
            description: `Configuration file ${file} has issues: ${error.message}`,
            suggestion: `Fix syntax errors in ${file}`
          });
        }
      }
    }

    if (result.remaining_issues.length === 0) {
      result.success = true;
    }

    return result;
  }

  /**
   * Troubleshoot resource issues
   */
  async troubleshootResource(analysis, options) {
    const result = {
      steps_executed: [],
      fixes_applied: [],
      remaining_issues: [],
      success: false
    };

    // Check file descriptor limits
    try {
      if (process.platform !== 'win32') {
        const ulimitOutput = execSync('ulimit -n', { encoding: 'utf8' });
        const fdLimit = parseInt(ulimitOutput.trim());
        
        result.steps_executed.push({
          step: 'fd_limit_check',
          description: `File descriptor limit: ${fdLimit}`
        });

        if (fdLimit < 1024) {
          result.remaining_issues.push({
            issue: 'low_fd_limit',
            description: `File descriptor limit is low: ${fdLimit}`,
            suggestion: 'Increase file descriptor limit with: ulimit -n 4096'
          });
        } else {
          result.success = true;
        }
      }
    } catch (error) {
      result.remaining_issues.push({
        issue: 'resource_check_failed',
        description: `Resource check failed: ${error.message}`,
        suggestion: 'Manual resource monitoring required'
      });
    }

    return result;
  }

  /**
   * Assess if a process can be safely terminated
   */
  assessProcessSafety(processInfo) {
    const safeProcesses = [
      'node', 'npm', 'yarn', 'webpack', 'vite', 'next', 'serve', 'http-server',
      'live-server', 'browser-sync', 'nodemon', 'ts-node', 'jest', 'mocha'
    ];
    
    const riskyProcesses = [
      'systemd', 'init', 'kernel', 'launchd', 'svchost', 'explorer', 'winlogon',
      'csrss', 'smss', 'wininit', 'services', 'lsass', 'spoolsv'
    ];

    const processName = processInfo.name.toLowerCase();
    
    if (riskyProcesses.some(risky => processName.includes(risky))) {
      return false;
    }
    
    if (safeProcesses.some(safe => processName.includes(safe))) {
      return true;
    }
    
    // Default to cautious approach
    return false;
  }

  /**
   * Check if process is still running
   */
  async checkProcessRunning(pid) {
    try {
      if (process.platform === 'win32') {
        const output = execSync(`tasklist /FI "PID eq ${pid}" /NH`, {
          encoding: 'utf8',
          timeout: 3000
        });
        return output.trim().length > 0;
      } else {
        execSync(`ps -p ${pid}`, { timeout: 3000 });
        return true;
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Ask user for permission (interactive mode)
   */
  async askUserPermission(question, isRecommended = true) {
    if (!process.stdin.isTTY) {
      return false; // Non-interactive environment
    }

    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: question,
      default: isRecommended
    }]);

    return confirm;
  }
}

/**
 * Main Error Messaging System
 */
export class ErrorMessagingSystem extends EventEmitter {
  constructor() {
    super();
    this.detector = new ContextAwareErrorDetector();
    this.formatter = new EnhancedErrorMessageFormatter();
    this.troubleshooter = new AutomatedTroubleshootingEngine();
    this.errorHistory = [];
    this.setupEventHandlers();
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    this.detector.on('error_analyzed', (analysis) => {
      this.emit('error_analyzed', analysis);
    });

    this.troubleshooter.on('troubleshooting_completed', (result) => {
      this.emit('troubleshooting_completed', result);
    });
  }

  /**
   * Process error with full analysis and formatting
   */
  async processError(error, options = {}) {
    const {
      autoTroubleshoot = false,
      autoFix = false,
      interactive = true,
      format = 'console',
      saveToHistory = true
    } = options;

    try {
      // Step 1: Analyze error
      const analysis = await this.detector.analyzeError(error, options.context);

      // Step 2: Format error message
      const formattedMessage = this.formatter.formatError(analysis, {
        format,
        colorize: format === 'console',
        includeContext: true,
        includeSuggestions: true,
        includeCommands: true
      });

      // Step 3: Run automated troubleshooting if requested
      let troubleshootingResult = null;
      if (autoTroubleshoot) {
        troubleshootingResult = await this.troubleshooter.runTroubleshooting(analysis, {
          autoFix,
          interactive
        });
      }

      const result = {
        timestamp: new Date().toISOString(),
        analysis,
        formatted_message: formattedMessage,
        troubleshooting_result: troubleshootingResult,
        options
      };

      // Step 4: Save to history
      if (saveToHistory) {
        this.errorHistory.push({
          timestamp: result.timestamp,
          category: analysis.category,
          severity: analysis.severity,
          resolved: troubleshootingResult?.success || false,
          message: analysis.original_error.message
        });

        // Keep only last 100 errors
        if (this.errorHistory.length > 100) {
          this.errorHistory = this.errorHistory.slice(-100);
        }
      }

      this.emit('error_processed', result);
      return result;

    } catch (processingError) {
      const fallbackResult = {
        timestamp: new Date().toISOString(),
        error: 'Error processing failed',
        original_error: error,
        processing_error: processingError.message,
        formatted_message: this.createFallbackMessage(error)
      };

      this.emit('error_processing_failed', fallbackResult);
      return fallbackResult;
    }
  }

  /**
   * Create fallback message when processing fails
   */
  createFallbackMessage(error) {
    return `
🚨 Error Processing Failed

Original Error: ${error.message || error}

Basic Troubleshooting Steps:
1. Check if the port is already in use: lsof -i :PORT
2. Try using a different port
3. Restart the service
4. Check system resources

For more help, run: npm run port:diagnose
`;
  }

  /**
   * Get error statistics
   */
  getErrorStatistics() {
    const stats = {
      total_errors: this.errorHistory.length,
      by_category: {},
      by_severity: {},
      resolution_rate: 0,
      recent_errors: this.errorHistory.slice(-10)
    };

    this.errorHistory.forEach(error => {
      // Count by category
      stats.by_category[error.category] = (stats.by_category[error.category] || 0) + 1;
      
      // Count by severity
      stats.by_severity[error.severity] = (stats.by_severity[error.severity] || 0) + 1;
    });

    // Calculate resolution rate
    const resolvedCount = this.errorHistory.filter(e => e.resolved).length;
    stats.resolution_rate = this.errorHistory.length > 0 
      ? Math.round((resolvedCount / this.errorHistory.length) * 100)
      : 0;

    return stats;
  }

  /**
   * Export error report
   */
  async exportErrorReport(format = 'json') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `error-report-${timestamp}.${format}`;
    const filepath = path.join(__dirname, '..', 'reports', filename);

    // Ensure reports directory exists
    await fs.mkdir(path.dirname(filepath), { recursive: true });

    const report = {
      generated_at: new Date().toISOString(),
      statistics: this.getErrorStatistics(),
      error_history: this.errorHistory,
      system_info: {
        platform: process.platform,
        node_version: process.version,
        arch: process.arch
      }
    };

    if (format === 'json') {
      await fs.writeFile(filepath, JSON.stringify(report, null, 2));
    } else if (format === 'csv') {
      const csv = this.convertErrorHistoryToCSV(this.errorHistory);
      await fs.writeFile(filepath, csv);
    }

    return filepath;
  }

  /**
   * Convert error history to CSV
   */
  convertErrorHistoryToCSV(history) {
    const headers = ['Timestamp', 'Category', 'Severity', 'Resolved', 'Message'];
    const rows = [headers.join(',')];

    history.forEach(error => {
      const row = [
        error.timestamp,
        error.category,
        error.severity,
        error.resolved,
        `"${error.message.replace(/"/g, '""')}"`
      ];
      rows.push(row.join(','));
    });

    return rows.join('\n');
  }
}

// Export singleton instance
export const errorMessagingSystem = new ErrorMessagingSystem();
export default errorMessagingSystem;
