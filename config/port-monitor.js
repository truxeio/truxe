/**
 * Truxe Port Usage Monitoring and History Tracking System
 * 
 * Comprehensive port monitoring with real-time tracking, historical analysis,
 * usage patterns, and predictive conflict detection.
 * 
 * @author DevOps Engineering Team
 * @version 3.0.0
 */

import { portConflictDetector } from './port-conflict-detector.js';
import portManager from './ports.js';
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Port Usage Event Types
 */
export const PortEvent = {
  PORT_OCCUPIED: 'port_occupied',
  PORT_RELEASED: 'port_released',
  CONFLICT_DETECTED: 'conflict_detected',
  CONFLICT_RESOLVED: 'conflict_resolved',
  SERVICE_STARTED: 'service_started',
  SERVICE_STOPPED: 'service_stopped',
  MONITORING_STARTED: 'monitoring_started',
  MONITORING_STOPPED: 'monitoring_stopped'
};

/**
 * Port Usage Statistics
 */
class PortUsageStats {
  constructor() {
    this.reset();
  }

  reset() {
    this.total_checks = 0;
    this.conflicts_detected = 0;
    this.ports_monitored = new Set();
    this.processes_tracked = new Set();
    this.containers_tracked = new Set();
    this.uptime_start = Date.now();
    this.last_check = null;
    this.check_frequency_ms = 0;
    this.average_response_time_ms = 0;
    this.response_times = [];
  }

  addCheck(responseTime) {
    this.total_checks++;
    this.last_check = Date.now();
    this.response_times.push(responseTime);
    
    // Keep only last 100 response times for average calculation
    if (this.response_times.length > 100) {
      this.response_times.shift();
    }
    
    this.average_response_time_ms = this.response_times.reduce((a, b) => a + b, 0) / this.response_times.length;
  }

  addConflict() {
    this.conflicts_detected++;
  }

  addPort(port) {
    this.ports_monitored.add(port);
  }

  addProcess(pid) {
    this.processes_tracked.add(pid);
  }

  addContainer(name) {
    this.containers_tracked.add(name);
  }

  getUptime() {
    return Date.now() - this.uptime_start;
  }

  toJSON() {
    return {
      total_checks: this.total_checks,
      conflicts_detected: this.conflicts_detected,
      ports_monitored: this.ports_monitored.size,
      processes_tracked: this.processes_tracked.size,
      containers_tracked: this.containers_tracked.size,
      uptime_ms: this.getUptime(),
      last_check: this.last_check,
      average_response_time_ms: Math.round(this.average_response_time_ms * 100) / 100,
      checks_per_minute: this.total_checks > 0 ? (this.total_checks / (this.getUptime() / 60000)) : 0
    };
  }
}

/**
 * Port Usage History Entry
 */
class PortHistoryEntry {
  constructor(port, status, details = {}) {
    this.timestamp = Date.now();
    this.iso_timestamp = new Date().toISOString();
    this.port = port;
    this.status = status; // 'available', 'occupied', 'conflict'
    this.details = details;
    this.environment = process.env.NODE_ENV || 'development';
    this.system_info = {
      platform: os.platform(),
      hostname: os.hostname(),
      pid: process.pid
    };
  }

  toJSON() {
    return {
      timestamp: this.timestamp,
      iso_timestamp: this.iso_timestamp,
      port: this.port,
      status: this.status,
      details: this.details,
      environment: this.environment,
      system_info: this.system_info
    };
  }
}

/**
 * Port Monitor Class
 */
