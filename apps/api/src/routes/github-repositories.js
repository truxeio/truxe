/**
 * GitHub Repository Access Routes
 *
 * RESTful API endpoints for GitHub repository access and management:
 * - GET /api/github/repositories - List user's repositories
 * - GET /api/github/repositories/:owner/:repo - Get repository details
 * - POST /api/github/repositories/sync - Trigger repository sync
 * - GET /api/github/repositories/:owner/:repo/commits - List commits
 * - GET /api/github/repositories/:owner/:repo/branches - List branches
 * - GET /api/github/repositories/:owner/:repo/pull-requests - List pull requests
 */

import GitHubClient from '../services/github/github-client.js';
import RepositorySyncService from '../services/github/repository-sync.js';
import { getGitHubMetrics } from '../services/github/github-metrics.js';
import oauthService from '../services/oauth/oauth-service.js';
import { getPool } from '../database/connection.js';
import config from '../config/index.js';

/**
 * GitHub repository routes plugin
 */
export default async function githubRepositoryRoutes(fastify, options) {
  const repositorySyncService = new RepositorySyncService({
    pool: getPool(),
    logger: fastify.log,
  });

  /**
   * Helper to get GitHub access token for authenticated user
   */
  async function getGitHubAccessToken(userId) {
    const accounts = await oauthService.listAccountsForUser(userId, {
      includeTokens: true,
    });

    const githubAccount = accounts.find(
      account => account.provider === 'github'
    );

    if (!githubAccount) {
      throw new Error('GitHub account not linked');
    }

    if (!githubAccount.tokens?.accessToken) {
      throw new Error('GitHub access token not available');
    }

    return {
      tokenData: {
        accessToken: githubAccount.tokens.accessToken,
      },
      oauthAccountId: githubAccount.id,
    };
  }

  /**
   * Format repository row from database
   */
  function formatRepository(row) {
    return {
      id: row.id,
      github_repo_id: row.github_repo_id,
      name: row.name,
      full_name: row.full_name,
      owner_login: row.owner_login,
      owner_type: row.owner_type,
      description: row.description,
      is_private: row.is_private,
      is_fork: row.is_fork,
      is_archived: row.is_archived,
      default_branch: row.default_branch,
      permissions: typeof row.permissions === 'string'
        ? JSON.parse(row.permissions)
        : row.permissions || {},
      language: row.language,
      topics: row.topics || [],
      stars_count: row.stars_count,
      forks_count: row.forks_count,
      watchers_count: row.watchers_count,
      github_created_at: row.github_created_at?.toISOString(),
      github_updated_at: row.github_updated_at?.toISOString(),
      github_pushed_at: row.github_pushed_at?.toISOString(),
      synced_at: row.synced_at?.toISOString(),
    };
  }

  /**
   * List user's repositories
   */
  fastify.get('/', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'List GitHub repositories for authenticated user',
      tags: ['GitHub Repositories'],
      querystring: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['all', 'owner', 'member'],
            default: 'all',
            description: 'Repository type filter',
          },
          sort: {
            type: 'string',
            enum: ['created', 'updated', 'pushed', 'full_name'],
            default: 'updated',
            description: 'Sort field',
          },
          direction: {
            type: 'string',
            enum: ['asc', 'desc'],
            default: 'desc',
            description: 'Sort direction',
          },
          is_private: {
            type: 'boolean',
            description: 'Filter by private/public',
          },
          is_archived: {
            type: 'boolean',
            description: 'Filter by archived status',
          },
          owner: {
            type: 'string',
            description: 'Filter by owner login',
          },
          language: {
            type: 'string',
            description: 'Filter by primary language',
          },
          search: {
            type: 'string',
            description: 'Search repositories by name/description',
          },
          per_page: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 30,
            description: 'Items per page',
          },
          page: {
            type: 'integer',
            minimum: 1,
            default: 1,
            description: 'Page number',
          },
          use_cache: {
            type: 'boolean',
            default: true,
            description: 'Use cached data from database',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            repositories: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  github_repo_id: { type: 'integer' },
                  name: { type: 'string' },
                  full_name: { type: 'string' },
                  owner_login: { type: 'string' },
                  owner_type: { type: 'string' },
                  description: { type: 'string' },
                  is_private: { type: 'boolean' },
                  is_fork: { type: 'boolean' },
                  is_archived: { type: 'boolean' },
                  default_branch: { type: 'string' },
                  permissions: { type: 'object' },
                  language: { type: 'string' },
                  topics: { type: 'array', items: { type: 'string' } },
                  stars_count: { type: 'integer' },
                  forks_count: { type: 'integer' },
                  watchers_count: { type: 'integer' },
                  github_created_at: { type: 'string' },
                  github_updated_at: { type: 'string' },
                  github_pushed_at: { type: 'string' },
                  synced_at: { type: 'string' },
                },
              },
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                per_page: { type: 'integer' },
                total: { type: 'integer' },
                total_pages: { type: 'integer' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { tokenData, oauthAccountId } = await getGitHubAccessToken(
        request.user.id
      );

      const {
        use_cache = true,
        type = 'all',
        sort = 'updated',
        direction = 'desc',
        is_private,
        is_archived,
        owner,
        language,
        search,
        per_page = 30,
        page = 1,
      } = request.query;

      let repositories = [];
      let total = 0;

      const metrics = getGitHubMetrics();

      if (use_cache) {
        // Query from database cache
        const pool = getPool();
        const conditions = [`oauth_account_id = $1`];
        const params = [oauthAccountId];
        let paramIndex = 2;

        // Apply filters
        if (is_private !== undefined) {
          conditions.push(`is_private = $${paramIndex}`);
          params.push(is_private);
          paramIndex++;
        }

        if (is_archived !== undefined) {
          conditions.push(`is_archived = $${paramIndex}`);
          params.push(is_archived);
          paramIndex++;
        }

        if (owner) {
          conditions.push(`owner_login = $${paramIndex}`);
          params.push(owner);
          paramIndex++;
        }

        if (language) {
          conditions.push(`language = $${paramIndex}`);
          params.push(language);
          paramIndex++;
        }

        if (search) {
          conditions.push(`(
            to_tsvector('english', COALESCE(name, '') || ' ' || 
              COALESCE(description, '') || ' ' || 
              COALESCE(full_name, '')) @@ plainto_tsquery('english', $${paramIndex})
          )`);
          params.push(search);
          paramIndex++;
        }

        const whereClause = conditions.join(' AND ');

        // Get total count
        const countResult = await pool.query(
          `SELECT COUNT(*) FROM github_repositories WHERE ${whereClause}`,
          params
        );
        total = parseInt(countResult.rows[0].count, 10);

        // Build main query with sorting and pagination
        const sortMap = {
          created: 'github_created_at',
          updated: 'github_updated_at',
          pushed: 'github_pushed_at',
          full_name: 'full_name',
        };
        const sortField = sortMap[sort] || 'github_updated_at';

        const query = `
          SELECT * FROM github_repositories
          WHERE ${whereClause}
          ORDER BY ${sortField} ${direction.toUpperCase()}
          LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;
        params.push(per_page, (page - 1) * per_page);

        const result = await pool.query(query, params);
        repositories = result.rows.map(row => formatRepository(row));

        // Record cache hit
        if (metrics) {
          metrics.recordCacheMetrics({
            type: 'hit',
            cacheSize: total,
          });
        }
      } else {
        // Fetch directly from GitHub API
        const client = new GitHubClient({
          accessToken: tokenData.accessToken,
          options: { logger: fastify.log },
        });

        const githubRepos = await client.getRepositories({
          type,
          sort,
          direction,
          per_page,
          page,
        });

        // Transform to match our format
        repositories = githubRepos.map(repo => ({
          github_repo_id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
          owner_login: repo.owner?.login || '',
          owner_type: repo.owner?.type || 'User',
          description: repo.description,
          is_private: repo.private || false,
          is_fork: repo.fork || false,
          is_archived: repo.archived || false,
          default_branch: repo.default_branch || 'main',
          permissions: repo.permissions || {},
          language: repo.language,
          topics: repo.topics || [],
          stars_count: repo.stargazers_count || 0,
          forks_count: repo.forks_count || 0,
          watchers_count: repo.watchers_count || 0,
          github_created_at: repo.created_at,
          github_updated_at: repo.updated_at,
          github_pushed_at: repo.pushed_at,
        }));

        total = repositories.length; // GitHub doesn't return total in list endpoint

        // Record cache miss
        if (metrics) {
          metrics.recordCacheMetrics({
            type: 'miss',
          });
        }
      }

      return reply.send({
        repositories,
        pagination: {
          page,
          per_page,
          total,
          total_pages: Math.ceil(total / per_page),
        },
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Failed to list repositories');
      return reply.code(500).send({
        error: 'Failed to list repositories',
        message: error.message,
      });
    }
  });

  /**
   * Get repository details
   */
  fastify.get('/:owner/:repo', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'Get GitHub repository details',
      tags: ['GitHub Repositories'],
      params: {
        type: 'object',
        required: ['owner', 'repo'],
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { tokenData } = await getGitHubAccessToken(request.user.id);
      const { owner, repo } = request.params;

      const client = new GitHubClient({
        accessToken: tokenData.accessToken,
        options: { logger: fastify.log },
      });

      const repository = await client.getRepository(owner, repo);

      return reply.send({
        github_repo_id: repository.id,
        name: repository.name,
        full_name: repository.full_name,
        owner_login: repository.owner?.login || '',
        owner_type: repository.owner?.type || 'User',
        description: repository.description,
        is_private: repository.private || false,
        is_fork: repository.fork || false,
        is_archived: repository.archived || false,
        default_branch: repository.default_branch || 'main',
        permissions: repository.permissions || {},
        language: repository.language,
        topics: repository.topics || [],
        stars_count: repository.stargazers_count || 0,
        forks_count: repository.forks_count || 0,
        watchers_count: repository.watchers_count || 0,
        github_created_at: repository.created_at,
        github_updated_at: repository.updated_at,
        github_pushed_at: repository.pushed_at,
        // Additional fields
        html_url: repository.html_url,
        clone_url: repository.clone_url,
        ssh_url: repository.ssh_url,
        homepage: repository.homepage,
        size: repository.size,
        open_issues_count: repository.open_issues_count,
        license: repository.license,
      });
    } catch (error) {
      if (error.statusCode === 404) {
        return reply.code(404).send({
          error: 'Repository not found',
          message: `Repository ${request.params.owner}/${request.params.repo} not found`,
        });
      }

      fastify.log.error({ err: error }, 'Failed to get repository');
      return reply.code(500).send({
        error: 'Failed to get repository',
        message: error.message,
      });
    }
  });

  /**
   * Trigger repository sync
   */
  fastify.post('/sync', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'Trigger sync of repositories from GitHub',
      tags: ['GitHub Repositories'],
      body: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['all', 'owner', 'member'],
            default: 'all',
          },
          full_sync: {
            type: 'boolean',
            default: false,
            description: 'Force full sync (ignore cache)',
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
                total: { type: 'integer' },
                created: { type: 'integer' },
                updated: { type: 'integer' },
                errors: { type: 'array' },
                duration: { type: 'integer' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { tokenData, oauthAccountId } = await getGitHubAccessToken(
        request.user.id
      );

      const { type = 'all', full_sync = false } = request.body || {};

      const result = await repositorySyncService.syncRepositories({
        oauthAccountId,
        accessToken: tokenData.accessToken,
        options: {
          type,
          full_sync,
        },
      });

      return reply.send({
        success: true,
        result,
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Failed to sync repositories');
      return reply.code(500).send({
        error: 'Failed to sync repositories',
        message: error.message,
      });
    }
  });

  /**
   * List repository commits
   */
  fastify.get('/:owner/:repo/commits', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'List repository commits',
      tags: ['GitHub Repositories'],
      params: {
        type: 'object',
        required: ['owner', 'repo'],
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          sha: { type: 'string' },
          path: { type: 'string' },
          author: { type: 'string' },
          since: { type: 'string' },
          until: { type: 'string' },
          per_page: { type: 'integer', default: 30 },
          page: { type: 'integer', default: 1 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { tokenData } = await getGitHubAccessToken(request.user.id);
      const { owner, repo } = request.params;

      const client = new GitHubClient({
        accessToken: tokenData.accessToken,
        options: { logger: fastify.log },
      });

      const commits = await client.getRepositoryCommits(owner, repo, {
        sha: request.query.sha,
        path: request.query.path,
        author: request.query.author,
        since: request.query.since,
        until: request.query.until,
        per_page: request.query.per_page,
        page: request.query.page,
      });

      return reply.send({ commits });
    } catch (error) {
      fastify.log.error({ err: error }, 'Failed to list commits');
      return reply.code(500).send({
        error: 'Failed to list commits',
        message: error.message,
      });
    }
  });

  /**
   * List repository branches
   */
  fastify.get('/:owner/:repo/branches', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'List repository branches',
      tags: ['GitHub Repositories'],
      params: {
        type: 'object',
        required: ['owner', 'repo'],
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { tokenData } = await getGitHubAccessToken(request.user.id);
      const { owner, repo } = request.params;

      const client = new GitHubClient({
        accessToken: tokenData.accessToken,
        options: { logger: fastify.log },
      });

      const branches = await client.getRepositoryBranches(owner, repo);

      return reply.send({ branches });
    } catch (error) {
      fastify.log.error({ err: error }, 'Failed to list branches');
      return reply.code(500).send({
        error: 'Failed to list branches',
        message: error.message,
      });
    }
  });

  /**
   * List repository pull requests
   */
  fastify.get('/:owner/:repo/pull-requests', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'List repository pull requests',
      tags: ['GitHub Repositories'],
      params: {
        type: 'object',
        required: ['owner', 'repo'],
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          state: {
            type: 'string',
            enum: ['open', 'closed', 'all'],
            default: 'open',
          },
          sort: {
            type: 'string',
            enum: ['created', 'updated', 'popularity'],
            default: 'created',
          },
          direction: {
            type: 'string',
            enum: ['asc', 'desc'],
            default: 'desc',
          },
          per_page: { type: 'integer', default: 30 },
          page: { type: 'integer', default: 1 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { tokenData } = await getGitHubAccessToken(request.user.id);
      const { owner, repo } = request.params;

      const client = new GitHubClient({
        accessToken: tokenData.accessToken,
        options: { logger: fastify.log },
      });

      const pullRequests = await client.getRepositoryPullRequests(owner, repo, {
        state: request.query.state,
        sort: request.query.sort,
        direction: request.query.direction,
        per_page: request.query.per_page,
        page: request.query.page,
      });

      return reply.send({ pullRequests });
    } catch (error) {
      fastify.log.error({ err: error }, 'Failed to list pull requests');
      return reply.code(500).send({
        error: 'Failed to list pull requests',
        message: error.message,
      });
    }
  });

  /**
   * Format repository row from database
   */
  function formatRepository(row) {
    return {
      id: row.id,
      github_repo_id: row.github_repo_id,
      name: row.name,
      full_name: row.full_name,
      owner_login: row.owner_login,
      owner_type: row.owner_type,
      description: row.description,
      is_private: row.is_private,
      is_fork: row.is_fork,
      is_archived: row.is_archived,
      default_branch: row.default_branch,
      permissions: typeof row.permissions === 'string'
        ? JSON.parse(row.permissions)
        : row.permissions || {},
      language: row.language,
      topics: row.topics || [],
      stars_count: row.stars_count,
      forks_count: row.forks_count,
      watchers_count: row.watchers_count,
      github_created_at: row.github_created_at?.toISOString(),
      github_updated_at: row.github_updated_at?.toISOString(),
      github_pushed_at: row.github_pushed_at?.toISOString(),
      synced_at: row.synced_at?.toISOString(),
    };
  }
}

