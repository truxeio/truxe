/**
 * Authentication Middleware for OAuth-protected routes
 */

const TruxeOAuthClient = require('../oauth-client');

// Initialize OAuth client
const oauthClient = new TruxeOAuthClient({
  truxeUrl: process.env.TRUXE_URL,
  clientId: process.env.OAUTH_CLIENT_ID,
  clientSecret: process.env.OAUTH_CLIENT_SECRET,
  redirectUri: process.env.OAUTH_REDIRECT_URI,
  usePKCE: process.env.USE_PKCE === 'true'
});

/**
 * Middleware to require authentication
 * Redirects to login if not authenticated
 * Automatically refreshes token if expired
 */
async function requireAuth(req, res, next) {
  const accessToken = req.session.access_token;
  const expiresAt = req.session.expires_at;

  // Not authenticated - redirect to login
  if (!accessToken) {
    req.session.returnTo = req.originalUrl;
    return res.redirect('/auth/login');
  }

  // Token expired - try to refresh
  if (oauthClient.isTokenExpired(expiresAt)) {
    const refreshToken = req.session.refresh_token;

    if (!refreshToken) {
      // No refresh token - require re-authentication
      req.session.returnTo = req.originalUrl;
      return res.redirect('/auth/login');
    }

    try {
      // Refresh the access token
      const tokens = await oauthClient.refreshAccessToken(refreshToken);

      // Update session with new tokens
      req.session.access_token = tokens.access_token;
      req.session.refresh_token = tokens.refresh_token || refreshToken;
      req.session.expires_at = Date.now() + (tokens.expires_in * 1000);

      // Continue to protected route
      return next();
    } catch (error) {
      console.error('Token refresh failed:', error.message);

      // Refresh failed - require re-authentication
      req.session.returnTo = req.originalUrl;
      return res.redirect('/auth/login');
    }
  }

  // Token is valid - continue
  next();
}

/**
 * Middleware to attach user info to request
 * Use after requireAuth
 */
async function attachUser(req, res, next) {
  // Check if user info is already in session
  if (req.session.user) {
    req.user = req.session.user;
    return next();
  }

  const accessToken = req.session.access_token;

  if (!accessToken) {
    return next();
  }

  try {
    // Fetch user info from Truxe
    const user = await oauthClient.getUserInfo(accessToken);

    // Store in session for future requests
    req.session.user = user;
    req.user = user;

    next();
  } catch (error) {
    console.error('Failed to fetch user info:', error.message);

    // Clear invalid session
    req.session.destroy();
    res.redirect('/auth/login');
  }
}

/**
 * Middleware to check if user is authenticated (without redirecting)
 * Sets req.isAuthenticated boolean
 */
function checkAuth(req, res, next) {
  const accessToken = req.session.access_token;
  const expiresAt = req.session.expires_at;

  req.isAuthenticated = !!(
    accessToken &&
    expiresAt &&
    !oauthClient.isTokenExpired(expiresAt)
  );

  next();
}

module.exports = {
  requireAuth,
  attachUser,
  checkAuth
};