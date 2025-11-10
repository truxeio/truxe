/**
 * GitHub Actions Routes
 *
 * RESTful API endpoints for GitHub Actions:
 * - GET /api/github/actions/:owner/:repo/workflows - List workflows
 * - GET /api/github/actions/:owner/:repo/workflows/:id - Get workflow
 * - POST /api/github/actions/:owner/:repo/workflows/:id/dispatch - Trigger workflow
 * - GET /api/github/actions/:owner/:repo/runs - List workflow runs
 * - GET /api/github/actions/:owner/:repo/runs/:id - Get workflow run
 * - POST /api/github/actions/:owner/:repo/runs/:id/cancel - Cancel workflow run
 * - GET /api/github/actions/:owner/:repo/runs/:id/logs - Get workflow logs
 * - GET /api/github/actions/:owner/:repo/secrets - List secrets
 */

import GitHubActionsService from '../services/github/github-actions.js';
import GitHubClient from '../services/github/github-client.js';
import oauthService from '../services/oauth/oauth-service.js';
import { getPool } from '../database/connection.js';

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
 * GitHub Actions routes plugin
 */
export default async function githubActionsRoutes(fastify, options) {
  const pool = getPool();

  /**
   * List workflows
   * GET /api/github/actions/:owner/:repo/workflows
   */
  fastify.get('/:owner/:repo/workflows', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'List workflows for a repository',
      tags: ['GitHub Actions'],
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
            total_count: { type: 'integer' },
            workflows: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  name: { type: 'string' },
                  path: { type: 'string' },
                  state: { type: 'string' }
                }
              }
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
        options: { logger: fastify.log }
      });

      const actionsService = new GitHubActionsService({
        githubClient,
        logger: fastify.log,
        pool
      });

      const workflows = await actionsService.listWorkflows(
        request.params.owner,
        request.params.repo
      );

      return reply.send(workflows);
    } catch (error) {
      fastify.log.error('Failed to list workflows', { error: error.message });
      return reply.code(500).send({
        error: 'Failed to list workflows',
        message: error.message
      });
    }
  });

  /**
   * Get workflow
   * GET /api/github/actions/:owner/:repo/workflows/:id
   */
  fastify.get('/:owner/:repo/workflows/:id', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'Get workflow details',
      tags: ['GitHub Actions'],
      params: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
          id: { type: 'string' }
        },
        required: ['owner', 'repo', 'id']
      }
    }
  }, async (request, reply) => {
    try {
      const userId = request.user.id;
      const accessToken = await getGitHubAccessToken(userId);

      const githubClient = new GitHubClient({
        accessToken,
        options: { logger: fastify.log }
      });

      const actionsService = new GitHubActionsService({
        githubClient,
        logger: fastify.log,
        pool
      });

      const workflow = await actionsService.getWorkflow(
        request.params.owner,
        request.params.repo,
        request.params.id
      );

      return reply.send(workflow);
    } catch (error) {
      fastify.log.error('Failed to get workflow', { error: error.message });
      return reply.code(500).send({
        error: 'Failed to get workflow',
        message: error.message
      });
    }
  });

  /**
   * Trigger workflow
   * POST /api/github/actions/:owner/:repo/workflows/:id/dispatch
   */
  fastify.post('/:owner/:repo/workflows/:id/dispatch', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'Trigger a workflow dispatch',
      tags: ['GitHub Actions'],
      params: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
          id: { type: 'string' }
        },
        required: ['owner', 'repo', 'id']
      },
      body: {
        type: 'object',
        required: ['ref'],
        properties: {
          ref: {
            type: 'string',
            description: 'Git reference (branch/tag)'
          },
          inputs: {
            type: 'object',
            description: 'Workflow inputs'
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
        options: { logger: fastify.log }
      });

      const actionsService = new GitHubActionsService({
        githubClient,
        logger: fastify.log,
        pool
      });

      await actionsService.triggerWorkflow(
        request.params.owner,
        request.params.repo,
        request.params.id,
        request.body
      );

      return reply.send({ success: true });
    } catch (error) {
      fastify.log.error('Failed to trigger workflow', { error: error.message });
      return reply.code(500).send({
        error: 'Failed to trigger workflow',
        message: error.message
      });
    }
  });

  /**
   * List workflow runs
   * GET /api/github/actions/:owner/:repo/runs
   */
  fastify.get('/:owner/:repo/runs', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'List workflow runs',
      tags: ['GitHub Actions'],
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
          workflow_id: { type: 'string' },
          actor: { type: 'string' },
          branch: { type: 'string' },
          event: { type: 'string' },
          status: { type: 'string' },
          per_page: { type: 'integer' },
          page: { type: 'integer' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userId = request.user.id;
      const accessToken = await getGitHubAccessToken(userId);

      const githubClient = new GitHubClient({
        accessToken,
        options: { logger: fastify.log }
      });

      const actionsService = new GitHubActionsService({
        githubClient,
        logger: fastify.log,
        pool
      });

      const runs = await actionsService.listWorkflowRuns(
        request.params.owner,
        request.params.repo,
        request.query
      );

      return reply.send(runs);
    } catch (error) {
      fastify.log.error('Failed to list workflow runs', { error: error.message });
      return reply.code(500).send({
        error: 'Failed to list workflow runs',
        message: error.message
      });
    }
  });

  /**
   * Get workflow run
   * GET /api/github/actions/:owner/:repo/runs/:id
   */
  fastify.get('/:owner/:repo/runs/:id', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'Get workflow run details',
      tags: ['GitHub Actions'],
      params: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
          id: { type: 'integer' }
        },
        required: ['owner', 'repo', 'id']
      }
    }
  }, async (request, reply) => {
    try {
      const userId = request.user.id;
      const accessToken = await getGitHubAccessToken(userId);

      const githubClient = new GitHubClient({
        accessToken,
        options: { logger: fastify.log }
      });

      const actionsService = new GitHubActionsService({
        githubClient,
        logger: fastify.log,
        pool
      });

      const run = await actionsService.getWorkflowRun(
        request.params.owner,
        request.params.repo,
        parseInt(request.params.id, 10)
      );

      // Store in database for tracking
      await actionsService.storeWorkflowRun(run).catch(err => {
        fastify.log.warn('Failed to store workflow run', { error: err.message });
      });

      return reply.send(run);
    } catch (error) {
      fastify.log.error('Failed to get workflow run', { error: error.message });
      return reply.code(500).send({
        error: 'Failed to get workflow run',
        message: error.message
      });
    }
  });

  /**
   * Cancel workflow run
   * POST /api/github/actions/:owner/:repo/runs/:id/cancel
   */
  fastify.post('/:owner/:repo/runs/:id/cancel', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'Cancel a workflow run',
      tags: ['GitHub Actions'],
      params: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
          id: { type: 'integer' }
        },
        required: ['owner', 'repo', 'id']
      }
    }
  }, async (request, reply) => {
    try {
      const userId = request.user.id;
      const accessToken = await getGitHubAccessToken(userId);

      const githubClient = new GitHubClient({
        accessToken,
        options: { logger: fastify.log }
      });

      const actionsService = new GitHubActionsService({
        githubClient,
        logger: fastify.log,
        pool
      });

      await actionsService.cancelWorkflowRun(
        request.params.owner,
        request.params.repo,
        parseInt(request.params.id, 10)
      );

      return reply.send({ success: true });
    } catch (error) {
      fastify.log.error('Failed to cancel workflow run', { error: error.message });
      return reply.code(500).send({
        error: 'Failed to cancel workflow run',
        message: error.message
      });
    }
  });

  /**
   * Get workflow run logs
   * GET /api/github/actions/:owner/:repo/runs/:id/logs
   */
  fastify.get('/:owner/:repo/runs/:id/logs', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'Get workflow run logs URL',
      tags: ['GitHub Actions'],
      params: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
          id: { type: 'integer' }
        },
        required: ['owner', 'repo', 'id']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            url: { type: 'string' }
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
        options: { logger: fastify.log }
      });

      const actionsService = new GitHubActionsService({
        githubClient,
        logger: fastify.log,
        pool
      });

      const logs = await actionsService.getWorkflowRunLogs(
        request.params.owner,
        request.params.repo,
        parseInt(request.params.id, 10)
      );

      return reply.send(logs);
    } catch (error) {
      fastify.log.error('Failed to get workflow logs', { error: error.message });
      return reply.code(500).send({
        error: 'Failed to get workflow logs',
        message: error.message
      });
    }
  });

  /**
   * List secrets
   * GET /api/github/actions/:owner/:repo/secrets
   */
  fastify.get('/:owner/:repo/secrets', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'List repository secrets',
      tags: ['GitHub Actions'],
      params: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' }
        },
        required: ['owner', 'repo']
      }
    }
  }, async (request, reply) => {
    try {
      const userId = request.user.id;
      const accessToken = await getGitHubAccessToken(userId);

      const githubClient = new GitHubClient({
        accessToken,
        options: { logger: fastify.log }
      });

      const actionsService = new GitHubActionsService({
        githubClient,
        logger: fastify.log,
        pool
      });

      const secrets = await actionsService.listSecrets(
        request.params.owner,
        request.params.repo
      );

      return reply.send(secrets);
    } catch (error) {
      fastify.log.error('Failed to list secrets', { error: error.message });
      return reply.code(500).send({
        error: 'Failed to list secrets',
        message: error.message
      });
    }
  });
}

