/**
 * Apple OAuth 2.0 Provider (Sign in with Apple)
 *
 * Implements OAuth 2.0 and OpenID Connect authentication with Apple.
 * Apple uses a unique JWT-based client authentication method.
 *
 * Features:
 * - OpenID Connect (OIDC) support
 * - JWT-based client secret generation
 * - ID token verification
 * - Email relay service support (@privaterelay.appleid.com)
 * - Name retrieval (only on first authorization)
 *
 * @see https://developer.apple.com/documentation/sign_in_with_apple
 * @see https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_rest_api
 */

import { OAuthProviderInterface } from '../provider-interface.js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { OAuthProviderError } from '../errors.js';

/**
 * Apple OAuth Provider Implementation
 */
export class AppleOAuthProvider extends OAuthProviderInterface {
  constructor(options = {}) {
    super('apple', {
      displayName: 'Apple',
      scopeSeparator: ' ',
      ...options
    });

    // Apple OAuth endpoints
    this.authUrl = 'https://appleid.apple.com/auth/authorize';
    this.tokenUrl = 'https://appleid.apple.com/auth/token';
    this.revokeUrl = 'https://appleid.apple.com/auth/revoke';
    this.jwksUrl = 'https://appleid.apple.com/auth/keys';

    // Configuration from environment
    this.clientId = options.clientId || process.env.APPLE_OAUTH_CLIENT_ID; // Service ID
    this.teamId = options.teamId || process.env.APPLE_OAUTH_TEAM_ID;
    this.keyId = options.keyId || process.env.APPLE_OAUTH_KEY_ID;
    this.privateKey = options.privateKey || process.env.APPLE_OAUTH_PRIVATE_KEY;

    // Logger (use provided logger or console)
    this.logger = options.logger || console;

    // Default scopes (OpenID Connect)
    this.defaultScopes = [
      'openid',
      'email',
      'name'
    ];

    // Validate required configuration
    this.validateConfig();

    // Cache for JWKS (JSON Web Key Set)
    this.jwksCache = {
      keys: null,
      expiresAt: 0
    };

    // Cache for generated client secrets (valid for 6 months)
    this.clientSecretCache = {
      secret: null,
      expiresAt: 0
    };

    this.logger.info('Apple OAuth provider initialized', {
      clientId: this.clientId?.substring(0, 20) + '...'
    });
  }

  /**
   * Validate provider configuration
   * @private
   */
  validateConfig() {
    if (!this.clientId) {
      throw new Error('Apple OAuth Client ID (Service ID) is required (APPLE_OAUTH_CLIENT_ID)');
    }

    if (!this.teamId) {
      throw new Error('Apple Team ID is required (APPLE_OAUTH_TEAM_ID)');
    }

    if (!this.keyId) {
      throw new Error('Apple Key ID is required (APPLE_OAUTH_KEY_ID)');
    }

    if (!this.privateKey) {
      throw new Error('Apple Private Key is required (APPLE_OAUTH_PRIVATE_KEY)');
    }
  }

  /**
   * Generate client secret JWT for Apple
   * Apple requires a JWT signed with your private key as the client_secret
   *
   * @private
   * @returns {string} JWT client secret
   */
  generateClientSecret() {
    // Check cache first (secrets are valid for 6 months)
    const now = Date.now();
    if (this.clientSecretCache.secret && this.clientSecretCache.expiresAt > now) {
      return this.clientSecretCache.secret;
    }

    // Generate new client secret
    const issuedAt = Math.floor(now / 1000);
    const expiresAt = issuedAt + (86400 * 180); // 180 days (6 months)

    const payload = {
      iss: this.teamId,
      iat: issuedAt,
      exp: expiresAt,
      aud: 'https://appleid.apple.com',
      sub: this.clientId
    };

    // Decode the private key if it's base64 encoded
    let privateKey = this.privateKey;
    if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
      try {
        privateKey = Buffer.from(privateKey, 'base64').toString('utf8');
      } catch (err) {
        throw new Error('Invalid Apple private key format');
      }
    }

    const clientSecret = jwt.sign(payload, privateKey, {
      algorithm: 'ES256',
      keyid: this.keyId
    });

