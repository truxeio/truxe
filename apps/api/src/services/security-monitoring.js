/**
 * Security Monitoring Dashboard Service
 * 
 * Comprehensive security monitoring with:
 * - Real-time security metrics
 * - Threat detection analytics
 * - Incident response tracking
 * - Security dashboard data
 * - Alert management
 * - Performance monitoring
 */

import { getPool } from '../database/connection.js'
import advancedSessionSecurityService from './advanced-session-security.js'
import threatDetectionService from './threat-detection.js'
import securityIncidentResponseService from './security-incident-response.js'
import refreshTokenRotationService from './refresh-token-rotation.js'
import config from '../config/index.js'

/**
 * Security Monitoring Service Class
 */
export class SecurityMonitoringService {
  constructor() {
    this.pool = getPool()
    
    // Configuration
    this.config = {
      metricsRetention: config.securityMonitoring?.metricsRetention || 30, // days
      alertThresholds: config.securityMonitoring?.alertThresholds || {
        highRiskIncidents: 5,
        failedLogins: 100,
        suspiciousActivities: 20,
        tokenCompromises: 3,
      },
      dashboardRefresh: config.securityMonitoring?.dashboardRefresh || 30000, // 30 seconds
      realTimeAlerts: config.securityMonitoring?.realTimeAlerts !== false,
    }
    
    console.log('Security Monitoring Service initialized')
  }
  
  /**
   * Get comprehensive security dashboard data
   */
  async getSecurityDashboard(timeRange = '24h') {
    try {
      const hours = this.parseTimeRange(timeRange)
      
      // Get all security metrics in parallel
      const [
        sessionMetrics,
        threatMetrics,
        incidentMetrics,
        tokenMetrics,
        deviceMetrics,
        ipMetrics,
        recentAlerts,
        securityTrends,
      ] = await Promise.all([
        this.getSessionMetrics(hours),
        this.getThreatMetrics(hours),
        this.getIncidentMetrics(hours),
        this.getTokenMetrics(hours),
        this.getDeviceMetrics(hours),
        this.getIPMetrics(hours),
        this.getRecentAlerts(50),
        this.getSecurityTrends(hours),
      ])
      
      // Calculate overall security score
      const securityScore = this.calculateSecurityScore({
        sessionMetrics,
        threatMetrics,
        incidentMetrics,
        tokenMetrics,
      })
      
      // Determine security status
      const securityStatus = this.determineSecurityStatus(securityScore, incidentMetrics)
      
      return {
        timeRange,
        generatedAt: new Date().toISOString(),
        securityStatus,
        securityScore,
        metrics: {
          sessions: sessionMetrics,
          threats: threatMetrics,
          incidents: incidentMetrics,
          tokens: tokenMetrics,
          devices: deviceMetrics,
          ips: ipMetrics,
        },
        alerts: recentAlerts,
        trends: securityTrends,
        summary: this.generateSecuritySummary({
          sessionMetrics,
          threatMetrics,
          incidentMetrics,
          tokenMetrics,
          securityScore,
          securityStatus,
        }),
      }
    } catch (error) {
      console.error('Failed to get security dashboard:', error.message)
      throw new Error('Security dashboard data retrieval failed')
    }
  }
  
  /**
   * Get session security metrics
   */
  async getSessionMetrics(hours) {
    try {
      const result = await this.pool.query(`
        SELECT 
          COUNT(*) as total_sessions,
          COUNT(*) FILTER (WHERE revoked_at IS NULL AND expires_at > NOW()) as active_sessions,
          COUNT(*) FILTER (WHERE revoked_at IS NOT NULL) as revoked_sessions,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '${hours} hours') as recent_sessions,
          COUNT(*) FILTER (WHERE revoked_reason = 'session_limit_exceeded') as limit_revoked,
          COUNT(*) FILTER (WHERE revoked_reason = 'security_incident') as security_revoked,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT ip) as unique_ips,
          AVG(EXTRACT(EPOCH FROM (expires_at - created_at))/3600) as avg_session_duration_hours
        FROM sessions
        WHERE created_at > NOW() - INTERVAL '${hours} hours'
      `)
      
      const stats = result.rows[0]
      
      return {
        total: parseInt(stats.total_sessions),
        active: parseInt(stats.active_sessions),
        revoked: parseInt(stats.revoked_sessions),
        recent: parseInt(stats.recent_sessions),
        limitRevoked: parseInt(stats.limit_revoked),
        securityRevoked: parseInt(stats.security_revoked),
        uniqueUsers: parseInt(stats.unique_users),
        uniqueIPs: parseInt(stats.unique_ips),
        avgDurationHours: parseFloat(stats.avg_session_duration_hours) || 0,
      }
    } catch (error) {
      console.error('Failed to get session metrics:', error.message)
      return this.getEmptySessionMetrics()
    }
  }
  
