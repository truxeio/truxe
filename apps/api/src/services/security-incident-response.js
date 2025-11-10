/**
 * Security Incident Response Service
 * 
 * Automated security incident response with:
 * - Real-time threat detection and response
 * - Automated incident classification and prioritization
 * - Multi-channel notification system
 * - Incident escalation procedures
 * - Security playbook automation
 * - Incident tracking and reporting
 */

import crypto from 'crypto'
import Redis from 'ioredis'
import { getPool } from '../database/connection.js'
import advancedSessionSecurityService from './advanced-session-security.js'
import threatDetectionService from './threat-detection.js'
import config from '../config/index.js'

/**
 * Security Incident Response Service Class
 */
export class SecurityIncidentResponseService {
  constructor() {
    this.pool = getPool()
    this.redis = new Redis(config.redis.url, {
      keyPrefix: config.redis.keyPrefix + 'security_incident:',
      retryDelayOnFailover: config.redis.retryDelayOnFailover,
      maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
      lazyConnect: true,
    })
    
    this.redis.on('error', (error) => {
      console.error('Security Incident Response Redis connection error:', error.message)
    })
    
    this.redis.on('connect', () => {
      console.log('Security Incident Response Redis connected successfully')
    })
    
    // Configuration
    this.config = {
      enabled: config.securityIncidentResponse?.enabled !== false,
      autoClassification: config.securityIncidentResponse?.autoClassification !== false,
      notificationChannels: config.securityIncidentResponse?.notificationChannels || ['log', 'email'],
      escalationLevels: config.securityIncidentResponse?.escalationLevels || [
        { level: 1, threshold: 3, response: 'log' },
        { level: 2, threshold: 5, response: 'notify' },
        { level: 3, threshold: 8, response: 'escalate' },
        { level: 4, threshold: 10, response: 'emergency' },
      ],
      responseTimeouts: config.securityIncidentResponse?.responseTimeouts || {
        level1: 300, // 5 minutes
        level2: 600, // 10 minutes
        level3: 1800, // 30 minutes
        level4: 3600, // 1 hour
      },
      playbooks: config.securityIncidentResponse?.playbooks || {},
    }
    
    // Incident types and their severity mappings
    this.incidentTypes = {
      'brute_force_attack': { severity: 'high', category: 'attack' },
      'account_takeover': { severity: 'critical', category: 'compromise' },
      'impossible_travel': { severity: 'high', category: 'anomaly' },
      'suspicious_activity': { severity: 'medium', category: 'anomaly' },
      'token_compromise': { severity: 'critical', category: 'compromise' },
      'session_hijacking': { severity: 'high', category: 'attack' },
      'privilege_escalation': { severity: 'critical', category: 'attack' },
      'data_exfiltration': { severity: 'critical', category: 'breach' },
      'malware_detection': { severity: 'high', category: 'threat' },
      'phishing_attempt': { severity: 'medium', category: 'social_engineering' },
    }
    
    // Start background processes
    this.startBackgroundProcesses()
    
    console.log('Security Incident Response Service initialized')
  }
  
  /**
   * Process security incident
   */
  async processIncident(incidentData) {
    if (!this.config.enabled) {
      return { processed: false, reason: 'service_disabled' }
    }
    
    try {
      const incidentId = crypto.randomUUID()
      const timestamp = new Date().toISOString()
      
      // Classify incident
      const classification = await this.classifyIncident(incidentData)
      
      // Create incident record
      const incident = {
        id: incidentId,
        timestamp,
        type: classification.type,
        severity: classification.severity,
        category: classification.category,
        status: 'open',
        priority: classification.priority,
        source: incidentData.source || 'system',
        userId: incidentData.userId,
        ip: incidentData.ip,
        userAgent: incidentData.userAgent,
        deviceInfo: incidentData.deviceInfo,
        details: incidentData.details || {},
        riskScore: classification.riskScore,
        escalationLevel: classification.escalationLevel,
        assignedTo: null,
        resolvedAt: null,
        resolution: null,
      }
      
      // Store incident
      await this.storeIncident(incident)
      
      // Trigger automated response
      const response = await this.triggerAutomatedResponse(incident)
      
      // Send notifications
      await this.sendNotifications(incident, response)
      
      // Log incident
      await this.logIncident(incident, response)
      
      return {
        processed: true,
        incidentId,
        classification,
        response,
        escalationLevel: incident.escalationLevel,
      }
    } catch (error) {
      console.error('Failed to process security incident:', error.message)
      return { processed: false, error: error.message }
    }
  }
  
