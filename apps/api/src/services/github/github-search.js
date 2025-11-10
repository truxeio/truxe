/**
 * GitHub Search Service
 *
 * Advanced GitHub repository and code search with filtering and saved searches.
 *
 * Features:
 * - Full-text search across repositories
 * - Code search within repositories
 * - Filter by language, topics, stars, etc.
 * - Save search queries
 *
 * @see https://docs.github.com/en/rest/search
 */

import GitHubClient from './github-client.js';
import { GitHubAPIError } from './github-client.js';

export class GitHubSearchService {
  constructor(options = {}) {
    this.githubClient = options.githubClient;
    this.logger = options.logger || console;
    this.pool = options.pool;

    if (!this.githubClient) {
      throw new Error('GitHubClient is required');
    }
  }

  /**
   * Search repositories
   *
   * @param {Object} query - Search query object
   * @param {string} query.q - Search query string (GitHub search syntax)
   * @param {string} query.sort - Sort field (stars, forks, help-wanted-issues, updated)
   * @param {string} query.order - Sort order (asc, desc)
   * @param {number} query.perPage - Results per page
   * @param {number} query.page - Page number
   * @returns {Promise<Object>} Search results with pagination
   */
  async searchRepositories(query = {}) {
    if (!query.q) {
      throw new Error('Search query (q) is required');
    }

    try {
      const queryParams = new URLSearchParams();
      queryParams.set('q', query.q);
      if (query.sort) queryParams.set('sort', query.sort);
      if (query.order) queryParams.set('order', query.order);
      if (query.perPage) queryParams.set('per_page', String(query.perPage));
      if (query.page) queryParams.set('page', String(query.page));

      return await this.githubClient.request(
        `/search/repositories?${queryParams.toString()}`
      );
    } catch (error) {
      this.logger.error('Failed to search repositories', { query, error: error.message });
      throw error;
    }
  }

  /**
   * Search code
   *
   * @param {Object} query - Search query object
   * @param {string} query.q - Search query string (GitHub search syntax)
   * @param {string} query.sort - Sort field (indexed, score)
   * @param {string} query.order - Sort order (asc, desc)
   * @param {number} query.perPage - Results per page
   * @param {number} query.page - Page number
   * @returns {Promise<Object>} Search results with pagination
   */
  async searchCode(query = {}) {
    if (!query.q) {
      throw new Error('Search query (q) is required');
    }

    try {
      const queryParams = new URLSearchParams();
      queryParams.set('q', query.q);
      if (query.sort) queryParams.set('sort', query.sort);
      if (query.order) queryParams.set('order', query.order);
      if (query.perPage) queryParams.set('per_page', String(query.perPage));
      if (query.page) queryParams.set('page', String(query.page));

      return await this.githubClient.request(
        `/search/code?${queryParams.toString()}`
      );
    } catch (error) {
      this.logger.error('Failed to search code', { query, error: error.message });
      throw error;
    }
  }

  /**
   * Search issues
   *
   * @param {Object} query - Search query object
   * @param {string} query.q - Search query string
   * @param {string} query.sort - Sort field (comments, reactions, interactions, created, updated)
   * @param {string} query.order - Sort order (asc, desc)
   * @param {number} query.perPage - Results per page
   * @param {number} query.page - Page number
   * @returns {Promise<Object>} Search results with pagination
   */
  async searchIssues(query = {}) {
    if (!query.q) {
      throw new Error('Search query (q) is required');
    }

    try {
      const queryParams = new URLSearchParams();
      queryParams.set('q', query.q);
      if (query.sort) queryParams.set('sort', query.sort);
      if (query.order) queryParams.set('order', query.order);
      if (query.perPage) queryParams.set('per_page', String(query.perPage));
      if (query.page) queryParams.set('page', String(query.page));

      return await this.githubClient.request(
        `/search/issues?${queryParams.toString()}`
      );
    } catch (error) {
      this.logger.error('Failed to search issues', { query, error: error.message });
      throw error;
    }
  }

