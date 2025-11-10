/**
 * GitHub Search Routes
 *
 * RESTful API endpoints for advanced GitHub search:
 * - GET /api/github/search/repositories - Search repositories
 * - GET /api/github/search/code - Search code
 * - GET /api/github/search/issues - Search issues
 * - GET /api/github/search/users - Search users
 * - GET /api/github/search/saved - List saved searches
 * - POST /api/github/search/saved - Save search query
 * - DELETE /api/github/search/saved/:id - Delete saved search
 */

import GitHubSearchService from '../services/github/github-search.js';
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
 * GitHub search routes plugin
 */
export default async function githubSearchRoutes(fastify, options) {
  const pool = getPool();

  /**
   * Search repositories
   * GET /api/github/search/repositories
   */
  fastify.get('/repositories', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'Search GitHub repositories',
      tags: ['GitHub Search'],
      querystring: {
        type: 'object',
        required: ['q'],
        properties: {
          q: {
            type: 'string',
            description: 'Search query (GitHub search syntax)'
          },
          language: {
            type: 'string',
            description: 'Filter by programming language'
          },
          topic: {
            type: 'string',
            description: 'Filter by topic'
          },
          min_stars: {
            type: 'integer',
            description: 'Minimum stars'
          },
          max_stars: {
            type: 'integer',
            description: 'Maximum stars'
          },
          license: {
            type: 'string',
            description: 'Filter by license'
          },
          archived: {
            type: 'boolean',
            description: 'Include archived repositories'
          },
          user: {
            type: 'string',
            description: 'Filter by user/organization'
          },
          sort: {
            type: 'string',
            enum: ['stars', 'forks', 'help-wanted-issues', 'updated'],
            default: 'stars'
          },
          order: {
            type: 'string',
            enum: ['asc', 'desc'],
            default: 'desc'
          },
          per_page: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 30
          },
          page: {
            type: 'integer',
            minimum: 1,
            default: 1
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

      const searchService = new GitHubSearchService({
        githubClient,
        logger: fastify.log,
        pool
      });

      // Build query with filters
      const filters = {
        query: request.query.q,
        language: request.query.language,
        topic: request.query.topic,
        minStars: request.query.min_stars,
        maxStars: request.query.max_stars,
        license: request.query.license,
        archived: request.query.archived,
        user: request.query.user
      };

      const searchQuery = searchService.buildRepositoryQuery(filters);

      const results = await searchService.searchRepositories({
        q: searchQuery,
        sort: request.query.sort,
        order: request.query.order,
        perPage: request.query.per_page,
        page: request.query.page
      });

      return reply.send(results);
    } catch (error) {
      fastify.log.error('Failed to search repositories', { error: error.message });
      return reply.code(500).send({
        error: 'Failed to search repositories',
        message: error.message
      });
    }
  });

  /**
   * Search code
   * GET /api/github/search/code
   */
  fastify.get('/code', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'Search GitHub code',
      tags: ['GitHub Search'],
      querystring: {
        type: 'object',
        required: ['q'],
        properties: {
          q: { type: 'string' },
          sort: { type: 'string', enum: ['indexed', 'score'] },
          order: { type: 'string', enum: ['asc', 'desc'] },
          per_page: { type: 'integer', minimum: 1, maximum: 100 },
          page: { type: 'integer', minimum: 1 }
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

      const searchService = new GitHubSearchService({
        githubClient,
        logger: fastify.log,
        pool
      });

      const results = await searchService.searchCode({
        q: request.query.q,
        sort: request.query.sort,
        order: request.query.order,
        perPage: request.query.per_page,
        page: request.query.page
      });

      return reply.send(results);
    } catch (error) {
      fastify.log.error('Failed to search code', { error: error.message });
      return reply.code(500).send({
        error: 'Failed to search code',
        message: error.message
      });
    }
  });

  /**
   * Search issues
   * GET /api/github/search/issues
   */
  fastify.get('/issues', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'Search GitHub issues',
      tags: ['GitHub Search'],
      querystring: {
        type: 'object',
        required: ['q'],
        properties: {
          q: { type: 'string' },
          sort: {
            type: 'string',
            enum: ['comments', 'reactions', 'interactions', 'created', 'updated']
          },
          order: { type: 'string', enum: ['asc', 'desc'] },
          per_page: { type: 'integer', minimum: 1, maximum: 100 },
          page: { type: 'integer', minimum: 1 }
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

      const searchService = new GitHubSearchService({
        githubClient,
        logger: fastify.log,
        pool
      });

      const results = await searchService.searchIssues({
        q: request.query.q,
        sort: request.query.sort,
        order: request.query.order,
        perPage: request.query.per_page,
        page: request.query.page
      });

      return reply.send(results);
    } catch (error) {
      fastify.log.error('Failed to search issues', { error: error.message });
      return reply.code(500).send({
        error: 'Failed to search issues',
        message: error.message
      });
    }
  });

  /**
   * Search users
   * GET /api/github/search/users
   */
  fastify.get('/users', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'Search GitHub users',
      tags: ['GitHub Search'],
      querystring: {
        type: 'object',
        required: ['q'],
        properties: {
          q: { type: 'string' },
          sort: {
            type: 'string',
            enum: ['followers', 'repositories', 'joined']
          },
          order: { type: 'string', enum: ['asc', 'desc'] },
          per_page: { type: 'integer', minimum: 1, maximum: 100 },
          page: { type: 'integer', minimum: 1 }
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

      const searchService = new GitHubSearchService({
        githubClient,
        logger: fastify.log,
        pool
      });

      const results = await searchService.searchUsers({
        q: request.query.q,
        sort: request.query.sort,
        order: request.query.order,
        perPage: request.query.per_page,
        page: request.query.page
      });

      return reply.send(results);
    } catch (error) {
      fastify.log.error('Failed to search users', { error: error.message });
      return reply.code(500).send({
        error: 'Failed to search users',
        message: error.message
      });
    }
  });

  /**
   * List saved searches
   * GET /api/github/search/saved
   */
  fastify.get('/saved', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'List saved searches',
      tags: ['GitHub Search'],
      querystring: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['repository', 'code', 'issues', 'users']
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userId = request.user.id;

      // Create a minimal client just for the service (pool is the important part)
      const searchService = new GitHubSearchService({
        githubClient: { baseUrl: 'https://api.github.com' }, // Dummy client
        logger: fastify.log,
        pool
      });

      const searches = await searchService.listSavedSearches(userId, request.query.type);

      return reply.send(searches);
    } catch (error) {
      fastify.log.error('Failed to list saved searches', { error: error.message });
      return reply.code(500).send({
        error: 'Failed to list saved searches',
        message: error.message
      });
    }
  });

  /**
   * Save search query
   * POST /api/github/search/saved
   */
  fastify.post('/saved', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'Save search query',
      tags: ['GitHub Search'],
      body: {
        type: 'object',
        required: ['name', 'type', 'query'],
        properties: {
          name: { type: 'string' },
          type: {
            type: 'string',
            enum: ['repository', 'code', 'issues', 'users']
          },
          query: { type: 'string' },
          filters: { type: 'object' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userId = request.user.id;

      const searchService = new GitHubSearchService({
        githubClient: { baseUrl: 'https://api.github.com' },
        logger: fastify.log,
        pool
      });

      const saved = await searchService.saveSearch(userId, request.body);

      return reply.code(201).send(saved);
    } catch (error) {
      fastify.log.error('Failed to save search', { error: error.message });
      return reply.code(500).send({
        error: 'Failed to save search',
        message: error.message
      });
    }
  });

  /**
   * Delete saved search
   * DELETE /api/github/search/saved/:id
   */
  fastify.delete('/saved/:id', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'Delete saved search',
      tags: ['GitHub Search'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        },
        required: ['id']
      }
    }
  }, async (request, reply) => {
    try {
      const userId = request.user.id;

      const searchService = new GitHubSearchService({
        githubClient: { baseUrl: 'https://api.github.com' },
        logger: fastify.log,
        pool
      });

      await searchService.deleteSavedSearch(userId, request.params.id);

      return reply.send({ success: true });
    } catch (error) {
      fastify.log.error('Failed to delete saved search', { error: error.message });
      return reply.code(500).send({
        error: 'Failed to delete saved search',
        message: error.message
      });
    }
  });
}

