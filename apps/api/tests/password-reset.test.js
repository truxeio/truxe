import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import Fastify from 'fastify'
import passwordAuthRoutes from '../src/routes/password-auth.js'
import emailQueue from '../src/services/email-queue-adapter.js'

// In-memory mock DB state
const state = {
  users: [],
  password_history: [],
  password_reset_tokens: [],
}

function resetState() {
  state.users = []
  state.password_history = []
  state.password_reset_tokens = []
}

// Helper: find reset token row by raw token
function findResetTokenByRaw(rawToken) {
  const crypto = require('crypto')
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex')
  return state.password_reset_tokens.find(t => t.token === hash)
}

// Mock database module
jest.mock('../src/database/connection.js', () => {
  return {
    __esModule: true,
    default: {
      query: async (sql, params) => mockQuery(sql, params),
      raw: async (sql) => mockQuery(sql, []),
    },
    getPool: jest.fn(() => ({
      connect: async () => ({
        query: async (sql, params) => mockQuery(sql, params),
        release: () => {},
      }),
      query: async (sql, params) => mockQuery(sql, params),
    })),
  }
})

// Mock rate limit plugin as no-op
jest.mock('../src/services/rate-limit.js', () => ({
  __esModule: true,
  default: {
    createFastifyPlugin: () => async () => {},
  },
}))

// Mock JWT and Session services to avoid crypto/keys setup and DB
jest.mock('../src/services/jwt.js', () => ({
  __esModule: true,
  default: {
    createTokenPair: async ({ userId }) => ({
      accessToken: { token: `access-${userId}`, jti: `ajti-${userId}`, expiresAt: new Date(Date.now() + 900000), expiresIn: 900 },
      refreshToken: { token: `refresh-${userId}`, jti: `rjti-${userId}`, expiresAt: new Date(Date.now() + 7 * 24 * 3600000), expiresIn: 604800 },
    }),
  },
}))

jest.mock('../src/services/session.js', () => ({
  __esModule: true,
  default: {
    createSession: async ({ userId }) => ({ jti: `session-${userId}`, isActive: true }),
    revokeAllUserSessions: async () => ({}),
  },
}))

// Mock email service sending (avoid network)
jest.mock('../src/services/email.js', () => ({
  __esModule: true,
  default: {
    sendPasswordResetEmail: jest.fn(async () => ({ success: true, messageId: 'mock' })),
  },
}))

// Mock email queue adapter to call email service directly
jest.mock('../src/services/email-queue-adapter.js', () => ({
  __esModule: true,
  default: {
    sendPasswordResetEmail: jest.fn(async () => ({ success: true })),
    sendEmailVerification: jest.fn(async () => ({ success: true })),
    sendEmailVerifiedConfirmation: jest.fn(async () => ({ success: true })),
    sendWelcomeEmail: jest.fn(async () => ({ success: true })),
    sendPasswordResetConfirmation: jest.fn(async () => ({ success: true })),
    sendPasswordChangedNotification: jest.fn(async () => ({ success: true })),
    sendAccountLockedNotification: jest.fn(async () => ({ success: true })),
    sendAccountUnlockedNotification: jest.fn(async () => ({ success: true })),
    sendSecurityAlert: jest.fn(async () => ({ success: true })),
  },
}))

jest.mock('../src/services/email-verification.js', () => ({
  __esModule: true,
  default: {
    tokenTTL: 24 * 60 * 60 * 1000,
    generateVerificationToken: jest.fn(() => 'mock-token'),
    storeVerificationToken: jest.fn(async () => ({ id: 'evt-1' })),
    validateVerificationToken: jest.fn(async () => ({ valid: true, tokenId: 'evt-1', userId: 'u-1' })),
    markTokenAsUsed: jest.fn(async () => new Date().toISOString()),
    markEmailAsVerified: jest.fn(async () => ({ emailVerified: true, emailVerifiedAt: new Date().toISOString() })),
  },
}))

// Mock auth decorator for change password tests
function withAuth(app, user) {
  app.decorate('authenticate', async (request, reply) => {
    request.user = { id: user.id, email: user.email, emailVerified: user.email_verified ?? user.emailVerified ?? false }
    request.tokenPayload = { user_id: user.id, email: user.email }
  })
  app.decorate('requireEmailVerified', async (request, reply) => {
    if (!request.user?.emailVerified) {
      return reply.code(403).send({
        error: 'Email Not Verified',
        message: 'Email verification is required to perform this action.',
        code: 'EMAIL_NOT_VERIFIED',
      })
    }
  })
}

