/**
 * Truxe Advanced Conflict Avoidance System
 * 
 * Comprehensive conflict prevention and resolution system that uses predictive
 * algorithms, real-time monitoring, and intelligent decision-making to avoid
 * port conflicts before they occur.
 * 
 * @author DevOps Engineering Team
 * @version 3.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import EventEmitter from 'events';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Conflict Severity Levels
 */
const CONFLICT_SEVERITY = {
  CRITICAL: {
    level: 4,
    name: 'Critical',
    description: 'Immediate action required - service cannot start',
    color: 'red',
    action_required: true
  },
  HIGH: {
    level: 3,
    name: 'High',
    description: 'High probability of conflict - should be resolved soon',
    color: 'orange',
    action_required: true
  },
  MEDIUM: {
    level: 2,
    name: 'Medium',
    description: 'Potential conflict - monitor and plan resolution',
    color: 'yellow',
    action_required: false
  },
  LOW: {
    level: 1,
    name: 'Low',
    description: 'Minor risk - informational only',
    color: 'blue',
    action_required: false
  },
  NONE: {
    level: 0,
    name: 'None',
    description: 'No conflict detected',
    color: 'green',
    action_required: false
  }
};

/**
 * Conflict Types
 */
const CONFLICT_TYPES = {
  PORT_IN_USE: {
    name: 'Port In Use',
    description: 'Port is currently occupied by another process',
    detection_method: 'runtime',
    resolution_strategies: ['kill_process', 'change_port', 'wait_for_release']
  },
  RESERVED_PORT: {
    name: 'Reserved Port',
    description: 'Port is in a reserved system range',
    detection_method: 'static',
    resolution_strategies: ['change_port', 'request_permission']
  },
  DUPLICATE_ASSIGNMENT: {
    name: 'Duplicate Assignment',
    description: 'Multiple services assigned to the same port',
    detection_method: 'configuration',
    resolution_strategies: ['reassign_service', 'sequential_assignment']
  },
  RANGE_VIOLATION: {
    name: 'Range Violation',
    description: 'Port is outside allowed environment range',
    detection_method: 'validation',
    resolution_strategies: ['change_port', 'expand_range']
  },
  DEPENDENCY_CONFLICT: {
    name: 'Dependency Conflict',
    description: 'Port conflicts with service dependencies',
    detection_method: 'analysis',
    resolution_strategies: ['reorder_services', 'change_dependencies']
  },
  FUTURE_CONFLICT: {
    name: 'Future Conflict',
    description: 'Predicted conflict based on usage patterns',
    detection_method: 'predictive',
    resolution_strategies: ['preemptive_change', 'monitor_closely']
  }
};

/**
 * Advanced Conflict Avoidance Engine
 */
export class AdvancedConflictAvoidance extends EventEmitter {
  constructor() {
    super();
    
    this.dataPath = path.join(__dirname, '../data/conflict-avoidance');
    this.historyPath = path.join(this.dataPath, 'conflict-history.json');
    this.patternsPath = path.join(this.dataPath, 'conflict-patterns.json');
    this.predictionsPath = path.join(this.dataPath, 'conflict-predictions.json');
    this.resolutionPath = path.join(this.dataPath, 'resolution-strategies.json');
    
    this.conflictHistory = new Map();
    this.conflictPatterns = new Map();
    this.activePredictions = new Map();
    this.resolutionStrategies = new Map();
    this.monitoringActive = false;
    
    this.config = {
      prediction_window: 3600000, // 1 hour
      monitoring_interval: 30000,  // 30 seconds
      pattern_learning: true,
      auto_resolution: false,
      notification_threshold: CONFLICT_SEVERITY.MEDIUM.level,
      max_history_entries: 10000
    };
    
    this.init();
  }

  /**
   * Initialize the conflict avoidance system
   */
  async init() {
    try {
      await this.ensureDataDirectory();
      await this.loadHistoricalData();
      await this.loadConflictPatterns();
      await this.loadPredictions();
      await this.loadResolutionStrategies();
      
      console.log('🛡️  Advanced Conflict Avoidance System initialized');
      this.emit('initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Conflict Avoidance System:', error.message);
      throw error;
    }
  }

  /**
   * Ensure data directory exists
   */
  async ensureDataDirectory() {
    try {
      await fs.access(this.dataPath);
    } catch {
      await fs.mkdir(this.dataPath, { recursive: true });
    }
  }

  /**
   * Load historical conflict data
   */
  async loadHistoricalData() {
    try {
      const data = await fs.readFile(this.historyPath, 'utf8');
      const history = JSON.parse(data);
      
      for (const [key, value] of Object.entries(history)) {
        this.conflictHistory.set(key, value);
      }
      
      console.log(`📚 Loaded ${this.conflictHistory.size} conflict history records`);
    } catch (error) {
      console.log('📚 No conflict history found, starting fresh');
    }
  }

  /**
   * Load conflict patterns
   */
  async loadConflictPatterns() {
    try {
      const data = await fs.readFile(this.patternsPath, 'utf8');
      const patterns = JSON.parse(data);
      
      for (const [key, value] of Object.entries(patterns)) {
        this.conflictPatterns.set(key, value);
      }
      
      console.log(`🔍 Loaded ${this.conflictPatterns.size} conflict patterns`);
    } catch (error) {
      console.log('🔍 No conflict patterns found, starting fresh');
    }
  }