  /**
   * Get threat detection metrics
   */
  async getThreatMetrics(hours) {
    try {
      const result = await this.pool.query(`
        SELECT 
          action,
          COUNT(*) as count,
          COUNT(DISTINCT actor_user_id) as unique_users,
          COUNT(DISTINCT ip) as unique_ips
        FROM audit_logs 
        WHERE created_at > NOW() - INTERVAL '${hours} hours'
          AND action LIKE 'threat_detection.%'
        GROUP BY action
        ORDER BY count DESC
      `)
      
      const threats = result.rows.map(row => ({
        type: row.action.replace('threat_detection.', ''),
        count: parseInt(row.count),
        uniqueUsers: parseInt(row.unique_users),
        uniqueIPs: parseInt(row.unique_ips),
      }))
      
      const totalThreats = threats.reduce((sum, threat) => sum + threat.count, 0)
      const uniqueUsers = new Set(threats.flatMap(t => Array(t.uniqueUsers).fill(t.type))).size
      const uniqueIPs = new Set(threats.flatMap(t => Array(t.uniqueIPs).fill(t.type))).size
      
      return {
        total: totalThreats,
        uniqueUsers,
        uniqueIPs,
        byType: threats,
        topThreats: threats.slice(0, 5),
      }
    } catch (error) {
      console.error('Failed to get threat metrics:', error.message)
      return this.getEmptyThreatMetrics()
    }
  }
  
  /**
   * Get security incident metrics
   */
  async getIncidentMetrics(hours) {
    try {
      const result = await this.pool.query(`
        SELECT 
          type,
          severity,
          status,
          priority,
          COUNT(*) as count,
          AVG(risk_score) as avg_risk_score
        FROM security_incidents 
        WHERE created_at > NOW() - INTERVAL '${hours} hours'
        GROUP BY type, severity, status, priority
        ORDER BY count DESC
      `)
      
      const incidents = result.rows.map(row => ({
        type: row.type,
        severity: row.severity,
        status: row.status,
        priority: row.priority,
        count: parseInt(row.count),
        avgRiskScore: parseFloat(row.avg_risk_score) || 0,
      }))
      
      const totalIncidents = incidents.reduce((sum, incident) => sum + incident.count, 0)
      const openIncidents = incidents
        .filter(i => i.status === 'open')
        .reduce((sum, incident) => sum + incident.count, 0)
      const criticalIncidents = incidents
        .filter(i => i.severity === 'critical')
        .reduce((sum, incident) => sum + incident.count, 0)
      
      return {
        total: totalIncidents,
        open: openIncidents,
        critical: criticalIncidents,
        byType: this.groupIncidentsByType(incidents),
        bySeverity: this.groupIncidentsBySeverity(incidents),
        byStatus: this.groupIncidentsByStatus(incidents),
        avgRiskScore: incidents.reduce((sum, i) => sum + i.avgRiskScore, 0) / incidents.length || 0,
      }
    } catch (error) {
      console.error('Failed to get incident metrics:', error.message)
      return this.getEmptyIncidentMetrics()
    }
  }
  
  /**
   * Get token security metrics
   */
  async getTokenMetrics(hours) {
    try {
      // Get token refresh metrics
      const refreshResult = await this.pool.query(`
        SELECT 
          COUNT(*) as total_refreshes,
          COUNT(*) FILTER (WHERE details->>'rotated' = 'true') as rotated_refreshes,
          COUNT(DISTINCT actor_user_id) as unique_users
        FROM audit_logs 
        WHERE created_at > NOW() - INTERVAL '${hours} hours'
          AND action LIKE 'refresh_token.%'
      `)
      
      // Get token revocation metrics
      const revocationResult = await this.pool.query(`
        SELECT 
          COUNT(*) as total_revocations,
          COUNT(*) FILTER (WHERE revoked_reason = 'security_incident') as security_revocations,
          COUNT(*) FILTER (WHERE revoked_reason = 'user_logout') as user_revocations
        FROM sessions 
        WHERE revoked_at > NOW() - INTERVAL '${hours} hours'
      `)
      
      const refreshStats = refreshResult.rows[0]
      const revocationStats = revocationResult.rows[0]
      
      return {
        refreshes: {
          total: parseInt(refreshStats.total_refreshes),
          rotated: parseInt(refreshStats.rotated_refreshes),
          uniqueUsers: parseInt(refreshStats.unique_users),
          rotationRate: refreshStats.total_refreshes > 0 
            ? (refreshStats.rotated_refreshes / refreshStats.total_refreshes) * 100 
            : 0,
        },
        revocations: {
          total: parseInt(revocationStats.total_revocations),
          security: parseInt(revocationStats.security_revocations),
          user: parseInt(revocationStats.user_revocations),
          securityRate: revocationStats.total_revocations > 0 
            ? (revocationStats.security_revocations / revocationStats.total_revocations) * 100 
            : 0,
        },
      }
    } catch (error) {
      console.error('Failed to get token metrics:', error.message)
      return this.getEmptyTokenMetrics()
    }
  }
  
