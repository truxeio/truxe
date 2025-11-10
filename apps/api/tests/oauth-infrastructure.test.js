/**
 * OAuth Infrastructure Tests
 *
 * Comprehensive test suite for OAuth 2.0 core functionality including:
 * - State management and CSRF protection
 * - Token encryption/decryption
 * - Provider registration and configuration
 * - Authorization flow
 * - Callback handling
 * - Account linking/unlinking
 *
 * @requires-integration-test Database and Redis required
 */

import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { OAuthService } from '../src/services/oauth/oauth-service.js';
import OAuthStateManager from '../src/services/oauth/state-manager.js';
import OAuthTokenEncryptor from '../src/services/oauth/token-encryptor.js';
import { BaseOAuthProvider } from '../src/services/oauth/provider-interface.js';
import {
  OAuthError,
  OAuthStateError,
  OAuthProviderError,
  OAuthConfigurationError,
} from '../src/services/oauth/errors.js';
import { getPool } from '../src/database/connection.js';
import Redis from 'ioredis';

// Mock provider for testing
class MockOAuthProvider extends BaseOAuthProvider {
  constructor(config) {
    super('mock', config);
    this.mockProfile = config.mockProfile || {
      id: 'mock-user-123',
      email: 'test@example.com',
      name: 'Test User',
      email_verified: true,
    };
  }

  async getAuthorizationUrl({ state, redirectUri, scopes }) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      state,
    });

    return `${this.authUrl}?${params.toString()}`;
  }

  async exchangeCodeForToken({ code, redirectUri }) {
    if (code === 'invalid_code') {
      throw new OAuthProviderError('Invalid authorization code');
    }

    return {
      access_token: 'mock_access_token_' + crypto.randomBytes(16).toString('hex'),
      refresh_token: 'mock_refresh_token_' + crypto.randomBytes(16).toString('hex'),
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'profile email',
    };
  }

  async getUserProfile({ accessToken }) {
    if (accessToken.includes('invalid')) {
      throw new OAuthProviderError('Invalid access token');
    }

    return this.mockProfile;
  }

  async refreshAccessToken({ refreshToken }) {
    if (!refreshToken) {
      throw new OAuthProviderError('Refresh token is required');
    }

    return {
      access_token: 'refreshed_access_token_' + crypto.randomBytes(16).toString('hex'),
      token_type: 'Bearer',
      expires_in: 3600,
    };
  }

  async revokeToken({ token }) {
    return true;
  }
}

