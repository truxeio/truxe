/**
 * Service Account API Routes
 * Backend-to-backend authentication endpoints
 */

export default async function serviceAccountRoutes(fastify, options) {
  // Import services dynamically to avoid circular dependencies
  const { getPool } = await import('../database/connection.js')
  const { default: jwtService } = await import('../services/jwt.js')
  const { ServiceAccountService } = await import('../services/service-account.js')
  const { default: config } = await import('../config/index.js')

  // Initialize service account service
  const serviceAccountService = new ServiceAccountService({
    pool: getPool(),
    jwt: jwtService,
    logger: fastify.log,
    config,
  })

  // Decorate fastify instance
  fastify.decorate('serviceAccountService', serviceAccountService)

  /**
   * POST /api/service-accounts/token
   * Authenticate service account and get access token
   */
  fastify.post('/token', {
    schema: {
      description: 'Authenticate service account and obtain access token',
      tags: ['Service Accounts'],
      body: {
        type: 'object',
        required: ['clientId', 'clientSecret'],
        properties: {
          clientId: {
            type: 'string',
            minLength: 1,
            description: 'Service account client ID',
          },
          clientSecret: {
            type: 'string',
            minLength: 1,
            description: 'Service account client secret',
          },
          tenantId: {
            type: 'string',
            description: 'Optional tenant/organization ID',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            tokenType: { type: 'string' },
            expiresIn: { type: 'number' },
            expiresAt: { type: 'string', format: 'date-time' },
            scopes: {
              type: 'array',
              items: { type: 'string' },
            },
            organizationId: { type: 'string' },
            organizationSlug: { type: 'string' },
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
    const startTime = Date.now()

    try {
      const { clientId, clientSecret, tenantId } = request.body

      const result = await serviceAccountService.authenticate({
        clientId,
        clientSecret,
        tenantId,
      })

      // Log successful authentication
      const responseTime = Date.now() - startTime
      await serviceAccountService.logUsage({
        serviceAccountId: result.serviceAccountId || null,
        endpoint: '/api/service-accounts/token',
        method: 'POST',
        statusCode: 200,
        responseTimeMs: responseTime,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      }).catch(err => {
        // Don't fail the request if logging fails
        fastify.log.error({ err }, 'Failed to log service account usage')
      })

      return reply.send(result)
    } catch (error) {
      const responseTime = Date.now() - startTime

      // Log failed authentication attempt
      await serviceAccountService.logUsage({
        serviceAccountId: null,
        endpoint: '/api/service-accounts/token',
        method: 'POST',
        statusCode: 401,
        responseTimeMs: responseTime,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        errorMessage: error.message,
      }).catch(err => {
        fastify.log.error({ err }, 'Failed to log service account usage')
      })

      fastify.log.warn(
        { err: error, clientId: request.body?.clientId },
        'Service account authentication failed'
      )

      return reply.code(401).send({
        error: 'authentication_failed',
        message: 'Invalid client credentials',
      })
    }
  })

  /**
   * POST /api/service-accounts/revoke
   * Revoke service account token
   */
  fastify.post('/revoke', {
    schema: {
      description: 'Revoke a service account token',
      tags: ['Service Accounts'],
      headers: {
        type: 'object',
        required: ['authorization'],
        properties: {
          authorization: {
            type: 'string',
            description: 'Bearer token to revoke',
          },
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
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    try {
      const jti = request.tokenPayload?.jti

      if (!jti) {
        return reply.code(400).send({
          error: 'invalid_token',
          message: 'Token does not contain JTI',
        })
      }

      await serviceAccountService.revokeToken(jti)

      return reply.send({
        success: true,
        message: 'Token revoked successfully',
      })
    } catch (error) {
      fastify.log.error({ err: error }, 'Failed to revoke service account token')

      return reply.code(500).send({
        error: 'revocation_failed',
        message: 'Failed to revoke token',
      })
    }
  })

  /**
   * GET /api/service-accounts/me
   * Get current service account info
   */
  fastify.get('/me', {
    schema: {
      description: 'Get information about the authenticated service account',
      tags: ['Service Accounts'],
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            clientId: { type: 'string' },
            scopes: {
              type: 'array',
              items: { type: 'string' },
            },
            enabled: { type: 'boolean' },
            rateLimitPerMinute: { type: 'number' },
            organizationId: { type: 'string' },
            organizationSlug: { type: 'string' },
            organizationName: { type: 'string' },
            lastUsedAt: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    try {
      // Check if authenticated as service account
      if (request.tokenPayload?.type !== 'service_account') {
        return reply.code(403).send({
          error: 'forbidden',
          message: 'This endpoint is only for service accounts',
        })
      }

      const serviceAccountId = request.tokenPayload.sub
      const account = await serviceAccountService.getById(serviceAccountId)

      return reply.send({
        id: account.id,
        name: account.name,
        description: account.description,
        clientId: account.client_id,
        scopes: account.scopes,
        enabled: account.enabled,
        rateLimitPerMinute: account.rate_limit_per_minute,
        organizationId: account.organization_id,
        organizationSlug: account.organization_slug,
        organizationName: account.organization_name,
        lastUsedAt: account.last_used_at,
        createdAt: account.created_at,
      })
    } catch (error) {
      fastify.log.error({ err: error }, 'Failed to get service account info')

      return reply.code(500).send({
        error: 'internal_error',
        message: 'Failed to retrieve service account information',
      })
    }
  })

  /**
   * GET /api/service-accounts/:id/usage
   * Get service account usage statistics
   */
  fastify.get('/:id/usage', {
    schema: {
      description: 'Get usage statistics for a service account',
      tags: ['Service Accounts'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            totalRequests: { type: 'string' },
            successfulRequests: { type: 'string' },
            failedRequests: { type: 'string' },
            avgResponseTimeMs: { type: 'string' },
            maxResponseTimeMs: { type: 'number' },
            minResponseTimeMs: { type: 'number' },
          },
        },
      },
    },
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    try {
      const { id } = request.params
      const {
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        endDate = new Date(),
      } = request.query

      const stats = await serviceAccountService.getUsageStats(
        id,
        new Date(startDate),
        new Date(endDate)
      )

      return reply.send(stats)
    } catch (error) {
      fastify.log.error({ err: error }, 'Failed to get service account usage stats')

      return reply.code(500).send({
        error: 'internal_error',
        message: 'Failed to retrieve usage statistics',
      })
    }
  })
}