  /**
   * Get device security metrics
   */
  async getDeviceMetrics(hours) {
    try {
      const result = await this.pool.query(`
        SELECT 
          device_info->>'browser'->>'name' as browser,
          device_info->>'os'->>'name' as os,
          device_info->>'device'->>'type' as device_type,
          COUNT(*) as count,
          COUNT(DISTINCT user_id) as unique_users
        FROM sessions 
        WHERE created_at > NOW() - INTERVAL '${hours} hours'
          AND device_info IS NOT NULL
        GROUP BY browser, os, device_type
        ORDER BY count DESC
        LIMIT 20
      `)
      
      const devices = result.rows.map(row => ({
        browser: row.browser || 'Unknown',
        os: row.os || 'Unknown',
        deviceType: row.device_type || 'Unknown',
        count: parseInt(row.count),
        uniqueUsers: parseInt(row.unique_users),
      }))
      
      const browsers = this.groupDevicesByBrowser(devices)
      const operatingSystems = this.groupDevicesByOS(devices)
      const deviceTypes = this.groupDevicesByType(devices)
      
      return {
        total: devices.reduce((sum, device) => sum + device.count, 0),
        uniqueUsers: Math.max(...devices.map(d => d.uniqueUsers), 0),
        browsers,
        operatingSystems,
        deviceTypes,
        topDevices: devices.slice(0, 10),
      }
    } catch (error) {
      console.error('Failed to get device metrics:', error.message)
      return this.getEmptyDeviceMetrics()
    }
  }
  
  /**
   * Get IP security metrics
   */
  async getIPMetrics(hours) {
    try {
      const result = await this.pool.query(`
        SELECT 
          ip,
          COUNT(*) as session_count,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(*) FILTER (WHERE revoked_at IS NOT NULL) as revoked_sessions,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as recent_sessions
        FROM sessions 
        WHERE created_at > NOW() - INTERVAL '${hours} hours'
          AND ip IS NOT NULL
        GROUP BY ip
        ORDER BY session_count DESC
        LIMIT 20
      `)
      
      const ips = result.rows.map(row => ({
        ip: row.ip.substring(0, 8) + '***', // Mask IP for privacy
        sessionCount: parseInt(row.session_count),
        uniqueUsers: parseInt(row.unique_users),
        revokedSessions: parseInt(row.revoked_sessions),
        recentSessions: parseInt(row.recent_sessions),
        revocationRate: row.session_count > 0 
          ? (row.revoked_sessions / row.session_count) * 100 
          : 0,
      }))
      
      return {
        total: ips.reduce((sum, ip) => sum + ip.sessionCount, 0),
        uniqueIPs: ips.length,
        topIPs: ips.slice(0, 10),
        suspiciousIPs: ips.filter(ip => ip.revocationRate > 50 || ip.recentSessions > 10),
      }
    } catch (error) {
      console.error('Failed to get IP metrics:', error.message)
      return this.getEmptyIPMetrics()
    }
  }
  
  /**
   * Get recent security alerts
   */
  async getRecentAlerts(limit = 50) {
    try {
      const result = await this.pool.query(`
        SELECT 
          action,
          severity,
          details,
          ip,
          created_at
        FROM audit_logs 
        WHERE action LIKE 'security_incident.%'
           OR action LIKE 'threat_detection.%'
           OR action LIKE 'session.%'
        ORDER BY created_at DESC 
        LIMIT $1
      `, [limit])
      
      return result.rows.map(row => ({
        action: row.action,
        severity: row.details?.severity || 'info',
        details: row.details,
        ip: row.ip ? row.ip.substring(0, 8) + '***' : null,
        timestamp: row.created_at,
      }))
    } catch (error) {
      console.error('Failed to get recent alerts:', error.message)
      return []
    }
  }
  
