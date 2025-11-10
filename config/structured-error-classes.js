/**
 * Truxe Structured Error Classes
 * 
 * Comprehensive error class hierarchy for port management with context-aware messaging,
 * automated resolution suggestions, and intelligent error recovery mechanisms.
 * 
 * @author DevOps Engineering Team
 * @version 4.0.0
 */

import { ErrorSeverity, ErrorCategory, ResolutionActionType } from './error-messaging-system.js';

/**
 * Base Truxe Error Class
 */
export class TruxeError extends Error {
  constructor(message, options = {}) {
    super(message);
    
    this.name = this.constructor.name;
    this.timestamp = new Date().toISOString();
    this.category = options.category || ErrorCategory.RUNTIME;
    this.severity = options.severity || ErrorSeverity.ERROR;
    this.code = options.code || 'TRUXE_ERROR';
    this.context = options.context || {};
    this.suggestions = options.suggestions || [];
    this.resolutionActions = options.resolutionActions || [];
    this.metadata = options.metadata || {};
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Add context information to the error
   */
  addContext(key, value) {
    this.context[key] = value;
    return this;
  }

  /**
   * Add a resolution suggestion
   */
  addSuggestion(suggestion) {
    this.suggestions.push(suggestion);
    return this;
  }

  /**
   * Add a resolution action
   */
  addResolutionAction(action) {
    this.resolutionActions.push(action);
    return this;
  }

  /**
   * Convert error to structured object
   */
  toStructuredObject() {
    return {
      name: this.name,
      message: this.message,
      timestamp: this.timestamp,
      category: this.category,
      severity: this.severity,
      code: this.code,
      context: this.context,
      suggestions: this.suggestions,
      resolutionActions: this.resolutionActions,
      metadata: this.metadata,
      stack: this.stack
    };
  }

  /**
   * Create user-friendly error message
   */
  getUserFriendlyMessage() {
    return `${this.getSeverityIcon()} ${this.message}`;
  }

  /**
   * Get severity icon
   */
  getSeverityIcon() {
    const icons = {
      [ErrorSeverity.INFO]: 'ℹ️',
      [ErrorSeverity.WARNING]: '⚠️',
      [ErrorSeverity.ERROR]: '❌',
      [ErrorSeverity.CRITICAL]: '🚨',
      [ErrorSeverity.FATAL]: '💀'
    };
    return icons[this.severity] || '❓';
  }
}

/**
 * Port Conflict Error
 */
export class PortConflictError extends TruxeError {
  constructor(port, conflictingProcess = null, options = {}) {
    const message = conflictingProcess 
      ? `Port ${port} is already in use by ${conflictingProcess.name} (PID: ${conflictingProcess.pid})`
      : `Port ${port} is already in use`;

    super(message, {
      category: ErrorCategory.PORT_CONFLICT,
      severity: ErrorSeverity.ERROR,
      code: 'PORT_IN_USE',
      ...options
    });

    this.port = port;
    this.conflictingProcess = conflictingProcess;
    
    this.addContext('port', port);
    if (conflictingProcess) {
      this.addContext('conflicting_process', conflictingProcess);
    }

    this.generateResolutionActions();
  }

