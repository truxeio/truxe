/**
 * Client-Side Token Refresh Handler
 * 
 * Automated client-side token refresh with:
 * - Automatic token refresh before expiration
 * - Concurrent refresh request protection
 * - Graceful fallback for expired tokens
 * - Retry logic with exponential backoff
 * - Security event logging
 */

import refreshTokenRotationService from './refresh-token-rotation.js'
import threatDetectionService from './threat-detection.js'
import securityIncidentResponseService from './security-incident-response.js'
import config from '../config/index.js'

/**
 * Client Token Refresh Handler Class
 */
export class ClientTokenRefreshHandler {
  constructor() {
    this.refreshPromises = new Map() // Track ongoing refresh requests
    this.refreshQueue = new Map() // Queue for concurrent requests
    this.retryAttempts = new Map() // Track retry attempts per session
    this.lastRefreshTime = new Map() // Track last refresh time per session
    
    // Configuration
    this.config = {
      refreshThreshold: config.clientTokenRefresh?.refreshThreshold || 300, // 5 minutes
      maxRetries: config.clientTokenRefresh?.maxRetries || 3,
      retryDelay: config.clientTokenRefresh?.retryDelay || 1000, // 1 second
      maxRetryDelay: config.clientTokenRefresh?.maxRetryDelay || 30000, // 30 seconds
      concurrentProtection: config.clientTokenRefresh?.concurrentProtection !== false,
      exponentialBackoff: config.clientTokenRefresh?.exponentialBackoff !== false,
    }
    
    console.log('Client Token Refresh Handler initialized')
  }
  
  /**
   * Handle automatic token refresh for a client
   */
  async handleTokenRefresh(sessionId, refreshToken, requestContext = {}) {
    try {
      // Check if refresh is already in progress
      if (this.config.concurrentProtection && this.refreshPromises.has(sessionId)) {
        return await this.handleConcurrentRefresh(sessionId)
      }
      
      // Check if token needs refresh
      const needsRefresh = await this.shouldRefreshToken(refreshToken)
      if (!needsRefresh) {
        return { success: true, refreshed: false, reason: 'not_needed' }
      }
      
      // Check retry limits
      const retryCount = this.retryAttempts.get(sessionId) || 0
      if (retryCount >= this.config.maxRetries) {
        return { success: false, error: 'max_retries_exceeded', retryCount }
      }
      
      // Perform refresh
      const refreshPromise = this.performRefresh(sessionId, refreshToken, requestContext)
      
      if (this.config.concurrentProtection) {
        this.refreshPromises.set(sessionId, refreshPromise)
      }
      
      try {
        const result = await refreshPromise
        return result
      } finally {
        if (this.config.concurrentProtection) {
          this.refreshPromises.delete(sessionId)
        }
      }
    } catch (error) {
      console.error('Client token refresh failed:', error.message)
      
      // Increment retry count
      const retryCount = (this.retryAttempts.get(sessionId) || 0) + 1
      this.retryAttempts.set(sessionId, retryCount)
      
      // Schedule retry if within limits
      if (retryCount < this.config.maxRetries) {
        const delay = this.calculateRetryDelay(retryCount)
        setTimeout(() => {
          this.handleTokenRefresh(sessionId, refreshToken, requestContext)
        }, delay)
      }
      
      return { success: false, error: error.message, retryCount }
    }
  }
  
  /**
   * Handle concurrent refresh requests
   */
  async handleConcurrentRefresh(sessionId) {
    try {
      // Wait for the ongoing refresh to complete
      const ongoingRefresh = this.refreshPromises.get(sessionId)
      if (ongoingRefresh) {
        return await ongoingRefresh
      }
      
      // If no ongoing refresh, something went wrong
      return { success: false, error: 'concurrent_refresh_failed' }
    } catch (error) {
      console.error('Concurrent refresh handling failed:', error.message)
      return { success: false, error: error.message }
    }
  }
  
  /**
   * Check if token needs refresh
   */
  async shouldRefreshToken(refreshToken) {
    try {
      // Import JWT service to check expiration
      const jwtService = (await import('./jwt.js')).default
      
      const expiration = jwtService.getTokenExpiration(refreshToken)
      if (!expiration) {
        return true // If we can't determine expiration, refresh to be safe
      }
      
      // Check if token is expired
      if (expiration.isExpired) {
        return true
      }
      
      // Check if token is within refresh threshold
      const timeToExpiration = expiration.timeToExpirationSeconds
      return timeToExpiration <= this.config.refreshThreshold
    } catch (error) {
      console.error('Failed to check token expiration:', error.message)
      return true // Refresh to be safe
    }
  }
  
