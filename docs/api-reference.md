# Truxe API Reference

**Production API URL:** `https://api.truxe.io`

**Version:** 1.0.0
**Authentication:** Magic Link (Passwordless)
**Token Type:** JWT (RS256)

---

## 🎯 Overview

Truxe is a production-ready authentication API that provides:
- **Passwordless Authentication** via magic links (email-based)
- **JWT Tokens** with RS256 signature
- **Session Management** with automatic revocation
- **Organization Support** for multi-tenant applications
- **OpenID Connect** compatible

**Important:** Truxe does NOT support traditional email/password authentication. Only magic link authentication is available.

---

## 📡 Base Endpoints

### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-28T14:21:41.330Z",
  "version": "1.0.0",
  "environment": "production",
  "services": {
    "database": { "status": "healthy" },
    "redis": { "status": "healthy" },
    "jwt": { "status": "healthy" },
    "email": { "status": "healthy" }
  }
}
```

### Version Info
```http
GET /version
```

**Response:**
```json
{
  "version": "1.0.0",
  "apiVersion": "v1",
  "environment": "production"
}
```

### OpenID Configuration
```http
GET /.well-known/openid-configuration
```

Returns OpenID Connect discovery document.

### JWKS (Public Keys)
```http
GET /.well-known/jwks.json
```

Returns JSON Web Key Set for token verification.

---

## 🔐 Authentication Endpoints

### 1. Request Magic Link

Send a magic link to user's email for passwordless authentication.

```http
POST /auth/magic-link
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Magic link sent to your email"
}
```

**Error Response (400):**
```json
{
  "error": "Bad Request",
  "message": "Email is required"
}
```

**Notes:**
- Magic link is valid for 15 minutes
- User will receive an email with a link containing a token
- Link format: `{your-app-url}/auth/verify?token=xxx`

---

### 2. Verify Magic Link

Verify the magic link token and obtain JWT tokens.

```http
GET /auth/verify?token=TOKEN_FROM_EMAIL
```

**Query Parameters:**
- `token` (required): The token from the magic link email

**Success Response (200):**
```json
{
  "success": true,
  "user": {
    "id": "usr_123abc",
    "email": "user@example.com",
    "emailVerified": true,
    "createdAt": "2025-10-28T10:00:00Z"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600
  }
}
```

**Error Response (401):**
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired magic link token"
}
```

**Token Claims:**
```json
{
  "sub": "usr_123abc",
  "email": "user@example.com",
  "session_id": "ses_456def",
  "iat": 1698504000,
  "exp": 1698507600,
  "iss": "https://api.truxe.io",
  "aud": "truxe-api"
}
```

---

### 3. Get Current User

Get authenticated user information.

```http
GET /auth/me
Authorization: Bearer {accessToken}
```

**Success Response (200):**
```json
{
  "id": "usr_123abc",
  "email": "user@example.com",
  "emailVerified": true,
  "createdAt": "2025-10-28T10:00:00Z",
  "lastLoginAt": "2025-10-28T14:00:00Z"
}
```

**Error Response (401):**
```json
{
  "error": "Unauthorized",
  "message": "Access token is required"
}
```

or

```json
{
  "error": "Unauthorized",
  "message": "Invalid access token",
  "code": "INVALID_TOKEN"
}
```

---

### 4. Refresh Access Token

Exchange refresh token for a new access token.

```http
POST /auth/refresh
Content-Type: application/json
```

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Success Response (200):**
```json
{
  "success": true,
  "tokens": {
    "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600
  }
}
```

**Error Response (401):**
```json
{
  "error": "Unauthorized",
  "message": "Refresh token is required",
  "code": "REFRESH_TOKEN_MISSING"
}
```

or

```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired refresh token"
}
```

**Notes:**
- Access tokens expire in 1 hour
- Refresh tokens expire in 30 days
- Refresh tokens are rotated on each use for security

---

### 5. Logout

Revoke current session and tokens.

```http
POST /auth/logout
Authorization: Bearer {accessToken}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

**Error Response (401):**
```json
{
  "error": "Unauthorized",
  "message": "Access token is required"
}
```

---

### 6. Revoke Session

Revoke a specific session (similar to logout).

```http
POST /auth/revoke
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request Body:**
```json
{
  "sessionId": "ses_456def"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Session revoked successfully"
}
```

---

## 🏢 Organization Endpoints

### 1. List Organizations

Get all organizations the user belongs to.

```http
GET /auth/organizations
Authorization: Bearer {accessToken}
```

**Success Response (200):**
```json
{
  "organizations": [
    {
      "id": "org_789ghi",
      "name": "My Company",
      "role": "admin",
      "createdAt": "2025-10-28T10:00:00Z"
    },
    {
      "id": "org_012jkl",
      "name": "Another Org",
      "role": "member",
      "createdAt": "2025-10-28T11:00:00Z"
    }
  ]
}
```

---

### 2. Switch Organization

Switch the current organization context.

```http
POST /auth/switch-org
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request Body:**
```json
{
  "organizationId": "org_789ghi"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Organization switched successfully",
  "organization": {
    "id": "org_789ghi",
    "name": "My Company",
    "role": "admin"
  }
}
```

---

## 🔒 Security Best Practices

### 1. Token Storage

**✅ Recommended:**
- Store tokens in httpOnly cookies (most secure)
- Or use localStorage with XSS protection

**❌ Never:**
- Store tokens in URLs
- Log tokens in console
- Send tokens in query parameters

### 2. Token Refresh

Implement automatic token refresh before expiration:

```javascript
// Refresh 5 minutes before expiry
const expiresIn = tokens.expiresIn * 1000
const refreshBefore = 5 * 60 * 1000

setTimeout(() => {
  refreshAccessToken()
}, expiresIn - refreshBefore)
```

### 3. Error Handling

Always handle these error codes:
- `TOKEN_EXPIRED` - Refresh the token
- `INVALID_TOKEN` - Redirect to login
- `REFRESH_TOKEN_MISSING` - Redirect to login

### 4. HTTPS Only

Always use HTTPS in production:
- API: `https://api.truxe.io`
- Never use HTTP for authentication

---

## 📊 Response Codes

| Code | Description |
|------|-------------|
| 200  | Success |
| 400  | Bad Request (missing/invalid parameters) |
| 401  | Unauthorized (invalid/expired token) |
| 403  | Forbidden (insufficient permissions) |
| 404  | Not Found |
| 500  | Internal Server Error |

---

## 🔧 Rate Limiting

- Magic link requests: 5 per 15 minutes per email
- Token refresh: 10 per minute per user
- Login attempts: Unlimited (passwordless)

---

## 🆘 Support

- **API URL:** https://api.truxe.io
- **Health Check:** https://api.truxe.io/health
- **Repository:** https://github.com/truxeio/truxe

---

## 📝 Notes

1. **No Password Authentication**: Truxe ONLY supports magic link authentication. There are NO `/auth/register` or `/auth/login` endpoints with password.

2. **Email Service**: Magic links require a configured email service (Brevo). Contact your API administrator if magic links aren't working.

3. **Token Verification**: Use the JWKS endpoint to verify tokens in your application without calling the API.

4. **Session Management**: Sessions are automatically managed. Logout or token revocation will invalidate all tokens from that session.
