# Truxe API Reference

Complete API documentation for the Truxe Authentication Platform with interactive examples and comprehensive endpoint coverage.

## 🚀 Base URL & Authentication

### Production
```
https://auth.yourapp.com
```

### Development
```
http://localhost:3001
```

### Authentication Methods

#### Bearer Token (Recommended)
```http
Authorization: Bearer <access_token>
```

#### HTTP-Only Cookie
```http
Cookie: truxe_access_token=<access_token>
```

---

## 📡 Authentication Endpoints

### POST /auth/magic-link
Request a passwordless magic link for authentication.

#### Request
```http
POST /auth/magic-link
Content-Type: application/json

{
  "email": "user@example.com",
  "organizationSlug": "acme-corp",
  "redirectUrl": "https://yourapp.com/dashboard",
  "metadata": {
    "source": "web_app",
    "campaign": "signup_flow"
  }
}
```

#### Response
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "message": "Magic link sent to user@example.com",
  "challengeId": "550e8400-e29b-41d4-a716-446655440000",
  "expiresAt": "2024-01-15T10:45:00Z",
  "rateLimitRemaining": 4,
  "rateLimitReset": "2024-01-15T10:31:00Z"
}
```

#### Rate Limits
- **5 requests per minute** per IP address
- **3 requests per hour** per email address
- **1000 requests per minute** globally

#### Error Responses
```http
HTTP/1.1 429 Too Many Requests
{
  "error": "Rate limit exceeded",
  "retryAfter": 60,
  "limit": 5,
  "remaining": 0
}

HTTP/1.1 400 Bad Request
{
  "error": "Invalid email format",
  "field": "email"
}
```

---

### GET /auth/verify
Verify a magic link token and authenticate the user.

#### Request
```http
GET /auth/verify?token=<magic_link_token>&redirect=https://yourapp.com/dashboard
```

#### Success Response
```http
HTTP/1.1 200 OK
Set-Cookie: truxe_access_token=<jwt>; HttpOnly; Secure; SameSite=Strict
Set-Cookie: truxe_refresh_token=<refresh_jwt>; HttpOnly; Secure; SameSite=Strict
Content-Type: application/json

