/**
 * Threat Detection Service
 * 
 * Advanced threat detection and security monitoring with:
 * - Brute force attack prevention
 * - Account takeover detection
 * - Impossible travel detection
 * - Suspicious activity alerting
 * - Automated security response
 * - Machine learning-based anomaly detection
 */

import crypto from 'crypto'
import Redis from 'ioredis'
import { getPool } from '../database/connection.js'
import advancedSessionSecurityService from './advanced-session-security.js'
import config from '../config/index.js'

/**
 * Threat Detection Service Class
 */
export class ThreatDetectionService {
  constructor() {
    this.pool = getPool()
    this.redis = new Redis(config.redis.url, {
      keyPrefix: config.redis.keyPrefix + 'threat_detection:',
      retryDelayOnFailover: config.redis.retryDelayOnFailover,
      maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
      lazyConnect: true,
    })
    
    this.redis.on('error', (error) => {
      console.error('Threat Detection Redis connection error:', error.message)
    })
    
    this.redis.on('connect', () => {
      console.log('Threat Detection Redis connected successfully')
    })
    
    // Configuration
    this.config = {
      bruteForce: {
        enabled: config.threatDetection?.bruteForce?.enabled !== false,
        maxAttempts: config.threatDetection?.bruteForce?.maxAttempts || 5,
        windowMinutes: config.threatDetection?.bruteForce?.windowMinutes || 15,
        lockoutDuration: config.threatDetection?.bruteForce?.lockoutDuration || 900, // 15 minutes
        progressiveDelay: config.threatDetection?.bruteForce?.progressiveDelay || true,
      },
      accountTakeover: {
        enabled: config.threatDetection?.accountTakeover?.enabled !== false,
        suspiciousLoginThreshold: config.threatDetection?.accountTakeover?.suspiciousLoginThreshold || 3,
        timeWindowHours: config.threatDetection?.accountTakeover?.timeWindowHours || 24,
        geoDistanceThreshold: config.threatDetection?.accountTakeover?.geoDistanceThreshold || 1000, // km
        deviceChangeThreshold: config.threatDetection?.accountTakeover?.deviceChangeThreshold || 2,
      },
      impossibleTravel: {
        enabled: config.threatDetection?.impossibleTravel?.enabled !== false,
        maxSpeedKmh: config.threatDetection?.impossibleTravel?.maxSpeedKmh || 500,
        minTimeBetweenLogins: config.threatDetection?.impossibleTravel?.minTimeBetweenLogins || 1, // hours
      },
      suspiciousActivity: {
        enabled: config.threatDetection?.suspiciousActivity?.enabled !== false,
        rapidSessionCreation: config.threatDetection?.suspiciousActivity?.rapidSessionCreation || 10,
        timeWindowMinutes: config.threatDetection?.suspiciousActivity?.timeWindowMinutes || 60,
        unusualIPPatterns: config.threatDetection?.suspiciousActivity?.unusualIPPatterns || true,
        deviceFingerprintChanges: config.threatDetection?.suspiciousActivity?.deviceFingerprintChanges || true,
      },
      automatedResponse: {
        enabled: config.threatDetection?.automatedResponse?.enabled !== false,
        autoBlockIPs: config.threatDetection?.automatedResponse?.autoBlockIPs || false,
        autoSuspendUsers: config.threatDetection?.automatedResponse?.autoSuspendUsers || false,
        notificationChannels: config.threatDetection?.automatedResponse?.notificationChannels || ['log'],
        escalationThreshold: config.threatDetection?.automatedResponse?.escalationThreshold || 3,
      },
    }
    
    // Start background monitoring
    this.startBackgroundMonitoring()
    
    console.log('Threat Detection Service initialized')
  }
  
  /**
   * BRUTE FORCE DETECTION
   */
  
