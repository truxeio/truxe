/**
 * k6 Performance Test: OAuth Authorization Flow
 *
 * Tests the OAuth authorization initiation endpoint (/:provider/start)
 * Measures: authorization URL generation, state creation, response times
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
  checkResponse,
  oauthTestData,
  logMetrics,
} from './config.js';

// Test configuration
export const options = {
  stages: stages.load, // Use load test stages
  thresholds: {
    ...thresholds,
    'http_req_duration{endpoint:authorization}': ['p(95)<500', 'p(99)<1000'],
    'authorization_errors': ['rate<0.01'],
  },
  summaryTrendStats: ['min', 'avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

// Test providers to cycle through
const providers = Object.keys(oauthTestData.providers);

// Setup function - runs once before all tests
export function setup() {
  console.log('Starting OAuth Authorization Performance Test');
  console.log(`Base URL: ${config.baseUrl}`);
  console.log(`Testing providers: ${providers.join(', ')}`);

  // Verify API is reachable
  const healthCheck = http.get(`${config.baseUrl}/health`);
  if (healthCheck.status !== 200) {
    console.error('API health check failed - API may not be running');
    console.error(`Status: ${healthCheck.status}`);
  }

  return {
    startTime: Date.now(),
    providers: providers,
  };
}

// Main test function - runs for each virtual user
export default function (data) {
  // Select a provider (cycle through them)
  const providerIndex = (__VU + __ITER) % providers.length;
  const provider = providers[providerIndex];
  const providerConfig = oauthTestData.providers[provider];

  // Prepare request payload
  const payload = JSON.stringify({
    redirectUri: oauthTestData.defaultRedirectUri,
    scopes: providerConfig.scopes,
    state: {
      test: true,
      vu: __VU,
      iteration: __ITER,
      timestamp: Date.now(),
    },
  });

  const url = `${config.baseUrl}${providerConfig.authUrl}`;
  const params = {
    headers: buildAuthHeaders(),
    tags: { endpoint: 'authorization', provider: provider },
  };

  // Make authorization request
  metrics.authorizationRequests.add(1);
  const startTime = Date.now();

  const response = http.post(url, payload, params);

  const duration = Date.now() - startTime;
  metrics.authorizationDuration.add(duration);

  // Check response
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'has authorizationUrl': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.authorizationUrl && body.authorizationUrl.length > 0;
      } catch (e) {
        return false;
      }
    },
    'has state': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.state && body.state.length > 0;
      } catch (e) {
        return false;
      }
    },
    'has expiresAt': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.expiresAt && new Date(body.expiresAt).getTime() > Date.now();
      } catch (e) {
        return false;
      }
    },
    'has scopes': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.scopes) && body.scopes.length > 0;
      } catch (e) {
        return false;
      }
    },
    'response time < 500ms': (r) => duration < 500,
  });

  if (!success) {
    metrics.authorizationErrors.add(1);
    console.error(`Authorization failed for ${provider}: ${response.status} - ${response.body}`);
  } else {
    metrics.authorizationErrors.add(0);

    // Log success metrics periodically
    if (__ITER % 100 === 0) {
      logMetrics({
        test: 'oauth-authorization',
        provider: provider,
        vu: __VU,
        iteration: __ITER,
        duration: duration,
        status: response.status,
      });
    }
  }

  // Think time - simulate user behavior
  sleep(Math.random() * 2 + 1); // 1-3 seconds
}

// Teardown function - runs once after all tests
export function teardown(data) {
  const duration = Date.now() - data.startTime;
  console.log(`OAuth Authorization Test completed in ${duration}ms`);
}

// Generate HTML report
export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  return {
    [`./tests/performance/results/oauth-authorization-${timestamp}.html`]: htmlReport(data),
    [`./tests/performance/results/oauth-authorization-${timestamp}.json`]: JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}