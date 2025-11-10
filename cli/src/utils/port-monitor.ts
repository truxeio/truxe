import { EventEmitter } from 'events';
import { PortManager } from './port-manager';
import fs from 'fs/promises';
import path from 'path';

export interface MonitoringOptions {
  environment: string;
  duration: number;
  interval: number;
  enableAlerts: boolean;
  onUpdate?: (data: MonitoringUpdate) => void;
  onAlert?: (alert: MonitoringAlert) => void;
}

export interface MonitoringUpdate {
  timestamp: Date;
  portsChecked: number;
  conflicts: number;
  availablePorts: number;
  newConflicts: number[];
  resolvedConflicts: number[];
}

export interface MonitoringAlert {
  type: 'conflict' | 'resolution' | 'threshold';
  message: string;
  port?: number;
  details?: any;
  timestamp: Date;
}

export interface MonitoringStatistics {
  totalChecks: number;
  conflictsDetected: number;
  avgResponseTime: number;
  uptime: number;
  portActivity: { [port: number]: PortActivity };
}

export interface PortActivity {
  port: number;
  checks: number;
  conflicts: number;
  lastStatus: 'available' | 'in-use';
  lastCheck: Date;
  statusChanges: number;
}

export class PortMonitor extends EventEmitter {
  private portManager: PortManager;
  private isMonitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private startTime: Date | null = null;
  private statistics: MonitoringStatistics;
  private previousResults: Map<number, boolean> = new Map();
  private monitoringData: MonitoringUpdate[] = [];

  constructor() {
    super();
    this.portManager = new PortManager();
    this.statistics = {
      totalChecks: 0,
      conflictsDetected: 0,
      avgResponseTime: 0,
      uptime: 0,
      portActivity: {}
    };
  }

  async startMonitoring(options: MonitoringOptions): Promise<void> {
    if (this.isMonitoring) {
      throw new Error('Monitoring is already active');
    }

    this.isMonitoring = true;
    this.startTime = new Date();
    this.monitoringData = [];
    
    const ports = await this.portManager.getEnvironmentPorts(options.environment);
    
    // Initialize port activity tracking
    ports.forEach(port => {
      this.statistics.portActivity[port] = {
        port,
        checks: 0,
        conflicts: 0,
        lastStatus: 'available',
        lastCheck: new Date(),
        statusChanges: 0
      };
    });

    // Start monitoring loop
    this.monitoringInterval = setInterval(async () => {
      await this.performMonitoringCheck(ports, options);
    }, options.interval);

    // Perform initial check
    await this.performMonitoringCheck(ports, options);

    // Stop monitoring after duration
    setTimeout(() => {
      this.stopMonitoring();
    }, options.duration);
  }

  private async performMonitoringCheck(ports: number[], options: MonitoringOptions): Promise<void> {
    const checkStart = Date.now();
    
    try {
      const results = await this.portManager.checkPorts(ports, options.environment);
      const checkDuration = Date.now() - checkStart;
      
      // Update statistics
      this.statistics.totalChecks++;
      this.updateAverageResponseTime(checkDuration);
      
      const conflicts = results.filter(r => !r.available);
      const newConflicts: number[] = [];
      const resolvedConflicts: number[] = [];
      
      // Analyze changes
      results.forEach(result => {
        const port = result.port;
        const wasAvailable = this.previousResults.get(port) ?? true;
        const isAvailable = result.available;
        
        // Update port activity
        const activity = this.statistics.portActivity[port];
        if (activity) {
          activity.checks++;
          activity.lastCheck = new Date();
          
          if (!isAvailable) {
            activity.conflicts++;
            this.statistics.conflictsDetected++;
          }
          
          if (wasAvailable !== isAvailable) {
            activity.statusChanges++;
            
            if (!isAvailable) {
              newConflicts.push(port);
              activity.lastStatus = 'in-use';
              
              if (options.enableAlerts) {
                this.emitAlert({
                  type: 'conflict',
                  message: `New conflict detected on port ${port}`,
                  port,
                  details: result,
                  timestamp: new Date()
                });
              }
            } else {
              resolvedConflicts.push(port);
              activity.lastStatus = 'available';
              
              if (options.enableAlerts) {
                this.emitAlert({
                  type: 'resolution',
                  message: `Conflict resolved on port ${port}`,
                  port,
                  timestamp: new Date()
                });
              }
            }
          } else {
            activity.lastStatus = isAvailable ? 'available' : 'in-use';
          }
        }
        
        this.previousResults.set(port, isAvailable);
      });
      
      // Create monitoring update
      const update: MonitoringUpdate = {
        timestamp: new Date(),
        portsChecked: ports.length,
        conflicts: conflicts.length,
        availablePorts: results.filter(r => r.available).length,
        newConflicts,
        resolvedConflicts
      };
      
      this.monitoringData.push(update);
      
      // Call update callback
      if (options.onUpdate) {
        options.onUpdate(update);
      }
      
      // Emit events
      this.emit('update', update);
      
      if (newConflicts.length > 0) {
        this.emit('conflicts', newConflicts);
      }
      
      if (resolvedConflicts.length > 0) {
        this.emit('resolutions', resolvedConflicts);
      }
      
    } catch (error) {
      this.emit('error', error);
    }
  }

