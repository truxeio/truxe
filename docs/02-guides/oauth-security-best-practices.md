# OAuth Provider Security Best Practices Guide

**Version:** 1.0  
**Date:** November 6, 2025  
**Audience:** Developers using Truxe OAuth Provider  
**Maintained By:** Truxe Security Team

---

## 📋 Table of Contents

1. [Introduction](#introduction)
2. [Client Registration](#client-registration)
3. [Authorization Flow](#authorization-flow)
4. [Token Handling](#token-handling)
5. [Error Handling](#error-handling)
6. [Security Configuration](#security-configuration)
7. [Testing Security](#testing-security)
8. [Common Vulnerabilities](#common-vulnerabilities)
9. [Compliance Checklist](#compliance-checklist)
10. [Code Examples](#code-examples)

---

## 🎯 Introduction

This guide provides security best practices for developers building applications that integrate with the Truxe OAuth 2.0 Provider. Following these practices will help you build secure, compliant OAuth integrations.

### Security Principles

1. **Defense in Depth** - Multiple layers of security
2. **Least Privilege** - Request minimum required scopes
3. **Secure by Default** - Always use most secure options
4. **Fail Securely** - Errors should not expose sensitive data
5. **Don't Trust, Verify** - Validate all inputs and tokens

---

## 🔐 Client Registration

### Best Practices

#### ✅ DO: Use HTTPS Redirect URIs in Production

**Why:** HTTP redirect URIs expose authorization codes to network eavesdroppers.

```javascript
// ✅ GOOD: HTTPS redirect URI
const client = await registerClient({
  clientName: 'My App',
  redirectUris: ['https://app.example.com/callback'],
  // ...
});

// ❌ BAD: HTTP redirect URI (only for localhost development)
const client = await registerClient({
  clientName: 'My App',
  redirectUris: ['http://app.example.com/callback'], // ⚠️ INSECURE
  // ...
});
```

**Exception:** `http://localhost` is allowed for local development only.

#### ✅ DO: Use Exact Redirect URI Matching

**Why:** Prevents open redirect vulnerabilities.

```javascript
// ✅ GOOD: Exact URIs registered
const client = await registerClient({
  redirectUris: [
    'https://app.example.com/oauth/callback',
    'https://app.example.com/oauth/callback2',
  ],
  // ...
});

// ❌ BAD: Trying to use wildcards (not supported)
const client = await registerClient({
  redirectUris: ['https://app.example.com/oauth/*'], // ⚠️ WON'T WORK
  // ...
});
```

#### ✅ DO: Request Minimal Scopes

**Why:** Principle of least privilege - only request what you need.

```javascript
// ✅ GOOD: Minimal scopes
const client = await registerClient({
  allowedScopes: ['openid', 'email'], // Only what's needed
  // ...
});

// ❌ BAD: Requesting all scopes
const client = await registerClient({
  allowedScopes: ['openid', 'email', 'profile', 'read', 'write', 'admin'], // ⚠️ TOO MUCH
  // ...
});
```

#### ✅ DO: Enable PKCE for Public Clients

**Why:** Protects against authorization code interception.

```javascript
// ✅ GOOD: PKCE enabled for mobile/SPA
const client = await registerClient({
  clientName: 'My Mobile App',
  requirePkce: true, // ✅ REQUIRED for public clients
  // ...
});
```

**Rule:** Always enable PKCE for:
- Mobile apps
- Single Page Applications (SPAs)
- Desktop apps
- Any client that cannot securely store secrets

#### ✅ DO: Secure Client Secrets

**Why:** Client secrets are like passwords - treat them accordingly.

```javascript
// ✅ GOOD: Environment variables
const clientSecret = process.env.OAUTH_CLIENT_SECRET;

// ❌ BAD: Hardcoded secrets
const clientSecret = 'cs_abc123xyz789'; // ⚠️ NEVER DO THIS

// ❌ BAD: Committed to git
// .env file with secrets committed to repository

// ❌ BAD: Logged or displayed
console.log('Client secret:', clientSecret); // ⚠️ SECURITY BREACH
```

**Checklist:**
- [ ] Store secrets in environment variables
- [ ] Never commit secrets to git
- [ ] Add `.env` to `.gitignore`
- [ ] Rotate secrets if compromised
- [ ] Use secret management tools (AWS Secrets Manager, HashiCorp Vault)

---

## 🔄 Authorization Flow

### State Parameter (CSRF Protection)

#### ✅ DO: Always Use State Parameter

**Why:** Prevents CSRF attacks on your authorization callback.

```javascript
// ✅ GOOD: Generate and validate state
import crypto from 'crypto';

// 1. Generate state before authorization
const state = crypto.randomBytes(32).toString('hex');
req.session.oauth_state = state;

// 2. Redirect to authorization endpoint
const authUrl = new URL('https://auth.truxe.io/oauth/authorize');
authUrl.searchParams.set('client_id', clientId);
authUrl.searchParams.set('redirect_uri', redirectUri);
authUrl.searchParams.set('scope', 'openid email');
authUrl.searchParams.set('state', state); // ✅ Include state
authUrl.searchParams.set('response_type', 'code');

res.redirect(authUrl.toString());

// 3. Validate state on callback
app.get('/oauth/callback', (req, res) => {
  const { code, state } = req.query;
  
  // ✅ CRITICAL: Validate state matches
  if (state !== req.session.oauth_state) {
    throw new Error('Invalid state parameter - possible CSRF attack');
  }
  
  delete req.session.oauth_state; // Clean up
  
  // Proceed with token exchange...
});
```

```javascript
// ❌ BAD: No state parameter
const authUrl = `https://auth.truxe.io/oauth/authorize?
  client_id=${clientId}&
  redirect_uri=${redirectUri}&
  scope=openid email&
  response_type=code`; // ⚠️ MISSING STATE - VULNERABLE TO CSRF
```

### PKCE Implementation

#### ✅ DO: Implement PKCE for Public Clients

**Why:** Protects against authorization code interception attacks.

```javascript
// ✅ GOOD: Full PKCE implementation
import crypto from 'crypto';

// 1. Generate code_verifier
function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

// 2. Generate code_challenge from verifier
function generateCodeChallenge(verifier) {
  return crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
}

// 3. Store verifier, use challenge in authorization
const codeVerifier = generateCodeVerifier();
const codeChallenge = generateCodeChallenge(codeVerifier);

req.session.code_verifier = codeVerifier; // Store for later

const authUrl = new URL('https://auth.truxe.io/oauth/authorize');
authUrl.searchParams.set('code_challenge', codeChallenge);
authUrl.searchParams.set('code_challenge_method', 'S256'); // ✅ Always use S256
// ... other parameters

// 4. Include code_verifier in token exchange
const tokenResponse = await fetch('https://auth.truxe.io/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code: authorizationCode,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: req.session.code_verifier, // ✅ Include verifier
  }),
});
```

#### ❌ DON'T: Use 'plain' Code Challenge Method

```javascript
// ❌ BAD: Using plain method (insecure)
const authUrl = new URL('https://auth.truxe.io/oauth/authorize');
authUrl.searchParams.set('code_challenge', codeVerifier); // ⚠️ Plain text
authUrl.searchParams.set('code_challenge_method', 'plain'); // ⚠️ INSECURE
```

**Rule:** Always use `S256` (SHA-256) method for code challenges.

---

## 🎫 Token Handling

### Access Token Storage

#### ✅ DO: Store Tokens Securely

```javascript
// ✅ GOOD: Secure storage options

// Option 1: Server-side session (Best for web apps)
req.session.access_token = tokenResponse.access_token;
req.session.refresh_token = tokenResponse.refresh_token;

// Option 2: HTTP-only cookies (Good for web apps)
res.cookie('access_token', tokenResponse.access_token, {
  httpOnly: true,  // ✅ Prevents JavaScript access
  secure: true,    // ✅ HTTPS only
  sameSite: 'strict', // ✅ CSRF protection
  maxAge: 3600000, // 1 hour
});

// Option 3: Encrypted storage (Mobile apps)
import { SecureStore } from 'expo-secure-store';
await SecureStore.setItemAsync('access_token', tokenResponse.access_token);
```

```javascript
// ❌ BAD: Insecure storage

// ❌ LocalStorage (vulnerable to XSS)
localStorage.setItem('access_token', tokenResponse.access_token); // ⚠️ XSS RISK

// ❌ Plain cookies (vulnerable to XSS)
res.cookie('access_token', tokenResponse.access_token); // ⚠️ NO HTTPONLY

// ❌ URL parameters
const apiUrl = `https://api.example.com/data?token=${accessToken}`; // ⚠️ LOGS/HISTORY

// ❌ Console logging
console.log('Access token:', accessToken); // ⚠️ SECURITY BREACH
```

### Token Validation

#### ✅ DO: Validate JWT Signatures

```javascript
// ✅ GOOD: Proper JWT validation
import jwt from 'jsonwebtoken';

async function validateAccessToken(accessToken) {
  try {
    // 1. Fetch public key from JWKS endpoint
    const jwks = await fetch('https://auth.truxe.io/.well-known/jwks.json');
    const keys = await jwks.json();
    
    // 2. Get the key that signed the token
    const decodedHeader = jwt.decode(accessToken, { complete: true });
    const key = keys.keys.find(k => k.kid === decodedHeader.header.kid);
    
    // 3. Verify signature and claims
    const decoded = jwt.verify(accessToken, key.publicKey, {
      algorithms: ['RS256'], // ✅ Only allow RS256
      issuer: 'https://auth.truxe.io', // ✅ Verify issuer
      audience: process.env.OAUTH_CLIENT_ID, // ✅ Verify audience
    });
    
    // 4. Additional validations
    if (decoded.exp < Date.now() / 1000) {
      throw new Error('Token expired');
    }
    
    return decoded;
  } catch (error) {
    console.error('Token validation failed:', error.message);
    throw new Error('Invalid access token');
  }
}
```

```javascript
// ❌ BAD: No validation
const decoded = jwt.decode(accessToken); // ⚠️ NO SIGNATURE VERIFICATION
// This only decodes the token without verifying it was signed by Truxe!
```

### Token Refresh

#### ✅ DO: Implement Automatic Token Refresh

```javascript
// ✅ GOOD: Automatic refresh with retry
class TokenManager {
  constructor(clientId, clientSecret, refreshToken) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.refreshToken = refreshToken;
    this.accessToken = null;
    this.expiresAt = null;
  }
  
  async getValidAccessToken() {
    // Check if token is still valid
    if (this.accessToken && this.expiresAt > Date.now() + 60000) {
      return this.accessToken; // Still valid (with 1 min buffer)
    }
    
    // Refresh token
    const tokenResponse = await fetch('https://auth.truxe.io/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
      }),
    });
    
    if (!tokenResponse.ok) {
      throw new Error('Token refresh failed - user must re-authenticate');
    }
    
    const tokens = await tokenResponse.json();
    
    // Update stored tokens
    this.accessToken = tokens.access_token;
    this.refreshToken = tokens.refresh_token; // ✅ Update refresh token (rotation)
    this.expiresAt = Date.now() + (tokens.expires_in * 1000);
    
    return this.accessToken;
  }
}

// Usage
const tokenManager = new TokenManager(clientId, clientSecret, refreshToken);
const accessToken = await tokenManager.getValidAccessToken();
```

#### ❌ DON'T: Store Expired Tokens

```javascript
// ❌ BAD: Not checking expiration
function getAccessToken() {
  return localStorage.getItem('access_token'); // ⚠️ Might be expired
}

// ❌ BAD: Not handling refresh
fetch('https://api.example.com/data', {
  headers: { 'Authorization': `Bearer ${expiredToken}` }, // ⚠️ Will fail
});
```

### Token Revocation

#### ✅ DO: Revoke Tokens on Logout

```javascript
// ✅ GOOD: Revoke tokens on logout
async function logout(accessToken, refreshToken) {
  // 1. Revoke refresh token (this also invalidates access token)
  await fetch('https://auth.truxe.io/oauth/revoke', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      token: refreshToken,
      token_type_hint: 'refresh_token',
    }),
  });
  
  // 2. Clear local storage
  req.session.destroy();
  res.clearCookie('access_token');
  
  // 3. Redirect to logout page
  res.redirect('/logged-out');
}
```

```javascript
// ❌ BAD: Not revoking tokens
function logout() {
  req.session.destroy(); // ⚠️ Tokens still valid on server!
  res.redirect('/');
}
```

---

## 🚨 Error Handling

### Secure Error Messages

#### ✅ DO: Use Generic Error Messages for Users

```javascript
// ✅ GOOD: Generic user-facing errors
app.post('/oauth/token', async (req, res) => {
  try {
    const tokens = await exchangeAuthorizationCode(req.body);
    res.json(tokens);
  } catch (error) {
    // Log detailed error server-side
    console.error('[OAuth Token Error]', {
      error: error.message,
      stack: error.stack,
      clientId: req.body.client_id,
      timestamp: new Date().toISOString(),
    });
    
    // Return generic error to client
    res.status(400).json({
      error: 'invalid_grant',
      error_description: 'The provided authorization code is invalid or expired',
    });
  }
});
```

```javascript
// ❌ BAD: Exposing internal details
app.post('/oauth/token', async (req, res) => {
  try {
    const tokens = await exchangeAuthorizationCode(req.body);
    res.json(tokens);
  } catch (error) {
    // ⚠️ SECURITY RISK: Exposing internal errors
    res.status(500).json({
      error: error.message, // e.g., "Database connection failed at 10.0.0.5:5432"
      stack: error.stack, // ⚠️ LEAKS INTERNAL PATHS
    });
  }
});
```

#### ✅ DO: Log Security Events

```javascript
// ✅ GOOD: Comprehensive security logging
function logSecurityEvent(event, details) {
  const securityLog = {
    timestamp: new Date().toISOString(),
    event,
    ...details,
    ip: details.ip || 'unknown',
    userAgent: details.userAgent || 'unknown',
  };
  
  // Log to security monitoring system
  securityLogger.warn('Security Event', securityLog);
  
  // Alert on critical events
  if (event === 'MULTIPLE_FAILED_LOGINS' || event === 'TOKEN_REVOKED_SUSPICIOUS') {
    alertSecurityTeam(securityLog);
  }
}

// Usage examples
logSecurityEvent('AUTHORIZATION_CODE_REUSE_ATTEMPT', {
  clientId: 'cl_abc123',
  code: 'ac_xyz789',
  ip: req.ip,
});

logSecurityEvent('INVALID_CLIENT_SECRET', {
  clientId: req.body.client_id,
  ip: req.ip,
});

logSecurityEvent('REFRESH_TOKEN_ROTATED', {
  clientId: 'cl_abc123',
  userId: 'user_123',
  oldTokenRevoked: true,
});
```

---

## ⚙️ Security Configuration

### Production Checklist

```javascript
// ✅ PRODUCTION SECURITY CHECKLIST

// 1. Environment Variables
const requiredEnvVars = [
  'JWT_PRIVATE_KEY',      // ✅ RS256 private key
  'JWT_PUBLIC_KEY',       // ✅ RS256 public key
  'DATABASE_URL',         // ✅ Connection string
  'SESSION_SECRET',       // ✅ Unique session secret
  'COOKIE_SECRET',        // ✅ Unique cookie secret
  'OAUTH_CLIENT_SECRET',  // ✅ Your client secret
];

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
});

// 2. HTTPS Enforcement
if (process.env.NODE_ENV === 'production' && !req.secure) {
  return res.redirect(`https://${req.headers.host}${req.url}`);
}

// 3. Secure Cookie Settings
app.use(session({
  secret: process.env.SESSION_SECRET,
  cookie: {
    secure: true,          // ✅ HTTPS only
    httpOnly: true,        // ✅ No JavaScript access
    sameSite: 'strict',    // ✅ CSRF protection
    maxAge: 3600000,       // 1 hour
  },
}));

// 4. Security Headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000,      // 1 year
    includeSubDomains: true,
    preload: true,
  },
}));

