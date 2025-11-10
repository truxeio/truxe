import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import WebSocket from 'ws';
import blessed from 'blessed';
import contrib from 'blessed-contrib';
import { Logger } from '../utils/logger';
import { ErrorHandler } from '../utils/error-handler';

interface DashboardData {
  services: ServiceStatus[];
  ports: PortStatus[];
  system: SystemMetrics;
  performance: PerformanceMetrics;
  alerts: Alert[];
  lastUpdate: number;
  isMonitoring: boolean;
}

interface ServiceStatus {
  id: string;
  name: string;
  port: number;
  status: 'healthy' | 'unhealthy' | 'stopped' | 'error' | 'running';
  responseTime: number | null;
  lastCheck: number;
  details?: string;
}

interface PortStatus {
  port: number;
  serviceName: string;
  inUse: boolean;
  pid?: number;
  command?: string;
  lastCheck: number;
}

interface SystemMetrics {
  cpu: number;
  memory: number;
  uptime: number;
  loadAverage: number[];
  totalMemory: number;
  freeMemory: number;
}

interface PerformanceMetrics {
  requestCount: number;
  errorRate: number;
  averageResponseTime: number;
  rateLimitViolations: number;
  securityThreats: number;
}

interface Alert {
  id: string;
  type: string;
  severity: 'low' | 'warning' | 'critical';
  message: string;
  timestamp: number;
}

