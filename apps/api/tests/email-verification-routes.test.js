import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import Fastify from 'fastify'
import emailVerificationRoutes from '../src/routes/email-verification.js'
import emailQueue from '../src/services/email-queue-adapter.js'
import emailVerificationService from '../src/services/email-verification.js'

const state = {
  users: [],
}

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

jest.mock('../src/services/email-queue-adapter.js', () => ({
  __esModule: true,
  default: {
    sendEmailVerification: jest.fn(async () => ({ success: true })),
    sendEmailVerifiedConfirmation: jest.fn(async () => ({ success: true })),
    sendPasswordResetEmail: jest.fn(async () => ({ success: true })),
  },
}))

jest.mock('../src/services/email-verification.js', () => ({
  __esModule: true,
  default: {
    tokenTTL: 24 * 60 * 60 * 1000,
    generateVerificationToken: jest.fn(() => 'mock-token'),
    storeVerificationToken: jest.fn(async () => ({ id: 'evt-1' })),
    validateVerificationToken: jest.fn(async () => ({ valid: true, tokenId: 'evt-1', userId: 'user-1' })),
    markTokenAsUsed: jest.fn(async () => new Date().toISOString()),
    markEmailAsVerified: jest.fn(async () => ({ emailVerified: true, emailVerifiedAt: new Date().toISOString() })),
  },
}))

function resetState() {
  state.users = []
}

function mockQuery(sql, params) {
  const text = typeof sql === 'string' ? sql : sql.text
  const lower = text.trim().toLowerCase()

  if (lower.startsWith('select') && lower.includes('from users') && lower.includes('where email =')) {
    const email = params[0]
    return { rows: state.users.filter(u => u.email === email) }
  }

  if (lower.startsWith('select') && lower.includes('from users') && lower.includes('where id =')) {
    const id = params[0]
    return { rows: state.users.filter(u => u.id === id) }
  }

  if (lower.startsWith('select') && lower.includes('email_verified_at') && lower.includes('from users')) {
    const id = params[0]
    return { rows: state.users.filter(u => u.id === id).map(u => ({
      email_verified: u.email_verified,
      email_verified_at: u.email_verified_at,
    })) }
  }

  return { rows: [] }
}

function addUser({ id, email, email_verified = false, email_verified_at = null }) {
  const existing = state.users.find(u => u.id === id)
  if (existing) {
    existing.email = email
    existing.email_verified = email_verified
    existing.email_verified_at = email_verified_at
    return existing
  }
  const user = { id, email, email_verified, email_verified_at }
  state.users.push(user)
  return user
}

let app