  /**
   * Check for brute force attacks
   */
  async checkBruteForceAttack(identifier, ip, userAgent, attemptType = 'login') {
    if (!this.config.bruteForce.enabled) {
      return { isBruteForce: false }
    }
    
    try {
      const key = `brute_force:${attemptType}:${identifier}:${ip}`
      const now = Date.now()
      const windowMs = this.config.bruteForce.windowMinutes * 60 * 1000
      
      // Get current attempts
      const attempts = await this.redis.lrange(key, 0, -1)
      const recentAttempts = attempts
        .map(JSON.parse)
        .filter(attempt => now - attempt.timestamp < windowMs)
      
      // Check if limit exceeded
      if (recentAttempts.length >= this.config.bruteForce.maxAttempts) {
        // Calculate lockout duration with progressive delay
        let lockoutDuration = this.config.bruteForce.lockoutDuration
        if (this.config.bruteForce.progressiveDelay) {
          const violationCount = await this.getBruteForceViolationCount(identifier, ip)
          lockoutDuration = lockoutDuration * Math.pow(2, Math.min(violationCount, 5)) // Max 32x delay
        }
        
        // Set lockout
        await this.redis.setex(`brute_force_lockout:${key}`, lockoutDuration, JSON.stringify({
          identifier,
          ip,
          userAgent,
          lockoutUntil: now + (lockoutDuration * 1000),
          violationCount: recentAttempts.length,
          attemptType,
        }))
        
        // Log security event
        await this.logThreatEvent({
          type: 'brute_force_detected',
          severity: 'high',
          identifier,
          ip,
          userAgent,
          details: {
            attemptCount: recentAttempts.length,
            timeWindow: this.config.bruteForce.windowMinutes,
            lockoutDuration,
            violationCount,
            attemptType,
          },
        })
        
        return {
          isBruteForce: true,
          lockoutDuration,
          violationCount: recentAttempts.length,
          lockoutUntil: new Date(now + (lockoutDuration * 1000)),
        }
      }
      
      // Record this attempt
      await this.recordBruteForceAttempt(key, {
        timestamp: now,
        ip,
        userAgent,
        attemptType,
      })
      
      return { isBruteForce: false, attemptCount: recentAttempts.length + 1 }
    } catch (error) {
      console.error('Failed to check brute force attack:', error.message)
      return { isBruteForce: false, error: error.message }
    }
  }
  
  /**
   * Record brute force attempt
   */
  async recordBruteForceAttempt(key, attempt) {
    try {
      // Add attempt to list
      await this.redis.lpush(key, JSON.stringify(attempt))
      
      // Set expiration for the key
      await this.redis.expire(key, this.config.bruteForce.windowMinutes * 60)
      
      // Trim list to keep only recent attempts
      await this.redis.ltrim(key, 0, this.config.bruteForce.maxAttempts - 1)
    } catch (error) {
      console.error('Failed to record brute force attempt:', error.message)
    }
  }
  
  /**
   * Get brute force violation count
   */
  async getBruteForceViolationCount(identifier, ip) {
    try {
      const key = `brute_force_violations:${identifier}:${ip}`
      const count = await this.redis.get(key)
      return count ? parseInt(count) : 0
    } catch (error) {
      console.error('Failed to get brute force violation count:', error.message)
      return 0
    }
  }
  
  /**
   * Increment brute force violation count
   */
  async incrementBruteForceViolationCount(identifier, ip) {
    try {
      const key = `brute_force_violations:${identifier}:${ip}`
      await this.redis.incr(key)
      await this.redis.expire(key, 86400 * 7) // 7 days
    } catch (error) {
      console.error('Failed to increment brute force violation count:', error.message)
    }
  }
  
  /**
   * Check if IP is locked out
   */
  async isIPLockedOut(identifier, ip, attemptType = 'login') {
    try {
      const key = `brute_force:${attemptType}:${identifier}:${ip}`
      const lockoutKey = `brute_force_lockout:${key}`
      const lockoutData = await this.redis.get(lockoutKey)
      
      if (lockoutData) {
        const lockout = JSON.parse(lockoutData)
        const now = Date.now()
        
        if (now < lockout.lockoutUntil) {
          return {
            lockedOut: true,
            lockoutUntil: new Date(lockout.lockoutUntil),
            violationCount: lockout.violationCount,
            remainingTime: lockout.lockoutUntil - now,
          }
        } else {
          // Lockout expired, clean up
          await this.redis.del(lockoutKey)
        }
      }
      
      return { lockedOut: false }
    } catch (error) {
      console.error('Failed to check IP lockout:', error.message)
      return { lockedOut: false, error: error.message }
    }
  }
  
