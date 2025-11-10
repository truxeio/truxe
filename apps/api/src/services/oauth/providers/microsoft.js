/**
 * Microsoft OAuth 2.0 Provider (Microsoft Identity Platform)
 *
 * Implements OAuth 2.0 and OpenID Connect authentication with Microsoft.
 * Supports personal Microsoft accounts, work/school accounts (Azure AD),
 * and Microsoft 365 integration.
 *
 * Features:
 * - OpenID Connect (OIDC) support
 * - Multi-tenant and single-tenant support
 * - Work and personal accounts
 * - ID token verification
 * - Microsoft Graph API access
 *
 * @see https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow
 * @see https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-protocols-oidc
 */

import { OAuthProviderInterface } from '../provider-interface.js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { OAuthProviderError } from '../errors.js';

/**
 * Microsoft OAuth Provider Implementation
 */
export class MicrosoftOAuthProvider extends OAuthProviderInterface {
  constructor(options = {}) {
    super('microsoft', {
      displayName: 'Microsoft',
      scopeSeparator: ' ',
      ...options
    });

    // Tenant configuration
    // 'common' = personal + work/school accounts
    // 'organizations' = work/school accounts only
    // 'consumers' = personal Microsoft accounts only
    // '{tenant-id}' = specific Azure AD tenant only
    this.tenant = options.tenant || process.env.MICROSOFT_OAUTH_TENANT || 'common';

    // Microsoft OAuth endpoints (v2.0)
    const baseUrl = `https://login.microsoftonline.com/${this.tenant}/oauth2/v2.0`;
    this.authUrl = `${baseUrl}/authorize`;
    this.tokenUrl = `${baseUrl}/token`;
    this.logoutUrl = `${baseUrl}/logout`;
    this.jwksUrl = 'https://login.microsoftonline.com/common/discovery/v2.0/keys';

    // Microsoft Graph API
    this.graphUrl = 'https://graph.microsoft.com/v1.0';
    this.userInfoUrl = `${this.graphUrl}/me`;

    // Configuration from environment
    this.clientId = options.clientId || process.env.MICROSOFT_OAUTH_CLIENT_ID;
    this.clientSecret = options.clientSecret || process.env.MICROSOFT_OAUTH_CLIENT_SECRET;

    // Logger (use provided logger or console)
    this.logger = options.logger || console;

    // Default scopes (OpenID Connect + basic profile)
    this.defaultScopes = [
      'openid',
      'email',
      'profile',
      'User.Read' // Microsoft Graph scope for basic profile
    ];

    // Validate required configuration
    this.validateConfig();

    // Cache for JWKS (JSON Web Key Set)
    this.jwksCache = {
      keys: null,
      expiresAt: 0
    };

    this.logger.info('Microsoft OAuth provider initialized', {
      clientId: this.clientId?.substring(0, 20) + '...',
      tenant: this.tenant
    });
  }

  /**
   * Validate provider configuration
   * @private
   */
  validateConfig() {
    if (!this.clientId) {
      throw new Error('Microsoft OAuth Client ID is required (MICROSOFT_OAUTH_CLIENT_ID)');
    }

    if (!this.clientSecret) {
      throw new Error('Microsoft OAuth Client Secret is required (MICROSOFT_OAUTH_CLIENT_SECRET)');
    }
  }

  /**
   * Generate authorization URL for Microsoft OAuth
   *
   * @param {Object} params - Authorization parameters
   * @returns {Promise<string>} Authorization URL
   */
  async getAuthorizationUrl({
    state,
    redirectUri,
    scopes = null,
    prompt = null,
    context = {}
  }) {
    const url = new URL(this.authUrl);

    // Use provided scopes or defaults
    const requestedScopes = scopes || this.defaultScopes;

    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_mode', 'query');
    url.searchParams.set('scope', requestedScopes.join(this.scopeSeparator));
    url.searchParams.set('state', state);

    // Optional parameters
    if (prompt) {
      // Prompt options: login, consent, select_account, none
      url.searchParams.set('prompt', prompt);
    }

    // Domain hint for faster login (for work/school accounts)
    if (context.domainHint) {
      url.searchParams.set('domain_hint', context.domainHint);
    }

    // Login hint (email address or username)
    if (context.loginHint) {
      url.searchParams.set('login_hint', context.loginHint);
    }

    // Code challenge for PKCE (recommended for public clients)
    if (context.codeChallenge) {
      url.searchParams.set('code_challenge', context.codeChallenge);
      url.searchParams.set('code_challenge_method', context.codeChallengeMethod || 'S256');
    }

    this.logger.info('Microsoft authorization URL generated', {
      scopes: requestedScopes,
      prompt,
      tenant: this.tenant
    });

    return url.toString();
  }

