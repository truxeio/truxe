/**
 * k6 Performance Test: OAuth Token Introspection
 *
 * Tests the OAuth introspection endpoint (POST /oauth/introspect)
 * Measures: token validation performance, cache efficiency, response times
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

import {
  config,
  stages,
  thresholds,
  metrics,
  logMetrics,
} from './config.js';

// Test configuration
export const options = {
  stages: stages.stress, // Use stress test stages - introspection should handle high load
  thresholds: {
    ...thresholds,
    'http_req_duration{endpoint:introspection}': ['p(95)<200', 'p(99)<400'],
    'introspection_errors': ['rate<0.01'],
  },
  summaryTrendStats: ['min', 'avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

// Mock client credentials
const TEST_CLIENT = {
  client_id: 'test-introspection-client',
  client_secret: 'test-introspection-secret',
};

// Setup function
export function setup() {
  console.log('Starting OAuth Introspection Performance Test');
  console.log(`Base URL: ${config.baseUrl}`);
  console.log('This test simulates high-load token validation scenarios');

  const healthCheck = http.get(`${config.baseUrl}/health`);
  if (healthCheck.status !== 200) {
    console.error('API health check failed');
  }

  return {
    startTime: Date.now(),
    // Generate a pool of mock tokens to test with
    tokenPool: generateTokenPool(100),
  };
}

// Generate pool of mock tokens for testing
function generateTokenPool(count) {
  const tokens = [];
  for (let i = 0; i < count; i++) {
    tokens.push(`mock_token_${i}_${Math.random().toString(36).substring(2, 15)}`);
  }
  return tokens;
}

// Main test function
export default function (data) {
  // Select a random token from the pool (simulates repeated validation of same tokens)
  const tokenIndex = Math.floor(Math.random() * data.tokenPool.length);
  const token = data.tokenPool[tokenIndex];

  const payload = {
    token: token,
    token_type_hint: 'access_token',
  };

  // Prepare request with client credentials in Basic Auth
  const credentials = `${TEST_CLIENT.client_id}:${TEST_CLIENT.client_secret}`;
  const encodedCredentials = encoding.b64encode(credentials);

  const url = `${config.baseUrl}/api/oauth/introspect`;
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Basic ${encodedCredentials}`,
    },
    tags: { endpoint: 'introspection' },
  };

  metrics.introspectionRequests.add(1);
  const startTime = Date.now();

  const response = http.post(url, JSON.stringify(payload), params);

  const duration = Date.now() - startTime;
  metrics.introspectionDuration.add(duration);

  // Check response
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'has active field': (r) => {
      try {
        const body = JSON.parse(r.body);
        return typeof body.active === 'boolean';
      } catch (e) {
        return false;
      }
    },
    'response time < 200ms': (r) => duration < 200, // Introspection should be very fast (cached)
  });

  if (!success) {
    metrics.introspectionErrors.add(1);
    if (__ITER % 50 === 0) {
      console.error(`Introspection failed: ${response.status} - ${response.body}`);
    }
  } else {
    metrics.introspectionErrors.add(0);

    // Additional checks if token is active
    const body = JSON.parse(response.body);
    if (body.active) {
      check(response, {
        'has client_id': (r) => {
          const b = JSON.parse(r.body);
          return b.client_id && b.client_id.length > 0;
        },
        'has exp (expiration)': (r) => {
          const b = JSON.parse(r.body);
          return b.exp && b.exp > 0;
        },
        'has iat (issued at)': (r) => {
          const b = JSON.parse(r.body);
          return b.iat && b.iat > 0;
        },
      });
    }

    // Log metrics periodically
    if (__ITER % 200 === 0) {
      logMetrics({
        test: 'oauth-introspection',
        vu: __VU,
        iteration: __ITER,
        duration: duration,
        status: response.status,
        active: body.active,
      });
    }
  }

  // Very short think time for introspection (happens frequently in real apps)
  sleep(Math.random() * 0.5); // 0-0.5 seconds
}

// Teardown function
export function teardown(data) {
  const duration = Date.now() - data.startTime;
  console.log(`OAuth Introspection Test completed in ${duration}ms`);
}

// Generate reports
export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  return {
    [`./tests/performance/results/oauth-introspection-${timestamp}.html`]: htmlReport(data),
    [`./tests/performance/results/oauth-introspection-${timestamp}.json`]: JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

// Note: k6 doesn't have built-in base64 encode, using workaround
import encoding from 'k6/encoding';