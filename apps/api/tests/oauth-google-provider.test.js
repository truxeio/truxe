/**
 * Google OAuth Provider Tests
 *
 * Comprehensive test suite for Google OAuth 2.0 implementation including:
 * - Authorization URL generation
 * - Token exchange
 * - User profile retrieval
 * - Token refresh
 * - Token revocation
 * - ID token verification (OpenID Connect)
 * - Error handling
 *
 * @requires-integration-test External API mocking required
 */

import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { GoogleOAuthProvider } from '../src/services/oauth/providers/google.js';
import { OAuthProviderError } from '../src/services/oauth/errors.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

describe('Google OAuth Provider', { timeout: 10000 }, () => {
  let provider;
  let mockFetch;

  const testConfig = {
    clientId: '123456789.apps.googleusercontent.com',
    clientSecret: 'test-client-secret',
    scopes: ['openid', 'email', 'profile']
  };

  before(() => {
    // Initialize Google provider
    provider = new GoogleOAuthProvider(testConfig);
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
      const googleProvider = new GoogleOAuthProvider(testConfig);

      assert.equal(googleProvider.id, 'google');
      assert.equal(googleProvider.displayName, 'Google');
      assert.equal(googleProvider.clientId, testConfig.clientId);
      assert.equal(googleProvider.clientSecret, testConfig.clientSecret);
      assert.ok(googleProvider.authUrl);
      assert.ok(googleProvider.tokenUrl);
      assert.ok(googleProvider.userInfoUrl);
    });

    it('should throw error when client ID is missing', () => {
      assert.throws(
        () => new GoogleOAuthProvider({ clientSecret: 'secret' }),
        /Client ID is required/,
        'Should require client ID'
      );
    });

    it('should throw error when client secret is missing', () => {
      assert.throws(
        () => new GoogleOAuthProvider({ clientId: 'id' }),
        /Client Secret is required/,
        'Should require client secret'
      );
    });

    it('should have correct default scopes', () => {
      assert.deepEqual(
        provider.defaultScopes,
        ['openid', 'email', 'profile']
      );
    });

    it('should return provider info', () => {
      const info = provider.getProviderInfo();

      assert.equal(info.id, 'google');
      assert.equal(info.name, 'Google');
      assert.equal(info.supportsRefresh, true);
      assert.equal(info.supportsRevoke, true);
      assert.equal(info.supportsOpenIDConnect, true);
    });
  });

  describe('Authorization URL Generation', () => {
    it('should generate valid authorization URL', async () => {
      const params = {
        state: 'random-state-123',
        redirectUri: 'http://localhost:3001/auth/callback/google',
        scopes: ['openid', 'email', 'profile']
      };

      const authUrl = await provider.getAuthorizationUrl(params);

      assert.ok(authUrl.startsWith('https://accounts.google.com/o/oauth2/v2/auth'));

      const url = new URL(authUrl);
      assert.equal(url.searchParams.get('client_id'), testConfig.clientId);
      assert.equal(url.searchParams.get('redirect_uri'), params.redirectUri);
      assert.equal(url.searchParams.get('response_type'), 'code');
      assert.equal(url.searchParams.get('state'), params.state);
      assert.equal(url.searchParams.get('access_type'), 'offline');
      assert.ok(url.searchParams.get('scope').includes('openid'));
      assert.ok(url.searchParams.get('scope').includes('email'));
      assert.ok(url.searchParams.get('scope').includes('profile'));
    });

    it('should include default scopes when none provided', async () => {
      const authUrl = await provider.getAuthorizationUrl({
        state: 'state',
        redirectUri: 'http://localhost:3001/callback'
      });

      const url = new URL(authUrl);
      const scopes = url.searchParams.get('scope').split(' ');

      assert.ok(scopes.includes('openid'));
      assert.ok(scopes.includes('email'));
      assert.ok(scopes.includes('profile'));
    });

    it('should merge custom scopes with defaults', async () => {
      const authUrl = await provider.getAuthorizationUrl({
        state: 'state',
        redirectUri: 'http://localhost:3001/callback',
        scopes: ['https://www.googleapis.com/auth/calendar.readonly']
      });

      const url = new URL(authUrl);
      const scopes = url.searchParams.get('scope').split(' ');

      // Should have both default and custom scopes
      assert.ok(scopes.includes('openid'));
      assert.ok(scopes.includes('email'));
      assert.ok(scopes.includes('https://www.googleapis.com/auth/calendar.readonly'));
    });

    it('should add prompt parameter when specified', async () => {
      const authUrl = await provider.getAuthorizationUrl({
        state: 'state',
        redirectUri: 'http://localhost:3001/callback',
        prompt: 'consent'
      });

      const url = new URL(authUrl);
      assert.equal(url.searchParams.get('prompt'), 'consent');
    });

    it('should add login_hint when email is provided', async () => {
      const authUrl = await provider.getAuthorizationUrl({
        state: 'state',
        redirectUri: 'http://localhost:3001/callback',
        context: {
          email: 'user@example.com'
        }
      });

      const url = new URL(authUrl);
      assert.equal(url.searchParams.get('login_hint'), 'user@example.com');
    });

    it('should add hosted domain restriction for Google Workspace', async () => {
      const authUrl = await provider.getAuthorizationUrl({
        state: 'state',
        redirectUri: 'http://localhost:3001/callback',
        context: {
          hostedDomain: 'company.com'
        }
      });

      const url = new URL(authUrl);
      assert.equal(url.searchParams.get('hd'), 'company.com');
    });

    it('should force consent when forceConsent is true', async () => {
      const authUrl = await provider.getAuthorizationUrl({
        state: 'state',
        redirectUri: 'http://localhost:3001/callback',
        context: {
          forceConsent: true
        }
      });

      const url = new URL(authUrl);
      assert.equal(url.searchParams.get('prompt'), 'consent');
    });
  });

  describe('Token Exchange', () => {
    it('should exchange authorization code for tokens successfully', async () => {
      const mockTokenResponse = {
        access_token: 'ya29.access_token_example',
        refresh_token: '1//refresh_token_example',
        expires_in: 3600,
        scope: 'openid email profile',
        token_type: 'Bearer',
        id_token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.mock_id_token'
      };

      mockFetch.mock.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse)
        })
      );

      const result = await provider.exchangeCodeForToken({
        code: 'test-auth-code',
        redirectUri: 'http://localhost:3001/callback'
      });

      assert.equal(result.access_token, mockTokenResponse.access_token);
      assert.equal(result.refresh_token, mockTokenResponse.refresh_token);
      assert.equal(result.expires_in, 3600);
      assert.ok(result.id_token);

      // Verify fetch was called with correct parameters
      const fetchCall = mockFetch.mock.calls[0];
      assert.equal(fetchCall.arguments[0], 'https://oauth2.googleapis.com/token');
      assert.equal(fetchCall.arguments[1].method, 'POST');
    });

    it('should throw error when authorization code is missing', async () => {
      await assert.rejects(
        async () => await provider.exchangeCodeForToken({
          redirectUri: 'http://localhost:3001/callback'
        }),
        OAuthProviderError,
        'Should require authorization code'
      );
    });

    it('should handle invalid_grant error from Google', async () => {
      mockFetch.mock.mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          text: () => Promise.resolve(JSON.stringify({
            error: 'invalid_grant',
            error_description: 'Code is invalid or expired'
          }))
        })
      );

      await assert.rejects(
        async () => await provider.exchangeCodeForToken({
          code: 'invalid-code',
          redirectUri: 'http://localhost:3001/callback'
        }),
        /invalid or expired/i,
        'Should handle invalid_grant error'
      );
    });

    it('should handle invalid_client error', async () => {
      mockFetch.mock.mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 401,
          text: () => Promise.resolve(JSON.stringify({
            error: 'invalid_client'
          }))
        })
      );

      await assert.rejects(
        async () => await provider.exchangeCodeForToken({
          code: 'valid-code',
          redirectUri: 'http://localhost:3001/callback'
        }),
        /invalid client credentials/i,
        'Should handle invalid_client error'
      );
    });

    it('should throw error when access token is missing in response', async () => {
      mockFetch.mock.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            // Missing access_token
            expires_in: 3600
          })
        })
      );

      await assert.rejects(
        async () => await provider.exchangeCodeForToken({
          code: 'test-code',
          redirectUri: 'http://localhost:3001/callback'
        }),
        /No access token/,
        'Should require access token in response'
      );
    });
  });

  describe('User Profile Retrieval', () => {
    it('should fetch user profile from UserInfo endpoint', async () => {
      const mockProfile = {
        id: 'google-user-123',
        email: 'user@gmail.com',
        verified_email: true,
        name: 'Test User',
        given_name: 'Test',
        family_name: 'User',
        picture: 'https://example.com/photo.jpg',
        locale: 'en'
      };

      mockFetch.mock.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockProfile)
        })
      );

      const profile = await provider.getUserProfile({
        accessToken: 'test-access-token'
      });

      assert.equal(profile.id, 'google-user-123');
      assert.equal(profile.email, 'user@gmail.com');
      assert.equal(profile.emailVerified, true);
      assert.equal(profile.name, 'Test User');
      assert.equal(profile.givenName, 'Test');
      assert.equal(profile.familyName, 'User');
      assert.equal(profile.picture, mockProfile.picture);
      assert.equal(profile.provider, 'google');

      // Verify fetch was called correctly
      const fetchCall = mockFetch.mock.calls[0];
      assert.equal(fetchCall.arguments[0], 'https://www.googleapis.com/oauth2/v2/userinfo');
      assert.ok(fetchCall.arguments[1].headers.Authorization.includes('test-access-token'));
    });

    it('should extract profile from verified ID token if available', async () => {
      const mockIdTokenPayload = {
        sub: 'google-user-456',
        email: 'user@example.com',
        email_verified: true,
        name: 'ID Token User',
        given_name: 'ID',
        family_name: 'User',
        picture: 'https://example.com/id-photo.jpg'
      };

      const profile = await provider.getUserProfile({
        accessToken: 'test-access-token',
        rawTokenResponse: {
          decoded_id_token: mockIdTokenPayload
        }
      });

      assert.equal(profile.id, 'google-user-456');
      assert.equal(profile.email, 'user@example.com');
      assert.equal(profile.profileSource, 'id_token');

      // Should not call UserInfo endpoint when ID token is available
      assert.equal(mockFetch.mock.calls.length, 0);
    });

    it('should throw error when access token is missing', async () => {
      await assert.rejects(
        async () => await provider.getUserProfile({}),
        /Access token is required/,
        'Should require access token'
      );
    });

    it('should handle UserInfo endpoint errors', async () => {
      mockFetch.mock.mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 401,
          text: () => Promise.resolve('Unauthorized')
        })
      );

      await assert.rejects(
        async () => await provider.getUserProfile({
          accessToken: 'invalid-token'
        }),
        OAuthProviderError,
        'Should handle UserInfo errors'
      );
    });
  });

  describe('Token Refresh', () => {
    it('should refresh access token successfully', async () => {
      const mockRefreshResponse = {
        access_token: 'new-access-token',
        expires_in: 3600,
        scope: 'openid email profile',
        token_type: 'Bearer'
      };

      mockFetch.mock.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockRefreshResponse)
        })
      );

      const result = await provider.refreshAccessToken({
        refreshToken: 'test-refresh-token'
      });

      assert.equal(result.access_token, 'new-access-token');
      assert.equal(result.expires_in, 3600);

      // Verify fetch was called correctly
      const fetchCall = mockFetch.mock.calls[0];
      const body = fetchCall.arguments[1].body;
      assert.ok(body.includes('grant_type=refresh_token'));
      assert.ok(body.includes('refresh_token=test-refresh-token'));
    });

    it('should throw error when refresh token is missing', async () => {
      await assert.rejects(
        async () => await provider.refreshAccessToken({}),
        /Refresh token is required/,
        'Should require refresh token'
      );
    });

    it('should handle invalid refresh token error', async () => {
      mockFetch.mock.mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          text: () => Promise.resolve(JSON.stringify({
            error: 'invalid_grant',
            error_description: 'Token has been expired or revoked'
          }))
        })
      );

      await assert.rejects(
        async () => await provider.refreshAccessToken({
          refreshToken: 'invalid-refresh-token'
        }),
        /invalid or revoked/i,
        'Should handle invalid refresh token'
      );
    });
  });

  describe('Token Revocation', () => {
    it('should revoke token successfully', async () => {
      mockFetch.mock.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 200
        })
      );

      const result = await provider.revokeToken({
        token: 'token-to-revoke'
      });

      assert.equal(result, true);

      // Verify fetch was called correctly
      const fetchCall = mockFetch.mock.calls[0];
      assert.equal(fetchCall.arguments[0], 'https://oauth2.googleapis.com/revoke');
      assert.ok(fetchCall.arguments[1].body.includes('token=token-to-revoke'));
    });

    it('should handle already revoked token as success', async () => {
      mockFetch.mock.mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 400 // Google returns 400 for already revoked tokens
        })
      );

      const result = await provider.revokeToken({
        token: 'already-revoked-token'
      });

      assert.equal(result, true, 'Should treat already revoked as success');
    });

    it('should return false on unexpected revocation errors', async () => {
      mockFetch.mock.mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 500
        })
      );

      const result = await provider.revokeToken({
        token: 'test-token'
      });

      assert.equal(result, false);
    });

    it('should return false on network errors', async () => {
      mockFetch.mock.mockImplementation(() =>
        Promise.reject(new Error('Network error'))
      );

      const result = await provider.revokeToken({
        token: 'test-token'
      });

      assert.equal(result, false, 'Should not throw on network errors');
    });
  });

  describe('Profile Normalization', () => {
    it('should normalize UserInfo profile correctly', () => {
      const rawProfile = {
        id: '123',
        email: 'user@example.com',
        verified_email: true,
        name: 'John Doe',
        given_name: 'John',
        family_name: 'Doe',
        picture: 'https://example.com/photo.jpg',
        locale: 'en-US',
        hd: 'company.com'
      };

      const normalized = provider.normalizeProfile(rawProfile, 'userinfo');

      assert.equal(normalized.id, '123');
      assert.equal(normalized.email, 'user@example.com');
      assert.equal(normalized.emailVerified, true);
      assert.equal(normalized.name, 'John Doe');
      assert.equal(normalized.givenName, 'John');
      assert.equal(normalized.familyName, 'Doe');
      assert.equal(normalized.picture, rawProfile.picture);
      assert.equal(normalized.locale, 'en-US');
      assert.equal(normalized.hostedDomain, 'company.com');
      assert.equal(normalized.provider, 'google');
      assert.equal(normalized.profileSource, 'userinfo');
    });

    it('should handle profile with sub instead of id', () => {
      const rawProfile = {
        sub: 'sub-456',
        email: 'user@example.com'
      };

      const normalized = provider.normalizeProfile(rawProfile);

      assert.equal(normalized.id, 'sub-456');
    });

    it('should handle missing optional fields gracefully', () => {
      const rawProfile = {
        sub: '789',
        email: 'minimal@example.com'
      };

      const normalized = provider.normalizeProfile(rawProfile);

      assert.equal(normalized.id, '789');
      assert.equal(normalized.email, 'minimal@example.com');
      assert.ok(!normalized.name);
      assert.ok(!normalized.picture);
    });
  });

  describe('Error Handling', () => {
    it('should parse Google error responses', () => {
      const errorBody = JSON.stringify({
        error: 'invalid_grant',
        error_description: 'Authorization code is invalid'
      });

      const errorMessage = provider.parseGoogleError(errorBody);
      assert.equal(errorMessage, 'Authorization code is invalid');
    });

    it('should map error codes to user-friendly messages', () => {
      const testCases = [
        { error: 'invalid_grant', expected: /invalid or expired/ },
        { error: 'invalid_client', expected: /invalid client/i },
        { error: 'access_denied', expected: /denied/ },
        { error: 'invalid_scope', expected: /scope is invalid/i }
      ];

      testCases.forEach(({ error, expected }) => {
        const errorBody = JSON.stringify({ error });
        const message = provider.parseGoogleError(errorBody);
        assert.match(message, expected);
      });
    });

    it('should handle non-JSON error responses', () => {
      const result = provider.parseGoogleError('Plain text error');
      assert.equal(result, null);
    });
  });

  describe('OpenID Connect (ID Token)', () => {
    it('should cache JWKS for performance', async () => {
      const mockJWKS = {
        keys: [
          {
            kid: 'test-key-id',
            kty: 'RSA',
            use: 'sig',
            n: 'test-modulus',
            e: 'AQAB'
          }
        ]
      };

      mockFetch.mock.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockJWKS)
        })
      );

      // First call should fetch
      const jwks1 = await provider.getJWKS();
      assert.deepEqual(jwks1, mockJWKS);
      assert.equal(mockFetch.mock.calls.length, 1);

      // Second call should use cache
      const jwks2 = await provider.getJWKS();
      assert.deepEqual(jwks2, mockJWKS);
      assert.equal(mockFetch.mock.calls.length, 1, 'Should not fetch again');
    });
  });
});