export function dashboardCommand(program: Command): void {
  const dashboard = program
    .command('dashboard')
    .description('Real-time service status dashboard')
    .option('--verbose', 'Enable verbose output');

  // heimdall dashboard show - Show dashboard in terminal
  dashboard
    .command('show')
    .description('Show real-time dashboard in terminal')
    .option('--api-url <url>', 'API server URL', 'http://localhost:21001')
    .option('--refresh <seconds>', 'Refresh interval in seconds', '5')
    .option('--compact', 'Use compact display mode')
    .action(async (options) => {
      try {
        await showTerminalDashboard(options);
      } catch (error) {
        ErrorHandler.handle(error as Error, 'Dashboard Show');
      }
    });

  // heimdall dashboard status - Quick status check
  dashboard
    .command('status')
    .description('Show quick status overview')
    .option('--api-url <url>', 'API server URL', 'http://localhost:21001')
    .option('--json', 'Output in JSON format')
    .action(async (options) => {
      const logger = new Logger();
      
      try {
        logger.header('📊 Service Status Overview');
        
        const data = await fetchDashboardData(options.apiUrl);
        
        if (options.json) {
          console.log(JSON.stringify(data, null, 2));
          return;
        }
        
        displayQuickStatus(data, logger);
        
      } catch (error) {
        ErrorHandler.handle(error as Error, 'Dashboard Status');
      }
    });

  // heimdall dashboard services - Show service details
  dashboard
    .command('services')
    .description('Show detailed service information')
    .option('--api-url <url>', 'API server URL', 'http://localhost:21001')
    .option('--service <name>', 'Show specific service details')
    .option('--json', 'Output in JSON format')
    .action(async (options) => {
      const logger = new Logger();
      
      try {
        logger.header('🔧 Service Details');
        
        if (options.service) {
          const serviceData = await fetchServiceDetails(options.apiUrl, options.service);
          
          if (options.json) {
            console.log(JSON.stringify(serviceData, null, 2));
            return;
          }
          
          displayServiceDetails(serviceData, logger);
        } else {
          const data = await fetchDashboardData(options.apiUrl);
          
          if (options.json) {
            console.log(JSON.stringify(data.services, null, 2));
            return;
          }
          
          displayServicesOverview(data.services, logger);
        }
        
      } catch (error) {
        ErrorHandler.handle(error as Error, 'Dashboard Services');
      }
    });

  // heimdall dashboard ports - Show port information
  dashboard
    .command('ports')
    .description('Show port usage information')
    .option('--api-url <url>', 'API server URL', 'http://localhost:21001')
    .option('--port <number>', 'Show specific port details')
    .option('--json', 'Output in JSON format')
    .action(async (options) => {
      const logger = new Logger();
      
      try {
        logger.header('🔌 Port Information');
        
        if (options.port) {
          const portData = await fetchPortDetails(options.apiUrl, options.port);
          
          if (options.json) {
            console.log(JSON.stringify(portData, null, 2));
            return;
          }
          
          displayPortDetails(portData, logger);
        } else {
          const data = await fetchDashboardData(options.apiUrl);
          
          if (options.json) {
            console.log(JSON.stringify(data.ports, null, 2));
            return;
          }
          
          displayPortsOverview(data.ports, logger);
        }
        
      } catch (error) {
        ErrorHandler.handle(error as Error, 'Dashboard Ports');
      }
    });

  // heimdall dashboard alerts - Show alerts
  dashboard
    .command('alerts')
    .description('Show current alerts and notifications')
    .option('--api-url <url>', 'API server URL', 'http://localhost:21001')
    .option('--severity <level>', 'Filter by severity (low|warning|critical)')
    .option('--type <type>', 'Filter by type (system|service|port|performance)')
    .option('--json', 'Output in JSON format')
    .action(async (options) => {
      const logger = new Logger();
      
      try {
        logger.header('🚨 System Alerts');
        
        const alerts = await fetchAlerts(options.apiUrl, {
          severity: options.severity,
          type: options.type
        });
        
        if (options.json) {
          console.log(JSON.stringify(alerts, null, 2));
          return;
        }
        
        displayAlerts(alerts, logger);
        
      } catch (error) {
        ErrorHandler.handle(error as Error, 'Dashboard Alerts');
      }
    });

  // heimdall dashboard kill - Kill process on port
  dashboard
    .command('kill')
    .description('Kill process using specific port')
    .argument('<port>', 'Port number')
    .option('--api-url <url>', 'API server URL', 'http://localhost:21001')
    .option('--force', 'Skip confirmation prompt')
    .action(async (port: string, options) => {
      const logger = new Logger();
      
      try {
        logger.header('🔪 Kill Port Process');
        
        const portNum = parseInt(port);
        if (isNaN(portNum)) {
          logger.error('Invalid port number provided');
          process.exit(1);
        }
        
        // Get port details first
        const portData = await fetchPortDetails(options.apiUrl, portNum);
        
        if (!portData.inUse) {
          logger.info(`Port ${portNum} is not in use`);
          return;
        }
        
        logger.info(`Port ${portNum} is used by: ${portData.command || 'unknown process'} (PID: ${portData.pid})`);
        
        let confirmed = options.force;
        if (!confirmed) {
          const answer = await inquirer.prompt([{
            type: 'confirm',
            name: 'proceed',
            message: `Kill process on port ${portNum}?`,
            default: false
          }]);
          confirmed = answer.proceed;
        }
        
        if (confirmed) {
          const spinner = ora(`Killing process on port ${portNum}...`).start();
          
          const result = await killPortProcess(options.apiUrl, portNum);
          
          spinner.stop();
          
          if (result.success) {
            logger.success(result.message);
          } else {
            logger.error(result.message);
          }
        } else {
          logger.info('Operation cancelled');
        }
        
      } catch (error) {
        ErrorHandler.handle(error as Error, 'Kill Port Process');
      }
    });
}

/**
 * Show real-time dashboard in terminal using blessed
 */
