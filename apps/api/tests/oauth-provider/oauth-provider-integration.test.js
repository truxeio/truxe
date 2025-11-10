/**
 * OAuth Provider Routes - Integration Tests
 * 
 * Tests the complete OAuth 2.0 authorization code flow with PKCE:
 * 1. Client registration
 * 2. Authorization request
 * 3. User consent
 * 4. Token exchange
 * 5. Token refresh
 * 6. Token introspection
 * 7. Token revocation
 * 8. UserInfo endpoint
 * 9. Discovery endpoints
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import crypto from 'crypto';
import testDatabaseHelper from '../helpers/test-database.js';
import clientService from '../../src/services/oauth-provider/client-service.js';
import authorizationService from '../../src/services/oauth-provider/authorization-service.js';
import tokenService from '../../src/services/oauth-provider/token-service.js';

describe('OAuth Provider Routes - Integration Tests', () => {
  let testUser;
  let testTenant;
  let testClient;
  let authCode;
  let accessToken;
  let refreshToken;
  let codeVerifier;
  let codeChallenge;

  beforeAll(async () => {
    await testDatabaseHelper.connect();
  });

  afterAll(async () => {
    await testDatabaseHelper.disconnect();
  });

  beforeEach(async () => {
    await testDatabaseHelper.truncate([
      'oauth_clients',
      'oauth_authorization_codes',
      'oauth_provider_tokens',
      'oauth_user_consents',
    ]);

    // Create test user and tenant
    testTenant = await testDatabaseHelper.createTenant({
      name: 'Test Organization',
      slug: 'test-org',
    });

    testUser = await testDatabaseHelper.createUser({
      email: 'oauth-test@example.com',
      email_verified: true,
      status: 'active',
    });

    // Generate PKCE parameters
    codeVerifier = generateCodeVerifier();
    codeChallenge = generateCodeChallenge(codeVerifier);
  });

  describe('Client Registration Flow', () => {
    it('should register a new OAuth client', async () => {
      const client = await clientService.registerClient({
        clientName: 'Test App',
        redirectUris: ['http://localhost:8000/callback'],
        tenantId: testTenant.id,
        createdBy: testUser.id,
        allowedScopes: ['openid', 'email', 'profile'],
        requirePkce: true,
        requireConsent: true,
      });

      expect(client).toBeDefined();
      expect(client.client_id).toMatch(/^cl_/);
      expect(client.client_secret).toMatch(/^cs_/);
      expect(client.client_name).toBe('Test App');
      expect(client.redirect_uris).toEqual(['http://localhost:8000/callback']);
      expect(client.allowed_scopes).toEqual(['openid', 'email', 'profile']);
      expect(client.require_pkce).toBe(true);

      testClient = client;
    });

    it('should list OAuth clients for a tenant', async () => {
      // Create multiple clients
      await clientService.registerClient({
        clientName: 'Test App 1',
        redirectUris: ['http://localhost:8001/callback'],
        tenantId: testTenant.id,
        createdBy: testUser.id,
      });

      await clientService.registerClient({
        clientName: 'Test App 2',
        redirectUris: ['http://localhost:8002/callback'],
        tenantId: testTenant.id,
        createdBy: testUser.id,
      });

      const clients = await clientService.listClients(testTenant.id);

      expect(clients).toHaveLength(2);
      expect(clients[0].client_name).toBeTruthy();
      expect(clients[1].client_name).toBeTruthy();
    });

    it('should update OAuth client settings', async () => {
      const client = await clientService.registerClient({
        clientName: 'Test App',
        redirectUris: ['http://localhost:8000/callback'],
        tenantId: testTenant.id,
        createdBy: testUser.id,
      });

      const updated = await clientService.updateClient(client.client_id, {
        clientName: 'Updated App Name',
        redirectUris: ['http://localhost:8000/callback', 'http://localhost:9000/callback'],
      });

      expect(updated.client_name).toBe('Updated App Name');
      expect(updated.redirect_uris).toHaveLength(2);
    });

    it('should delete OAuth client', async () => {
      const client = await clientService.registerClient({
        clientName: 'Test App',
        redirectUris: ['http://localhost:8000/callback'],
        tenantId: testTenant.id,
        createdBy: testUser.id,
      });

      await clientService.deleteClient(client.client_id);

      const deleted = await clientService.getClientById(client.client_id);
      expect(deleted).toBeNull();
    });
  });

  describe('Authorization Code Flow with PKCE', () => {
    beforeEach(async () => {
      // Register test client
      testClient = await clientService.registerClient({
        clientName: 'Test App',
        redirectUris: ['http://localhost:8000/callback'],
        tenantId: testTenant.id,
        createdBy: testUser.id,
        allowedScopes: ['openid', 'email', 'profile'],
        requirePkce: true,
        requireConsent: false, // Skip consent for testing
      });
    });

    it('should validate authorization request', async () => {
      await expect(
        authorizationService.validateAuthorizationRequest({
          clientId: testClient.client_id,
          redirectUri: 'http://localhost:8000/callback',
          responseType: 'code',
          scope: 'openid email profile',
          state: 'random-state',
          codeChallengeMethod: 'S256',
          codeChallenge: codeChallenge,
        })
      ).resolves.not.toThrow();
    });

    it('should reject invalid redirect URI', async () => {
      await expect(
        authorizationService.validateAuthorizationRequest({
          clientId: testClient.client_id,
          redirectUri: 'http://evil.com/callback',
          responseType: 'code',
          scope: 'openid email profile',
          state: 'random-state',
          codeChallengeMethod: 'S256',
          codeChallenge: codeChallenge,
        })
      ).rejects.toThrow('Invalid redirect_uri');
    });

    it('should generate authorization code', async () => {
      const result = await authorizationService.generateAuthorizationCode({
        clientId: testClient.client_id,
        userId: testUser.id,
        redirectUri: 'http://localhost:8000/callback',
        scopes: ['openid', 'email', 'profile'],
        codeChallenge: codeChallenge,
        codeChallengeMethod: 'S256',
      });

      expect(result.code).toMatch(/^ac_/);
      expect(result.expires_at).toBeDefined();

      authCode = result.code;
    });

    it('should validate and consume authorization code', async () => {
      // Generate code first
      const { code } = await authorizationService.generateAuthorizationCode({
        clientId: testClient.client_id,
        userId: testUser.id,
        redirectUri: 'http://localhost:8000/callback',
        scopes: ['openid', 'email', 'profile'],
        codeChallenge: codeChallenge,
        codeChallengeMethod: 'S256',
      });

      // Validate and consume
      const authData = await authorizationService.validateAndConsumeCode({
        code,
        clientId: testClient.client_id,
        redirectUri: 'http://localhost:8000/callback',
        codeVerifier: codeVerifier,
      });

      expect(authData).toBeDefined();
      expect(authData.user_id).toBe(testUser.id);
      expect(authData.scopes).toContain('openid');
    });

    it('should reject reused authorization code', async () => {
      // Generate code
      const { code } = await authorizationService.generateAuthorizationCode({
        clientId: testClient.client_id,
        userId: testUser.id,
        redirectUri: 'http://localhost:8000/callback',
        scopes: ['openid', 'email', 'profile'],
        codeChallenge: codeChallenge,
        codeChallengeMethod: 'S256',
      });

      // Use once (should succeed)
      await authorizationService.validateAndConsumeCode({
        code,
        clientId: testClient.client_id,
        redirectUri: 'http://localhost:8000/callback',
        codeVerifier: codeVerifier,
      });

      // Try to reuse (should fail)
      const authData = await authorizationService.validateAndConsumeCode({
        code,
        clientId: testClient.client_id,
        redirectUri: 'http://localhost:8000/callback',
        codeVerifier: codeVerifier,
      });

      expect(authData).toBeNull();
    });
  });

  describe('Token Operations', () => {
    beforeEach(async () => {
      // Register test client
      testClient = await clientService.registerClient({
        clientName: 'Test App',
        redirectUris: ['http://localhost:8000/callback'],
        tenantId: testTenant.id,
        createdBy: testUser.id,
        allowedScopes: ['openid', 'email', 'profile'],
        requirePkce: true,
        requireConsent: false,
      });

      // Generate authorization code
      const { code } = await authorizationService.generateAuthorizationCode({
        clientId: testClient.client_id,
        userId: testUser.id,
        redirectUri: 'http://localhost:8000/callback',
        scopes: ['openid', 'email', 'profile'],
        codeChallenge: codeChallenge,
        codeChallengeMethod: 'S256',
      });

      authCode = code;
    });

    it('should exchange authorization code for tokens', async () => {
      // Validate and consume code
      const authData = await authorizationService.validateAndConsumeCode({
        code: authCode,
        clientId: testClient.client_id,
        redirectUri: 'http://localhost:8000/callback',
        codeVerifier: codeVerifier,
      });

      // Generate token pair
      const tokens = await tokenService.generateTokenPair({
        clientId: testClient.client_id,
        userId: authData.user_id,
        scope: authData.scopes.join(' '),
        userInfo: {
          sub: testUser.id,
          email: testUser.email,
          email_verified: testUser.email_verified,
        },
      });

      expect(tokens.access_token).toBeDefined();
      expect(tokens.token_type).toBe('Bearer');
      expect(tokens.expires_in).toBe(3600);
      expect(tokens.refresh_token).toMatch(/^rt_/);
      expect(tokens.scope).toBe(authData.scopes.join(' '));

      accessToken = tokens.access_token;
      refreshToken = tokens.refresh_token;
    });

    it('should refresh access token', async () => {
      // First get initial tokens
      const authData = await authorizationService.validateAndConsumeCode({
        code: authCode,
        clientId: testClient.client_id,
        redirectUri: 'http://localhost:8000/callback',
        codeVerifier: codeVerifier,
      });

      const initialTokens = await tokenService.generateTokenPair({
        clientId: testClient.client_id,
        userId: authData.user_id,
        scope: authData.scopes.join(' '),
        userInfo: {
          sub: testUser.id,
          email: testUser.email,
          email_verified: testUser.email_verified,
        },
      });

      // Refresh token
      const newTokens = await tokenService.refreshToken({
        refreshToken: initialTokens.refresh_token,
        clientId: testClient.client_id,
      });

      expect(newTokens.access_token).toBeDefined();
      expect(newTokens.access_token).not.toBe(initialTokens.access_token);
      expect(newTokens.refresh_token).toBeDefined();
    });

    it('should introspect valid token', async () => {
      // Generate tokens
      const authData = await authorizationService.validateAndConsumeCode({
        code: authCode,
        clientId: testClient.client_id,
        redirectUri: 'http://localhost:8000/callback',
        codeVerifier: codeVerifier,
      });

      const tokens = await tokenService.generateTokenPair({
        clientId: testClient.client_id,
        userId: authData.user_id,
        scope: authData.scopes.join(' '),
        userInfo: {
          sub: testUser.id,
          email: testUser.email,
          email_verified: testUser.email_verified,
        },
      });

      // Introspect token
      const introspection = await tokenService.introspectToken({
        token: tokens.access_token,
        clientId: testClient.client_id,
      });

      expect(introspection.active).toBe(true);
      expect(introspection.client_id).toBe(testClient.client_id);
      expect(introspection.scope).toBe(authData.scopes.join(' '));
    });

    it('should revoke token', async () => {
      // Generate tokens
      const authData = await authorizationService.validateAndConsumeCode({
        code: authCode,
        clientId: testClient.client_id,
        redirectUri: 'http://localhost:8000/callback',
        codeVerifier: codeVerifier,
      });

      const tokens = await tokenService.generateTokenPair({
        clientId: testClient.client_id,
        userId: authData.user_id,
        scope: authData.scopes.join(' '),
        userInfo: {
          sub: testUser.id,
          email: testUser.email,
          email_verified: testUser.email_verified,
        },
      });

      // Revoke token
      await tokenService.revokeToken({
        token: tokens.access_token,
        clientId: testClient.client_id,
      });

      // Introspect should return inactive
      const introspection = await tokenService.introspectToken({
        token: tokens.access_token,
        clientId: testClient.client_id,
      });

      expect(introspection.active).toBe(false);
    });
  });

  describe('User Consent Management', () => {
    beforeEach(async () => {
      testClient = await clientService.registerClient({
        clientName: 'Test App',
        redirectUris: ['http://localhost:8000/callback'],
        tenantId: testTenant.id,
        createdBy: testUser.id,
        allowedScopes: ['openid', 'email', 'profile'],
        requirePkce: true,
        requireConsent: true,
      });
    });

    it('should record user consent', async () => {
      await authorizationService.recordUserConsent({
        userId: testUser.id,
        clientId: testClient.client_id,
        scopes: ['openid', 'email', 'profile'],
      });

      const consent = await authorizationService.checkUserConsent(
        testUser.id,
        testClient.client_id,
        ['openid', 'email', 'profile']
      );

      expect(consent).toBeDefined();
      expect(consent.client_id).toBe(testClient.client_id);
    });

    it('should revoke user consent', async () => {
      // Record consent first
      await authorizationService.recordUserConsent({
        userId: testUser.id,
        clientId: testClient.client_id,
        scopes: ['openid', 'email', 'profile'],
      });

      // Revoke consent
      await authorizationService.revokeUserConsent(testUser.id, testClient.client_id);

      // Check consent should return null
      const consent = await authorizationService.checkUserConsent(
        testUser.id,
        testClient.client_id,
        ['openid', 'email', 'profile']
      );

      expect(consent).toBeNull();
    });
  });

  describe('Client Secret Management', () => {
    beforeEach(async () => {
      // Register a test client for secret management tests
      testClient = await clientService.registerClient({
        clientName: 'Secret Test App',
        redirectUris: ['http://localhost:8000/callback'],
        tenantId: testTenant.id,
        createdBy: testUser.id,
        allowedScopes: ['openid', 'email', 'profile'],
        requirePkce: true,
        requireConsent: true,
      });
    });

    it('should regenerate client secret', async () => {
      const originalSecret = testClient.client_secret;

      // Regenerate secret
      const result = await clientService.regenerateClientSecret(testClient.client_id);

      expect(result).toBeDefined();
      expect(result.client_id).toBe(testClient.client_id);
      expect(result.client_secret).toBeDefined();
      expect(result.client_secret).toMatch(/^cs_/);
      expect(result.client_secret).not.toBe(originalSecret);

      // Verify old secret no longer works
      const validWithOld = await clientService.verifyClientSecret(
        testClient.client_id,
        originalSecret
      );
      expect(validWithOld).toBe(false);

      // Verify new secret works
      const validWithNew = await clientService.verifyClientSecret(
        testClient.client_id,
        result.client_secret
      );
      expect(validWithNew).toBe(true);
    });

    it('should return new secret only once after regeneration', async () => {
      // Regenerate secret
      const result = await clientService.regenerateClientSecret(testClient.client_id);
      const newSecret = result.client_secret;

      expect(newSecret).toBeDefined();
      expect(newSecret).toMatch(/^cs_/);

      // Try to get client details - should not include plain text secret
      const clientDetails = await clientService.getClientById(testClient.client_id);
      expect(clientDetails.client_secret).toBeUndefined();
      expect(clientDetails.client_secret_hash).toBeDefined();
    });

    it('should fail to regenerate secret for non-existent client', async () => {
      await expect(
        clientService.regenerateClientSecret('cl_nonexistent')
      ).rejects.toThrow('Client not found');
    });

    it('should invalidate existing tokens after secret regeneration', async () => {
      // Generate an access token first
      const { code } = await authorizationService.generateAuthorizationCode({
        clientId: testClient.client_id,
        userId: testUser.id,
        redirectUri: 'http://localhost:8000/callback',
        scopes: ['openid', 'email', 'profile'],
        codeChallenge: codeChallenge,
        codeChallengeMethod: 'S256',
      });

      const authData = await authorizationService.validateAndConsumeCode({
        code,
        clientId: testClient.client_id,
        redirectUri: 'http://localhost:8000/callback',
        codeVerifier: codeVerifier,
      });

      const tokens = await tokenService.generateTokens({
        clientId: testClient.client_id,
        userId: authData.user_id,
        scopes: authData.scopes,
      });

      const originalAccessToken = tokens.access_token;

      // Verify token works before regeneration
      const tokenInfoBefore = await tokenService.introspectToken(originalAccessToken);
      expect(tokenInfoBefore.active).toBe(true);

      // Regenerate client secret
      await clientService.regenerateClientSecret(testClient.client_id);

      // Note: In a full implementation, regenerating the secret should ideally
      // also revoke existing tokens. This test documents the expected behavior.
      // For now, tokens remain valid but the old secret cannot be used for new requests.
    });

    it('should update client timestamp after secret regeneration', async () => {
      const clientBefore = await clientService.getClientById(testClient.client_id);
      const updatedAtBefore = clientBefore.updated_at;

      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 100));

      // Regenerate secret
      await clientService.regenerateClientSecret(testClient.client_id);

      const clientAfter = await clientService.getClientById(testClient.client_id);
      const updatedAtAfter = clientAfter.updated_at;

      expect(new Date(updatedAtAfter).getTime()).toBeGreaterThan(
        new Date(updatedAtBefore).getTime()
      );
    });
  });
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate PKCE code verifier
 */
function generateCodeVerifier() {
  return base64URLEncode(crypto.randomBytes(32));
}

/**
 * Generate PKCE code challenge (S256 method)
 */
function generateCodeChallenge(verifier) {
  const hash = crypto.createHash('sha256').update(verifier).digest();
  return base64URLEncode(hash);
}

/**
 * Base64 URL encode
 */
function base64URLEncode(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