// Simple query router to simulate Postgres
function mockQuery(sql, params) {
  const text = typeof sql === 'string' ? sql : sql.text
  const lower = text.trim().toLowerCase()

  // users operations
  if (lower.startsWith('select') && lower.includes('from users') && lower.includes('where email =')) {
    const email = params[0]
    return { rows: state.users.filter(u => u.email === email) }
  }
  if (lower.startsWith('select') && lower.includes('from users') && lower.includes('where id =')) {
    const id = params[0]
    return { rows: state.users.filter(u => u.id === id) }
  }
  if (lower.startsWith('insert into users')) {
    const [email, emailVerified, status, metadataJson, passwordHash] = params
    const now = new Date().toISOString()
    const user = { id: `u-${state.users.length + 1}`, email, email_verified: emailVerified, status, metadata: metadataJson, password_hash: passwordHash, password_updated_at: now, failed_login_attempts: 0, locked_until: null, created_at: now, updated_at: now }
    state.users.push(user)
    return { rows: [{ id: user.id, email: user.email, email_verified: user.email_verified, status: user.status, created_at: user.created_at }] }
  }
  if (lower.startsWith('update users set password_hash')) {
    const [id, newHash] = params
    const u = state.users.find(x => x.id === id)
    if (u) {
      u.password_hash = newHash
      u.password_updated_at = new Date().toISOString()
      u.updated_at = new Date().toISOString()
    }
    return { rows: [] }
  }

  // password_history
  if (lower.startsWith('insert into password_history')) {
    const [userId, passwordHash] = params
    state.password_history.push({ id: `ph-${state.password_history.length + 1}`, user_id: userId, password_hash: passwordHash, created_at: new Date().toISOString() })
    return { rows: [] }
  }
  if (lower.includes('from password_history') && lower.includes('where user_id = $1') && lower.includes('order by created_at desc')) {
    const [userId, limit] = params
    const rows = state.password_history
      .filter(r => r.user_id === userId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit)
      .map(r => ({ id: r.id, password_hash: r.password_hash }))
    return { rows }
  }
  if (lower.startsWith('with kept as') && lower.includes('delete from password_history')) {
    // Clean older than last N (simulate by trimming array per user)
    // No-op sufficient for tests
    return { rows: [], rowCount: 0 }
  }

  // password_reset_tokens
  if (lower.startsWith('insert into password_reset_tokens')) {
    const [userId, tokenHash, expiresAt, ip, ua] = params
    const row = { id: `prt-${state.password_reset_tokens.length + 1}`, user_id: userId, token: tokenHash, expires_at: new Date(expiresAt).toISOString(), used_at: null, ip_address: ip, user_agent: ua, created_at: new Date().toISOString() }
    state.password_reset_tokens.push(row)
    return { rows: [] }
  }
  if (lower.startsWith('select') && lower.includes('from password_reset_tokens') && lower.includes('where token =')) {
    const [hash] = params
    const row = state.password_reset_tokens.find(r => r.token === hash)
    return { rows: row ? [{ id: row.id, user_id: row.user_id, expires_at: row.expires_at, used_at: row.used_at }] : [] }
  }
  if (lower.startsWith('update password_reset_tokens set used_at')) {
    const [id] = params
    const row = state.password_reset_tokens.find(r => r.id === id)
    if (row) row.used_at = new Date().toISOString()
    return { rows: [] }
  }
  if (lower.startsWith('delete from password_reset_tokens')) {
    const before = state.password_reset_tokens.length
    state.password_reset_tokens = state.password_reset_tokens.filter(r => new Date(r.expires_at) > new Date())
    return { rowCount: before - state.password_reset_tokens.length, rows: [] }
  }

  // users failed attempts (not central in this test)
  if (lower.startsWith('update users set failed_login_attempts')) {
    const [id, attempts, lockedUntil] = params
    const u = state.users.find(x => x.id === id)
    if (u) {
      u.failed_login_attempts = attempts
      u.locked_until = lockedUntil ? new Date(lockedUntil).toISOString() : null
      u.updated_at = new Date().toISOString()
    }
    return { rows: [] }
  }
  if (lower.startsWith('update users set failed_login_attempts = 0')) {
    const [id] = params
    const u = state.users.find(x => x.id === id)
    if (u) {
      u.failed_login_attempts = 0
      u.locked_until = null
      u.updated_at = new Date().toISOString()
    }
    return { rows: [] }
  }

  return { rows: [] }
}

