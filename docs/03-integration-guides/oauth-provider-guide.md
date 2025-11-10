# Truxe OAuth Provider Integration Guide

Complete guide for integrating your applications with Truxe's OAuth 2.0 Provider.

**Version:** 1.0
**Last Updated:** 2025-11-06
**Covers:** OAuth 2.0 Authorization Code Flow, PKCE, Refresh Tokens, Token Introspection

---

## Table of Contents

1. [Overview](#overview)
2. [What is Truxe OAuth Provider](#what-is-truxe-oauth-provider)
3. [Features](#features)
4. [Quick Start (5-Minute Setup)](#quick-start-5-minute-setup)
5. [Detailed Integration Steps](#detailed-integration-steps)
6. [Grant Types](#grant-types)
7. [Security Best Practices](#security-best-practices)
8. [Code Examples](#code-examples)
9. [Testing Your Integration](#testing-your-integration)
10. [Troubleshooting](#troubleshooting)
11. [API Reference](#api-reference)

---

## Overview

Truxe provides a **standards-compliant OAuth 2.0 Authorization Server** that allows third-party applications to authenticate and authorize users securely. This guide will help you integrate your application with Truxe's OAuth Provider in any language or framework.

### Who is this guide for?

- Developers building applications that need to authenticate with Truxe
- Teams integrating third-party services with Truxe
- Anyone implementing OAuth 2.0 clients (web apps, mobile apps, CLIs, services)

---

## What is Truxe OAuth Provider

Truxe OAuth Provider is an **OAuth 2.0 Authorization Server** implementation that allows external applications to:

- **Authenticate users** via Truxe accounts
- **Obtain access tokens** for API calls
- **Refresh tokens** automatically without re-authentication
- **Introspect tokens** to validate them server-side
- **Revoke tokens** when users disconnect

Think of it like "Sign in with Truxe" - similar to "Sign in with Google" or "Sign in with GitHub".

### Architecture Overview

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────┐
│   Your App      │────────▶│  Truxe OAuth  │────────▶│  User's     │
│  (OAuth Client) │         │     Provider     │         │  Browser    │
└─────────────────┘         └──────────────────┘         └─────────────┘
        │                            │                            │
        │                            │                            │
        │  1. Redirect to /authorize │                            │
        │───────────────────────────▶│                            │
        │                            │  2. Show consent screen    │
        │                            │───────────────────────────▶│
        │                            │                            │
        │                            │  3. User grants permission │
        │                            │◀───────────────────────────│
        │  4. Redirect with code     │                            │
        │◀───────────────────────────│                            │
        │                            │                            │
        │  5. Exchange code for token│                            │
        │───────────────────────────▶│                            │
        │                            │                            │
        │  6. Return access_token    │                            │
        │◀───────────────────────────│                            │
```

---

## Features

### Core OAuth 2.0 Features

- **Authorization Code Flow** (RFC 6749) - Secure authorization for web and mobile apps
- **PKCE Support** (RFC 7636) - Enhanced security for public clients (mobile/SPA)
- **Refresh Tokens** (RFC 6749) - Long-lived sessions without re-authentication
- **Token Introspection** (RFC 7662) - Validate tokens server-side
- **Token Revocation** (RFC 7009) - Revoke access and refresh tokens
- **Client Credentials Flow** (RFC 6749) - Machine-to-machine authentication
- **OpenID Connect** (OIDC) - User profile information via ID tokens

### Security Features

- **State Parameter** - CSRF protection for authorization requests
- **Nonce Support** - Replay attack prevention for OIDC
- **PKCE (S256)** - Code interception attack prevention
- **Client Secret Encryption** - Secure storage of client credentials
- **Token Expiration** - Configurable access token lifetimes
- **Scope Validation** - Fine-grained permission control
- **Rate Limiting** - Protection against abuse
- **Audit Logging** - Complete OAuth event logging

### Developer Experience

- **Multiple Client Types** - Public, confidential, and trusted clients
- **Flexible Scopes** - Define custom scopes for your API
- **Trusted Clients** - Skip consent screen for first-party apps
- **Client Management API** - Programmatic client creation
- **Comprehensive Error Messages** - Clear error codes and descriptions
- **CORS Support** - Easy SPA integration

---

## Quick Start (5-Minute Setup)

### Step 1: Register Your Application

First, create an OAuth client in Truxe:

```bash
curl -X POST https://api.truxe.io/oauth-provider/clients \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "My Awesome App",
    "redirect_uris": ["http://localhost:3000/auth/callback"],
    "client_type": "confidential",
    "grant_types": ["authorization_code", "refresh_token"],
    "allowed_scopes": ["openid", "profile", "email"]
  }'
```

**Response:**
```json
{
  "client_id": "client_abc123xyz",
  "client_secret": "secret_def456uvw",
  "client_name": "My Awesome App",
  "redirect_uris": ["http://localhost:3000/auth/callback"]
}
```

**Save these credentials securely!** You'll need them for the next steps.

### Step 2: Redirect User to Authorization URL

```javascript
const authUrl = new URL('https://api.truxe.io/oauth-provider/authorize');
authUrl.searchParams.set('client_id', 'client_abc123xyz');
authUrl.searchParams.set('redirect_uri', 'http://localhost:3000/auth/callback');
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', 'openid profile email');
authUrl.searchParams.set('state', generateRandomState()); // CSRF protection

// Redirect user
window.location.href = authUrl.toString();
```

### Step 3: Handle Callback and Exchange Code for Token

```javascript
// On your callback endpoint: /auth/callback
const code = req.query.code;
const state = req.query.state;

// Validate state parameter (CSRF protection)
if (state !== expectedState) {
  throw new Error('Invalid state parameter');
}

// Exchange code for token
const tokenResponse = await fetch('https://api.truxe.io/oauth-provider/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: 'http://localhost:3000/auth/callback',
    client_id: 'client_abc123xyz',
    client_secret: 'secret_def456uvw'
  })
});

const tokens = await tokenResponse.json();
// {
//   access_token: "at_...",
//   token_type: "Bearer",
//   expires_in: 3600,
//   refresh_token: "rt_...",
//   scope: "openid profile email"
// }
```

### Step 4: Use Access Token for API Calls

```javascript
const userProfile = await fetch('https://api.truxe.io/oauth-provider/userinfo', {
  headers: {
    'Authorization': `Bearer ${tokens.access_token}`
  }
});

const user = await userProfile.json();
// {
//   sub: "user_123",
//   email: "user@example.com",
//   name: "John Doe",
//   email_verified: true
// }
```

**That's it!** You now have a working OAuth integration. Continue reading for detailed implementation guides and best practices.

---

## Detailed Integration Steps

### Step 1: Register Your OAuth Client

Before integrating OAuth, you need to register your application with Truxe. This can be done via:

1. **Admin Dashboard** (recommended for non-developers)
2. **API** (recommended for automation)
3. **CLI** (coming soon)

#### Via Admin Dashboard

1. Log into Truxe Admin Dashboard: `https://admin.truxe.io`
2. Navigate to **OAuth Clients** → **Create New Client**
3. Fill in the form:
   - **Client Name**: Display name (e.g., "My App")
   - **Client Type**:
     - `confidential` - For server-side apps (can keep secrets secure)
     - `public` - For SPAs/mobile apps (cannot keep secrets secure)
   - **Redirect URIs**: Whitelist of allowed callback URLs
   - **Grant Types**: Select `authorization_code` and `refresh_token`
   - **Scopes**: Select required scopes (openid, profile, email, etc.)
4. Click **Create**
5. **Save the client_secret** - it's only shown once!

#### Via API

```bash
curl -X POST https://api.truxe.io/oauth-provider/clients \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "My App",
    "client_type": "confidential",
    "redirect_uris": [
      "http://localhost:3000/auth/callback",
      "https://myapp.com/auth/callback"
    ],
    "grant_types": ["authorization_code", "refresh_token"],
    "allowed_scopes": ["openid", "profile", "email"],
    "require_consent": true,
    "trusted": false
  }'
```

**Response:**
```json
{
  "client_id": "client_abc123xyz",
  "client_secret": "secret_def456uvw",
  "client_name": "My App",
  "client_type": "confidential",
  "redirect_uris": ["http://localhost:3000/auth/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "allowed_scopes": ["openid", "profile", "email"],
  "require_consent": true,
  "trusted": false,
  "created_at": "2025-11-06T12:00:00Z"
}
```

#### Client Configuration Options

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `client_name` | string | Yes | Display name shown to users |
| `client_type` | enum | Yes | `confidential` or `public` |
| `redirect_uris` | array | Yes | Whitelist of allowed callback URLs |
| `grant_types` | array | Yes | `authorization_code`, `refresh_token`, `client_credentials` |
| `allowed_scopes` | array | Yes | Scopes this client can request |
| `require_consent` | boolean | No | Show consent screen (default: true) |
| `trusted` | boolean | No | Skip consent for first-party apps (default: false) |
| `client_uri` | string | No | Homepage URL |
| `logo_uri` | string | No | Logo image URL |
| `tos_uri` | string | No | Terms of Service URL |
| `policy_uri` | string | No | Privacy Policy URL |

### Step 2: Implement Authorization Flow

#### 2.1: Generate Authorization URL

```javascript
function generateAuthorizationUrl(config) {
  const authUrl = new URL(`${config.truxeUrl}/oauth-provider/authorize`);

  // Required parameters
  authUrl.searchParams.set('client_id', config.clientId);
  authUrl.searchParams.set('redirect_uri', config.redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', config.scopes.join(' '));

  // CSRF protection (required)
  const state = generateRandomState();
  authUrl.searchParams.set('state', state);
  sessionStorage.setItem('oauth_state', state);

  // PKCE (recommended for public clients)
  if (config.usePKCE) {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    sessionStorage.setItem('code_verifier', codeVerifier);
  }

  // OpenID Connect nonce (optional but recommended)
  if (config.scopes.includes('openid')) {
    const nonce = generateRandomNonce();
    authUrl.searchParams.set('nonce', nonce);
    sessionStorage.setItem('oauth_nonce', nonce);
  }

  return authUrl.toString();
}

// Helper functions
function generateRandomState() {
  return base64URLEncode(crypto.randomBytes(32));
}

function generateCodeVerifier() {
  return base64URLEncode(crypto.randomBytes(32));
}

function generateCodeChallenge(verifier) {
  return base64URLEncode(
    crypto.createHash('sha256').update(verifier).digest()
  );
}

function generateRandomNonce() {
  return base64URLEncode(crypto.randomBytes(16));
}
```

#### 2.2: Redirect User to Authorization URL

```javascript
// Express example
app.get('/auth/login', (req, res) => {
  const authUrl = generateAuthorizationUrl({
    truxeUrl: 'https://api.truxe.io',
    clientId: process.env.OAUTH_CLIENT_ID,
    redirectUri: 'http://localhost:3000/auth/callback',
    scopes: ['openid', 'profile', 'email'],
    usePKCE: true
  });

  res.redirect(authUrl);
});
```

### Step 3: Handle OAuth Callback

After user authorizes, Truxe redirects back to your `redirect_uri` with:
- `code` - Authorization code (exchange for tokens)
- `state` - State parameter (validate for CSRF protection)

```javascript
app.get('/auth/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  // Check for authorization errors
  if (error) {
    console.error('Authorization error:', error, error_description);
    return res.redirect('/error?message=' + error_description);
  }

  // Validate state parameter (CSRF protection)
  const expectedState = req.session.oauth_state;
  if (!state || state !== expectedState) {
    return res.status(400).send('Invalid state parameter');
  }

  // Clear state from session
  delete req.session.oauth_state;

  // Exchange authorization code for tokens
  try {
    const tokens = await exchangeCodeForToken({
      code,
      redirectUri: 'http://localhost:3000/auth/callback',
      clientId: process.env.OAUTH_CLIENT_ID,
      clientSecret: process.env.OAUTH_CLIENT_SECRET,
      codeVerifier: req.session.code_verifier // If using PKCE
    });

    // Clear code_verifier from session
    delete req.session.code_verifier;

    // Store tokens securely
    req.session.access_token = tokens.access_token;
    req.session.refresh_token = tokens.refresh_token;
    req.session.expires_at = Date.now() + (tokens.expires_in * 1000);

    // Redirect to app
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Token exchange error:', error);
    res.redirect('/error?message=Authentication failed');
  }
});
```

### Step 4: Exchange Code for Tokens

```javascript
async function exchangeCodeForToken({ code, redirectUri, clientId, clientSecret, codeVerifier }) {
  const tokenEndpoint = 'https://api.truxe.io/oauth-provider/token';

  const body = {
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret
  };

  // Add PKCE verifier if used
  if (codeVerifier) {
    body.code_verifier = codeVerifier;
  }

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Token exchange failed: ${error.error_description}`);
  }

  const tokens = await response.json();
  /*
  {
    access_token: "at_abc123xyz...",
    token_type: "Bearer",
    expires_in: 3600,
    refresh_token: "rt_def456uvw...",
    scope: "openid profile email"
  }
  */

  return tokens;
}
```

### Step 5: Use Access Token

```javascript
async function getUserProfile(accessToken) {
  const response = await fetch('https://api.truxe.io/oauth-provider/userinfo', {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user profile');
  }

  const user = await response.json();
  /*
  {
    sub: "user_123456",
    email: "user@example.com",
    email_verified: true,
    name: "John Doe",
    given_name: "John",
    family_name: "Doe",
    picture: "https://...",
    updated_at: 1699564800
  }
  */

  return user;
}

// Middleware to require authentication
function requireAuth(req, res, next) {
  const accessToken = req.session.access_token;

  if (!accessToken) {
    return res.redirect('/auth/login');
  }

  // Check if token is expired
  if (Date.now() >= req.session.expires_at) {
    // Token expired - refresh it
    return refreshAccessToken(req, res, next);
  }

  next();
}
```

### Step 6: Refresh Tokens

Access tokens expire (typically after 1 hour). Use refresh tokens to get new access tokens without re-authentication:

```javascript
async function refreshAccessToken(req, res, next) {
  const refreshToken = req.session.refresh_token;

  if (!refreshToken) {
    return res.redirect('/auth/login');
  }

  try {
    const response = await fetch('https://api.truxe.io/oauth-provider/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.OAUTH_CLIENT_ID,
        client_secret: process.env.OAUTH_CLIENT_SECRET
      })
    });

    if (!response.ok) {
      // Refresh token invalid/expired - require re-authentication
      return res.redirect('/auth/login');
    }

    const tokens = await response.json();

    // Update session with new tokens
    req.session.access_token = tokens.access_token;
    req.session.refresh_token = tokens.refresh_token;
    req.session.expires_at = Date.now() + (tokens.expires_in * 1000);

    next();
  } catch (error) {
    console.error('Token refresh error:', error);
    res.redirect('/auth/login');
  }
}
```

### Step 7: Logout and Revoke Tokens

```javascript
app.get('/auth/logout', async (req, res) => {
  const accessToken = req.session.access_token;

  if (accessToken) {
    // Revoke token on Truxe
    try {
      await fetch('https://api.truxe.io/oauth-provider/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token: accessToken,
          token_type_hint: 'access_token',
          client_id: process.env.OAUTH_CLIENT_ID,
          client_secret: process.env.OAUTH_CLIENT_SECRET
        })
      });
    } catch (error) {
      console.error('Token revocation error:', error);
      // Continue with logout even if revocation fails
    }
  }

  // Clear session
  req.session.destroy();

  res.redirect('/');
});
```

---

## Grant Types

Truxe supports multiple OAuth 2.0 grant types for different use cases:

### 1. Authorization Code Flow

**Use Case:** Web applications with server-side backend

**Security:** Highest - Client secret is kept secure on server

**Flow:**
1. Redirect user to `/authorize`
2. User consents
3. Receive `code` via redirect
4. Exchange `code` for tokens server-side (using client_secret)

**Example:** See [Express Example](./examples/nodejs/express/)

### 2. Authorization Code Flow + PKCE

**Use Case:** Single Page Applications (SPAs), Mobile apps, Native apps

**Security:** High - No client secret, uses code challenge/verifier

**Flow:**
1. Generate `code_verifier` and `code_challenge`
2. Redirect user to `/authorize` with `code_challenge`
3. User consents
4. Receive `code` via redirect
5. Exchange `code` + `code_verifier` for tokens

**Example:** See [React SPA Example](./examples/react/spa/)

### 3. Refresh Token Grant

**Use Case:** Refreshing expired access tokens

**Security:** Refresh tokens are long-lived, store securely

**Flow:**
1. Access token expires
2. Use `refresh_token` to get new `access_token`
3. Optionally receive new `refresh_token`

**Example:**
```javascript
{
  grant_type: 'refresh_token',
  refresh_token: 'rt_...',
  client_id: 'client_id',
  client_secret: 'client_secret'
}
```

### 4. Client Credentials Flow

**Use Case:** Machine-to-machine authentication (no user context)

**Security:** Use for backend services only

**Flow:**
1. Request token using `client_id` + `client_secret`
2. Receive `access_token` (no refresh token)
3. Use token for API calls

**Example:**
```javascript
{
  grant_type: 'client_credentials',
  client_id: 'client_id',
  client_secret: 'client_secret',
  scope: 'api:read api:write'
}
```

---

## Security Best Practices

### 1. Always Use HTTPS

Never use OAuth over HTTP in production. All OAuth endpoints must use HTTPS to prevent token interception.

```javascript
// ❌ BAD
const authUrl = 'http://api.truxe.io/oauth-provider/authorize';