  /**
   * Get security trends over time
   */
  async getSecurityTrends(hours) {
    try {
      const result = await this.pool.query(`
        SELECT 
          DATE_TRUNC('hour', created_at) as hour,
          COUNT(*) FILTER (WHERE action LIKE 'threat_detection.%') as threats,
          COUNT(*) FILTER (WHERE action LIKE 'security_incident.%') as incidents,
          COUNT(*) FILTER (WHERE action = 'session.created') as sessions_created,
          COUNT(*) FILTER (WHERE action = 'session.revoked') as sessions_revoked
        FROM audit_logs 
        WHERE created_at > NOW() - INTERVAL '${hours} hours'
        GROUP BY hour
        ORDER BY hour
      `)
      
      return result.rows.map(row => ({
        hour: row.hour,
        threats: parseInt(row.threats),
        incidents: parseInt(row.incidents),
        sessionsCreated: parseInt(row.sessions_created),
        sessionsRevoked: parseInt(row.sessions_revoked),
      }))
    } catch (error) {
      console.error('Failed to get security trends:', error.message)
      return []
    }
  }
  
  /**
   * Calculate overall security score
   */
  calculateSecurityScore({ sessionMetrics, threatMetrics, incidentMetrics, tokenMetrics }) {
    let score = 100 // Start with perfect score
    
    // Deduct points for security issues
    if (incidentMetrics.critical > 0) score -= incidentMetrics.critical * 10
    if (incidentMetrics.open > 5) score -= (incidentMetrics.open - 5) * 2
    if (threatMetrics.total > 50) score -= Math.min(threatMetrics.total * 0.5, 20)
    if (sessionMetrics.securityRevoked > 10) score -= Math.min(sessionMetrics.securityRevoked * 0.5, 15)
    if (tokenMetrics.revocations.securityRate > 20) score -= 10
    
    // Bonus points for good practices
    if (tokenMetrics.refreshes.rotationRate > 80) score += 5
    if (sessionMetrics.avgDurationHours < 24) score += 5 // Short session duration is good
    
    return Math.max(0, Math.min(100, score))
  }
  
  /**
   * Determine security status
   */
  determineSecurityStatus(securityScore, incidentMetrics) {
    if (incidentMetrics.critical > 0) return 'critical'
    if (securityScore < 50) return 'high_risk'
    if (securityScore < 70) return 'medium_risk'
    if (incidentMetrics.open > 10) return 'attention_needed'
    return 'secure'
  }
  
  /**
   * Generate security summary
   */
  generateSecuritySummary({ sessionMetrics, threatMetrics, incidentMetrics, tokenMetrics, securityScore, securityStatus }) {
    const summary = {
      status: securityStatus,
      score: securityScore,
      keyMetrics: {
        activeSessions: sessionMetrics.active,
        openIncidents: incidentMetrics.open,
        totalThreats: threatMetrics.total,
        tokenRotationRate: tokenMetrics.refreshes.rotationRate,
      },
      recommendations: [],
    }
    
    // Generate recommendations based on metrics
    if (incidentMetrics.open > 5) {
      summary.recommendations.push('Review and resolve open security incidents')
    }
    
    if (threatMetrics.total > 100) {
      summary.recommendations.push('Investigate high threat detection volume')
    }
    
    if (tokenMetrics.refreshes.rotationRate < 50) {
      summary.recommendations.push('Enable token rotation for better security')
    }
    
    if (sessionMetrics.securityRevoked > 20) {
      summary.recommendations.push('Review session security policies')
    }
    
    if (securityScore < 70) {
      summary.recommendations.push('Overall security posture needs improvement')
    }
    
    return summary
  }
  
  /**
   * UTILITY METHODS
   */
  
  parseTimeRange(timeRange) {
    const ranges = {
      '1h': 1,
      '24h': 24,
      '7d': 168,
      '30d': 720,
    }
    return ranges[timeRange] || 24
  }
  
  groupIncidentsByType(incidents) {
    const grouped = {}
    incidents.forEach(incident => {
      if (!grouped[incident.type]) {
        grouped[incident.type] = { count: 0, avgRiskScore: 0 }
      }
      grouped[incident.type].count += incident.count
      grouped[incident.type].avgRiskScore += incident.avgRiskScore
    })
    
    // Calculate average risk scores
    Object.keys(grouped).forEach(type => {
      const typeIncidents = incidents.filter(i => i.type === type)
      grouped[type].avgRiskScore = grouped[type].avgRiskScore / typeIncidents.length
    })
    
    return grouped
  }
  
