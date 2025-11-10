/**
 * Authentication routes for OAuth flow
 */

const express = require('express');
const router = express.Router();
const TruxeOAuthClient = require('../oauth-client');

// Initialize OAuth client
const oauthClient = new TruxeOAuthClient({
  truxeUrl: process.env.TRUXE_URL,
  clientId: process.env.OAUTH_CLIENT_ID,
  clientSecret: process.env.OAUTH_CLIENT_SECRET,
  redirectUri: process.env.OAUTH_REDIRECT_URI,
  scopes: ['openid', 'profile', 'email'],
  usePKCE: process.env.USE_PKCE === 'true'
});

/**
 * GET /auth/login
 * Initiate OAuth authorization flow
 */
router.get('/login', (req, res) => {
  try {
    // Generate authorization URL
    const { url, state, codeVerifier, nonce } = oauthClient.generateAuthorizationUrl();

    // Store state and code_verifier in session for validation
    req.session.oauth_state = state;

    if (codeVerifier) {
      req.session.code_verifier = codeVerifier;
    }

    if (nonce) {
      req.session.oauth_nonce = nonce;
    }

    // Redirect user to Truxe authorization page
    res.redirect(url);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).send('Authentication failed. Please try again.');
  }
});

/**
 * GET /auth/callback
 * Handle OAuth callback from Truxe
 */
router.get('/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  // Handle authorization errors
  if (error) {
    console.error('Authorization error:', error, error_description);
    return res.redirect(`/error?message=${encodeURIComponent(error_description || error)}`);
  }

  // Validate required parameters
  if (!code || !state) {
    return res.status(400).send('Missing required parameters');
  }

  // Validate state parameter (CSRF protection)
  const expectedState = req.session.oauth_state;
  if (state !== expectedState) {
    console.error('State mismatch - potential CSRF attack');
    return res.status(403).send('Invalid state parameter');
  }

  // Clear state from session
  delete req.session.oauth_state;

  try {
    // Get code_verifier if using PKCE
    const codeVerifier = req.session.code_verifier;

    // Exchange authorization code for tokens
    const tokens = await oauthClient.exchangeCodeForToken(code, codeVerifier);

    // Clear code_verifier from session
    if (codeVerifier) {
      delete req.session.code_verifier;
    }

    // Store tokens in session
    req.session.access_token = tokens.access_token;
    req.session.refresh_token = tokens.refresh_token;
    req.session.expires_at = Date.now() + (tokens.expires_in * 1000);
    req.session.token_type = tokens.token_type;
    req.session.scope = tokens.scope;

    // Fetch user info
    const user = await oauthClient.getUserInfo(tokens.access_token);
    req.session.user = user;

    // Redirect to return URL or dashboard
    const returnTo = req.session.returnTo || '/dashboard';
    delete req.session.returnTo;

    res.redirect(returnTo);
  } catch (error) {
    console.error('Token exchange error:', error);
    res.redirect(`/error?message=${encodeURIComponent('Authentication failed. Please try again.')}`);
  }
});

/**
 * GET /auth/logout
 * Logout and revoke tokens
 */
router.get('/logout', async (req, res) => {
  const accessToken = req.session.access_token;

  // Revoke token on Truxe (best effort)
  if (accessToken) {
    try {
      await oauthClient.revokeToken(accessToken);
    } catch (error) {
      console.error('Token revocation failed:', error.message);
      // Continue with logout even if revocation fails
    }
  }

  // Destroy session
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destruction error:', err);
    }
    res.redirect('/');
  });
});

/**
 * POST /auth/refresh
 * Manually refresh access token (AJAX endpoint)
 */
router.post('/refresh', async (req, res) => {
  const refreshToken = req.session.refresh_token;

  if (!refreshToken) {
    return res.status(401).json({ error: 'No refresh token available' });
  }

  try {
    const tokens = await oauthClient.refreshAccessToken(refreshToken);

    // Update session
    req.session.access_token = tokens.access_token;
    req.session.refresh_token = tokens.refresh_token || refreshToken;
    req.session.expires_at = Date.now() + (tokens.expires_in * 1000);

    res.json({
      success: true,
      expires_in: tokens.expires_in
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      error: 'token_refresh_failed',
      error_description: error.message
    });
  }
});

/**
 * GET /auth/user
 * Get current user info (AJAX endpoint)
 */
router.get('/user', async (req, res) => {
  const accessToken = req.session.access_token;

  if (!accessToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Return cached user if available
  if (req.session.user) {
    return res.json(req.session.user);
  }

  try {
    const user = await oauthClient.getUserInfo(accessToken);
    req.session.user = user;
    res.json(user);
  } catch (error) {
    console.error('User info error:', error);
    res.status(401).json({
      error: 'user_info_failed',
      error_description: error.message
    });
  }
});

module.exports = router;