  generateResolutionActions() {
    // Action 1: Check what's using the port
    this.addResolutionAction({
      type: ResolutionActionType.COMMAND,
      priority: 'high',
      title: 'Identify the conflicting process',
      description: `Check what process is currently using port ${this.port}`,
      commands: this.getPortCheckCommands(),
      estimatedTime: '30 seconds',
      riskLevel: 'none'
    });

    // Action 2: Kill the conflicting process (if identified and safe)
    if (this.conflictingProcess && this.isProcessSafeToKill()) {
      this.addResolutionAction({
        type: ResolutionActionType.KILL_PROCESS,
        priority: 'medium',
        title: 'Stop the conflicting process',
        description: `Terminate ${this.conflictingProcess.name} (PID: ${this.conflictingProcess.pid})`,
        commands: this.getProcessKillCommands(),
        estimatedTime: '1 minute',
        riskLevel: 'low'
      });
    }

    // Action 3: Use alternative port
    this.addResolutionAction({
      type: ResolutionActionType.CONFIG_CHANGE,
      priority: 'low',
      title: 'Use an alternative port',
      description: 'Configure your service to use a different port',
      commands: [
        `export PORT=${this.port + 1}`,
        'npm start'
      ],
      estimatedTime: '2 minutes',
      riskLevel: 'none'
    });

    // Action 4: Use port management CLI
    this.addResolutionAction({
      type: ResolutionActionType.COMMAND,
      priority: 'medium',
      title: 'Use Truxe port management',
      description: 'Let Truxe automatically resolve the conflict',
      commands: [
        'npm run port:resolve',
        `npm run port:suggest --service=api --port=${this.port}`
      ],
      estimatedTime: '1 minute',
      riskLevel: 'low'
    });
  }

  getPortCheckCommands() {
    if (process.platform === 'win32') {
      return [
        `netstat -ano | findstr :${this.port}`,
        `tasklist /FI "PID eq <PID_FROM_NETSTAT>"`
      ];
    } else {
      return [
        `lsof -ti:${this.port}`,
        `ps -p $(lsof -ti:${this.port})`,
        `netstat -tulpn | grep :${this.port}`
      ];
    }
  }

  getProcessKillCommands() {
    if (!this.conflictingProcess) return [];

    if (process.platform === 'win32') {
      return [
        `taskkill /PID ${this.conflictingProcess.pid}`,
        `taskkill /PID ${this.conflictingProcess.pid} /F`
      ];
    } else {
      return [
        `kill -15 ${this.conflictingProcess.pid}`,
        `kill -9 ${this.conflictingProcess.pid}`
      ];
    }
  }

  isProcessSafeToKill() {
    if (!this.conflictingProcess) return false;

    const safeProcesses = [
      'node', 'npm', 'yarn', 'webpack', 'vite', 'next', 'serve',
      'http-server', 'live-server', 'browser-sync', 'nodemon'
    ];

    const processName = this.conflictingProcess.name.toLowerCase();
    return safeProcesses.some(safe => processName.includes(safe));
  }
}

/**
 * Permission Denied Error
 */
export class PermissionDeniedError extends TruxeError {
  constructor(port = null, operation = 'bind', options = {}) {
    const message = port 
      ? `Permission denied to ${operation} on port ${port}`
      : `Permission denied for ${operation} operation`;

    super(message, {
      category: ErrorCategory.PERMISSION,
      severity: ErrorSeverity.ERROR,
      code: 'PERMISSION_DENIED',
      ...options
    });

    this.port = port;
    this.operation = operation;
    this.isPrivilegedPort = port && port < 1024;

    this.addContext('port', port);
    this.addContext('operation', operation);
    this.addContext('is_privileged_port', this.isPrivilegedPort);

    this.generateResolutionActions();
  }

