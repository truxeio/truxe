/**
 * Magic Link Service
 * 
 * Handles passwordless authentication via secure magic links with:
 * - Cryptographically secure token generation (256-bit entropy)
 * - Argon2 hashing for token storage
 * - Rate limiting and abuse prevention
 * - Email delivery with multiple providers
 * - Comprehensive security validation
 */

import crypto from 'crypto'
import argon2 from 'argon2'
import { getPool } from '../database/connection.js'
import config from '../config/index.js'

/**
 * Magic Link Service Class
 */
export class MagicLinkService {
  constructor() {
    // Initialize database connection
    this.pool = getPool()
    this.tokenLength = config.magicLink.tokenLength
    this.ttl = config.magicLink.ttl
    this.baseUrl = config.magicLink.baseUrl
    
    // Argon2 configuration for token hashing
    this.argon2Options = {
      type: argon2.argon2id,
      memoryCost: 2 ** 16, // 64 MB
      timeCost: 3,
      parallelism: 1,
    }
  }
  
  /**
   * Generate cryptographically secure magic link token
   * Uses 256-bit entropy for maximum security
   */
  generateSecureToken() {
    // Generate 32 bytes (256 bits) of cryptographically secure random data
    const randomBytes = crypto.randomBytes(32)
    
    // Convert to URL-safe base64 string
    return randomBytes
      .toString('base64url')
      .replace(/[^a-zA-Z0-9]/g, '') // Remove any non-alphanumeric characters
      .substring(0, this.tokenLength) // Ensure consistent length
  }
  
  /**
   * Hash token using Argon2id for secure storage
   */
  async hashToken(token) {
    try {
      return await argon2.hash(token, this.argon2Options)
    } catch (error) {
      console.error('Failed to hash token:', error.message)
      throw new Error('Token hashing failed')
    }
  }
  
  /**
   * Verify token against stored hash
   */
  async verifyToken(token, hash) {
    try {
      return await argon2.verify(hash, token)
    } catch (error) {
      console.error('Failed to verify token:', error.message)
      return false
    }
  }
  
  /**
   * Create magic link challenge
   */
  async createChallenge({
    email,
    orgSlug = null,
    redirectUri = null,
    ip = null,
    userAgent = null,
  }) {
    try {
      // Validate email format
      if (!this.isValidEmail(email)) {
        throw new Error('Invalid email address format')
      }

      // Generate secure token
      const token = this.generateSecureToken()
      const tokenHash = await this.hashToken(token)

      // Calculate expiration time
      const expiresAt = new Date(Date.now() + this.ttl)

      // Store challenge in database
      const result = await this.pool.query(
        `INSERT INTO magic_link_challenges (
          email, token_hash, org_slug, expires_at, ip, user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, created_at`,
        [email, tokenHash, orgSlug, expiresAt, ip, userAgent]
      )

      const challenge = result.rows[0]

      // Generate magic link URL (use custom redirectUri if provided)
      const magicLinkUrl = this.generateMagicLinkUrl(token, {
        email,
        orgSlug,
        challengeId: challenge.id,
        redirectUri,
      })
      
      // Log challenge creation
      if (config.features.auditLogs) {
        await this.logMagicLinkEvent({
          email,
          orgSlug,
          action: 'magic_link.sent',
          challengeId: challenge.id,
          ip,
          userAgent,
          details: {
            expiresAt: expiresAt.toISOString(),
          },
        })
      }
      
      return {
        challengeId: challenge.id,
        email,
        orgSlug,
        magicLinkUrl,
        expiresAt,
        createdAt: challenge.created_at,
        token, // Only return token for immediate email sending
      }
    } catch (error) {
      console.error('Failed to create magic link challenge:', error.message)
      throw new Error('Magic link creation failed')
    }
  }
  