  /**
   * Load predictions
   */
  async loadPredictions() {
    try {
      const data = await fs.readFile(this.predictionsPath, 'utf8');
      const predictions = JSON.parse(data);
      
      for (const [key, value] of Object.entries(predictions)) {
        this.activePredictions.set(key, value);
      }
      
      console.log(`🔮 Loaded ${this.activePredictions.size} active predictions`);
    } catch (error) {
      console.log('🔮 No predictions found, starting fresh');
    }
  }

  /**
   * Load resolution strategies
   */
  async loadResolutionStrategies() {
    try {
      const data = await fs.readFile(this.resolutionPath, 'utf8');
      const strategies = JSON.parse(data);
      
      for (const [key, value] of Object.entries(strategies)) {
        this.resolutionStrategies.set(key, value);
      }
      
      console.log(`🔧 Loaded ${this.resolutionStrategies.size} resolution strategies`);
    } catch (error) {
      console.log('🔧 No resolution strategies found, using defaults');
      this.initializeDefaultStrategies();
    }
  }

  /**
   * Initialize default resolution strategies
   */
  initializeDefaultStrategies() {
    const defaultStrategies = {
      'kill_process': {
        name: 'Kill Process',
        description: 'Terminate the process using the conflicted port',
        risk_level: 'high',
        success_rate: 0.9,
        execution_time: 5000,
        prerequisites: ['process_identification', 'permission_check']
      },
      'change_port': {
        name: 'Change Port',
        description: 'Assign a different port to the service',
        risk_level: 'low',
        success_rate: 0.95,
        execution_time: 2000,
        prerequisites: ['available_port_identification', 'configuration_update']
      },
      'wait_for_release': {
        name: 'Wait for Release',
        description: 'Wait for the current process to release the port',
        risk_level: 'low',
        success_rate: 0.7,
        execution_time: 30000,
        prerequisites: ['timeout_configuration']
      },
      'sequential_assignment': {
        name: 'Sequential Assignment',
        description: 'Start services in sequence to avoid conflicts',
        risk_level: 'medium',
        success_rate: 0.85,
        execution_time: 10000,
        prerequisites: ['dependency_analysis', 'startup_ordering']
      }
    };

    for (const [key, strategy] of Object.entries(defaultStrategies)) {
      this.resolutionStrategies.set(key, strategy);
    }
  }

  /**
   * Comprehensive conflict detection
   */
  async detectConflicts(environment = 'development', options = {}) {
    const {
      includeRuntime = true,
      includeConfiguration = true,
      includePredictive = true,
      includeSystemPorts = true
    } = options;

    console.log(`🔍 Running comprehensive conflict detection for ${environment}...`);

    const conflicts = {
      timestamp: Date.now(),
      environment,
      detection_methods: [],
      conflicts: [],
      predictions: [],
      summary: {
        total_conflicts: 0,
        critical_conflicts: 0,
        high_conflicts: 0,
        medium_conflicts: 0,
        low_conflicts: 0
      }
    };

    // Runtime conflict detection
    if (includeRuntime) {
      const runtimeConflicts = await this.detectRuntimeConflicts(environment);
      conflicts.conflicts.push(...runtimeConflicts);
      conflicts.detection_methods.push('runtime');
    }

    // Configuration conflict detection
    if (includeConfiguration) {
      const configConflicts = await this.detectConfigurationConflicts(environment);
      conflicts.conflicts.push(...configConflicts);
      conflicts.detection_methods.push('configuration');
    }

    // System port conflicts
    if (includeSystemPorts) {
      const systemConflicts = await this.detectSystemPortConflicts(environment);
      conflicts.conflicts.push(...systemConflicts);
      conflicts.detection_methods.push('system_ports');
    }

    // Predictive conflict detection
    if (includePredictive) {
      const predictiveConflicts = await this.detectPredictiveConflicts(environment);
      conflicts.predictions.push(...predictiveConflicts);
      conflicts.detection_methods.push('predictive');
    }

    // Calculate summary
    conflicts.summary.total_conflicts = conflicts.conflicts.length;
    
    for (const conflict of conflicts.conflicts) {
      switch (conflict.severity.level) {
        case CONFLICT_SEVERITY.CRITICAL.level:
          conflicts.summary.critical_conflicts++;
          break;
        case CONFLICT_SEVERITY.HIGH.level:
          conflicts.summary.high_conflicts++;
          break;
        case CONFLICT_SEVERITY.MEDIUM.level:
          conflicts.summary.medium_conflicts++;
          break;
        case CONFLICT_SEVERITY.LOW.level:
          conflicts.summary.low_conflicts++;
          break;
      }
    }

    // Record conflicts for learning
    await this.recordConflictDetection(conflicts);

    // Emit events for high-severity conflicts
    if (conflicts.summary.critical_conflicts > 0 || conflicts.summary.high_conflicts > 0) {
      this.emit('high_severity_conflicts', conflicts);
    }

    return conflicts;
  }