export class PortMonitor extends EventEmitter {
  constructor() {
    super();
    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.monitoringFrequency = 5000; // 5 seconds default
    this.portHistory = new Map(); // port -> array of history entries
    this.globalHistory = []; // chronological history of all events
    this.stats = new PortUsageStats();
    this.watchedPorts = new Set();
    this.watchedServices = new Set();
    this.alertThresholds = {
      max_conflicts_per_hour: 10,
      max_response_time_ms: 5000,
      min_availability_percent: 95
    };
    this.setupEventHandlers();
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    this.on(PortEvent.CONFLICT_DETECTED, (data) => {
      this.stats.addConflict();
      this.addHistoryEntry(data.port, 'conflict', {
        type: 'conflict_detected',
        processes: data.processes,
        containers: data.containers
      });
    });

    this.on(PortEvent.PORT_OCCUPIED, (data) => {
      this.addHistoryEntry(data.port, 'occupied', {
        type: 'port_occupied',
        process: data.process,
        container: data.container
      });
    });

    this.on(PortEvent.PORT_RELEASED, (data) => {
      this.addHistoryEntry(data.port, 'available', {
        type: 'port_released',
        previous_occupant: data.previous_occupant
      });
    });
  }

  /**
   * Start monitoring specified ports
   */
  async startMonitoring(ports = null, options = {}) {
    if (this.isMonitoring) {
      throw new Error('Port monitoring is already active');
    }

    const {
      frequency = 5000,
      environment = 'development',
      includeSystemPorts = false,
      enableAlerts = true
    } = options;

    this.monitoringFrequency = frequency;

    // Determine ports to monitor
    if (ports) {
      this.watchedPorts = new Set(Array.isArray(ports) ? ports : [ports]);
    } else {
      // Monitor all ports for the environment
      const envConfig = portManager.getEnvironmentConfig(environment);
      this.watchedPorts = new Set(Object.values(envConfig.services));
      
      // Add service names for reference
      for (const [service, port] of Object.entries(envConfig.services)) {
        this.watchedServices.add(service);
      }
    }

    console.log(`🔍 Starting port monitoring for ${this.watchedPorts.size} ports...`);
    console.log(`📊 Monitoring frequency: ${frequency}ms`);
    console.log(`🎯 Ports: ${Array.from(this.watchedPorts).join(', ')}`);

    this.isMonitoring = true;
    this.stats.reset();
    
    // Initial scan
    await this.performMonitoringScan();

    // Start periodic monitoring
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performMonitoringScan();
      } catch (error) {
        console.error('Monitoring scan failed:', error.message);
        this.emit('error', error);
      }
    }, frequency);

    this.emit(PortEvent.MONITORING_STARTED, {
      ports: Array.from(this.watchedPorts),
      frequency,
      environment
    });

    return {
      monitoring_started: true,
      ports_count: this.watchedPorts.size,
      frequency_ms: frequency,
      environment
    };
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      return { monitoring_stopped: false, reason: 'Not currently monitoring' };
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.isMonitoring = false;

    const finalStats = this.stats.toJSON();

    this.emit(PortEvent.MONITORING_STOPPED, {
      final_stats: finalStats,
      total_history_entries: this.globalHistory.length
    });

    console.log('🛑 Port monitoring stopped');
    console.log(`📊 Final stats: ${finalStats.total_checks} checks, ${finalStats.conflicts_detected} conflicts`);

    return {
      monitoring_stopped: true,
      final_stats: finalStats
    };
  }

  /**
   * Perform monitoring scan
   */
  async performMonitoringScan() {
    const scanStart = Date.now();
    const scanResults = {
      timestamp: new Date().toISOString(),
      ports_scanned: this.watchedPorts.size,
      conflicts_found: 0,
      new_occupants: 0,
      released_ports: 0,
      scan_time_ms: 0
    };

    try {
      // Get current port states
      const conflictResults = await portConflictDetector.detectPortConflicts(
        Array.from(this.watchedPorts),
        {
          methods: ['socket_test', 'lsof'],
          includeProcessDetails: true,
          timeout: Math.min(this.monitoringFrequency / 2, 10000)
        }
      );

      // Process results for each port
      for (const [port, result] of Object.entries(conflictResults.ports)) {
        const portNum = parseInt(port);
        this.stats.addPort(portNum);

        const previousState = this.getLastPortState(portNum);

        if (!result.available) {
          // Port is occupied
          scanResults.conflicts_found++;

          // Check if this is a new occupation
          if (!previousState || previousState.status === 'available') {
            scanResults.new_occupants++;

            // Emit events for processes and containers
            for (const process of result.processes) {
              this.stats.addProcess(process.pid);
              this.emit(PortEvent.PORT_OCCUPIED, {
                port: portNum,
                process: process,
                previous_state: previousState
              });
            }

            for (const container of result.containers) {
              this.stats.addContainer(container.name);
              this.emit(PortEvent.PORT_OCCUPIED, {
                port: portNum,
                container: container,
                previous_state: previousState
              });
            }

            // Emit conflict detected event
            this.emit(PortEvent.CONFLICT_DETECTED, {
              port: portNum,
              processes: result.processes,
              containers: result.containers,
              detection_methods: result.detection_results.map(r => r.method)
            });
          }

        } else {
          // Port is available
          if (previousState && previousState.status !== 'available') {
            scanResults.released_ports++;
            this.emit(PortEvent.PORT_RELEASED, {
              port: portNum,
              previous_occupant: previousState.details
            });
          }
        }

        // Update port history
        this.addHistoryEntry(portNum, result.available ? 'available' : 'occupied', {
          processes: result.processes,
          containers: result.containers,
          detection_results: result.detection_results
        });
      }

      scanResults.scan_time_ms = Date.now() - scanStart;
      this.stats.addCheck(scanResults.scan_time_ms);

      // Check alert thresholds
      this.checkAlertThresholds(scanResults);

      return scanResults;

    } catch (error) {
      scanResults.scan_time_ms = Date.now() - scanStart;
      scanResults.error = error.message;
      throw error;
    }
  }

  /**
   * Add history entry
   */
  addHistoryEntry(port, status, details = {}) {
    const entry = new PortHistoryEntry(port, status, details);

    // Add to port-specific history
    if (!this.portHistory.has(port)) {
      this.portHistory.set(port, []);
    }
    this.portHistory.get(port).push(entry);

    // Add to global history
    this.globalHistory.push(entry);

    // Limit history size (keep last 1000 entries per port, 10000 global)
    const portEntries = this.portHistory.get(port);
    if (portEntries.length > 1000) {
      portEntries.shift();
    }

    if (this.globalHistory.length > 10000) {
      this.globalHistory.shift();
    }

    return entry;
  }

  /**
   * Get last port state
   */
  getLastPortState(port) {
    const history = this.portHistory.get(port);
    return history && history.length > 0 ? history[history.length - 1] : null;
  }

  /**
   * Check alert thresholds
   */
  checkAlertThresholds(scanResults) {
    const stats = this.stats.toJSON();

    // Check conflicts per hour
    const uptimeHours = stats.uptime_ms / (1000 * 60 * 60);
    const conflictsPerHour = uptimeHours > 0 ? stats.conflicts_detected / uptimeHours : 0;

    if (conflictsPerHour > this.alertThresholds.max_conflicts_per_hour) {
      this.emit('alert', {
        type: 'high_conflict_rate',
        message: `High conflict rate: ${conflictsPerHour.toFixed(1)} conflicts/hour`,
        threshold: this.alertThresholds.max_conflicts_per_hour,
        current_value: conflictsPerHour
      });
    }

    // Check response time
    if (stats.average_response_time_ms > this.alertThresholds.max_response_time_ms) {
      this.emit('alert', {
        type: 'slow_response_time',
        message: `Slow monitoring response: ${stats.average_response_time_ms}ms`,
        threshold: this.alertThresholds.max_response_time_ms,
        current_value: stats.average_response_time_ms
      });
    }
  }

  /**
   * Get port usage statistics
   */
  getPortStatistics(port = null) {
    if (port) {
      return this.getPortSpecificStats(port);
    }

    const overallStats = {
      monitoring_active: this.isMonitoring,
      global_stats: this.stats.toJSON(),
      ports_tracked: this.portHistory.size,
      total_history_entries: this.globalHistory.length,
      port_breakdown: {}
    };

    // Add breakdown for each monitored port
    for (const [portNum, history] of this.portHistory.entries()) {
      overallStats.port_breakdown[portNum] = this.getPortSpecificStats(portNum);
    }

    return overallStats;
  }

  /**
   * Get port-specific statistics
   */
  getPortSpecificStats(port) {
    const history = this.portHistory.get(port) || [];
    
    if (history.length === 0) {
      return {
        port,
        no_data: true,
        message: 'No monitoring data available for this port'
      };
    }

    const stats = {
      port,
      total_entries: history.length,
      first_seen: history[0].iso_timestamp,
      last_seen: history[history.length - 1].iso_timestamp,
      current_status: history[history.length - 1].status,
      status_distribution: {},
      conflicts_detected: 0,
      unique_processes: new Set(),
      unique_containers: new Set(),
      availability_percentage: 0,
      average_occupation_duration_ms: 0
    };

    // Calculate statistics
    let availableCount = 0;
    let occupationPeriods = [];
    let currentOccupationStart = null;

    for (let i = 0; i < history.length; i++) {
      const entry = history[i];
      
      // Status distribution
      stats.status_distribution[entry.status] = (stats.status_distribution[entry.status] || 0) + 1;

      // Count availability
      if (entry.status === 'available') {
        availableCount++;
        
        // End occupation period if it was ongoing
        if (currentOccupationStart !== null) {
          occupationPeriods.push(entry.timestamp - currentOccupationStart);
          currentOccupationStart = null;
        }
      } else {
        // Start occupation period if not already started
        if (currentOccupationStart === null) {
          currentOccupationStart = entry.timestamp;
        }

        // Count conflicts
        if (entry.status === 'conflict') {
          stats.conflicts_detected++;
        }

        // Track processes and containers
        if (entry.details.processes) {
          entry.details.processes.forEach(p => stats.unique_processes.add(p.pid));
        }
        if (entry.details.containers) {
          entry.details.containers.forEach(c => stats.unique_containers.add(c.name));
        }
      }
    }

    // Calculate availability percentage
    stats.availability_percentage = (availableCount / history.length) * 100;

    // Calculate average occupation duration
    if (occupationPeriods.length > 0) {
      stats.average_occupation_duration_ms = occupationPeriods.reduce((a, b) => a + b, 0) / occupationPeriods.length;
    }

    // Convert sets to counts
    stats.unique_processes = stats.unique_processes.size;
    stats.unique_containers = stats.unique_containers.size;

    return stats;
  }

  /**
   * Get usage patterns and trends
   */
  getUsagePatterns(timeframe = '24h') {
    const now = Date.now();
    const timeframes = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000
    };

    const timeframeMs = timeframes[timeframe] || timeframes['24h'];
    const cutoffTime = now - timeframeMs;

    const recentHistory = this.globalHistory.filter(entry => entry.timestamp >= cutoffTime);

    const patterns = {
      timeframe,
      period_start: new Date(cutoffTime).toISOString(),
      period_end: new Date(now).toISOString(),
      total_events: recentHistory.length,
      port_activity: {},
      hourly_distribution: {},
      conflict_patterns: {
        total_conflicts: 0,
        most_conflicted_ports: {},
        conflict_times: []
      },
      process_patterns: {
        most_active_processes: {},
        process_lifecycle: {}
      }
    };

    // Analyze recent history
    for (const entry of recentHistory) {
      const hour = new Date(entry.timestamp).getHours();
      
      // Port activity
      if (!patterns.port_activity[entry.port]) {
        patterns.port_activity[entry.port] = {
          events: 0,
          conflicts: 0,
          last_status: entry.status
        };
      }
      patterns.port_activity[entry.port].events++;
      
      if (entry.status === 'conflict') {
        patterns.port_activity[entry.port].conflicts++;
        patterns.conflict_patterns.total_conflicts++;
        patterns.conflict_patterns.conflict_times.push(entry.iso_timestamp);
        
        if (!patterns.conflict_patterns.most_conflicted_ports[entry.port]) {
          patterns.conflict_patterns.most_conflicted_ports[entry.port] = 0;
        }
        patterns.conflict_patterns.most_conflicted_ports[entry.port]++;
      }

      // Hourly distribution
      if (!patterns.hourly_distribution[hour]) {
        patterns.hourly_distribution[hour] = { events: 0, conflicts: 0 };
      }
      patterns.hourly_distribution[hour].events++;
      if (entry.status === 'conflict') {
        patterns.hourly_distribution[hour].conflicts++;
      }

      // Process patterns
      if (entry.details.processes) {
        for (const process of entry.details.processes) {
          const processKey = `${process.name}_${process.pid}`;
          if (!patterns.process_patterns.most_active_processes[processKey]) {
            patterns.process_patterns.most_active_processes[processKey] = {
              name: process.name,
              pid: process.pid,
              appearances: 0,
              ports_used: new Set()
            };
          }
          patterns.process_patterns.most_active_processes[processKey].appearances++;
          patterns.process_patterns.most_active_processes[processKey].ports_used.add(entry.port);
        }
      }
    }

    // Convert sets to arrays for JSON serialization
    for (const processKey in patterns.process_patterns.most_active_processes) {
      const process = patterns.process_patterns.most_active_processes[processKey];
      process.ports_used = Array.from(process.ports_used);
    }

    return patterns;
  }

  /**
   * Export monitoring data
   */
  async exportMonitoringData(format = 'json', options = {}) {
    const {
      includeHistory = true,
      includeStats = true,
      includePatterns = true,
      timeframe = '24h'
    } = options;

    const exportData = {
      export_timestamp: new Date().toISOString(),
      monitoring_active: this.isMonitoring,
      export_format: format
    };

    if (includeStats) {
      exportData.statistics = this.getPortStatistics();
    }

    if (includePatterns) {
      exportData.usage_patterns = this.getUsagePatterns(timeframe);
    }

    if (includeHistory) {
      exportData.history = {
        global_history: this.globalHistory,
        port_history: Object.fromEntries(this.portHistory)
      };
    }

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `port-monitoring-export-${timestamp}.${format}`;
    const filepath = path.join(__dirname, '..', 'reports', filename);

    // Ensure reports directory exists
    await fs.mkdir(path.dirname(filepath), { recursive: true });

    if (format === 'json') {
      await fs.writeFile(filepath, JSON.stringify(exportData, null, 2));
    } else if (format === 'csv') {
      const csv = this.convertHistoryToCSV(exportData.history.global_history);
      await fs.writeFile(filepath, csv);
    }

    return {
      filepath,
      format,
      size_bytes: (await fs.stat(filepath)).size,
      entries_exported: exportData.history ? exportData.history.global_history.length : 0
    };
  }

  /**
   * Convert history to CSV format
   */
  convertHistoryToCSV(history) {
    const headers = ['Timestamp', 'Port', 'Status', 'Process_Count', 'Container_Count', 'Environment'];
    const rows = [headers.join(',')];

    for (const entry of history) {
      const processCount = entry.details.processes ? entry.details.processes.length : 0;
      const containerCount = entry.details.containers ? entry.details.containers.length : 0;
      
      const row = [
        entry.iso_timestamp,
        entry.port,
        entry.status,
        processCount,
        containerCount,
        entry.environment
      ];
      
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  /**
   * Get monitoring status
   */
  getMonitoringStatus() {
    return {
      is_monitoring: this.isMonitoring,
      frequency_ms: this.monitoringFrequency,
      watched_ports: Array.from(this.watchedPorts),
      watched_services: Array.from(this.watchedServices),
      stats: this.stats.toJSON(),
      alert_thresholds: this.alertThresholds,
      uptime_ms: this.stats.getUptime(),
      last_scan: this.stats.last_check
    };
  }

  /**
   * Update alert thresholds
   */
  updateAlertThresholds(newThresholds) {
    this.alertThresholds = { ...this.alertThresholds, ...newThresholds };
    return this.alertThresholds;
  }

  /**
   * Clear monitoring history
   */
  clearHistory(port = null) {
    if (port) {
      this.portHistory.delete(port);
      this.globalHistory = this.globalHistory.filter(entry => entry.port !== port);
    } else {
      this.portHistory.clear();
      this.globalHistory = [];
      this.stats.reset();
    }

    return {
      cleared: true,
      port: port || 'all',
      remaining_entries: this.globalHistory.length
    };
  }
}

// Export singleton instance
export const portMonitor = new PortMonitor();
export default portMonitor;
