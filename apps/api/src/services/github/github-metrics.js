/**
 * GitHub Integration Metrics
 *
 * Prometheus metrics for GitHub integration features:
 * - Repository sync operations
 * - API request metrics
 * - Rate limit tracking
 * - Error tracking
 *
 * Integrates with the existing monitoring-observability service.
 */

import { getMonitoringService } from '../monitoring-observability.js';

/**
 * GitHub Metrics Manager
 */
export class GitHubMetrics {
  constructor(options = {}) {
    this.monitoring = options.monitoring || getMonitoringService();
    this.metricsPrefix = options.metricsPrefix || 'github_';
    
    // Initialize metrics if not already done
    this.initializeMetrics();
  }

  /**
   * Initialize GitHub-specific metrics
   */
  initializeMetrics() {
    if (!this.monitoring) return;

    // Repository sync metrics
    this.monitoring.recordMetric('github_repository_sync_total', 0, {
      status: 'success',
      type: 'full',
    });
    
    this.monitoring.recordMetric('github_repository_sync_total', 0, {
      status: 'error',
      type: 'full',
    });

    this.monitoring.recordMetric('github_repository_sync_duration_seconds', 0, {
      type: 'full',
    });

    // API request metrics
    this.monitoring.recordMetric('github_api_requests_total', 0, {
      endpoint: '/user/repos',
      status: 'success',
    });

    this.monitoring.recordMetric('github_api_requests_total', 0, {
      endpoint: '/user/repos',
      status: 'error',
    });

    this.monitoring.recordMetric('github_api_request_duration_seconds', 0, {
      endpoint: '/user/repos',
    });

    // Rate limit metrics
    this.monitoring.recordMetric('github_rate_limit_remaining', 0, {
      resource: 'core',
    });

    this.monitoring.recordMetric('github_rate_limit_reset_timestamp', 0, {
      resource: 'core',
    });

    // Cache metrics
    this.monitoring.recordMetric('github_repository_cache_size', 0);
    
    this.monitoring.recordMetric('github_repository_cache_hits_total', 0);
    
    this.monitoring.recordMetric('github_repository_cache_misses_total', 0);
  }

  /**
   * Record repository sync operation
   *
   * @param {Object} params
   * @param {string} params.status - 'success' or 'error'
   * @param {string} params.type - 'full' or 'incremental'
   * @param {number} params.duration - Duration in milliseconds
   * @param {number} params.repositoriesTotal - Total repositories synced
   * @param {number} params.repositoriesCreated - New repositories
   * @param {number} params.repositoriesUpdated - Updated repositories
   * @param {number} params.errors - Number of errors
   */
  recordRepositorySync({
    status,
    type = 'full',
    duration = 0,
    repositoriesTotal = 0,
    repositoriesCreated = 0,
    repositoriesUpdated = 0,
    errors = 0,
  }) {
    if (!this.monitoring) return;

    // Increment sync counter
    this.monitoring.recordMetric('github_repository_sync_total', 1, {
      status,
      type,
    });

    // Record duration
    if (duration > 0) {
      this.monitoring.recordMetric(
        'github_repository_sync_duration_seconds',
        duration / 1000,
        { type }
      );
    }

    // Record repository counts
    if (repositoriesTotal > 0) {
      this.monitoring.recordMetric(
        'github_repository_sync_repositories_total',
        repositoriesTotal,
        { status, type }
      );
    }

    if (repositoriesCreated > 0) {
      this.monitoring.recordMetric(
        'github_repository_sync_repositories_created',
        repositoriesCreated,
        { type }
      );
    }

    if (repositoriesUpdated > 0) {
      this.monitoring.recordMetric(
        'github_repository_sync_repositories_updated',
        repositoriesUpdated,
        { type }
      );
    }

    if (errors > 0) {
      this.monitoring.recordMetric(
        'github_repository_sync_errors_total',
        errors,
        { type }
      );
    }
  }

  /**
   * Record GitHub API request
   *
   * @param {Object} params
   * @param {string} params.endpoint - API endpoint (e.g., '/user/repos')
   * @param {string} params.status - 'success' or 'error'
   * @param {number} params.duration - Duration in milliseconds
   * @param {number} params.statusCode - HTTP status code
   */
  recordAPIRequest({
    endpoint,
    status = 'success',
    duration = 0,
    statusCode = 200,
  }) {
    if (!this.monitoring) return;

    // Increment request counter
    this.monitoring.recordMetric('github_api_requests_total', 1, {
      endpoint,
      status,
      status_code: String(statusCode),
    });

    // Record duration
    if (duration > 0) {
      this.monitoring.recordMetric(
        'github_api_request_duration_seconds',
        duration / 1000,
        { endpoint, status_code: String(statusCode) }
      );
    }
  }

