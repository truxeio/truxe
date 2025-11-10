/**
 * Password Reset Service
 *
 * Handles secure password reset token generation, storage (hashed),
 * validation, single-use enforcement, and cleanup.
 */

import crypto from 'crypto'
import { getPool } from '../database/connection.js'

export class PasswordResetService {
  constructor(options = {}) {
    this.pool = options.pool || getPool()
    this.ttlMs = options.ttlMs || 60 * 60 * 1000 // 1 hour
  }

  generateResetToken() {
    const token = crypto.randomBytes(32).toString('hex')
    return token
  }

  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex')
  }

  async storeResetToken({ userId, token, ipAddress = null, userAgent = null, expiresAt = null }) {
    if (!userId) throw new Error('userId is required')
    if (!token) throw new Error('token is required')

    const tokenHash = this.hashToken(token)
    const expiry = expiresAt || new Date(Date.now() + this.ttlMs)

    const client = await this.pool.connect()
    try {
      await client.query(
        `INSERT INTO password_reset_tokens (user_id, token, expires_at, ip_address, user_agent, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [userId, tokenHash, expiry, ipAddress, userAgent]
      )
      return { success: true, expiresAt: expiry }
    } finally {
      client.release()
    }
  }

  async validateResetToken(rawToken) {
    if (!rawToken || typeof rawToken !== 'string') {
      return { valid: false, error: 'Invalid token' }
    }

    const tokenHash = this.hashToken(rawToken)
    const client = await this.pool.connect()
    try {
      const res = await client.query(
        `SELECT id, user_id, expires_at, used_at
         FROM password_reset_tokens
         WHERE token = $1
         LIMIT 1`,
        [tokenHash]
      )

      if (res.rows.length === 0) return { valid: false, error: 'Invalid or expired token' }

      const row = res.rows[0]
      if (row.used_at) return { valid: false, error: 'Token already used' }
      if (new Date(row.expires_at).getTime() <= Date.now()) return { valid: false, error: 'Invalid or expired token' }

      return { valid: true, tokenId: row.id, userId: row.user_id, expiresAt: row.expires_at }
    } finally {
      client.release()
    }
  }

  async markTokenAsUsed(tokenId) {
    if (!tokenId) throw new Error('tokenId is required')
    await this.pool.query(
      `UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`,
      [tokenId]
    )
  }

  async cleanExpiredTokens() {
    const res = await this.pool.query(
      `DELETE FROM password_reset_tokens
       WHERE expires_at <= NOW() OR used_at IS NOT NULL AND used_at < NOW() - INTERVAL '7 days'`
    )
    return res.rowCount || 0
  }
}

const passwordResetService = new PasswordResetService()
export default passwordResetService


