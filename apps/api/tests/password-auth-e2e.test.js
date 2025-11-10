import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import Fastify from 'fastify'
import passwordAuthRoutes from '../src/routes/password-auth.js'
import adminRoutes from '../src/routes/admin.js'
import emailQueue from '../src/services/email-queue-adapter.js'

// In-memory mock DB state for E2E
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

// Mock email service and queue to avoid network
jest.mock('../src/services/email.js', () => ({
  __esModule: true,
  default: {
    sendPasswordResetEmail: jest.fn(async () => ({ success: true, messageId: 'mock' })),
  },
}))

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

// Mock security audit logger used by admin unlock (no-op)
jest.mock('../src/services/advanced-session-security.js', () => ({
  __esModule: true,
  default: {
    logSecurityEvent: async () => 'event-id',
  },
}))

// Simple auth and RBAC decorators for tests
function withAuthAndAdmin(app, adminUser) {
  app.decorate('authenticate', async (request, reply) => {
    const auth = request.headers.authorization || ''
    if (!auth.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }
    const token = auth.split(' ')[1]
    if (token === 'admin-token') {
      request.user = { id: adminUser.id, email: adminUser.email, emailVerified: true }
      request.tokenPayload = { user_id: adminUser.id, role: 'admin' }
    } else {
      // Treat as regular user token of form access-<userId>
      const uid = token.replace('access-', '')
      const record = state.users.find(u => u.id === uid)
      request.user = {
        id: uid,
        email: record?.email,
        emailVerified: Boolean(record?.email_verified),
      }
      request.tokenPayload = { user_id: uid, role: 'member' }
    }
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

  app.decorate('requireRole', function (required) {
    return async (request, reply) => {
      const role = request.tokenPayload?.role
      const ok = Array.isArray(required) ? required.includes(role) : role === required
      if (!ok) return reply.code(403).send({ error: 'Insufficient Permissions' })
    }
  })
}

// SQL-like router over in-memory state
function mockQuery(sql, params) {
  const text = typeof sql === 'string' ? sql : sql.text
  const lower = text.trim().toLowerCase()

  // users
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

  return { rows: [] }
}

let app

describe('Password Auth E2E', () => {
  beforeEach(async () => {
    resetState()
    app = Fastify({ logger: false })
    // Decorate auth + rbac for both password and admin routes
    withAuthAndAdmin(app, { id: 'admin-1', email: 'admin@example.com' })
    await app.register(passwordAuthRoutes, { prefix: '/api/auth' })
    await app.register(adminRoutes, { prefix: '/api/admin' })
  })

  afterEach(async () => {
    await app.close()
    jest.clearAllMocks()
  })

  it('Full user journey with lockout and admin unlock', async () => {
    // 1) Register
    const reg = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: 'test@example.com', password: 'CorrectPass123!' } })
    expect(reg.statusCode).toBe(201)
    const regBody = JSON.parse(reg.body)
    const userId = regBody.data.user.id
    expect(emailQueue.sendWelcomeEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'test@example.com' })
    )

    // 2) Login success
    const loginOk = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'test@example.com', password: 'CorrectPass123!' } })
    expect(loginOk.statusCode).toBe(200)
    const tokens1 = JSON.parse(loginOk.body).data.tokens

    // 3) Fail login 5 times to lock
    for (let i = 0; i < 5; i++) {
      await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'test@example.com', password: 'WrongPass' } })
    }
    expect(emailQueue.sendAccountLockedNotification).toHaveBeenCalledTimes(1)

    // 4) Try login while locked
    const lockedTry = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'test@example.com', password: 'CorrectPass123!' } })
    expect(lockedTry.statusCode).toBe(423)

    // 5) Admin unlocks
    const unlock = await app.inject({ method: 'POST', url: `/api/admin/users/${userId}/unlock`, headers: { Authorization: 'Bearer admin-token' } })
    expect(unlock.statusCode).toBe(200)
    const unlockBody = JSON.parse(unlock.body)
    expect(unlockBody.success).toBe(true)
    expect(unlockBody.data.failed_login_attempts).toBe(0)
    expect(unlockBody.data.locked_until).toBeNull()
    expect(emailQueue.sendAccountUnlockedNotification).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'test@example.com' })
    )

    // 6) Login successfully again
    const loginAgain = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'test@example.com', password: 'CorrectPass123!' } })
    expect(loginAgain.statusCode).toBe(200)

    // 7) Request password reset
    const forgot = await app.inject({ method: 'POST', url: '/api/auth/password/forgot', payload: { email: 'test@example.com' } })
    expect(forgot.statusCode).toBe(200)
    expect(emailQueue.sendPasswordResetEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'test@example.com', resetToken: expect.any(String) })
    )

    // 8) Reset password with token (inject matching token)
    const rawToken = 'z'.repeat(64)
    const crypto = require('crypto')
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex')
    // Replace first token entry (created by forgot) to match our raw token
    if (state.password_reset_tokens.length > 0) {
      state.password_reset_tokens[0].token = hash
      state.password_reset_tokens[0].expires_at = new Date(Date.now() + 3600_000).toISOString()
      state.password_reset_tokens[0].user_id = userId
    } else {
      state.password_reset_tokens.push({ id: 'prt-1', user_id: userId, token: hash, expires_at: new Date(Date.now() + 3600_000).toISOString(), used_at: null })
    }
    const reset = await app.inject({ method: 'POST', url: '/api/auth/password/reset', payload: { token: rawToken, password: 'NewCorrectPass456!' } })
    expect(reset.statusCode).toBe(200)
    expect(emailQueue.sendPasswordResetConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'test@example.com' })
    )

    // 9) Login with new password
    const loginNew = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'test@example.com', password: 'NewCorrectPass456!' } })
    expect(loginNew.statusCode).toBe(200)

    const record = state.users.find(u => u.id === userId)
    if (record) {
      record.email_verified = true
      record.email_verified_at = new Date().toISOString()
    }

    // 10) Change password (authenticated)
    const access = JSON.parse(loginNew.body).data.tokens.access_token
    const change = await app.inject({ method: 'PUT', url: '/api/auth/password/change', headers: { Authorization: `Bearer ${access}` }, payload: { current_password: 'NewCorrectPass456!', new_password: 'ChangedAgain789!' } })
    expect(change.statusCode).toBe(200)

    // 11) Login with changed password
    const finalLogin = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'test@example.com', password: 'ChangedAgain789!' } })
    expect(finalLogin.statusCode).toBe(200)
  })
})
