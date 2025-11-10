/**
 * GitHub App Management Routes
 *
 * RESTful API endpoints for GitHub App installation management:
 * - GET /api/github/apps/installations - List app installations
 * - GET /api/github/apps/installations/:id - Get installation details
 * - POST /api/github/apps/installations/:id/sync - Sync installation from GitHub
 * - DELETE /api/github/apps/installations/:id - Delete/uninstall app
 * - POST /api/github/apps/installations/:id/token - Get installation token
 */

import { GitHubApp, GitHubAppError } from '../services/github/github-app.js';
import { getPool } from '../database/connection.js';
import config from '../config/index.js';

/**
 * GitHub App routes plugin
 */
export default async function githubAppRoutes(fastify, options) {
  const pool = getPool();

  // Initialize GitHub App service
  let githubApp;
  try {
    githubApp = new GitHubApp({
      appId: config.github?.appId || process.env.GITHUB_APP_ID,
      privateKey: config.github?.privateKey || process.env.GITHUB_APP_PRIVATE_KEY,
      webhookSecret: config.github?.webhookSecret || process.env.GITHUB_APP_WEBHOOK_SECRET,
      logger: fastify.log,
      pool
    });
  } catch (error) {
    fastify.log.warn('GitHub App not configured', { error: error.message });
  }

  /**
   * Helper to require GitHub App configuration
   */
  function requireGitHubApp(request, reply) {
    if (!githubApp) {
      return reply.code(503).send({
        error: 'GitHub App not configured',
        message: 'GitHub App credentials are required for this endpoint'
      });
    }
  }

  /**
   * List app installations
   * GET /api/github/apps/installations
   */
  fastify.get('/installations', {
    preHandler: [
      (request, reply) => fastify.authenticate(request, reply),
      requireGitHubApp
    ],
    schema: {
      description: 'List GitHub App installations',
      tags: ['GitHub Apps'],
      querystring: {
        type: 'object',
        properties: {
          per_page: { type: 'integer', minimum: 1, maximum: 100, default: 30 },
          page: { type: 'integer', minimum: 1, default: 1 }
        }
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              account: { type: 'object' },
              target_type: { type: 'string' },
              permissions: { type: 'object' },
              repository_selection: { type: 'string' },
              created_at: { type: 'string' }
            }
          }
        },
        503: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const installations = await githubApp.listInstallations({
        perPage: request.query.per_page,
        page: request.query.page
      });

      return reply.send(installations);
    } catch (error) {
      fastify.log.error('Failed to list installations', { error: error.message });
      
      if (error instanceof GitHubAppError) {
        return reply.code(error.statusCode || 500).send({
          error: 'Failed to list installations',
          message: error.message
        });
      }

      return reply.code(500).send({
        error: 'Internal server error',
        message: 'Failed to list GitHub App installations'
      });
    }
  });

  /**
   * Get installation details
   * GET /api/github/apps/installations/:id
   */
  fastify.get('/installations/:id', {
    preHandler: [
      (request, reply) => fastify.authenticate(request, reply),
      requireGitHubApp
    ],
    schema: {
      description: 'Get GitHub App installation details',
      tags: ['GitHub Apps'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'integer', description: 'Installation ID' }
        },
        required: ['id']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            account: { type: 'object' },
            target_type: { type: 'string' },
            permissions: { type: 'object' },
            repository_selection: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const installationId = parseInt(request.params.id, 10);
      
      // Try to get from database first
      let installation = await githubApp.getStoredInstallation(installationId);
      
      // If not found, fetch from GitHub and store
      if (!installation) {
        const githubInstallation = await githubApp.getInstallation(installationId);
        installation = await githubApp.storeInstallation(githubInstallation);
      }

      return reply.send(installation);
    } catch (error) {
      fastify.log.error('Failed to get installation', { 
        error: error.message,
        installationId: request.params.id
      });
      
      if (error instanceof GitHubAppError) {
        return reply.code(error.statusCode || 500).send({
          error: 'Failed to get installation',
          message: error.message
        });
      }

      return reply.code(500).send({
        error: 'Internal server error',
        message: 'Failed to get GitHub App installation'
      });
    }
  });

  /**
   * Sync installation from GitHub
   * POST /api/github/apps/installations/:id/sync
   */
  fastify.post('/installations/:id/sync', {
    preHandler: [
      (request, reply) => fastify.authenticate(request, reply),
      requireGitHubApp
    ],
    schema: {
      description: 'Sync installation data from GitHub',
      tags: ['GitHub Apps'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'integer', description: 'Installation ID' }
        },
        required: ['id']
      },
      body: {
        type: 'object',
        properties: {
          organization_id: { 
            type: 'string', 
            format: 'uuid',
            description: 'Heimdall organization ID to link installation'
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const installationId = parseInt(request.params.id, 10);
      const organizationId = request.body?.organization_id || null;

      // Fetch latest from GitHub
      const githubInstallation = await githubApp.getInstallation(installationId);
      
      // Store in database
      const installation = await githubApp.storeInstallation(githubInstallation, organizationId);

      return reply.send({
        success: true,
        installation
      });
    } catch (error) {
      fastify.log.error('Failed to sync installation', { 
        error: error.message,
        installationId: request.params.id
      });
      
      if (error instanceof GitHubAppError) {
        return reply.code(error.statusCode || 500).send({
          error: 'Failed to sync installation',
          message: error.message
        });
      }

      return reply.code(500).send({
        error: 'Internal server error',
        message: 'Failed to sync GitHub App installation'
      });
    }
  });

  /**
   * Get installation access token
   * POST /api/github/apps/installations/:id/token
   */
  fastify.post('/installations/:id/token', {
    preHandler: [
      (request, reply) => fastify.authenticate(request, reply),
      requireGitHubApp
    ],
    schema: {
      description: 'Get installation access token',
      tags: ['GitHub Apps'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'integer', description: 'Installation ID' }
        },
        required: ['id']
      },
      body: {
        type: 'object',
        properties: {
          permissions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional permissions to request'
          },
          repository_ids: {
            type: 'array',
            items: { type: 'integer' },
            description: 'Repository IDs for repository-level access'
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            expires_at: { type: 'string' },
            permissions: { type: 'object' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const installationId = parseInt(request.params.id, 10);
      
      const tokenData = await githubApp.getInstallationAccessToken(installationId, {
        permissions: request.body?.permissions,
        repositoryIds: request.body?.repository_ids
      });

      return reply.send({
        token: tokenData.token,
        expires_at: tokenData.expires_at,
        permissions: tokenData.permissions || {},
        repository_selection: tokenData.repository_selection
      });
    } catch (error) {
      fastify.log.error('Failed to get installation token', { 
        error: error.message,
        installationId: request.params.id
      });
      
      if (error instanceof GitHubAppError) {
        return reply.code(error.statusCode || 500).send({
          error: 'Failed to get installation token',
          message: error.message
        });
      }

      return reply.code(500).send({
        error: 'Internal server error',
        message: 'Failed to get GitHub App installation token'
      });
    }
  });

  /**
   * Delete/uninstall app
   * DELETE /api/github/apps/installations/:id
   */
  fastify.delete('/installations/:id', {
    preHandler: [
      (request, reply) => fastify.authenticate(request, reply),
      requireGitHubApp
    ],
    schema: {
      description: 'Delete/uninstall GitHub App',
      tags: ['GitHub Apps'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'integer', description: 'Installation ID' }
        },
        required: ['id']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const installationId = parseInt(request.params.id, 10);
      
      await githubApp.deleteInstallation(installationId);

      return reply.send({
        success: true,
        message: 'GitHub App uninstalled successfully'
      });
    } catch (error) {
      fastify.log.error('Failed to delete installation', { 
        error: error.message,
        installationId: request.params.id
      });
      
      if (error instanceof GitHubAppError) {
        return reply.code(error.statusCode || 500).send({
          error: 'Failed to delete installation',
          message: error.message
        });
      }

      return reply.code(500).send({
        error: 'Internal server error',
        message: 'Failed to uninstall GitHub App'
      });
    }
  });
}

