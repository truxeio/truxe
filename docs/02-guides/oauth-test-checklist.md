# OAuth Testing Checklist

Use this checklist to verify OAuth implementation is working correctly.

---

## ✅ Pre-Testing Setup

- [ ] PostgreSQL running and accessible
- [ ] Redis running and accessible
- [ ] Database migrations applied (`npm run migrate`)
- [ ] Environment variables configured (`.env`)
  - [ ] `OAUTH_STATE_SECRET`
  - [ ] `OAUTH_TOKEN_ENCRYPTION_KEY`
  - [ ] `GOOGLE_OAUTH_CLIENT_ID`
  - [ ] `GOOGLE_OAUTH_CLIENT_SECRET`
- [ ] Dependencies installed (`npm install`)
- [ ] API server starts without errors (`npm run dev`)

---

## ✅ Unit Tests

### OAuth Infrastructure Tests

```bash
npm test -- tests/oauth-infrastructure.test.js
```

- [ ] All state manager tests pass (5 tests)
- [ ] All token encryptor tests pass (8 tests)
- [ ] All OAuth service tests pass (12 tests)
- [ ] All security tests pass (15 tests)
- [ ] Test coverage > 95%

### Google Provider Tests

```bash
npm test -- tests/oauth-google-provider.test.js
```

- [ ] Configuration tests pass (5 tests)
- [ ] Authorization URL tests pass (8 tests)
- [ ] Token exchange tests pass (6 tests)
- [ ] User profile tests pass (5 tests)
- [ ] Token refresh tests pass (4 tests)
- [ ] Token revocation tests pass (4 tests)
- [ ] Profile normalization tests pass (3 tests)
- [ ] Error handling tests pass (4 tests)
- [ ] OpenID Connect tests pass (1 test)
- [ ] Test coverage > 97%

---

## ✅ Integration Tests

### Automated Integration Tests

```bash
cd api
./scripts/test-oauth.sh
```

- [ ] API health check passes
- [ ] OAuth providers endpoint returns Google provider
- [ ] Authorization request creates valid state
- [ ] Authorization URL is properly formatted
- [ ] State is stored in Redis with TTL
- [ ] Error handling works for invalid requests
- [ ] Database schema exists and is correct

### Manual API Testing

#### Test 1: Provider List

```bash
curl http://localhost:3001/oauth/providers | jq
```

- [ ] Returns success: true
- [ ] Google provider listed
- [ ] Provider has correct scopes

#### Test 2: Authorization Request

```bash
curl -X POST http://localhost:3001/oauth/google/start \
  -H "Content-Type: application/json" \
  -d '{"redirectUri": "http://localhost:3001/auth/callback/google"}' | jq
```

- [ ] Returns success: true
- [ ] Returns authorizationUrl
- [ ] Returns state parameter
- [ ] Returns expiresAt timestamp
- [ ] URL contains all required parameters

#### Test 3: Redis State Verification

```bash
redis-cli KEYS "oauth:state:*"
redis-cli GET "oauth:state:<state-id>"
```

- [ ] State key exists in Redis
- [ ] State has appropriate TTL (300 seconds)
- [ ] State payload is valid JSON
- [ ] Payload contains provider, redirectUri, timestamp

#### Test 4: Error Handling

```bash
# Missing redirect URI
curl -X POST http://localhost:3001/oauth/google/start \
  -H "Content-Type: application/json" \
  -d '{}' | jq
```

- [ ] Returns error object
- [ ] Error code is descriptive
- [ ] Error message is user-friendly

```bash
# Invalid provider
curl -X POST http://localhost:3001/oauth/invalid/start \
  -H "Content-Type: application/json" \
  -d '{"redirectUri": "http://localhost:3001/callback"}' | jq
```

- [ ] Returns 404 status code
- [ ] Returns error object

---

## ✅ Manual OAuth Flow Testing

### Setup

- [ ] Google OAuth credentials configured in Google Cloud Console
- [ ] Redirect URI registered: `http://localhost:3001/auth/callback/google`
- [ ] Test Google account available

### Test Flow

#### Step 1: Initiate Authorization

```bash
curl -X POST http://localhost:3001/oauth/google/start \
  -H "Content-Type: application/json" \
  -d '{"redirectUri": "http://localhost:3001/auth/callback/google"}' \
  | jq -r '.authorizationUrl'
```

- [ ] Authorization URL generated
- [ ] URL copied to clipboard

#### Step 2: User Authorization

- [ ] Open authorization URL in browser
- [ ] Google sign-in page displays
- [ ] Sign in with test account
- [ ] Consent screen displays with correct app name
- [ ] Consent screen shows requested scopes:
  - [ ] "Associate you with your personal info" (OpenID)
  - [ ] "View your email address"
  - [ ] "View your basic profile info"

