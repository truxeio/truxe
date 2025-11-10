/**
 * OAuth Token Service - Manual Integration Tests
 *
 * End-to-end testing of token service functionality.
 * Tests full OAuth flow with real database and JWT operations.
 *
 * Prerequisites:
 * - Database is running and migrated
 * - Environment variables are configured
 * - Test OAuth client exists
 *
 * Usage:
 *   node api/tests/manual/test-token-service.js
 */

import tokenService from '../../src/services/oauth-provider/token-service.js';
import clientService from '../../src/services/oauth-provider/client-service.js';
import { getPool } from '../../src/database/connection.js';
import crypto from 'crypto';

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) {
  log(`✓ ${message}`, 'green');
}

function error(message) {
  log(`✗ ${message}`, 'red');
}

function info(message) {
  log(`ℹ ${message}`, 'blue');
}

function section(title) {
  log(`\n${'='.repeat(70)}`, 'bold');
  log(`${title}`, 'bold');
  log(`${'='.repeat(70)}`, 'bold');
}

// Test data
let testClientId;
let testUserId;
let testAccessToken;
let testRefreshToken;
let testJti;

async function setup() {
  section('Setup');
  
  try {
    const pool = getPool();

    // 1. Create test user
    info('Creating test user...');
    const userResult = await pool.query(`
      INSERT INTO users (
        email,
        email_verified,
        metadata,
        status
      ) VALUES (
        $1, $2, $3::jsonb, $4
      )
      ON CONFLICT (email) DO UPDATE
        SET email_verified = EXCLUDED.email_verified
      RETURNING id
    `, [
      'token-test@example.com',
      true,
      JSON.stringify({
        name: 'Token Test',
        given_name: 'Token',
        family_name: 'Test'
      }),
      'active',
    ]);

    testUserId = userResult.rows[0].id;
    success(`Created test user: ${testUserId}`);

    // 2. Create test OAuth client
    info('Creating test OAuth client...');
    const clientResult = await pool.query(`
      INSERT INTO oauth_clients (
        client_id,
        client_secret_hash,
        client_name,
        redirect_uris,
        allowed_scopes,
        grant_types,
        status
      ) VALUES (
        $1, $2, $3, $4::TEXT[], $5::TEXT[], $6::TEXT[], $7
      )
      ON CONFLICT (client_id) DO UPDATE
        SET status = EXCLUDED.status
      RETURNING client_id
    `, [
      'test-token-client',
      crypto.createHash('sha256').update('test-secret').digest('hex'),
      'Token Test Client',
      ['http://localhost:3000/callback'],
      ['openid', 'email', 'profile'],
      ['authorization_code', 'refresh_token'],
      'active',
    ]);

    testClientId = clientResult.rows[0].client_id;
    success(`Created test OAuth client: ${testClientId}`);

    log('');
    success('Setup completed successfully');

  } catch (err) {
    error(`Setup failed: ${err.message}`);
    throw err;
  }
}

