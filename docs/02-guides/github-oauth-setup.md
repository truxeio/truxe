# GitHub OAuth Setup Guide

**Provider**: GitHub Sign-In
**Protocol**: OAuth 2.0
**Difficulty**: Easy
**Estimated Setup Time**: 15 minutes

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [GitHub Application Setup](#github-application-setup)
4. [Configuration](#configuration)
5. [Testing](#testing)
6. [Advanced Features](#advanced-features)
7. [Troubleshooting](#troubleshooting)
8. [Best Practices](#best-practices)

---

## Overview

GitHub Sign-In allows users to authenticate with their GitHub accounts. This guide walks you through setting up GitHub OAuth 2.0 for Truxe.

### Features Supported

- ✅ OAuth 2.0 Authorization Code Flow
- ✅ Email verification handling
- ✅ Token revocation
- ✅ Scope management
- ✅ Profile information (name, email, avatar, bio)
- ✅ Organization and repository access (with appropriate scopes)
- ✅ GitHub Enterprise Server support
- ⚠️ Refresh tokens not supported (GitHub OAuth Apps limitation)

### Important Note: Refresh Tokens

**GitHub OAuth Apps do not provide refresh tokens**. Access tokens remain valid until:
- Manually revoked by the user
- Revoked via the disconnect endpoint
- Revoked via GitHub's API

For applications requiring refresh token support, consider using [GitHub Apps](https://docs.github.com/en/apps) instead of OAuth Apps.

---

## Prerequisites

Before you begin, ensure you have:

- [ ] GitHub account (personal or organization)
- [ ] Access to [GitHub Developer Settings](https://github.com/settings/developers)
- [ ] Truxe API running locally or deployed
- [ ] Basic understanding of OAuth 2.0 flow

---

## GitHub Application Setup

### Step 1: Register a New OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)

2. Click **OAuth Apps** in the left sidebar

3. Click **New OAuth App** button (or **Register a new application**)

4. Fill in **Application Information**:

   - **Application name**: `Truxe` (or your app name)
     - This is what users will see when authorizing
   
   - **Homepage URL**: `https://yourdomain.com` (or `http://localhost:3000` for development)
     - Your application's public homepage
   
   - **Application description** (optional but recommended):
     ```
     Secure authentication service for Truxe.
     Allows users to sign in with their GitHub account.
     ```

   - **Authorization callback URL**: 
     ```
     http://localhost:3001/auth/oauth/callback/github   (development)
     https://api.yourdomain.com/auth/oauth/callback/github   (production)
     ```
     
     > **Important**: This must exactly match your Truxe callback URL.

5. Click **Register application**

6. **Application created** page appears:
   - Copy **Client ID** (displayed on the page)
   - Click **Generate a new client secret**
   - Copy **Client secret** (only shown once - save it securely!)
   - Click **Update application** to save

### Step 2: Configure Application Settings (Optional)

1. On your OAuth App page, you can configure:

   - **Application name**: Update if needed
   - **Homepage URL**: Update if changed
   - **Application description**: Add details
   - **Authorization callback URL**: Update for new environments
   - **Application logo**: Upload a logo (1:1 aspect ratio, recommended size: 200x200px)

2. Click **Update application** to save changes

### Step 3: Note Important Limitations

GitHub OAuth Apps have some limitations:

- ❌ **No refresh tokens**: Access tokens don't expire unless revoked
- ⚠️ **Rate limits**: Subject to GitHub API rate limits (5,000 requests/hour for authenticated requests)
- ⚠️ **Scopes**: Users must re-authorize to grant additional scopes
- ✅ **Webhooks**: Can receive webhooks if configured with `admin:repo_hook` scope

For advanced features, consider migrating to GitHub Apps later.

---

## Configuration

### Environment Variables

Add the following to your `.env` file:

```bash
# GitHub OAuth Configuration
GITHUB_OAUTH_ENABLED=true
GITHUB_OAUTH_CLIENT_ID=your_github_client_id
GITHUB_OAUTH_CLIENT_SECRET=your_github_client_secret
GITHUB_OAUTH_REDIRECT_URI=http://localhost:3001/auth/oauth/callback/github

# GitHub Default Scopes (comma-separated)
GITHUB_OAUTH_SCOPES=read:user,user:email

# GitHub API Configuration (optional)
GITHUB_API_VERSION=2022-11-28
GITHUB_USER_AGENT=Truxe-Auth

# GitHub Enterprise (optional - for self-hosted GitHub)
# GITHUB_ENTERPRISE_URL=https://github.yourcompany.com
```

### Scope Configuration

GitHub scopes control what your application can access. Common scope combinations:

**Minimal (default)** - Just authentication:
```bash
GITHUB_OAUTH_SCOPES=read:user,user:email
```

**Profile** - Extended user info:
```bash
GITHUB_OAUTH_SCOPES=read:user,user:email,user:follow
```

**Repository Access (Public only)**:
```bash
GITHUB_OAUTH_SCOPES=read:user,user:email,public_repo,repo:status
```

**Full Repository Access (including private)**:
```bash
GITHUB_OAUTH_SCOPES=read:user,user:email,repo
```

**Organization Access**:
```bash
GITHUB_OAUTH_SCOPES=read:user,user:email,read:org
```

**Webhook Management**:
```bash
GITHUB_OAUTH_SCOPES=read:user,user:email,admin:repo_hook
```

See [GitHub OAuth Scopes Documentation](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps) for complete list.

### Configuration Object

If using programmatic configuration:

```javascript
{
  oauth: {
    enabled: true,
    providers: {
      github: {
        enabled: true,
        clientId: process.env.GITHUB_OAUTH_CLIENT_ID,
        clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
        scopes: ['read:user', 'user:email'],
        apiVersion: '2022-11-28',
        userAgent: 'Truxe-Auth',
        enterpriseUrl: null // For GitHub Enterprise Server
      }
    }
  }
}
```

### Callback URL Configuration

Ensure your callback URL is correctly configured:

**Development**:
```
http://localhost:3001/auth/oauth/callback/github
```

**Production**:
```
https://api.yourdomain.com/auth/oauth/callback/github
```

This URL must be:
1. Registered in GitHub OAuth App settings (Authorization callback URL)
2. Accessible from your frontend
3. Handled by Truxe OAuth routes

---

## Testing

### 1. Verify Configuration

```bash
# Check if GitHub provider is loaded
curl http://localhost:3001/auth/oauth/github/scopes | jq

# Expected output:
{
  "availableScopes": { ... },
  "scopePresets": { ... },
  "availablePresets": ["minimal", "profile", "repository", ...],
  "currentScopes": null
}
```

### 2. Test Authorization Flow

```bash
# Step 1: Get authorization URL
curl -X POST http://localhost:3001/auth/oauth/github/start \
  -H "Content-Type: application/json" \
  -d '{
    "redirectUri": "http://localhost:3000/auth/callback"
  }' | jq

# Expected output:
{
  "provider": "github",
  "authorizationUrl": "https://github.com/login/oauth/authorize?client_id=...",
  "state": "...",
  "expiresAt": "2025-01-28T10:10:00Z",
  "scopes": ["read:user", "user:email"]
}
```

### 3. Complete Flow in Browser

1. Copy the `authorizationUrl` from the response
2. Open it in your browser
3. Sign in with your GitHub account (if not already signed in)
4. Review requested permissions
5. Click **Authorize** (or **Authorize [App Name]**)
6. You'll be redirected to your callback URL with `code` and `state` parameters

### 4. Handle Callback

The Truxe callback endpoint will automatically:
- Validate the state parameter
- Exchange code for tokens
- Retrieve user profile and emails
- Create/link OAuth account
- Return user data

```bash
# This happens automatically when user is redirected
GET /auth/oauth/callback/github?code=xxx&state=yyy
```

**Response example**:
```json
{
  "success": true,
  "provider": "github",
  "linked": true,
  "account": {
    "id": "...",
    "provider": "github",
    "providerAccountId": "12345678",
    "email": "user@example.com",
    "scope": "read:user user:email"
  },
  "profile": {
    "id": "12345678",
    "email": "user@example.com",
    "emailVerified": true,
    "name": "John Doe",
    "login": "johndoe",
    "avatarUrl": "https://avatars.githubusercontent.com/u/12345678",
    "bio": "Software developer",
    "company": "Acme Inc",
    "location": "San Francisco, CA",
    "publicRepos": 25,
    "followers": 150,
    "following": 50
  }
}
```

---

## Advanced Features

### Requesting Additional Scopes

To request additional scopes after initial authorization:

```bash
# List available scopes and user's current scopes
GET /auth/oauth/github/scopes

# Request additional scopes
POST /auth/oauth/github/scopes/upgrade
{
  "scopes": ["repo", "read:org"],
  "redirectUri": "http://localhost:3000/auth/callback"
}
```

Or use a preset:

```bash
POST /auth/oauth/github/scopes/upgrade
{
  "preset": "fullRepository",
  "redirectUri": "http://localhost:3000/auth/callback"
}
```

Available presets:
- `minimal` - Basic authentication
- `profile` - Extended user info
- `repository` - Public repository access
- `fullRepository` - Full repository access (including private)
- `organization` - Organization access
- `webhooks` - Webhook management
- `full` - All available scopes

### Custom Scopes per Request

Request custom scopes during authorization:

```bash
POST /auth/oauth/github/start
{
  "scopes": ["read:user", "user:email", "repo", "read:org"],
  "redirectUri": "http://localhost:3000/auth/callback"
}
```

### Disconnecting GitHub Account

Revoke tokens and unlink account:

```bash
POST /auth/oauth/github/disconnect
Authorization: Bearer <truxe_jwt_token>

# Response:
{
  "success": true,
  "message": "GitHub account disconnected successfully",
  "remainingMethods": ["email", "magic_link"]
}
```

### GitHub Enterprise Server

For GitHub Enterprise Server (self-hosted GitHub):

```bash
# Environment variables
GITHUB_ENTERPRISE_URL=https://github.yourcompany.com
GITHUB_OAUTH_AUTHORIZATION_URL=https://github.yourcompany.com/login/oauth/authorize
GITHUB_OAUTH_TOKEN_URL=https://github.yourcompany.com/login/oauth/access_token
GITHUB_OAUTH_USERINFO_URL=https://github.yourcompany.com/api/v3/user
```

The provider will automatically use Enterprise endpoints when `GITHUB_ENTERPRISE_URL` is configured.

---

## Troubleshooting

### Issue: "Redirect URI mismatch" error

**Symptom**: GitHub shows error: "redirect_uri_mismatch"

**Causes**:
1. Callback URL not registered in GitHub OAuth App settings
2. URL doesn't exactly match (http vs https, port mismatch, trailing slash)
3. Using wrong OAuth app

**Solution**:
1. Go to [GitHub Developer Settings](https://github.com/settings/developers) → OAuth Apps
2. Click on your OAuth App
3. Verify **Authorization callback URL** exactly matches your callback URL
4. Ensure no trailing slash: `http://localhost:3001/auth/oauth/callback/github` ✅
5. Ensure exact match including protocol, domain, port, and path
6. Click **Update application** to save

### Issue: "Bad verification code"

**Symptom**: Error "bad_verification_code" during token exchange

**Causes**:
- Authorization code expired (codes expire after 10 minutes)
- Code already used (codes can only be used once)
- Code doesn't match the client ID/secret

**Solution**:
1. Start a new authorization flow
2. Complete the flow within 10 minutes
3. Ensure you're using the correct client ID and secret
4. Check system clock is synchronized

### Issue: "Incorrect client credentials"

**Symptom**: Error 401 "incorrect_client_credentials"

**Causes**:
- Wrong client ID or client secret
- Client secret regenerated after configuration
- Special characters in secret not properly handled

**Solution**:
1. Verify `GITHUB_OAUTH_CLIENT_ID` matches your OAuth App Client ID
2. Verify `GITHUB_OAUTH_CLIENT_SECRET` matches current client secret
3. If secret was regenerated, update your `.env` file
4. Ensure no extra spaces or line breaks in environment variables
5. Double-check you're using the correct OAuth App (not a GitHub App)

### Issue: Email not returned or unverified

**Symptom**: User profile missing email or `emailVerified: false`

**Causes**:
- `user:email` scope not requested
- User's email is private on GitHub
- Email not verified on GitHub

**Solution**:
1. Ensure `user:email` scope is included:
   ```bash
   GITHUB_OAUTH_SCOPES=read:user,user:email
   ```

2. The provider attempts to fetch emails separately and uses:
   - Verified primary email (preferred)
   - Primary email (if verified)
   - First verified email
   - Public email from profile (fallback)

3. Encourage users to verify their GitHub email:
   - Go to GitHub Settings → Emails
   - Verify primary email address
   - Make email public if needed

### Issue: Rate limit exceeded

**Symptom**: Error "API rate limit exceeded" (403)

**Causes**:
- Too many API requests in a short period
- Using unauthenticated requests (lower limits)

**Solution**:
1. GitHub API rate limits:
   - Authenticated requests: 5,000/hour
   - Unauthenticated requests: 60/hour (per IP)

2. Implement rate limiting in your application
3. Cache user profile data
4. Use webhooks instead of polling when possible

### Issue: Refresh token error

**Symptom**: Error when trying to refresh GitHub token

**Explanation**: This is expected behavior. GitHub OAuth Apps **do not support refresh tokens**.

**Solution**:
- Access tokens remain valid until revoked
- Use the disconnect endpoint to revoke tokens when needed
- Consider migrating to GitHub Apps for refresh token support

**Improved error message**:
```json
{
  "error": "GITHUB_REFRESH_NOT_SUPPORTED",
  "message": "GitHub OAuth Apps do not support refresh tokens...",
  "details": {
    "reason": "oauth_apps_no_refresh",
    "solution": "Use disconnect endpoint to revoke tokens...",
    "documentation": "https://docs.github.com/en/apps/oauth-apps/..."
  }
}
```

### Issue: Scopes not granted

**Symptom**: User authorized but doesn't have expected permissions

**Causes**:
- User didn't grant all requested scopes
- Scopes not properly requested

**Solution**:
1. Check what scopes were actually granted:
   ```bash
   GET /auth/oauth/github/scopes
   # Check currentScopes field
   ```

2. Request missing scopes:
   ```bash
   POST /auth/oauth/github/scopes/upgrade
   {
     "scopes": ["repo", "read:org"]
   }
   ```

3. Verify scopes in token response:
   - Token includes `scope` parameter with granted scopes

### Debugging Tips

**Enable debug logging**:
```bash
LOG_LEVEL=debug npm start
```

**Check OAuth provider health**:
```bash
curl http://localhost:3001/health | jq '.services.oauth'
```

**Validate token**:
```bash
# Test token with GitHub API
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     https://api.github.com/user
```

**Check GitHub API status**:
- Visit [GitHub Status](https://www.githubstatus.com/)
- Check [GitHub API Status](https://www.githubstatus.com/api)

---

## Best Practices

### Security

1. **Never expose client secret**:
   - Store in environment variables
   - Never commit to version control
   - Rotate if compromised

2. **Use HTTPS in production**:
   - GitHub requires HTTPS for production callback URLs
   - Use valid SSL certificates

3. **Request minimal scopes**:
   - Only request scopes you actually need
   - Start with `read:user` and `user:email`
   - Request additional scopes only when needed

4. **Store tokens securely**:
   - Truxe encrypts tokens at rest (AES-256-GCM)
   - Never log access tokens
   - Implement token rotation if possible

5. **Validate state parameter**:
   - Always validate state to prevent CSRF attacks
   - Truxe does this automatically

### User Experience

1. **Explain scope requests**:
   - Show users what permissions they're granting
   - Explain why each scope is needed
   - Example: "We need `repo` scope to read your repositories"

2. **Handle authorization cancellation**:
   - User may click "Cancel" on GitHub authorization page
   - Show friendly error message
   - Provide "Try again" option

3. **Show loading states**:
   - Display spinner during OAuth redirect
   - Handle callback processing time (can take 2-5 seconds)

4. **Provide alternatives**:
   - Offer magic link as fallback
   - Don't force users to use GitHub
   - Support multiple OAuth providers

### Performance

1. **Cache user profile**:
   - Don't fetch profile on every request
   - Cache for reasonable TTL (5-15 minutes)
   - Invalidate on disconnect

2. **Request only needed scopes**:
   - More scopes = longer authorization process
   - Users may skip if too many permissions requested

3. **Handle rate limits gracefully**:
   - Implement exponential backoff
   - Cache API responses
   - Use webhooks instead of polling

### Token Management

1. **Monitor token validity**:
   - Tokens don't expire but can be revoked
   - Check token validity before making GitHub API calls
   - Handle 401 errors gracefully

2. **Provide disconnect option**:
   - Allow users to revoke access anytime
   - Use `/auth/oauth/github/disconnect` endpoint

3. **Consider GitHub Apps**:
   - For production apps requiring refresh tokens
   - Better rate limits (5,000/hour per installation)
   - Per-repository permissions

---

## Additional Resources

- [GitHub OAuth Apps Documentation](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
- [GitHub OAuth Scopes](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps)
- [GitHub API Documentation](https://docs.github.com/en/rest)
- [GitHub Developer Settings](https://github.com/settings/developers)
- [GitHub Apps vs OAuth Apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/differences-between-github-apps-and-oauth-apps)

---

## Next Steps

After setting up GitHub OAuth:

1. ✅ Test the complete authorization flow
2. ✅ Verify user profile data is retrieved correctly
3. ✅ Test scope upgrade functionality
4. ✅ Implement UI components (see [OAuth UI Components Guide](./oauth-ui-components.md))
5. ✅ Set up additional providers (Google, Apple)
6. ✅ Consider GitHub Apps for advanced features (Phase 5)

---

## Migration to GitHub Apps (Future)

For applications requiring:
- Refresh token support
- Higher rate limits
- Per-repository permissions
- Better webhook management

Consider migrating to GitHub Apps (covered in Phase 5 of the GitHub Integration Plan).

---

**Last Updated**: 2025-01-28
**Tested with**: GitHub OAuth Apps API
**Truxe Version**: v0.2.0+

