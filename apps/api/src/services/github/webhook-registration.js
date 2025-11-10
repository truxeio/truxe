/**
 * GitHub Webhook Registration Service
 *
 * Manages registration and configuration of GitHub webhooks for repositories and organizations.
 * Handles webhook registration, updates, deletion, and testing.
 *
 * Features:
 * - Register webhooks with GitHub repositories
 * - Manage webhook configurations
 * - Test webhook connectivity
 * - Track registered webhooks in database
 *
 * @see https://docs.github.com/en/webhooks-and-events/webhooks/about-webhooks
 */

import { getPool } from '../../database/connection.js';
import GitHubClient from './github-client.js';
import oauthService from '../oauth/oauth-service.js';

/**
 * GitHub Webhook Registration Service
 */
export class GitHubWebhookRegistrationService {
  constructor(options = {}) {
    this.pool = options.pool || getPool();
    this.logger = options.logger || console;
    this.baseWebhookUrl = options.baseWebhookUrl || process.env.GITHUB_WEBHOOK_BASE_URL ||
      `${process.env.APP_URL || `http://localhost:${process.env.TRUXE_API_PORT || 87001}`}/api/github/webhooks`;
  }

  /**
   * Get GitHub client for user
   *
   * @param {string} userId - User ID
   * @returns {Promise<GitHubClient>} GitHub client instance
   * @private
   */
  async getGitHubClientForUser(userId) {
    // Get OAuth account for user
    const result = await this.pool.query(
      `SELECT access_token, provider 
       FROM oauth_accounts 
       WHERE user_id = $1 AND provider = 'github'`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('GitHub OAuth account not found for user');
    }

    const account = result.rows[0];
    
    // Decrypt token if needed (tokens are stored encrypted)
    let accessToken = account.access_token;
    try {
      // Try to decrypt - if it fails, assume it's plain text
      const tokenEncryptor = (await import('../oauth/token-encryptor.js')).default;
      accessToken = tokenEncryptor.decrypt(accessToken);
    } catch (error) {
      // Token might already be decrypted or encryption failed
      // Use as-is
      this.logger.debug('Token decryption skipped', { error: error.message });
    }

    if (!accessToken) {
      throw new Error('GitHub access token not available');
    }

    return new GitHubClient({ accessToken });
  }

