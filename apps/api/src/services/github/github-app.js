/**
 * GitHub App Service
 *
 * Service for managing GitHub App installations and tokens.
 * GitHub Apps provide better permissions, higher rate limits, and built-in webhook support.
 *
 * Features:
 * - JWT generation for GitHub App authentication
 * - Installation access token management
 * - Installation storage and retrieval
 * - Automatic token refresh
 * - Organization and repository-level installations
 *
 * @see https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app
 */

import { SignJWT, jwtVerify } from 'jose';
import GitHubClient from './github-client.js';
import { getGitHubMetrics } from './github-metrics.js';
import { getPool } from '../../database/connection.js';
import OAuthTokenEncryptor from '../oauth/token-encryptor.js';
import config from '../../config/index.js';

export class GitHubAppError extends Error {
  constructor(message, { statusCode = null, response = null, code = null } = {}) {
    super(message);
    this.name = 'GitHubAppError';
    this.statusCode = statusCode;
    this.response = response;
    this.code = code;
  }
}

/**
 * GitHub App Service
 */
export class GitHubApp {
  constructor(options = {}) {
    this.appId = options.appId || process.env.GITHUB_APP_ID;
    this.privateKey = options.privateKey || process.env.GITHUB_APP_PRIVATE_KEY;
    this.webhookSecret = options.webhookSecret || process.env.GITHUB_APP_WEBHOOK_SECRET;
    this.baseUrl = options.baseUrl || process.env.GITHUB_ENTERPRISE_URL || 'https://api.github.com';
    this.apiVersion = options.apiVersion || process.env.GITHUB_API_VERSION || '2022-11-28';
    this.userAgent = options.userAgent || process.env.GITHUB_USER_AGENT || 'Truxe-GitHubApp';
    this.logger = options.logger || console;
    this.pool = options.pool || getPool();
    this.metrics = options.metrics || getGitHubMetrics();

    // Initialize token encryptor for secure token storage
    const encryptionKey = options.encryptionKey || 
                         process.env.OAUTH_TOKEN_ENCRYPTION_KEY || 
                         process.env.SECRET_KEY ||
                         config.oauth?.tokenEncryptionKey;
    
    if (encryptionKey) {
      this.tokenEncryptor = new OAuthTokenEncryptor({
        key: encryptionKey,
        algorithm: options.encryptionAlgorithm || 
                  process.env.OAUTH_TOKEN_ENCRYPTION_ALGORITHM || 
                  'aes-256-gcm'
      });
      this.logger.debug('GitHub App token encryption enabled');
    } else {
      this.logger.warn('GitHub App token encryption key not found - tokens will be stored with base64 encoding only');
      this.tokenEncryptor = null;
    }

    if (!this.appId) {
      throw new GitHubAppError('GitHub App ID is required');
    }

    if (!this.privateKey) {
      throw new GitHubAppError('GitHub App private key is required');
    }

    // Parse and validate private key
    try {
      this.privateKeyParsed = this.parsePrivateKey(this.privateKey);
    } catch (error) {
      throw new GitHubAppError('Invalid GitHub App private key', { code: 'INVALID_KEY' });
    }

    // Cache for JWT tokens (5 minute TTL, GitHub JWTs expire after 10 minutes)
    this.jwtCache = null;
    this.jwtCacheExpiry = null;
  }

  /**
   * Parse private key from various formats
   *
   * @param {string} key - Private key in PEM format (may include escaped newlines)
   * @returns {string} Parsed private key
   * @private
   */
  parsePrivateKey(key) {
    // Handle base64 encoded keys
    if (!key.includes('-----BEGIN')) {
      try {
        key = Buffer.from(key, 'base64').toString('utf-8');
      } catch {
        // Not base64, assume it's already text
      }
    }

    // Replace escaped newlines
    key = key.replace(/\\n/g, '\n');

    // Ensure proper PEM format
    if (!key.includes('-----BEGIN')) {
      throw new Error('Private key must be in PEM format');
    }

    return key;
  }

