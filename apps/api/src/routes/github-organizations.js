/**
 * GitHub Organization Management Routes
 *
 * RESTful API endpoints for GitHub organization synchronization:
 * - POST /api/github/organizations/sync - Sync GitHub organization
 * - GET /api/github/organizations - List user's accessible GitHub organizations
 * - GET /api/github/organizations/:orgLogin - Get GitHub organization details
 * - GET /api/github/organizations/:orgLogin/settings - Get organization settings
 * - PUT /api/github/organizations/:orgLogin/settings - Update organization settings
 * - GET /api/github/organizations/:orgLogin/teams - List organization teams
 * - GET /api/github/organizations/:orgLogin/members - List organization members
 */

import createError from '@fastify/error';
import OrganizationSyncService from '../services/github/organization-sync.js';
import OrganizationSettingsService from '../services/github/organization-settings.js';
import GitHubClient from '../services/github/github-client.js';
import { getPool } from '../database/connection.js';
import * as organizationService from '../services/organization.js';
import OAuthTokenEncryptor from '../services/oauth/token-encryptor.js';

/**
 * GitHub Organizations routes plugin
 */
export default async function githubOrganizationRoutes(fastify, options) {
  const logger = fastify.log.child({ component: 'github-organizations' });
  const syncService = new OrganizationSyncService({ logger });
  const settingsService = new OrganizationSettingsService({ logger });

  /**
   * Get GitHub access token for authenticated user
   *
   * @param {string} userId - User ID
   * @returns {Promise<string|null>} Access token or null
   */
  async function getGitHubAccessToken(userId) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT oa.access_token, oa.refresh_token
       FROM oauth_accounts oa
       WHERE oa.user_id = $1
         AND oa.provider = 'github'
       ORDER BY oa.created_at DESC
       LIMIT 1`,
      [userId]
    );

      if (result.rows.length === 0) {
      return null;
    }

    try {
      const encryptor = new OAuthTokenEncryptor({
        key: process.env.OAUTH_TOKEN_ENCRYPTION_KEY || process.env.SECRET_KEY,
      });
      // decrypt is synchronous
      const decrypted = encryptor.decrypt(result.rows[0].access_token);
      return decrypted;
    } catch (error) {
      logger.error('Failed to decrypt GitHub access token', {
        userId,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Sync GitHub organization
   * POST /api/github/organizations/sync
   */
  fastify.post('/sync', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'Sync a GitHub organization to Heimdall',
      tags: ['GitHub Organizations'],
      body: {
        type: 'object',
        required: ['orgLogin'],
        properties: {
          orgLogin: {
            type: 'string',
            description: 'GitHub organization login',
          },
          syncMembers: {
            type: 'boolean',
            default: true,
            description: 'Whether to sync organization members',
          },
          syncTeams: {
            type: 'boolean',
            default: true,
            description: 'Whether to sync organization teams',
          },
          memberBatchSize: {
            type: 'number',
            default: 50,
            minimum: 1,
            maximum: 100,
            description: 'Batch size for member sync',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            result: {
              type: 'object',
              properties: {
                organization: { type: 'object' },
                members: {
                  type: 'object',
                  properties: {
                    total: { type: 'number' },
                    created: { type: 'number' },
                    updated: { type: 'number' },
                    errors: { type: 'array' },
                  },
                },
                teams: {
                  type: 'object',
                  properties: {
                    total: { type: 'number' },
                    synced: { type: 'number' },
                    errors: { type: 'array' },
                  },
                },
                duration: { type: 'number' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.id;
    const { orgLogin, syncMembers = true, syncTeams = true, memberBatchSize = 50 } = request.body;

    // Get GitHub access token
    const accessToken = await getGitHubAccessToken(userId);
    if (!accessToken) {
      return reply.code(401).send({
        error: 'GitHub account not linked',
        message: 'Please connect your GitHub account first',
      });
    }

    try {
      const result = await syncService.syncGitHubOrganization({
        githubOrgLogin: orgLogin,
        accessToken,
        userId,
        options: {
          syncMembers,
          syncTeams,
          memberBatchSize,
          ip: request.ip,
          userAgent: request.headers['user-agent'],
        },
      });

      return {
        success: true,
        result,
      };
    } catch (error) {
      logger.error('Failed to sync GitHub organization', {
        orgLogin,
        userId,
        error: error.message,
      });

      return reply.code(500).send({
        error: 'Sync failed',
        message: error.message,
      });
    }
  });

  /**
   * List user's GitHub organizations
   * GET /api/github/organizations
   */
  fastify.get('/', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'List GitHub organizations the user has access to',
      tags: ['GitHub Organizations'],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', default: 30, minimum: 1, maximum: 100 },
          page: { type: 'number', default: 1, minimum: 1 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            organizations: {
              type: 'array',
              items: { type: 'object' },
            },
            pagination: {
              type: 'object',
              properties: {
                total: { type: 'number' },
                limit: { type: 'number' },
                page: { type: 'number' },
                hasMore: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.id;
    const limit = parseInt(request.query.limit) || 30;
    const page = parseInt(request.query.page) || 1;

    // Get GitHub access token
    const accessToken = await getGitHubAccessToken(userId);
    if (!accessToken) {
      return reply.code(401).send({
        error: 'GitHub account not linked',
        message: 'Please connect your GitHub account first',
      });
    }

    try {
      const client = new GitHubClient({
        accessToken,
        options: { logger },
      });

      const organizations = await client.getOrganizations();

      // Paginate results
      const start = (page - 1) * limit;
      const end = start + limit;
      const paginatedOrgs = organizations.slice(start, end);

      return {
        success: true,
        organizations: paginatedOrgs,
        pagination: {
          total: organizations.length,
          limit,
          page,
          hasMore: end < organizations.length,
        },
      };
    } catch (error) {
      logger.error('Failed to list GitHub organizations', {
        userId,
        error: error.message,
      });

      return reply.code(500).send({
        error: 'Failed to fetch organizations',
        message: error.message,
      });
    }
  });

  /**
   * Get GitHub organization details
   * GET /api/github/organizations/:orgLogin
   */
  fastify.get('/:orgLogin', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'Get GitHub organization details',
      tags: ['GitHub Organizations'],
      params: {
        type: 'object',
        required: ['orgLogin'],
        properties: {
          orgLogin: {
            type: 'string',
            description: 'GitHub organization login',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            organization: { type: 'object' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.id;
    const { orgLogin } = request.params;

    // Get GitHub access token
    const accessToken = await getGitHubAccessToken(userId);
    if (!accessToken) {
      return reply.code(401).send({
        error: 'GitHub account not linked',
        message: 'Please connect your GitHub account first',
      });
    }

    try {
      const client = new GitHubClient({
        accessToken,
        options: { logger },
      });

      const organization = await client.getOrganization(orgLogin);

      // Also check if there's a Truxe organization linked
      const pool = getPool();
      const truxeOrg = await pool.query(
        `SELECT id, name, slug, settings
         FROM organizations
         WHERE slug = $1`,
        [orgLogin.toLowerCase()]
      );

      return {
        success: true,
        organization: {
          ...organization,
          truxe: truxeOrg.rows.length > 0 ? {
            id: truxeOrg.rows[0].id,
            name: truxeOrg.rows[0].name,
            slug: truxeOrg.rows[0].slug,
          } : null,
        },
      };
    } catch (error) {
      logger.error('Failed to get GitHub organization', {
        orgLogin,
        userId,
        error: error.message,
      });

      return reply.code(404).send({
        error: 'Organization not found',
        message: error.message,
      });
    }
  });

  /**
   * Get organization GitHub settings
   * GET /api/github/organizations/:orgLogin/settings
   */
  fastify.get('/:orgLogin/settings', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'Get GitHub settings for a Heimdall organization',
      tags: ['GitHub Organizations'],
      params: {
        type: 'object',
        required: ['orgLogin'],
        properties: {
          orgLogin: {
            type: 'string',
            description: 'GitHub organization login (or Heimdall org slug)',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            settings: { type: 'object' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.id;
    const { orgLogin } = request.params;

    try {
      // Find Heimdall organization
      const org = await organizationService.getOrganizationById({
        orgId: orgLogin, // Try as ID first
        userId,
      }) || await getPool().query(
        `SELECT id, name, slug, settings
         FROM organizations
         WHERE slug = $1`,
        [orgLogin.toLowerCase()]
      ).then(result => result.rows[0] ? {
        id: result.rows[0].id,
        name: result.rows[0].name,
        slug: result.rows[0].slug,
        settings: result.rows[0].settings,
      } : null);

      if (!org) {
        return reply.code(404).send({
          error: 'Organization not found',
        });
      }

      const githubSettings = settingsService.extractGitHubSettings(org.settings);

      return {
        success: true,
        settings: githubSettings,
      };
    } catch (error) {
      logger.error('Failed to get organization settings', {
        orgLogin,
        userId,
        error: error.message,
      });

      return reply.code(500).send({
        error: 'Failed to get settings',
        message: error.message,
      });
    }
  });

  /**
   * Update organization GitHub settings
   * PUT /api/github/organizations/:orgLogin/settings
   */
  fastify.put('/:orgLogin/settings', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'Update GitHub settings for a Heimdall organization',
      tags: ['GitHub Organizations'],
      params: {
        type: 'object',
        required: ['orgLogin'],
        properties: {
          orgLogin: {
            type: 'string',
            description: 'GitHub organization login (or Heimdall org slug)',
          },
        },
      },
      body: {
        type: 'object',
        properties: {
          auto_sync_enabled: { type: 'boolean' },
          sync_interval: { type: 'string', enum: ['1h', '6h', '12h', '24h'] },
          sync_members: { type: 'boolean' },
          sync_teams: { type: 'boolean' },
          sync_repositories: { type: 'boolean' },
          require_github_sso: { type: 'boolean' },
          allowed_organizations: {
            type: 'array',
            items: { type: 'string' },
          },
          require_2fa: { type: 'boolean' },
          allowed_ip_ranges: {
            type: 'array',
            items: { type: 'string' },
          },
          webhook_events: {
            type: 'array',
            items: { type: 'string' },
          },
          teamMappings: { type: 'object' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            settings: { type: 'object' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.id;
    const { orgLogin } = request.params;
    const settingsUpdates = request.body;

    try {
      // Find Heimdall organization
      let org = await organizationService.getOrganizationById({
        orgId: orgLogin,
        userId,
      });

      if (!org) {
        const result = await getPool().query(
          `SELECT id, name, slug, settings
           FROM organizations
           WHERE slug = $1`,
          [orgLogin.toLowerCase()]
        );
        org = result.rows[0] ? {
          id: result.rows[0].id,
          name: result.rows[0].name,
          slug: result.rows[0].slug,
          settings: result.rows[0].settings,
        } : null;
      }

      if (!org) {
        return reply.code(404).send({
          error: 'Organization not found',
        });
      }

      // Validate and update settings
      const updatedSettings = settingsService.updateGitHubSettings(
        org.settings,
        settingsUpdates
      );

      // Update organization
      const updated = await organizationService.updateOrganization({
        orgId: org.id,
        userId,
        updates: {
          settings: updatedSettings,
        },
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });

      const githubSettings = settingsService.extractGitHubSettings(updated.settings);

      return {
        success: true,
        settings: githubSettings,
      };
    } catch (error) {
      logger.error('Failed to update organization settings', {
        orgLogin,
        userId,
        error: error.message,
      });

      return reply.code(400).send({
        error: 'Failed to update settings',
        message: error.message,
      });
    }
  });

  /**
   * List organization teams
   * GET /api/github/organizations/:orgLogin/teams
   */
  fastify.get('/:orgLogin/teams', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'List teams in a GitHub organization',
      tags: ['GitHub Organizations'],
      params: {
        type: 'object',
        required: ['orgLogin'],
        properties: {
          orgLogin: {
            type: 'string',
            description: 'GitHub organization login',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            teams: {
              type: 'array',
              items: { type: 'object' },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.id;
    const { orgLogin } = request.params;

    // Get GitHub access token
    const accessToken = await getGitHubAccessToken(userId);
    if (!accessToken) {
      return reply.code(401).send({
        error: 'GitHub account not linked',
        message: 'Please connect your GitHub account first',
      });
    }

    try {
      const client = new GitHubClient({
        accessToken,
        options: { logger },
      });

      const teams = await client.getTeams(orgLogin);

      return {
        success: true,
        teams,
      };
    } catch (error) {
      logger.error('Failed to list organization teams', {
        orgLogin,
        userId,
        error: error.message,
      });

      return reply.code(500).send({
        error: 'Failed to fetch teams',
        message: error.message,
      });
    }
  });

  /**
   * List organization members
   * GET /api/github/organizations/:orgLogin/members
   */
  fastify.get('/:orgLogin/members', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'List members in a GitHub organization',
      tags: ['GitHub Organizations'],
      params: {
        type: 'object',
        required: ['orgLogin'],
        properties: {
          orgLogin: {
            type: 'string',
            description: 'GitHub organization login',
          },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', default: 30, minimum: 1, maximum: 100 },
          page: { type: 'number', default: 1, minimum: 1 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            members: {
              type: 'array',
              items: { type: 'object' },
            },
            pagination: {
              type: 'object',
              properties: {
                total: { type: 'number' },
                limit: { type: 'number' },
                page: { type: 'number' },
                hasMore: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.id;
    const { orgLogin } = request.params;
    const limit = parseInt(request.query.limit) || 30;
    const page = parseInt(request.query.page) || 1;

    // Get GitHub access token
    const accessToken = await getGitHubAccessToken(userId);
    if (!accessToken) {
      return reply.code(401).send({
        error: 'GitHub account not linked',
        message: 'Please connect your GitHub account first',
      });
    }

    try {
      const client = new GitHubClient({
        accessToken,
        options: { logger },
      });

      const members = await client.getOrganizationMembers(orgLogin);

      // Paginate results
      const start = (page - 1) * limit;
      const end = start + limit;
      const paginatedMembers = members.slice(start, end);

      return {
        success: true,
        members: paginatedMembers,
        pagination: {
          total: members.length,
          limit,
          page,
          hasMore: end < members.length,
        },
      };
    } catch (error) {
      logger.error('Failed to list organization members', {
        orgLogin,
        userId,
        error: error.message,
      });

      return reply.code(500).send({
        error: 'Failed to fetch members',
        message: error.message,
      });
    }
  });
}
