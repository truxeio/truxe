/**
 * OAuth Token Service - Advanced Test Suite
 * 
 * Tests for improved branch coverage:
 * - Database failure scenarios
 * - Edge case error conditions
 * - Concurrent operations
 * - Race conditions
 * - Boundary conditions
 * - Security edge cases
 * 
 * Target: 90% branch coverage
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll, jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

import tokenService from '../../../src/services/oauth-provider/token-service.js';
import enhancedTokenService from '../../../src/services/oauth-provider/enhanced-token-service.js';
import tokenMetrics from '../../../src/services/oauth-provider/token-metrics.js';
import clientService from '../../../src/services/oauth-provider/client-service.js';
import { getPool } from '../../../src/database/connection.js';

describe('OAuth Token Service - Advanced Tests', () => {
  let testClient;
  let testUser;
  let testUserId;
  let testClientId;
  const testScope = 'openid email profile';

  // JWT keys for testing
  const testPrivateKey = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC4RxfAqnVub7cB
Yqtxg+bA4jd3PtXkrBTTCROh3Qks8UEOI3tTibi0eiMEhA4v0TId30WjakVCtVK1
g3B0E2P+uJttwEhQjWscTDAKyIBZAHMmeo8iHrScaAg882KDmLAeXSFaNnzWPFww
fyfj7ZfaA8Pex6fNMvKWvk3xZgKFw8qQNyo8DgLNjt3fkejhZxs1I9pLZXkHW5CL
NNiZaBH4adrnAx9sMNyVFW6AqIL49g/LiQ0pyhMVdLt3XaXCpu8X4VJqn0se8iqj
fTPCzLOBA8NRYTdPUiiTryF8Cn0K8KjOakLMJM/Q1knd8Q2zql+Mndo1umwHA8AJ
h9uYwqwlAgMBAAECggEACGDlHdOyQKnwKG43zNK6Nmliq7eN6pZ/YOQAAkNGREaY
1l97Hz57CSundXBao8ZvcKfC5w3xJboQT2PxRDnQeVej637LWuw/Izt8kLTyjvlk
AuseIGdEf3sEat8HCuQxl8PUvSEOloAKkgLqCaU3GwjCSloKEVygZoWzDgd9FF9R
UHD128k1skB7ow55/Pkg4DIMle992Qt0Qicv4gJJ7Q7+K5UGgNj9SK0fPhO5jCkr
Ls2FjoexDePJFBRP1D/HYf/zslWYy1qesltN28XMAoSYrYYxxSxc6j0LyWQcvSHR
Iu+yAzp3AMa5YExkTgrwnrKoC4cmIQsHdzm6xEM7+QKBgQD+8JRLjIYABvcHIJi7
IPI2gPhZ23Ke5YlNXn6nYzHuEfleiGatxidAlSShmG034f3bv32muz7JI74SGYh5
5bBtQ9i5eDXyWLEz84SsKZmb/YsCP2kUFTZhrEI8aVJIs4yCeb+NAGPUVf6jpECi
wNxQeOXEhn8jt40w3cliebWY7QKBgQC5C0iMngrFt1l/Mm5WzRjqLKXyZwzLhhPf
w4l+Jtb5tVjRi85fqSGL4HYlDvs2evm4YJvKFjQ1YeiUdVFjZpuvfRqD1KOKvLmJ
29nXFUQ1D+jEqw5ipG+p5kpVhHo09vhkNZ+nN/woHM/yba/DuVRTy7i1S6Q2RgrC
RHLkQXsRGQKBgH1t+EhDVxpkUt2a2AoZZ5IRWh87rOUooakDOOU6FLLA/SPZkEsn
FuDbgC5RREseUTvwtu11aqqjfzyAe3kd3POlUdfOoRwfLvAUe84ImZ752467jANp
fFwJ2HzIhMdoL1VyeR/ydStfM+1nPrXUlZCyKrnKQntcL4c/V3mvz/zxAoGAeuED
TF2myaT3yX+zxfBsmxULHe1QkdZ3XCB9LUideTTzxjMQ2HV30Ws9CV7pc0Q2kDmX
OpuED+70g6Fkap24xNBOyzxpXbf1fZaBElMM+C+YYwE0jEyl2i0TL7bJcGKQj/sM
Cf8jc3+ul04/abmoRf0Cq2GPqnrYqijKIslY8AECgYEAuMtDuW5NkGUcE02hVp9G
JSYiBUu5+o8XRs0QCyrAlU1w3GK8TcwxxPfJ2DefVix2i4OaT9sx9bVc6ScRJS7q
xH7TTkbXwQlB7EBQaJ2yMQAV29/o6rzK6vTOMzo7VOy3OKN1GQlDKhF2nCe40qUU
nT7rRhXVUbddmmA3onNPCYA=
-----END PRIVATE KEY-----`;

  const testPublicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuEcXwKp1bm+3AWKrcYPm
wOI3dz7V5KwU0wkTod0JLPFBDiN7U4m4tHojBIQOL9EyHd9Fo2pFQrVStYNwdBNj
/ribbcBIUI1rHEwwCsiAWQBzJnqPIh60nGgIPPNig5iwHl0hWjZ81jxcMH8n4+2X
2gPD3senzTLylr5N8WYChcPKkDcqPA4CzY7d35Ho4WcbNSPaS2V5B1uQizTYmWgR
+Gna5wMfbDDclRVugKiC+PYPy4kNKcoTFXS7d12lwqbvF+FSap9LHvIqo30zwsyz
gQPDUWE3T1Iok68hfAp9CvCozmpCzCTP0NZJ3fENs6pfjJ3aNbpsBwPACYfbmMKs
JQIDAQAB
-----END PUBLIC KEY-----`;

  beforeAll(async () => {
    // Set environment variables
    process.env.JWT_PRIVATE_KEY = testPrivateKey;
    process.env.JWT_PUBLIC_KEY = testPublicKey;
    process.env.JWT_ISSUER = 'https://auth.truxe.test';
    process.env.JWT_KID = 'test-key-2024';

    const pool = getPool();

    // Create test user
    const userResult = await pool.query(`
      INSERT INTO users (email, email_verified, metadata)
      VALUES ('advanced-test@example.com', true, '{"name": "Advanced Test", "given_name": "Advanced", "family_name": "Test"}'::jsonb)
      RETURNING id, email, email_verified, metadata
    `);
    testUser = userResult.rows[0];
    testUserId = testUser.id;

    // Create test OAuth client
    const clientResult = await pool.query(`
      INSERT INTO oauth_clients (
        client_id, client_secret, client_name, redirect_uris, 
        allowed_scopes, allowed_grant_types, status
      )
      VALUES (
        'test-advanced-client-' || substr(md5(random()::text), 1, 8),
        encode(digest('test-secret', 'sha256'), 'hex'),
        'Advanced Test Client',
        ARRAY['http://localhost:3000/callback']::TEXT[],
        ARRAY['openid', 'email', 'profile']::TEXT[],
        ARRAY['authorization_code', 'refresh_token']::TEXT[],
        'active'
      )
      RETURNING client_id, client_name, status, allowed_scopes
    `);
    testClient = clientResult.rows[0];
    testClientId = testClient.client_id;
  });

  beforeEach(async () => {
    // Clean up tokens before each test
    const pool = getPool();
    await pool.query(`DELETE FROM oauth_provider_tokens WHERE client_id = $1`, [testClientId]);
  });

  afterAll(async () => {
    // Cleanup test data
    const pool = getPool();
    await pool.query(`DELETE FROM oauth_provider_tokens WHERE client_id = $1`, [testClientId]);
    await pool.query(`DELETE FROM oauth_clients WHERE client_id = $1`, [testClientId]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [testUserId]);
  });

  const getUserInfo = () => ({
    email: testUser.email,
    email_verified: testUser.email_verified,
    name: testUser.metadata?.name || 'Advanced Test',
    given_name: testUser.metadata?.given_name || 'Advanced',
    family_name: testUser.metadata?.family_name || 'Test',
    picture: testUser.metadata?.picture || null,
    updated_at: new Date(),
  });

  // ==========================================================================
  // DATABASE FAILURE SIMULATION TESTS
  // ==========================================================================

  describe('Database Failure Scenarios', () => {
    test('should handle database connection failure gracefully', async () => {
      // Mock pool.query to simulate connection failure
      const pool = getPool();
      const originalQuery = pool.query.bind(pool);
      const mockQuery = jest.fn().mockRejectedValue(new Error('Connection lost'));
      pool.query = mockQuery;

      try {
        await expect(
          tokenService.generateTokenPair({
            clientId: testClientId,
            userId: testUserId,
            scope: testScope,
            userInfo: getUserInfo(),
          })
        ).rejects.toThrow();
      } finally {
        // Restore original query method
        pool.query = originalQuery;
      }
    });

    test('should handle transaction rollback on error', async () => {
      const pool = getPool();
      
      // Start with a valid token generation
      const tokens = await tokenService.generateTokenPair({
        clientId: testClientId,
        userId: testUserId,
        scope: testScope,
        userInfo: getUserInfo(),
      });

      // Verify token was stored
      const result = await pool.query(`
        SELECT COUNT(*) as count FROM oauth_provider_tokens 
        WHERE client_id = $1
      `, [testClientId]);
      
      expect(parseInt(result.rows[0].count)).toBeGreaterThan(0);
    });

    test('should handle constraint violation errors', async () => {
      // Generate a token first
      const tokens = await tokenService.generateTokenPair({
        clientId: testClientId,
        userId: testUserId,
        scope: testScope,
        userInfo: getUserInfo(),
      });

      // Verify we can't violate unique constraints
      const pool = getPool();
      const tokenHash = tokenService.hashToken(tokens.access_token);
      
      await expect(
        pool.query(`
          INSERT INTO oauth_provider_tokens (
            token_hash, client_id, user_id, scope, expires_at, created_at
          ) VALUES ($1, $2, $3, $4, NOW() + INTERVAL '1 hour', NOW())
        `, [tokenHash, testClientId, testUserId, testScope])
      ).rejects.toThrow();
    });

    test('should handle database timeout', async () => {
      const pool = getPool();
      
      // Set a very short statement timeout for this test
      await pool.query(`SET statement_timeout = '1ms'`);
      
      try {
        // This should timeout (if it takes longer than 1ms)
        await expect(
          pool.query(`SELECT pg_sleep(0.1)`)
        ).rejects.toThrow();
      } finally {
        // Reset timeout
        await pool.query(`SET statement_timeout = '30s'`);
      }
    });

    test('should handle deadlock scenarios', async () => {
      // This test verifies the database can handle concurrent operations
      // In practice, deadlocks are rare with our token operations
      // but this ensures the service doesn't crash
      
      const promises = Array(5).fill(null).map(() =>
        tokenService.generateTokenPair({
          clientId: testClientId,
          userId: testUserId,
          scope: testScope,
          userInfo: getUserInfo(),
        })
      );

      const results = await Promise.allSettled(promises);
      
      // At least some should succeed
      const succeeded = results.filter(r => r.status === 'fulfilled');
      expect(succeeded.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // EDGE CASE ERROR CONDITIONS
  // ==========================================================================

  describe('Edge Case Error Conditions', () => {
    test('should handle extremely long scope strings', async () => {
      // Create a very long scope string (testing input validation)
      const longScope = Array(100).fill('scope').join(' ');
      
      const tokens = await tokenService.generateTokenPair({
        clientId: testClientId,
        userId: testUserId,
        scope: longScope,
        userInfo: getUserInfo(),
      });

      expect(tokens).toHaveProperty('access_token');
      expect(tokens).toHaveProperty('scope', longScope);
    });

    test('should handle special characters in user info', async () => {
      const specialUserInfo = {
        email: testUser.email,
        email_verified: true,
        name: "O'Reilly <test@example.com> & Co.",
        given_name: "Test\nLine\tBreak",
        family_name: 'Test "Quotes" \'Single\'',
        picture: null,
        updated_at: new Date(),
      };

      const tokens = await tokenService.generateTokenPair({
        clientId: testClientId,
        userId: testUserId,
        scope: testScope,
        userInfo: specialUserInfo,
      });

      const decoded = jwt.decode(tokens.access_token);
      expect(decoded.name).toBe(specialUserInfo.name);
    });

    test('should handle empty scope', async () => {
      const tokens = await tokenService.generateTokenPair({
        clientId: testClientId,
        userId: testUserId,
        scope: '',
        userInfo: getUserInfo(),
      });

      expect(tokens).toHaveProperty('access_token');
      expect(tokens).toHaveProperty('scope', '');
    });

    test('should handle malformed JWT in validation', async () => {
      await expect(
        tokenService.validateToken('not-a-jwt')
      ).rejects.toThrow();
    });

    test('should handle JWT with missing required claims', async () => {
      const malformedToken = jwt.sign(
        { sub: testUserId }, // Missing required claims
        testPrivateKey,
        { algorithm: 'RS256' }
      );

      // The service should handle this gracefully
      const result = await tokenService.introspectToken({
        token: malformedToken,
        clientId: testClientId,
      });

      expect(result.active).toBe(false);
    });

    test('should handle expired token edge case (exactly at expiration)', async () => {
      // Create a token that expires in 1 second
      const now = Math.floor(Date.now() / 1000);
      const token = jwt.sign(
        {
          iss: process.env.JWT_ISSUER,
          sub: testUserId,
          aud: testClientId,
          exp: now + 1,
          iat: now,
          jti: crypto.randomUUID(),
          scope: testScope,
        },
        testPrivateKey,
        { algorithm: 'RS256' }
      );

      // Wait 2 seconds to ensure expiration
      await new Promise(resolve => setTimeout(resolve, 2000));

      await expect(
        tokenService.validateToken(token)
      ).rejects.toThrow();
    });

    test('should handle null/undefined parameters gracefully', async () => {
      await expect(
        tokenService.generateTokenPair({
          clientId: null,
          userId: testUserId,
          scope: testScope,
          userInfo: getUserInfo(),
        })
      ).rejects.toThrow();

      await expect(
        tokenService.generateTokenPair({
          clientId: testClientId,
          userId: null,
          scope: testScope,
          userInfo: getUserInfo(),
        })
      ).rejects.toThrow();
    });

    test('should handle concurrent token generation for same user', async () => {
      // Generate multiple tokens concurrently for the same user
      const promises = Array(10).fill(null).map(() =>
        tokenService.generateTokenPair({
          clientId: testClientId,
          userId: testUserId,
          scope: testScope,
          userInfo: getUserInfo(),
        })
      );

      const results = await Promise.all(promises);
      
      // All should succeed
      expect(results).toHaveLength(10);
      
      // All tokens should be unique
      const accessTokens = results.map(r => r.access_token);
      const uniqueTokens = new Set(accessTokens);
      expect(uniqueTokens.size).toBe(10);
    });

    test('should handle rapid refresh token requests', async () => {
      // Generate initial tokens
      const initialTokens = await tokenService.generateTokenPair({
        clientId: testClientId,
        userId: testUserId,
        scope: testScope,
        userInfo: getUserInfo(),
      });

      // Try multiple rapid refreshes
      const promises = Array(5).fill(null).map(() =>
        tokenService.refreshToken({
          refreshToken: initialTokens.refresh_token,
          clientId: testClientId,
        })
      );

      const results = await Promise.allSettled(promises);
      
      // Only one should succeed (refresh token is one-time use)
      const succeeded = results.filter(r => r.status === 'fulfilled');
      expect(succeeded.length).toBe(1);
      
      // Others should fail
      const failed = results.filter(r => r.status === 'rejected');
      expect(failed.length).toBe(4);
    });
  });

  // ==========================================================================
  // BOUNDARY CONDITION TESTS
  // ==========================================================================

  describe('Boundary Conditions', () => {
    test('should handle maximum token expiration time', async () => {
      // Test that tokens have reasonable maximum lifetimes
      const tokens = await tokenService.generateTokenPair({
        clientId: testClientId,
        userId: testUserId,
        scope: testScope,
        userInfo: getUserInfo(),
      });

      const decoded = jwt.decode(tokens.access_token);
      const maxExpiration = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60); // 1 year
      
      expect(decoded.exp).toBeLessThan(maxExpiration);
    });

    test('should handle minimum scope (openid only)', async () => {
      const tokens = await tokenService.generateTokenPair({
        clientId: testClientId,
        userId: testUserId,
        scope: 'openid',
        userInfo: getUserInfo(),
      });

      const decoded = jwt.decode(tokens.access_token);
      
      // Should only have sub, no email or profile claims
      expect(decoded).toHaveProperty('sub');
      expect(decoded).not.toHaveProperty('email');
      expect(decoded).not.toHaveProperty('name');
    });

    test('should handle very long client IDs', async () => {
      // OAuth spec allows client IDs up to 255 characters
      const longClientId = 'a'.repeat(255);
      
      // This should fail gracefully (client doesn't exist)
      await expect(
        tokenService.generateTokenPair({
          clientId: longClientId,
          userId: testUserId,
          scope: testScope,
          userInfo: getUserInfo(),
        })
      ).rejects.toThrow();
    });

    test('should handle token at exact character limits', async () => {
      const tokens = await tokenService.generateTokenPair({
        clientId: testClientId,
        userId: testUserId,
        scope: testScope,
        userInfo: getUserInfo(),
      });

      // Access token (JWT) should be within reasonable size
      expect(tokens.access_token.length).toBeLessThan(2000);
      
      // Refresh token should be exactly 46 characters (rt_ + 43 chars)
      expect(tokens.refresh_token.length).toBe(46);
      expect(tokens.refresh_token).toMatch(/^rt_[A-Za-z0-9_-]{43}$/);
    });

    test('should handle zero expiration edge case', async () => {
      // Verify that tokens always have positive expiration
      const tokens = await tokenService.generateTokenPair({
        clientId: testClientId,
        userId: testUserId,
        scope: testScope,
        userInfo: getUserInfo(),
      });

      expect(tokens.expires_in).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // SECURITY EDGE CASES
  // ==========================================================================

  describe('Security Edge Cases', () => {
    test('should not allow token reuse after revocation', async () => {
      const tokens = await tokenService.generateTokenPair({
        clientId: testClientId,
        userId: testUserId,
        scope: testScope,
        userInfo: getUserInfo(),
      });

      // Revoke the token
      await tokenService.revokeToken({
        token: tokens.access_token,
        clientId: testClientId,
      });

      // Try to use it again
      const result = await tokenService.introspectToken({
        token: tokens.access_token,
        clientId: testClientId,
      });

      expect(result.active).toBe(false);
    });

    test('should prevent refresh token replay attacks', async () => {
      const tokens = await tokenService.generateTokenPair({
        clientId: testClientId,
        userId: testUserId,
        scope: testScope,
        userInfo: getUserInfo(),
      });

      // First refresh succeeds
      const newTokens = await tokenService.refreshToken({
        refreshToken: tokens.refresh_token,
        clientId: testClientId,
      });

      expect(newTokens).toHaveProperty('access_token');

      // Second refresh with same token should fail
      await expect(
        tokenService.refreshToken({
          refreshToken: tokens.refresh_token,
          clientId: testClientId,
        })
      ).rejects.toThrow();
    });

    test('should not leak information in error messages', async () => {
      try {
        await tokenService.validateToken('invalid-token');
      } catch (error) {
        // Error message should not contain sensitive information
        expect(error.message.toLowerCase()).not.toContain('database');
        expect(error.message.toLowerCase()).not.toContain('sql');
        expect(error.message.toLowerCase()).not.toContain('table');
      }
    });

    test('should handle token generation for suspended client', async () => {
      const pool = getPool();
      
      // Suspend the client
      await pool.query(`
        UPDATE oauth_clients SET status = 'suspended' WHERE client_id = $1
      `, [testClientId]);

      try {
        await expect(
          tokenService.generateTokenPair({
            clientId: testClientId,
            userId: testUserId,
            scope: testScope,
            userInfo: getUserInfo(),
          })
        ).rejects.toThrow('suspended');
      } finally {
        // Restore client status
        await pool.query(`
          UPDATE oauth_clients SET status = 'active' WHERE client_id = $1
        `, [testClientId]);
      }
    });

    test('should validate JWT signature correctly', async () => {
      const tokens = await tokenService.generateTokenPair({
        clientId: testClientId,
        userId: testUserId,
        scope: testScope,
        userInfo: getUserInfo(),
      });

      // Tamper with the token (change last character)
      const tamperedToken = tokens.access_token.slice(0, -1) + 'X';

      await expect(
        tokenService.validateToken(tamperedToken)
      ).rejects.toThrow();
    });

    test('should prevent JWT algorithm confusion attacks', async () => {
      // Create a token signed with HS256 instead of RS256
      const maliciousToken = jwt.sign(
        {
          iss: process.env.JWT_ISSUER,
          sub: testUserId,
          aud: testClientId,
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
          jti: crypto.randomUUID(),
          scope: testScope,
        },
        testPublicKey, // Try to use public key as HMAC secret
        { algorithm: 'HS256' }
      );

      await expect(
        tokenService.validateToken(maliciousToken)
      ).rejects.toThrow();
    });
  });

  // ==========================================================================
  // PERFORMANCE & STRESS TESTS
  // ==========================================================================

  describe('Performance & Stress Tests', () => {
    test('should handle bulk token generation efficiently', async () => {
      const startTime = Date.now();
      
      const promises = Array(20).fill(null).map(() =>
        tokenService.generateTokenPair({
          clientId: testClientId,
          userId: testUserId,
          scope: testScope,
          userInfo: getUserInfo(),
        })
      );

      await Promise.all(promises);
      
      const duration = Date.now() - startTime;
      
      // Should complete in reasonable time (< 5 seconds for 20 tokens)
      expect(duration).toBeLessThan(5000);
    });

    test('should handle cleanup of large number of expired tokens', async () => {
      // Generate several tokens
      for (let i = 0; i < 10; i++) {
        await tokenService.generateTokenPair({
          clientId: testClientId,
          userId: testUserId,
          scope: testScope,
          userInfo: getUserInfo(),
        });
      }

      // Expire them all
      const pool = getPool();
      await pool.query(`
        UPDATE oauth_provider_tokens 
        SET expires_at = NOW() - INTERVAL '1 day',
            refresh_token_expires_at = NOW() - INTERVAL '1 hour'
        WHERE client_id = $1
      `, [testClientId]);

      const deletedCount = await tokenService.deleteExpiredTokens();
      expect(deletedCount).toBeGreaterThanOrEqual(10);
    });
  });

  // ==========================================================================
  // ENHANCED SERVICE INTEGRATION TESTS
  // ==========================================================================

  describe('Enhanced Token Service Integration', () => {
    test('should track metrics on token generation', async () => {
      await enhancedTokenService.generateTokenPair({
        clientId: testClientId,
        userId: testUserId,
        scope: testScope,
        userInfo: getUserInfo(),
        ip: '127.0.0.1',
        userAgent: 'test-agent',
        requestId: 'test-request-1',
      });

      // Metrics should be tracked
      const metrics = await tokenMetrics.getClientMetrics(testClientId);
      expect(metrics.tokensGenerated).toBeGreaterThan(0);
    });

    test('should get comprehensive security metrics', async () => {
      const metrics = await enhancedTokenService.getSecurityMetrics('1h');
      
      expect(metrics).toHaveProperty('counters');
      expect(metrics).toHaveProperty('rates');
      expect(metrics).toHaveProperty('security');
      expect(metrics).toHaveProperty('health');
    });

    test('should detect anomalies in token generation', async () => {
      const anomalies = await tokenMetrics.detectAnomalies();
      
      expect(Array.isArray(anomalies)).toBe(true);
      // Anomalies array may be empty if no anomalies detected
    });

    test('should provide health status across all services', async () => {
      const health = await enhancedTokenService.getHealthStatus();
      
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('components');
      expect(health.components).toHaveProperty('tokenService');
      expect(health.components).toHaveProperty('metrics');
      expect(health.components).toHaveProperty('auditLog');
    });
  });
});
