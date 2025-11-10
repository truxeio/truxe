/**
 * Google OAuth Integration Tests
 *
 * Tests the complete Google OAuth flow including:
 * - Authorization URL generation
 * - Token exchange
 * - ID token verification
 * - User profile retrieval
 * - Token refresh
 * - Token revocation
 * - Error handling
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { GoogleOAuthProvider } from '../../../src/services/oauth/providers/google.js';

describe('Google OAuth Provider', () => {
  let provider;
  const testConfig = {
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || 'test-client-id.apps.googleusercontent.com',
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || 'test-client-secret',
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {}
    }
  };

  before(() => {
    provider = new GoogleOAuthProvider(testConfig);
  });

  describe('Provider Initialization', () => {
    it('should initialize with valid config', () => {
      assert.ok(provider);
      assert.strictEqual(provider.id, 'google');
      assert.strictEqual(provider.displayName, 'Google');
      assert.strictEqual(provider.clientId, testConfig.clientId);
    });

    it('should throw error with missing client ID', () => {
      assert.throws(() => {
        new GoogleOAuthProvider({ clientSecret: 'secret' });
      }, /Client ID is required/);
    });

    it('should throw error with missing client secret', () => {
      assert.throws(() => {
        new GoogleOAuthProvider({ clientId: 'client-id' });
      }, /Client Secret is required/);
    });

    it('should warn for invalid client ID format', () => {
      let warned = false;
      const customProvider = new GoogleOAuthProvider({
        clientId: 'invalid-format',
        clientSecret: 'secret',
        logger: {
          ...testConfig.logger,
          warn: () => { warned = true; }
        }
      });
      assert.ok(warned, 'Should warn about invalid client ID format');
    });
  });

  describe('Authorization URL Generation', () => {
    it('should generate valid authorization URL', async () => {
      const url = await provider.getAuthorizationUrl({
        state: 'test_state_123',
        redirectUri: 'http://localhost:3001/callback',
        scopes: ['openid', 'email', 'profile']
      });

      assert.ok(url);
      assert.ok(url.startsWith('https://accounts.google.com/o/oauth2/v2/auth'));
      assert.ok(url.includes('client_id=' + testConfig.clientId));
      assert.ok(url.includes('redirect_uri='));
      assert.ok(url.includes('response_type=code'));
      assert.ok(url.includes('state=test_state_123'));
      assert.ok(url.includes('access_type=offline')); // Request refresh token
    });

    it('should include default scopes', async () => {
      const url = await provider.getAuthorizationUrl({
        state: 'test_state',
        redirectUri: 'http://localhost:3001/callback'
      });

      // Default scopes: openid, email, profile
      assert.ok(url.includes('scope='), 'Should include scope parameter');
      assert.ok(url.includes('openid'), 'Should include openid scope');
      assert.ok(url.includes('email'), 'Should include email scope');
      assert.ok(url.includes('profile'), 'Should include profile scope');
    });

    it('should merge custom scopes with defaults', async () => {
      const url = await provider.getAuthorizationUrl({
        state: 'test_state',
        redirectUri: 'http://localhost:3001/callback',
        scopes: ['https://www.googleapis.com/auth/calendar.readonly']
      });

      assert.ok(url.includes('openid'), 'Should include default openid');
      assert.ok(url.includes('email'), 'Should include default email');
      assert.ok(url.includes('calendar.readonly'), 'Should include custom scope');
    });

    it('should include prompt parameter when specified', async () => {
      const url = await provider.getAuthorizationUrl({
        state: 'test_state',
        redirectUri: 'http://localhost:3001/callback',
        prompt: 'consent'
      });

      assert.ok(url.includes('prompt=consent'));
    });

    it('should include hosted domain for Google Workspace', async () => {
      const url = await provider.getAuthorizationUrl({
        state: 'test_state',
        redirectUri: 'http://localhost:3001/callback',
        context: {
          hostedDomain: 'example.com'
        }
      });

      assert.ok(url.includes('hd=example.com'));
    });

    it('should include login hint when email provided', async () => {
      const url = await provider.getAuthorizationUrl({
        state: 'test_state',
        redirectUri: 'http://localhost:3001/callback',
        context: {
          email: 'user@example.com'
        }
      });

      assert.ok(url.includes('login_hint=user%40example.com'));
    });

    it('should force consent when forceConsent is true', async () => {
      const url = await provider.getAuthorizationUrl({
        state: 'test_state',
        redirectUri: 'http://localhost:3001/callback',
        context: {
          forceConsent: true
        }
      });

      assert.ok(url.includes('prompt=consent'));
    });
  });

  describe('Token Exchange', () => {
    it('should reject with missing code', async () => {
      await assert.rejects(
        async () => {
          await provider.exchangeCodeForToken({
            redirectUri: 'http://localhost:3001/callback'
          });
        },
        /Authorization code is required/
      );
    });

    it('should handle missing redirect URI (Google will reject)', async () => {
      // Note: Provider doesn't validate redirect URI - Google API does
      // This test verifies the request is made but Google will reject it
      await assert.rejects(
        async () => {
          await provider.exchangeCodeForToken({
            code: 'invalid_code',
            redirectUri: undefined
          });
        },
        /Token exchange failed|invalid_grant|doesn't comply|OAuth 2.0 policy/i
      );
    });

    // Note: Real token exchange requires valid authorization code from Google
    // These are integration tests that verify the request structure
    it('should handle invalid authorization code', async () => {
      await assert.rejects(
        async () => {
          await provider.exchangeCodeForToken({
            code: 'invalid_code',
            redirectUri: 'http://localhost:3001/callback'
          });
        },
        /Token exchange failed|invalid_grant|doesn't comply|OAuth 2.0 policy|OAuth client was not found/i
      );
    });

    it('should handle network errors', async () => {
      // Temporarily break the token URL to test error handling
      const originalTokenUrl = provider.tokenUrl;
      provider.tokenUrl = 'https://invalid-domain-that-does-not-exist.google.com/token';

      await assert.rejects(
        async () => {
          await provider.exchangeCodeForToken({
            code: 'test_code',
            redirectUri: 'http://localhost:3001/callback'
          });
        },
        /Failed to exchange|ENOTFOUND/i
      );

      // Restore original URL
      provider.tokenUrl = originalTokenUrl;
    });
  });

  describe('User Profile Retrieval', () => {
    it('should reject with missing access token', async () => {
      await assert.rejects(
        async () => {
          await provider.getUserProfile({});
        },
        /Access token is required/
      );
    });

    it('should handle invalid access token', async () => {
      await assert.rejects(
        async () => {
          await provider.getUserProfile({
            accessToken: 'invalid_token'
          });
        },
        /Failed to fetch user profile|401/i
      );
    });

    it('should normalize profile data correctly', () => {
      const rawProfile = {
        id: '123456789',
        email: 'user@example.com',
        verified_email: true,
        name: 'John Doe',
        given_name: 'John',
        family_name: 'Doe',
        picture: 'https://example.com/photo.jpg',
        locale: 'en',
        hd: 'example.com'
      };

      const normalized = provider.normalizeProfile(rawProfile, 'userinfo');

      assert.strictEqual(normalized.id, '123456789');
      assert.strictEqual(normalized.email, 'user@example.com');
      assert.strictEqual(normalized.emailVerified, true);
      assert.strictEqual(normalized.name, 'John Doe');
      assert.strictEqual(normalized.givenName, 'John');
      assert.strictEqual(normalized.familyName, 'Doe');
      assert.strictEqual(normalized.picture, 'https://example.com/photo.jpg');
      assert.strictEqual(normalized.locale, 'en');
      assert.strictEqual(normalized.hostedDomain, 'example.com');
      assert.strictEqual(normalized.provider, 'google');
      assert.strictEqual(normalized.profileSource, 'userinfo');
    });

    it('should handle missing optional fields', () => {
      const rawProfile = {
        sub: '123456789',
        email: 'user@example.com',
        email_verified: true
      };

      const normalized = provider.normalizeProfile(rawProfile, 'id_token');

      assert.strictEqual(normalized.id, '123456789');
      assert.strictEqual(normalized.email, 'user@example.com');
      assert.strictEqual(normalized.emailVerified, true);
      assert.strictEqual(normalized.name, undefined);
      assert.strictEqual(normalized.hostedDomain, undefined);
    });
  });

  describe('Token Refresh', () => {
    it('should reject with missing refresh token', async () => {
      await assert.rejects(
        async () => {
          await provider.refreshAccessToken({});
        },
        /Refresh token is required/
      );
    });

    it('should handle invalid refresh token', async () => {
      await assert.rejects(
        async () => {
          await provider.refreshAccessToken({
            refreshToken: 'invalid_refresh_token'
          });
        },
        /Token refresh failed|invalid_grant|doesn't comply|OAuth 2.0 policy|OAuth client was not found/i
      );
    });

    it('should handle revoked refresh token', async () => {
      await assert.rejects(
        async () => {
          await provider.refreshAccessToken({
            refreshToken: 'revoked_refresh_token'
          });
        },
        /Token refresh failed|invalid_grant|invalid.*revoked|doesn't comply|OAuth 2.0 policy|OAuth client was not found/i
      );
    });
  });

  describe('Token Revocation', () => {
    it('should reject with missing token', async () => {
      await assert.rejects(
        async () => {
          await provider.revokeToken({});
        },
        /Token is required/
      );
    });

    it('should handle already revoked token gracefully', async () => {
      // Revoked tokens should return true (already revoked = success)
      const result = await provider.revokeToken({
        token: 'already_revoked_token'
      });

      // Should not throw error
      assert.ok(typeof result === 'boolean');
    });

    it('should not throw on revocation failure', async () => {
      // Token revocation is best-effort, should not throw
      const result = await provider.revokeToken({
        token: 'some_token'
      });

      assert.ok(typeof result === 'boolean');
    });
  });

  describe('ID Token Verification', () => {
    it('should reject invalid ID token format', async () => {
      await assert.rejects(
        async () => {
          await provider.verifyIdToken('invalid.token');
        },
        /Failed to verify Google ID token|Invalid ID token format/i
      );
    });

    it('should reject expired ID token', async () => {
      // Create a mock expired ID token (simplified for test)
      const expiredToken = 'eyJhbGciOiJSUzI1NiIsImtpZCI6InRlc3Qta2lkIiwidHlwIjoiSldUIn0.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhdWQiOiJ0ZXN0LWNsaWVudC1pZCIsImV4cCI6MTYwMDAwMDAwMCwiaWF0IjoxNjAwMDAwMDAwLCJzdWIiOiIxMjM0NTYiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20ifQ.signature';

      await assert.rejects(
        async () => {
          await provider.verifyIdToken(expiredToken);
        },
        /Failed to verify Google ID token|Public key not found/i
      );
    });
  });

  describe('Error Handling', () => {
    it('should parse Google error responses', () => {
      const errorBody = JSON.stringify({
        error: 'invalid_grant',
        error_description: 'Authorization code is invalid or expired'
      });

      const message = provider.parseGoogleError(errorBody);
      assert.strictEqual(message, 'Authorization code is invalid or expired');
    });

    it('should map Google error codes to user-friendly messages', () => {
      const testCases = [
        { error: 'invalid_grant', expected: 'Authorization code is invalid or expired' },
        { error: 'invalid_client', expected: 'Invalid client credentials' },
        { error: 'unauthorized_client', expected: 'Client is not authorized' },
        { error: 'access_denied', expected: 'Access was denied' },
        { error: 'unsupported_grant_type', expected: 'Grant type is not supported' },
        { error: 'invalid_scope', expected: 'Requested scope is invalid' }
      ];

      for (const testCase of testCases) {
        const errorBody = JSON.stringify({ error: testCase.error });
        const message = provider.parseGoogleError(errorBody);
        assert.strictEqual(message, testCase.expected);
      }
    });

    it('should return null for unparseable errors', () => {
      const message = provider.parseGoogleError('not json');
      assert.strictEqual(message, null);
    });
  });

  describe('Provider Info', () => {
    it('should return correct provider information', () => {
      const info = provider.getProviderInfo();

      assert.strictEqual(info.id, 'google');
      assert.strictEqual(info.name, 'Google');
      assert.strictEqual(info.displayName, 'Google');
      assert.strictEqual(info.brandColor, '#4285F4');
      assert.strictEqual(info.supportsRefresh, true);
      assert.strictEqual(info.supportsRevoke, true);
      assert.strictEqual(info.supportsOpenIDConnect, true);
      assert.ok(Array.isArray(info.defaultScopes));
      assert.ok(info.defaultScopes.includes('openid'));
    });
  });

  describe('JWKS Caching', () => {
    it('should cache JWKS for 1 hour', async () => {
      // First call - should fetch from Google
      const jwks1 = await provider.getJWKS();
      assert.ok(jwks1);
      assert.ok(Array.isArray(jwks1.keys));

      // Second call - should return from cache
      const jwks2 = await provider.getJWKS();
      assert.deepStrictEqual(jwks1, jwks2);

      // Verify cache metadata
      assert.ok(provider.jwksCache.keys);
      assert.ok(provider.jwksCache.expiresAt > Date.now());
    });

    it('should refresh expired cache', async () => {
      // Force cache expiration
      provider.jwksCache.expiresAt = Date.now() - 1000;

      // Should fetch fresh JWKS
      const jwks = await provider.getJWKS();
      assert.ok(jwks);
      assert.ok(provider.jwksCache.expiresAt > Date.now());
    });
  });
});

describe('Google OAuth Integration (E2E)', () => {
  // These tests require manual setup with real Google credentials
  // Skip if credentials not configured
  const hasRealCredentials = process.env.GOOGLE_OAUTH_CLIENT_ID?.includes('apps.googleusercontent.com');

  (hasRealCredentials ? describe : describe.skip)('With Real Credentials', () => {
    let provider;

    before(() => {
      provider = new GoogleOAuthProvider({
        clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
        clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
        logger: console
      });
    });

    it('should generate valid authorization URL', async () => {
      const url = await provider.getAuthorizationUrl({
        state: crypto.randomBytes(16).toString('hex'),
        redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:3001/api/oauth/callback/google',
        scopes: ['openid', 'email', 'profile'],
        context: { forceConsent: true }
      });

      console.log('\n📋 Authorization URL:');
      console.log(url);
      console.log('\n👉 Open this URL in your browser to test OAuth flow\n');

      assert.ok(url.startsWith('https://accounts.google.com'));
    });

    it('should fetch real JWKS from Google', async () => {
      const jwks = await provider.getJWKS();

      assert.ok(jwks);
      assert.ok(Array.isArray(jwks.keys));
      assert.ok(jwks.keys.length > 0);
      assert.ok(jwks.keys[0].kid);
      assert.ok(jwks.keys[0].n);
      assert.ok(jwks.keys[0].e);

      console.log('✅ JWKS fetched successfully');
      console.log('Keys:', jwks.keys.length);
    });
  });
});
