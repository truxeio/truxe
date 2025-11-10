/**
 * Authentication Middleware
 * 
 * Fastify plugin for JWT authentication with comprehensive security features:
 * - JWT verification with JTI revocation checking
 * - Session validation and management
 * - User context injection
 * - Security headers and CORS
 * - Request logging and monitoring
 */

import fp from 'fastify-plugin'
import jwtService from '../services/jwt.js'
import sessionService from '../services/session.js'
import advancedSessionSecurityService from '../services/advanced-session-security.js'
import { getPool } from '../database/connection.js'
import config from '../config/index.js'

/**
 * Authentication middleware plugin
 * Using fastify-plugin to avoid encapsulation so decorators are available to all routes
 */
async function authMiddleware(fastify, options) {
  fastify.log.info('Registering authentication middleware')

  /**
   * JWT Authentication decorator
   */
  fastify.decorate('authenticate', async function (request, reply) {
    try {
      // Get token from Authorization header or cookie
      let token = null

      // Check Authorization header first
      const authHeader = request.headers.authorization
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7)
      }

      // Fallback to cookie - temporarily disabled
      // if (!token) {
      //   token = request.cookies?.truxe_access_token
      // }

      if (!token) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Access token is required',
        })
      }
      
      // Verify JWT token
      const verification = await jwtService.verifyAccessToken(token)
      
      if (!verification.payload) {
        // Handle expired tokens
        if (verification.isExpired) {
          return reply.code(401).send({
            error: 'Token Expired',
            message: 'Access token has expired. Please refresh your token.',
            code: 'TOKEN_EXPIRED',
          })
        }
        
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Invalid access token',
        })
      }
      
      // Check if JTI is blacklisted (advanced security check)
      const blacklistCheck = await advancedSessionSecurityService.isJTIBlacklisted(verification.jti)
      if (blacklistCheck.blacklisted) {
        // Log security event
        await advancedSessionSecurityService.logSecurityEvent({
          userId: verification.payload.sub,
          action: 'session.blacklisted_access_attempt',
          target: { type: 'jti', id: verification.jti },
          ip: request.ip,
          userAgent: request.headers['user-agent'],
          sessionId: verification.jti,
          severity: 'warning',
          details: {
            reason: blacklistCheck.reason,
            blacklistedAt: blacklistCheck.blacklistedAt,
          },
        })
        
        return reply.code(401).send({
          error: 'Token Revoked',
          message: 'Access token has been revoked. Please sign in again.',
          code: 'TOKEN_REVOKED',
        })
      }
      
      // Check if this is a service account token
      const isServiceAccount = verification.payload.token_type === 'access' &&
                               verification.payload.type === 'service_account'

      if (isServiceAccount) {
        // Service account authentication - skip user session checks
        // Validate service account token exists and is not expired
        const pool = getPool()
        const tokenCheck = await pool.query(
          `SELECT id FROM service_account_tokens
           WHERE jti = $1 AND expires_at > CURRENT_TIMESTAMP`,
          [verification.jti]
        )

        if (tokenCheck.rows.length === 0) {
          return reply.code(401).send({
            error: 'Token Revoked',
            message: 'Service account token has been revoked or expired.',
            code: 'TOKEN_REVOKED',
          })
        }

        // Inject minimal context for service accounts
        request.user = null // Service accounts are not users
        request.session = null
        request.tokenPayload = verification.payload
        request.jti = verification.jti
        request.isServiceAccount = true
      } else {
        // Regular user authentication
        // Fallback check with session service
        const isRevoked = await sessionService.isJTIRevoked(verification.jti)
        if (isRevoked) {
          return reply.code(401).send({
            error: 'Token Revoked',
            message: 'Access token has been revoked. Please sign in again.',
            code: 'TOKEN_REVOKED',
          })
        }

        // Get session information
        const session = await sessionService.getSession(verification.jti)
        if (!session || !session.isActive) {
          return reply.code(401).send({
            error: 'Session Invalid',
            message: 'Session is no longer valid. Please sign in again.',
            code: 'SESSION_INVALID',
          })
        }

        // Get user information
        const user = await getUserById(verification.payload.sub)
        if (!user) {
          return reply.code(401).send({
            error: 'User Not Found',
            message: 'User account not found. Please sign in again.',
            code: 'USER_NOT_FOUND',
          })
        }

        // Check user status
        if (user.status === 'blocked') {
          return reply.code(403).send({
            error: 'Account Blocked',
            message: 'Your account has been blocked. Please contact support.',
            code: 'ACCOUNT_BLOCKED',
          })
        }

        // Update session last used time
        await sessionService.updateSessionLastUsed(
          verification.jti,
          config.session.extendOnUse
        )

        // Inject user and session into request
        request.user = user
        request.session = session
        request.tokenPayload = verification.payload
        request.jti = verification.jti
        request.isServiceAccount = false

        // Set user context for RLS (if using database in this request)
        if (session.orgId) {
          const pool = getPool()
          await pool.setRLSContext(user.id, session.orgId)
        }
      }
    } catch (error) {
      // Log error for debugging
      fastify.log.error('Authentication error:', error.message)

      // Check if it's a JWT verification error (includes various JWT error patterns)
      if (error.message && (
        error.message.includes('Token verification failed') ||
        error.message.includes('Invalid') ||
        error.message.includes('malformed') ||
        error.message.includes('signature') ||
        error.message.includes('expired') ||
        error.message.includes('Compact JWS') ||
        error.message.includes('claim validation')
      )) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Invalid access token',
          code: 'INVALID_TOKEN',
        })
      }

      // For other errors, return 500
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Authentication failed due to server error',
      })
    }
  })

  /**
   * Require verified email for downstream handlers
   */
  fastify.decorate('requireEmailVerified', async function (request, reply) {
    if (request.isServiceAccount) {
      return
    }

    const emailVerified = request.user?.emailVerified ?? request.tokenPayload?.email_verified
    if (emailVerified) {
      return
    }

    return reply.code(403).send({
      error: 'Email Not Verified',
      message: 'Email verification is required to perform this action.',
      code: 'EMAIL_NOT_VERIFIED',
    })
  })

  fastify.log.info('Authentication decorator registered successfully')

  /**
   * Optional authentication decorator (doesn't fail if no token)
   */
  fastify.decorate('optionalAuth', async function (request, reply) {
    try {
      // Check if token exists first
      const authHeader = request.headers.authorization
      const hasToken = authHeader && authHeader.startsWith('Bearer ')

      if (!hasToken) {
        // No token provided, set user context to null and continue
        request.user = null
        request.session = null
        request.tokenPayload = null
        request.jti = null
        return
      }

      // Token exists, try to authenticate
      await fastify.authenticate(request, reply)
    } catch (error) {
      // Ignore authentication errors for optional auth
      request.user = null
      request.session = null
      request.tokenPayload = null
      request.jti = null
    }
  })
  
  /**
   * Role-based authorization decorator
   */
  fastify.decorate('requireRole', function (requiredRoles) {
    return async function (request, reply) {
      // Ensure user is authenticated first
      await fastify.authenticate(request, reply)
      
      const userRole = request.tokenPayload?.role
      const userPermissions = request.tokenPayload?.permissions || []
      
      // Check if user has required role
      const hasRequiredRole = Array.isArray(requiredRoles)
        ? requiredRoles.includes(userRole)
        : userRole === requiredRoles
      
      if (!hasRequiredRole) {
        return reply.code(403).send({
          error: 'Insufficient Permissions',
          message: `This action requires one of the following roles: ${Array.isArray(requiredRoles) ? requiredRoles.join(', ') : requiredRoles}`,
          code: 'INSUFFICIENT_ROLE',
          required: requiredRoles,
          current: userRole,
        })
      }
    }
  })
  
  /**
   * Permission-based authorization decorator
   */
  fastify.decorate('requirePermission', function (requiredPermissions) {
    return async function (request, reply) {
      // Ensure user is authenticated first
      await fastify.authenticate(request, reply)
      
      const userPermissions = request.tokenPayload?.permissions || []
      
      // Check if user has required permissions
      const hasRequiredPermissions = Array.isArray(requiredPermissions)
        ? requiredPermissions.every(permission => userPermissions.includes(permission))
        : userPermissions.includes(requiredPermissions)
      
      if (!hasRequiredPermissions) {
        return reply.code(403).send({
          error: 'Insufficient Permissions',
          message: `This action requires the following permissions: ${Array.isArray(requiredPermissions) ? requiredPermissions.join(', ') : requiredPermissions}`,
          code: 'INSUFFICIENT_PERMISSIONS',
          required: requiredPermissions,
          current: userPermissions,
        })
      }
    }
  })
  
  /**
   * Organization context decorator
   */
  fastify.decorate('requireOrganization', function (allowedRoles = ['owner', 'admin', 'member']) {
    return async function (request, reply) {
      // Ensure user is authenticated first
      await fastify.authenticate(request, reply)
      
      const orgId = request.tokenPayload?.org_id
      const userRole = request.tokenPayload?.role
      
      if (!orgId) {
        return reply.code(400).send({
          error: 'Organization Required',
          message: 'This action requires an organization context',
          code: 'NO_ORGANIZATION_CONTEXT',
        })
      }
      
      if (!allowedRoles.includes(userRole)) {
        return reply.code(403).send({
          error: 'Insufficient Organization Role',
          message: `This action requires one of the following organization roles: ${allowedRoles.join(', ')}`,
          code: 'INSUFFICIENT_ORG_ROLE',
          required: allowedRoles,
          current: userRole,
        })
      }
      
      // Inject organization context
      request.organizationId = orgId
      request.organizationRole = userRole
    }
  })
  
  /**
   * Get user by ID helper function
   */
  async function getUserById(userId) {
    try {
      const pool = getPool()
      const result = await pool.query(
        'SELECT * FROM users WHERE id = $1',
        [userId]
      )

      if (result.rows.length === 0) {
        return null
      }

      const user = result.rows[0]

      return {
        id: user.id,
        email: user.email,
        emailVerified: user.email_verified,
        status: user.status,
        metadata: user.metadata,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      }
    } catch (error) {
      fastify.log.error('Failed to get user by ID:', error.message)
      return null
    }
  }
  
  /**
   * Security headers hook
   */
  fastify.addHook('onSend', async (request, reply, payload) => {
    // Add security headers
    if (config.features.helmet) {
      reply.header('X-Content-Type-Options', 'nosniff')
      reply.header('X-Frame-Options', 'DENY')
      reply.header('X-XSS-Protection', '1; mode=block')
      reply.header('Referrer-Policy', 'strict-origin-when-cross-origin')
      
      if (config.app.environment === 'production') {
        reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
      }
    }
    
    // Add API version header
    reply.header('X-API-Version', config.app.apiVersion)
    
    // Add request ID header
    if (request.id) {
      reply.header('X-Request-ID', request.id)
    }
    
    return payload
  })
  
  /**
   * Request logging hook
   */
  if (config.features.requestLogging) {
    fastify.addHook('onRequest', async (request, reply) => {
      request.startTime = Date.now()
    })
    
    fastify.addHook('onResponse', async (request, reply) => {
      const duration = Date.now() - request.startTime
      const userId = request.user?.id
      const sessionId = request.session?.jti
      
      fastify.log.info({
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        duration,
        userId,
        sessionId,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      }, 'Request completed')
    })
  }
  
  /**
   * Error handler for authentication errors
   */
  fastify.setErrorHandler((error, request, reply) => {
    // Handle JWT-specific errors
    if (error.code === 'FST_JWT_AUTHORIZATION_TOKEN_EXPIRED') {
      return reply.code(401).send({
        error: 'Token Expired',
        message: 'Access token has expired',
        code: 'TOKEN_EXPIRED',
      })
    }
    
    if (error.code === 'FST_JWT_AUTHORIZATION_TOKEN_INVALID') {
      return reply.code(401).send({
        error: 'Invalid Token',
        message: 'Access token is invalid',
        code: 'TOKEN_INVALID',
      })
    }
    
    if (error.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') {
      return reply.code(401).send({
        error: 'Missing Token',
        message: 'Authorization header is missing',
        code: 'TOKEN_MISSING',
      })
    }
    
    // Log unexpected errors
    if (error.statusCode >= 500) {
      fastify.log.error(error, 'Unexpected server error')
    }
    
    // Default error response
    reply.send(error)
  })
}

// Export with fastify-plugin to avoid encapsulation
export default fp(authMiddleware, {
  name: 'auth-middleware',
  fastify: '4.x'
})
