# Google OAuth Setup Guide

**Provider**: Google Sign-In
**Protocol**: OAuth 2.0 + OpenID Connect
**Difficulty**: Easy
**Estimated Setup Time**: 15 minutes

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Google Cloud Console Setup](#google-cloud-console-setup)
4. [Configuration](#configuration)
5. [Testing](#testing)
6. [Advanced Features](#advanced-features)
7. [Troubleshooting](#troubleshooting)
8. [Best Practices](#best-practices)

---

## Overview

Google Sign-In allows users to authenticate with their Google accounts (Gmail, Google Workspace). This guide walks you through setting up Google OAuth 2.0 for Truxe.

### Features Supported

- ✅ OAuth 2.0 Authorization Code Flow
- ✅ OpenID Connect (OIDC) for identity
- ✅ ID token verification
- ✅ Email verification status
- ✅ Refresh token support
- ✅ Token revocation
- ✅ Google Workspace (G Suite) domain restriction
- ✅ Incremental authorization
- ✅ Profile information (name, email, avatar)

---

## Prerequisites

Before you begin, ensure you have:

- [ ] Google account (personal or workspace)
- [ ] Access to [Google Cloud Console](https://console.cloud.google.com)
- [ ] Truxe API running locally or deployed
- [ ] Basic understanding of OAuth 2.0 flow

---

## Google Cloud Console Setup

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)

2. Click **Select a project** dropdown (top bar)

3. Click **NEW PROJECT**

4. Fill in project details:
   - **Project name**: `Truxe Authentication` (or your app name)
   - **Organization**: Select if applicable
   - **Location**: Your organization/folder

5. Click **CREATE**

6. Wait for project creation (usually ~30 seconds)

7. Select your new project from the dropdown

### Step 2: Enable Google+ API

1. In the left sidebar, navigate to **APIs & Services** → **Library**

2. Search for "Google+ API"

3. Click on **Google+ API**

4. Click **ENABLE**

5. Wait for API to be enabled

> **Note**: While the Google+ API is deprecated for posting, it's still required for retrieving user profile information via OAuth.

### Step 3: Configure OAuth Consent Screen

1. Navigate to **APIs & Services** → **OAuth consent screen**

2. Choose **User Type**:
   - **Internal**: Only for Google Workspace users within your organization
   - **External**: For any Google account user (most common)

3. Click **CREATE**

4. Fill in **App Information**:
   - **App name**: `Truxe` (or your app name)
   - **User support email**: Your support email
   - **App logo**: (Optional) Upload your logo (120x120px recommended)

5. Fill in **App domain** (optional but recommended):
   - **Application home page**: `https://yourdomain.com`
   - **Application privacy policy**: `https://yourdomain.com/privacy`
   - **Application terms of service**: `https://yourdomain.com/terms`

6. **Developer contact information**:
   - Add your email address

7. Click **SAVE AND CONTINUE**

8. **Scopes** screen:
   - Click **ADD OR REMOVE SCOPES**
   - Select the following scopes:
     - `.../auth/userinfo.email` - View your email address
     - `.../auth/userinfo.profile` - View your basic profile info
     - `openid` - Associate you with your personal info
   - Click **UPDATE**
   - Click **SAVE AND CONTINUE**

9. **Test users** (if using External + Testing):
   - Add test user emails during development
   - Click **ADD USERS**
   - Enter email addresses
   - Click **ADD**
   - Click **SAVE AND CONTINUE**

10. **Summary** screen:
    - Review your settings
    - Click **BACK TO DASHBOARD**

### Step 4: Create OAuth 2.0 Credentials

1. Navigate to **APIs & Services** → **Credentials**

2. Click **CREATE CREDENTIALS** → **OAuth client ID**

3. Choose **Application type**:
   - For web applications: **Web application**
   - For mobile: **iOS** or **Android**

4. Fill in **OAuth Client** details:
   - **Name**: `Truxe OAuth Client` (descriptive name)

5. **Authorized JavaScript origins** (for web apps):
   - Click **ADD URI**
   - Add your frontend URLs:
     ```
     http://localhost:3000        (development)
     https://app.yourdomain.com   (production)
     ```

6. **Authorized redirect URIs**:
   - Click **ADD URI**
   - Add your Truxe callback URLs:
     ```
     http://localhost:3001/auth/callback/google   (development)
     https://api.yourdomain.com/auth/callback/google   (production)
     ```

   > **Important**: The redirect URI must exactly match what you configure in Truxe.

7. Click **CREATE**

8. **OAuth client created** dialog appears:
   - Copy **Client ID** (looks like `123456789-abc.apps.googleusercontent.com`)
   - Copy **Client secret**
   - Click **OK**

9. **Download credentials** (optional but recommended):
   - Click the download icon next to your OAuth client
   - Save the JSON file securely
   - **Never commit this file to version control**

---

## Configuration

### Environment Variables

Add the following to your `.env` file:

```bash
# Google OAuth Configuration
GOOGLE_OAUTH_ENABLED=true
GOOGLE_OAUTH_CLIENT_ID=123456789-abc.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your-google-oauth-secret
GOOGLE_OAUTH_SCOPES=openid,email,profile

# Optional: Restrict to specific Google Workspace domain
# GOOGLE_OAUTH_HOSTED_DOMAIN=yourcompany.com
```

### Configuration Object

If using programmatic configuration:

```javascript
{
  oauth: {
    enabled: true,
    providers: {
      google: {
        enabled: true,
        clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
        clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
        scopes: ['openid', 'email', 'profile'],
        // Optional
        hostedDomain: 'yourcompany.com' // Restrict to workspace domain
      }
    }
  }
}
```

### Callback URL Configuration

Ensure your callback URL is correctly configured:

**Development**:
```
http://localhost:3001/auth/callback/google
```

**Production**:
```
https://api.yourdomain.com/auth/callback/google
```

This URL must be:
1. Registered in Google Cloud Console (Authorized redirect URIs)
2. Accessible from your frontend
3. Handled by Truxe OAuth routes

---

## Testing

### 1. Verify Configuration

```bash
# Check if Google provider is loaded
curl http://localhost:3001/oauth/providers | jq

# Expected output:
{
  "providers": [
    {
      "id": "google",
      "name": "Google",
      "enabled": true
    }
  ]
}
```

### 2. Test Authorization Flow

```bash
# Step 1: Get authorization URL
curl -X POST http://localhost:3001/oauth/google/start \
  -H "Content-Type: application/json" \
  -d '{
    "redirectUri": "http://localhost:3000/auth/callback"
  }' | jq

# Expected output:
{
  "provider": "google",
  "authorizationUrl": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...",
  "state": "...",
  "expiresAt": "2025-01-28T10:10:00Z"
}
```

### 3. Complete Flow in Browser

1. Copy the `authorizationUrl` from the response
2. Open it in your browser
3. Sign in with your Google account
4. Grant permissions
5. You'll be redirected to your callback URL with `code` and `state` parameters

### 4. Handle Callback

The Truxe callback endpoint will automatically:
- Validate the state parameter
- Exchange code for tokens
- Retrieve user profile
- Create/link OAuth account
- Return user data

```bash
# This happens automatically when user is redirected
GET /auth/callback/google?code=xxx&state=yyy
```

---

## Advanced Features

### Google Workspace Domain Restriction

Restrict sign-in to users from a specific Google Workspace domain:

```javascript
// In configuration
{
  google: {
    enabled: true,
    hostedDomain: 'yourcompany.com'
  }
}

// Or per request
POST /oauth/google/start
{
  "state": {
    "hostedDomain": "yourcompany.com"
  }
}
```

When configured, Google will:
1. Only show users from the specified domain
2. Return an error if user is from a different domain
3. Include `hd` claim in ID token

### Login Hint

Pre-fill the email address in the Google sign-in screen:

```javascript
POST /oauth/google/start
{
  "state": {
    "email": "user@example.com"
  }
}
```

### Force Consent Screen

Force the consent screen to appear (useful for getting a refresh token):

```javascript
POST /oauth/google/start
{
  "prompt": "consent"
}
```

### Incremental Authorization

Request additional scopes after initial sign-in:

```javascript
POST /oauth/google/start
{
  "scopes": [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/calendar.readonly"
  ]
}
```

Google will only prompt for the new scopes.

### Offline Access (Refresh Tokens)

Truxe automatically requests offline access to receive refresh tokens. This is configured via `access_type=offline` in authorization URLs.

To ensure you get a refresh token:
- Use `prompt=consent` on first authorization
- Refresh token is only returned on first consent
- Store it securely (Truxe encrypts it automatically)

---

## Troubleshooting

### Issue: "Redirect URI mismatch" error

**Symptom**: Google shows error page: "redirect_uri_mismatch"

**Causes**:
1. Callback URL not registered in Google Cloud Console
2. URL doesn't exactly match (http vs https, port mismatch, trailing slash)
3. Using wrong OAuth client

**Solution**:
1. Go to Google Cloud Console → Credentials
2. Click on your OAuth client
3. Verify **Authorized redirect URIs** includes your exact callback URL
4. Ensure no trailing slash: `http://localhost:3001/auth/callback/google` ✅
5. Ensure exact match including protocol, domain, port, and path

### Issue: "Access blocked: App not verified"

**Symptom**: Google shows warning "This app isn't verified"

**Causes**:
- Using External user type in development
- App not published

**Solution**:

**For Development**:
1. Click **Advanced** on the warning page
2. Click **Go to [App Name] (unsafe)**
3. This is safe for testing your own app

**For Production**:
1. Go through Google's verification process
2. Navigate to OAuth consent screen
3. Click **PUBLISH APP**
4. Submit for verification if using sensitive scopes

### Issue: No refresh token received

**Symptom**: `refresh_token` is null in token response

**Causes**:
- User has already granted consent
- Not using `prompt=consent`

**Solution**:
1. Use `prompt=consent` to force consent screen:
   ```javascript
   POST /oauth/google/start
   {
     "prompt": "consent"
   }
   ```

2. Or revoke access and try again:
   - Go to https://myaccount.google.com/permissions
   - Find your app
   - Click **Remove Access**
   - Sign in again

### Issue: Invalid client error

**Symptom**: "Error 401: invalid_client"

**Causes**:
- Wrong client ID or client secret
- Client secret has special characters not properly encoded

**Solution**:
1. Verify `GOOGLE_OAUTH_CLIENT_ID` is correct
2. Verify `GOOGLE_OAUTH_CLIENT_SECRET` is correct
3. Ensure no extra spaces or line breaks in environment variables
4. Try regenerating client secret in Google Cloud Console

### Issue: Scopes not returned

**Symptom**: User profile incomplete or missing expected data

**Causes**:
- Required scopes not requested
- User didn't grant all scopes

**Solution**:
1. Check requested scopes include what you need:
   - `openid` - Required for OIDC
   - `email` - For email address
   - `profile` - For name, picture, etc.

2. Verify consent screen shows all requested scopes

3. Check token response:
   ```javascript
   console.log(tokenResponse.scope);
   // Should include: "openid email profile"
   ```

### Issue: ID token verification fails

**Symptom**: Error "Failed to verify Google ID token"

**Causes**:
- System clock out of sync
- JWKS keys not cached properly
- Invalid ID token format

**Solution**:
1. Verify system time is correct:
   ```bash
   date
   # Should match current UTC time closely
   ```

2. Clear JWKS cache (restart API)

3. Check Google status page: https://www.google.com/appsstatus

### Debugging Tips

**Enable debug logging**:
```bash
LOG_LEVEL=debug npm start
```

**Check OAuth service health**:
```bash
curl http://localhost:3001/health | jq '.services.oauth'
```

**Validate JWT tokens**:
- Use https://jwt.io to decode ID tokens
- Verify claims match expected values
- Check expiration time

---

## Best Practices

### Security

1. **Never expose client secret**:
   - Store in environment variables
   - Never commit to version control
   - Rotate periodically (every 90 days)

2. **Use HTTPS in production**:
   - Google requires HTTPS for production redirect URIs
   - Use valid SSL certificates

3. **Validate hosted domain**:
   - For Google Workspace apps, always validate `hd` claim
   - Don't trust user-provided domain parameter

4. **Verify ID tokens**:
   - Always verify signature
   - Check issuer, audience, expiration
   - Truxe does this automatically

5. **Store tokens securely**:
   - Truxe encrypts tokens at rest (AES-256-GCM)
   - Never log access tokens or refresh tokens

### User Experience

1. **Use login hint**:
   ```javascript
   // If you know user's email
   state: { email: 'user@example.com' }
   ```

2. **Handle sign-in cancellation**:
   - User may close the consent screen
   - Show friendly error message
   - Provide "Try again" option

3. **Show loading states**:
   - Display spinner during OAuth redirect
   - Handle callback processing time

4. **Provide alternatives**:
   - Offer magic link as fallback
   - Don't force users to use Google

### Performance

1. **Cache JWKS keys**:
   - Truxe caches for 1 hour
   - Reduces latency on ID token verification

2. **Request only needed scopes**:
   - Don't request calendar, drive, etc. unless needed
   - Fewer scopes = faster consent

3. **Reuse OAuth accounts**:
   - Don't create new accounts on every sign-in
   - Link to existing user by email

---

## Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)
- [Google Sign-In Branding Guidelines](https://developers.google.com/identity/branding-guidelines)
- [OAuth 2.0 Scopes for Google APIs](https://developers.google.com/identity/protocols/oauth2/scopes)
- [Google Cloud Console](https://console.cloud.google.com)

---

## Next Steps

After setting up Google OAuth:

1. ✅ Test the complete authorization flow
2. ✅ Verify user profile data is retrieved correctly
3. ✅ Test token refresh functionality
4. ✅ Implement UI components (see [OAuth UI Components Guide](./oauth-ui-components.md))
5. ✅ Set up additional providers (GitHub, Apple)

---

**Last Updated**: 2025-01-28
**Tested with**: Google OAuth 2.0 API (Latest)
**Truxe Version**: v0.2.0+