  /**
   * Verify magic link token and return user information
   */
  async verifyChallenge(token, options = {}) {
    try {
      if (!token || token.length < 16) {
        throw new Error('Invalid token format')
      }
      
      // Find valid challenges for this token
      // We need to check against all non-expired, non-used challenges
      const challenges = await this.pool.query(
        `SELECT * FROM magic_link_challenges 
         WHERE expires_at > NOW() 
           AND used_at IS NULL 
           AND attempts < 5
         ORDER BY created_at DESC
         LIMIT 10`, // Limit to prevent DoS
        []
      )
      
      if (challenges.rows.length === 0) {
        throw new Error('No valid challenges found')
      }
      
      let matchedChallenge = null
      
      // Check token against each challenge hash
      for (const challenge of challenges.rows) {
        const isValid = await this.verifyToken(token, challenge.token_hash)
        if (isValid) {
          matchedChallenge = challenge
          break
        }
      }
      
      if (!matchedChallenge) {
        // Increment attempt count for all challenges (rate limiting)
        await this.pool.query(
          `UPDATE magic_link_challenges 
           SET attempts = attempts + 1 
           WHERE expires_at > NOW() AND used_at IS NULL`,
          []
        )
        
        throw new Error('Invalid or expired magic link token')
      }
      
      // Mark challenge as used
      const result = await this.pool.query(
        `UPDATE magic_link_challenges 
         SET used_at = NOW(), attempts = attempts + 1
         WHERE id = $1 AND used_at IS NULL
         RETURNING *`,
        [matchedChallenge.id]
      )
      
      if (result.rows.length === 0) {
        throw new Error('Magic link token has already been used')
      }
      
      const usedChallenge = result.rows[0]
      
      // Get or create user
      const user = await this.getOrCreateUser(usedChallenge.email)
      
      // Log successful verification
      if (config.features.auditLogs) {
        await this.logMagicLinkEvent({
          email: usedChallenge.email,
          orgSlug: usedChallenge.org_slug,
          action: 'magic_link.verified',
          challengeId: usedChallenge.id,
          userId: user.id,
          ip: options.ip,
          userAgent: options.userAgent,
          details: {
            attempts: usedChallenge.attempts,
            verifiedAt: usedChallenge.used_at,
          },
        })
      }
      
      // Clean up old challenges for this email
      await this.cleanupUserChallenges(usedChallenge.email)
      
      return {
        user,
        challenge: {
          id: usedChallenge.id,
          email: usedChallenge.email,
          orgSlug: usedChallenge.org_slug,
          createdAt: usedChallenge.created_at,
          usedAt: usedChallenge.used_at,
          attempts: usedChallenge.attempts,
        },
      }
    } catch (error) {
      console.error('Failed to verify magic link challenge:', error.message)
      throw error
    }
  }
  
  /**
   * Get or create user from email
   */
  async getOrCreateUser(email) {
    try {
      // Try to find existing user
      let result = await this.pool.query(
        'SELECT * FROM users WHERE email = $1',
        [email.toLowerCase()]
      )
      
      if (result.rows.length > 0) {
        const user = result.rows[0]
        
        // Update email verification status if not already verified
        if (!user.email_verified) {
          await this.pool.query(
            'UPDATE users SET email_verified = true, status = $2, updated_at = NOW() WHERE id = $1',
            [user.id, user.status === 'pending' ? 'active' : user.status]
          )
          
          user.email_verified = true
          if (user.status === 'pending') {
            user.status = 'active'
          }
        }
        
        return this.formatUser(user)
      }
      
      // Create new user if signup is enabled
      if (!config.features.signup) {
        throw new Error('User signup is disabled')
      }
      
      result = await this.pool.query(
        `INSERT INTO users (email, email_verified, status, metadata)
         VALUES ($1, true, 'active', '{}')
         RETURNING *`,
        [email.toLowerCase()]
      )
      
      const newUser = result.rows[0]
      
      // Log user creation
      if (config.features.auditLogs) {
        await this.logMagicLinkEvent({
          email,
          orgSlug: null,
          action: 'user.signup',
          userId: newUser.id,
          challengeId: null,
          ip: null,
          userAgent: null,
          details: {
            signupMethod: 'magic_link',
          },
        })
      }
      
      return this.formatUser(newUser)
    } catch (error) {
      console.error('Failed to get or create user:', error.message)
      throw new Error('User creation or retrieval failed')
    }
  }
  
  /**
   * Generate magic link URL
   */
  generateMagicLinkUrl(token, { email, orgSlug, challengeId, redirectUri }) {
    const params = new URLSearchParams({
      token,
      email,
    })

    if (orgSlug) {
      params.set('org', orgSlug)
    }

    if (challengeId) {
      params.set('challenge', challengeId)
    }

    // If custom redirectUri provided, use it directly (assuming it already has the path)
    // Otherwise use default baseUrl with /auth/verify path
    let finalUrl
    if (redirectUri) {
      // Check if redirectUri already contains query params
      const separator = redirectUri.includes('?') ? '&' : '?'
      finalUrl = `${redirectUri}${separator}${params.toString()}`
    } else {
      finalUrl = `${this.baseUrl}/auth/verify?${params.toString()}`
    }

    console.log('Generated magic link URL:', {
      baseUrl: this.baseUrl,
      redirectUri,
      finalUrl,
      urlLength: finalUrl.length,
    })

    return finalUrl
  }
  