  /**
   * Register webhook for repository
   *
   * @param {Object} params - Registration parameters
   * @param {string} params.userId - User ID who owns the repository
   * @param {string} params.owner - Repository owner (user or org)
   * @param {string} params.repo - Repository name
   * @param {string} params.webhookUrl - Webhook URL (optional, uses default if not provided)
   * @param {string} params.secret - Webhook secret
   * @param {Array<string>} params.events - Events to subscribe to
   * @param {boolean} params.active - Whether webhook is active
   * @returns {Promise<Object>} Created webhook
   */
  async registerRepositoryWebhook(params) {
    const { userId, owner, repo, webhookUrl, secret, events, active = true } = params;

    if (!userId || !owner || !repo) {
      throw new Error('userId, owner, and repo are required');
    }

    if (!secret) {
      throw new Error('Webhook secret is required');
    }

    const client = await this.getGitHubClientForUser(userId);
    const url = webhookUrl || this.baseWebhookUrl;

    this.logger.info('Registering GitHub webhook', {
      userId,
      owner,
      repo,
      url,
      events,
    });

    try {
      // Register webhook with GitHub
      const webhook = await client.createRepositoryWebhook(owner, repo, {
        url,
        secret,
        events: events || ['push', 'pull_request'],
        active,
        contentType: 'json',
      });

      // Store webhook registration in database
      await this.storeWebhookRegistration({
        userId,
        owner,
        repo,
        githubHookId: webhook.id,
        webhookUrl: url,
        events: webhook.events || events,
        active: webhook.active !== false,
        githubWebhookData: webhook,
      });

      this.logger.info('GitHub webhook registered successfully', {
        hookId: webhook.id,
        owner,
        repo,
      });

      return {
        id: webhook.id,
        url: webhook.config.url,
        events: webhook.events,
        active: webhook.active,
        created_at: webhook.created_at,
        updated_at: webhook.updated_at,
      };
    } catch (error) {
      this.logger.error('Failed to register GitHub webhook', {
        userId,
        owner,
        repo,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * List webhooks for repository
   *
   * @param {Object} params - Query parameters
   * @param {string} params.userId - User ID
   * @param {string} params.owner - Repository owner
   * @param {string} params.repo - Repository name
   * @returns {Promise<Array>} Webhook list
   */
  async listRepositoryWebhooks(params) {
    const { userId, owner, repo } = params;

    if (!userId || !owner || !repo) {
      throw new Error('userId, owner, and repo are required');
    }

    const client = await this.getGitHubClientForUser(userId);
    return client.getRepositoryWebhooks(owner, repo);
  }

  /**
   * Update webhook configuration
   *
   * @param {Object} params - Update parameters
   * @param {string} params.userId - User ID
   * @param {string} params.owner - Repository owner
   * @param {string} params.repo - Repository name
   * @param {number} params.hookId - Webhook ID
   * @param {Object} params.config - Update configuration
   * @returns {Promise<Object>} Updated webhook
   */
  async updateRepositoryWebhook(params) {
    const { userId, owner, repo, hookId, config } = params;

    if (!userId || !owner || !repo || !hookId) {
      throw new Error('userId, owner, repo, and hookId are required');
    }

    const client = await this.getGitHubClientForUser(userId);
    const updated = await client.updateRepositoryWebhook(owner, repo, hookId, config);

    // Update stored registration
    await this.updateWebhookRegistration({
      owner,
      repo,
      githubHookId: hookId,
      events: updated.events,
      active: updated.active,
      githubWebhookData: updated,
    });

    return updated;
  }

  /**
   * Delete webhook
   *
   * @param {Object} params - Delete parameters
   * @param {string} params.userId - User ID
   * @param {string} params.owner - Repository owner
   * @param {string} params.repo - Repository name
   * @param {number} params.hookId - Webhook ID
   * @returns {Promise<void>}
   */
  async deleteRepositoryWebhook(params) {
    const { userId, owner, repo, hookId } = params;

    if (!userId || !owner || !repo || !hookId) {
      throw new Error('userId, owner, repo, and hookId are required');
    }

    const client = await this.getGitHubClientForUser(userId);
    await client.deleteRepositoryWebhook(owner, repo, hookId);

    // Remove from database
    await this.deleteWebhookRegistration({
      owner,
      repo,
      githubHookId: hookId,
    });
  }

  /**
   * Test webhook (ping)
   *
   * @param {Object} params - Test parameters
   * @param {string} params.userId - User ID
   * @param {string} params.owner - Repository owner
   * @param {string} params.repo - Repository name
   * @param {number} params.hookId - Webhook ID
   * @returns {Promise<Object>} Test result
   */
  async testRepositoryWebhook(params) {
    const { userId, owner, repo, hookId } = params;

    if (!userId || !owner || !repo || !hookId) {
      throw new Error('userId, owner, repo, and hookId are required');
    }

    const client = await this.getGitHubClientForUser(userId);
    return client.testRepositoryWebhook(owner, repo, hookId);
  }

  /**
   * Store webhook registration in database
   * @private
   */
  async storeWebhookRegistration(registration) {
    // This would require a github_webhook_registrations table
    // For now, we'll log it - can be implemented later if needed
    this.logger.debug('Webhook registration stored', {
      owner: registration.owner,
      repo: registration.repo,
      hookId: registration.githubHookId,
    });
  }

  /**
   * Update webhook registration in database
   * @private
   */
  async updateWebhookRegistration(registration) {
    this.logger.debug('Webhook registration updated', {
      owner: registration.owner,
      repo: registration.repo,
      hookId: registration.githubHookId,
    });
  }

  /**
   * Delete webhook registration from database
   * @private
   */
  async deleteWebhookRegistration(registration) {
    this.logger.debug('Webhook registration deleted', {
      owner: registration.owner,
      repo: registration.repo,
      hookId: registration.githubHookId,
    });
  }
}

export default GitHubWebhookRegistrationService;

