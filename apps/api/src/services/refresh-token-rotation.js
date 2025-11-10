/**
 * Refresh Token Rotation Service
 * 
 * Advanced refresh token management with:
 * - Automatic token rotation on each refresh
 * - Concurrent refresh request protection
 * - Token family tracking for security
 * - Graceful fallback for expired tokens
 * - Client-side token refresh automation
 * - Comprehensive security logging
 */

import crypto from 'crypto'
import Redis from 'ioredis'
import { getPool } from '../database/connection.js'
import jwtService from './jwt.js'
import sessionService from './session.js'
import advancedSessionSecurityService from './advanced-session-security.js'
import config from '../config/index.js'

/**
 * Refresh Token Rotation Service Class
 */
export class RefreshTokenRotationService {
  constructor() {
    this.pool = getPool()
    this.redis = new Redis(config.redis.url, {
      keyPrefix: config.redis.keyPrefix + 'refresh_rotation:',
      retryDelayOnFailover: config.redis.retryDelayOnFailover,
      maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
      lazyConnect: true,
    })
    
    this.redis.on('error', (error) => {
      console.error('Refresh Token Rotation Redis connection error:', error.message)
    })
    
    this.redis.on('connect', () => {
      console.log('Refresh Token Rotation Redis connected successfully')
    })
    
    // Configuration
    this.config = {
      rotationEnabled: config.refreshToken?.rotationEnabled !== false,
      concurrentProtection: config.refreshToken?.concurrentProtection !== false,
      familyTracking: config.refreshToken?.familyTracking !== false,
      gracePeriod: config.refreshToken?.gracePeriod || 300, // 5 minutes
      maxConcurrentRefreshes: config.refreshToken?.maxConcurrentRefreshes || 3,
      familySizeLimit: config.refreshToken?.familySizeLimit || 10,
      rotationWindow: config.refreshToken?.rotationWindow || 1000, // 1 second
    }
    
    console.log('Refresh Token Rotation Service initialized')
  }
  
  /**
   * Refresh tokens with automatic rotation and concurrent protection
   */
  async refreshTokens(refreshToken, requestContext = {}) {
    const startTime = Date.now()
    const { ip, userAgent, deviceInfo } = requestContext
    
    try {
      // Verify refresh token
      const verification = await jwtService.verifyRefreshToken(refreshToken)
      
      if (!verification.payload) {
        throw new Error('Invalid or expired refresh token')
      }
      
      const userId = verification.payload.sub
      const sessionId = verification.payload.session_id
      const refreshJTI = verification.jti
      
      // Check concurrent refresh protection
      if (this.config.concurrentProtection) {
        const concurrentCheck = await this.checkConcurrentRefresh(userId, refreshJTI)
        if (!concurrentCheck.allowed) {
          throw new Error('Concurrent refresh request detected')
        }
      }
      
      // Get session information
      const session = await sessionService.getSessionByRefreshJTI(refreshJTI)
      if (!session || !session.isActive) {
        throw new Error('Session is no longer valid')
      }
      
      // Check token family if enabled
      if (this.config.familyTracking) {
        const familyCheck = await this.checkTokenFamily(sessionId, refreshJTI)
        if (!familyCheck.valid) {
          // Revoke entire token family for security
          await this.revokeTokenFamily(sessionId, 'family_compromise_detected')
          throw new Error('Token family compromised')
        }
      }
      
      // Create new token pair with rotation
      const newTokens = await this.createRotatedTokens({
        userId,
        sessionId,
        previousRefreshJTI: refreshJTI,
        deviceInfo: session.deviceInfo,
        orgId: session.orgId,
        ip,
        userAgent,
      })
      
      // Update session with new refresh token
      await sessionService.updateRefreshJTI(sessionId, newTokens.refreshToken.jti)
      
      // Track token family
      if (this.config.familyTracking) {
        await this.trackTokenFamily(sessionId, refreshJTI, newTokens.refreshToken.jti)
      }
      
      // Log successful refresh
      await this.logRefreshEvent({
        userId,
        sessionId,
        action: 'tokens_refreshed',
        oldRefreshJTI: refreshJTI,
        newRefreshJTI: newTokens.refreshToken.jti,
        ip,
        userAgent,
        deviceInfo,
        duration: Date.now() - startTime,
      })
      
      return {
        success: true,
        tokens: newTokens,
        rotation: {
          rotated: true,
          previousRefreshJTI: refreshJTI,
          newRefreshJTI: newTokens.refreshToken.jti,
        },
      }
    } catch (error) {
      // Log failed refresh attempt
      await this.logRefreshEvent({
        userId: requestContext.userId,
        sessionId: requestContext.sessionId,
        action: 'refresh_failed',
        error: error.message,
        ip,
        userAgent,
        deviceInfo,
        duration: Date.now() - startTime,
      })
      
      throw error
    }
  }
  