// ✅ GOOD
const authUrl = 'https://api.truxe.io/oauth-provider/authorize';
```

### 2. Implement CSRF Protection with State Parameter

Always generate and validate the `state` parameter:

```javascript
// Generate state on authorization request
const state = crypto.randomBytes(32).toString('base64url');
sessionStorage.setItem('oauth_state', state);
authUrl.searchParams.set('state', state);

// Validate state on callback
const receivedState = req.query.state;
const expectedState = req.session.oauth_state;
if (receivedState !== expectedState) {
  throw new Error('CSRF attack detected');
}
```

### 3. Use PKCE for Public Clients

For SPAs and mobile apps that cannot securely store client secrets:

```javascript
// Generate PKCE parameters
const codeVerifier = generateCodeVerifier(); // 43-128 chars
const codeChallenge = sha256(codeVerifier).base64url();

// Store verifier
localStorage.setItem('code_verifier', codeVerifier);

// Send challenge in authorization request
authUrl.searchParams.set('code_challenge', codeChallenge);
authUrl.searchParams.set('code_challenge_method', 'S256');

// Send verifier in token request
body.code_verifier = localStorage.getItem('code_verifier');
```

### 4. Secure Token Storage

**Server-Side (Node.js/Python/etc.):**
- Store tokens in encrypted session storage
- Use HTTP-only cookies
- Enable session encryption
- Set secure cookie flags

```javascript
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,      // HTTPS only
    httpOnly: true,    // No JavaScript access
    sameSite: 'lax',   // CSRF protection
    maxAge: 86400000   // 24 hours
  }
}));
```

**Client-Side (SPA):**
- Store tokens in memory (most secure)
- Use sessionStorage (better than localStorage)
- Never log tokens
- Clear tokens on logout

```javascript
// ✅ GOOD - Memory storage
class TokenManager {
  #accessToken = null;
  #refreshToken = null;

