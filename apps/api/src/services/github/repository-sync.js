/**
 * GitHub Repository Sync Service
 *
 * Synchronizes GitHub repositories to the database cache.
 * Supports incremental sync, batch operations, and conflict resolution.
 *
 * Features:
 * - Incremental repository sync
 * - Batch operations for efficiency
 * - Automatic conflict resolution
 * - Progress tracking
 * - Error recovery
 */

import GitHubClient from './github-client.js';
import { getPool } from '../../database/connection.js';
import { getGitHubMetrics } from './github-metrics.js';

export class RepositorySyncError extends Error {
  constructor(message, { cause, details = {} } = {}) {
    super(message);
    this.name = 'RepositorySyncError';
    this.cause = cause;
    this.details = details;
  }
}

export class RepositorySyncService {
  constructor({ pool = null, logger = console, metrics = null } = {}) {
    this.pool = pool || getPool();
    this.logger = logger;
    this.metrics = metrics || getGitHubMetrics();
  }

  /**
   * Sync repositories for a user's OAuth account
   *
   * @param {Object} params
   * @param {string} params.oauthAccountId - OAuth account ID
   * @param {string} params.accessToken - GitHub access token
   * @param {Object} params.options - Sync options
   * @returns {Promise<Object>} Sync result
   */
  async syncRepositories({ oauthAccountId, accessToken, options = {} }) {
    if (!oauthAccountId) {
      throw new RepositorySyncError('OAuth account ID is required');
    }

    if (!accessToken) {
      throw new RepositorySyncError('GitHub access token is required');
    }

    const client = new GitHubClient({
      accessToken,
      options: {
        logger: this.logger,
      },
    });

    const result = {
      total: 0,
      created: 0,
      updated: 0,
      errors: [],
      startTime: new Date(),
    };

    try {
      // Fetch all repositories from GitHub
      this.logger.info('Starting repository sync', { oauthAccountId });

      const repositories = await client.getAllRepositories(
        {
          type: options.type || 'all',
          sort: options.sort || 'updated',
          direction: options.direction || 'desc',
          per_page: options.per_page || 100,
        },
        async (page, pageNum) => {
          this.logger.debug('Syncing repository page', {
            page: pageNum,
            count: page.length,
          });
        }
      );

      result.total = repositories.length;
      this.logger.info('Fetched repositories from GitHub', {
        count: result.total,
      });

      // Sync repositories in batches
      const batchSize = options.batchSize || 50;
      for (let i = 0; i < repositories.length; i += batchSize) {
        const batch = repositories.slice(i, i + batchSize);
        await this.syncBatch({
          oauthAccountId,
          repositories: batch,
          result,
        });
      }

      result.endTime = new Date();
      result.duration = result.endTime - result.startTime;

      // Record metrics
      if (this.metrics) {
        this.metrics.recordRepositorySync({
          status: result.errors.length > 0 ? 'partial' : 'success',
          type: options.type || 'full',
          duration: result.duration,
          repositoriesTotal: result.total,
          repositoriesCreated: result.created,
          repositoriesUpdated: result.updated,
          errors: result.errors.length,
        });
      }

      this.logger.info('Repository sync completed', {
        oauthAccountId,
        ...result,
        duration: `${result.duration}ms`,
      });

      return result;
    } catch (error) {
      // Record error metrics
      if (this.metrics) {
        this.metrics.recordRepositorySync({
          status: 'error',
          type: options.type || 'full',
        });
        this.metrics.recordError({
          type: 'sync_error',
          endpoint: 'syncRepositories',
        });
      }

      this.logger.error('Repository sync failed', {
        oauthAccountId,
        error: error.message,
      });

      if (error instanceof RepositorySyncError) {
        throw error;
      }

      throw new RepositorySyncError('Repository sync failed', {
        cause: error,
        details: { oauthAccountId },
      });
    }
  }