  /**
   * Search users
   *
   * @param {Object} query - Search query object
   * @param {string} query.q - Search query string
   * @param {string} query.sort - Sort field (followers, repositories, joined)
   * @param {string} query.order - Sort order (asc, desc)
   * @param {number} query.perPage - Results per page
   * @param {number} query.page - Page number
   * @returns {Promise<Object>} Search results with pagination
   */
  async searchUsers(query = {}) {
    if (!query.q) {
      throw new Error('Search query (q) is required');
    }

    try {
      const queryParams = new URLSearchParams();
      queryParams.set('q', query.q);
      if (query.sort) queryParams.set('sort', query.sort);
      if (query.order) queryParams.set('order', query.order);
      if (query.perPage) queryParams.set('per_page', String(query.perPage));
      if (query.page) queryParams.set('page', String(query.page));

      return await this.githubClient.request(
        `/search/users?${queryParams.toString()}`
      );
    } catch (error) {
      this.logger.error('Failed to search users', { query, error: error.message });
      throw error;
    }
  }

  /**
   * Build repository search query with filters
   *
   * @param {Object} filters - Search filters
   * @param {string} filters.query - Base search query
   * @param {string} filters.language - Programming language filter
   * @param {string} filters.topic - Topic filter
   * @param {number} filters.minStars - Minimum stars
   * @param {number} filters.maxStars - Maximum stars
   * @param {string} filters.license - License filter
   * @param {boolean} filters.archived - Include archived repositories
   * @param {string} filters.user - Filter by user/organization
   * @returns {string} GitHub search query string
   */
  buildRepositoryQuery(filters = {}) {
    const parts = [];

    if (filters.query) {
      parts.push(filters.query);
    }

    if (filters.language) {
      parts.push(`language:${filters.language}`);
    }

    if (filters.topic) {
      parts.push(`topic:${filters.topic}`);
    }

    if (filters.minStars !== undefined) {
      parts.push(`stars:>=${filters.minStars}`);
    }

    if (filters.maxStars !== undefined) {
      parts.push(`stars:<=${filters.maxStars}`);
    }

    if (filters.license) {
      parts.push(`license:${filters.license}`);
    }

    if (filters.archived === false) {
      parts.push('archived:false');
    }

    if (filters.user) {
      parts.push(`user:${filters.user}`);
    }

    return parts.join(' ');
  }

  /**
   * Save search query
   *
   * @param {string} userId - User ID
   * @param {Object} searchData - Search data
   * @param {string} searchData.name - Search name
   * @param {string} searchData.type - Search type (repository, code, issues, users)
   * @param {string} searchData.query - Search query
   * @param {Object} searchData.filters - Search filters
   * @returns {Promise<Object>} Saved search
   */
  async saveSearch(userId, searchData) {
    if (!this.pool) {
      throw new Error('Database pool required for saving searches');
    }

    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO github_saved_searches (
          user_id, name, search_type, query, filters, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        RETURNING *`,
        [
          userId,
          searchData.name,
          searchData.type,
          searchData.query,
          JSON.stringify(searchData.filters || {})
        ]
      );

      return this.formatSavedSearch(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * List saved searches for user
   *
   * @param {string} userId - User ID
   * @param {string} type - Optional filter by search type
   * @returns {Promise<Array>} Saved searches
   */
  async listSavedSearches(userId, type = null) {
    if (!this.pool) {
      return [];
    }

    const client = await this.pool.connect();
    try {
      let query = 'SELECT * FROM github_saved_searches WHERE user_id = $1';
      const params = [userId];

      if (type) {
        query += ' AND search_type = $2';
        params.push(type);
      }

      query += ' ORDER BY updated_at DESC';

      const result = await client.query(query, params);
      return result.rows.map(row => this.formatSavedSearch(row));
    } finally {
      client.release();
    }
  }

  /**
   * Delete saved search
   *
   * @param {string} userId - User ID
   * @param {string} searchId - Search ID
   * @returns {Promise<void>}
   */
  async deleteSavedSearch(userId, searchId) {
    if (!this.pool) {
      throw new Error('Database pool required for deleting searches');
    }

    const client = await this.pool.connect();
    try {
      await client.query(
        'DELETE FROM github_saved_searches WHERE id = $1 AND user_id = $2',
        [searchId, userId]
      );
    } finally {
      client.release();
    }
  }

  /**
   * Format saved search row from database
   *
   * @param {Object} row - Database row
   * @returns {Object} Formatted saved search
   * @private
   */
  formatSavedSearch(row) {
    return {
      id: row.id,
      user_id: row.user_id,
      name: row.name,
      search_type: row.search_type,
      query: row.query,
      filters: typeof row.filters === 'string' ? JSON.parse(row.filters) : row.filters,
      created_at: row.created_at?.toISOString(),
      updated_at: row.updated_at?.toISOString()
    };
  }
}

export default GitHubSearchService;

