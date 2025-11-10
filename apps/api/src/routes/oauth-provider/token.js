/**
 * OAuth Provider - Token Routes
 * 
 * Implements OAuth 2.0 Token endpoint and related operations:
 * - POST /token - Exchange authorization code, refresh token, or client credentials
 * - POST /introspect - Token introspection (RFC 7662)
 * - POST /revoke - Token revocation (RFC 7009)
 * 
 * Grant Types Supported:
 * - authorization_code (with PKCE support)
 * - refresh_token
 * - client_credentials
 * 
 * @requires Client Authentication - client_id + client_secret required
 */

import authorizationService from '../../services/oauth-provider/authorization-service.js';
import tokenService from '../../services/oauth-provider/token-service.js';
import enhancedTokenService from '../../services/oauth-provider/enhanced-token-service.js';
import clientService from '../../services/oauth-provider/client-service.js';
import { getPool } from '../../database/connection.js';

/**
 * OAuth error response builder
 */
function buildOAuthError(code, description, statusCode = 400) {
  return {
    statusCode,
    payload: {
      error: code,
      error_description: description,
    },
  };
}

export default async function tokenRoutes(fastify, options) {
  
  // ============================================================================
  // POST /token - OAuth 2.0 Token Endpoint
  // ============================================================================
  
  fastify.post('/token', {
    config: {
      rateLimit: {
        max: 10,              // 10 requests per window
        timeWindow: 60000,    // 1 minute (60000ms)
      }
    },
    schema: {
      description: 'OAuth 2.0 token endpoint - Exchange code/refresh token for access token',
      tags: ['OAuth Provider'],
      body: {
        type: 'object',
        required: ['grant_type'],
        properties: {
          grant_type: {
            type: 'string',
            enum: ['authorization_code', 'refresh_token', 'client_credentials'],
            description: 'OAuth 2.0 grant type',
          },
          // Authorization code grant parameters
          code: {
            type: 'string',
            description: 'Authorization code (required for authorization_code grant)',
          },
          redirect_uri: {
            type: 'string',
            format: 'uri',
            description: 'Redirect URI (required for authorization_code grant)',
          },
          code_verifier: {
            type: 'string',
            description: 'PKCE code verifier (required if code_challenge was sent)',
          },
          // Refresh token grant parameters
          refresh_token: {
            type: 'string',
            description: 'Refresh token (required for refresh_token grant)',
          },
          // Client credentials
          client_id: {
            type: 'string',
            description: 'Client ID',
          },
          client_secret: {
            type: 'string',
            description: 'Client Secret',
          },
          // Optional scope parameter
          scope: {
            type: 'string',
            description: 'Space-separated scopes (optional, for refresh_token grant)',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            access_token: { type: 'string' },
            token_type: { type: 'string' },
            expires_in: { type: 'number' },
            refresh_token: { type: 'string' },
            scope: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            error_description: { type: 'string' },
          },
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            error_description: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const startTime = Date.now();
    
    try {
      const {
        grant_type,
        code,
        redirect_uri,
        code_verifier,
        refresh_token,
        client_id,
        client_secret,
        scope,
      } = request.body;

      // Validate client credentials
      const client = await clientService.validateClientCredentials(client_id, client_secret);

      if (!client) {
        const { statusCode, payload } = buildOAuthError(
          'invalid_client',
          'Invalid client credentials',
          401
        );
        return reply.code(statusCode).send(payload);
      }

      let tokenResponse;

      // Handle different grant types
      switch (grant_type) {
        case 'authorization_code':
          tokenResponse = await handleAuthorizationCodeGrant({
            code,
            redirect_uri,
            code_verifier,
            client,
            request,
            fastify,
          });
          break;

        case 'refresh_token':
          tokenResponse = await handleRefreshTokenGrant({
            refresh_token,
            scope,
            client,
            request,
            fastify,
          });
          break;

        case 'client_credentials':
          tokenResponse = await handleClientCredentialsGrant({
            scope,
            client,
            request,
            fastify,
          });
          break;

        default:
          const { statusCode, payload } = buildOAuthError(
            'unsupported_grant_type',
            `Grant type "${grant_type}" is not supported`,
            400
          );
          return reply.code(statusCode).send(payload);
      }

      const responseTime = Date.now() - startTime;
      
      fastify.log.info({
        grantType: grant_type,
        clientId: client_id,
        responseTime,
      }, 'Token issued successfully');

      return reply.send(tokenResponse);
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      fastify.log.error({
        err: error,
        responseTime,
      }, 'Token request failed');

      // Determine error code based on error message
      let errorCode = 'server_error';
      let statusCode = 500;

      if (error.message.includes('Invalid') || error.message.includes('not found')) {
        errorCode = 'invalid_grant';
        statusCode = 400;
      } else if (error.message.includes('expired')) {
        errorCode = 'invalid_grant';
        statusCode = 400;
      } else if (error.message.includes('revoked')) {
        errorCode = 'invalid_grant';
        statusCode = 400;
      }

      const { statusCode: errorStatus, payload } = buildOAuthError(
        errorCode,
        error.message || 'Token request failed',
        statusCode
      );
      
      return reply.code(errorStatus).send(payload);
    }
  });

  // ============================================================================
  // POST /introspect - Token Introspection (RFC 7662)
  // ============================================================================
  
  fastify.post('/introspect', {
    schema: {
      description: 'OAuth 2.0 token introspection endpoint (RFC 7662)',
      tags: ['OAuth Provider'],
      body: {
        type: 'object',
        required: ['token', 'client_id', 'client_secret'],
        properties: {
          token: {
            type: 'string',
            description: 'Token to introspect',
          },
          token_type_hint: {
            type: 'string',
            enum: ['access_token', 'refresh_token'],
            description: 'Hint about token type',
          },
          client_id: {
            type: 'string',
            description: 'Client ID',
          },
          client_secret: {
            type: 'string',
            description: 'Client Secret',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            active: { type: 'boolean' },
            scope: { type: 'string' },
            client_id: { type: 'string' },
            username: { type: 'string' },
            token_type: { type: 'string' },
            exp: { type: 'number' },
            iat: { type: 'number' },
            sub: { type: 'string' },
            aud: { type: 'string' },
            iss: { type: 'string' },
            jti: { type: 'string' },
          },
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            error_description: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { token, token_type_hint, client_id, client_secret } = request.body;

      // Validate client credentials
      const client = await clientService.validateClientCredentials(client_id, client_secret);

      if (!client) {
        const { statusCode, payload } = buildOAuthError(
          'invalid_client',
          'Invalid client credentials',
          401
        );
        return reply.code(statusCode).send(payload);
      }

      // Use enhanced token service for security features
      const introspectionResult = await enhancedTokenService.introspectToken({
        token,
        clientId: client_id,
        tokenTypeHint: token_type_hint,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        requestId: request.id,
      });

      return reply.send(introspectionResult);
    } catch (error) {
      fastify.log.error({ err: error }, 'Token introspection failed');

      // RFC 7662: Always return 200 with active: false for invalid tokens
      return reply.send({ active: false });
    }
  });

  // ============================================================================
  // POST /revoke - Token Revocation (RFC 7009)
  // ============================================================================
  
  fastify.post('/revoke', {
    schema: {
      description: 'OAuth 2.0 token revocation endpoint (RFC 7009)',
      tags: ['OAuth Provider'],
      body: {
        type: 'object',
        required: ['token', 'client_id', 'client_secret'],
        properties: {
          token: {
            type: 'string',
            description: 'Token to revoke',
          },
          token_type_hint: {
            type: 'string',
            enum: ['access_token', 'refresh_token'],
            description: 'Hint about token type',
          },
          client_id: {
            type: 'string',
            description: 'Client ID',
          },
          client_secret: {
            type: 'string',
            description: 'Client Secret',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            error_description: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { token, token_type_hint, client_id, client_secret } = request.body;

      // Validate client credentials
      const client = await clientService.validateClientCredentials(client_id, client_secret);

      if (!client) {
        const { statusCode, payload } = buildOAuthError(
          'invalid_client',
          'Invalid client credentials',
          401
        );
        return reply.code(statusCode).send(payload);
      }

      // Use enhanced token service for security features
      await enhancedTokenService.revokeToken({
        token,
        clientId: client_id,
        tokenTypeHint: token_type_hint,
        userId: null, // Not available in client credentials flow
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        requestId: request.id,
      });

      fastify.log.info({
        clientId: client_id,
        tokenTypeHint: token_type_hint,
      }, 'Token revoked successfully');

      // RFC 7009: Return 200 even if token was invalid or already revoked
      return reply.send({ success: true });
    } catch (error) {
      fastify.log.error({ err: error }, 'Token revocation failed');

      // RFC 7009: Return 200 even on error (don't leak token status)
      return reply.send({ success: true });
    }
  });
}

// ============================================================================
// GRANT TYPE HANDLERS
// ============================================================================

/**
 * Handle authorization_code grant type
 */
async function handleAuthorizationCodeGrant({
  code,
  redirect_uri,
  code_verifier,
  client,
  request,
  fastify,
}) {
  // Validate required parameters
  if (!code) {
    throw new Error('Missing required parameter: code');
  }
  if (!redirect_uri) {
    throw new Error('Missing required parameter: redirect_uri');
  }

  // Validate and consume authorization code
  const authData = await authorizationService.validateAndConsumeCode({
    code,
    clientId: client.client_id,
    redirectUri: redirect_uri,
    codeVerifier: code_verifier,
  });

  if (!authData) {
    throw new Error('Invalid authorization code');
  }

  // Get user information
  const pool = getPool();
  const userResult = await pool.query(
    'SELECT id, email, username FROM users WHERE id = $1',
    [authData.userId]
  );

  if (userResult.rows.length === 0) {
    throw new Error('User not found');
  }

  const user = userResult.rows[0];

  // Generate token pair using enhanced service
  const tokenResponse = await enhancedTokenService.generateTokenPair({
    clientId: client.client_id,
    userId: authData.userId,
    scope: authData.scope,
    userInfo: {
      sub: user.id,
      email: user.email,
      username: user.username,
    },
    ip: request.ip,
    userAgent: request.headers['user-agent'],
    requestId: request.id,
  });

  return tokenResponse;
}

/**
 * Handle refresh_token grant type
 */
async function handleRefreshTokenGrant({
  refresh_token,
  scope,
  client,
  request,
  fastify,
}) {
  // Validate required parameters
  if (!refresh_token) {
    throw new Error('Missing required parameter: refresh_token');
  }

  // Refresh token using token service
  const tokenResponse = await tokenService.refreshToken({
    refreshToken: refresh_token,
    clientId: client.client_id,
    scope,
  });

  return tokenResponse;
}

/**
 * Handle client_credentials grant type
 */
async function handleClientCredentialsGrant({
  scope,
  client,
  request,
  fastify,
}) {
  // Client credentials grant - no user context
  const requestedScope = scope || client.allowed_scopes.join(' ');

  // Generate token pair (no refresh token for client credentials)
  const tokenResponse = await tokenService.generateTokenPair({
    clientId: client.client_id,
    userId: null, // No user for client credentials
    scope: requestedScope,
    userInfo: {
      sub: client.client_id,
      client_name: client.client_name,
    },
  });

  // Remove refresh token from response (not used in client_credentials)
  delete tokenResponse.refresh_token;

  return tokenResponse;
}