  private updateAverageResponseTime(duration: number): void {
    const currentAvg = this.statistics.avgResponseTime;
    const totalChecks = this.statistics.totalChecks;
    
    this.statistics.avgResponseTime = Math.round(
      (currentAvg * (totalChecks - 1) + duration) / totalChecks
    );
  }

  private emitAlert(alert: MonitoringAlert): void {
    this.emit('alert', alert);
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.isMonitoring = false;
    
    if (this.startTime) {
      this.statistics.uptime = Date.now() - this.startTime.getTime();
    }
    
    this.emit('stopped', this.statistics);
  }

  getStatistics(): MonitoringStatistics {
    if (this.startTime) {
      this.statistics.uptime = Date.now() - this.startTime.getTime();
    }
    
    return { ...this.statistics };
  }

  getMonitoringData(): MonitoringUpdate[] {
    return [...this.monitoringData];
  }

  isActive(): boolean {
    return this.isMonitoring;
  }

  async exportData(format: 'json' | 'csv' = 'json'): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `port-monitoring-${timestamp}.${format}`;
    const filepath = path.join(process.cwd(), filename);
    
    const exportData = {
      metadata: {
        exportTime: new Date().toISOString(),
        monitoringDuration: this.statistics.uptime,
        totalChecks: this.statistics.totalChecks
      },
      statistics: this.statistics,
      monitoringData: this.monitoringData
    };
    
    if (format === 'json') {
      await fs.writeFile(filepath, JSON.stringify(exportData, null, 2));
    } else if (format === 'csv') {
      const csv = this.convertToCSV(exportData);
      await fs.writeFile(filepath, csv);
    }
    
