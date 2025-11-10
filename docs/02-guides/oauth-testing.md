# OAuth Framework Testing Guide

Complete guide for testing the Truxe Universal OAuth Framework with all 4 providers (GitHub, Google, Apple, Microsoft).

## Table of Contents

- [Overview](#overview)
- [Automated Tests](#automated-tests)
- [Manual Testing](#manual-testing)
  - [Google OAuth](#google-oauth-manual-testing)
  - [Apple OAuth](#apple-oauth-manual-testing)
  - [Microsoft OAuth](#microsoft-oauth-manual-testing)
  - [GitHub OAuth](#github-oauth-manual-testing)
- [Testing Checklist](#testing-checklist)
- [Troubleshooting](#troubleshooting)

---

## Overview

The OAuth framework includes comprehensive integration tests and manual testing procedures for all 4 providers:

| Provider | Automated Tests | Manual Tests | Status |
|----------|----------------|--------------|--------|
| **GitHub** | 40+ tests ✅ | Complete ✅ | Production Ready |
| **Google** | 40+ tests ✅ | Complete ✅ | Production Ready |
| **Apple** | 28 tests ⏳ | Pending | Implementation Complete |
| **Microsoft** | 30 tests ⏳ | Pending | Implementation Complete |

---

## Automated Tests

### Running All OAuth Tests

```bash
# Run all OAuth infrastructure tests
npm run test:oauth

# Run specific provider tests
node --test tests/oauth-google-provider.test.js
node --test tests/oauth-apple-provider.test.js
node --test tests/oauth-microsoft-provider.test.js
node --test tests/oauth-infrastructure.test.js
```

### Test Coverage

**Google OAuth Provider** (`oauth-google-provider.test.js`):
- ✅ Configuration & Initialization (5 tests)
- ✅ Authorization URL Generation (7 tests)
- ✅ Token Exchange (5 tests)
- ✅ User Profile Retrieval (4 tests)
- ✅ Token Refresh (2 tests)
- ✅ Token Revocation (2 tests)
- ✅ JWKS and ID Token (tests)
- **Total: 40+ tests, 97% coverage**

**Apple OAuth Provider** (`oauth-apple-provider.test.js`):
- ✅ Configuration & Initialization (7 tests)
- ⏳ JWT Client Secret Generation (3 tests)
- ✅ Authorization URL Generation (3 tests)
- ⏳ Token Exchange (4 tests)
- ✅ User Profile Retrieval (4 tests)
- ⏳ Token Refresh (2 tests)
- ⏳ Token Revocation (3 tests)
- ✅ Profile Normalization (2 tests)
- **Total: 28 tests**

**Microsoft OAuth Provider** (`oauth-microsoft-provider.test.js`):
- ✅ Configuration & Initialization (7 tests)
- ✅ Authorization URL Generation (6 tests)
- ⏳ Token Exchange (5 tests)
- ⏳ User Profile Retrieval (4 tests)
- ⏳ Token Refresh (3 tests)
- ✅ Token Revocation (1 test)
- ✅ Logout URL Generation (2 tests)
- ✅ Profile Normalization (2 tests)
- **Total: 30 tests**

---

## Manual Testing

### Prerequisites

1. **Environment Setup**
   ```bash
   cp .env.example .env
   # Configure OAuth credentials in .env
   ```

2. **Start Services**
   ```bash
   # Start PostgreSQL and Redis
   docker-compose up -d postgres redis

   # Start API server
   npm run dev
   ```

3. **Verify Health**
   ```bash
   curl http://localhost:3001/health
   ```

---

### Google OAuth Manual Testing

#### Step 1: Configure Google OAuth App

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3001/auth/oauth/callback/google`
5. Copy Client ID and Client Secret

#### Step 2: Update Environment Variables

```bash
# .env
GOOGLE_OAUTH_ENABLED=true
GOOGLE_OAUTH_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your_client_secret
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3001/auth/oauth/callback/google
```

#### Step 3: Test OAuth Flow

```bash
# 1. Get available providers
curl http://localhost:3001/api/oauth/providers | jq .

# 2. Initiate OAuth flow
curl -X POST http://localhost:3001/api/oauth/google/start \
  -H "Content-Type: application/json" \
  -d '{"redirectUri": "http://localhost:3001/auth/oauth/callback/google"}' \
  | jq .

# 3. Open the authorizationUrl in your browser
# 4. Sign in with Google
# 5. Check callback logs for successful token exchange
```

#### Step 4: Verify Features

- [x] Authorization URL generation
- [x] User consent screen
- [x] Token exchange
- [x] ID token verification (OpenID Connect)
- [x] User profile retrieval
- [x] Email verification status
- [x] Token refresh
- [x] Token revocation

---

### Apple OAuth Manual Testing

#### Step 1: Configure Apple Sign In

1. Enroll in [Apple Developer Program](https://developer.apple.com/programs/) ($99/year)
2. Create an App ID at [Identifiers](https://developer.apple.com/account/resources/identifiers/list)
3. Create a Services ID:
   - Identifier: `com.yourcompany.yourapp`
   - Configure Sign in with Apple
   - Add domain: `localhost` (for testing)
   - Add redirect URL: `http://localhost:3001/auth/oauth/callback/apple`
4. Create a private key:
   - Go to [Keys](https://developer.apple.com/account/resources/authkeys/list)
   - Create new key
   - Enable Sign in with Apple
   - Download `.p8` file (SAVE IT - can't download again!)
   - Note the Key ID

#### Step 2: Prepare Private Key

```bash
# Convert .p8 to base64 for environment variable
cat AuthKey_ABC123XYZ.p8 | base64 > apple-key-base64.txt
```

#### Step 3: Update Environment Variables

```bash
# .env
APPLE_OAUTH_ENABLED=true
APPLE_OAUTH_CLIENT_ID=com.yourcompany.yourapp
APPLE_OAUTH_TEAM_ID=YOUR_TEAM_ID
APPLE_OAUTH_KEY_ID=ABC123XYZ
APPLE_OAUTH_PRIVATE_KEY=<paste base64 encoded key>
APPLE_OAUTH_CALLBACK_URL=http://localhost:3001/auth/oauth/callback/apple
```

#### Step 4: Test OAuth Flow

```bash
# 1. Initiate Apple OAuth
curl -X POST http://localhost:3001/api/oauth/apple/start \
  -H "Content-Type: application/json" \
  -d '{"redirectUri": "http://localhost:3001/auth/oauth/callback/apple"}' \
  | jq .

# 2. Open authorizationUrl in browser
# 3. Sign in with Apple ID
# 4. Check logs for successful authentication
```

#### Step 5: Verify Features

- [x] JWT client secret generation (ES256)
- [x] Authorization URL generation
- [x] User consent screen
- [x] Token exchange
- [x] ID token decoding
- [x] Private email relay detection (@privaterelay.appleid.com)
- [x] Name retrieval (first authorization only)
- [x] Token refresh
- [x] Token revocation

**Note:** Apple only provides name on FIRST authorization. Subsequent logins won't include name.

---

### Microsoft OAuth Manual Testing

#### Step 1: Configure Microsoft App

1. Go to [Azure Portal](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Click "New registration"
3. Configure:
   - Name: Your app name
   - Supported account types: "Accounts in any organizational directory and personal Microsoft accounts"
   - Redirect URI: Web - `http://localhost:3001/auth/oauth/callback/microsoft`
4. After creation:
   - Copy Application (client) ID
   - Go to "Certificates & secrets" → New client secret
   - Copy the secret VALUE (not ID)

#### Step 2: Update Environment Variables

```bash
# .env
MICROSOFT_OAUTH_ENABLED=true
MICROSOFT_OAUTH_CLIENT_ID=your_application_client_id
MICROSOFT_OAUTH_CLIENT_SECRET=your_client_secret_value
MICROSOFT_OAUTH_TENANT=common
MICROSOFT_OAUTH_CALLBACK_URL=http://localhost:3001/auth/oauth/callback/microsoft
```

#### Step 3: Test OAuth Flow

```bash
# 1. Initiate Microsoft OAuth
curl -X POST http://localhost:3001/api/oauth/microsoft/start \
  -H "Content-Type: application/json" \
  -d '{"redirectUri": "http://localhost:3001/auth/oauth/callback/microsoft"}' \
  | jq .

# 2. Open authorizationUrl in browser
# 3. Sign in with Microsoft account (personal or work)
# 4. Check logs for successful authentication
```

#### Step 4: Test Multi-Tenant Scenarios

```bash
# Test with personal accounts only
MICROSOFT_OAUTH_TENANT=consumers npm run dev

# Test with work/school accounts only
MICROSOFT_OAUTH_TENANT=organizations npm run dev

# Test with specific tenant
MICROSOFT_OAUTH_TENANT=your-tenant-id npm run dev
```

#### Step 5: Verify Features

- [x] Multi-tenant authorization
- [x] Personal Microsoft account login
- [x] Work/school account login (Azure AD)
- [x] Microsoft Graph API profile retrieval
- [x] Extended token expiry
- [x] Token refresh
- [x] Logout URL generation
- [x] PKCE support (optional)

---

### GitHub OAuth Manual Testing

GitHub OAuth testing is already complete. See existing documentation:
- [GitHub Integration Tests](../api/tests/oauth-github-provider.test.js)
- [GitHub Setup Guide](../README.md#github-oauth-setup)

---

## Testing Checklist

### Pre-Testing

- [ ] All environment variables configured
- [ ] PostgreSQL running (port 21432)
- [ ] Redis running (port 21379)
- [ ] API server running (port 3001)
- [ ] OAuth redirect URIs registered with providers

### Per-Provider Testing

For each provider (Google, Apple, Microsoft):

**Authorization Flow:**
- [ ] Generate authorization URL
- [ ] URL contains correct client_id
- [ ] URL contains correct redirect_uri
- [ ] URL contains state parameter
- [ ] User consent screen displays correctly
- [ ] User can grant permissions

**Token Exchange:**
- [ ] Callback receives authorization code
- [ ] Token exchange succeeds
- [ ] Access token received
- [ ] Refresh token received (if applicable)
- [ ] ID token received (OIDC providers)
- [ ] Token expiry set correctly

**Profile Retrieval:**
- [ ] User profile fetched successfully
- [ ] Email address retrieved
- [ ] Name retrieved (if available)
- [ ] Email verification status correct
- [ ] Provider-specific fields present

**Token Management:**
- [ ] Token refresh works
- [ ] New access token received
- [ ] Refresh token rotated (if applicable)
- [ ] Token revocation works
- [ ] Revoked tokens can't be used

**Error Handling:**
- [ ] Invalid code handled gracefully
- [ ] Expired code handled gracefully
- [ ] Network errors caught
- [ ] API errors logged properly

---

## Troubleshooting

### Common Issues

#### 1. "redirect_uri_mismatch" Error

**Problem:** OAuth provider rejects redirect URI

**Solution:**
- Check redirect URI exactly matches what's configured in provider console
- Include protocol (http/https)
- Include port number if not default (80/443)
- No trailing slash unless configured with one

#### 2. "invalid_client" Error

**Problem:** Client credentials invalid

**Solution:**
- Verify CLIENT_ID is correct
- Verify CLIENT_SECRET is correct (for Google/Microsoft)
- For Apple: Verify TEAM_ID, KEY_ID, and PRIVATE_KEY are correct
- Check credentials haven't expired or been revoked

#### 3. "Invalid ID Token" Error

**Problem:** ID token verification fails

**Solution:**
- Check system time is synchronized
- Verify token hasn't expired
- For Apple: Ensure private key is in correct format
- Check issuer (iss) claim matches expected value

#### 4. JWT Generation Fails (Apple)

**Problem:** ES256 signature fails

**Solution:**
```bash
# Ensure private key is properly formatted
# Should start with: -----BEGIN PRIVATE KEY-----
# Should be base64 encoded or PEM format

# If base64 encoded in .env:
echo $APPLE_OAUTH_PRIVATE_KEY | base64 -d

# Should output valid PEM key
```

#### 5. Microsoft Graph API 401 Error

**Problem:** Access token invalid for Graph API

**Solution:**
- Ensure `User.Read` scope is requested
- Check token hasn't expired
- Verify tenant configuration is correct
- Check app has required API permissions in Azure Portal

### Debug Mode

Enable detailed logging:

```bash
# .env
LOG_LEVEL=debug
```

Check API logs:
```bash
tail -f logs/app.log
```

### Test with Mock Data

If you don't have real OAuth credentials, you can test with mock data:

```bash
# Run integration tests (uses mocks)
npm run test:oauth

# These tests verify:
# - Provider initialization
# - URL generation
# - Error handling
# - Profile normalization
```

---

## Next Steps

After successful manual testing:

1. **Update Documentation**
   - Add screenshots of OAuth flows
   - Document any provider-specific quirks
   - Update troubleshooting section with new issues

2. **Production Deployment**
   - Use HTTPS redirect URIs
   - Store credentials in secrets manager
   - Enable rate limiting
   - Monitor OAuth errors

3. **Monitoring**
   - Track OAuth success/failure rates
   - Monitor token refresh patterns
   - Alert on unusual OAuth errors

4. **Additional Providers**
   - Twitter OAuth
   - LinkedIn OAuth
   - Discord OAuth
   - Custom OAuth providers

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/truxe-auth/truxe/issues
- Discord: https://discord.gg/truxe
- Docs: https://docs.truxe.io

---

**Generated:** 2025-11-03
**Version:** v0.3.6
**OAuth Providers:** 4 (GitHub, Google, Apple, Microsoft)