  setTokens({ access_token, refresh_token }) {
    this.#accessToken = access_token;
    this.#refreshToken = refresh_token;
  }

  getAccessToken() {
    return this.#accessToken;
  }

  clear() {
    this.#accessToken = null;
    this.#refreshToken = null;
  }
}

// ❌ BAD - localStorage (XSS vulnerable)
localStorage.setItem('access_token', token);
```

### 5. Validate Redirect URIs

Only whitelist exact redirect URIs - no wildcards:

```javascript
// ✅ GOOD
redirect_uris: [
  "https://myapp.com/auth/callback",
  "https://staging.myapp.com/auth/callback"
]

// ❌ BAD
redirect_uris: [
  "https://*.myapp.com/auth/callback",  // Wildcard vulnerable
  "https://myapp.com/*"                 // Overly broad
]
```

### 6. Implement Token Expiration Handling

Always check if tokens are expired and refresh proactively:

```javascript
function isTokenExpired(expiresAt) {
  // Refresh 5 minutes before expiration
  return Date.now() >= (expiresAt - 300000);
}

async function getValidToken() {
  if (isTokenExpired(session.expires_at)) {
    await refreshAccessToken();
  }
  return session.access_token;
}
```

### 7. Use Minimal Scopes

Only request scopes you actually need:

```javascript
// ❌ BAD - Requesting unnecessary scopes
scopes: ['openid', 'profile', 'email', 'admin', 'delete:all']