  generateResolutionActions() {
    if (this.isPrivilegedPort) {
      // Privileged port suggestions
      this.addResolutionAction({
        type: ResolutionActionType.COMMAND,
        priority: 'high',
        title: 'Run with elevated privileges',
        description: `Port ${this.port} requires administrator/root privileges`,
        commands: process.platform === 'win32' 
          ? ['# Run Command Prompt as Administrator', 'npm start']
          : ['sudo npm start'],
        estimatedTime: '1 minute',
        riskLevel: 'medium'
      });

      this.addResolutionAction({
        type: ResolutionActionType.CONFIG_CHANGE,
        priority: 'medium',
        title: 'Use a non-privileged port',
        description: 'Switch to a port above 1024 that doesn\'t require special privileges',
        commands: [
          `export PORT=${this.port + 3000}`,
          'npm start'
        ],
        estimatedTime: '1 minute',
        riskLevel: 'none'
      });
    } else {
      // General permission issues
      this.addResolutionAction({
        type: ResolutionActionType.COMMAND,
        priority: 'high',
        title: 'Check file and directory permissions',
        description: 'Verify that you have the necessary permissions',
        commands: [
          'ls -la',
          'whoami',
          'groups'
        ],
        estimatedTime: '30 seconds',
        riskLevel: 'none'
      });
    }

    // Common permission fixes
    this.addResolutionAction({
      type: ResolutionActionType.COMMAND,
      priority: 'low',
      title: 'Check firewall settings',
      description: 'Ensure firewall isn\'t blocking the port',
      commands: process.platform === 'win32'
        ? ['netsh advfirewall firewall show rule name=all']
        : ['sudo ufw status', 'sudo iptables -L'],
      estimatedTime: '2 minutes',
      riskLevel: 'none'
    });
  }
}

/**
 * Configuration Error
 */
export class ConfigurationError extends TruxeError {
  constructor(configFile = null, issue = null, options = {}) {
    const message = configFile 
      ? `Configuration error in ${configFile}${issue ? `: ${issue}` : ''}`
      : `Configuration error${issue ? `: ${issue}` : ''}`;

    super(message, {
      category: ErrorCategory.CONFIGURATION,
      severity: ErrorSeverity.ERROR,
      code: 'CONFIG_ERROR',
      ...options
    });

    this.configFile = configFile;
    this.issue = issue;

    this.addContext('config_file', configFile);
    this.addContext('issue', issue);

    this.generateResolutionActions();
  }

  generateResolutionActions() {
    if (this.configFile) {
      this.addResolutionAction({
        type: ResolutionActionType.COMMAND,
        priority: 'high',
        title: 'Validate configuration file',
        description: `Check syntax and structure of ${this.configFile}`,
        commands: this.getValidationCommands(),
        estimatedTime: '1 minute',
        riskLevel: 'none'
      });

      this.addResolutionAction({
        type: ResolutionActionType.CONFIG_CHANGE,
        priority: 'medium',
        title: 'Fix configuration issues',
        description: 'Correct the identified configuration problems',
        commands: [
          `code ${this.configFile}`,
          '# Fix the configuration issues',
          'npm run config:validate'
        ],
        estimatedTime: '5 minutes',
        riskLevel: 'low'
      });
    }

    this.addResolutionAction({
      type: ResolutionActionType.COMMAND,
      priority: 'medium',
      title: 'Reset to default configuration',
      description: 'Use default configuration as a starting point',
      commands: [
        'cp config/ports.js.example config/ports.js',
        'npm run config:init'
      ],
      estimatedTime: '2 minutes',
      riskLevel: 'medium'
    });

    this.addResolutionAction({
      type: ResolutionActionType.CHECK_DOCUMENTATION,
      priority: 'low',
      title: 'Check configuration documentation',
      description: 'Review configuration guide and examples',
      links: [
        'docs/05-guides/configuration-guide.md',
        'config/ports.js.example'
      ],
      estimatedTime: '10 minutes',
      riskLevel: 'none'
    });
  }

  getValidationCommands() {
    if (!this.configFile) return ['npm run config:validate'];

    const ext = this.configFile.split('.').pop();
    switch (ext) {
      case 'json':
        return [
          `cat ${this.configFile} | jq .`,
          'npm run config:validate'
        ];
      case 'js':
        return [
          `node -c ${this.configFile}`,
          'npm run config:validate'
        ];
      case 'yml':
      case 'yaml':
        return [
          `yamllint ${this.configFile}`,
          'npm run config:validate'
        ];
      default:
        return ['npm run config:validate'];
    }
  }
}

/**
 * Network Error
 */
export class NetworkError extends TruxeError {
  constructor(host = null, port = null, operation = 'connect', options = {}) {
    const target = host && port ? `${host}:${port}` : (host || port || 'network');
    const message = `Network error: Failed to ${operation} to ${target}`;

    super(message, {
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.ERROR,
      code: 'NETWORK_ERROR',
      ...options
    });

    this.host = host;
    this.port = port;
    this.operation = operation;

    this.addContext('host', host);
    this.addContext('port', port);
    this.addContext('operation', operation);

    this.generateResolutionActions();
  }