{
  "success": true,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "emailVerified": true,
    "metadata": {},
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "organization": {
    "id": "org-uuid",
    "name": "Acme Corp",
    "slug": "acme-corp",
    "role": "member"
  },
  "tokens": {
    "accessToken": "<jwt_access_token>",
    "refreshToken": "<jwt_refresh_token>",
    "expiresAt": "2024-01-15T10:45:00Z"
  },
  "session": {
    "id": "session-jti",
    "deviceInfo": {
      "browser": "Chrome 120.0",
      "os": "macOS 14.0",
      "device": "Desktop"
    },
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

#### Error Responses
```http
HTTP/1.1 400 Bad Request
{
  "error": "Invalid or expired token"
}

HTTP/1.1 410 Gone
{
  "error": "Token already used"
}
```

---

### POST /auth/refresh
Refresh an expired access token using a refresh token.

#### Request
```http
POST /auth/refresh
Content-Type: application/json
Authorization: Bearer <refresh_token>

{
  "refreshToken": "<refresh_token>"
}
```

#### Response
```http
HTTP/1.1 200 OK
Set-Cookie: truxe_access_token=<new_jwt>; HttpOnly; Secure
Set-Cookie: truxe_refresh_token=<new_refresh_jwt>; HttpOnly; Secure

{
  "success": true,
  "tokens": {
    "accessToken": "<new_access_token>",
    "refreshToken": "<new_refresh_token>",
    "expiresAt": "2024-01-15T11:00:00Z"
  },
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "emailVerified": true
  }
}
```

---

### POST /auth/revoke
Revoke a session and invalidate all associated tokens.

#### Request
```http
POST /auth/revoke
Authorization: Bearer <access_token>

{
  "sessionId": "session-jti",
  "reason": "user_logout"
}
```

#### Response
```http
HTTP/1.1 200 OK

{
  "success": true,
  "message": "Session revoked successfully",
  "revokedAt": "2024-01-15T10:30:00Z"
}
```

---

### GET /auth/me
Get current user information and session details.

#### Request
```http
GET /auth/me
Authorization: Bearer <access_token>
```

#### Response
```http
HTTP/1.1 200 OK

{
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "emailVerified": true,
    "metadata": {
      "firstName": "John",
      "lastName": "Doe",
      "avatar": "https://example.com/avatar.jpg"
    },
    "createdAt": "2024-01-10T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  },
  "organization": {
    "id": "org-uuid",
    "name": "Acme Corp",
    "slug": "acme-corp",
    "role": "member",
    "permissions": ["read:dashboard", "write:profile"]
  },
  "session": {
    "id": "session-jti",
    "createdAt": "2024-01-15T10:30:00Z",
    "lastUsedAt": "2024-01-15T10:35:00Z",
    "deviceInfo": {
      "browser": "Chrome 120.0",
      "os": "macOS 14.0",
      "ip": "192.168.1.100"
    }
  }
}
```

---

## 🔑 JWKS & Discovery Endpoints

### GET /.well-known/jwks.json
Get JSON Web Key Set for token verification.

#### Response
```http
HTTP/1.1 200 OK
Cache-Control: public, max-age=3600

{
  "keys": [
    {
      "kty": "RSA",
      "use": "sig",
      "kid": "2024-01-15",
      "alg": "RS256",
      "n": "0vx7agoebGcQSuuPiLJXZptN9nndrQmbPFRP_gHPeE7SuUXaI5_pZmrfBDpfJOmm_rI-R706fMR4gHfvWiOkk_ubuqPiLJXZptN9nndrQmbPFRP_gHPeE7SuUXaI5_pZmrfBDpfJOmm_rI-R706fMR4gHfvWiOkk_ubuqPiLJXZptN9nndrQmbPFRP_gHPeE7SuUXaI5_pZmrfBDpfJOmm_rI-R706fMR4gHfvWiOkk_ubu",
      "e": "AQAB"
    }
  ]
}
```

### GET /.well-known/openid-configuration
OpenID Connect Discovery document.

#### Response
```http
HTTP/1.1 200 OK

{
  "issuer": "https://auth.yourapp.com",
  "authorization_endpoint": "https://auth.yourapp.com/auth/authorize",
  "token_endpoint": "https://auth.yourapp.com/auth/token",
  "userinfo_endpoint": "https://auth.yourapp.com/auth/me",
  "jwks_uri": "https://auth.yourapp.com/.well-known/jwks.json",
  "response_types_supported": ["code", "token", "id_token"],
  "subject_types_supported": ["public"],
  "id_token_signing_alg_values_supported": ["RS256"],
  "scopes_supported": ["openid", "email", "profile"],
  "claims_supported": ["iss", "sub", "aud", "exp", "iat", "email", "email_verified"]
}
```

---

## 🛡️ Security Monitoring Endpoints

### GET /security/dashboard
Get security monitoring dashboard data.

#### Request
```http
GET /security/dashboard?timeRange=24h
Authorization: Bearer <admin_token>
```

#### Response
```http
HTTP/1.1 200 OK

{
  "timeRange": "24h",
  "generatedAt": "2024-01-15T10:30:00Z",
  "sessions": {
    "timeline": [
      {"timestamp": "2024-01-15T09:00:00Z", "count": 45},
      {"timestamp": "2024-01-15T10:00:00Z", "count": 67}
    ],
    "total": 234,
    "revoked": 12
  },
  "securityEvents": [
    {
      "id": "event-uuid",
      "timestamp": "2024-01-15T10:25:00Z",
      "type": "impossible_travel",
      "severity": "high",
      "userId": "user-uuid",
      "details": {
        "previousLocation": "New York, US",
        "currentLocation": "London, UK",
        "timeElapsed": "30 minutes",
        "distance": "3459 km"
      }
    }
  ],
  "topIPs": [
    {"ip": "192.168.1.100", "requests": 1234, "blocked": 5},
    {"ip": "10.0.0.50", "requests": 987, "blocked": 0}
  ],
  "summary": {
    "totalSessions": 234,
    "revokedSessions": 12,
    "uniqueUsers": 89,
    "uniqueIPs": 156
  }
}
```

---

## 🏥 Health & Monitoring

### GET /health
System health check endpoint.

#### Response
```http
HTTP/1.1 200 OK

{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0",
  "services": {
    "database": {
      "status": "healthy",
      "responseTime": 15,
      "connections": {
        "active": 5,
        "idle": 10,
        "total": 15
      }
    },
    "redis": {
      "status": "healthy",
      "responseTime": 2,
      "memory": {
        "used": "45MB",
        "peak": "67MB"
      }
    },
    "email": {
      "status": "healthy",
      "provider": "resend",
      "lastTest": "2024-01-15T10:25:00Z"
    }
  },
  "metrics": {
    "requestsPerSecond": 45.2,
    "averageResponseTime": 125,
    "errorRate": 0.01,
    "uptime": 86400
  }
}
```

---

## 📊 Admin Management Endpoints

### GET /admin/rate-limits/stats
Get comprehensive rate limiting statistics.

#### Request
```http
GET /admin/rate-limits/stats
Authorization: Bearer <admin_token>
```

#### Response
```http
HTTP/1.1 200 OK

{
  "success": true,
  "data": {
    "overview": {
      "totalRequests": 12345,
      "blockedRequests": 67,
      "blockRate": 0.54,
      "topViolatingIPs": ["1.2.3.4", "5.6.7.8"]
    },
    "endpoints": {
      "POST:/auth/magic-link": {
        "requests": 1234,
        "blocked": 23,
        "limits": {
          "perIP": {"max": 5, "window": "1m"},
          "perEmail": {"max": 3, "window": "1h"}
        }
      }
    },
    "plans": {
      "free": {"users": 234, "quotaUsage": 0.67},
      "starter": {"users": 45, "quotaUsage": 0.23},
      "pro": {"users": 12, "quotaUsage": 0.89}
    }
  }
}
```

---

## 🔧 SDK Examples

### JavaScript/TypeScript SDK

#### Installation
```bash
npm install @truxe/sdk
```

#### Basic Usage
```typescript
import { TruxeClient } from '@truxe/sdk';

const truxe = new TruxeClient({
  baseUrl: 'https://auth.yourapp.com',
  apiKey: 'your-api-key' // For server-side usage
});

// Request magic link
const result = await truxe.auth.requestMagicLink({
  email: 'user@example.com',
  organizationSlug: 'acme-corp'
});

// Verify token
const session = await truxe.auth.verifyToken(token);

// Get current user
const user = await truxe.auth.getCurrentUser();
```

### Next.js Integration

#### Middleware
```typescript
// middleware.ts
import { authMiddleware } from '@truxe/nextjs';

export default authMiddleware({
  publicRoutes: ['/'],
  ignoredRoutes: ['/api/webhook']
});
```

#### API Route Protection
```typescript
// pages/api/protected.ts
import { verifyToken } from '@truxe/nextjs';

export default async function handler(req, res) {
  const user = await verifyToken(req);
  
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  res.json({ message: `Hello ${user.email}!` });
}
```

#### React Hooks
```typescript
// components/UserProfile.tsx
import { useAuth, useUser } from '@truxe/react';

export function UserProfile() {
  const { user, isLoading } = useUser();
  const { logout } = useAuth();

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Welcome, {user.email}!</h1>
      <button onClick={() => logout()}>Logout</button>
    </div>
  );
}
```

---

## ⚠️ Error Handling

### Error Response Format
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "validation_failed",
  "message": "The email field is required",
  "details": {
    "field": "email",
    "code": "required",
    "received": null
  },
  "requestId": "req_1234567890",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `validation_failed` | 400 | Request validation failed |
| `rate_limit_exceeded` | 429 | Rate limit exceeded |
| `token_expired` | 401 | JWT token has expired |
| `token_invalid` | 401 | JWT token is invalid |
| `token_revoked` | 401 | JWT token has been revoked |
| `insufficient_permissions` | 403 | User lacks required permissions |
| `resource_not_found` | 404 | Requested resource not found |
| `internal_error` | 500 | Internal server error |

### Rate Limiting Headers
```http
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 4
X-RateLimit-Reset: 1642248660
Retry-After: 60
```

---

## 🧪 Testing & Development

### Development Environment
```bash
# Start development server with hot reload
npm run dev

# Run with debug logging
DEBUG=truxe:* npm run dev

# Test specific endpoint
curl -X POST http://localhost:3001/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

### Testing Utilities
```typescript
// Test helper functions
import { createTestUser, generateMagicLink } from '@truxe/testing';

describe('Authentication', () => {
  it('should authenticate with magic link', async () => {
    const user = await createTestUser({ email: 'test@example.com' });
    const token = await generateMagicLink(user.email);
    
    const response = await request(app)
      .get(`/auth/verify?token=${token}`)
      .expect(200);
      
    expect(response.body.user.email).toBe('test@example.com');
  });
});
```

---

## 📚 Additional Resources

- **[Interactive API Explorer](http://localhost:3001/docs)** - Test API endpoints in browser
- **[OpenAPI Specification](http://localhost:3001/docs/json)** - Download OpenAPI spec
- **[Postman Collection](./postman-collection.json)** - Import into Postman
- **[SDK Documentation](https://docs.truxe.io/sdk)** - Language-specific guides
- **[Integration Examples](https://github.com/truxe-auth/examples)** - Sample applications

---

**Questions?** Join our [Discord community](https://discord.gg/truxe) or check the [troubleshooting guide](./troubleshooting.md).
