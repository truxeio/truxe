/**
 * OAuth Provider - Authorization Flow Routes
 * 
 * Implements OAuth 2.0 Authorization Code Flow:
 * - GET /authorize - Authorization consent screen (displays to user)
 * - POST /authorize - Grant/deny authorization (user decision)
 * 
 * Features:
 * - PKCE support (S256 and plain)
 * - State parameter validation
 * - User consent management
 * - Trusted client support (skip consent)
 * 
 * @requires Authentication - User must be authenticated
 */

import authorizationService from '../../services/oauth-provider/authorization-service.js';
import clientService from '../../services/oauth-provider/client-service.js';

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
 * Build redirect URL with parameters
 */
function buildRedirectUrl(baseUrl, params) {
  const url = new URL(baseUrl);
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });
  
  return url.toString();
}

export default async function authorizeRoutes(fastify, options) {
  
  // ============================================================================
  // GET /authorize - Authorization consent screen
  // ============================================================================
  
  fastify.get('/authorize', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'OAuth 2.0 authorization endpoint - Display consent screen (HTML or JSON)',
      tags: ['OAuth Provider'],
      querystring: {
        type: 'object',
        required: ['client_id', 'redirect_uri', 'response_type'],
        properties: {
          client_id: {
            type: 'string',
            description: 'Client ID',
          },
          redirect_uri: {
            type: 'string',
            format: 'uri',
            description: 'Redirect URI (must be whitelisted)',
          },
          response_type: {
            type: 'string',
            enum: ['code'],
            description: 'Response type (must be "code")',
          },
          scope: {
            type: 'string',
            description: 'Space-separated scopes',
          },
          state: {
            type: 'string',
            description: 'State parameter for CSRF protection',
          },
          nonce: {
            type: 'string',
            description: 'Nonce for OpenID Connect',
          },
          code_challenge: {
            type: 'string',
            description: 'PKCE code challenge',
          },
          code_challenge_method: {
            type: 'string',
            enum: ['S256', 'plain'],
            description: 'PKCE code challenge method',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            client: {
              type: 'object',
              properties: {
                client_id: { type: 'string' },
                client_name: { type: 'string' },
                client_uri: { type: 'string' },
                logo_uri: { type: 'string' },
                tos_uri: { type: 'string' },
                policy_uri: { type: 'string' },
              },
            },
            scopes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                },
              },
            },
            redirect_uri: { type: 'string' },
            state: { type: 'string' },
            require_consent: { type: 'boolean' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const {
        client_id,
        redirect_uri,
        response_type,
        scope = 'openid profile email',
        state,
        nonce,
        code_challenge,
        code_challenge_method,
      } = request.query;

      const userId = request.user.id;

      // Validate authorization request
      try {
        await authorizationService.validateAuthorizationRequest({
          clientId: client_id,
          redirectUri: redirect_uri,
          responseType: response_type,
          scope,
          state,
          codeChallengeMethod: code_challenge_method,
          codeChallenge: code_challenge,
        });
      } catch (validationError) {
        // Redirect with error if redirect_uri is valid
        const client = await clientService.getClientById(client_id);
        
        if (client && client.redirect_uris.includes(redirect_uri)) {
          const errorUrl = buildRedirectUrl(redirect_uri, {
            error: 'invalid_request',
            error_description: validationError.message,
            state,
          });
          return reply.redirect(errorUrl);
        }
        
        // Otherwise return error response
        const { statusCode, payload } = buildOAuthError(
          'invalid_request',
          validationError.message,
          400
        );
        return reply.code(statusCode).send(payload);
      }

      // Get client details
      const client = await clientService.getClientById(client_id);

      // Parse requested scopes
      const requestedScopes = authorizationService.parseScopes(scope);

      // Check if consent already granted (for trusted clients or existing consent)
      const existingConsent = await authorizationService.checkUserConsent(
        userId,
        client_id,
        requestedScopes
      );

      // If trusted client or consent exists, auto-approve
      if (client.trusted || (!client.require_consent && existingConsent)) {
        // Generate authorization code
        const { code: authCode } = await authorizationService.generateAuthorizationCode({
          clientId: client_id,
          userId,
          redirectUri: redirect_uri,
          scopes: requestedScopes,
          codeChallenge: code_challenge,
          codeChallengeMethod: code_challenge_method,
        });

        // Redirect with authorization code
        const successUrl = buildRedirectUrl(redirect_uri, {
          code: authCode,
          state,
        });
        
        return reply.redirect(successUrl);
      }

      // Return consent screen data
      const scopeDescriptions = requestedScopes.map(scopeName => ({
        name: scopeName,
        description: getScopeDescription(scopeName),
      }));

      const consentData = {
        client: {
          client_id: client.client_id,
          client_name: client.client_name,
          client_uri: client.client_uri,
          logo_uri: client.logo_uri,
          tos_uri: client.tos_uri,
          policy_uri: client.policy_uri,
        },
        scopes: scopeDescriptions,
        redirect_uri,
        state,
        require_consent: client.require_consent,
      };

      // Check Accept header for HTML or JSON response
      const acceptsHtml = request.headers.accept?.includes('text/html');
      
      if (acceptsHtml) {
        // Serve HTML consent screen - The HTML will fetch JSON data via AJAX
        reply.type('text/html');
        return reply.sendFile('oauth/consent.html');
      }

      // Return JSON for API clients (including AJAX requests from consent screen)
      return reply.send(consentData);
    } catch (error) {
      fastify.log.error({ err: error }, 'Authorization request failed');
      
      const { statusCode, payload } = buildOAuthError(
        'server_error',
        'Authorization request failed',
        500
      );
      return reply.code(statusCode).send(payload);
    }
  });

  // ============================================================================
  // POST /authorize - Grant/deny authorization
  // ============================================================================
  
  fastify.post('/authorize', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'OAuth 2.0 authorization endpoint - User consent decision',
      tags: ['OAuth Provider'],
      body: {
        type: 'object',
        required: ['client_id', 'redirect_uri', 'authorized'],
        properties: {
          client_id: {
            type: 'string',
            description: 'Client ID',
          },
          redirect_uri: {
            type: 'string',
            format: 'uri',
            description: 'Redirect URI',
          },
          authorized: {
            type: 'boolean',
            description: 'User authorization decision (true = grant, false = deny)',
          },
          scope: {
            type: 'string',
            description: 'Space-separated scopes',
          },
          state: {
            type: 'string',
            description: 'State parameter',
          },
          nonce: {
            type: 'string',
            description: 'Nonce for OpenID Connect',
          },
          code_challenge: {
            type: 'string',
            description: 'PKCE code challenge',
          },
          code_challenge_method: {
            type: 'string',
            enum: ['S256', 'plain'],
            description: 'PKCE code challenge method',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            redirect_url: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const {
        client_id,
        redirect_uri,
        authorized,
        scope = 'openid profile email',
        state,
        nonce,
        code_challenge,
        code_challenge_method,
      } = request.body;

      const userId = request.user.id;

      // Validate client and redirect_uri
      const client = await clientService.getClientById(client_id);
      
      if (!client) {
        const { statusCode, payload } = buildOAuthError(
          'invalid_client',
          'Invalid client_id',
          400
        );
        return reply.code(statusCode).send(payload);
      }

      const isValidRedirectUri = await clientService.validateRedirectUri(client_id, redirect_uri);
      
      if (!isValidRedirectUri) {
        const { statusCode, payload } = buildOAuthError(
          'invalid_request',
          'Invalid redirect_uri',
          400
        );
        return reply.code(statusCode).send(payload);
      }

      // If user denied authorization
      if (!authorized) {
        const errorUrl = buildRedirectUrl(redirect_uri, {
          error: 'access_denied',
          error_description: 'User denied authorization',
          state,
        });
        
        return reply.send({ redirect_url: errorUrl });
      }

      // User authorized - validate request
      try {
        await authorizationService.validateAuthorizationRequest({
          clientId: client_id,
          redirectUri: redirect_uri,
          responseType: 'code',
          scope,
          state,
          codeChallengeMethod: code_challenge_method,
          codeChallenge: code_challenge,
        });
      } catch (validationError) {
        const errorUrl = buildRedirectUrl(redirect_uri, {
          error: 'invalid_request',
          error_description: validationError.message,
          state,
        });
        
        return reply.send({ redirect_url: errorUrl });
      }

      // Parse scopes
      const requestedScopes = authorizationService.parseScopes(scope);

      // Store user consent (if consent is required)
      if (client.require_consent) {
        await authorizationService.recordUserConsent({
          userId,
          clientId: client_id,
          scopes: requestedScopes,
        });
      }

      // Generate authorization code
      const { code: authCode } = await authorizationService.generateAuthorizationCode({
        clientId: client_id,
        userId,
        redirectUri: redirect_uri,
        scopes: requestedScopes,
        codeChallenge: code_challenge,
        codeChallengeMethod: code_challenge_method,
      });

      // Build success redirect URL
      const successUrl = buildRedirectUrl(redirect_uri, {
        code: authCode,
        state,
      });

      fastify.log.info({
        userId,
        clientId: client_id,
        scopes: requestedScopes,
      }, 'Authorization granted');

      return reply.send({ redirect_url: successUrl });
    } catch (error) {
      fastify.log.error({ err: error }, 'Authorization failed');
      
      const { statusCode, payload } = buildOAuthError(
        'server_error',
        'Authorization failed',
        500
      );
      return reply.code(statusCode).send(payload);
    }
  });
}

/**
 * Get human-readable description for OAuth scope
 */
function getScopeDescription(scope) {
  const descriptions = {
    openid: 'Verify your identity',
    profile: 'Access your basic profile information (name, username)',
    email: 'Access your email address',
    read: 'Read your data',
    write: 'Modify your data',
    delete: 'Delete your data',
  };
  
  return descriptions[scope] || `Access ${scope}`;
}