  generateResolutionActions() {
    // Test connectivity
    this.addResolutionAction({
      type: ResolutionActionType.COMMAND,
      priority: 'high',
      title: 'Test network connectivity',
      description: 'Check if the target is reachable',
      commands: this.getConnectivityTestCommands(),
      estimatedTime: '1 minute',
      riskLevel: 'none'
    });

    // Check network interfaces
    this.addResolutionAction({
      type: ResolutionActionType.COMMAND,
      priority: 'medium',
      title: 'Check network interfaces',
      description: 'Verify network interface configuration',
      commands: process.platform === 'win32'
        ? ['ipconfig /all', 'netstat -rn']
        : ['ip addr show', 'ip route show', 'netstat -rn'],
      estimatedTime: '30 seconds',
      riskLevel: 'none'
    });

    // DNS resolution
    if (this.host && this.host !== 'localhost' && this.host !== '127.0.0.1') {
      this.addResolutionAction({
        type: ResolutionActionType.COMMAND,
        priority: 'medium',
        title: 'Check DNS resolution',
        description: `Verify that ${this.host} can be resolved`,
        commands: [
          `nslookup ${this.host}`,
          `ping -c 3 ${this.host}`
        ],
        estimatedTime: '30 seconds',
        riskLevel: 'none'
      });
    }

    // Firewall check
    this.addResolutionAction({
      type: ResolutionActionType.COMMAND,
      priority: 'low',
      title: 'Check firewall rules',
      description: 'Ensure firewall isn\'t blocking the connection',
      commands: process.platform === 'win32'
        ? ['netsh advfirewall show allprofiles']
        : ['sudo ufw status verbose', 'sudo iptables -L -n'],
      estimatedTime: '1 minute',
      riskLevel: 'none'
    });
  }

  getConnectivityTestCommands() {
    const commands = [];

    if (this.host) {
      commands.push(`ping -c 3 ${this.host}`);
    }

    if (this.host && this.port) {
      if (process.platform === 'win32') {
        commands.push(`telnet ${this.host} ${this.port}`);
      } else {
        commands.push(`nc -zv ${this.host} ${this.port}`);
        commands.push(`telnet ${this.host} ${this.port}`);
      }
    }

    return commands.length > 0 ? commands : ['ping -c 3 localhost'];
  }
}

/**
 * Resource Limitation Error
 */
export class ResourceLimitationError extends TruxeError {
  constructor(resource = 'unknown', limit = null, current = null, options = {}) {
    const message = limit && current 
      ? `Resource limit exceeded: ${resource} (${current}/${limit})`
      : `Resource limit exceeded: ${resource}`;

    super(message, {
      category: ErrorCategory.RESOURCE,
      severity: ErrorSeverity.CRITICAL,
      code: 'RESOURCE_LIMIT',
      ...options
    });

    this.resource = resource;
    this.limit = limit;
    this.current = current;

    this.addContext('resource', resource);
    this.addContext('limit', limit);
    this.addContext('current', current);

    this.generateResolutionActions();
  }

  generateResolutionActions() {
    // Check current resource usage
    this.addResolutionAction({
      type: ResolutionActionType.COMMAND,
      priority: 'high',
      title: 'Check resource usage',
      description: `Monitor current ${this.resource} usage`,
      commands: this.getResourceCheckCommands(),
      estimatedTime: '30 seconds',
      riskLevel: 'none'
    });

    // Increase limits if possible
    if (this.resource === 'file_descriptors') {
      this.addResolutionAction({
        type: ResolutionActionType.COMMAND,
        priority: 'medium',
        title: 'Increase file descriptor limit',
        description: 'Temporarily increase the file descriptor limit',
        commands: [
          'ulimit -n 4096',
          '# Or permanently: echo "* soft nofile 4096" >> /etc/security/limits.conf'
        ],
        estimatedTime: '1 minute',
        riskLevel: 'low'
      });
    }

    // Clean up resources
    this.addResolutionAction({
      type: ResolutionActionType.RESTART_SERVICE,
      priority: 'medium',
      title: 'Restart services to free resources',
      description: 'Restart services that might be holding resources',
      commands: [
        'sudo systemctl restart docker',
        'npm run services:restart'
      ],
      estimatedTime: '3 minutes',
      riskLevel: 'medium'
    });

    // System cleanup
    this.addResolutionAction({
      type: ResolutionActionType.COMMAND,
      priority: 'low',
      title: 'System cleanup',
      description: 'Clean up temporary files and free system resources',
      commands: process.platform === 'win32'
        ? ['cleanmgr', 'sfc /scannow']
        : ['sudo apt-get clean', 'sudo journalctl --vacuum-time=7d'],
      estimatedTime: '5 minutes',
      riskLevel: 'low'
    });
  }

