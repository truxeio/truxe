/**
 * Email Verification Routes
 *
 * Endpoints:
 * - POST /api/auth/email/send-verification
 * - GET /api/auth/email/verify
 * - POST /api/auth/email/resend-verification
 * - GET /api/auth/email/verification-status
 */

import db from '../database/connection.js'
import config from '../config/index.js'
import rateLimitService from '../services/rate-limit.js'
import emailQueue from '../services/email-queue-adapter.js'
import emailVerificationService from '../services/email-verification.js'

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

function formatDuration(ms) {
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

  const baseWithoutTrailingSlash = rawBase?.endsWith('/')
    ? rawBase.slice(0, -1)
    : rawBase

  const rawPath =
    config.emailVerification?.verificationPath ||
    '/api/auth/email/verify'

  // Allow placeholder replacement in either base or path
  if (baseWithoutTrailingSlash && baseWithoutTrailingSlash.includes('{token}')) {
    return baseWithoutTrailingSlash.replace('{token}', encodeURIComponent(token))
  }

  if (rawPath && rawPath.includes('{token}')) {
    const normalizedBase = baseWithoutTrailingSlash || ''
    const normalizedPath = rawPath.startsWith('/')
      ? rawPath
      : `/${rawPath}`
    return `${normalizedBase}${normalizedPath.replace('{token}', encodeURIComponent(token))}`
  }

  const normalizedBase = baseWithoutTrailingSlash || ''
  const normalizedPath = rawPath.startsWith('/')
    ? rawPath
    : `/${rawPath}`

  const url = `${normalizedBase}${normalizedPath}`
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}token=${encodeURIComponent(token)}`
}

async function sendVerificationEmail({ userId, email, request, bypassCooldown = false }) {
  const token = emailVerificationService.generateVerificationToken()

  await emailVerificationService.storeVerificationToken({
    userId,
    token,
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'] || null,
    bypassCooldown,
  })

  const verificationUrl = buildVerificationUrl(token)
  const expiresIn = formatDuration(emailVerificationService.tokenTTL)

  await emailQueue.sendEmailVerification(email, verificationUrl, {
    userName: null,
    expiresIn,
  })

  return { verificationUrl, expiresIn }
}

export default async function emailVerificationRoutes(fastify) {
  const rateLimitPlugin = rateLimitService.createFastifyPlugin()
  await fastify.register(rateLimitPlugin)

  fastify.post('/send-verification', {
    schema: {
      description: 'Send email verification link to a user by email',
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
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
        429: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { email: rawEmail } = request.body || {}
    const email = normalizeEmail(rawEmail)

    if (!email) {
      return reply.code(400).send({
        error: 'Invalid email',
        message: 'A valid email address is required.',
      })
    }

    try {
      const result = await db.query(
        'SELECT id, email, email_verified FROM users WHERE email = $1 LIMIT 1',
        [email],
      )

      if (result.rows.length === 0) {
        // Avoid user enumeration by returning generic success
        return reply.code(200).send({
          success: true,
          message: 'Verification email sent',
        })
      }

      const user = result.rows[0]
      if (user.email_verified) {
        return reply.code(200).send({
          success: true,
          message: 'Email already verified',
        })
      }

      try {
        await sendVerificationEmail({
          userId: user.id,
          email: user.email,
          request,
        })
      } catch (error) {
        if (error.code === 'RATE_LIMITED') {
          const retryAfterSec = Math.ceil((error.retryAfterMs || 0) / 1000)
          if (retryAfterSec > 0) {
            reply.header('Retry-After', retryAfterSec)
          }
          return reply.code(429).send({
            error: 'Too Many Requests',
            message: 'A verification email was sent recently. Please try again later.',
          })
        }
        request.log.error({ err: error }, 'Failed to send verification email')
        return reply.code(500).send({
          error: 'Verification failed',
          message: 'Unable to send verification email at this time.',
        })
      }

      return reply.code(200).send({
        success: true,
        message: 'Verification email sent',
      })
    } catch (error) {
      request.log.error({ err: error }, 'Verification email request failed')
      return reply.code(500).send({
        error: 'Verification failed',
        message: 'Unable to process verification request.',
      })
    }
  })

  fastify.post('/resend-verification', {
    onRequest: [fastify.authenticate],
    schema: {
      description: 'Resend verification email for authenticated user',
      tags: ['Authentication'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
        403: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
        429: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    if (request.user?.emailVerified) {
      return reply.code(403).send({
        error: 'Already Verified',
        message: 'Email address is already verified.',
      })
    }

    const userId = request.user?.id || request.tokenPayload?.user_id

    try {
      const result = await db.query(
        'SELECT id, email, email_verified FROM users WHERE id = $1 LIMIT 1',
        [userId],
      )

      if (result.rows.length === 0) {
        return reply.code(403).send({
          error: 'Unauthorized',
          message: 'User record not found.',
        })
      }

      const user = result.rows[0]
      if (user.email_verified) {
        return reply.code(403).send({
          error: 'Already Verified',
          message: 'Email address is already verified.',
        })
      }

      try {
        await sendVerificationEmail({
          userId: user.id,
          email: user.email,
          request,
        })
      } catch (error) {
        if (error.code === 'RATE_LIMITED') {
          const retryAfterSec = Math.ceil((error.retryAfterMs || 0) / 1000)
          if (retryAfterSec > 0) {
            reply.header('Retry-After', retryAfterSec)
          }
          return reply.code(429).send({
            error: 'Too Many Requests',
            message: 'Verification email was recently sent. Please try again later.',
          })
        }
        request.log.error({ err: error }, 'Failed to resend verification email')
        return reply.code(500).send({
          error: 'Verification failed',
          message: 'Unable to send verification email at this time.',
        })
      }

      return reply.code(200).send({
        success: true,
        message: 'Verification email resent',
      })
    } catch (error) {
      request.log.error({ err: error }, 'Resend verification failed')
      return reply.code(500).send({
        error: 'Verification failed',
        message: 'Unable to resend verification email.',
      })
    }
  })

  fastify.get('/verify', {
    schema: {
      description: 'Verify email address using a token',
      tags: ['Authentication'],
      querystring: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string', minLength: 10 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            verified_at: { type: 'string' },
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
    const { token } = request.query || {}
    try {
      const validation = await emailVerificationService.validateVerificationToken(token)
      if (!validation.valid) {
        return reply.code(400).send({
          error: 'Invalid token',
          message: validation.error,
        })
      }

      const { userId, tokenId } = validation
      const userResult = await db.query(
        'SELECT id, email, email_verified, email_verified_at FROM users WHERE id = $1 LIMIT 1',
        [userId],
      )

      if (userResult.rows.length === 0) {
        return reply.code(400).send({
          error: 'Invalid token',
          message: 'Unable to verify email with this token.',
        })
      }

      const user = userResult.rows[0]

      await emailVerificationService.markTokenAsUsed(tokenId)
      const verification = await emailVerificationService.markEmailAsVerified(userId)

      const verifiedAt = verification.emailVerifiedAt || user.email_verified_at || new Date()

      try {
        await emailQueue.sendEmailVerifiedConfirmation(user.email, {
          verifiedAt,
        })
      } catch (emailError) {
        request.log.warn({ err: emailError }, 'Failed to send verification confirmation email')
      }

      return reply.code(200).send({
        success: true,
        message: 'Email verified successfully',
        verified_at: new Date(verifiedAt).toISOString(),
      })
    } catch (error) {
      request.log.error({ err: error }, 'Email verification failed')
      return reply.code(400).send({
        error: 'Verification failed',
        message: 'Invalid or expired verification token.',
      })
    }
  })

  fastify.get('/verification-status', {
    onRequest: [fastify.authenticate],
    schema: {
      description: 'Get email verification status for authenticated user',
      tags: ['Authentication'],
      response: {
        200: {
          type: 'object',
          properties: {
            verified: { type: 'boolean' },
            verified_at: { type: ['string', 'null'] },
          },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user?.id || request.tokenPayload?.user_id
    try {
      const result = await db.query(
        'SELECT email_verified, email_verified_at FROM users WHERE id = $1 LIMIT 1',
        [userId],
      )

      if (result.rows.length === 0) {
        return reply.code(200).send({
          verified: false,
          verified_at: null,
        })
      }

      const user = result.rows[0]
      return reply.code(200).send({
        verified: Boolean(user.email_verified),
        verified_at: user.email_verified_at ? new Date(user.email_verified_at).toISOString() : null,
      })
    } catch (error) {
      request.log.error({ err: error }, 'Failed to fetch verification status')
      return reply.code(500).send({
        error: 'Verification status unavailable',
        message: 'Unable to retrieve verification status.',
      })
    }
  })
}