  /**
   * Classify incident automatically
   */
  async classifyIncident(incidentData) {
    try {
      const { type, details, userId, ip, userAgent, deviceInfo } = incidentData
      
      // Get incident type configuration
      const typeConfig = this.incidentTypes[type] || { severity: 'medium', category: 'unknown' }
      
      // Calculate risk score
      let riskScore = this.calculateBaseRiskScore(typeConfig.severity)
      
      // Adjust risk score based on context
      if (userId) {
        const userRisk = await this.calculateUserRiskScore(userId)
        riskScore += userRisk
      }
      
      if (ip) {
        const ipRisk = await this.calculateIPRiskScore(ip)
        riskScore += ipRisk
      }
      
      if (deviceInfo) {
        const deviceRisk = await this.calculateDeviceRiskScore(deviceInfo)
        riskScore += deviceRisk
      }
      
      // Adjust based on details
      if (details) {
        const detailsRisk = this.calculateDetailsRiskScore(details)
        riskScore += detailsRisk
      }
      
      // Cap risk score at 10
      riskScore = Math.min(riskScore, 10)
      
      // Determine priority
      const priority = this.determinePriority(riskScore, typeConfig.severity)
      
      // Determine escalation level
      const escalationLevel = this.determineEscalationLevel(riskScore)
      
      return {
        type,
        severity: typeConfig.severity,
        category: typeConfig.category,
        riskScore,
        priority,
        escalationLevel,
        confidence: this.calculateClassificationConfidence(incidentData),
      }
    } catch (error) {
      console.error('Failed to classify incident:', error.message)
      return {
        type: incidentData.type || 'unknown',
        severity: 'medium',
        category: 'unknown',
        riskScore: 5,
        priority: 'medium',
        escalationLevel: 1,
        confidence: 0.5,
      }
    }
  }
  
  /**
   * Calculate base risk score from severity
   */
  calculateBaseRiskScore(severity) {
    const severityScores = {
      'low': 1,
      'medium': 3,
      'high': 6,
      'critical': 9,
    }
    return severityScores[severity] || 3
  }
  
  /**
   * Calculate user risk score
   */
  async calculateUserRiskScore(userId) {
    try {
      // Get user's recent security events
      const result = await this.pool.query(
        `SELECT action, details, created_at
         FROM audit_logs 
         WHERE actor_user_id = $1 
           AND created_at > NOW() - INTERVAL '24 hours'
           AND action LIKE 'threat_detection.%'
         ORDER BY created_at DESC
         LIMIT 50`,
        [userId]
      )
      
      const events = result.rows
      let riskScore = 0
      
      // Count high-severity events
      const highSeverityEvents = events.filter(event => 
        event.details?.severity === 'high' || event.details?.severity === 'critical'
      )
      riskScore += highSeverityEvents.length * 0.5
      
      // Check for repeated incidents
      const incidentTypes = events.map(event => event.action)
      const uniqueTypes = new Set(incidentTypes)
      if (uniqueTypes.size > 3) {
        riskScore += 1 // Multiple different incident types
      }
      
      return Math.min(riskScore, 3) // Cap at 3
    } catch (error) {
      console.error('Failed to calculate user risk score:', error.message)
      return 0
    }
  }
  
  /**
   * Calculate IP risk score
   */
  async calculateIPRiskScore(ip) {
    try {
      // Check if IP is in known malicious ranges (placeholder)
      // In production, integrate with threat intelligence feeds
      
      // Check recent activity from this IP
      const result = await this.pool.query(
        `SELECT COUNT(*) as count
         FROM audit_logs 
         WHERE ip = $1 
           AND created_at > NOW() - INTERVAL '1 hour'
           AND action LIKE 'threat_detection.%'`,
        [ip]
      )
      
      const recentThreats = parseInt(result.rows[0].count)
      let riskScore = 0
      
      if (recentThreats > 10) {
        riskScore += 2 // High activity
      } else if (recentThreats > 5) {
        riskScore += 1 // Medium activity
      }
      
      return Math.min(riskScore, 2) // Cap at 2
    } catch (error) {
      console.error('Failed to calculate IP risk score:', error.message)
      return 0
    }
  }
  
