/**
 * OAuth Client Utility for Truxe OAuth Provider
 *
 * This module provides helper functions for OAuth 2.0 flows:
 * - Authorization URL generation
 * - Code exchange for tokens
 * - Token refresh
 * - Token revocation
 * - PKCE support
 */

const crypto = require('crypto');
const axios = require('axios');

class TruxeOAuthClient {
  constructor(config) {
    this.truxeUrl = config.truxeUrl;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
    this.scopes = config.scopes || ['openid', 'profile', 'email'];
    this.usePKCE = config.usePKCE || false;
  }

  /**
   * Generate authorization URL for OAuth flow
   * @param {Object} options - Additional options (state, nonce, etc.)
   * @returns {Object} { url, state, codeVerifier }
   */
  generateAuthorizationUrl(options = {}) {
    const authUrl = new URL(`${this.truxeUrl}/oauth-provider/authorize`);

    // Required parameters
    authUrl.searchParams.set('client_id', this.clientId);
    authUrl.searchParams.set('redirect_uri', this.redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', this.scopes.join(' '));

    // Generate state for CSRF protection (required)
    const state = options.state || this.generateRandomString(32);
    authUrl.searchParams.set('state', state);

    const result = {
      url: authUrl.toString(),
      state
    };

    // PKCE support (recommended for public clients)
    if (this.usePKCE) {
      const codeVerifier = this.generateCodeVerifier();
      const codeChallenge = this.generateCodeChallenge(codeVerifier);

      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');

      result.codeVerifier = codeVerifier;
      result.url = authUrl.toString();
    }

    // OpenID Connect nonce (optional)
    if (this.scopes.includes('openid')) {
      const nonce = options.nonce || this.generateRandomString(16);
      authUrl.searchParams.set('nonce', nonce);
      result.nonce = nonce;
      result.url = authUrl.toString();
    }

    return result;
  }

  /**
   * Exchange authorization code for access token
   * @param {string} code - Authorization code
   * @param {string} codeVerifier - PKCE code verifier (if using PKCE)
   * @returns {Promise<Object>} Token response
   */
  async exchangeCodeForToken(code, codeVerifier = null) {
    const tokenUrl = `${this.truxeUrl}/oauth-provider/token`;

    const body = {
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: this.redirectUri,
      client_id: this.clientId,
      client_secret: this.clientSecret
    };

    // Add PKCE verifier if used
    if (codeVerifier) {
      body.code_verifier = codeVerifier;
    }

    try {
      const response = await axios.post(tokenUrl, body, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return response.data;
      /*
      {
        access_token: "at_...",
        token_type: "Bearer",
        expires_in: 3600,
        refresh_token: "rt_...",
        scope: "openid profile email"
      }
      */
    } catch (error) {
      throw this.handleOAuthError(error);
    }
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object>} New token response
   */
  async refreshAccessToken(refreshToken) {
    const tokenUrl = `${this.truxeUrl}/oauth-provider/token`;

    const body = {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret
    };

    try {
      const response = await axios.post(tokenUrl, body, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      throw this.handleOAuthError(error);
    }
  }

  /**
   * Get user info from userinfo endpoint
   * @param {string} accessToken - Access token
   * @returns {Promise<Object>} User profile
   */
  async getUserInfo(accessToken) {
    const userinfoUrl = `${this.truxeUrl}/oauth-provider/userinfo`;

    try {
      const response = await axios.get(userinfoUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      return response.data;
      /*
      {
        sub: "user_123",
        email: "user@example.com",
        email_verified: true,
        name: "John Doe",
        picture: "https://..."
      }
      */
    } catch (error) {
      throw this.handleOAuthError(error);
    }
  }

  /**
   * Introspect token (validate server-side)
   * @param {string} token - Token to introspect
   * @param {string} tokenTypeHint - Token type hint (access_token or refresh_token)
   * @returns {Promise<Object>} Introspection response
   */
  async introspectToken(token, tokenTypeHint = 'access_token') {
    const introspectUrl = `${this.truxeUrl}/oauth-provider/introspect`;

    const body = {
      token: token,
      token_type_hint: tokenTypeHint,
      client_id: this.clientId,
      client_secret: this.clientSecret
    };

    try {
      const response = await axios.post(introspectUrl, body, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return response.data;
      /*
      {
        active: true,
        client_id: "client_123",
        exp: 1699999999,
        iat: 1699996399,
        scope: "openid profile email"
      }
      */
    } catch (error) {
      throw this.handleOAuthError(error);
    }
  }

  /**
   * Revoke token (logout)
   * @param {string} token - Token to revoke
   * @param {string} tokenTypeHint - Token type hint
   * @returns {Promise<void>}
   */
  async revokeToken(token, tokenTypeHint = 'access_token') {
    const revokeUrl = `${this.truxeUrl}/oauth-provider/revoke`;

    const body = {
      token: token,
      token_type_hint: tokenTypeHint,
      client_id: this.clientId,
      client_secret: this.clientSecret
    };

    try {
      await axios.post(revokeUrl, body, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return true;
    } catch (error) {
      // Revocation failures are often non-critical
      console.error('Token revocation failed:', error.message);
      return false;
    }
  }

  /**
   * Generate random string for state/nonce
   * @param {number} length - String length
   * @returns {string}
   */
  generateRandomString(length = 32) {
    return crypto.randomBytes(length).toString('base64url');
  }

  /**
   * Generate PKCE code verifier
   * @returns {string}
   */
  generateCodeVerifier() {
    return this.generateRandomString(32); // 43-128 characters
  }

  /**
   * Generate PKCE code challenge from verifier
   * @param {string} verifier - Code verifier
   * @returns {string}
   */
  generateCodeChallenge(verifier) {
    return crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64url');
  }

  /**
   * Check if token is expired
   * @param {number} expiresAt - Expiration timestamp
   * @returns {boolean}
   */
  isTokenExpired(expiresAt) {
    // Consider token expired 5 minutes before actual expiration
    const buffer = 5 * 60 * 1000; // 5 minutes in milliseconds
    return Date.now() >= (expiresAt - buffer);
  }

  /**
   * Handle OAuth error responses
   * @param {Error} error - Axios error
   * @returns {Error}
   */
  handleOAuthError(error) {
    if (error.response && error.response.data) {
      const { error: errorCode, error_description } = error.response.data;
      const err = new Error(error_description || errorCode || 'OAuth request failed');
      err.code = errorCode;
      err.status = error.response.status;
      return err;
    }

    return error;
  }
}

module.exports = TruxeOAuthClient;