async function showTerminalDashboard(options: any): Promise<void> {
  const screen = blessed.screen({
    smartCSR: true,
    title: 'Heimdall Dashboard'
  });

  // Create grid layout
  const grid = new contrib.grid({ rows: 12, cols: 12, screen: screen });

  // Create widgets
  const servicesTable = grid.set(0, 0, 6, 6, contrib.table, {
    keys: true,
    fg: 'white',
    selectedFg: 'white',
    selectedBg: 'blue',
    interactive: false,
    label: 'Services',
    width: '50%',
    height: '50%',
    border: { type: 'line', fg: 'cyan' },
    columnSpacing: 2,
    columnWidth: [15, 8, 10, 15]
  });

  const portsTable = grid.set(0, 6, 6, 6, contrib.table, {
    keys: true,
    fg: 'white',
    selectedFg: 'white',
    selectedBg: 'blue',
    interactive: false,
    label: 'Ports',
    width: '50%',
    height: '50%',
    border: { type: 'line', fg: 'cyan' },
    columnSpacing: 2,
    columnWidth: [8, 15, 10, 8]
  });

  const systemGauge = grid.set(6, 0, 3, 3, contrib.gauge, {
    label: 'CPU Usage',
    stroke: 'green',
    fill: 'white'
  });

  const memoryGauge = grid.set(6, 3, 3, 3, contrib.gauge, {
    label: 'Memory Usage',
    stroke: 'green',
    fill: 'white'
  });

  const performanceChart = grid.set(6, 6, 6, 6, contrib.line, {
    style: {
      line: 'yellow',
      text: 'green',
      baseline: 'black'
    },
    xLabelPadding: 3,
    xPadding: 5,
    label: 'Response Time (ms)',
    showLegend: true,
    wholeNumbersOnly: false,
    legend: { width: 10 }
  });

  const alertsList = grid.set(9, 0, 3, 6, blessed.list, {
    label: 'Recent Alerts',
    border: { type: 'line', fg: 'red' },
    style: {
      selected: {
        bg: 'red'
      }
    },
    keys: true,
    vi: true
  });

  // Status bar
  const statusBar = blessed.box({
    parent: screen,
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    content: 'Loading...',
    style: {
      fg: 'white',
      bg: 'blue'
    }
  });

  // Performance data for chart
  const performanceData = {
    title: 'Response Time',
    style: { line: 'red' },
    x: [] as string[],
    y: [] as number[]
  };

  // Update function
  let updateCount = 0;
  const updateDashboard = async () => {
    try {
      const data = await fetchDashboardData(options.apiUrl);
      
      // Update services table
      const servicesData = [
        ['Service', 'Port', 'Status', 'Response Time']
      ];
      
      data.services.forEach(service => {
        const status = getStatusDisplay(service.status);
        const responseTime = service.responseTime ? `${service.responseTime}ms` : 'N/A';
        servicesData.push([
          service.name,
          service.port.toString(),
          status,
          responseTime
        ]);
      });
      
      servicesTable.setData({
        headers: servicesData[0],
        data: servicesData.slice(1)
      });

      // Update ports table
      const portsData = [
        ['Port', 'Service', 'Status', 'PID']
      ];
      
      data.ports.forEach(port => {
        const status = port.inUse ? 'In Use' : 'Available';
        const pid = port.pid ? port.pid.toString() : 'N/A';
        portsData.push([
          port.port.toString(),
          port.serviceName,
          status,
          pid
        ]);
      });
      
      portsTable.setData({
        headers: portsData[0],
        data: portsData.slice(1)
      });

      // Update system gauges
      systemGauge.setPercent(Math.round(data.system.cpu));
      memoryGauge.setPercent(Math.round(data.system.memory));

      // Update performance chart
      const now = new Date();
      const timeLabel = now.toLocaleTimeString();
      
      performanceData.x.push(timeLabel);
      performanceData.y.push(data.performance.averageResponseTime || 0);
      
      // Keep only last 20 data points
      if (performanceData.x.length > 20) {
        performanceData.x.shift();
        performanceData.y.shift();
      }
      
      performanceChart.setData([performanceData]);

      // Update alerts list
      const alertItems = data.alerts.slice(0, 10).map(alert => {
        const time = new Date(alert.timestamp).toLocaleTimeString();
        const severity = alert.severity.toUpperCase();
        return `[${time}] ${severity}: ${alert.message}`;
      });
      
      alertsList.setItems(alertItems);

      // Update status bar
      const healthyServices = data.services.filter(s => s.status === 'healthy').length;
      const totalServices = data.services.length;
      const activeAlerts = data.alerts.length;
      
      statusBar.setContent(
        `Services: ${healthyServices}/${totalServices} healthy | ` +
        `CPU: ${data.system.cpu.toFixed(1)}% | ` +
        `Memory: ${data.system.memory.toFixed(1)}% | ` +
        `Alerts: ${activeAlerts} | ` +
        `Last Update: ${new Date(data.lastUpdate).toLocaleTimeString()}`
      );

      screen.render();
      updateCount++;
      
    } catch (error) {
      statusBar.setContent(`Error: ${error.message} | Updates: ${updateCount}`);
      screen.render();
    }
  };

  // Initial update
  await updateDashboard();

  // Set up refresh interval
  const refreshInterval = parseInt(options.refresh) * 1000;
  const intervalId = setInterval(updateDashboard, refreshInterval);

  // Handle key events
  screen.key(['escape', 'q', 'C-c'], () => {
    clearInterval(intervalId);
    process.exit(0);
  });

  screen.key(['r'], () => {
    updateDashboard();
  });

  screen.key(['h'], () => {
    const helpBox = blessed.message({
      parent: screen,
      top: 'center',
      left: 'center',
      width: '50%',
      height: '50%',
      border: 'line',
      label: 'Help',
      content: 'Keys:\n\n' +
               'q, ESC, Ctrl+C - Quit\n' +
               'r - Refresh now\n' +
               'h - Show this help\n\n' +
               'Dashboard refreshes every ' + options.refresh + ' seconds'
    });
    
    helpBox.display();
    screen.render();
  });

  // Focus on screen
  screen.render();
}

