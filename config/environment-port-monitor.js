/**
 * Truxe Environment Port Monitoring System
 * 
 * Provides comprehensive monitoring, alerting, and reporting for 
 * environment-specific port usage and isolation compliance.
 * 
 * @author DevOps Engineering Team
 * @version 1.0.0
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import EventEmitter from 'events';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Monitoring Configuration
 */
const MONITORING_CONFIG = {
  // Monitoring intervals (in milliseconds)
  intervals: {
    port_scan: 30000,           // 30 seconds
    environment_check: 60000,   // 1 minute
    conflict_detection: 45000,  // 45 seconds
    health_check: 120000,       // 2 minutes
    metrics_collection: 10000,  // 10 seconds
    report_generation: 300000   // 5 minutes
  },
  
  // Alert thresholds
  thresholds: {
    port_utilization: {
      warning: 70,    // 70% utilization
      critical: 85    // 85% utilization
    },
    conflict_count: {
      warning: 1,     // 1 conflict
      critical: 3     // 3 conflicts
    },
    environment_switches: {
      warning: 5,     // 5 switches per hour
      critical: 10    // 10 switches per hour
    },
    isolation_violations: {
      warning: 1,     // 1 violation
      critical: 3     // 3 violations
    },
    response_time: {
      warning: 1000,  // 1 second
      critical: 3000  // 3 seconds
    }
  },
  
  // Retention policies
  retention: {
    metrics_hours: 24,          // Keep metrics for 24 hours
    alerts_days: 7,             // Keep alerts for 7 days
    reports_days: 30,           // Keep reports for 30 days
    logs_days: 14               // Keep logs for 14 days
  },
  
  // Alert channels
  alerting: {
    console: true,
    file: true,
    webhook: false,
    email: false
  },
  
  // Monitoring features
  features: {
    port_scanning: true,
    process_monitoring: true,
    resource_tracking: true,
    performance_metrics: true,
    security_monitoring: true,
    compliance_checking: true
  }
};

/**
 * Environment Port Monitor Class
 * Comprehensive monitoring and alerting system
 */
class EnvironmentPortMonitor extends EventEmitter {
  constructor(portManager, isolationValidator, config = MONITORING_CONFIG) {
    super();
    this.portManager = portManager;
    this.isolationValidator = isolationValidator;
    this.config = config;
    
    // Monitoring state
    this.isMonitoring = false;
    this.monitoringIntervals = new Map();
    this.metrics = new Map();
    this.alerts = [];
    this.reports = [];
    this.lastScan = null;
    
    // Performance tracking
    this.performanceMetrics = {
      scan_times: [],
      response_times: [],
      error_counts: new Map(),
      success_rates: new Map()
    };
    
    // Initialize monitoring
    this.initializeMonitoring();
  }

  /**
   * Initialize monitoring system
   */
  initializeMonitoring() {
    console.log('📊 Initializing Environment Port Monitor...');
    
    // Setup event handlers
    this.setupEventHandlers();
    
    // Initialize metrics storage
    this.initializeMetrics();
    
    // Setup alert handlers
    this.setupAlertHandlers();
    
    console.log('✅ Environment Port Monitor initialized');
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    // Port manager events
    this.portManager.on('environmentChanged', (data) => {
      this.recordEnvironmentChange(data);
    });
    
    this.portManager.on('conflictsDetected', (conflicts) => {
      this.handleConflictsDetected(conflicts);
    });
    
    // Isolation validator events
    this.isolationValidator.on('isolationValidationPerformed', (validation) => {
      this.recordIsolationValidation(validation);
    });
  }

  /**
   * Initialize metrics storage
   */
  initializeMetrics() {
    const environments = Object.keys(this.portManager.config.environments);
    
    for (const env of environments) {
      this.metrics.set(env, {
        port_usage: [],
        conflicts: [],
        violations: [],
        performance: [],
        health_status: 'unknown',
        last_check: null
      });
    }
  }

  /**
   * Setup alert handlers
   */
  setupAlertHandlers() {
    this.on('alert', (alert) => {
      this.handleAlert(alert);
    });
    
    this.on('critical', (alert) => {
      this.handleCriticalAlert(alert);
    });
  }

