/**
 * Advanced Session Security Service
 * 
 * Enterprise-grade session security with:
 * - JTI-based token revocation with Redis blacklisting
 * - Advanced device fingerprinting and tracking
 * - Concurrent session limits with configurable maximums
 * - Comprehensive audit logging for security events
 * - Anomaly detection for suspicious activities
 * - Automated session cleanup and monitoring
 */

import crypto from 'crypto'
import Redis from 'ioredis'
import { getPool } from '../database/connection.js'
import config from '../config/index.js'
import sessionService from './session.js'

/**
 * Advanced Session Security Service Class
 */
class AdvancedSessionSecurityService {
  constructor() {
    this.pool = getPool()
    this.redis = new Redis(config.redis.url, {
      keyPrefix: config.redis.keyPrefix + 'session_security:',
      retryDelayOnFailover: config.redis.retryDelayOnFailover,
      maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
      lazyConnect: true,
    })
    
    this.redis.on('error', (error) => {
      console.error('Session Security Redis connection error:', error.message)
    })
    
    this.redis.on('connect', () => {
      console.log('Session Security Redis connected successfully')
    })
    
    // Security configuration
    this.config = {
      maxConcurrentSessions: config.session.maxConcurrent || 5,
      deviceTracking: config.session.deviceTracking !== false,
      anomalyDetection: config.session.anomalyDetection !== false,
      impossibleTravelThreshold: config.session.impossibleTravelThreshold || 500, // km/h
      newDeviceNotification: config.session.newDeviceNotification !== false,
      sessionCleanupInterval: config.session.cleanupInterval || 3600000, // 1 hour
      jtiBlacklistTTL: config.session.jtiBlacklistTTL || 2592000, // 30 days
    }
    
    // Start background processes
    this.startCleanupTimer()
    this.startAnomalyDetectionTimer()
    
    console.log('Advanced Session Security Service initialized')
  }
  
  /**
   * JTI BLACKLISTING SYSTEM
   */
  
  /**
   * Blacklist a JTI immediately for revocation
   */
  async blacklistJTI(jti, reason = 'revoked', metadata = {}) {
    try {
      const key = `blacklist:${jti}`
      const data = {
        jti,
        reason,
        blacklistedAt: new Date().toISOString(),
        metadata,
      }
      
      // Store in Redis with TTL
      await this.redis.setex(key, this.config.jtiBlacklistTTL, JSON.stringify(data))
      
      // Also store in database for audit trail
      await this.pool.query(
        `INSERT INTO audit_logs (action, target_type, target_id, details, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        ['session.jti_blacklisted', 'jti', jti, JSON.stringify({ reason, ...metadata })]
      )
      
      console.log(`JTI blacklisted: ${jti} (reason: ${reason})`)
      return { success: true, jti, reason }
    } catch (error) {
      console.error('Failed to blacklist JTI:', error.message)
      throw new Error('JTI blacklisting failed')
    }
  }
  
  /**
   * Check if JTI is blacklisted
   */
  async isJTIBlacklisted(jti) {
    try {
      const key = `blacklist:${jti}`
      const result = await this.redis.get(key)
      
      if (result) {
        const data = JSON.parse(result)
        return {
          blacklisted: true,
          reason: data.reason,
          blacklistedAt: data.blacklistedAt,
          metadata: data.metadata,
        }
      }
      
      return { blacklisted: false }
    } catch (error) {
      console.error('Failed to check JTI blacklist:', error.message)
      // Fail secure - consider blacklisted if we can't check
      return { blacklisted: true, reason: 'check_failed', error: error.message }
    }
  }
  
  /**
   * Remove JTI from blacklist (admin function)
   */
  async removeFromBlacklist(jti, reason = 'admin_action') {
    try {
      const key = `blacklist:${jti}`
      const deleted = await this.redis.del(key)
      
      if (deleted > 0) {
        // Log the removal
        await this.pool.query(
          `INSERT INTO audit_logs (action, target_type, target_id, details, created_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          ['session.jti_unblacklisted', 'jti', jti, JSON.stringify({ reason })]
        )
        
        console.log(`JTI removed from blacklist: ${jti} (reason: ${reason})`)
        return { success: true, removed: true }
      }
      
      return { success: true, removed: false, message: 'JTI was not blacklisted' }
    } catch (error) {
      console.error('Failed to remove JTI from blacklist:', error.message)
      throw new Error('JTI blacklist removal failed')
    }
  }
  
  /**
   * ADVANCED DEVICE FINGERPRINTING
   */
  