describe('OAuth Infrastructure', { timeout: 10000 }, () => {
  let pool;
  let redis;
  let oauthService;
  let testUserId;

  before(async () => {
    pool = getPool();
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

    // Initialize OAuth service
    oauthService = new OAuthService({
      config: {
        enabled: true,
        callbackBaseUrl: 'http://localhost:3001',
        state: {
          secret: crypto.randomBytes(32).toString('hex'),
          ttl: 600000, // 10 minutes
          length: 32,
          keyPrefix: 'test:oauth:state:',
        },
        tokenEncryption: {
          key: crypto.randomBytes(32).toString('base64'),
          algorithm: 'aes-256-gcm',
        },
        providers: {
          mock: {
            enabled: true,
            clientId: 'test-client-id',
            clientSecret: 'test-client-secret',
            authUrl: 'https://provider.example.com/oauth/authorize',
            tokenUrl: 'https://provider.example.com/oauth/token',
            userInfoUrl: 'https://provider.example.com/oauth/userinfo',
            callbackPath: '/auth/callback/mock',
            scopes: ['profile', 'email'],
          },
        },
      },
      pool,
      redisConfig: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        keyPrefix: 'test:',
      },
      logger: console,
    });

    // Register mock provider
    const mockProvider = new MockOAuthProvider({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      authUrl: 'https://provider.example.com/oauth/authorize',
      tokenUrl: 'https://provider.example.com/oauth/token',
      userInfoUrl: 'https://provider.example.com/oauth/userinfo',
      callbackUrl: 'http://localhost:3001/auth/callback/mock',
      scopes: ['profile', 'email'],
    });

    oauthService.registerProvider('mock', mockProvider);

    // Create test user
    const userResult = await pool.query(
      `INSERT INTO users (email, email_verified, status)
       VALUES ($1, $2, $3)
       RETURNING id`,
      ['test@example.com', true, 'active']
    );
    testUserId = userResult.rows[0].id;
  });

  after(async () => {
    // Cleanup test data
    if (testUserId) {
      await pool.query('DELETE FROM oauth_accounts WHERE user_id = $1', [testUserId]);
      await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    }

    // Cleanup Redis test keys
    const keys = await redis.keys('test:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }

    await redis.quit();
  });

  describe('OAuthStateManager', () => {
    let stateManager;

    beforeEach(() => {
      stateManager = new OAuthStateManager({
        oauthConfig: {
          state: {
            secret: crypto.randomBytes(32).toString('hex'),
            ttl: 600000,
            length: 32,
            keyPrefix: 'oauth:state:',
          },
        },
        redisConfig: {
          url: process.env.REDIS_URL || 'redis://localhost:6379',
          keyPrefix: 'test:',
        },
        logger: console,
      });
    });

    afterEach(async () => {
      if (stateManager) {
        await stateManager.destroy();
      }
    });

    it('should generate state parameter with context', async () => {
      const context = {
        provider: 'mock',
        tenantId: 'tenant-123',
        userId: testUserId,
      };

      const result = await stateManager.generateState(context);

      assert.ok(result.state, 'State should be generated');
      assert.ok(result.stateId, 'State ID should be generated');
      assert.ok(result.context, 'Context should be included');
      assert.equal(result.context.provider, 'mock');
      assert.equal(result.context.tenantId, 'tenant-123');
      assert.ok(result.context.nonce, 'Nonce should be generated');
    });

    it('should validate state parameter successfully', async () => {
      const context = {
        provider: 'mock',
        userId: testUserId,
      };

      const { state } = await stateManager.generateState(context);
      const validated = await stateManager.validateState(state);

      assert.equal(validated.provider, 'mock');
      assert.equal(validated.userId, testUserId);
      assert.ok(validated.nonce);
    });

    it('should consume state parameter on validation', async () => {
      const { state } = await stateManager.generateState({ provider: 'mock' });

      // First validation should succeed
      await stateManager.validateState(state);

      // Second validation should fail (state consumed)
      await assert.rejects(
        async () => await stateManager.validateState(state),
        OAuthStateError,
        'State should be consumed after first validation'
      );
    });

    it('should reject malformed state parameter', async () => {
      await assert.rejects(
        async () => await stateManager.validateState('invalid-state'),
        OAuthStateError,
        'Should reject malformed state'
      );
    });

    it('should reject state with invalid signature', async () => {
      const { stateId } = await stateManager.generateState({ provider: 'mock' });
      const tamperedState = `${stateId}.tampered-signature`;

      await assert.rejects(
        async () => await stateManager.validateState(tamperedState),
        OAuthStateError,
        'Should reject invalid signature'
      );
    });

    it('should verify provider match in state validation', async () => {
      const { state } = await stateManager.generateState({ provider: 'google' });

      await assert.rejects(
        async () => await stateManager.validateState(state, { expectedProvider: 'github' }),
        OAuthStateError,
        'Should reject provider mismatch'
      );
    });
  });

  describe('OAuthTokenEncryptor', () => {
    let encryptor;

    beforeEach(() => {
      encryptor = new OAuthTokenEncryptor({
        key: crypto.randomBytes(32).toString('base64'),
        algorithm: 'aes-256-gcm',
      });
    });

    it('should encrypt and decrypt tokens correctly', () => {
      const plaintext = 'sensitive_access_token_12345';

      const encrypted = encryptor.encrypt(plaintext);
      assert.ok(encrypted, 'Token should be encrypted');
      assert.notEqual(encrypted, plaintext, 'Encrypted value should differ from plaintext');

      const decrypted = encryptor.decrypt(encrypted);
      assert.equal(decrypted, plaintext, 'Decrypted value should match original');
    });

    it('should handle null and empty values', () => {
      assert.equal(encryptor.encrypt(null), null);
      assert.equal(encryptor.encrypt(''), null);
      assert.equal(encryptor.decrypt(null), null);
      assert.equal(encryptor.decrypt(''), null);
    });

    it('should produce different ciphertexts for same plaintext', () => {
      const plaintext = 'same_token_value';

      const encrypted1 = encryptor.encrypt(plaintext);
      const encrypted2 = encryptor.encrypt(plaintext);

      assert.notEqual(encrypted1, encrypted2, 'Ciphertexts should differ due to random IV');

      // Both should decrypt to same plaintext
      assert.equal(encryptor.decrypt(encrypted1), plaintext);
      assert.equal(encryptor.decrypt(encrypted2), plaintext);
    });

    it('should throw error on tampered ciphertext', () => {
      const encrypted = encryptor.encrypt('token_value');
      const tampered = encrypted.slice(0, -5) + 'XXXXX';

      assert.throws(
        () => encryptor.decrypt(tampered),
        Error,
        'Should reject tampered ciphertext'
      );
    });
  });

  describe('OAuthService - Authorization Flow', () => {
    it('should create authorization request successfully', async () => {
      const result = await oauthService.createAuthorizationRequest({
        providerId: 'mock',
        tenantId: 'tenant-123',
        userId: testUserId,
        redirectUri: 'http://localhost:3000/callback',
        scopes: ['profile', 'email'],
      });

      assert.ok(result.authorizationUrl, 'Authorization URL should be generated');
      assert.ok(result.state, 'State should be generated');
      assert.ok(result.stateId, 'State ID should be generated');
      assert.ok(result.expiresAt, 'Expiration should be set');
      assert.equal(result.tenantId, 'tenant-123');
      assert.deepEqual(result.scopes, ['profile', 'email']);

      // Verify URL structure
      const url = new URL(result.authorizationUrl);
      assert.equal(url.searchParams.get('client_id'), 'test-client-id');
      assert.equal(url.searchParams.get('state'), result.state);
      assert.equal(url.searchParams.get('scope'), 'profile email');
    });

    it('should reject authorization request for disabled provider', async () => {
      await assert.rejects(
        async () => {
          await oauthService.createAuthorizationRequest({
            providerId: 'disabled_provider',
            userId: testUserId,
          });
        },
        OAuthError,
        'Should reject disabled provider'
      );
    });

    it('should normalize scopes correctly', () => {
      // Array format
      assert.deepEqual(
        oauthService.normalizeScopes(['profile', 'email']),
        ['profile', 'email']
      );

      // String format with spaces
      assert.deepEqual(
        oauthService.normalizeScopes('profile email openid'),
        ['profile', 'email', 'openid']
      );

      // String format with commas
      assert.deepEqual(
        oauthService.normalizeScopes('profile,email,openid'),
        ['profile', 'email', 'openid']
      );

      // Empty/null
      assert.deepEqual(oauthService.normalizeScopes(null), []);
      assert.deepEqual(oauthService.normalizeScopes(''), []);
    });
  });

  describe('OAuthService - Callback Handling', () => {
    let authState;

    beforeEach(async () => {
      // Create authorization request first
      const authResult = await oauthService.createAuthorizationRequest({
        providerId: 'mock',
        userId: testUserId,
        redirectUri: 'http://localhost:3000/callback',
      });

      authState = authResult.state;
    });

    it('should handle OAuth callback successfully', async () => {
      const result = await oauthService.handleCallback({
        providerId: 'mock',
        code: 'valid_auth_code',
        state: authState,
        userId: testUserId,
      });

      assert.equal(result.provider, 'mock');
      assert.ok(result.tokens, 'Tokens should be returned');
      assert.ok(result.tokens.accessToken, 'Access token should be present');
      assert.ok(result.tokens.refreshToken, 'Refresh token should be present');
      assert.ok(result.profile, 'Profile should be returned');
      assert.equal(result.profile.email, 'test@example.com');
      assert.ok(result.account, 'Account should be linked');
    });

    it('should reject callback with invalid authorization code', async () => {
      await assert.rejects(
        async () => {
          await oauthService.handleCallback({
            providerId: 'mock',
            code: 'invalid_code',
            state: authState,
            userId: testUserId,
          });
        },
        OAuthProviderError,
        'Should reject invalid authorization code'
      );
    });

    it('should reject callback with expired state', async () => {
      // Use an old/invalid state
      const expiredState = 'expired.state.parameter';

      await assert.rejects(
        async () => {
          await oauthService.handleCallback({
            providerId: 'mock',
            code: 'valid_auth_code',
            state: expiredState,
            userId: testUserId,
          });
        },
        OAuthStateError,
        'Should reject expired state'
      );
    });

    it('should reject callback with provider error', async () => {
      await assert.rejects(
        async () => {
          await oauthService.handleCallback({
            providerId: 'mock',
            code: 'valid_code',
            state: authState,
            error: 'access_denied',
            errorDescription: 'User denied access',
          });
        },
        OAuthProviderError,
        'Should reject when provider returns error'
      );
    });

    it('should normalize token response correctly', () => {
      const rawResponse = {
        access_token: 'access_token_value',
        refresh_token: 'refresh_token_value',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'profile email',
      };

      const normalized = oauthService.normalizeTokenResponse(rawResponse);

      assert.equal(normalized.accessToken, 'access_token_value');
      assert.equal(normalized.refreshToken, 'refresh_token_value');
      assert.equal(normalized.tokenType, 'Bearer');
      assert.equal(normalized.expiresIn, 3600);
      assert.equal(normalized.scope, 'profile email');
      assert.ok(normalized.expiresAt instanceof Date);
    });
  });

  describe('OAuthService - Account Management', () => {
    it('should link OAuth account to user', async () => {
      const account = await oauthService.linkAccount({
        userId: testUserId,
        providerId: 'mock',
        providerAccountId: 'provider-user-123',
        email: 'test@example.com',
        tokens: {
          accessToken: 'test_access_token',
          refreshToken: 'test_refresh_token',
          expiresAt: new Date(Date.now() + 3600 * 1000),
        },
        scope: 'profile email',
        profile: {
          id: 'provider-user-123',
          email: 'test@example.com',
          name: 'Test User',
        },
      });

      assert.ok(account.id, 'Account ID should be returned');
      assert.equal(account.userId, testUserId);
      assert.equal(account.provider, 'mock');
      assert.equal(account.providerAccountId, 'provider-user-123');
      assert.equal(account.email, 'test@example.com');
      assert.ok(account.tokens.hasAccessToken, 'Should have access token');
      assert.ok(account.tokens.hasRefreshToken, 'Should have refresh token');
    });

    it('should update existing OAuth account on re-link', async () => {
      // First link
      await oauthService.linkAccount({
        userId: testUserId,
        providerId: 'mock',
        providerAccountId: 'provider-user-456',
        email: 'test@example.com',
        tokens: {
          accessToken: 'original_token',
          refreshToken: 'original_refresh',
        },
        scope: 'profile',
      });

      // Re-link with updated tokens
      const updatedAccount = await oauthService.linkAccount({
        userId: testUserId,
        providerId: 'mock',
        providerAccountId: 'provider-user-456',
        email: 'updated@example.com',
        tokens: {
          accessToken: 'updated_token',
          refreshToken: 'updated_refresh',
        },
        scope: 'profile email',
      });

      assert.equal(updatedAccount.email, 'updated@example.com');
      assert.equal(updatedAccount.scope, 'profile email');
    });

    it('should reject linking account already linked to different user', async () => {
      // Create another test user
      const otherUserResult = await pool.query(
        `INSERT INTO users (email, email_verified, status)
         VALUES ($1, $2, $3)
         RETURNING id`,
        ['other@example.com', true, 'active']
      );
      const otherUserId = otherUserResult.rows[0].id;

      try {
        // Link to first user
        await oauthService.linkAccount({
          userId: testUserId,
          providerId: 'mock',
          providerAccountId: 'shared-provider-id',
          tokens: { accessToken: 'token1' },
        });

        // Try to link same provider account to different user
        await assert.rejects(
          async () => {
            await oauthService.linkAccount({
              userId: otherUserId,
              providerId: 'mock',
              providerAccountId: 'shared-provider-id',
              tokens: { accessToken: 'token2' },
            });
          },
          /already linked to another user/,
          'Should reject account conflict'
        );
      } finally {
        // Cleanup
        await pool.query('DELETE FROM oauth_accounts WHERE user_id = $1', [otherUserId]);
        await pool.query('DELETE FROM users WHERE id = $1', [otherUserId]);
      }
    });

    it('should unlink OAuth account successfully', async () => {
      // Link account first
      await oauthService.linkAccount({
        userId: testUserId,
        providerId: 'mock',
        providerAccountId: 'to-be-unlinked',
        tokens: { accessToken: 'token' },
      });

      // Unlink
      const result = await oauthService.unlinkAccount({
        userId: testUserId,
        providerId: 'mock',
        providerAccountId: 'to-be-unlinked',
      });

      assert.ok(result, 'Unlink should return account data');
      assert.equal(result.provider, 'mock');

      // Verify account is removed
      const accounts = await oauthService.listAccountsForUser(testUserId);
      const found = accounts.find(a => a.providerAccountId === 'to-be-unlinked');
      assert.ok(!found, 'Account should be removed');
    });

    it('should list all OAuth accounts for user', async () => {
      // Link multiple accounts
      await oauthService.linkAccount({
        userId: testUserId,
        providerId: 'mock',
        providerAccountId: 'account-1',
        tokens: { accessToken: 'token1' },
      });

      await oauthService.linkAccount({
        userId: testUserId,
        providerId: 'mock',
        providerAccountId: 'account-2',
        tokens: { accessToken: 'token2' },
      });

      const accounts = await oauthService.listAccountsForUser(testUserId);

      assert.ok(accounts.length >= 2, 'Should return multiple accounts');
      assert.ok(accounts.every(a => a.userId === testUserId), 'All accounts should belong to user');
      assert.ok(accounts.every(a => a.tokens.hasAccessToken), 'All accounts should have tokens');
    });
  });

  describe('OAuth Security', () => {
    it('should prevent CSRF attacks with state validation', async () => {
      // Create auth request
      const { state: legitimateState } = await oauthService.createAuthorizationRequest({
        providerId: 'mock',
        userId: testUserId,
      });

      // Attacker tries to use different state
      const attackerState = crypto.randomBytes(32).toString('hex');

      await assert.rejects(
        async () => {
          await oauthService.handleCallback({
            providerId: 'mock',
            code: 'valid_code',
            state: attackerState,
            userId: testUserId,
          });
        },
        OAuthStateError,
        'Should prevent CSRF with invalid state'
      );
    });

    it('should encrypt sensitive tokens before storage', async () => {
      const account = await oauthService.linkAccount({
        userId: testUserId,
        providerId: 'mock',
        providerAccountId: 'encrypted-test',
        tokens: {
          accessToken: 'plaintext_access_token',
          refreshToken: 'plaintext_refresh_token',
        },
      });

      // Verify tokens are not exposed in default response
      assert.equal(account.tokens.hasAccessToken, true);
      assert.equal(account.tokens.hasRefreshToken, true);
      assert.ok(!account.tokens.accessToken, 'Access token should not be exposed');

      // Verify tokens are encrypted in database
      const dbResult = await pool.query(
        'SELECT access_token, refresh_token FROM oauth_accounts WHERE id = $1',
        [account.id]
      );

      const storedAccessToken = dbResult.rows[0].access_token;
      const storedRefreshToken = dbResult.rows[0].refresh_token;

      assert.notEqual(storedAccessToken, 'plaintext_access_token', 'Access token should be encrypted');
      assert.notEqual(storedRefreshToken, 'plaintext_refresh_token', 'Refresh token should be encrypted');
    });

    it('should validate redirect URIs against allowlist', async () => {
      const serviceWithWhitelist = new OAuthService({
        config: {
          enabled: true,
          callbackBaseUrl: 'http://localhost:3001',
          allowedRedirectHosts: ['localhost:3000', 'app.example.com'],
          state: {
            secret: crypto.randomBytes(32).toString('hex'),
            ttl: 600000,
          },
          tokenEncryption: {
            key: crypto.randomBytes(32).toString('base64'),
          },
          providers: {
            mock: {
              enabled: true,
              clientId: 'test',
              clientSecret: 'test',
              callbackPath: '/callback',
            },
          },
        },
        pool,
      });

      // Allowed redirect
      assert.ok(
        serviceWithWhitelist.validateRedirectUri('http://localhost:3000/callback'),
        'Should allow whitelisted host'
      );

      // Disallowed redirect
      assert.throws(
        () => serviceWithWhitelist.validateRedirectUri('http://evil.com/callback'),
        OAuthError,
        'Should reject non-whitelisted host'
      );
    });
  });
});
