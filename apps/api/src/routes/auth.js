/**
 * Authentication Routes
 * 
 * RESTful API endpoints for authentication:
 * - POST /auth/magic-link - Request magic link
 * - GET /auth/verify - Verify magic link token
 * - POST /auth/refresh - Refresh JWT tokens
 * - POST /auth/revoke - Revoke session
 * - GET /auth/me - Get current user
 * - POST /auth/logout - Logout user
 */

import jwtService from '../services/jwt.js'
import sessionService from '../services/session.js'
import advancedSessionSecurityService from '../services/advanced-session-security.js'
import refreshTokenRotationService from '../services/refresh-token-rotation.js'
import threatDetectionService from '../services/threat-detection.js'
import securityIncidentResponseService from '../services/security-incident-response.js'
import magicLinkService from '../services/magic-link.js'
import emailService from '../services/email.js'
import rbac from '../middleware/rbac.js'
import config from '../config/index.js'
import webhookEventsService from '../services/webhook-events.js'
import db from '../database/connection.js'
import { v4 as uuidv4 } from 'uuid'

/**
 * Authentication routes plugin
 */
export default async function authRoutes(fastify, options) {
  // Request magic link
  fastify.post('/magic-link', {
    schema: {
      description: 'Request a magic link for passwordless authentication',
      tags: ['Authentication'],
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address',
          },
          orgSlug: {
            type: 'string',
            pattern: '^[a-z0-9][a-z0-9-]*[a-z0-9]$',
            description: 'Organization slug for direct login',
          },
          redirectUri: {
            type: 'string',
            format: 'uri',
            description: 'Custom redirect URI for magic link callback (optional)',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            email: { type: 'string' },
            expiresIn: { type: 'number' },
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
            retryAfter: { type: 'number' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { email, orgSlug, redirectUri } = request.body
      const ip = request.ip
      const userAgent = request.headers['user-agent']

      // Validate email format
      if (!magicLinkService.isValidEmail(email)) {
        return reply.code(400).send({
          error: 'Invalid Email',
          message: 'Please provide a valid email address',
        })
      }

      // Check if magic links are enabled
      if (!config.features.magicLinks) {
        return reply.code(503).send({
          error: 'Service Unavailable',
          message: 'Magic link authentication is currently disabled',
        })
      }

      // Create magic link challenge
      const challenge = await magicLinkService.createChallenge({
        email: email.toLowerCase(),
        orgSlug,
        redirectUri,
        ip,
        userAgent,
      })
      
      // Send magic link email
      await emailService.sendMagicLink({
        email: email.toLowerCase(),
        magicLinkUrl: challenge.magicLinkUrl,
        orgName: orgSlug, // TODO: Get org name from slug
        requestedAt: challenge.createdAt || new Date(),
        ipAddress: ip,
        userAgent,
      })
      
      return reply.send({
        success: true,
        message: 'Magic link sent! Check your email and click the link to sign in.',
        email: email.toLowerCase(),
        expiresIn: Math.floor(config.magicLink.ttl / 1000),
      })
    } catch (error) {
      fastify.log.error('Magic link request failed:', error.message)
      
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to send magic link. Please try again.',
      })
    }
  })
  
  // Verify magic link token
  fastify.get('/verify', {
    schema: {
      description: 'Verify magic link token and authenticate user',
      tags: ['Authentication'],
      querystring: {
        type: 'object',
        required: ['token'],
        properties: {
          token: {
            type: 'string',
            minLength: 16,
            description: 'Magic link token',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address (optional)',
          },
          org: {
            type: 'string',
            description: 'Organization slug (optional)',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                emailVerified: { type: 'boolean' },
                status: { type: 'string' },
              },
            },
            tokens: {
              type: 'object',
              properties: {
                accessToken: { type: 'string' },
                refreshToken: { type: 'string' },
                expiresIn: { type: 'number' },
                tokenType: { type: 'string' },
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
    try {
      const { token, email, org } = request.query
      const ip = request.ip
      const userAgent = request.headers['user-agent']
      
      // Verify magic link token
      const verification = await magicLinkService.verifyChallenge(token, {
        ip,
        userAgent,
      })
      
      const { user, challenge } = verification
      
      // Generate advanced device fingerprint
      const deviceInfo = advancedSessionSecurityService.generateAdvancedDeviceFingerprint(
        request,
        { verificationMethod: 'magic_link' }
      )
      
      // Check if device is recognized
      const deviceRecognition = await advancedSessionSecurityService.isDeviceRecognized(
        user.id,
        deviceInfo
      )
      
      // Detect impossible travel
      const impossibleTravel = await advancedSessionSecurityService.detectImpossibleTravel(
        user.id,
        { ip },
        new Date()
      )
      
      // Detect suspicious patterns
      const suspiciousPatterns = await advancedSessionSecurityService.detectSuspiciousPatterns(
        user.id,
        { deviceInfo, ip, userAgent }
      )
      
      // Detect account takeover
      const accountTakeover = await threatDetectionService.detectAccountTakeover(user.id, {
        ip,
        userAgent,
        deviceInfo,
        location: impossibleTravel.currentLocation,
        timestamp: Date.now(),
      })
      
      // Detect suspicious activity
      const suspiciousActivity = await threatDetectionService.detectSuspiciousActivity(user.id, {
        ip,
        userAgent,
        deviceInfo,
        action: 'magic_link_verification',
        timestamp: Date.now(),
      })
      
      // Log security events
      if (!deviceRecognition.recognized) {
        await advancedSessionSecurityService.logSecurityEvent({
          userId: user.id,
          action: 'session.new_device_detected',
          target: { type: 'device', id: deviceInfo.stableFingerprint },
          ip,
          userAgent,
          deviceInfo,
          severity: 'info',
          details: {
            previousSessions: deviceRecognition.previousSessions,
            deviceInfo,
          },
        })
      }
      
      if (impossibleTravel.impossibleTravel) {
        await advancedSessionSecurityService.logSecurityEvent({
          userId: user.id,
          action: 'session.impossible_travel_detected',
          target: { type: 'user', id: user.id },
          ip,
          userAgent,
          deviceInfo,
          severity: 'high',
          details: impossibleTravel,
        })
      }
      
      if (suspiciousPatterns.suspicious) {
        await advancedSessionSecurityService.logSecurityEvent({
          userId: user.id,
          action: 'session.suspicious_patterns_detected',
          target: { type: 'user', id: user.id },
          ip,
          userAgent,
          deviceInfo,
          severity: suspiciousPatterns.riskScore > 50 ? 'high' : 'medium',
          details: suspiciousPatterns,
        })
      }
      
      // Process security incidents
      if (accountTakeover.isTakeover) {
        await securityIncidentResponseService.processIncident({
          type: 'account_takeover',
          source: 'magic_link_verification',
          userId: user.id,
          ip,
          userAgent,
          deviceInfo,
          details: {
            riskScore: accountTakeover.riskScore,
            riskFactors: accountTakeover.riskFactors,
            recentLogins: accountTakeover.recentLogins,
          },
        })
      }
      
      if (suspiciousActivity.suspicious) {
        await securityIncidentResponseService.processIncident({
          type: 'suspicious_activity',
          source: 'magic_link_verification',
          userId: user.id,
          ip,
          userAgent,
          deviceInfo,
          details: {
            riskScore: suspiciousActivity.riskScore,
            patterns: suspiciousActivity.patterns,
            action: 'magic_link_verification',
          },
        })
      }
      
      if (impossibleTravel.impossibleTravel) {
        await securityIncidentResponseService.processIncident({
          type: 'impossible_travel',
          source: 'magic_link_verification',
          userId: user.id,
          ip,
          userAgent,
          deviceInfo,
          details: impossibleTravel,
        })
      }
      
      // If user has MFA enabled, return MFA challenge and skip token issuance
      const mfa = await db.query('SELECT totp_verified FROM mfa_settings WHERE user_id = $1', [user.id])
      if (mfa.rows[0]?.totp_verified) {
        const challengeId = uuidv4()
        const payload = JSON.stringify({ userId: user.id, ip, userAgent, deviceInfo })
        const ttlSeconds = 300 // 5 minutes
        await request.server.redis.setex(`mfa:challenge:${challengeId}`, ttlSeconds, payload)
        return reply.send({
          success: true,
          mfaRequired: true,
          challengeId,
          message: 'MFA required. Verify with your authenticator app.'
        })
      }

      // Create JWT tokens
      const tokens = await jwtService.createTokenPair({
        userId: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        orgId: challenge.orgSlug ? null : null, // TODO: Get org ID from slug
        role: null, // TODO: Get user role in org
        permissions: [],
        sessionId: null, // Will be set after session creation
        deviceInfo,
      })
      
      // Enforce advanced session limits before creating new session
      await advancedSessionSecurityService.enforceAdvancedSessionLimits(
        user.id,
        { deviceInfo, ip, userAgent }
      )
      
      // Create session
      const session = await sessionService.createSession({
        userId: user.id,
        orgId: challenge.orgSlug ? null : null, // TODO: Get org ID from slug
        deviceInfo,
        ip,
        userAgent,
        accessTokenJTI: tokens.accessToken.jti,
        refreshTokenJTI: tokens.refreshToken.jti,
        expiresAt: tokens.refreshToken.expiresAt,
      })
      
      // Log successful session creation
      await advancedSessionSecurityService.logSecurityEvent({
        userId: user.id,
        action: 'session.created',
        target: { type: 'session', id: session.jti },
        ip,
        userAgent,
        deviceInfo,
        sessionId: session.jti,
        severity: 'info',
        details: {
          deviceRecognized: deviceRecognition.recognized,
          impossibleTravel: impossibleTravel.impossibleTravel,
          suspiciousActivity: suspiciousPatterns.suspicious,
          riskScore: suspiciousPatterns.riskScore,
        },
      })
      
      // Trigger webhook events
      try {
        // Trigger user login event
        await webhookEventsService.triggerUserLogin(user, session, {
          orgId: challenge.orgSlug ? null : null, // TODO: Get org ID from slug
          loginMethod: 'magic_link',
          isNewDevice: !deviceRecognition.recognized,
          location: impossibleTravel.currentLocation,
          ip,
          userAgent,
        })
        
        // Trigger session created event
        await webhookEventsService.triggerSessionCreated(session, user, {
          creationMethod: 'magic_link',
        })
        
        // Trigger security events if detected
        if (!deviceRecognition.recognized) {
          await webhookEventsService.triggerNewDeviceLogin(user, session, deviceInfo, {
            orgId: challenge.orgSlug ? null : null,
            location: impossibleTravel.currentLocation,
          })
        }
        
        if (impossibleTravel.impossibleTravel) {
          await webhookEventsService.triggerImpossibleTravel(user, impossibleTravel, {
            orgId: challenge.orgSlug ? null : null,
          })
        }
        
        if (suspiciousPatterns.suspicious) {
          await webhookEventsService.triggerSuspiciousActivity(user, {
            type: 'login_patterns',
            description: 'Suspicious login patterns detected',
            risk_score: suspiciousPatterns.riskScore,
            patterns: suspiciousPatterns.patterns || [],
            ip,
            user_agent: userAgent,
            location: impossibleTravel.currentLocation,
            severity: suspiciousPatterns.riskScore > 50 ? 'high' : 'medium',
          }, {
            orgId: challenge.orgSlug ? null : null,
          })
        }
        
        if (accountTakeover.isTakeover) {
          await webhookEventsService.triggerAccountTakeover(user, accountTakeover, {
            orgId: challenge.orgSlug ? null : null,
            ip,
            userAgent,
          })
        }
      } catch (webhookError) {
        // Log webhook error but don't fail the authentication
        fastify.log.error('Failed to trigger webhook events:', webhookError.message)
      }
      
      // Set secure HTTP-only cookies for tokens
      reply.setCookie('truxe_access_token', tokens.accessToken.token, {
        httpOnly: true,
        secure: config.app.environment === 'production',
        sameSite: 'lax',
        maxAge: tokens.accessToken.expiresIn,
        path: '/',
      })

      reply.setCookie('truxe_refresh_token', tokens.refreshToken.token, {
        httpOnly: true,
        secure: config.app.environment === 'production',
        sameSite: 'lax',
        maxAge: tokens.refreshToken.expiresIn,
        path: '/',
      })
      
      return reply.send({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          emailVerified: user.emailVerified,
          status: user.status,
          metadata: user.metadata,
        },
        tokens: {
          accessToken: tokens.accessToken.token,
          refreshToken: tokens.refreshToken.token,
          expiresIn: tokens.accessToken.expiresIn,
          tokenType: 'Bearer',
        },
        session: {
          id: session.jti,
          expiresAt: session.expiresAt,
          deviceInfo: session.deviceInfo,
        },
      })
    } catch (error) {
      fastify.log.error('Magic link verification failed:', error.message)
      console.error('Full error stack:', error)

      if (error.message.includes('Invalid') || error.message.includes('expired')) {
        return reply.code(400).send({
          error: 'Invalid Token',
          message: 'The magic link is invalid or has expired. Please request a new one.',
        })
      }

      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to verify magic link. Please try again.',
      })
    }
  })
  
  // Refresh JWT tokens with advanced rotation and security
  fastify.post('/refresh', {
    schema: {
      description: 'Refresh JWT access token using refresh token with automatic rotation',
      tags: ['Authentication'],
      body: {
        type: 'object',
        properties: {
          refreshToken: {
            type: 'string',
            description: 'Refresh token (optional if provided in cookie)',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            tokens: {
              type: 'object',
              properties: {
                accessToken: { type: 'string' },
                refreshToken: { type: 'string' },
                expiresIn: { type: 'number' },
                tokenType: { type: 'string' },
              },
            },
            rotation: {
              type: 'object',
              properties: {
                rotated: { type: 'boolean' },
                previousRefreshJTI: { type: 'string' },
                newRefreshJTI: { type: 'string' },
              },
            },
          },
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            code: { type: 'string' },
          },
        },
        429: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            retryAfter: { type: 'number' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      // Get refresh token from body or cookie
      const refreshToken = request.body?.refreshToken ||
                          request.cookies?.truxe_refresh_token
      
      if (!refreshToken) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Refresh token is required',
          code: 'REFRESH_TOKEN_MISSING',
        })
      }
      
      const ip = request.ip
      const userAgent = request.headers['user-agent']
      const deviceInfo = advancedSessionSecurityService.generateAdvancedDeviceFingerprint(request)
      
      // Check for brute force attacks
      const bruteForceCheck = await threatDetectionService.checkBruteForceAttack(
        'refresh_token',
        ip,
        userAgent,
        'refresh'
      )
      
      if (bruteForceCheck.isBruteForce) {
        return reply.code(429).send({
          error: 'Too Many Requests',
          message: 'Too many refresh attempts. Please try again later.',
          retryAfter: bruteForceCheck.lockoutDuration,
          code: 'REFRESH_RATE_LIMITED',
        })
      }
      
      // Check if IP is locked out
      const lockoutCheck = await threatDetectionService.isIPLockedOut(
        'refresh_token',
        ip,
        'refresh'
      )
      
      if (lockoutCheck.lockedOut) {
        return reply.code(429).send({
          error: 'IP Locked Out',
          message: 'This IP address is temporarily locked due to suspicious activity.',
          retryAfter: lockoutCheck.remainingTime / 1000,
          code: 'IP_LOCKED_OUT',
        })
      }
      
      // Use refresh token rotation service
      const refreshResult = await refreshTokenRotationService.refreshTokens(refreshToken, {
        ip,
        userAgent,
        deviceInfo,
        userId: null, // Will be determined by the service
        sessionId: null, // Will be determined by the service
      })
      
      if (!refreshResult.success) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Failed to refresh token. Please sign in again.',
          code: 'REFRESH_FAILED',
        })
      }
      
      const { tokens, rotation } = refreshResult
      
      // Detect suspicious activity
      await threatDetectionService.detectSuspiciousActivity(
        tokens.accessToken.payload?.sub || 'unknown',
        {
          ip,
          userAgent,
          deviceInfo,
          action: 'token_refresh',
          timestamp: Date.now(),
        }
      )
      
      // Update cookies with new tokens
      reply.setCookie('truxe_access_token', tokens.accessToken.token, {
        httpOnly: true,
        secure: config.app.environment === 'production',
        sameSite: 'lax',
        maxAge: tokens.accessToken.expiresIn,
        path: '/',
      })

      reply.setCookie('truxe_refresh_token', tokens.refreshToken.token, {
        httpOnly: true,
        secure: config.app.environment === 'production',
        sameSite: 'lax',
        maxAge: tokens.refreshToken.expiresIn,
        path: '/',
      })
      
      return reply.send({
        success: true,
        tokens: {
          accessToken: tokens.accessToken.token,
          refreshToken: tokens.refreshToken.token,
          expiresIn: tokens.accessToken.expiresIn,
          tokenType: 'Bearer',
        },
        rotation: {
          rotated: rotation.rotated,
          previousRefreshJTI: rotation.previousRefreshJTI,
          newRefreshJTI: rotation.newRefreshJTI,
        },
      })
    } catch (error) {
      fastify.log.error('Token refresh failed:', error.message)
      
      // Log security incident for failed refresh attempts
      await securityIncidentResponseService.processIncident({
        type: 'token_refresh_failed',
        source: 'auth_service',
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        details: {
          error: error.message,
          timestamp: new Date().toISOString(),
        },
      })
      
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Failed to refresh token. Please sign in again.',
        code: 'REFRESH_FAILED',
      })
    }
  })
  
  // Revoke session (logout)
  fastify.post('/revoke', {
    schema: {
      description: 'Revoke current session and logout user',
      tags: ['Authentication'],
      body: {
        type: 'object',
        properties: {
          revokeAll: {
            type: 'boolean',
            description: 'Revoke all user sessions (default: false)',
            default: false,
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            revokedSessions: { type: 'number' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { revokeAll = false } = request.body
      
      // Get access token from header or cookie
      const accessToken = request.headers.authorization?.replace('Bearer ', '') ||
                         request.cookies?.truxe_access_token
      
      if (!accessToken) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Access token is required',
        })
      }
      
      // Verify access token
      const verification = await jwtService.verifyAccessToken(accessToken)
      
      if (!verification.payload) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Invalid access token',
        })
      }
      
      const userId = verification.payload.sub
      const sessionJTI = verification.jti
      
      let revokedSessions = 0
      
      if (revokeAll) {
        // Revoke all user sessions with advanced audit logging
        const sessions = await sessionService.getUserSessions(userId)
        for (const session of sessions) {
          await advancedSessionSecurityService.revokeSessionWithAudit(
            session.jti,
            'user_logout_all',
            {
              userId,
              requestedBy: userId,
              ip: request.ip,
              userAgent: request.headers['user-agent'],
            }
          )
        }
        revokedSessions = sessions.length
        
        // Trigger webhook events for each revoked session
        try {
          for (const session of sessions) {
            await webhookEventsService.triggerSessionRevoked(session, { id: userId }, {
              orgId: session.org_id,
              revocationReason: 'user_logout_all',
              revokedBy: userId,
              ip: request.ip,
              userAgent: request.headers['user-agent'],
            })
          }
          
          await webhookEventsService.triggerUserLogout({ id: userId }, { jti: sessionJTI }, {
            orgId: sessions[0]?.org_id,
            logoutReason: 'user_initiated_all',
            logoutMethod: 'revoke_all',
            sessionCount: sessions.length,
            ip: request.ip,
            userAgent: request.headers['user-agent'],
          })
        } catch (webhookError) {
          fastify.log.error('Failed to trigger logout webhook events:', webhookError.message)
        }
      } else {
        // Revoke current session only with advanced audit logging
        const result = await advancedSessionSecurityService.revokeSessionWithAudit(
          sessionJTI,
          'user_logout',
          {
            userId,
            requestedBy: userId,
            ip: request.ip,
            userAgent: request.headers['user-agent'],
          }
        )
        revokedSessions = result.success ? 1 : 0
        
        // Trigger webhook events for single session logout
        if (result.success) {
          try {
            const session = await sessionService.getSession(sessionJTI)
            if (session) {
              await webhookEventsService.triggerSessionRevoked(session, { id: userId }, {
                orgId: session.org_id,
                revocationReason: 'user_logout',
                revokedBy: userId,
                ip: request.ip,
                userAgent: request.headers['user-agent'],
              })
              
              await webhookEventsService.triggerUserLogout({ id: userId }, session, {
                orgId: session.org_id,
                logoutReason: 'user_initiated',
                logoutMethod: 'revoke_single',
                ip: request.ip,
                userAgent: request.headers['user-agent'],
              })
            }
          } catch (webhookError) {
            fastify.log.error('Failed to trigger logout webhook events:', webhookError.message)
          }
        }
      }
      
      // Clear cookies
      reply.clearCookie('truxe_access_token', { path: '/' })
      reply.clearCookie('truxe_refresh_token', { path: '/' })
      
      return reply.send({
        success: true,
        message: revokeAll 
          ? `Successfully logged out from ${revokedSessions} sessions`
          : 'Successfully logged out',
        revokedSessions,
      })
    } catch (error) {
      fastify.log.error('Session revocation failed:', error.message)
      
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to revoke session',
      })
    }
  })
  
  // Get current user (requires authentication)
  fastify.get('/me', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'Get current authenticated user information',
      tags: ['Authentication'],
      response: {
        200: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                emailVerified: { type: 'boolean' },
                status: { type: 'string' },
                metadata: { type: 'object' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
              },
            },
            session: {
              type: 'object',
              properties: {
                jti: { type: 'string' },
                createdAt: { type: 'string' },
                expiresAt: { type: 'string' },
                lastUsedAt: { type: 'string' },
                deviceInfo: { type: 'object' },
              },
            },
          },
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const user = request.user
      const session = request.session
      
      return reply.send({
        user: {
          id: user.id,
          email: user.email,
          emailVerified: user.emailVerified,
          status: user.status,
          metadata: user.metadata,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        session: {
          jti: session.jti,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
          lastUsedAt: session.lastUsedAt,
          deviceInfo: session.deviceInfo,
        },
      })
    } catch (error) {
      fastify.log.error('Get current user failed:', error.message)
      
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get user information',
      })
    }
  })
  
  // Logout (alias for revoke)
  fastify.post('/logout', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'Logout user (alias for /auth/revoke)',
      tags: ['Authentication'],
      body: {
        type: 'object',
        properties: {
          revokeAll: {
            type: 'boolean',
            description: 'Revoke all user sessions (default: false)',
            default: false,
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            revokedSessions: { type: 'number' },
          },
        },
      },
    },
  }, async (request, reply) => {
    // Forward to revoke handler
    return fastify.inject({
      method: 'POST',
      url: '/auth/revoke',
      payload: request.body,
      headers: request.headers,
      cookies: request.cookies,
    }).then(response => {
      reply.code(response.statusCode)
      return response.json()
    })
  })

  // Get user's available organizations for switching
  fastify.get('/organizations', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'Get user\'s available organizations for switching',
      tags: ['Authentication'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            organizations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  slug: { type: 'string' },
                  role: { type: 'string' },
                  permissions: { type: 'array' },
                },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const userId = request.user.id

      const organizations = await rbac.getUserOrganizationsWithRoles(userId)

      return reply.send({
        success: true,
        organizations: organizations.map(org => ({
          id: org.id,
          name: org.name,
          slug: org.slug,
          role: org.role,
          permissions: org.permissions,
        })),
      })
    } catch (error) {
      fastify.log.error('Failed to get user organizations:', error.message)

      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve organizations',
      })
    }
  })

  // Switch organization context
  fastify.post('/switch-org', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'Switch user organization context',
      tags: ['Authentication'],
      body: {
        type: 'object',
        required: ['orgId'],
        properties: {
          orgId: {
            type: 'string',
            format: 'uuid',
            description: 'Organization ID to switch to',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            organization: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                slug: { type: 'string' },
                settings: { type: 'object' },
              },
            },
            membership: {
              type: 'object',
              properties: {
                role: { type: 'string' },
                permissions: { type: 'array' },
              },
            },
            tokens: {
              type: 'object',
              properties: {
                accessToken: { type: 'string' },
                refreshToken: { type: 'string' },
                expiresIn: { type: 'number' },
                tokenType: { type: 'string' },
              },
            },
          },
        },
        403: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { orgId } = request.body
      const userId = request.user.id
      const sessionJTI = request.session.jti
      const ip = request.ip
      const userAgent = request.headers['user-agent']

      // Import organization service
      const organizationService = (await import('../services/organization.js')).default

      // Validate organization access using RBAC
      const accessCheck = await rbac.validateOrganizationAccess(orgId, userId)
      
      if (!accessCheck.hasAccess) {
        // Log access attempt
        await rbac.logAccessAttempt({
          userId,
          orgId,
          action: 'org_switch',
          resource: 'organization',
          success: false,
          reason: accessCheck.reason,
          ip,
          userAgent,
        })
        
        return reply.code(403).send({
          error: 'Forbidden',
          message: accessCheck.reason,
        })
      }

      const organization = await organizationService.getOrganizationById({
        orgId,
        userId,
      })

      if (!organization) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Organization not found',
        })
      }

      // Update session with new organization context
      await sessionService.updateSessionOrganization(sessionJTI, orgId)

      // Create new JWT tokens with organization context
      const tokens = await jwtService.createTokenPair({
        userId,
        email: request.user.email,
        emailVerified: request.user.emailVerified,
        orgId,
        role: accessCheck.membership.role,
        permissions: accessCheck.membership.permissions,
        sessionId: sessionJTI,
        deviceInfo: request.session.deviceInfo,
      })

      // Update session with new refresh token JTI
      await sessionService.updateRefreshJTI(sessionJTI, tokens.refreshToken.jti)

      // Log organization switch
      await advancedSessionSecurityService.logSecurityEvent({
        userId,
        action: 'session.org_switched',
        target: { type: 'organization', id: orgId },
        ip,
        userAgent,
        sessionId: sessionJTI,
        severity: 'info',
        details: {
          previousOrgId: request.session.orgId,
          newOrgId: orgId,
          role: accessCheck.membership.role,
        },
      })

      // Update cookies with new tokens
      reply.setCookie('truxe_access_token', tokens.accessToken.token, {
        httpOnly: true,
        secure: config.app.environment === 'production',
        sameSite: 'lax',
        maxAge: tokens.accessToken.expiresIn,
        path: '/',
      })

      reply.setCookie('truxe_refresh_token', tokens.refreshToken.token, {
        httpOnly: true,
        secure: config.app.environment === 'production',
        sameSite: 'lax',
        maxAge: tokens.refreshToken.expiresIn,
        path: '/',
      })

      return reply.send({
        success: true,
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          settings: organization.settings,
        },
        membership: {
          role: accessCheck.membership.role,
          permissions: accessCheck.membership.permissions,
        },
        tokens: {
          accessToken: tokens.accessToken.token,
          refreshToken: tokens.refreshToken.token,
          expiresIn: tokens.accessToken.expiresIn,
          tokenType: 'Bearer',
        },
      })
    } catch (error) {
      fastify.log.error('Organization switch failed:', error.message)

      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to switch organization context',
      })
    }
  })
}