  /**
   * Sync a batch of repositories
   *
   * @param {Object} params
   * @param {string} params.oauthAccountId - OAuth account ID
   * @param {Array} params.repositories - Repository data from GitHub
   * @param {Object} params.result - Result accumulator
   * @private
   */
  async syncBatch({ oauthAccountId, repositories, result }) {
    const dbClient = await this.pool.connect();

    try {
      await dbClient.query('BEGIN');

      for (const repo of repositories) {
        try {
          const existing = await dbClient.query(
            `SELECT id FROM github_repositories 
             WHERE oauth_account_id = $1 AND github_repo_id = $2`,
            [oauthAccountId, repo.id]
          );

          const repoData = this.normalizeRepository(repo);

          if (existing.rows.length > 0) {
            // Update existing repository
            await dbClient.query(
              `UPDATE github_repositories SET
                name = $3,
                full_name = $4,
                owner_login = $5,
                owner_type = $6,
                description = $7,
                is_private = $8,
                is_fork = $9,
                is_archived = $10,
                default_branch = $11,
                permissions = $12,
                language = $13,
                topics = $14,
                stars_count = $15,
                forks_count = $16,
                watchers_count = $17,
                github_created_at = $18,
                github_updated_at = $19,
                github_pushed_at = $20,
                synced_at = NOW()
              WHERE oauth_account_id = $1 AND github_repo_id = $2`,
              [
                oauthAccountId,
                repo.id,
                repoData.name,
                repoData.full_name,
                repoData.owner_login,
                repoData.owner_type,
                repoData.description,
                repoData.is_private,
                repoData.is_fork,
                repoData.is_archived,
                repoData.default_branch,
                JSON.stringify(repoData.permissions),
                repoData.language,
                repoData.topics,
                repoData.stars_count,
                repoData.forks_count,
                repoData.watchers_count,
                repoData.github_created_at,
                repoData.github_updated_at,
                repoData.github_pushed_at,
              ]
            );
            result.updated++;
          } else {
            // Insert new repository
            await dbClient.query(
              `INSERT INTO github_repositories (
                oauth_account_id,
                github_repo_id,
                name,
                full_name,
                owner_login,
                owner_type,
                description,
                is_private,
                is_fork,
                is_archived,
                default_branch,
                permissions,
                language,
                topics,
                stars_count,
                forks_count,
                watchers_count,
                github_created_at,
                github_updated_at,
                github_pushed_at,
                synced_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW())`,
              [
                oauthAccountId,
                repo.id,
                repoData.name,
                repoData.full_name,
                repoData.owner_login,
                repoData.owner_type,
                repoData.description,
                repoData.is_private,
                repoData.is_fork,
                repoData.is_archived,
                repoData.default_branch,
                JSON.stringify(repoData.permissions),
                repoData.language,
                repoData.topics,
                repoData.stars_count,
                repoData.forks_count,
                repoData.watchers_count,
                repoData.github_created_at,
                repoData.github_updated_at,
                repoData.github_pushed_at,
              ]
            );
            result.created++;
          }
        } catch (error) {
          this.logger.warn('Failed to sync repository', {
            repo: repo.full_name || repo.name,
            error: error.message,
          });
          result.errors.push({
            repository: repo.full_name || repo.name,
            error: error.message,
          });
        }
      }

      await dbClient.query('COMMIT');
    } catch (error) {
      await dbClient.query('ROLLBACK');
      throw error;
    } finally {
      dbClient.release();
    }
  }

  /**
   * Normalize GitHub repository data for database storage
   *
   * @param {Object} repo - Raw repository data from GitHub API
   * @returns {Object} Normalized repository data
   * @private
   */
  normalizeRepository(repo) {
    // Parse owner type
    const ownerType = repo.owner?.type || 'User';
    const ownerLogin = repo.owner?.login || repo.full_name?.split('/')[0] || '';

    // Extract permissions (if available)
    const permissions = {};
    if (repo.permissions) {
      permissions.admin = repo.permissions.admin || false;
      permissions.push = repo.permissions.push || false;
      permissions.pull = repo.permissions.pull || false;
    }

    // Parse topics (can be array or comma-separated string)
    let topics = [];
    if (repo.topics && Array.isArray(repo.topics)) {
      topics = repo.topics;
    } else if (repo.topics && typeof repo.topics === 'string') {
      topics = repo.topics.split(',').map(t => t.trim()).filter(Boolean);
    }

    // Parse timestamps
    const parseDate = (dateString) => {
      if (!dateString) return null;
      try {
        return new Date(dateString);
      } catch {
        return null;
      }
    };

    return {
      name: repo.name || '',
      full_name: repo.full_name || `${ownerLogin}/${repo.name}`,
      owner_login: ownerLogin,
      owner_type: ownerType,
      description: repo.description || null,
      is_private: repo.private || false,
      is_fork: repo.fork || false,
      is_archived: repo.archived || false,
      default_branch: repo.default_branch || 'main',
      permissions,
      language: repo.language || null,
      topics,
      stars_count: repo.stargazers_count || 0,
      forks_count: repo.forks_count || 0,
      watchers_count: repo.watchers_count || 0,
      github_created_at: parseDate(repo.created_at),
      github_updated_at: parseDate(repo.updated_at),
      github_pushed_at: parseDate(repo.pushed_at),
    };
  }

  /**
   * Get sync status for an OAuth account
   *
   * @param {string} oauthAccountId - OAuth account ID
   * @returns {Promise<Object>} Sync status
   */
  async getSyncStatus(oauthAccountId) {
    const result = await this.pool.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN synced_at > NOW() - INTERVAL '24 hours' THEN 1 END) as synced_24h,
        COUNT(CASE WHEN synced_at > NOW() - INTERVAL '7 days' THEN 1 END) as synced_7d,
        MAX(synced_at) as last_sync
      FROM github_repositories
      WHERE oauth_account_id = $1`,
      [oauthAccountId]
    );

    return {
      total: parseInt(result.rows[0].total, 10),
      synced24h: parseInt(result.rows[0].synced_24h, 10),
      synced7d: parseInt(result.rows[0].synced_7d, 10),
      lastSync: result.rows[0].last_sync,
    };
  }

  /**
   * Delete repositories that are no longer accessible
   *
   * @param {string} oauthAccountId - OAuth account ID
   * @param {Array<string>} accessibleRepoIds - GitHub repo IDs that are still accessible
   * @returns {Promise<number>} Number of deleted repositories
   */
  async cleanupDeletedRepositories(oauthAccountId, accessibleRepoIds) {
    const result = await this.pool.query(
      `DELETE FROM github_repositories
       WHERE oauth_account_id = $1
         AND github_repo_id != ALL($2::bigint[])
       RETURNING github_repo_id`,
      [oauthAccountId, accessibleRepoIds]
    );

    return result.rows.length;
  }
}

export default RepositorySyncService;