  /**
   * Record rate limit information
   *
   * @param {Object} params
   * @param {string} params.resource - Rate limit resource ('core', 'search', etc.)
   * @param {number} params.remaining - Remaining requests
   * @param {number} params.limit - Total limit
   * @param {number} params.reset - Reset timestamp
   */
  recordRateLimit({ resource = 'core', remaining = 0, limit = 0, reset = 0 }) {
    if (!this.monitoring) return;

    this.monitoring.recordMetric('github_rate_limit_remaining', remaining, {
      resource,
    });

    this.monitoring.recordMetric('github_rate_limit_limit', limit, {
      resource,
    });

    this.monitoring.recordMetric('github_rate_limit_reset_timestamp', reset, {
      resource,
    });

    // Calculate usage percentage
    if (limit > 0) {
      const usage = ((limit - remaining) / limit) * 100;
      this.monitoring.recordMetric('github_rate_limit_usage_percent', usage, {
        resource,
      });
    }
  }

  /**
   * Record cache metrics
   *
   * @param {Object} params
   * @param {string} params.type - 'hit' or 'miss'
   * @param {number} params.cacheSize - Current cache size
   */
  recordCacheMetrics({ type, cacheSize = 0 }) {
    if (!this.monitoring) return;

    if (type === 'hit') {
      this.monitoring.recordMetric('github_repository_cache_hits_total', 1);
    } else if (type === 'miss') {
      this.monitoring.recordMetric('github_repository_cache_misses_total', 1);
    }

    if (cacheSize > 0) {
      this.monitoring.recordMetric('github_repository_cache_size', cacheSize);
    }
  }

  /**
   * Record organization sync operation
   *
   * @param {Object} params
   * @param {string} params.status - 'success', 'partial', or 'error'
   * @param {number} params.duration - Duration in milliseconds
   * @param {number} params.membersTotal - Total members synced
   * @param {number} params.membersCreated - New members
   * @param {number} params.membersUpdated - Updated members
   * @param {number} params.teamsTotal - Total teams
   * @param {number} params.teamsSynced - Teams synced
   * @param {number} params.errors - Number of errors
   */
  recordOrganizationSync({
    status,
    duration = 0,
    membersTotal = 0,
    membersCreated = 0,
    membersUpdated = 0,
    teamsTotal = 0,
    teamsSynced = 0,
    errors = 0,
  }) {
    if (!this.monitoring) return;

    this.monitoring.recordMetric('github_organization_sync_total', 1, {
      status,
    });

    if (duration > 0) {
      this.monitoring.recordMetric(
        'github_organization_sync_duration_seconds',
        duration / 1000,
        { status }
      );
    }

    if (membersTotal > 0) {
      this.monitoring.recordMetric('github_organization_members_synced_total', membersTotal, {
        status,
      });
      this.monitoring.recordMetric('github_organization_members_created_total', membersCreated);
      this.monitoring.recordMetric('github_organization_members_updated_total', membersUpdated);
    }

    if (teamsTotal > 0) {
      this.monitoring.recordMetric('github_organization_teams_synced_total', teamsSynced, {
        status,
      });
    }

    if (errors > 0) {
      this.monitoring.recordMetric('github_organization_sync_errors_total', errors);
    }
  }

  /**
   * Record error
   *
   * @param {Object} params
   * @param {string} params.type - Error type (e.g., 'api_error', 'sync_error')
   * @param {string} params.endpoint - Endpoint where error occurred
   * @param {number} params.statusCode - HTTP status code (if applicable)
   */
  recordError({ type, endpoint = null, statusCode = null }) {
    if (!this.monitoring) return;

    const labels = { type };
    if (endpoint) labels.endpoint = endpoint;
    if (statusCode) labels.status_code = String(statusCode);

    this.monitoring.recordMetric('github_errors_total', 1, labels);

    // Log error event
    this.monitoring.logEvent('error', 'GitHub integration error', {
      type,
      endpoint,
      statusCode,
    });
  }

  /**
   * Record webhook event (for Phase 3)
   *
   * @param {Object} params
   * @param {string} params.eventType - Webhook event type
   * @param {string} params.status - 'processed' or 'failed'
   * @param {number} params.duration - Processing duration
   */
  recordWebhookEvent({ eventType, status = 'processed', duration = 0 }) {
    if (!this.monitoring) return;

    this.monitoring.recordMetric('github_webhook_events_total', 1, {
      event_type: eventType,
      status,
    });

    if (duration > 0) {
      this.monitoring.recordMetric(
        'github_webhook_processing_duration_seconds',
        duration / 1000,
        { event_type: eventType, status }
      );
    }
  }
}

// Singleton instance
let globalGitHubMetrics = null;

/**
 * Get or create global GitHub metrics instance
 */
export function getGitHubMetrics(options = {}) {
  if (!globalGitHubMetrics) {
    globalGitHubMetrics = new GitHubMetrics(options);
  }
  return globalGitHubMetrics;
}

export default GitHubMetrics;