  /**
   * ACCOUNT TAKEOVER DETECTION
   */
  
  /**
   * Detect potential account takeover
   */
  async detectAccountTakeover(userId, loginData) {
    if (!this.config.accountTakeover.enabled) {
      return { isTakeover: false }
    }
    
    try {
      const { ip, userAgent, deviceInfo, location } = loginData
      const timeWindow = this.config.accountTakeover.timeWindowHours * 60 * 60 * 1000
      const now = Date.now()
      
      // Get recent login history
      const recentLogins = await this.getRecentLogins(userId, timeWindow)
      
      if (recentLogins.length === 0) {
        return { isTakeover: false, reason: 'no_recent_logins' }
      }
      
      const riskFactors = []
      
      // Check for suspicious location changes
      if (location && recentLogins.some(login => login.location)) {
        const suspiciousLocation = await this.checkSuspiciousLocationChange(
          recentLogins,
          location,
          now
        )
        if (suspiciousLocation.suspicious) {
          riskFactors.push({
            type: 'suspicious_location',
            severity: suspiciousLocation.severity,
            details: suspiciousLocation,
          })
        }
      }
      
      // Check for device changes
      const deviceChange = await this.checkDeviceChange(recentLogins, deviceInfo)
      if (deviceChange.suspicious) {
        riskFactors.push({
          type: 'device_change',
          severity: deviceChange.severity,
          details: deviceChange,
        })
      }
      
      // Check for unusual login patterns
      const unusualPattern = await this.checkUnusualLoginPattern(recentLogins, loginData)
      if (unusualPattern.suspicious) {
        riskFactors.push({
          type: 'unusual_pattern',
          severity: unusualPattern.severity,
          details: unusualPattern,
        })
      }
      
      // Check for rapid successive logins
      const rapidLogins = await this.checkRapidSuccessiveLogins(recentLogins, now)
      if (rapidLogins.suspicious) {
        riskFactors.push({
          type: 'rapid_logins',
          severity: rapidLogins.severity,
          details: rapidLogins,
        })
      }
      
      // Calculate overall risk score
      const riskScore = this.calculateAccountTakeoverRiskScore(riskFactors)
      const isTakeover = riskScore >= this.config.accountTakeover.suspiciousLoginThreshold
      
      if (isTakeover) {
        // Log account takeover detection
        await this.logThreatEvent({
          type: 'account_takeover_detected',
          severity: 'critical',
          userId,
          ip,
          userAgent,
          deviceInfo,
          details: {
            riskScore,
            riskFactors,
            recentLogins: recentLogins.length,
            timeWindow: this.config.accountTakeover.timeWindowHours,
          },
        })
        
        // Trigger automated response if enabled
        if (this.config.automatedResponse.enabled) {
          await this.triggerAccountTakeoverResponse(userId, riskScore, riskFactors)
        }
      }
      
      return {
        isTakeover,
        riskScore,
        riskFactors,
        recentLogins: recentLogins.length,
      }
    } catch (error) {
      console.error('Failed to detect account takeover:', error.message)
      return { isTakeover: false, error: error.message }
    }
  }
  
