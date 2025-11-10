/**
 * API Key Service
 *
 * Service for managing API keys and service accounts for M2M authentication.
 *
 * @module services/api-key
 */

import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { getPool } from '../database/connection.js';

/**
 * Service for managing API keys and service accounts
 */
export class ApiKeyService {
  constructor() {
    this.pool = getPool();
    this.saltRounds = 12;
  }

  /**
   * Generate a new API key
   * Format: heimdall_<env>_<type>_<identifier>_<secret>
   *
   * @param {string} environment - 'live' or 'test'
   * @param {string} keyType - 'pk' (public key) or 'sk' (secret key)
   * @returns {Object} Generated API key components
   */
  generateApiKey(environment = 'live', keyType = 'pk') {
    // Generate 8-char identifier (URL-safe)
    const identifier = this.generateIdentifier(8);

    // Generate 32-char secret (high entropy)
    const secret = this.generateSecret(32);

    // Construct full key
    const fullKey = `heimdall_${keyType}_${environment}_${identifier}_${secret}`;
    const keyPrefix = `heimdall_${keyType}_${environment}_${identifier}`;

    return {
      fullKey,        // Return to user ONCE (never stored)
      identifier,     // Stored for lookup
      keyPrefix,      // Stored for display
      secret          // Hash this before storing
    };
  }

