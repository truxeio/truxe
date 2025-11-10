# OAuth Provider API Reference

Complete API reference for Truxe's OAuth 2.0 Provider endpoints.

**Version:** 1.0
**Base URL:** `https://api.truxe.io`
**Last Updated:** 2025-11-06

---

## Table of Contents

1. [Authorization Endpoint](#authorization-endpoint)
2. [Token Endpoint](#token-endpoint)
3. [Userinfo Endpoint](#userinfo-endpoint)
4. [Introspection Endpoint](#introspection-endpoint)
5. [Revocation Endpoint](#revocation-endpoint)
6. [OpenID Discovery](#openid-discovery)
7. [JWKS Endpoint](#jwks-endpoint)
8. [Error Responses](#error-responses)
9. [Rate Limiting](#rate-limiting)

---

## Authorization Endpoint

Initiates the OAuth 2.0 authorization flow.

### Endpoint

```
GET /oauth-provider/authorize
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `client_id` | string | Yes | OAuth client identifier |
| `redirect_uri` | string | Yes | Callback URL (must be whitelisted) |
| `response_type` | string | Yes | Must be `code` |
| `scope` | string | Yes | Space-separated list of scopes |
| `state` | string | Yes | CSRF protection token |
| `code_challenge` | string | No | PKCE code challenge (base64url) |
| `code_challenge_method` | string | No | Must be `S256` |
| `nonce` | string | No | OpenID Connect nonce |
| `prompt` | string | No | `none`, `login`, `consent`, `select_account` |

### Example Request

```http
GET /oauth-provider/authorize?
  client_id=client_abc123&
  redirect_uri=https://myapp.com/callback&
  response_type=code&
  scope=openid%20profile%20email&
  state=random_state_string&
  code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&
  code_challenge_method=S256
  HTTP/1.1
Host: api.truxe.io
```

### Success Response

Redirects user to `redirect_uri` with:

```
https://myapp.com/callback?
  code=auth_code_abc123&
  state=random_state_string
```

### Error Response

Redirects to `redirect_uri` with error:

```
https://myapp.com/callback?
  error=invalid_request&
  error_description=Missing+required+parameter&
  state=random_state_string
```

### Scopes

| Scope | Description |
|-------|-------------|
| `openid` | OpenID Connect authentication |
| `profile` | Basic profile (name, picture) |
| `email` | Email address |
| `offline_access` | Refresh token |

---

## Token Endpoint

Exchanges authorization code for access token or refreshes existing tokens.

### Endpoint

```
POST /oauth-provider/token
```

### Content-Type

```
application/json
```

### Grant Types

#### 1. Authorization Code Grant

Exchange authorization code for tokens.

**Request Body:**

```json
{
  "grant_type": "authorization_code",
  "code": "auth_code_abc123",
  "redirect_uri": "https://myapp.com/callback",
  "client_id": "client_abc123",
  "client_secret": "secret_def456",
  "code_verifier": "pkce_verifier_string"
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `grant_type` | string | Yes | Must be `authorization_code` |
| `code` | string | Yes | Authorization code from /authorize |
| `redirect_uri` | string | Yes | Must match authorization request |
| `client_id` | string | Yes | OAuth client ID |
| `client_secret` | string | Yes* | Client secret (*not required for public clients with PKCE) |
| `code_verifier` | string | No | PKCE verifier (required if challenge was used) |

**Success Response (200 OK):**

```json
{
  "access_token": "at_abc123xyz...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "rt_def456uvw...",
  "scope": "openid profile email",
  "id_token": "eyJhbGci..."
}
```

#### 2. Refresh Token Grant

Get new access token using refresh token.

**Request Body:**

```json
{
  "grant_type": "refresh_token",
  "refresh_token": "rt_def456uvw...",
  "client_id": "client_abc123",
  "client_secret": "secret_def456"
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `grant_type` | string | Yes | Must be `refresh_token` |
| `refresh_token` | string | Yes | Refresh token from previous response |
| `client_id` | string | Yes | OAuth client ID |
| `client_secret` | string | Yes | Client secret |
| `scope` | string | No | Requested scope (must be subset of original) |

**Success Response (200 OK):**

```json
{
  "access_token": "at_new123...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "rt_new456...",
  "scope": "openid profile email"
}
```

#### 3. Client Credentials Grant

Machine-to-machine authentication.

**Request Body:**

```json
{
  "grant_type": "client_credentials",
  "client_id": "client_abc123",
  "client_secret": "secret_def456",
  "scope": "api:read api:write"
}
```

**Success Response (200 OK):**

```json
{
  "access_token": "at_m2m123...",
  "token_type": "Bearer",
  "expires_in": 7200,
  "scope": "api:read api:write"
}
```

### Error Response (400 Bad Request)

```json
{
  "error": "invalid_grant",
  "error_description": "Authorization code has expired"
}
```

### Common Errors

| Error Code | Description |
|------------|-------------|
| `invalid_request` | Missing or invalid parameters |
| `invalid_client` | Invalid client credentials |
| `invalid_grant` | Invalid/expired code or refresh token |
| `unauthorized_client` | Client not authorized for grant type |
| `unsupported_grant_type` | Grant type not supported |

---

## Userinfo Endpoint

Returns information about the authenticated user (OpenID Connect).

### Endpoint

```
GET /oauth-provider/userinfo
```

### Authentication

```
Authorization: Bearer {access_token}
```

### Example Request

```http
GET /oauth-provider/userinfo HTTP/1.1
Host: api.truxe.io
Authorization: Bearer at_abc123xyz...
```

### Success Response (200 OK)

```json
{
  "sub": "user_123456",
  "email": "user@example.com",
  "email_verified": true,
  "name": "John Doe",
  "given_name": "John",
  "family_name": "Doe",
  "picture": "https://cdn.truxe.io/avatars/user_123456.jpg",
  "updated_at": 1699564800
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `sub` | string | Unique user identifier (subject) |
| `email` | string | User email address |
| `email_verified` | boolean | Whether email is verified |
| `name` | string | Full name |
| `given_name` | string | First name |
| `family_name` | string | Last name |
| `picture` | string | Profile picture URL |
| `updated_at` | number | Last profile update timestamp |

### Error Response (401 Unauthorized)

```json
{
  "error": "invalid_token",
  "error_description": "Access token is invalid or expired"
}
```

---

## Introspection Endpoint

Validates and returns information about a token (RFC 7662).

### Endpoint

```
POST /oauth-provider/introspect
```

### Content-Type

```
application/json
```

### Request Body

```json
{
  "token": "at_abc123xyz...",
  "token_type_hint": "access_token",
  "client_id": "client_abc123",
  "client_secret": "secret_def456"
}
```

### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `token` | string | Yes | Token to introspect |
| `token_type_hint` | string | No | `access_token` or `refresh_token` |
| `client_id` | string | Yes | OAuth client ID |
| `client_secret` | string | Yes | Client secret |

### Success Response - Active Token (200 OK)

```json
{
  "active": true,
  "client_id": "client_abc123",
  "token_type": "Bearer",
  "exp": 1699999999,
  "iat": 1699996399,
  "nbf": 1699996399,
  "sub": "user_123456",
  "scope": "openid profile email",
  "jti": "token_id_abc123"
}
```

### Success Response - Inactive Token (200 OK)

```json
{
  "active": false
}
```

### Response Fields (Active Token)

| Field | Type | Description |
|-------|------|-------------|
| `active` | boolean | Whether token is active |
| `client_id` | string | Client that requested the token |
| `token_type` | string | Token type (usually "Bearer") |
| `exp` | number | Expiration timestamp |
| `iat` | number | Issued at timestamp |
| `nbf` | number | Not before timestamp |
| `sub` | string | Subject (user ID) |
| `scope` | string | Granted scopes |
| `jti` | string | JWT ID (token identifier) |

---

## Revocation Endpoint

Revokes an access or refresh token (RFC 7009).

### Endpoint

```
POST /oauth-provider/revoke
```

### Content-Type

```
application/json
```

### Request Body

```json
{
  "token": "at_abc123xyz...",
  "token_type_hint": "access_token",
  "client_id": "client_abc123",
  "client_secret": "secret_def456"
}
```

### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `token` | string | Yes | Token to revoke |
| `token_type_hint` | string | No | `access_token` or `refresh_token` |
| `client_id` | string | Yes | OAuth client ID |
| `client_secret` | string | Yes | Client secret |

### Success Response (200 OK)

```json
{
  "revoked": true
}
```

**Note:** The endpoint returns 200 OK even if the token was already revoked or invalid (per RFC 7009).

---

## OpenID Discovery

OpenID Connect discovery document (RFC 8414).

### Endpoint

```
GET /.well-known/openid-configuration
```

### Example Response

```json
{
  "issuer": "https://api.truxe.io",
  "authorization_endpoint": "https://api.truxe.io/oauth-provider/authorize",
  "token_endpoint": "https://api.truxe.io/oauth-provider/token",
  "userinfo_endpoint": "https://api.truxe.io/oauth-provider/userinfo",
  "jwks_uri": "https://api.truxe.io/.well-known/jwks.json",
  "introspection_endpoint": "https://api.truxe.io/oauth-provider/introspect",
  "revocation_endpoint": "https://api.truxe.io/oauth-provider/revoke",
  "response_types_supported": ["code"],
  "grant_types_supported": [
    "authorization_code",
    "refresh_token",
    "client_credentials"
  ],
  "subject_types_supported": ["public"],
  "id_token_signing_alg_values_supported": ["RS256"],
  "scopes_supported": [
    "openid",
    "profile",
    "email",
    "offline_access"
  ],
  "token_endpoint_auth_methods_supported": [
    "client_secret_post",
    "client_secret_basic"
  ],
  "claims_supported": [
    "sub",
    "email",
    "email_verified",
    "name",
    "given_name",
    "family_name",
    "picture",
    "updated_at"
  ],
  "code_challenge_methods_supported": ["S256"]
}
```

---

## JWKS Endpoint

JSON Web Key Set for token verification.

### Endpoint

```
GET /.well-known/jwks.json
```

### Example Response

```json
{
  "keys": [
    {
      "kty": "RSA",
      "kid": "truxe-rsa-2024",
      "use": "sig",
      "alg": "RS256",
      "n": "xGOr-H7A...",
      "e": "AQAB"
    }
  ]
}
```

---

## Error Responses

All error responses follow RFC 6749 format.

### Standard Error Format

```json
{
  "error": "error_code",
  "error_description": "Human-readable error description",
  "error_uri": "https://docs.truxe.io/errors/error_code"
}
```

### Common Error Codes

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `invalid_request` | 400 | Missing/invalid parameters |
| `invalid_client` | 401 | Invalid client credentials |
| `invalid_grant` | 400 | Invalid/expired authorization code |
| `unauthorized_client` | 400 | Client not authorized |
| `unsupported_grant_type` | 400 | Grant type not supported |
| `invalid_scope` | 400 | Invalid or unknown scope |
| `access_denied` | 403 | User denied authorization |
| `server_error` | 500 | Internal server error |
| `temporarily_unavailable` | 503 | Service temporarily unavailable |

---

## Rate Limiting

Truxe implements rate limiting to prevent abuse.

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1699999999
```

### Rate Limits by Endpoint

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/authorize` | 60 requests | per hour per IP |
| `/token` | 30 requests | per hour per client |
| `/userinfo` | 300 requests | per hour per token |
| `/introspect` | 600 requests | per hour per client |
| `/revoke` | 100 requests | per hour per client |

### Rate Limit Exceeded (429 Too Many Requests)

```json
{
  "error": "rate_limit_exceeded",
  "error_description": "Too many requests. Please try again later.",
  "retry_after": 3600
}
```

---

## CORS Support

Truxe OAuth endpoints support CORS for browser-based applications.

### Allowed Origins

Configure allowed origins in your OAuth client settings.

### CORS Headers

```http
Access-Control-Allow-Origin: https://myapp.com
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type
Access-Control-Max-Age: 86400
```

---

## Additional Resources

- [OAuth 2.0 RFC 6749](https://tools.ietf.org/html/rfc6749)
- [PKCE RFC 7636](https://tools.ietf.org/html/rfc7636)
- [Token Introspection RFC 7662](https://tools.ietf.org/html/rfc7662)
- [Token Revocation RFC 7009](https://tools.ietf.org/html/rfc7009)
- [OpenID Connect Core](https://openid.net/specs/openid-connect-core-1_0.html)
- [OAuth 2.0 Discovery RFC 8414](https://tools.ietf.org/html/rfc8414)

---

**Last Updated:** 2025-11-06
**Version:** 1.0