  /**
   * Start monitoring
   */
  startMonitoring() {
    if (this.isMonitoring) {
      console.log('📊 Monitoring already running');
      return;
    }

    console.log('🚀 Starting environment port monitoring...');
    this.isMonitoring = true;

    // Start monitoring intervals
    if (this.config.features.port_scanning) {
      this.startPortScanning();
    }
    
    if (this.config.features.process_monitoring) {
      this.startProcessMonitoring();
    }
    
    if (this.config.features.resource_tracking) {
      this.startResourceTracking();
    }
    
    if (this.config.features.performance_metrics) {
      this.startPerformanceMonitoring();
    }
    
    if (this.config.features.security_monitoring) {
      this.startSecurityMonitoring();
    }
    
    if (this.config.features.compliance_checking) {
      this.startComplianceChecking();
    }

    // Start report generation
    this.startReportGeneration();

    console.log('✅ Environment port monitoring started');
    this.emit('monitoringStarted', { timestamp: new Date().toISOString() });
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      console.log('📊 Monitoring not running');
      return;
    }

    console.log('🛑 Stopping environment port monitoring...');
    this.isMonitoring = false;

    // Clear all intervals
    for (const [name, intervalId] of this.monitoringIntervals) {
      clearInterval(intervalId);
      console.log(`  - Stopped ${name} monitoring`);
    }
    this.monitoringIntervals.clear();

