/**
 * Truxe Load Testing & Performance Validation
 * 
 * Comprehensive load testing suite for validating production performance
 * targets including 10k+ requests/minute with <200ms response time,
 * error rates <0.1%, and system stability under load.
 * 
 * @author Performance Engineering Team
 * @version 1.0.0
 */

import { check, group, sleep } from 'k6';
import http from 'k6/http';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { randomString, randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const errorRate = new Rate('error_rate');
const responseTime = new Trend('response_time');
const requestsPerSecond = new Rate('requests_per_second');
const concurrentUsers = new Gauge('concurrent_users');
const authSuccessRate = new Rate('auth_success_rate');
const magicLinkSuccessRate = new Rate('magic_link_success_rate');
const databaseQueryTime = new Trend('database_query_time');
const cacheHitRate = new Rate('cache_hit_rate');

// Test configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const TEST_DURATION = __ENV.TEST_DURATION || '5m';
const TARGET_RPS = parseInt(__ENV.TARGET_RPS) || 167; // 10k requests/minute
const MAX_VUS = parseInt(__ENV.MAX_VUS) || 100;

// Performance targets
const PERFORMANCE_TARGETS = {
  responseTime: {
    p95: 200, // 95th percentile < 200ms
    p99: 500, // 99th percentile < 500ms
    avg: 100  // Average < 100ms
  },
  errorRate: {
    max: 0.001 // < 0.1%
  },
  throughput: {
    min: TARGET_RPS // Minimum requests per second
  },
  availability: {
    min: 99.9 // 99.9% uptime
  }
};

// Test data
const TEST_USERS = Array.from({ length: 1000 }, (_, i) => ({
  email: `loadtest${i}@truxe.test`,
  id: `user_${i}`,
  orgId: `org_${Math.floor(i / 10)}` // 10 users per org
}));

const TEST_ORGANIZATIONS = Array.from({ length: 100 }, (_, i) => ({
  name: `Load Test Org ${i}`,
  slug: `loadtest-org-${i}`,
  id: `org_${i}`
}));

/**
 * K6 Test Options
 */
export let options = {
  scenarios: {
    // Smoke test - verify basic functionality
    smoke_test: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
      tags: { test_type: 'smoke' },
      exec: 'smokeTest'
    },
    
    // Load test - normal expected load
    load_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 20 },   // Ramp up
        { duration: '5m', target: 20 },   // Stay at 20 users
        { duration: '2m', target: 50 },   // Ramp up
        { duration: '5m', target: 50 },   // Stay at 50 users
        { duration: '2m', target: 0 }     // Ramp down
      ],
      tags: { test_type: 'load' },
      exec: 'loadTest'
    },
    
    // Stress test - above normal load
    stress_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },   // Ramp up
        { duration: '5m', target: 50 },   // Stay at 50
        { duration: '2m', target: 100 },  // Ramp up
        { duration: '5m', target: 100 },  // Stay at 100
        { duration: '5m', target: 200 },  // Push to limits
        { duration: '2m', target: 0 }     // Ramp down
      ],
      tags: { test_type: 'stress' },
      exec: 'stressTest'
    },
    
    // Spike test - sudden load spikes
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 100 }, // Quick ramp up
        { duration: '1m', target: 100 },  // Stay high
        { duration: '10s', target: 0 }    // Quick ramp down
      ],
      tags: { test_type: 'spike' },
      exec: 'spikeTest'
    },
    
    // Volume test - large amounts of data
    volume_test: {
      executor: 'constant-vus',
      vus: 10,
      duration: '10m',
      tags: { test_type: 'volume' },
      exec: 'volumeTest'
    },
    
    // Endurance test - extended duration
    endurance_test: {
      executor: 'constant-vus',
      vus: 30,
      duration: '30m',
      tags: { test_type: 'endurance' },
      exec: 'enduranceTest'
    }
  },
  
  thresholds: {
    // Response time thresholds
    'http_req_duration': [
      `p(95)<${PERFORMANCE_TARGETS.responseTime.p95}`,
      `p(99)<${PERFORMANCE_TARGETS.responseTime.p99}`,
      `avg<${PERFORMANCE_TARGETS.responseTime.avg}`
    ],
    
    // Error rate threshold
    'http_req_failed': [`rate<${PERFORMANCE_TARGETS.errorRate.max}`],
    
    // Custom metric thresholds
    'error_rate': [`rate<${PERFORMANCE_TARGETS.errorRate.max}`],
    'auth_success_rate': ['rate>0.99'],
    'magic_link_success_rate': ['rate>0.95'],
    'response_time': [
      `p(95)<${PERFORMANCE_TARGETS.responseTime.p95}`,
      `avg<${PERFORMANCE_TARGETS.responseTime.avg}`
    ]
  }
};

