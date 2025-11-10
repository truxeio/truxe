/**
 * Port Analytics Service
 * 
 * Comprehensive port usage analytics and monitoring tools for:
 * - Port utilization tracking
 * - Conflict detection and analysis
 * - Performance optimization recommendations
 * - Usage pattern analysis
 * - Health monitoring and reporting
 */

import { Pool } from 'pg'
import config from '../config/index.js'
import { promisify } from 'util'
import { exec } from 'child_process'

const execAsync = promisify(exec)

// Database connection pool
const pool = new Pool({
  connectionString: config.database.url,
  ssl: config.database.ssl,
  min: config.database.poolMin,
  max: config.database.poolMax,
  connectionTimeoutMillis: config.database.connectionTimeout,
  statement_timeout: config.database.statementTimeout,
})

/**
 * Port Analytics Service
 */
export class PortAnalyticsService {
  constructor() {
    this.metricsCache = new Map()
    this.cacheTimeout = 5 * 60 * 1000 // 5 minutes
  }

  /**
   * Get comprehensive port usage analytics
   */
  async getPortAnalytics(options = {}) {
    const {
      environment = 'development',
      timeframe = '24h',
      includeDetails = true,
      includeRecommendations = true,
    } = options

    const startTime = this.calculateTimeframeStart(timeframe)
    
    try {
      // Get port usage data
      const portUsage = await this.getPortUsageData(environment, startTime)
      
      // Get conflict data
      const conflicts = await this.getConflictData(environment, startTime)
      
      // Get performance metrics
      const performance = await this.getPerformanceMetrics(environment, startTime)
      
      // Get service health data
      const health = await this.getServiceHealthData(environment)
      
      // Calculate utilization metrics
      const utilization = this.calculateUtilizationMetrics(portUsage)
      
      // Generate recommendations
      const recommendations = includeRecommendations 
        ? await this.generateRecommendations(portUsage, conflicts, performance, health)
        : []
      
      // Calculate overall health score
      const healthScore = this.calculateHealthScore(utilization, conflicts, performance, health)
      
      return {
        environment,
        timeframe,
        timestamp: new Date().toISOString(),
        summary: {
          totalPorts: portUsage.totalPorts,
          usedPorts: portUsage.usedPorts,
          availablePorts: portUsage.availablePorts,
          utilizationPercentage: utilization.percentage,
          conflictCount: conflicts.totalConflicts,
          healthScore,
          overallStatus: this.determineOverallStatus(healthScore, conflicts.totalConflicts),
        },
        utilization,
        conflicts,
        performance,
        health,
        recommendations,
        details: includeDetails ? {
          portUsage,
          serviceBreakdown: this.generateServiceBreakdown(portUsage),
          conflictHistory: conflicts.history,
          performanceTrends: performance.trends,
        } : undefined,
      }
    } catch (error) {
      throw new Error(`Failed to generate port analytics: ${error.message}`)
    }
  }

  /**
   * Get port usage data for a specific environment
   */
  async getPortUsageData(environment, startTime) {
    const client = await pool.connect()
    
    try {
      // Get configured ports for environment
      const configuredPorts = this.getEnvironmentPorts(environment)
      
      // Get actual port usage from system
      const actualUsage = await this.getSystemPortUsage()
      
      // Get historical usage data from database
      const historicalUsage = await this.getHistoricalPortUsage(environment, startTime, client)
      
      // Merge data
      const portUsage = configuredPorts.map(port => {
        const actual = actualUsage.find(p => p.port === port.port)
        const historical = historicalUsage.find(p => p.port === port.port)
        
        return {
          port: port.port,
          service: port.service,
          configured: true,
          inUse: actual ? actual.inUse : false,
          process: actual ? actual.process : null,
          pid: actual ? actual.pid : null,
          lastUsed: historical ? historical.lastUsed : null,
          usageCount: historical ? historical.usageCount : 0,
          averageUptime: historical ? historical.averageUptime : 0,
        }
      })
      
      return {
        ports: portUsage,
        totalPorts: configuredPorts.length,
        usedPorts: portUsage.filter(p => p.inUse).length,
        availablePorts: portUsage.filter(p => !p.inUse).length,
        timestamp: new Date().toISOString(),
      }
    } finally {
      client.release()
    }
  }