  getResourceCheckCommands() {
    const commands = [];

    switch (this.resource) {
      case 'file_descriptors':
        commands.push('ulimit -n', 'lsof | wc -l');
        break;
      case 'memory':
        commands.push('free -h', 'ps aux --sort=-%mem | head');
        break;
      case 'disk':
        commands.push('df -h', 'du -sh * | sort -hr');
        break;
      case 'processes':
        commands.push('ps aux | wc -l', 'ps aux --sort=-%cpu | head');
        break;
      default:
        commands.push('top -n 1', 'free -h', 'df -h');
    }

    return commands;
  }
}

/**
 * Service Startup Error
 */
export class ServiceStartupError extends TruxeError {
  constructor(serviceName, reason = null, options = {}) {
    const message = reason 
      ? `Failed to start service '${serviceName}': ${reason}`
      : `Failed to start service '${serviceName}'`;

    super(message, {
      category: ErrorCategory.STARTUP,
      severity: ErrorSeverity.CRITICAL,
      code: 'SERVICE_STARTUP_FAILED',
      ...options
    });

    this.serviceName = serviceName;
    this.reason = reason;

    this.addContext('service_name', serviceName);
    this.addContext('reason', reason);

    this.generateResolutionActions();
  }

  generateResolutionActions() {
    // Check service logs
    this.addResolutionAction({
      type: ResolutionActionType.COMMAND,
      priority: 'high',
      title: 'Check service logs',
      description: `Review logs for ${this.serviceName} to identify the issue`,
      commands: [
        `docker logs ${this.serviceName}`,
        `journalctl -u ${this.serviceName} -n 50`,
        'npm run logs'
      ],
      estimatedTime: '2 minutes',
      riskLevel: 'none'
    });

    // Validate configuration
    this.addResolutionAction({
      type: ResolutionActionType.COMMAND,
      priority: 'high',
      title: 'Validate service configuration',
      description: 'Check configuration files for syntax errors',
      commands: [
        'npm run config:validate',
        'npm run port:check',
        'docker-compose config'
      ],
      estimatedTime: '1 minute',
      riskLevel: 'none'
    });

    // Check dependencies
    this.addResolutionAction({
      type: ResolutionActionType.COMMAND,
      priority: 'medium',
      title: 'Check service dependencies',
      description: 'Verify that all required services are running',
      commands: [
        'docker ps',
        'npm run status',
        'systemctl status'
      ],
      estimatedTime: '1 minute',
      riskLevel: 'none'
    });

    // Restart with clean state
    this.addResolutionAction({
      type: ResolutionActionType.RESTART_SERVICE,
      priority: 'medium',
      title: 'Clean restart',
      description: 'Stop all services and restart with clean state',
      commands: [
        'docker-compose down',
        'docker system prune -f',
        'docker-compose up -d'
      ],
      estimatedTime: '5 minutes',
      riskLevel: 'medium'
    });

    // Port-specific troubleshooting
    this.addResolutionAction({
      type: ResolutionActionType.COMMAND,
      priority: 'low',
      title: 'Port troubleshooting',
      description: 'Run comprehensive port diagnostics',
      commands: [
        'npm run port:diagnose',
        'npm run port:resolve',
        'npm run port:suggest'
      ],
      estimatedTime: '3 minutes',
      riskLevel: 'low'
    });
  }
}

/**
 * Validation Error
 */
export class ValidationError extends TruxeError {
  constructor(field = null, value = null, constraint = null, options = {}) {
    const message = field 
      ? `Validation failed for ${field}${value ? ` (value: ${value})` : ''}${constraint ? `: ${constraint}` : ''}`
      : 'Validation failed';

    super(message, {
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.WARNING,
      code: 'VALIDATION_FAILED',
      ...options
    });

    this.field = field;
    this.value = value;
    this.constraint = constraint;

    this.addContext('field', field);
    this.addContext('value', value);
    this.addContext('constraint', constraint);

    this.generateResolutionActions();
  }