/**
 * Setup function - runs once before all tests
 */
export function setup() {
  console.log('🚀 Starting Truxe Load Testing Suite');
  console.log(`📊 Target: ${TARGET_RPS} RPS with ${MAX_VUS} max VUs`);
  console.log(`🎯 Performance Targets:`);
  console.log(`   - Response Time: p95 < ${PERFORMANCE_TARGETS.responseTime.p95}ms`);
  console.log(`   - Error Rate: < ${PERFORMANCE_TARGETS.errorRate.max * 100}%`);
  console.log(`   - Throughput: > ${PERFORMANCE_TARGETS.throughput.min} RPS`);
  
  // Verify API is accessible
  const healthCheck = http.get(`${BASE_URL}/health`);
  if (healthCheck.status !== 200) {
    throw new Error(`API health check failed: ${healthCheck.status}`);
  }
  
  return {
    baseUrl: BASE_URL,
    testUsers: TEST_USERS,
    testOrgs: TEST_ORGANIZATIONS
  };
}

/**
 * Smoke Test - Basic functionality verification
 */
export function smokeTest(data) {
  group('Smoke Test - Basic API Functionality', () => {
    // Health check
    group('Health Check', () => {
      const response = http.get(`${data.baseUrl}/health`);
      check(response, {
        'health check status is 200': (r) => r.status === 200,
        'health check response time < 100ms': (r) => r.timings.duration < 100
      });
    });
    
    // JWKS endpoint
    group('JWKS Endpoint', () => {
      const response = http.get(`${data.baseUrl}/.well-known/jwks.json`);
      check(response, {
        'JWKS status is 200': (r) => r.status === 200,
        'JWKS has keys': (r) => JSON.parse(r.body).keys.length > 0
      });
    });
    
    // Magic link request
    group('Magic Link Request', () => {
      const testUser = randomItem(data.testUsers);
      const response = http.post(`${data.baseUrl}/auth/magic-link`, 
        JSON.stringify({ email: testUser.email }),
        { headers: { 'Content-Type': 'application/json' } }
      );
      
      const success = response.status === 200;
      magicLinkSuccessRate.add(success);
      
      check(response, {
        'magic link status is 200': (r) => r.status === 200,
        'magic link response time < 200ms': (r) => r.timings.duration < 200
      });
    });
  });
  
  sleep(1);
}

/**
 * Load Test - Normal expected load
 */
export function loadTest(data) {
  const testUser = randomItem(data.testUsers);
  
  group('Load Test - Normal Operations', () => {
    // Authentication flow
    group('Authentication Flow', () => {
      // Request magic link
      const magicLinkResponse = http.post(`${data.baseUrl}/auth/magic-link`,
        JSON.stringify({ email: testUser.email }),
        { headers: { 'Content-Type': 'application/json' } }
      );
      
      const magicLinkSuccess = magicLinkResponse.status === 200;
      magicLinkSuccessRate.add(magicLinkSuccess);
      responseTime.add(magicLinkResponse.timings.duration);
      
      check(magicLinkResponse, {
        'magic link request successful': (r) => r.status === 200,
        'magic link response time acceptable': (r) => r.timings.duration < 500
      });
    });
    
    // Health and monitoring endpoints
    group('Health Endpoints', () => {
      const endpoints = ['/health', '/health/performance', '/metrics'];
      
      endpoints.forEach(endpoint => {
        const response = http.get(`${data.baseUrl}${endpoint}`);
        responseTime.add(response.timings.duration);
        
        check(response, {
          [`${endpoint} is accessible`]: (r) => r.status === 200,
          [`${endpoint} responds quickly`]: (r) => r.timings.duration < 200
        });
      });
    });
  });
  
  // Random sleep to simulate user think time
  sleep(Math.random() * 2 + 1); // 1-3 seconds
}

/**
 * Stress Test - Above normal load
 */