  /**
   * Detect runtime conflicts (ports currently in use)
   */
  async detectRuntimeConflicts(environment) {
    const conflicts = [];
    
    try {
      // Get configured ports for environment
      const { default: portManager } = await import('./ports.js');
      const envConfig = portManager.getEnvironmentConfig(environment);
      
      for (const [serviceName, port] of Object.entries(envConfig.services)) {
        const isAvailable = portManager.isPortAvailable(port);
        
        if (!isAvailable) {
          const processInfo = await this.getPortProcessInfo(port);
          
          conflicts.push({
            id: crypto.randomUUID(),
            type: CONFLICT_TYPES.PORT_IN_USE,
            severity: CONFLICT_SEVERITY.HIGH,
            port,
            service: serviceName,
            environment,
            description: `Port ${port} is in use by ${processInfo.name || 'unknown process'}`,
            process_info: processInfo,
            detected_at: Date.now(),
            resolution_strategies: this.getApplicableStrategies('PORT_IN_USE'),
            auto_resolvable: processInfo.killable || false
          });
        }
      }
    } catch (error) {
      console.error('Error detecting runtime conflicts:', error.message);
    }
    
    return conflicts;
  }

  /**
   * Detect configuration conflicts (duplicate assignments, range violations)
   */
  async detectConfigurationConflicts(environment) {
    const conflicts = [];
    
    try {
      const { default: portManager } = await import('./ports.js');
      const envConfig = portManager.getEnvironmentConfig(environment);
      
      // Check for duplicate port assignments
      const portUsage = {};
      for (const [serviceName, port] of Object.entries(envConfig.services)) {
        if (portUsage[port]) {
          portUsage[port].push(serviceName);
        } else {
          portUsage[port] = [serviceName];
        }
      }

      for (const [port, services] of Object.entries(portUsage)) {
        if (services.length > 1) {
          conflicts.push({
            id: crypto.randomUUID(),
            type: CONFLICT_TYPES.DUPLICATE_ASSIGNMENT,
            severity: CONFLICT_SEVERITY.CRITICAL,
            port: parseInt(port),
            services,
            environment,
            description: `Port ${port} is assigned to multiple services: ${services.join(', ')}`,
            detected_at: Date.now(),
            resolution_strategies: this.getApplicableStrategies('DUPLICATE_ASSIGNMENT'),
            auto_resolvable: true
          });
        }
      }

      // Check for range violations
      for (const [serviceName, port] of Object.entries(envConfig.services)) {
        if (port < envConfig.range.start || port > envConfig.range.end) {
          conflicts.push({
            id: crypto.randomUUID(),
            type: CONFLICT_TYPES.RANGE_VIOLATION,
            severity: CONFLICT_SEVERITY.MEDIUM,
            port,
            service: serviceName,
            environment,
            description: `Port ${port} for ${serviceName} is outside allowed range ${envConfig.range.start}-${envConfig.range.end}`,
            expected_range: envConfig.range,
            detected_at: Date.now(),
            resolution_strategies: this.getApplicableStrategies('RANGE_VIOLATION'),
            auto_resolvable: true
          });
        }
      }
    } catch (error) {
      console.error('Error detecting configuration conflicts:', error.message);
    }
    
    return conflicts;
  }

  /**
   * Detect system port conflicts (reserved ranges)
   */
  async detectSystemPortConflicts(environment) {
    const conflicts = [];
    
    try {
      const { default: portManager } = await import('./ports.js');
      const envConfig = portManager.getEnvironmentConfig(environment);
      
      for (const [serviceName, port] of Object.entries(envConfig.services)) {
        if (portManager.isPortReserved(port)) {
          const reservedRange = portManager.config.conflict_detection.reserved_ranges.find(
            range => port >= range.start && port <= range.end
          );
          
          conflicts.push({
            id: crypto.randomUUID(),
            type: CONFLICT_TYPES.RESERVED_PORT,
            severity: CONFLICT_SEVERITY.HIGH,
            port,
            service: serviceName,
            environment,
            description: `Port ${port} for ${serviceName} is in reserved range: ${reservedRange?.description || 'System reserved'}`,
            reserved_range: reservedRange,
            detected_at: Date.now(),
            resolution_strategies: this.getApplicableStrategies('RESERVED_PORT'),
            auto_resolvable: true
          });
        }
      }
    } catch (error) {
      console.error('Error detecting system port conflicts:', error.message);
    }
    
    return conflicts;
  }

  /**
   * Detect predictive conflicts based on patterns and trends
   */
  async detectPredictiveConflicts(environment) {
    const predictions = [];
    
    try {
      // Analyze historical conflict patterns
      const patterns = await this.analyzeConflictPatterns(environment);
      
      // Check for services that historically have conflicts
      for (const pattern of patterns) {
        if (pattern.probability > 0.7) { // 70% probability threshold
          predictions.push({
            id: crypto.randomUUID(),
            type: CONFLICT_TYPES.FUTURE_CONFLICT,
            severity: this.calculatePredictiveSeverity(pattern.probability),
            service: pattern.service,
            port: pattern.port,
            environment,
            description: `Predicted conflict for ${pattern.service} on port ${pattern.port} (${Math.round(pattern.probability * 100)}% probability)`,
            probability: pattern.probability,
            pattern_data: pattern,
            predicted_time: Date.now() + pattern.estimated_time_to_conflict,
            resolution_strategies: this.getApplicableStrategies('FUTURE_CONFLICT'),
            auto_resolvable: false
          });
        }
      }

      // Check for resource exhaustion patterns
      const resourcePredictions = await this.predictResourceExhaustion(environment);
      predictions.push(...resourcePredictions);

    } catch (error) {
      console.error('Error detecting predictive conflicts:', error.message);
    }
    
    return predictions;
  }