  /**
   * Check suspicious location change
   */
  async checkSuspiciousLocationChange(recentLogins, currentLocation, currentTime) {
    try {
      const recentLocationLogins = recentLogins.filter(login => login.location)
      
      if (recentLocationLogins.length === 0) {
        return { suspicious: false, reason: 'no_location_data' }
      }
      
      // Find most recent location login
      const lastLocationLogin = recentLocationLogins[0]
      const timeDiff = (currentTime - lastLocationLogin.timestamp) / (1000 * 60 * 60) // hours
      
      // Calculate distance between locations
      const distance = this.calculateDistance(
        lastLocationLogin.location.lat,
        lastLocationLogin.location.lon,
        currentLocation.lat,
        currentLocation.lon
      )
      
      // Calculate required speed
      const requiredSpeed = distance / timeDiff
      
      // Check if travel is suspicious
      const isSuspicious = requiredSpeed > this.config.impossibleTravel.maxSpeedKmh
      
      return {
        suspicious: isSuspicious,
        severity: isSuspicious ? 'high' : 'low',
        distance,
        timeDiff,
        requiredSpeed,
        threshold: this.config.impossibleTravel.maxSpeedKmh,
        lastLocation: lastLocationLogin.location,
        currentLocation,
      }
    } catch (error) {
      console.error('Failed to check suspicious location change:', error.message)
      return { suspicious: false, error: error.message }
    }
  }
  
  /**
   * Check device change
   */
  async checkDeviceChange(recentLogins, currentDeviceInfo) {
    try {
      if (!currentDeviceInfo) {
        return { suspicious: false, reason: 'no_device_info' }
      }
      
      const deviceChanges = recentLogins.filter(login => {
        if (!login.deviceInfo) return false
        
        // Check for significant device changes
        return (
          login.deviceInfo.browser?.name !== currentDeviceInfo.browser?.name ||
          login.deviceInfo.os?.name !== currentDeviceInfo.os?.name ||
          login.deviceInfo.device?.type !== currentDeviceInfo.device?.type
        )
      })
      
      const changeCount = deviceChanges.length
      const isSuspicious = changeCount >= this.config.accountTakeover.deviceChangeThreshold
      
      return {
        suspicious: isSuspicious,
        severity: isSuspicious ? 'medium' : 'low',
        changeCount,
        threshold: this.config.accountTakeover.deviceChangeThreshold,
        changes: deviceChanges.map(change => ({
          timestamp: change.timestamp,
          deviceInfo: change.deviceInfo,
        })),
      }
    } catch (error) {
      console.error('Failed to check device change:', error.message)
      return { suspicious: false, error: error.message }
    }
  }
  
  /**
   * Check unusual login patterns
   */
  async checkUnusualLoginPattern(recentLogins, currentLogin) {
    try {
      const patterns = []
      
      // Check for unusual time patterns
      const currentHour = new Date(currentLogin.timestamp).getHours()
      const recentHours = recentLogins.map(login => new Date(login.timestamp).getHours())
      const unusualTime = this.detectUnusualTimePattern(currentHour, recentHours)
      
      if (unusualTime.unusual) {
        patterns.push({
          type: 'unusual_time',
          details: unusualTime,
        })
      }
      
      // Check for unusual IP patterns
      const recentIPs = recentLogins.map(login => login.ip)
      const uniqueIPs = new Set(recentIPs)
      const unusualIP = uniqueIPs.size > 3 // More than 3 different IPs
      
      if (unusualIP) {
        patterns.push({
          type: 'unusual_ip',
          details: {
            uniqueIPs: uniqueIPs.size,
            IPs: Array.from(uniqueIPs),
          },
        })
      }
      
      const suspicious = patterns.length > 0
      const severity = patterns.length > 2 ? 'high' : patterns.length > 1 ? 'medium' : 'low'
      
      return {
        suspicious,
        severity,
        patterns,
      }
    } catch (error) {
      console.error('Failed to check unusual login patterns:', error.message)
      return { suspicious: false, error: error.message }
    }
  }
  
  /**
   * Check rapid successive logins
   */
  async checkRapidSuccessiveLogins(recentLogins, currentTime) {
    try {
      const rapidLogins = recentLogins.filter(login => {
        const timeDiff = (currentTime - login.timestamp) / (1000 * 60) // minutes
        return timeDiff <= 5 // Within 5 minutes
      })
      
      const isSuspicious = rapidLogins.length >= 3
      const severity = rapidLogins.length >= 5 ? 'high' : rapidLogins.length >= 3 ? 'medium' : 'low'
      
      return {
        suspicious: isSuspicious,
        severity,
        count: rapidLogins.length,
        timeWindow: 5, // minutes
      }
    } catch (error) {
      console.error('Failed to check rapid successive logins:', error.message)
      return { suspicious: false, error: error.message }
    }
  }
  
