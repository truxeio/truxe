# Google OAuth Setup Guide

Complete guide for setting up Google OAuth authentication in Truxe.

## 📋 Prerequisites

- Google Cloud Console account
- Truxe API running locally or deployed
- Node.js 20+

## 🔧 Step 1: Create Google OAuth Application

### 1.1 Go to Google Cloud Console

Visit [Google Cloud Console](https://console.cloud.google.com/)

### 1.2 Create a New Project (or select existing)

1. Click the project dropdown at the top
2. Click "New Project"
3. Enter project name (e.g., "Truxe Auth")
4. Click "Create"

### 1.3 Enable Required APIs

1. Go to **APIs & Services** > **Library**
2. Search for "Google+ API" and enable it
3. Search for "People API" and enable it (for profile access)

### 1.4 Configure OAuth Consent Screen

1. Go to **APIs & Services** > **OAuth consent screen**
2. Select **User Type**:
   - **Internal**: Only for Google Workspace users (recommended for testing)
   - **External**: For all Google users (requires verification for production)
3. Click "Create"

**Fill in Application Information:**
- **App name**: Truxe Auth
- **User support email**: your-email@example.com
- **Application home page**: http://localhost:3001 (or your domain)
- **Authorized domains**: localhost (for testing), your-domain.com (for production)
- **Developer contact information**: your-email@example.com

**Scopes** (Step 2):
- Add the following scopes:
  - `.../auth/userinfo.email`
  - `.../auth/userinfo.profile`
  - `openid`

**Test users** (Step 3 - only for External apps in testing):
- Add your Google account email for testing

Click "Save and Continue"

### 1.5 Create OAuth Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **+ Create Credentials** > **OAuth client ID**
3. Select **Application type**: Web application
4. **Name**: Truxe OAuth Client

**Authorized JavaScript origins:**
```
http://localhost:3001
http://localhost:3000
```

**Authorized redirect URIs:**
```
http://localhost:3001/api/oauth/callback/google
http://localhost:3000/auth/callback/google
```

> **Note**: For production, add your production URLs:
> - `https://api.yourdomain.com`
> - `https://api.yourdomain.com/api/oauth/callback/google`

5. Click **Create**
6. **Save your Client ID and Client Secret** ⚠️

## 🔐 Step 2: Configure Truxe

### 2.1 Set Environment Variables

Add to your `.env` file:

```bash
# Google OAuth Configuration
GOOGLE_OAUTH_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your_client_secret
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3001/api/oauth/callback/google

# OAuth General Settings
OAUTH_ENABLED=true
OAUTH_CALLBACK_BASE_URL=http://localhost:3001

# Token Encryption (32 bytes for AES-256)
OAUTH_TOKEN_ENCRYPTION_KEY=your_random_32_byte_encryption_key_here

# Feature Flags
FEATURE_OAUTH=true
```

### 2.2 Generate Encryption Key

```bash
# Generate a secure 32-byte key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output to `OAUTH_TOKEN_ENCRYPTION_KEY`

### 2.3 Verify Configuration

```bash
# Check environment variables are loaded
node --env-file=.env -e "console.log({
  clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
  hasSecret: !!process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI
})"
```

## 🧪 Step 3: Test Google OAuth

### 3.1 Manual Testing

Run the manual test script:

```bash
cd api
node --env-file=.env test-google-oauth-manual.js
```

**Follow the prompts:**
1. Copy the authorization URL
2. Open in browser
3. Authorize the app
4. Copy the `code` parameter from redirect URL
5. Paste into terminal
6. Verify all tests pass ✅

### 3.2 Integration Testing

Run the full integration test suite:

```bash
cd api
npm test -- test/integration/oauth/google-oauth.test.js
```

### 3.3 E2E Testing with Real Browser

1. Start Truxe API:
   ```bash
   npm run dev
   ```

2. Make OAuth start request:
   ```bash
   curl -X POST http://localhost:3001/api/oauth/google/start \
     -H "Content-Type: application/json" \
     -d '{
       "redirectUri": "http://localhost:3000/auth/callback",
       "scopes": ["openid", "email", "profile"]
     }'
   ```

3. Open the returned `authorizationUrl` in browser
4. Authorize the app
5. You'll be redirected to callback URL with `code` and `state`

## 🔑 Step 4: Supported Scopes

### Default Scopes (Always Requested)

- `openid` - OpenID Connect authentication
- `email` - User's email address
- `profile` - User's basic profile (name, picture)

### Additional Scopes

You can request additional scopes when starting OAuth:

```javascript
{
  "scopes": [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/calendar.readonly",  // Calendar access
    "https://www.googleapis.com/auth/drive.readonly"      // Drive access
  ]
}
```

**Common Google Scopes:**
- `https://www.googleapis.com/auth/calendar` - Calendar read/write
- `https://www.googleapis.com/auth/drive` - Drive read/write
- `https://www.googleapis.com/auth/gmail.readonly` - Gmail read-only
- `https://www.googleapis.com/auth/userinfo.profile` - Extended profile

