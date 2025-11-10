/**
 * Service Account Authentication Service
 * Handles backend-to-backend authentication for API clients
 */

import argon2 from 'argon2'
import crypto from 'crypto'

export class ServiceAccountService {
  constructor({ pool, jwt, logger, config }) {
    this.pool = pool
    this.jwt = jwt
    this.logger = logger
    this.config = config
  }

  /**
   * Authenticate service account and issue token
   * @param {string} clientId - Service account client ID
   * @param {string} clientSecret - Service account client secret
   * @param {string} tenantId - Optional tenant ID
   * @returns {Promise<{accessToken: string, expiresIn: number, scopes: string[]}>}
   */
  async authenticate({ clientId, clientSecret, tenantId = null }) {
    this.logger.info({ clientId, tenantId }, 'Service account authentication attempt')

    // Find service account
    const serviceAccount = await this.pool.query(
      `SELECT sa.*, o.slug as organization_slug
       FROM service_accounts sa
       LEFT JOIN organizations o ON sa.organization_id = o.id
       WHERE sa.client_id = $1 AND sa.enabled = true`,
      [clientId]
    )

    if (serviceAccount.rows.length === 0) {
      this.logger.warn({ clientId }, 'Service account not found or disabled')
      throw new Error('Invalid credentials')
    }

    const account = serviceAccount.rows[0]

    // Verify client secret
    const isValid = await argon2.verify(account.client_secret_hash, clientSecret)
    if (!isValid) {
      this.logger.warn({ clientId }, 'Invalid client secret')
      throw new Error('Invalid credentials')
    }

    // Generate JWT token using JWT service
    const tokenPayload = {
      userId: account.id, // For compatibility with JWT service
      type: 'service_account',
      clientId,
      organizationId: account.organization_id,
      organizationSlug: account.organization_slug,
      tenantId,
      scopes: account.scopes || [],
    }

    const tokenResult = await this.jwt.createAccessToken(tokenPayload)
    const accessToken = tokenResult.token
    const jti = tokenResult.jti // Use JTI from JWT service
    const expiresAt = tokenResult.expiresAt
    const expiresIn = tokenResult.expiresIn

    // Store token in database
    await this.pool.query(
      `INSERT INTO service_account_tokens (
        service_account_id,
        jti,
        token_hash,
        scopes,
        expires_at
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        account.id,
        jti,
        crypto.createHash('sha256').update(accessToken).digest('hex'),
        account.scopes,
        expiresAt,
      ]
    )

    // Update last used timestamp
    await this.pool.query(
      `UPDATE service_accounts SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [account.id]
    )

    this.logger.info(
      { clientId, serviceAccountId: account.id, scopes: account.scopes },
      'Service account authenticated successfully'
    )

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
      expiresAt: expiresAt.toISOString(),
      scopes: account.scopes || [],
      organizationId: account.organization_id,
      organizationSlug: account.organization_slug,
      serviceAccountId: account.id, // For logging purposes
    }
  }

  /**
   * Validate service account token
   * @param {string} jti - Token JTI
   * @returns {Promise<boolean>}
   */
  async validateToken(jti) {
    const result = await this.pool.query(
      `SELECT id FROM service_account_tokens
       WHERE jti = $1 AND expires_at > CURRENT_TIMESTAMP`,
      [jti]
    )

    return result.rows.length > 0
  }

  /**
   * Revoke service account token
   * @param {string} jti - Token JTI
   */
  async revokeToken(jti) {
    await this.pool.query(
      `DELETE FROM service_account_tokens WHERE jti = $1`,
      [jti]
    )

    this.logger.info({ jti }, 'Service account token revoked')
  }

  /**
   * Log API usage for service account
   * @param {object} params - Log parameters
   */
  async logUsage({ serviceAccountId, endpoint, method, statusCode, responseTimeMs, ipAddress, userAgent, errorMessage = null, metadata = {} }) {
    await this.pool.query(
      `INSERT INTO service_account_logs (
        service_account_id,
        endpoint,
        method,
        status_code,
        response_time_ms,
        ip_address,
        user_agent,
        error_message,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        serviceAccountId,
        endpoint,
        method,
        statusCode,
        responseTimeMs,
        ipAddress,
        userAgent,
        errorMessage,
        JSON.stringify(metadata),
      ]
    )
  }

  /**
   * Get service account by ID
   * @param {string} id - Service account ID
   * @returns {Promise<object>}
   */
  async getById(id) {
    const result = await this.pool.query(
      `SELECT sa.*, o.slug as organization_slug, o.name as organization_name
       FROM service_accounts sa
       LEFT JOIN organizations o ON sa.organization_id = o.id
       WHERE sa.id = $1`,
      [id]
    )

    if (result.rows.length === 0) {
      throw new Error('Service account not found')
    }

    const account = result.rows[0]
    delete account.client_secret_hash // Never expose secret hash

    return account
  }

  /**
   * List service accounts for organization
   * @param {string} organizationId - Organization ID
   * @returns {Promise<Array>}
   */
  async listByOrganization(organizationId) {
    const result = await this.pool.query(
      `SELECT id, name, description, client_id, scopes, enabled, rate_limit_per_minute, last_used_at, created_at
       FROM service_accounts
       WHERE organization_id = $1
       ORDER BY created_at DESC`,
      [organizationId]
    )

    return result.rows
  }

  /**
   * Get service account usage stats
   * @param {string} serviceAccountId - Service account ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<object>}
   */
  async getUsageStats(serviceAccountId, startDate, endDate) {
    const result = await this.pool.query(
      `SELECT
        COUNT(*) as total_requests,
        COUNT(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 END) as successful_requests,
        COUNT(CASE WHEN status_code >= 400 THEN 1 END) as failed_requests,
        AVG(response_time_ms) as avg_response_time_ms,
        MAX(response_time_ms) as max_response_time_ms,
        MIN(response_time_ms) as min_response_time_ms
       FROM service_account_logs
       WHERE service_account_id = $1
         AND created_at BETWEEN $2 AND $3`,
      [serviceAccountId, startDate, endDate]
    )

    return result.rows[0]
  }
}

export default ServiceAccountService