  /**
   * Create rotated token pair
   */
  async createRotatedTokens({
    userId,
    sessionId,
    previousRefreshJTI,
    deviceInfo,
    orgId,
    ip,
    userAgent,
  }) {
    try {
      // Get user information
      const user = await this.getUserById(userId)
      if (!user) {
        throw new Error('User not found')
      }
      
      // Create new token pair
      const tokens = await jwtService.createTokenPair({
        userId,
        email: user.email,
        emailVerified: user.emailVerified,
        orgId,
        role: user.role,
        permissions: user.permissions || [],
        sessionId,
        deviceInfo,
      })
      
      // Add rotation metadata to refresh token
      const rotationMetadata = {
        rotated: true,
        previousRefreshJTI,
        rotationTime: new Date().toISOString(),
        rotationReason: 'automatic_rotation',
      }
      
      // Store rotation metadata in session
      await this.storeRotationMetadata(sessionId, rotationMetadata)
      
      return tokens
    } catch (error) {
      console.error('Failed to create rotated tokens:', error.message)
      throw new Error('Token rotation failed')
    }
  }
  
  /**
   * Check for concurrent refresh requests
   */
  async checkConcurrentRefresh(userId, refreshJTI) {
    try {
      const lockKey = `refresh_lock:${userId}:${refreshJTI}`
      const lockValue = crypto.randomUUID()
      const lockTTL = this.config.rotationWindow / 1000 // Convert to seconds
      
      // Try to acquire lock
      const acquired = await this.redis.set(lockKey, lockValue, 'PX', this.config.rotationWindow, 'NX')
      
      if (!acquired) {
        // Lock already exists - concurrent request detected
        return {
          allowed: false,
          reason: 'concurrent_refresh_detected',
          lockKey,
        }
      }
      
      // Store lock info for cleanup
      await this.redis.setex(`refresh_lock_info:${lockKey}`, lockTTL, JSON.stringify({
        userId,
        refreshJTI,
        acquiredAt: new Date().toISOString(),
        lockValue,
      }))
      
      return {
        allowed: true,
        lockKey,
        lockValue,
      }
    } catch (error) {
      console.error('Failed to check concurrent refresh:', error.message)
      // Fail secure - allow refresh but log the error
      return { allowed: true, error: error.message }
    }
  }
  
