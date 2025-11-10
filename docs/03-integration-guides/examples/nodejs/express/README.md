# Truxe OAuth 2.0 - Express.js Example

Complete, production-ready Express.js application demonstrating OAuth 2.0 integration with Truxe.

## Features

✅ **OAuth 2.0 Authorization Code Flow**
✅ **PKCE (Proof Key for Code Exchange)** support
✅ **State parameter** for CSRF protection
✅ **Automatic token refresh** when expired
✅ **Secure session management** with HTTP-only cookies
✅ **Protected routes** with authentication middleware
✅ **Token revocation** on logout
✅ **Rate limiting** for auth endpoints
✅ **Error handling** with user-friendly messages
✅ **User profile** fetching and display

## Prerequisites

- Node.js 18+ installed
- Truxe OAuth client credentials (client_id and client_secret)
- A registered redirect URI in Truxe: `http://localhost:3000/auth/callback`

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and fill in your credentials:

```env
TRUXE_URL=https://api.truxe.io
OAUTH_CLIENT_ID=your_client_id_here
OAUTH_CLIENT_SECRET=your_client_secret_here
OAUTH_REDIRECT_URI=http://localhost:3000/auth/callback

PORT=3000
NODE_ENV=development

SESSION_SECRET=generate_a_secure_random_string_here

USE_PKCE=true
```

**Important:** Generate a secure `SESSION_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Start the Server

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

### 4. Test the OAuth Flow

1. Open your browser to http://localhost:3000
2. Click "Sign in with Truxe"
3. Log in to Truxe (if not already logged in)
4. Grant permission on the consent screen
5. You'll be redirected back to the app
6. See your profile on the dashboard!

## Project Structure

```
.
├── server.js              # Main Express application
├── oauth-client.js        # OAuth client utility class
├── middleware/
│   └── auth.js           # Authentication middleware
├── routes/
│   └── auth.js           # OAuth routes (/login, /callback, /logout)
├── package.json          # Dependencies
├── .env.example          # Environment variables template
└── README.md             # This file
```

## Routes

### Public Routes

- `GET /` - Home page
- `GET /error` - Error page with error message

### Authentication Routes

- `GET /auth/login` - Initiates OAuth flow
- `GET /auth/callback` - OAuth callback handler
- `GET /auth/logout` - Logout and revoke tokens
- `POST /auth/refresh` - Manually refresh tokens (AJAX)
- `GET /auth/user` - Get current user info (AJAX)

### Protected Routes

- `GET /dashboard` - Protected dashboard (requires authentication)
- `GET /api/protected` - Example protected API endpoint

## OAuth Client Usage

The `TruxeOAuthClient` class provides helper methods:

```javascript
const TruxeOAuthClient = require('./oauth-client');

const client = new TruxeOAuthClient({
  truxeUrl: 'https://api.truxe.io',
  clientId: 'your_client_id',
  clientSecret: 'your_client_secret',
  redirectUri: 'http://localhost:3000/auth/callback',
  scopes: ['openid', 'profile', 'email'],
  usePKCE: true
});

// Generate authorization URL
const { url, state, codeVerifier } = client.generateAuthorizationUrl();

// Exchange code for tokens
const tokens = await client.exchangeCodeForToken(code, codeVerifier);

// Refresh access token
const newTokens = await client.refreshAccessToken(refreshToken);

// Get user info
const user = await client.getUserInfo(accessToken);

// Introspect token (validate)
const introspection = await client.introspectToken(accessToken);

// Revoke token
await client.revokeToken(accessToken);
```

## Middleware Usage

### Require Authentication

Protects routes, redirects to login if not authenticated, auto-refreshes expired tokens:

```javascript
const { requireAuth } = require('./middleware/auth');

app.get('/protected', requireAuth, (req, res) => {
  res.send('This route requires authentication!');
});
```

### Attach User Info

Fetches and attaches user info to `req.user`:

```javascript
const { requireAuth, attachUser } = require('./middleware/auth');

app.get('/dashboard', requireAuth, attachUser, (req, res) => {
  console.log(req.user.email); // user@example.com
  res.send(`Welcome, ${req.user.name}!`);
});
```

### Check Auth Status

Sets `req.isAuthenticated` boolean without redirecting:

```javascript
const { checkAuth } = require('./middleware/auth');

app.use(checkAuth);

app.get('/', (req, res) => {
  if (req.isAuthenticated) {
    res.send('You are logged in!');
  } else {
    res.send('You are not logged in');
  }
});
```

## Security Best Practices

This example implements several security best practices:

### 1. State Parameter (CSRF Protection)

```javascript
// Generate and store state
const { url, state } = client.generateAuthorizationUrl();
req.session.oauth_state = state;

// Validate state on callback
if (req.query.state !== req.session.oauth_state) {
  throw new Error('CSRF attack detected');
}
```

### 2. PKCE (Code Interception Prevention)

```javascript
// Generate code verifier and challenge
const codeVerifier = client.generateCodeVerifier();
const codeChallenge = client.generateCodeChallenge(codeVerifier);

// Store verifier, send challenge in authorization request
req.session.code_verifier = codeVerifier;

