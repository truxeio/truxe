# Truxe OAuth 2.0 - React SPA Example

Production-ready React Single Page Application with OAuth 2.0 + PKCE integration.

## Features

✅ **OAuth 2.0 Authorization Code Flow with PKCE**
✅ **In-memory token storage** (most secure for SPAs)
✅ **Automatic token refresh** before expiration
✅ **TypeScript** for type safety
✅ **React Router** for navigation
✅ **Protected routes** with authentication
✅ **useAuth hook** for easy integration
✅ **State parameter** for CSRF protection
✅ **Modern React 18** with hooks

## Prerequisites

- Node.js 18+
- Truxe OAuth client credentials (public client, no secret needed)
- Registered redirect URI: `http://localhost:5173/callback`

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
VITE_TRUXE_URL=https://api.truxe.io
VITE_OAUTH_CLIENT_ID=your_public_client_id_here
VITE_OAUTH_REDIRECT_URI=http://localhost:5173/callback
```

**Note:** This is a **public client** (SPA) so no client_secret is needed. PKCE provides security.

### 3. Start Development Server

```bash
npm run dev
```

Open http://localhost:5173

### 4. Test OAuth Flow

1. Click "Sign in with Truxe"
2. Authenticate on Truxe
3. Grant permissions
4. Redirected to dashboard with your profile!

## Project Structure

```
src/
├── lib/
│   └── oauth-client.ts       # OAuth client with PKCE (315 lines)
├── hooks/
│   └── useAuth.tsx           # Authentication hook (75 lines)
├── components/
│   └── ProtectedRoute.tsx    # Route guard component
├── pages/
│   ├── LoginPage.tsx         # Login page
│   ├── CallbackPage.tsx      # OAuth callback handler
│   └── DashboardPage.tsx     # Protected dashboard
├── App.tsx                   # Main app with routing
└── main.tsx                  # Entry point
```

## Usage

### Authentication Hook

```typescript
import { useAuth } from './hooks/useAuth';