  /**
   * Release refresh lock
   */
  async releaseRefreshLock(lockKey, lockValue) {
    try {
      // Use Lua script for atomic check-and-delete
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `
      
      await this.redis.eval(script, 1, lockKey, lockValue)
      
      // Also clean up lock info
      await this.redis.del(`refresh_lock_info:${lockKey}`)
    } catch (error) {
      console.error('Failed to release refresh lock:', error.message)
    }
  }
  
  /**
   * Check token family validity
   */
  async checkTokenFamily(sessionId, refreshJTI) {
    try {
      const familyKey = `token_family:${sessionId}`
      const familyData = await this.redis.get(familyKey)
      
      if (!familyData) {
        // No family data - create new family
        await this.redis.setex(familyKey, 2592000, JSON.stringify({ // 30 days
          tokens: [refreshJTI],
          created: new Date().toISOString(),
          lastUsed: new Date().toISOString(),
        }))
        return { valid: true, isNewFamily: true }
      }
      
      const family = JSON.parse(familyData)
      
      // Check if current token is in family
      if (!family.tokens.includes(refreshJTI)) {
        return {
          valid: false,
          reason: 'token_not_in_family',
          familySize: family.tokens.length,
        }
      }
      
      // Check family size limit
      if (family.tokens.length > this.config.familySizeLimit) {
        return {
          valid: false,
          reason: 'family_size_exceeded',
          familySize: family.tokens.length,
          limit: this.config.familySizeLimit,
        }
      }
      
      return { valid: true, familySize: family.tokens.length }
    } catch (error) {
      console.error('Failed to check token family:', error.message)
      // Fail secure - allow refresh but log the error
      return { valid: true, error: error.message }
    }
  }
  
  /**
   * Track token family
   */
  async trackTokenFamily(sessionId, oldRefreshJTI, newRefreshJTI) {
    try {
      const familyKey = `token_family:${sessionId}`
      const familyData = await this.redis.get(familyKey)
      
      if (familyData) {
        const family = JSON.parse(familyData)
        
        // Add new token to family
        family.tokens.push(newRefreshJTI)
        family.lastUsed = new Date().toISOString()
        
        // Remove old token if it exists
        const oldIndex = family.tokens.indexOf(oldRefreshJTI)
        if (oldIndex > -1) {
          family.tokens.splice(oldIndex, 1)
        }
        
        // Update family data
        await this.redis.setex(familyKey, 2592000, JSON.stringify(family))
      } else {
        // Create new family
        await this.redis.setex(familyKey, 2592000, JSON.stringify({
          tokens: [newRefreshJTI],
          created: new Date().toISOString(),
          lastUsed: new Date().toISOString(),
        }))
      }
    } catch (error) {
      console.error('Failed to track token family:', error.message)
    }
  }
  
  /**
   * Revoke entire token family
   */
  async revokeTokenFamily(sessionId, reason) {
    try {
      const familyKey = `token_family:${sessionId}`
      const familyData = await this.redis.get(familyKey)
      
      if (familyData) {
        const family = JSON.parse(familyData)
        
        // Revoke all tokens in family
        for (const tokenJTI of family.tokens) {
          await advancedSessionSecurityService.blacklistJTI(tokenJTI, reason, {
            familyRevocation: true,
            sessionId,
            familySize: family.tokens.length,
          })
        }
        
        // Remove family data
        await this.redis.del(familyKey)
        
        // Log family revocation
        await this.logRefreshEvent({
          userId: null,
          sessionId,
          action: 'token_family_revoked',
          reason,
          familySize: family.tokens.length,
          tokens: family.tokens,
        })
      }
    } catch (error) {
      console.error('Failed to revoke token family:', error.message)
    }
  }
  
  /**
   * Store rotation metadata
   */
  async storeRotationMetadata(sessionId, metadata) {
    try {
      const key = `rotation_metadata:${sessionId}`
      await this.redis.setex(key, 86400, JSON.stringify(metadata)) // 24 hours
    } catch (error) {
      console.error('Failed to store rotation metadata:', error.message)
    }
  }
  
  /**
   * Get rotation metadata
   */
  async getRotationMetadata(sessionId) {
    try {
      const key = `rotation_metadata:${sessionId}`
      const data = await this.redis.get(key)
      return data ? JSON.parse(data) : null
    } catch (error) {
      console.error('Failed to get rotation metadata:', error.message)
      return null
    }
  }
  
  /**
   * Handle graceful token expiration
   */
  async handleTokenExpiration(refreshToken, requestContext = {}) {
    try {
      // Check if token is in grace period
      const verification = await jwtService.verifyRefreshToken(refreshToken, { ignoreExpiration: true })
      
      if (!verification.payload) {
        throw new Error('Invalid refresh token')
      }
      
      const now = Math.floor(Date.now() / 1000)
      const exp = verification.payload.exp
      const timeSinceExpiration = now - exp
      
      // Check if within grace period
      if (timeSinceExpiration <= this.config.gracePeriod) {
        // Allow refresh within grace period
        return await this.refreshTokens(refreshToken, requestContext)
      } else {
        throw new Error('Token expired beyond grace period')
      }
    } catch (error) {
      console.error('Failed to handle token expiration:', error.message)
      throw error
    }
  }
  
  /**
   * Get user by ID
   */
  async getUserById(userId) {
    try {
      const result = await this.pool.query(
        'SELECT * FROM users WHERE id = $1 AND status != $2',
        [userId, 'deleted']
      )
      
      if (result.rows.length === 0) {
        return null
      }
      
      const user = result.rows[0]
      
      return {
        id: user.id,
        email: user.email,
        emailVerified: user.email_verified,
        status: user.status,
        role: user.role,
        permissions: user.permissions || [],
        metadata: user.metadata,
      }
    } catch (error) {
      console.error('Failed to get user by ID:', error.message)
      return null
    }
  }
  
  /**
   * Log refresh events
   */
  async logRefreshEvent({
    userId,
    sessionId,
    action,
    oldRefreshJTI,
    newRefreshJTI,
    error,
    ip,
    userAgent,
    deviceInfo,
    duration,
    reason,
    familySize,
    tokens,
  }) {
    try {
      await advancedSessionSecurityService.logSecurityEvent({
        userId,
        action: `refresh_token.${action}`,
        target: { type: 'refresh_token', id: newRefreshJTI || oldRefreshJTI },
        ip,
        userAgent,
        deviceInfo,
        sessionId,
        severity: error ? 'warning' : 'info',
        details: {
          oldRefreshJTI,
          newRefreshJTI,
          error,
          duration,
          reason,
          familySize,
          tokens,
          rotationEnabled: this.config.rotationEnabled,
          concurrentProtection: this.config.concurrentProtection,
        },
      })
    } catch (error) {
      console.error('Failed to log refresh event:', error.message)
    }
  }
  
  /**
   * Clean up expired locks and metadata
   */
  async cleanup() {
    try {
      const patterns = [
        'refresh_lock:*',
        'refresh_lock_info:*',
        'rotation_metadata:*',
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
        console.log(`Cleaned up ${totalCleaned} expired refresh token rotation data`)
      }
      
      return totalCleaned
    } catch (error) {
      console.error('Failed to cleanup refresh token rotation data:', error.message)
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
      
      // Get rotation statistics
      const lockKeys = await this.redis.keys('refresh_lock:*')
      const familyKeys = await this.redis.keys('token_family:*')
      const metadataKeys = await this.redis.keys('rotation_metadata:*')
      
      return {
        status: 'healthy',
        config: this.config,
        redis: {
          connected: true,
          memoryUsage,
          activeLocks: lockKeys.length,
          tokenFamilies: familyKeys.length,
          metadataEntries: metadataKeys.length,
        },
        features: {
          rotationEnabled: this.config.rotationEnabled,
          concurrentProtection: this.config.concurrentProtection,
          familyTracking: this.config.familyTracking,
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
const refreshTokenRotationService = new RefreshTokenRotationService()

// Export singleton and class
export default refreshTokenRotationService