  /**
   * Get process information for a port
   */
  async getPortProcessInfo(port) {
    try {
      const result = execSync(`lsof -ti:${port}`, { encoding: 'utf8', timeout: 5000 });
      const pids = result.trim().split('\n').filter(pid => pid);
      
      if (pids.length > 0) {
        const pid = parseInt(pids[0]);
        const processInfo = execSync(`ps -p ${pid} -o pid,ppid,comm,args --no-headers`, {
          encoding: 'utf8',
          timeout: 2000
        });
        
        const [pidStr, ppid, comm, ...args] = processInfo.trim().split(/\s+/);
        
        return {
          pid,
          ppid: parseInt(ppid),
          name: comm,
          command: args.join(' '),
          killable: this.isProcessKillable(comm),
          system_process: this.isSystemProcess(comm)
        };
      }
    } catch (error) {
      // Process might have ended or lsof not available
    }
    
    return {
      pid: null,
      name: 'unknown',
      killable: false,
      system_process: false
    };
  }

  /**
   * Check if process can be safely killed
   */
  isProcessKillable(processName) {
    const unkillableProcesses = [
      'systemd', 'kernel', 'init', 'kthreadd', 'ksoftirqd',
      'migration', 'rcu_', 'watchdog', 'sshd', 'networkd'
    ];
    
    return !unkillableProcesses.some(name => processName.includes(name));
  }

  /**
   * Check if process is a system process
   */
  isSystemProcess(processName) {
    const systemProcesses = [
      'systemd', 'kernel', 'init', 'kthreadd', 'ksoftirqd',
      'migration', 'rcu_', 'watchdog', 'networkd', 'dbus'
    ];
    
    return systemProcesses.some(name => processName.includes(name));
  }

  /**
   * Get applicable resolution strategies for conflict type
   */
  getApplicableStrategies(conflictType) {
    const conflictTypeInfo = CONFLICT_TYPES[conflictType];
    if (!conflictTypeInfo) return [];
    
    return conflictTypeInfo.resolution_strategies.map(strategyName => {
      const strategy = this.resolutionStrategies.get(strategyName);
      return strategy ? { name: strategyName, ...strategy } : null;
    }).filter(Boolean);
  }

  /**
   * Analyze conflict patterns for predictive detection
   */
  async analyzeConflictPatterns(environment) {
    const patterns = [];
    
    // Analyze historical conflicts
    const environmentConflicts = Array.from(this.conflictHistory.values())
      .filter(conflict => conflict.environment === environment);

    if (environmentConflicts.length < 5) {
      return patterns; // Not enough data for pattern analysis
    }

    // Group conflicts by service and port
    const conflictGroups = {};
    
    for (const conflict of environmentConflicts) {
      const key = `${conflict.service}:${conflict.port}`;
      
      if (!conflictGroups[key]) {
        conflictGroups[key] = [];
      }
      
      conflictGroups[key].push(conflict);
    }

    // Analyze patterns for each group
    for (const [key, conflicts] of Object.entries(conflictGroups)) {
      const [service, port] = key.split(':');
      
      if (conflicts.length >= 3) { // Need at least 3 occurrences for pattern
        const pattern = this.calculateConflictPattern(conflicts);
        
        if (pattern.probability > 0.3) { // 30% minimum threshold
          patterns.push({
            service,
            port: parseInt(port),
            probability: pattern.probability,
            frequency: pattern.frequency,
            estimated_time_to_conflict: pattern.estimated_time_to_conflict,
            contributing_factors: pattern.contributing_factors
          });
        }
      }
    }

    return patterns;
  }

  /**
   * Calculate conflict pattern probability
   */
  calculateConflictPattern(conflicts) {
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    
    // Filter recent conflicts
    const recentConflicts = conflicts.filter(c => c.detected_at > thirtyDaysAgo);
    
    // Calculate frequency (conflicts per day)
    const frequency = recentConflicts.length / 30;
    
    // Calculate probability based on frequency and recency
    let probability = Math.min(frequency / 2, 1.0); // Max 2 conflicts per day = 100% probability
    
    // Adjust for recency
    const mostRecentConflict = Math.max(...recentConflicts.map(c => c.detected_at));
    const daysSinceLastConflict = (now - mostRecentConflict) / (24 * 60 * 60 * 1000);
    
    if (daysSinceLastConflict < 1) {
      probability *= 1.5; // Increase probability if very recent
    } else if (daysSinceLastConflict > 7) {
      probability *= 0.7; // Decrease probability if not recent
    }

    // Estimate time to next conflict
    const avgTimeBetweenConflicts = this.calculateAverageTimeBetweenConflicts(recentConflicts);
    const estimatedTimeToConflict = avgTimeBetweenConflicts || (7 * 24 * 60 * 60 * 1000); // Default to 7 days

    return {
      probability: Math.min(probability, 1.0),
      frequency,
      estimated_time_to_conflict: estimatedTimeToConflict,
      contributing_factors: this.identifyContributingFactors(conflicts)
    };
  }

