/**
 * OAuth Client Service
 *
 * Manages OAuth 2.0 client applications (registration, validation, credentials).
 *
 * Database Table: oauth_clients
 * - client_id: VARCHAR(255) UNIQUE (format: cl_xxxxxxxxxxxxx)
 * - client_secret_hash: VARCHAR(255) (bcrypt hashed)
 * - client_name: VARCHAR(255)
 * - redirect_uris: TEXT[]
 * - allowed_scopes: TEXT[]
 * - require_pkce: BOOLEAN
 * - require_consent: BOOLEAN
 * - tenant_id: UUID
 * - created_by: UUID
 * - status: VARCHAR(20) ['active', 'suspended', 'revoked']
 */

import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { getPool } from '../../database/connection.js';
import {
  validateClientName,
  validateRedirectUris,
  validateUUID,
  validateScopes,
} from './validators.js';

class OAuthClientService {

  // ============================================================================
  // CLIENT REGISTRATION
  // ============================================================================

  /**
   * Register a new OAuth client application
   *
   * @param {Object} params
   * @param {string} params.clientName - Human-readable client name
   * @param {string[]} params.redirectUris - Array of allowed redirect URIs
   * @param {UUID} params.tenantId - Tenant/organization ID (optional)
   * @param {UUID} params.createdBy - User ID who created this client
   * @param {string[]} params.allowedScopes - Array of allowed OAuth scopes (default: ['openid', 'email', 'profile'])
   * @param {boolean} params.requirePkce - Require PKCE for this client (default: true)
   * @param {boolean} params.requireConsent - Require user consent (default: true)
   * @param {boolean} params.trusted - Skip consent screen (default: false)
   * @param {string} params.clientUri - Client homepage URL (optional)
   * @param {string} params.logoUri - Client logo URL (optional)
   * @param {string} params.tosUri - Terms of service URL (optional)
   * @param {string} params.policyUri - Privacy policy URL (optional)
   *
   * @returns {Promise<Object>} { client_id, client_secret, ...clientData }
   *
   * @throws {Error} If validation fails or database error
   */
  async registerClient({
    clientName,
    redirectUris,
    tenantId = null,
    createdBy,
    allowedScopes = ['openid', 'email', 'profile'],
    requirePkce = true,
    requireConsent = true,
    trusted = false,
    clientUri = null,
    logoUri = null,
    tosUri = null,
    policyUri = null,
  }) {
    // Validate inputs
    validateClientName(clientName);
    validateRedirectUris(redirectUris);
    validateUUID(createdBy, 'createdBy');
    validateScopes(allowedScopes);

    if (tenantId) {
      validateUUID(tenantId, 'tenantId');
    }

    // Generate credentials
    const clientId = this.generateClientId();
    const clientSecret = this.generateClientSecret();
    const clientSecretHash = await this.hashClientSecret(clientSecret);

    // Insert into database
    const query = `
      INSERT INTO oauth_clients (
        client_id,
        client_secret_hash,
        client_name,
        client_uri,
        logo_uri,
        tos_uri,
        policy_uri,
        redirect_uris,
        allowed_scopes,
        require_pkce,
        require_consent,
        trusted,
        tenant_id,
        created_by,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id, client_id, client_name, client_uri, logo_uri, tos_uri, policy_uri,
                redirect_uris, allowed_scopes, require_pkce, require_consent, trusted,
                tenant_id, created_by, status, created_at, updated_at
    `;

    const values = [
      clientId,
      clientSecretHash,
      clientName,
      clientUri,
      logoUri,
      tosUri,
      policyUri,
      redirectUris,
      allowedScopes,
      requirePkce,
      requireConsent,
      trusted,
      tenantId,
      createdBy,
      'active'
    ];

    const pool = getPool();
    const result = await pool.query(query, values);
    const client = result.rows[0];

    // Return client data with plain text secret (only time it's visible!)
    return {
      ...client,
      client_secret: clientSecret,
    };
  }

  // ============================================================================
  // CLIENT VALIDATION
  // ============================================================================

