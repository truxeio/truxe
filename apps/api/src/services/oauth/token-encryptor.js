import crypto from 'crypto'
import { OAuthConfigurationError } from './errors.js'

/**
 * Secure token encryption/decryption helper using AES-GCM with authentication.
 */
export class OAuthTokenEncryptor {
  constructor(options = {}) {
    this.algorithm = options.algorithm || 'aes-256-gcm'
    this.key = this.normalizeKey(options.key)
  }

  getExpectedKeyLength() {
    if (this.algorithm.includes('256')) return 32
    if (this.algorithm.includes('192')) return 24
    if (this.algorithm.includes('128')) return 16
    return 32
  }

  normalizeKey(rawKey) {
    if (!rawKey) {
      throw new OAuthConfigurationError('OAuth token encryption key is required')
    }

    let buffer

    if (Buffer.isBuffer(rawKey)) {
      buffer = rawKey
    } else if (typeof rawKey === 'string') {
      buffer = this.tryDecodeStringKey(rawKey)
    } else {
      throw new OAuthConfigurationError('Invalid OAuth token encryption key format')
    }

    const expectedLength = this.getExpectedKeyLength()

    if (buffer.length === expectedLength) {
      return buffer
    }

    // Derive a key of the expected length using SHA-256
    return crypto.createHash('sha256').update(buffer).digest().subarray(0, expectedLength)
  }

  tryDecodeStringKey(value) {
    const trimmed = value.trim()

    // Try Base64 / Base64URL
    try {
      const decoded = Buffer.from(trimmed, 'base64')
      if (decoded.length >= 16) {
        return decoded
      }
    } catch {}

    try {
      const decoded = Buffer.from(trimmed, 'base64url')
      if (decoded.length >= 16) {
        return decoded
      }
    } catch {}

    // Try hexadecimal
    if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0) {
      return Buffer.from(trimmed, 'hex')
    }

    // Fallback to UTF-8 representation
    return Buffer.from(trimmed, 'utf8')
  }

  /**
   * Encrypt a string payload. Returns a Base64URL encoded string containing
   * IV + auth tag + ciphertext for storage.
   */
  encrypt(plaintext) {
    if (plaintext === null || plaintext === undefined) {
      return null
    }

    const input = typeof plaintext === 'string'
      ? plaintext
      : JSON.stringify(plaintext)

    if (!input || input.length === 0) {
      return null
    }

    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv)

    const ciphertext = Buffer.concat([
      cipher.update(input, 'utf8'),
      cipher.final(),
    ])

    const authTag = cipher.getAuthTag()

    return Buffer.concat([iv, authTag, ciphertext]).toString('base64url')
  }

  /**
   * Decrypt a previously encrypted payload. Returns the raw string content.
   */
  decrypt(encoded) {
    if (!encoded || typeof encoded !== 'string') {
      return null
    }

    let buffer

    try {
      buffer = Buffer.from(encoded, 'base64url')
    } catch (error) {
      // Attempt to decode standard base64 as a fallback
      buffer = Buffer.from(encoded, 'base64')
    }

    if (buffer.length < 16) {
      throw new OAuthConfigurationError('Encrypted token payload is too short')
    }

    const iv = buffer.subarray(0, 12)
    const authTag = buffer.subarray(12, 28)
    const ciphertext = buffer.subarray(28)

    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv)
    decipher.setAuthTag(authTag)

    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8')

    return plaintext
  }
}

export default OAuthTokenEncryptor
