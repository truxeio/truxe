/**
 * Google OAuth 2.0 Provider
 *
 * Implements OAuth 2.0 and OpenID Connect authentication with Google.
 * Supports Google Sign-In, Google Workspace accounts, and profile retrieval.
 *
 * Features:
 * - OpenID Connect (OIDC) support
 * - ID token verification
 * - Email verification status
 * - Refresh token rotation
 * - Google-specific error handling
 *
 * @see https://developers.google.com/identity/protocols/oauth2
 * @see https://developers.google.com/identity/openid-connect/openid-connect
 */

import { OAuthProviderInterface } from '../provider-interface.js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { OAuthProviderError } from '../errors.js';

/**
 * Google OAuth Provider Implementation
 */
export class GoogleOAuthProvider extends OAuthProviderInterface {
  constructor(options = {}) {
    super('google', {
      displayName: 'Google',
      scopeSeparator: ' ',
      ...options
    });

    // Google OAuth endpoints
    this.authUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
    this.tokenUrl = 'https://oauth2.googleapis.com/token';
    this.userInfoUrl = 'https://www.googleapis.com/oauth2/v2/userinfo';
    this.revokeUrl = 'https://oauth2.googleapis.com/revoke';
    this.jwksUrl = 'https://www.googleapis.com/oauth2/v3/certs';

    // Configuration from environment
    this.clientId = options.clientId || process.env.GOOGLE_OAUTH_CLIENT_ID;
    this.clientSecret = options.clientSecret || process.env.GOOGLE_OAUTH_CLIENT_SECRET;

    // Logger (use provided logger or console)
    this.logger = options.logger || console;

    // Default scopes (OpenID Connect)
    this.defaultScopes = [
      'openid',
      'email',
      'profile'
    ];

    // Validate required configuration
    this.validateConfig();

    // Cache for JWKS (JSON Web Key Set)
    this.jwksCache = {
      keys: null,
      expiresAt: 0
    };

    this.logger.info('Google OAuth provider initialized', {
      clientId: this.clientId?.substring(0, 20) + '...'
    });
  }

  /**
   * Validate provider configuration
   * @private
   */
  validateConfig() {
    if (!this.clientId) {
      throw new Error('Google OAuth Client ID is required (GOOGLE_OAUTH_CLIENT_ID)');
    }

    if (!this.clientSecret) {
      throw new Error('Google OAuth Client Secret is required (GOOGLE_OAUTH_CLIENT_SECRET)');
    }

    // Validate client ID format
    if (!this.clientId.endsWith('.apps.googleusercontent.com')) {
      this.logger.warn('Google Client ID format may be incorrect', {
        clientId: this.clientId?.substring(0, 20) + '...'
      });
    }
  }

  /**
   * Generate authorization URL for Google OAuth
   *
   * @param {Object} params - Authorization parameters
   * @returns {Promise<string>} Authorization URL
   */
  async getAuthorizationUrl({
    state,
    redirectUri,
    scopes = null,
    prompt = null,
    context = {},
    providerConfig = {}
  }) {
    // Merge scopes: defaults + configured + requested
    const requestedScopes = scopes || providerConfig.scopes || this.defaultScopes;
    const mergedScopes = [...new Set([...this.defaultScopes, ...requestedScopes])];

    // Build authorization parameters
    const params = {
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: mergedScopes.join(' '),
      state: state,
      access_type: 'offline', // Request refresh token
      include_granted_scopes: 'true', // Incremental authorization
    };

    // Add prompt parameter if specified
    // Options: 'none', 'consent', 'select_account'
    if (prompt) {
      params.prompt = prompt;
    } else if (context.forceConsent) {
      params.prompt = 'consent'; // Force consent screen to get refresh token
    }

    // Add login hint if email is known
    if (context.email || context.loginHint) {
      params.login_hint = context.email || context.loginHint;
    }

    // Add hosted domain restriction for Google Workspace
    if (context.hostedDomain || providerConfig.hostedDomain) {
      params.hd = context.hostedDomain || providerConfig.hostedDomain;
    }

    const queryString = new URLSearchParams(params).toString();
    const authUrl = `${this.authUrl}?${queryString}`;

    this.logger.debug('Google authorization URL generated', {
      scopes: mergedScopes,
      prompt: params.prompt,
      hostedDomain: params.hd
    });

    return authUrl;
  }

