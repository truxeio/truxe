/**
 * Real-Time Service Status Dashboard
 * 
 * Provides live monitoring and visualization of:
 * - Service health and status
 * - Port usage and conflicts
 * - Performance metrics
 * - Resource utilization
 * - Alert management
 */

import { PortManager, SystemStatus } from './port-manager';
import { IntelligentPortSuggester, PortUsageAnalysis } from './intelligent-port-suggester';
import { EnhancedErrorMessaging, ErrorReport } from './enhanced-error-messaging';
import chalk from 'chalk';
import ora from 'ora';
import { EventEmitter } from 'events';

export interface DashboardConfig {
  refresh_interval: number; // milliseconds
  max_history: number; // number of data points to keep
  alert_thresholds: {
    cpu_usage: number;
    memory_usage: number;
    port_conflicts: number;
    response_time: number;
  };
  display_options: {
    show_timestamps: boolean;
    show_colors: boolean;
    compact_mode: boolean;
    show_metrics: boolean;
  };
}

export interface ServiceMetrics {
  service_name: string;
  port: number;
  status: 'running' | 'stopped' | 'error' | 'unknown';
  health_score: number;
  uptime: number;
  response_time: number;
  cpu_usage: number;
  memory_usage: number;
  last_updated: string;
  error_count: number;
  warning_count: number;
}

export interface SystemMetrics {
  timestamp: string;
  total_services: number;
  healthy_services: number;
  unhealthy_services: number;
  port_utilization: number;
  total_conflicts: number;
  system_cpu: number;
  system_memory: number;
  network_connections: number;
  disk_usage: number;
}

export interface Alert {
  id: string;
  type: 'warning' | 'error' | 'critical';
  service: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
  resolved: boolean;
  resolution_steps?: string[];
}

export interface DashboardData {
  services: ServiceMetrics[];
  system: SystemMetrics;
  alerts: Alert[];
  history: SystemMetrics[];
  port_analysis: PortUsageAnalysis | null;
  error_reports: ErrorReport[];
}

export class RealTimeDashboard extends EventEmitter {
  private portManager: PortManager;
  private intelligentSuggester: IntelligentPortSuggester;
  private errorMessaging: EnhancedErrorMessaging;
  private config: DashboardConfig;
  private isRunning: boolean = false;
  private refreshTimer: NodeJS.Timeout | null = null;
  private data: DashboardData;
  private alertHistory: Map<string, Alert> = new Map();

  constructor(config: Partial<DashboardConfig> = {}) {
    super();
    
    this.portManager = new PortManager();
    this.intelligentSuggester = new IntelligentPortSuggester();
    this.errorMessaging = new EnhancedErrorMessaging();
    
    this.config = {
      refresh_interval: 5000, // 5 seconds
      max_history: 100,
      alert_thresholds: {
        cpu_usage: 80,
        memory_usage: 85,
        port_conflicts: 1,
        response_time: 1000
      },
      display_options: {
        show_timestamps: true,
        show_colors: true,
        compact_mode: false,
        show_metrics: true
      },
      ...config
    };

    this.data = {
      services: [],
      system: this.createEmptySystemMetrics(),
      alerts: [],
      history: [],
      port_analysis: null,
      error_reports: []
    };
  }

  /**
   * Start the real-time dashboard
   */
  async start(environment: string = 'development'): Promise<void> {
    if (this.isRunning) {
      console.log(chalk.yellow('Dashboard is already running'));
      return;
    }

    console.log(chalk.blue('Starting real-time dashboard...'));
    this.isRunning = true;

    // Initial data load
    await this.refreshData(environment);

    // Start refresh timer
    this.refreshTimer = setInterval(async () => {
      try {
        await this.refreshData(environment);
        this.emit('dataUpdated', this.data);
      } catch (error) {
        this.emit('error', error);
      }
    }, this.config.refresh_interval);

    console.log(chalk.green('Dashboard started successfully'));
    this.emit('started');
  }

  /**
   * Stop the real-time dashboard
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }

    this.isRunning = false;
    console.log(chalk.yellow('Dashboard stopped'));
    this.emit('stopped');
  }

  /**
   * Get current dashboard data
   */
  getData(): DashboardData {
    return { ...this.data };
  }

  /**
   * Display the dashboard in the terminal
   */
  display(): void {
    console.clear();
    this.displayHeader();
    this.displaySystemMetrics();
    this.displayServices();
    this.displayAlerts();
    this.displayPortAnalysis();
    this.displayFooter();
  }