export function stressTest(data) {
  const testUser = randomItem(data.testUsers);
  concurrentUsers.add(1);
  
  group('Stress Test - High Load Operations', () => {
    // Rapid authentication requests
    group('Rapid Auth Requests', () => {
      for (let i = 0; i < 5; i++) {
        const response = http.post(`${data.baseUrl}/auth/magic-link`,
          JSON.stringify({ email: `${testUser.email}_${i}` }),
          { headers: { 'Content-Type': 'application/json' } }
        );
        
        responseTime.add(response.timings.duration);
        errorRate.add(response.status >= 400);
        
        // Check for rate limiting
        if (response.status === 429) {
          console.log('Rate limiting triggered - expected under high load');
        }
      }
    });
    
    // Concurrent health checks
    group('Concurrent Health Checks', () => {
      const requests = [
        ['GET', `${data.baseUrl}/health`],
        ['GET', `${data.baseUrl}/health/performance`],
        ['GET', `${data.baseUrl}/.well-known/jwks.json`]
      ];
      
      const responses = http.batch(requests);
      responses.forEach(response => {
        responseTime.add(response.timings.duration);
        errorRate.add(response.status >= 400);
      });
    });
  });
  
  sleep(0.5); // Shorter sleep for stress testing
}

/**
 * Spike Test - Sudden load spikes
 */
export function spikeTest(data) {
  const testUser = randomItem(data.testUsers);
  
  group('Spike Test - Sudden Load Spike', () => {
    // Burst of requests
    const burstSize = 10;
    const requests = [];
    
    for (let i = 0; i < burstSize; i++) {
      requests.push(['POST', `${data.baseUrl}/auth/magic-link`, 
        JSON.stringify({ email: `${testUser.email}_spike_${i}` }),
        { headers: { 'Content-Type': 'application/json' } }
      ]);
    }
    
    const startTime = Date.now();
    const responses = http.batch(requests);
    const endTime = Date.now();
    
    console.log(`Spike test: ${burstSize} requests in ${endTime - startTime}ms`);
    
    responses.forEach(response => {
      responseTime.add(response.timings.duration);
      errorRate.add(response.status >= 400);
      
      check(response, {
        'spike request handled': (r) => r.status === 200 || r.status === 429,
        'spike response time reasonable': (r) => r.timings.duration < 1000
      });
    });
  });
  
  // No sleep - maximum pressure
}

/**
 * Volume Test - Large amounts of data
 */
export function volumeTest(data) {
  group('Volume Test - Large Data Operations', () => {
    // Test with large payloads
    group('Large Payload Test', () => {
      const largeData = {
        email: randomItem(data.testUsers).email,
        metadata: {
          large_field: randomString(1000), // 1KB of random data
          array_data: Array.from({ length: 100 }, () => randomString(50)),
          nested_object: {
            level1: { level2: { level3: randomString(500) } }
          }
        }
      };
      
      const response = http.post(`${data.baseUrl}/auth/magic-link`,
        JSON.stringify(largeData),
        { 
          headers: { 'Content-Type': 'application/json' },
          timeout: '10s'
        }
      );
      
      responseTime.add(response.timings.duration);
      
      check(response, {
        'large payload handled': (r) => r.status === 200 || r.status === 400,
        'large payload response time acceptable': (r) => r.timings.duration < 2000
      });
    });
    
    // Test many sequential requests
    group('Sequential Request Volume', () => {
      for (let i = 0; i < 50; i++) {
        const response = http.get(`${data.baseUrl}/health`);
        responseTime.add(response.timings.duration);
        
        if (i % 10 === 0) {
          console.log(`Volume test progress: ${i}/50 requests completed`);
        }
      }
    });
  });
  
  sleep(2);
}

/**
 * Endurance Test - Extended duration
 */
export function enduranceTest(data) {
  const testUser = randomItem(data.testUsers);
  
  group('Endurance Test - Sustained Load', () => {
    // Simulate realistic user behavior over time
    const actions = [
      () => {
        // Request magic link
        const response = http.post(`${data.baseUrl}/auth/magic-link`,
          JSON.stringify({ email: testUser.email }),
          { headers: { 'Content-Type': 'application/json' } }
        );
        responseTime.add(response.timings.duration);
        magicLinkSuccessRate.add(response.status === 200);
      },
      () => {
        // Check health
        const response = http.get(`${data.baseUrl}/health`);
        responseTime.add(response.timings.duration);
      },
      () => {
        // Get JWKS
        const response = http.get(`${data.baseUrl}/.well-known/jwks.json`);
        responseTime.add(response.timings.duration);
      }
    ];
    
    // Execute random action
    const action = randomItem(actions);
    action();
  });
  
  // Realistic user think time
  sleep(Math.random() * 5 + 2); // 2-7 seconds
}

/**
 * Teardown function - runs once after all tests
 */