See [Google OAuth Scopes](https://developers.google.com/identity/protocols/oauth2/scopes) for complete list.

## 🏢 Step 5: Google Workspace Configuration

### 5.1 Restrict to Workspace Domain

To only allow users from your Google Workspace domain:

**In OAuth request, add:**
```javascript
{
  "context": {
    "hostedDomain": "yourcompany.com"
  }
}
```

This will:
- Restrict login to `@yourcompany.com` accounts
- Show only workspace accounts in account picker
- Add `hd` claim to ID token

### 5.2 Verify Hosted Domain

After OAuth callback, verify the hosted domain:

```javascript
const profile = await provider.getUserProfile({ accessToken });

if (profile.hostedDomain !== 'yourcompany.com') {
  throw new Error('User must be from yourcompany.com');
}
```

## 🔄 Step 6: Token Refresh

### 6.1 Request Refresh Token

By default, Google only provides refresh token on **first authorization**.

To force refresh token:

```javascript
{
  "prompt": "consent",  // Forces consent screen
  "context": {
    "forceConsent": true
  }
}
```

### 6.2 Refresh Access Token

```javascript
const refreshedTokens = await provider.refreshAccessToken({
  refreshToken: existingRefreshToken
});

console.log('New access token:', refreshedTokens.access_token);
console.log('Expires in:', refreshedTokens.expires_in);
```

### 6.3 Handle Refresh Token Rotation

Google **may** rotate refresh tokens. Always save the new refresh token:

```javascript
if (refreshedTokens.refresh_token) {
  // Google issued new refresh token - save it!
  await saveRefreshToken(refreshedTokens.refresh_token);
}
```

## 🚨 Troubleshooting

### Error: "redirect_uri_mismatch"

**Cause**: Redirect URI doesn't match configured URIs in Google Console

**Solution**:
1. Check exact URL in Google Console > Credentials
2. URLs must match **exactly** (including protocol, port, path)
3. Add all variations:
   - `http://localhost:3001/api/oauth/callback/google`
   - `http://127.0.0.1:3001/api/oauth/callback/google`

### Error: "invalid_client"

**Cause**: Invalid Client ID or Client Secret

**Solution**:
1. Verify `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` in `.env`
2. Check for extra spaces or newlines
3. Regenerate credentials if needed

### Error: "access_denied"

**Cause**: User declined authorization or app not configured

**Solution**:
1. Check OAuth consent screen configuration
2. Add user to test users (if External app in testing)
3. Enable required APIs (Google+ API, People API)

### Warning: "No refresh token"

**Cause**: Google only issues refresh token on first authorization

**Solution**:
1. Revoke access at https://myaccount.google.com/permissions
2. Re-authorize with `prompt=consent`

### Error: "Invalid ID token"

**Cause**: ID token signature verification failed

**Solution**:
1. Check system clock is synchronized
2. Verify `GOOGLE_OAUTH_CLIENT_ID` matches audience claim
3. Google's JWKS might be cached - wait 1 hour

## 🔐 Security Best Practices

### 1. Token Storage

**✅ DO:**
- Encrypt tokens at rest (AES-256-GCM)
- Store refresh tokens securely (database, not localStorage)
- Use HttpOnly cookies for tokens in browser

**❌ DON'T:**
- Store tokens in localStorage (XSS risk)
- Log tokens (even partially)
- Share tokens between users

### 2. Token Validation

**Always validate:**
- ID token signature (using Google's JWKS)
- ID token audience (matches your Client ID)
- ID token issuer (`https://accounts.google.com`)
- ID token expiration

### 3. Scope Management

**Request minimum scopes needed:**
- Only request `openid`, `email`, `profile` for basic auth
- Request additional scopes only when needed
- Document why each scope is needed

### 4. State Parameter

**Always use state parameter:**
- Prevents CSRF attacks
- Must be unpredictable (crypto.randomBytes)
- Verify state matches on callback
- Store state with expiration (10 minutes max)

## 📊 Production Checklist

### Before Going Live:

- [ ] OAuth Consent Screen verified (if External app)
- [ ] Production redirect URIs configured
- [ ] Client Secret stored securely (not in git)
- [ ] Token encryption key is strong (32 bytes)
- [ ] HTTPS enforced (no HTTP in production)
- [ ] Rate limiting configured
- [ ] Logging excludes sensitive data
- [ ] Error handling for all OAuth failures
- [ ] Token refresh implemented
- [ ] Token revocation on logout
- [ ] Security audit completed

### Monitoring:

- [ ] OAuth success/failure rates
- [ ] Token refresh failures
- [ ] Average OAuth flow duration
- [ ] User consent abandonment rate

## 📚 Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [OpenID Connect Documentation](https://developers.google.com/identity/openid-connect/openid-connect)
- [Google OAuth Scopes](https://developers.google.com/identity/protocols/oauth2/scopes)
- [OAuth 2.0 RFC 6749](https://datatracker.ietf.org/doc/html/rfc6749)
- [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html)

## 🆘 Support

If you encounter issues:

1. Check [Troubleshooting](#-troubleshooting) section
2. Review Google OAuth logs in Cloud Console
3. Check Truxe API logs
4. Open issue on GitHub: https://github.com/truxe-auth/truxe/issues

---

**Last Updated**: 2024-01-15
**Truxe Version**: v0.4.0
**Author**: Truxe Team