function MyComponent() {
  const { user, isAuthenticated, login, logout, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  if (!isAuthenticated) {
    return <button onClick={login}>Sign In</button>;
  }

  return (
    <div>
      <p>Welcome, {user.name}!</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

### Protected Routes

```typescript
import { ProtectedRoute } from './components/ProtectedRoute';

<Route
  path="/dashboard"
  element={
    <ProtectedRoute>
      <DashboardPage />
    </ProtectedRoute>
  }
/>
```

### OAuth Client API

```typescript
import { getOAuthClient } from './lib/oauth-client';

const client = getOAuthClient();

// Initiate login
client.login();

// Handle callback
await client.handleCallback();

// Get user info
const user = await client.getUserInfo();

// Check authentication
const isAuth = client.isAuthenticated();

// Logout
await client.logout();

// Get access token (auto-refreshes if expired)
const token = await client.getAccessToken();
```

## Security Features

### 1. PKCE (Proof Key for Code Exchange)

PKCE protects against code interception attacks, crucial for public clients:

```typescript
// Generate code verifier and challenge
const codeVerifier = generateCodeVerifier();
const codeChallenge = await sha256(codeVerifier);

// Send challenge in authorization request
authUrl.searchParams.set('code_challenge', codeChallenge);
authUrl.searchParams.set('code_challenge_method', 'S256');

// Send verifier in token exchange
body.code_verifier = codeVerifier;
```

### 2. In-Memory Token Storage

Tokens stored in memory (not localStorage) to prevent XSS attacks:

```typescript
class TruxeOAuthClient {
  private tokens: OAuthTokens | null = null;  // In-memory only
  private tokenExpiresAt: number | null = null;
}
```

**Trade-off:** Tokens lost on page refresh (user must re-authenticate). This is a security best practice for SPAs.

**Alternative:** If you need persistence, use sessionStorage (better than localStorage):
```typescript
sessionStorage.setItem('tokens', JSON.stringify(tokens));
```

### 3. State Parameter

CSRF protection via state parameter:

```typescript
const state = generateRandomString(32);
sessionStorage.setItem('oauth_state', state);

// Validate on callback
if (receivedState !== expectedState) {
  throw new Error('CSRF attack detected');
}
```

### 4. Automatic Token Refresh

Tokens refresh 5 minutes before expiration:

```typescript
private isTokenExpired(): boolean {
  const buffer = 5 * 60 * 1000; // 5 minutes
  return Date.now() >= (this.tokenExpiresAt - buffer);
}

private async getValidAccessToken(): Promise<string> {
  if (this.isTokenExpired()) {
    const tokens = await this.refreshAccessToken();
    this.setTokens(tokens);
  }
  return this.tokens.access_token;
}
```

## Building for Production

### 1. Build

```bash
npm run build
```

### 2. Preview Production Build

```bash
npm run preview
```

### 3. Deploy

Deploy the `dist/` folder to your hosting provider (Vercel, Netlify, AWS S3, etc.)

**Important:**
- Update `VITE_OAUTH_REDIRECT_URI` to your production URL
- Register production redirect URI in Truxe
- Ensure HTTPS in production (required for OAuth)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_TRUXE_URL` | Yes | Truxe API base URL |
| `VITE_OAUTH_CLIENT_ID` | Yes | Public OAuth client ID |
| `VITE_OAUTH_REDIRECT_URI` | Yes | OAuth callback URL |

**Note:** Vite exposes only variables prefixed with `VITE_` to the browser.

## Troubleshooting

### Tokens lost on page refresh

**Cause:** In-memory storage doesn't persist

**Solutions:**
1. Accept this (best security practice)
2. Use sessionStorage for persistence (less secure but better UX)
3. Implement "remember me" with refresh token in httpOnly cookie (requires backend)

### CORS errors

**Cause:** Truxe API blocking cross-origin requests

**Solution:**
- Ensure your origin is whitelisted in Truxe CORS config
- Use `credentials: 'include'` if using cookies

### "Invalid redirect_uri"

**Cause:** Redirect URI mismatch

**Solution:**
- Ensure `VITE_OAUTH_REDIRECT_URI` exactly matches registered URI
- Include protocol, port, and path
- Register `http://localhost:5173/callback` for development

### Code challenge verification failed

**Cause:** PKCE implementation issue

**Solution:**
- Ensure code_verifier stored in sessionStorage before redirect
- Verify SHA-256 hashing works in browser
- Check base64url encoding (not base64)

## Best Practices Implemented

✅ **PKCE for public clients** (no client secret)
✅ **In-memory token storage** (XSS protection)
✅ **State parameter** (CSRF protection)
✅ **Automatic token refresh** (UX improvement)
✅ **TypeScript** (type safety)
✅ **Error handling** with user-friendly messages
✅ **Loading states** for async operations
✅ **Protected routes** pattern
✅ **Centralized OAuth logic** (single OAuth client)
✅ **React Context** for global auth state

## Testing

### Manual Testing

1. Start dev server: `npm run dev`
2. Open http://localhost:5173
3. Test flow:
   - Redirects to login when accessing `/dashboard`
   - Click "Sign in with Truxe"
   - Complete OAuth flow
   - See dashboard with profile
   - Logout works correctly
4. Test refresh:
   - Wait for token to near expiration
   - Navigate between pages
   - Should auto-refresh transparently

### Testing with DevTools

```javascript
// In browser console
import { getOAuthClient } from './lib/oauth-client';

const client = getOAuthClient();

// Check auth status
console.log(client.isAuthenticated());

// Get tokens
console.log(client.getTokens());

// Get user info
client.getUserInfo().then(console.log);
```

## Production Deployment

### Vercel

```bash
npm run build
vercel --prod
```

### Netlify

```bash
npm run build
netlify deploy --prod --dir=dist
```

### Docker

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## Additional Resources

- [OAuth 2.0 for Browser-Based Apps (RFC)](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps)
- [PKCE RFC 7636](https://tools.ietf.org/html/rfc7636)
- [React Router Documentation](https://reactrouter.com/)
- [Vite Documentation](https://vitejs.dev/)

## License

MIT