/**
 * GitHub API Client
 *
 * Client for making authenticated requests to the GitHub API.
 * Supports rate limit handling, automatic retries, pagination, and error handling.
 *
 * Features:
 * - Authenticated API requests
 * - Rate limit detection and handling
 * - Request retries with exponential backoff
 * - Automatic pagination
 * - Comprehensive error handling
 * - Request timeout support
 * - Prometheus metrics integration
 *
 * @see https://docs.github.com/en/rest
 */

import { getGitHubMetrics } from './github-metrics.js';

export class GitHubAPIError extends Error {
  constructor(message, { statusCode, response, headers = {}, rateLimit = null }) {
    super(message);
    this.name = 'GitHubAPIError';
    this.statusCode = statusCode;
    this.response = response;
    this.headers = headers;
    this.rateLimit = rateLimit;
  }
}

export class GitHubClient {
  constructor({ accessToken, options = {} }) {
    if (!accessToken) {
      throw new Error('GitHub access token is required');
    }

    this.accessToken = accessToken;
    this.baseUrl = options.enterpriseUrl || process.env.GITHUB_ENTERPRISE_URL || 'https://api.github.com';
    this.apiVersion = options.apiVersion || process.env.GITHUB_API_VERSION || '2022-11-28';
    this.userAgent = options.userAgent || process.env.GITHUB_USER_AGENT || 'Heimdall-Auth';
    this.timeout = options.timeout || 30000; // 30 seconds default
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000; // 1 second initial delay
    this.logger = options.logger || console;
    this.metrics = options.metrics || getGitHubMetrics();

    // Rate limit tracking
    this.rateLimit = {
      limit: null,
      remaining: null,
      reset: null,
    };
  }

  /**
   * Make authenticated request to GitHub API
   *
   * @param {string} endpoint - API endpoint (e.g., '/user', '/user/repos')
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response data
   */
  async request(endpoint, options = {}) {
    const fullUrl = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': this.apiVersion,
      'User-Agent': this.userAgent,
      ...options.headers,
    };

    let lastError;
    let attempt = 0;
    const startTime = Date.now();

