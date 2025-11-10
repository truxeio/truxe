/**
 * Truxe Port Usage Analytics System
 * 
 * Comprehensive analytics system for tracking, analyzing, and learning from
 * port usage patterns across all environments and services.
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
 * Port Usage Analytics Engine
 */
export class PortUsageAnalyzer extends EventEmitter {
  constructor() {
    super();
    
    this.dataPath = path.join(__dirname, '../data/analytics');
    this.metricsPath = path.join(this.dataPath, 'metrics.json');
    this.trendsPath = path.join(this.dataPath, 'trends.json');
    this.patternsPath = path.join(this.dataPath, 'patterns.json');
    this.reportsPath = path.join(this.dataPath, 'reports');
    
    this.metrics = new Map();
    this.trends = new Map();
    this.patterns = new Map();
    this.realTimeData = new Map();
    
    this.analysisInterval = null;
    this.collectionInterval = null;
    
    this.config = {
      collection_interval: 30000, // 30 seconds
      analysis_interval: 300000,  // 5 minutes
      retention_days: 30,
      max_data_points: 10000,
      enable_real_time: true,
      enable_predictive: true
    };
    
    this.init();
  }

  /**
   * Initialize the analytics system
   */
  async init() {
    try {
      await this.ensureDirectories();
      await this.loadStoredData();
      
      if (this.config.enable_real_time) {
        this.startRealTimeCollection();
      }
      
      this.startPeriodicAnalysis();
      
      console.log('📊 Port Usage Analytics System initialized');
      this.emit('initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Port Usage Analytics:', error.message);
      throw error;
    }
  }

