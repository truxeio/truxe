/**
 * Password Service
 * 
 * Provides secure password hashing (Argon2id), verification, complexity validation,
 * and password history management.
 */

import argon2 from 'argon2'
import { getPool } from '../database/connection.js'
import config from '../config/index.js'

/**
 * Class handling password operations securely
 */
export class PasswordService {
  constructor(options = {}) {
    this.pool = options.pool || getPool()

    // Argon2id recommended parameters
    this.argon2Options = {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3, // iterations
      parallelism: 4, // threads
    }

    // Password policy from configuration
    const policy = config.password || {}
    this.minLength = policy.passwordMinLength ?? 8
    this.maxLength = policy.passwordMaxLength ?? 128
    this.requireUppercase = policy.passwordRequireUppercase ?? true
    this.requireLowercase = policy.passwordRequireLowercase ?? true
    this.requireNumber = policy.passwordRequireNumber ?? true
    this.requireSpecial = policy.passwordRequireSpecial ?? true
    this.historyLimit = policy.passwordHistoryLimit ?? 5
  }

  /**
   * Hash a password using Argon2id
   * @param {string} password - Plain text password
   * @returns {Promise<string>} - Hashed password
   */
  async hashPassword(password) {
    if (typeof password !== 'string') {
      throw new TypeError('Password must be a string')
    }
    try {
      return await argon2.hash(password, this.argon2Options)
    } catch (error) {
      throw new Error(`Password hashing failed: ${error.message}`)
    }
  }

  /**
   * Verify a password against a hash
   * @param {string} hash - Hashed password
   * @param {string} password - Plain text password
   * @returns {Promise<boolean>} - True if password matches
   */
  async verifyPassword(hash, password) {
    if (typeof hash !== 'string' || typeof password !== 'string') {
      throw new TypeError('Hash and password must be strings')
    }
    try {
      return await argon2.verify(hash, password)
    } catch (error) {
      // Do not leak details; return false for invalid hashes
      return false
    }
  }

  /**
   * Validate password complexity
   * @param {string} password - Password to validate
   * @returns {{ valid: boolean, errors: string[] }} - Validation result
   */
  validatePasswordComplexity(password) {
    const errors = []

    if (typeof password !== 'string') {
      return { valid: false, errors: ['Password must be a string'] }
    }

    if (password.length < this.minLength) {
      errors.push(`Password must be at least ${this.minLength} characters`)
    }
    if (password.length > this.maxLength) {
      errors.push(`Password must be at most ${this.maxLength} characters`)
    }

    if (this.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter')
    }
    if (this.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter')
    }
    if (this.requireNumber && !/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number')
    }
    if (this.requireSpecial && !/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password)) {
      errors.push('Password must contain at least one special character')
    }

    return { valid: errors.length === 0, errors }
  }

  /**
   * Check if password was used before
   * @param {string} userId - User ID
   * @param {string} password - Plain text password
   * @returns {Promise<boolean>} - True if password was used before
   */
  async checkPasswordHistory(userId, password) {
    if (!userId) throw new Error('userId is required')
    if (typeof password !== 'string') throw new TypeError('Password must be a string')

    const client = await this.pool.connect()
    try {
      const result = await client.query(
        `SELECT id, password_hash
         FROM password_history
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, this.historyLimit]
      )

      for (const row of result.rows) {
        const match = await this.verifyPassword(row.password_hash, password)
        if (match) return true
      }
      return false
    } finally {
      client.release()
    }
  }

  /**
   * Add password to history
   * @param {string} userId - User ID
   * @param {string} passwordHash - Hashed password
   * @returns {Promise<void>}
   */
  async addPasswordToHistory(userId, passwordHash) {
    if (!userId) throw new Error('userId is required')
    if (typeof passwordHash !== 'string') throw new TypeError('passwordHash must be a string')

    const client = await this.pool.connect()
    try {
      await client.query(
        `INSERT INTO password_history (user_id, password_hash, created_at)
         VALUES ($1, $2, NOW())`,
        [userId, passwordHash]
      )
    } finally {
      client.release()
    }
  }

  /**
   * Clean old password history (keep last 5)
   * @param {string} userId - User ID
   * @returns {Promise<number>} - Number of deleted entries
   */
  async cleanPasswordHistory(userId) {
    if (!userId) throw new Error('userId is required')

    const client = await this.pool.connect()
    try {
      const result = await client.query(
        `WITH kept AS (
           SELECT id
           FROM password_history
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT $2
         )
         DELETE FROM password_history ph
         WHERE ph.user_id = $1
           AND ph.id NOT IN (SELECT id FROM kept)`,
        [userId, this.historyLimit]
      )
      // In pg, result.rowCount contains deleted rows for DELETE
      return result.rowCount || 0
    } finally {
      client.release()
    }
  }
}

export default PasswordService


