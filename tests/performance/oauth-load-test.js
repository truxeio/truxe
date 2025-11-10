/**
 * k6 Performance Test: Combined OAuth Load Test
 *
 * Comprehensive load test simulating real-world OAuth usage patterns
 * Tests all OAuth endpoints together with realistic user flows
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import { Counter, Trend } from 'k6/metrics';

import {
  config,
  stages,
  thresholds,
  buildAuthHeaders,
  metrics,
  oauthTestData,
  logMetrics,
} from './config.js';

// Test configuration - use load test stages
export const options = {
  stages: stages.load,
  thresholds: {
    ...thresholds,
    'group_duration{group:::Complete OAuth Flow}': ['p(95)<2000', 'p(99)<3000'],
  },
  summaryTrendStats: ['min', 'avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

// Custom metrics for combined test
const completeFlows = new Counter('complete_oauth_flows');
const flowDuration = new Trend('oauth_flow_duration');
const flowErrors = new Counter('oauth_flow_errors');

// Setup
export function setup() {
  console.log('Starting Combined OAuth Load Test');
  console.log(`Base URL: ${config.baseUrl}`);
  console.log('Simulating realistic OAuth flows with multiple endpoints');

  const healthCheck = http.get(`${config.baseUrl}/health`);
  if (healthCheck.status !== 200) {
    console.error('API health check failed');
  }

  return {
    startTime: Date.now(),
    providers: Object.keys(oauthTestData.providers),
  };
}

// Main test - simulates complete OAuth flow
export default function (data) {
  const flowStart = Date.now();

  // Randomly select a scenario
  const scenario = Math.random();

  if (scenario < 0.5) {
    // 50%: Complete authorization + token exchange flow
    completeOAuthFlow(data);
  } else if (scenario < 0.8) {
    // 30%: Token introspection (resource server validating tokens)
    tokenIntrospectionFlow();
  } else {
    // 20%: Token refresh flow
    tokenRefreshFlow();
  }

  const flowEnd = Date.now();
  flowDuration.add(flowEnd - flowStart);

  // Realistic think time between user actions
  sleep(Math.random() * 3 + 1); // 1-4 seconds
}

// Scenario 1: Complete OAuth authorization flow
function completeOAuthFlow(data) {
  group('Complete OAuth Flow', function () {
    // Select random provider
    const providerIndex = (__VU + __ITER) % data.providers.length;
    const provider = data.providers[providerIndex];
    const providerConfig = oauthTestData.providers[provider];

    // Step 1: Initiate authorization
    const authPayload = JSON.stringify({
      redirectUri: oauthTestData.defaultRedirectUri,
      scopes: providerConfig.scopes,
      state: {
        test: true,
        vu: __VU,
        timestamp: Date.now(),
      },
    });

    const authUrl = `${config.baseUrl}${providerConfig.authUrl}`;
    metrics.authorizationRequests.add(1);

    const authResponse = http.post(authUrl, authPayload, {
      headers: buildAuthHeaders(),
      tags: { endpoint: 'authorization', provider: provider, flow: 'complete' },
    });

    const authSuccess = check(authResponse, {
      'auth: status is 200': (r) => r.status === 200,
      'auth: has authorizationUrl': (r) => {
        try {
          return JSON.parse(r.body).authorizationUrl;
        } catch {
          return false;
        }
      },
    });

    if (!authSuccess) {
      flowErrors.add(1);
      metrics.authorizationErrors.add(1);
      return;
    }

    metrics.authorizationErrors.add(0);

    // Simulate user interaction delay (user clicks "Allow")
    sleep(Math.random() * 2 + 1); // 1-3 seconds

    // Step 2: Exchange code for token (simulated callback)
    const tokenPayload = JSON.stringify({
      grant_type: 'authorization_code',
      code: `mock_code_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      redirect_uri: oauthTestData.defaultRedirectUri,
      client_id: 'test-client',
      client_secret: 'test-secret',
    });

    const tokenUrl = `${config.baseUrl}/api/oauth/token`;
    metrics.tokenExchanges.add(1);

    const tokenResponse = http.post(tokenUrl, tokenPayload, {
      headers: buildAuthHeaders(),
      tags: { endpoint: 'token', grant_type: 'authorization_code', flow: 'complete' },
    });

    const tokenSuccess = check(tokenResponse, {
      'token: status is 200 or 400': (r) => r.status === 200 || r.status === 400,
    });

    if (tokenSuccess && tokenResponse.status === 200) {
      completeFlows.add(1);
      metrics.tokenErrors.add(0);
    } else {
      flowErrors.add(1);
      metrics.tokenErrors.add(1);
    }
  });
}

// Scenario 2: Token introspection (resource server)
function tokenIntrospectionFlow() {
  group('Token Introspection Flow', function () {
    const mockToken = `mock_access_${Math.floor(Math.random() * 1000)}_${Math.random().toString(36).substring(2)}`;

    const payload = JSON.stringify({
      token: mockToken,
      token_type_hint: 'access_token',
    });

    const url = `${config.baseUrl}/api/oauth/introspect`;
    metrics.introspectionRequests.add(1);

    const response = http.post(url, payload, {
      headers: {
        ...buildAuthHeaders(),
        'Authorization': 'Basic ' + 'dGVzdC1jbGllbnQ6dGVzdC1zZWNyZXQ=', // test-client:test-secret
      },
      tags: { endpoint: 'introspection', flow: 'validation' },
    });

    const success = check(response, {
      'introspect: status is 200': (r) => r.status === 200,
      'introspect: has active field': (r) => {
        try {
          return typeof JSON.parse(r.body).active === 'boolean';
        } catch {
          return false;
        }
      },
    });

    if (!success) {
      flowErrors.add(1);
      metrics.introspectionErrors.add(1);
    } else {
      metrics.introspectionErrors.add(0);
    }
  });
}

// Scenario 3: Token refresh
function tokenRefreshFlow() {
  group('Token Refresh Flow', function () {
    const mockRefreshToken = `mock_refresh_${Math.random().toString(36).substring(2)}`;

    const payload = JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: mockRefreshToken,
      client_id: 'test-client',
      client_secret: 'test-secret',
    });

    const url = `${config.baseUrl}/api/oauth/token`;
    metrics.tokenExchanges.add(1);

    const response = http.post(url, payload, {
      headers: buildAuthHeaders(),
      tags: { endpoint: 'token', grant_type: 'refresh_token', flow: 'refresh' },
    });

    const success = check(response, {
      'refresh: status is 200 or 400': (r) => r.status === 200 || r.status === 400,
    });

    if (!success || response.status !== 200) {
      flowErrors.add(1);
      metrics.tokenErrors.add(1);
    } else {
      metrics.tokenErrors.add(0);
    }
  });
}

// Teardown
export function teardown(data) {
  const duration = Date.now() - data.startTime;
  console.log(`Combined OAuth Load Test completed in ${duration}ms`);
  console.log('Check results for:');
  console.log('  - complete_oauth_flows: successful end-to-end flows');
  console.log('  - oauth_flow_errors: failed flows');
  console.log('  - oauth_flow_duration: time to complete flows');
}

// Generate reports
export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  return {
    [`./tests/performance/results/oauth-load-test-${timestamp}.html`]: htmlReport(data),
    [`./tests/performance/results/oauth-load-test-${timestamp}.json`]: JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}