/**
 * Fetch dashboard data from API
 */
async function fetchDashboardData(apiUrl: string): Promise<DashboardData> {
  const response = await fetch(`${apiUrl}/dashboard/overview`);
  
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  
  return await response.json();
}

/**
 * Fetch service details
 */
async function fetchServiceDetails(apiUrl: string, serviceId: string): Promise<any> {
  const response = await fetch(`${apiUrl}/dashboard/services/${serviceId}`);
  
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  
  return await response.json();
}

/**
 * Fetch port details
 */
async function fetchPortDetails(apiUrl: string, port: number): Promise<any> {
  const response = await fetch(`${apiUrl}/dashboard/ports/${port}`);
  
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  
  return await response.json();
}

/**
 * Fetch alerts
 */
async function fetchAlerts(apiUrl: string, filters: any = {}): Promise<Alert[]> {
  const params = new URLSearchParams();
  
  if (filters.severity) params.append('severity', filters.severity);
  if (filters.type) params.append('type', filters.type);
  
  const url = `${apiUrl}/dashboard/alerts${params.toString() ? '?' + params.toString() : ''}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  
  return await response.json();
}

/**
 * Kill process on port
 */
async function killPortProcess(apiUrl: string, port: number): Promise<any> {
  const response = await fetch(`${apiUrl}/dashboard/ports/${port}/kill`, {
    method: 'POST'
  });
  
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  
  return await response.json();
}

/**
 * Display functions
 */
function displayQuickStatus(data: DashboardData, logger: Logger): void {
  logger.blank();
  
  // System overview
  const systemData = [
    { key: 'CPU Usage', value: `${data.system.cpu.toFixed(1)}%`, status: data.system.cpu > 80 ? 'warning' as const : 'success' as const },
    { key: 'Memory Usage', value: `${data.system.memory.toFixed(1)}%`, status: data.system.memory > 80 ? 'warning' as const : 'success' as const },
    { key: 'Uptime', value: formatUptime(data.system.uptime), status: undefined },
    { key: 'Load Average', value: data.system.loadAverage.map(l => l.toFixed(2)).join(', '), status: undefined }
  ];
  
  logger.subheader('System Status:');
  logger.table(systemData);
  
  // Services overview
  const healthyServices = data.services.filter(s => s.status === 'healthy').length;
  const totalServices = data.services.length;
  
  logger.blank();
  logger.subheader('Services Overview:');
  logger.info(`${chalk.green(healthyServices)} healthy / ${totalServices} total services`);
  
  // Show unhealthy services
  const unhealthyServices = data.services.filter(s => s.status !== 'healthy');
  if (unhealthyServices.length > 0) {
    logger.blank();
    logger.warning('Unhealthy Services:');
    unhealthyServices.forEach(service => {
      logger.info(`  ${service.name} (${service.port}): ${getStatusDisplay(service.status)}`);
    });
  }
  
  // Alerts summary
  if (data.alerts.length > 0) {
    logger.blank();
    logger.subheader('Active Alerts:');
    
    const criticalAlerts = data.alerts.filter(a => a.severity === 'critical').length;
    const warningAlerts = data.alerts.filter(a => a.severity === 'warning').length;
    
    if (criticalAlerts > 0) {
      logger.error(`${criticalAlerts} critical alerts`);
    }
    if (warningAlerts > 0) {
      logger.warning(`${warningAlerts} warning alerts`);
    }
  }
}

function displayServicesOverview(services: ServiceStatus[], logger: Logger): void {
  logger.blank();
  
  const tableData = services.map(service => ({
    key: service.name,
    value: `Port ${service.port} - ${getStatusDisplay(service.status)}`,
    status: service.status === 'healthy' ? 'success' as const : 
            service.status === 'stopped' ? 'warning' as const : 'error' as const
  }));
  
  logger.table(tableData);
  
  // Summary
  const healthyCount = services.filter(s => s.status === 'healthy').length;
  logger.blank();
  logger.info(`Summary: ${chalk.green(`${healthyCount} healthy`)} / ${services.length} total`);
}

function displayServiceDetails(service: any, logger: Logger): void {
  logger.blank();
  logger.subheader(`Service: ${service.name}`);
  
  const detailsData = [
    { key: 'Status', value: getStatusDisplay(service.status), status: service.status === 'healthy' ? 'success' as const : 'error' as const },
    { key: 'Port', value: service.port.toString(), status: undefined },
    { key: 'Type', value: service.type || 'Unknown', status: undefined },
    { key: 'Response Time', value: service.responseTime ? `${service.responseTime}ms` : 'N/A', status: undefined },
    { key: 'Last Check', value: new Date(service.lastCheck).toLocaleString(), status: undefined },
    { key: 'PID', value: service.pid ? service.pid.toString() : 'N/A', status: undefined }
  ];
  
  logger.table(detailsData);
  
  if (service.dependencies && service.dependencies.length > 0) {
    logger.blank();
    logger.subheader('Dependencies:');
    service.dependencies.forEach((dep: string) => {
      logger.info(`  - ${dep}`);
    });
  }
}

function displayPortsOverview(ports: PortStatus[], logger: Logger): void {
  logger.blank();
  
  const tableData = ports.map(port => ({
    key: `Port ${port.port}`,
    value: `${port.serviceName} - ${port.inUse ? 'In Use' : 'Available'}`,
    status: port.inUse ? 'success' as const : 'warning' as const
  }));
  
  logger.table(tableData);
  
  // Summary
  const inUseCount = ports.filter(p => p.inUse).length;
  logger.blank();
  logger.info(`Summary: ${chalk.green(`${inUseCount} in use`)} / ${ports.length} monitored`);
}

function displayPortDetails(port: any, logger: Logger): void {
  logger.blank();
  logger.subheader(`Port ${port.port} Details`);
  
  const detailsData = [
    { key: 'Service', value: port.serviceName, status: undefined },
    { key: 'Status', value: port.inUse ? 'In Use' : 'Available', status: port.inUse ? 'success' as const : 'warning' as const },
    { key: 'PID', value: port.pid ? port.pid.toString() : 'N/A', status: undefined },
    { key: 'Command', value: port.command || 'N/A', status: undefined },
    { key: 'Connections', value: port.connections ? port.connections.toString() : 'N/A', status: undefined },
    { key: 'Last Check', value: new Date(port.lastCheck).toLocaleString(), status: undefined }
  ];
  
  logger.table(detailsData);
}

function displayAlerts(alerts: Alert[], logger: Logger): void {
  if (alerts.length === 0) {
    logger.success('No active alerts');
    return;
  }
  
  logger.blank();
  
  alerts.forEach(alert => {
    const time = new Date(alert.timestamp).toLocaleString();
    const severity = alert.severity.toUpperCase();
    
    let color = chalk.blue;
    if (alert.severity === 'warning') color = chalk.yellow;
    if (alert.severity === 'critical') color = chalk.red;
    
    logger.info(`${color(`[${severity}]`)} ${time} - ${alert.message}`);
  });
  
  logger.blank();
  logger.info(`Total: ${alerts.length} alerts`);
}

/**
 * Helper functions
 */
function getStatusDisplay(status: string): string {
  switch (status) {
    case 'healthy': return chalk.green('Healthy');
    case 'unhealthy': return chalk.yellow('Unhealthy');
    case 'stopped': return chalk.gray('Stopped');
    case 'error': return chalk.red('Error');
    case 'running': return chalk.blue('Running');
    default: return chalk.gray('Unknown');
  }
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}