async function testTokenGeneration() {
  section('Test 1: Token Generation');

  try {
    const userInfo = {
      email: 'token-test@example.com',
      email_verified: true,
      name: 'Token Test',
      given_name: 'Token',
      family_name: 'Test',
      picture: 'https://example.com/avatar.jpg',
      updated_at: new Date(),
    };

    info('Generating token pair...');
    const tokenResponse = await tokenService.generateTokenPair({
      clientId: testClientId,
      userId: testUserId,
      scope: 'openid email profile',
      userInfo,
    });

    success('Token pair generated successfully');

    // Validate response structure
    if (!tokenResponse.access_token) {
      throw new Error('Missing access_token');
    }
    success('Response contains access_token');

    if (!tokenResponse.refresh_token) {
      throw new Error('Missing refresh_token');
    }
    success('Response contains refresh_token');

    if (tokenResponse.token_type !== 'Bearer') {
      throw new Error('Invalid token_type');
    }
    success('token_type is Bearer');

    if (tokenResponse.expires_in !== 3600) {
      throw new Error('Invalid expires_in');
    }
    success('expires_in is 3600 seconds');

    if (tokenResponse.scope !== 'openid email profile') {
      throw new Error('Invalid scope');
    }
    success('scope matches requested scope');

    // Validate refresh token format
    if (!tokenResponse.refresh_token.match(/^rt_[A-Za-z0-9_-]{43}$/)) {
      throw new Error('Invalid refresh token format');
    }
    success('refresh_token has correct format');

    // Store tokens for later tests
    testAccessToken = tokenResponse.access_token;
    testRefreshToken = tokenResponse.refresh_token;

    // Decode JWT to get JTI
    const decoded = JSON.parse(
      Buffer.from(testAccessToken.split('.')[1], 'base64').toString()
    );
    testJti = decoded.jti;
    success(`JWT decoded, JTI: ${testJti.substring(0, 8)}...`);

    log('');
    success('Token generation test passed');

  } catch (err) {
    error(`Token generation test failed: ${err.message}`);
    throw err;
  }
}

async function testAccessTokenValidation() {
  section('Test 2: Access Token Validation');

  try {
    info('Verifying access token...');
    const decoded = await tokenService.verifyAccessToken(testAccessToken);

    success('Access token verified successfully');

    // Validate claims
    if (decoded.sub !== testUserId) {
      throw new Error('Invalid sub claim');
    }
    success(`sub claim matches user ID: ${testUserId}`);

    if (decoded.aud !== testClientId) {
      throw new Error('Invalid aud claim');
    }
    success(`aud claim matches client ID: ${testClientId}`);

    if (!decoded.iss) {
      throw new Error('Missing iss claim');
    }
    success(`iss claim present: ${decoded.iss}`);

    if (!decoded.exp) {
      throw new Error('Missing exp claim');
    }
    success(`exp claim present: ${new Date(decoded.exp * 1000).toISOString()}`);

    if (decoded.jti !== testJti) {
      throw new Error('Invalid jti claim');
    }
    success(`jti claim matches: ${testJti.substring(0, 8)}...`);

    // Validate user claims
    if (decoded.email !== 'token-test@example.com') {
      throw new Error('Invalid email claim');
    }
    success(`email claim present: ${decoded.email}`);

    if (!decoded.name) {
      throw new Error('Missing name claim');
    }
    success(`name claim present: ${decoded.name}`);

    log('');
    success('Access token validation test passed');

  } catch (err) {
    error(`Access token validation test failed: ${err.message}`);
    throw err;
  }
}

async function testTokenIntrospection() {
  section('Test 3: Token Introspection');

  try {
    info('Introspecting access token...');
    const introspection = await tokenService.introspectToken({
      token: testAccessToken,
      clientId: testClientId,
      tokenTypeHint: 'access_token',
    });

    if (!introspection.active) {
      throw new Error('Token should be active');
    }
    success('Token is active');

    if (introspection.scope !== 'openid email profile') {
      throw new Error('Invalid scope in introspection');
    }
    success(`Scope matches: ${introspection.scope}`);

    if (introspection.client_id !== testClientId) {
      throw new Error('Invalid client_id in introspection');
    }
    success(`client_id matches: ${introspection.client_id}`);

    if (introspection.sub !== testUserId) {
      throw new Error('Invalid sub in introspection');
    }
    success(`sub matches: ${testUserId}`);

    log('');
    success('Token introspection test passed');

  } catch (err) {
    error(`Token introspection test failed: ${err.message}`);
    throw err;
  }
}