// ✅ GOOD - Minimal necessary scopes
scopes: ['openid', 'profile', 'email']
```

### 8. Validate ID Tokens (OpenID Connect)

If using OpenID Connect, validate ID tokens:

```javascript
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

async function validateIdToken(idToken) {
  const client = jwksClient({
    jwksUri: 'https://api.truxe.io/.well-known/jwks.json'
  });

  const decoded = jwt.decode(idToken, { complete: true });
  const key = await client.getSigningKey(decoded.header.kid);

  const verified = jwt.verify(idToken, key.getPublicKey(), {
    issuer: 'https://api.truxe.io',
    audience: process.env.OAUTH_CLIENT_ID,
    algorithms: ['RS256']
  });

  return verified;
}
```

### 9. Handle Errors Gracefully

Never expose sensitive error details to end users:

```javascript
try {
  const tokens = await exchangeCodeForToken(code);
} catch (error) {
  // ❌ BAD - Exposing technical details
  res.send(`Error: ${error.message}`);

  // ✅ GOOD - Generic message + logging
  logger.error('Token exchange failed', { error: error.message, code });
  res.redirect('/error?message=Authentication failed. Please try again.');
}
```

### 10. Implement Rate Limiting

Protect your OAuth endpoints from brute-force attacks:

```javascript
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                    // 5 requests per window
  message: 'Too many authentication attempts, please try again later.'
});

