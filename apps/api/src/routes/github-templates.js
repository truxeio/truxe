/**
 * GitHub Repository Templates Routes
 *
 * RESTful API endpoints for repository templates:
 * - GET /api/github/templates - List available templates
 * - GET /api/github/templates/:owner/:repo - Get template details
 * - POST /api/github/templates/:owner/:repo/create - Create repository from template
 * - GET /api/github/templates/:owner/:repo/files - Get template files
 * - GET /api/github/templates/:owner/:repo/readme - Get template README
 */

import RepositoryTemplatesService from '../services/github/repository-templates.js';
import GitHubClient from '../services/github/github-client.js';
import oauthService from '../services/oauth/oauth-service.js';

/**
 * Helper to get GitHub access token for authenticated user
 */
async function getGitHubAccessToken(userId) {
  const accounts = await oauthService.listAccountsForUser(userId, {
    includeTokens: true
  });

  const githubAccount = accounts.find(
    account => account.provider === 'github'
  );

  if (!githubAccount || !githubAccount.tokens?.accessToken) {
    throw new Error('GitHub account not linked or token unavailable');
  }

  return githubAccount.tokens.accessToken;
}

/**
 * GitHub templates routes plugin
 */
export default async function githubTemplatesRoutes(fastify, options) {
  /**
   * List templates for owner
   * GET /api/github/templates
   */
  fastify.get('/', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'List available repository templates',
      tags: ['GitHub Templates'],
      querystring: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner (user or organization)'
          }
        },
        required: ['owner']
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              name: { type: 'string' },
              full_name: { type: 'string' },
              description: { type: 'string' },
              is_template: { type: 'boolean' }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userId = request.user.id;
      const accessToken = await getGitHubAccessToken(userId);

      const githubClient = new GitHubClient({
        accessToken,
        options: {
          logger: fastify.log
        }
      });

      const templatesService = new RepositoryTemplatesService({
        githubClient,
        logger: fastify.log
      });

      const templates = await templatesService.listTemplates(request.query.owner);

      return reply.send(templates);
    } catch (error) {
      fastify.log.error('Failed to list templates', { error: error.message });
      return reply.code(500).send({
        error: 'Failed to list templates',
        message: error.message
      });
    }
  });

  /**
   * Get template details
   * GET /api/github/templates/:owner/:repo
   */
  fastify.get('/:owner/:repo', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'Get template repository details',
      tags: ['GitHub Templates'],
      params: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' }
        },
        required: ['owner', 'repo']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            full_name: { type: 'string' },
            description: { type: 'string' },
            is_template: { type: 'boolean' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userId = request.user.id;
      const accessToken = await getGitHubAccessToken(userId);

      const githubClient = new GitHubClient({
        accessToken,
        options: {
          logger: fastify.log
        }
      });

      const templatesService = new RepositoryTemplatesService({
        githubClient,
        logger: fastify.log
      });

      const template = await templatesService.getTemplate(
        request.params.owner,
        request.params.repo
      );

      return reply.send(template);
    } catch (error) {
      fastify.log.error('Failed to get template', { error: error.message });
      return reply.code(500).send({
        error: 'Failed to get template',
        message: error.message
      });
    }
  });

  /**
   * Create repository from template
   * POST /api/github/templates/:owner/:repo/create
   */
  fastify.post('/:owner/:repo/create', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'Create repository from template',
      tags: ['GitHub Templates'],
      params: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' }
        },
        required: ['owner', 'repo']
      },
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: {
            type: 'string',
            description: 'Name for the new repository'
          },
          owner: {
            type: 'string',
            description: 'Owner of new repository (user or org)'
          },
          description: {
            type: 'string',
            description: 'Repository description'
          },
          private: {
            type: 'boolean',
            description: 'Make repository private',
            default: false
          },
          include_all_branches: {
            type: 'boolean',
            description: 'Include all branches from template',
            default: false
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            full_name: { type: 'string' },
            private: { type: 'boolean' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userId = request.user.id;
      const accessToken = await getGitHubAccessToken(userId);

      const githubClient = new GitHubClient({
        accessToken,
        options: {
          logger: fastify.log
        }
      });

      const templatesService = new RepositoryTemplatesService({
        githubClient,
        logger: fastify.log
      });

      const repository = await templatesService.createFromTemplate(
        request.params.owner,
        request.params.repo,
        request.body
      );

      return reply.send(repository);
    } catch (error) {
      fastify.log.error('Failed to create repository from template', {
        error: error.message
      });
      return reply.code(500).send({
        error: 'Failed to create repository',
        message: error.message
      });
    }
  });

  /**
   * Get template files
   * GET /api/github/templates/:owner/:repo/files
   */
  fastify.get('/:owner/:repo/files', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'Get template files',
      tags: ['GitHub Templates'],
      params: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' }
        },
        required: ['owner', 'repo']
      },
      querystring: {
        type: 'object',
        properties: {
          ref: {
            type: 'string',
            description: 'Git reference (branch/tag)'
          }
        }
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              name: { type: 'string' },
              size: { type: 'integer' }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userId = request.user.id;
      const accessToken = await getGitHubAccessToken(userId);

      const githubClient = new GitHubClient({
        accessToken,
        options: {
          logger: fastify.log
        }
      });

      const templatesService = new RepositoryTemplatesService({
        githubClient,
        logger: fastify.log
      });

      const files = await templatesService.getTemplateFiles(
        request.params.owner,
        request.params.repo,
        request.query.ref
      );

      return reply.send(files);
    } catch (error) {
      fastify.log.error('Failed to get template files', { error: error.message });
      return reply.code(500).send({
        error: 'Failed to get template files',
        message: error.message
      });
    }
  });

  /**
   * Get template README
   * GET /api/github/templates/:owner/:repo/readme
   */
  fastify.get('/:owner/:repo/readme', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'Get template README content',
      tags: ['GitHub Templates'],
      params: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' }
        },
        required: ['owner', 'repo']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            content: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userId = request.user.id;
      const accessToken = await getGitHubAccessToken(userId);

      const githubClient = new GitHubClient({
        accessToken,
        options: {
          logger: fastify.log
        }
      });

      const templatesService = new RepositoryTemplatesService({
        githubClient,
        logger: fastify.log
      });

      const readme = await templatesService.getTemplateReadme(
        request.params.owner,
        request.params.repo
      );

      return reply.send({ content: readme });
    } catch (error) {
      fastify.log.error('Failed to get template README', { error: error.message });
      return reply.code(500).send({
        error: 'Failed to get template README',
        message: error.message
      });
    }
  });
}