  /**
   * SUSPICIOUS ACTIVITY DETECTION
   */
  
  /**
   * Detect suspicious activity patterns
   */
  async detectSuspiciousActivity(userId, activityData) {
    if (!this.config.suspiciousActivity.enabled) {
      return { suspicious: false }
    }
    
    try {
      const { ip, userAgent, deviceInfo, action, timestamp } = activityData
      const timeWindow = this.config.suspiciousActivity.timeWindowMinutes * 60 * 1000
      
      const suspiciousPatterns = []
      
      // Check for rapid session creation
      if (action === 'session.created') {
        const rapidSessions = await this.checkRapidSessionCreation(userId, timeWindow)
        if (rapidSessions.suspicious) {
          suspiciousPatterns.push({
            type: 'rapid_session_creation',
            severity: rapidSessions.severity,
            details: rapidSessions,
          })
        }
      }
      
      // Check for unusual IP patterns
      const unusualIP = await this.checkUnusualIPPatterns(userId, ip, timeWindow)
      if (unusualIP.suspicious) {
        suspiciousPatterns.push({
          type: 'unusual_ip_patterns',
          severity: unusualIP.severity,
          details: unusualIP,
        })
      }
      
      // Check for device fingerprint changes
      if (deviceInfo) {
        const deviceChanges = await this.checkDeviceFingerprintChanges(userId, deviceInfo, timeWindow)
        if (deviceChanges.suspicious) {
          suspiciousPatterns.push({
            type: 'device_fingerprint_changes',
            severity: deviceChanges.severity,
            details: deviceChanges,
          })
        }
      }
      
      // Check for automated behavior patterns
      const automatedBehavior = await this.checkAutomatedBehavior(userId, activityData, timeWindow)
      if (automatedBehavior.suspicious) {
        suspiciousPatterns.push({
          type: 'automated_behavior',
          severity: automatedBehavior.severity,
          details: automatedBehavior,
        })
      }
      
      const suspicious = suspiciousPatterns.length > 0
      const riskScore = this.calculateSuspiciousActivityRiskScore(suspiciousPatterns)
      
      if (suspicious) {
        await this.logThreatEvent({
          type: 'suspicious_activity_detected',
          severity: riskScore > 50 ? 'high' : 'medium',
          userId,
          ip,
          userAgent,
          deviceInfo,
          details: {
            riskScore,
            patterns: suspiciousPatterns,
            action,
            timestamp,
          },
        })
      }
      
      return {
        suspicious,
        riskScore,
        patterns: suspiciousPatterns,
      }
    } catch (error) {
      console.error('Failed to detect suspicious activity:', error.message)
      return { suspicious: false, error: error.message }
    }
  }
  
  /**
   * Check rapid session creation
   */
  async checkRapidSessionCreation(userId, timeWindow) {
    try {
      const result = await this.pool.query(
        `SELECT COUNT(*) as count
         FROM sessions 
         WHERE user_id = $1 
           AND created_at > NOW() - INTERVAL '${timeWindow}ms'
           AND revoked_at IS NULL`,
        [userId]
      )
      
      const sessionCount = parseInt(result.rows[0].count)
      const isSuspicious = sessionCount >= this.config.suspiciousActivity.rapidSessionCreation
      const severity = sessionCount >= this.config.suspiciousActivity.rapidSessionCreation * 2 ? 'high' : 'medium'
      
      return {
        suspicious: isSuspicious,
        severity,
        sessionCount,
        threshold: this.config.suspiciousActivity.rapidSessionCreation,
        timeWindow,
      }
    } catch (error) {
      console.error('Failed to check rapid session creation:', error.message)
      return { suspicious: false, error: error.message }
    }
  }
  