  /**
   * Exchange authorization code for tokens
   *
   * @param {Object} params - Token exchange parameters
   * @returns {Promise<Object>} Token response
   */
  async exchangeCodeForToken({
    code,
    redirectUri,
    state = {},
    providerConfig = {}
  }) {
    if (!code) {
      throw new OAuthProviderError('Authorization code is required', {
        provider: 'google',
        code: 'GOOGLE_CODE_REQUIRED'
      });
    }

    const tokenParams = {
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    };

    try {
      this.logger.debug('Exchanging Google authorization code for tokens');

      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: new URLSearchParams(tokenParams).toString()
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error('Google token exchange failed', {
          status: response.status,
          error: errorBody
        });

        throw new OAuthProviderError(
          this.parseGoogleError(errorBody) || 'Token exchange failed',
          {
            provider: 'google',
            code: 'GOOGLE_TOKEN_EXCHANGE_FAILED',
            statusCode: response.status,
            details: { errorBody }
          }
        );
      }

      const tokenData = await response.json();

      // Validate response
      if (!tokenData.access_token) {
        throw new OAuthProviderError('No access token in response', {
          provider: 'google',
          code: 'GOOGLE_NO_ACCESS_TOKEN'
        });
      }

      // Verify ID token if present (OpenID Connect)
      if (tokenData.id_token) {
        try {
          const decodedIdToken = await this.verifyIdToken(tokenData.id_token);
          tokenData.decoded_id_token = decodedIdToken;
        } catch (error) {
          this.logger.warn('Failed to verify Google ID token', {
            error: error.message
          });
          // Continue without ID token verification (non-critical)
        }
      }

      this.logger.info('Google token exchange successful', {
        hasRefreshToken: !!tokenData.refresh_token,
        hasIdToken: !!tokenData.id_token,
        expiresIn: tokenData.expires_in
      });

      return tokenData;
    } catch (error) {
      if (error instanceof OAuthProviderError) {
        throw error;
      }

      this.logger.error('Google token exchange error', {
        error: error.message
      });

      throw new OAuthProviderError(
        'Failed to exchange authorization code with Google',
        {
          provider: 'google',
          code: 'GOOGLE_TOKEN_EXCHANGE_ERROR',
          cause: error
        }
      );
    }
  }

  /**
   * Get user profile from Google
   *
   * @param {Object} params - Profile retrieval parameters
   * @returns {Promise<Object>} Normalized user profile
   */
  async getUserProfile({
    accessToken,
    idToken = null,
    rawTokenResponse = {},
    state = {},
    providerConfig = {}
  }) {
    if (!accessToken) {
      throw new OAuthProviderError('Access token is required', {
        provider: 'google',
        code: 'GOOGLE_ACCESS_TOKEN_REQUIRED'
      });
    }

    try {
      // Always fetch from UserInfo endpoint for complete profile data
      // ID token only contains minimal claims (sub, email, email_verified)
      this.logger.debug('Fetching Google user profile from UserInfo endpoint');

      const response = await fetch(this.userInfoUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error('Google UserInfo request failed', {
          status: response.status,
          error: errorBody
        });

        throw new OAuthProviderError(
          'Failed to fetch user profile from Google',
          {
            provider: 'google',
            code: 'GOOGLE_USERINFO_FAILED',
            statusCode: response.status,
            details: { errorBody }
          }
        );
      }

      const profileData = await response.json();

      this.logger.info('Google user profile retrieved', {
        userId: profileData.id,
        email: profileData.email,
        emailVerified: profileData.email_verified,
        hasName: !!profileData.name,
        hasPicture: !!profileData.picture,
        rawProfile: profileData
      });

      const normalized = this.normalizeProfile(profileData, 'userinfo');

      this.logger.info('Normalized profile', { normalized });

      return normalized;
    } catch (error) {
      if (error instanceof OAuthProviderError) {
        throw error;
      }

      this.logger.error('Google profile retrieval error', {
        error: error.message
      });

      throw new OAuthProviderError(
        'Failed to retrieve user profile from Google',
        {
          provider: 'google',
          code: 'GOOGLE_PROFILE_ERROR',
          cause: error
        }
      );
    }
  }

  /**
   * Refresh Google access token
   *
   * @param {Object} params - Refresh parameters
   * @returns {Promise<Object>} New token response
   */
  async refreshAccessToken({
    refreshToken,
    account = {},
    providerConfig = {}
  }) {
    if (!refreshToken) {
      throw new OAuthProviderError('Refresh token is required', {
        provider: 'google',
        code: 'GOOGLE_REFRESH_TOKEN_REQUIRED'
      });
    }

    const refreshParams = {
      refresh_token: refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'refresh_token'
    };

    try {
      this.logger.debug('Refreshing Google access token');

      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: new URLSearchParams(refreshParams).toString()
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error('Google token refresh failed', {
          status: response.status,
          error: errorBody
        });

        // Check if refresh token is invalid/revoked
        if (response.status === 400) {
          throw new OAuthProviderError(
            'Google refresh token is invalid or revoked',
            {
              provider: 'google',
              code: 'GOOGLE_REFRESH_TOKEN_INVALID',
              statusCode: 400,
              details: { errorBody }
            }
          );
        }

        throw new OAuthProviderError(
          this.parseGoogleError(errorBody) || 'Token refresh failed',
          {
            provider: 'google',
            code: 'GOOGLE_TOKEN_REFRESH_FAILED',
            statusCode: response.status,
            details: { errorBody }
          }
        );
      }

      const tokenData = await response.json();

      this.logger.info('Google access token refreshed successfully', {
        expiresIn: tokenData.expires_in
      });

      return tokenData;
    } catch (error) {
      if (error instanceof OAuthProviderError) {
        throw error;
      }

      this.logger.error('Google token refresh error', {
        error: error.message
      });

      throw new OAuthProviderError(
        'Failed to refresh Google access token',
        {
          provider: 'google',
          code: 'GOOGLE_REFRESH_ERROR',
          cause: error
        }
      );
    }
  }

  /**
   * Revoke Google OAuth token
   *
   * @param {Object} params - Revoke parameters
   * @returns {Promise<boolean>} Success status
   */
  async revokeToken({
    token,
    tokenTypeHint = 'access_token',
    account = {},
    providerConfig = {}
  }) {
    if (!token) {
      throw new OAuthProviderError('Token is required for revocation', {
        provider: 'google',
        code: 'GOOGLE_TOKEN_REQUIRED'
      });
    }

    try {
      this.logger.debug('Revoking Google token', { tokenTypeHint });

      const response = await fetch(this.revokeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({ token }).toString()
      });

      // Google returns 200 for success, 400 for invalid token
      if (response.ok) {
        this.logger.info('Google token revoked successfully');
        return true;
      }

      // Token already revoked or invalid is considered success
      if (response.status === 400) {
        this.logger.info('Google token already revoked or invalid');
        return true;
      }

      this.logger.warn('Google token revocation returned unexpected status', {
        status: response.status
      });

      return false;
    } catch (error) {
      this.logger.error('Google token revocation error', {
        error: error.message
      });

      // Don't throw error - revocation failure is non-critical
      return false;
    }
  }

  /**
   * Verify Google ID token (OpenID Connect)
   *
   * @param {string} idToken - ID token to verify
   * @returns {Promise<Object>} Decoded and verified token payload
   * @private
   */
  async verifyIdToken(idToken) {
    try {
      // Decode without verification first to get key ID
      const decodedHeader = jwt.decode(idToken, { complete: true });

      if (!decodedHeader || !decodedHeader.header) {
        throw new Error('Invalid ID token format');
      }

      const { kid } = decodedHeader.header;

      // Get JWKS (JSON Web Key Set) from Google
      const jwks = await this.getJWKS();
      const publicKey = jwks.keys.find(key => key.kid === kid);

      if (!publicKey) {
        throw new Error(`Public key not found for kid: ${kid}`);
      }

      // Convert JWK to PEM format
      const pem = this.jwkToPem(publicKey);

      // Verify and decode ID token
      const decoded = jwt.verify(idToken, pem, {
        algorithms: ['RS256'],
        audience: this.clientId,
        issuer: ['https://accounts.google.com', 'accounts.google.com']
      });

      this.logger.debug('Google ID token verified successfully', {
        sub: decoded.sub,
        email: decoded.email
      });

      return decoded;
    } catch (error) {
      this.logger.error('Google ID token verification failed', {
        error: error.message
      });
      throw new OAuthProviderError(
        'Failed to verify Google ID token',
        {
          provider: 'google',
          code: 'GOOGLE_ID_TOKEN_VERIFICATION_FAILED',
          cause: error
        }
      );
    }
  }

  /**
   * Get Google JWKS (JSON Web Key Set) with caching
   *
   * @returns {Promise<Object>} JWKS
   * @private
   */
  async getJWKS() {
    // Return cached JWKS if still valid
    if (this.jwksCache.keys && Date.now() < this.jwksCache.expiresAt) {
      return this.jwksCache.keys;
    }

    this.logger.debug('Fetching Google JWKS');

    const response = await fetch(this.jwksUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch JWKS: ${response.status}`);
    }

    const jwks = await response.json();

    // Cache for 1 hour
    this.jwksCache = {
      keys: jwks,
      expiresAt: Date.now() + 3600000
    };

    return jwks;
  }

  /**
   * Convert JWK (JSON Web Key) to PEM format
   *
   * @param {Object} jwk - JSON Web Key
   * @returns {string} PEM formatted public key
   * @private
   */
  jwkToPem(jwk) {
    // For RS256, we need the modulus (n) and exponent (e)
    const modulus = Buffer.from(jwk.n, 'base64');
    const exponent = Buffer.from(jwk.e, 'base64');

    // Create RSA public key
    const publicKey = crypto.createPublicKey({
      key: {
        kty: 'RSA',
        n: jwk.n,
        e: jwk.e
      },
      format: 'jwk'
    });

    return publicKey.export({ type: 'spki', format: 'pem' });
  }

  /**
   * Normalize Google profile to standard format
   *
   * @param {Object} rawProfile - Raw profile from Google
   * @param {string} source - Source of profile data ('id_token' or 'userinfo')
   * @returns {Object} Normalized profile
   * @private
   */
  normalizeProfile(rawProfile, source = 'userinfo') {
    return {
      // Standard fields
      id: rawProfile.id || rawProfile.sub,
      email: rawProfile.email,
      emailVerified: rawProfile.email_verified || rawProfile.verified_email || false,
      name: rawProfile.name,
      givenName: rawProfile.given_name,
      familyName: rawProfile.family_name,
      picture: rawProfile.picture,
      locale: rawProfile.locale,

      // Google-specific fields
      hostedDomain: rawProfile.hd, // Google Workspace domain

      // Metadata
      provider: 'google',
      profileSource: source,
      raw: rawProfile
    };
  }

  /**
   * Parse Google error response
   *
   * @param {string} errorBody - Error response body
   * @returns {string|null} Parsed error message
   * @private
   */
  parseGoogleError(errorBody) {
    try {
      const error = JSON.parse(errorBody);

      if (error.error_description) {
        return error.error_description;
      }

      if (error.error) {
        // Map Google error codes to user-friendly messages
        const errorMessages = {
          'invalid_grant': 'Authorization code is invalid or expired',
          'invalid_client': 'Invalid client credentials',
          'unauthorized_client': 'Client is not authorized',
          'access_denied': 'Access was denied',
          'unsupported_grant_type': 'Grant type is not supported',
          'invalid_scope': 'Requested scope is invalid'
        };

        return errorMessages[error.error] || error.error;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get provider display information
   *
   * @returns {Object} Provider info
   */
  getProviderInfo() {
    return {
      id: 'google',
      name: 'Google',
      displayName: 'Google',
      iconUrl: 'https://www.google.com/favicon.ico',
      brandColor: '#4285F4',
      supportsRefresh: true,
      supportsRevoke: true,
      supportsOpenIDConnect: true,
      defaultScopes: this.defaultScopes
    };
  }
}

export default GoogleOAuthProvider;