  groupIncidentsBySeverity(incidents) {
    const grouped = {}
    incidents.forEach(incident => {
      if (!grouped[incident.severity]) {
        grouped[incident.severity] = 0
      }
      grouped[incident.severity] += incident.count
    })
    return grouped
  }
  
  groupIncidentsByStatus(incidents) {
    const grouped = {}
    incidents.forEach(incident => {
      if (!grouped[incident.status]) {
        grouped[incident.status] = 0
      }
      grouped[incident.status] += incident.count
    })
    return grouped
  }
  
  groupDevicesByBrowser(devices) {
    const grouped = {}
    devices.forEach(device => {
      if (!grouped[device.browser]) {
        grouped[device.browser] = { count: 0, uniqueUsers: 0 }
      }
      grouped[device.browser].count += device.count
      grouped[device.browser].uniqueUsers += device.uniqueUsers
    })
    return grouped
  }
  
  groupDevicesByOS(devices) {
    const grouped = {}
    devices.forEach(device => {
      if (!grouped[device.os]) {
        grouped[device.os] = { count: 0, uniqueUsers: 0 }
      }
      grouped[device.os].count += device.count
      grouped[device.os].uniqueUsers += device.uniqueUsers
    })
    return grouped
  }
  
  groupDevicesByType(devices) {
    const grouped = {}
    devices.forEach(device => {
      if (!grouped[device.deviceType]) {
        grouped[device.deviceType] = { count: 0, uniqueUsers: 0 }
      }
      grouped[device.deviceType].count += device.count
      grouped[device.deviceType].uniqueUsers += device.uniqueUsers
    })
    return grouped
  }
  
  /**
   * EMPTY METRICS FALLBACKS
   */
  
  getEmptySessionMetrics() {
    return {
      total: 0,
      active: 0,
      revoked: 0,
      recent: 0,
      limitRevoked: 0,
      securityRevoked: 0,
      uniqueUsers: 0,
      uniqueIPs: 0,
      avgDurationHours: 0,
    }
  }
  
  getEmptyThreatMetrics() {
    return {
      total: 0,
      uniqueUsers: 0,
      uniqueIPs: 0,
      byType: [],
      topThreats: [],
    }
  }
  
  getEmptyIncidentMetrics() {
    return {
      total: 0,
      open: 0,
      critical: 0,
      byType: {},
      bySeverity: {},
      byStatus: {},
      avgRiskScore: 0,
    }
  }
  
  getEmptyTokenMetrics() {
    return {
      refreshes: {
        total: 0,
        rotated: 0,
        uniqueUsers: 0,
        rotationRate: 0,
      },
      revocations: {
        total: 0,
        security: 0,
        user: 0,
        securityRate: 0,
      },
    }
  }
  
  getEmptyDeviceMetrics() {
    return {
      total: 0,
      uniqueUsers: 0,
      browsers: {},
      operatingSystems: {},
      deviceTypes: {},
      topDevices: [],
    }
  }
  
  getEmptyIPMetrics() {
    return {
      total: 0,
      uniqueIPs: 0,
      topIPs: [],
      suspiciousIPs: [],
    }
  }
  
  /**
   * Get service health status
   */
  async getHealthStatus() {
    try {
      // Test database connectivity
      await this.pool.query('SELECT 1')
      
      // Get service health from other services
      const [
        sessionSecurityHealth,
        threatDetectionHealth,
        incidentResponseHealth,
        tokenRotationHealth,
      ] = await Promise.all([
        advancedSessionSecurityService.getHealthStatus(),
        threatDetectionService.getHealthStatus(),
        securityIncidentResponseService.getHealthStatus(),
        refreshTokenRotationService.getHealthStatus(),
      ])
      
      return {
        status: 'healthy',
        config: this.config,
        services: {
          sessionSecurity: sessionSecurityHealth.status,
          threatDetection: threatDetectionHealth.status,
          incidentResponse: incidentResponseHealth.status,
          tokenRotation: tokenRotationHealth.status,
        },
        database: {
          connected: true,
        },
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        database: { connected: false },
      }
    }
  }
}

// Create singleton instance
const securityMonitoringService = new SecurityMonitoringService()

// Export singleton and class
export default securityMonitoringService
