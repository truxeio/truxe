/**
 * Setup OAuth Test Client for Performance Testing
 *
 * This script registers an OAuth client application in Truxe
 * for use in k6 performance testing.
 *
 * Usage:
 *   node setup-test-client.js
 *
 * Environment Variables:
 *   API_URL - Truxe API URL (default: http://localhost:3001)
 *   ADMIN_TOKEN - Admin authentication token (required)
 */

import http from 'http';
import https from 'https';
import { URL } from 'url';

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3001';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'test-admin-token';

const CLIENT_DATA = {
  client_name: 'Performance Testing Client',
  redirect_uris: [
    'http://localhost:3000/callback',
    'http://localhost:8080/callback',
  ],
  allowed_scopes: ['openid', 'email', 'profile'],
  require_pkce: true,
  require_consent: false, // Skip consent for faster testing
  trusted: true, // Trust this client for automated testing
  client_uri: 'http://localhost:3000',
};

/**
 * Make HTTP request
 */
function makeRequest(url, options, data = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = protocol.request(requestOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

/**
 * Check API health
 */
async function checkHealth() {
  console.log('🔍 Checking API health...');
  try {
    const response = await makeRequest(`${API_URL}/health`, { method: 'GET' });

    if (response.status === 200) {
      console.log('✅ API is healthy');
      console.log(`   Status: ${response.data.status}`);
      console.log(`   Version: ${response.data.version}`);
      return true;
    } else {
      console.error(`❌ API health check failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Cannot connect to API: ${error.message}`);
    return false;
  }
}

/**
 * Register OAuth client
 */
async function registerClient() {
  console.log('\n📝 Registering OAuth test client...');

  try {
    const response = await makeRequest(
      `${API_URL}/api/oauth/clients`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ADMIN_TOKEN}`,
        },
      },
      CLIENT_DATA
    );

    if (response.status === 201 || response.status === 200) {
      console.log('✅ OAuth client registered successfully!\n');
      console.log('📋 Client Details:');
      console.log(`   Client ID:     ${response.data.client_id}`);
      console.log(`   Client Secret: ${response.data.client_secret}`);
      console.log(`   Client Name:   ${response.data.client_name}`);
      console.log(`   Redirect URIs: ${response.data.redirect_uris.join(', ')}`);
      console.log(`   Scopes:        ${response.data.allowed_scopes.join(', ')}`);
      console.log(`   PKCE Required: ${response.data.require_pkce}`);
      console.log(`   Trusted:       ${response.data.trusted}`);

      // Save to config file
      const config = {
        API_URL,
        CLIENT_ID: response.data.client_id,
        CLIENT_SECRET: response.data.client_secret,
        REDIRECT_URI: response.data.redirect_uris[0],
      };

      console.log('\n💾 Save these credentials for performance testing:');
      console.log('');
      console.log('export TRUXE_URL="' + API_URL + '"');
      console.log('export OAUTH_CLIENT_ID="' + response.data.client_id + '"');
      console.log('export OAUTH_CLIENT_SECRET="' + response.data.client_secret + '"');
      console.log('export OAUTH_REDIRECT_URI="' + response.data.redirect_uris[0] + '"');
      console.log('');

      return config;
    } else {
      console.error(`❌ Failed to register client: ${response.status}`);
      console.error(`   Error: ${JSON.stringify(response.data, null, 2)}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error registering client: ${error.message}`);
    return null;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Truxe OAuth Client Setup for Performance Testing\n');
  console.log(`   API URL: ${API_URL}`);
  console.log(`   Admin Token: ${ADMIN_TOKEN ? '✓ Set' : '✗ Not set'}`);
  console.log('');

  // Check health
  const isHealthy = await checkHealth();
  if (!isHealthy) {
    console.error('\n❌ Setup failed: API is not healthy');
    process.exit(1);
  }

  // Register client
  const config = await registerClient();
  if (!config) {
    console.error('\n❌ Setup failed: Could not register OAuth client');
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Ensure ADMIN_TOKEN is set correctly');
    console.error('   2. Check that the API is running on ' + API_URL);
    console.error('   3. Verify database connection');
    console.error('   4. Check API logs for errors');
    process.exit(1);
  }

  console.log('\n✅ Setup complete! You can now run performance tests:');
  console.log('');
  console.log('   k6 run tests/performance/oauth-load-test.js');
  console.log('');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { registerClient, checkHealth };