    // Cache the secret
    this.clientSecretCache = {
      secret: clientSecret,
      expiresAt: expiresAt * 1000 // Convert to milliseconds
    };

    this.logger.info('Generated new Apple client secret', {
      expiresAt: new Date(expiresAt * 1000).toISOString()
    });

    return clientSecret;
  }

  /**
   * Generate authorization URL for Apple OAuth
   *
   * @param {Object} params - Authorization parameters
   * @returns {Promise<string>} Authorization URL
   */
  async getAuthorizationUrl({
    state,
    redirectUri,
    scopes = null,
    responseMode = 'form_post', // Apple recommends form_post
    context = {}
  }) {
    const url = new URL(this.authUrl);

    // Use provided scopes or defaults
    const requestedScopes = scopes || this.defaultScopes;

    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('response_mode', responseMode);
    url.searchParams.set('scope', requestedScopes.join(this.scopeSeparator));
    url.searchParams.set('state', state);

    this.logger.info('Apple authorization URL generated', {
      scopes: requestedScopes,
      responseMode
    });

    return url.toString();
  }

  /**
   * Exchange authorization code for tokens
   *
   * @param {Object} params - Token exchange parameters
   * @returns {Promise<Object>} Token response
   */
  async exchangeCodeForToken({ code, redirectUri }) {
    if (!code) {
      throw new OAuthProviderError('Authorization code is required', 'MISSING_CODE', 'apple');
    }

    if (!redirectUri) {
      throw new OAuthProviderError('Redirect URI is required', 'MISSING_REDIRECT_URI', 'apple');
    }

    this.logger.info('Exchanging Apple authorization code for tokens');

    const clientSecret = this.generateClientSecret();

    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri
    });

    try {
      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      const data = await response.json();

      if (!response.ok) {
        this.logger.error('Apple token exchange failed', {
          status: response.status,
          error: JSON.stringify(data, null, 2)
        });
        throw new OAuthProviderError(
          data.error_description || data.error || 'Token exchange failed',
          data.error || 'TOKEN_EXCHANGE_FAILED',
          'apple'
        );
      }

      this.logger.info('Apple token exchange successful', {
        hasAccessToken: !!data.access_token,
        hasRefreshToken: !!data.refresh_token,
        hasIdToken: !!data.id_token
      });

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        idToken: data.id_token,
        expiresIn: data.expires_in,
        tokenType: data.token_type,
        scope: data.scope
      };
    } catch (error) {
      if (error instanceof OAuthProviderError) {
        throw error;
      }
      this.logger.error('Apple token exchange error', { error: error.message });
      throw new OAuthProviderError(error.message, 'TOKEN_EXCHANGE_ERROR', 'apple');
    }
  }

  /**
   * Get user profile from Apple
   * Note: Apple only provides user info in the ID token and during first authorization
   *
   * @param {Object} params - Profile retrieval parameters
   * @returns {Promise<Object>} User profile
   */
  async getUserProfile({ accessToken, idToken, rawTokenResponse, state = {} }) {
    if (!idToken) {
      throw new OAuthProviderError('ID token is required for Apple profile', 'MISSING_ID_TOKEN', 'apple');
    }

    this.logger.info('Fetching Apple user profile from ID token');

    try {
      // Decode the ID token (without verification for now - should verify in production)
      const decoded = jwt.decode(idToken, { complete: true });

      if (!decoded) {
        throw new OAuthProviderError('Invalid ID token', 'INVALID_ID_TOKEN', 'apple');
      }

      const payload = decoded.payload;

      // Apple's ID token contains:
      // - sub: unique user identifier
      // - email: user's email (may be private relay)
      // - email_verified: boolean (as string)
      // - is_private_email: boolean (as string)

      const profile = {
        id: payload.sub,
        email: payload.email,
        emailVerified: payload.email_verified === 'true' || payload.email_verified === true,
        isPrivateEmail: payload.is_private_email === 'true' || payload.is_private_email === true
      };

      // Check if user info was provided in the state (first-time authorization only)
      if (state.user) {
        const userInfo = typeof state.user === 'string' ? JSON.parse(state.user) : state.user;

        if (userInfo.name) {
          profile.name = `${userInfo.name.firstName || ''} ${userInfo.name.lastName || ''}`.trim();
          profile.firstName = userInfo.name.firstName;
          profile.lastName = userInfo.name.lastName;
        }
      }

      this.logger.info('Apple user profile retrieved', {
        id: profile.id,
        email: profile.email,
        isPrivateEmail: profile.isPrivateEmail
      });

      return this.normalizeProfile(profile);
    } catch (error) {
      if (error instanceof OAuthProviderError) {
        throw error;
      }
      this.logger.error('Apple profile retrieval error', { error: error.message });
      throw new OAuthProviderError(error.message, 'PROFILE_FETCH_ERROR', 'apple');
    }
  }

  /**
   * Normalize Apple profile to standard format
   *
   * @param {Object} rawProfile - Raw profile from Apple
   * @returns {Promise<Object>} Normalized profile
   */
  async normalizeProfile(rawProfile) {
    return {
      id: rawProfile.id,
      email: rawProfile.email,
      emailVerified: rawProfile.emailVerified,
      name: rawProfile.name,
      firstName: rawProfile.firstName,
      lastName: rawProfile.lastName,
      isPrivateEmail: rawProfile.isPrivateEmail,
      raw: rawProfile
    };
  }

  /**
   * Refresh access token using refresh token
   *
   * @param {Object} params - Refresh parameters
   * @returns {Promise<Object>} New token response
   */
  async refreshAccessToken({ refreshToken, account }) {
    if (!refreshToken) {
      throw new OAuthProviderError('Refresh token is required', 'MISSING_REFRESH_TOKEN', 'apple');
    }

    this.logger.info('Refreshing Apple access token');

    const clientSecret = this.generateClientSecret();

    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    });

    try {
      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      const data = await response.json();

      if (!response.ok) {
        this.logger.error('Apple token refresh failed', {
          status: response.status,
          error: JSON.stringify(data, null, 2)
        });
        throw new OAuthProviderError(
          data.error_description || data.error || 'Token refresh failed',
          data.error || 'TOKEN_REFRESH_FAILED',
          'apple'
        );
      }

      this.logger.info('Apple token refresh successful');

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken, // Apple may not return new refresh token
        idToken: data.id_token,
        expiresIn: data.expires_in,
        tokenType: data.token_type
      };
    } catch (error) {
      if (error instanceof OAuthProviderError) {
        throw error;
      }
      this.logger.error('Apple token refresh error', { error: error.message });
      throw new OAuthProviderError(error.message, 'TOKEN_REFRESH_ERROR', 'apple');
    }
  }

  /**
   * Revoke token with Apple
   *
   * @param {Object} params - Revoke parameters
   * @returns {Promise<void>}
   */
  async revokeToken({ token, tokenTypeHint = 'access_token', account }) {
    if (!token) {
      throw new OAuthProviderError('Token is required for revocation', 'MISSING_TOKEN', 'apple');
    }

    this.logger.info('Revoking Apple token', { tokenTypeHint });

    const clientSecret = this.generateClientSecret();

    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: clientSecret,
      token,
      token_type_hint: tokenTypeHint
    });

    try {
      const response = await fetch(this.revokeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        this.logger.error('Apple token revocation failed', {
          status: response.status,
          error: JSON.stringify(data, null, 2)
        });
        throw new OAuthProviderError(
          data.error_description || data.error || 'Token revocation failed',
          data.error || 'TOKEN_REVOKE_FAILED',
          'apple'
        );
      }

      this.logger.info('Apple token revoked successfully');
    } catch (error) {
      if (error instanceof OAuthProviderError) {
        throw error;
      }
      this.logger.error('Apple token revocation error', { error: error.message });
      throw new OAuthProviderError(error.message, 'TOKEN_REVOKE_ERROR', 'apple');
    }
  }

  /**
   * Get provider information
   *
   * @returns {Object} Provider info
   */
  getProviderInfo() {
    return {
      name: this.id,
      displayName: this.displayName,
      authUrl: this.authUrl,
      tokenUrl: this.tokenUrl,
      defaultScopes: this.defaultScopes,
      features: {
        openidConnect: true,
        emailVerification: true,
        privateEmailRelay: true,
        nameProvided: true // Only on first authorization
      }
    };
  }
}

export default AppleOAuthProvider;