// Send verifier when exchanging code
await client.exchangeCodeForToken(code, codeVerifier);
```

### 3. Secure Session Configuration

```javascript
session({
  secret: process.env.SESSION_SECRET,
  cookie: {
    secure: true,      // HTTPS only (production)
    httpOnly: true,    // No JavaScript access
    sameSite: 'lax',   // CSRF protection
    maxAge: 86400000   // 24 hours
  }
})
```

### 4. Rate Limiting

```javascript
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10                    // 10 requests per window
});

app.use('/auth', authLimiter);
```

### 5. Token Refresh Before Expiry

```javascript
// Check if token expires within 5 minutes
if (client.isTokenExpired(expiresAt)) {
  await refreshAccessToken();
}
```

## Error Handling

The example includes comprehensive error handling:

```javascript
try {
  const tokens = await client.exchangeCodeForToken(code);
} catch (error) {
  // error.code: OAuth error code (e.g., 'invalid_grant')
  // error.message: Human-readable error description
  // error.status: HTTP status code
  console.error('OAuth error:', error.message);
  res.redirect(`/error?message=${encodeURIComponent(error.message)}`);
}
```

## Testing

### Manual Testing

1. Start the server: `npm start`
2. Open http://localhost:3000
3. Test the OAuth flow:
   - Click "Sign in with Truxe"
   - Complete authentication
   - Verify you're redirected to dashboard
   - Check user profile is displayed
4. Test protected routes:
   - Try accessing `/dashboard` while logged out (should redirect to login)
   - Try accessing `/dashboard` while logged in (should work)
5. Test token refresh:
   - Wait for token to expire or manually set expiry in the past
   - Make a request to a protected route
   - Should automatically refresh token
6. Test logout:
   - Click "Logout"
   - Verify session is cleared
   - Verify you're redirected to home page

### Testing with cURL

```bash
# Test protected API endpoint (should fail - not authenticated)
curl http://localhost:3000/api/protected

# After logging in via browser, export your session cookie:
# (Get session cookie from browser DevTools)
curl http://localhost:3000/api/protected \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE"

# Test token refresh endpoint
curl -X POST http://localhost:3000/auth/refresh \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE"
```

## Deployment

### Production Checklist

Before deploying to production:

- [ ] Set `NODE_ENV=production`
- [ ] Use HTTPS (required for OAuth)
- [ ] Generate secure `SESSION_SECRET`
- [ ] Update `OAUTH_REDIRECT_URI` to production URL
- [ ] Register production redirect URI in Truxe
- [ ] Enable `secure: true` for session cookies
- [ ] Set up proper logging (e.g., Winston, Pino)
- [ ] Configure rate limiting appropriately
- [ ] Set up monitoring and alerts
- [ ] Test OAuth flow end-to-end

### Environment Variables (Production)

```env
TRUXE_URL=https://api.truxe.io
OAUTH_CLIENT_ID=prod_client_id
OAUTH_CLIENT_SECRET=prod_client_secret
OAUTH_REDIRECT_URI=https://yourapp.com/auth/callback

PORT=3000
NODE_ENV=production

SESSION_SECRET=very_secure_random_string_generated_with_crypto

USE_PKCE=true
```

### Example Deployment (Docker)

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
```

## Troubleshooting

### "Invalid state parameter" error

**Cause:** State mismatch (potential CSRF attack or session issue)

**Solution:**
- Ensure cookies are enabled in your browser
- Check that session middleware is configured correctly
- Verify `SESSION_SECRET` is set

### "Token exchange failed: invalid_grant"

**Causes:**
- Authorization code already used (codes are single-use)
- Authorization code expired (10-minute lifetime)
- PKCE verifier mismatch

**Solutions:**
- Start the OAuth flow again to get a new code
- Ensure code_verifier is stored and retrieved correctly
- Check that code_challenge is generated correctly

### "redirect_uri_mismatch" error

**Cause:** Redirect URI doesn't match what's registered in Truxe

**Solution:**
- Verify `OAUTH_REDIRECT_URI` in `.env` matches exactly (including protocol, port, path)
- Add the redirect URI to your OAuth client's whitelist in Truxe

### Session not persisting

**Cause:** Cookies blocked or session configuration issue

**Solutions:**
- Check browser console for cookie errors
- Ensure `sameSite: 'lax'` is compatible with your setup
- In development, `secure: false` (HTTPS not required)
- In production, `secure: true` (HTTPS required)

### Token refresh failing

**Causes:**
- Refresh token expired (typically 30 days)
- Refresh token revoked

**Solution:**
- User must re-authenticate by going through OAuth flow again

## Additional Resources

- [Truxe OAuth Provider Guide](../../OAUTH_PROVIDER_GUIDE.md)
- [OAuth 2.0 RFC 6749](https://tools.ietf.org/html/rfc6749)
- [PKCE RFC 7636](https://tools.ietf.org/html/rfc7636)
- [Express.js Documentation](https://expressjs.com/)

## Support

- GitHub Issues: https://github.com/yourusername/truxe/issues
- Documentation: https://docs.truxe.io
- Discord: https://discord.gg/truxe

## License

MIT