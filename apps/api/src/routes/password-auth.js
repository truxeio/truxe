/**
 * Password Authentication Routes
 *
 * - POST /api/auth/register
 * - POST /api/auth/login
 */

import db, { getPool } from '../database/connection.js'
import config from '../config/index.js'
import PasswordService from '../services/password.js'
import jwtService from '../services/jwt.js'
import sessionService from '../services/session.js'
import rateLimitService from '../services/rate-limit.js'
import passwordResetService from '../services/password-reset.js'
import emailQueue from '../services/email-queue-adapter.js'
import emailVerificationService from '../services/email-verification.js'

const passwordService = new PasswordService({ pool: getPool() })

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

function buildUserResponse(row) {
  return {
    id: row.id,
    email: row.email,
    status: row.status,
    email_verified: Boolean(row.email_verified),
    created_at: row.created_at,
  }
}

function formatVerificationDuration(ms) {
  if (!ms || typeof ms !== 'number') return null
  const minutes = Math.round(ms / 60000)
  if (minutes % 60 === 0) {
    const hours = Math.round(minutes / 60)
    return hours === 1 ? '1 hour' : `${hours} hours`
  }
  return minutes === 1 ? '1 minute' : `${minutes} minutes`
}

function buildVerificationUrl(token) {
  const rawBase =
    config.emailVerification?.verificationUrlBase ||
    config.emailVerification?.baseUrl ||
    config.jwt?.issuer ||
    (config.app?.publicBaseUrl ? config.app.publicBaseUrl : null) ||
    `http://localhost:${process.env.TRUXE_API_PORT || config.app?.port || 87001}`

  const base = rawBase?.endsWith('/') ? rawBase.slice(0, -1) : rawBase
  const path =
    config.emailVerification?.verificationPath ||
    '/api/auth/email/verify'

  if (base && base.includes('{token}')) {
    return base.replace('{token}', encodeURIComponent(token))
  }

  if (path && path.includes('{token}')) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    return `${base || ''}${normalizedPath.replace('{token}', encodeURIComponent(token))}`
  }

  const normalizedBase = base || ''
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const url = `${normalizedBase}${normalizedPath}`
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}token=${encodeURIComponent(token)}`
}

async function queueVerificationEmail({ userId, email, request }) {
  const token = emailVerificationService.generateVerificationToken()
  await emailVerificationService.storeVerificationToken({
    userId,
    token,
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'] || null,
    bypassCooldown: true,
  })

  const verificationUrl = buildVerificationUrl(token)
  const expiresIn = formatVerificationDuration(emailVerificationService.tokenTTL)

  await emailQueue.sendEmailVerification(email, verificationUrl, {
    userName: null,
    expiresIn,
  })
}

export default async function passwordAuthRoutes(fastify) {
  // Per-route rate limiting using the advanced rate limit service
  const rateLimitPlugin = rateLimitService.createFastifyPlugin()
  await fastify.register(rateLimitPlugin)

  // POST /api/auth/register
  fastify.post('/register', {
    schema: {
      description: 'Register a new user with email and password',
      tags: ['Authentication'],
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 1 },
          metadata: { type: 'object', additionalProperties: true },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    email: { type: 'string' },
                    status: { type: 'string' },
                    email_verified: { type: 'boolean' },
                    created_at: { type: 'string' },
                  },
                },
                tokens: {
                  type: 'object',
                  properties: {
                    access_token: { type: 'string' },
                    refresh_token: { type: 'string' },
                    expires_in: { type: 'number' },
                  },
                },
              },
            },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const start = Date.now()
    const ip = request.ip
    const userAgent = request.headers['user-agent'] || null
    const { email: rawEmail, password, metadata = {} } = request.body || {}
    const email = normalizeEmail(rawEmail)

    try {
      // Validate email format (Fastify also validates via schema)
      if (!email) {
        return reply.code(400).send({ error: 'Invalid email', message: 'Invalid email format' })
      }

      // Enforce stronger password policy
      const complexity = passwordService.validatePasswordComplexity(password)
      if (!complexity.valid) {
        return reply.code(400).send({ error: 'Weak password', message: 'Password does not meet complexity requirements' })
      }

      // Check uniqueness
      const existing = await db.query('SELECT id FROM users WHERE email = $1', [email])
      if (existing.rows.length > 0) {
        return reply.code(400).send({ error: 'Email exists', message: 'Email already exists' })
      }

      // Hash password
      const passwordHash = await passwordService.hashPassword(password)

      // Create user
      const insert = await db.query(
        `INSERT INTO users (email, email_verified, status, metadata, password_hash, password_updated_at, failed_login_attempts, locked_until, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), 0, NULL, NOW(), NOW())
         RETURNING id, email, email_verified, status, created_at`,
        [email, false, 'active', JSON.stringify(metadata || {}), passwordHash]
      )
      const user = insert.rows[0]

      // Add to password history
      await passwordService.addPasswordToHistory(user.id, passwordHash)

      // Create token pair and session
      const deviceInfo = request.body?.device_info || {}
      const tokens = await jwtService.createTokenPair({
        userId: user.id,
        email: user.email,
        emailVerified: user.email_verified,
        sessionId: null,
        deviceInfo,
      })

      const session = await sessionService.createSession({
        userId: user.id,
        deviceInfo,
        ip,
        userAgent,
        accessTokenJTI: tokens.accessToken.jti,
        refreshTokenJTI: tokens.refreshToken.jti,
        expiresAt: tokens.refreshToken.expiresAt,
      })

      try {
        await queueVerificationEmail({ userId: user.id, email: user.email, request })
      } catch (error) {
        request.log?.warn({ err: error, user_id: user.id }, 'Failed to send verification email after registration')
      }

      try {
        await emailQueue.sendWelcomeEmail({
          to: user.email,
          userName: user.email.split('@')[0],
        })
      } catch (error) {
        request.log?.warn({ err: error, user_id: user.id }, 'Failed to send welcome email after registration')
      }

      // Respond
      return reply.code(201).send({
        success: true,
        data: {
          user: buildUserResponse(user),
          tokens: {
            access_token: tokens.accessToken.token,
            refresh_token: tokens.refreshToken.token,
            expires_in: tokens.accessToken.expiresIn,
          },
        },
        duration_ms: Date.now() - start,
      })
    } catch (error) {
      request.log.error({ err: error }, 'Registration failed')
      return reply.code(500).send({ error: 'Registration failed', message: 'Unexpected error' })
    }
  })

  // POST /api/auth/login
  fastify.post('/login', {
    schema: {
      description: 'Login with email and password',
      tags: ['Authentication'],
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 1 },
          device_info: { type: 'object', additionalProperties: true },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    email: { type: 'string' },
                    status: { type: 'string' },
                  },
                },
                tokens: {
                  type: 'object',
                  properties: {
                    access_token: { type: 'string' },
                    refresh_token: { type: 'string' },
                    expires_in: { type: 'number' },
                  },
                },
                requires_mfa: { type: 'boolean' },
              },
            },
          },
        },
        401: {
          type: 'object',
          properties: { error: { type: 'string' }, message: { type: 'string' } },
        },
        403: {
          type: 'object',
          properties: { error: { type: 'string' }, message: { type: 'string' } },
        },
        423: {
          type: 'object',
          properties: { error: { type: 'string' }, message: { type: 'string' }, unlock_at: { type: 'string' } },
        },
      },
    },
  }, async (request, reply) => {
    const start = Date.now()
    const ip = request.ip
    const userAgent = request.headers['user-agent'] || null
    const { email: rawEmail, password } = request.body || {}
    const email = normalizeEmail(rawEmail)

    try {
      // Lookup user (case-insensitive)
      const result = await db.query('SELECT * FROM users WHERE email = $1', [email])
      if (result.rows.length === 0) {
        // Avoid info leakage
        return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid email or password' })
      }

      const user = result.rows[0]
      const previousAttempts = user.failed_login_attempts || 0

      // Account status checks
      if (user.status === 'suspended' || user.status === 'deleted' || user.status === 'blocked') {
        return reply.code(403).send({ error: 'Forbidden', message: 'Account not active' })
      }

      // Account lockout check
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        return reply.code(423).send({
          error: 'Account Locked',
          message: 'Account is temporarily locked due to too many failed attempts',
          unlock_at: new Date(user.locked_until).toISOString(),
        })
      }

      // Verify password
      const valid = await passwordService.verifyPassword(user.password_hash || '', password)
      if (!valid) {
        const attempts = (user.failed_login_attempts || 0) + 1
        let lockedUntil = null
        if (attempts >= 5) {
          lockedUntil = new Date(Date.now() + 15 * 60 * 1000)
        }
        const thresholdReached = attempts >= 5 && previousAttempts < 5
        await db.query(
          `UPDATE users SET failed_login_attempts = $2, locked_until = $3, updated_at = NOW() WHERE id = $1`,
          [user.id, attempts, lockedUntil]
        )
        if (lockedUntil && thresholdReached) {
          try {
            await emailQueue.sendAccountLockedNotification({
              to: user.email,
              attemptCount: attempts,
              lockedAt: new Date(),
              lockedUntil,
              ipAddress: ip,
              userAgent,
            })
          } catch (error) {
            request.log?.warn({ err: error, user_id: user.id }, 'Failed to send account locked notification email')
          }
        }
        if (lockedUntil) {
          return reply.code(423).send({
            error: 'Account Locked',
            message: 'Account is temporarily locked due to too many failed attempts',
            unlock_at: lockedUntil.toISOString(),
          })
        }
        return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid email or password' })
      }

      // Successful login: reset counters
      await db.query(
        `UPDATE users SET failed_login_attempts = 0, locked_until = NULL, updated_at = NOW() WHERE id = $1`,
        [user.id]
      )

      // Issue tokens and create session
      const deviceInfo = request.body?.device_info || {}
      const tokens = await jwtService.createTokenPair({
        userId: user.id,
        email: user.email,
        emailVerified: user.email_verified,
        sessionId: null,
        deviceInfo,
      })
      await sessionService.createSession({
        userId: user.id,
        deviceInfo,
        ip,
        userAgent,
        accessTokenJTI: tokens.accessToken.jti,
        refreshTokenJTI: tokens.refreshToken.jti,
        expiresAt: tokens.refreshToken.expiresAt,
      })

      return reply.code(200).send({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            status: user.status,
          },
          tokens: {
            access_token: tokens.accessToken.token,
            refresh_token: tokens.refreshToken.token,
            expires_in: tokens.accessToken.expiresIn,
          },
          requires_mfa: false,
        },
        duration_ms: Date.now() - start,
      })
    } catch (error) {
      request.log.error({ err: error }, 'Login failed')
      return reply.code(500).send({ error: 'Login failed', message: 'Unexpected error' })
    }
  })

  // POST /api/auth/password/forgot
  fastify.post('/password/forgot', {
    schema: {
      description: 'Request password reset email. Always returns 200 to prevent user enumeration.',
      tags: ['Authentication'],
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { email: rawEmail } = request.body || {}
    const email = normalizeEmail(rawEmail)
    const ip = request.ip
    const userAgent = request.headers['user-agent'] || null

    const genericResponse = {
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.',
    }

    try {
      if (!email) return reply.code(200).send(genericResponse)

      const res = await db.query('SELECT id, email FROM users WHERE email = $1', [email])
      if (res.rows.length === 0) {
        return reply.code(200).send(genericResponse)
      }

      const user = res.rows[0]
      const token = passwordResetService.generateResetToken()
      await passwordResetService.storeResetToken({
        userId: user.id,
        token,
        ipAddress: ip,
        userAgent,
      })

      await emailQueue.sendPasswordResetEmail({
        to: user.email,
        resetToken: token,
        ipAddress: ip,
        userAgent,
        requestedAt: new Date(),
        expiresInMinutes: 60,
      })

      return reply.code(200).send(genericResponse)
    } catch (error) {
      request.log.error({ err: error }, 'Password reset request failed')
      return reply.code(200).send(genericResponse)
    } finally {
      // Opportunistic cleanup regardless of outcome
      passwordResetService.cleanExpiredTokens().catch(() => {})
    }
  })

  // POST /api/auth/password/reset
  fastify.post('/password/reset', {
    schema: {
      description: 'Reset password using a single-use token',
      tags: ['Authentication'],
      body: {
        type: 'object',
        required: ['token', 'password'],
        properties: {
          token: { type: 'string', minLength: 10 },
          password: { type: 'string', minLength: 1 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: { error: { type: 'string' }, message: { type: 'string' } },
        },
      },
    },
  }, async (request, reply) => {
    const { token, password } = request.body || {}

    try {
      const validation = await passwordResetService.validateResetToken(token)
      if (!validation.valid) {
        return reply.code(400).send({ error: 'Invalid token', message: validation.error })
      }

      const { tokenId, userId } = validation
      const userLookup = await db.query('SELECT email FROM users WHERE id = $1', [userId])
      const userEmail = userLookup.rows.length > 0 ? userLookup.rows[0].email : null

      const complexity = passwordService.validatePasswordComplexity(password)
      if (!complexity.valid) {
        return reply.code(400).send({ error: 'Weak password', message: 'Password does not meet complexity requirements' })
      }

      const reused = await passwordService.checkPasswordHistory(userId, password)
      if (reused) {
        return reply.code(400).send({ error: 'Password reuse', message: 'Password was recently used' })
      }

      const passwordHash = await passwordService.hashPassword(password)
      await db.query(
        `UPDATE users SET password_hash = $2, password_updated_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [userId, passwordHash]
      )
      await passwordService.addPasswordToHistory(userId, passwordHash)
      await passwordService.cleanPasswordHistory(userId)
      await passwordResetService.markTokenAsUsed(tokenId)

      try {
        await sessionService.revokeAllUserSessions(userId, 'password_reset')
      } catch (_) { }

      if (userEmail) {
        try {
          await emailQueue.sendPasswordResetConfirmation({
            to: userEmail,
            resetAt: new Date(),
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'] || null,
          })
        } catch (error) {
          request.log?.warn({ err: error, user_id: userId }, 'Failed to send password reset confirmation email')
        }
      }

      return reply.code(200).send({ success: true, message: 'Password has been reset successfully. You can now login.' })
    } catch (error) {
      request.log.error({ err: error }, 'Password reset failed')
      return reply.code(400).send({ error: 'Reset failed', message: 'Invalid or expired token' })
    }
  })

  // PUT /api/auth/password/change
  fastify.put('/password/change', {
    onRequest: [fastify.authenticate, fastify.requireEmailVerified],
    schema: {
      description: 'Change password for authenticated user',
      tags: ['Authentication'],
      body: {
        type: 'object',
        required: ['current_password', 'new_password'],
        properties: {
          current_password: { type: 'string', minLength: 1 },
          new_password: { type: 'string', minLength: 1 },
        },
      },
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' }, message: { type: 'string' } } },
        400: { type: 'object', properties: { error: { type: 'string' }, message: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' }, message: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const userId = request.user?.id || request.tokenPayload?.user_id
    const { current_password: currentPassword, new_password: newPassword } = request.body || {}

    try {
      const res = await db.query('SELECT id, email, password_hash FROM users WHERE id = $1', [userId])
      if (res.rows.length === 0) {
        return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid current password' })
      }

      const user = res.rows[0]
      const validCurrent = await passwordService.verifyPassword(user.password_hash || '', currentPassword)
      if (!validCurrent) {
        return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid current password' })
      }

      const complexity = passwordService.validatePasswordComplexity(newPassword)
      if (!complexity.valid) {
        return reply.code(400).send({ error: 'Weak password', message: 'New password does not meet complexity requirements' })
      }

      const reused = await passwordService.checkPasswordHistory(userId, newPassword)
      if (reused) {
        return reply.code(400).send({ error: 'Password reuse', message: 'New password was recently used' })
      }

      const newHash = await passwordService.hashPassword(newPassword)
      await db.query(
        `UPDATE users SET password_hash = $2, password_updated_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [userId, newHash]
      )
      await passwordService.addPasswordToHistory(userId, newHash)
      await passwordService.cleanPasswordHistory(userId)

      try {
        await emailQueue.sendPasswordChangedNotification({
          to: user.email,
          changedAt: new Date(),
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'] || null,
        })
      } catch (error) {
        request.log?.warn({ err: error, user_id: userId }, 'Failed to send password change notification email')
      }

      return reply.code(200).send({ success: true, message: 'Password changed successfully.' })
    } catch (error) {
      request.log.error({ err: error }, 'Password change failed')
      return reply.code(400).send({ error: 'Change failed', message: 'Unable to change password' })
    }
  })
}
