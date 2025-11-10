/**
 * Real-time Service Status Dashboard Service
 * 
 * Provides comprehensive real-time monitoring for:
 * - Service health and status
 * - Port usage and availability
 * - Performance metrics and trends
 * - System resource monitoring
 * - Alert and notification management
 * 
 * @author CLI Developer
 * @version 1.0.0
 */

import { EventEmitter } from 'events'
import { WebSocketServer } from 'ws'
import { execSync } from 'child_process'
import os from 'os'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Dashboard Service Class
 * Manages real-time monitoring and WebSocket connections
 */
export class DashboardService extends EventEmitter {
  constructor(server, portManager, monitoringService) {
    super()
    
    this.server = server
    this.portManager = portManager
    this.monitoringService = monitoringService
    this.wss = null
    this.clients = new Set()
    this.isMonitoring = false
    this.monitoringInterval = null
    
    // Dashboard metrics
    this.metrics = {
      services: new Map(),
      ports: new Map(),
      system: {
        cpu: 0,
        memory: 0,
        uptime: 0,
        loadAverage: [0, 0, 0]
      },
      network: {
        connections: 0,
        bandwidth: { in: 0, out: 0 }
      },
      alerts: [],
      lastUpdate: Date.now()
    }
    
    // Service definitions for monitoring
    // Ports are dynamically loaded from port manager configuration
    const portConfig = this.portManager?.getPortConfig?.() || {}
    const servicePorts = portConfig.servicePorts || {}

    this.serviceDefinitions = {
      api: {
        port: servicePorts.api || parseInt(process.env.TRUXE_API_PORT) || 87001,
        name: 'Heimdall API',
        type: 'http',
        healthPath: '/health'
      },
      database: {
        port: servicePorts.database || parseInt(process.env.TRUXE_DB_PORT) || 87032,
        name: 'PostgreSQL',
        type: 'tcp'
      },
      redis: {
        port: servicePorts.redis || parseInt(process.env.TRUXE_REDIS_PORT) || 87079,
        name: 'Redis',
        type: 'tcp'
      },
      mailhog_web: {
        port: servicePorts.mailhog_web || parseInt(process.env.TRUXE_MAILHOG_WEB_PORT) || 87825,
        name: 'MailHog Web',
        type: 'http',
        healthPath: '/'
      },
      mailhog_smtp: {
        port: servicePorts.mailhog_smtp || parseInt(process.env.TRUXE_MAILHOG_SMTP_PORT) || 87025,
        name: 'MailHog SMTP',
        type: 'smtp'
      },
      monitoring: {
        port: servicePorts.monitoring || parseInt(process.env.TRUXE_MONITORING_PORT) || 87090,
        name: 'Monitoring',
        type: 'http'
      },
      grafana: {
        port: servicePorts.grafana || parseInt(process.env.TRUXE_GRAFANA_PORT) || 87091,
        name: 'Grafana',
        type: 'http'
      },
      prometheus: {
        port: servicePorts.prometheus || parseInt(process.env.TRUXE_PROMETHEUS_PORT) || 87092,
        name: 'Prometheus',
        type: 'http'
      }
    }
    
    // Performance thresholds
    this.thresholds = {
      cpu: { warning: 70, critical: 90 },
      memory: { warning: 80, critical: 95 },
      responseTime: { warning: 1000, critical: 5000 },
      errorRate: { warning: 5, critical: 10 }
    }
    
    this.initializeWebSocket()
  }
  
  /**
   * Initialize WebSocket server for real-time communication
   */
  initializeWebSocket() {
    try {
      this.wss = new WebSocketServer({ 
        server: this.server,
        path: '/dashboard/ws',
        clientTracking: true
      })
      
      this.wss.on('connection', (ws, request) => {
        console.log('🔌 Dashboard client connected:', request.socket.remoteAddress)
        
        this.clients.add(ws)
        
        // Send initial data
        this.sendToClient(ws, {
          type: 'initial_data',
          data: this.getComprehensiveDashboardData()
        })
        
        // Handle client messages
        ws.on('message', (message) => {
          try {
            const data = JSON.parse(message.toString())
            this.handleClientMessage(ws, data)
          } catch (error) {
            console.error('Invalid WebSocket message:', error.message)
          }
        })
        
        // Handle client disconnect
        ws.on('close', () => {
          this.clients.delete(ws)
          console.log('🔌 Dashboard client disconnected')
        })
        
        // Handle errors
        ws.on('error', (error) => {
          console.error('WebSocket error:', error.message)
          this.clients.delete(ws)
        })
      })
      
      console.log('🚀 Dashboard WebSocket server initialized on /dashboard/ws')
      
    } catch (error) {
      console.error('Failed to initialize WebSocket server:', error.message)
    }
  }
  