  /**
   * Ensure required directories exist
   */
  async ensureDirectories() {
    const dirs = [this.dataPath, this.reportsPath];
    
    for (const dir of dirs) {
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
      }
    }
  }

  /**
   * Load stored analytics data
   */
  async loadStoredData() {
    await Promise.all([
      this.loadMetrics(),
      this.loadTrends(),
      this.loadPatterns()
    ]);
  }

  /**
   * Load metrics data
   */
  async loadMetrics() {
    try {
      const data = await fs.readFile(this.metricsPath, 'utf8');
      const metrics = JSON.parse(data);
      
      for (const [key, value] of Object.entries(metrics)) {
        this.metrics.set(key, value);
      }
      
      console.log(`📈 Loaded ${this.metrics.size} metric records`);
    } catch (error) {
      console.log('📈 No existing metrics data found');
    }
  }

  /**
   * Load trends data
   */
  async loadTrends() {
    try {
      const data = await fs.readFile(this.trendsPath, 'utf8');
      const trends = JSON.parse(data);
      
      for (const [key, value] of Object.entries(trends)) {
        this.trends.set(key, value);
      }
      
      console.log(`📊 Loaded ${this.trends.size} trend records`);
    } catch (error) {
      console.log('📊 No existing trends data found');
    }
  }

  /**
   * Load patterns data
   */
  async loadPatterns() {
    try {
      const data = await fs.readFile(this.patternsPath, 'utf8');
      const patterns = JSON.parse(data);
      
      for (const [key, value] of Object.entries(patterns)) {
        this.patterns.set(key, value);
      }
      
      console.log(`🔍 Loaded ${this.patterns.size} pattern records`);
    } catch (error) {
      console.log('🔍 No existing patterns data found');
    }
  }

  /**
   * Start real-time data collection
   */
  startRealTimeCollection() {
    this.collectionInterval = setInterval(async () => {
      try {
        await this.collectRealTimeData();
      } catch (error) {
        console.error('❌ Real-time collection error:', error.message);
      }
    }, this.config.collection_interval);
    
    console.log('🔄 Real-time data collection started');
  }

  /**
   * Start periodic analysis
   */
  startPeriodicAnalysis() {
    this.analysisInterval = setInterval(async () => {
      try {
        await this.performPeriodicAnalysis();
      } catch (error) {
        console.error('❌ Periodic analysis error:', error.message);
      }
    }, this.config.analysis_interval);
    
    console.log('🔄 Periodic analysis started');
  }

  /**
   * Collect real-time port usage data
   */
  async collectRealTimeData() {
    const timestamp = Date.now();
    const snapshot = await this.captureSystemSnapshot();
    
    // Store in real-time data buffer
    const snapshotKey = `snapshot_${timestamp}`;
    this.realTimeData.set(snapshotKey, snapshot);
    
    // Limit buffer size
    if (this.realTimeData.size > this.config.max_data_points) {
      const oldestKey = Array.from(this.realTimeData.keys())[0];
      this.realTimeData.delete(oldestKey);
    }
    
    // Update metrics
    await this.updateMetricsFromSnapshot(snapshot);
    
    this.emit('data_collected', snapshot);
  }

  /**
   * Capture current system port usage snapshot
   */
  async captureSystemSnapshot() {
    const snapshot = {
      timestamp: Date.now(),
      system_ports: await this.getSystemPortUsage(),
      docker_ports: await this.getDockerPortUsage(),
      process_ports: await this.getProcessPortUsage(),
      truxe_ports: await this.getTruxePortUsage(),
      system_load: await this.getSystemLoad(),
      network_stats: await this.getNetworkStats()
    };

    return snapshot;
  }

  /**
   * Get system-wide port usage
   */
  async getSystemPortUsage() {
    try {
      const result = execSync('ss -tuln', { encoding: 'utf8', timeout: 5000 });
      const lines = result.split('\n').filter(line => line.includes('LISTEN'));
      
      const ports = [];
      for (const line of lines) {
        const match = line.match(/:(\d+)\s/);
        if (match) {
          const port = parseInt(match[1]);
          if (port > 0 && port <= 65535) {
            ports.push(port);
          }
        }
      }
      
      return {
        listening_ports: ports,
        port_count: ports.length,
        port_ranges: this.analyzePortRanges(ports)
      };
    } catch (error) {
      return { listening_ports: [], port_count: 0, port_ranges: [], error: error.message };
    }
  }

  /**
   * Get Docker container port usage
   */
  async getDockerPortUsage() {
    try {
      const result = execSync('docker ps --format "{{.Names}}:{{.Ports}}"', { 
        encoding: 'utf8', 
        timeout: 5000 
      });
      
      const containers = [];
      const lines = result.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        const [name, ports] = line.split(':');
        if (ports) {
          const portMappings = this.parseDockerPorts(ports);
          containers.push({
            name: name.trim(),
            ports: portMappings
          });
        }
      }
      
      return {
        containers,
        container_count: containers.length,
        total_port_mappings: containers.reduce((sum, c) => sum + c.ports.length, 0)
      };
    } catch (error) {
      return { containers: [], container_count: 0, total_port_mappings: 0, error: error.message };
    }
  }

  /**
   * Parse Docker port mappings
   */
  parseDockerPorts(portsString) {
    const mappings = [];
    const portRegex = /(\d+):(\d+)/g;
    let match;
    
    while ((match = portRegex.exec(portsString)) !== null) {
      mappings.push({
        host_port: parseInt(match[1]),
        container_port: parseInt(match[2])
      });
    }
    
    return mappings;
  }

  /**
   * Get process-specific port usage
   */
  async getProcessPortUsage() {
    try {
      const result = execSync('lsof -i -P -n | grep LISTEN', { 
        encoding: 'utf8', 
        timeout: 5000 
      });
      
      const processes = [];
      const lines = result.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        const parts = line.split(/\s+/);
        if (parts.length >= 9) {
          const process = parts[0];
          const pid = parseInt(parts[1]);
          const address = parts[8];
          
          const portMatch = address.match(/:(\d+)$/);
          if (portMatch) {
            processes.push({
              process,
              pid,
              port: parseInt(portMatch[1]),
              address
            });
          }
        }
      }
      
      return {
        processes,
        process_count: processes.length,
        unique_processes: [...new Set(processes.map(p => p.process))].length
      };
    } catch (error) {
      return { processes: [], process_count: 0, unique_processes: 0, error: error.message };
    }
  }

  /**
   * Get Truxe-specific port usage
   */
  async getTruxePortUsage() {
    try {
      // This would integrate with the existing port manager
      const environments = ['development', 'staging', 'testing', 'production'];
      const truxePorts = {};
      
      for (const env of environments) {
        try {
          // Dynamically import to avoid circular dependencies
          const { default: portManager } = await import('./ports.js');
          const envConfig = portManager.getEnvironmentConfig(env);
          
          truxePorts[env] = {
            services: envConfig.services,
            range: envConfig.range,
            port_count: Object.keys(envConfig.services).length
          };
        } catch (error) {
          truxePorts[env] = { error: error.message };
        }
      }
      
      return truxePorts;
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Get system load metrics
   */
  async getSystemLoad() {
    try {
      const loadavg = execSync('uptime', { encoding: 'utf8', timeout: 2000 });
      const meminfo = execSync('free -m', { encoding: 'utf8', timeout: 2000 });
      
      return {
        load_average: loadavg.trim(),
        memory_info: meminfo.trim(),
        timestamp: Date.now()
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Get network statistics
   */
  async getNetworkStats() {
    try {
      const netstat = execSync('netstat -s', { encoding: 'utf8', timeout: 5000 });
      
      // Parse key network metrics
      const stats = {};
      const lines = netstat.split('\n');
      
      for (const line of lines) {
        if (line.includes('connections')) {
          const match = line.match(/(\d+)/);
          if (match) {
            stats.connections = parseInt(match[1]);
          }
        }
      }
      
      return stats;
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Analyze port ranges in use
   */
  analyzePortRanges(ports) {
    if (ports.length === 0) return [];
    
    const sortedPorts = [...ports].sort((a, b) => a - b);
    const ranges = [];
    let currentRange = { start: sortedPorts[0], end: sortedPorts[0], count: 1 };
    
    for (let i = 1; i < sortedPorts.length; i++) {
      const port = sortedPorts[i];
      
      if (port === currentRange.end + 1) {
        // Consecutive port
        currentRange.end = port;
        currentRange.count++;
      } else {
        // Gap found, save current range and start new one
        ranges.push({ ...currentRange });
        currentRange = { start: port, end: port, count: 1 };
      }
    }
    
    // Add the last range
    ranges.push(currentRange);
    
    return ranges;
  }

  /**
   * Update metrics from snapshot data
   */
  async updateMetricsFromSnapshot(snapshot) {
    const timestamp = snapshot.timestamp;
    const date = new Date(timestamp).toISOString().split('T')[0];
    
    // Update daily metrics
    const dailyKey = `daily_${date}`;
    const dailyMetrics = this.metrics.get(dailyKey) || {
      date,
      snapshots: 0,
      avg_system_ports: 0,
      avg_docker_ports: 0,
      avg_process_count: 0,
      peak_port_usage: 0,
      port_conflicts: 0,
      system_load_samples: []
    };
    
    dailyMetrics.snapshots++;
    dailyMetrics.avg_system_ports = this.updateAverage(
      dailyMetrics.avg_system_ports,
      snapshot.system_ports.port_count,
      dailyMetrics.snapshots
    );
    dailyMetrics.avg_docker_ports = this.updateAverage(
      dailyMetrics.avg_docker_ports,
      snapshot.docker_ports.total_port_mappings,
      dailyMetrics.snapshots
    );
    dailyMetrics.avg_process_count = this.updateAverage(
      dailyMetrics.avg_process_count,
      snapshot.process_ports.process_count,
      dailyMetrics.snapshots
    );
    
    dailyMetrics.peak_port_usage = Math.max(
      dailyMetrics.peak_port_usage,
      snapshot.system_ports.port_count
    );
    
    this.metrics.set(dailyKey, dailyMetrics);
    
    // Update hourly metrics
    const hour = new Date(timestamp).getHours();
    const hourlyKey = `hourly_${date}_${hour}`;
    const hourlyMetrics = this.metrics.get(hourlyKey) || {
      date,
      hour,
      snapshots: 0,
      port_usage_trend: [],
      conflict_events: [],
      performance_samples: []
    };
    
    hourlyMetrics.snapshots++;
    hourlyMetrics.port_usage_trend.push({
      timestamp,
      system_ports: snapshot.system_ports.port_count,
      docker_ports: snapshot.docker_ports.total_port_mappings
    });
    
    // Keep only last 60 samples (1 hour at 1-minute intervals)
    if (hourlyMetrics.port_usage_trend.length > 60) {
      hourlyMetrics.port_usage_trend = hourlyMetrics.port_usage_trend.slice(-60);
    }
    
    this.metrics.set(hourlyKey, hourlyMetrics);
  }

  /**
   * Update running average
   */
  updateAverage(currentAvg, newValue, count) {
    return ((currentAvg * (count - 1)) + newValue) / count;
  }

  /**
   * Perform periodic analysis
   */
  async performPeriodicAnalysis() {
    console.log('🔍 Performing periodic port usage analysis...');
    
    await Promise.all([
      this.analyzeTrends(),
      this.detectPatterns(),
      this.identifyAnomalies(),
      this.updatePredictions(),
      this.cleanupOldData()
    ]);
    
    await this.saveAnalyticsData();
    
    this.emit('analysis_complete');
  }

  /**
   * Analyze usage trends
   */
  async analyzeTrends() {
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
    
    // Analyze daily trends
    const dailyTrend = await this.calculateTrend('daily', oneDayAgo, now);
    this.trends.set('daily_port_usage', dailyTrend);
    
    // Analyze weekly trends
    const weeklyTrend = await this.calculateTrend('weekly', oneWeekAgo, now);
    this.trends.set('weekly_port_usage', weeklyTrend);
    
    // Analyze service-specific trends
    const serviceTrends = await this.analyzeServiceTrends();
    this.trends.set('service_trends', serviceTrends);
  }

  /**
   * Calculate trend for a time period
   */
  async calculateTrend(period, startTime, endTime) {
    const dataPoints = [];
    
    for (const [key, snapshot] of this.realTimeData) {
      const timestamp = parseInt(key.split('_')[1]);
      
      if (timestamp >= startTime && timestamp <= endTime) {
        dataPoints.push({
          timestamp,
          system_ports: snapshot.system_ports.port_count,
          docker_ports: snapshot.docker_ports.total_port_mappings,
          process_count: snapshot.process_ports.process_count
        });
      }
    }
    
    if (dataPoints.length < 2) {
      return { trend: 'insufficient_data', data_points: dataPoints.length };
    }
    
    // Calculate linear regression for trend analysis
    const systemPortTrend = this.calculateLinearRegression(
      dataPoints.map(d => d.timestamp),
      dataPoints.map(d => d.system_ports)
    );
    
    const dockerPortTrend = this.calculateLinearRegression(
      dataPoints.map(d => d.timestamp),
      dataPoints.map(d => d.docker_ports)
    );
    
    return {
      period,
      start_time: startTime,
      end_time: endTime,
      data_points: dataPoints.length,
      system_port_trend: systemPortTrend,
      docker_port_trend: dockerPortTrend,
      analysis_timestamp: Date.now()
    };
  }

  /**
   * Calculate linear regression
   */
  calculateLinearRegression(x, y) {
    const n = x.length;
    if (n === 0) return { slope: 0, intercept: 0, correlation: 0 };
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumYY = y.reduce((sum, yi) => sum + yi * yi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate correlation coefficient
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
    const correlation = denominator === 0 ? 0 : numerator / denominator;
    
    return {
      slope: isNaN(slope) ? 0 : slope,
      intercept: isNaN(intercept) ? 0 : intercept,
      correlation: isNaN(correlation) ? 0 : correlation,
      trend_direction: slope > 0.1 ? 'increasing' : slope < -0.1 ? 'decreasing' : 'stable'
    };
  }

  /**
   * Analyze service-specific trends
   */
  async analyzeServiceTrends() {
    const serviceTrends = {};
    
    // This would analyze trends for each Truxe service
    try {
      const { default: portManager } = await import('./ports.js');
      const environments = ['development', 'staging', 'testing'];
      
      for (const env of environments) {
        try {
          const envConfig = portManager.getEnvironmentConfig(env);
          
          for (const [serviceName, port] of Object.entries(envConfig.services)) {
            const serviceKey = `${env}_${serviceName}`;
            
            serviceTrends[serviceKey] = {
              service: serviceName,
              environment: env,
              current_port: port,
              usage_pattern: await this.analyzeServiceUsagePattern(serviceName, env),
              conflict_history: await this.getServiceConflictHistory(serviceName, env),
              performance_trend: await this.getServicePerformanceTrend(serviceName, env)
            };
          }
        } catch (error) {
          console.warn(`Could not analyze trends for ${env}:`, error.message);
        }
      }
    } catch (error) {
      console.warn('Could not load port manager for service trends:', error.message);
    }
    
    return serviceTrends;
  }

  /**
   * Analyze service usage pattern
   */
  async analyzeServiceUsagePattern(serviceName, environment) {
    // This would analyze how frequently a service is used
    const pattern = {
      frequency: 'unknown',
      peak_hours: [],
      usage_consistency: 'unknown',
      last_active: null
    };
    
    // Analyze real-time data for patterns
    const serviceData = [];
    
    for (const [key, snapshot] of this.realTimeData) {
      if (snapshot.truxe_ports && snapshot.truxe_ports[environment]) {
        const envData = snapshot.truxe_ports[environment];
        if (envData.services && envData.services[serviceName]) {
          serviceData.push({
            timestamp: parseInt(key.split('_')[1]),
            active: true
          });
        }
      }
    }
    
    if (serviceData.length > 0) {
      pattern.last_active = Math.max(...serviceData.map(d => d.timestamp));
      pattern.frequency = serviceData.length > 100 ? 'high' : 
                         serviceData.length > 50 ? 'medium' : 'low';
    }
    
    return pattern;
  }

  /**
   * Get service conflict history
   */
  async getServiceConflictHistory(serviceName, environment) {
    // This would track historical conflicts for the service
    return {
      total_conflicts: 0,
      recent_conflicts: 0,
      conflict_types: [],
      resolution_time_avg: 0
    };
  }

  /**
   * Get service performance trend
   */
  async getServicePerformanceTrend(serviceName, environment) {
    // This would track performance metrics over time
    return {
      availability: 1.0,
      response_time_trend: 'stable',
      error_rate: 0.0,
      performance_score: 1.0
    };
  }

  /**
   * Detect usage patterns
   */
  async detectPatterns() {
    console.log('🔍 Detecting port usage patterns...');
    
    const patterns = {
      peak_usage_hours: await this.detectPeakUsageHours(),
      port_clustering: await this.detectPortClustering(),
      service_dependencies: await this.detectServiceDependencies(),
      conflict_patterns: await this.detectConflictPatterns(),
      seasonal_patterns: await this.detectSeasonalPatterns()
    };
    
    this.patterns.set('usage_patterns', patterns);
  }

  /**
   * Detect peak usage hours
   */
  async detectPeakUsageHours() {
    const hourlyUsage = new Array(24).fill(0);
    const hourlyCounts = new Array(24).fill(0);
    
    for (const [key, snapshot] of this.realTimeData) {
      const timestamp = parseInt(key.split('_')[1]);
      const hour = new Date(timestamp).getHours();
      
      hourlyUsage[hour] += snapshot.system_ports.port_count;
      hourlyCounts[hour]++;
    }
    
    // Calculate average usage per hour
    const avgHourlyUsage = hourlyUsage.map((usage, hour) => ({
      hour,
      avg_usage: hourlyCounts[hour] > 0 ? usage / hourlyCounts[hour] : 0,
      sample_count: hourlyCounts[hour]
    }));
    
    // Find peak hours (top 25%)
    const sortedHours = [...avgHourlyUsage].sort((a, b) => b.avg_usage - a.avg_usage);
    const peakHours = sortedHours.slice(0, 6).map(h => h.hour);
    
    return {
      peak_hours: peakHours,
      hourly_averages: avgHourlyUsage,
      peak_usage_value: sortedHours[0]?.avg_usage || 0
    };
  }

  /**
   * Detect port clustering patterns
   */
  async detectPortClustering() {
    const allPorts = [];
    
    for (const [key, snapshot] of this.realTimeData) {
      allPorts.push(...snapshot.system_ports.listening_ports);
    }
    
    if (allPorts.length === 0) {
      return { clusters: [], analysis: 'no_data' };
    }
    
    // Find port clusters (groups of ports close together)
    const sortedPorts = [...new Set(allPorts)].sort((a, b) => a - b);
    const clusters = [];
    let currentCluster = [sortedPorts[0]];
    
    for (let i = 1; i < sortedPorts.length; i++) {
      const port = sortedPorts[i];
      const lastPort = currentCluster[currentCluster.length - 1];
      
      if (port - lastPort <= 10) {
        // Port is close enough to be in the same cluster
        currentCluster.push(port);
      } else {
        // Start new cluster
        if (currentCluster.length > 1) {
          clusters.push({
            start: currentCluster[0],
            end: currentCluster[currentCluster.length - 1],
            ports: [...currentCluster],
            size: currentCluster.length
          });
        }
        currentCluster = [port];
      }
    }
    
    // Add the last cluster
    if (currentCluster.length > 1) {
      clusters.push({
        start: currentCluster[0],
        end: currentCluster[currentCluster.length - 1],
        ports: [...currentCluster],
        size: currentCluster.length
      });
    }
    
    return {
      clusters,
      total_clusters: clusters.length,
      largest_cluster: clusters.reduce((max, cluster) => 
        cluster.size > max.size ? cluster : max, { size: 0 })
    };
  }

  /**
   * Detect service dependencies
   */
  async detectServiceDependencies() {
    // This would analyze which services tend to be active together
    return {
      dependency_pairs: [],
      correlation_matrix: {},
      analysis: 'not_implemented'
    };
  }

  /**
   * Detect conflict patterns
   */
  async detectConflictPatterns() {
    // This would analyze when and why conflicts occur
    return {
      common_conflict_ports: [],
      conflict_times: [],
      conflict_triggers: [],
      analysis: 'not_implemented'
    };
  }

  /**
   * Detect seasonal patterns
   */
  async detectSeasonalPatterns() {
    // This would analyze longer-term patterns (weekly, monthly)
    return {
      weekly_patterns: {},
      monthly_patterns: {},
      analysis: 'insufficient_data'
    };
  }

  /**
   * Identify anomalies in port usage
   */
  async identifyAnomalies() {
    console.log('🚨 Identifying port usage anomalies...');
    
    const anomalies = [];
    const recentSnapshots = Array.from(this.realTimeData.values()).slice(-100);
    
    if (recentSnapshots.length < 10) {
      return; // Not enough data for anomaly detection
    }
    
    // Calculate baseline metrics
    const baseline = this.calculateBaseline(recentSnapshots);
    
    // Check recent snapshots for anomalies
    const latestSnapshots = recentSnapshots.slice(-10);
    
    for (const snapshot of latestSnapshots) {
      const anomaly = this.detectSnapshotAnomalies(snapshot, baseline);
      if (anomaly.anomalies.length > 0) {
        anomalies.push(anomaly);
      }
    }
    
    if (anomalies.length > 0) {
      this.patterns.set('anomalies', {
        detected_anomalies: anomalies,
        detection_timestamp: Date.now(),
        baseline_metrics: baseline
      });
      
      this.emit('anomalies_detected', anomalies);
    }
  }

  /**
   * Calculate baseline metrics
   */
  calculateBaseline(snapshots) {
    const systemPorts = snapshots.map(s => s.system_ports.port_count);
    const dockerPorts = snapshots.map(s => s.docker_ports.total_port_mappings);
    const processes = snapshots.map(s => s.process_ports.process_count);
    
    return {
      system_ports: {
        mean: this.calculateMean(systemPorts),
        std: this.calculateStandardDeviation(systemPorts)
      },
      docker_ports: {
        mean: this.calculateMean(dockerPorts),
        std: this.calculateStandardDeviation(dockerPorts)
      },
      processes: {
        mean: this.calculateMean(processes),
        std: this.calculateStandardDeviation(processes)
      }
    };
  }

  /**
   * Calculate mean
   */
  calculateMean(values) {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Calculate standard deviation
   */
  calculateStandardDeviation(values) {
    const mean = this.calculateMean(values);
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const avgSquaredDiff = this.calculateMean(squaredDiffs);
    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Detect anomalies in a snapshot
   */
  detectSnapshotAnomalies(snapshot, baseline) {
    const anomalies = [];
    const threshold = 2; // 2 standard deviations
    
    // Check system ports
    const systemPortsZ = Math.abs(snapshot.system_ports.port_count - baseline.system_ports.mean) / 
                        (baseline.system_ports.std || 1);
    
    if (systemPortsZ > threshold) {
      anomalies.push({
        type: 'system_ports',
        value: snapshot.system_ports.port_count,
        expected: baseline.system_ports.mean,
        z_score: systemPortsZ,
        severity: systemPortsZ > 3 ? 'high' : 'medium'
      });
    }
    
    // Check Docker ports
    const dockerPortsZ = Math.abs(snapshot.docker_ports.total_port_mappings - baseline.docker_ports.mean) / 
                        (baseline.docker_ports.std || 1);
    
    if (dockerPortsZ > threshold) {
      anomalies.push({
        type: 'docker_ports',
        value: snapshot.docker_ports.total_port_mappings,
        expected: baseline.docker_ports.mean,
        z_score: dockerPortsZ,
        severity: dockerPortsZ > 3 ? 'high' : 'medium'
      });
    }
    
    return {
      timestamp: snapshot.timestamp,
      anomalies
    };
  }

  /**
   * Update predictive models
   */
  async updatePredictions() {
    if (!this.config.enable_predictive) return;
    
    console.log('🔮 Updating predictive models...');
    
    // This would implement machine learning models for prediction
    const predictions = {
      port_usage_forecast: await this.forecastPortUsage(),
      conflict_probability: await this.predictConflictProbability(),
      capacity_planning: await this.generateCapacityPredictions()
    };
    
    this.patterns.set('predictions', predictions);
  }

  /**
   * Forecast port usage
   */
  async forecastPortUsage() {
    // Simple linear extrapolation based on recent trends
    const trend = this.trends.get('daily_port_usage');
    
    if (!trend || !trend.system_port_trend) {
      return { forecast: 'insufficient_data' };
    }
    
    const currentTime = Date.now();
    const futureTime = currentTime + (24 * 60 * 60 * 1000); // 24 hours ahead
    
    const predictedUsage = trend.system_port_trend.intercept + 
                          (trend.system_port_trend.slope * futureTime);
    
    return {
      forecast_horizon: '24_hours',
      predicted_port_usage: Math.max(0, Math.round(predictedUsage)),
      confidence: Math.abs(trend.system_port_trend.correlation),
      trend_direction: trend.system_port_trend.trend_direction
    };
  }

  /**
   * Predict conflict probability
   */
  async predictConflictProbability() {
    // This would use historical conflict data to predict future conflicts
    return {
      overall_probability: 0.1,
      high_risk_ports: [],
      risk_factors: []
    };
  }

  /**
   * Generate capacity planning predictions
   */
  async generateCapacityPredictions() {
    const currentUsage = await this.getCurrentPortUtilization();
    
    return {
      current_utilization: currentUsage,
      projected_utilization_30d: currentUsage * 1.1, // Simple 10% growth assumption
      capacity_warnings: currentUsage > 0.8 ? ['high_utilization'] : [],
      recommendations: currentUsage > 0.8 ? ['expand_port_range'] : []
    };
  }

  /**
   * Get current port utilization
   */
  async getCurrentPortUtilization() {
    try {
      const { default: portManager } = await import('./ports.js');
      return portManager.calculatePortUtilization() / 100;
    } catch (error) {
      return 0.5; // Default assumption
    }
  }

  /**
   * Clean up old data
   */
  async cleanupOldData() {
    const cutoffTime = Date.now() - (this.config.retention_days * 24 * 60 * 60 * 1000);
    
    // Clean up real-time data
    for (const [key, snapshot] of this.realTimeData) {
      if (snapshot.timestamp < cutoffTime) {
        this.realTimeData.delete(key);
      }
    }
    
    // Clean up metrics
    for (const [key, metric] of this.metrics) {
      if (key.startsWith('daily_') || key.startsWith('hourly_')) {
        const dateStr = key.includes('hourly_') ? key.split('_')[1] : key.split('_')[1];
        const metricTime = new Date(dateStr).getTime();
        
        if (metricTime < cutoffTime) {
          this.metrics.delete(key);
        }
      }
    }
    
    console.log(`🧹 Cleaned up data older than ${this.config.retention_days} days`);
  }

  /**
   * Save analytics data to persistent storage
   */
  async saveAnalyticsData() {
    try {
      await Promise.all([
        this.saveMetrics(),
        this.saveTrends(),
        this.savePatterns()
      ]);
      
      console.log('💾 Analytics data saved successfully');
    } catch (error) {
      console.error('❌ Failed to save analytics data:', error.message);
    }
  }

  /**
   * Save metrics data
   */
  async saveMetrics() {
    const data = Object.fromEntries(this.metrics);
    await fs.writeFile(this.metricsPath, JSON.stringify(data, null, 2));
  }

  /**
   * Save trends data
   */
  async saveTrends() {
    const data = Object.fromEntries(this.trends);
    await fs.writeFile(this.trendsPath, JSON.stringify(data, null, 2));
  }

  /**
   * Save patterns data
   */
  async savePatterns() {
    const data = Object.fromEntries(this.patterns);
    await fs.writeFile(this.patternsPath, JSON.stringify(data, null, 2));
  }

  /**
   * Generate comprehensive analytics report
   */
  async generateAnalyticsReport(timeframe = '24h') {
    const report = {
      generated_at: new Date().toISOString(),
      timeframe,
      summary: await this.generateSummary(),
      metrics: await this.getMetricsSummary(timeframe),
      trends: await this.getTrendsSummary(),
      patterns: await this.getPatternsSummary(),
      anomalies: await this.getAnomaliesSummary(),
      predictions: await this.getPredictionsSummary(),
      recommendations: await this.generateRecommendations()
    };
    
    // Save report
    const reportPath = path.join(this.reportsPath, `analytics-report-${Date.now()}.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    return report;
  }

  /**
   * Generate summary statistics
   */
  async generateSummary() {
    const latestSnapshot = Array.from(this.realTimeData.values()).slice(-1)[0];
    
    if (!latestSnapshot) {
      return { status: 'no_data' };
    }
    
    return {
      current_system_ports: latestSnapshot.system_ports.port_count,
      current_docker_ports: latestSnapshot.docker_ports.total_port_mappings,
      current_processes: latestSnapshot.process_ports.process_count,
      data_collection_active: this.collectionInterval !== null,
      analysis_active: this.analysisInterval !== null,
      total_snapshots: this.realTimeData.size
    };
  }

  /**
   * Get metrics summary
   */
  async getMetricsSummary(timeframe) {
    // This would aggregate metrics based on timeframe
    return {
      timeframe,
      avg_port_usage: 0,
      peak_port_usage: 0,
      port_growth_rate: 0
    };
  }

  /**
   * Get trends summary
   */
  async getTrendsSummary() {
    const dailyTrend = this.trends.get('daily_port_usage');
    const serviceTrends = this.trends.get('service_trends');
    
    return {
      daily_trend: dailyTrend?.system_port_trend?.trend_direction || 'unknown',
      service_count: serviceTrends ? Object.keys(serviceTrends).length : 0,
      trend_confidence: dailyTrend?.system_port_trend?.correlation || 0
    };
  }

  /**
   * Get patterns summary
   */
  async getPatternsSummary() {
    const patterns = this.patterns.get('usage_patterns');
    
    return {
      peak_hours_detected: patterns?.peak_usage_hours?.peak_hours?.length || 0,
      port_clusters_detected: patterns?.port_clustering?.total_clusters || 0,
      patterns_analyzed: patterns ? Object.keys(patterns).length : 0
    };
  }

  /**
   * Get anomalies summary
   */
  async getAnomaliesSummary() {
    const anomalies = this.patterns.get('anomalies');
    
    return {
      recent_anomalies: anomalies?.detected_anomalies?.length || 0,
      high_severity_anomalies: anomalies?.detected_anomalies?.filter(a => 
        a.anomalies.some(an => an.severity === 'high')).length || 0
    };
  }

  /**
   * Get predictions summary
   */
  async getPredictionsSummary() {
    const predictions = this.patterns.get('predictions');
    
    return {
      port_usage_forecast: predictions?.port_usage_forecast?.predicted_port_usage || 'unknown',
      forecast_confidence: predictions?.port_usage_forecast?.confidence || 0,
      capacity_warnings: predictions?.capacity_planning?.capacity_warnings?.length || 0
    };
  }

  /**
   * Generate recommendations based on analysis
   */
  async generateRecommendations() {
    const recommendations = [];
    
    // Check for high utilization
    const currentUtilization = await this.getCurrentPortUtilization();
    if (currentUtilization > 0.8) {
      recommendations.push({
        type: 'capacity',
        priority: 'high',
        message: 'Port utilization is high, consider expanding port ranges',
        action: 'expand_port_range'
      });
    }
    
    // Check for anomalies
    const anomalies = this.patterns.get('anomalies');
    if (anomalies && anomalies.detected_anomalies.length > 0) {
      recommendations.push({
        type: 'monitoring',
        priority: 'medium',
        message: 'Recent anomalies detected, investigate unusual port usage patterns',
        action: 'investigate_anomalies'
      });
    }
    
    // Check trends
    const dailyTrend = this.trends.get('daily_port_usage');
    if (dailyTrend?.system_port_trend?.trend_direction === 'increasing') {
      recommendations.push({
        type: 'planning',
        priority: 'low',
        message: 'Port usage is trending upward, plan for future capacity needs',
        action: 'capacity_planning'
      });
    }
    
    return recommendations;
  }

  /**
   * Stop analytics collection and analysis
   */
  async stop() {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }
    
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }
    
    await this.saveAnalyticsData();
    
    console.log('📊 Port Usage Analytics System stopped');
    this.emit('stopped');
  }
}

// Export singleton instance
const portUsageAnalyzer = new PortUsageAnalyzer();

export default portUsageAnalyzer;
export { PortUsageAnalyzer };