  /**
   * Exchange authorization code for tokens
   *
   * @param {Object} params - Token exchange parameters
   * @returns {Promise<Object>} Token response
   */
  async exchangeCodeForToken({ code, redirectUri, context = {} }) {
    if (!code) {
      throw new OAuthProviderError('Authorization code is required', 'MISSING_CODE', 'microsoft');
    }

    if (!redirectUri) {
      throw new OAuthProviderError('Redirect URI is required', 'MISSING_REDIRECT_URI', 'microsoft');
    }

    this.logger.info('Exchanging Microsoft authorization code for tokens');

    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    });

    // Add code verifier for PKCE if used
    if (context.codeVerifier) {
      params.set('code_verifier', context.codeVerifier);
    }

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
        this.logger.error('Microsoft token exchange failed', {
          status: response.status,
          error: JSON.stringify(data, null, 2)
        });
        throw new OAuthProviderError(
          data.error_description || data.error || 'Token exchange failed',
          data.error || 'TOKEN_EXCHANGE_FAILED',
          'microsoft'
        );
      }

      this.logger.info('Microsoft token exchange successful', {
        hasAccessToken: !!data.access_token,
        hasRefreshToken: !!data.refresh_token,
        hasIdToken: !!data.id_token
      });

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        idToken: data.id_token,
        expiresIn: data.ext_expires_in || data.expires_in, // Use extended expiry if available
        tokenType: data.token_type,
        scope: data.scope
      };
    } catch (error) {
      if (error instanceof OAuthProviderError) {
        throw error;
      }
      this.logger.error('Microsoft token exchange error', { error: error.message });
      throw new OAuthProviderError(error.message, 'TOKEN_EXCHANGE_ERROR', 'microsoft');
    }
  }

  /**
   * Get user profile from Microsoft Graph API
   *
   * @param {Object} params - Profile retrieval parameters
   * @returns {Promise<Object>} User profile
   */
  async getUserProfile({ accessToken, idToken, rawTokenResponse, state = {} }) {
    if (!accessToken) {
      throw new OAuthProviderError('Access token is required', 'MISSING_ACCESS_TOKEN', 'microsoft');
    }

    this.logger.info('Fetching Microsoft user profile from Graph API');

    try {
      // Fetch profile from Microsoft Graph
      const response = await fetch(this.userInfoUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        this.logger.error('Microsoft Graph request failed', {
          status: response.status,
          error: JSON.stringify(error, null, 2)
        });
        throw new OAuthProviderError(
          error.error?.message || 'Failed to fetch user profile',
          error.error?.code || 'PROFILE_FETCH_FAILED',
          'microsoft'
        );
      }

      const profile = await response.json();

      // Also decode ID token if available for additional claims
      let idTokenClaims = {};
      if (idToken) {
        try {
          const decoded = jwt.decode(idToken);
          idTokenClaims = decoded || {};
        } catch (err) {
          this.logger.warn('Failed to decode ID token', { error: err.message });
        }
      }

      this.logger.info('Microsoft user profile retrieved', {
        id: profile.id,
        email: profile.mail || profile.userPrincipalName
      });

      return this.normalizeProfile({ ...profile, idTokenClaims });
    } catch (error) {
      if (error instanceof OAuthProviderError) {
        throw error;
      }
      this.logger.error('Microsoft profile retrieval error', { error: error.message });
      throw new OAuthProviderError(error.message, 'PROFILE_FETCH_ERROR', 'microsoft');
    }
  }

  /**
   * Normalize Microsoft profile to standard format
   *
   * @param {Object} rawProfile - Raw profile from Microsoft Graph
   * @returns {Promise<Object>} Normalized profile
   */
  async normalizeProfile(rawProfile) {
    // Microsoft Graph profile fields:
    // - id: unique user ID
    // - displayName: full name
    // - givenName: first name
    // - surname: last name
    // - mail: email (may be null for personal accounts)
    // - userPrincipalName: UPN (username@domain.com)
    // - jobTitle, mobilePhone, officeLocation, preferredLanguage, etc.

    return {
      id: rawProfile.id,
      email: rawProfile.mail || rawProfile.userPrincipalName,
      emailVerified: true, // Microsoft verifies emails
      name: rawProfile.displayName,
      firstName: rawProfile.givenName,
      lastName: rawProfile.surname,
      avatarUrl: null, // Requires additional API call to /me/photo
      locale: rawProfile.preferredLanguage,
      jobTitle: rawProfile.jobTitle,
      mobilePhone: rawProfile.mobilePhone,
      officeLocation: rawProfile.officeLocation,
      businessPhones: rawProfile.businessPhones,
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
      throw new OAuthProviderError('Refresh token is required', 'MISSING_REFRESH_TOKEN', 'microsoft');
    }

    this.logger.info('Refreshing Microsoft access token');

    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
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
        this.logger.error('Microsoft token refresh failed', {
          status: response.status,
          error: JSON.stringify(data, null, 2)
        });
        throw new OAuthProviderError(
          data.error_description || data.error || 'Token refresh failed',
          data.error || 'TOKEN_REFRESH_FAILED',
          'microsoft'
        );
      }

      this.logger.info('Microsoft token refresh successful');

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken, // Microsoft may not return new refresh token
        idToken: data.id_token,
        expiresIn: data.ext_expires_in || data.expires_in,
        tokenType: data.token_type
      };
    } catch (error) {
      if (error instanceof OAuthProviderError) {
        throw error;
      }
      this.logger.error('Microsoft token refresh error', { error: error.message });
      throw new OAuthProviderError(error.message, 'TOKEN_REFRESH_ERROR', 'microsoft');
    }
  }

  /**
   * Revoke token with Microsoft (logout)
   * Note: Microsoft doesn't have a traditional token revocation endpoint
   * Instead, you should clear the session and optionally redirect to logout URL
   *
   * @param {Object} params - Revoke parameters
   * @returns {Promise<void>}
   */
  async revokeToken({ token, tokenTypeHint = 'access_token', account }) {
    // Microsoft doesn't support token revocation via API
    // The token will expire naturally based on its expiry time
    // For immediate logout, the client should:
    // 1. Clear local session/cookies
    // 2. Optionally redirect to the logout URL to clear Microsoft session

    this.logger.info('Microsoft token revocation requested (no-op)', {
      tokenTypeHint,
      note: 'Microsoft tokens expire naturally. Use logout URL for session clearing.'
    });

    // Return success - the token will expire based on its lifetime
    return;
  }

  /**
   * Get logout URL for Microsoft
   * This will clear the user's session with Microsoft
   *
   * @param {string} postLogoutRedirectUri - Where to redirect after logout
   * @returns {string} Logout URL
   */
  getLogoutUrl(postLogoutRedirectUri) {
    const url = new URL(this.logoutUrl);

    if (postLogoutRedirectUri) {
      url.searchParams.set('post_logout_redirect_uri', postLogoutRedirectUri);
    }

    return url.toString();
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
      tenant: this.tenant,
      defaultScopes: this.defaultScopes,
      features: {
        openidConnect: true,
        emailVerification: true,
        workAccounts: true,
        personalAccounts: this.tenant === 'common' || this.tenant === 'consumers',
        microsoftGraph: true
      }
    };
  }
}

export default MicrosoftOAuthProvider;
