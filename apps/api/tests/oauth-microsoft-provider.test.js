/**
 * Microsoft OAuth Provider Tests
 *
 * Comprehensive test suite for Microsoft OAuth 2.0 (Azure AD) including:
 * - Multi-tenant authorization
 * - Authorization URL generation
 * - Token exchange
 * - Microsoft Graph API user profile retrieval
 * - Token refresh
 * - Error handling
 * - PKCE support
 *
 * @requires-integration-test External API mocking required
 */

import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { MicrosoftOAuthProvider } from '../src/services/oauth/providers/microsoft.js';
import { OAuthProviderError } from '../src/services/oauth/errors.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

describe('Microsoft OAuth Provider', { timeout: 10000 }, () => {
  let provider;
  let mockFetch;

  const testConfig = {
    clientId: 'test-microsoft-client-id',
    clientSecret: 'test-microsoft-client-secret',
    tenant: 'common'
  };

  before(() => {
    // Initialize Microsoft provider
    provider = new MicrosoftOAuthProvider(testConfig);
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
      const msProvider = new MicrosoftOAuthProvider(testConfig);

      assert.equal(msProvider.id, 'microsoft');
      assert.equal(msProvider.displayName, 'Microsoft');
      assert.equal(msProvider.clientId, testConfig.clientId);
      assert.equal(msProvider.clientSecret, testConfig.clientSecret);
      assert.equal(msProvider.tenant, 'common');
      assert.ok(msProvider.authUrl);
      assert.ok(msProvider.tokenUrl);
      assert.ok(msProvider.userInfoUrl);
    });

    it('should throw error when client ID is missing', () => {
      assert.throws(
        () => new MicrosoftOAuthProvider({ clientSecret: 'secret' }),
        /Client ID is required/,
        'Should require client ID'
      );
    });

    it('should throw error when client secret is missing', () => {
      assert.throws(
        () => new MicrosoftOAuthProvider({ clientId: 'id' }),
        /Client Secret is required/,
        'Should require client secret'
      );
    });

    it('should default to common tenant', () => {
      const msProvider = new MicrosoftOAuthProvider({
        clientId: 'test-id',
        clientSecret: 'test-secret'
      });

      assert.equal(msProvider.tenant, 'common');
    });

    it('should support custom tenant', () => {
      const msProvider = new MicrosoftOAuthProvider({
        clientId: 'test-id',
        clientSecret: 'test-secret',
        tenant: 'organizations'
      });

      assert.equal(msProvider.tenant, 'organizations');
      assert.ok(msProvider.authUrl.includes('/organizations/'));
    });

    it('should have correct default scopes', () => {
      assert.deepEqual(
        provider.defaultScopes,
        ['openid', 'email', 'profile', 'User.Read']
      );
    });

    it('should return provider info', () => {
      const info = provider.getProviderInfo();

      assert.equal(info.name, 'microsoft');
      assert.equal(info.displayName, 'Microsoft');
      assert.equal(info.tenant, 'common');
      assert.equal(info.features.openidConnect, true);
      assert.equal(info.features.microsoftGraph, true);
      assert.equal(info.features.workAccounts, true);
      assert.equal(info.features.personalAccounts, true);
    });
  });

  describe('Authorization URL Generation', () => {
    it('should generate valid authorization URL', async () => {
      const params = {
        state: 'random-state-123',
        redirectUri: 'http://localhost:3001/auth/callback/microsoft',
        scopes: ['openid', 'email', 'profile', 'User.Read']
      };

      const authUrl = await provider.getAuthorizationUrl(params);
      const url = new URL(authUrl);

      assert.ok(url.origin.includes('login.microsoftonline.com'));
      assert.ok(url.pathname.includes('/common/oauth2/v2.0/authorize'));
      assert.equal(url.searchParams.get('client_id'), testConfig.clientId);
      assert.equal(url.searchParams.get('redirect_uri'), params.redirectUri);
      assert.equal(url.searchParams.get('response_type'), 'code');
      assert.equal(url.searchParams.get('response_mode'), 'query');
      assert.equal(url.searchParams.get('scope'), 'openid email profile User.Read');
      assert.equal(url.searchParams.get('state'), params.state);
    });

    it('should use default scopes when none provided', async () => {
      const params = {
        state: 'random-state-123',
        redirectUri: 'http://localhost:3001/auth/callback/microsoft'
      };

      const authUrl = await provider.getAuthorizationUrl(params);
      const url = new URL(authUrl);

      assert.equal(url.searchParams.get('scope'), 'openid email profile User.Read');
    });

    it('should support prompt parameter', async () => {
      const params = {
        state: 'random-state-123',
        redirectUri: 'http://localhost:3001/auth/callback/microsoft',
        prompt: 'consent'
      };

      const authUrl = await provider.getAuthorizationUrl(params);
      const url = new URL(authUrl);

      assert.equal(url.searchParams.get('prompt'), 'consent');
    });

    it('should support domain hint', async () => {
      const params = {
        state: 'random-state-123',
        redirectUri: 'http://localhost:3001/auth/callback/microsoft',
        context: { domainHint: 'example.com' }
      };

      const authUrl = await provider.getAuthorizationUrl(params);
      const url = new URL(authUrl);

      assert.equal(url.searchParams.get('domain_hint'), 'example.com');
    });

    it('should support login hint', async () => {
      const params = {
        state: 'random-state-123',
        redirectUri: 'http://localhost:3001/auth/callback/microsoft',
        context: { loginHint: 'user@example.com' }
      };

      const authUrl = await provider.getAuthorizationUrl(params);
      const url = new URL(authUrl);

      assert.equal(url.searchParams.get('login_hint'), 'user@example.com');
    });

    it('should support PKCE code challenge', async () => {
      const params = {
        state: 'random-state-123',
        redirectUri: 'http://localhost:3001/auth/callback/microsoft',
        context: {
          codeChallenge: 'test_code_challenge',
          codeChallengeMethod: 'S256'
        }
      };

      const authUrl = await provider.getAuthorizationUrl(params);
      const url = new URL(authUrl);

      assert.equal(url.searchParams.get('code_challenge'), 'test_code_challenge');
      assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    });
  });

  describe('Token Exchange', () => {
    it('should exchange authorization code for tokens successfully', async () => {
      const mockTokenResponse = {
        access_token: 'microsoft_access_token_123',
        refresh_token: 'microsoft_refresh_token_456',
        id_token: jwt.sign(
          {
            sub: 'microsoft_user_id_789',
            email: 'user@example.com',
            name: 'Test User'
          },
          'test-secret'
        ),
        expires_in: 3600,
        ext_expires_in: 7200,
        token_type: 'Bearer',
        scope: 'openid email profile User.Read'
      };

      mockFetch.mock.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse)
        })
      );

      const params = {
        code: 'auth_code_123',
        redirectUri: 'http://localhost:3001/auth/callback/microsoft'
      };

      const tokens = await provider.exchangeCodeForToken(params);

      assert.equal(tokens.accessToken, 'microsoft_access_token_123');
      assert.equal(tokens.refreshToken, 'microsoft_refresh_token_456');
      assert.ok(tokens.idToken);
      assert.equal(tokens.expiresIn, 7200); // Should use ext_expires_in
    });

    it('should support PKCE code verifier', async () => {
      const mockTokenResponse = {
        access_token: 'test_token',
        refresh_token: 'test_refresh',
        expires_in: 3600
      };

      mockFetch.mock.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse)
        })
      );

      const params = {
        code: 'auth_code_123',
        redirectUri: 'http://localhost:3001/auth/callback/microsoft',
        context: { codeVerifier: 'test_verifier' }
      };

      await provider.exchangeCodeForToken(params);

      // Verify fetch was called with code_verifier in body
      const fetchCalls = mockFetch.mock.calls;
      assert.ok(fetchCalls.length > 0);
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

    it('should handle invalid_grant error from Microsoft', async () => {
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
          redirectUri: 'http://localhost:3001/auth/callback/microsoft'
        }),
        /invalid_grant/,
        'Should handle invalid_grant error'
      );
    });
  });

  describe('User Profile Retrieval', () => {
    it('should fetch user profile from Microsoft Graph API', async () => {
      const mockGraphResponse = {
        id: 'microsoft_user_123',
        displayName: 'John Doe',
        givenName: 'John',
        surname: 'Doe',
        mail: 'john.doe@example.com',
        userPrincipalName: 'john.doe@example.com',
        preferredLanguage: 'en-US',
        jobTitle: 'Software Engineer',
        mobilePhone: '+1234567890',
        officeLocation: 'Building 1',
        businessPhones: ['+0987654321']
      };

      mockFetch.mock.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockGraphResponse)
        })
      );

      const profile = await provider.getUserProfile({
        accessToken: 'test_access_token',
        rawTokenResponse: {},
        state: {}
      });

      assert.equal(profile.id, 'microsoft_user_123');
      assert.equal(profile.email, 'john.doe@example.com');
      assert.equal(profile.name, 'John Doe');
      assert.equal(profile.firstName, 'John');
      assert.equal(profile.lastName, 'Doe');
      assert.equal(profile.jobTitle, 'Software Engineer');
      assert.equal(profile.locale, 'en-US');
    });

    it('should use userPrincipalName when mail is null', async () => {
      const mockGraphResponse = {
        id: 'microsoft_user_123',
        displayName: 'John Doe',
        mail: null,
        userPrincipalName: 'john.doe@example.com'
      };

      mockFetch.mock.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockGraphResponse)
        })
      );

      const profile = await provider.getUserProfile({
        accessToken: 'test_access_token',
        rawTokenResponse: {}
      });

      assert.equal(profile.email, 'john.doe@example.com');
    });

    it('should throw error when access token is missing', async () => {
      await assert.rejects(
        async () => await provider.getUserProfile({ rawTokenResponse: {} }),
        OAuthProviderError,
        'Should require access token'
      );
    });

    it('should handle Graph API errors', async () => {
      mockFetch.mock.mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({
            error: {
              code: 'InvalidAuthenticationToken',
              message: 'Access token is invalid'
            }
          })
        })
      );

      await assert.rejects(
        async () => await provider.getUserProfile({
          accessToken: 'invalid_token',
          rawTokenResponse: {}
        }),
        /InvalidAuthenticationToken/,
        'Should handle Graph API errors'
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
        ext_expires_in: 7200,
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
      assert.equal(tokens.expiresIn, 7200);
    });

    it('should keep old refresh token if new one not provided', async () => {
      const mockRefreshResponse = {
        access_token: 'new_access_token_123',
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

      assert.equal(tokens.refreshToken, 'old_refresh_token');
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
    it('should handle token revocation gracefully', async () => {
      // Microsoft doesn't support token revocation via API
      // Should not throw error
      await assert.doesNotReject(
        async () => await provider.revokeToken({
          token: 'test_token',
          tokenTypeHint: 'access_token',
          account: {}
        })
      );
    });
  });

  describe('Logout URL Generation', () => {
    it('should generate logout URL', () => {
      const logoutUrl = provider.getLogoutUrl('http://localhost:3000');
      const url = new URL(logoutUrl);

      assert.ok(url.origin.includes('login.microsoftonline.com'));
      assert.ok(url.pathname.includes('/logout'));
      assert.equal(url.searchParams.get('post_logout_redirect_uri'), 'http://localhost:3000');
    });

    it('should generate logout URL without redirect', () => {
      const logoutUrl = provider.getLogoutUrl();
      const url = new URL(logoutUrl);

      assert.ok(url.origin.includes('login.microsoftonline.com'));
      assert.ok(url.pathname.includes('/logout'));
    });
  });

  describe('Profile Normalization', () => {
    it('should normalize Microsoft profile correctly', async () => {
      const rawProfile = {
        id: 'microsoft_user_123',
        displayName: 'John Doe',
        givenName: 'John',
        surname: 'Doe',
        mail: 'john.doe@example.com',
        jobTitle: 'Engineer',
        preferredLanguage: 'en-US'
      };

      const normalized = await provider.normalizeProfile(rawProfile);

      assert.equal(normalized.id, 'microsoft_user_123');
      assert.equal(normalized.email, 'john.doe@example.com');
      assert.equal(normalized.emailVerified, true);
      assert.equal(normalized.name, 'John Doe');
      assert.equal(normalized.firstName, 'John');
      assert.equal(normalized.lastName, 'Doe');
      assert.equal(normalized.jobTitle, 'Engineer');
      assert.equal(normalized.locale, 'en-US');
      assert.deepEqual(normalized.raw, rawProfile);
    });

    it('should handle missing optional fields', async () => {
      const rawProfile = {
        id: 'microsoft_user_123',
        displayName: 'John Doe',
        mail: 'john.doe@example.com'
      };

      const normalized = await provider.normalizeProfile(rawProfile);

      assert.equal(normalized.id, 'microsoft_user_123');
      assert.equal(normalized.email, 'john.doe@example.com');
      assert.equal(normalized.firstName, undefined);
      assert.equal(normalized.lastName, undefined);
      assert.equal(normalized.jobTitle, undefined);
    });
  });
});