  generateResolutionActions() {
    // Show validation rules
    this.addResolutionAction({
      type: ResolutionActionType.CHECK_DOCUMENTATION,
      priority: 'high',
      title: 'Check validation rules',
      description: `Review validation requirements for ${this.field || 'the field'}`,
      links: [
        'docs/05-guides/configuration-guide.md#validation-rules',
        'docs/05-guides/port-management-guide.md#port-validation'
      ],
      estimatedTime: '2 minutes',
      riskLevel: 'none'
    });

    // Validate configuration
    this.addResolutionAction({
      type: ResolutionActionType.COMMAND,
      priority: 'medium',
      title: 'Run full validation',
      description: 'Execute comprehensive configuration validation',
      commands: [
        'npm run config:validate',
        'npm run port:validate',
        'npm run lint:config'
      ],
      estimatedTime: '1 minute',
      riskLevel: 'none'
    });

    // Fix common validation issues
    if (this.field === 'port') {
      this.addResolutionAction({
        type: ResolutionActionType.CONFIG_CHANGE,
        priority: 'medium',
        title: 'Fix port validation',
        description: 'Ensure port is within valid range and not reserved',
        commands: [
          '# Check port range: 1024-65535 for non-privileged',
          '# Avoid reserved ports: 22, 25, 53, 80, 443, etc.',
          'npm run port:suggest'
        ],
        estimatedTime: '2 minutes',
        riskLevel: 'low'
      });
    }
  }
}

/**
 * Error Factory for creating appropriate error instances
 */
export class ErrorFactory {
  /**
   * Create error from exception
   */
  static createFromException(error, context = {}) {
    const message = error.message || error.toString();
    const code = error.code || error.errno;

    // Port conflict detection
    if (code === 'EADDRINUSE' || message.includes('EADDRINUSE')) {
      const portMatch = message.match(/:(\d+)/);
      const port = portMatch ? parseInt(portMatch[1]) : null;
      return new PortConflictError(port, null, { context });
    }

    // Permission denied detection
    if (code === 'EACCES' || message.includes('permission denied')) {
      const portMatch = message.match(/:(\d+)/);
      const port = portMatch ? parseInt(portMatch[1]) : null;
      return new PermissionDeniedError(port, 'bind', { context });
    }

    // Network errors
    if (code === 'ENOTFOUND' || code === 'ECONNREFUSED' || message.includes('network')) {
      const hostMatch = message.match(/getaddrinfo\s+(\S+)/);
      const host = hostMatch ? hostMatch[1] : null;
      return new NetworkError(host, null, 'connect', { context });
    }

    // Resource limitations
    if (code === 'EMFILE' || code === 'ENFILE' || message.includes('too many open files')) {
      return new ResourceLimitationError('file_descriptors', null, null, { context });
    }

    // Configuration errors
    if (message.includes('config') || message.includes('configuration')) {
      return new ConfigurationError(null, message, { context });
    }

    // Default to generic Truxe error
    return new TruxeError(message, {
      code: code || 'UNKNOWN_ERROR',
      context
    });
  }

  /**
   * Create port conflict error with process info
   */
  static createPortConflictError(port, processInfo = null, context = {}) {
    return new PortConflictError(port, processInfo, { context });
  }

