/**
 * OAuth Provider - UserInfo & Discovery Routes
 * 
 * Implements OpenID Connect UserInfo and OAuth Server Metadata endpoints:
 * - GET /userinfo - OpenID Connect UserInfo endpoint
 * - GET /.well-known/oauth-authorization-server - OAuth 2.0 Authorization Server Metadata
 * - GET /.well-known/openid-configuration - OpenID Connect Discovery
 * 
 * Standards:
 * - OpenID Connect Core 1.0
 * - RFC 8414 (OAuth 2.0 Authorization Server Metadata)
 * - RFC 7662 (Token Introspection)
 * - RFC 7009 (Token Revocation)
 */

import jwt from 'jsonwebtoken';
import { getPool } from '../../database/connection.js';
import config from '../../config/index.js';

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

/**
 * Extract bearer token from Authorization header
 */
function extractBearerToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

export default async function userinfoRoutes(fastify, options) {
  
  // ============================================================================
  // GET /userinfo - OpenID Connect UserInfo Endpoint
  // ============================================================================
  
  fastify.get('/userinfo', {
    schema: {
      description: 'OpenID Connect UserInfo endpoint - Get user profile information',
      tags: ['OAuth Provider', 'OpenID Connect'],
      headers: {
        type: 'object',
        required: ['authorization'],
        properties: {
          authorization: {
            type: 'string',
            description: 'Bearer token',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            sub: { type: 'string' },
            email: { type: 'string' },
            email_verified: { type: 'boolean' },
            username: { type: 'string' },
            name: { type: 'string' },
            given_name: { type: 'string' },
            family_name: { type: 'string' },
            picture: { type: 'string' },
            updated_at: { type: 'number' },
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
      // Extract access token from Authorization header
      const accessToken = extractBearerToken(request.headers.authorization);

      if (!accessToken) {
        const { statusCode, payload } = buildOAuthError(
          'invalid_token',
          'Missing or invalid Authorization header',
          401
        );
        return reply.code(statusCode).send(payload);
      }

      // Verify and decode JWT token
      let decoded;
      try {
        // Get JWT public key from JWT service
        const jwtService = await import('../../services/jwt.js');
        const publicKey = jwtService.default.getPublicKey();
        
        decoded = jwt.verify(accessToken, publicKey, {
          algorithms: ['RS256'],
        });
      } catch (jwtError) {
        const { statusCode, payload } = buildOAuthError(
          'invalid_token',
          'Token verification failed',
          401
        );
        return reply.code(statusCode).send(payload);
      }

      // Extract user ID from token
      const userId = decoded.sub;

      if (!userId) {
        const { statusCode, payload } = buildOAuthError(
          'invalid_token',
          'Token does not contain user information',
          401
        );
        return reply.code(statusCode).send(payload);
      }

      // Get user information from database
      const pool = getPool();
      const userResult = await pool.query(
        `SELECT 
          id,
          email,
          email_verified,
          username,
          full_name,
          given_name,
          family_name,
          avatar_url,
          updated_at
        FROM users
        WHERE id = $1`,
        [userId]
      );

      if (userResult.rows.length === 0) {
        const { statusCode, payload } = buildOAuthError(
          'invalid_token',
          'User not found',
          401
        );
        return reply.code(statusCode).send(payload);
      }

      const user = userResult.rows[0];

      // Check token scope - return only allowed claims
      const scopes = decoded.scope ? decoded.scope.split(' ') : [];

      // Build UserInfo response based on scopes
      const userInfo = {
        sub: user.id,
      };

      // profile scope - basic profile information
      if (scopes.includes('profile') || scopes.includes('openid')) {
        if (user.username) userInfo.username = user.username;
        if (user.full_name) userInfo.name = user.full_name;
        if (user.given_name) userInfo.given_name = user.given_name;
        if (user.family_name) userInfo.family_name = user.family_name;
        if (user.avatar_url) userInfo.picture = user.avatar_url;
        if (user.updated_at) {
          userInfo.updated_at = Math.floor(new Date(user.updated_at).getTime() / 1000);
        }
      }

      // email scope - email address
      if (scopes.includes('email') || scopes.includes('openid')) {
        if (user.email) userInfo.email = user.email;
        userInfo.email_verified = user.email_verified || false;
      }

      return reply.send(userInfo);
    } catch (error) {
      fastify.log.error({ err: error }, 'UserInfo request failed');

      const { statusCode, payload } = buildOAuthError(
        'server_error',
        'Failed to retrieve user information',
        500
      );
      return reply.code(statusCode).send(payload);
    }
  });

  // ============================================================================
  // GET /.well-known/oauth-authorization-server - OAuth Server Metadata
  // ============================================================================
  
  fastify.get('/.well-known/oauth-authorization-server', {
    schema: {
      description: 'OAuth 2.0 Authorization Server Metadata (RFC 8414)',
      tags: ['OAuth Provider', 'Discovery'],
      response: {
        200: {
          type: 'object',
          properties: {
            issuer: { type: 'string' },
            authorization_endpoint: { type: 'string' },
            token_endpoint: { type: 'string' },
            userinfo_endpoint: { type: 'string' },
            jwks_uri: { type: 'string' },
            registration_endpoint: { type: 'string' },
            scopes_supported: { type: 'array', items: { type: 'string' } },
            response_types_supported: { type: 'array', items: { type: 'string' } },
            response_modes_supported: { type: 'array', items: { type: 'string' } },
            grant_types_supported: { type: 'array', items: { type: 'string' } },
            token_endpoint_auth_methods_supported: { type: 'array', items: { type: 'string' } },
            revocation_endpoint: { type: 'string' },
            revocation_endpoint_auth_methods_supported: { type: 'array', items: { type: 'string' } },
            introspection_endpoint: { type: 'string' },
            introspection_endpoint_auth_methods_supported: { type: 'array', items: { type: 'string' } },
            code_challenge_methods_supported: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  }, async (request, reply) => {
    // Build base URL from request
    const protocol = request.headers['x-forwarded-proto'] || request.protocol || 'https';
    const host = request.headers['x-forwarded-host'] || request.hostname;
    const baseUrl = `${protocol}://${host}`;

    const metadata = {
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/api/oauth/authorize`,
      token_endpoint: `${baseUrl}/api/oauth/token`,
      userinfo_endpoint: `${baseUrl}/api/oauth/userinfo`,
      jwks_uri: `${baseUrl}/.well-known/jwks.json`,
      registration_endpoint: `${baseUrl}/api/oauth/clients`,
      scopes_supported: [
        'openid',
        'profile',
        'email',
        'read',
        'write',
      ],
      response_types_supported: ['code'],
      response_modes_supported: ['query'],
      grant_types_supported: [
        'authorization_code',
        'refresh_token',
        'client_credentials',
      ],
      token_endpoint_auth_methods_supported: [
        'client_secret_post',
        'client_secret_basic',
      ],
      revocation_endpoint: `${baseUrl}/api/oauth/revoke`,
      revocation_endpoint_auth_methods_supported: [
        'client_secret_post',
        'client_secret_basic',
      ],
      introspection_endpoint: `${baseUrl}/api/oauth/introspect`,
      introspection_endpoint_auth_methods_supported: [
        'client_secret_post',
        'client_secret_basic',
      ],
      code_challenge_methods_supported: ['S256', 'plain'],
    };

    return reply.send(metadata);
  });

  // ============================================================================
  // GET /.well-known/openid-configuration - OpenID Connect Discovery
  // ============================================================================
  
  fastify.get('/.well-known/openid-configuration', {
    schema: {
      description: 'OpenID Connect Discovery endpoint',
      tags: ['OAuth Provider', 'OpenID Connect', 'Discovery'],
      response: {
        200: {
          type: 'object',
          properties: {
            issuer: { type: 'string' },
            authorization_endpoint: { type: 'string' },
            token_endpoint: { type: 'string' },
            userinfo_endpoint: { type: 'string' },
            jwks_uri: { type: 'string' },
            registration_endpoint: { type: 'string' },
            scopes_supported: { type: 'array', items: { type: 'string' } },
            response_types_supported: { type: 'array', items: { type: 'string' } },
            response_modes_supported: { type: 'array', items: { type: 'string' } },
            grant_types_supported: { type: 'array', items: { type: 'string' } },
            subject_types_supported: { type: 'array', items: { type: 'string' } },
            id_token_signing_alg_values_supported: { type: 'array', items: { type: 'string' } },
            token_endpoint_auth_methods_supported: { type: 'array', items: { type: 'string' } },
            claims_supported: { type: 'array', items: { type: 'string' } },
            code_challenge_methods_supported: { type: 'array', items: { type: 'string' } },
            revocation_endpoint: { type: 'string' },
            introspection_endpoint: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    // Build base URL from request
    const protocol = request.headers['x-forwarded-proto'] || request.protocol || 'https';
    const host = request.headers['x-forwarded-host'] || request.hostname;
    const baseUrl = `${protocol}://${host}`;

    const metadata = {
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/api/oauth/authorize`,
      token_endpoint: `${baseUrl}/api/oauth/token`,
      userinfo_endpoint: `${baseUrl}/api/oauth/userinfo`,
      jwks_uri: `${baseUrl}/.well-known/jwks.json`,
      registration_endpoint: `${baseUrl}/api/oauth/clients`,
      scopes_supported: [
        'openid',
        'profile',
        'email',
        'read',
        'write',
      ],
      response_types_supported: ['code'],
      response_modes_supported: ['query'],
      grant_types_supported: [
        'authorization_code',
        'refresh_token',
        'client_credentials',
      ],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      token_endpoint_auth_methods_supported: [
        'client_secret_post',
        'client_secret_basic',
      ],
      claims_supported: [
        'sub',
        'iss',
        'aud',
        'exp',
        'iat',
        'email',
        'email_verified',
        'username',
        'name',
        'given_name',
        'family_name',
        'picture',
        'updated_at',
      ],
      code_challenge_methods_supported: ['S256', 'plain'],
      revocation_endpoint: `${baseUrl}/api/oauth/revoke`,
      introspection_endpoint: `${baseUrl}/api/oauth/introspect`,
    };

    return reply.send(metadata);
  });
}