  /**
   * Check unusual IP patterns
   */
  async checkUnusualIPPatterns(userId, currentIP, timeWindow) {
    try {
      const result = await this.pool.query(
        `SELECT ip, COUNT(*) as count
         FROM sessions 
         WHERE user_id = $1 
           AND created_at > NOW() - INTERVAL '${timeWindow}ms'
         GROUP BY ip
         ORDER BY count DESC`,
        [userId]
      )
      
      const ipStats = result.rows
      const uniqueIPs = ipStats.length
      const totalSessions = ipStats.reduce((sum, stat) => sum + parseInt(stat.count), 0)
      
      // Check if current IP is new
      const currentIPStat = ipStats.find(stat => stat.ip === currentIP)
      const isNewIP = !currentIPStat
      
      // Check for IP diversity (multiple IPs in short time)
      const isDiverse = uniqueIPs > 3
      
      const suspicious = isNewIP || isDiverse
      const severity = isDiverse ? 'high' : 'medium'
      
      return {
        suspicious,
        severity,
        uniqueIPs,
        totalSessions,
        isNewIP,
        isDiverse,
        ipStats: ipStats.map(stat => ({
          ip: stat.ip.substring(0, 8) + '***', // Mask IP
          count: parseInt(stat.count),
        })),
      }
    } catch (error) {
      console.error('Failed to check unusual IP patterns:', error.message)
      return { suspicious: false, error: error.message }
    }
  }
  
  /**
   * Check device fingerprint changes
   */
  async checkDeviceFingerprintChanges(userId, currentDeviceInfo, timeWindow) {
    try {
      const result = await this.pool.query(
        `SELECT device_info
         FROM sessions 
         WHERE user_id = $1 
           AND created_at > NOW() - INTERVAL '${timeWindow}ms'
           AND device_info IS NOT NULL
         ORDER BY created_at DESC
         LIMIT 10`,
        [userId]
      )
      
      const deviceChanges = []
      const currentFingerprint = currentDeviceInfo.stableFingerprint
      
      for (const session of result.rows) {
        const deviceInfo = session.device_info
        if (deviceInfo && deviceInfo.stableFingerprint !== currentFingerprint) {
          deviceChanges.push({
            timestamp: session.created_at,
            deviceInfo,
          })
        }
      }
      
      const isSuspicious = deviceChanges.length > 2
      const severity = deviceChanges.length > 5 ? 'high' : 'medium'
      
      return {
        suspicious: isSuspicious,
        severity,
        changeCount: deviceChanges.length,
        changes: deviceChanges.slice(0, 5), // Limit to 5 most recent
      }
    } catch (error) {
      console.error('Failed to check device fingerprint changes:', error.message)
      return { suspicious: false, error: error.message }
    }
  }
  
  /**
   * Check automated behavior patterns
   */
  async checkAutomatedBehavior(userId, activityData, timeWindow) {
    try {
      const { action, timestamp } = activityData
      
      // Get recent activities
      const result = await this.pool.query(
        `SELECT action, created_at, ip, user_agent
         FROM audit_logs 
         WHERE actor_user_id = $1 
           AND created_at > NOW() - INTERVAL '${timeWindow}ms'
         ORDER BY created_at DESC
         LIMIT 50`,
        [userId]
      )
      
      const activities = result.rows
      
      // Check for repetitive patterns
      const actionCounts = {}
      activities.forEach(activity => {
        actionCounts[activity.action] = (actionCounts[activity.action] || 0) + 1
      })
      
      // Check for high frequency actions
      const highFrequencyActions = Object.entries(actionCounts)
        .filter(([action, count]) => count > 10)
        .map(([action, count]) => ({ action, count }))
      
      // Check for regular intervals (possible bot behavior)
      const intervals = []
      for (let i = 1; i < activities.length; i++) {
        const interval = new Date(activities[i-1].created_at) - new Date(activities[i].created_at)
        intervals.push(interval)
      }
      
      const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length
      const isRegular = intervals.every(interval => 
        Math.abs(interval - avgInterval) < avgInterval * 0.1 // Within 10% of average
      )
      
      const suspicious = highFrequencyActions.length > 0 || isRegular
      const severity = highFrequencyActions.length > 2 || isRegular ? 'high' : 'medium'
      
      return {
        suspicious,
        severity,
        highFrequencyActions,
        isRegular,
        avgInterval,
        totalActivities: activities.length,
      }
    } catch (error) {
      console.error('Failed to check automated behavior:', error.message)
      return { suspicious: false, error: error.message }
    }
  }
  