  /**
   * Create permission denied error
   */
  static createPermissionDeniedError(port = null, operation = 'bind', context = {}) {
    return new PermissionDeniedError(port, operation, { context });
  }

  /**
   * Create configuration error
   */
  static createConfigurationError(configFile = null, issue = null, context = {}) {
    return new ConfigurationError(configFile, issue, { context });
  }

  /**
   * Create network error
   */
  static createNetworkError(host = null, port = null, operation = 'connect', context = {}) {
    return new NetworkError(host, port, operation, { context });
  }

  /**
   * Create resource limitation error
   */
  static createResourceLimitationError(resource, limit = null, current = null, context = {}) {
    return new ResourceLimitationError(resource, limit, current, { context });
  }

  /**
   * Create service startup error
   */
  static createServiceStartupError(serviceName, reason = null, context = {}) {
    return new ServiceStartupError(serviceName, reason, { context });
  }

  /**
   * Create validation error
   */
  static createValidationError(field = null, value = null, constraint = null, context = {}) {
    return new ValidationError(field, value, constraint, { context });
  }
}

/**
 * Error Handler with automatic error type detection
 */
export class SmartErrorHandler {
  constructor() {
    this.errorPatterns = new Map();
    this.setupErrorPatterns();
  }

  /**
   * Setup error detection patterns
   */
  setupErrorPatterns() {
    // Port conflict patterns
    this.errorPatterns.set(/EADDRINUSE.*:(\d+)/, (match, error) => {
      const port = parseInt(match[1]);
      return ErrorFactory.createPortConflictError(port);
    });

    this.errorPatterns.set(/listen EADDRINUSE.*:(\d+)/, (match, error) => {
      const port = parseInt(match[1]);
      return ErrorFactory.createPortConflictError(port);
    });

    // Permission patterns
    this.errorPatterns.set(/EACCES.*permission denied/, (match, error) => {
      return ErrorFactory.createPermissionDeniedError();
    });

    this.errorPatterns.set(/bind.*permission denied/, (match, error) => {
      const portMatch = error.message.match(/:(\d+)/);
      const port = portMatch ? parseInt(portMatch[1]) : null;
      return ErrorFactory.createPermissionDeniedError(port, 'bind');
    });

    // Network patterns
    this.errorPatterns.set(/ENOTFOUND (.+)/, (match, error) => {
      return ErrorFactory.createNetworkError(match[1], null, 'resolve');
    });

    this.errorPatterns.set(/ECONNREFUSED/, (match, error) => {
      return ErrorFactory.createNetworkError(null, null, 'connect');
    });

    // Resource patterns
    this.errorPatterns.set(/EMFILE|ENFILE/, (match, error) => {
      return ErrorFactory.createResourceLimitationError('file_descriptors');
    });

    this.errorPatterns.set(/too many open files/, (match, error) => {
      return ErrorFactory.createResourceLimitationError('file_descriptors');
    });
  }

  /**
   * Handle error with automatic type detection
   */
  handleError(error, context = {}) {
    const errorMessage = error.message || error.toString();

    // Try to match against known patterns
    for (const [pattern, factory] of this.errorPatterns) {
      const match = errorMessage.match(pattern);
      if (match) {
        const structuredError = factory(match, error);
        structuredError.addContext('original_error', error);
        structuredError.addContext('detection_pattern', pattern.toString());
        Object.assign(structuredError.context, context);
        return structuredError;
      }
    }

    // Fallback to factory method
    return ErrorFactory.createFromException(error, context);
  }

  /**
   * Add custom error pattern
   */
  addErrorPattern(pattern, factory) {
    this.errorPatterns.set(pattern, factory);
  }
}

// Export singleton instance
export const smartErrorHandler = new SmartErrorHandler();

// Export all error classes and utilities
export {
  TruxeError,
  PortConflictError,
  PermissionDeniedError,
  ConfigurationError,
  NetworkError,
  ResourceLimitationError,
  ServiceStartupError,
  ValidationError,
  ErrorFactory
};
