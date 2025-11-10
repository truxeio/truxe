/**
 * Session Management Service
 * 
 * Handles JTI-based session management, revocation, device tracking,
 * and concurrent session limits with comprehensive security features.
 */

import crypto from 'crypto'
import { getPool } from '../database/connection.js'
import config from '../config/index.js'

/**
 * Session Service Class
 */
export class SessionService {
  constructor() {
    this.pool = getPool()
    this.maxConcurrentSessions = config.session.maxConcurrent
    this.cleanupInterval = config.session.cleanupInterval
    this.deviceTracking = config.session.deviceTracking
    this.extendOnUse = config.session.extendOnUse
    
    // Start cleanup timer
    this.startCleanupTimer()
  }
  
  /**
   * Create a new session
   */
  async createSession({
    userId,
    orgId = null,
    deviceInfo = {},
    ip = null,
    userAgent = null,
    accessTokenJTI,
    refreshTokenJTI,
    expiresAt,
  }) {
    try {
      // Check concurrent session limits
      await this.enforceSessionLimits(userId)
      
      // Create session record
      const result = await this.pool.query(
        `INSERT INTO sessions (
          jti, user_id, org_id, refresh_jti, device_info, 
          ip, user_agent, expires_at, created_at, last_used_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING *`,
        [
          accessTokenJTI,
          userId,
          orgId,
          refreshTokenJTI,
          JSON.stringify(deviceInfo),
          ip,
          userAgent,
          expiresAt,
        ]
      )
      
      const session = result.rows[0]
      
      // Log session creation
      if (config.features.auditLogs) {
        await this.logSessionEvent({
          userId,
          orgId,
          action: 'session.created',
          sessionId: session.jti,
          ip,
          userAgent,
          details: {
            deviceInfo,
            expiresAt: expiresAt.toISOString(),
          },
        })
      }
      
      return this.formatSession(session)
    } catch (error) {
      console.error('Failed to create session:', error.message)
      throw new Error('Session creation failed')
    }
  }
  
  /**
   * Get session by JTI
   */
  async getSession(jti) {
    try {
      const result = await this.pool.query(
        'SELECT * FROM sessions WHERE jti = $1 AND revoked_at IS NULL',
        [jti]
      )
      
      if (result.rows.length === 0) {
        return null
      }
      
      return this.formatSession(result.rows[0])
    } catch (error) {
      console.error('Failed to get session:', error.message)
      throw new Error('Session retrieval failed')
    }
  }
  
  /**
   * Get session by refresh token JTI
   */
  async getSessionByRefreshJTI(refreshJTI) {
    try {
      const result = await this.pool.query(
        'SELECT * FROM sessions WHERE refresh_jti = $1 AND revoked_at IS NULL',
        [refreshJTI]
      )
      
      if (result.rows.length === 0) {
        return null
      }
      
      return this.formatSession(result.rows[0])
    } catch (error) {
      console.error('Failed to get session by refresh JTI:', error.message)
      throw new Error('Session retrieval failed')
    }
  }
  
  /**
   * Update session last used time
   */
  async updateSessionLastUsed(jti, extendExpiration = false) {
    try {
      let query = 'UPDATE sessions SET last_used_at = NOW()'
      const params = [jti]
      
      // Optionally extend expiration
      if (extendExpiration && this.extendOnUse) {
        query += ', expires_at = NOW() + INTERVAL \'15 minutes\''
      }
      
      query += ' WHERE jti = $1 AND revoked_at IS NULL RETURNING *'
      
      const result = await this.pool.query(query, params)
      
      if (result.rows.length === 0) {
        return null
      }
      
      return this.formatSession(result.rows[0])
    } catch (error) {
      console.error('Failed to update session last used:', error.message)
      throw new Error('Session update failed')
    }
  }
  
  /**
   * Revoke session by JTI
   */
  async revokeSession(jti, reason = 'user_logout', revokedBy = null) {
    try {
      const result = await this.pool.query(
        `UPDATE sessions 
         SET revoked_at = NOW(), revoked_reason = $2 
         WHERE jti = $1 AND revoked_at IS NULL 
         RETURNING *`,
        [jti, reason]
      )
      
      if (result.rows.length === 0) {
        return null
      }
      
      const session = result.rows[0]
      
      // Log session revocation
      if (config.features.auditLogs) {
        await this.logSessionEvent({
          userId: session.user_id,
          orgId: session.org_id,
          action: 'session.revoked',
          sessionId: jti,
          ip: null,
          userAgent: null,
          details: {
            reason,
            revokedBy,
            revokedAt: session.revoked_at,
          },
        })
      }
      
      return this.formatSession(session)
    } catch (error) {
      console.error('Failed to revoke session:', error.message)
      throw new Error('Session revocation failed')
    }
  }
  