app.use('/auth/login', authLimiter);
app.use('/auth/callback', authLimiter);
```

---

## Code Examples

Complete, production-ready examples in multiple languages and frameworks:

### Node.js
- [Express Example](./examples/nodejs/express/) - Traditional Express.js application
- [Fastify Example](./examples/nodejs/fastify/) - Modern Fastify with TypeScript

### Next.js
- [App Router Example](./examples/nextjs/app-router/) - Next.js 13+ with Server Components
- [Pages Router Example](./examples/nextjs/pages-router/) - Next.js Pages Router with API routes

### Python
- [Flask Example](./examples/python/flask/) - Flask with OAuth decorators
- [Django Example](./examples/python/django/) - Django with custom auth backend

### React
- [React SPA Example](./examples/react/spa/) - Single Page Application with PKCE
- [React Router Example](./examples/react/with-router/) - React Router with protected routes

Each example includes:
- Complete source code
- Setup instructions
- Error handling
- Token refresh logic
- Logout functionality
- Tests

---

## Testing Your Integration

### 1. Test Authorization Flow

```bash
# Start your app
npm start

# Open browser
open http://localhost:3000/auth/login

# Expected flow:
# 1. Redirect to Truxe authorization page
# 2. Log in (if not already logged in)
# 3. See consent screen (if required)
# 4. Grant permission
# 5. Redirect back to your app with code
# 6. App exchanges code for tokens
# 7. App displays user profile
```

### 2. Test Token Refresh

```javascript
// Manually expire the access token in your session
req.session.expires_at = Date.now() - 1000;