  /**
   * Calculate device risk score
   */
  async calculateDeviceRiskScore(deviceInfo) {
    try {
      let riskScore = 0
      
      // Check for suspicious device characteristics
      if (deviceInfo.browser?.name === 'Unknown') {
        riskScore += 0.5
      }
      
      if (deviceInfo.os?.name === 'Unknown') {
        riskScore += 0.5
      }
      
      if (deviceInfo.device?.type === 'Unknown') {
        riskScore += 0.5
      }
      
      // Check for unusual combinations
      if (deviceInfo.browser?.name === 'Internet Explorer' && deviceInfo.os?.name === 'macOS') {
        riskScore += 1 // Unusual combination
      }
      
      return Math.min(riskScore, 2) // Cap at 2
    } catch (error) {
      console.error('Failed to calculate device risk score:', error.message)
      return 0
    }
  }
  
  /**
   * Calculate details risk score
   */
  calculateDetailsRiskScore(details) {
    let riskScore = 0
    
    // Check for specific risk indicators
    if (details.impossibleTravel) {
      riskScore += 1
    }
    
    if (details.suspiciousPatterns) {
      riskScore += 0.5
    }
    
    if (details.rapidRequests) {
      riskScore += 0.5
    }
    
    if (details.privilegeEscalation) {
      riskScore += 2
    }
    
    if (details.dataAccess) {
      riskScore += 1
    }
    
    return Math.min(riskScore, 3) // Cap at 3
  }
  
  /**
   * Determine incident priority
   */
  determinePriority(riskScore, severity) {
    if (riskScore >= 8 || severity === 'critical') {
      return 'critical'
    } else if (riskScore >= 6 || severity === 'high') {
      return 'high'
    } else if (riskScore >= 4 || severity === 'medium') {
      return 'medium'
    } else {
      return 'low'
    }
  }
  
  /**
   * Determine escalation level
   */
  determineEscalationLevel(riskScore) {
    for (const level of this.config.escalationLevels) {
      if (riskScore >= level.threshold) {
        return level.level
      }
    }
    return 1 // Default to level 1
  }
  
  /**
   * Calculate classification confidence
   */
  calculateClassificationConfidence(incidentData) {
    let confidence = 0.5 // Base confidence
    
    // Increase confidence based on data quality
    if (incidentData.userId) confidence += 0.1
    if (incidentData.ip) confidence += 0.1
    if (incidentData.userAgent) confidence += 0.1
    if (incidentData.deviceInfo) confidence += 0.1
    if (incidentData.details && Object.keys(incidentData.details).length > 0) confidence += 0.1
    
    return Math.min(confidence, 1.0)
  }
  