let app

describe('Password Reset Flow', () => {
  beforeEach(async () => {
    resetState()
   app = Fastify({ logger: false })
    // Provide dummy auth decorator for route registration
    app.decorate('authenticate', async () => {})
    app.decorate('requireEmailVerified', async () => {})
    await app.register(passwordAuthRoutes, { prefix: '/api/auth' })
  })

  afterEach(async () => {
    await app.close()
    jest.clearAllMocks()
  })

  it('returns 200 for forgot even if email does not exist', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/password/forgot', payload: { email: 'nope@example.com' } })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.success).toBe(true)
    expect(emailQueue.sendPasswordResetEmail).not.toHaveBeenCalled()
  })

  it('creates reset token and sends email when email exists', async () => {
    // Register user
    await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: 'user@example.com', password: 'SecurePass123!' } })
    const res = await app.inject({ method: 'POST', url: '/api/auth/password/forgot', payload: { email: 'user@example.com' } })
    expect(res.statusCode).toBe(200)
    expect(state.password_reset_tokens.length).toBe(1)
    expect(emailQueue.sendPasswordResetEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'user@example.com', resetToken: expect.any(String) })
    )
  })

  it('resets password with valid token', async () => {
    await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: 'reset@example.com', password: 'SecurePass123!' } })
    const forgot = await app.inject({ method: 'POST', url: '/api/auth/password/forgot', payload: { email: 'reset@example.com' } })
    expect(forgot.statusCode).toBe(200)
    // Grab raw token from in-memory by reverse engineering: generate our own token to match hash approach
    // We cannot access raw token from service here; instead simulate by taking first entry and craft matching raw token only for logic testing via service itself
    const tokenRow = state.password_reset_tokens[0]
    // For test, reconstruct a raw token that hashes to same value is infeasible; instead call route with a fresh token we create and insert matching hashed row
    const rawToken = 'a'.repeat(64)
    const crypto = require('crypto')
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex')
    // Replace token entry to match our rawToken
    tokenRow.token = hash
    const res = await app.inject({ method: 'POST', url: '/api/auth/password/reset', payload: { token: rawToken, password: 'NewSecure123!' } })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.success).toBe(true)
    expect(emailQueue.sendPasswordResetConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'reset@example.com' })
    )
  })

  it('rejects reset with expired token', async () => {
    await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: 'exp@example.com', password: 'SecurePass123!' } })
    await app.inject({ method: 'POST', url: '/api/auth/password/forgot', payload: { email: 'exp@example.com' } })
    const rawToken = 'b'.repeat(64)
    const crypto = require('crypto')
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex')
    // Insert expired token row
    state.password_reset_tokens.push({ id: 'prt-exp', user_id: state.users[0].id, token: hash, expires_at: new Date(Date.now() - 1000).toISOString(), used_at: null })
    const res = await app.inject({ method: 'POST', url: '/api/auth/password/reset', payload: { token: rawToken, password: 'NewSecure123!' } })
    expect(res.statusCode).toBe(400)
    expect(emailQueue.sendPasswordResetConfirmation).not.toHaveBeenCalled()
  })

  it('rejects reset with used token', async () => {
    await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: 'used@example.com', password: 'SecurePass123!' } })
    await app.inject({ method: 'POST', url: '/api/auth/password/forgot', payload: { email: 'used@example.com' } })
    const rawToken = 'c'.repeat(64)
    const crypto = require('crypto')
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex')
    state.password_reset_tokens.push({ id: 'prt-used', user_id: state.users[0].id, token: hash, expires_at: new Date(Date.now() + 3600_000).toISOString(), used_at: new Date().toISOString() })
    const res = await app.inject({ method: 'POST', url: '/api/auth/password/reset', payload: { token: rawToken, password: 'NewSecure123!' } })
    expect(res.statusCode).toBe(400)
  })

  it('rejects reset with weak password', async () => {
    await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: 'weak@example.com', password: 'SecurePass123!' } })
    await app.inject({ method: 'POST', url: '/api/auth/password/forgot', payload: { email: 'weak@example.com' } })
    const rawToken = 'd'.repeat(64)
    const crypto = require('crypto')
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex')
    state.password_reset_tokens.push({ id: 'prt-weak', user_id: state.users[0].id, token: hash, expires_at: new Date(Date.now() + 3600_000).toISOString(), used_at: null })
    const res = await app.inject({ method: 'POST', url: '/api/auth/password/reset', payload: { token: rawToken, password: 'weak' } })
    expect(res.statusCode).toBe(400)
  })

  it('rejects reset with recently used password', async () => {
    // Register and then attempt reset to same password
    await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: 'reuse@example.com', password: 'SecurePass123!' } })
    await app.inject({ method: 'POST', url: '/api/auth/password/forgot', payload: { email: 'reuse@example.com' } })
    const rawToken = 'e'.repeat(64)
    const crypto = require('crypto')
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex')
    state.password_reset_tokens.push({ id: 'prt-reuse', user_id: state.users[0].id, token: hash, expires_at: new Date(Date.now() + 3600_000).toISOString(), used_at: null })
    const res = await app.inject({ method: 'POST', url: '/api/auth/password/reset', payload: { token: rawToken, password: 'SecurePass123!' } })
    expect(res.statusCode).toBe(400)
  })

  it('changes password for authenticated user', async () => {
    // Register
    await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: 'change@example.com', password: 'SecurePass123!' } })
    const user = state.users.find(u => u.email === 'change@example.com')
    user.email_verified = true
    // Register routes plugin again with auth decorator attached
    await app.close()
    app = Fastify({ logger: false })
    withAuth(app, user)
    await app.register(passwordAuthRoutes, { prefix: '/api/auth' })

    const res = await app.inject({ method: 'PUT', url: '/api/auth/password/change', payload: { current_password: 'SecurePass123!', new_password: 'AnotherSecure456!' } })
    expect(res.statusCode).toBe(200)
    expect(emailQueue.sendPasswordChangedNotification).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'change@example.com' })
    )
  })

  it('rejects change with wrong current password', async () => {
    await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: 'wrongcurr@example.com', password: 'SecurePass123!' } })
    const user = state.users.find(u => u.email === 'wrongcurr@example.com')
    user.email_verified = true
    await app.close()
    app = Fastify({ logger: false })
    withAuth(app, user)
    await app.register(passwordAuthRoutes, { prefix: '/api/auth' })

    const res = await app.inject({ method: 'PUT', url: '/api/auth/password/change', payload: { current_password: 'BadPass!', new_password: 'AnotherSecure456!' } })
    expect(res.statusCode).toBe(401)
    expect(emailQueue.sendPasswordChangedNotification).not.toHaveBeenCalled()
  })

  it('marks reset token as used after successful reset', async () => {
    await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: 'markused@example.com', password: 'SecurePass123!' } })
    await app.inject({ method: 'POST', url: '/api/auth/password/forgot', payload: { email: 'markused@example.com' } })
    const rawToken = 'f'.repeat(64)
    const crypto = require('crypto')
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex')
    state.password_reset_tokens.push({ id: 'prt-mark', user_id: state.users[0].id, token: hash, expires_at: new Date(Date.now() + 3600_000).toISOString(), used_at: null })
    const res = await app.inject({ method: 'POST', url: '/api/auth/password/reset', payload: { token: rawToken, password: 'NewSecure123!' } })
    expect(res.statusCode).toBe(200)
    const row = state.password_reset_tokens.find(r => r.id === 'prt-mark')
    expect(row.used_at).not.toBeNull()
  })

  it('cleanup removes expired tokens', async () => {
    // Insert expired and valid tokens
    state.password_reset_tokens.push({ id: 'prt-old', user_id: 'u-1', token: 'hash1', expires_at: new Date(Date.now() - 10_000).toISOString(), used_at: null })
    state.password_reset_tokens.push({ id: 'prt-new', user_id: 'u-1', token: 'hash2', expires_at: new Date(Date.now() + 10_000).toISOString(), used_at: null })
    // Trigger cleanup via forgot flow
    await app.inject({ method: 'POST', url: '/api/auth/password/forgot', payload: { email: 'nobody@example.com' } })
    // Simulated cleanup deletes expired
    const hasOld = state.password_reset_tokens.find(r => r.id === 'prt-old')
    expect(hasOld).toBeUndefined()
  })
})