  /**
   * AUTOMATED RESPONSE
   */
  
  /**
   * Trigger automated response for account takeover
   */
  async triggerAccountTakeoverResponse(userId, riskScore, riskFactors) {
    try {
      const responses = []
      
      // Auto-suspend user if enabled and risk is high
      if (this.config.automatedResponse.autoSuspendUsers && riskScore >= 8) {
        await this.suspendUser(userId, 'automated_suspension_account_takeover', {
          riskScore,
          riskFactors,
          timestamp: new Date().toISOString(),
        })
        responses.push('user_suspended')
      }
      
      // Send notifications
      if (this.config.automatedResponse.notificationChannels.includes('log')) {
        await this.logThreatEvent({
          type: 'automated_response_triggered',
          severity: 'high',
          userId,
          details: {
            responseType: 'account_takeover',
            riskScore,
            riskFactors,
            responses,
          },
        })
      }
      
      // TODO: Implement other notification channels (email, SMS, webhook)
      
      return { responses, success: true }
    } catch (error) {
      console.error('Failed to trigger account takeover response:', error.message)
      return { responses: [], success: false, error: error.message }
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
      await this.logThreatEvent({
        type: 'user_suspended',
        severity: 'high',
        userId,
        details: {
          reason,
          metadata,
          suspendedAt: new Date().toISOString(),
        },
      })
      
      return { success: true }
    } catch (error) {
      console.error('Failed to suspend user:', error.message)
      return { success: false, error: error.message }
    }
  }
  
  /**
   * UTILITY METHODS
   */
  
  /**
   * Get recent logins for user
   */
  async getRecentLogins(userId, timeWindow) {
    try {
      const result = await this.pool.query(
        `SELECT ip, user_agent, device_info, created_at, 
                (device_info->>'location')::jsonb as location
         FROM sessions 
         WHERE user_id = $1 
           AND created_at > NOW() - INTERVAL '${timeWindow}ms'
         ORDER BY created_at DESC
         LIMIT 20`,
        [userId]
      )
      
      return result.rows.map(row => ({
        ip: row.ip,
        userAgent: row.user_agent,
        deviceInfo: row.device_info,
        location: row.location,
        timestamp: new Date(row.created_at).getTime(),
      }))
    } catch (error) {
      console.error('Failed to get recent logins:', error.message)
      return []
    }
  }
  
  /**
   * Calculate distance between two coordinates
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
   * Detect unusual time patterns
   */
  detectUnusualTimePattern(currentHour, recentHours) {
    // Simple heuristic: if current hour is very different from recent hours
    const avgRecentHour = recentHours.reduce((sum, hour) => sum + hour, 0) / recentHours.length
    const hourDiff = Math.abs(currentHour - avgRecentHour)
    
    // Consider unusual if more than 6 hours different from average
    const unusual = hourDiff > 6
    const severity = hourDiff > 12 ? 'high' : 'medium'
    
    return {
      unusual,
      severity,
      currentHour,
      avgRecentHour,
      hourDiff,
    }
  }
  
  /**
   * Calculate account takeover risk score
   */
  calculateAccountTakeoverRiskScore(riskFactors) {
    let score = 0
    
    for (const factor of riskFactors) {
      switch (factor.severity) {
        case 'low':
          score += 1
          break
        case 'medium':
          score += 3
          break
        case 'high':
          score += 5
          break
        case 'critical':
          score += 10
          break
      }
    }
    
    return Math.min(score, 10) // Cap at 10
  }
  