  /**
   * Generate JWT for GitHub App authentication
   * JWTs are valid for 10 minutes, cached for 5 minutes
   *
   * @returns {Promise<string>} JWT token
   */
  async generateJWT() {
    // Return cached JWT if still valid
    if (this.jwtCache && this.jwtCacheExpiry && Date.now() < this.jwtCacheExpiry) {
      return this.jwtCache;
    }

    try {
      const now = Math.floor(Date.now() / 1000);
      const payload = {
        iat: now - 60, // Issued 1 minute ago (clock skew tolerance)
        exp: now + 600, // Expires in 10 minutes
        iss: String(this.appId)
      };

      const jwt = await new SignJWT(payload)
        .setProtectedHeader({ alg: 'RS256' })
        .setIssuedAt(now)
        .setExpirationTime(now + 600)
        .sign(this.privateKeyParsed);

      // Cache for 5 minutes (half of 10 minute expiry)
      this.jwtCache = jwt;
      this.jwtCacheExpiry = Date.now() + (5 * 60 * 1000);

      return jwt;
    } catch (error) {
      this.logger.error('Failed to generate GitHub App JWT', { error: error.message });
      throw new GitHubAppError('Failed to generate JWT', { code: 'JWT_GENERATION_FAILED' });
    }
  }

  /**
   * Get installation access token for a specific installation
   *
   * @param {number} installationId - GitHub installation ID
   * @param {Object} options - Additional options
   * @param {string[]} options.permissions - Requested permissions (overrides app defaults)
   * @param {string[]} options.repositoryIds - Repository IDs for repository-level access
   * @returns {Promise<Object>} Installation token data
   */
  async getInstallationAccessToken(installationId, options = {}) {
    // Check cache first
    const cached = await this.getCachedInstallationToken(installationId);
    if (cached && cached.expiresAt && new Date(cached.expiresAt) > new Date()) {
      return cached.token;
    }

    try {
      const jwt = await this.generateJWT();
      const url = `${this.baseUrl}/app/installations/${installationId}/access_tokens`;

      const body = {};
      if (options.permissions && options.permissions.length > 0) {
        body.permissions = options.permissions.reduce((acc, perm) => {
          acc[perm] = 'read';
          return acc;
        }, {});
      }

      if (options.repositoryIds && options.repositoryIds.length > 0) {
        body.repository_ids = options.repositoryIds;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': this.apiVersion,
          'User-Agent': this.userAgent
        },
        body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new GitHubAppError(
          errorData.message || `Failed to get installation token: ${response.statusText}`,
          {
            statusCode: response.status,
            response: errorData
          }
        );
      }

      const data = await response.json();
      
      // Cache the token
      await this.cacheInstallationToken(installationId, {
        token: data.token,
        expiresAt: new Date(data.expires_at),
        permissions: data.permissions || {},
        repositorySelection: data.repository_selection
      });

      if (this.metrics) {
        this.metrics.recordAPIRequest({
          endpoint: `/app/installations/${installationId}/access_tokens`,
          status: 'success',
          duration: 0
        });
      }

      return data;
    } catch (error) {
      if (this.metrics) {
        this.metrics.recordError({
          type: 'github_app_error',
          endpoint: `/app/installations/${installationId}/access_tokens`
        });
      }

      if (error instanceof GitHubAppError) {
        throw error;
      }

      throw new GitHubAppError('Failed to get installation access token', {
        code: 'TOKEN_FETCH_FAILED',
        response: { message: error.message }
      });
    }
  }

  /**
   * Get GitHub client using installation token
   *
   * @param {number} installationId - Installation ID
   * @param {Object} options - Options for token and client
   * @returns {Promise<GitHubClient>} Configured GitHub client
   */
  async getInstallationClient(installationId, options = {}) {
    const tokenData = await this.getInstallationAccessToken(installationId, options);
    return new GitHubClient({
      accessToken: tokenData.token,
      options: {
        baseUrl: this.baseUrl,
        apiVersion: this.apiVersion,
        userAgent: this.userAgent,
        logger: this.logger,
        metrics: this.metrics
      }
    });
  }

  /**
   * List installations for the app
   *
   * @param {Object} options - Query options
   * @param {number} options.perPage - Results per page
   * @param {number} options.page - Page number
   * @returns {Promise<Array>} Installation list
   */
  async listInstallations(options = {}) {
    try {
      const jwt = await this.generateJWT();
      const queryParams = new URLSearchParams();
      if (options.perPage) queryParams.set('per_page', String(options.perPage));
      if (options.page) queryParams.set('page', String(options.page));

      const url = `${this.baseUrl}/app/installations${queryParams.toString() ? `?${queryParams}` : ''}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': this.apiVersion,
          'User-Agent': this.userAgent
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new GitHubAppError(
          errorData.message || `Failed to list installations: ${response.statusText}`,
          { statusCode: response.status, response: errorData }
        );
      }

      return response.json();
    } catch (error) {
      if (error instanceof GitHubAppError) {
        throw error;
      }
      throw new GitHubAppError('Failed to list installations', {
        code: 'LIST_FAILED',
        response: { message: error.message }
      });
    }
  }

  /**
   * Get installation details
   *
   * @param {number} installationId - Installation ID
   * @returns {Promise<Object>} Installation data
   */
  async getInstallation(installationId) {
    try {
      const jwt = await this.generateJWT();
      const url = `${this.baseUrl}/app/installations/${installationId}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': this.apiVersion,
          'User-Agent': this.userAgent
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new GitHubAppError(
          errorData.message || `Failed to get installation: ${response.statusText}`,
          { statusCode: response.status, response: errorData }
        );
      }

      return response.json();
    } catch (error) {
      if (error instanceof GitHubAppError) {
        throw error;
      }
      throw new GitHubAppError('Failed to get installation', {
        code: 'GET_FAILED',
        response: { message: error.message }
      });
    }
  }

  /**
   * Delete installation (uninstall app)
   *
   * @param {number} installationId - Installation ID
   * @returns {Promise<void>}
   */
  async deleteInstallation(installationId) {
    try {
      const jwt = await this.generateJWT();
      const url = `${this.baseUrl}/app/installations/${installationId}`;

      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': this.apiVersion,
          'User-Agent': this.userAgent
        }
      });

      if (!response.ok && response.status !== 204) {
        const errorData = await response.json().catch(() => ({}));
        throw new GitHubAppError(
          errorData.message || `Failed to delete installation: ${response.statusText}`,
          { statusCode: response.status, response: errorData }
        );
      }

      // Remove from cache and database
      await this.removeInstallation(installationId);
    } catch (error) {
      if (error instanceof GitHubAppError) {
        throw error;
      }
      throw new GitHubAppError('Failed to delete installation', {
        code: 'DELETE_FAILED',
        response: { message: error.message }
      });
    }
  }

  /**
   * Store installation in database
   *
   * @param {Object} installationData - Installation data from GitHub
   * @param {string} organizationId - Truxe organization ID (optional)
   * @returns {Promise<Object>} Stored installation
   */
  async storeInstallation(installationData, organizationId = null) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO github_app_installations (
          installation_id, account_type, account_id, account_login,
          target_type, target_id, permissions, repository_selection,
          organization_id, suspended_at, suspended_by,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
        ON CONFLICT (installation_id) DO UPDATE SET
          account_type = EXCLUDED.account_type,
          account_id = EXCLUDED.account_id,
          account_login = EXCLUDED.account_login,
          target_type = EXCLUDED.target_type,
          target_id = EXCLUDED.target_id,
          permissions = EXCLUDED.permissions,
          repository_selection = EXCLUDED.repository_selection,
          organization_id = EXCLUDED.organization_id,
          suspended_at = EXCLUDED.suspended_at,
          suspended_by = EXCLUDED.suspended_by,
          updated_at = NOW()
        RETURNING *`,
        [
          installationData.id,
          installationData.account?.type || null,
          installationData.account?.id || null,
          installationData.account?.login || null,
          installationData.target_type || null,
          installationData.target_id || null,
          JSON.stringify(installationData.permissions || {}),
          installationData.repository_selection || null,
          organizationId,
          installationData.suspended_at || null,
          installationData.suspended_by?.login || null
        ]
      );

      return this.formatInstallation(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Get installation from database
   *
   * @param {number} installationId - GitHub installation ID
   * @returns {Promise<Object|null>} Installation data
   */
  async getStoredInstallation(installationId) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM github_app_installations WHERE installation_id = $1',
        [installationId]
      );

      return result.rows.length > 0 ? this.formatInstallation(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  /**
   * Remove installation from database
   *
   * @param {number} installationId - Installation ID
   * @returns {Promise<void>}
   */
  async removeInstallation(installationId) {
    const client = await this.pool.connect();
    try {
      await client.query(
        'DELETE FROM github_app_installations WHERE installation_id = $1',
        [installationId]
      );
    } finally {
      client.release();
    }
  }

  /**
   * Cache installation token
   *
   * @param {number} installationId - Installation ID
   * @param {Object} tokenData - Token data
   * @private
   */
  async cacheInstallationToken(installationId, tokenData) {
    const client = await this.pool.connect();
    try {
      // Encrypt token if encryptor is available, otherwise use base64 (development mode)
      let encryptedToken;
      if (this.tokenEncryptor) {
        encryptedToken = this.tokenEncryptor.encrypt(tokenData.token);
      } else {
        // Fallback to base64 encoding if encryption key not available (development only)
        encryptedToken = Buffer.from(tokenData.token).toString('base64');
      }

      await client.query(
        `INSERT INTO github_app_tokens (
          installation_id, token_hash, expires_at, permissions, repository_selection, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (installation_id) DO UPDATE SET
          token_hash = EXCLUDED.token_hash,
          expires_at = EXCLUDED.expires_at,
          permissions = EXCLUDED.permissions,
          repository_selection = EXCLUDED.repository_selection,
          created_at = NOW()`,
        [
          installationId,
          encryptedToken,
          tokenData.expiresAt,
          JSON.stringify(tokenData.permissions || {}),
          tokenData.repositorySelection || null
        ]
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get cached installation token
   *
   * @param {number} installationId - Installation ID
   * @returns {Promise<Object|null>} Cached token data
   * @private
   */
  async getCachedInstallationToken(installationId) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM github_app_tokens WHERE installation_id = $1 AND expires_at > NOW()',
        [installationId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      
      // Decrypt token if encryptor is available, otherwise try base64 decode (development mode)
      let decryptedToken;
      if (this.tokenEncryptor) {
        try {
          decryptedToken = this.tokenEncryptor.decrypt(row.token_hash);
        } catch (error) {
          this.logger.error('Failed to decrypt cached installation token', {
            installationId,
            error: error.message
          });
          // Token might be stored in old format, try base64 fallback
          try {
            decryptedToken = Buffer.from(row.token_hash, 'base64').toString('utf-8');
            this.logger.warn('Using base64 fallback for installation token decryption');
          } catch {
            throw new GitHubAppError('Failed to decrypt installation token', {
              code: 'DECRYPTION_FAILED'
            });
          }
        }
      } else {
        // Fallback to base64 decoding if encryption not available (development only)
        decryptedToken = Buffer.from(row.token_hash, 'base64').toString('utf-8');
      }

      return {
        token: decryptedToken,
        expiresAt: row.expires_at,
        permissions: typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions,
        repositorySelection: row.repository_selection
      };
    } finally {
      client.release();
    }
  }

  /**
   * Format installation row from database
   *
   * @param {Object} row - Database row
   * @returns {Object} Formatted installation
   * @private
   */
  formatInstallation(row) {
    return {
      id: row.id,
      installation_id: row.installation_id,
      account: {
        type: row.account_type,
        id: row.account_id,
        login: row.account_login
      },
      target_type: row.target_type,
      target_id: row.target_id,
      permissions: typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions,
      repository_selection: row.repository_selection,
      organization_id: row.organization_id,
      suspended_at: row.suspended_at?.toISOString(),
      suspended_by: row.suspended_by,
      created_at: row.created_at?.toISOString(),
      updated_at: row.updated_at?.toISOString()
    };
  }
}

export default GitHubApp;