describe('Email Verification Routes', () => {
  beforeEach(async () => {
    resetState()
    jest.clearAllMocks()
    emailVerificationService.storeVerificationToken.mockImplementation(async () => ({ id: 'evt-1' }))
    emailVerificationService.validateVerificationToken.mockImplementation(async () => ({ valid: true, tokenId: 'evt-1', userId: 'user-1' }))
    emailVerificationService.markTokenAsUsed.mockImplementation(async () => new Date().toISOString())
    emailVerificationService.markEmailAsVerified.mockImplementation(async (userId) => {
      const user = state.users.find(u => u.id === userId)
      if (user) {
        user.email_verified = true
        const timestamp = new Date().toISOString()
        user.email_verified_at = timestamp
        return { emailVerified: true, emailVerifiedAt: timestamp }
      }
      return { emailVerified: false, emailVerifiedAt: null }
    })
    emailQueue.sendEmailVerification.mockImplementation(async () => ({ success: true }))
    emailQueue.sendEmailVerifiedConfirmation.mockImplementation(async () => ({ success: true }))
    app = Fastify({ logger: false })
    app.decorate('authenticate', async (request, reply) => {
      const auth = request.headers.authorization || ''
      if (!auth.startsWith('Bearer ')) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }
      const userId = auth.substring('Bearer '.length)
      const user = state.users.find(u => u.id === userId)
      if (!user) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }
      request.user = { id: user.id, email: user.email, emailVerified: Boolean(user.email_verified) }
      request.tokenPayload = { user_id: user.id }
    })
    app.decorate('requireEmailVerified', async () => {})
    await app.register(emailVerificationRoutes, { prefix: '/api/auth/email' })
  })

  afterEach(async () => {
    await app.close()
    jest.clearAllMocks()
  })

  it('sends verification email for existing unverified user', async () => {
    addUser({ id: 'user-1', email: 'user@example.com', email_verified: false })
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/email/send-verification',
      payload: { email: 'user@example.com' },
    })

    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toEqual({
      success: true,
      message: 'Verification email sent',
    })
    expect(emailVerificationService.storeVerificationToken).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
    }))
    expect(emailQueue.sendEmailVerification).toHaveBeenCalledWith(
      'user@example.com',
      expect.any(String),
      expect.objectContaining({ expiresIn: expect.any(String) }),
    )
  })

  it('returns success without sending email when user not found', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/email/send-verification',
      payload: { email: 'missing@example.com' },
    })

    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toEqual({
      success: true,
      message: 'Verification email sent',
    })
    expect(emailVerificationService.storeVerificationToken).not.toHaveBeenCalled()
    expect(emailQueue.sendEmailVerification).not.toHaveBeenCalled()
  })

  it('returns 429 when verification request is rate limited', async () => {
    addUser({ id: 'user-2', email: 'slow@example.com' })
    const rateError = new Error('Too soon')
    rateError.code = 'RATE_LIMITED'
    rateError.retryAfterMs = 5000
    emailVerificationService.storeVerificationToken.mockRejectedValueOnce(rateError)

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/email/send-verification',
      payload: { email: 'slow@example.com' },
    })

    expect(response.statusCode).toBe(429)
    const body = JSON.parse(response.body)
    expect(body.error).toBe('Too Many Requests')
    expect(response.headers['retry-after']).toBe('5')
  })

  it('rejects invalid email payload', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/email/send-verification',
      payload: { email: 'not-an-email' },
    })

    expect(response.statusCode).toBe(400)
  })

  it('resends verification email for authenticated unverified user', async () => {
    addUser({ id: 'user-3', email: 'auth@example.com', email_verified: false })
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/email/resend-verification',
      headers: { Authorization: 'Bearer user-3' },
    })

    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toEqual({
      success: true,
      message: 'Verification email resent',
    })
    expect(emailVerificationService.storeVerificationToken).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-3' }))
  })

  it('returns 403 when resending for already verified user', async () => {
    addUser({ id: 'user-4', email: 'done@example.com', email_verified: true })
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/email/resend-verification',
      headers: { Authorization: 'Bearer user-4' },
    })

    expect(response.statusCode).toBe(403)
    expect(JSON.parse(response.body).error).toBe('Already Verified')
  })

  it('returns 429 when resend hits cooldown', async () => {
    addUser({ id: 'user-5', email: 'cooldown@example.com', email_verified: false })
    const error = new Error('Limited')
    error.code = 'RATE_LIMITED'
    error.retryAfterMs = 120000
    emailVerificationService.storeVerificationToken.mockRejectedValueOnce(error)

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/email/resend-verification',
      headers: { Authorization: 'Bearer user-5' },
    })

    expect(response.statusCode).toBe(429)
    expect(response.headers['retry-after']).toBe('120')
  })

  it('requires authentication for resend endpoint', async () => {
    addUser({ id: 'user-6', email: 'noauth@example.com', email_verified: false })
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/email/resend-verification',
    })

    expect(response.statusCode).toBe(401)
  })

  it('verifies email successfully and sends confirmation', async () => {
    addUser({ id: 'user-7', email: 'verify@example.com', email_verified: false })
    emailVerificationService.validateVerificationToken.mockResolvedValueOnce({
      valid: true,
      tokenId: 'evt-9',
      userId: 'user-7',
    })

    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/email/verify?token=valid-token',
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.success).toBe(true)
    expect(body.message).toBe('Email verified successfully')
    expect(body.verified_at).toBeDefined()
    expect(emailVerificationService.markTokenAsUsed).toHaveBeenCalledWith('evt-9')
    expect(emailVerificationService.markEmailAsVerified).toHaveBeenCalledWith('user-7')
    expect(emailQueue.sendEmailVerifiedConfirmation).toHaveBeenCalledWith(
      'verify@example.com',
      expect.objectContaining({ verifiedAt: expect.any(String) }),
    )
    const user = state.users.find(u => u.id === 'user-7')
    expect(user.email_verified).toBe(true)
  })

  it('returns 400 for invalid verification token', async () => {
    emailVerificationService.validateVerificationToken.mockResolvedValueOnce({ valid: false, error: 'Invalid token' })
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/email/verify?token=bad',
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 400 when user is missing during verification', async () => {
    emailVerificationService.validateVerificationToken.mockResolvedValueOnce({
      valid: true,
      tokenId: 'evt-missing',
      userId: 'missing-user',
    })

    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/email/verify?token=unknown',
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns unverified status for authenticated user', async () => {
    addUser({ id: 'user-8', email: 'status@example.com', email_verified: false })
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/email/verification-status',
      headers: { Authorization: 'Bearer user-8' },
    })

    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toEqual({
      verified: false,
      verified_at: null,
    })
  })

  it('returns verified status with timestamp', async () => {
    const timestamp = new Date().toISOString()
    addUser({ id: 'user-9', email: 'ready@example.com', email_verified: true, email_verified_at: timestamp })
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/email/verification-status',
      headers: { Authorization: 'Bearer user-9' },
    })

    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toEqual({
      verified: true,
      verified_at: timestamp,
    })
  })

  it('requires authentication for verification status endpoint', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/email/verification-status',
    })

    expect(response.statusCode).toBe(401)
  })
})
