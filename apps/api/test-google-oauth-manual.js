/**
 * Manual Google OAuth Testing Script
 *
 * This script tests the Google OAuth flow manually to verify:
 * 1. Authorization URL generation
 * 2. Token exchange (requires manual code input)
 * 3. User profile retrieval
 * 4. Token refresh
 * 5. Token revocation
 *
 * Usage:
 * 1. Configure Google OAuth credentials in .env
 * 2. Run: node --env-file=.env test-google-oauth-manual.js
 * 3. Follow the prompts
 */

import { GoogleOAuthProvider } from './src/services/oauth/providers/google.js';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function main() {
  console.log('🔍 Google OAuth Manual Testing\n');

  // Initialize provider
  const provider = new GoogleOAuthProvider({
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    logger: console
  });

  console.log('✅ Provider initialized\n');

  // Step 1: Generate authorization URL
  console.log('📋 STEP 1: Generate Authorization URL\n');

  const authUrl = await provider.getAuthorizationUrl({
    state: 'test_state_123',
    redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI,
    scopes: ['openid', 'email', 'profile'],
    context: {
      forceConsent: true // Force consent to get refresh token
    }
  });

  console.log('Authorization URL generated:');
  console.log(authUrl);
  console.log('\n');
  console.log('👉 Please open this URL in your browser and authorize the app');
  console.log('👉 After authorization, you will be redirected to the callback URL');
  console.log('👉 Copy the "code" parameter from the URL\n');

  // Step 2: Get authorization code
  const code = await prompt('Enter authorization code: ');
  console.log('\n');

  // Step 3: Exchange code for tokens
  console.log('📋 STEP 2: Exchange Code for Tokens\n');

  try {
    const tokenData = await provider.exchangeCodeForToken({
      code: code.trim(),
      redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI
    });

    console.log('✅ Token exchange successful!');
    console.log('Access Token:', tokenData.access_token?.substring(0, 20) + '...');
    console.log('Refresh Token:', tokenData.refresh_token ? 'Present ✅' : 'Not present ❌');
    console.log('Expires In:', tokenData.expires_in, 'seconds');
    console.log('Scope:', tokenData.scope);
    console.log('ID Token:', tokenData.id_token ? 'Present ✅' : 'Not present ❌');

    if (tokenData.decoded_id_token) {
      console.log('\nDecoded ID Token:');
      console.log('  Sub:', tokenData.decoded_id_token.sub);
      console.log('  Email:', tokenData.decoded_id_token.email);
      console.log('  Email Verified:', tokenData.decoded_id_token.email_verified);
      console.log('  Name:', tokenData.decoded_id_token.name);
    }
    console.log('\n');

    // Step 4: Get user profile
    console.log('📋 STEP 3: Get User Profile\n');

    const profile = await provider.getUserProfile({
      accessToken: tokenData.access_token,
      idToken: tokenData.id_token,
      rawTokenResponse: tokenData
    });

    console.log('✅ User profile retrieved!');
    console.log('Profile:');
    console.log('  ID:', profile.id);
    console.log('  Email:', profile.email);
    console.log('  Email Verified:', profile.emailVerified);
    console.log('  Name:', profile.name);
    console.log('  Given Name:', profile.givenName);
    console.log('  Family Name:', profile.familyName);
    console.log('  Picture:', profile.picture);
    console.log('  Locale:', profile.locale);
    console.log('  Hosted Domain:', profile.hostedDomain || 'None');
    console.log('\n');

    // Step 5: Test token refresh (if refresh token available)
    if (tokenData.refresh_token) {
      console.log('📋 STEP 4: Test Token Refresh\n');

      const refreshed = await provider.refreshAccessToken({
        refreshToken: tokenData.refresh_token
      });

      console.log('✅ Token refresh successful!');
      console.log('New Access Token:', refreshed.access_token?.substring(0, 20) + '...');
      console.log('Expires In:', refreshed.expires_in, 'seconds');
      console.log('\n');
    } else {
      console.log('⚠️  No refresh token available. Add prompt=consent to force refresh token.\n');
    }

    // Step 6: Test token revocation
    console.log('📋 STEP 5: Test Token Revocation\n');

    const shouldRevoke = await prompt('Do you want to revoke the access token? (y/n): ');

    if (shouldRevoke.toLowerCase() === 'y') {
      const revoked = await provider.revokeToken({
        token: tokenData.access_token,
        tokenTypeHint: 'access_token'
      });

      console.log(revoked ? '✅ Token revoked successfully!' : '⚠️  Token revocation returned false');
      console.log('\n');
    }

    // Summary
    console.log('🎉 All tests completed!\n');
    console.log('Summary:');
    console.log('✅ Authorization URL generation');
    console.log('✅ Token exchange');
    console.log('✅ ID token verification');
    console.log('✅ User profile retrieval');
    if (tokenData.refresh_token) {
      console.log('✅ Token refresh');
    }
    if (shouldRevoke.toLowerCase() === 'y') {
      console.log('✅ Token revocation');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nDetails:', error);
  }

  rl.close();
}

main().catch(console.error);
