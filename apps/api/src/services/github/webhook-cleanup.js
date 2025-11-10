/**
 * GitHub Webhook Cleanup Service
 *
 * Automated cleanup job for old GitHub webhook events.
 * Removes processed events older than configured retention period.
 *
 * Features:
 * - Scheduled cleanup of old webhook events
 * - Configurable retention period
 * - Safe deletion (only processed events)
 * - Metrics and logging
 */

import { getPool } from '../../database/connection.js';

/**
 * GitHub Webhook Cleanup Service
 */
export class GitHubWebhookCleanupService {
  constructor(options = {}) {
    this.pool = options.pool || getPool();
    this.logger = options.logger || console;
    
    // Configuration
    this.retentionDays = options.retentionDays || 
      parseInt(process.env.GITHUB_WEBHOOK_RETENTION_DAYS || '90');
    this.cleanupInterval = options.cleanupInterval || 
      parseInt(process.env.GITHUB_WEBHOOK_CLEANUP_INTERVAL || '86400000'); // 24 hours
    this.batchSize = options.batchSize || 
      parseInt(process.env.GITHUB_WEBHOOK_CLEANUP_BATCH_SIZE || '1000');
    
    this.cleanupTimer = null;
    this.isRunning = false;
  }

  /**
   * Start automated cleanup job
   */
  start() {
    if (this.cleanupTimer) {
      this.logger.warn('Cleanup job already started');
      return;
    }

    // Run immediately on start
    this.performCleanup().catch(error => {
      this.logger.error('Initial cleanup failed', { error: error.message });
    });

    // Schedule periodic cleanup
    this.cleanupTimer = setInterval(() => {
      this.performCleanup().catch(error => {
        this.logger.error('Scheduled cleanup failed', { error: error.message });
      });
    }, this.cleanupInterval);

    this.logger.info('GitHub webhook cleanup job started', {
      retentionDays: this.retentionDays,
      interval: `${this.cleanupInterval}ms`,
    });
  }

  /**
   * Stop automated cleanup job
   */
  stop() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      this.logger.info('GitHub webhook cleanup job stopped');
    }
  }

  /**
   * Perform cleanup of old webhook events
   *
   * @returns {Promise<Object>} Cleanup statistics
   */
  async performCleanup() {
    if (this.isRunning) {
      this.logger.warn('Cleanup already in progress, skipping');
      return { skipped: true };
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      this.logger.info('Starting GitHub webhook cleanup', {
        retentionDays: this.retentionDays,
      });

      // Use database function for cleanup
      const result = await this.pool.query(
        `SELECT cleanup_old_github_webhook_events() as deleted_count`
      );

      const deletedCount = parseInt(result.rows[0]?.deleted_count || 0);
      const duration = Date.now() - startTime;

      this.logger.info('GitHub webhook cleanup completed', {
        deletedCount,
        duration: `${duration}ms`,
      });

      return {
        deletedCount,
        duration,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('GitHub webhook cleanup failed', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get cleanup statistics
   *
   * @returns {Promise<Object>} Statistics
   */
  async getCleanupStats() {
    try {
      // Get count of events eligible for cleanup
      const eligibleResult = await this.pool.query(
        `SELECT COUNT(*) as count
         FROM github_webhook_events
         WHERE processed = true
           AND processed_at < NOW() - INTERVAL '${this.retentionDays} days'`
      );

      const eligibleCount = parseInt(eligibleResult.rows[0]?.count || 0);

      // Get total event count
      const totalResult = await this.pool.query(
        `SELECT COUNT(*) as count FROM github_webhook_events`
      );

      const totalCount = parseInt(totalResult.rows[0]?.count || 0);

      // Get oldest processed event date
      const oldestResult = await this.pool.query(
        `SELECT MIN(processed_at) as oldest
         FROM github_webhook_events
         WHERE processed = true`
      );

      return {
        retentionDays: this.retentionDays,
        totalEvents: totalCount,
        eligibleForCleanup: eligibleCount,
        oldestProcessedEvent: oldestResult.rows[0]?.oldest?.toISOString() || null,
        nextCleanup: this.cleanupTimer 
          ? new Date(Date.now() + this.cleanupInterval).toISOString()
          : null,
        isRunning: this.isRunning,
      };
    } catch (error) {
      this.logger.error('Failed to get cleanup stats', {
        error: error.message,
      });
      throw error;
    }
  }
}

export default GitHubWebhookCleanupService;




