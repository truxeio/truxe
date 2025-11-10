/**
 * API Keys Routes
 *
 * API endpoints for service account and API key management.
 * Includes CRUD operations, key rotation, analytics, and audit logs.
 *
 * @module routes/api-keys
 */

import apiKeyService from '../services/api-key.js';
import db from '../database/connection.js';

export default async function apiKeysRoutes(fastify, options) {

  // Helper to call authenticateApiKey decorator
  const authenticateApiKeyHook = async function(request, reply) {
    if (fastify.authenticateApiKey) {
      return await fastify.authenticateApiKey.call(this, request, reply);
    }
    throw new Error('authenticateApiKey decorator not available');
  };

  // ============================================================================
  // API Key Testing
  // ============================================================================

  /**
   * GET /api/api-keys/test
   * Test API key authentication
   */
  fastify.get('/api-keys/test', {
    onRequest: authenticateApiKeyHook,
    schema: {
      description: 'Test API key authentication',
      tags: ['API Keys'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            serviceAccount: { type: 'object' },
            permissions: { type: 'array' },
            environment: { type: 'string' },
            rateLimitTier: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    return reply.send({
      success: true,
      message: 'API key is valid ✅',
      serviceAccount: {
        id: request.serviceAccount.serviceAccountId,
        name: request.serviceAccount.serviceAccountName,
        organizationId: request.serviceAccount.organizationId
      },
      permissions: request.serviceAccount.permissions,
      environment: request.serviceAccount.environment,
      rateLimitTier: request.serviceAccount.rateLimitTier
    });
  });

  // ============================================================================
  // Service Account Management (Requires User Authentication)
  // ============================================================================

  /**
   * POST /api/service-accounts
   * Create a new service account with initial API key
   */
  fastify.post('/service-accounts', {
    onRequest: async (request, reply) => {
      await fastify.authenticate(request, reply);
    },
    schema: {
      description: 'Create a new service account',
      tags: ['Service Accounts'],
      body: {
        type: 'object',
        required: ['organizationId', 'name'],
        properties: {
          organizationId: { type: 'string', format: 'uuid' },
          name: { type: 'string', minLength: 1, maxLength: 255 },
          description: { type: 'string', maxLength: 1000 },
          permissions: { type: 'array', items: { type: 'string' } },
          rateLimitTier: { type: 'string', enum: ['standard', 'high', 'unlimited'] },
          environment: { type: 'string', enum: ['test', 'live'], default: 'live' }
        }
      }
    }
  }, async (request, reply) => {
    const { organizationId, name, description, permissions, rateLimitTier, environment } = request.body;

    // Verify user has access to organization
    const memberCheck = await db.query(
      `SELECT role FROM memberships WHERE organization_id = $1 AND user_id = $2`,
      [organizationId, request.user.id]
    );

    if (memberCheck.rows.length === 0) {
      return reply.code(403).send({ error: 'Forbidden', message: 'Not a member of this organization' });
    }

    // Only owners and admins can create service accounts
    if (!['owner', 'admin'].includes(memberCheck.rows[0].role)) {
      return reply.code(403).send({ error: 'Forbidden', message: 'Insufficient permissions' });
    }

    const result = await apiKeyService.createServiceAccount({
      organizationId,
      name,
      description,
      permissions: permissions || [],
      rateLimitTier: rateLimitTier || 'standard',
      environment: environment || 'live',
      createdBy: request.user.id
    });

    return reply.code(201).send({
      serviceAccount: result.serviceAccount,
      apiKey: {
        id: result.apiKey.id,
        keyPrefix: result.apiKey.keyPrefix,
        fullKey: result.apiKey.fullKey,
        name: result.apiKey.name,
        environment: result.apiKey.environment,
        permissions: result.apiKey.permissions,
        rateLimitTier: result.apiKey.rateLimitTier,
        warning: 'Store this API key securely. It will not be shown again.'
      }
    });
  });

  /**
   * GET /api/service-accounts
   * List all service accounts for an organization
   */
  fastify.get('/service-accounts', {
    onRequest: async (request, reply) => {
      await fastify.authenticate(request, reply);
    },
    schema: {
      description: 'List service accounts for an organization',
      tags: ['Service Accounts'],
      querystring: {
        type: 'object',
        required: ['organizationId'],
        properties: {
          organizationId: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async (request, reply) => {
    const { organizationId } = request.query;

    // Verify membership
    const memberCheck = await db.query(
      `SELECT 1 FROM memberships WHERE organization_id = $1 AND user_id = $2`,
      [organizationId, request.user.id]
    );

    if (memberCheck.rows.length === 0) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const result = await db.query(`
      SELECT
        sa.id,
        sa.name,
        sa.description,
        sa.status,
        sa.created_at,
        sa.updated_at,
        COUNT(ak.id) as api_key_count,
        MAX(ak.last_used_at) as last_used_at
      FROM service_accounts sa
      LEFT JOIN api_keys ak ON sa.id = ak.service_account_id AND ak.status = 'active'
      WHERE sa.organization_id = $1
      GROUP BY sa.id
      ORDER BY sa.created_at DESC
    `, [organizationId]);

    return reply.send({ serviceAccounts: result.rows });
  });

  /**
   * GET /api/service-accounts/:id
   * Get service account details
   */
  fastify.get('/service-accounts/:id', {
    onRequest: async (request, reply) => {
      await fastify.authenticate(request, reply);
    },
    schema: {
      description: 'Get service account details',
      tags: ['Service Accounts'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params;

    const result = await db.query(`
      SELECT sa.*, u.email as created_by_email
      FROM service_accounts sa
      LEFT JOIN users u ON sa.created_by = u.id
      WHERE sa.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'Not Found' });
    }

    const serviceAccount = result.rows[0];

    // Verify membership
    const memberCheck = await db.query(
      `SELECT 1 FROM memberships WHERE organization_id = $1 AND user_id = $2`,
      [serviceAccount.organization_id, request.user.id]
    );

    if (memberCheck.rows.length === 0) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    return reply.send({ serviceAccount });
  });

  /**
   * PATCH /api/service-accounts/:id
   * Update service account
   */
  fastify.patch('/service-accounts/:id', {
    onRequest: async (request, reply) => {
      await fastify.authenticate(request, reply);
    },
    schema: {
      description: 'Update service account',
      tags: ['Service Accounts'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          description: { type: 'string', maxLength: 1000 },
          status: { type: 'string', enum: ['active', 'suspended'] }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params;
    const { name, description, status } = request.body;

    // Get service account
    const saResult = await db.query(`SELECT organization_id FROM service_accounts WHERE id = $1`, [id]);
    if (saResult.rows.length === 0) {
      return reply.code(404).send({ error: 'Not Found' });
    }

    // Verify admin access
    const memberCheck = await db.query(
      `SELECT role FROM memberships WHERE organization_id = $1 AND user_id = $2`,
      [saResult.rows[0].organization_id, request.user.id]
    );

    if (memberCheck.rows.length === 0 || !['owner', 'admin'].includes(memberCheck.rows[0].role)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }

    if (updates.length > 0) {
      updates.push(`updated_at = NOW()`);
      values.push(id);

      await db.query(
        `UPDATE service_accounts SET ${updates.join(', ')} WHERE id = $${paramCount}`,
        values
      );
    }

    return reply.send({ success: true });
  });

  /**
   * DELETE /api/service-accounts/:id
   * Delete service account (will cascade delete all API keys)
   */
  fastify.delete('/service-accounts/:id', {
    onRequest: async (request, reply) => {
      await fastify.authenticate(request, reply);
    },
    schema: {
      description: 'Delete service account',
      tags: ['Service Accounts']
    }
  }, async (request, reply) => {
    const { id } = request.params;

    const saResult = await db.query(`SELECT organization_id FROM service_accounts WHERE id = $1`, [id]);
    if (saResult.rows.length === 0) {
      return reply.code(404).send({ error: 'Not Found' });
    }

    // Verify owner/admin access
    const memberCheck = await db.query(
      `SELECT role FROM memberships WHERE organization_id = $1 AND user_id = $2`,
      [saResult.rows[0].organization_id, request.user.id]
    );

    if (memberCheck.rows.length === 0 || !['owner', 'admin'].includes(memberCheck.rows[0].role)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    await db.query(`DELETE FROM service_accounts WHERE id = $1`, [id]);

    return reply.code(204).send();
  });

  // ============================================================================
  // API Key Management
  // ============================================================================

  /**
   * GET /api/service-accounts/:id/keys
   * List all API keys for a service account
   */
  fastify.get('/service-accounts/:id/keys', {
    onRequest: async (request, reply) => {
      await fastify.authenticate(request, reply);
    },
    schema: {
      description: 'List API keys for a service account',
      tags: ['API Keys']
    }
  }, async (request, reply) => {
    const { id } = request.params;

    // Get service account and verify access
    const saResult = await db.query(`SELECT organization_id FROM service_accounts WHERE id = $1`, [id]);
    if (saResult.rows.length === 0) {
      return reply.code(404).send({ error: 'Not Found' });
    }

    const memberCheck = await db.query(
      `SELECT 1 FROM memberships WHERE organization_id = $1 AND user_id = $2`,
      [saResult.rows[0].organization_id, request.user.id]
    );

    if (memberCheck.rows.length === 0) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const result = await db.query(`
      SELECT
        id,
        key_prefix,
        name,
        environment,
        permissions,
        rate_limit_tier,
        status,
        last_used_at,
        expires_at,
        created_at
      FROM api_keys
      WHERE service_account_id = $1
      ORDER BY created_at DESC
    `, [id]);

    return reply.send({ apiKeys: result.rows });
  });

  /**
   * POST /api/service-accounts/:id/keys
   * Create a new API key for service account
   */
  fastify.post('/service-accounts/:id/keys', {
    onRequest: async (request, reply) => {
      await fastify.authenticate(request, reply);
    },
    schema: {
      description: 'Create new API key',
      tags: ['API Keys'],
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          environment: { type: 'string', enum: ['test', 'live'] },
          permissions: { type: 'array', items: { type: 'string' } },
          rateLimitTier: { type: 'string', enum: ['standard', 'high', 'unlimited'] },
          expiresInDays: { type: 'integer', minimum: 1, maximum: 365 }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params;
    const { name, environment, permissions, rateLimitTier, expiresInDays } = request.body;

    // Verify access
    const saResult = await db.query(`SELECT organization_id FROM service_accounts WHERE id = $1`, [id]);
    if (saResult.rows.length === 0) {
      return reply.code(404).send({ error: 'Not Found' });
    }

    const memberCheck = await db.query(
      `SELECT role FROM memberships WHERE organization_id = $1 AND user_id = $2`,
      [saResult.rows[0].organization_id, request.user.id]
    );

    if (memberCheck.rows.length === 0 || !['owner', 'admin'].includes(memberCheck.rows[0].role)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    // Generate new API key
    const { fullKey, identifier, keyPrefix, secret } = apiKeyService.generateApiKey(
      environment || 'live',
      'pk'
    );

    const keyHash = await apiKeyService.hashApiKey(secret);
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const result = await db.query(`
      INSERT INTO api_keys (
        service_account_id,
        key_identifier,
        key_hash,
        key_prefix,
        name,
        environment,
        permissions,
        rate_limit_tier,
        expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, key_prefix, name, environment, permissions, rate_limit_tier, created_at
    `, [
      id,
      identifier,
      keyHash,
      keyPrefix,
      name,
      environment || 'live',
      JSON.stringify(permissions || []),
      rateLimitTier || 'standard',
      expiresAt
    ]);

    return reply.code(201).send({
      apiKey: {
        ...result.rows[0],
        fullKey,
        warning: 'Store this API key securely. It will not be shown again.'
      }
    });
  });

  /**
   * POST /api/api-keys/:keyId/rotate
   * Rotate an API key (creates new key, marks old as rotated)
   */
  fastify.post('/api-keys/:keyId/rotate', {
    onRequest: async (request, reply) => {
      await fastify.authenticate(request, reply);
    },
    schema: {
      description: 'Rotate API key',
      tags: ['API Keys'],
      params: {
        type: 'object',
        properties: {
          keyId: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async (request, reply) => {
    const { keyId } = request.params;

    // Get existing key
    const keyResult = await db.query(`
      SELECT ak.*, sa.organization_id
      FROM api_keys ak
      JOIN service_accounts sa ON ak.service_account_id = sa.id
      WHERE ak.id = $1
    `, [keyId]);

    if (keyResult.rows.length === 0) {
      return reply.code(404).send({ error: 'Not Found' });
    }

    const oldKey = keyResult.rows[0];

    // Verify access
    const memberCheck = await db.query(
      `SELECT role FROM memberships WHERE organization_id = $1 AND user_id = $2`,
      [oldKey.organization_id, request.user.id]
    );

    if (memberCheck.rows.length === 0 || !['owner', 'admin'].includes(memberCheck.rows[0].role)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    // Generate new key
    const { fullKey, identifier, keyPrefix, secret } = apiKeyService.generateApiKey(
      oldKey.environment,
      'pk'
    );

    const keyHash = await apiKeyService.hashApiKey(secret);

    // Start transaction
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Mark old key as rotated
      await client.query(`
        UPDATE api_keys
        SET status = 'rotated', updated_at = NOW()
        WHERE id = $1
      `, [keyId]);

      // Create new key with same settings
      const result = await client.query(`
        INSERT INTO api_keys (
          service_account_id,
          key_identifier,
          key_hash,
          key_prefix,
          name,
          environment,
          permissions,
          rate_limit_tier,
          expires_at,
          ip_whitelist
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, key_prefix, name, environment, permissions, rate_limit_tier, created_at
      `, [
        oldKey.service_account_id,
        identifier,
        keyHash,
        keyPrefix,
        `${oldKey.name} (rotated)`,
        oldKey.environment,
        oldKey.permissions,
        oldKey.rate_limit_tier,
        oldKey.expires_at,
        oldKey.ip_whitelist
      ]);

      await client.query('COMMIT');

      return reply.send({
        apiKey: {
          ...result.rows[0],
          fullKey,
          warning: 'Store this API key securely. The old key is now inactive.'
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  /**
   * DELETE /api/api-keys/:keyId
   * Revoke/delete an API key
   */
  fastify.delete('/api-keys/:keyId', {
    onRequest: async (request, reply) => {
      await fastify.authenticate(request, reply);
    },
    schema: {
      description: 'Revoke API key',
      tags: ['API Keys']
    }
  }, async (request, reply) => {
    const { keyId } = request.params;

    const keyResult = await db.query(`
      SELECT ak.*, sa.organization_id
      FROM api_keys ak
      JOIN service_accounts sa ON ak.service_account_id = sa.id
      WHERE ak.id = $1
    `, [keyId]);

    if (keyResult.rows.length === 0) {
      return reply.code(404).send({ error: 'Not Found' });
    }

    const memberCheck = await db.query(
      `SELECT role FROM memberships WHERE organization_id = $1 AND user_id = $2`,
      [keyResult.rows[0].organization_id, request.user.id]
    );

    if (memberCheck.rows.length === 0 || !['owner', 'admin'].includes(memberCheck.rows[0].role)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    await db.query(`UPDATE api_keys SET status = 'revoked', updated_at = NOW() WHERE id = $1`, [keyId]);

    return reply.code(204).send();
  });

  // ============================================================================
  // Usage Analytics
  // ============================================================================

  /**
   * GET /api/service-accounts/:id/analytics
   * Get usage analytics for service account
   */
  fastify.get('/service-accounts/:id/analytics', {
    onRequest: async (request, reply) => {
      await fastify.authenticate(request, reply);
    },
    schema: {
      description: 'Get service account usage analytics',
      tags: ['Analytics'],
      querystring: {
        type: 'object',
        properties: {
          days: { type: 'integer', minimum: 1, maximum: 90, default: 7 }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params;
    const { days = 7 } = request.query;

    // Verify access
    const saResult = await db.query(`SELECT organization_id FROM service_accounts WHERE id = $1`, [id]);
    if (saResult.rows.length === 0) {
      return reply.code(404).send({ error: 'Not Found' });
    }

    const memberCheck = await db.query(
      `SELECT 1 FROM memberships WHERE organization_id = $1 AND user_id = $2`,
      [saResult.rows[0].organization_id, request.user.id]
    );

    if (memberCheck.rows.length === 0) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    // Get usage stats
    const usageResult = await db.query(`
      SELECT
        DATE(timestamp) as date,
        COUNT(*) as total_requests,
        COUNT(DISTINCT endpoint) as unique_endpoints,
        AVG(response_time_ms) as avg_response_time,
        COUNT(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 END) as successful_requests,
        COUNT(CASE WHEN status_code >= 400 THEN 1 END) as failed_requests
      FROM api_key_usage aku
      JOIN api_keys ak ON aku.api_key_id = ak.id
      WHERE ak.service_account_id = $1
        AND timestamp >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE(timestamp)
      ORDER BY date DESC
    `, [id]);

    // Get top endpoints
    const endpointsResult = await db.query(`
      SELECT
        endpoint,
        method,
        COUNT(*) as request_count,
        AVG(response_time_ms) as avg_response_time
      FROM api_key_usage aku
      JOIN api_keys ak ON aku.api_key_id = ak.id
      WHERE ak.service_account_id = $1
        AND timestamp >= NOW() - INTERVAL '${days} days'
      GROUP BY endpoint, method
      ORDER BY request_count DESC
      LIMIT 10
    `, [id]);

    // Get status code distribution
    const statusResult = await db.query(`
      SELECT
        status_code,
        COUNT(*) as count
      FROM api_key_usage aku
      JOIN api_keys ak ON aku.api_key_id = ak.id
      WHERE ak.service_account_id = $1
        AND timestamp >= NOW() - INTERVAL '${days} days'
      GROUP BY status_code
      ORDER BY count DESC
    `, [id]);

    return reply.send({
      analytics: {
        dailyUsage: usageResult.rows,
        topEndpoints: endpointsResult.rows,
        statusCodes: statusResult.rows
      }
    });
  });

  /**
   * GET /api/api-keys/:keyId/analytics
   * Get usage analytics for specific API key
   */
  fastify.get('/api-keys/:keyId/analytics', {
    onRequest: async (request, reply) => {
      await fastify.authenticate(request, reply);
    },
    schema: {
      description: 'Get API key usage analytics',
      tags: ['Analytics'],
      querystring: {
        type: 'object',
        properties: {
          days: { type: 'integer', minimum: 1, maximum: 90, default: 7 }
        }
      }
    }
  }, async (request, reply) => {
    const { keyId } = request.params;
    const { days = 7 } = request.query;

    // Verify access
    const keyResult = await db.query(`
      SELECT ak.*, sa.organization_id
      FROM api_keys ak
      JOIN service_accounts sa ON ak.service_account_id = sa.id
      WHERE ak.id = $1
    `, [keyId]);

    if (keyResult.rows.length === 0) {
      return reply.code(404).send({ error: 'Not Found' });
    }

    const memberCheck = await db.query(
      `SELECT 1 FROM memberships WHERE organization_id = $1 AND user_id = $2`,
      [keyResult.rows[0].organization_id, request.user.id]
    );

    if (memberCheck.rows.length === 0) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const usageResult = await db.query(`
      SELECT
        DATE(timestamp) as date,
        COUNT(*) as total_requests,
        AVG(response_time_ms) as avg_response_time,
        COUNT(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 END) as successful_requests,
        COUNT(CASE WHEN status_code >= 400 THEN 1 END) as failed_requests
      FROM api_key_usage
      WHERE api_key_id = $1
        AND timestamp >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE(timestamp)
      ORDER BY date DESC
    `, [keyId]);

    return reply.send({ analytics: { dailyUsage: usageResult.rows } });
  });

  // ============================================================================
  // Audit Logs
  // ============================================================================

  /**
   * GET /api/service-accounts/:id/audit-log
   * Get audit log for service account
   */
  fastify.get('/service-accounts/:id/audit-log', {
    onRequest: async (request, reply) => {
      await fastify.authenticate(request, reply);
    },
    schema: {
      description: 'Get service account audit log',
      tags: ['Audit'],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 1000, default: 100 },
          offset: { type: 'integer', minimum: 0, default: 0 }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params;
    const { limit = 100, offset = 0 } = request.query;

    // Verify access
    const saResult = await db.query(`SELECT organization_id FROM service_accounts WHERE id = $1`, [id]);
    if (saResult.rows.length === 0) {
      return reply.code(404).send({ error: 'Not Found' });
    }

    const memberCheck = await db.query(
      `SELECT 1 FROM memberships WHERE organization_id = $1 AND user_id = $2`,
      [saResult.rows[0].organization_id, request.user.id]
    );

    if (memberCheck.rows.length === 0) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const auditResult = await db.query(`
      SELECT
        aku.timestamp,
        aku.endpoint,
        aku.method,
        aku.status_code,
        aku.response_time_ms,
        ak.key_prefix,
        ak.name as api_key_name
      FROM api_key_usage aku
      JOIN api_keys ak ON aku.api_key_id = ak.id
      WHERE ak.service_account_id = $1
      ORDER BY aku.timestamp DESC
      LIMIT $2 OFFSET $3
    `, [id, limit, offset]);

    const countResult = await db.query(`
      SELECT COUNT(*)
      FROM api_key_usage aku
      JOIN api_keys ak ON aku.api_key_id = ak.id
      WHERE ak.service_account_id = $1
    `, [id]);

    return reply.send({
      auditLog: auditResult.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        limit,
        offset
      }
    });
  });

  /**
   * GET /api/api-keys/:keyId/audit-log
   * Get audit log for specific API key
   */
  fastify.get('/api-keys/:keyId/audit-log', {
    onRequest: async (request, reply) => {
      await fastify.authenticate(request, reply);
    },
    schema: {
      description: 'Get API key audit log',
      tags: ['Audit'],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 1000, default: 100 },
          offset: { type: 'integer', minimum: 0, default: 0 },
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' }
        }
      }
    }
  }, async (request, reply) => {
    const { keyId } = request.params;
    const { limit = 100, offset = 0, startDate, endDate } = request.query;

    // Verify access
    const keyResult = await db.query(`
      SELECT ak.*, sa.organization_id
      FROM api_keys ak
      JOIN service_accounts sa ON ak.service_account_id = sa.id
      WHERE ak.id = $1
    `, [keyId]);

    if (keyResult.rows.length === 0) {
      return reply.code(404).send({ error: 'Not Found' });
    }

    const memberCheck = await db.query(
      `SELECT 1 FROM memberships WHERE organization_id = $1 AND user_id = $2`,
      [keyResult.rows[0].organization_id, request.user.id]
    );

    if (memberCheck.rows.length === 0) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    let query = `
      SELECT
        timestamp,
        endpoint,
        method,
        status_code,
        response_time_ms
      FROM api_key_usage
      WHERE api_key_id = $1
    `;

    const params = [keyId];
    let paramCount = 2;

    if (startDate) {
      query += ` AND timestamp >= $${paramCount++}`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND timestamp <= $${paramCount++}`;
      params.push(endDate);
    }

    query += ` ORDER BY timestamp DESC LIMIT $${paramCount++} OFFSET $${paramCount}`;
    params.push(limit, offset);

    const auditResult = await db.query(query, params);

    const countQuery = `
      SELECT COUNT(*)
      FROM api_key_usage
      WHERE api_key_id = $1
      ${startDate ? `AND timestamp >= $2` : ''}
      ${endDate ? `AND timestamp <= $${startDate ? 3 : 2}` : ''}
    `;

    const countParams = [keyId];
    if (startDate) countParams.push(startDate);
    if (endDate) countParams.push(endDate);

    const countResult = await db.query(countQuery, countParams);

    return reply.send({
      auditLog: auditResult.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        limit,
        offset
      }
    });
  });
}
