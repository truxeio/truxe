/**
 * Unit Tests for OAuth Authorization Service
 *
 * Test Categories:
 * 1. Authorization Request Validation (10 tests)
 * 2. Authorization Code Generation (8 tests)
 * 3. Authorization Code Validation (12 tests)
 * 4. PKCE Validation (6 tests)
 * 5. User Consent Management (8 tests)
 * 6. Cleanup (4 tests)
 * 7. Utility Methods (6 tests)
 *
 * Total: 54 tests
 */

import authorizationService from '../../../src/services/oauth-provider/authorization-service.js';
import clientService from '../../../src/services/oauth-provider/client-service.js';
import { getPool } from '../../../src/database/connection.js';

describe('OAuth Authorization Service', () => {
  let testClient;
  let testUserId;
  let testUser;

  // Setup: Create test user and client
  beforeAll(async () => {
    const pool = getPool();
    
    // Create test user first (to satisfy foreign key)
    testUserId = '550e8400-e29b-41d4-a716-446655440000';
    
    try {
      const userResult = await pool.query(
        `INSERT INTO users (id, email, email_verified, metadata)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email
         RETURNING *`,
        [testUserId, 'test@example.com', true, JSON.stringify({ isTestUser: true })]
      );
      testUser = userResult.rows[0];
    } catch (error) {
      console.error('Error creating test user:', error.message);
    }

    testClient = await clientService.registerClient({
      clientName: 'Test OAuth Client',
      redirectUris: ['http://localhost:3000/callback', 'https://app.example.com/oauth/callback'],
      createdBy: testUserId,
      allowedScopes: ['openid', 'email', 'profile', 'admin'],
      requirePkce: true,
      requireConsent: true,
    });
  });

  // Cleanup: Delete test client and related data
  afterAll(async () => {
    if (testClient) {
      await clientService.deleteClient(testClient.client_id);
    }
    
    // Clean up test user
    if (testUserId) {
      const pool = getPool();
      try {
        await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  // ============================================================================
  // 1. AUTHORIZATION REQUEST VALIDATION (10 tests)
  // ============================================================================

  describe('Authorization Request Validation', () => {
    const validRequestParams = {
      clientId: null, // Set in beforeEach
      redirectUri: 'http://localhost:3000/callback',
      responseType: 'code',
      scope: 'openid email profile',
      state: 'random_state_123',
      codeChallengeMethod: 'S256',
      codeChallenge: 'test_challenge_123',
    };

    beforeEach(() => {
      validRequestParams.clientId = testClient.client_id;
    });

    test('should validate valid authorization request', async () => {
      const result = await authorizationService.validateAuthorizationRequest(validRequestParams);

      expect(result).toBeDefined();
      expect(result.client).toBeDefined();
      expect(result.clientId).toBe(testClient.client_id);
      expect(result.scopes).toEqual(['openid', 'email', 'profile']);
    });

    test('should reject invalid client ID', async () => {
      await expect(
        authorizationService.validateAuthorizationRequest({
          ...validRequestParams,
          clientId: 'invalid_client_id',
        })
      ).rejects.toThrow('Invalid client_id');
    });

    test('should reject suspended client', async () => {
      await clientService.suspendClient(testClient.client_id);

      await expect(
        authorizationService.validateAuthorizationRequest(validRequestParams)
      ).rejects.toThrow('Client is suspended');

      await clientService.activateClient(testClient.client_id);
    });

    test('should reject revoked client', async () => {
      await clientService.revokeClient(testClient.client_id);

      await expect(
        authorizationService.validateAuthorizationRequest(validRequestParams)
      ).rejects.toThrow('Client is revoked');

      await clientService.activateClient(testClient.client_id);
    });

    test('should reject invalid redirect URI', async () => {
      await expect(
        authorizationService.validateAuthorizationRequest({
          ...validRequestParams,
          redirectUri: 'http://evil.com/callback',
        })
      ).rejects.toThrow('Invalid redirect_uri');
    });

    test('should reject invalid response_type', async () => {
      await expect(
        authorizationService.validateAuthorizationRequest({
          ...validRequestParams,
          responseType: 'token',
        })
      ).rejects.toThrow('Invalid response_type');
    });

    test('should reject invalid scopes not allowed for client', async () => {
      await expect(
        authorizationService.validateAuthorizationRequest({
          ...validRequestParams,
          scope: 'openid email offline_access', // offline_access not in client's allowed scopes
        })
      ).rejects.toThrow('Scopes not allowed for this client');
    });

    test('should reject empty scope string', async () => {
      await expect(
        authorizationService.validateAuthorizationRequest({
          ...validRequestParams,
          scope: '',
        })
      ).rejects.toThrow('No scopes requested');
    });

    test('should reject scope with invalid characters', async () => {
      await expect(
        authorizationService.validateAuthorizationRequest({
          ...validRequestParams,
          scope: 'openid invalid-scope', // Dash is not allowed
        })
      ).rejects.toThrow('Invalid scope format');
    });

    test('should reject missing state parameter', async () => {
      await expect(
        authorizationService.validateAuthorizationRequest({
          ...validRequestParams,
          state: '',
        })
      ).rejects.toThrow('state parameter is required');
    });

    test('should reject missing code_challenge_method when code_challenge provided', async () => {
      await expect(
        authorizationService.validateAuthorizationRequest({
          ...validRequestParams,
          codeChallenge: 'some_challenge',
          codeChallengeMethod: null,
        })
      ).rejects.toThrow('code_challenge_method is required');
    });

    test('should reject missing PKCE when required', async () => {
      await expect(
        authorizationService.validateAuthorizationRequest({
          ...validRequestParams,
          codeChallenge: null,
        })
      ).rejects.toThrow('code_challenge is required');
    });

    test('should reject invalid PKCE method', async () => {
      await expect(
        authorizationService.validateAuthorizationRequest({
          ...validRequestParams,
          codeChallengeMethod: 'invalid',
        })
      ).rejects.toThrow('code_challenge_method must be "S256" or "plain"');
    });

    test('should accept request without PKCE when client does not require it', async () => {
      // Create client without PKCE requirement
      const noPkceClient = await clientService.registerClient({
        clientName: 'No PKCE Client',
        redirectUris: ['http://localhost:3000/callback'],
        createdBy: testUserId,
        requirePkce: false,
      });

      const result = await authorizationService.validateAuthorizationRequest({
        clientId: noPkceClient.client_id,
        redirectUri: 'http://localhost:3000/callback',
        responseType: 'code',
        scope: 'openid email',
        state: 'state_123',
        codeChallengeMethod: null,
        codeChallenge: null,
      });

      expect(result).toBeDefined();
      expect(result.codeChallenge).toBeNull();

      await clientService.deleteClient(noPkceClient.client_id);
    });
  });

  // ============================================================================
  // 2. AUTHORIZATION CODE GENERATION (8 tests)
  // ============================================================================

  describe('Authorization Code Generation', () => {
    test('should generate authorization code successfully', async () => {
      const result = await authorizationService.generateAuthorizationCode({
        clientId: testClient.client_id,
        userId: testUserId,
        redirectUri: 'http://localhost:3000/callback',
        scopes: ['openid', 'email', 'profile'],
        codeChallenge: 'test_challenge',
        codeChallengeMethod: 'S256',
      });

      expect(result).toBeDefined();
      expect(result.code).toBeDefined();
      expect(result.expires_at).toBeDefined();
      expect(typeof result.code).toBe('string');
      expect(result.code).toMatch(/^ac_/);
    });

    test('should generate code with correct format', async () => {
      const result = await authorizationService.generateAuthorizationCode({
        clientId: testClient.client_id,
        userId: testUserId,
        redirectUri: 'http://localhost:3000/callback',
        scopes: ['openid'],
      });

      // Format: ac_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
      expect(result.code).toMatch(/^ac_[A-Za-z0-9_-]{43}$/);
    });

    test('should generate unique codes', async () => {
      const codes = new Set();

      for (let i = 0; i < 100; i++) {
        const result = await authorizationService.generateAuthorizationCode({
          clientId: testClient.client_id,
          userId: testUserId,
          redirectUri: 'http://localhost:3000/callback',
          scopes: ['openid'],
        });

        codes.add(result.code);
      }

      expect(codes.size).toBe(100);
    });

    test('should set correct expiration timestamp', async () => {
      const beforeGeneration = Date.now();

      const result = await authorizationService.generateAuthorizationCode({
        clientId: testClient.client_id,
        userId: testUserId,
        redirectUri: 'http://localhost:3000/callback',
        scopes: ['openid'],
        expiresIn: 600,
      });

      const afterGeneration = Date.now();
      const expiresAt = new Date(result.expires_at).getTime();

      // Should expire in ~600 seconds (10 minutes)
      const expectedExpiration = beforeGeneration + 600 * 1000;
      const tolerance = 5000; // 5 seconds tolerance

      expect(expiresAt).toBeGreaterThanOrEqual(expectedExpiration - tolerance);
      expect(expiresAt).toBeLessThanOrEqual(afterGeneration + 600 * 1000 + tolerance);
    });

    test('should store code in database', async () => {
      const result = await authorizationService.generateAuthorizationCode({
        clientId: testClient.client_id,
        userId: testUserId,
        redirectUri: 'http://localhost:3000/callback',
        scopes: ['openid', 'email'],
      });

      const pool = getPool();
      const query = 'SELECT * FROM oauth_authorization_codes WHERE code = $1';
      const dbResult = await pool.query(query, [result.code]);

      expect(dbResult.rows.length).toBe(1);
      expect(dbResult.rows[0].client_id).toBe(testClient.client_id);
      expect(dbResult.rows[0].user_id).toBe(testUserId);
    });

    test('should store PKCE code_challenge', async () => {
      const result = await authorizationService.generateAuthorizationCode({
        clientId: testClient.client_id,
        userId: testUserId,
        redirectUri: 'http://localhost:3000/callback',
        scopes: ['openid'],
        codeChallenge: 'test_challenge_123',
        codeChallengeMethod: 'S256',
      });

      const pool = getPool();
      const query = 'SELECT * FROM oauth_authorization_codes WHERE code = $1';
      const dbResult = await pool.query(query, [result.code]);

      expect(dbResult.rows[0].code_challenge).toBe('test_challenge_123');
      expect(dbResult.rows[0].code_challenge_method).toBe('S256');
    });

    test('should store scopes as string', async () => {
      const result = await authorizationService.generateAuthorizationCode({
        clientId: testClient.client_id,
        userId: testUserId,
        redirectUri: 'http://localhost:3000/callback',
        scopes: ['openid', 'email', 'profile'],
      });

      const pool = getPool();
      const query = 'SELECT * FROM oauth_authorization_codes WHERE code = $1';
      const dbResult = await pool.query(query, [result.code]);

      expect(typeof dbResult.rows[0].scope).toBe('string');
      expect(dbResult.rows[0].scope).toBe('openid email profile');
    });

    test('should use default expiration of 10 minutes', async () => {
      const beforeGeneration = Date.now();

      const result = await authorizationService.generateAuthorizationCode({
        clientId: testClient.client_id,
        userId: testUserId,
        redirectUri: 'http://localhost:3000/callback',
        scopes: ['openid'],
      });

      const expiresAt = new Date(result.expires_at).getTime();
      const expectedExpiration = beforeGeneration + 600 * 1000; // 10 minutes

      expect(expiresAt).toBeGreaterThanOrEqual(expectedExpiration - 5000);
      expect(expiresAt).toBeLessThanOrEqual(expectedExpiration + 5000);
    });
  });

  // ============================================================================
  // 3. AUTHORIZATION CODE VALIDATION (12 tests)
  // ============================================================================

  describe('Authorization Code Validation', () => {
    let validCode;
    let validCodeVerifier;

    beforeEach(async () => {
      // Generate PKCE challenge
      validCodeVerifier = 'test_code_verifier_1234567890123456789012345678901234567890';
      const codeChallenge = authorizationService.hashCodeVerifier(validCodeVerifier);

      const result = await authorizationService.generateAuthorizationCode({
        clientId: testClient.client_id,
        userId: testUserId,
        redirectUri: 'http://localhost:3000/callback',
        scopes: ['openid', 'email'],
        codeChallenge,
        codeChallengeMethod: 'S256',
      });

      validCode = result.code;
    });

    test('should validate valid code', async () => {
      const result = await authorizationService.validateAndConsumeCode({
        code: validCode,
        clientId: testClient.client_id,
        redirectUri: 'http://localhost:3000/callback',
        codeVerifier: validCodeVerifier,
      });

      expect(result).not.toBeNull();
      expect(result.user_id).toBe(testUserId);
      expect(result.scopes).toEqual(['openid', 'email']);
    });

    test('should reject invalid code', async () => {
      const result = await authorizationService.validateAndConsumeCode({
        code: 'ac_invalid_code_123',
        clientId: testClient.client_id,
        redirectUri: 'http://localhost:3000/callback',
        codeVerifier: validCodeVerifier,
      });

      expect(result).toBeNull();
    });

    test('should reject expired code', async () => {
      // Generate code with 1 second expiration
      const expiredCodeResult = await authorizationService.generateAuthorizationCode({
        clientId: testClient.client_id,
        userId: testUserId,
        redirectUri: 'http://localhost:3000/callback',
        scopes: ['openid'],
        expiresIn: 1, // 1 second
      });

      // Wait for code to expire
      await new Promise(resolve => setTimeout(resolve, 1500));

      const result = await authorizationService.validateAndConsumeCode({
        code: expiredCodeResult.code,
        clientId: testClient.client_id,
        redirectUri: 'http://localhost:3000/callback',
      });

      expect(result).toBeNull();
    });

    test('should reject used code (single-use)', async () => {
      // Use code first time
      const result1 = await authorizationService.validateAndConsumeCode({
        code: validCode,
        clientId: testClient.client_id,
        redirectUri: 'http://localhost:3000/callback',
        codeVerifier: validCodeVerifier,
      });

      expect(result1).not.toBeNull();

      // Try to use code second time
      const result2 = await authorizationService.validateAndConsumeCode({
        code: validCode,
        clientId: testClient.client_id,
        redirectUri: 'http://localhost:3000/callback',
        codeVerifier: validCodeVerifier,
      });

      expect(result2).toBeNull();
    });

    test('should reject code with wrong client_id', async () => {
      const result = await authorizationService.validateAndConsumeCode({
        code: validCode,
        clientId: 'wrong_client_id',
        redirectUri: 'http://localhost:3000/callback',
        codeVerifier: validCodeVerifier,
      });

      expect(result).toBeNull();
    });

    test('should reject code with wrong redirect_uri', async () => {
      const result = await authorizationService.validateAndConsumeCode({
        code: validCode,
        clientId: testClient.client_id,
        redirectUri: 'http://evil.com/callback',
        codeVerifier: validCodeVerifier,
      });

      expect(result).toBeNull();
    });

    test('should mark code as used after validation', async () => {
      await authorizationService.validateAndConsumeCode({
        code: validCode,
        clientId: testClient.client_id,
        redirectUri: 'http://localhost:3000/callback',
        codeVerifier: validCodeVerifier,
      });

      const pool = getPool();
      const query = 'SELECT used_at FROM oauth_authorization_codes WHERE code = $1';
      const dbResult = await pool.query(query, [validCode]);

      expect(dbResult.rows[0].used_at).not.toBeNull();
    });

    test('should prevent code reuse', async () => {
      // Use code
      await authorizationService.validateAndConsumeCode({
        code: validCode,
        clientId: testClient.client_id,
        redirectUri: 'http://localhost:3000/callback',
        codeVerifier: validCodeVerifier,
      });

      // Try to use again
      const result = await authorizationService.validateAndConsumeCode({
        code: validCode,
        clientId: testClient.client_id,
        redirectUri: 'http://localhost:3000/callback',
        codeVerifier: validCodeVerifier,
      });

      expect(result).toBeNull();
    });

    test('should validate PKCE S256 correctly', async () => {
      const codeVerifier = 'test_pkce_verifier_1234567890123456789012345678901234567890';
      const codeChallenge = authorizationService.hashCodeVerifier(codeVerifier);

      const codeResult = await authorizationService.generateAuthorizationCode({
        clientId: testClient.client_id,
        userId: testUserId,
        redirectUri: 'http://localhost:3000/callback',
        scopes: ['openid'],
        codeChallenge,
        codeChallengeMethod: 'S256',
      });

      const result = await authorizationService.validateAndConsumeCode({
        code: codeResult.code,
        clientId: testClient.client_id,
        redirectUri: 'http://localhost:3000/callback',
        codeVerifier,
      });

      expect(result).not.toBeNull();
    });

    test('should validate PKCE plain correctly', async () => {
      const codeVerifier = 'test_plain_verifier';
      const codeChallenge = codeVerifier; // Plain method

      const codeResult = await authorizationService.generateAuthorizationCode({
        clientId: testClient.client_id,
        userId: testUserId,
        redirectUri: 'http://localhost:3000/callback',
        scopes: ['openid'],
        codeChallenge,
        codeChallengeMethod: 'plain',
      });

      const result = await authorizationService.validateAndConsumeCode({
        code: codeResult.code,
        clientId: testClient.client_id,
        redirectUri: 'http://localhost:3000/callback',
        codeVerifier,
      });

      expect(result).not.toBeNull();
    });

    test('should reject invalid PKCE S256 verifier', async () => {
      const result = await authorizationService.validateAndConsumeCode({
        code: validCode,
        clientId: testClient.client_id,
        redirectUri: 'http://localhost:3000/callback',
        codeVerifier: 'wrong_verifier',
      });

      expect(result).toBeNull();
    });

    test('should reject invalid PKCE plain verifier', async () => {
      const codeVerifier = 'correct_verifier';
      const codeChallenge = codeVerifier;

      const codeResult = await authorizationService.generateAuthorizationCode({
        clientId: testClient.client_id,
        userId: testUserId,
        redirectUri: 'http://localhost:3000/callback',
        scopes: ['openid'],
        codeChallenge,
        codeChallengeMethod: 'plain',
      });

      const result = await authorizationService.validateAndConsumeCode({
        code: codeResult.code,
        clientId: testClient.client_id,
        redirectUri: 'http://localhost:3000/callback',
        codeVerifier: 'wrong_verifier',
      });

      expect(result).toBeNull();
    });

    test('should reject code with missing verifier when PKCE required', async () => {
      const codeVerifier = 'test_verifier';
      const codeChallenge = authorizationService.hashCodeVerifier(codeVerifier);

      const codeResult = await authorizationService.generateAuthorizationCode({
        clientId: testClient.client_id,
        userId: testUserId,
        redirectUri: 'http://localhost:3000/callback',
        scopes: ['openid'],
        codeChallenge,
        codeChallengeMethod: 'S256',
      });

      // Try to validate without verifier
      const result = await authorizationService.validateAndConsumeCode({
        code: codeResult.code,
        clientId: testClient.client_id,
        redirectUri: 'http://localhost:3000/callback',
        codeVerifier: null, // Missing verifier
      });

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // 4. PKCE VALIDATION (6 tests)
  // ============================================================================

  describe('PKCE Validation', () => {
    test('should validate S256 method with correct verifier', () => {
      const codeVerifier = 'test_verifier_1234567890';
      const codeChallenge = authorizationService.hashCodeVerifier(codeVerifier);

      const isValid = authorizationService.validatePKCE(
        codeVerifier,
        codeChallenge,
        'S256'
      );

      expect(isValid).toBe(true);
    });

    test('should reject S256 method with incorrect verifier', () => {
      const codeVerifier = 'test_verifier_1234567890';
      const codeChallenge = authorizationService.hashCodeVerifier(codeVerifier);

      const isValid = authorizationService.validatePKCE(
        'wrong_verifier',
        codeChallenge,
        'S256'
      );

      expect(isValid).toBe(false);
    });

    test('should validate plain method with correct verifier', () => {
      const codeVerifier = 'test_plain_verifier';
      const codeChallenge = codeVerifier;

      const isValid = authorizationService.validatePKCE(
        codeVerifier,
        codeChallenge,
        'plain'
      );

      expect(isValid).toBe(true);
    });

    test('should reject plain method with incorrect verifier', () => {
      const codeVerifier = 'test_plain_verifier';
      const codeChallenge = codeVerifier;

      const isValid = authorizationService.validatePKCE(
        'wrong_verifier',
        codeChallenge,
        'plain'
      );

      expect(isValid).toBe(false);
    });

    test('should use correct Base64URL encoding', () => {
      const buffer = Buffer.from('test data');
      const encoded = authorizationService.base64URLEncode(buffer);

      // Should not contain +, /, or =
      expect(encoded).not.toContain('+');
      expect(encoded).not.toContain('/');
      expect(encoded).not.toContain('=');

      // Should be valid base64url
      expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    test('should generate correct SHA256 hash', () => {
      const codeVerifier = 'test_code_verifier';
      const hash = authorizationService.hashCodeVerifier(codeVerifier);

      // Should be base64url encoded
      expect(hash).toMatch(/^[A-Za-z0-9_-]+$/);

      // Hash should be consistent
      const hash2 = authorizationService.hashCodeVerifier(codeVerifier);
      expect(hash).toBe(hash2);
    });

    test('should reject PKCE validation with invalid method', () => {
      const codeVerifier = 'test_verifier';
      const codeChallenge = 'test_challenge';

      const isValid = authorizationService.validatePKCE(
        codeVerifier,
        codeChallenge,
        'invalid_method'
      );

      expect(isValid).toBe(false);
    });

    test('should handle timing-safe comparison with non-string inputs', () => {
      // This tests the timingSafeEqual edge case
      const isValid1 = authorizationService.validatePKCE(
        null,
        'challenge',
        'plain'
      );
      expect(isValid1).toBe(false);

      const isValid2 = authorizationService.validatePKCE(
        'verifier',
        null,
        'plain'
      );
      expect(isValid2).toBe(false);
    });

    test('should handle timing-safe comparison edge cases', () => {
      // Test with objects that will be converted to strings
      const result = authorizationService.validatePKCE(
        {},
        {},
        'plain'
      );
      expect(result).toBe(false);

      // Test with undefined
      const result2 = authorizationService.validatePKCE(
        undefined,
        'challenge',
        'plain'
      );
      expect(result2).toBe(false);
    });
  });

  // ============================================================================
  // 5. USER CONSENT MANAGEMENT (8 tests)
  // ============================================================================

  describe('User Consent Management', () => {
    let consentUserId;
    let consentUser;

    beforeAll(async () => {
      // Create a separate test user for consent tests
      const pool = getPool();
      consentUserId = '550e8400-e29b-41d4-a716-446655440001';
      
      try {
        const userResult = await pool.query(
          `INSERT INTO users (id, email, email_verified, metadata)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email
           RETURNING *`,
          [consentUserId, 'consent-test@example.com', true, JSON.stringify({ isTestUser: true })]
        );
        consentUser = userResult.rows[0];
      } catch (error) {
        console.error('Error creating consent test user:', error.message);
      }
    });

    afterEach(async () => {
      // Clean up consent records
      await authorizationService.revokeUserConsent(consentUserId, testClient.client_id);
    });

    afterAll(async () => {
      // Clean up consent test user
      if (consentUserId) {
        const pool = getPool();
        try {
          await pool.query('DELETE FROM users WHERE id = $1', [consentUserId]);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });

    test('should check existing consent', async () => {
      // Record consent
      await authorizationService.recordUserConsent({
        userId: consentUserId,
        clientId: testClient.client_id,
        scopes: ['openid', 'email', 'profile'],
      });

      // Check consent
      const consent = await authorizationService.checkUserConsent(
        consentUserId,
        testClient.client_id,
        ['openid', 'email']
      );

      expect(consent).not.toBeNull();
      expect(consent.user_id).toBe(consentUserId);
      expect(consent.client_id).toBe(testClient.client_id);
    });

    test('should return null for non-existent consent', async () => {
      const consent = await authorizationService.checkUserConsent(
        consentUserId,
        testClient.client_id,
        ['openid']
      );

      expect(consent).toBeNull();
    });

    test('should require new consent for additional scopes', async () => {
      // Record consent for limited scopes
      await authorizationService.recordUserConsent({
        userId: consentUserId,
        clientId: testClient.client_id,
        scopes: ['openid', 'email'],
      });

      // Check consent for additional scope
      const consent = await authorizationService.checkUserConsent(
        consentUserId,
        testClient.client_id,
        ['openid', 'email', 'profile'] // Requesting additional scope
      );

      expect(consent).toBeNull();
    });

    test('should use existing consent for subset of scopes', async () => {
      // Record consent for multiple scopes
      await authorizationService.recordUserConsent({
        userId: consentUserId,
        clientId: testClient.client_id,
        scopes: ['openid', 'email', 'profile'],
      });

      // Check consent for subset
      const consent = await authorizationService.checkUserConsent(
        consentUserId,
        testClient.client_id,
        ['openid', 'email'] // Subset of granted scopes
      );

      expect(consent).not.toBeNull();
    });

    test('should record new consent', async () => {
      const result = await authorizationService.recordUserConsent({
        userId: consentUserId,
        clientId: testClient.client_id,
        scopes: ['openid', 'email'],
      });

      expect(result).toBeDefined();
      expect(result.user_id).toBe(consentUserId);
      expect(result.client_id).toBe(testClient.client_id);
      expect(result.granted_scopes).toEqual(['openid', 'email']);
    });

    test('should update existing consent with new scopes', async () => {
      // Initial consent
      await authorizationService.recordUserConsent({
        userId: consentUserId,
        clientId: testClient.client_id,
        scopes: ['openid', 'email'],
      });

      // Update consent with additional scope
      const result = await authorizationService.recordUserConsent({
        userId: consentUserId,
        clientId: testClient.client_id,
        scopes: ['openid', 'email', 'profile'],
      });

      expect(result.granted_scopes).toEqual(['openid', 'email', 'profile']);
    });

    test('should revoke consent', async () => {
      // Record consent
      await authorizationService.recordUserConsent({
        userId: consentUserId,
        clientId: testClient.client_id,
        scopes: ['openid', 'email'],
      });

      // Revoke consent
      await authorizationService.revokeUserConsent(consentUserId, testClient.client_id);

      // Check consent is gone
      const consent = await authorizationService.checkUserConsent(
        consentUserId,
        testClient.client_id,
        ['openid']
      );

      expect(consent).toBeNull();
    });

    test('should require new authorization after revoked consent', async () => {
      // Record and revoke consent
      await authorizationService.recordUserConsent({
        userId: consentUserId,
        clientId: testClient.client_id,
        scopes: ['openid', 'email'],
      });

      await authorizationService.revokeUserConsent(consentUserId, testClient.client_id);

      // Try to check consent
      const consent = await authorizationService.checkUserConsent(
        consentUserId,
        testClient.client_id,
        ['openid', 'email']
      );

      expect(consent).toBeNull();
    });
  });

  // ============================================================================
  // 6. CLEANUP (4 tests)
  // ============================================================================

  describe('Cleanup', () => {
    test('should delete expired unused codes', async () => {
      // Generate expired code
      const expiredCode = await authorizationService.generateAuthorizationCode({
        clientId: testClient.client_id,
        userId: testUserId,
        redirectUri: 'http://localhost:3000/callback',
        scopes: ['openid'],
        expiresIn: 1, // 1 second
      });

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Cleanup
      const deletedCount = await authorizationService.cleanupExpiredCodes();

      expect(deletedCount).toBeGreaterThanOrEqual(1);

      // Verify code is deleted
      const pool = getPool();
      const query = 'SELECT * FROM oauth_authorization_codes WHERE code = $1';
      const result = await pool.query(query, [expiredCode.code]);

      expect(result.rows.length).toBe(0);
    });

    test('should keep non-expired codes', async () => {
      const validCode = await authorizationService.generateAuthorizationCode({
        clientId: testClient.client_id,
        userId: testUserId,
        redirectUri: 'http://localhost:3000/callback',
        scopes: ['openid'],
        expiresIn: 600, // 10 minutes
      });

      // Cleanup
      await authorizationService.cleanupExpiredCodes();

      // Verify code still exists
      const pool = getPool();
      const query = 'SELECT * FROM oauth_authorization_codes WHERE code = $1';
      const result = await pool.query(query, [validCode.code]);

      expect(result.rows.length).toBe(1);
    });

    test('should keep used codes for audit', async () => {
      // Generate and use code
      const codeResult = await authorizationService.generateAuthorizationCode({
        clientId: testClient.client_id,
        userId: testUserId,
        redirectUri: 'http://localhost:3000/callback',
        scopes: ['openid'],
        expiresIn: 1, // Will expire soon
      });

      // Use the code
      await authorizationService.validateAndConsumeCode({
        code: codeResult.code,
        clientId: testClient.client_id,
        redirectUri: 'http://localhost:3000/callback',
      });

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Cleanup
      await authorizationService.cleanupExpiredCodes();

      // Verify used code is still there (for audit)
      const pool = getPool();
      const query = 'SELECT * FROM oauth_authorization_codes WHERE code = $1';
      const result = await pool.query(query, [codeResult.code]);

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].used_at).not.toBeNull();
    });

    test('should return count of deleted codes', async () => {
      // Generate multiple expired codes
      for (let i = 0; i < 3; i++) {
        await authorizationService.generateAuthorizationCode({
          clientId: testClient.client_id,
          userId: testUserId,
          redirectUri: 'http://localhost:3000/callback',
          scopes: ['openid'],
          expiresIn: 1,
        });
      }

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Cleanup
      const deletedCount = await authorizationService.cleanupExpiredCodes();

      expect(deletedCount).toBeGreaterThanOrEqual(3);
    });
  });

  // ============================================================================
  // 7. UTILITY METHODS (6 tests)
  // ============================================================================

  describe('Utility Methods', () => {
    test('should parse scopes string', () => {
      const scopes = authorizationService.parseScopes('openid email profile');

      expect(scopes).toEqual(['openid', 'email', 'profile']);
    });

    test('should parse empty/null scopes', () => {
      expect(authorizationService.parseScopes('')).toEqual([]);
      expect(authorizationService.parseScopes(null)).toEqual([]);
      expect(authorizationService.parseScopes(undefined)).toEqual([]);
      expect(authorizationService.parseScopes('   ')).toEqual([]);
    });

    test('should validate valid scope format', () => {
      expect(authorizationService.isValidScope('openid')).toBe(true);
      expect(authorizationService.isValidScope('email')).toBe(true);
      expect(authorizationService.isValidScope('admin')).toBe(true);
      expect(authorizationService.isValidScope('admin_read')).toBe(true);
      expect(authorizationService.isValidScope('user_profile')).toBe(true);
    });

    test('should validate invalid scope format', () => {
      expect(authorizationService.isValidScope('invalid scope')).toBe(false);
      expect(authorizationService.isValidScope('invalid@scope')).toBe(false);
      expect(authorizationService.isValidScope('invalid-scope')).toBe(false);
      expect(authorizationService.isValidScope('')).toBe(false);
    });

    test('should hash code verifier using S256', () => {
      const codeVerifier = 'test_code_verifier_123';
      const hash = authorizationService.hashCodeVerifier(codeVerifier);

      // Should be base64url encoded
      expect(hash).toMatch(/^[A-Za-z0-9_-]+$/);

      // Should be consistent
      const hash2 = authorizationService.hashCodeVerifier(codeVerifier);
      expect(hash).toBe(hash2);

      // Should be different from input
      expect(hash).not.toBe(codeVerifier);
    });

    test('should encode Base64URL correctly', () => {
      const buffer = Buffer.from('hello world');
      const encoded = authorizationService.base64URLEncode(buffer);

      // Should not contain standard base64 characters
      expect(encoded).not.toContain('+');
      expect(encoded).not.toContain('/');
      expect(encoded).not.toContain('=');

      // Should only contain base64url characters
      expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });
});