  /**
   * Create a new service account with API key
   *
   * @param {Object} params - Service account parameters
   * @param {string} params.organizationId - Organization ID
   * @param {string} params.name - Service account name
   * @param {string} params.description - Description
   * @param {string} params.createdBy - User ID who created it
   * @param {string[]} params.permissions - Permission scopes
   * @param {string} params.environment - 'live' or 'test'
   * @returns {Promise<Object>} Created service account and API key
   */
  async createServiceAccount({
    organizationId,
    name,
    description,
    createdBy,
    permissions = [],
    environment = 'live'
  }) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Create service account
      const saResult = await client.query(`
        INSERT INTO service_accounts (organization_id, name, description, created_by)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [organizationId, name, description, createdBy]);

      const serviceAccount = saResult.rows[0];

      // 2. Generate API key
      const { fullKey, identifier, keyPrefix, secret } = this.generateApiKey(environment);

      // 3. Hash the full key
      const keyHash = await bcrypt.hash(fullKey, this.saltRounds);

      // 4. Store API key
      const apiKeyResult = await client.query(`
        INSERT INTO api_keys (
          service_account_id,
          key_identifier,
          key_hash,
          key_prefix,
          name,
          environment,
          permissions,
          created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, key_identifier, key_prefix, name, environment, permissions, created_at
      `, [
        serviceAccount.id,
        identifier,
        keyHash,
        keyPrefix,
        `${name} - API Key`,
        environment,
        JSON.stringify(permissions),
        createdBy
      ]);

      await client.query('COMMIT');

      return {
        serviceAccount,
        apiKey: {
          ...apiKeyResult.rows[0],
          fullKey // Return ONLY during creation
        }
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create additional API key for existing service account
   *
   * @param {Object} params - API key parameters
   * @returns {Promise<Object>} Created API key
   */
  async createApiKey({
    serviceAccountId,
    name,
    description,
    permissions = [],
    environment = 'live',
    expiresAt = null,
    allowedIps = null,
    rateLimitTier = 'standard',
    createdBy
  }) {
    // Generate API key
    const { fullKey, identifier, keyPrefix, secret } = this.generateApiKey(environment);

    // Hash the full key
    const keyHash = await bcrypt.hash(fullKey, this.saltRounds);

    // Store API key
    const result = await this.pool.query(`
      INSERT INTO api_keys (
        service_account_id,
        key_identifier,
        key_hash,
        key_prefix,
        name,
        description,
        environment,
        permissions,
        expires_at,
        allowed_ips,
        rate_limit_tier,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id, key_identifier, key_prefix, name, environment, permissions, created_at, expires_at
    `, [
      serviceAccountId,
      identifier,
      keyHash,
      keyPrefix,
      name,
      description,
      environment,
      JSON.stringify(permissions),
      expiresAt,
      allowedIps,
      rateLimitTier,
      createdBy
    ]);

    return {
      ...result.rows[0],
      fullKey // Return ONLY during creation
    };
  }

  /**
   * Verify API key and return service account context
   *
   * @param {string} providedKey - API key to verify
   * @param {string} clientIp - Client IP address (optional)
   * @returns {Promise<Object>} Service account context
   * @throws {Error} If API key is invalid
   */
  async verifyApiKey(providedKey, clientIp = null) {
    // Parse key format: heimdall_pk_live_2k8x9m4p_7j3n5q8r...
    const keyParts = providedKey.split('_');

    if (keyParts.length < 5 || keyParts[0] !== 'heimdall') {
      throw new Error('Invalid API key format');
    }

    const identifier = keyParts[3];

    // Lookup API key by identifier
    const result = await this.pool.query(`
      SELECT
        ak.*,
        sa.organization_id,
        sa.name as service_account_name,
        sa.status as service_account_status
      FROM api_keys ak
      JOIN service_accounts sa ON ak.service_account_id = sa.id
      WHERE ak.key_identifier = $1
    `, [identifier]);

    if (result.rows.length === 0) {
      throw new Error('API key not found');
    }

    const apiKey = result.rows[0];

    // Check status
    if (apiKey.status !== 'active') {
      throw new Error(`API key is ${apiKey.status}`);
    }

    if (apiKey.service_account_status !== 'active') {
      throw new Error('Service account is inactive');
    }

    // Check expiration
    if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
      // Auto-revoke expired keys
      await this.pool.query(`
        UPDATE api_keys SET status = 'expired' WHERE id = $1
      `, [apiKey.id]);
      throw new Error('API key has expired');
    }

    // Verify key hash
    const isValid = await bcrypt.compare(providedKey, apiKey.key_hash);

    if (!isValid) {
      throw new Error('Invalid API key');
    }

    // Check IP whitelist
    if (apiKey.allowed_ips && apiKey.allowed_ips.length > 0) {
      if (!clientIp || !apiKey.allowed_ips.includes(clientIp)) {
        throw new Error('IP address not allowed');
      }
    }

    // Update last used timestamp
    await this.pool.query(`
      UPDATE api_keys SET last_used_at = NOW() WHERE id = $1
    `, [apiKey.id]);

    // Parse permissions (handle both string and already-parsed object)
    const permissions = typeof apiKey.permissions === 'string'
      ? JSON.parse(apiKey.permissions)
      : apiKey.permissions || [];

    return {
      apiKeyId: apiKey.id,
      serviceAccountId: apiKey.service_account_id,
      serviceAccountName: apiKey.service_account_name,
      organizationId: apiKey.organization_id,
      permissions,
      rateLimitTier: apiKey.rate_limit_tier,
      environment: apiKey.environment
    };
  }

  /**
   * Check if API key has specific permission
   *
   * @param {string[]} permissions - API key permissions
   * @param {string} requiredPermission - Required permission to check
   * @returns {boolean} Whether permission is granted
   */
  hasPermission(permissions, requiredPermission) {
    // Admin wildcard
    if (permissions.includes('*')) {
      return true;
    }

    // Exact match
    if (permissions.includes(requiredPermission)) {
      return true;
    }

    // Wildcard matching (e.g., 'users:*' matches 'users:read')
    const wildcardMatch = permissions.find(perm => {
      if (perm.endsWith(':*')) {
        const prefix = perm.slice(0, -2);
        return requiredPermission.startsWith(prefix + ':');
      }
      return false;
    });

    return !!wildcardMatch;
  }

  /**
   * Revoke API key
   *
   * @param {string} apiKeyId - API key ID
   * @param {string} revokedBy - User ID who revoked it
   * @param {string} reason - Reason for revocation
   * @returns {Promise<Object>} Revoked API key
   */
  async revokeApiKey(apiKeyId, revokedBy, reason = null) {
    const result = await this.pool.query(`
      UPDATE api_keys
      SET
        status = 'revoked',
        revoked_at = NOW(),
        revoked_by = $2,
        revoke_reason = $3
      WHERE id = $1
      RETURNING *
    `, [apiKeyId, revokedBy, reason]);

    return result.rows[0];
  }

  /**
   * Log API key usage
   *
   * @param {Object} params - Usage log parameters
   * @returns {Promise<void>}
   */
  async logUsage({
    apiKeyId,
    endpoint,
    method,
    statusCode,
    responseTimeMs,
    ipAddress,
    userAgent,
    requestId,
    errorMessage = null
  }) {
    await this.pool.query(`
      INSERT INTO api_key_usage (
        api_key_id,
        endpoint,
        method,
        status_code,
        response_time_ms,
        ip_address,
        user_agent,
        request_id,
        error_message
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      apiKeyId,
      endpoint,
      method,
      statusCode,
      responseTimeMs,
      ipAddress,
      userAgent,
      requestId,
      errorMessage
    ]);
  }

  /**
   * Get API key usage statistics
   *
   * @param {string} apiKeyId - API key ID
   * @param {string} timeRange - Time range ('24h', '7d', '30d')
   * @returns {Promise<Object[]>} Usage statistics
   */
  async getUsageStats(apiKeyId, timeRange = '7d') {
    const interval = timeRange === '24h' ? '1 hour' :
                     timeRange === '7d' ? '1 day' : '1 day';

    const result = await this.pool.query(`
      SELECT
        DATE_TRUNC($1, timestamp) as bucket,
        COUNT(*) as request_count,
        AVG(response_time_ms) as avg_response_time,
        COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count
      FROM api_key_usage
      WHERE api_key_id = $2
        AND timestamp > NOW() - $3::interval
      GROUP BY bucket
      ORDER BY bucket DESC
    `, [interval, apiKeyId, timeRange]);

    return result.rows;
  }

  /**
   * Generate random identifier (URL-safe)
   *
   * @param {number} length - Length of identifier
   * @returns {string} Random identifier
   */
  generateIdentifier(length) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const bytes = crypto.randomBytes(length);

    for (let i = 0; i < length; i++) {
      result += chars[bytes[i] % chars.length];
    }

    return result;
  }

