/**
 * OAuth Provider - Client Management Routes
 * 
 * Provides endpoints for managing OAuth client applications:
 * - POST /clients - Register new OAuth client
 * - GET /clients - List user's OAuth clients
 * - GET /clients/:id - Get client details
 * - PATCH /clients/:id - Update client settings
 * - DELETE /clients/:id - Delete/revoke client
 * 
 * @requires Authentication - User must be authenticated
 * @requires Authorization - Organization-level permissions
 */

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

export default async function clientRoutes(fastify, options) {
  
  // ============================================================================
  // POST /clients - Register new OAuth client
  // ============================================================================
  
  fastify.post('/clients', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Register a new OAuth client application',
      tags: ['OAuth Provider'],
      body: {
        type: 'object',
        required: ['client_name', 'redirect_uris'],
        properties: {
          client_name: {
            type: 'string',
            minLength: 1,
            maxLength: 255,
            description: 'Human-readable name of the client application',
          },
          redirect_uris: {
            type: 'array',
            items: { type: 'string', format: 'uri' },
            minItems: 1,
            description: 'Array of allowed redirect URIs',
          },
          allowed_scopes: {
            type: 'array',
            items: { type: 'string' },
            default: ['openid', 'email', 'profile'],
            description: 'OAuth scopes allowed for this client',
          },
          require_pkce: {
            type: 'boolean',
            default: true,
            description: 'Require PKCE (Proof Key for Code Exchange)',
          },
          require_consent: {
            type: 'boolean',
            default: true,
            description: 'Require user consent screen',
          },
          trusted: {
            type: 'boolean',
            default: false,
            description: 'Skip consent for trusted clients',
          },
          client_uri: {
            type: 'string',
            format: 'uri',
            description: 'Client application homepage URL',
          },
          logo_uri: {
            type: 'string',
            format: 'uri',
            description: 'URL of client logo',
          },
          tos_uri: {
            type: 'string',
            format: 'uri',
            description: 'Terms of service URL',
          },
          policy_uri: {
            type: 'string',
            format: 'uri',
            description: 'Privacy policy URL',
          },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            client_id: { type: 'string' },
            client_secret: { type: 'string' },
            client_name: { type: 'string' },
            redirect_uris: { type: 'array', items: { type: 'string' } },
            allowed_scopes: { type: 'array', items: { type: 'string' } },
            require_pkce: { type: 'boolean' },
            require_consent: { type: 'boolean' },
            trusted: { type: 'boolean' },
            tenant_id: { type: 'string', format: 'uuid' },
            status: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        400: {
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
      const userId = request.user.id;
      const tenantId = request.user.tenantId;
      
      if (!tenantId) {
        const { statusCode, payload } = buildOAuthError(
          'invalid_request',
          'User must belong to an organization to register OAuth clients',
          400
        );
        return reply.code(statusCode).send(payload);
      }

      const {
        client_name,
        redirect_uris,
        allowed_scopes = ['openid', 'email', 'profile'],
        require_pkce = true,
        require_consent = true,
        trusted = false,
        client_uri,
        logo_uri,
        tos_uri,
        policy_uri,
      } = request.body;

      // Register client
      const client = await clientService.registerClient({
        clientName: client_name,
        redirectUris: redirect_uris,
        tenantId,
        createdBy: userId,
        allowedScopes: allowed_scopes,
        requirePkce: require_pkce,
        requireConsent: require_consent,
        trusted,
        clientUri: client_uri,
        logoUri: logo_uri,
        tosUri: tos_uri,
        policyUri: policy_uri,
      });

      fastify.log.info({
        userId,
        tenantId,
        clientId: client.client_id,
      }, 'OAuth client registered');

      return reply.code(201).send({
        client_id: client.client_id,
        client_secret: client.client_secret, // Only shown once!
        client_name: client.client_name,
        redirect_uris: client.redirect_uris,
        allowed_scopes: client.allowed_scopes,
        require_pkce: client.require_pkce,
        require_consent: client.require_consent,
        trusted: client.trusted,
        tenant_id: client.tenant_id,
        status: client.status,
        created_at: client.created_at,
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Failed to register OAuth client');
      
      const { statusCode, payload } = buildOAuthError(
        'server_error',
        error.message || 'Failed to register OAuth client',
        500
      );
      return reply.code(statusCode).send(payload);
    }
  });

  // ============================================================================
  // GET /clients - List user's OAuth clients
  // ============================================================================
  
  fastify.get('/clients', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'List OAuth clients for the authenticated user\'s organization',
      tags: ['OAuth Provider'],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            clients: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  client_id: { type: 'string' },
                  client_name: { type: 'string' },
                  redirect_uris: { type: 'array', items: { type: 'string' } },
                  allowed_scopes: { type: 'array', items: { type: 'string' } },
                  require_pkce: { type: 'boolean' },
                  require_consent: { type: 'boolean' },
                  trusted: { type: 'boolean' },
                  status: { type: 'string' },
                  created_at: { type: 'string', format: 'date-time' },
                  last_used_at: { type: 'string', format: 'date-time' },
                },
              },
            },
            total: { type: 'integer' },
            limit: { type: 'integer' },
            offset: { type: 'integer' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const tenantId = request.user.tenantId;
      const { limit = 50, offset = 0 } = request.query;

      if (!tenantId) {
        const { statusCode, payload } = buildOAuthError(
          'invalid_request',
          'User must belong to an organization',
          400
        );
        return reply.code(statusCode).send(payload);
      }

      const result = await clientService.listClients(tenantId, { limit, offset });

      return reply.send({
        clients: result.clients,
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Failed to list OAuth clients');
      
      const { statusCode, payload } = buildOAuthError(
        'server_error',
        'Failed to list OAuth clients',
        500
      );
      return reply.code(statusCode).send(payload);
    }
  });

  // ============================================================================
  // GET /clients/:id - Get client details
  // ============================================================================
  
  fastify.get('/clients/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get details of a specific OAuth client',
      tags: ['OAuth Provider'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Client ID' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            client_id: { type: 'string' },
            client_name: { type: 'string' },
            client_uri: { type: 'string' },
            logo_uri: { type: 'string' },
            tos_uri: { type: 'string' },
            policy_uri: { type: 'string' },
            redirect_uris: { type: 'array', items: { type: 'string' } },
            allowed_scopes: { type: 'array', items: { type: 'string' } },
            require_pkce: { type: 'boolean' },
            require_consent: { type: 'boolean' },
            trusted: { type: 'boolean' },
            tenant_id: { type: 'string', format: 'uuid' },
            status: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
            last_used_at: { type: 'string', format: 'date-time' },
          },
        },
        404: {
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
      const { id: clientId } = request.params;
      const tenantId = request.user.tenantId;

      const client = await clientService.getClientById(clientId);

      if (!client) {
        const { statusCode, payload } = buildOAuthError(
          'not_found',
          'OAuth client not found',
          404
        );
        return reply.code(statusCode).send(payload);
      }

      // Verify client belongs to user's organization
      if (client.tenant_id !== tenantId) {
        const { statusCode, payload } = buildOAuthError(
          'forbidden',
          'Access denied to this OAuth client',
          403
        );
        return reply.code(statusCode).send(payload);
      }

      return reply.send(client);
    } catch (error) {
      fastify.log.error({ err: error }, 'Failed to get OAuth client');
      
      const { statusCode, payload } = buildOAuthError(
        'server_error',
        'Failed to get OAuth client',
        500
      );
      return reply.code(statusCode).send(payload);
    }
  });

  // ============================================================================
  // PATCH /clients/:id - Update client settings
  // ============================================================================
  
  fastify.patch('/clients/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Update OAuth client settings',
      tags: ['OAuth Provider'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Client ID' },
        },
      },
      body: {
        type: 'object',
        properties: {
          client_name: { type: 'string', minLength: 1, maxLength: 255 },
          redirect_uris: {
            type: 'array',
            items: { type: 'string', format: 'uri' },
            minItems: 1,
          },
          allowed_scopes: {
            type: 'array',
            items: { type: 'string' },
          },
          require_pkce: { type: 'boolean' },
          require_consent: { type: 'boolean' },
          client_uri: { type: 'string', format: 'uri' },
          logo_uri: { type: 'string', format: 'uri' },
          tos_uri: { type: 'string', format: 'uri' },
          policy_uri: { type: 'string', format: 'uri' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            client_id: { type: 'string' },
            client_name: { type: 'string' },
            redirect_uris: { type: 'array', items: { type: 'string' } },
            allowed_scopes: { type: 'array', items: { type: 'string' } },
            require_pkce: { type: 'boolean' },
            require_consent: { type: 'boolean' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        404: {
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
      const { id: clientId } = request.params;
      const tenantId = request.user.tenantId;
      const updates = request.body;

      // Verify client exists and belongs to user's organization
      const existingClient = await clientService.getClientById(clientId);

      if (!existingClient) {
        const { statusCode, payload } = buildOAuthError(
          'not_found',
          'OAuth client not found',
          404
        );
        return reply.code(statusCode).send(payload);
      }

      if (existingClient.tenant_id !== tenantId) {
        const { statusCode, payload } = buildOAuthError(
          'forbidden',
          'Access denied to this OAuth client',
          403
        );
        return reply.code(statusCode).send(payload);
      }

      // Convert snake_case to camelCase for service
      const serviceUpdates = {};
      if (updates.client_name) serviceUpdates.clientName = updates.client_name;
      if (updates.redirect_uris) serviceUpdates.redirectUris = updates.redirect_uris;
      if (updates.allowed_scopes) serviceUpdates.allowedScopes = updates.allowed_scopes;
      if (updates.require_pkce !== undefined) serviceUpdates.requirePkce = updates.require_pkce;
      if (updates.require_consent !== undefined) serviceUpdates.requireConsent = updates.require_consent;
      if (updates.client_uri) serviceUpdates.clientUri = updates.client_uri;
      if (updates.logo_uri) serviceUpdates.logoUri = updates.logo_uri;
      if (updates.tos_uri) serviceUpdates.tosUri = updates.tos_uri;
      if (updates.policy_uri) serviceUpdates.policyUri = updates.policy_uri;

      const updatedClient = await clientService.updateClient(clientId, serviceUpdates);

      fastify.log.info({
        clientId,
        tenantId,
        updates: Object.keys(serviceUpdates),
      }, 'OAuth client updated');

      return reply.send({
        client_id: updatedClient.client_id,
        client_name: updatedClient.client_name,
        redirect_uris: updatedClient.redirect_uris,
        allowed_scopes: updatedClient.allowed_scopes,
        require_pkce: updatedClient.require_pkce,
        require_consent: updatedClient.require_consent,
        updated_at: updatedClient.updated_at,
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Failed to update OAuth client');
      
      const { statusCode, payload } = buildOAuthError(
        'server_error',
        error.message || 'Failed to update OAuth client',
        500
      );
      return reply.code(statusCode).send(payload);
    }
  });

  // ============================================================================
  // DELETE /clients/:id - Delete/revoke client
  // ============================================================================
  
  fastify.delete('/clients/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Delete OAuth client (revokes all tokens)',
      tags: ['OAuth Provider'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Client ID' },
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
        404: {
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
      const { id: clientId } = request.params;
      const tenantId = request.user.tenantId;

      // Verify client exists and belongs to user's organization
      const existingClient = await clientService.getClientById(clientId);

      if (!existingClient) {
        const { statusCode, payload } = buildOAuthError(
          'not_found',
          'OAuth client not found',
          404
        );
        return reply.code(statusCode).send(payload);
      }

      if (existingClient.tenant_id !== tenantId) {
        const { statusCode, payload } = buildOAuthError(
          'forbidden',
          'Access denied to this OAuth client',
          403
        );
        return reply.code(statusCode).send(payload);
      }

      // Delete client (this will cascade delete tokens and codes)
      await clientService.deleteClient(clientId);

      fastify.log.info({
        clientId,
        tenantId,
      }, 'OAuth client deleted');

      return reply.send({
        success: true,
        message: 'OAuth client deleted successfully',
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Failed to delete OAuth client');
      
      const { statusCode, payload } = buildOAuthError(
        'server_error',
        'Failed to delete OAuth client',
        500
      );
      return reply.code(statusCode).send(payload);
    }
  });

  // ============================================================================
  // GET /clients/:id/stats - Get client statistics
  // ============================================================================
  
  fastify.get('/clients/:id/stats', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get OAuth client usage statistics',
      tags: ['OAuth Provider'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Client ID' },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          timeframe: { 
            type: 'string', 
            enum: ['1h', '24h', '7d', '30d'],
            default: '24h',
            description: 'Time window for statistics' 
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            clientId: { type: 'string' },
            stats: {
              type: 'object',
              properties: {
                tokensGenerated: { type: 'number' },
                tokensRefreshed: { type: 'number' },
                activeTokens: { type: 'number' },
                authFailures: { type: 'number' },
                lastTokenIssued: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id: clientId } = request.params;
      const { timeframe = '24h' } = request.query;
      const tenantId = request.user.tenantId;

      // Verify client exists and belongs to user's organization
      const existingClient = await clientService.getClientById(clientId);

      if (!existingClient) {
        const { statusCode, payload } = buildOAuthError(
          'not_found',
          'OAuth client not found',
          404
        );
        return reply.code(statusCode).send(payload);
      }

      if (existingClient.tenant_id !== tenantId) {
        const { statusCode, payload } = buildOAuthError(
          'forbidden',
          'Access denied to this OAuth client',
          403
        );
        return reply.code(statusCode).send(payload);
      }

      // Get token statistics
      const stats = await clientService.getClientStats(clientId, timeframe);

      return reply.send({
        clientId,
        timeframe,
        stats,
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Failed to get client statistics');
      
      // Return empty stats instead of error (metrics service might be unavailable)
      return reply.send({
        clientId: request.params.id,
        timeframe: request.query.timeframe || '24h',
        stats: {
          tokensGenerated: 0,
          tokensRefreshed: 0,
          activeTokens: 0,
          authFailures: 0,
          lastTokenIssued: null,
        },
      });
    }
  });

  // ============================================================================
  // POST /clients/:id/regenerate-secret - Regenerate client secret
  // ============================================================================
  
  fastify.post('/clients/:id/regenerate-secret', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Regenerate OAuth client secret (invalidates old secret)',
      tags: ['OAuth Provider'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Client ID' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            client_secret: { type: 'string' },
            message: { type: 'string' },
            warning: { type: 'string' },
          },
        },
        404: {
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
      const { id: clientId } = request.params;
      const tenantId = request.user.tenantId;
      const userId = request.user.id;

      // Verify client exists and belongs to user's organization
      const existingClient = await clientService.getClientById(clientId);

      if (!existingClient) {
        const { statusCode, payload } = buildOAuthError(
          'not_found',
          'OAuth client not found',
          404
        );
        return reply.code(statusCode).send(payload);
      }

      if (existingClient.tenant_id !== tenantId) {
        const { statusCode, payload } = buildOAuthError(
          'forbidden',
          'Access denied to this OAuth client',
          403
        );
        return reply.code(statusCode).send(payload);
      }

      // Regenerate secret
      const result = await clientService.regenerateClientSecret(clientId);

      fastify.log.warn({
        clientId,
        tenantId,
        userId,
      }, 'OAuth client secret regenerated');

      return reply.send({
        client_secret: result.client_secret,
        message: 'Client secret regenerated successfully',
        warning: 'This is the only time the secret will be shown. Please save it now.',
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Failed to regenerate client secret');
      
      const { statusCode, payload } = buildOAuthError(
        'server_error',
        error.message || 'Failed to regenerate client secret',
        500
      );
      return reply.code(statusCode).send(payload);
    }
  });
}
