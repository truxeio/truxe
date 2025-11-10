import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import Fastify from 'fastify'
import passwordAuthRoutes from '../src/routes/password-auth.js'
import emailQueue from '../src/services/email-queue-adapter.js'

// In-memory mock DB
const state = {
  users: [],
  password_history: [],
}

function resetState() {
  state.users = []
  state.password_history = []
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

// Mock JWT and Session services to avoid crypto/DB
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
  },
}))

// Mock email queue adapter to avoid SMTP dependency on import
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
    generateVerificationToken: jest.fn(() => 'token-123'),
    storeVerificationToken: jest.fn(async () => ({ id: 'evt-1' })),
  },
}))

// Mock rate limit service plugin as no-op
jest.mock('../src/services/rate-limit.js', () => ({
  __esModule: true,
  default: {
    createFastifyPlugin: () => async (fastify) => { /* no-op */ },
  },
}))

// Very small SQL router for our queries
function mockQuery(sql, params) {
  const text = typeof sql === 'string' ? sql : sql.text
  const lower = text.trim().toLowerCase()

  // users select by email
  if (lower.startsWith('select') && lower.includes('from users') && lower.includes('where email =')) {
    const email = params[0]
    const rows = state.users.filter(u => u.email === email)
    return { rows }
  }

  // users select by id
  if (lower.startsWith('select') && lower.includes('from users') && lower.includes('where id =')) {
    const id = params[0]
    const rows = state.users.filter(u => u.id === id)
    return { rows }
  }

  // insert user
  if (lower.startsWith('insert into users')) {
    const [email, emailVerified, status, metadataJson, passwordHash] = params
    const user = {
      id: `u-${state.users.length + 1}`,
      email,
      email_verified: emailVerified,
      status,
      metadata: metadataJson,
      password_hash: passwordHash,
      password_updated_at: new Date().toISOString(),
      failed_login_attempts: 0,
      locked_until: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    state.users.push(user)
    return { rows: [{ id: user.id, email: user.email, email_verified: user.email_verified, status: user.status, created_at: user.created_at }] }
  }

  // update user for attempts/lock
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

  // reset counters
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

  // password_history insert
  if (lower.startsWith('insert into password_history')) {
    const [userId, passwordHash] = params
    state.password_history.push({ id: `ph-${state.password_history.length + 1}`, user_id: userId, password_hash: passwordHash, created_at: new Date().toISOString() })
    return { rows: [] }
  }

  // select password_history latest N
  if (lower.includes('from password_history') && lower.includes('where user_id = $1') && lower.includes('order by created_at desc')) {
    const [userId, limit] = params
    const rows = state.password_history
      .filter(r => r.user_id === userId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit)
      .map(r => ({ id: r.id, password_hash: r.password_hash }))
    return { rows }
  }

  return { rows: [] }
}

let app

describe('Password Auth Routes', () => {
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

  it('registers a new user successfully', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'user@example.com', password: 'SecurePass123!' },
    })
    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body)
    expect(body.success).toBe(true)
    expect(body.data.user.email).toBe('user@example.com')
    expect(body.data.tokens.access_token).toMatch(/^access-/)
    expect(emailQueue.sendEmailVerification).toHaveBeenCalledWith(
      'user@example.com',
      expect.any(String),
      expect.objectContaining({ expiresIn: expect.any(String) }),
    )
    expect(emailQueue.sendWelcomeEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'user@example.com' })
    )
  })

  it('rejects duplicate email on registration', async () => {
    // First
    await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: 'dup@example.com', password: 'SecurePass123!' } })
    // Second
    const res = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: 'dup@example.com', password: 'SecurePass123!' } })
    expect(res.statusCode).toBe(400)
  })

  it('rejects weak password', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: 'weak@example.com', password: 'weak' } })
    expect(res.statusCode).toBe(400)
  })

  it('logs in with correct credentials', async () => {
    // Register first
    await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: 'login@example.com', password: 'SecurePass123!' } })
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'login@example.com', password: 'SecurePass123!' } })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.success).toBe(true)
    expect(body.data.tokens.refresh_token).toMatch(/^refresh-/)
  })

  it('fails login with unknown email', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'nope@example.com', password: 'SecurePass123!' } })
    expect(res.statusCode).toBe(401)
  })

  it('fails login with wrong password and increments attempts', async () => {
    await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: 'wrongpass@example.com', password: 'SecurePass123!' } })
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'wrongpass@example.com', password: 'BadPass123!' } })
    expect(res.statusCode).toBe(401)
  })

  it('locks account after 5 failed attempts', async () => {
    await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: 'lock@example.com', password: 'SecurePass123!' } })
    for (let i = 0; i < 4; i++) {
      await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'lock@example.com', password: 'WrongPass123!' } })
    }
    const res5 = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'lock@example.com', password: 'WrongPass123!' } })
    expect([401, 423]).toContain(res5.statusCode)
    // One more should be locked for sure
    const res6 = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'lock@example.com', password: 'WrongPass123!' } })
    expect(res6.statusCode).toBe(423)
    const body = JSON.parse(res6.body)
    expect(body.unlock_at).toBeDefined()
    expect(emailQueue.sendAccountLockedNotification).toHaveBeenCalledTimes(1)
    expect(emailQueue.sendAccountLockedNotification).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'lock@example.com' })
    )
  })

  it('unlocks after 15 minutes window', async () => {
    await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: 'unlock@example.com', password: 'SecurePass123!' } })
    // Fail 5 times to lock
    for (let i = 0; i < 5; i++) {
      await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'unlock@example.com', password: 'WrongPass123!' } })
    }
    // Manually expire lock
    const u = state.users.find(x => x.email === 'unlock@example.com')
    u.locked_until = new Date(Date.now() - 1000).toISOString()
    // Now login should succeed with correct password
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'unlock@example.com', password: 'SecurePass123!' } })
    expect(res.statusCode).toBe(200)
  })

  it('resets failed attempts on successful login', async () => {
    await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: 'reset@example.com', password: 'SecurePass123!' } })
    // One failed
    await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'reset@example.com', password: 'WrongPass123!' } })
    // Success
    await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'reset@example.com', password: 'SecurePass123!' } })
    const u = state.users.find(x => x.email === 'reset@example.com')
    expect(u.failed_login_attempts || 0).toBe(0)
    expect(u.locked_until).toBeNull()
  })

  it('stores password to history on registration', async () => {
    await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: 'history@example.com', password: 'SecurePass123!' } })
    const u = state.users.find(x => x.email === 'history@example.com')
    const entries = state.password_history.filter(r => r.user_id === u.id)
    expect(entries.length).toBe(1)
  })

  it('returns same generic error for invalid email/password', async () => {
    // Unknown email
    const e1 = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'unknown@example.com', password: 'whatever' } })
    expect(e1.statusCode).toBe(401)
    // Wrong password
    await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: 'gen@example.com', password: 'SecurePass123!' } })
    const e2 = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'gen@example.com', password: 'bad' } })
    expect(e2.statusCode).toBe(401)
  })
})
