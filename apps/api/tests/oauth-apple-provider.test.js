/**
 * Apple OAuth Provider Tests
 *
 * Comprehensive test suite for Apple OAuth 2.0 (Sign in with Apple) including:
 * - JWT client secret generation
 * - Authorization URL generation
 * - Token exchange
 * - User profile retrieval from ID token
 * - Token refresh
 * - Token revocation
 * - Error handling
 *
 * @requires-integration-test External API mocking required
 */

import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { AppleOAuthProvider } from '../src/services/oauth/providers/apple.js';
import { OAuthProviderError } from '../src/services/oauth/errors.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

describe('Apple OAuth Provider', { timeout: 10000 }, () => {
  let provider;
  let mockFetch;

  const testConfig = {
    clientId: 'com.example.app',
    teamId: 'ABC123DEFG',
    keyId: 'XYZ987WXYZ',
    // Mock ES256 private key (for testing only - not a real key)
    privateKey: `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgTest1234567890Test
1234567890Test1234567890ahRANCAAQTest1234567890Test1234567890Test12
34567890Test1234567890Test1234567890Test1234567890Test123456789=
-----END PRIVATE KEY-----`
  };

  before(() => {
    // Initialize Apple provider
    provider = new AppleOAuthProvider(testConfig);
  });

  beforeEach(() => {
    // Mock global fetch
    mockFetch = mock.fn(global, 'fetch');
  });

  afterEach(() => {
    // Restore mocks
    mockFetch.mock.restore();
  });

  describe('Configuration & Initialization', () => {
    it('should initialize with valid configuration', () => {
      const appleProvider = new AppleOAuthProvider(testConfig);

      assert.equal(appleProvider.id, 'apple');
      assert.equal(appleProvider.displayName, 'Apple');
      assert.equal(appleProvider.clientId, testConfig.clientId);
      assert.equal(appleProvider.teamId, testConfig.teamId);
      assert.equal(appleProvider.keyId, testConfig.keyId);
      assert.ok(appleProvider.authUrl);
      assert.ok(appleProvider.tokenUrl);
      assert.ok(appleProvider.revokeUrl);
    });

    it('should throw error when client ID is missing', () => {
      assert.throws(
        () => new AppleOAuthProvider({
          teamId: 'ABC123',
          keyId: 'XYZ987',
          privateKey: 'test-key'
        }),
        /Client ID.*is required/,
        'Should require client ID'
      );
    });

    it('should throw error when team ID is missing', () => {
      assert.throws(
        () => new AppleOAuthProvider({
          clientId: 'com.example.app',
          keyId: 'XYZ987',
          privateKey: 'test-key'
        }),
        /Team ID is required/,
        'Should require team ID'
      );
    });

    it('should throw error when key ID is missing', () => {
      assert.throws(
        () => new AppleOAuthProvider({
          clientId: 'com.example.app',
          teamId: 'ABC123',
          privateKey: 'test-key'
        }),
        /Key ID is required/,
        'Should require key ID'
      );
    });

    it('should throw error when private key is missing', () => {
      assert.throws(
        () => new AppleOAuthProvider({
          clientId: 'com.example.app',
          teamId: 'ABC123',
          keyId: 'XYZ987'
        }),
        /Private Key is required/,
        'Should require private key'
      );
    });

    it('should have correct default scopes', () => {
      assert.deepEqual(
        provider.defaultScopes,
        ['openid', 'email', 'name']
      );
    });

    it('should return provider info', () => {
      const info = provider.getProviderInfo();

      assert.equal(info.name, 'apple');
      assert.equal(info.displayName, 'Apple');
      assert.equal(info.features.openidConnect, true);
      assert.equal(info.features.privateEmailRelay, true);
    });
  });

  describe('JWT Client Secret Generation', () => {
    it('should generate valid JWT client secret', () => {
      const clientSecret = provider.generateClientSecret();

      assert.ok(clientSecret, 'Client secret should be generated');
      assert.equal(typeof clientSecret, 'string');

      // Decode JWT to verify structure
      const decoded = jwt.decode(clientSecret, { complete: true });
      assert.ok(decoded, 'JWT should be decodable');
      assert.equal(decoded.header.alg, 'ES256');
      assert.equal(decoded.header.kid, testConfig.keyId);
      assert.equal(decoded.payload.iss, testConfig.teamId);
      assert.equal(decoded.payload.sub, testConfig.clientId);
      assert.equal(decoded.payload.aud, 'https://appleid.apple.com');
    });

    it('should cache client secret', () => {
      const secret1 = provider.generateClientSecret();
      const secret2 = provider.generateClientSecret();

      // Should return same secret from cache
      assert.equal(secret1, secret2);
    });

    it('should set expiry for 180 days', () => {
      const clientSecret = provider.generateClientSecret();
      const decoded = jwt.decode(clientSecret);

      const expectedExpiry = decoded.iat + (86400 * 180);
      assert.equal(decoded.exp, expectedExpiry);
    });
  });

  describe('Authorization URL Generation', () => {
    it('should generate valid authorization URL', async () => {
      const params = {
        state: 'random-state-123',
        redirectUri: 'http://localhost:3001/auth/callback/apple',
        scopes: ['openid', 'email', 'name']
      };

      const authUrl = await provider.getAuthorizationUrl(params);
      const url = new URL(authUrl);

      assert.equal(url.origin + url.pathname, 'https://appleid.apple.com/auth/authorize');
      assert.equal(url.searchParams.get('client_id'), testConfig.clientId);
      assert.equal(url.searchParams.get('redirect_uri'), params.redirectUri);
      assert.equal(url.searchParams.get('response_type'), 'code');
      assert.equal(url.searchParams.get('response_mode'), 'form_post'); // Apple default
      assert.equal(url.searchParams.get('scope'), 'openid email name');
      assert.equal(url.searchParams.get('state'), params.state);
    });

    it('should use default scopes when none provided', async () => {
      const params = {
        state: 'random-state-123',
        redirectUri: 'http://localhost:3001/auth/callback/apple'
      };

      const authUrl = await provider.getAuthorizationUrl(params);
      const url = new URL(authUrl);

      assert.equal(url.searchParams.get('scope'), 'openid email name');
    });

    it('should support custom response mode', async () => {
      const params = {
        state: 'random-state-123',
        redirectUri: 'http://localhost:3001/auth/callback/apple',
        responseMode: 'query'
      };

      const authUrl = await provider.getAuthorizationUrl(params);
      const url = new URL(authUrl);

      assert.equal(url.searchParams.get('response_mode'), 'query');
    });
  });

  describe('Token Exchange', () => {
    it('should exchange authorization code for tokens successfully', async () => {
      const mockTokenResponse = {
        access_token: 'apple_access_token_123',
        refresh_token: 'apple_refresh_token_456',
        id_token: jwt.sign(
          {
            sub: 'apple_user_id_789',
            email: 'user@example.com',
            email_verified: 'true',
            is_private_email: 'false'
          },
          'test-secret'
        ),
        expires_in: 3600,
        token_type: 'Bearer'
      };

      mockFetch.mock.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse)
        })
      );

      const params = {
        code: 'auth_code_123',
        redirectUri: 'http://localhost:3001/auth/callback/apple'
      };

      const tokens = await provider.exchangeCodeForToken(params);

      assert.equal(tokens.accessToken, 'apple_access_token_123');
      assert.equal(tokens.refreshToken, 'apple_refresh_token_456');
      assert.ok(tokens.idToken);
      assert.equal(tokens.expiresIn, 3600);
    });

    it('should throw error when authorization code is missing', async () => {
      await assert.rejects(
        async () => await provider.exchangeCodeForToken({ redirectUri: 'http://example.com' }),
        OAuthProviderError,
        'Should throw OAuthProviderError'
      );
    });

    it('should throw error when redirect URI is missing', async () => {
      await assert.rejects(
        async () => await provider.exchangeCodeForToken({ code: 'test' }),
        OAuthProviderError,
        'Should throw OAuthProviderError'
      );
    });

    it('should handle invalid_grant error from Apple', async () => {
      mockFetch.mock.mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          json: () => Promise.resolve({
            error: 'invalid_grant',
            error_description: 'Authorization code is invalid or expired'
          })
        })
      );

      await assert.rejects(
        async () => await provider.exchangeCodeForToken({
          code: 'invalid_code',
          redirectUri: 'http://localhost:3001/auth/callback/apple'
        }),
        /invalid_grant/,
        'Should handle invalid_grant error'
      );
    });
  });

  describe('User Profile Retrieval', () => {
    it('should extract user profile from ID token', async () => {
      const idToken = jwt.sign(
        {
          sub: 'apple_user_123',
          email: 'user@example.com',
          email_verified: 'true',
          is_private_email: 'false'
        },
        'test-secret'
      );

      const profile = await provider.getUserProfile({
        accessToken: 'test_access_token',
        idToken,
        rawTokenResponse: {},
        state: {}
      });

      assert.equal(profile.id, 'apple_user_123');
      assert.equal(profile.email, 'user@example.com');
      assert.equal(profile.emailVerified, true);
      assert.equal(profile.isPrivateEmail, false);
    });

    it('should detect private email relay', async () => {
      const idToken = jwt.sign(
        {
          sub: 'apple_user_123',
          email: 'abc123@privaterelay.appleid.com',
          email_verified: 'true',
          is_private_email: 'true'
        },
        'test-secret'
      );

      const profile = await provider.getUserProfile({
        accessToken: 'test_access_token',
        idToken,
        rawTokenResponse: {},
        state: {}
      });

      assert.equal(profile.isPrivateEmail, true);
      assert.ok(profile.email.includes('privaterelay.appleid.com'));
    });

    it('should extract name from state on first authorization', async () => {
      const idToken = jwt.sign(
        {
          sub: 'apple_user_123',
          email: 'user@example.com',
          email_verified: 'true'
        },
        'test-secret'
      );

      const state = {
        user: JSON.stringify({
          name: {
            firstName: 'John',
            lastName: 'Doe'
          }
        })
      };

      const profile = await provider.getUserProfile({
        accessToken: 'test_access_token',
        idToken,
        rawTokenResponse: {},
        state
      });

      assert.equal(profile.firstName, 'John');
      assert.equal(profile.lastName, 'Doe');
      assert.equal(profile.name, 'John Doe');
    });

    it('should throw error when ID token is missing', async () => {
      await assert.rejects(
        async () => await provider.getUserProfile({
          accessToken: 'test_access_token',
          rawTokenResponse: {}
        }),
        OAuthProviderError,
        'Should require ID token'
      );
    });
  });

  describe('Token Refresh', () => {
    it('should refresh access token successfully', async () => {
      const mockRefreshResponse = {
        access_token: 'new_access_token_123',
        refresh_token: 'new_refresh_token_456',
        id_token: 'new_id_token',
        expires_in: 3600,
        token_type: 'Bearer'
      };

      mockFetch.mock.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockRefreshResponse)
        })
      );

      const tokens = await provider.refreshAccessToken({
        refreshToken: 'old_refresh_token',
        account: {}
      });

      assert.equal(tokens.accessToken, 'new_access_token_123');
      assert.equal(tokens.refreshToken, 'new_refresh_token_456');
    });

    it('should throw error when refresh token is missing', async () => {
      await assert.rejects(
        async () => await provider.refreshAccessToken({ account: {} }),
        OAuthProviderError,
        'Should require refresh token'
      );
    });
  });

  describe('Token Revocation', () => {
    it('should revoke token successfully', async () => {
      mockFetch.mock.mockImplementation(() =>
        Promise.resolve({
          ok: true
        })
      );

      await assert.doesNotReject(
        async () => await provider.revokeToken({
          token: 'test_token',
          tokenTypeHint: 'access_token',
          account: {}
        })
      );
    });

    it('should throw error when token is missing', async () => {
      await assert.rejects(
        async () => await provider.revokeToken({ account: {} }),
        OAuthProviderError,
        'Should require token'
      );
    });

    it('should handle revocation errors gracefully', async () => {
      mockFetch.mock.mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          json: () => Promise.resolve({
            error: 'invalid_token'
          })
        })
      );

      await assert.rejects(
        async () => await provider.revokeToken({
          token: 'invalid_token',
          account: {}
        }),
        /invalid_token/,
        'Should handle revocation errors'
      );
    });
  });

  describe('Profile Normalization', () => {
    it('should normalize Apple profile correctly', async () => {
      const rawProfile = {
        id: 'apple_user_123',
        email: 'user@example.com',
        emailVerified: true,
        isPrivateEmail: false,
        firstName: 'John',
        lastName: 'Doe'
      };

      const normalized = await provider.normalizeProfile(rawProfile);

      assert.equal(normalized.id, 'apple_user_123');
      assert.equal(normalized.email, 'user@example.com');
      assert.equal(normalized.emailVerified, true);
      assert.equal(normalized.firstName, 'John');
      assert.equal(normalized.lastName, 'Doe');
      assert.equal(normalized.name, 'John Doe');
      assert.equal(normalized.isPrivateEmail, false);
      assert.deepEqual(normalized.raw, rawProfile);
    });

    it('should handle missing optional fields', async () => {
      const rawProfile = {
        id: 'apple_user_123',
        email: 'user@example.com',
        emailVerified: true
      };

      const normalized = await provider.normalizeProfile(rawProfile);

      assert.equal(normalized.id, 'apple_user_123');
      assert.equal(normalized.email, 'user@example.com');
      assert.equal(normalized.firstName, undefined);
      assert.equal(normalized.lastName, undefined);
      assert.equal(normalized.name, undefined);
    });
  });
});
