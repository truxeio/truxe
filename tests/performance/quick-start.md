# Performance Testing - Quick Start Guide

**Get performance tests running in 5 minutes!**

---

## Prerequisites

- ✅ Truxe API running on http://localhost:3001
- ✅ k6 installed (`k6 version` should work)
- ✅ Node.js installed

---

## Option 1: Use Existing User Token (Fastest)

If you already have a user account in Truxe:

### Step 1: Get Access Token

**Via Magic Link:**
```bash
# Request magic link
curl -X POST http://localhost:3001/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com"}'

# Check your email, click link, copy token from URL or response
```

**Via Password Login (if you have password auth):**
```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com","password":"your-password"}'

# Copy access_token from response
```

### Step 2: Set Token
```bash
export ADMIN_TOKEN="your-access-token-here"
```

### Step 3: Register OAuth Client
```bash
cd tests/performance
node setup-test-client.js
```

### Step 4: Run Tests
```bash
# The setup script will output export commands like:
export OAUTH_CLIENT_ID="cl_xxx"
export OAUTH_CLIENT_SECRET="cs_xxx"

# Then run:
k6 run oauth-load-test.js
```

---

## Option 2: Manual OAuth Client Registration

If OAuth client registration endpoint requires special permissions:

### Create Client via Database

```bash
# Connect to database
psql "postgresql://truxe.io_password_change_me@localhost:21432/truxe.io"

# Insert test client
INSERT INTO oauth_clients (
  client_id,
  client_secret_hash,
  client_name,
  redirect_uris,
  allowed_scopes,
  require_pkce,
  require_consent,
  trusted,
  created_at,
  updated_at
) VALUES (
  'perf_test_client',
  '$2b$12$dummy_hash_here',
  'Performance Test Client',
  ARRAY['http://localhost:3000/callback'],
  ARRAY['openid', 'email', 'profile'],
  true,
  false,
  true,
  NOW(),
  NOW()
);
```

Then use:
```bash
export OAUTH_CLIENT_ID="perf_test_client"
export OAUTH_CLIENT_SECRET="any_value_for_testing"
```

---

## Option 3: Skip OAuth Client, Test Public Endpoints

If you just want to test the OAuth **authorization** flow (not full client registration):

### Modify Tests to Use Public Flow

Edit `tests/performance/config.js`:

```javascript
export const config = {
  baseUrl: 'http://localhost:3001',
  // For testing without client registration
  skipClientAuth: true,
};
```

Then run individual endpoint tests:
```bash
k6 run oauth-authorization.js  # Test /authorize endpoint
```

---

## Troubleshooting

### "Route not found" errors

All OAuth provider routes are under the `/api/oauth` prefix:
- `/api/oauth/clients` - Client registration
- `/api/oauth/authorize` - Authorization endpoint
- `/api/oauth/token` - Token endpoint
- `/api/oauth/introspect` - Token introspection

### "Invalid token" (401)

Your access token expired or is invalid. Get a new one via magic link or login.

### "Connection refused"

API server not running. Start it:
```bash
cd api
npm run dev
```

### Database not accessible

Check Docker containers:
```bash
docker ps | grep postgres
docker ps | grep redis
```

---

## Expected Results

**Smoke Test** (2 min, 5 users):
```
✓ checks.........................: 99.00%
✓ http_req_duration..............: avg=245ms p(95)=450ms p(99)=850ms
✓ http_req_failed................: 0.50%
✓ http_reqs......................: 500 requests
```

**Load Test** (10 min, 10-100 users):
```
✓ checks.........................: 98.50%
✓ http_req_duration..............: avg=350ms p(95)=600ms p(99)=1.2s
✓ http_req_failed................: 1.00%
✓ http_reqs......................: 15000 requests
```

---

## Quick Commands Reference

```bash
# Get magic link token
curl -X POST http://localhost:3001/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Set token
export ADMIN_TOKEN="your-token"

# Register OAuth client
cd tests/performance && node setup-test-client.js

# Run smoke test
k6 run --env SCENARIO=smoke oauth-load-test.js

# Run load test
k6 run --env SCENARIO=load oauth-load-test.js

# Run specific endpoint test
k6 run oauth-authorization.js
k6 run oauth-token.js
k6 run oauth-introspection.js
```

---

## Success!

If tests run without errors and show reasonable response times (P95 < 1s), your OAuth Provider is performing well! 🎉

For detailed analysis, see the full [Performance Testing Guide](README.md).

---

**Last Updated:** November 6, 2025
**Status:** Ready to use