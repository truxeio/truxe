# OAuth Testing Guide

**Version**: v0.2.0
**Last Updated**: 2025-01-28
**Covers**: OAuth Infrastructure (Ticket 1.1) & Google Provider (Ticket 1.2)

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Unit Testing](#unit-testing)
4. [Integration Testing](#integration-testing)
5. [Manual Testing](#manual-testing)
6. [Test Scenarios](#test-scenarios)
7. [Troubleshooting](#troubleshooting)

---

## Overview

This guide covers all testing approaches for the OAuth implementation:
- **Unit Tests**: Testing individual components in isolation
- **Integration Tests**: Testing the complete OAuth flow
- **Manual Tests**: Testing with real OAuth providers (Google)

---

## Prerequisites

### 1. Environment Setup

Ensure you have the following configured in your `.env` file:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/truxe

# Redis (for state management)
REDIS_URL=redis://localhost:6379

# OAuth Configuration
OAUTH_STATE_SECRET=generate-with-openssl-rand-base64-32
OAUTH_TOKEN_ENCRYPTION_KEY=generate-with-openssl-rand-base64-32

# Google OAuth (for manual testing)
GOOGLE_OAUTH_ENABLED=true
GOOGLE_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your-google-oauth-secret

# Optional: Logging
LOG_LEVEL=debug
```

### 2. Generate Secrets

```bash
# Generate OAuth state secret (32 bytes)
openssl rand -base64 32

# Generate token encryption key (32 bytes)
openssl rand -base64 32
```

### 3. Database Migration

Ensure the OAuth infrastructure migration is applied:

```bash
cd api
npm run migrate
```

Expected output:
```
Running migration: 014_oauth_infrastructure.sql
✅ Migration completed successfully
```

### 4. Install Dependencies

```bash
cd api
npm install
```

---

## Unit Testing

Unit tests verify individual components work correctly in isolation.

### Running All OAuth Tests

```bash
# Run all OAuth-related tests
npm test -- --grep "OAuth"

# Or run specific test files
npm test -- tests/oauth-infrastructure.test.js
npm test -- tests/oauth-google-provider.test.js
```

### Running Individual Test Suites

#### OAuth Infrastructure Tests

```bash
npm test -- tests/oauth-infrastructure.test.js
```

**What it tests:**
- ✅ State management (generation, validation, expiration)
- ✅ Token encryption/decryption (AES-256-GCM)
- ✅ OAuth service orchestration
- ✅ CSRF protection
- ✅ Error handling

**Expected output:**
```
✓ OAuth State Manager
  ✓ generates valid state with metadata
  ✓ validates legitimate state
  ✓ rejects expired state
  ✓ rejects tampered state
  ✓ enforces one-time use

✓ OAuth Token Encryptor
  ✓ encrypts and decrypts tokens
  ✓ rejects tampered ciphertext
  ✓ handles different token lengths

✓ OAuth Service
  ✓ creates authorization request
  ✓ handles callback successfully
  ✓ links OAuth accounts
  ✓ unlinks OAuth accounts

Tests: 40 passed
Coverage: 95.2%
```

#### Google OAuth Provider Tests

```bash
npm test -- tests/oauth-google-provider.test.js
```

**What it tests:**
- ✅ Provider configuration validation
- ✅ Authorization URL generation
- ✅ Token exchange
- ✅ ID token verification (JWKS, RS256)
- ✅ User profile retrieval
- ✅ Token refresh
- ✅ Token revocation
- ✅ Error handling
- ✅ Profile normalization

**Expected output:**
```
✓ Google OAuth Provider
  ✓ Configuration & Initialization (5 tests)
  ✓ Authorization URL Generation (8 tests)
  ✓ Token Exchange (6 tests)
  ✓ User Profile Retrieval (5 tests)
  ✓ Token Refresh (4 tests)
  ✓ Token Revocation (4 tests)
  ✓ Profile Normalization (3 tests)
  ✓ Error Handling (4 tests)
  ✓ OpenID Connect (1 test)

Tests: 40 passed
Coverage: 97.1%
```

### Running Tests with Coverage

```bash
# Coverage for all OAuth tests
npm run test:coverage -- tests/oauth-*.test.js

# View detailed coverage report
open coverage/index.html
```

**Coverage targets:**
- ✅ Statements: >95%
- ✅ Branches: >90%
- ✅ Functions: >95%
- ✅ Lines: >95%

### Running Tests in Watch Mode

For active development:

```bash
npm test -- --watch tests/oauth-infrastructure.test.js
```

---

## Integration Testing

Integration tests verify the complete OAuth flow with real components.

### 1. Start Required Services

```bash
# Terminal 1: Start PostgreSQL (if not running)
brew services start postgresql@14
# or
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=password postgres:14

# Terminal 2: Start Redis (if not running)
brew services start redis
# or
docker run -d -p 6379:6379 redis:7

# Terminal 3: Start Truxe API
cd api
npm run dev
```

Expected output:
```
[INFO] Truxe API starting...
[INFO] Database connected
[INFO] Redis connected
[INFO] Google OAuth provider registered
[INFO] Server listening on http://localhost:3001
```

### 2. Verify Provider Registration

```bash
# Check registered OAuth providers
curl http://localhost:3001/oauth/providers | jq
```

Expected response:
```json
{
  "success": true,
  "providers": [
    {
      "id": "google",
      "name": "Google",
      "enabled": true,
      "scopes": ["openid", "email", "profile"]
    }
  ]
}
```

### 3. Test State Generation

```bash
# Create authorization request
curl -X POST http://localhost:3001/oauth/google/start \
  -H "Content-Type: application/json" \
  -d '{
    "redirectUri": "http://localhost:3000/auth/callback",
    "scopes": ["openid", "email", "profile"]
  }' | jq
```

Expected response:
```json
{
  "success": true,
  "provider": "google",
  "authorizationUrl": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...&redirect_uri=...&response_type=code&scope=openid+email+profile&state=...&access_type=offline&include_granted_scopes=true",
  "state": "abc123.signature",
  "expiresAt": "2025-01-28T10:10:00Z"
}
```

**Verify state in Redis:**
```bash
redis-cli
> KEYS oauth:state:*
> GET oauth:state:abc123
```

### 4. Test Authorization URL Structure

Extract and verify the authorization URL from the previous response:

```bash
# The URL should contain:
# ✅ client_id=your-google-client-id
# ✅ redirect_uri=http://localhost:3000/auth/callback (URL encoded)
# ✅ response_type=code
# ✅ scope=openid email profile
# ✅ state=abc123.signature
# ✅ access_type=offline
# ✅ include_granted_scopes=true
```

### 5. Test Error Handling

```bash
# Test missing redirect URI
curl -X POST http://localhost:3001/oauth/google/start \
  -H "Content-Type: application/json" \
  -d '{}' | jq

# Expected: 400 Bad Request
{
  "error": {
    "code": "OAUTH_VALIDATION_ERROR",
    "message": "redirectUri is required"
  }
}

# Test invalid provider
curl -X POST http://localhost:3001/oauth/invalid/start \
  -H "Content-Type: application/json" \
  -d '{"redirectUri": "http://localhost:3000/callback"}' | jq

# Expected: 404 Not Found
{
  "error": {
    "code": "OAUTH_PROVIDER_NOT_FOUND",
    "message": "OAuth provider 'invalid' not found"
  }
}
```

---

## Manual Testing

Manual testing with real Google OAuth requires actual user interaction.

### Prerequisites for Manual Testing

1. **Google OAuth Credentials** (see [google-oauth-setup.md](./google-oauth-setup.md))
   - Client ID
   - Client secret
   - Authorized redirect URIs configured

2. **Frontend Application** (or use curl + browser)
   - Can be a simple HTML page
   - Or your actual frontend app

### Option A: Testing with curl + Browser

#### Step 1: Initiate Authorization

```bash
curl -X POST http://localhost:3001/oauth/google/start \
  -H "Content-Type: application/json" \
  -d '{
    "redirectUri": "http://localhost:3001/auth/callback/google"
  }' | jq -r '.authorizationUrl'
```

This returns an authorization URL like:
```
https://accounts.google.com/o/oauth2/v2/auth?client_id=...&state=...
```

#### Step 2: Open URL in Browser

1. Copy the authorization URL
2. Open it in your browser
3. Sign in with your Google account
4. Grant permissions
5. You'll be redirected to: `http://localhost:3001/auth/callback/google?code=...&state=...`

#### Step 3: Handle Callback

The callback is automatically handled by Truxe. Check the logs:

```
[INFO] OAuth callback received
[INFO] Provider: google
[INFO] Exchanging authorization code for tokens
[INFO] Verifying Google ID token
[INFO] ID token verified successfully
[INFO] Retrieving user profile
[INFO] Profile retrieved from ID token
[INFO] Creating/linking OAuth account
[INFO] OAuth authentication successful
```

**Response in browser:**
```json
{
  "success": true,
  "user": {
    "id": "user-uuid",
    "email": "user@gmail.com",
    "emailVerified": true
  },
  "profile": {
    "id": "google-user-123",
    "email": "user@gmail.com",
    "emailVerified": true,
    "name": "John Doe",
    "givenName": "John",
    "familyName": "Doe",
    "picture": "https://lh3.googleusercontent.com/...",
    "provider": "google",
    "profileSource": "id_token"
  },
  "account": {
    "id": "oauth-account-uuid",
    "provider": "google",
    "providerAccountId": "google-user-123"
  }
}
```

### Option B: Testing with Simple HTML Page

Create `test-oauth.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>OAuth Test</title>
</head>
<body>
  <h1>Truxe OAuth Test</h1>
  <button onclick="startOAuth()">Sign in with Google</button>
  <div id="result"></div>

  <script>
    async function startOAuth() {
      const response = await fetch('http://localhost:3001/oauth/google/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          redirectUri: 'http://localhost:3001/auth/callback/google'
        })
      });

      const data = await response.json();

      if (data.success) {
        // Redirect to Google for authorization
        window.location.href = data.authorizationUrl;
      } else {
        document.getElementById('result').innerHTML =
          `<pre>Error: ${JSON.stringify(data.error, null, 2)}</pre>`;
      }
    }

    // Check if we're coming back from OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('code')) {
      document.getElementById('result').innerHTML =
        '<h2>✅ OAuth Success!</h2><p>Check server logs for details.</p>';
    }
  </script>
</body>
</html>
```

Open in browser:
```bash
open test-oauth.html
```

### Verifying Database Records

After successful OAuth flow, verify database:

```bash
# Connect to database
psql -d truxe

# Check OAuth accounts
SELECT
  id,
  user_id,
  provider,
  provider_account_id,
  provider_email,
  token_expires_at,
  scope,
  created_at
FROM oauth_accounts;

# Check tokens are encrypted
SELECT
  provider,
  length(access_token) as access_token_length,
  length(refresh_token) as refresh_token_length,
  length(id_token) as id_token_length
FROM oauth_accounts;
```

Expected output:
```
 provider | access_token_length | refresh_token_length | id_token_length
----------+---------------------+----------------------+-----------------
 google   |                 340 |                  340 |             680
```

(Encrypted tokens are longer than plaintext due to IV + AuthTag)

---

## Test Scenarios

### Scenario 1: First-Time User Sign-In

**Goal**: New user signs in with Google for the first time

**Steps:**
1. User clicks "Sign in with Google"
2. API generates authorization URL
3. User authorizes on Google
4. Google redirects back with code
5. API exchanges code for tokens
6. API retrieves user profile
7. API creates new user record
8. API creates OAuth account record
9. API returns authentication token

**Verification:**
```sql
-- User created
SELECT * FROM users WHERE email = 'newuser@gmail.com';

-- OAuth account linked
SELECT * FROM oauth_accounts WHERE provider = 'google' AND provider_email = 'newuser@gmail.com';
```

### Scenario 2: Existing User Sign-In

**Goal**: Existing user signs in with already-linked Google account

**Steps:**
1. User clicks "Sign in with Google"
2. OAuth flow completes
3. API finds existing OAuth account
4. API returns authentication token for existing user

**Verification:**
```sql
-- Check oauth_accounts.updated_at is recent
SELECT user_id, provider, updated_at FROM oauth_accounts WHERE provider_email = 'existinguser@gmail.com';
```

### Scenario 3: Account Linking

**Goal**: User links Google account to existing Truxe account

**Steps:**
1. User is already logged into Truxe
2. User clicks "Link Google Account"
3. OAuth flow completes
4. API links Google account to authenticated user

**Verification:**
```sql
-- Same user_id has multiple OAuth providers
SELECT user_id, provider FROM oauth_accounts WHERE user_id = 'user-uuid';
```

### Scenario 4: Token Refresh

**Goal**: Expired access token is refreshed using refresh token

**Setup:**
```bash
# Manually expire an access token in database
UPDATE oauth_accounts
SET token_expires_at = NOW() - INTERVAL '1 hour'
WHERE provider = 'google' AND provider_account_id = 'google-user-123';
```

**Test:**
```bash
# Make API call that requires Google access
curl -X POST http://localhost:3001/api/google/calendar \
  -H "Authorization: Bearer your-truxe-token"
```

**Expected behavior:**
- API detects expired token
- API calls `refreshAccessToken()` with refresh token
- New access token is obtained and encrypted
- API call succeeds with new token

**Verification:**
```sql
-- token_expires_at should be in the future
SELECT provider_account_id, token_expires_at FROM oauth_accounts WHERE provider = 'google';
```

### Scenario 5: Account Unlinking

**Goal**: User unlinks Google account from Truxe

**Test:**
```bash
curl -X DELETE http://localhost:3001/api/user/oauth-accounts/google \
  -H "Authorization: Bearer your-truxe-token"
```

**Expected:**
- Token is revoked on Google
- OAuth account record deleted from database
- User remains in Truxe (if has other auth methods)

**Verification:**
```sql
SELECT * FROM oauth_accounts WHERE provider = 'google' AND user_id = 'user-uuid';
-- Should return no rows
```

### Scenario 6: Error Handling - Invalid State

**Goal**: Reject callback with tampered state parameter

**Test:**
```bash
# Tamper with state parameter
curl "http://localhost:3001/auth/callback/google?code=valid-code&state=invalid-state"
```

**Expected response:**
```json
{
  "error": {
    "code": "OAUTH_INVALID_STATE",
    "message": "Invalid or expired state parameter"
  }
}
```

### Scenario 7: Error Handling - User Cancels

**Goal**: Handle user canceling OAuth consent screen

**Test:**
1. Start OAuth flow
2. On Google consent screen, click "Cancel"
3. Google redirects with error

**Callback:**
```
http://localhost:3001/auth/callback/google?error=access_denied&state=...
```

**Expected response:**
```json
{
  "error": {
    "code": "OAUTH_USER_CANCELLED",
    "message": "User cancelled authorization"
  }
}
```

### Scenario 8: Hosted Domain Restriction

**Goal**: Only allow users from specific Google Workspace domain

**Configuration:**
```bash
# .env
GOOGLE_OAUTH_HOSTED_DOMAIN=yourcompany.com
```

**Test:**
```bash
# Start OAuth flow
curl -X POST http://localhost:3001/oauth/google/start \
  -H "Content-Type: application/json" \
  -d '{
    "redirectUri": "http://localhost:3001/auth/callback/google",
    "context": {
      "hostedDomain": "yourcompany.com"
    }
  }' | jq -r '.authorizationUrl'
```

**Authorization URL should contain:**
```
&hd=yourcompany.com
```

**Sign in with non-company email**: Should fail at Google level or during ID token validation

---

## Troubleshooting

### Issue: Tests Failing with "Redis connection error"

**Solution:**
```bash
# Start Redis
brew services start redis

# Or with Docker
docker run -d -p 6379:6379 redis:7

# Verify Redis is running
redis-cli ping
# Should respond: PONG
```

### Issue: "Token decryption failed"

**Cause**: `OAUTH_TOKEN_ENCRYPTION_KEY` changed or not set

**Solution:**
```bash
# Generate new key
openssl rand -base64 32

# Update .env
OAUTH_TOKEN_ENCRYPTION_KEY=<new-key>

# Clear existing encrypted tokens
redis-cli FLUSHDB
psql -d truxe -c "DELETE FROM oauth_accounts;"
```

### Issue: "ID token verification failed"

**Causes:**
1. System clock out of sync
2. JWKS cache issue
3. Invalid token

**Solutions:**
```bash
# Check system time
date
# Should be close to current UTC time

# Clear JWKS cache (restart API)
npm run dev

# Check Google status
curl https://www.google.com/appsstatus
```

### Issue: Unit tests pass but integration tests fail

**Common causes:**
1. Missing environment variables
2. Database migration not applied
3. Redis not running
4. Port conflicts

**Debug checklist:**
```bash
# Check environment
cat .env | grep OAUTH

# Check database migration
psql -d truxe -c "\dt oauth_accounts"

# Check Redis
redis-cli ping

# Check port availability
lsof -i :3001
```

### Issue: "redirect_uri_mismatch" from Google

**Solution:**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to Credentials
3. Edit OAuth client
4. Ensure redirect URI exactly matches:
   - Protocol (http vs https)
   - Domain
   - Port
   - Path
   - No trailing slash

### Debug Mode

Enable detailed logging:

```bash
# .env
LOG_LEVEL=debug
NODE_ENV=development

# Restart API
npm run dev
```

This will log:
- State generation/validation
- Token encryption/decryption
- OAuth flow steps
- API requests/responses (tokens redacted)

---

## Next Steps

After verifying tests pass:

1. ✅ **Ticket 1.3**: Implement GitHub OAuth Provider
2. ✅ **Ticket 1.4**: Implement Apple Sign In Provider
3. ✅ **Ticket 1.5**: Build OAuth UI Components
4. ✅ **Ticket 1.6**: Security audit and additional tests
5. ✅ **Ticket 1.7**: Complete documentation

---

**Last Updated**: 2025-01-28
**Tested with**: Truxe v0.2.0, Google OAuth 2.0 API, Node.js v20+
**Related Docs**:
- [OAuth Architecture](../02-technical/oauth-architecture.md)
- [Google OAuth Setup](./google-oauth-setup.md)
- [Implementation Summaries](../06-implementation-summaries/)