  /**
   * Calculate average time between conflicts
   */
  calculateAverageTimeBetweenConflicts(conflicts) {
    if (conflicts.length < 2) return null;
    
    const sortedConflicts = conflicts.sort((a, b) => a.detected_at - b.detected_at);
    const intervals = [];
    
    for (let i = 1; i < sortedConflicts.length; i++) {
      intervals.push(sortedConflicts[i].detected_at - sortedConflicts[i - 1].detected_at);
    }
    
    return intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  }

  /**
   * Identify contributing factors to conflicts
   */
  identifyContributingFactors(conflicts) {
    const factors = [];
    
    // Analyze conflict types
    const typeFrequency = {};
    for (const conflict of conflicts) {
      const type = conflict.type.name;
      typeFrequency[type] = (typeFrequency[type] || 0) + 1;
    }
    
    const mostCommonType = Object.keys(typeFrequency).reduce((a, b) => 
      typeFrequency[a] > typeFrequency[b] ? a : b
    );
    
    factors.push(`Most common type: ${mostCommonType}`);
    
    // Analyze time patterns
    const hours = conflicts.map(c => new Date(c.detected_at).getHours());
    const hourFrequency = {};
    
    for (const hour of hours) {
      hourFrequency[hour] = (hourFrequency[hour] || 0) + 1;
    }
    
    const peakHour = Object.keys(hourFrequency).reduce((a, b) => 
      hourFrequency[a] > hourFrequency[b] ? a : b
    );
    
    factors.push(`Peak conflict time: ${peakHour}:00`);
    
    return factors;
  }

  /**
   * Predict resource exhaustion
   */
  async predictResourceExhaustion(environment) {
    const predictions = [];
    
    try {
      const { default: portManager } = await import('./ports.js');
      const utilization = portManager.calculatePortUtilization(environment);
      
      if (utilization > 80) {
        predictions.push({
          id: crypto.randomUUID(),
          type: CONFLICT_TYPES.FUTURE_CONFLICT,
          severity: CONFLICT_SEVERITY.MEDIUM,
          environment,
          description: `Port range utilization is ${utilization}% - approaching capacity`,
          probability: (utilization - 80) / 20, // 80% = 0%, 100% = 100%
          predicted_time: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
          resolution_strategies: [
            {
              name: 'expand_range',
              description: 'Expand the port range for this environment',
              risk_level: 'low',
              success_rate: 0.95
            }
          ],
          auto_resolvable: false
        });
      }
    } catch (error) {
      console.error('Error predicting resource exhaustion:', error.message);
    }
    
    return predictions;
  }

  /**
   * Calculate predictive severity based on probability
   */
  calculatePredictiveSeverity(probability) {
    if (probability >= 0.9) return CONFLICT_SEVERITY.HIGH;
    if (probability >= 0.7) return CONFLICT_SEVERITY.MEDIUM;
    if (probability >= 0.5) return CONFLICT_SEVERITY.LOW;
    return CONFLICT_SEVERITY.NONE;
  }

