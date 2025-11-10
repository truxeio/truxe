/**
 * Email Verification Service
 *
 * Responsibilities:
 * - Secure token generation (256-bit entropy) and SHA-256 hashing for storage
 * - Persisting verification tokens with 24 hour expiry and metadata
 * - Validating raw tokens against stored hashes with single-use enforcement
 * - Tracking email verification status and marking users as verified
 * - Resend rate limiting (5 minute cooldown between sends)
 * - Cleaning up expired or fully consumed verification tokens
 */

import crypto from 'crypto'
import { getPool } from '../database/connection.js'

const TOKEN_BYTE_LENGTH = 32
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
const RESEND_COOLDOWN_MS = 5 * 60 * 1000 // 5 minutes

const emailServiceDefault = null

/**
 * Normalize constructor arguments to support both positional (pool, emailService)
 * and options object signatures without complicating consumers.
 */
function resolveConstructorArgs(poolOrOptions, maybeEmailService) {
  // Direct pool instance (typically pg.Pool mock or real pool)
  if (poolOrOptions && typeof poolOrOptions.query === 'function') {
    return {
      pool: poolOrOptions,
      emailService: maybeEmailService || emailServiceDefault,
    }
  }

  // Options object with overrides
  if (poolOrOptions && typeof poolOrOptions === 'object') {
    return {
      pool: poolOrOptions.pool || getPool(),
      emailService: poolOrOptions.emailService || maybeEmailService || emailServiceDefault,
    }
  }

  // Default constructor usage (no args or undefined values)
  return {
    pool: getPool(),
    emailService: maybeEmailService || emailServiceDefault,
  }
}

export class EmailVerificationService {
  constructor(poolOrOptions, maybeEmailService) {
    const { pool, emailService } = resolveConstructorArgs(poolOrOptions, maybeEmailService)
    this.pool = pool
    this.emailService = emailService
    this.tokenTTL = TOKEN_TTL_MS
    this.resendCooldownMs = RESEND_COOLDOWN_MS
  }

  /**
   * Generate a cryptographically secure token (hex encoded, 64 chars).
   */
  generateVerificationToken() {
    return crypto.randomBytes(TOKEN_BYTE_LENGTH).toString('hex')
  }

  /**
   * Hash raw token value using SHA-256.
   */
  hashToken(token) {
    if (typeof token !== 'string' || token.length === 0) {
      throw new Error('Token must be a non-empty string')
    }
    return crypto.createHash('sha256').update(token).digest('hex')
  }

  /**
   * Store verification token metadata in the database.
   * Enforces resend cooldown unless explicitly bypassed.
   */
  async storeVerificationToken({ userId, token, ipAddress = null, userAgent = null, bypassCooldown = false }) {
    if (!userId) throw new Error('userId is required')
    if (!token) throw new Error('token is required')

    if (!bypassCooldown) {
      const lastSentAt = await this.getLastVerificationTokenDate(userId)
      if (lastSentAt) {
        const elapsed = Date.now() - lastSentAt.getTime()
        if (elapsed < this.resendCooldownMs) {
          const retryAfterMs = this.resendCooldownMs - elapsed
          const error = new Error('Verification email recently sent')
          error.code = 'RATE_LIMITED'
          error.retryAfterMs = retryAfterMs
          throw error
        }
      }
    }

    const tokenHash = this.hashToken(token)
    const expiresAt = new Date(Date.now() + this.tokenTTL)

    await this.cleanupExpiredTokens()

    const result = await this.pool.query(
      `INSERT INTO email_verification_tokens (
        user_id, token, expires_at, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING id, user_id, expires_at, used_at, created_at`,
      [userId, tokenHash, expiresAt, ipAddress, userAgent]
    )

    return result.rows[0]
  }

  /**
   * Validate a raw token string.
   * Returns token and user metadata when valid.
   */
  async validateVerificationToken(rawToken) {
    if (typeof rawToken !== 'string' || rawToken.length === 0) {
      return { valid: false, error: 'Invalid token' }
    }

    const tokenHash = this.hashToken(rawToken)
    const result = await this.pool.query(
      `SELECT id, user_id, expires_at, used_at, created_at
       FROM email_verification_tokens
       WHERE token = $1
       LIMIT 1`,
      [tokenHash]
    )

    if (result.rows.length === 0) {
      return { valid: false, error: 'Invalid or expired token' }
    }

    const row = result.rows[0]
    if (row.used_at) {
      return { valid: false, error: 'Token already used' }
    }

    if (new Date(row.expires_at).getTime() <= Date.now()) {
      return { valid: false, error: 'Invalid or expired token' }
    }

    return {
      valid: true,
      tokenId: row.id,
      userId: row.user_id,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    }
  }

  /**
   * Mark a specific token as used.
   * Returns the timestamp when the token was marked.
   */
  async markTokenAsUsed(tokenId) {
    if (!tokenId) throw new Error('tokenId is required')

    const result = await this.pool.query(
      `UPDATE email_verification_tokens
       SET used_at = NOW()
       WHERE id = $1 AND used_at IS NULL
       RETURNING used_at`,
      [tokenId]
    )

    if (result.rows.length === 0) {
      return null
    }

    return result.rows[0].used_at
  }

  /**
   * Set user email_verified flags and consume all outstanding tokens.
   */
  async markEmailAsVerified(userId) {
    if (!userId) throw new Error('userId is required')

    const result = await this.pool.query(
      `UPDATE users
       SET email_verified = TRUE,
           email_verified_at = COALESCE(email_verified_at, NOW())
       WHERE id = $1
       RETURNING email_verified, email_verified_at`,
      [userId]
    )

    if (result.rows.length === 0) {
      throw new Error('User not found')
    }

    await this.pool.query(
      `UPDATE email_verification_tokens
       SET used_at = NOW()
       WHERE user_id = $1 AND used_at IS NULL`,
      [userId]
    )

    return {
      emailVerified: result.rows[0].email_verified,
      emailVerifiedAt: result.rows[0].email_verified_at,
    }
  }

  /**
   * Check if a user already has a verified email.
   */
  async isEmailVerified(userId) {
    if (!userId) throw new Error('userId is required')

    const result = await this.pool.query(
      `SELECT email_verified
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId]
    )

    if (result.rows.length === 0) {
      return false
    }

    return result.rows[0].email_verified === true
  }

  /**
   * Determine whether a verification email can be resent right now.
   */
  async canResendVerification(userId) {
    if (!userId) throw new Error('userId is required')

    const lastSentAt = await this.getLastVerificationTokenDate(userId)
    if (!lastSentAt) return true

    return (Date.now() - lastSentAt.getTime()) >= this.resendCooldownMs
  }

  /**
   * Fetch the most recent token creation timestamp for the user.
   */
  async getLastVerificationTokenDate(userId) {
    if (!userId) throw new Error('userId is required')

    const result = await this.pool.query(
      `SELECT created_at
       FROM email_verification_tokens
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    )

    if (result.rows.length === 0) {
      return null
    }

    const createdAt = result.rows[0].created_at
    return createdAt instanceof Date ? createdAt : new Date(createdAt)
  }

  /**
   * Delete expired verification tokens.
   */
  async cleanupExpiredTokens() {
    const result = await this.pool.query(
      `DELETE FROM email_verification_tokens
       WHERE expires_at <= NOW()`
    )
    return result.rowCount || 0
  }
}

const emailVerificationService = new EmailVerificationService()
export default emailVerificationService