  /**
   * Generate random secret (high entropy)
   *
   * @param {number} length - Length of secret
   * @returns {string} Random secret
   */
  generateSecret(length) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const bytes = crypto.randomBytes(length);

    for (let i = 0; i < length; i++) {
      result += chars[bytes[i] % chars.length];
    }

    return result;
  }

  /**
   * List all API keys for service account
   *
   * @param {string} serviceAccountId - Service account ID
   * @returns {Promise<Object[]>} List of API keys
   */
  async listApiKeys(serviceAccountId) {
    const result = await this.pool.query(`
      SELECT
        id,
        key_prefix,
        name,
        description,
        environment,
        permissions,
        status,
        created_at,
        last_used_at,
        expires_at,
        rate_limit_tier
      FROM api_keys
      WHERE service_account_id = $1
      ORDER BY created_at DESC
    `, [serviceAccountId]);

    return result.rows;
  }

  /**
   * List all service accounts for organization
   *
   * @param {string} organizationId - Organization ID
   * @returns {Promise<Object[]>} List of service accounts
   */
  async listServiceAccounts(organizationId) {
    const result = await this.pool.query(`
      SELECT
        sa.*,
        COUNT(ak.id) as api_key_count,
        MAX(ak.last_used_at) as last_used_at
      FROM service_accounts sa
      LEFT JOIN api_keys ak ON sa.id = ak.service_account_id AND ak.status = 'active'
      WHERE sa.organization_id = $1
      GROUP BY sa.id
      ORDER BY sa.created_at DESC
    `, [organizationId]);

    return result.rows;
  }
}

export default new ApiKeyService();
