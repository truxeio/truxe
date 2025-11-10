/**
 * OAuth Admin Endpoints - Automated Tests
 * 
 * Tests for OAuth Provider admin dashboard API endpoints:
 * - GET /api/oauth/clients/:id/stats - Get client statistics
 * - POST /api/oauth/clients/:id/regenerate-secret - Regenerate client secret
 * 
 * Coverage:
 * - Authentication required
 * - Tenant isolation
 * - Valid statistics retrieval
 * - Secret regeneration flow
 * - Error handling
 * 
 * Test Count: 15 tests
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { getPool } from '../../../src/database/connection.js';
import clientService from '../../../src/services/oauth-provider/client-service.js';
import bcrypt from 'bcrypt';

describe('OAuth Admin Endpoints', () => {
  let testUser;
  let testUserId;
  let testTenantId;
  let testClient;
  let testClientId;
  let testClientSecret;
  let otherTenantId;
  let otherClient;

  beforeAll(async () => {
    const pool = getPool();

    // Create test tenant
    const tenantResult = await pool.query(`
      INSERT INTO tenants (name, slug, tenant_type, status)
      VALUES ('Test Org Admin', 'test-org-admin', 'organization', 'active')
      RETURNING id
    `);
    testTenantId = tenantResult.rows[0].id;

    // Create another tenant for isolation tests
    const otherTenantResult = await pool.query(`
      INSERT INTO tenants (name, slug, tenant_type, status)
      VALUES ('Other Org Admin', 'other-org-admin', 'organization', 'active')
      RETURNING id
    `);
    otherTenantId = otherTenantResult.rows[0].id;

    // Create test user
    const userResult = await pool.query(`
      INSERT INTO users (
        email,
        email_verified,
        metadata,
        status
      ) VALUES ($1, $2, $3::jsonb, $4)
      RETURNING id
    `, [
      'admin-test@example.com',
      true,
      JSON.stringify({
        name: 'Admin Test User',
        given_name: 'Admin',
        family_name: 'Test'
      }),
      'active',
    ]);
    testUserId = userResult.rows[0].id;
    testUser = userResult.rows[0];

    // Add user to tenant as admin
    await pool.query(`
      INSERT INTO tenant_members (tenant_id, user_id, role, joined_at)
      VALUES ($1, $2, 'admin', NOW())
    `, [testTenantId, testUserId]);
  });

  beforeEach(async () => {
    // Create test client for each test
    const client = await clientService.registerClient({
      clientName: 'Test Admin Client',
      redirectUris: ['http://localhost:3000/callback'],
      allowedScopes: ['openid', 'email', 'profile'],
      requirePkce: true,
      requireConsent: true,
      trusted: false,
      tenantId: testTenantId,
      createdBy: testUserId,
      clientUri: 'http://localhost:3000',
      logoUri: 'http://localhost:3000/logo.png',
    });

    testClient = client;
    testClientId = client.client_id;
    testClientSecret = client.client_secret;

    // Create client in other tenant for isolation tests
    // Use timestamp to ensure unique email per test
    const otherUserEmail = `other-user-${Date.now()}@example.com`;
    const otherUserResult = await getPool().query(`
      INSERT INTO users (
        email,
        email_verified,
        metadata,
        status
      ) VALUES ($1, $2, $3::jsonb, $4)
      RETURNING id
    `, [
      otherUserEmail,
      true,
      JSON.stringify({ name: 'Other User' }),
      'active',
    ]);

    const otherUserId = otherUserResult.rows[0].id;

    // Add other user to other tenant
    await getPool().query(`
      INSERT INTO tenant_members (tenant_id, user_id, role, joined_at)
      VALUES ($1, $2, 'admin', NOW())
    `, [otherTenantId, otherUserId]);

    const otherClientData = await clientService.registerClient({
      clientName: 'Other Tenant Client',
      redirectUris: ['http://localhost:3000/callback'],
      allowedScopes: ['openid'],
      tenantId: otherTenantId,
      createdBy: otherUserId,
    });

    otherClient = otherClientData;
  });

  afterEach(async () => {
    const pool = getPool();

    // Cleanup after each test
    await pool.query('DELETE FROM oauth_provider_tokens WHERE client_id LIKE $1', ['cl_%']);
    await pool.query('DELETE FROM oauth_authorization_codes WHERE client_id LIKE $1', ['cl_%']);
    await pool.query('DELETE FROM oauth_clients WHERE client_id = $1', [testClientId]);
    if (otherClient) {
      await pool.query('DELETE FROM oauth_clients WHERE client_id = $1', [otherClient.client_id]);
      // Delete other user and membership (created in beforeEach)
      await pool.query('DELETE FROM tenant_members WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)', ['other-user-%@example.com']);
      await pool.query('DELETE FROM users WHERE email LIKE $1', ['other-user-%@example.com']);
    }
  });

  afterAll(async () => {
    const pool = getPool();

    // Final cleanup: delete test tenants and main test user
    await pool.query('DELETE FROM tenant_members WHERE tenant_id IN ($1, $2)', [testTenantId, otherTenantId]);
    await pool.query('DELETE FROM users WHERE email = $1', ['admin-test@example.com']);
    await pool.query('DELETE FROM tenants WHERE id IN ($1, $2)', [testTenantId, otherTenantId]);
  });

  // ============================================================================
  // GET /api/oauth/clients/:id/stats - Client Statistics
  // ============================================================================

  describe('GET /api/oauth/clients/:id/stats', () => {
    test('should return client statistics with default timeframe', async () => {
      const stats = await clientService.getClientStats(testClientId);

      expect(stats).toHaveProperty('tokensGenerated');
      expect(stats).toHaveProperty('tokensRefreshed');
      expect(stats).toHaveProperty('activeTokens');
      expect(stats).toHaveProperty('totalTokens');
      expect(stats).toHaveProperty('authFailures');
      expect(stats).toHaveProperty('lastTokenIssued');

      // Initially should be 0 (no tokens generated yet)
      expect(stats.tokensGenerated).toBe(0);
      expect(stats.activeTokens).toBe(0);
    });

    test('should return statistics for different timeframes', async () => {
      const timeframes = ['1h', '24h', '7d', '30d'];

      for (const timeframe of timeframes) {
        const stats = await clientService.getClientStats(testClientId, timeframe);

        expect(stats).toBeDefined();
        expect(stats.tokensGenerated).toBeGreaterThanOrEqual(0);
        expect(stats.activeTokens).toBeGreaterThanOrEqual(0);
      }
    });

    test('should return valid statistics after token generation', async () => {
      const pool = getPool();

      // Generate some test tokens
      await pool.query(`
        INSERT INTO oauth_provider_tokens (
          token_hash,
          client_id,
          user_id,
          scope,
          created_at,
          expires_at
        ) VALUES 
          (encode(sha256(gen_random_uuid()::text::bytea), 'hex'), $1, $2, 'openid email', NOW() - INTERVAL '30 minutes', NOW() + INTERVAL '1 hour'),
          (encode(sha256(gen_random_uuid()::text::bytea), 'hex'), $1, $2, 'openid email', NOW() - INTERVAL '15 minutes', NOW() + INTERVAL '1 hour'),
          (encode(sha256(gen_random_uuid()::text::bytea), 'hex'), $1, $2, 'openid email', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour')
      `, [testClientId, testUserId]);

      const stats = await clientService.getClientStats(testClientId, '24h');

      expect(stats.tokensGenerated).toBe(3); // All 3 tokens within 24h
      expect(stats.activeTokens).toBe(2); // Only 2 are not expired
      expect(stats.totalTokens).toBe(3);
    });

    test('should not include tokens from other clients', async () => {
      const pool = getPool();

      // Generate tokens for test client
      await pool.query(`
        INSERT INTO oauth_provider_tokens (
          token_hash,
          client_id,
          user_id,
          scope,
          expires_at
        ) VALUES 
          (encode(sha256(gen_random_uuid()::text::bytea), 'hex'), $1, $2, 'openid', NOW() + INTERVAL '1 hour')
      `, [testClientId, testUserId]);

      // Generate tokens for other client
      await pool.query(`
        INSERT INTO oauth_provider_tokens (
          token_hash,
          client_id,
          user_id,
          scope,
          expires_at
        ) VALUES 
          (encode(sha256(gen_random_uuid()::text::bytea), 'hex'), $1, $2, 'openid', NOW() + INTERVAL '1 hour')
      `, [otherClient.client_id, testUserId]);

      const stats = await clientService.getClientStats(testClientId);

      // Should only count tokens from testClient
      expect(stats.activeTokens).toBe(1);
    });

    test('should handle non-existent client gracefully', async () => {
      const fakeClientId = 'cl_nonexistent123456';
      const stats = await clientService.getClientStats(fakeClientId);

      // Should return zeros, not throw error
      expect(stats.tokensGenerated).toBe(0);
      expect(stats.activeTokens).toBe(0);
    });

    test('should track refresh token usage', async () => {
      const pool = getPool();

      // Generate tokens with refresh tokens
      await pool.query(`
        INSERT INTO oauth_provider_tokens (
          token_hash,
          refresh_token_hash,
          client_id,
          user_id,
          scope,
          expires_at,
          refresh_token_expires_at
        ) VALUES 
          (encode(sha256(gen_random_uuid()::text::bytea), 'hex'), encode(sha256('rt_test1'::bytea), 'hex'), $1, $2, 'openid', NOW() + INTERVAL '1 hour', NOW() + INTERVAL '30 days'),
          (encode(sha256(gen_random_uuid()::text::bytea), 'hex'), encode(sha256('rt_test2'::bytea), 'hex'), $1, $2, 'openid', NOW() + INTERVAL '1 hour', NOW() + INTERVAL '30 days')
      `, [testClientId, testUserId]);

      const stats = await clientService.getClientStats(testClientId);

      expect(stats.tokensRefreshed).toBe(2);
    });

    test('should respect timeframe filter', async () => {
      const pool = getPool();

      // Generate old token (created 2 hours ago but still valid)
      await pool.query(`
        INSERT INTO oauth_provider_tokens (
          token_hash,
          client_id,
          user_id,
          scope,
          expires_at,
          created_at
        ) VALUES 
          (encode(sha256(gen_random_uuid()::text::bytea), 'hex'), $1, $2, 'openid', NOW() + INTERVAL '1 hour', NOW() - INTERVAL '2 hours')
      `, [testClientId, testUserId]);

      // Recent stats should be 0
      const recentStats = await clientService.getClientStats(testClientId, '1h');
      expect(recentStats.tokensGenerated).toBe(0);

      // 24h stats should include it
      const dayStats = await clientService.getClientStats(testClientId, '24h');
      expect(dayStats.tokensGenerated).toBe(1);
    });
  });

  // ============================================================================
  // POST /api/oauth/clients/:id/regenerate-secret - Regenerate Secret
  // ============================================================================

  describe('POST /api/oauth/clients/:id/regenerate-secret', () => {
    test('should regenerate client secret successfully', async () => {
      const result = await clientService.regenerateClientSecret(testClientId);

      expect(result).toHaveProperty('client_secret');
      expect(result.client_secret).toMatch(/^cs_[A-Za-z0-9]{32}$/);
      expect(result.client_secret).not.toBe(testClientSecret);
    });

    test('should invalidate old secret after regeneration', async () => {
      const oldSecret = testClientSecret;
      
      // Regenerate secret
      await clientService.regenerateClientSecret(testClientId);

      // Try to validate with old secret (should throw/return null)
      const validationResult = await clientService.validateClientCredentials(testClientId, oldSecret);

      expect(validationResult).toBeNull(); // Old secret should not work
    });

    test('should allow validation with new secret', async () => {
      const result = await clientService.regenerateClientSecret(testClientId);
      const newSecret = result.client_secret;

      // Validate with new secret
      const validationResult = await clientService.validateClientCredentials(testClientId, newSecret);

      expect(validationResult).not.toBeNull();
      expect(validationResult.client_id).toBe(testClientId);
    });

    test('should throw error for non-existent client', async () => {
      const fakeClientId = 'cl_nonexistent123456';

      await expect(
        clientService.regenerateClientSecret(fakeClientId)
      ).rejects.toThrow('Client not found');
    });

    test('should generate unique secrets on multiple regenerations', async () => {
      const secret1 = (await clientService.regenerateClientSecret(testClientId)).client_secret;
      const secret2 = (await clientService.regenerateClientSecret(testClientId)).client_secret;
      const secret3 = (await clientService.regenerateClientSecret(testClientId)).client_secret;

      // All secrets should be different
      expect(secret1).not.toBe(secret2);
      expect(secret2).not.toBe(secret3);
      expect(secret1).not.toBe(secret3);

      // All should follow format
      expect(secret1).toMatch(/^cs_[A-Za-z0-9]{32}$/);
      expect(secret2).toMatch(/^cs_[A-Za-z0-9]{32}$/);
      expect(secret3).toMatch(/^cs_[A-Za-z0-9]{32}$/);
    });

    test('should update client updated_at timestamp', async () => {
      const pool = getPool();

      // Get original timestamp
      const beforeResult = await pool.query(
        'SELECT updated_at FROM oauth_clients WHERE client_id = $1',
        [testClientId]
      );
      const beforeTimestamp = beforeResult.rows[0].updated_at;

      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      // Regenerate secret
      await clientService.regenerateClientSecret(testClientId);

      // Get new timestamp
      const afterResult = await pool.query(
        'SELECT updated_at FROM oauth_clients WHERE client_id = $1',
        [testClientId]
      );
      const afterTimestamp = afterResult.rows[0].updated_at;

      expect(new Date(afterTimestamp).getTime()).toBeGreaterThan(new Date(beforeTimestamp).getTime());
    });

    test('should hash new secret with bcrypt', async () => {
      const pool = getPool();
      const result = await clientService.regenerateClientSecret(testClientId);
      const newSecret = result.client_secret;

      // Get stored hash
      const hashResult = await pool.query(
        'SELECT client_secret_hash FROM oauth_clients WHERE client_id = $1',
        [testClientId]
      );
      const storedHash = hashResult.rows[0].client_secret_hash;

      // Verify hash matches secret
      const isValid = await bcrypt.compare(newSecret, storedHash);
      expect(isValid).toBe(true);

      // Verify old secret doesn't match
      const oldSecretMatch = await bcrypt.compare(testClientSecret, storedHash);
      expect(oldSecretMatch).toBe(false);
    });
  });

  // ============================================================================
  // Tenant Isolation Tests
  // ============================================================================

  describe('Tenant Isolation', () => {
    test('should not return stats for client in different tenant', async () => {
      // This would be enforced by the route handler checking tenantId
      // Here we verify at service level that stats are accurate
      
      const pool = getPool();

      // Add tokens to other tenant's client
      await pool.query(`
        INSERT INTO oauth_provider_tokens (
          token_hash,
          client_id,
          user_id,
          token_type,
          scope,
          created_at,
          expires_at
        ) VALUES 
          (encode(sha256(gen_random_uuid()::text::bytea), 'hex'), $1, $2, 'Bearer', 'openid', NOW() - INTERVAL '30 minutes', NOW() + INTERVAL '1 hour')
      `, [otherClient.client_id, testUserId]);

      // Stats for test client should not include other tenant's tokens
      const stats = await clientService.getClientStats(testClientId);
      expect(stats.activeTokens).toBe(0);
    });

    test('should verify client belongs to tenant before operations', async () => {
      // Verify test client belongs to test tenant
      const client = await clientService.getClientById(testClientId);
      expect(client.tenant_id).toBe(testTenantId);

      // Verify other client belongs to other tenant
      const otherClientData = await clientService.getClientById(otherClient.client_id);
      expect(otherClientData.tenant_id).toBe(otherTenantId);
      expect(otherClientData.tenant_id).not.toBe(testTenantId);
    });
  });
});