async function testUserInfoEndpoint() {
  section('Test 4: UserInfo Endpoint');

  try {
    info('Fetching user info from token...');
    const userInfo = await tokenService.getUserInfoByToken(testAccessToken);

    if (!userInfo.sub) {
      throw new Error('Missing sub claim');
    }
    success(`sub claim present: ${userInfo.sub}`);

    if (!userInfo.email) {
      throw new Error('Missing email claim');
    }
    success(`email claim present: ${userInfo.email}`);

    if (!userInfo.name) {
      throw new Error('Missing name claim');
    }
    success(`name claim present: ${userInfo.name}`);

    if (userInfo.email_verified !== true) {
      throw new Error('email_verified should be true');
    }
    success('email_verified is true');

    log('');
    success('UserInfo endpoint test passed');

  } catch (err) {
    error(`UserInfo endpoint test failed: ${err.message}`);
    throw err;
  }
}

async function testRefreshTokenFlow() {
  section('Test 5: Refresh Token Flow');

  try {
    const oldRefreshToken = testRefreshToken;
    const oldAccessToken = testAccessToken;

    info('Waiting 2 seconds before refresh...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    info('Refreshing token...');
    const newTokenResponse = await tokenService.refreshToken({
      refreshToken: oldRefreshToken,
      clientId: testClientId,
    });

    success('Token refreshed successfully');

    // Validate new tokens are different
    if (newTokenResponse.access_token === oldAccessToken) {
      throw new Error('New access token should be different');
    }
    success('New access token is different');

    if (newTokenResponse.refresh_token === oldRefreshToken) {
      throw new Error('New refresh token should be different');
    }
    success('New refresh token is different (rotation)');

    // Update tokens
    testAccessToken = newTokenResponse.access_token;
    testRefreshToken = newTokenResponse.refresh_token;

    // Verify new access token works
    info('Verifying new access token...');
    const decoded = await tokenService.verifyAccessToken(testAccessToken);
    success('New access token is valid');

    // Try to use old refresh token (should fail)
    info('Attempting to reuse old refresh token...');
    try {
      await tokenService.refreshToken({
        refreshToken: oldRefreshToken,
        clientId: testClientId,
      });
      throw new Error('Old refresh token should be revoked');
    } catch (err) {
      if (err.message.includes('revoked')) {
        success('Old refresh token is correctly revoked');
      } else {
        throw err;
      }
    }

    log('');
    success('Refresh token flow test passed');

  } catch (err) {
    error(`Refresh token flow test failed: ${err.message}`);
    throw err;
  }
}

async function testScopeReduction() {
  section('Test 6: Scope Reduction');

  try {
    info('Refreshing token with reduced scope...');
    const tokenResponse = await tokenService.refreshToken({
      refreshToken: testRefreshToken,
      clientId: testClientId,
      scope: 'openid email', // Reduced from 'openid email profile'
    });

    success('Token refreshed with reduced scope');

    const decoded = JSON.parse(
      Buffer.from(tokenResponse.access_token.split('.')[1], 'base64').toString()
    );

    if (decoded.scope !== 'openid email') {
      throw new Error('Scope should be reduced');
    }
    success(`Scope reduced to: ${decoded.scope}`);

    // Should not have profile claims
    if (decoded.name) {
      throw new Error('Should not have name claim with reduced scope');
    }
    success('Profile claims not present (as expected)');

    // Update tokens
    testAccessToken = tokenResponse.access_token;
    testRefreshToken = tokenResponse.refresh_token;

    log('');
    success('Scope reduction test passed');

  } catch (err) {
    error(`Scope reduction test failed: ${err.message}`);
    throw err;
  }
}

async function testTokenRevocation() {
  section('Test 7: Token Revocation');

  try {
    info('Revoking access token...');
    await tokenService.revokeToken({
      token: testAccessToken,
      clientId: testClientId,
      tokenTypeHint: 'access_token',
    });

    success('Access token revoked');

    // Try to verify revoked token
    info('Attempting to verify revoked token...');
    try {
      await tokenService.verifyAccessToken(testAccessToken);
      throw new Error('Revoked token should not be valid');
    } catch (err) {
      if (err.message.includes('revoked')) {
        success('Revoked token correctly rejected');
      } else {
        throw err;
      }
    }

    // Introspection should return active=false
    info('Introspecting revoked token...');
    const introspection = await tokenService.introspectToken({
      token: testAccessToken,
      clientId: testClientId,
    });

    if (introspection.active === true) {
      throw new Error('Revoked token should be inactive');
    }
    success('Introspection returns active=false');

    // Revoke refresh token
    info('Revoking refresh token...');
    await tokenService.revokeToken({
      token: testRefreshToken,
      clientId: testClientId,
      tokenTypeHint: 'refresh_token',
    });

    success('Refresh token revoked');

    log('');
    success('Token revocation test passed');

  } catch (err) {
    error(`Token revocation test failed: ${err.message}`);
    throw err;
  }
}

async function testCleanup() {
  section('Test 8: Cleanup Functions');

  try {
    info('Running cleanup: delete expired tokens...');
    const expiredCount = await tokenService.deleteExpiredTokens();
    success(`Deleted ${expiredCount} expired tokens`);

    info('Running cleanup: delete old revoked tokens...');
    const revokedCount = await tokenService.deleteOldRevokedTokens();
    success(`Deleted ${revokedCount} old revoked tokens`);

    log('');
    success('Cleanup test passed');

  } catch (err) {
    error(`Cleanup test failed: ${err.message}`);
    throw err;
  }
}

async function cleanup() {
  section('Cleanup');

  try {
    const pool = getPool();

    // Delete test tokens
    info('Deleting test tokens...');
    await pool.query(`
      DELETE FROM oauth_provider_tokens
      WHERE client_id = $1
    `, [testClientId]);
    success('Test tokens deleted');

    // Delete test client
    info('Deleting test OAuth client...');
    await pool.query(`
      DELETE FROM oauth_clients
      WHERE client_id = $1
    `, [testClientId]);
    success('Test OAuth client deleted');

    // Delete test user
    info('Deleting test user...');
    await pool.query(`
      DELETE FROM users
      WHERE id = $1
    `, [testUserId]);
    success('Test user deleted');

    log('');
    success('Cleanup completed successfully');

  } catch (err) {
    error(`Cleanup failed: ${err.message}`);
    // Don't throw - cleanup is best effort
  }
}

async function runTests() {
  log(`\n${colors.bold}${colors.blue}OAuth Token Service - Manual Integration Tests${colors.reset}\n`);

  let testsPassed = 0;
  let testsFailed = 0;

  try {
    await setup();

    const tests = [
      { name: 'Token Generation', fn: testTokenGeneration },
      { name: 'Access Token Validation', fn: testAccessTokenValidation },
      { name: 'Token Introspection', fn: testTokenIntrospection },
      { name: 'UserInfo Endpoint', fn: testUserInfoEndpoint },
      { name: 'Refresh Token Flow', fn: testRefreshTokenFlow },
      { name: 'Scope Reduction', fn: testScopeReduction },
      { name: 'Token Revocation', fn: testTokenRevocation },
      { name: 'Cleanup Functions', fn: testCleanup },
    ];

    for (const test of tests) {
      try {
        await test.fn();
        testsPassed++;
      } catch (err) {
        testsFailed++;
        error(`Test "${test.name}" failed`);
        console.error(err);
      }
    }

    await cleanup();

  } catch (err) {
    error('Test suite failed during setup');
    console.error(err);
    process.exit(1);
  }

  // Summary
  section('Test Summary');
  log(`Total tests: ${testsPassed + testsFailed}`);
  log(`Passed: ${testsPassed}`, 'green');
  log(`Failed: ${testsFailed}`, testsFailed > 0 ? 'red' : 'green');

  if (testsFailed === 0) {
    log('\n🎉 All tests passed!', 'green');
    process.exit(0);
  } else {
    log('\n❌ Some tests failed', 'red');
    process.exit(1);
  }
}

// Run tests
runTests().catch(err => {
  error('Unexpected error running tests');
  console.error(err);
  process.exit(1);
});
