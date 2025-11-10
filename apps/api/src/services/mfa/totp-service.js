import speakeasy from 'speakeasy'
import QRCode from 'qrcode'
import argon2 from 'argon2'
import db, { getPool } from '../../database/connection.js'
import config from '../../config/index.js'
import OAuthTokenEncryptor from '../oauth/token-encryptor.js'

class TOTPService {
  constructor(options = {}) {
    const key = options.encryptionKey || process.env.MFA_ENCRYPTION_KEY || config.oauth?.tokenEncryption?.key
    const algorithm = options.encryptionAlgorithm || process.env.MFA_ENCRYPTION_ALGORITHM || config.oauth?.tokenEncryption?.algorithm || 'aes-256-gcm'
    this.encryptor = new OAuthTokenEncryptor({ key, algorithm })
    this.issuer = options.issuer || config.app.name || 'Heimdall'
    this.logger = options.logger || console
    this.pool = options.pool || getPool()
  }

  async generateSecret(userId, userEmail) {
    const secret = speakeasy.generateSecret({ length: 20, name: `${this.issuer} (${userEmail})`, issuer: this.issuer })

    const otpauthUrl = secret.otpauth_url
    const qrCode = await QRCode.toDataURL(otpauthUrl)

    const encryptedSecret = this.encryptor.encrypt(secret.base32)

    await db.query(
      `INSERT INTO mfa_settings (user_id, totp_secret, totp_verified)
       VALUES ($1, $2, false)
       ON CONFLICT (user_id)
       DO UPDATE SET totp_secret = EXCLUDED.totp_secret, totp_verified = false, updated_at = NOW()`,
      [userId, encryptedSecret],
    )

    return {
      secret: secret.base32,
      otpauthUrl,
      qrCode,
      manualEntryCode: secret.base32.match(/.{1,4}/g).join(' '),
    }
  }

  async verifyToken(userId, token, windowTolerance = 1) {
    const result = await db.query('SELECT totp_secret FROM mfa_settings WHERE user_id = $1', [userId])

    if (!result.rows[0]?.totp_secret) {
      throw new Error('MFA not configured')
    }

    const secret = this.encryptor.decrypt(result.rows[0].totp_secret)

    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: windowTolerance,
    })

    if (verified) {
      await db.query(
        `UPDATE mfa_settings
         SET last_used_at = NOW(), totp_verified = true, updated_at = NOW()
         WHERE user_id = $1`,
        [userId],
      )
    }

    return verified
  }

  async generateBackupCodes(userId, count = 10) {
    const codes = []
    const hashedCodes = []

    for (let i = 0; i < count; i++) {
      const raw = Math.random().toString().slice(2, 10)
      codes.push(raw)
      const hash = await argon2.hash(raw, { type: argon2.argon2id })
      hashedCodes.push(hash)
    }

    await db.query('UPDATE mfa_settings SET backup_codes = $2, updated_at = NOW() WHERE user_id = $1', [userId, hashedCodes])

    return codes
  }

  async verifyBackupCode(userId, code) {
    const result = await db.query('SELECT backup_codes FROM mfa_settings WHERE user_id = $1', [userId])
    const stored = result.rows[0]?.backup_codes || []

    for (let i = 0; i < stored.length; i++) {
      const match = await argon2.verify(stored[i], code)
      if (match) {
        const remaining = stored.filter((_, idx) => idx !== i)
        await db.query('UPDATE mfa_settings SET backup_codes = $2, updated_at = NOW() WHERE user_id = $1', [userId, remaining])
        return true
      }
    }
    return false
  }

  async getStatus(userId) {
    const result = await db.query('SELECT totp_verified, backup_codes, updated_at FROM mfa_settings WHERE user_id = $1', [userId])
    const row = result.rows[0]
    if (!row) return { enabled: false, backupCodesRemaining: 0 }
    return {
      enabled: !!row.totp_verified,
      backupCodesRemaining: Array.isArray(row.backup_codes) ? row.backup_codes.length : 0,
      updatedAt: row.updated_at,
    }
  }
}

export default new TOTPService()
export { TOTPService }