// 5. Rate Limiting
app.use('/oauth/token', rateLimit({
  windowMs: 60 * 1000,     // 1 minute
  max: 10,                 // 10 requests per minute
  message: 'Too many token requests, please try again later',
}));

// 6. CORS Configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [],
  credentials: true,
  methods: ['GET', 'POST'],
}));
```

---

## 🧪 Testing Security

### Security Test Cases

```javascript
// Example security tests
describe('OAuth Security', () => {
  
  test('should reject reused authorization codes', async () => {
    const code = await createAuthorizationCode();
    
    // First use: Success
    const tokens1 = await exchangeCode(code);
    expect(tokens1.access_token).toBeDefined();
    
    // Second use: Should fail
    await expect(exchangeCode(code)).rejects.toThrow('Authorization code already used');
  });
  
  test('should reject expired authorization codes', async () => {
    const expiredCode = await createExpiredAuthorizationCode();
    
    await expect(exchangeCode(expiredCode)).rejects.toThrow('Authorization code expired');
  });
  
  test('should enforce redirect URI match', async () => {
    const code = await createAuthorizationCode({
      redirectUri: 'https://app.example.com/callback',
    });
    
    // Wrong redirect URI
    await expect(exchangeCode(code, {
      redirectUri: 'https://evil.com/callback',
    })).rejects.toThrow('Redirect URI mismatch');
  });
  
  test('should require PKCE for public clients', async () => {
    await expect(authorize({
      clientId: publicClientId,
      // Missing code_challenge
    })).rejects.toThrow('PKCE required');
  });
  
  test('should validate PKCE code_verifier', async () => {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    
    const code = await authorize({
      codeChallenge,
      codeChallengeMethod: 'S256',
    });
    
    // Wrong verifier
    await expect(exchangeCode(code, {
      codeVerifier: 'wrong-verifier',
    })).rejects.toThrow('Invalid code_verifier');
  });
  
  test('should enforce tenant isolation', async () => {
    const tenant1Client = await createClient({ tenantId: 'tenant1' });
    
    // Tenant 2 user tries to access tenant 1 client
    await expect(getClient(tenant1Client.clientId, {
      tenantId: 'tenant2',
    })).rejects.toThrow('Client not found');
  });
});
```

---

## 🐛 Common Vulnerabilities

### 1. Authorization Code Interception

**Vulnerability:**
```javascript
// ❌ Public client without PKCE
const authUrl = `https://auth.truxe.io/oauth/authorize?
  client_id=${publicClientId}&
  redirect_uri=${redirectUri}&
  response_type=code`; // ⚠️ No PKCE - code can be intercepted
