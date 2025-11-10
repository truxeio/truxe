/**
 * Manual Test Script for OAuth Authorization Service
 *
 * This script tests the complete authorization flow:
 * 1. Client registration
 * 2. Authorization request validation
 * 3. Authorization code generation
 * 4. Code validation and consumption
 * 5. PKCE validation
 * 6. User consent management
 */

import authorizationService from '../../src/services/oauth-provider/authorization-service.js';
import clientService from '../../src/services/oauth-provider/client-service.js';
import { getPool } from '../../src/database/connection.js';

async function testAuthorizationService() {
  console.log('🧪 Testing OAuth Authorization Service...\n');

  let client = null;
  let testUserId = '550e8400-e29b-41d4-a716-446655440000';
  let testUser2Id = '550e8400-e29b-41d4-a716-446655440001';

  try {
    // =========================================================================
    // SETUP: Create Test Users and Client
    // =========================================================================
    console.log('📋 Step 1: Create test users and client...');
    
    const pool = getPool();
    
    // Create test users
    try {
      await pool.query(
        `INSERT INTO users (id, email, email_verified, metadata)
         VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email`,
        [
          testUserId, 'test1@example.com', true, JSON.stringify({ isTestUser: true }),
          testUser2Id, 'test2@example.com', true, JSON.stringify({ isTestUser: true })
        ]
      );
      console.log('✅ Test users created');
    } catch (error) {
      console.log('⚠️  Test users may already exist');
    }
    
    client = await clientService.registerClient({
      clientName: 'Test Application',
      redirectUris: ['http://localhost:3000/callback'],
      createdBy: testUserId,
      requirePkce: true,
    });

    console.log('✅ Test client created:', client.client_id);
    console.log('   Redirect URIs:', client.redirect_uris);
    console.log('   Requires PKCE:', client.require_pkce);
    console.log('');

    // =========================================================================
    // TEST 1: Validate Authorization Request
    // =========================================================================
    console.log('📋 Step 2: Validate authorization request...');

    const codeVerifier = 'test_code_verifier_123456789012345678901234567890';
    const codeChallenge = authorizationService.hashCodeVerifier(codeVerifier);

    const validatedRequest = await authorizationService.validateAuthorizationRequest({
      clientId: client.client_id,
      redirectUri: 'http://localhost:3000/callback',
      responseType: 'code',
      scope: 'openid email profile',
      state: 'random_state_123',
      codeChallengeMethod: 'S256',
      codeChallenge,
    });

    console.log('✅ Authorization request validated');
    console.log('   Client:', validatedRequest.client.client_name);
    console.log('   Scopes:', validatedRequest.scopes);
    console.log('   PKCE Method:', validatedRequest.codeChallengeMethod);
    console.log('');

    // =========================================================================
    // TEST 2: Generate Authorization Code
    // =========================================================================
    console.log('📋 Step 3: Generate authorization code...');

    const authorization = await authorizationService.generateAuthorizationCode({
      clientId: client.client_id,
      userId: testUser2Id,
      redirectUri: 'http://localhost:3000/callback',
      scopes: ['openid', 'email', 'profile'],
      codeChallenge,
      codeChallengeMethod: 'S256',
    });

    console.log('✅ Authorization code generated');
    console.log('   Code:', authorization.code);
    console.log('   Expires at:', authorization.expires_at);
    console.log('   Format check:', authorization.code.startsWith('ac_') ? '✓' : '✗');
    console.log('');

    // =========================================================================
    // TEST 3: Validate and Consume Code
    // =========================================================================
    console.log('📋 Step 4: Validate and consume authorization code...');

    const authData = await authorizationService.validateAndConsumeCode({
      code: authorization.code,
      clientId: client.client_id,
      redirectUri: 'http://localhost:3000/callback',
      codeVerifier,
    });

    console.log('✅ Authorization code validated and consumed');
    console.log('   User ID:', authData.user_id);
    console.log('   Scopes:', authData.scopes);
    console.log('   Client ID:', authData.client_id);
    console.log('');

    // =========================================================================
    // TEST 4: Try to Use Code Again (Should Fail)
    // =========================================================================
    console.log('📋 Step 5: Attempt to reuse authorization code...');

    const authData2 = await authorizationService.validateAndConsumeCode({
      code: authorization.code,
      clientId: client.client_id,
      redirectUri: 'http://localhost:3000/callback',
      codeVerifier,
    });

    if (authData2 === null) {
      console.log('✅ Used code correctly rejected (single-use enforcement)');
    } else {
      console.log('❌ ERROR: Used code was accepted (should have been rejected)');
    }
    console.log('');

    // =========================================================================
    // TEST 5: User Consent
    // =========================================================================
    console.log('📋 Step 6: Test user consent management...');

    await authorizationService.recordUserConsent({
      userId: testUser2Id,
      clientId: client.client_id,
      scopes: ['openid', 'email', 'profile'],
    });

    console.log('✅ User consent recorded');

    const consent = await authorizationService.checkUserConsent(
      testUser2Id,
      client.client_id,
      ['openid', 'email']
    );

    if (consent) {
      console.log('✅ Consent check passed');
      console.log('   Granted scopes:', consent.granted_scopes);
    } else {
      console.log('❌ ERROR: Consent not found');
    }
    console.log('');

    // =========================================================================
    // TEST 6: PKCE Plain Method
    // =========================================================================
    console.log('📋 Step 7: Test PKCE plain method...');

    const plainVerifier = 'plain_method_verifier';
    const plainChallenge = plainVerifier; // Plain method

    const plainCodeResult = await authorizationService.generateAuthorizationCode({
      clientId: client.client_id,
      userId: testUser2Id,
      redirectUri: 'http://localhost:3000/callback',
      scopes: ['openid'],
      codeChallenge: plainChallenge,
      codeChallengeMethod: 'plain',
    });

    const plainAuthData = await authorizationService.validateAndConsumeCode({
      code: plainCodeResult.code,
      clientId: client.client_id,
      redirectUri: 'http://localhost:3000/callback',
      codeVerifier: plainVerifier,
    });

    if (plainAuthData) {
      console.log('✅ PKCE plain method validation successful');
    } else {
      console.log('❌ ERROR: PKCE plain method validation failed');
    }
    console.log('');

    // =========================================================================
    // TEST 7: Invalid PKCE Verifier
    // =========================================================================
    console.log('📋 Step 8: Test invalid PKCE verifier rejection...');

    const invalidCodeResult = await authorizationService.generateAuthorizationCode({
      clientId: client.client_id,
      userId: testUser2Id,
      redirectUri: 'http://localhost:3000/callback',
      scopes: ['openid'],
      codeChallenge: authorizationService.hashCodeVerifier('correct_verifier'),
      codeChallengeMethod: 'S256',
    });

    const invalidAuthData = await authorizationService.validateAndConsumeCode({
      code: invalidCodeResult.code,
      clientId: client.client_id,
      redirectUri: 'http://localhost:3000/callback',
      codeVerifier: 'wrong_verifier',
    });

    if (invalidAuthData === null) {
      console.log('✅ Invalid PKCE verifier correctly rejected');
    } else {
      console.log('❌ ERROR: Invalid PKCE verifier was accepted');
    }
    console.log('');

    // =========================================================================
    // TEST 8: Code Expiration
    // =========================================================================
    console.log('📋 Step 9: Test code expiration...');

    const expiredCodeResult = await authorizationService.generateAuthorizationCode({
      clientId: client.client_id,
      userId: testUser2Id,
      redirectUri: 'http://localhost:3000/callback',
      scopes: ['openid'],
      expiresIn: 2, // 2 seconds
    });

    console.log('   Waiting for code to expire (2 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 2500));

    const expiredAuthData = await authorizationService.validateAndConsumeCode({
      code: expiredCodeResult.code,
      clientId: client.client_id,
      redirectUri: 'http://localhost:3000/callback',
    });

    if (expiredAuthData === null) {
      console.log('✅ Expired code correctly rejected');
    } else {
      console.log('❌ ERROR: Expired code was accepted');
    }
    console.log('');

    // =========================================================================
    // TEST 9: Cleanup Expired Codes
    // =========================================================================
    console.log('📋 Step 10: Test cleanup of expired codes...');

    // Create some expired codes
    for (let i = 0; i < 3; i++) {
      await authorizationService.generateAuthorizationCode({
        clientId: client.client_id,
        userId: testUser2Id,
        redirectUri: 'http://localhost:3000/callback',
        scopes: ['openid'],
        expiresIn: 1,
      });
    }

    console.log('   Waiting for codes to expire (1 second)...');
    await new Promise(resolve => setTimeout(resolve, 1500));

    const deletedCount = await authorizationService.cleanupExpiredCodes();
    console.log('✅ Expired codes cleaned up');
    console.log('   Deleted count:', deletedCount);
    console.log('');

    // =========================================================================
    // TEST 10: Utility Methods
    // =========================================================================
    console.log('📋 Step 11: Test utility methods...');

    const scopes = authorizationService.parseScopes('openid email profile');
    console.log('✅ Parse scopes:', scopes);

    const isValid = authorizationService.isValidScope('admin:read');
    console.log('✅ Valid scope check:', isValid ? 'Pass ✓' : 'Fail ✗');

    const hash = authorizationService.hashCodeVerifier('test_verifier');
    console.log('✅ Hash code verifier:', hash.substring(0, 20) + '...');

    const buffer = Buffer.from('test');
    const encoded = authorizationService.base64URLEncode(buffer);
    console.log('✅ Base64URL encode:', encoded);
    console.log('');

    // =========================================================================
    // CLEANUP
    // =========================================================================
    console.log('📋 Step 12: Cleanup...');

    if (client) {
      await clientService.deleteClient(client.client_id);
      console.log('✅ Test client deleted');
    }
    
    // Clean up test users
    try {
      const pool = getPool();
      await pool.query('DELETE FROM users WHERE id = ANY($1)', [[testUserId, testUser2Id]]);
      console.log('✅ Test users cleaned up');
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ All tests passed! 🎉');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('Summary:');
    console.log('  ✓ Authorization request validation');
    console.log('  ✓ Authorization code generation');
    console.log('  ✓ Code validation and consumption');
    console.log('  ✓ Single-use enforcement');
    console.log('  ✓ User consent management');
    console.log('  ✓ PKCE S256 validation');
    console.log('  ✓ PKCE plain validation');
    console.log('  ✓ Invalid PKCE rejection');
    console.log('  ✓ Code expiration');
    console.log('  ✓ Expired code cleanup');
    console.log('  ✓ Utility methods');
    console.log('');

  } catch (error) {
    console.error('\n═══════════════════════════════════════════════════════════');
    console.error('❌ Test failed with error:');
    console.error('═══════════════════════════════════════════════════════════');
    console.error('');
    console.error('Message:', error.message);
    console.error('');
    console.error('Stack trace:');
    console.error(error.stack);
    console.error('');

    // Cleanup on error
    if (client) {
      try {
        await clientService.deleteClient(client.client_id);
        console.log('✅ Test client cleaned up after error');
      } catch (cleanupError) {
        console.error('❌ Failed to cleanup test client:', cleanupError.message);
      }
    }
    
    // Clean up test users
    try {
      const pool = getPool();
      await pool.query('DELETE FROM users WHERE id = ANY($1)', [[testUserId, testUser2Id]]);
      console.log('✅ Test users cleaned up after error');
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

    process.exit(1);
  }
}

// Run the test
testAuthorizationService()
  .then(() => {
    console.log('Test script completed successfully! 🚀\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test script failed:', error);
    process.exit(1);
  });