    return filepath;
  }

  private convertToCSV(data: any): string {
    const headers = [
      'timestamp',
      'portsChecked',
      'conflicts',
      'availablePorts',
      'newConflicts',
      'resolvedConflicts'
    ];
    
    const csvLines = [headers.join(',')];
    
    data.monitoringData.forEach((update: MonitoringUpdate) => {
      const row = [
        update.timestamp.toISOString(),
        update.portsChecked.toString(),
        update.conflicts.toString(),
        update.availablePorts.toString(),
        update.newConflicts.join(';'),
        update.resolvedConflicts.join(';')
      ];
      csvLines.push(row.join(','));
    });
    
    return csvLines.join('\n');
  }

  // Real-time monitoring with live updates
  async startLiveMonitoring(options: MonitoringOptions): Promise<void> {
    await this.startMonitoring({
      ...options,
      onUpdate: (data) => {
        this.displayLiveUpdate(data);
        if (options.onUpdate) {
          options.onUpdate(data);
        }
      },
      onAlert: (alert) => {
        this.displayLiveAlert(alert);
        if (options.onAlert) {
          options.onAlert(alert);
        }
      }
    });
  }

  private displayLiveUpdate(data: MonitoringUpdate): void {
    const timestamp = data.timestamp.toLocaleTimeString();
    const status = data.conflicts > 0 ? `⚠️  ${data.conflicts} conflicts` : '✅ All clear';
    
    // Clear line and display update
    process.stdout.write('\r\x1b[K'); // Clear current line
    process.stdout.write(`${timestamp} - ${status} - Checked ${data.portsChecked} ports`);
    
    if (data.newConflicts.length > 0) {
      console.log(`\n🚨 New conflicts: ${data.newConflicts.join(', ')}`);
    }
    
    if (data.resolvedConflicts.length > 0) {
      console.log(`\n✅ Resolved: ${data.resolvedConflicts.join(', ')}`);
    }
  }

  private displayLiveAlert(alert: MonitoringAlert): void {
    console.log(); // New line
    
    const icon = {
      conflict: '🚨',
      resolution: '✅',
      threshold: '⚠️'
    }[alert.type] || '📢';
    
    console.log(`${icon} ${alert.message}`);
    
    if (alert.details) {
      console.log(`   Details: ${JSON.stringify(alert.details, null, 2)}`);
    }
  }

  // Get port usage patterns
  getUsagePatterns(timeframe: string = '1h'): any {
    const now = new Date();
    const timeframeMs = this.parseTimeframe(timeframe);
    const cutoffTime = new Date(now.getTime() - timeframeMs);
    
    const recentData = this.monitoringData.filter(
      update => update.timestamp >= cutoffTime
    );
    
    const patterns = {
      timeframe,
      totalEvents: recentData.length,
      conflictPatterns: this.analyzeConflictPatterns(recentData),
      portActivity: this.analyzePortActivity(recentData),
      trends: this.analyzeTrends(recentData)
    };
    
    return patterns;
  }

  private parseTimeframe(timeframe: string): number {
    const match = timeframe.match(/^(\d+)([smhd])$/);
    if (!match) return 3600000; // Default 1 hour
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    const multipliers = {
      s: 1000,
      m: 60000,
      h: 3600000,
      d: 86400000
    };
    
    return value * (multipliers[unit as keyof typeof multipliers] || 3600000);
  }

  private analyzeConflictPatterns(data: MonitoringUpdate[]): any {
    const totalConflicts = data.reduce((sum, update) => sum + update.newConflicts.length, 0);
    const conflictFrequency = data.length > 0 ? totalConflicts / data.length : 0;
    
    return {
      total_conflicts: totalConflicts,
      conflict_frequency: conflictFrequency,
      peak_conflicts: Math.max(...data.map(d => d.conflicts)),
      avg_conflicts: data.length > 0 ? data.reduce((sum, d) => sum + d.conflicts, 0) / data.length : 0
    };
  }

  private analyzePortActivity(_data: MonitoringUpdate[]): any {
    const portActivity: { [port: number]: any } = {};
    
    Object.entries(this.statistics.portActivity).forEach(([port, activity]) => {
      portActivity[parseInt(port)] = {
        events: activity.checks,
        conflicts: activity.conflicts,
        last_status: activity.lastStatus,
        status_changes: activity.statusChanges,
        conflict_rate: activity.checks > 0 ? activity.conflicts / activity.checks : 0
      };
    });
    
    return portActivity;
  }

  private analyzeTrends(data: MonitoringUpdate[]): any {
    if (data.length < 2) return { trend: 'insufficient_data' };
    
    const recent = data.slice(-5);
    const earlier = data.slice(0, 5);
    
    const recentAvg = recent.reduce((sum, d) => sum + d.conflicts, 0) / recent.length;
    const earlierAvg = earlier.reduce((sum, d) => sum + d.conflicts, 0) / earlier.length;
    
    let trend = 'stable';
    if (recentAvg > earlierAvg * 1.2) {
      trend = 'increasing';
    } else if (recentAvg < earlierAvg * 0.8) {
      trend = 'decreasing';
    }
    
    return {
      trend,
      recent_avg: recentAvg,
      earlier_avg: earlierAvg,
      change_rate: earlierAvg > 0 ? (recentAvg - earlierAvg) / earlierAvg : 0
    };
  }
}