```

**Fix:**
```javascript
// ✅ Public client with PKCE
const codeVerifier = generateCodeVerifier();
const codeChallenge = generateCodeChallenge(codeVerifier);

const authUrl = `https://auth.truxe.io/oauth/authorize?
  client_id=${publicClientId}&
  redirect_uri=${redirectUri}&
  response_type=code&
  code_challenge=${codeChallenge}&
  code_challenge_method=S256`; // ✅ PKCE protects code
```

### 2. Token Leakage in Logs

**Vulnerability:**
```javascript
// ❌ Logging tokens
console.log('Received token:', req.body.access_token); // ⚠️ LOGS TOKEN
logger.info(`User ${userId} authenticated with token ${accessToken}`); // ⚠️ LOGS TOKEN
```

**Fix:**
```javascript
// ✅ Redact sensitive data
function sanitizeLog(obj) {
  const sensitive = ['access_token', 'refresh_token', 'client_secret', 'password'];
  const sanitized = { ...obj };
  sensitive.forEach(key => {
    if (sanitized[key]) {
      sanitized[key] = '[REDACTED]';
    }
  });
  return sanitized;
}

console.log('Token request:', sanitizeLog(req.body)); // ✅ Safe to log
```

### 3. Open Redirect

**Vulnerability:**
```javascript
// ❌ Accepting any redirect_uri
app.get('/oauth/callback', (req, res) => {
  const { redirect_uri } = req.query;
  res.redirect(redirect_uri); // ⚠️ OPEN REDIRECT
});
```

**Fix:**
```javascript
// ✅ Validate against whitelist
const ALLOWED_REDIRECTS = [
  'https://app.example.com/callback',
  'https://app.example.com/callback2',
];

