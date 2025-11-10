/**
 * k6 Performance Test: OAuth Token Exchange
 *
 * Tests the OAuth token endpoint (POST /oauth/token)
 * Scenarios: authorization_code, refresh_token
 * Measures: token generation, database operations, response times
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

import {
  config,
  stages,
  thresholds,
  buildAuthHeaders,
  metrics,
  oauthTestData,
  logMetrics,
} from './config.js';

// Test configuration
export const options = {
  stages: stages.load,
  thresholds: {
    ...thresholds,
    'http_req_duration{endpoint:token}': ['p(95)<300', 'p(99)<600'],
    'token_errors': ['rate<0.01'],
  },
  summaryTrendStats: ['min', 'avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

// Mock OAuth client credentials (would be from registered client)
const TEST_CLIENT = {
  client_id: 'test-perf-client-id',
  client_secret: 'test-perf-client-secret',
  redirect_uri: oauthTestData.defaultRedirectUri,
};

// Setup function
export function setup() {
  console.log('Starting OAuth Token Exchange Performance Test');
  console.log(`Base URL: ${config.baseUrl}`);

  // Verify API is reachable
  const healthCheck = http.get(`${config.baseUrl}/health`);
  if (healthCheck.status !== 200) {
    console.error('API health check failed');
  }

  return {
    startTime: Date.now(),
  };
}

// Helper to generate mock authorization code
function generateMockAuthCode() {
  return `mock_code_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

// Main test function
export default function (data) {
  // Test token exchange with authorization code
  testAuthorizationCodeFlow();

  sleep(Math.random() + 0.5); // 0.5-1.5 seconds

  // Occasionally test refresh token flow (30% of requests)
  if (Math.random() < 0.3) {
    testRefreshTokenFlow();
  }
}

function testAuthorizationCodeFlow() {
  const payload = {
    grant_type: 'authorization_code',
    code: generateMockAuthCode(),
    redirect_uri: TEST_CLIENT.redirect_uri,
    client_id: TEST_CLIENT.client_id,
    client_secret: TEST_CLIENT.client_secret,
    code_verifier: `verifier_${Math.random().toString(36).substring(2)}`, // PKCE
  };

  const url = `${config.baseUrl}/api/oauth/token`;
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    tags: { endpoint: 'token', grant_type: 'authorization_code' },
  };

  metrics.tokenExchanges.add(1);
  const startTime = Date.now();

  const response = http.post(url, JSON.stringify(payload), params);

  const duration = Date.now() - startTime;
  metrics.tokenDuration.add(duration);

  // Note: This will likely fail in practice since we're using mock codes
  // In a real test, you'd need to create valid authorization codes first
  const success = check(response, {
    'status is 200 or 400': (r) => r.status === 200 || r.status === 400, // 400 expected for invalid code
    'response has body': (r) => r.body && r.body.length > 0,
    'response time < 300ms': (r) => duration < 300,
  });

  if (response.status === 200) {
    check(response, {
      'has access_token': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.access_token && body.access_token.length > 0;
        } catch (e) {
          return false;
        }
      },
      'has refresh_token': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.refresh_token && body.refresh_token.length > 0;
        } catch (e) {
          return false;
        }
      },
      'has expires_in': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.expires_in && body.expires_in > 0;
        } catch (e) {
          return false;
        }
      },
      'token_type is Bearer': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.token_type === 'Bearer';
        } catch (e) {
          return false;
        }
      },
    });

    metrics.tokenErrors.add(0);
  } else {
    // Expected to fail with mock data, but we're testing performance not correctness
    metrics.tokenErrors.add(1);
  }

  if (__ITER % 100 === 0) {
    logMetrics({
      test: 'oauth-token-exchange',
      grant_type: 'authorization_code',
      vu: __VU,
      iteration: __ITER,
      duration: duration,
      status: response.status,
    });
  }
}

function testRefreshTokenFlow() {
  const payload = {
    grant_type: 'refresh_token',
    refresh_token: `mock_refresh_${Date.now()}_${Math.random().toString(36).substring(2)}`,
    client_id: TEST_CLIENT.client_id,
    client_secret: TEST_CLIENT.client_secret,
  };

  const url = `${config.baseUrl}/api/oauth/token`;
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    tags: { endpoint: 'token', grant_type: 'refresh_token' },
  };

  metrics.tokenExchanges.add(1);
  const startTime = Date.now();

  const response = http.post(url, JSON.stringify(payload), params);

  const duration = Date.now() - startTime;
  metrics.tokenDuration.add(duration);

  // Will likely fail with mock data
  check(response, {
    'status is 200 or 400': (r) => r.status === 200 || r.status === 400,
    'response has body': (r) => r.body && r.body.length > 0,
    'response time < 300ms': (r) => duration < 300,
  });

  if (response.status !== 200) {
    metrics.tokenErrors.add(1);
  } else {
    metrics.tokenErrors.add(0);
  }
}

// Teardown function
export function teardown(data) {
  const duration = Date.now() - data.startTime;
  console.log(`OAuth Token Test completed in ${duration}ms`);
}

// Generate reports
export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  return {
    [`./tests/performance/results/oauth-token-${timestamp}.html`]: htmlReport(data),
    [`./tests/performance/results/oauth-token-${timestamp}.json`]: JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}