  /**
   * Handle incoming client messages
   */
  handleClientMessage(ws, message) {
    switch (message.type) {
      case 'subscribe':
        this.handleSubscription(ws, message.data)
        break
        
      case 'get_service_details':
        this.sendServiceDetails(ws, message.data.serviceName)
        break
        
      case 'get_port_details':
        this.sendPortDetails(ws, message.data.port)
        break
        
      case 'restart_service':
        this.handleServiceRestart(ws, message.data.serviceName)
        break
        
      case 'kill_port_process':
        this.handleKillPortProcess(ws, message.data.port)
        break
        
      default:
        console.warn('Unknown message type:', message.type)
    }
  }
  
  /**
   * Handle client subscription preferences
   */
  handleSubscription(ws, subscriptions) {
    ws.subscriptions = subscriptions
    console.log('📡 Client subscriptions updated:', subscriptions)
  }
  
  /**
   * Start real-time monitoring
   */
  startMonitoring(interval = 5000) {
    if (this.isMonitoring) {
      console.log('⚠️  Monitoring already active')
      return
    }
    
    this.isMonitoring = true
    console.log('🔍 Starting real-time dashboard monitoring...')
    
    // Initial scan
    this.performMonitoringScan()
    
    // Start periodic monitoring
    this.monitoringInterval = setInterval(() => {
      this.performMonitoringScan()
    }, interval)
    
    this.emit('monitoring_started', { interval })
  }
  
  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      return
    }
    
    this.isMonitoring = false
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }
    
    console.log('🛑 Dashboard monitoring stopped')
    this.emit('monitoring_stopped')
  }
  
  /**
   * Perform comprehensive monitoring scan
   */
  async performMonitoringScan() {
    try {
      const startTime = Date.now()
      
      // Collect all metrics in parallel
      const [
        serviceStatuses,
        portStatuses,
        systemMetrics,
        networkMetrics,
        performanceMetrics
      ] = await Promise.all([
        this.collectServiceStatuses(),
        this.collectPortStatuses(),
        this.collectSystemMetrics(),
        this.collectNetworkMetrics(),
        this.collectPerformanceMetrics()
      ])
      
      // Update metrics
      this.updateMetrics({
        services: serviceStatuses,
        ports: portStatuses,
        system: systemMetrics,
        network: networkMetrics,
        performance: performanceMetrics,
        scanDuration: Date.now() - startTime
      })
      
      // Check for alerts
      this.checkAlertConditions()
      
      // Broadcast updates to connected clients
      this.broadcastUpdate()
      
    } catch (error) {
      console.error('Monitoring scan failed:', error.message)
      this.emit('monitoring_error', error)
    }
  }
  
  /**
   * Collect service status information
   */
  async collectServiceStatuses() {
    const statuses = new Map()
    
    for (const [serviceId, service] of Object.entries(this.serviceDefinitions)) {
      try {
        const status = await this.checkServiceHealth(service)
        statuses.set(serviceId, {
          ...service,
          status: status.status,
          responseTime: status.responseTime,
          lastCheck: Date.now(),
          details: status.details,
          pid: status.pid
        })
      } catch (error) {
        statuses.set(serviceId, {
          ...service,
          status: 'error',
          responseTime: null,
          lastCheck: Date.now(),
          error: error.message
        })
      }
    }
    
    return statuses
  }
  
  /**
   * Check individual service health
   */
  async checkServiceHealth(service) {
    const startTime = Date.now()
    
    try {
      // Check if port is in use
      const portStatus = await this.checkPortStatus(service.port)
      
      if (!portStatus.inUse) {
        return {
          status: 'stopped',
          responseTime: Date.now() - startTime,
          details: 'Service not running'
        }
      }
      
      // For HTTP services, check health endpoint
      if (service.type === 'http' && service.healthPath) {
        try {
          const response = await fetch(`http://localhost:${service.port}${service.healthPath}`, {
            timeout: 5000,
            headers: { 'User-Agent': 'Heimdall-Dashboard/1.0' }
          })
          
          const responseTime = Date.now() - startTime
          
          if (response.ok) {
            return {
              status: 'healthy',
              responseTime,
              details: `HTTP ${response.status}`,
              pid: portStatus.pid
            }
          } else {
            return {
              status: 'unhealthy',
              responseTime,
              details: `HTTP ${response.status}`,
              pid: portStatus.pid
            }
          }
        } catch (fetchError) {
          return {
            status: 'unhealthy',
            responseTime: Date.now() - startTime,
            details: 'Health check failed',
            pid: portStatus.pid
          }
        }
      }
      
      // For non-HTTP services, just check if port is responsive
      return {
        status: 'running',
        responseTime: Date.now() - startTime,
        details: 'Port is active',
        pid: portStatus.pid
      }
      
    } catch (error) {
      return {
        status: 'error',
        responseTime: Date.now() - startTime,
        details: error.message
      }
    }
  }
  
  /**
   * Check port status and get process information
   */
  async checkPortStatus(port) {
    try {
      // Use lsof to check port usage
      const result = execSync(`lsof -ti:${port}`, { 
        encoding: 'utf8', 
        stdio: 'pipe',
        timeout: 5000 
      })
      
      if (result.trim()) {
        const pid = result.trim().split('\n')[0]
        
        // Get process details
        try {
          const processInfo = execSync(`ps -p ${pid} -o pid,ppid,comm,args --no-headers`, {
            encoding: 'utf8',
            stdio: 'pipe'
          })
          
          const [procPid, ppid, comm, ...args] = processInfo.trim().split(/\s+/)
          
          return {
            inUse: true,
            pid: parseInt(procPid),
            ppid: parseInt(ppid),
            command: comm,
            args: args.join(' ')
          }
        } catch (psError) {
          return {
            inUse: true,
            pid: parseInt(pid)
          }
        }
      }
      
      return { inUse: false }
      
    } catch (error) {
      // Port not in use or lsof failed
      return { inUse: false }
    }
  }
  
  /**
   * Collect port usage statistics
   */
  async collectPortStatuses() {
    const portStatuses = new Map()
    
    // Get environment configuration
    const envConfig = this.portManager?.getEnvironmentConfig?.('development') || {}
    const servicePorts = envConfig.services || {}
    
    // Check all configured service ports
    for (const [serviceName, port] of Object.entries(servicePorts)) {
      try {
        const status = await this.checkPortStatus(port)
        portStatuses.set(port, {
          port,
          serviceName,
          ...status,
          lastCheck: Date.now()
        })
      } catch (error) {
        portStatuses.set(port, {
          port,
          serviceName,
          inUse: false,
          error: error.message,
          lastCheck: Date.now()
        })
      }
    }
    
    return portStatuses
  }
  
  /**
   * Collect system resource metrics
   */
  async collectSystemMetrics() {
    try {
      const cpus = os.cpus()
      const totalMem = os.totalmem()
      const freeMem = os.freemem()
      const loadAvg = os.loadavg()
      
      // Calculate CPU usage (simplified)
      const cpuUsage = Math.min(100, Math.max(0, loadAvg[0] * 100 / cpus.length))
      
      // Calculate memory usage
      const memoryUsage = ((totalMem - freeMem) / totalMem) * 100
      
      return {
        cpu: Math.round(cpuUsage * 100) / 100,
        memory: Math.round(memoryUsage * 100) / 100,
        uptime: os.uptime(),
        loadAverage: loadAvg,
        totalMemory: totalMem,
        freeMemory: freeMem,
        cpuCount: cpus.length,
        platform: os.platform(),
        arch: os.arch()
      }
    } catch (error) {
      console.error('Failed to collect system metrics:', error.message)
      return this.metrics.system
    }
  }
  
  /**
   * Collect network metrics
   */
  async collectNetworkMetrics() {
    try {
      // Get network interface statistics
      const interfaces = os.networkInterfaces()
      let activeConnections = 0
      
      // Count active network connections (simplified)
      try {
        const netstat = execSync('netstat -an | grep ESTABLISHED | wc -l', {
          encoding: 'utf8',
          stdio: 'pipe',
          timeout: 3000
        })
        activeConnections = parseInt(netstat.trim()) || 0
      } catch (error) {
        // Fallback for systems without netstat
        activeConnections = this.clients.size
      }
      
      return {
        connections: activeConnections,
        interfaces: Object.keys(interfaces).length,
        bandwidth: { in: 0, out: 0 } // Would need more complex implementation for real bandwidth
      }
    } catch (error) {
      console.error('Failed to collect network metrics:', error.message)
      return this.metrics.network
    }
  }
  
  /**
   * Collect performance metrics from monitoring service
   */
  async collectPerformanceMetrics() {
    try {
      if (this.monitoringService && typeof this.monitoringService.getDashboardData === 'function') {
        const monitoringData = await this.monitoringService.getDashboardData()
        return {
          requestCount: monitoringData.metrics?.requestCount || 0,
          errorRate: monitoringData.metrics?.errorRate || 0,
          averageResponseTime: monitoringData.metrics?.averageResponseTime || 0,
          rateLimitViolations: monitoringData.metrics?.rateLimitViolations || 0,
          securityThreats: monitoringData.metrics?.securityThreats || 0,
          timeSeries: monitoringData.timeSeries || {}
        }
      }
      
      return {
        requestCount: 0,
        errorRate: 0,
        averageResponseTime: 0,
        rateLimitViolations: 0,
        securityThreats: 0,
        timeSeries: {}
      }
    } catch (error) {
      console.error('Failed to collect performance metrics:', error.message)
      return {
        requestCount: 0,
        errorRate: 0,
        averageResponseTime: 0,
        rateLimitViolations: 0,
        securityThreats: 0,
        timeSeries: {}
      }
    }
  }
  
  /**
   * Update internal metrics
   */
  updateMetrics(newData) {
    this.metrics = {
      ...this.metrics,
      services: newData.services,
      ports: newData.ports,
      system: newData.system,
      network: newData.network,
      performance: newData.performance,
      scanDuration: newData.scanDuration,
      lastUpdate: Date.now()
    }
    
    this.emit('metrics_updated', this.metrics)
  }
  
  /**
   * Check for alert conditions
   */
  checkAlertConditions() {
    const alerts = []
    const now = Date.now()
    
    // Check system resource alerts
    if (this.metrics.system.cpu > this.thresholds.cpu.critical) {
      alerts.push({
        id: `cpu_critical_${now}`,
        type: 'system',
        severity: 'critical',
        message: `Critical CPU usage: ${this.metrics.system.cpu}%`,
        timestamp: now,
        data: { cpu: this.metrics.system.cpu }
      })
    } else if (this.metrics.system.cpu > this.thresholds.cpu.warning) {
      alerts.push({
        id: `cpu_warning_${now}`,
        type: 'system',
        severity: 'warning',
        message: `High CPU usage: ${this.metrics.system.cpu}%`,
        timestamp: now,
        data: { cpu: this.metrics.system.cpu }
      })
    }
    
    if (this.metrics.system.memory > this.thresholds.memory.critical) {
      alerts.push({
        id: `memory_critical_${now}`,
        type: 'system',
        severity: 'critical',
        message: `Critical memory usage: ${this.metrics.system.memory}%`,
        timestamp: now,
        data: { memory: this.metrics.system.memory }
      })
    } else if (this.metrics.system.memory > this.thresholds.memory.warning) {
      alerts.push({
        id: `memory_warning_${now}`,
        type: 'system',
        severity: 'warning',
        message: `High memory usage: ${this.metrics.system.memory}%`,
        timestamp: now,
        data: { memory: this.metrics.system.memory }
      })
    }
    
    // Check service health alerts
    for (const [serviceId, service] of this.metrics.services) {
      if (service.status === 'error' || service.status === 'unhealthy') {
        alerts.push({
          id: `service_${serviceId}_${now}`,
          type: 'service',
          severity: service.status === 'error' ? 'critical' : 'warning',
          message: `Service ${service.name} is ${service.status}`,
          timestamp: now,
          data: { serviceId, service: service.name, status: service.status }
        })
      }
      
      if (service.responseTime && service.responseTime > this.thresholds.responseTime.critical) {
        alerts.push({
          id: `response_time_${serviceId}_${now}`,
          type: 'performance',
          severity: 'warning',
          message: `Slow response time for ${service.name}: ${service.responseTime}ms`,
          timestamp: now,
          data: { serviceId, service: service.name, responseTime: service.responseTime }
        })
      }
    }
    
    // Check port conflicts
    const portConflicts = Array.from(this.metrics.ports.values()).filter(port => 
      port.inUse && !this.serviceDefinitions[port.serviceName]
    )
    
    if (portConflicts.length > 0) {
      alerts.push({
        id: `port_conflicts_${now}`,
        type: 'port',
        severity: 'warning',
        message: `${portConflicts.length} port conflicts detected`,
        timestamp: now,
        data: { conflicts: portConflicts }
      })
    }
    
    // Update alerts (keep only recent ones)
    this.metrics.alerts = [
      ...alerts,
      ...this.metrics.alerts.filter(alert => now - alert.timestamp < 300000) // Keep alerts for 5 minutes
    ].slice(0, 50) // Limit to 50 most recent alerts
    
    // Emit new alerts
    alerts.forEach(alert => {
      this.emit('alert', alert)
      console.log(`🚨 Alert: ${alert.message}`)
    })
  }
  
  /**
   * Broadcast updates to all connected clients
   */
  broadcastUpdate() {
    if (this.clients.size === 0) {
      return
    }
    
    const updateData = {
      type: 'dashboard_update',
      data: this.getComprehensiveDashboardData(),
      timestamp: Date.now()
    }
    
    this.clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        this.sendToClient(client, updateData)
      }
    })
  }
  
  /**
   * Send data to specific client
   */
  sendToClient(client, data) {
    try {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(JSON.stringify(data))
      }
    } catch (error) {
      console.error('Failed to send data to client:', error.message)
      this.clients.delete(client)
    }
  }
  
  /**
   * Get comprehensive dashboard data
   */
  getComprehensiveDashboardData() {
    return {
      services: Array.from(this.metrics.services.entries()).map(([id, service]) => ({
        id,
        ...service
      })),
      ports: Array.from(this.metrics.ports.entries()).map(([port, data]) => ({
        port,
        ...data
      })),
      system: this.metrics.system,
      network: this.metrics.network,
      performance: this.metrics.performance,
      alerts: this.metrics.alerts,
      thresholds: this.thresholds,
      lastUpdate: this.metrics.lastUpdate,
      scanDuration: this.metrics.scanDuration,
      isMonitoring: this.isMonitoring,
      clientCount: this.clients.size
    }
  }
  
  /**
   * Send detailed service information
   */
  async sendServiceDetails(ws, serviceName) {
    try {
      const service = this.metrics.services.get(serviceName)
      if (!service) {
        this.sendToClient(ws, {
          type: 'service_details',
          error: 'Service not found',
          serviceName
        })
        return
      }
      
      // Get additional service details
      const details = {
        ...service,
        logs: await this.getServiceLogs(serviceName),
        dependencies: this.getServiceDependencies(serviceName),
        configuration: this.getServiceConfiguration(serviceName)
      }
      
      this.sendToClient(ws, {
        type: 'service_details',
        data: details,
        serviceName
      })
    } catch (error) {
      this.sendToClient(ws, {
        type: 'service_details',
        error: error.message,
        serviceName
      })
    }
  }
  
  /**
   * Send detailed port information
   */
  async sendPortDetails(ws, port) {
    try {
      const portData = this.metrics.ports.get(parseInt(port))
      if (!portData) {
        this.sendToClient(ws, {
          type: 'port_details',
          error: 'Port not found',
          port
        })
        return
      }
      
      // Get additional port details
      const details = {
        ...portData,
        connections: await this.getPortConnections(port),
        history: await this.getPortHistory(port)
      }
      
      this.sendToClient(ws, {
        type: 'port_details',
        data: details,
        port
      })
    } catch (error) {
      this.sendToClient(ws, {
        type: 'port_details',
        error: error.message,
        port
      })
    }
  }
  
  /**
   * Handle service restart request
   */
  async handleServiceRestart(ws, serviceName) {
    try {
      // This would integrate with Docker Compose or systemd
      // For now, just simulate the action
      this.sendToClient(ws, {
        type: 'service_restart_result',
        success: false,
        message: 'Service restart not implemented yet',
        serviceName
      })
    } catch (error) {
      this.sendToClient(ws, {
        type: 'service_restart_result',
        success: false,
        error: error.message,
        serviceName
      })
    }
  }
  
  /**
   * Handle kill port process request
   */
  async handleKillPortProcess(ws, port) {
    try {
      const portData = this.metrics.ports.get(parseInt(port))
      if (!portData || !portData.pid) {
        this.sendToClient(ws, {
          type: 'kill_process_result',
          success: false,
          message: 'No process found on port',
          port
        })
        return
      }
      
      // Kill the process
      execSync(`kill -TERM ${portData.pid}`, { timeout: 5000 })
      
      // Wait a moment and check if it's still running
      setTimeout(async () => {
        const newStatus = await this.checkPortStatus(port)
        
        this.sendToClient(ws, {
          type: 'kill_process_result',
          success: !newStatus.inUse,
          message: newStatus.inUse ? 'Process still running' : 'Process terminated successfully',
          port
        })
      }, 1000)
      
    } catch (error) {
      this.sendToClient(ws, {
        type: 'kill_process_result',
        success: false,
        error: error.message,
        port
      })
    }
  }
  
  /**
   * Get service logs (placeholder)
   */
  async getServiceLogs(serviceName) {
    // This would integrate with Docker logs or system logs
    return [
      { timestamp: Date.now(), level: 'info', message: 'Service logs not implemented yet' }
    ]
  }
  
  /**
   * Get service dependencies
   */
  getServiceDependencies(serviceName) {
    const dependencies = {
      api: ['database', 'redis'],
      monitoring: ['api'],
      grafana: ['prometheus']
    }
    
    return dependencies[serviceName] || []
  }
  
  /**
   * Get service configuration
   */
  getServiceConfiguration(serviceName) {
    const service = this.serviceDefinitions[serviceName]
    return service ? {
      port: service.port,
      type: service.type,
      healthPath: service.healthPath
    } : {}
  }
  
  /**
   * Get port connections (placeholder)
   */
  async getPortConnections(port) {
    try {
      const connections = execSync(`netstat -an | grep :${port}`, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 3000
      })
      
      return connections.split('\n').filter(line => line.trim()).length
    } catch (error) {
      return 0
    }
  }
  
  /**
   * Get port history (placeholder)
   */
  async getPortHistory(port) {
    // This would integrate with time-series database
    return []
  }
  
  /**
   * Get dashboard health status
   */
  getHealthStatus() {
    return {
      status: 'healthy',
      isMonitoring: this.isMonitoring,
      clientCount: this.clients.size,
      lastUpdate: this.metrics.lastUpdate,
      scanDuration: this.metrics.scanDuration,
      servicesMonitored: this.metrics.services.size,
      portsMonitored: this.metrics.ports.size,
      activeAlerts: this.metrics.alerts.length
    }
  }
  
  /**
   * Cleanup resources
   */
  async cleanup() {
    this.stopMonitoring()
    
    // Close all WebSocket connections
    this.clients.forEach(client => {
      if (client.readyState === 1) {
        client.close()
      }
    })
    
    if (this.wss) {
      this.wss.close()
    }
    
    console.log('🧹 Dashboard service cleaned up')
  }
}

export default DashboardService