  /**
   * Revoke all sessions for a user
   */
  async revokeAllUserSessions(userId, reason = 'admin_action', excludeJTI = null) {
    try {
      let query = `
        UPDATE sessions 
        SET revoked_at = NOW(), revoked_reason = $2 
        WHERE user_id = $1 AND revoked_at IS NULL
      `
      const params = [userId, reason]
      
      // Optionally exclude a specific session (e.g., current session)
      if (excludeJTI) {
        query += ' AND jti != $3'
        params.push(excludeJTI)
      }
      
      query += ' RETURNING *'
      
      const result = await this.pool.query(query, params)
      
      // Log bulk revocation
      if (config.features.auditLogs && result.rows.length > 0) {
        await this.logSessionEvent({
          userId,
          orgId: null,
          action: 'session.bulk_revoked',
          sessionId: null,
          ip: null,
          userAgent: null,
          details: {
            reason,
            revokedCount: result.rows.length,
            excludedJTI: excludeJTI,
          },
        })
      }
      
      return result.rows.map(session => this.formatSession(session))
    } catch (error) {
      console.error('Failed to revoke all user sessions:', error.message)
      throw new Error('Bulk session revocation failed')
    }
  }
  
  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId) {
    try {
      const result = await this.pool.query(
        `SELECT * FROM sessions 
         WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
         ORDER BY created_at DESC`,
        [userId]
      )
      
      return result.rows.map(session => this.formatSession(session))
    } catch (error) {
      console.error('Failed to get user sessions:', error.message)
      throw new Error('Session retrieval failed')
    }
  }
  
  /**
   * Enforce concurrent session limits
   */
  async enforceSessionLimits(userId) {
    try {
      // Get current active sessions
      const activeSessions = await this.getUserSessions(userId)
      
      // Check if we need to revoke old sessions
      if (activeSessions.length >= this.maxConcurrentSessions) {
        // Sort by last used (oldest first)
        const sortedSessions = activeSessions.sort((a, b) => 
          new Date(a.lastUsedAt) - new Date(b.lastUsedAt)
        )
        
        // Revoke oldest sessions to make room
        const sessionsToRevoke = sortedSessions.slice(0, 
          activeSessions.length - this.maxConcurrentSessions + 1
        )
        
        for (const session of sessionsToRevoke) {
          await this.revokeSession(session.jti, 'session_limit_exceeded')
        }
      }
    } catch (error) {
      console.error('Failed to enforce session limits:', error.message)
      // Don't throw error - allow session creation to continue
    }
  }
  
  /**
   * Check if JTI is revoked (for JWT verification)
   */
  async isJTIRevoked(jti) {
    try {
      const result = await this.pool.query(
        'SELECT revoked_at FROM sessions WHERE jti = $1',
        [jti]
      )
      
      if (result.rows.length === 0) {
        // JTI not found - consider it revoked for security
        return true
      }
      
      return result.rows[0].revoked_at !== null
    } catch (error) {
      console.error('Failed to check JTI revocation status:', error.message)
      // Fail secure - consider revoked if we can't check
      return true
    }
  }
  
  /**
   * Update session with new refresh token JTI (for token rotation)
   */
  async updateRefreshJTI(sessionJTI, newRefreshJTI) {
    try {
      const result = await this.pool.query(
        `UPDATE sessions 
         SET refresh_jti = $2, last_used_at = NOW()
         WHERE jti = $1 AND revoked_at IS NULL 
         RETURNING *`,
        [sessionJTI, newRefreshJTI]
      )
      
      if (result.rows.length === 0) {
        return null
      }
      
      return this.formatSession(result.rows[0])
    } catch (error) {
      console.error('Failed to update refresh JTI:', error.message)
      throw new Error('Refresh JTI update failed')
    }
  }
  
  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions() {
    try {
      // Delete sessions expired more than 7 days ago (for audit trail)
      const result = await this.pool.query(
        `DELETE FROM sessions 
         WHERE (expires_at < NOW() - INTERVAL '7 days') 
            OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '7 days')
         RETURNING COUNT(*)`
      )
      
      const deletedCount = result.rowCount || 0
      
      if (deletedCount > 0) {
        console.log(`Cleaned up ${deletedCount} expired sessions`)
      }
      
      return deletedCount
    } catch (error) {
      console.error('Failed to cleanup expired sessions:', error.message)
      return 0
    }
  }
  
  /**
   * Start automatic cleanup timer
   */
  startCleanupTimer() {
    setInterval(async () => {
      try {
        await this.cleanupExpiredSessions()
      } catch (error) {
        console.error('Session cleanup timer error:', error.message)
      }
    }, this.cleanupInterval)
    
    console.log(`Session cleanup timer started (interval: ${this.cleanupInterval}ms)`)
  }
  
  /**
   * Generate device fingerprint
   */
  generateDeviceFingerprint(userAgent, ip, additionalData = {}) {
    if (!this.deviceTracking) {
      return null
    }
    
    const fingerprint = crypto
      .createHash('sha256')
      .update(`${userAgent || ''}:${ip || ''}:${JSON.stringify(additionalData)}`)
      .digest('hex')
    
    return {
      fingerprint,
      userAgent,
      ip,
      browser: this.parseBrowserInfo(userAgent),
      os: this.parseOSInfo(userAgent),
      ...additionalData,
    }
  }
  
  /**
   * Parse browser information from user agent
   */
  parseBrowserInfo(userAgent) {
    if (!userAgent) return { name: 'Unknown', version: 'Unknown' }
    
    const browsers = [
      { name: 'Chrome', regex: /Chrome\/([0-9.]+)/ },
      { name: 'Firefox', regex: /Firefox\/([0-9.]+)/ },
      { name: 'Safari', regex: /Version\/([0-9.]+).*Safari/ },
      { name: 'Edge', regex: /Edg\/([0-9.]+)/ },
    ]
    
    for (const browser of browsers) {
      const match = userAgent.match(browser.regex)
      if (match) {
        return { name: browser.name, version: match[1] }
      }
    }
    
    return { name: 'Unknown', version: 'Unknown' }
  }
  
  /**
   * Parse OS information from user agent
   */
  parseOSInfo(userAgent) {
    if (!userAgent) return { name: 'Unknown', version: 'Unknown' }
    
    const systems = [
      { name: 'Windows', regex: /Windows NT ([0-9.]+)/ },
      { name: 'macOS', regex: /Mac OS X ([0-9_.]+)/ },
      { name: 'Linux', regex: /Linux/ },
      { name: 'iOS', regex: /iPhone OS ([0-9_]+)/ },
      { name: 'Android', regex: /Android ([0-9.]+)/ },
    ]
    
    for (const system of systems) {
      const match = userAgent.match(system.regex)
      if (match) {
        return { 
          name: system.name, 
          version: match[1] ? match[1].replace(/_/g, '.') : 'Unknown',
        }
      }
    }
    
    return { name: 'Unknown', version: 'Unknown' }
  }
  
  /**
   * Log session-related events
   */
  async logSessionEvent({
    userId,
    orgId,
    action,
    sessionId,
    ip,
    userAgent,
    details = {},
  }) {
    try {
      await this.pool.query(
        `INSERT INTO audit_logs (
          org_id, actor_user_id, action, target_type, target_id,
          details, ip, user_agent, request_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          orgId,
          userId,
          action,
          'session',
          sessionId,
          JSON.stringify(details),
          ip,
          userAgent,
          crypto.randomUUID(),
        ]
      )
    } catch (error) {
      console.error('Failed to log session event:', error.message)
      // Don't throw - logging failure shouldn't break session operations
    }
  }
  
  /**
   * Format session object for API response
   */
  formatSession(session) {
    return {
      jti: session.jti,
      userId: session.user_id,
      orgId: session.org_id,
      refreshJTI: session.refresh_jti,
      deviceInfo: session.device_info,
      ip: session.ip,
      userAgent: session.user_agent,
      createdAt: session.created_at,
      expiresAt: session.expires_at,
      lastUsedAt: session.last_used_at,
      revokedAt: session.revoked_at,
      revokedReason: session.revoked_reason,
      isActive: !session.revoked_at && new Date(session.expires_at) > new Date(),
    }
  }
  
  /**
   * Get service health status
   */
  async getHealthStatus() {
    try {
      // Test database connectivity
      await this.pool.query('SELECT 1')
      
      // Get session statistics
      const stats = await this.pool.query(`
        SELECT 
          COUNT(*) as total_sessions,
          COUNT(*) FILTER (WHERE revoked_at IS NULL AND expires_at > NOW()) as active_sessions,
          COUNT(*) FILTER (WHERE revoked_at IS NOT NULL) as revoked_sessions,
          COUNT(*) FILTER (WHERE expires_at <= NOW()) as expired_sessions
        FROM sessions
      `)
      
      return {
        status: 'healthy',
        maxConcurrentSessions: this.maxConcurrentSessions,
        deviceTracking: this.deviceTracking,
        extendOnUse: this.extendOnUse,
        statistics: stats.rows[0],
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
      }
    }
  }
}

// Create singleton instance
const sessionService = new SessionService()

// Export singleton and class
export default sessionService
