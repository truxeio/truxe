/**
 * Get Admin Token for Performance Testing
 *
 * This script helps you obtain an admin token for running performance tests.
 *
 * Usage:
 *   node get-admin-token.js
 */

import http from 'http';
import { URL } from 'url';

const API_URL = process.env.API_URL || 'http://localhost:3001';

function makeRequest(url, options, data = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const protocol = http;

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

async function createTestUser() {
  console.log('🚀 Getting Admin Token for Performance Testing\n');
  console.log(`   API URL: ${API_URL}\n`);

  // Create or login test user
  const userData = {
    email: 'perftest@truxe.io',
    password: 'PerfTest123!@#',
    name: 'Performance Test User',
  };

  console.log('📝 Creating/logging in test user...');

  // Try signup first
  let response = await makeRequest(
    `${API_URL}/auth/signup`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    userData
  );

  // If user exists, try login
  if (response.status === 409 || response.status === 400) {
    console.log('   User exists, trying login...');
    response = await makeRequest(
      `${API_URL}/auth/login`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      {
        email: userData.email,
        password: userData.password,
      }
    );
  }

  if (response.status === 200 || response.status === 201) {
    console.log('✅ Successfully authenticated!\n');

    const token = response.data.access_token || response.data.accessToken;

    if (token) {
      console.log('📋 Your Admin Token:');
      console.log('');
      console.log(token);
      console.log('');
      console.log('💾 Export it for performance testing:');
      console.log('');
      console.log(`export ADMIN_TOKEN="${token}"`);
      console.log('');
      console.log('✅ Now run:');
      console.log('   node setup-test-client.js');
      console.log('');

      return token;
    } else {
      console.error('❌ No token in response');
      console.error('Response:', JSON.stringify(response.data, null, 2));
      return null;
    }
  } else {
    console.error(`❌ Failed to authenticate: ${response.status}`);
    console.error('Response:', JSON.stringify(response.data, null, 2));
    console.error('');
    console.error('💡 Troubleshooting:');
    console.error('   1. Ensure API is running on ' + API_URL);
    console.error('   2. Check database connection');
    console.error('   3. Verify auth endpoints are working');
    return null;
  }
}

createTestUser().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});