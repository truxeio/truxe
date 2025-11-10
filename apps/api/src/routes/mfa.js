import totpService from '../services/mfa/totp-service.js'
import rateLimitService from '../services/rate-limit.js'
import db from '../database/connection.js'

export default async function mfaRoutes(fastify, options) {
  fastify.post('/setup', {
    onRequest: [fastify.authenticate],
    schema: {
      description: 'Initiate TOTP MFA setup and return secret, QR code, and otpauth URL',
      tags: ['Authentication'],
      response: {
        200: {
          type: 'object',
          properties: {
            secret: { type: 'string' },
            qrCode: { type: 'string' },
            otpauthUrl: { type: 'string' },
            manualEntryCode: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    // Rate limit setup attempts
    await rateLimitService.checkEndpointLimits?.('totp_setup', { user: request.user.id, ip: request.ip })
    const result = await totpService.generateSecret(request.user.id, request.user.email)
    return reply.send(result)
  })

  fastify.post('/enable', {
    onRequest: [fastify.authenticate],
    schema: {
      description: 'Verify a TOTP token and enable MFA, returning backup codes',
      tags: ['Authentication'],
      body: {
        type: 'object',
        required: ['token'],
        properties: { token: { type: 'string', minLength: 6, maxLength: 10 } },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            backupCodes: { type: 'array', items: { type: 'string' } },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { token } = request.body
    const allowed = await rateLimitService.checkEndpointLimits?.('totp_verify', { user: request.user.id, ip: request.ip })
    if (allowed && allowed.allowed === false) {
      return reply.code(429).send({ error: 'Rate Limit Exceeded', message: 'Too many attempts. Try later.', retryAfter: allowed.mostRestrictive?.retryAfter })
    }

    const ok = await totpService.verifyToken(request.user.id, token)
    if (!ok) {
      return reply.code(400).send({ error: 'Invalid Token', message: 'TOTP code is invalid or expired' })
    }
    const backupCodes = await totpService.generateBackupCodes(request.user.id)
    return reply.send({ success: true, backupCodes, message: 'MFA enabled successfully. Save your backup codes.' })
  })

  fastify.get('/status', {
    onRequest: [fastify.authenticate],
    schema: {
      description: 'Get MFA status for the current user',
      tags: ['Authentication'],
      response: {
        200: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' },
            backupCodesRemaining: { type: 'number' },
            updatedAt: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async (request, reply) => {
    const status = await totpService.getStatus(request.user.id)
    return reply.send(status)
  })

  fastify.post('/verify', {
    onRequest: [fastify.authenticate],
    schema: {
      description: 'Verify a TOTP token for login challenge',
      tags: ['Authentication'],
      body: { type: 'object', required: ['token'], properties: { token: { type: 'string' } } },
      response: { 200: { type: 'object', properties: { success: { type: 'boolean' } } } },
    },
  }, async (request, reply) => {
    const { token } = request.body
    const limited = await rateLimitService.checkEndpointLimits?.('totp_verify', { user: request.user.id, ip: request.ip })
    if (limited && limited.allowed === false) {
      return reply.code(429).send({ error: 'Rate Limit Exceeded', message: 'Too many attempts. Try later.', retryAfter: limited.mostRestrictive?.retryAfter })
    }
    const ok = await totpService.verifyToken(request.user.id, token)
    return reply.send({ success: !!ok })
  })

  fastify.post('/backup/verify', {
    onRequest: [fastify.authenticate],
    schema: {
      description: 'Verify a backup code for login challenge',
      tags: ['Authentication'],
      body: { type: 'object', required: ['code'], properties: { code: { type: 'string' } } },
      response: { 200: { type: 'object', properties: { success: { type: 'boolean' } } } },
    },
  }, async (request, reply) => {
    const { code } = request.body
    const limited = await rateLimitService.checkEndpointLimits?.('backup_code_verify', { user: request.user.id, ip: request.ip })
    if (limited && limited.allowed === false) {
      return reply.code(429).send({ error: 'Rate Limit Exceeded', message: 'Too many attempts. Try later.', retryAfter: limited.mostRestrictive?.retryAfter })
    }
    const ok = await totpService.verifyBackupCode(request.user.id, code)
    return reply.send({ success: !!ok })
  })

  // Disable MFA (requires TOTP token or a valid backup code)
  fastify.post('/disable', {
    onRequest: [fastify.authenticate],
    schema: {
      description: 'Disable TOTP MFA for current user (requires verification)',
      tags: ['Authentication'],
      body: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          backupCode: { type: 'string' },
        },
      },
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' } } },
      },
    },
  }, async (request, reply) => {
    const { token, backupCode } = request.body || {}
    if (!token && !backupCode) {
      return reply.code(400).send({ error: 'Bad Request', message: 'Provide token or backupCode' })
    }

    let verified = false
    if (token) verified = await totpService.verifyToken(request.user.id, token)
    if (!verified && backupCode) verified = await totpService.verifyBackupCode(request.user.id, backupCode)
    if (!verified) {
      return reply.code(400).send({ error: 'Invalid Verification', message: 'Failed to verify for disable' })
    }

    await db.query('UPDATE mfa_settings SET totp_secret = NULL, totp_verified = FALSE, backup_codes = NULL, updated_at = NOW() WHERE user_id = $1', [request.user.id])
    return reply.send({ success: true })
  })

  // Regenerate backup codes (requires a valid TOTP token)
  fastify.post('/backup/regenerate', {
    onRequest: [fastify.authenticate],
    schema: {
      description: 'Regenerate backup codes for current user (requires TOTP token)',
      tags: ['Authentication'],
      body: {
        type: 'object',
        required: ['token'],
        properties: { token: { type: 'string' } },
      },
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' }, backupCodes: { type: 'array', items: { type: 'string' } } } },
      },
    },
  }, async (request, reply) => {
    const { token } = request.body
    const ok = await totpService.verifyToken(request.user.id, token)
    if (!ok) {
      return reply.code(400).send({ error: 'Invalid Token', message: 'TOTP code is invalid or expired' })
    }
    const backupCodes = await totpService.generateBackupCodes(request.user.id)
    return reply.send({ success: true, backupCodes })
  })

  // Login-time MFA challenge verification (no auth required)
  fastify.post('/challenge/verify', {
    schema: {
      description: 'Complete login by verifying MFA challenge and issuing tokens',
      tags: ['Authentication'],
      body: {
        type: 'object',
        required: ['challengeId'],
        properties: {
          challengeId: { type: 'string' },
          token: { type: 'string' },
          backupCode: { type: 'string' },
          trustDevice: { type: 'boolean' },
        },
      },
    },
  }, async (request, reply) => {
    const { challengeId, token, backupCode } = request.body
    if (!challengeId || (!token && !backupCode)) {
      return reply.code(400).send({ error: 'Bad Request', message: 'Provide token or backupCode with challengeId' })
    }

    const raw = await request.server.redis.get(`mfa:challenge:${challengeId}`)
    if (!raw) {
      return reply.code(400).send({ error: 'Invalid Challenge', message: 'Challenge expired or not found' })
    }

    const ctx = JSON.parse(raw)

    // Rate limit per user/IP
    const limited = await rateLimitService.checkEndpointLimits?.(token ? 'totp_verify' : 'backup_code_verify', { user: ctx.userId, ip: request.ip })
    if (limited && limited.allowed === false) {
      return reply.code(429).send({ error: 'Rate Limit Exceeded', message: 'Too many attempts. Try later.', retryAfter: limited.mostRestrictive?.retryAfter })
    }

    let ok = false
    if (token) ok = await totpService.verifyToken(ctx.userId, token)
    if (backupCode && !ok) ok = await totpService.verifyBackupCode(ctx.userId, backupCode)
    if (!ok) {
      return reply.code(400).send({ error: 'Invalid Code', message: 'Verification failed' })
    }

    // Issue tokens and create session mirroring /auth/verify
    const { default: jwtService } = await import('../services/jwt.js')
    const { default: sessionService } = await import('../services/session.js')
    const { default: advancedSessionSecurityService } = await import('../services/advanced-session-security.js')
    const { default: webhookEventsService } = await import('../services/webhook-events.js')

    // Minimal user fetch: we assume ctx.userId is valid; fetch email
    const u = await db.query('SELECT id, email, email_verified FROM users WHERE id = $1', [ctx.userId])
    const user = { id: u.rows[0].id, email: u.rows[0].email, emailVerified: u.rows[0].email_verified }

    const tokens = await (await jwtService).createTokenPair({
      userId: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      orgId: null,
      role: null,
      permissions: [],
      sessionId: null,
      deviceInfo: ctx.deviceInfo,
    })

    await (await advancedSessionSecurityService).enforceAdvancedSessionLimits(user.id, { deviceInfo: ctx.deviceInfo, ip: ctx.ip, userAgent: ctx.userAgent })

    const session = await (await sessionService).createSession({
      userId: user.id,
      orgId: null,
      deviceInfo: ctx.deviceInfo,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      accessTokenJTI: tokens.accessToken.jti,
      refreshTokenJTI: tokens.refreshToken.jti,
      expiresAt: tokens.refreshToken.expiresAt,
    })

    await (await advancedSessionSecurityService).logSecurityEvent({
      userId: user.id,
      action: 'session.created',
      target: { type: 'session', id: session.jti },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      deviceInfo: ctx.deviceInfo,
      sessionId: session.jti,
      severity: 'info',
      details: { mfa: true },
    })

    try {
      await (await webhookEventsService).triggerUserLogin(user, session, {
        orgId: null,
        loginMethod: 'magic_link_mfa',
        isNewDevice: false,
        location: null,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      })
    } catch {}

    await request.server.redis.del(`mfa:challenge:${challengeId}`)

    return reply.send({ success: true, user: { id: user.id, email: user.email }, tokens: {
      accessToken: tokens.accessToken.token,
      refreshToken: tokens.refreshToken.token,
      expiresIn: tokens.accessToken.expiresIn,
      tokenType: 'Bearer',
    } })
  })
}