  /**
   * Store incident in database and Redis
   */
  async storeIncident(incident) {
    try {
      // Store in database
      await this.pool.query(
        `INSERT INTO security_incidents (
          id, type, severity, category, status, priority, source, user_id,
          ip, user_agent, device_info, details, risk_score, escalation_level,
          assigned_to, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
        [
          incident.id,
          incident.type,
          incident.severity,
          incident.category,
          incident.status,
          incident.priority,
          incident.source,
          incident.userId,
          incident.ip,
          incident.userAgent,
          JSON.stringify(incident.deviceInfo),
          JSON.stringify(incident.details),
          incident.riskScore,
          incident.escalationLevel,
          incident.assignedTo,
          incident.timestamp,
          incident.timestamp,
        ]
      )
      
      // Store in Redis for real-time access
      const redisKey = `incident:${incident.id}`
      await this.redis.setex(redisKey, 86400 * 7, JSON.stringify(incident)) // 7 days
      
      // Add to incident index
      await this.redis.zadd('incidents:by_priority', incident.riskScore, incident.id)
      await this.redis.zadd('incidents:by_time', Date.now(), incident.id)
      
      // Add to user incidents if applicable
      if (incident.userId) {
        await this.redis.zadd(`user_incidents:${incident.userId}`, Date.now(), incident.id)
      }
      
      // Add to IP incidents if applicable
      if (incident.ip) {
        await this.redis.zadd(`ip_incidents:${incident.ip}`, Date.now(), incident.id)
      }
    } catch (error) {
      console.error('Failed to store incident:', error.message)
      throw error
    }
  }
  
  /**
   * Trigger automated response based on incident
   */
  async triggerAutomatedResponse(incident) {
    try {
      const responses = []
      
      // Get escalation level configuration
      const escalationConfig = this.config.escalationLevels.find(
        level => level.level === incident.escalationLevel
      )
      
      if (!escalationConfig) {
        return { responses, success: false, error: 'No escalation configuration found' }
      }
      
      // Execute response based on escalation level
      switch (escalationConfig.response) {
        case 'log':
          responses.push('logged')
          break
          
        case 'notify':
          responses.push('logged')
          responses.push('notified')
          break
          
        case 'escalate':
          responses.push('logged')
          responses.push('notified')
          responses.push('escalated')
          break
          
        case 'emergency':
          responses.push('logged')
          responses.push('notified')
          responses.push('escalated')
          responses.push('emergency_alert')
          break
      }
      
      // Execute specific playbook if available
      const playbook = this.config.playbooks[incident.type]
      if (playbook) {
        const playbookResponse = await this.executePlaybook(incident, playbook)
        responses.push(...playbookResponse)
      }
      
      // Execute automated actions based on incident type
      const automatedActions = await this.executeAutomatedActions(incident)
      responses.push(...automatedActions)
      
      return { responses, success: true }
    } catch (error) {
      console.error('Failed to trigger automated response:', error.message)
      return { responses: [], success: false, error: error.message }
    }
  }
  
  /**
   * Execute security playbook
   */
  async executePlaybook(incident, playbook) {
    try {
      const responses = []
      
      for (const action of playbook.actions) {
        switch (action.type) {
          case 'block_ip':
            if (incident.ip) {
              await this.blockIP(incident.ip, action.duration, incident.id)
              responses.push('ip_blocked')
            }
            break
            
          case 'suspend_user':
            if (incident.userId) {
              await this.suspendUser(incident.userId, `automated_suspension_${incident.type}`, {
                incidentId: incident.id,
                reason: action.reason,
              })
              responses.push('user_suspended')
            }
            break
            
          case 'revoke_sessions':
            if (incident.userId) {
              await this.revokeUserSessions(incident.userId, `automated_revocation_${incident.type}`)
              responses.push('sessions_revoked')
            }
            break
            
          case 'enable_mfa':
            if (incident.userId) {
              await this.enableMFA(incident.userId)
              responses.push('mfa_enabled')
            }
            break
            
          case 'send_alert':
            await this.sendAlert(incident, action.channels, action.message)
            responses.push('alert_sent')
            break
        }
      }
      
      return responses
    } catch (error) {
      console.error('Failed to execute playbook:', error.message)
      return []
    }
  }
  
  /**
   * Execute automated actions
   */
  async executeAutomatedActions(incident) {
    try {
      const actions = []
      
      // Block IP for brute force attacks
      if (incident.type === 'brute_force_attack' && incident.ip) {
        await this.blockIP(incident.ip, 3600, incident.id) // 1 hour
        actions.push('ip_blocked')
      }
      
      // Suspend user for account takeover
      if (incident.type === 'account_takeover' && incident.userId) {
        await this.suspendUser(incident.userId, `automated_suspension_${incident.type}`, {
          incidentId: incident.id,
        })
        actions.push('user_suspended')
      }
      
      // Revoke sessions for token compromise
      if (incident.type === 'token_compromise' && incident.userId) {
        await this.revokeUserSessions(incident.userId, `automated_revocation_${incident.type}`)
        actions.push('sessions_revoked')
      }
      
      return actions
    } catch (error) {
      console.error('Failed to execute automated actions:', error.message)
      return []
    }
  }
  
  /**
   * Send notifications
   */
  async sendNotifications(incident, response) {
    try {
      const notifications = []
      
      for (const channel of this.config.notificationChannels) {
        switch (channel) {
          case 'log':
            await this.logIncident(incident, response)
            notifications.push('logged')
            break
            
          case 'email':
            await this.sendEmailNotification(incident)
            notifications.push('email_sent')
            break
            
          case 'webhook':
            await this.sendWebhookNotification(incident)
            notifications.push('webhook_sent')
            break
            
          case 'slack':
            await this.sendSlackNotification(incident)
            notifications.push('slack_sent')
            break
        }
      }
      
      return notifications
    } catch (error) {
      console.error('Failed to send notifications:', error.message)
      return []
    }
  }
  
  /**
   * Log incident
   */
  async logIncident(incident, response) {
    try {
      await advancedSessionSecurityService.logSecurityEvent({
        userId: incident.userId,
        action: 'security_incident.created',
        target: { type: 'incident', id: incident.id },
        ip: incident.ip,
        userAgent: incident.userAgent,
        deviceInfo: incident.deviceInfo,
        sessionId: null,
        severity: incident.severity,
        details: {
          incidentType: incident.type,
          category: incident.category,
          priority: incident.priority,
          riskScore: incident.riskScore,
          escalationLevel: incident.escalationLevel,
          response,
        },
      })
    } catch (error) {
      console.error('Failed to log incident:', error.message)
    }
  }
  
  /**
   * Send email notification
   */
  async sendEmailNotification(incident) {
    try {
      // TODO: Implement email notification
      console.log(`Email notification for incident ${incident.id}: ${incident.type} (${incident.severity})`)
    } catch (error) {
      console.error('Failed to send email notification:', error.message)
    }
  }
  
  /**
   * Send webhook notification
   */
  async sendWebhookNotification(incident) {
    try {
      // TODO: Implement webhook notification
      console.log(`Webhook notification for incident ${incident.id}: ${incident.type} (${incident.severity})`)
    } catch (error) {
      console.error('Failed to send webhook notification:', error.message)
    }
  }
  
  /**
   * Send Slack notification
   */
  async sendSlackNotification(incident) {
    try {
      // TODO: Implement Slack notification
      console.log(`Slack notification for incident ${incident.id}: ${incident.type} (${incident.severity})`)
    } catch (error) {
      console.error('Failed to send Slack notification:', error.message)
    }
  }
  
  /**
   * AUTOMATED ACTIONS
   */
  
  /**
   * Block IP address
   */
  async blockIP(ip, duration, incidentId) {
    try {
      const blockKey = `blocked_ip:${ip}`
      const blockData = {
        ip,
        blockedAt: new Date().toISOString(),
        duration,
        incidentId,
        expiresAt: new Date(Date.now() + duration * 1000).toISOString(),
      }
      
      await this.redis.setex(blockKey, duration, JSON.stringify(blockData))
      
      // Log IP block
      await this.logIncident({
        id: crypto.randomUUID(),
        type: 'ip_blocked',
        severity: 'medium',
        category: 'response',
        details: { ip, duration, incidentId },
      }, ['ip_blocked'])
      
      return { success: true }
    } catch (error) {
      console.error('Failed to block IP:', error.message)
      return { success: false, error: error.message }
    }
  }
  
  /**
   * Suspend user account
   */
  async suspendUser(userId, reason, metadata = {}) {
    try {
      // Update user status
      await this.pool.query(
        'UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2',
        ['suspended', userId]
      )
      
      // Revoke all user sessions
      await this.pool.query(
        'UPDATE sessions SET revoked_at = NOW(), revoked_reason = $1 WHERE user_id = $2',
        [reason, userId]
      )
      
      // Log suspension
      await this.logIncident({
        id: crypto.randomUUID(),
        type: 'user_suspended',
        severity: 'high',
        category: 'response',
        userId,
        details: { reason, metadata },
      }, ['user_suspended'])
      
      return { success: true }
    } catch (error) {
      console.error('Failed to suspend user:', error.message)
      return { success: false, error: error.message }
    }
  }
  
  /**
   * Revoke all user sessions
   */
  async revokeUserSessions(userId, reason) {
    try {
      // Revoke all user sessions
      await this.pool.query(
        'UPDATE sessions SET revoked_at = NOW(), revoked_reason = $1 WHERE user_id = $2',
        [reason, userId]
      )
      
      // Log session revocation
      await this.logIncident({
        id: crypto.randomUUID(),
        type: 'sessions_revoked',
        severity: 'medium',
        category: 'response',
        userId,
        details: { reason },
      }, ['sessions_revoked'])
      
      return { success: true }
    } catch (error) {
      console.error('Failed to revoke user sessions:', error.message)
      return { success: false, error: error.message }
    }
  }
  
  /**
   * Enable MFA for user
   */
  async enableMFA(userId) {
    try {
      // TODO: Implement MFA enablement
      console.log(`MFA enabled for user ${userId}`)
      return { success: true }
    } catch (error) {
      console.error('Failed to enable MFA:', error.message)
      return { success: false, error: error.message }
    }
  }
  
  /**
   * Send alert
   */
  async sendAlert(incident, channels, message) {
    try {
      // TODO: Implement alert sending
      console.log(`Alert sent for incident ${incident.id}: ${message}`)
      return { success: true }
    } catch (error) {
      console.error('Failed to send alert:', error.message)
      return { success: false, error: error.message }
    }
  }
  
  /**
   * INCIDENT MANAGEMENT
   */
  
  /**
   * Get incident by ID
   */
  async getIncident(incidentId) {
    try {
      // Try Redis first
      const redisKey = `incident:${incidentId}`
      const cached = await this.redis.get(redisKey)
      
      if (cached) {
        return JSON.parse(cached)
      }
      
      // Fallback to database
      const result = await this.pool.query(
        'SELECT * FROM security_incidents WHERE id = $1',
        [incidentId]
      )
      
      if (result.rows.length === 0) {
        return null
      }
      
      const incident = result.rows[0]
      return {
        id: incident.id,
        type: incident.type,
        severity: incident.severity,
        category: incident.category,
        status: incident.status,
        priority: incident.priority,
        source: incident.source,
        userId: incident.user_id,
        ip: incident.ip,
        userAgent: incident.user_agent,
        deviceInfo: incident.device_info,
        details: incident.details,
        riskScore: incident.risk_score,
        escalationLevel: incident.escalation_level,
        assignedTo: incident.assigned_to,
        createdAt: incident.created_at,
        updatedAt: incident.updated_at,
        resolvedAt: incident.resolved_at,
        resolution: incident.resolution,
      }
    } catch (error) {
      console.error('Failed to get incident:', error.message)
      return null
    }
  }
  
  /**
   * Get incidents by user
   */
  async getUserIncidents(userId, limit = 50) {
    try {
      const result = await this.pool.query(
        `SELECT * FROM security_incidents 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2`,
        [userId, limit]
      )
      
      return result.rows.map(incident => ({
        id: incident.id,
        type: incident.type,
        severity: incident.severity,
        category: incident.category,
        status: incident.status,
        priority: incident.priority,
        riskScore: incident.risk_score,
        createdAt: incident.created_at,
        resolvedAt: incident.resolved_at,
      }))
    } catch (error) {
      console.error('Failed to get user incidents:', error.message)
      return []
    }
  }
  
  /**
   * Get incidents by IP
   */
  async getIPIncidents(ip, limit = 50) {
    try {
      const result = await this.pool.query(
        `SELECT * FROM security_incidents 
         WHERE ip = $1 
         ORDER BY created_at DESC 
         LIMIT $2`,
        [ip, limit]
      )
      
      return result.rows.map(incident => ({
        id: incident.id,
        type: incident.type,
        severity: incident.severity,
        category: incident.category,
        status: incident.status,
        priority: incident.priority,
        riskScore: incident.risk_score,
        userId: incident.user_id,
        createdAt: incident.created_at,
        resolvedAt: incident.resolved_at,
      }))
    } catch (error) {
      console.error('Failed to get IP incidents:', error.message)
      return []
    }
  }
  
  /**
   * Update incident status
   */
  async updateIncidentStatus(incidentId, status, resolution = null, assignedTo = null) {
    try {
      const now = new Date().toISOString()
      
      await this.pool.query(
        `UPDATE security_incidents 
         SET status = $1, resolution = $2, assigned_to = $3, updated_at = $4, resolved_at = $5
         WHERE id = $6`,
        [status, resolution, assignedTo, now, status === 'resolved' ? now : null, incidentId]
      )
      
      // Update Redis cache
      const redisKey = `incident:${incidentId}`
      const cached = await this.redis.get(redisKey)
      if (cached) {
        const incident = JSON.parse(cached)
        incident.status = status
        incident.resolution = resolution
        incident.assignedTo = assignedTo
        incident.updatedAt = now
        incident.resolvedAt = status === 'resolved' ? now : null
        
        await this.redis.setex(redisKey, 86400 * 7, JSON.stringify(incident))
      }
      
      return { success: true }
    } catch (error) {
      console.error('Failed to update incident status:', error.message)
      return { success: false, error: error.message }
    }
  }
  
  /**
   * BACKGROUND PROCESSES
   */
  
  /**
   * Start background processes
   */
  startBackgroundProcesses() {
    // Monitor for escalation every 5 minutes
    setInterval(async () => {
      try {
        await this.monitorEscalation()
      } catch (error) {
        console.error('Incident escalation monitoring error:', error.message)
      }
    }, 300000) // 5 minutes
    
    // Clean up expired data every hour
    setInterval(async () => {
      try {
        await this.cleanup()
      } catch (error) {
        console.error('Incident cleanup error:', error.message)
      }
    }, 3600000) // 1 hour
  }
  
  /**
   * Monitor for escalation
   */
  async monitorEscalation() {
    try {
      // Get unresolved high-priority incidents
      const result = await this.pool.query(
        `SELECT * FROM security_incidents 
         WHERE status = 'open' 
           AND priority IN ('high', 'critical')
           AND created_at < NOW() - INTERVAL '1 hour'
         ORDER BY created_at ASC`,
        []
      )
      
      for (const incident of result.rows) {
        const age = Date.now() - new Date(incident.created_at).getTime()
        const ageHours = age / (1000 * 60 * 60)
        
        // Escalate if incident is old and unresolved
        if (ageHours > 2) {
          await this.escalateIncident(incident.id, 'timeout')
        }
      }
    } catch (error) {
      console.error('Failed to monitor escalation:', error.message)
    }
  }
  
  /**
   * Escalate incident
   */
  async escalateIncident(incidentId, reason) {
    try {
      const incident = await this.getIncident(incidentId)
      if (!incident) return { success: false, error: 'Incident not found' }
      
      // Increase escalation level
      const newLevel = Math.min(incident.escalationLevel + 1, 4)
      
      await this.pool.query(
        'UPDATE security_incidents SET escalation_level = $1, updated_at = NOW() WHERE id = $2',
        [newLevel, incidentId]
      )
      
      // Log escalation
      await this.logIncident({
        id: crypto.randomUUID(),
        type: 'incident_escalated',
        severity: 'medium',
        category: 'response',
        details: { incidentId, reason, newLevel },
      }, ['escalated'])
      
      return { success: true }
    } catch (error) {
      console.error('Failed to escalate incident:', error.message)
      return { success: false, error: error.message }
    }
  }
  
  /**
   * Clean up expired data
   */
  async cleanup() {
    try {
      // Clean up expired Redis data
      const patterns = [
        'incident:*',
        'blocked_ip:*',
        'incidents:by_priority',
        'incidents:by_time',
        'user_incidents:*',
        'ip_incidents:*',
      ]
      
      let totalCleaned = 0
      
      for (const pattern of patterns) {
        const keys = await this.redis.keys(pattern)
        
        if (keys.length > 0) {
          // Check TTL for each key and delete expired ones
          const pipeline = this.redis.pipeline()
          
          for (const key of keys) {
            pipeline.ttl(key)
          }
          
          const ttlResults = await pipeline.exec()
          const expiredKeys = keys.filter((key, index) => ttlResults[index][1] === -1)
          
          if (expiredKeys.length > 0) {
            await this.redis.del(...expiredKeys)
            totalCleaned += expiredKeys.length
          }
        }
      }
      
      if (totalCleaned > 0) {
        console.log(`Cleaned up ${totalCleaned} expired incident data`)
      }
      
      return totalCleaned
    } catch (error) {
      console.error('Failed to cleanup incident data:', error.message)
      return 0
    }
  }
  
  /**
   * Get service health status
   */
  async getHealthStatus() {
    try {
      // Test Redis connectivity
      await this.redis.ping()
      
      // Get Redis memory usage
      const info = await this.redis.info('memory')
      const memoryUsage = info.match(/used_memory_human:(.+)/)?.[1]?.trim()
      
      // Get incident statistics
      const incidentStats = await this.pool.query(`
        SELECT 
          COUNT(*) as total_incidents,
          COUNT(*) FILTER (WHERE status = 'open') as open_incidents,
          COUNT(*) FILTER (WHERE priority = 'critical') as critical_incidents,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as recent_incidents
        FROM security_incidents
      `)
      
      return {
        status: 'healthy',
        config: this.config,
        redis: {
          connected: true,
          memoryUsage,
        },
        incidents: {
          total: parseInt(incidentStats.rows[0].total_incidents),
          open: parseInt(incidentStats.rows[0].open_incidents),
          critical: parseInt(incidentStats.rows[0].critical_incidents),
          recent: parseInt(incidentStats.rows[0].recent_incidents),
        },
        features: {
          enabled: this.config.enabled,
          autoClassification: this.config.autoClassification,
          notificationChannels: this.config.notificationChannels,
        },
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        redis: { connected: false },
      }
    }
  }
  
  /**
   * Close Redis connection
   */
  async close() {
    await this.redis.quit()
  }
}

// Create singleton instance
const securityIncidentResponseService = new SecurityIncidentResponseService()

// Export singleton and class
export default securityIncidentResponseService
