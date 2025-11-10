/**
 * API Key Authentication Middleware
 *
 * Middleware to authenticate API keys for machine-to-machine (M2M) communication.
 *
 * @module middleware/api-key-auth
 */

import fp from 'fastify-plugin';
import apiKeyService from '../services/api-key.js';
import rateLimitService from '../services/rate-limit.js';

/**
 * Middleware to authenticate API keys
 */
export async function apiKeyAuthMiddleware(fastify, options) {
  fastify.log.info('Registering API key authentication middleware');

  /**
   * Decorator to authenticate API keys
   */
  fastify.decorate('authenticateApiKey', async function(request, reply) {
    const startTime = Date.now();

    try {
      // Extract API key from Authorization header
      const authHeader = request.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Missing or invalid Authorization header',
          hint: 'Use: Authorization: Bearer truxe_pk_live_...'
        });
      }

      const apiKey = authHeader.substring(7); // Remove 'Bearer '

      // Verify API key format
      if (!apiKey.startsWith('truxe_')) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Invalid API key format'
        });
      }

      // Verify API key and get context
      const serviceAccountContext = await apiKeyService.verifyApiKey(
        apiKey,
        request.ip
      );

      // Check rate limits based on tier
      const rateLimitConfig = getRateLimitConfig(serviceAccountContext.rateLimitTier);
      const rateLimitKey = `api_key:${serviceAccountContext.apiKeyId}`;

      const allowed = await rateLimitService.checkLimit(
        rateLimitKey,
        rateLimitConfig.limit,
        rateLimitConfig.window
      );

      if (!allowed) {
        return reply.code(429).send({
          error: 'Rate Limit Exceeded',
          message: `Rate limit exceeded. Limit: ${rateLimitConfig.limit} requests per ${rateLimitConfig.window}`,
          retryAfter: rateLimitConfig.window
        });
      }

      // Inject service account context into request
      request.serviceAccount = serviceAccountContext;
      request.isServiceAccount = true;
      request.isUserAuth = false;

      // Continue to route handler
      return;

    } catch (error) {
      fastify.log.error('API key authentication failed:', error.message);

      const responseTime = Date.now() - startTime;

      // Log failed attempt
      if (request.serviceAccount?.apiKeyId) {
        await apiKeyService.logUsage({
          apiKeyId: request.serviceAccount.apiKeyId,
          endpoint: request.url,
          method: request.method,
          statusCode: 401,
          responseTimeMs: responseTime,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          requestId: request.id,
          errorMessage: error.message
        }).catch(err => fastify.log.error('Failed to log usage:', err));
      }

      return reply.code(401).send({
        error: 'Unauthorized',
        message: error.message
      });
    }
  });

  /**
   * Decorator to require specific permission for API keys
   */
  fastify.decorate('requireApiKeyPermission', function(permission) {
    return async function(request, reply) {
      if (!request.serviceAccount) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }

      const hasPermission = apiKeyService.hasPermission(
        request.serviceAccount.permissions,
        permission
      );

      if (!hasPermission) {
        fastify.log.warn(`Permission denied: ${permission} for service account ${request.serviceAccount.serviceAccountName}`);

        return reply.code(403).send({
          error: 'Forbidden',
          message: `Insufficient permissions. Required: ${permission}`,
          currentPermissions: request.serviceAccount.permissions
        });
      }

      // Permission check passed
      return;
    };
  });

  /**
   * Hook to log API key usage after request
   */
  fastify.addHook('onResponse', async (request, reply) => {
    if (request.serviceAccount?.apiKeyId) {
      const responseTime = reply.elapsedTime;

      await apiKeyService.logUsage({
        apiKeyId: request.serviceAccount.apiKeyId,
        endpoint: request.url,
        method: request.method,
        statusCode: reply.statusCode,
        responseTimeMs: Math.round(responseTime),
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        requestId: request.id
      }).catch(err => fastify.log.error('Failed to log usage:', err));
    }
  });
}

/**
 * Get rate limit configuration by tier
 *
 * @param {string} tier - Rate limit tier ('standard', 'high', 'unlimited')
 * @returns {Object} Rate limit configuration
 */
function getRateLimitConfig(tier) {
  const configs = {
    'standard': {
      limit: 1000,
      window: '1h'
    },
    'high': {
      limit: 10000,
      window: '1h'
    },
    'unlimited': {
      limit: 1000000,
      window: '1h'
    }
  };

  return configs[tier] || configs.standard;
}

// Export wrapped with fastify-plugin to break encapsulation
// This makes decorators available across all plugin contexts
export default fp(apiKeyAuthMiddleware, {
  name: 'api-key-auth-middleware',
  fastify: '>=4.x'
});