  /**
   * Generate comprehensive device fingerprint
   */
  generateAdvancedDeviceFingerprint(request, additionalData = {}) {
    const userAgent = request.headers['user-agent'] || ''
    const ip = request.ip
    const acceptLanguage = request.headers['accept-language'] || ''
    const acceptEncoding = request.headers['accept-encoding'] || ''
    const connection = request.headers.connection || ''
    const upgradeInsecureRequests = request.headers['upgrade-insecure-requests'] || ''
    const dnt = request.headers.dnt || ''
    
    // Parse detailed browser and OS information
    const browserInfo = this.parseAdvancedBrowserInfo(userAgent)
    const osInfo = this.parseAdvancedOSInfo(userAgent)
    const deviceInfo = this.parseDeviceInfo(userAgent)
    
    // Generate fingerprint hash
    const fingerprintData = {
      userAgent,
      acceptLanguage,
      acceptEncoding,
      connection,
      upgradeInsecureRequests,
      dnt,
      browserInfo,
      osInfo,
      deviceInfo,
      ...additionalData,
    }
    
    const fingerprint = crypto
      .createHash('sha256')
      .update(JSON.stringify(fingerprintData))
      .digest('hex')
    
    // Generate a more stable fingerprint (without volatile data)
    const stableData = {
      browser: browserInfo.name,
      browserVersion: browserInfo.version?.split('.')[0], // Major version only
      os: osInfo.name,
      osVersion: osInfo.version?.split('.')[0], // Major version only
      device: deviceInfo.type,
      acceptLanguage: acceptLanguage?.split(',')[0], // Primary language only
    }
    
    const stableFingerprint = crypto
      .createHash('sha256')
      .update(JSON.stringify(stableData))
      .digest('hex')
    
    return {
      fingerprint,
      stableFingerprint,
      ip,
      userAgent,
      browser: browserInfo,
      os: osInfo,
      device: deviceInfo,
      headers: {
        acceptLanguage,
        acceptEncoding,
        connection,
        upgradeInsecureRequests,
        dnt,
      },
      generatedAt: new Date().toISOString(),
      ...additionalData,
    }
  }
  
  /**
   * Parse advanced browser information
   */
  parseAdvancedBrowserInfo(userAgent) {
    if (!userAgent) return { name: 'Unknown', version: 'Unknown', engine: 'Unknown' }
    
    const browsers = [
      // Chrome-based browsers
      { name: 'Chrome', regex: /Chrome\/([0-9.]+)/, engine: 'Blink' },
      { name: 'Edge', regex: /Edg\/([0-9.]+)/, engine: 'Blink' },
      { name: 'Opera', regex: /OPR\/([0-9.]+)/, engine: 'Blink' },
      { name: 'Brave', regex: /Brave\/([0-9.]+)/, engine: 'Blink' },
      
      // Firefox
      { name: 'Firefox', regex: /Firefox\/([0-9.]+)/, engine: 'Gecko' },
      
      // Safari
      { name: 'Safari', regex: /Version\/([0-9.]+).*Safari/, engine: 'WebKit' },
      
      // Mobile browsers
      { name: 'Chrome Mobile', regex: /Chrome\/([0-9.]+).*Mobile/, engine: 'Blink' },
      { name: 'Firefox Mobile', regex: /Mobile.*Firefox\/([0-9.]+)/, engine: 'Gecko' },
      { name: 'Safari Mobile', regex: /Version\/([0-9.]+).*Mobile.*Safari/, engine: 'WebKit' },
      
      // Other browsers
      { name: 'Internet Explorer', regex: /MSIE ([0-9.]+)/, engine: 'Trident' },
      { name: 'Internet Explorer', regex: /rv:([0-9.]+).*Trident/, engine: 'Trident' },
    ]
    
    for (const browser of browsers) {
      const match = userAgent.match(browser.regex)
      if (match) {
        return { 
          name: browser.name, 
          version: match[1],
          engine: browser.engine,
          fullVersion: match[1],
        }
      }
    }
    
    return { name: 'Unknown', version: 'Unknown', engine: 'Unknown' }
  }
  
