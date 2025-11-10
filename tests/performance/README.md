# OAuth Provider Performance Testing

**Complete k6 load testing suite for Truxe OAuth Provider**

> 🚀 **Ready to Run** | 📊 **Comprehensive Metrics** | ⚡ **Production Validation**

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Test Scenarios](#test-scenarios)
5. [Configuration](#configuration)
6. [Running Tests](#running-tests)
7. [Understanding Results](#understanding-results)
8. [Performance Targets](#performance-targets)
9. [Troubleshooting](#troubleshooting)

---

## Overview

This suite contains k6 performance tests for all Truxe OAuth Provider endpoints:

- **Authorization Flow** - `/api/oauth/authorize`
- **Token Exchange** - `/api/oauth/token`
- **Token Introspection** - `/api/oauth/introspect`
- **Combined Load Test** - All endpoints together

### Test Types

1. **Smoke Test** - 5 VUs for 2 minutes (basic functionality)
2. **Load Test** - 10-100 VUs for 10 minutes (normal load)
3. **Stress Test** - 100-500 VUs for 20 minutes (high load)
4. **Spike Test** - 10-500 VUs rapid changes (traffic spikes)

---

## Prerequisites

### 1. Install k6

**macOS:**
```bash
brew install k6
```

**Linux:**
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

**Windows:**
```bash
choco install k6
```

**Verify Installation:**
```bash
k6 version
# Should show: k6 v1.2.3 or higher
```

### 2. Setup OAuth Test Client

Run the setup script to register an OAuth client:

```bash
# Set admin token (get from your Truxe instance)
export ADMIN_TOKEN="your-admin-token"

# Register test client
node tests/performance/setup-test-client.js
```

**Output:**
```
✅ OAuth client registered successfully!

📋 Client Details:
   Client ID:     cl_abc123xyz
   Client Secret: cs_secret_key...

💾 Save these credentials for performance testing:

export TRUXE_URL="http://localhost:3001"
export OAUTH_CLIENT_ID="cl_abc123xyz"
export OAUTH_CLIENT_SECRET="cs_secret_key..."
export OAUTH_REDIRECT_URI="http://localhost:3000/callback"
```

### 3. Configure Environment

Create `.env` file or export environment variables:

```bash
export TRUXE_URL="http://localhost:3001"
export OAUTH_CLIENT_ID="cl_abc123xyz"
export OAUTH_CLIENT_SECRET="cs_secret_key..."
export OAUTH_REDIRECT_URI="http://localhost:3000/callback"
```

---

## Quick Start

### Run All Tests (Smoke Level)

```bash
# Quick smoke test of all endpoints
k6 run tests/performance/oauth-load-test.js
```

### Run Individual Tests

```bash
# Test authorization endpoint
k6 run tests/performance/oauth-authorization.js

# Test token endpoint
k6 run tests/performance/oauth-token.js

# Test introspection endpoint
k6 run tests/performance/oauth-introspection.js
```

---

## Test Scenarios

### 1. Smoke Test (Quick Validation)

**Purpose:** Verify basic functionality and catch obvious issues
**Duration:** 2 minutes
**Load:** 5 concurrent users

```bash
k6 run --env SCENARIO=smoke tests/performance/oauth-load-test.js
```

**Use When:**
- After code changes
- Before deploying
- Quick sanity check

---

### 2. Load Test (Normal Traffic)

**Purpose:** Test system under normal/expected load
**Duration:** 10 minutes
**Load:** Ramps from 10 to 100 users

```bash
k6 run --env SCENARIO=load tests/performance/oauth-load-test.js
```

**Use When:**
- Regular performance testing
- Validating new features
- Baseline metrics

**Expected Results:**
- P95 response time < 500ms
- P99 response time < 1000ms
- Error rate < 1%
- Throughput > 10 req/s

---

### 3. Stress Test (High Load)

**Purpose:** Find system limits and breaking points
**Duration:** 20 minutes
**Load:** Ramps from 100 to 500 users

```bash
k6 run --env SCENARIO=stress tests/performance/oauth-load-test.js
```

**Use When:**
- Capacity planning
- Finding bottlenecks
- Pre-production validation

**Expected Behavior:**
- Gradual performance degradation
- Graceful handling of overload
- Rate limiting kicks in
- No crashes or data loss

---

### 4. Spike Test (Traffic Surges)

**Purpose:** Test system recovery from sudden load spikes
**Duration:** 15 minutes
**Load:** 10 users → 500 users → 10 users (rapid)

```bash
k6 run --env SCENARIO=spike tests/performance/oauth-load-test.js
```

**Use When:**
- Testing auto-scaling
- Validating rate limiting
- Simulating traffic surges (e.g., product launch)

---

## Configuration

### Test Configuration File

**File:** `tests/performance/config.js`

```javascript
export const config = {
  baseUrl: process.env.TRUXE_URL || 'http://localhost:3001',
  clientId: process.env.OAUTH_CLIENT_ID,
  clientSecret: process.env.OAUTH_CLIENT_SECRET,
  redirectUri: process.env.OAUTH_REDIRECT_URI || 'http://localhost:3000/callback',
};

export const thresholds = {
  http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% under 500ms, 99% under 1s
  http_req_failed: ['rate<0.01'],                  // Error rate < 1%
  http_reqs: ['rate>10'],                          // Throughput > 10 req/s
};
```

### Customizing Thresholds

Edit `config.js` to adjust performance targets:

```javascript
// Stricter thresholds for production
export const thresholds = {
  http_req_duration: ['p(95)<300', 'p(99)<500'],  // Faster response times
  http_req_failed: ['rate<0.001'],                 // 0.1% error rate
  http_reqs: ['rate>50'],                          // Higher throughput
};
```

---

## Running Tests

### Basic Execution

```bash
# Run with default configuration
k6 run tests/performance/oauth-load-test.js
```

### With Custom Options

```bash
# Specify scenario
k6 run --env SCENARIO=load tests/performance/oauth-load-test.js

# Override VUs and duration
k6 run --vus 50 --duration 5m tests/performance/oauth-token.js

# Custom thresholds
k6 run --env P95_THRESHOLD=300 tests/performance/oauth-load-test.js
```

### Output Formats

**Terminal Output (Default):**
```bash
k6 run tests/performance/oauth-load-test.js
```

**JSON Output:**
```bash
k6 run --out json=results.json tests/performance/oauth-load-test.js
```

**HTML Report:**
```bash
# Install reporter
npm install -g k6-to-junit

# Generate report
k6 run --out json=results.json tests/performance/oauth-load-test.js
k6-to-junit results.json > report.xml
```

**Cloud Output (k6 Cloud):**
```bash
k6 cloud tests/performance/oauth-load-test.js
```

---

## Understanding Results

### Terminal Output

```
scenarios: (100.00%) 1 scenario, 100 max VUs, 10m30s max duration
          ✓ OAuth authorization successful
          ✓ Token exchange successful
          ✓ Response time acceptable

checks.........................: 98.50% ✓ 9850      ✗ 150
data_received..................: 15 MB  25 kB/s
data_sent......................: 8.0 MB 13 kB/s
http_req_blocked...............: avg=1.2ms    min=0s       med=1ms     max=50ms
http_req_duration..............: avg=245ms    min=50ms     med=200ms   max=2s
  { expected_response:true }...: avg=230ms    min=50ms     med=195ms   max=1.5s
http_req_failed................: 1.50%  ✓ 150       ✗ 9850
http_req_receiving.............: avg=1.5ms    min=0s       med=1ms     max=25ms
http_req_sending...............: avg=0.8ms    min=0s       med=0.5ms   max=10ms
http_req_tls_handshaking.......: avg=0s       min=0s       med=0s      max=0s
http_req_waiting...............: avg=242ms    min=49ms     med=198ms   max=2s
http_reqs......................: 10000  16.66/s
iteration_duration.............: avg=5.2s     min=4.8s     med=5s      max=8s
iterations.....................: 1000   1.66/s
vus............................: 100    min=10      max=100
vus_max........................: 100    min=100     max=100
```

### Key Metrics

| Metric | Description | Good | Warning | Bad |
|--------|-------------|------|---------|-----|
| **http_req_duration (P95)** | 95th percentile response time | < 500ms | 500-1000ms | > 1000ms |
| **http_req_duration (P99)** | 99th percentile response time | < 1000ms | 1000-2000ms | > 2000ms |
| **http_req_failed** | Error rate | < 1% | 1-5% | > 5% |
| **http_reqs** | Throughput (req/s) | > 50 | 10-50 | < 10 |
| **checks** | Assertion pass rate | > 99% | 95-99% | < 95% |

### Custom Metrics

The tests track custom metrics:

- `oauth_authorization_duration` - Authorization flow time
- `oauth_token_duration` - Token exchange time
- `oauth_complete_flow_duration` - End-to-end OAuth flow

---

## Performance Targets

### Baseline Targets (Acceptable)

| Endpoint | P95 | P99 | Throughput | Error Rate |
|----------|-----|-----|------------|------------|
| /authorize | < 500ms | < 1s | > 10 req/s | < 1% |
| /token | < 500ms | < 1s | > 20 req/s | < 1% |
| /introspect | < 200ms | < 500ms | > 100 req/s | < 1% |
| /userinfo | < 300ms | < 600ms | > 50 req/s | < 1% |

### Production Targets (Ideal)

| Endpoint | P95 | P99 | Throughput | Error Rate |
|----------|-----|-----|------------|------------|
| /authorize | < 300ms | < 500ms | > 50 req/s | < 0.1% |
| /token | < 300ms | < 500ms | > 100 req/s | < 0.1% |
| /introspect | < 100ms | < 200ms | > 500 req/s | < 0.1% |
| /userinfo | < 150ms | < 300ms | > 200 req/s | < 0.1% |

---

## Troubleshooting

### Issue: "OAUTH_CLIENT_ID not set"

**Cause:** Environment variables not configured

**Solution:**
```bash
# Run setup script
node tests/performance/setup-test-client.js

# Export credentials
export OAUTH_CLIENT_ID="cl_xxx"
export OAUTH_CLIENT_SECRET="cs_xxx"
```

---

### Issue: "Connection refused"

**Cause:** API server not running or wrong URL

**Solution:**
```bash
# Check API health
curl http://localhost:3001/health

# Verify TRUXE_URL
echo $TRUXE_URL

# Start API if needed
cd api && npm run dev
```

---

### Issue: "Rate limit exceeded (429)"

**Cause:** Too many requests from single IP

**Solution:**
```bash
# Reduce VUs
k6 run --vus 10 tests/performance/oauth-load-test.js

# Or disable rate limiting temporarily
# (In API .env file)
RATE_LIMIT_ENABLED=false
```

---

### Issue: High error rate (> 5%)

**Possible Causes:**
1. Database connection pool exhausted
2. Redis connection issues
3. Server under heavy load

**Solutions:**
```bash
# Check API logs
docker logs truxe-api

# Check database connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Check Redis
redis-cli ping

# Increase database pool
# (In API .env file)
DATABASE_POOL_MAX=20
```

---

## Continuous Integration

### GitHub Actions Example

```yaml
name: Performance Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  performance:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup k6
        run: |
          curl https://github.com/grafana/k6/releases/download/v0.47.0/k6-v0.47.0-linux-amd64.tar.gz -L | tar xvz
          sudo cp k6-v0.47.0-linux-amd64/k6 /usr/local/bin

      - name: Start API
        run: |
          cd api
          npm install
          npm run dev &
          sleep 10

      - name: Setup OAuth Client
        run: |
          export ADMIN_TOKEN=${{ secrets.ADMIN_TOKEN }}
          node tests/performance/setup-test-client.js

      - name: Run Performance Tests
        run: |
          k6 run --env SCENARIO=smoke tests/performance/oauth-load-test.js

      - name: Upload Results
        uses: actions/upload-artifact@v3
        with:
          name: performance-results
          path: results.json
```

---

## Best Practices

### 1. Test Incrementally

Start with smoke tests, then progress to load/stress tests:

```bash
# Step 1: Smoke test (2 min)
k6 run --env SCENARIO=smoke tests/performance/oauth-load-test.js

# Step 2: Load test (10 min)
k6 run --env SCENARIO=load tests/performance/oauth-load-test.js

# Step 3: Stress test (20 min)
k6 run --env SCENARIO=stress tests/performance/oauth-load-test.js
```

### 2. Monitor During Tests

Watch system metrics while tests run:

```bash
# Terminal 1: Run test
k6 run tests/performance/oauth-load-test.js

# Terminal 2: Monitor API logs
docker logs -f truxe-api

# Terminal 3: Monitor database
watch -n 1 'psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"'

# Terminal 4: Monitor Redis
watch -n 1 'redis-cli info stats | grep total_commands_processed'
```

### 3. Regular Baseline Testing

Run performance tests regularly to catch regressions:

```bash
# Weekly baseline test
k6 run --env SCENARIO=load tests/performance/oauth-load-test.js > baseline_$(date +%Y%m%d).txt

# Compare with previous baseline
diff baseline_20251106.txt baseline_20251113.txt
```

---

## Additional Resources

- **[k6 Documentation](https://k6.io/docs/)** - Official k6 docs
- **[OAuth Deployment Guide](../../docs/03-integration-guides/OAUTH_DEPLOYMENT_GUIDE.md)** - Production deployment
- **[API Reference](../../docs/04-api-reference/oauth-endpoints.md)** - OAuth endpoints
- **[Examples](../../docs/03-integration-guides/examples/)** - Integration examples

---

**Last Updated:** November 6, 2025
**k6 Version:** v1.2.3+
**Test Suite Version:** 1.0.0
**Status:** Production-Ready ✅