  /**
   * Get conflict data for analysis
   */
  async getConflictData(environment, startTime) {
    const client = await pool.connect()
    
    try {
      // Get conflicts from database
      const conflictQuery = `
        SELECT 
          port,
          conflict_type,
          conflicting_process,
          resolved_at,
          resolution_method,
          created_at
        FROM port_conflicts 
        WHERE environment = $1 AND created_at >= $2
        ORDER BY created_at DESC
      `
      
      const result = await client.query(conflictQuery, [environment, startTime])
      const conflicts = result.rows
      
      // Analyze conflict patterns
      const conflictAnalysis = this.analyzeConflictPatterns(conflicts)
      
      return {
        conflicts,
        totalConflicts: conflicts.length,
        resolvedConflicts: conflicts.filter(c => c.resolved_at).length,
        unresolvedConflicts: conflicts.filter(c => !c.resolved_at).length,
        analysis: conflictAnalysis,
        history: this.generateConflictHistory(conflicts),
      }
    } finally {
      client.release()
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(environment, startTime) {
    const client = await pool.connect()
    
    try {
      // Get performance data from database
      const performanceQuery = `
        SELECT 
          port,
          response_time,
          throughput,
          error_rate,
          uptime_percentage,
          created_at
        FROM port_performance_metrics 
        WHERE environment = $1 AND created_at >= $2
        ORDER BY created_at DESC
      `
      
      const result = await client.query(performanceQuery, [environment, startTime])
      const metrics = result.rows
      
      // Calculate performance trends
      const trends = this.calculatePerformanceTrends(metrics)
      
      // Calculate averages
      const averages = this.calculatePerformanceAverages(metrics)
      
      return {
        metrics,
        trends,
        averages,
        timestamp: new Date().toISOString(),
      }
    } finally {
      client.release()
    }
  }

  /**
   * Get service health data
   */
  async getServiceHealthData(environment) {
    const configuredPorts = this.getEnvironmentPorts(environment)
    const healthChecks = []
    
    for (const portConfig of configuredPorts) {
      try {
        const health = await this.checkServiceHealth(portConfig.port, portConfig.service)
        healthChecks.push({
          port: portConfig.port,
          service: portConfig.service,
          ...health,
        })
      } catch (error) {
        healthChecks.push({
          port: portConfig.port,
          service: portConfig.service,
          healthy: false,
          error: error.message,
        })
      }
    }
    
    return {
      services: healthChecks,
      healthyServices: healthChecks.filter(s => s.healthy).length,
      unhealthyServices: healthChecks.filter(s => !s.healthy).length,
      overallHealth: this.calculateOverallHealth(healthChecks),
    }
  }

  /**
   * Calculate utilization metrics
   */
  calculateUtilizationMetrics(portUsage) {
    const totalPorts = portUsage.totalPorts
    const usedPorts = portUsage.usedPorts
    const percentage = totalPorts > 0 ? (usedPorts / totalPorts) * 100 : 0
    
    // Categorize utilization
    let status = 'optimal'
    if (percentage > 90) status = 'critical'
    else if (percentage > 75) status = 'high'
    else if (percentage > 50) status = 'moderate'
    
    return {
      percentage: Math.round(percentage * 100) / 100,
      status,
      totalPorts,
      usedPorts,
      availablePorts: totalPorts - usedPorts,
    }
  }

  /**
   * Generate optimization recommendations
   */
  async generateRecommendations(portUsage, conflicts, performance, health) {
    const recommendations = []
    
    // High utilization recommendations
    if (portUsage.utilizationPercentage > 75) {
      recommendations.push({
        type: 'utilization',
        priority: 'high',
        title: 'High Port Utilization Detected',
        description: `Port utilization is at ${portUsage.utilizationPercentage}%, which may lead to conflicts`,
        action: 'Consider expanding the port range or optimizing port allocation',
        impact: 'Prevent future port conflicts and improve scalability',
      })
    }
    
    // Conflict recommendations
    if (conflicts.totalConflicts > 0) {
      recommendations.push({
        type: 'conflict',
        priority: 'medium',
        title: 'Port Conflicts Detected',
        description: `${conflicts.totalConflicts} port conflicts have occurred`,
        action: 'Implement better port conflict detection and resolution',
        impact: 'Reduce downtime and improve service reliability',
      })
    }
    
    // Performance recommendations
    if (performance.averages && performance.averages.error_rate > 5) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        title: 'High Error Rate Detected',
        description: `Error rate is ${performance.averages.error_rate}%, which is above acceptable levels`,
        action: 'Investigate and fix underlying issues causing errors',
        impact: 'Improve service reliability and user experience',
      })
    }
    