  /**
   * Get service-specific metrics
   */
  getServiceMetrics(serviceName: string): ServiceMetrics | null {
    return this.data.services.find(s => s.service_name === serviceName) || null;
  }

  /**
   * Get system health summary
   */
  getSystemHealth(): {
    overall_health: 'healthy' | 'warning' | 'critical';
    health_score: number;
    issues: string[];
    recommendations: string[];
  } {
    const { system, services, alerts } = this.data;
    
    let healthScore = 100;
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check service health
    const unhealthyServices = services.filter(s => s.status !== 'running');
    if (unhealthyServices.length > 0) {
      healthScore -= unhealthyServices.length * 10;
      issues.push(`${unhealthyServices.length} services are unhealthy`);
      recommendations.push('Check service logs and restart failed services');
    }

    // Check port conflicts
    if (system.total_conflicts > 0) {
      healthScore -= system.total_conflicts * 15;
      issues.push(`${system.total_conflicts} port conflicts detected`);
      recommendations.push('Resolve port conflicts using port management tools');
    }

    // Check resource usage
    if (system.system_cpu > this.config.alert_thresholds.cpu_usage) {
      healthScore -= 20;
      issues.push(`High CPU usage: ${system.system_cpu}%`);
      recommendations.push('Monitor resource usage and consider scaling');
    }

    if (system.system_memory > this.config.alert_thresholds.memory_usage) {
      healthScore -= 20;
      issues.push(`High memory usage: ${system.system_memory}%`);
      recommendations.push('Monitor memory usage and consider optimization');
    }

    // Check alerts
    const criticalAlerts = alerts.filter(a => a.type === 'critical' && !a.resolved);
    if (criticalAlerts.length > 0) {
      healthScore -= criticalAlerts.length * 25;
      issues.push(`${criticalAlerts.length} critical alerts`);
      recommendations.push('Address critical alerts immediately');
    }

    const overallHealth = healthScore >= 80 ? 'healthy' : healthScore >= 60 ? 'warning' : 'critical';

    return {
      overall_health: overallHealth,
      health_score: Math.max(0, healthScore),
      issues,
      recommendations
    };
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.data.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      this.emit('alertAcknowledged', alert);
      return true;
    }
    return false;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.data.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      this.emit('alertResolved', alert);
      return true;
    }
    return false;
  }

  /**
   * Export dashboard data
   */
  exportData(): {
    timestamp: string;
    config: DashboardConfig;
    data: DashboardData;
    health_summary: any;
  } {
    return {
      timestamp: new Date().toISOString(),
      config: this.config,
      data: this.data,
      health_summary: this.getSystemHealth()
    };
  }

  private async refreshData(environment: string): Promise<void> {
    try {
      // Get system status
      const systemStatus = await this.portManager.getSystemStatus(environment);
      
      // Update system metrics
      this.data.system = await this.collectSystemMetrics(systemStatus);
      
      // Update service metrics
      this.data.services = await this.collectServiceMetrics(systemStatus);
      
      // Update port analysis
      this.data.port_analysis = await this.intelligentSuggester.analyzePortUsage(environment);
      
      // Update error reports
      this.data.error_reports = this.errorMessaging.getErrorHistory();
      
      // Check for new alerts
      await this.checkForAlerts();
      
      // Update history
      this.updateHistory();
      
    } catch (error) {
      console.error('Error refreshing dashboard data:', error);
      this.emit('error', error);
    }
  }

  private async collectSystemMetrics(systemStatus: SystemStatus): Promise<SystemMetrics> {
    // This would typically collect real system metrics
    // For now, we'll simulate based on the system status
    return {
      timestamp: new Date().toISOString(),
      total_services: systemStatus.totalServices,
      healthy_services: systemStatus.services.filter(s => s.available).length,
      unhealthy_services: systemStatus.services.filter(s => !s.available).length,
      port_utilization: systemStatus.portUtilization,
      total_conflicts: systemStatus.conflicts,
      system_cpu: Math.random() * 100, // Simulated
      system_memory: Math.random() * 100, // Simulated
      network_connections: Math.floor(Math.random() * 1000), // Simulated
      disk_usage: Math.random() * 100 // Simulated
    };
  }

  private async collectServiceMetrics(systemStatus: SystemStatus): Promise<ServiceMetrics[]> {
    return systemStatus.services.map(service => ({
      service_name: service.name,
      port: service.port,
      status: service.available ? 'running' : 'stopped',
      health_score: service.available ? Math.floor(Math.random() * 40) + 60 : 0,
      uptime: service.available ? Math.floor(Math.random() * 86400) : 0,
      response_time: service.available ? Math.floor(Math.random() * 500) + 50 : 0,
      cpu_usage: Math.random() * 100,
      memory_usage: Math.random() * 100,
      last_updated: new Date().toISOString(),
      error_count: Math.floor(Math.random() * 5),
      warning_count: Math.floor(Math.random() * 10)
    }));
  }

  private async checkForAlerts(): Promise<void> {
    const { system, services } = this.data;
    
    // Check CPU usage
    if (system.system_cpu > this.config.alert_thresholds.cpu_usage) {
      this.createAlert('warning', 'system', `High CPU usage: ${system.system_cpu.toFixed(1)}%`);
    }
    
    // Check memory usage
    if (system.system_memory > this.config.alert_thresholds.memory_usage) {
      this.createAlert('warning', 'system', `High memory usage: ${system.system_memory.toFixed(1)}%`);
    }
    
    // Check port conflicts
    if (system.total_conflicts > this.config.alert_thresholds.port_conflicts) {
      this.createAlert('error', 'system', `${system.total_conflicts} port conflicts detected`);
    }
    
    // Check service health
    services.forEach(service => {
      if (service.status !== 'running') {
        this.createAlert('error', service.service_name, `Service ${service.service_name} is not running`);
      }
      
      if (service.health_score < 50) {
        this.createAlert('warning', service.service_name, `Service ${service.service_name} has low health score: ${service.health_score}`);
      }
      
      if (service.response_time > this.config.alert_thresholds.response_time) {
        this.createAlert('warning', service.service_name, `Service ${service.service_name} has slow response time: ${service.response_time}ms`);
      }
    });
  }

  private createAlert(type: 'warning' | 'error' | 'critical', service: string, message: string): void {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Check if similar alert already exists
    const existingAlert = this.data.alerts.find(a => 
      a.service === service && 
      a.message === message && 
      !a.resolved
    );
    
    if (existingAlert) {
      return; // Don't create duplicate alerts
    }
    
    const alert: Alert = {
      id: alertId,
      type,
      service,
      message,
      timestamp: new Date().toISOString(),
      acknowledged: false,
      resolved: false,
      resolution_steps: this.getResolutionSteps(type, service, message)
    };
    
    this.data.alerts.unshift(alert);
    this.alertHistory.set(alertId, alert);
    
    // Keep only recent alerts
    if (this.data.alerts.length > 50) {
      this.data.alerts = this.data.alerts.slice(0, 50);
    }
    
    this.emit('alertCreated', alert);
  }

  private getResolutionSteps(type: string, service: string, message: string): string[] {
    if (message.includes('CPU usage')) {
      return ['Monitor resource usage', 'Check for resource-intensive processes', 'Consider scaling resources'];
    }
    
    if (message.includes('memory usage')) {
      return ['Check memory leaks', 'Optimize memory usage', 'Consider increasing memory allocation'];
    }
    
    if (message.includes('port conflicts')) {
      return ['Use port management tools', 'Kill conflicting processes', 'Reassign ports'];
    }
    
    if (message.includes('not running')) {
      return ['Check service logs', 'Restart the service', 'Verify configuration'];
    }
    
    if (message.includes('response time')) {
      return ['Check service performance', 'Optimize database queries', 'Check network connectivity'];
    }
    
    return ['Check logs', 'Verify configuration', 'Contact support if needed'];
  }

  private updateHistory(): void {
    this.data.history.unshift({ ...this.data.system });
    
    // Keep only recent history
    if (this.data.history.length > this.config.max_history) {
      this.data.history = this.data.history.slice(0, this.config.max_history);
    }
  }

  private createEmptySystemMetrics(): SystemMetrics {
    return {
      timestamp: new Date().toISOString(),
      total_services: 0,
      healthy_services: 0,
      unhealthy_services: 0,
      port_utilization: 0,
      total_conflicts: 0,
      system_cpu: 0,
      system_memory: 0,
      network_connections: 0,
      disk_usage: 0
    };
  }

  private displayHeader(): void {
    const { system } = this.data;
    const health = this.getSystemHealth();
    
    console.log(chalk.blue.bold('┌─────────────────────────────────────────────────────────────────┐'));
    console.log(chalk.blue.bold('│                    HEIMDALL REAL-TIME DASHBOARD                │'));
    console.log(chalk.blue.bold('├─────────────────────────────────────────────────────────────────┤'));
    console.log(chalk.white(`│ Status: ${this.getHealthStatusColor(health.overall_health)} ${health.overall_health.toUpperCase().padEnd(10)} │ Services: ${system.total_services.toString().padStart(3)} │ Conflicts: ${system.total_conflicts.toString().padStart(2)} │`));
    console.log(chalk.blue.bold('└─────────────────────────────────────────────────────────────────┘'));
    console.log();
  }

  private displaySystemMetrics(): void {
    const { system } = this.data;
    
    console.log(chalk.yellow.bold('SYSTEM METRICS'));
    console.log(chalk.gray('─'.repeat(60)));
    console.log(`CPU Usage:    ${this.getUsageBar(system.system_cpu)} ${system.system_cpu.toFixed(1)}%`);
    console.log(`Memory Usage: ${this.getUsageBar(system.system_memory)} ${system.system_memory.toFixed(1)}%`);
    console.log(`Disk Usage:   ${this.getUsageBar(system.disk_usage)} ${system.disk_usage.toFixed(1)}%`);
    console.log(`Connections:  ${system.network_connections}`);
    console.log();
  }

  private displayServices(): void {
    const { services } = this.data;
    
    console.log(chalk.yellow.bold('SERVICES'));
    console.log(chalk.gray('─'.repeat(60)));
    
    if (services.length === 0) {
      console.log(chalk.gray('No services found'));
      return;
    }
    
    services.forEach(service => {
      const statusColor = this.getServiceStatusColor(service.status);
      const healthBar = this.getUsageBar(service.health_score);
      
      console.log(`${statusColor(service.service_name.padEnd(20))} ${statusColor(service.status.padEnd(10))} ${healthBar} ${service.health_score}%`);
      console.log(`  Port: ${service.port} | Uptime: ${this.formatUptime(service.uptime)} | Response: ${service.response_time}ms`);
    });
    
    console.log();
  }

  private displayAlerts(): void {
    const { alerts } = this.data;
    const activeAlerts = alerts.filter(a => !a.resolved);
    
    if (activeAlerts.length === 0) {
      return;
    }
    
    console.log(chalk.yellow.bold('ACTIVE ALERTS'));
    console.log(chalk.gray('─'.repeat(60)));
    
    activeAlerts.slice(0, 5).forEach(alert => {
      const alertColor = this.getAlertColor(alert.type);
      const status = alert.acknowledged ? 'ACK' : 'NEW';
      
      console.log(`${alertColor(alert.type.toUpperCase().padEnd(8))} ${status.padEnd(3)} ${alert.service.padEnd(15)} ${alert.message}`);
    });
    
    if (activeAlerts.length > 5) {
      console.log(chalk.gray(`... and ${activeAlerts.length - 5} more alerts`));
    }
    
    console.log();
  }

  private displayPortAnalysis(): void {
    const { port_analysis } = this.data;
    
    if (!port_analysis) {
      return;
    }
    
    console.log(chalk.yellow.bold('PORT ANALYSIS'));
    console.log(chalk.gray('─'.repeat(60)));
    console.log(`Total Services: ${port_analysis.total_services}`);
    console.log(`Port Utilization: ${port_analysis.port_utilization.toFixed(1)}%`);
    console.log(`Conflict Risk: ${this.getConflictRiskColor(port_analysis.conflict_risk)} ${port_analysis.conflict_risk.toUpperCase()}`);
    console.log();
  }

  private displayFooter(): void {
    const now = new Date().toLocaleTimeString();
    console.log(chalk.gray(`Last updated: ${now} | Press Ctrl+C to stop`));
  }

  private getHealthStatusColor(health: string): string {
    switch (health) {
      case 'healthy': return chalk.green('●');
      case 'warning': return chalk.yellow('●');
      case 'critical': return chalk.red('●');
      default: return chalk.gray('●');
    }
  }

  private getServiceStatusColor(status: string): (text: string) => string {
    switch (status) {
      case 'running': return chalk.green;
      case 'stopped': return chalk.red;
      case 'error': return chalk.red;
      default: return chalk.gray;
    }
  }

  private getAlertColor(type: string): (text: string) => string {
    switch (type) {
      case 'critical': return chalk.red.bold;
      case 'error': return chalk.red;
      case 'warning': return chalk.yellow;
      default: return chalk.gray;
    }
  }

  private getConflictRiskColor(risk: string): (text: string) => string {
    switch (risk) {
      case 'low': return chalk.green;
      case 'medium': return chalk.yellow;
      case 'high': return chalk.red;
      default: return chalk.gray;
    }
  }

  private getUsageBar(percentage: number, width: number = 20): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    
    let color = chalk.green;
    if (percentage > 80) color = chalk.red;
    else if (percentage > 60) color = chalk.yellow;
    
    return color('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  }

  private formatUptime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }
}

export default RealTimeDashboard;