  /**
   * Parse advanced OS information
   */
  parseAdvancedOSInfo(userAgent) {
    if (!userAgent) return { name: 'Unknown', version: 'Unknown', architecture: 'Unknown' }
    
    const systems = [
      // Windows
      { name: 'Windows', regex: /Windows NT ([0-9.]+)/, arch: /WOW64|Win64|x64/ },
      
      // macOS
      { name: 'macOS', regex: /Mac OS X ([0-9_.]+)/, arch: /Intel|PPC/ },
      
      // Linux distributions
      { name: 'Ubuntu', regex: /Ubuntu/, arch: /x86_64|i686/ },
      { name: 'Linux', regex: /Linux/, arch: /x86_64|i686|armv7l|aarch64/ },
      
      // Mobile OS
      { name: 'iOS', regex: /iPhone OS ([0-9_]+)/, arch: /arm64|armv7/ },
      { name: 'Android', regex: /Android ([0-9.]+)/, arch: /arm64-v8a|armeabi-v7a/ },
      
      // Other OS
      { name: 'ChromeOS', regex: /CrOS/, arch: /x86_64|armv7l/ },
      { name: 'FreeBSD', regex: /FreeBSD/, arch: /amd64|i386/ },
    ]
    
    for (const system of systems) {
      const match = userAgent.match(system.regex)
      if (match) {
        const archMatch = userAgent.match(system.arch)
        return { 
          name: system.name, 
          version: match[1] ? match[1].replace(/_/g, '.') : 'Unknown',
          architecture: archMatch ? archMatch[0] : 'Unknown',
        }
      }
    }
    
    return { name: 'Unknown', version: 'Unknown', architecture: 'Unknown' }
  }
  
  /**
   * Parse device information
   */
  parseDeviceInfo(userAgent) {
    if (!userAgent) return { type: 'Unknown', model: 'Unknown', vendor: 'Unknown' }
    
    // Mobile devices
    if (/Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)) {
      if (/iPhone/i.test(userAgent)) {
        const model = userAgent.match(/iPhone OS ([0-9_]+)/)?.[1]?.replace(/_/g, '.')
        return { type: 'Mobile', model: `iPhone (iOS ${model})`, vendor: 'Apple' }
      }
      
      if (/iPad/i.test(userAgent)) {
        return { type: 'Tablet', model: 'iPad', vendor: 'Apple' }
      }
      
      if (/Android/i.test(userAgent)) {
        const model = userAgent.match(/Android ([0-9.]+)/)?.[1]
        return { type: 'Mobile', model: `Android ${model}`, vendor: 'Google' }
      }
      
      return { type: 'Mobile', model: 'Unknown', vendor: 'Unknown' }
    }
    
    // Tablets
    if (/Tablet|iPad/i.test(userAgent)) {
      return { type: 'Tablet', model: 'Unknown', vendor: 'Unknown' }
    }
    