    // Health recommendations
    if (health.overallHealth < 0.8) {
      recommendations.push({
        type: 'health',
        priority: 'high',
        title: 'Service Health Issues',
        description: `${health.unhealthyServices} services are experiencing health issues`,
        action: 'Investigate and resolve service health problems',
        impact: 'Improve overall system stability',
      })
    }
    
    return recommendations
  }

  /**
   * Calculate overall health score
   */
  calculateHealthScore(utilization, conflicts, performance, health) {
    let score = 100
    
    // Deduct points for high utilization
    if (utilization.percentage > 90) score -= 30
    else if (utilization.percentage > 75) score -= 20
    else if (utilization.percentage > 50) score -= 10
    
    // Deduct points for conflicts
    if (conflicts.totalConflicts > 10) score -= 25
    else if (conflicts.totalConflicts > 5) score -= 15
    else if (conflicts.totalConflicts > 0) score -= 5
    
    // Deduct points for performance issues
    if (performance.averages && performance.averages.error_rate > 10) score -= 20
    else if (performance.averages && performance.averages.error_rate > 5) score -= 10
    
    // Deduct points for health issues
    if (health.overallHealth < 0.5) score -= 25
    else if (health.overallHealth < 0.8) score -= 15
    
    return Math.max(0, Math.min(100, score))
  }

  /**
   * Determine overall status based on health score and conflicts
   */
  determineOverallStatus(healthScore, conflictCount) {
    if (healthScore >= 90 && conflictCount === 0) return 'excellent'
    if (healthScore >= 80 && conflictCount <= 2) return 'good'
    if (healthScore >= 60 && conflictCount <= 5) return 'fair'
    if (healthScore >= 40) return 'poor'
    return 'critical'
  }

  /**
   * Get environment-specific port configuration
   */
  getEnvironmentPorts(environment) {
    const portRanges = {
      development: { start: 21000, end: 21999 },
      staging: { start: 22000, end: 22999 },
      production: { start: 23000, end: 23999 },
      testing: { start: 24000, end: 24999 },
    }
    
    const range = portRanges[environment] || portRanges.development
    const servicePorts = config.portManagement.servicePorts
    
    return Object.entries(servicePorts).map(([service, port]) => ({
      service,
      port,
      range: range.start <= port && port <= range.end ? 'in-range' : 'out-of-range',
    }))
  }

  /**
   * Get actual port usage from system
   */
  async getSystemPortUsage() {
    try {
      // Use lsof to get port usage (Unix/Linux/macOS)
      const { stdout } = await execAsync('lsof -i -P -n | grep LISTEN')
      const lines = stdout.split('\n').filter(line => line.trim())
      
      return lines.map(line => {
        const parts = line.split(/\s+/)
        const address = parts[8]
        const portMatch = address.match(/:(\d+)$/)
        
        if (portMatch) {
          return {
            port: parseInt(portMatch[1]),
            process: parts[0],
            pid: parts[1],
            inUse: true,
          }
        }
        return null
      }).filter(Boolean)
    } catch (error) {
      // Fallback for systems without lsof
      return []
    }
  }

  /**
   * Get historical port usage from database
   */
  async getHistoricalPortUsage(environment, startTime, client) {
    try {
      const query = `
        SELECT 
          port,
          COUNT(*) as usage_count,
          MAX(created_at) as last_used,
          AVG(EXTRACT(EPOCH FROM (ended_at - started_at))) as average_uptime
        FROM port_usage_log 
        WHERE environment = $1 AND created_at >= $2
        GROUP BY port
      `
      
      const result = await client.query(query, [environment, startTime])
      return result.rows
    } catch (error) {
      // Table might not exist yet
      return []
    }
  }

  /**
   * Check service health
   */
  async checkServiceHealth(port, service) {
    try {
      // Simple TCP connection check
      const net = await import('net')
      const socket = new net.Socket()
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          socket.destroy()
          resolve({
            healthy: false,
            responseTime: null,
            error: 'Connection timeout',
          })
        }, 5000)
        
        socket.connect(port, 'localhost', () => {
          clearTimeout(timeout)
          socket.destroy()
          resolve({
            healthy: true,
            responseTime: Date.now(),
            error: null,
          })
        })
        
        socket.on('error', (error) => {
          clearTimeout(timeout)
          resolve({
            healthy: false,
            responseTime: null,
            error: error.message,
          })
        })
      })
    } catch (error) {
      return {
        healthy: false,
        responseTime: null,
        error: error.message,
      }
    }
  }

  /**
   * Analyze conflict patterns
   */
  analyzeConflictPatterns(conflicts) {
    const patterns = {
      mostConflictedPorts: {},
      commonConflictTypes: {},
      resolutionMethods: {},
      timePatterns: {},
    }
    
    conflicts.forEach(conflict => {
      // Most conflicted ports
      patterns.mostConflictedPorts[conflict.port] = 
        (patterns.mostConflictedPorts[conflict.port] || 0) + 1
      
      // Common conflict types
      patterns.commonConflictTypes[conflict.conflict_type] = 
        (patterns.commonConflictTypes[conflict.conflict_type] || 0) + 1
      
      // Resolution methods
      if (conflict.resolution_method) {
        patterns.resolutionMethods[conflict.resolution_method] = 
          (patterns.resolutionMethods[conflict.resolution_method] || 0) + 1
      }
      
      // Time patterns (hour of day)
      const hour = new Date(conflict.created_at).getHours()
      patterns.timePatterns[hour] = (patterns.timePatterns[hour] || 0) + 1
    })
    
    return patterns
  }

  /**
   * Generate conflict history
   */
  generateConflictHistory(conflicts) {
    const history = {}
    
    conflicts.forEach(conflict => {
      const date = new Date(conflict.created_at).toISOString().split('T')[0]
      if (!history[date]) {
        history[date] = 0
      }
      history[date]++
    })
    
    return history
  }

  /**
   * Calculate performance trends
   */
  calculatePerformanceTrends(metrics) {
    if (metrics.length < 2) return null
    
    const sorted = metrics.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    const first = sorted[0]
    const last = sorted[sorted.length - 1]
    
    return {
      responseTime: {
        trend: last.response_time > first.response_time ? 'increasing' : 'decreasing',
        change: last.response_time - first.response_time,
      },
      throughput: {
        trend: last.throughput > first.throughput ? 'increasing' : 'decreasing',
        change: last.throughput - first.throughput,
      },
      errorRate: {
        trend: last.error_rate > first.error_rate ? 'increasing' : 'decreasing',
        change: last.error_rate - first.error_rate,
      },
    }
  }

  /**
   * Calculate performance averages
   */
  calculatePerformanceAverages(metrics) {
    if (metrics.length === 0) return null
    
    const totals = metrics.reduce((acc, metric) => ({
      responseTime: acc.responseTime + (metric.response_time || 0),
      throughput: acc.throughput + (metric.throughput || 0),
      errorRate: acc.errorRate + (metric.error_rate || 0),
      uptime: acc.uptime + (metric.uptime_percentage || 0),
    }), { responseTime: 0, throughput: 0, errorRate: 0, uptime: 0 })
    
    const count = metrics.length
    
    return {
      responseTime: totals.responseTime / count,
      throughput: totals.throughput / count,
      errorRate: totals.errorRate / count,
      uptime: totals.uptime / count,
    }
  }

  /**
   * Calculate overall health from service health checks
   */
  calculateOverallHealth(healthChecks) {
    if (healthChecks.length === 0) return 1
    
    const healthyCount = healthChecks.filter(check => check.healthy).length
    return healthyCount / healthChecks.length
  }

  /**
   * Generate service breakdown
   */
  generateServiceBreakdown(portUsage) {
    const breakdown = {}
    
    portUsage.ports.forEach(port => {
      if (!breakdown[port.service]) {
        breakdown[port.service] = {
          totalPorts: 0,
          usedPorts: 0,
          availablePorts: 0,
        }
      }
      
      breakdown[port.service].totalPorts++
      if (port.inUse) {
        breakdown[port.service].usedPorts++
      } else {
        breakdown[port.service].availablePorts++
      }
    })
    
    return breakdown
  }

  /**
   * Calculate timeframe start
   */
  calculateTimeframeStart(timeframe) {
    const now = new Date()
    
    switch (timeframe) {
      case '1h':
        return new Date(now.getTime() - 60 * 60 * 1000)
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000)
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      default:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000)
    }
  }
}

export default PortAnalyticsService
