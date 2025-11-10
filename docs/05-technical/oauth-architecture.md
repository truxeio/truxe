# OAuth 2.0 Architecture Documentation

**Version:** v0.2.0
**Status:** ✅ Implemented
**Last Updated:** 2025-01-28

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Security Features](#security-features)
4. [Data Flow](#data-flow)
5. [API Reference](#api-reference)
6. [Database Schema](#database-schema)
7. [Configuration](#configuration)
8. [Error Handling](#error-handling)
9. [Testing](#testing)
10. [Best Practices](#best-practices)

---

## Overview

Truxe's OAuth 2.0 implementation provides secure, standards-compliant social login functionality with support for multiple providers (Google, GitHub, Apple). The architecture follows RFC 6749 (OAuth 2.0 Authorization Framework) and implements comprehensive security measures including CSRF protection, token encryption, and state management.

### Key Features

- ✅ **Multi-Provider Support**: Google, GitHub, Apple (extensible architecture)
- ✅ **CSRF Protection**: Cryptographically secure state parameters with Redis storage
- ✅ **Token Encryption**: AES-256-GCM encryption for sensitive tokens at rest
- ✅ **Account Linking**: Link/unlink OAuth accounts to existing users
- ✅ **Flexible Flows**: Sign-in, sign-up, and account linking modes
- ✅ **Multi-Tenant**: Tenant-aware OAuth flows and callbacks
- ✅ **Audit Logging**: Comprehensive OAuth event logging
- ✅ **Rate Limiting**: Protection against abuse

---

## Architecture

### Component Diagram

```
┌────────────────────────────────────────────────────────────┐
│                     OAuth Architecture                      │
└────────────────────────────────────────────────────────────┘

┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Client    │────────▶│ OAuth Routes │────────▶│  OAuth      │
│ Application │         │  (Fastify)   │         │  Service    │
└─────────────┘         └──────────────┘         └─────────────┘
                                │                       │
                                │                       ▼
                                │              ┌─────────────────┐
                                │              │ State Manager   │
                                │              │   (Redis)       │
                                │              └─────────────────┘
                                │                       │
                                ▼                       ▼
                        ┌──────────────┐      ┌─────────────────┐
                        │  Provider    │      │ Token Encryptor │
                        │  Interface   │      │   (AES-256)     │
                        └──────────────┘      └─────────────────┘
                                │                       │
                    ┌───────────┼───────────┐          │
                    ▼           ▼           ▼          ▼
               ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐
               │ Google │ │ GitHub │ │ Apple  │ │PostgreSQL│
               │Provider│ │Provider│ │Provider│ │(Accounts)│
               └────────┘ └────────┘ └────────┘ └──────────┘
```

### Core Components

#### 1. OAuth Service (`oauth-service.js`)

**Purpose**: Orchestrates the entire OAuth flow from authorization to account linking.

**Responsibilities**:
- Provider registration and management
- Authorization flow initiation
- Callback handling and validation
- Token exchange and storage
- Account linking/unlinking
- User profile retrieval

**Key Methods**:
```javascript
class OAuthService {
  // Flow initiation
  async createAuthorizationRequest({ providerId, tenantId, userId, redirectUri, scopes })

  // Callback processing
  async handleCallback({ providerId, code, state, error, tenantId, userId })

  // Account management
  async linkAccount({ userId, providerId, providerAccountId, tokens, profile })
  async unlinkAccount({ userId, providerId, providerAccountId })
  async listAccountsForUser(userId, { includeTokens })

  // Utility
  getProvider(providerId)
  isProviderEnabled(providerId)
  buildCallbackUrl(providerId, { tenantId })
}
```

#### 2. State Manager (`state-manager.js`)

**Purpose**: Manages OAuth state parameters for CSRF protection.

**Security Features**:
- Cryptographically secure state generation (32 bytes minimum)
- HMAC-SHA256 signature for state integrity
- Redis-backed storage with configurable TTL (default: 10 minutes)
- Memory fallback for resilience
- One-time use enforcement (consumed on validation)
- Timing-safe comparison to prevent timing attacks

**State Structure**:
```javascript
{
  stateId: "base64url-encoded-random-32-bytes",
  signature: "hmac-sha256-signature",
  payload: {
    provider: "google",
    tenantId: "tenant-123",
    userId: "user-456",
    redirectUri: "https://app.example.com/callback",
    nonce: "uuid-v4",
    createdAt: "2025-01-28T10:00:00Z",
    expiresAt: 1706443800000
  }
}
```

**Key Methods**:
```javascript
class OAuthStateManager {
  async generateState(context)          // Create and store state
  async validateState(stateValue, opts) // Validate and consume state
  async deleteState(stateId)             // Manually delete state
  async destroy()                        // Cleanup resources
}
```

#### 3. Token Encryptor (`token-encryptor.js`)

**Purpose**: Encrypt/decrypt sensitive OAuth tokens before database storage.

**Encryption Spec**:
- **Algorithm**: AES-256-GCM (Galois/Counter Mode)
- **Key Size**: 256 bits (32 bytes)
- **IV**: 96 bits (12 bytes) - randomly generated per encryption
- **Auth Tag**: 128 bits (16 bytes) - for authenticated encryption
- **Encoding**: Base64URL for safe storage

**Encrypted Token Format**:
```
[12 bytes IV][16 bytes Auth Tag][N bytes Ciphertext]
                    ↓
            Base64URL Encoded
```

**Key Methods**:
```javascript
class OAuthTokenEncryptor {
  encrypt(plaintext)     // Returns base64url(IV + AuthTag + Ciphertext)
  decrypt(encoded)       // Returns plaintext or throws on tampering
}
```

#### 4. Provider Interface (`provider-interface.js`)

**Purpose**: Abstract base class defining OAuth provider contract.

**Abstract Methods** (must be implemented by providers):
```javascript
class BaseOAuthProvider {
  // Required implementations
  async getAuthorizationUrl({ state, redirectUri, scopes, providerConfig })
  async exchangeCodeForToken({ code, redirectUri, providerConfig })
  async getUserProfile({ accessToken, idToken, providerConfig })
  async refreshAccessToken({ refreshToken, providerConfig })
  async revokeToken({ token, providerConfig })
}
```

**Utility Methods** (inherited by all providers):
```javascript
// State helpers
generateState(metadata)
validateState(state, maxAge)

// HTTP helpers
makeRequest(url, options)
buildQueryString(params)

// Profile normalization
normalizeProfile(rawProfile)
```

---

## Security Features

### 1. CSRF Protection

**Implementation**:
- State parameter with cryptographically secure random generation
- HMAC-SHA256 signature prevents tampering
- Redis storage with 10-minute TTL
- One-time use enforcement
- Provider validation on callback

**Flow**:
```
1. Generate state: stateId.signature
2. Store context in Redis: oauth:state:{stateId} → { provider, userId, ... }
3. Include state in authorization URL
4. Validate signature on callback
5. Verify state exists in Redis
6. Consume state (delete from Redis)
7. Verify provider matches
```

### 2. Token Encryption

**Why**: Protect sensitive OAuth tokens from database compromise.

**What's Encrypted**:
- Access tokens
- Refresh tokens
- ID tokens (OpenID Connect)

**Encryption Process**:
```
1. Generate random 12-byte IV
2. Encrypt token with AES-256-GCM
3. Get 16-byte authentication tag
4. Concatenate: IV || AuthTag || Ciphertext
5. Encode with Base64URL
6. Store in database
```

**Decryption Process**:
```
1. Decode Base64URL
2. Extract IV (bytes 0-12)
3. Extract AuthTag (bytes 12-28)
4. Extract Ciphertext (bytes 28+)
5. Decrypt with AES-256-GCM
6. Verify AuthTag (throws if tampered)
7. Return plaintext
```

### 3. Redirect URI Validation

**Purpose**: Prevent open redirect vulnerabilities.

**Validation Rules**:
- Must be valid URI format
- Optional whitelist of allowed hosts
- Compared against provider configuration
- Logged for audit purposes

**Configuration Example**:
```javascript
{
  oauth: {
    allowedRedirectHosts: [
      'localhost:3000',
      'app.example.com',
      'staging.example.com'
    ]
  }
}
```

### 4. Rate Limiting

**Implemented At**:
- Authorization request initiation
- Callback endpoint
- Account linking/unlinking

**Default Limits**:
```javascript
{
  'oauth:authorize': { limit: 10, window: '15m' },
  'oauth:callback': { limit: 20, window: '15m' },
  'oauth:link': { limit: 5, window: '15m' },
  'oauth:unlink': { limit: 5, window: '15m' }
}
```

---

## Data Flow

### Authorization Flow (Sign-In)

```mermaid
sequenceDiagram
    participant Client
    participant Truxe
    participant Redis
    participant Provider
    participant Database

    Client->>Truxe: POST /oauth/:provider/start
    Truxe->>Truxe: Generate state
    Truxe->>Redis: Store state context (TTL: 10min)
    Truxe->>Truxe: Build authorization URL
    Truxe->>Client: Return { authorizationUrl, state }

    Client->>Provider: Redirect to authorization URL
    Provider->>Provider: User authenticates
    Provider->>Client: Redirect to callback with code & state

    Client->>Truxe: GET /callback/:provider?code=xxx&state=yyy
    Truxe->>Redis: Validate and consume state
    Truxe->>Provider: Exchange code for tokens
    Provider->>Truxe: Return access_token, refresh_token
    Truxe->>Provider: Get user profile
    Provider->>Truxe: Return profile data

    Truxe->>Truxe: Encrypt tokens
    Truxe->>Database: Store/update oauth_accounts
    Truxe->>Database: Create/get user
    Truxe->>Client: Return { user, profile, account }
```

### Account Linking Flow

```mermaid
sequenceDiagram
    participant Client
    participant Truxe
    participant Redis
    participant Provider
    participant Database

    Note over Client: User already authenticated

    Client->>Truxe: POST /oauth/:provider/start<br/>{Authorization: Bearer jwt}
    Truxe->>Truxe: Extract userId from JWT
    Truxe->>Truxe: Generate state with userId
    Truxe->>Redis: Store state context
    Truxe->>Client: Return authorization URL

    Client->>Provider: Redirect to authorization URL
    Provider->>Client: Redirect to callback with code

    Client->>Truxe: GET /callback/:provider?code=xxx&state=yyy<br/>{Authorization: Bearer jwt}
    Truxe->>Redis: Validate state, get userId
    Truxe->>Provider: Exchange code for tokens
    Truxe->>Provider: Get user profile

    Truxe->>Database: Check if provider account exists
    alt Account exists for different user
        Truxe->>Client: Error: Account already linked
    else Account doesn't exist or belongs to same user
        Truxe->>Truxe: Encrypt tokens
        Truxe->>Database: INSERT/UPDATE oauth_accounts
        Truxe->>Client: Success: Account linked
    end
```

---

## API Reference

### POST /oauth/:provider/start

**Description**: Initiate OAuth authorization flow.

**Parameters**:
- `provider` (path, required): Provider identifier (google, github, apple)

**Request Body**:
```json
{
  "redirectUri": "https://app.example.com/callback",
  "tenantId": "tenant-123",
  "scopes": ["profile", "email"],
  "prompt": "consent",
  "state": {
    "customField": "customValue"
  }
}
```

**Response (200 OK)**:
```json
{
  "provider": "google",
  "authorizationUrl": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...",
  "state": "randomstate123.signature456",
  "expiresAt": "2025-01-28T10:10:00Z",
  "tenantId": "tenant-123",
  "scopes": ["profile", "email"]
}
```

**Error Responses**:
- `400`: Invalid request (missing provider, invalid redirect URI)
- `503`: Provider disabled

---

### GET /callback/:provider

**Description**: OAuth provider callback endpoint.

**Parameters**:
- `provider` (path, required): Provider identifier
- `code` (query, required): Authorization code from provider
- `state` (query, required): State parameter from authorization
- `error` (query, optional): Error code from provider
- `error_description` (query, optional): Error description from provider

**Response (200 OK)**:
```json
{
  "success": true,
  "provider": "google",
  "tenantId": "tenant-123",
  "linked": true,
  "account": {
    "id": "account-uuid",
    "userId": "user-uuid",
    "provider": "google",
    "providerAccountId": "google-user-123",
    "email": "user@gmail.com",
    "scope": "profile email",
    "tokenExpiresAt": "2025-01-28T11:00:00Z",
    "createdAt": "2025-01-28T10:00:00Z",
    "tokens": {
      "hasAccessToken": true,
      "hasRefreshToken": true,
      "hasIdToken": true
    }
  },
  "profile": {
    "id": "google-user-123",
    "email": "user@gmail.com",
    "emailVerified": true,
    "name": "John Doe",
    "givenName": "John",
    "familyName": "Doe",
    "avatarUrl": "https://..."
  },
  "tokenMetadata": {
    "scope": "profile email",
    "tokenType": "Bearer",
    "expiresAt": "2025-01-28T11:00:00Z",
    "hasRefreshToken": true
  },
  "state": {
    "redirectUri": "https://app.example.com/callback",
    "nonce": "uuid-v4"
  }
}
```

**Error Responses**:
- `400`: Invalid state, missing code
- `401`: State validation failed
- `409`: Account already linked to different user

---

## Database Schema

### oauth_accounts Table

```sql
CREATE TABLE oauth_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    provider_account_id VARCHAR(255) NOT NULL,
    provider_email VARCHAR(255),
    access_token TEXT,              -- Encrypted with AES-256-GCM
    refresh_token TEXT,             -- Encrypted with AES-256-GCM
    token_expires_at TIMESTAMPTZ,
    scope TEXT,
    id_token TEXT,                  -- Encrypted with AES-256-GCM
    profile_data JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider, provider_account_id)
);

-- Indexes for performance
CREATE INDEX idx_oauth_accounts_user_id ON oauth_accounts(user_id);
CREATE INDEX idx_oauth_accounts_provider_account
    ON oauth_accounts(provider, provider_account_id);

-- RLS Policy
ALTER TABLE oauth_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY oauth_accounts_user_access
    ON oauth_accounts
    FOR ALL TO authenticated
    USING (user_id = current_user_id())
    WITH CHECK (user_id = current_user_id());
```

### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Reference to internal Truxe user |
| `provider` | VARCHAR(50) | Provider identifier (google, github, apple) |
| `provider_account_id` | VARCHAR(255) | Stable identifier from OAuth provider |
| `provider_email` | VARCHAR(255) | Email from provider (may differ from user email) |
| `access_token` | TEXT | Encrypted OAuth access token |
| `refresh_token` | TEXT | Encrypted OAuth refresh token (if available) |
| `token_expires_at` | TIMESTAMPTZ | Access token expiration |
| `scope` | TEXT | Granted OAuth scopes |
| `id_token` | TEXT | Encrypted OpenID Connect ID token (if available) |
| `profile_data` | JSONB | Cached provider profile data |
| `created_at` | TIMESTAMPTZ | Account creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

---

## Configuration

### Environment Variables

```bash
# OAuth Global Settings
OAUTH_ENABLED=true
OAUTH_CALLBACK_BASE_URL=https://api.yourdomain.com
OAUTH_STATE_SECRET=<256-bit-random-secret>
OAUTH_STATE_TTL=600000                    # 10 minutes in ms
OAUTH_TOKEN_ENCRYPTION_KEY=<base64-key>
OAUTH_ALLOWED_REDIRECT_HOSTS=app.yourdomain.com,staging.yourdomain.com

# Google OAuth
GOOGLE_OAUTH_ENABLED=true
GOOGLE_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret
GOOGLE_OAUTH_SCOPES=openid,profile,email

# GitHub OAuth
GITHUB_OAUTH_ENABLED=true
GITHUB_OAUTH_CLIENT_ID=your-github-client-id
GITHUB_OAUTH_CLIENT_SECRET=your-github-client-secret
GITHUB_OAUTH_SCOPES=read:user,user:email

# Apple OAuth
APPLE_OAUTH_ENABLED=true
APPLE_OAUTH_CLIENT_ID=com.yourapp.service
APPLE_OAUTH_TEAM_ID=your-team-id
APPLE_OAUTH_KEY_ID=your-key-id
APPLE_OAUTH_PRIVATE_KEY=<path-to-p8-file>
APPLE_OAUTH_SCOPES=name,email
```

### Configuration Object

```javascript
{
  oauth: {
    enabled: true,
    callbackBaseUrl: 'https://api.yourdomain.com',
    tenantParameter: 'tenant',
    allowedRedirectHosts: ['app.yourdomain.com'],

    state: {
      secret: process.env.OAUTH_STATE_SECRET,
      ttl: 600000,      // 10 minutes
      length: 32,       // State ID length
      keyPrefix: 'oauth:state:'
    },

    tokenEncryption: {
      key: process.env.OAUTH_TOKEN_ENCRYPTION_KEY,
      algorithm: 'aes-256-gcm'
    },

    providers: {
      google: {
        enabled: true,
        clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
        clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
        callbackPath: '/auth/callback/google',
        scopes: ['openid', 'profile', 'email']
      },

      github: {
        enabled: true,
        clientId: process.env.GITHUB_OAUTH_CLIENT_ID,
        clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
        authUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        userInfoUrl: 'https://api.github.com/user',
        callbackPath: '/auth/callback/github',
        scopes: ['read:user', 'user:email']
      },

      apple: {
        enabled: true,
        clientId: process.env.APPLE_OAUTH_CLIENT_ID,
        teamId: process.env.APPLE_OAUTH_TEAM_ID,
        keyId: process.env.APPLE_OAUTH_KEY_ID,
        privateKey: process.env.APPLE_OAUTH_PRIVATE_KEY,
        authUrl: 'https://appleid.apple.com/auth/authorize',
        tokenUrl: 'https://appleid.apple.com/auth/token',
        callbackPath: '/auth/callback/apple',
        scopes: ['name', 'email']
      }
    }
  }
}
```

---

## Error Handling

### Error Classes

```javascript
// Base OAuth error
class OAuthError extends Error {
  code: string
  statusCode: number
  details?: object
}

// State validation errors
class OAuthStateError extends OAuthError

// Provider communication errors
class OAuthProviderError extends OAuthError

// Database/persistence errors
class OAuthPersistenceError extends OAuthError

// Configuration errors
class OAuthConfigurationError extends OAuthError
```

### Common Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `OAUTH_PROVIDER_REQUIRED` | Provider ID missing | 400 |
| `OAUTH_PROVIDER_DISABLED` | Provider not enabled | 503 |
| `OAUTH_CODE_REQUIRED` | Authorization code missing | 400 |
| `OAUTH_STATE_EXPIRED` | State parameter expired | 401 |
| `OAUTH_STATE_INVALID` | State validation failed | 401 |
| `OAUTH_ACCOUNT_CONFLICT` | Account already linked | 409 |
| `OAUTH_REDIRECT_DISALLOWED` | Redirect URI not allowed | 400 |
| `OAUTH_INTERNAL_ERROR` | Unexpected error | 500 |

---

## Testing

### Test Coverage

- ✅ State generation and validation
- ✅ Token encryption/decryption
- ✅ Authorization flow
- ✅ Callback handling
- ✅ Account linking/unlinking
- ✅ CSRF protection
- ✅ Error scenarios
- ✅ Security validations

### Running Tests

```bash
# Run all OAuth tests
npm test -- tests/oauth-infrastructure.test.js

# Run with coverage
npm run test:coverage -- tests/oauth-infrastructure.test.js

# Run specific test suite
npm test -- --grep "OAuth State Manager"
```

### Test Environment Setup

```bash
# Required environment variables for testing
export DATABASE_URL=postgresql://user:pass@localhost:5432/truxe_test
export REDIS_URL=redis://localhost:6379
export OAUTH_STATE_SECRET=$(openssl rand -base64 32)
export OAUTH_TOKEN_ENCRYPTION_KEY=$(openssl rand -base64 32)
```

---

## Best Practices

### Security

1. **Never Log Sensitive Data**
   ```javascript
   // ❌ Bad
   logger.info('Token received', { accessToken: token });

   // ✅ Good
   logger.info('Token received', {
     tokenLength: token.length,
     expiresAt: expiresAt
   });
   ```

2. **Always Validate State**
   - Never skip state validation
   - Enforce one-time use
   - Check provider match

3. **Encrypt Tokens Before Storage**
   ```javascript
   // Always encrypt sensitive tokens
   const encrypted = tokenEncryptor.encrypt(accessToken);
   await db.query('INSERT INTO oauth_accounts (access_token) VALUES ($1)', [encrypted]);
   ```

4. **Use Redirect URI Whitelist**
   ```javascript
   // Configure allowed redirect hosts
   allowedRedirectHosts: [
     'app.yourdomain.com',
     'staging.yourdomain.com'
   ]
   ```

### Performance

1. **Cache Provider Instances**
   - Providers are registered once at startup
   - Reuse instances across requests

2. **Use Redis for State**
   - Memory fallback available for resilience
   - Configure appropriate TTL

3. **Index Database Queries**
   - Indexes on `user_id`, `provider`, `provider_account_id`
   - RLS policies optimized

### Maintainability

1. **Provider Isolation**
   - Each provider in separate file
   - Extends `BaseOAuthProvider`
   - Implements required methods

2. **Configuration**
   - Environment-based configuration
   - Provider-specific settings isolated
   - Easy to enable/disable providers

3. **Error Handling**
   - Use custom error classes
   - Include error codes
   - Provide helpful messages

---

## Additional Resources

- [OAuth 2.0 RFC 6749](https://datatracker.ietf.org/doc/html/rfc6749)
- [OAuth 2.0 Security Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)
- [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html)
- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- [GitHub OAuth Documentation](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [Apple Sign In Documentation](https://developer.apple.com/sign-in-with-apple/)

---

**Document Version**: 1.0
**Last Reviewed**: 2025-01-28
**Next Review**: 2025-04-28
