import { describe, it, expect, beforeEach } from '@jest/globals'
import { EmailVerificationService } from '../src/services/email-verification.js'

class MockPool {
  constructor() {
    this.tokens = []
    this.users = new Map()
    this.sequence = 1
  }

  addUser({ id, emailVerified = false, emailVerifiedAt = null }) {
    this.users.set(id, {
      id,
      email_verified: emailVerified,
      email_verified_at: emailVerifiedAt,
    })
  }

  reset() {
    this.tokens = []
    this.users.clear()
    this.sequence = 1
  }

  async query(sql, params = []) {
    const text = typeof sql === 'string' ? sql : sql.text
    const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase()

    if (normalized.startsWith('insert into email_verification_tokens')) {
      const [userId, tokenHash, expiresAt, ipAddress, userAgent] = params
      const row = {
        id: `evt-${this.sequence++}`,
        user_id: userId,
        token: tokenHash,
        expires_at: expiresAt instanceof Date ? expiresAt : new Date(expiresAt),
        used_at: null,
        ip_address: ipAddress,
        user_agent: userAgent,
        created_at: new Date(),
      }
      this.tokens.push(row)
      return {
        rows: [{
          id: row.id,
          user_id: row.user_id,
          expires_at: row.expires_at,
          used_at: row.used_at,
          created_at: row.created_at,
        }],
        rowCount: 1,
      }
    }

    if (normalized.startsWith('select created_at from email_verification_tokens')) {
      const [userId] = params
      const rows = this.tokens
        .filter(t => t.user_id === userId)
        .sort((a, b) => b.created_at - a.created_at)
        .slice(0, 1)
        .map(t => ({ created_at: t.created_at }))
      return { rows, rowCount: rows.length }
    }

    if (normalized.startsWith('select id, user_id, expires_at, used_at, created_at from email_verification_tokens where token =')) {
      const [hash] = params
      const token = this.tokens.find(t => t.token === hash)
      if (!token) return { rows: [], rowCount: 0 }
      return {
        rows: [{
          id: token.id,
          user_id: token.user_id,
          expires_at: token.expires_at,
          used_at: token.used_at,
          created_at: token.created_at,
        }],
        rowCount: 1,
      }
    }

    if (normalized === 'update email_verification_tokens set used_at = now() where id = $1 and used_at is null returning used_at') {
      const [tokenId] = params
      const token = this.tokens.find(t => t.id === tokenId && !t.used_at)
      if (!token) return { rows: [], rowCount: 0 }
      token.used_at = new Date()
      return { rows: [{ used_at: token.used_at }], rowCount: 1 }
    }

    if (normalized === 'update email_verification_tokens set used_at = now() where user_id = $1 and used_at is null') {
      const [userId] = params
      let count = 0
      this.tokens.forEach(token => {
        if (token.user_id === userId && !token.used_at) {
          token.used_at = new Date()
          count++
        }
      })
      return { rows: [], rowCount: count }
    }

    if (normalized === 'delete from email_verification_tokens where expires_at <= now()') {
      const now = new Date()
      const before = this.tokens.length
      this.tokens = this.tokens.filter(t => t.expires_at > now)
      return { rows: [], rowCount: before - this.tokens.length }
    }

    if (normalized.startsWith('update users set email_verified = true')) {
      const [userId] = params
      const user = this.users.get(userId)
      if (!user) return { rows: [], rowCount: 0 }
      user.email_verified = true
      if (!user.email_verified_at) {
        user.email_verified_at = new Date()
      }
      return {
        rows: [{
          email_verified: user.email_verified,
          email_verified_at: user.email_verified_at,
        }],
        rowCount: 1,
      }
    }

    if (normalized.startsWith('select email_verified from users')) {
      const [userId] = params
      const user = this.users.get(userId)
      if (!user) return { rows: [], rowCount: 0 }
      return {
        rows: [{ email_verified: user.email_verified }],
        rowCount: 1,
      }
    }

    throw new Error(`Unhandled query in mock: ${text}`)
  }
}