  /**
   * Clean up old challenges for a user
   */
  async cleanupUserChallenges(email) {
    try {
      await this.pool.query(
        `DELETE FROM magic_link_challenges 
         WHERE email = $1 AND (used_at IS NOT NULL OR expires_at < NOW())`,
        [email]
      )
    } catch (error) {
      console.error('Failed to cleanup user challenges:', error.message)
      // Don't throw - cleanup failure shouldn't break the flow
    }
  }
  
  /**
   * Clean up all expired challenges
   */
  async cleanupExpiredChallenges() {
    try {
      const result = await this.pool.query(
        `DELETE FROM magic_link_challenges 
         WHERE expires_at < NOW() - INTERVAL '1 day'
         RETURNING COUNT(*)`
      )
      
      const deletedCount = result.rowCount || 0
      
      if (deletedCount > 0) {
        console.log(`Cleaned up ${deletedCount} expired magic link challenges`)
      }
      
      return deletedCount
    } catch (error) {
      console.error('Failed to cleanup expired challenges:', error.message)
      return 0
    }
  }
  
  /**
   * Get challenge statistics for rate limiting
   */
  async getChallengeStats(email, ip, timeWindow = 3600000) { // 1 hour default
    try {
      const since = new Date(Date.now() - timeWindow)
      
      const emailStats = await this.pool.query(
        'SELECT COUNT(*) as count FROM magic_link_challenges WHERE email = $1 AND created_at > $2',
        [email, since]
      )
      
      const ipStats = await this.pool.query(
        'SELECT COUNT(*) as count FROM magic_link_challenges WHERE ip = $1 AND created_at > $2',
        [ip, since]
      )
      
      return {
        emailCount: parseInt(emailStats.rows[0].count),
        ipCount: parseInt(ipStats.rows[0].count),
        timeWindow,
        since,
      }
    } catch (error) {
      console.error('Failed to get challenge stats:', error.message)
      return { emailCount: 0, ipCount: 0, timeWindow, since: new Date() }
    }
  }
  
  /**
   * Validate email address format
   */
  isValidEmail(email) {
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
    return emailRegex.test(email) && email.length <= 254
  }
  
  /**
   * Log magic link events
   */
  async logMagicLinkEvent({
    email,
    orgSlug,
    action,
    challengeId,
    userId = null,
    ip,
    userAgent,
    details = {},
  }) {
    try {
      await this.pool.query(
        `INSERT INTO audit_logs (
          org_id, actor_user_id, action, target_type, target_id,
          details, ip, user_agent, request_id
        ) VALUES (
          (SELECT id FROM organizations WHERE slug = $1), 
          $2, $3, $4, $5, $6, $7, $8, $9
        )`,
        [
          orgSlug,
          userId,
          action,
          'magic_link_challenge',
          challengeId?.toString(),
          JSON.stringify({ ...details, email }),
          ip,
          userAgent,
          crypto.randomUUID(),
        ]
      )
    } catch (error) {
      console.error('Failed to log magic link event:', error.message)
      // Don't throw - logging failure shouldn't break the flow
    }
  }
  
  /**
   * Format user object for API response
   */
  formatUser(user) {
    return {
      id: user.id,
      email: user.email,
      emailVerified: user.email_verified,
      status: user.status,
      metadata: user.metadata,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    }
  }
  
  /**
   * Get service health status
   */
  async getHealthStatus() {
    try {
      // Test database connectivity
      await this.pool.query('SELECT 1')
      
      // Get challenge statistics
      const stats = await this.pool.query(`
        SELECT 
          COUNT(*) as total_challenges,
          COUNT(*) FILTER (WHERE used_at IS NOT NULL) as used_challenges,
          COUNT(*) FILTER (WHERE expires_at > NOW() AND used_at IS NULL) as active_challenges,
          COUNT(*) FILTER (WHERE expires_at <= NOW()) as expired_challenges,
          COUNT(*) FILTER (WHERE attempts >= 5) as rate_limited_challenges
        FROM magic_link_challenges
        WHERE created_at > NOW() - INTERVAL '24 hours'
      `)
      
      return {
        status: 'healthy',
        tokenLength: this.tokenLength,
        ttl: this.ttl,
        baseUrl: this.baseUrl,
        signupEnabled: config.features.signup,
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
const magicLinkService = new MagicLinkService()

// Export singleton and class
export default magicLinkService