export function teardown(data) {
  console.log('🏁 Load Testing Complete');
  
  // Generate performance report
  const report = generatePerformanceReport();
  console.log('📊 Performance Report:');
  console.log(JSON.stringify(report, null, 2));
}

/**
 * Generate performance report
 */
function generatePerformanceReport() {
  return {
    timestamp: new Date().toISOString(),
    summary: {
      total_requests: requestsPerSecond.rate * options.scenarios.load_test.stages.reduce((sum, stage) => sum + parseInt(stage.duration), 0),
      avg_response_time: responseTime.avg,
      p95_response_time: responseTime.p95,
      p99_response_time: responseTime.p99,
      error_rate: errorRate.rate,
      auth_success_rate: authSuccessRate.rate,
      magic_link_success_rate: magicLinkSuccessRate.rate
    },
    targets_met: {
      response_time_p95: responseTime.p95 <= PERFORMANCE_TARGETS.responseTime.p95,
      response_time_avg: responseTime.avg <= PERFORMANCE_TARGETS.responseTime.avg,
      error_rate: errorRate.rate <= PERFORMANCE_TARGETS.errorRate.max,
      auth_success: authSuccessRate.rate >= 0.99
    },
    recommendations: generateRecommendations()
  };
}

/**
 * Generate performance recommendations
 */
function generateRecommendations() {
  const recommendations = [];
  
  if (responseTime.p95 > PERFORMANCE_TARGETS.responseTime.p95) {
    recommendations.push({
      type: 'performance',
      priority: 'high',
      message: `P95 response time (${responseTime.p95}ms) exceeds target (${PERFORMANCE_TARGETS.responseTime.p95}ms)`,
      suggestions: [
        'Enable database query optimization',
        'Implement response caching',
        'Scale application horizontally',
        'Optimize database indexes'
      ]
    });
  }
  
  if (errorRate.rate > PERFORMANCE_TARGETS.errorRate.max) {
    recommendations.push({
      type: 'reliability',
      priority: 'critical',
      message: `Error rate (${(errorRate.rate * 100).toFixed(2)}%) exceeds target (${PERFORMANCE_TARGETS.errorRate.max * 100}%)`,
      suggestions: [
        'Investigate error logs',
        'Implement circuit breakers',
        'Add more comprehensive error handling',
        'Scale infrastructure resources'
      ]
    });
  }
  
  if (magicLinkSuccessRate.rate < 0.95) {
    recommendations.push({
      type: 'functionality',
      priority: 'high',
      message: `Magic link success rate (${(magicLinkSuccessRate.rate * 100).toFixed(2)}%) is below target (95%)`,
      suggestions: [
        'Check email service reliability',
        'Implement retry mechanisms',
        'Add email service monitoring',
        'Consider backup email providers'
      ]
    });
  }
  
  return recommendations;
}

/**
 * Custom check function for business logic
 */
export function checkBusinessLogic(response, testType) {
  const checks = {
    [`${testType}: status code is valid`]: (r) => [200, 201, 400, 401, 429].includes(r.status),
    [`${testType}: response has required fields`]: (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.hasOwnProperty('success') || body.hasOwnProperty('error');
      } catch {
        return false;
      }
    },
    [`${testType}: response time acceptable`]: (r) => r.timings.duration < 1000
  };
  
  return check(response, checks);
}

/**
 * Performance validation helper
 */
export function validatePerformanceTargets() {
  const results = {
    passed: 0,
    failed: 0,
    details: []
  };
  
  // Response time validation
  if (responseTime.p95 <= PERFORMANCE_TARGETS.responseTime.p95) {
    results.passed++;
    results.details.push({ metric: 'P95 Response Time', status: 'PASS', value: `${responseTime.p95}ms` });
  } else {
    results.failed++;
    results.details.push({ metric: 'P95 Response Time', status: 'FAIL', value: `${responseTime.p95}ms` });
  }
  
  // Error rate validation
  if (errorRate.rate <= PERFORMANCE_TARGETS.errorRate.max) {
    results.passed++;
    results.details.push({ metric: 'Error Rate', status: 'PASS', value: `${(errorRate.rate * 100).toFixed(3)}%` });
  } else {
    results.failed++;
    results.details.push({ metric: 'Error Rate', status: 'FAIL', value: `${(errorRate.rate * 100).toFixed(3)}%` });
  }
  
  return results;
}

export default {
  smokeTest,
  loadTest,
  stressTest,
  spikeTest,
  volumeTest,
  enduranceTest,
  checkBusinessLogic,
  validatePerformanceTargets
};