  /**
   * Perform the actual token refresh
   */
  async performRefresh(sessionId, refreshToken, requestContext) {
    try {
      const { ip, userAgent, deviceInfo } = requestContext
      
      // Check for brute force attacks
      const bruteForceCheck = await threatDetectionService.checkBruteForceAttack(
        `client_refresh:${sessionId}`,
        ip,
        userAgent,
        'client_refresh'
      )
      
      if (bruteForceCheck.isBruteForce) {
        throw new Error('Client refresh rate limited')
      }
      
      // Use refresh token rotation service
      const refreshResult = await refreshTokenRotationService.refreshTokens(refreshToken, {
        ip,
        userAgent,
        deviceInfo,
        sessionId,
        userId: null, // Will be determined by the service
      })
      
      if (!refreshResult.success) {
        throw new Error('Token refresh failed')
      }
      
      // Reset retry count on successful refresh
      this.retryAttempts.delete(sessionId)
      this.lastRefreshTime.set(sessionId, Date.now())
      
      // Log successful refresh
      await this.logRefreshEvent({
        sessionId,
        action: 'client_token_refreshed',
        success: true,
        ip,
        userAgent,
        deviceInfo,
        details: {
          rotated: refreshResult.rotation.rotated,
          previousJTI: refreshResult.rotation.previousRefreshJTI,
          newJTI: refreshResult.rotation.newRefreshJTI,
        },
      })
      
      return {
        success: true,
        refreshed: true,
        tokens: refreshResult.tokens,
        rotation: refreshResult.rotation,
      }
    } catch (error) {
      // Log failed refresh
      await this.logRefreshEvent({
        sessionId,
        action: 'client_token_refresh_failed',
        success: false,
        error: error.message,
        ip: requestContext.ip,
        userAgent: requestContext.userAgent,
        deviceInfo: requestContext.deviceInfo,
      })
      
      throw error
    }
  }
  
  /**
   * Calculate retry delay with exponential backoff
   */
  calculateRetryDelay(retryCount) {
    if (!this.config.exponentialBackoff) {
      return this.config.retryDelay
    }
    
    const delay = this.config.retryDelay * Math.pow(2, retryCount - 1)
    return Math.min(delay, this.config.maxRetryDelay)
  }
  
  /**
   * Handle graceful token expiration
   */
  async handleTokenExpiration(sessionId, refreshToken, requestContext) {
    try {
      // Try to refresh with grace period
      const refreshResult = await refreshTokenRotationService.handleTokenExpiration(
        refreshToken,
        requestContext
      )
      
      if (refreshResult.success) {
        // Reset retry count on successful refresh
        this.retryAttempts.delete(sessionId)
        this.lastRefreshTime.set(sessionId, Date.now())
        
        return {
          success: true,
          refreshed: true,
          tokens: refreshResult.tokens,
          rotation: refreshResult.rotation,
          gracePeriod: true,
        }
      }
      
      return { success: false, error: 'Token expired beyond grace period' }
    } catch (error) {
      console.error('Graceful token expiration handling failed:', error.message)
      return { success: false, error: error.message }
    }
  }
  
  /**
   * Get refresh status for a session
   */
  getRefreshStatus(sessionId) {
    const isRefreshing = this.refreshPromises.has(sessionId)
    const retryCount = this.retryAttempts.get(sessionId) || 0
    const lastRefresh = this.lastRefreshTime.get(sessionId)
    
    return {
      isRefreshing,
      retryCount,
      lastRefresh: lastRefresh ? new Date(lastRefresh) : null,
      maxRetries: this.config.maxRetries,
    }
  }
  
  /**
   * Clear refresh state for a session
   */
  clearRefreshState(sessionId) {
    this.refreshPromises.delete(sessionId)
    this.refreshQueue.delete(sessionId)
    this.retryAttempts.delete(sessionId)
    this.lastRefreshTime.delete(sessionId)
  }
  
  /**
   * Log refresh events
   */
  async logRefreshEvent({
    sessionId,
    action,
    success,
    error,
    ip,
    userAgent,
    deviceInfo,
    details,
  }) {
    try {
      await securityIncidentResponseService.processIncident({
        type: 'client_token_refresh',
        source: 'client_handler',
        sessionId,
        ip,
        userAgent,
        deviceInfo,
        details: {
          action,
          success,
          error,
          timestamp: new Date().toISOString(),
          ...details,
        },
      })
    } catch (error) {
      console.error('Failed to log refresh event:', error.message)
    }
  }
  
  /**
   * Get handler health status
   */
  getHealthStatus() {
    return {
      status: 'healthy',
      config: this.config,
      activeRefreshes: this.refreshPromises.size,
      queuedRefreshes: this.refreshQueue.size,
      sessionsWithRetries: this.retryAttempts.size,
      sessionsWithLastRefresh: this.lastRefreshTime.size,
    }
  }
  
  /**
   * Clean up expired data
   */
  cleanup() {
    const now = Date.now()
    const maxAge = 24 * 60 * 60 * 1000 // 24 hours
    
    // Clean up old retry attempts
    for (const [sessionId, retryCount] of this.retryAttempts.entries()) {
      const lastRefresh = this.lastRefreshTime.get(sessionId)
      if (lastRefresh && now - lastRefresh > maxAge) {
        this.retryAttempts.delete(sessionId)
        this.lastRefreshTime.delete(sessionId)
      }
    }
    
    // Clean up old refresh times
    for (const [sessionId, lastRefresh] of this.lastRefreshTime.entries()) {
      if (now - lastRefresh > maxAge) {
        this.lastRefreshTime.delete(sessionId)
      }
    }
  }
}

// Create singleton instance
const clientTokenRefreshHandler = new ClientTokenRefreshHandler()

// Export singleton and class
export default clientTokenRefreshHandler