  /**
   * Record conflict detection for learning
   */
  async recordConflictDetection(conflictData) {
    const recordId = `detection_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    this.conflictHistory.set(recordId, {
      id: recordId,
      timestamp: conflictData.timestamp,
      environment: conflictData.environment,
      detection_methods: conflictData.detection_methods,
      total_conflicts: conflictData.summary.total_conflicts,
      critical_conflicts: conflictData.summary.critical_conflicts,
      high_conflicts: conflictData.summary.high_conflicts,
      conflicts: conflictData.conflicts.map(c => ({
        id: c.id,
        type: c.type.name,
        severity: c.severity.name,
        port: c.port,
        service: c.service,
        auto_resolvable: c.auto_resolvable
      }))
    });

    // Cleanup old entries
    if (this.conflictHistory.size > this.config.max_history_entries) {
      const entries = Array.from(this.conflictHistory.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toDelete = entries.slice(0, entries.length - this.config.max_history_entries);
      for (const [key] of toDelete) {
        this.conflictHistory.delete(key);
      }
    }

    // Trigger periodic save
    if (Math.random() < 0.1) { // 10% chance
      await this.saveData();
    }
  }

  /**
   * Resolve conflicts automatically
   */
  async resolveConflicts(conflicts, options = {}) {
    const {
      dryRun = false,
      strategy = 'auto',
      maxConcurrentResolutions = 3
    } = options;

    console.log(`🔧 Resolving ${conflicts.length} conflicts (dry run: ${dryRun})...`);

    const results = {
      timestamp: Date.now(),
      total_conflicts: conflicts.length,
      resolved_conflicts: 0,
      failed_resolutions: 0,
      skipped_conflicts: 0,
      resolutions: []
    };

    // Sort conflicts by severity (critical first)
    const sortedConflicts = conflicts.sort((a, b) => b.severity.level - a.severity.level);
    
    // Process conflicts in batches
    const batches = this.createResolutionBatches(sortedConflicts, maxConcurrentResolutions);
    
    for (const batch of batches) {
      const batchPromises = batch.map(conflict => 
        this.resolveConflict(conflict, { dryRun, strategy })
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      for (let i = 0; i < batchResults.length; i++) {
        const result = batchResults[i];
        const conflict = batch[i];
        
        if (result.status === 'fulfilled') {
          const resolution = result.value;
          results.resolutions.push(resolution);
          
          if (resolution.success) {
            results.resolved_conflicts++;
          } else {
            results.failed_resolutions++;
          }
        } else {
          results.failed_resolutions++;
          results.resolutions.push({
            conflict_id: conflict.id,
            success: false,
            error: result.reason.message,
            strategy_used: 'none'
          });
        }
      }
    }

    results.skipped_conflicts = results.total_conflicts - results.resolved_conflicts - results.failed_resolutions;

    // Record resolution results
    await this.recordResolutionResults(results);

    return results;
  }

  /**
   * Create resolution batches to avoid overwhelming the system
   */
  createResolutionBatches(conflicts, batchSize) {
    const batches = [];
    
    for (let i = 0; i < conflicts.length; i += batchSize) {
      batches.push(conflicts.slice(i, i + batchSize));
    }
    
    return batches;
  }

  /**
   * Resolve a single conflict
   */
  async resolveConflict(conflict, options = {}) {
    const { dryRun = false, strategy = 'auto' } = options;
    
    const resolution = {
      conflict_id: conflict.id,
      timestamp: Date.now(),
      success: false,
      strategy_used: null,
      actions_taken: [],
      error: null,
      dry_run: dryRun
    };

    try {
      // Skip if not auto-resolvable and no manual strategy specified
      if (!conflict.auto_resolvable && strategy === 'auto') {
        resolution.error = 'Conflict requires manual resolution';
        return resolution;
      }

      // Select resolution strategy
      const selectedStrategy = this.selectResolutionStrategy(conflict, strategy);
      if (!selectedStrategy) {
        resolution.error = 'No suitable resolution strategy found';
        return resolution;
      }

      resolution.strategy_used = selectedStrategy.name;

      // Execute resolution strategy
      const executionResult = await this.executeResolutionStrategy(
        conflict, 
        selectedStrategy, 
        { dryRun }
      );

      resolution.success = executionResult.success;
      resolution.actions_taken = executionResult.actions;
      resolution.error = executionResult.error;

      if (resolution.success && !dryRun) {
        // Update conflict status
        await this.markConflictResolved(conflict.id);
      }

    } catch (error) {
      resolution.error = error.message;
    }

    return resolution;
  }

  /**
   * Select the best resolution strategy for a conflict
   */
  selectResolutionStrategy(conflict, preferredStrategy) {
    const availableStrategies = conflict.resolution_strategies || [];
    
    if (availableStrategies.length === 0) {
      return null;
    }

    // If specific strategy requested, try to find it
    if (preferredStrategy !== 'auto') {
      const strategy = availableStrategies.find(s => s.name === preferredStrategy);
      if (strategy) return strategy;
    }

    // Auto-select based on success rate, risk level, and execution time
    const scoredStrategies = availableStrategies.map(strategy => {
      let score = strategy.success_rate || 0.5;
      
      // Prefer lower risk
      if (strategy.risk_level === 'low') score += 0.2;
      else if (strategy.risk_level === 'high') score -= 0.2;
      
      // Prefer faster execution
      const executionTime = strategy.execution_time || 10000;
      if (executionTime < 5000) score += 0.1;
      else if (executionTime > 30000) score -= 0.1;
      
      return { ...strategy, score };
    });

    // Return strategy with highest score
    return scoredStrategies.sort((a, b) => b.score - a.score)[0];
  }

  /**
   * Execute a resolution strategy
   */
  async executeResolutionStrategy(conflict, strategy, options = {}) {
    const { dryRun = false } = options;
    
    const result = {
      success: false,
      actions: [],
      error: null
    };

    try {
      switch (strategy.name) {
        case 'kill_process':
          return await this.executeKillProcessStrategy(conflict, { dryRun });
          
        case 'change_port':
          return await this.executeChangePortStrategy(conflict, { dryRun });
          
        case 'wait_for_release':
          return await this.executeWaitForReleaseStrategy(conflict, { dryRun });
          
        case 'sequential_assignment':
          return await this.executeSequentialAssignmentStrategy(conflict, { dryRun });
          
        default:
          result.error = `Unknown resolution strategy: ${strategy.name}`;
      }
    } catch (error) {
      result.error = error.message;
    }

    return result;
  }

  /**
   * Execute kill process strategy
   */
  async executeKillProcessStrategy(conflict, { dryRun = false }) {
    const result = {
      success: false,
      actions: [],
      error: null
    };

    if (!conflict.process_info || !conflict.process_info.pid) {
      result.error = 'No process information available';
      return result;
    }

    const { pid, name, system_process, killable } = conflict.process_info;

    if (system_process) {
      result.error = 'Cannot kill system process';
      return result;
    }

    if (!killable) {
      result.error = 'Process is not safely killable';
      return result;
    }

    result.actions.push(`Kill process ${name} (PID: ${pid})`);

    if (!dryRun) {
      try {
        // Try graceful termination first
        process.kill(pid, 'SIGTERM');
        result.actions.push('Sent SIGTERM signal');

        // Wait a bit for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Check if process still exists
        try {
          process.kill(pid, 0);
          // Process still exists, force kill
          process.kill(pid, 'SIGKILL');
          result.actions.push('Sent SIGKILL signal');
        } catch {
          // Process already terminated
        }

        result.success = true;
      } catch (error) {
        result.error = `Failed to kill process: ${error.message}`;
      }
    } else {
      result.success = true; // Assume success in dry run
    }

    return result;
  }

  /**
   * Execute change port strategy
   */
  async executeChangePortStrategy(conflict, { dryRun = false }) {
    const result = {
      success: false,
      actions: [],
      error: null
    };

    try {
      // Find alternative port
      const { default: intelligentSuggester } = await import('./intelligent-port-suggester.js');
      
      const suggestions = await intelligentSuggester.suggestOptimalPorts(
        conflict.service, 
        conflict.environment, 
        { count: 1, avoidCurrentPort: true }
      );

      if (suggestions.suggestions.length === 0) {
        result.error = 'No alternative ports available';
        return result;
      }

      const newPort = suggestions.suggestions[0].port;
      result.actions.push(`Change ${conflict.service} from port ${conflict.port} to ${newPort}`);

      if (!dryRun) {
        // This would need integration with configuration management
        // For now, we'll just record the action
        result.actions.push('Configuration update required (manual step)');
      }

      result.success = true;
    } catch (error) {
      result.error = `Failed to change port: ${error.message}`;
    }

    return result;
  }

  /**
   * Execute wait for release strategy
   */
  async executeWaitForReleaseStrategy(conflict, { dryRun = false }) {
    const result = {
      success: false,
      actions: [],
      error: null
    };

    const timeout = 30000; // 30 seconds
    result.actions.push(`Wait up to ${timeout / 1000} seconds for port ${conflict.port} to be released`);

    if (!dryRun) {
      const startTime = Date.now();
      
      while (Date.now() - startTime < timeout) {
        try {
          const { default: portManager } = await import('./ports.js');
          
          if (portManager.isPortAvailable(conflict.port)) {
            result.success = true;
            result.actions.push(`Port ${conflict.port} released after ${Date.now() - startTime}ms`);
            break;
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        } catch (error) {
          result.error = error.message;
          break;
        }
      }

      if (!result.success && !result.error) {
        result.error = 'Timeout waiting for port release';
      }
    } else {
      result.success = true; // Assume success in dry run
    }

    return result;
  }

  /**
   * Execute sequential assignment strategy
   */
  async executeSequentialAssignmentStrategy(conflict, { dryRun = false }) {
    const result = {
      success: false,
      actions: [],
      error: null
    };

    result.actions.push('Implement sequential service startup to avoid conflicts');

    if (!dryRun) {
      // This would need integration with service orchestration
      result.actions.push('Service startup order configuration required (manual step)');
    }

    result.success = true; // This strategy is more about planning than immediate execution
    return result;
  }

  /**
   * Mark conflict as resolved
   */
  async markConflictResolved(conflictId) {
    // Update conflict history
    for (const [key, conflict] of this.conflictHistory) {
      if (conflict.id === conflictId) {
        conflict.resolved = true;
        conflict.resolved_at = Date.now();
        break;
      }
    }
  }

  /**
   * Record resolution results for learning
   */
  async recordResolutionResults(results) {
    const recordId = `resolution_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    this.conflictHistory.set(recordId, {
      id: recordId,
      type: 'resolution_batch',
      timestamp: results.timestamp,
      total_conflicts: results.total_conflicts,
      resolved_conflicts: results.resolved_conflicts,
      failed_resolutions: results.failed_resolutions,
      success_rate: results.resolved_conflicts / results.total_conflicts,
      strategies_used: [...new Set(results.resolutions.map(r => r.strategy_used))],
      resolution_summary: results
    });
  }