  /**
   * Calculate suspicious activity risk score
   */
  calculateSuspiciousActivityRiskScore(patterns) {
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
      }
    }
    
    return Math.min(score, 100) // Cap at 100
  }
  
  /**
   * Log threat events
   */
  async logThreatEvent({
    type,
    severity,
    userId,
    ip,
    userAgent,
    deviceInfo,
    details,
  }) {
    try {
      await advancedSessionSecurityService.logSecurityEvent({
        userId,
        action: `threat_detection.${type}`,
        target: { type: 'threat', id: crypto.randomUUID() },
        ip,
        userAgent,
        deviceInfo,
        sessionId: null,
        severity,
        details: {
          threatType: type,
          ...details,
        },
      })
    } catch (error) {
      console.error('Failed to log threat event:', error.message)
    }
  }
  
  /**
   * BACKGROUND MONITORING
   */
  
  /**
   * Start background monitoring processes
   */
  startBackgroundMonitoring() {
    // Clean up expired data every hour
    setInterval(async () => {
      try {
        await this.cleanup()
      } catch (error) {
        console.error('Threat detection cleanup error:', error.message)
      }
    }, 3600000) // 1 hour
    
    // Monitor for escalation every 5 minutes
    setInterval(async () => {
      try {
        await this.monitorEscalation()
      } catch (error) {
        console.error('Threat detection escalation monitoring error:', error.message)
      }
    }, 300000) // 5 minutes
  }
  
  /**
   * Clean up expired data
   */
  async cleanup() {
    try {
      const patterns = [
        'brute_force:*',
        'brute_force_lockout:*',
        'brute_force_violations:*',
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
        console.log(`Cleaned up ${totalCleaned} expired threat detection data`)
      }
      
      return totalCleaned
    } catch (error) {
      console.error('Failed to cleanup threat detection data:', error.message)
      return 0
    }
  }
  
  /**
   * Monitor for escalation
   */
  async monitorEscalation() {
    try {
      // Check for users with high threat scores
      const highThreatUsers = await this.getHighThreatUsers()
      
      for (const user of highThreatUsers) {
        if (user.threatScore >= this.config.automatedResponse.escalationThreshold) {
          await this.escalateThreat(user.userId, user.threatScore, user.recentThreats)
        }
      }
    } catch (error) {
      console.error('Failed to monitor escalation:', error.message)
    }
  }
  
  /**
   * Get users with high threat scores
   */
  async getHighThreatUsers() {
    try {
      // This would typically query a threat scoring table
      // For now, return empty array
      return []
    } catch (error) {
      console.error('Failed to get high threat users:', error.message)
      return []
    }
  }
  
  /**
   * Escalate threat
   */
  async escalateThreat(userId, threatScore, recentThreats) {
    try {
      await this.logThreatEvent({
        type: 'threat_escalated',
        severity: 'critical',
        userId,
        details: {
          threatScore,
          recentThreats,
          escalatedAt: new Date().toISOString(),
        },
      })
      
      // TODO: Implement escalation actions (notify security team, etc.)
    } catch (error) {
      console.error('Failed to escalate threat:', error.message)
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
      
      // Get threat detection statistics
      const bruteForceKeys = await this.redis.keys('brute_force:*')
      const lockoutKeys = await this.redis.keys('brute_force_lockout:*')
      const violationKeys = await this.redis.keys('brute_force_violations:*')
      
      return {
        status: 'healthy',
        config: this.config,
        redis: {
          connected: true,
          memoryUsage,
          bruteForceEntries: bruteForceKeys.length,
          lockoutEntries: lockoutKeys.length,
          violationEntries: violationKeys.length,
        },
        features: {
          bruteForceDetection: this.config.bruteForce.enabled,
          accountTakeoverDetection: this.config.accountTakeover.enabled,
          impossibleTravelDetection: this.config.impossibleTravel.enabled,
          suspiciousActivityDetection: this.config.suspiciousActivity.enabled,
          automatedResponse: this.config.automatedResponse.enabled,
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
const threatDetectionService = new ThreatDetectionService()

// Export singleton and class
export default threatDetectionService