  /**
   * Validate client credentials
   *
   * @param {string} clientId - Client ID (format: cl_xxxxxxxxxxxxx)
   * @param {string} clientSecret - Plain text client secret (format: cs_xxxxxxxxxxxxx)
   *
   * @returns {Promise<Object|null>} Client object if valid, null if invalid
   *
   * @throws {Error} If database error
   */
  async validateClientCredentials(clientId, clientSecret) {
    const pool = getPool();
    
    // Fetch client from database
    const query = `
      SELECT id, client_id, client_secret_hash, client_name, client_uri, logo_uri,
             tos_uri, policy_uri, redirect_uris, allowed_scopes, require_pkce,
             require_consent, trusted, tenant_id, created_by, status, created_at,
             updated_at, last_used_at
      FROM oauth_clients
      WHERE client_id = $1
    `;

    const result = await pool.query(query, [clientId]);

    if (result.rows.length === 0) {
      return null;
    }

    const client = result.rows[0];

    // Verify client status is 'active'
    if (client.status !== 'active') {
      return null;
    }

    // Compare clientSecret with hashed secret
    const isValidSecret = await bcrypt.compare(clientSecret, client.client_secret_hash);

    if (!isValidSecret) {
      return null;
    }

    // Update last_used_at timestamp
    await pool.query(
      'UPDATE oauth_clients SET last_used_at = NOW() WHERE client_id = $1',
      [clientId]
    );

    // Return client object (without secret hash!)
    const { client_secret_hash, ...clientWithoutHash } = client;
    return clientWithoutHash;
  }

  /**
   * Validate redirect URI for a client
   *
   * @param {string} clientId - Client ID
   * @param {string} redirectUri - Redirect URI to validate
   *
   * @returns {Promise<boolean>} True if valid, false otherwise
   *
   * @throws {Error} If database error
   */
  async validateRedirectUri(clientId, redirectUri) {
    const pool = getPool();

    // Fetch client from database
    const query = `
      SELECT redirect_uris
      FROM oauth_clients
      WHERE client_id = $1
    `;

    const result = await pool.query(query, [clientId]);

    if (result.rows.length === 0) {
      return false;
    }

    const client = result.rows[0];

    // Check if redirectUri is in client.redirect_uris array (exact match)
    return client.redirect_uris.includes(redirectUri);
  }

  // ============================================================================
  // CLIENT RETRIEVAL
  // ============================================================================