// Make a protected request
// Should automatically refresh token
```

### 3. Test Error Scenarios

```javascript
// Test invalid client_id
// Test invalid redirect_uri
// Test expired authorization code
// Test invalid state parameter
// Test user denies consent
// Test token revocation
```

### 4. Test with Postman

Import this Postman collection to test OAuth flows:

```json
{
  "info": { "name": "Truxe OAuth Tests" },
  "item": [
    {
      "name": "1. Get Authorization URL",
      "request": {
        "method": "GET",
        "url": "{{truxe_url}}/oauth-provider/authorize?client_id={{client_id}}&redirect_uri={{redirect_uri}}&response_type=code&scope=openid profile email&state={{state}}"
      }
    },
    {
      "name": "2. Exchange Code for Token",
      "request": {
        "method": "POST",
        "url": "{{truxe_url}}/oauth-provider/token",
        "body": {
          "mode": "raw",
          "raw": "{\n  \"grant_type\": \"authorization_code\",\n  \"code\": \"{{code}}\",\n  \"redirect_uri\": \"{{redirect_uri}}\",\n  \"client_id\": \"{{client_id}}\",\n  \"client_secret\": \"{{client_secret}}\"\n}"
        }
      }
    },
    {
      "name": "3. Get User Info",
      "request": {
        "method": "GET",
        "url": "{{truxe_url}}/oauth-provider/userinfo",
        "header": [
          { "key": "Authorization", "value": "Bearer {{access_token}}" }
        ]
      }
    },
    {
      "name": "4. Refresh Token",
      "request": {
        "method": "POST",
        "url": "{{truxe_url}}/oauth-provider/token",
        "body": {
          "mode": "raw",
          "raw": "{\n  \"grant_type\": \"refresh_token\",\n  \"refresh_token\": \"{{refresh_token}}\",\n  \"client_id\": \"{{client_id}}\",\n  \"client_secret\": \"{{client_secret}}\"\n}"
        }
      }
    },
    {
      "name": "5. Introspect Token",
      "request": {
        "method": "POST",
        "url": "{{truxe_url}}/oauth-provider/introspect",
        "body": {
          "mode": "raw",
          "raw": "{\n  \"token\": \"{{access_token}}\",\n  \"client_id\": \"{{client_id}}\",\n  \"client_secret\": \"{{client_secret}}\"\n}"
        }
      }
    },
    {
      "name": "6. Revoke Token",
      "request": {
        "method": "POST",
        "url": "{{truxe_url}}/oauth-provider/revoke",
        "body": {
          "mode": "raw",
          "raw": "{\n  \"token\": \"{{access_token}}\",\n  \"client_id\": \"{{client_id}}\",\n  \"client_secret\": \"{{client_secret}}\"\n}"
        }
      }
    }
  ]
}
```

---

## Troubleshooting

### Error: "invalid_client"

**Cause:** Invalid client_id or client_secret

**Solution:**
- Verify your client credentials
- Check if client is enabled
- Ensure you're using the correct endpoint (staging vs production)

### Error: "invalid_grant"

**Causes:**
- Authorization code already used
- Authorization code expired (10 minutes)
- Invalid code_verifier (PKCE)
- Redirect URI mismatch

**Solutions:**
- Generate a new authorization code
- Ensure code is used within 10 minutes
- Verify code_verifier matches code_challenge
- Ensure redirect_uri exactly matches

### Error: "redirect_uri_mismatch"

**Cause:** Redirect URI not whitelisted

**Solution:**
- Add the redirect URI to your client's whitelist
- Ensure exact match (including protocol, port, path)
- No trailing slashes unless whitelisted with trailing slash

### Error: "invalid_scope"

**Cause:** Requesting scopes not allowed for this client

**Solution:**
- Check client's `allowed_scopes`
- Request only scopes in the whitelist

### Error: "access_denied"

**Cause:** User denied authorization

**Solution:**
- This is expected behavior
- Show user-friendly message
- Allow user to try again

### Token Refresh Failing

**Causes:**
- Refresh token expired (typically 30 days)
- Refresh token revoked
- Refresh token used too many times (if rotation enabled)

**Solutions:**
- Redirect user to re-authenticate
- Check if refresh_token rotation is enabled
- Verify refresh_token is stored correctly

### CORS Errors (SPAs)

**Cause:** Cross-origin requests blocked

**Solution:**
- Truxe supports CORS for OAuth endpoints
- Ensure your origin is whitelisted
- Use credentials: 'include' for cookies

```javascript
fetch(tokenEndpoint, {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(tokenRequest)
});
```

---

## API Reference

For detailed API documentation, see:
- [OAuth Endpoints API Reference](../04-api-reference/oauth-endpoints.md)

### Quick Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/oauth-provider/authorize` | GET | Authorization endpoint |
| `/oauth-provider/token` | POST | Token endpoint |
| `/oauth-provider/userinfo` | GET | User profile endpoint |
| `/oauth-provider/introspect` | POST | Token introspection |
| `/oauth-provider/revoke` | POST | Token revocation |
| `/.well-known/openid-configuration` | GET | OpenID discovery |

---

## Next Steps

1. Choose your language/framework from the [examples directory](./examples/)
2. Follow the setup instructions
3. Integrate OAuth into your application
4. Test thoroughly (use Postman collection)
5. Deploy to production with HTTPS
6. Monitor your OAuth usage in Truxe Dashboard

## Support

- Documentation: https://docs.truxe.io
- GitHub Issues: https://github.com/yourusername/truxe/issues
- Discord Community: https://discord.gg/truxe
- Email: support@truxe.io

---

**Last Updated:** 2025-11-06
**Version:** 1.0
**License:** MIT