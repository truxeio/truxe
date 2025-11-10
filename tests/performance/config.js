/**
 * Shared k6 Performance Test Configuration
 *
 * This file contains common configuration, utilities, and setup for all k6 tests
 */

// Environment configuration
export const config = {
  baseUrl: __ENV.API_BASE_URL || 'http://localhost:3001',
  database: {
    host: __ENV.DB_HOST || 'localhost',
    port: __ENV.DB_PORT || '21432',
    database: __ENV.DB_NAME || 'truxe.io',
    user: __ENV.DB_USER || 'heimdall',
    password: __ENV.DB_PASSWORD || 'dev_password_change_me'
  },
  redis: {
    host: __ENV.REDIS_HOST || 'localhost',
    port: __ENV.REDIS_PORT || '6379'
  }
};

// Common test thresholds for performance requirements
export const thresholds = {
  // Response time thresholds
  'http_req_duration{endpoint:authorization}': ['p(95)<500', 'p(99)<1000'], // Authorization should be fast
  'http_req_duration{endpoint:token}': ['p(95)<300', 'p(99)<600'], // Token exchange should be very fast
  'http_req_duration{endpoint:introspection}': ['p(95)<200', 'p(99)<400'], // Introspection is lightweight
  'http_req_duration{endpoint:callback}': ['p(95)<800', 'p(99)<1500'], // Callback can be slower (DB writes)

  // General thresholds
  'http_req_failed': ['rate<0.01'], // Error rate should be < 1%
  'http_req_duration': ['p(95)<1000', 'p(99)<2000'], // Overall response times
  'http_reqs': ['rate>10'], // Should handle at least 10 req/s
};

// Common test stages for gradual load ramping
export const stages = {
  smoke: [
    { duration: '30s', target: 5 }, // Warm up
    { duration: '1m', target: 5 },  // Stay at 5 users
    { duration: '30s', target: 0 }, // Ramp down
  ],
  load: [
    { duration: '1m', target: 10 },   // Ramp up to 10 users
    { duration: '3m', target: 10 },   // Stay at 10 users
    { duration: '1m', target: 50 },   // Ramp up to 50 users
    { duration: '3m', target: 50 },   // Stay at 50 users
    { duration: '1m', target: 100 },  // Ramp up to 100 users
    { duration: '2m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  stress: [
    { duration: '2m', target: 50 },   // Ramp up to 50
    { duration: '5m', target: 50 },   // Stay at 50
    { duration: '2m', target: 100 },  // Ramp up to 100
    { duration: '5m', target: 100 },  // Stay at 100
    { duration: '2m', target: 200 },  // Ramp up to 200
    { duration: '5m', target: 200 },  // Stay at 200
    { duration: '2m', target: 500 },  // Ramp up to 500
    { duration: '5m', target: 500 },  // Stay at 500
    { duration: '5m', target: 0 },    // Ramp down
  ],
  spike: [
    { duration: '1m', target: 10 },   // Normal load
    { duration: '30s', target: 500 }, // Spike to 500
    { duration: '1m', target: 500 },  // Stay at spike
    { duration: '30s', target: 10 },  // Drop back to normal
    { duration: '1m', target: 10 },   // Recover
    { duration: '30s', target: 0 },   // Ramp down
  ],
};

// Test data generators
export function generateTestUser(vu, iteration) {
  return {
    email: `perftest_vu${vu}_iter${iteration}@example.com`,
    password: 'TestPassword123!@#',
    name: `PerfTest User ${vu}-${iteration}`
  };
}

export function generateOAuthProvider() {
  const providers = ['github', 'google', 'microsoft', 'apple'];
  return providers[Math.floor(Math.random() * providers.length)];
}

export function generateState() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `state_${timestamp}_${random}`;
}

// Mock OAuth response for testing
export function generateMockOAuthTokens() {
  return {
    access_token: `mock_access_token_${Date.now()}_${Math.random().toString(36).substring(2)}`,
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: `mock_refresh_token_${Date.now()}_${Math.random().toString(36).substring(2)}`,
    scope: 'user:email repo'
  };
}

export function generateMockProfile(provider) {
  const id = Math.floor(Math.random() * 1000000);
  return {
    id: id.toString(),
    email: `user${id}@${provider}.com`,
    name: `Test User ${id}`,
    picture: `https://avatars.${provider}.com/${id}`,
    email_verified: true
  };
}

// HTTP request helpers with error handling
export function buildAuthHeaders(token = null) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

// Custom metrics for tracking
import { Counter, Rate, Trend } from 'k6/metrics';

export const metrics = {
  // Custom counters
  authorizationRequests: new Counter('authorization_requests'),
  tokenExchanges: new Counter('token_exchanges'),
  callbackProcessing: new Counter('callback_processing'),
  introspectionRequests: new Counter('introspection_requests'),

  // Custom error rates
  authorizationErrors: new Rate('authorization_errors'),
  tokenErrors: new Rate('token_errors'),
  callbackErrors: new Rate('callback_errors'),
  introspectionErrors: new Rate('introspection_errors'),

  // Custom trends (response times)
  authorizationDuration: new Trend('authorization_duration'),
  tokenDuration: new Trend('token_duration'),
  callbackDuration: new Trend('callback_duration'),
  introspectionDuration: new Trend('introspection_duration'),
};

// Results directory setup
export const resultsDir = __ENV.RESULTS_DIR || './tests/performance/results';

// Utility function to log summary data
export function logMetrics(data) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    ...data
  }));
}

// Check response status and track metrics
export function checkResponse(response, endpoint, metrics) {
  const success = response.status >= 200 && response.status < 300;

  if (!success) {
    console.error(`${endpoint} failed: ${response.status} - ${response.body}`);
  }

  // Add endpoint tag to the request
  response.tags = { endpoint };

  return success;
}

// Common options for all tests
export const commonOptions = {
  summaryTrendStats: ['min', 'avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  summaryTimeUnit: 'ms',
};

// OAuth-specific test data
export const oauthTestData = {
  providers: {
    github: {
      authUrl: '/api/auth/oauth/github/start',
      callbackUrl: '/api/auth/oauth/callback/github',
      scopes: ['user:email', 'read:user'],
    },
    google: {
      authUrl: '/api/auth/oauth/google/start',
      callbackUrl: '/api/auth/oauth/callback/google',
      scopes: ['openid', 'email', 'profile'],
    },
    microsoft: {
      authUrl: '/api/auth/oauth/microsoft/start',
      callbackUrl: '/api/auth/oauth/callback/microsoft',
      scopes: ['openid', 'email', 'profile'],
    },
    apple: {
      authUrl: '/api/auth/oauth/apple/start',
      callbackUrl: '/api/auth/oauth/callback/apple',
      scopes: ['email', 'name'],
    },
  },
  defaultRedirectUri: 'http://localhost:3001/auth/callback',
};

// Database cleanup utility (use with caution!)
export function shouldCleanupTestData() {
  return __ENV.CLEANUP_TEST_DATA === 'true';
}

// Export all for convenience
export default {
  config,
  thresholds,
  stages,
  generateTestUser,
  generateOAuthProvider,
  generateState,
  generateMockOAuthTokens,
  generateMockProfile,
  buildAuthHeaders,
  metrics,
  resultsDir,
  logMetrics,
  checkResponse,
  commonOptions,
  oauthTestData,
  shouldCleanupTestData,
};