#### Step 3: Authorization Grant

- [ ] Click "Allow" or "Continue"
- [ ] Redirected to callback URL
- [ ] URL contains `code` parameter
- [ ] URL contains `state` parameter
- [ ] Browser displays success response (or error if auth fails)

#### Step 4: Verify Server Logs

Check API logs for:

- [ ] "OAuth callback received"
- [ ] "Provider: google"
- [ ] "Exchanging authorization code for tokens"
- [ ] "Verifying Google ID token"
- [ ] "ID token verified successfully"
- [ ] "Retrieving user profile"
- [ ] "Profile retrieved from ID token"
- [ ] "Creating/linking OAuth account"
- [ ] "OAuth authentication successful"

#### Step 5: Verify Response

- [ ] Response contains `success: true`
- [ ] Response contains `user` object:
  - [ ] `id` (UUID)
  - [ ] `email`
  - [ ] `emailVerified: true`
- [ ] Response contains `profile` object:
  - [ ] `id` (Google user ID)
  - [ ] `email`
  - [ ] `name`
  - [ ] `givenName`
  - [ ] `familyName`
  - [ ] `picture` (URL)
  - [ ] `provider: "google"`
- [ ] Response contains `account` object:
  - [ ] `id` (UUID)
  - [ ] `provider: "google"`
  - [ ] `providerAccountId`

#### Step 6: Verify Database Records

```sql
-- Check user created
SELECT id, email, email_verified FROM users WHERE email = 'your-test-email@gmail.com';
```

- [ ] User record exists
- [ ] Email matches Google email
- [ ] `email_verified` is true

```sql
-- Check OAuth account created
SELECT
  id,
  user_id,
  provider,
  provider_account_id,
  provider_email,
  token_expires_at,
  scope,
  created_at
FROM oauth_accounts
WHERE provider = 'google' AND provider_email = 'your-test-email@gmail.com';
```

- [ ] OAuth account record exists
- [ ] `provider` is "google"
- [ ] `provider_account_id` populated
- [ ] `provider_email` matches
- [ ] `token_expires_at` is in future
- [ ] `scope` contains "openid email profile"

```sql
-- Check tokens are encrypted
SELECT
  provider,
  length(access_token) as access_token_len,
  length(refresh_token) as refresh_token_len,
  length(id_token) as id_token_len
FROM oauth_accounts
WHERE provider = 'google' AND provider_email = 'your-test-email@gmail.com';
```

- [ ] `access_token` length > 200 (encrypted)
- [ ] `refresh_token` length > 200 (encrypted, if present)
- [ ] `id_token` length > 500 (encrypted)
- [ ] Tokens are NOT plaintext

---

## ✅ Advanced Features Testing

### Hosted Domain Restriction

```bash
curl -X POST http://localhost:3001/oauth/google/start \
  -H "Content-Type: application/json" \
  -d '{
    "redirectUri": "http://localhost:3001/auth/callback/google",
    "context": {"hostedDomain": "example.com"}
  }' | jq -r '.authorizationUrl'
```

- [ ] Authorization URL contains `&hd=example.com`
- [ ] Google only shows users from specified domain
- [ ] Non-domain users see error

### Login Hint

```bash
curl -X POST http://localhost:3001/oauth/google/start \
  -H "Content-Type: application/json" \
  -d '{
    "redirectUri": "http://localhost:3001/auth/callback/google",
    "context": {"email": "test@gmail.com"}
  }' | jq -r '.authorizationUrl'
```

- [ ] Authorization URL contains `&login_hint=test@gmail.com`
- [ ] Google pre-fills email field

### Custom Scopes

```bash
curl -X POST http://localhost:3001/oauth/google/start \
  -H "Content-Type: application/json" \
  -d '{
    "redirectUri": "http://localhost:3001/auth/callback/google",
    "scopes": ["openid", "email", "profile", "https://www.googleapis.com/auth/calendar.readonly"]
  }' | jq -r '.authorizationUrl'
```

- [ ] Authorization URL contains calendar scope
- [ ] Consent screen shows additional permission
- [ ] After authorization, `scope` field includes calendar scope

### Force Consent

```bash
curl -X POST http://localhost:3001/oauth/google/start \
  -H "Content-Type: application/json" \
  -d '{
    "redirectUri": "http://localhost:3001/auth/callback/google",
    "prompt": "consent"
  }' | jq -r '.authorizationUrl'
```

- [ ] Authorization URL contains `&prompt=consent`
- [ ] Consent screen always displays (even if previously authorized)
- [ ] Refresh token is returned in token response

---

## ✅ Error Scenarios Testing

### Invalid State Parameter

```bash
curl "http://localhost:3001/auth/callback/google?code=valid-code&state=tampered-state"
```