  /**
   * Start continuous monitoring
   */
  async startMonitoring(environment = 'development') {
    if (this.monitoringActive) {
      console.log('⚠️  Monitoring already active');
      return;
    }

    this.monitoringActive = true;
    console.log(`🔄 Starting continuous conflict monitoring for ${environment}...`);

    const monitoringLoop = async () => {
      if (!this.monitoringActive) return;

      try {
        const conflicts = await this.detectConflicts(environment, {
          includeRuntime: true,
          includeConfiguration: true,
          includePredictive: true
        });

        if (conflicts.summary.total_conflicts > 0) {
          this.emit('conflicts_detected', conflicts);

          // Auto-resolve if enabled
          if (this.config.auto_resolution) {
            const autoResolvableConflicts = conflicts.conflicts.filter(c => c.auto_resolvable);
            
            if (autoResolvableConflicts.length > 0) {
              console.log(`🤖 Auto-resolving ${autoResolvableConflicts.length} conflicts...`);
              
              const resolutionResults = await this.resolveConflicts(autoResolvableConflicts, {
                dryRun: false,
                strategy: 'auto'
              });

              this.emit('auto_resolution_complete', resolutionResults);
            }
          }
        }

        // Schedule next check
        setTimeout(monitoringLoop, this.config.monitoring_interval);
      } catch (error) {
        console.error('❌ Monitoring error:', error.message);
        setTimeout(monitoringLoop, this.config.monitoring_interval * 2); // Back off on error
      }
    };

    // Start monitoring
    monitoringLoop();
    this.emit('monitoring_started', { environment });
  }