    while (attempt <= this.maxRetries) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(fullUrl, {
          ...options,
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Update rate limit info from headers
        this.updateRateLimitFromHeaders(response.headers);
        
        // Record rate limit metrics
        if (this.metrics && this.rateLimit.limit !== null) {
          this.metrics.recordRateLimit({
            resource: 'core',
            remaining: this.rateLimit.remaining,
            limit: this.rateLimit.limit,
            reset: this.rateLimit.reset,
          });
        }

        // Handle rate limit
        if (response.status === 403 && this.isRateLimited(response.headers)) {
          const retryAfter = this.getRetryAfter(response.headers);
          this.logger.warn('GitHub API rate limit exceeded', {
            limit: this.rateLimit.limit,
            remaining: this.rateLimit.remaining,
            reset: new Date(this.rateLimit.reset * 1000).toISOString(),
            retryAfter,
          });

          if (retryAfter > 0 && attempt < this.maxRetries) {
            await this.sleep(retryAfter * 1000);
            attempt++;
            continue;
          }

          throw new GitHubAPIError('GitHub API rate limit exceeded', {
            statusCode: 403,
            response: await this.safeParseResponse(response),
            headers: Object.fromEntries(response.headers.entries()),
            rateLimit: this.rateLimit,
          });
        }

        const duration = Date.now() - startTime;
        const endpointName = this.extractEndpoint(fullUrl);

        if (!response.ok) {
          const errorData = await this.safeParseResponse(response);
          
          // Record error metrics
          if (this.metrics) {
            this.metrics.recordAPIRequest({
              endpoint: endpointName,
              status: 'error',
              duration,
              statusCode: response.status,
            });
            this.metrics.recordError({
              type: 'api_error',
              endpoint: endpointName,
              statusCode: response.status,
            });
          }
          
          throw new GitHubAPIError(
            this.getErrorMessage(errorData, response.status),
            {
              statusCode: response.status,
              response: errorData,
              headers: Object.fromEntries(response.headers.entries()),
              rateLimit: this.rateLimit,
            }
          );
        }

        // Record success metrics
        if (this.metrics) {
          this.metrics.recordAPIRequest({
            endpoint: endpointName,
            status: 'success',
            duration,
            statusCode: response.status,
          });
        }

        return await response.json();
      } catch (error) {
        lastError = error;

        // Don't retry on client errors (4xx) except rate limits
        if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 403) {
          throw error;
        }

        // Don't retry on timeout or abort
        if (error.name === 'AbortError') {
          throw new GitHubAPIError('Request timeout', {
            statusCode: 504,
            response: { message: 'Request timeout' },
            rateLimit: this.rateLimit,
          });
        }

        // Retry with exponential backoff
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          this.logger.warn('GitHub API request failed, retrying', {
            attempt: attempt + 1,
            maxRetries: this.maxRetries,
            delay,
            error: error.message,
          });
          await this.sleep(delay);
          attempt++;
        } else {
          throw error;
        }
      }
    }

    throw lastError;
  }

  /**
   * Get current user
   *
   * @returns {Promise<Object>} User data
   */
  async getUser() {
    return this.request('/user');
  }

  /**
   * Get user emails
   *
   * @returns {Promise<Array>} Email addresses
   */
  async getUserEmails() {
    return this.request('/user/emails');
  }

  /**
   * List user repositories
   *
   * @param {Object} params - Query parameters
   * @param {string} params.type - Repository type (all, owner, member)
   * @param {string} params.sort - Sort field (created, updated, pushed, full_name)
   * @param {string} params.direction - Sort direction (asc, desc)
   * @param {number} params.per_page - Items per page (max 100)
   * @param {number} params.page - Page number
   * @returns {Promise<Array>} Repository list
   */
  async getRepositories(params = {}) {
    const queryParams = new URLSearchParams({
      type: params.type || 'all',
      sort: params.sort || 'updated',
      direction: params.direction || 'desc',
      per_page: String(params.per_page || 30),
      page: String(params.page || 1),
    });

    return this.request(`/user/repos?${queryParams}`);
  }

  /**
   * Get all user repositories with pagination
   *
   * @param {Object} params - Query parameters
   * @param {Function} onPage - Optional callback for each page
   * @returns {Promise<Array>} All repositories
   */
  async getAllRepositories(params = {}, onPage = null) {
    const allRepos = [];
    let page = params.page || 1;
    let hasMore = true;

    while (hasMore) {
      const repos = await this.getRepositories({ ...params, page });
      allRepos.push(...repos);

      if (onPage) {
        await onPage(repos, page);
      }

      // Check if there are more pages
      hasMore = repos.length === (params.per_page || 30);

      if (!hasMore) {
        break;
      }

      page++;
    }

    return allRepos;
  }

  /**
   * Get repository details
   *
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Object>} Repository data
   */
  async getRepository(owner, repo) {
    return this.request(`/repos/${owner}/${repo}`);
  }

  /**
   * List repository commits
   *
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {Object} params - Query parameters
   * @returns {Promise<Array>} Commit list
   */
  async getRepositoryCommits(owner, repo, params = {}) {
    const queryParams = new URLSearchParams();
    if (params.sha) queryParams.set('sha', params.sha);
    if (params.path) queryParams.set('path', params.path);
    if (params.author) queryParams.set('author', params.author);
    if (params.since) queryParams.set('since', params.since);
    if (params.until) queryParams.set('until', params.until);
    if (params.per_page) queryParams.set('per_page', String(params.per_page));
    if (params.page) queryParams.set('page', String(params.page));

    const query = queryParams.toString();
    return this.request(`/repos/${owner}/${repo}/commits${query ? `?${query}` : ''}`);
  }

  /**
   * List repository branches
   *
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Array>} Branch list
   */
  async getRepositoryBranches(owner, repo) {
    return this.request(`/repos/${owner}/${repo}/branches`);
  }

  /**
   * List repository pull requests
   *
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {Object} params - Query parameters
   * @returns {Promise<Array>} Pull request list
   */
  async getRepositoryPullRequests(owner, repo, params = {}) {
    const queryParams = new URLSearchParams();
    if (params.state) queryParams.set('state', params.state);
    if (params.head) queryParams.set('head', params.head);
    if (params.base) queryParams.set('base', params.base);
    if (params.sort) queryParams.set('sort', params.sort);
    if (params.direction) queryParams.set('direction', params.direction);
    if (params.per_page) queryParams.set('per_page', String(params.per_page));
    if (params.page) queryParams.set('page', String(params.page));

    const query = queryParams.toString();
    return this.request(`/repos/${owner}/${repo}/pulls${query ? `?${query}` : ''}`);
  }

  /**
   * Get user organizations
   *
   * @returns {Promise<Array>} Organization list
   */
  async getOrganizations() {
    return this.request('/user/orgs');
  }

  /**
   * Get organization details
   *
   * @param {string} org - Organization login
   * @returns {Promise<Object>} Organization data
   */
  async getOrganization(org) {
    return this.request(`/orgs/${org}`);
  }

  /**
   * List organization members
   *
   * @param {string} org - Organization login
   * @returns {Promise<Array>} Member list
   */
  async getOrganizationMembers(org) {
    return this.request(`/orgs/${org}/members`);
  }

  /**
   * List organization teams
   *
   * @param {string} org - Organization login
   * @returns {Promise<Array>} Team list
   */
  async getTeams(org) {
    return this.request(`/orgs/${org}/teams`);
  }

  /**
   * List team members
   *
   * @param {string} org - Organization login
   * @param {string} teamSlug - Team slug
   * @returns {Promise<Array>} Team member list
   */
  async getTeamMembers(org, teamSlug) {
    return this.request(`/orgs/${org}/teams/${teamSlug}/members`);
  }

  /**
   * Update rate limit info from response headers
   *
   * @param {Headers} headers - Response headers
   * @private
   */
  updateRateLimitFromHeaders(headers) {
    const limit = headers.get('x-ratelimit-limit');
    const remaining = headers.get('x-ratelimit-remaining');
    const reset = headers.get('x-ratelimit-reset');

    if (limit) this.rateLimit.limit = parseInt(limit, 10);
    if (remaining) this.rateLimit.remaining = parseInt(remaining, 10);
    if (reset) this.rateLimit.reset = parseInt(reset, 10);
  }

  /**
   * Check if response indicates rate limiting
   *
   * @param {Headers} headers - Response headers
   * @returns {boolean}
   * @private
   */
  isRateLimited(headers) {
    // GitHub returns 403 with rate limit headers when rate limited
    const remaining = headers.get('x-ratelimit-remaining');
    return remaining !== null && parseInt(remaining, 10) === 0;
  }

  /**
   * Get retry-after delay in seconds
   *
   * @param {Headers} headers - Response headers
   * @returns {number}
   * @private
   */
  getRetryAfter(headers) {
    const retryAfter = headers.get('retry-after');
    if (retryAfter) {
      return parseInt(retryAfter, 10);
    }

    // Calculate from reset time
    if (this.rateLimit.reset) {
      const resetTime = this.rateLimit.reset * 1000;
      const now = Date.now();
      return Math.max(0, Math.ceil((resetTime - now) / 1000));
    }

    return 0;
  }

  /**
   * Safely parse response as JSON or text
   *
   * @param {Response} response - Fetch response
   * @returns {Promise<Object|string>}
   * @private
   */
  async safeParseResponse(response) {
    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    if (contentType.includes('application/json')) {
      try {
        return JSON.parse(text);
      } catch {
        return { raw: text };
      }
    }

    return { message: text };
  }

  /**
   * Get user-friendly error message
   *
   * @param {Object|string} errorData - Error response data
   * @param {number} statusCode - HTTP status code
   * @returns {string}
   * @private
   */
  getErrorMessage(errorData, statusCode) {
    if (typeof errorData === 'string') {
      return errorData;
    }

    if (errorData?.message) {
      return errorData.message;
    }

    // Default messages by status code
    const statusMessages = {
      400: 'Bad request',
      401: 'Unauthorized - invalid or expired token',
      403: 'Forbidden - insufficient permissions',
      404: 'Resource not found',
      422: 'Validation failed',
      429: 'Too many requests - rate limit exceeded',
      500: 'GitHub API server error',
      503: 'GitHub API service unavailable',
    };

    return statusMessages[statusCode] || `GitHub API error (${statusCode})`;
  }

  /**
   * Extract endpoint name from full URL
   *
   * @param {string} fullUrl - Full URL
   * @returns {string} Endpoint path
   * @private
   */
  extractEndpoint(fullUrl) {
    try {
      const url = new URL(fullUrl);
      return url.pathname || fullUrl;
    } catch {
      return fullUrl;
    }
  }

  /**
   * Sleep utility for retries
   *
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   * @private
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current rate limit info
   *
   * @returns {Object}
   */
  getRateLimit() {
    return { ...this.rateLimit };
  }

  /**
   * List repository webhooks
   *
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Array>} Webhook list
   */
  async getRepositoryWebhooks(owner, repo) {
    return this.request(`/repos/${owner}/${repo}/hooks`);
  }

  /**
   * Get repository webhook by ID
   *
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} hookId - Webhook ID
   * @returns {Promise<Object>} Webhook details
   */
  async getRepositoryWebhook(owner, repo, hookId) {
    return this.request(`/repos/${owner}/${repo}/hooks/${hookId}`);
  }

  /**
   * Create repository webhook
   *
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {Object} webhookConfig - Webhook configuration
   * @param {string} webhookConfig.url - Webhook URL
   * @param {string} webhookConfig.secret - Webhook secret
   * @param {Array<string>} webhookConfig.events - Events to subscribe to
   * @param {boolean} webhookConfig.active - Whether webhook is active
   * @param {Object} webhookConfig.config - Additional configuration
   * @returns {Promise<Object>} Created webhook
   */
  async createRepositoryWebhook(owner, repo, webhookConfig) {
    const payload = {
      name: 'web',
      active: webhookConfig.active !== false,
      events: webhookConfig.events || ['push'],
      config: {
        url: webhookConfig.url,
        content_type: webhookConfig.contentType || 'json',
        secret: webhookConfig.secret,
        insecure_ssl: webhookConfig.insecureSsl ? '1' : '0',
        ...webhookConfig.config,
      },
    };

    return this.request(`/repos/${owner}/${repo}/hooks`, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Update repository webhook
   *
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} hookId - Webhook ID
   * @param {Object} webhookConfig - Webhook configuration updates
   * @returns {Promise<Object>} Updated webhook
   */
  async updateRepositoryWebhook(owner, repo, hookId, webhookConfig) {
    const payload = {};

    if (webhookConfig.events !== undefined) {
      payload.events = webhookConfig.events;
    }
    if (webhookConfig.active !== undefined) {
      payload.active = webhookConfig.active;
    }
    if (webhookConfig.config !== undefined) {
      payload.config = webhookConfig.config;
    }

    return this.request(`/repos/${owner}/${repo}/hooks/${hookId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Delete repository webhook
   *
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} hookId - Webhook ID
   * @returns {Promise<void>}
   */
  async deleteRepositoryWebhook(owner, repo, hookId) {
    return this.request(`/repos/${owner}/${repo}/hooks/${hookId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Test repository webhook (ping)
   *
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} hookId - Webhook ID
   * @returns {Promise<Object>} Test result
   */
  async testRepositoryWebhook(owner, repo, hookId) {
    return this.request(`/repos/${owner}/${repo}/hooks/${hookId}/tests`, {
      method: 'POST',
    });
  }

  /**
   * List organization webhooks
   *
   * @param {string} org - Organization name
   * @returns {Promise<Array>} Webhook list
   */
  async getOrganizationWebhooks(org) {
    return this.request(`/orgs/${org}/hooks`);
  }

  /**
   * Create organization webhook
   *
   * @param {string} org - Organization name
   * @param {Object} webhookConfig - Webhook configuration
   * @returns {Promise<Object>} Created webhook
   */
  async createOrganizationWebhook(org, webhookConfig) {
    const payload = {
      name: 'web',
      active: webhookConfig.active !== false,
      events: webhookConfig.events || ['push'],
      config: {
        url: webhookConfig.url,
        content_type: webhookConfig.contentType || 'json',
        secret: webhookConfig.secret,
        insecure_ssl: webhookConfig.insecureSsl ? '1' : '0',
        ...webhookConfig.config,
      },
    };

    return this.request(`/orgs/${org}/hooks`, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}

export default GitHubClient;