app.get('/oauth/callback', (req, res) => {
  const { redirect_uri } = req.query;
  
  if (!ALLOWED_REDIRECTS.includes(redirect_uri)) {
    return res.status(400).json({ error: 'Invalid redirect_uri' });
  }
  
  res.redirect(redirect_uri); // ✅ Safe redirect
});
```

### 4. CSRF on Authorization Callback

**Vulnerability:**
```javascript
// ❌ No state parameter validation
app.get('/oauth/callback', async (req, res) => {
  const { code } = req.query;
  const tokens = await exchangeCode(code); // ⚠️ CSRF VULNERABLE
  req.session.access_token = tokens.access_token;
  res.redirect('/dashboard');
});
```

**Fix:**
```javascript
// ✅ Validate state parameter
app.get('/oauth/callback', async (req, res) => {
  const { code, state } = req.query;
  
  // Validate state matches
  if (state !== req.session.oauth_state) {
    return res.status(403).json({ error: 'Invalid state - possible CSRF attack' });
  }
  
  delete req.session.oauth_state; // Clean up
  
  const tokens = await exchangeCode(code); // ✅ CSRF protected
  req.session.access_token = tokens.access_token;
  res.redirect('/dashboard');
});
```

---

## ✅ Compliance Checklist

### Pre-Launch Security Checklist

- [ ] **Client Registration**
  - [ ] HTTPS redirect URIs in production
  - [ ] Exact redirect URI matching
  - [ ] Minimal scopes requested
  - [ ] PKCE enabled for public clients
  - [ ] Client secrets stored in environment variables

- [ ] **Authorization Flow**
  - [ ] State parameter generated and validated
  - [ ] PKCE implemented (code_challenge + code_verifier)
  - [ ] S256 code challenge method used
  - [ ] Redirect URI validated on callback

- [ ] **Token Handling**
  - [ ] Tokens stored securely (HTTP-only cookies or server session)
  - [ ] JWT signatures validated
  - [ ] Token expiration checked
  - [ ] Automatic token refresh implemented
  - [ ] Tokens revoked on logout

- [ ] **Error Handling**
  - [ ] Generic error messages for users
  - [ ] Detailed errors logged server-side only
  - [ ] Security events logged and monitored

- [ ] **Production Configuration**
  - [ ] HTTPS enforced
  - [ ] Secure cookie settings
  - [ ] Security headers configured
  - [ ] Rate limiting enabled
  - [ ] CORS properly configured

- [ ] **Testing**
  - [ ] Security test suite implemented
  - [ ] Authorization code reuse tested
  - [ ] Token expiration tested
  - [ ] PKCE validation tested
  - [ ] Tenant isolation tested

---

## 📚 Additional Resources

### Official Documentation

- **Truxe OAuth Provider Docs:** `/docs/oauth-provider/`
- **OAuth 2.0 RFC 6749:** https://datatracker.ietf.org/doc/html/rfc6749
- **PKCE RFC 7636:** https://datatracker.ietf.org/doc/html/rfc7636
- **JWT RFC 7519:** https://datatracker.ietf.org/doc/html/rfc7519
- **OAuth 2.0 Security Best Practices:** https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics

### Security Tools

- **npm audit:** Scan for vulnerabilities
- **Snyk:** Automated security scanning
- **OWASP ZAP:** Penetration testing
- **jwt.io:** JWT debugging

### Support

- **Security Issues:** security@truxe.io
- **General Support:** support@truxe.io
- **Bug Reports:** https://github.com/truxeio/truxe/issues

---

**Document Version:** 1.0  
**Last Updated:** November 6, 2025  
**Next Review:** February 6, 2026

**Remember:** Security is an ongoing process. Stay updated with the latest OAuth security best practices and regularly review your implementation.