    // Desktop/Laptop
    return { type: 'Desktop', model: 'Unknown', vendor: 'Unknown' }
  }
  
  /**
   * Check if device is recognized (previously seen)
   */
  async isDeviceRecognized(userId, deviceFingerprint) {
    try {
      // Check stable fingerprint in recent sessions
      const result = await this.pool.query(
        `SELECT COUNT(*) as count
         FROM sessions 
         WHERE user_id = $1 
           AND device_info->>'stableFingerprint' = $2
           AND created_at > NOW() - INTERVAL '30 days'`,
        [userId, deviceFingerprint.stableFingerprint]
      )
      
      const count = parseInt(result.rows[0].count)
      return {
        recognized: count > 0,
        previousSessions: count,
        fingerprint: deviceFingerprint.stableFingerprint,
      }
    } catch (error) {
      console.error('Failed to check device recognition:', error.message)
      return { recognized: false, error: error.message }
    }
  }
  
  /**
   * CONCURRENT SESSION MANAGEMENT
   */
  
  /**
   * Enhanced session limits enforcement with priority-based eviction
   */
  async enforceAdvancedSessionLimits(userId, newSessionInfo = {}) {
    try {
      // Get current active sessions
      const activeSessions = await sessionService.getUserSessions(userId)
      
      // Check if we need to revoke old sessions
      if (activeSessions.length >= this.config.maxConcurrentSessions) {
        // Calculate session scores for priority-based eviction
        const scoredSessions = activeSessions.map(session => {
          const score = this.calculateSessionScore(session, newSessionInfo)
          return { ...session, score }
        })
        
        // Sort by score (lowest score = highest priority for removal)
        scoredSessions.sort((a, b) => a.score - b.score)
        
        // Determine how many sessions to revoke
        const sessionsToRevoke = scoredSessions.slice(0, 
          activeSessions.length - this.config.maxConcurrentSessions + 1
        )
        
        // Revoke sessions with audit logging
        for (const session of sessionsToRevoke) {
          await this.revokeSessionWithAudit(session.jti, 'session_limit_exceeded', {
            userId,
            totalSessions: activeSessions.length,
            maxAllowed: this.config.maxConcurrentSessions,
            sessionScore: session.score,
            newSessionInfo,
          })
        }
        
        console.log(`Revoked ${sessionsToRevoke.length} sessions for user ${userId} due to limit enforcement`)
      }
    } catch (error) {
      console.error('Failed to enforce session limits:', error.message)
      // Don't throw error - allow session creation to continue
    }
  }
  
  /**
   * Calculate session priority score for eviction
   */
  calculateSessionScore(session, newSessionInfo = {}) {
    let score = 0
    
    // Age factor (older sessions have lower score)
    const ageHours = (Date.now() - new Date(session.createdAt).getTime()) / (1000 * 60 * 60)
    score += Math.min(ageHours * 10, 1000) // Max 1000 points for age
    
    // Last used factor (less recently used have lower score)
    const lastUsedHours = (Date.now() - new Date(session.lastUsedAt).getTime()) / (1000 * 60 * 60)
    score += Math.min(lastUsedHours * 20, 2000) // Max 2000 points for inactivity
    
    // Device recognition factor (unrecognized devices have lower score)
    const deviceInfo = session.deviceInfo
    const newDeviceInfo = newSessionInfo.deviceInfo
    
    if (deviceInfo && newDeviceInfo) {
      // Same device gets bonus points (less likely to be revoked)
      if (deviceInfo.stableFingerprint === newDeviceInfo.stableFingerprint) {
        score += 5000 // High bonus for same device
      }
      
      // Same browser family gets some bonus
      if (deviceInfo.browser?.name === newDeviceInfo.browser?.name) {
        score += 1000
      }
      
      // Same OS gets some bonus
      if (deviceInfo.os?.name === newDeviceInfo.os?.name) {
        score += 500
      }
    }
    
    // IP address factor (same IP gets bonus)
    if (session.ip === newSessionInfo.ip) {
      score += 2000
    }
    
    return score
  }
  
  /**
   * ANOMALY DETECTION
   */
  
  /**
   * Detect impossible travel between sessions
   */
  async detectImpossibleTravel(userId, newLocation, newTimestamp) {
    try {
      // Get the most recent session with location data
      const result = await this.pool.query(
        `SELECT ip, created_at, device_info
         FROM sessions 
         WHERE user_id = $1 
           AND ip IS NOT NULL 
           AND created_at < $2
         ORDER BY created_at DESC 
         LIMIT 1`,
        [userId, newTimestamp]
      )
      
      if (result.rows.length === 0) {
        return { impossibleTravel: false, reason: 'no_previous_location' }
      }
      
      const previousSession = result.rows[0]
      const timeDiff = (new Date(newTimestamp) - new Date(previousSession.created_at)) / 1000 / 60 / 60 // hours
      
      // Skip check if sessions are too close in time (less than 1 hour)
      if (timeDiff < 1) {
        return { impossibleTravel: false, reason: 'time_too_close' }
      }
      
      // Get approximate locations from IP addresses (simplified - in production use IP geolocation service)
      const previousLocation = await this.getLocationFromIP(previousSession.ip)
      const currentLocation = await this.getLocationFromIP(newLocation.ip || newLocation)
      
      if (!previousLocation || !currentLocation) {
        return { impossibleTravel: false, reason: 'location_unknown' }
      }
      
      // Calculate distance between locations
      const distance = this.calculateDistance(
        previousLocation.lat, previousLocation.lon,
        currentLocation.lat, currentLocation.lon
      )
      
      // Calculate required speed (km/h)
      const requiredSpeed = distance / timeDiff
      
      // Check if travel is impossible (faster than threshold)
      const isImpossible = requiredSpeed > this.config.impossibleTravelThreshold
      
      return {
        impossibleTravel: isImpossible,
        distance,
        timeDiff,
        requiredSpeed,
        threshold: this.config.impossibleTravelThreshold,
        previousLocation,
        currentLocation,
        previousSession: {
          ip: previousSession.ip,
          createdAt: previousSession.created_at,
        },
      }
    } catch (error) {
      console.error('Failed to detect impossible travel:', error.message)
      return { impossibleTravel: false, error: error.message }
    }
  }
  
  /**
   * Get approximate location from IP address (placeholder - integrate with real service)
   */
  async getLocationFromIP(ip) {
    // In production, integrate with services like MaxMind GeoIP2, IPinfo, etc.
    // For now, return mock data for common IP ranges
    
    if (!ip || ip === '127.0.0.1' || ip === '::1') {
      return { lat: 37.7749, lon: -122.4194, city: 'San Francisco', country: 'US' } // Default
    }
    
    // Mock locations for demonstration
    const mockLocations = {
      '192.168.': { lat: 37.7749, lon: -122.4194, city: 'San Francisco', country: 'US' },
      '10.0.': { lat: 40.7128, lon: -74.0060, city: 'New York', country: 'US' },
    }
    
    for (const [prefix, location] of Object.entries(mockLocations)) {
      if (ip.startsWith(prefix)) {
        return location
      }
    }
    
    // Default location
    return { lat: 37.7749, lon: -122.4194, city: 'Unknown', country: 'Unknown' }
  }
  
  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371 // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1)
    const dLon = this.toRadians(lon2 - lon1)
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }
  
  toRadians(degrees) {
    return degrees * (Math.PI/180)
  }
  
  /**
   * Detect suspicious session patterns
   */
  async detectSuspiciousPatterns(userId, sessionData) {
    const patterns = []
    
    try {
      // Pattern 1: Rapid session creation from different IPs
      const recentSessions = await this.pool.query(
        `SELECT ip, created_at
         FROM sessions 
         WHERE user_id = $1 
           AND created_at > NOW() - INTERVAL '1 hour'
         ORDER BY created_at DESC`,
        [userId]
      )
      
      if (recentSessions.rows.length > 5) {
        const uniqueIPs = new Set(recentSessions.rows.map(s => s.ip))
        if (uniqueIPs.size > 3) {
          patterns.push({
            type: 'rapid_multi_ip_sessions',
            severity: 'high',
            details: {
              sessionCount: recentSessions.rows.length,
              uniqueIPs: uniqueIPs.size,
              timeWindow: '1 hour',
            },
          })
        }
      }
      
      // Pattern 2: Unusual browser/OS combinations
      const deviceInfo = sessionData.deviceInfo
      if (deviceInfo) {
        const userSessions = await this.pool.query(
          `SELECT device_info
           FROM sessions 
           WHERE user_id = $1 
             AND created_at > NOW() - INTERVAL '30 days'
           LIMIT 100`,
          [userId]
        )
        
        const browsers = new Set()
        const oses = new Set()
        
        for (const session of userSessions.rows) {
          if (session.device_info?.browser?.name) {
            browsers.add(session.device_info.browser.name)
          }
          if (session.device_info?.os?.name) {
            oses.add(session.device_info.os.name)
          }
        }
        
        if (browsers.size > 5) {
          patterns.push({
            type: 'multiple_browsers',
            severity: 'medium',
            details: {
              uniqueBrowsers: browsers.size,
              currentBrowser: deviceInfo.browser?.name,
            },
          })
        }
        
        if (oses.size > 3) {
          patterns.push({
            type: 'multiple_operating_systems',
            severity: 'medium',
            details: {
              uniqueOSes: oses.size,
              currentOS: deviceInfo.os?.name,
            },
          })
        }
      }
      
      // Pattern 3: Sessions from known malicious IP ranges (placeholder)
      // In production, integrate with threat intelligence feeds
      
      return {
        suspicious: patterns.length > 0,
        patterns,
        riskScore: this.calculateRiskScore(patterns),
      }
    } catch (error) {
      console.error('Failed to detect suspicious patterns:', error.message)
      return { suspicious: false, error: error.message }
    }
  }
  
  /**
   * Calculate risk score based on detected patterns
   */
  calculateRiskScore(patterns) {
    let score = 0
    
    for (const pattern of patterns) {
      switch (pattern.severity) {
        case 'low':
          score += 10
          break
        case 'medium':
          score += 25
          break
        case 'high':
          score += 50
          break
        case 'critical':
          score += 100
          break
      }
    }
    
    return Math.min(score, 100) // Cap at 100
  }
  
  /**
   * ENHANCED AUDIT LOGGING
   */
  
  /**
   * Log comprehensive security events
   */
  async logSecurityEvent({
    userId,
    orgId = null,
    action,
    target = null,
    ip = null,
    userAgent = null,
    deviceInfo = null,
    sessionId = null,
    severity = 'info',
    details = {},
    correlationId = null,
  }) {
    try {
      const eventData = {
        org_id: orgId,
        actor_user_id: userId,
        action,
        target_type: target?.type || null,
        target_id: target?.id || null,
        details: {
          severity,
          ip,
          userAgent,
          deviceInfo,
          sessionId,
          correlationId: correlationId || crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          ...details,
        },
        ip,
        user_agent: userAgent,
        request_id: crypto.randomUUID(),
      }
      
      // Store in database
      await this.pool.query(
        `INSERT INTO audit_logs (
          org_id, actor_user_id, action, target_type, target_id, 
          details, ip, user_agent, request_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [
          eventData.org_id,
          eventData.actor_user_id,
          eventData.action,
          eventData.target_type,
          eventData.target_id,
          JSON.stringify(eventData.details),
          eventData.ip,
          eventData.user_agent,
          eventData.request_id,
        ]
      )
      
      // Also store in Redis for real-time monitoring (with shorter TTL)
      const redisKey = `security_event:${eventData.request_id}`
      await this.redis.setex(redisKey, 86400, JSON.stringify(eventData)) // 24 hours
      
      // Log to console for immediate visibility
      console.log(`Security Event [${severity.toUpperCase()}]: ${action}`, {
        userId,
        sessionId,
        ip: ip?.substring(0, 8) + '***', // Partially mask IP
        correlationId: eventData.details.correlationId,
      })
      
      return eventData.request_id
    } catch (error) {
      console.error('Failed to log security event:', error.message)
      // Don't throw - logging failure shouldn't break application flow
      return null
    }
  }
  
  /**
   * Revoke session with comprehensive audit logging
   */
  async revokeSessionWithAudit(jti, reason, metadata = {}) {
    try {
      // Get session details before revocation
      const session = await sessionService.getSession(jti)
      if (!session) {
        return { success: false, error: 'Session not found' }
      }
      
      // Blacklist JTI immediately
      await this.blacklistJTI(jti, reason, metadata)
      
      // Revoke session in database
      const revokedSession = await sessionService.revokeSession(jti, reason)
      
      // Log comprehensive security event
      await this.logSecurityEvent({
        userId: session.userId,
        orgId: session.orgId,
        action: 'session.revoked',
        target: { type: 'session', id: jti },
        ip: session.ip,
        userAgent: session.userAgent,
        deviceInfo: session.deviceInfo,
        sessionId: jti,
        severity: 'info',
        details: {
          reason,
          sessionAge: Date.now() - new Date(session.createdAt).getTime(),
          lastUsed: session.lastUsedAt,
          ...metadata,
        },
      })
      
      return { success: true, session: revokedSession }
    } catch (error) {
      console.error('Failed to revoke session with audit:', error.message)
      throw error
    }
  }
  
  /**
   * BACKGROUND PROCESSES
   */
  
  /**
   * Start cleanup timer for expired sessions and blacklisted JTIs
   */
  startCleanupTimer() {
    setInterval(async () => {
      try {
        await this.performCleanup()
      } catch (error) {
        console.error('Cleanup timer error:', error.message)
      }
    }, this.config.sessionCleanupInterval)
    
    console.log(`Session security cleanup timer started (interval: ${this.config.sessionCleanupInterval}ms)`)
  }
  
  /**
   * Perform comprehensive cleanup
   */
  async performCleanup() {
    try {
      const startTime = Date.now()
      
      // Clean up expired sessions (delegate to session service)
      const expiredSessions = await sessionService.cleanupExpiredSessions()
      
      // Clean up expired blacklisted JTIs
      const expiredJTIs = await this.cleanupExpiredBlacklistedJTIs()
      
      // Clean up old security events from Redis
      const expiredEvents = await this.cleanupExpiredSecurityEvents()
      
      const duration = Date.now() - startTime
      
      console.log(`Security cleanup completed in ${duration}ms:`, {
        expiredSessions,
        expiredJTIs,
        expiredEvents,
      })
      
      // Log cleanup stats
      await this.logSecurityEvent({
        userId: null,
        action: 'system.security_cleanup',
        severity: 'info',
        details: {
          duration,
          expiredSessions,
          expiredJTIs,
          expiredEvents,
        },
      })
    } catch (error) {
      console.error('Failed to perform security cleanup:', error.message)
    }
  }
  
  /**
   * Clean up expired blacklisted JTIs
   */
  async cleanupExpiredBlacklistedJTIs() {
    try {
      const pattern = 'blacklist:*'
      const stream = this.redis.scanStream({
        match: pattern,
        count: 100,
      })
      
      let deletedCount = 0
      
      return new Promise((resolve) => {
        stream.on('data', async (keys) => {
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
              deletedCount += expiredKeys.length
            }
          }
        })
        
        stream.on('end', () => {
          resolve(deletedCount)
        })
      })
    } catch (error) {
      console.error('Failed to cleanup expired blacklisted JTIs:', error.message)
      return 0
    }
  }
  
  /**
   * Clean up expired security events from Redis
   */
  async cleanupExpiredSecurityEvents() {
    try {
      const pattern = 'security_event:*'
      const keys = await this.redis.keys(pattern)
      
      if (keys.length === 0) {
        return 0
      }
      
      // Delete keys that have expired (TTL = -1)
      const pipeline = this.redis.pipeline()
      
      for (const key of keys) {
        pipeline.ttl(key)
      }
      
      const ttlResults = await pipeline.exec()
      const expiredKeys = keys.filter((key, index) => ttlResults[index][1] === -1)
      
      if (expiredKeys.length > 0) {
        await this.redis.del(...expiredKeys)
        return expiredKeys.length
      }
      
      return 0
    } catch (error) {
      console.error('Failed to cleanup expired security events:', error.message)
      return 0
    }
  }
  
  /**
   * Start anomaly detection timer
   */
  startAnomalyDetectionTimer() {
    if (!this.config.anomalyDetection) {
      return
    }
    
    // Run anomaly detection every 5 minutes
    setInterval(async () => {
      try {
        await this.performAnomalyDetection()
      } catch (error) {
        console.error('Anomaly detection timer error:', error.message)
      }
    }, 300000) // 5 minutes
    
    console.log('Anomaly detection timer started')
  }
  
  /**
   * Perform periodic anomaly detection
   */
  async performAnomalyDetection() {
    try {
      // Detect patterns in recent security events
      const recentEvents = await this.getRecentSecurityEvents()
      const anomalies = await this.analyzeSecurityEventPatterns(recentEvents)
      
      if (anomalies.length > 0) {
        console.warn(`Detected ${anomalies.length} security anomalies`)
        
        // Log anomalies
        for (const anomaly of anomalies) {
          await this.logSecurityEvent({
            userId: null,
            action: 'system.anomaly_detected',
            severity: anomaly.severity,
            details: anomaly,
          })
        }
      }
    } catch (error) {
      console.error('Failed to perform anomaly detection:', error.message)
    }
  }
  
  /**
   * Get recent security events for analysis
   */
  async getRecentSecurityEvents(hours = 1) {
    try {
      const result = await this.pool.query(
        `SELECT action, details, ip, created_at
         FROM audit_logs 
         WHERE created_at > NOW() - INTERVAL '${hours} hours'
           AND action LIKE 'session.%'
         ORDER BY created_at DESC
         LIMIT 1000`,
        []
      )
      
      return result.rows
    } catch (error) {
      console.error('Failed to get recent security events:', error.message)
      return []
    }
  }
  
  /**
   * Analyze security event patterns for anomalies
   */
  async analyzeSecurityEventPatterns(events) {
    const anomalies = []
    
    try {
      // Group events by IP
      const eventsByIP = {}
      for (const event of events) {
        if (event.ip) {
          if (!eventsByIP[event.ip]) {
            eventsByIP[event.ip] = []
          }
          eventsByIP[event.ip].push(event)
        }
      }
      
      // Detect IPs with excessive failed attempts
      for (const [ip, ipEvents] of Object.entries(eventsByIP)) {
        const failedEvents = ipEvents.filter(e => 
          e.action.includes('failed') || e.action.includes('revoked')
        )
        
        if (failedEvents.length > 10) {
          anomalies.push({
            type: 'excessive_failed_attempts',
            severity: 'high',
            ip,
            eventCount: failedEvents.length,
            timeWindow: '1 hour',
          })
        }
      }
      
      // Detect unusual session creation patterns
      const sessionCreations = events.filter(e => e.action === 'session.created')
      if (sessionCreations.length > 100) {
        anomalies.push({
          type: 'excessive_session_creation',
          severity: 'medium',
          count: sessionCreations.length,
          timeWindow: '1 hour',
        })
      }
      
      return anomalies
    } catch (error) {
      console.error('Failed to analyze security event patterns:', error.message)
      return []
    }
  }
  
  /**
   * SERVICE HEALTH AND MONITORING
   */
  
  /**
   * Get comprehensive service health status
   */
  async getHealthStatus() {
    try {
      // Test Redis connectivity
      await this.redis.ping()
      
      // Test database connectivity
      await this.pool.query('SELECT 1')
      
      // Get Redis memory usage
      const info = await this.redis.info('memory')
      const memoryUsage = info.match(/used_memory_human:(.+)/)?.[1]?.trim()
      
      // Get blacklist statistics
      const blacklistKeys = await this.redis.keys('blacklist:*')
      const securityEventKeys = await this.redis.keys('security_event:*')
      
      // Get recent session statistics
      const sessionStats = await this.pool.query(`
        SELECT 
          COUNT(*) as total_sessions,
          COUNT(*) FILTER (WHERE revoked_at IS NULL AND expires_at > NOW()) as active_sessions,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as recent_sessions,
          COUNT(*) FILTER (WHERE revoked_reason = 'session_limit_exceeded') as limit_revoked_sessions
        FROM sessions
        WHERE created_at > NOW() - INTERVAL '24 hours'
      `)
      
      return {
        status: 'healthy',
        features: {
          jtiBlacklisting: true,
          deviceFingerprinting: this.config.deviceTracking,
          anomalyDetection: this.config.anomalyDetection,
          impossibleTravelDetection: true,
        },
        redis: {
          connected: true,
          memoryUsage,
          blacklistedJTIs: blacklistKeys.length,
          securityEvents: securityEventKeys.length,
        },
        database: {
          connected: true,
        },
        sessions: {
          total: parseInt(sessionStats.rows[0].total_sessions),
          active: parseInt(sessionStats.rows[0].active_sessions),
          recent: parseInt(sessionStats.rows[0].recent_sessions),
          limitRevoked: parseInt(sessionStats.rows[0].limit_revoked_sessions),
        },
        config: {
          maxConcurrentSessions: this.config.maxConcurrentSessions,
          impossibleTravelThreshold: this.config.impossibleTravelThreshold,
          jtiBlacklistTTL: this.config.jtiBlacklistTTL,
          cleanupInterval: this.config.sessionCleanupInterval,
        },
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        redis: { connected: false },
        database: { connected: false },
      }
    }
  }
  
  /**
   * Get security monitoring dashboard data
   */
  async getSecurityDashboardData(timeRange = '24h') {
    try {
      const hours = timeRange === '1h' ? 1 : timeRange === '7d' ? 168 : 24
      
      // Session statistics
      const sessionStats = await this.pool.query(`
        SELECT 
          DATE_TRUNC('hour', created_at) as hour,
          COUNT(*) as total_sessions,
          COUNT(*) FILTER (WHERE revoked_at IS NOT NULL) as revoked_sessions,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT ip) as unique_ips
        FROM sessions 
        WHERE created_at > NOW() - INTERVAL '${hours} hours'
        GROUP BY hour
        ORDER BY hour
      `)
      
      // Security events
      const securityEvents = await this.pool.query(`
        SELECT 
          action,
          COUNT(*) as count,
          COUNT(DISTINCT actor_user_id) as unique_users
        FROM audit_logs 
        WHERE created_at > NOW() - INTERVAL '${hours} hours'
          AND action LIKE 'session.%'
        GROUP BY action
        ORDER BY count DESC
      `)
      
      // Top IPs by session count
      const topIPs = await this.pool.query(`
        SELECT 
          ip,
          COUNT(*) as session_count,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(*) FILTER (WHERE revoked_at IS NOT NULL) as revoked_count
        FROM sessions 
        WHERE created_at > NOW() - INTERVAL '${hours} hours'
          AND ip IS NOT NULL
        GROUP BY ip
        ORDER BY session_count DESC
        LIMIT 10
      `)
      
      // Device statistics
      const deviceStats = await this.pool.query(`
        SELECT 
          device_info->>'browser'->>'name' as browser,
          device_info->>'os'->>'name' as os,
          COUNT(*) as count
        FROM sessions 
        WHERE created_at > NOW() - INTERVAL '${hours} hours'
          AND device_info IS NOT NULL
        GROUP BY browser, os
        ORDER BY count DESC
        LIMIT 10
      `)
      
      return {
        timeRange,
        generatedAt: new Date().toISOString(),
        sessions: {
          timeline: sessionStats.rows,
          total: sessionStats.rows.reduce((sum, row) => sum + parseInt(row.total_sessions), 0),
          revoked: sessionStats.rows.reduce((sum, row) => sum + parseInt(row.revoked_sessions), 0),
        },
        securityEvents: securityEvents.rows,
        topIPs: topIPs.rows.map(row => ({
          ...row,
          ip: row.ip.substring(0, 8) + '***', // Mask IP for privacy
        })),
        devices: deviceStats.rows,
        summary: {
          totalSessions: sessionStats.rows.reduce((sum, row) => sum + parseInt(row.total_sessions), 0),
          revokedSessions: sessionStats.rows.reduce((sum, row) => sum + parseInt(row.revoked_sessions), 0),
          uniqueUsers: Math.max(...sessionStats.rows.map(row => parseInt(row.unique_users) || 0)),
          uniqueIPs: Math.max(...sessionStats.rows.map(row => parseInt(row.unique_ips) || 0)),
        },
      }
    } catch (error) {
      console.error('Failed to get security dashboard data:', error.message)
      throw new Error('Security dashboard data retrieval failed')
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
const advancedSessionSecurityService = new AdvancedSessionSecurityService()

// Export singleton and class
export default advancedSessionSecurityService