  /**
   * Get client by ID
   *
   * @param {string} clientId - Client ID
   *
   * @returns {Promise<Object|null>} Client object or null
   */
  async getClientById(clientId) {
    const pool = getPool();

    const query = `
      SELECT id, client_id, client_name, client_uri, logo_uri, tos_uri, policy_uri,
             redirect_uris, allowed_scopes, require_pkce, require_consent, trusted,
             tenant_id, created_by, status, created_at, updated_at, last_used_at
      FROM oauth_clients
      WHERE client_id = $1
    `;

    const result = await pool.query(query, [clientId]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * List clients for a tenant/organization
   *
   * @param {UUID} tenantId - Tenant ID
   * @param {Object} options - Pagination options
   * @param {number} options.limit - Max results (default: 50)
   * @param {number} options.offset - Offset for pagination (default: 0)
   *
   * @returns {Promise<Object[]>} Array of client objects
   */
  async listClients(tenantId, { limit = 50, offset = 0 } = {}) {
    const pool = getPool();

    const query = `
      SELECT id, client_id, client_name, client_uri, logo_uri, tos_uri, policy_uri,
             redirect_uris, allowed_scopes, require_pkce, require_consent, trusted,
             tenant_id, created_by, status, created_at, updated_at, last_used_at
      FROM oauth_clients
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await pool.query(query, [tenantId, limit, offset]);
    return result.rows;
  }

  // ============================================================================
  // CLIENT MANAGEMENT
  // ============================================================================

  /**
   * Update client
   *
   * @param {string} clientId - Client ID
   * @param {Object} updates - Fields to update
   * @param {string} updates.clientName - New client name
   * @param {string[]} updates.redirectUris - New redirect URIs
   * @param {string[]} updates.allowedScopes - New allowed scopes
   * @param {boolean} updates.requirePkce - Update PKCE requirement
   * @param {boolean} updates.requireConsent - Update consent requirement
   * @param {string} updates.clientUri - Update homepage URL
   * @param {string} updates.logoUri - Update logo URL
   * @param {string} updates.tosUri - Update ToS URL
   * @param {string} updates.policyUri - Update privacy policy URL
   *
   * @returns {Promise<Object>} Updated client object
   *
   * @throws {Error} If client not found or validation fails
   */
  async updateClient(clientId, updates) {
    // Validate updates
    if (updates.clientName !== undefined) {
      validateClientName(updates.clientName);
    }

    if (updates.redirectUris !== undefined) {
      validateRedirectUris(updates.redirectUris);
    }

    if (updates.allowedScopes !== undefined) {
      validateScopes(updates.allowedScopes);
    }

    // Build dynamic UPDATE query based on provided fields
    const allowedFields = {
      clientName: 'client_name',
      redirectUris: 'redirect_uris',
      allowedScopes: 'allowed_scopes',
      requirePkce: 'require_pkce',
      requireConsent: 'require_consent',
      clientUri: 'client_uri',
      logoUri: 'logo_uri',
      tosUri: 'tos_uri',
      policyUri: 'policy_uri',
    };

    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const [jsKey, dbKey] of Object.entries(allowedFields)) {
      if (updates[jsKey] !== undefined) {
        setClauses.push(`${dbKey} = $${paramIndex}`);
        values.push(updates[jsKey]);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      throw new Error('No valid fields to update');
    }

    // Add updated_at
    setClauses.push(`updated_at = NOW()`);

    // Add clientId to values
    values.push(clientId);

    const query = `
      UPDATE oauth_clients
      SET ${setClauses.join(', ')}
      WHERE client_id = $${paramIndex}
      RETURNING id, client_id, client_name, client_uri, logo_uri, tos_uri, policy_uri,
                redirect_uris, allowed_scopes, require_pkce, require_consent, trusted,
                tenant_id, created_by, status, created_at, updated_at, last_used_at
    `;

    const pool = getPool();
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      throw new Error('Client not found');
    }

    return result.rows[0];
  }

  /**
   * Regenerate client secret
   *
   * @param {string} clientId - Client ID
   *
   * @returns {Promise<Object>} { client_id, client_secret }
   *
   * @throws {Error} If client not found
   */
  async regenerateClientSecret(clientId) {
    // Generate new client secret
    const newClientSecret = this.generateClientSecret();
    const newClientSecretHash = await this.hashClientSecret(newClientSecret);

    // Update database
    const query = `
      UPDATE oauth_clients
      SET client_secret_hash = $1, updated_at = NOW()
      WHERE client_id = $2
      RETURNING client_id
    `;

    const pool = getPool();
    const result = await pool.query(query, [newClientSecretHash, clientId]);

    if (result.rows.length === 0) {
      throw new Error('Client not found');
    }

    // Return plain text secret (only time visible!)
    return {
      client_id: clientId,
      client_secret: newClientSecret,
    };
  }

  /**
   * Suspend client (revoke access temporarily)
   *
   * @param {string} clientId - Client ID
   *
   * @returns {Promise<void>}
   */
  async suspendClient(clientId) {
    const pool = getPool();
    await pool.query(
      'UPDATE oauth_clients SET status = $1, updated_at = NOW() WHERE client_id = $2',
      ['suspended', clientId]
    );
  }

  /**
   * Activate client
   *
   * @param {string} clientId - Client ID
   *
   * @returns {Promise<void>}
   */
  async activateClient(clientId) {
    const pool = getPool();
    await pool.query(
      'UPDATE oauth_clients SET status = $1, updated_at = NOW() WHERE client_id = $2',
      ['active', clientId]
    );
  }

  /**
   * Revoke client permanently
   *
   * @param {string} clientId - Client ID
   *
   * @returns {Promise<void>}
   */
  async revokeClient(clientId) {
    const pool = getPool();
    await pool.query(
      'UPDATE oauth_clients SET status = $1, updated_at = NOW() WHERE client_id = $2',
      ['revoked', clientId]
    );
    
    // TODO: Also revoke all active tokens for this client
    // This will be implemented when we have the token service
  }

  /**
   * Delete client (hard delete)
   *
   * @param {string} clientId - Client ID
   *
   * @returns {Promise<void>}
   */
  async deleteClient(clientId) {
    const pool = getPool();
    await pool.query('DELETE FROM oauth_clients WHERE client_id = $1', [clientId]);
    // NOTE: This will cascade delete all related records (codes, tokens, consents)
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Generate client ID
   *
   * Format: cl_xxxxxxxxxxxxx (16 random chars after 'cl_')
   *
   * @returns {string} Client ID
   */
  generateClientId() {
    // Generate URL-safe base64 string
    const randomBytes = crypto.randomBytes(16); // 16 bytes for enough entropy
    const randomChars = randomBytes.toString('base64')
      .replace(/\+/g, '0')
      .replace(/\//g, '1')
      .replace(/=/g, '')
      .substring(0, 16);

    return `cl_${randomChars}`;
  }

  /**
   * Generate client secret
   *
   * Format: cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx (32 random chars after 'cs_')
   *
   * @returns {string} Client secret
   */
  generateClientSecret() {
    // Generate URL-safe base64 string
    const randomBytes = crypto.randomBytes(32); // 32 bytes for enough entropy
    const randomChars = randomBytes.toString('base64')
      .replace(/\+/g, '0')
      .replace(/\//g, '1')
      .replace(/=/g, '')
      .substring(0, 32);

    return `cs_${randomChars}`;
  }

  /**
   * Hash client secret using bcrypt
   *
   * @param {string} clientSecret - Plain text client secret
   *
   * @returns {Promise<string>} Bcrypt hash
   */
  async hashClientSecret(clientSecret) {
    return bcrypt.hash(clientSecret, 12);
  }

  /**
   * Validate client secret format
   *
   * @param {string} clientSecret - Client secret to validate
   *
   * @returns {boolean} True if valid format
   */
  validateClientSecretFormat(clientSecret) {
    return /^cs_[a-zA-Z0-9]{32}$/.test(clientSecret);
  }

  /**
   * Validate client ID format
   *
   * @param {string} clientId - Client ID to validate
   *
   * @returns {boolean} True if valid format
   */
  validateClientIdFormat(clientId) {
    return /^cl_[a-zA-Z0-9]{16}$/.test(clientId);
  }

  /**
   * Get client statistics (tokens issued, active tokens, etc.)
   *
   * @param {string} clientId - Client ID
   * @param {string} timeframe - Time window ('1h', '24h', '7d', '30d')
   *
   * @returns {Promise<Object>} Client statistics
   */
  async getClientStats(clientId, timeframe = '24h') {
    try {
      const pool = getPool();
      
      // Get token counts from database
      const tokenQuery = `
        SELECT 
          COUNT(*) as total_tokens,
          COUNT(*) FILTER (WHERE expires_at > NOW()) as active_tokens,
          MAX(created_at) as last_token_issued
        FROM oauth_provider_tokens
        WHERE client_id = $1
      `;
      
      const tokenResult = await pool.query(tokenQuery, [clientId]);
      const tokenStats = tokenResult.rows[0];
      
      // Calculate time window for recent stats
      const timeWindows = {
        '1h': '1 hour',
        '24h': '24 hours',
        '7d': '7 days',
        '30d': '30 days',
      };
      
      const recentQuery = `
        SELECT 
          COUNT(*) as tokens_generated,
          COUNT(DISTINCT refresh_token_hash) FILTER (WHERE refresh_token_hash IS NOT NULL) as tokens_refreshed
        FROM oauth_provider_tokens
        WHERE client_id = $1
          AND created_at > NOW() - INTERVAL '${timeWindows[timeframe] || '24 hours'}'
      `;
      
      const recentResult = await pool.query(recentQuery, [clientId]);
      const recentStats = recentResult.rows[0];
      
      // Get failed auth attempts from authorization codes
      const failureQuery = `
        SELECT COUNT(*) as auth_failures
        FROM oauth_authorization_codes
        WHERE client_id = $1
          AND used_at IS NULL
          AND expires_at < NOW()
          AND created_at > NOW() - INTERVAL '${timeWindows[timeframe] || '24 hours'}'
      `;
      
      const failureResult = await pool.query(failureQuery, [clientId]);
      const failureStats = failureResult.rows[0];
      
      return {
        tokensGenerated: parseInt(recentStats.tokens_generated) || 0,
        tokensRefreshed: parseInt(recentStats.tokens_refreshed) || 0,
        activeTokens: parseInt(tokenStats.active_tokens) || 0,
        totalTokens: parseInt(tokenStats.total_tokens) || 0,
        authFailures: parseInt(failureStats.auth_failures) || 0,
        lastTokenIssued: tokenStats.last_token_issued || null,
      };
    } catch (error) {
      console.error('Failed to get client stats:', error);
      // Return empty stats on error (graceful degradation)
      return {
        tokensGenerated: 0,
        tokensRefreshed: 0,
        activeTokens: 0,
        totalTokens: 0,
        authFailures: 0,
        lastTokenIssued: null,
      };
    }
  }
}

// Export singleton instance
export default new OAuthClientService();