- [ ] Returns error response
- [ ] Error code: "OAUTH_INVALID_STATE"
- [ ] Error message: "Invalid or expired state parameter"
- [ ] HTTP status: 400

### Expired State

1. Generate state
2. Wait 6 minutes (state TTL is 5 minutes)
3. Try to use state

- [ ] Returns error
- [ ] Error indicates state expired
- [ ] State removed from Redis

### User Cancellation

1. Start OAuth flow
2. On Google consent screen, click "Cancel"

- [ ] Redirected with `error=access_denied`
- [ ] API returns user-friendly error
- [ ] Error code: "OAUTH_USER_CANCELLED"

### Invalid Authorization Code

```bash
# Simulate callback with invalid code
curl "http://localhost:3001/auth/callback/google?code=invalid-code&state=<valid-state>"
```

- [ ] Google returns error (invalid_grant)
- [ ] API returns user-friendly error
- [ ] Error logged appropriately

### Missing Scopes

Configure provider with minimal scopes and verify error handling:

- [ ] Missing `openid` scope handled
- [ ] Missing `email` scope handled
- [ ] Profile data incomplete but no crash

---

## ✅ Security Testing

### Token Encryption

```sql
-- Raw token should NOT be decryptable without key
SELECT access_token FROM oauth_accounts LIMIT 1;
```

- [ ] Token is base64url encoded
- [ ] Token is not readable plaintext
- [ ] Token cannot be decrypted without `OAUTH_TOKEN_ENCRYPTION_KEY`

### State Signature Verification

1. Generate state
2. Modify state ID (first part before `.`)
3. Try to validate

- [ ] Validation fails
- [ ] Error indicates tampering

### CSRF Protection

1. Generate state for one provider
2. Use state in callback for different provider

- [ ] Validation fails
- [ ] Error indicates provider mismatch

### ID Token Verification

Check logs during OAuth flow:

- [ ] ID token signature verified with Google JWKS
- [ ] Issuer claim validated (`https://accounts.google.com`)
- [ ] Audience claim validated (matches client ID)
- [ ] Expiration time validated
- [ ] No self-signed or tampered tokens accepted

---

## ✅ Performance Testing

### JWKS Caching

1. Complete OAuth flow (causes JWKS fetch)
2. Complete another OAuth flow immediately
3. Check logs

- [ ] First flow fetches JWKS from Google
- [ ] Second flow uses cached JWKS
- [ ] Response time improved on second flow

### State Cleanup

```bash
# Check Redis memory usage
redis-cli INFO memory
```

- [ ] Expired states automatically removed (TTL)
- [ ] Memory doesn't grow unbounded

### Token Encryption Performance

Run benchmark:

```bash
npm test -- tests/oauth-infrastructure.test.js --grep "performance"
```

- [ ] Encryption < 5ms per token
- [ ] Decryption < 5ms per token

---

## ✅ Logging & Monitoring

### Log Levels

- [ ] INFO logs show major OAuth events
- [ ] DEBUG logs show detailed flow (when `LOG_LEVEL=debug`)
- [ ] ERROR logs show failures with context
- [ ] No sensitive data (tokens, secrets) in logs

### Audit Trail

Check logs contain:

- [ ] OAuth authorization initiated (with provider)
- [ ] OAuth callback received
- [ ] Token exchange completed
- [ ] User profile retrieved
- [ ] OAuth account created/updated
- [ ] All errors logged with actionable details

---

## ✅ Documentation

- [ ] `oauth-architecture.md` is accurate and complete
- [ ] `google-oauth-setup.md` instructions work end-to-end
- [ ] `oauth-testing-guide.md` (this document) is followed
- [ ] Implementation summaries are up-to-date
- [ ] API documentation includes OAuth endpoints
- [ ] Troubleshooting section covers common issues

---

## 📊 Test Results Summary

### Unit Tests
- OAuth Infrastructure: **___ / ___ tests passed**
- Google Provider: **___ / ___ tests passed**
- Total Coverage: **___%**

### Integration Tests
- Automated script: **___ / ___ checks passed**
- Manual API tests: **___ / ___ tests passed**

### Manual OAuth Flow
- Authorization flow: **✅ / ❌**
- Token exchange: **✅ / ❌**
- Profile retrieval: **✅ / ❌**
- Database persistence: **✅ / ❌**

### Security Tests
- Token encryption: **✅ / ❌**
- State validation: **✅ / ❌**
- CSRF protection: **✅ / ❌**
- ID token verification: **✅ / ❌**

### Overall Status
- **✅ Ready for production**
- **⚠️ Needs fixes** (list issues)
- **❌ Not ready** (list blockers)

---

**Last Updated**: 2025-01-28
**Tested By**: _____________
**Date Tested**: _____________
**Version**: v0.2.0