  /**
   * Stop continuous monitoring
   */
  stopMonitoring() {
    this.monitoringActive = false;
    console.log('⏹️  Conflict monitoring stopped');
    this.emit('monitoring_stopped');
  }

  /**
   * Save all data to persistent storage
   */
  async saveData() {
    try {
      await Promise.all([
        this.saveConflictHistory(),
        this.saveConflictPatterns(),
        this.savePredictions(),
        this.saveResolutionStrategies()
      ]);
    } catch (error) {
      console.error('❌ Failed to save conflict avoidance data:', error.message);
    }
  }

  /**
   * Save conflict history
   */
  async saveConflictHistory() {
    const data = Object.fromEntries(this.conflictHistory);
    await fs.writeFile(this.historyPath, JSON.stringify(data, null, 2));
  }

  /**
   * Save conflict patterns
   */
  async saveConflictPatterns() {
    const data = Object.fromEntries(this.conflictPatterns);
    await fs.writeFile(this.patternsPath, JSON.stringify(data, null, 2));
  }

  /**
   * Save predictions
   */
  async savePredictions() {
    const data = Object.fromEntries(this.activePredictions);
    await fs.writeFile(this.predictionsPath, JSON.stringify(data, null, 2));
  }

  /**
   * Save resolution strategies
   */
  async saveResolutionStrategies() {
    const data = Object.fromEntries(this.resolutionStrategies);
    await fs.writeFile(this.resolutionPath, JSON.stringify(data, null, 2));
  }

  /**
   * Get comprehensive conflict report
   */
  async getConflictReport(environment = 'development') {
    const conflicts = await this.detectConflicts(environment);
    const patterns = await this.analyzeConflictPatterns(environment);
    
    return {
      timestamp: Date.now(),
      environment,
      current_conflicts: conflicts,
      historical_patterns: patterns,
      system_health: this.calculateSystemHealth(conflicts),
      recommendations: this.generateRecommendations(conflicts, patterns),
      monitoring_status: {
        active: this.monitoringActive,
        auto_resolution_enabled: this.config.auto_resolution
      }
    };
  }

  /**
   * Calculate system health score
   */
  calculateSystemHealth(conflicts) {
    let healthScore = 100;
    
    // Deduct for active conflicts
    healthScore -= conflicts.summary.critical_conflicts * 25;
    healthScore -= conflicts.summary.high_conflicts * 15;
    healthScore -= conflicts.summary.medium_conflicts * 5;
    healthScore -= conflicts.summary.low_conflicts * 1;
    
    // Deduct for predictions
    const highProbabilityPredictions = conflicts.predictions.filter(p => p.probability > 0.7).length;
    healthScore -= highProbabilityPredictions * 10;
    
    return {
      score: Math.max(0, healthScore),
      status: healthScore >= 80 ? 'healthy' : healthScore >= 60 ? 'warning' : 'critical',
      active_conflicts: conflicts.summary.total_conflicts,
      high_risk_predictions: highProbabilityPredictions
    };
  }

  /**
   * Generate recommendations based on conflicts and patterns
   */
  generateRecommendations(conflicts, patterns) {
    const recommendations = [];
    
    // Critical conflicts
    if (conflicts.summary.critical_conflicts > 0) {
      recommendations.push({
        priority: 'critical',
        type: 'immediate_action',
        message: `${conflicts.summary.critical_conflicts} critical conflicts require immediate attention`,
        action: 'resolve_critical_conflicts'
      });
    }

    // High-frequency patterns
    const highFrequencyPatterns = patterns.filter(p => p.frequency > 1);
    if (highFrequencyPatterns.length > 0) {
      recommendations.push({
        priority: 'high',
        type: 'pattern_prevention',
        message: `${highFrequencyPatterns.length} services show recurring conflict patterns`,
        action: 'implement_preventive_measures'
      });
    }

    // Auto-resolution opportunity
    const autoResolvableConflicts = conflicts.conflicts.filter(c => c.auto_resolvable).length;
    if (autoResolvableConflicts > 0 && !this.config.auto_resolution) {
      recommendations.push({
        priority: 'medium',
        type: 'automation',
        message: `${autoResolvableConflicts} conflicts could be auto-resolved`,
        action: 'enable_auto_resolution'
      });
    }

    return recommendations;
  }
}

// Export singleton instance
const advancedConflictAvoidance = new AdvancedConflictAvoidance();

export default advancedConflictAvoidance;
export { AdvancedConflictAvoidance, CONFLICT_SEVERITY, CONFLICT_TYPES };