    console.log('✅ Environment port monitoring stopped');
    this.emit('monitoringStopped', { timestamp: new Date().toISOString() });
  }

  /**
   * Start port scanning
   */
  startPortScanning() {
    const intervalId = setInterval(() => {
      this.performPortScan();
    }, this.config.intervals.port_scan);
    
    this.monitoringIntervals.set('port_scan', intervalId);
    console.log('🔍 Port scanning started');
  }

  /**
   * Perform comprehensive port scan
   */
  async performPortScan() {
    const scanId = crypto.randomUUID();
    const startTime = Date.now();
    
    try {
      console.log(`🔍 Performing port scan: ${scanId}`);
      
      const currentEnv = this.portManager.currentEnvironment;
      const envConfig = this.portManager.getEnvironmentConfig(currentEnv);
      
      const scanResults = {
        scan_id: scanId,
        timestamp: new Date().toISOString(),
        environment: currentEnv,
        duration_ms: 0,
        ports_scanned: 0,
        ports_in_use: 0,
        conflicts: [],
        violations: [],
        services: {}
      };

      // Scan environment port range
      const portsInUse = await this.scanPortRange(envConfig.range.start, envConfig.range.end);
      scanResults.ports_scanned = envConfig.range.end - envConfig.range.start + 1;
      scanResults.ports_in_use = portsInUse.length;

      // Check service ports
      for (const [serviceName, port] of Object.entries(envConfig.services)) {
        const isInUse = portsInUse.includes(port);
        const isAvailable = this.portManager.isPortAvailable(port);
        
        scanResults.services[serviceName] = {
          port: port,
          in_use: isInUse,
          available: isAvailable,
          status: isInUse ? 'active' : (isAvailable ? 'available' : 'blocked')
        };
      }

      // Detect conflicts
      const conflicts = this.portManager.detectConflicts(currentEnv);
      scanResults.conflicts = conflicts;

      // Check isolation violations
      const violations = this.isolationValidator.validateEnvironmentIsolation(currentEnv);
      scanResults.violations = violations.violations || [];

      // Calculate metrics
      const utilization = this.calculatePortUtilization(currentEnv, portsInUse.length);
      scanResults.utilization = utilization;

      // Record scan duration
      scanResults.duration_ms = Date.now() - startTime;
      this.performanceMetrics.scan_times.push(scanResults.duration_ms);

      // Store scan results
      this.recordScanResults(scanResults);

      // Check thresholds and generate alerts
      this.checkScanThresholds(scanResults);

      this.lastScan = scanResults;
      
    } catch (error) {
      console.error(`❌ Port scan failed: ${error.message}`);
      this.recordError('port_scan', error);
    }
  }

  /**
   * Scan port range for active ports
   */
  async scanPortRange(startPort, endPort) {
    try {
      const result = execSync(`nmap -p ${startPort}-${endPort} localhost --open -T4 | grep "^[0-9]" | cut -d'/' -f1`, {
        encoding: 'utf8',
        timeout: 30000,
        stdio: 'pipe'
      });
      
      return result.trim().split('\n').filter(Boolean).map(port => parseInt(port));
    } catch (error) {
      // Fallback to lsof if nmap is not available
      return this.scanPortRangeWithLsof(startPort, endPort);
    }
  }

  /**
   * Fallback port scanning with lsof
   */
  scanPortRangeWithLsof(startPort, endPort) {
    const portsInUse = [];
    
    for (let port = startPort; port <= endPort; port += 10) {
      const endRange = Math.min(port + 9, endPort);
      try {
        const result = execSync(`lsof -i :${port}-${endRange} -t`, {
          encoding: 'utf8',
          stdio: 'pipe',
          timeout: 1000
        });
        
        if (result.trim()) {
          // Port is in use, check individual ports in range
          for (let p = port; p <= endRange; p++) {
            if (!this.portManager.isPortAvailable(p)) {
              portsInUse.push(p);
            }
          }
        }
      } catch (error) {
        // No ports in use in this range
      }
    }
    
    return portsInUse;
  }

  /**
   * Calculate port utilization
   */
  calculatePortUtilization(environment, portsInUse) {
    const envConfig = this.portManager.getEnvironmentConfig(environment);
    const totalPorts = envConfig.range.end - envConfig.range.start + 1;
    return Math.round((portsInUse / totalPorts) * 100 * 100) / 100;
  }

  /**
   * Record scan results
   */
  recordScanResults(scanResults) {
    const envMetrics = this.metrics.get(scanResults.environment);
    if (envMetrics) {
      envMetrics.port_usage.push({
        timestamp: scanResults.timestamp,
        utilization: scanResults.utilization,
        ports_in_use: scanResults.ports_in_use,
        conflicts: scanResults.conflicts.length,
        violations: scanResults.violations.length
      });
      
      // Keep only recent metrics
      const cutoff = Date.now() - (this.config.retention.metrics_hours * 60 * 60 * 1000);
      envMetrics.port_usage = envMetrics.port_usage.filter(
        metric => new Date(metric.timestamp).getTime() > cutoff
      );
      
      envMetrics.last_check = scanResults.timestamp;
    }
  }

  /**
   * Check scan thresholds and generate alerts
   */
  checkScanThresholds(scanResults) {
    const { utilization, conflicts, violations } = scanResults;
    
    // Port utilization alerts
    if (utilization >= this.config.thresholds.port_utilization.critical) {
      this.generateAlert('critical', 'port_utilization', {
        message: `Critical port utilization: ${utilization}%`,
        environment: scanResults.environment,
        value: utilization,
        threshold: this.config.thresholds.port_utilization.critical
      });
    } else if (utilization >= this.config.thresholds.port_utilization.warning) {
      this.generateAlert('warning', 'port_utilization', {
        message: `High port utilization: ${utilization}%`,
        environment: scanResults.environment,
        value: utilization,
        threshold: this.config.thresholds.port_utilization.warning
      });
    }
    
    // Conflict alerts
    if (conflicts.length >= this.config.thresholds.conflict_count.critical) {
      this.generateAlert('critical', 'port_conflicts', {
        message: `Critical number of port conflicts: ${conflicts.length}`,
        environment: scanResults.environment,
        conflicts: conflicts
      });
    } else if (conflicts.length >= this.config.thresholds.conflict_count.warning) {
      this.generateAlert('warning', 'port_conflicts', {
        message: `Port conflicts detected: ${conflicts.length}`,
        environment: scanResults.environment,
        conflicts: conflicts
      });
    }
    
    // Violation alerts
    if (violations.length >= this.config.thresholds.isolation_violations.critical) {
      this.generateAlert('critical', 'isolation_violations', {
        message: `Critical isolation violations: ${violations.length}`,
        environment: scanResults.environment,
        violations: violations
      });
    } else if (violations.length >= this.config.thresholds.isolation_violations.warning) {
      this.generateAlert('warning', 'isolation_violations', {
        message: `Isolation violations detected: ${violations.length}`,
        environment: scanResults.environment,
        violations: violations
      });
    }
  }

  /**
   * Start process monitoring
   */
  startProcessMonitoring() {
    const intervalId = setInterval(() => {
      this.monitorProcesses();
    }, this.config.intervals.environment_check);
    
    this.monitoringIntervals.set('process_monitoring', intervalId);
    console.log('🔄 Process monitoring started');
  }

  /**
   * Monitor processes using ports
   */
  monitorProcesses() {
    try {
      const currentEnv = this.portManager.currentEnvironment;
      const envConfig = this.portManager.getEnvironmentConfig(currentEnv);
      
      const processInfo = {};
      
      for (const [serviceName, port] of Object.entries(envConfig.services)) {
        try {
          const result = execSync(`lsof -ti:${port}`, {
            encoding: 'utf8',
            stdio: 'pipe',
            timeout: 5000
          });
          
          if (result.trim()) {
            const pid = result.trim().split('\n')[0];
            const processDetails = this.getProcessDetails(pid);
            processInfo[serviceName] = {
              port: port,
              pid: pid,
              ...processDetails
            };
          }
        } catch (error) {
          // Port not in use
          processInfo[serviceName] = {
            port: port,
            status: 'not_running'
          };
        }
      }
      
      this.recordProcessInfo(currentEnv, processInfo);
      
    } catch (error) {
      console.error(`❌ Process monitoring failed: ${error.message}`);
      this.recordError('process_monitoring', error);
    }
  }

  /**
   * Get detailed process information
   */
  getProcessDetails(pid) {
    try {
      const psResult = execSync(`ps -p ${pid} -o pid,ppid,user,command --no-headers`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      const [, ppid, user, command] = psResult.trim().split(/\s+/, 4);
      
      return {
        pid: parseInt(pid),
        ppid: parseInt(ppid),
        user: user,
        command: command,
        status: 'running'
      };
    } catch (error) {
      return {
        pid: parseInt(pid),
        status: 'unknown',
        error: error.message
      };
    }
  }

  /**
   * Record process information
   */
  recordProcessInfo(environment, processInfo) {
    const envMetrics = this.metrics.get(environment);
    if (envMetrics) {
      envMetrics.processes = {
        timestamp: new Date().toISOString(),
        services: processInfo
      };
    }
  }

  /**
   * Start resource tracking
   */
  startResourceTracking() {
    const intervalId = setInterval(() => {
      this.trackResources();
    }, this.config.intervals.metrics_collection);
    
    this.monitoringIntervals.set('resource_tracking', intervalId);
    console.log('📈 Resource tracking started');
  }

  /**
   * Track system resources
   */
  trackResources() {
    try {
      const resources = {
        timestamp: new Date().toISOString(),
        memory: this.getMemoryUsage(),
        cpu: this.getCpuUsage(),
        network: this.getNetworkStats(),
        disk: this.getDiskUsage()
      };
      
      this.recordResourceMetrics(resources);
      
    } catch (error) {
      console.error(`❌ Resource tracking failed: ${error.message}`);
      this.recordError('resource_tracking', error);
    }
  }

  /**
   * Get memory usage
   */
  getMemoryUsage() {
    const memInfo = process.memoryUsage();
    return {
      rss: memInfo.rss,
      heap_total: memInfo.heapTotal,
      heap_used: memInfo.heapUsed,
      external: memInfo.external,
      array_buffers: memInfo.arrayBuffers
    };
  }

  /**
   * Get CPU usage
   */
  getCpuUsage() {
    const cpuUsage = process.cpuUsage();
    return {
      user: cpuUsage.user,
      system: cpuUsage.system
    };
  }

  /**
   * Get network statistics
   */
  getNetworkStats() {
    try {
      // This is a simplified version - in production, you'd want more detailed network stats
      const netstat = execSync('netstat -i | tail -n +3', {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      return {
        interfaces: netstat.trim().split('\n').length,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Get disk usage
   */
  getDiskUsage() {
    try {
      const df = execSync('df -h /', {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      const lines = df.trim().split('\n');
      if (lines.length > 1) {
        const [, size, used, available, percent] = lines[1].split(/\s+/);
        return {
          size: size,
          used: used,
          available: available,
          percent: percent
        };
      }
    } catch (error) {
      return {
        error: error.message
      };
    }
  }

  /**
   * Record resource metrics
   */
  recordResourceMetrics(resources) {
    const currentEnv = this.portManager.currentEnvironment;
    const envMetrics = this.metrics.get(currentEnv);
    
    if (envMetrics) {
      if (!envMetrics.resources) {
        envMetrics.resources = [];
      }
      
      envMetrics.resources.push(resources);
      
      // Keep only recent metrics
      const cutoff = Date.now() - (this.config.retention.metrics_hours * 60 * 60 * 1000);
      envMetrics.resources = envMetrics.resources.filter(
        metric => new Date(metric.timestamp).getTime() > cutoff
      );
    }
  }

  /**
   * Start performance monitoring
   */
  startPerformanceMonitoring() {
    const intervalId = setInterval(() => {
      this.measurePerformance();
    }, this.config.intervals.health_check);
    
    this.monitoringIntervals.set('performance_monitoring', intervalId);
    console.log('⚡ Performance monitoring started');
  }

  /**
   * Measure system performance
   */
  measurePerformance() {
    const startTime = Date.now();
    
    try {
      // Measure port manager response time
      const testPort = this.portManager.getServicePort('api');
      const responseTime = Date.now() - startTime;
      
      this.performanceMetrics.response_times.push(responseTime);
      
      // Keep only recent measurements
      if (this.performanceMetrics.response_times.length > 100) {
        this.performanceMetrics.response_times = this.performanceMetrics.response_times.slice(-100);
      }
      
      // Check response time thresholds
      if (responseTime >= this.config.thresholds.response_time.critical) {
        this.generateAlert('critical', 'slow_response', {
          message: `Critical response time: ${responseTime}ms`,
          response_time: responseTime,
          threshold: this.config.thresholds.response_time.critical
        });
      } else if (responseTime >= this.config.thresholds.response_time.warning) {
        this.generateAlert('warning', 'slow_response', {
          message: `Slow response time: ${responseTime}ms`,
          response_time: responseTime,
          threshold: this.config.thresholds.response_time.warning
        });
      }
      
    } catch (error) {
      this.recordError('performance_monitoring', error);
    }
  }

  /**
   * Start security monitoring
   */
  startSecurityMonitoring() {
    const intervalId = setInterval(() => {
      this.monitorSecurity();
    }, this.config.intervals.environment_check);
    
    this.monitoringIntervals.set('security_monitoring', intervalId);
    console.log('🔒 Security monitoring started');
  }

  /**
   * Monitor security aspects
   */
  monitorSecurity() {
    try {
      const securityStatus = {
        timestamp: new Date().toISOString(),
        environment: this.portManager.currentEnvironment,
        checks: []
      };
      
      // Check for unauthorized port access
      this.checkUnauthorizedPortAccess(securityStatus);
      
      // Check file permissions
      this.checkFilePermissions(securityStatus);
      
      // Check process ownership
      this.checkProcessOwnership(securityStatus);
      
      this.recordSecurityStatus(securityStatus);
      
    } catch (error) {
      console.error(`❌ Security monitoring failed: ${error.message}`);
      this.recordError('security_monitoring', error);
    }
  }

  /**
   * Check for unauthorized port access
   */
  checkUnauthorizedPortAccess(securityStatus) {
    const currentEnv = this.portManager.currentEnvironment;
    const envConfig = this.portManager.getEnvironmentConfig(currentEnv);
    
    // Check for processes using ports outside the environment range
    try {
      const result = execSync(`lsof -i -P -n | grep LISTEN`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      const lines = result.trim().split('\n');
      const unauthorizedPorts = [];
      
      for (const line of lines) {
        const match = line.match(/:(\d+)\s+\(LISTEN\)/);
        if (match) {
          const port = parseInt(match[1]);
          if (port < envConfig.range.start || port > envConfig.range.end) {
            // Check if it's a system port or allowed port
            if (port > 1024 && !this.isSystemPort(port)) {
              unauthorizedPorts.push(port);
            }
          }
        }
      }
      
      if (unauthorizedPorts.length > 0) {
        securityStatus.checks.push({
          type: 'unauthorized_port_access',
          status: 'warning',
          message: `Unauthorized ports detected: ${unauthorizedPorts.join(', ')}`,
          ports: unauthorizedPorts
        });
      }
      
    } catch (error) {
      securityStatus.checks.push({
        type: 'unauthorized_port_access',
        status: 'error',
        message: `Failed to check unauthorized ports: ${error.message}`
      });
    }
  }

  /**
   * Check if port is a system port
   */
  isSystemPort(port) {
    const systemPorts = [22, 25, 53, 80, 110, 143, 443, 993, 995];
    return systemPorts.includes(port) || port < 1024;
  }

  /**
   * Check file permissions
   */
  checkFilePermissions(securityStatus) {
    const sensitiveFiles = [
      'secrets/jwt-private-key.pem',
      'secrets/jwt-public-key.pem',
      '.env'
    ];
    
    for (const file of sensitiveFiles) {
      const filePath = path.join(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        try {
          const stats = fs.statSync(filePath);
          const mode = stats.mode & parseInt('777', 8);
          
          if (mode & parseInt('044', 8)) {
            securityStatus.checks.push({
              type: 'file_permissions',
              status: 'warning',
              message: `File ${file} has overly permissive permissions`,
              file: file,
              permissions: mode.toString(8)
            });
          }
        } catch (error) {
          securityStatus.checks.push({
            type: 'file_permissions',
            status: 'error',
            message: `Failed to check permissions for ${file}: ${error.message}`
          });
        }
      }
    }
  }

  /**
   * Check process ownership
   */
  checkProcessOwnership(securityStatus) {
    const currentUser = process.env.USER || process.env.USERNAME || 'unknown';
    const isRoot = currentUser === 'root' || process.getuid?.() === 0;
    
    if (isRoot && this.portManager.currentEnvironment !== 'production') {
      securityStatus.checks.push({
        type: 'process_ownership',
        status: 'warning',
        message: 'Running as root in non-production environment',
        user: currentUser,
        environment: this.portManager.currentEnvironment
      });
    }
  }

  /**
   * Record security status
   */
  recordSecurityStatus(securityStatus) {
    const envMetrics = this.metrics.get(securityStatus.environment);
    if (envMetrics) {
      envMetrics.security = securityStatus;
      
      // Generate alerts for security issues
      for (const check of securityStatus.checks) {
        if (check.status === 'warning' || check.status === 'error') {
          this.generateAlert(check.status === 'error' ? 'critical' : 'warning', 'security_issue', {
            message: check.message,
            check_type: check.type,
            environment: securityStatus.environment
          });
        }
      }
    }
  }

  /**
   * Start compliance checking
   */
  startComplianceChecking() {
    const intervalId = setInterval(() => {
      this.checkCompliance();
    }, this.config.intervals.conflict_detection);
    
    this.monitoringIntervals.set('compliance_checking', intervalId);
    console.log('📋 Compliance checking started');
  }

  /**
   * Check environment compliance
   */
  checkCompliance() {
    try {
      const currentEnv = this.portManager.currentEnvironment;
      const validation = this.isolationValidator.validateEnvironmentIsolation(currentEnv);
      
      const complianceStatus = {
        timestamp: new Date().toISOString(),
        environment: currentEnv,
        status: validation.status,
        violations: validation.violations,
        warnings: validation.warnings,
        checks_performed: validation.checks_performed
      };
      
      this.recordComplianceStatus(complianceStatus);
      
    } catch (error) {
      console.error(`❌ Compliance checking failed: ${error.message}`);
      this.recordError('compliance_checking', error);
    }
  }

  /**
   * Record compliance status
   */
  recordComplianceStatus(complianceStatus) {
    const envMetrics = this.metrics.get(complianceStatus.environment);
    if (envMetrics) {
      envMetrics.compliance = complianceStatus;
      
      // Generate alerts for compliance violations
      if (complianceStatus.violations.length > 0) {
        this.generateAlert('critical', 'compliance_violation', {
          message: `Compliance violations detected: ${complianceStatus.violations.length}`,
          environment: complianceStatus.environment,
          violations: complianceStatus.violations
        });
      }
    }
  }

  /**
   * Start report generation
   */
  startReportGeneration() {
    const intervalId = setInterval(() => {
      this.generateReport();
    }, this.config.intervals.report_generation);
    
    this.monitoringIntervals.set('report_generation', intervalId);
    console.log('📊 Report generation started');
  }

  /**
   * Generate monitoring report
   */
  generateReport() {
    try {
      const report = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        period: {
          start: new Date(Date.now() - this.config.intervals.report_generation).toISOString(),
          end: new Date().toISOString()
        },
        environments: {},
        summary: {},
        alerts: this.getRecentAlerts(),
        performance: this.getPerformanceSummary()
      };
      
      // Generate environment-specific reports
      for (const [env, metrics] of this.metrics.entries()) {
        report.environments[env] = this.generateEnvironmentReport(env, metrics);
      }
      
      // Generate summary
      report.summary = this.generateReportSummary(report);
      
      // Store report
      this.storeReport(report);
      
      console.log(`📊 Generated monitoring report: ${report.id}`);
      
    } catch (error) {
      console.error(`❌ Report generation failed: ${error.message}`);
      this.recordError('report_generation', error);
    }
  }

  /**
   * Generate environment-specific report
   */
  generateEnvironmentReport(environment, metrics) {
    return {
      environment: environment,
      status: metrics.health_status || 'unknown',
      last_check: metrics.last_check,
      port_utilization: this.getLatestPortUtilization(metrics),
      conflicts: this.getRecentConflicts(metrics),
      violations: this.getRecentViolations(metrics),
      processes: metrics.processes,
      resources: this.getLatestResources(metrics),
      security: metrics.security,
      compliance: metrics.compliance
    };
  }

  /**
   * Get latest port utilization
   */
  getLatestPortUtilization(metrics) {
    if (metrics.port_usage && metrics.port_usage.length > 0) {
      return metrics.port_usage[metrics.port_usage.length - 1];
    }
    return null;
  }

  /**
   * Get recent conflicts
   */
  getRecentConflicts(metrics) {
    const cutoff = Date.now() - (60 * 60 * 1000); // Last hour
    return (metrics.conflicts || []).filter(
      conflict => new Date(conflict.timestamp).getTime() > cutoff
    );
  }

  /**
   * Get recent violations
   */
  getRecentViolations(metrics) {
    const cutoff = Date.now() - (60 * 60 * 1000); // Last hour
    return (metrics.violations || []).filter(
      violation => new Date(violation.timestamp).getTime() > cutoff
    );
  }

  /**
   * Get latest resources
   */
  getLatestResources(metrics) {
    if (metrics.resources && metrics.resources.length > 0) {
      return metrics.resources[metrics.resources.length - 1];
    }
    return null;
  }

  /**
   * Generate report summary
   */
  generateReportSummary(report) {
    const summary = {
      total_environments: Object.keys(report.environments).length,
      healthy_environments: 0,
      total_alerts: report.alerts.length,
      critical_alerts: 0,
      warning_alerts: 0,
      total_violations: 0,
      total_conflicts: 0,
      average_utilization: 0
    };
    
    let totalUtilization = 0;
    let utilizationCount = 0;
    
    for (const [env, envReport] of Object.entries(report.environments)) {
      if (envReport.status === 'healthy') {
        summary.healthy_environments++;
      }
      
      if (envReport.violations) {
        summary.total_violations += envReport.violations.length;
      }
      
      if (envReport.conflicts) {
        summary.total_conflicts += envReport.conflicts.length;
      }
      
      if (envReport.port_utilization && envReport.port_utilization.utilization) {
        totalUtilization += envReport.port_utilization.utilization;
        utilizationCount++;
      }
    }
    
    if (utilizationCount > 0) {
      summary.average_utilization = Math.round((totalUtilization / utilizationCount) * 100) / 100;
    }
    
    for (const alert of report.alerts) {
      if (alert.severity === 'critical') {
        summary.critical_alerts++;
      } else if (alert.severity === 'warning') {
        summary.warning_alerts++;
      }
    }
    
    return summary;
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts() {
    const cutoff = Date.now() - this.config.intervals.report_generation;
    return this.alerts.filter(
      alert => new Date(alert.timestamp).getTime() > cutoff
    );
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary() {
    const scanTimes = this.performanceMetrics.scan_times;
    const responseTimes = this.performanceMetrics.response_times;
    
    return {
      average_scan_time: scanTimes.length > 0 ? 
        Math.round(scanTimes.reduce((a, b) => a + b, 0) / scanTimes.length) : 0,
      average_response_time: responseTimes.length > 0 ? 
        Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) : 0,
      total_scans: scanTimes.length,
      error_count: Array.from(this.performanceMetrics.error_counts.values())
        .reduce((a, b) => a + b, 0)
    };
  }

  /**
   * Store report
   */
  storeReport(report) {
    this.reports.push(report);
    
    // Keep only recent reports
    const cutoff = Date.now() - (this.config.retention.reports_days * 24 * 60 * 60 * 1000);
    this.reports = this.reports.filter(
      r => new Date(r.timestamp).getTime() > cutoff
    );
    
    // Optionally write to file
    if (this.config.alerting.file) {
      this.writeReportToFile(report);
    }
  }

  /**
   * Write report to file
   */
  writeReportToFile(report) {
    try {
      const reportsDir = path.join(process.cwd(), 'reports');
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }
      
      const filename = `monitoring-report-${report.timestamp.replace(/[:.]/g, '-')}.json`;
      const filepath = path.join(reportsDir, filename);
      
      fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
      console.log(`📊 Report saved to: ${filepath}`);
      
    } catch (error) {
      console.error(`❌ Failed to write report to file: ${error.message}`);
    }
  }

  /**
   * Generate alert
   */
  generateAlert(severity, type, details) {
    const alert = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      severity: severity,
      type: type,
      ...details
    };
    
    this.alerts.push(alert);
    
    // Keep only recent alerts
    const cutoff = Date.now() - (this.config.retention.alerts_days * 24 * 60 * 60 * 1000);
    this.alerts = this.alerts.filter(
      a => new Date(a.timestamp).getTime() > cutoff
    );
    
    // Emit alert event
    this.emit(severity === 'critical' ? 'critical' : 'alert', alert);
    
    return alert;
  }

  /**
   * Handle alert
   */
  handleAlert(alert) {
    if (this.config.alerting.console) {
      const icon = alert.severity === 'critical' ? '🚨' : '⚠️';
      console.log(`${icon} ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`);
    }
    
    if (this.config.alerting.file) {
      this.writeAlertToFile(alert);
    }
  }

  /**
   * Handle critical alert
   */
  handleCriticalAlert(alert) {
    console.error(`🚨 CRITICAL ALERT: ${alert.message}`);
    
    // Additional handling for critical alerts
    if (this.config.alerting.file) {
      this.writeAlertToFile(alert);
    }
  }

  /**
   * Write alert to file
   */
  writeAlertToFile(alert) {
    try {
      const alertsDir = path.join(process.cwd(), 'logs', 'alerts');
      if (!fs.existsSync(alertsDir)) {
        fs.mkdirSync(alertsDir, { recursive: true });
      }
      
      const filename = `alerts-${new Date().toISOString().split('T')[0]}.log`;
      const filepath = path.join(alertsDir, filename);
      
      const logEntry = `${alert.timestamp} [${alert.severity.toUpperCase()}] ${alert.type}: ${alert.message}\n`;
      fs.appendFileSync(filepath, logEntry);
      
    } catch (error) {
      console.error(`❌ Failed to write alert to file: ${error.message}`);
    }
  }

  /**
   * Record environment change
   */
  recordEnvironmentChange(data) {
    const envMetrics = this.metrics.get(data.current);
    if (envMetrics) {
      if (!envMetrics.environment_changes) {
        envMetrics.environment_changes = [];
      }
      
      envMetrics.environment_changes.push({
        timestamp: data.timestamp,
        from: data.previous,
        to: data.current
      });
    }
  }

  /**
   * Handle conflicts detected
   */
  handleConflictsDetected(conflicts) {
    const currentEnv = this.portManager.currentEnvironment;
    const envMetrics = this.metrics.get(currentEnv);
    
    if (envMetrics) {
      if (!envMetrics.conflicts) {
        envMetrics.conflicts = [];
      }
      
      for (const conflict of conflicts) {
        envMetrics.conflicts.push({
          timestamp: new Date().toISOString(),
          ...conflict
        });
      }
    }
  }

  /**
   * Record isolation validation
   */
  recordIsolationValidation(validation) {
    const envMetrics = this.metrics.get(validation.target_environment);
    if (envMetrics) {
      if (!envMetrics.violations) {
        envMetrics.violations = [];
      }
      
      if (validation.violations && validation.violations.length > 0) {
        for (const violation of validation.violations) {
          envMetrics.violations.push({
            timestamp: validation.timestamp,
            ...violation
          });
        }
      }
    }
  }

  /**
   * Record error
   */
  recordError(component, error) {
    const errorCount = this.performanceMetrics.error_counts.get(component) || 0;
    this.performanceMetrics.error_counts.set(component, errorCount + 1);
    
    console.error(`❌ ${component} error: ${error.message}`);
  }

  /**
   * Get monitoring status
   */
  getMonitoringStatus() {
    return {
      timestamp: new Date().toISOString(),
      is_monitoring: this.isMonitoring,
      active_intervals: Array.from(this.monitoringIntervals.keys()),
      metrics_collected: this.metrics.size,
      alerts_count: this.alerts.length,
      reports_count: this.reports.length,
      last_scan: this.lastScan?.timestamp || null,
      performance: this.getPerformanceSummary(),
      config: this.config
    };
  }

  /**
   * Get latest report
   */
  getLatestReport() {
    return this.reports.length > 0 ? this.reports[this.reports.length - 1] : null;
  }

  /**
   * Get environment metrics
   */
  getEnvironmentMetrics(environment) {
    return this.metrics.get(environment) || null;
  }

  /**
   * Cleanup monitoring resources
   */
  cleanup() {
    this.stopMonitoring();
    this.metrics.clear();
    this.alerts = [];
    this.reports = [];
    this.performanceMetrics = {
      scan_times: [],
      response_times: [],
      error_counts: new Map(),
      success_rates: new Map()
    };
  }
}

export default EnvironmentPortMonitor;
export { MONITORING_CONFIG };