describe('EmailVerificationService', () => {
  let pool
  let service
  const mockEmailService = {}
  const userId = 'user-1'

  beforeEach(() => {
    pool = new MockPool()
    pool.addUser({ id: userId, emailVerified: false })
    service = new EmailVerificationService(pool, mockEmailService)
  })

  it('generateVerificationToken produces 64 character hex string', () => {
    const token = service.generateVerificationToken()
    expect(token).toMatch(/^[a-f0-9]{64}$/)
  })

  it('generateVerificationToken returns unique values', () => {
    const t1 = service.generateVerificationToken()
    const t2 = service.generateVerificationToken()
    expect(t1).not.toEqual(t2)
  })

  it('hashToken generates deterministic SHA-256 hash', () => {
    const token = 'abc123'
    const hash1 = service.hashToken(token)
    const hash2 = service.hashToken(token)
    expect(hash1).toEqual(hash2)
    expect(hash1).toMatch(/^[a-f0-9]{64}$/)
  })

  it('hashToken throws for non-string input', () => {
    expect(() => service.hashToken(null)).toThrow('Token must be a non-empty string')
  })

  it('storeVerificationToken persists hashed token and metadata', async () => {
    const rawToken = 'token-123'
    const stored = await service.storeVerificationToken({ userId, token: rawToken, ipAddress: '127.0.0.1', userAgent: 'jest' })
    expect(stored.id).toBeDefined()
    expect(stored.user_id).toEqual(userId)
    expect(stored.expires_at).toBeInstanceOf(Date)
    const saved = pool.tokens.find(t => t.id === stored.id)
    expect(saved.token).toEqual(service.hashToken(rawToken))
    expect(saved.ip_address).toEqual('127.0.0.1')
    expect(saved.user_agent).toEqual('jest')
  })

  it('storeVerificationToken enforces resend cooldown', async () => {
    await service.storeVerificationToken({ userId, token: 'alpha' })
    await expect(
      service.storeVerificationToken({ userId, token: 'beta' })
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' })
  })

  it('storeVerificationToken respects bypass cooldown flag', async () => {
    await service.storeVerificationToken({ userId, token: 'alpha' })
    const stored = await service.storeVerificationToken({ userId, token: 'beta', bypassCooldown: true })
    expect(stored).toHaveProperty('id')
    expect(pool.tokens.length).toBe(2)
  })

  it('validateVerificationToken returns metadata for valid token', async () => {
    const rawToken = 'valid-123'
    const stored = await service.storeVerificationToken({ userId, token: rawToken, bypassCooldown: true })
    const result = await service.validateVerificationToken(rawToken)
    expect(result.valid).toBe(true)
    expect(result.tokenId).toEqual(stored.id)
    expect(result.userId).toEqual(userId)
  })

  it('validateVerificationToken rejects unknown tokens', async () => {
    const result = await service.validateVerificationToken('missing')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/invalid/i)
  })

  it('validateVerificationToken rejects expired tokens', async () => {
    const rawToken = 'will-expire'
    const stored = await service.storeVerificationToken({ userId, token: rawToken, bypassCooldown: true })
    const token = pool.tokens.find(t => t.id === stored.id)
    token.expires_at = new Date(Date.now() - 1000)
    const result = await service.validateVerificationToken(rawToken)
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/expired/i)
  })

  it('validateVerificationToken rejects used tokens', async () => {
    const rawToken = 'already-used'
    const stored = await service.storeVerificationToken({ userId, token: rawToken, bypassCooldown: true })
    await service.markTokenAsUsed(stored.id)
    const result = await service.validateVerificationToken(rawToken)
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/used/i)
  })

  it('markTokenAsUsed marks timestamps and prevents repeat usage', async () => {
    const stored = await service.storeVerificationToken({ userId, token: 'to-mark', bypassCooldown: true })
    const usedAt = await service.markTokenAsUsed(stored.id)
    expect(usedAt).toBeInstanceOf(Date)
    const second = await service.markTokenAsUsed(stored.id)
    expect(second).toBeNull()
  })

  it('markEmailAsVerified updates user record and consumes open tokens', async () => {
    await service.storeVerificationToken({ userId, token: 'one', bypassCooldown: true })
    await service.storeVerificationToken({ userId, token: 'two', bypassCooldown: true })
    const result = await service.markEmailAsVerified(userId)
    expect(result.emailVerified).toBe(true)
    expect(result.emailVerifiedAt).toBeInstanceOf(Date)
    pool.tokens.forEach(token => {
      expect(token.used_at).not.toBeNull()
    })
  })

  it('markEmailAsVerified throws when user missing', async () => {
    await expect(service.markEmailAsVerified('missing')).rejects.toThrow('User not found')
  })

  it('isEmailVerified returns correct boolean', async () => {
    expect(await service.isEmailVerified(userId)).toBe(false)
    await service.markEmailAsVerified(userId)
    expect(await service.isEmailVerified(userId)).toBe(true)
  })

  it('isEmailVerified returns false for unknown user', async () => {
    expect(await service.isEmailVerified('unknown-user')).toBe(false)
  })

  it('canResendVerification enforces cooldown window', async () => {
    const stored = await service.storeVerificationToken({ userId, token: 'cooldown', bypassCooldown: true })
    expect(await service.canResendVerification(userId)).toBe(false)
    const token = pool.tokens.find(t => t.id === stored.id)
    token.created_at = new Date(Date.now() - service.resendCooldownMs - 1000)
    expect(await service.canResendVerification(userId)).toBe(true)
  })

  it('getLastVerificationTokenDate returns most recent timestamp', async () => {
    await service.storeVerificationToken({ userId, token: 't1', bypassCooldown: true })
    const entry = await service.storeVerificationToken({ userId, token: 't2', bypassCooldown: true })
    const last = await service.getLastVerificationTokenDate(userId)
    expect(last).toEqual(pool.tokens.find(t => t.id === entry.id).created_at)
  })

  it('cleanupExpiredTokens removes only expired entries', async () => {
    const t1 = await service.storeVerificationToken({ userId, token: 'keep', bypassCooldown: true })
    const t2 = await service.storeVerificationToken({ userId, token: 'expire', bypassCooldown: true })
    const tokenToExpire = pool.tokens.find(t => t.id === t2.id)
    tokenToExpire.expires_at = new Date(Date.now() - 1000)
    const removed = await service.cleanupExpiredTokens()
    expect(removed).toBe(1)
    expect(pool.tokens.some(t => t.id === t1.id)).toBe(true)
    expect(pool.tokens.some(t => t.id === t2.id)).toBe(false)
  })
})
