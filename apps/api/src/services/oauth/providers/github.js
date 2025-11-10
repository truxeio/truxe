/**
 * GitHub OAuth 2.0 Provider
 *
 * Implements OAuth 2.0 authentication with GitHub.
 * Supports GitHub Sign-In, organization access, and repository permissions.
 *
 * Features:
 * - OAuth 2.0 flow
 * - Email verification handling
 * - Refresh token support (when available)
 * - Token revocation
 * - GitHub-specific error handling
 * - Rate limit awareness
 *
 * @see https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
 * @see https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps
 */

import { OAuthProviderInterface } from '../provider-interface.js';
import { OAuthProviderError } from '../errors.js';

/**
 * GitHub OAuth Provider Implementation
 */
export class GitHubOAuthProvider extends OAuthProviderInterface {
  constructor(options = {}) {
    super('github', {
      displayName: 'GitHub',
      scopeSeparator: ' ',
      ...options
    });

    // GitHub OAuth endpoints
    this.authUrl = options.authUrl || process.env.GITHUB_OAUTH_AUTHORIZATION_URL || 'https://github.com/login/oauth/authorize';
    this.tokenUrl = options.tokenUrl || process.env.GITHUB_OAUTH_TOKEN_URL || 'https://github.com/login/oauth/access_token';
    this.userInfoUrl = options.userInfoUrl || process.env.GITHUB_OAUTH_USERINFO_URL || 'https://api.github.com/user';
    this.userEmailUrl = 'https://api.github.com/user/emails';
    this.revokeUrl = options.revokeUrl || null; // GitHub uses DELETE /applications/{client_id}/token

    // GitHub Enterprise support
    this.enterpriseUrl = options.enterpriseUrl || process.env.GITHUB_ENTERPRISE_URL || null;
    if (this.enterpriseUrl) {
      this.authUrl = `${this.enterpriseUrl}/login/oauth/authorize`;
      this.tokenUrl = `${this.enterpriseUrl}/login/oauth/access_token`;
      this.userInfoUrl = `${this.enterpriseUrl}/api/v3/user`;
      this.userEmailUrl = `${this.enterpriseUrl}/api/v3/user/emails`;
    }

    // Configuration from environment
    this.clientId = options.clientId || process.env.GITHUB_OAUTH_CLIENT_ID || process.env.GITHUB_CLIENT_ID;
    this.clientSecret = options.clientSecret || process.env.GITHUB_OAUTH_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET;

    // GitHub API configuration
    this.apiVersion = options.apiVersion || process.env.GITHUB_API_VERSION || '2022-11-28';
    this.userAgent = options.userAgent || process.env.GITHUB_USER_AGENT || 'Truxe-Auth';

    // Logger (use provided logger or console)
    this.logger = options.logger || console;

    // Default scopes (minimal required)
    this.defaultScopes = [
      'read:user',
      'user:email'
    ];

    // Validate required configuration
    this.validateConfig();

    this.logger.info('GitHub OAuth provider initialized', {
      clientId: this.clientId?.substring(0, 20) + '...',
      enterpriseUrl: this.enterpriseUrl ? 'configured' : 'github.com'
    });
  }

  /**
   * Validate provider configuration
   * @private
   */
  validateConfig() {
    if (!this.clientId) {
      throw new Error('GitHub OAuth Client ID is required (GITHUB_OAUTH_CLIENT_ID or GITHUB_CLIENT_ID)');
    }

    if (!this.clientSecret) {
      throw new Error('GitHub OAuth Client Secret is required (GITHUB_OAUTH_CLIENT_SECRET or GITHUB_CLIENT_SECRET)');
    }
  }

  /**
   * Generate authorization URL for GitHub OAuth
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
      scope: mergedScopes.join(' '),
      state: state,
    };

    // GitHub doesn't support 'prompt' parameter like Google
    // But we can use 'allow_signup' parameter
    if (context.allowSignup !== undefined) {
      params.allow_signup = context.allowSignup ? 'true' : 'false';
    }

    const queryString = new URLSearchParams(params).toString();
    const authUrl = `${this.authUrl}?${queryString}`;

    this.logger.debug('GitHub authorization URL generated', {
      scopes: mergedScopes,
      allowSignup: params.allow_signup
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
        provider: 'github',
        code: 'GITHUB_CODE_REQUIRED'
      });
    }

    const tokenParams = {
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: redirectUri,
    };

    try {
      this.logger.debug('Exchanging GitHub authorization code for tokens');

      // GitHub expects application/json for POST but also accepts form-urlencoded
      // We'll use form-urlencoded for compatibility
      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': this.userAgent,
        },
        body: new URLSearchParams(tokenParams).toString()
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error('GitHub token exchange failed', {
          status: response.status,
          error: errorBody
        });

        throw new OAuthProviderError(
          this.parseGitHubError(errorBody) || 'Token exchange failed',
          {
            provider: 'github',
            code: 'GITHUB_TOKEN_EXCHANGE_FAILED',
            statusCode: response.status,
            details: { errorBody }
          }
        );
      }

      const tokenData = await response.json();

      // GitHub returns token data in different formats
      // Handle both JSON and form-urlencoded responses
      let accessToken, scope, tokenType;

      if (tokenData.access_token) {
        // Standard JSON response
        accessToken = tokenData.access_token;
        scope = tokenData.scope;
        tokenType = tokenData.token_type || 'token';
      } else if (typeof tokenData === 'string') {
        // Form-urlencoded response - parse it
        const params = new URLSearchParams(tokenData);
        accessToken = params.get('access_token');
        scope = params.get('scope');
        tokenType = params.get('token_type') || 'token';
      }

      if (!accessToken) {
        throw new OAuthProviderError('No access token in response', {
          provider: 'github',
          code: 'GITHUB_NO_ACCESS_TOKEN'
        });
      }

      // Normalize response format
      const normalizedResponse = {
        access_token: accessToken,
        token_type: tokenType,
        scope: scope || null,
        // GitHub doesn't provide refresh tokens by default
        // Refresh tokens are only available for GitHub Apps, not OAuth Apps
        refresh_token: null,
        // GitHub doesn't specify expires_in, tokens don't expire unless revoked
        expires_in: null,
        expires_at: null
      };

      this.logger.info('GitHub token exchange successful', {
        hasScope: !!normalizedResponse.scope,
        tokenType: normalizedResponse.token_type
      });

      return normalizedResponse;
    } catch (error) {
      if (error instanceof OAuthProviderError) {
        throw error;
      }

      this.logger.error('GitHub token exchange error', {
        error: error.message
      });

      throw new OAuthProviderError(
        'Failed to exchange authorization code with GitHub',
        {
          provider: 'github',
          code: 'GITHUB_TOKEN_EXCHANGE_ERROR',
          cause: error
        }
      );
    }
  }

  /**
   * Get user profile from GitHub
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
        provider: 'github',
        code: 'GITHUB_ACCESS_TOKEN_REQUIRED'
      });
    }

    try {
      // Fetch user profile from GitHub API
      this.logger.debug('Fetching GitHub user profile from API');

      const userResponse = await fetch(this.userInfoUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': this.apiVersion,
          'User-Agent': this.userAgent,
        }
      });

      if (!userResponse.ok) {
        const errorBody = await userResponse.text();
        this.logger.error('GitHub User API request failed', {
          status: userResponse.status,
          error: errorBody
        });

        throw new OAuthProviderError(
          'Failed to fetch user profile from GitHub',
          {
            provider: 'github',
            code: 'GITHUB_USERINFO_FAILED',
            statusCode: userResponse.status,
            details: { errorBody }
          }
        );
      }

      const userData = await userResponse.json();

      // Fetch user emails separately (requires user:email scope)
      let emails = [];
      let primaryEmail = null;
      let verifiedEmail = null;

      try {
        const emailResponse = await fetch(this.userEmailUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': this.apiVersion,
            'User-Agent': this.userAgent,
          }
        });

        if (emailResponse.ok) {
          emails = await emailResponse.json();
          // Find primary and verified email
          primaryEmail = emails.find(e => e.primary)?.email || null;
          verifiedEmail = emails.find(e => e.verified && e.primary)?.email || 
                         emails.find(e => e.verified)?.email || null;
        }
      } catch (error) {
        // Email fetching is not critical, log and continue
        this.logger.warn('Failed to fetch GitHub user emails', {
          error: error.message
        });
      }

      // Use verified email if available, fallback to primary or public email
      const email = verifiedEmail || primaryEmail || userData.email || null;
      const emailVerified = Boolean(verifiedEmail || (primaryEmail && emails.find(e => e.email === primaryEmail && e.verified)));

      this.logger.info('GitHub user profile retrieved', {
        userId: userData.id,
        login: userData.login,
        email: email,
        emailVerified: emailVerified,
        hasName: !!userData.name,
        hasAvatar: !!userData.avatar_url
      });

      const normalized = this.normalizeProfile(userData, email, emailVerified);

      return normalized;
    } catch (error) {
      if (error instanceof OAuthProviderError) {
        throw error;
      }

      this.logger.error('GitHub profile retrieval error', {
        error: error.message
      });

      throw new OAuthProviderError(
        'Failed to retrieve user profile from GitHub',
        {
          provider: 'github',
          code: 'GITHUB_PROFILE_ERROR',
          cause: error
        }
      );
    }
  }

  /**
   * Refresh GitHub access token
   *
   * Note: GitHub OAuth Apps don't provide refresh tokens.
   * This method is provided for interface compliance but will throw an error.
   * For long-term access, consider using GitHub Apps instead of OAuth Apps.
   *
   * @param {Object} params - Refresh parameters
   * @returns {Promise<Object>} New token response
   */
  async refreshAccessToken({
    refreshToken,
    account = {},
    providerConfig = {}
  }) {
    // GitHub OAuth Apps don't support refresh tokens
    // Only GitHub Apps support token refresh
    throw new OAuthProviderError(
      'GitHub OAuth Apps do not support refresh tokens. Access tokens remain valid until manually revoked by the user or your application. To revoke a token, use the disconnect endpoint or call GitHub\'s token revocation API. For applications requiring long-term access, consider migrating to GitHub Apps which support token refresh.',
      {
        provider: 'github',
        code: 'GITHUB_REFRESH_NOT_SUPPORTED',
        statusCode: 501,
        details: {
          reason: 'oauth_apps_no_refresh',
          solution: 'Use disconnect endpoint to revoke tokens, or migrate to GitHub Apps for refresh token support',
          documentation: 'https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#refreshing-user-access-tokens'
        }
      }
    );
  }

  /**
   * Revoke GitHub OAuth token
   *
   * GitHub token revocation requires DELETE request to applications endpoint
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
        provider: 'github',
        code: 'GITHUB_TOKEN_REQUIRED'
      });
    }

    try {
      // GitHub token revocation endpoint
      // DELETE /applications/{client_id}/token
      const revokeEndpoint = this.enterpriseUrl 
        ? `${this.enterpriseUrl}/api/v3/applications/${this.clientId}/token`
        : `https://api.github.com/applications/${this.clientId}/token`;

      this.logger.debug('Revoking GitHub token', { tokenTypeHint });

      const response = await fetch(revokeEndpoint, {
        method: 'DELETE',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': this.apiVersion,
          'User-Agent': this.userAgent,
        },
        body: JSON.stringify({
          access_token: token
        })
      });

      // GitHub returns 204 for success, 404 for not found
      if (response.status === 204 || response.status === 404) {
        this.logger.info('GitHub token revoked successfully');
        return true;
      }

      this.logger.warn('GitHub token revocation returned unexpected status', {
        status: response.status
      });

      return false;
    } catch (error) {
      this.logger.error('GitHub token revocation error', {
        error: error.message
      });

      // Don't throw error - revocation failure is non-critical
      return false;
    }
  }

  /**
   * Normalize GitHub profile to standard format
   *
   * @param {Object} rawProfile - Raw profile from GitHub
   * @param {string} email - Email address (from separate API call)
   * @param {boolean} emailVerified - Email verification status
   * @returns {Object} Normalized profile
   * @private
   */
  normalizeProfile(rawProfile, email, emailVerified) {
    return {
      // Standard fields
      id: String(rawProfile.id),
      email: email,
      emailVerified: emailVerified,
      name: rawProfile.name || rawProfile.login,
      givenName: rawProfile.name ? rawProfile.name.split(' ')[0] : null,
      familyName: rawProfile.name && rawProfile.name.includes(' ') 
        ? rawProfile.name.split(' ').slice(1).join(' ') 
        : null,
      picture: rawProfile.avatar_url,
      locale: null, // GitHub doesn't provide locale

      // GitHub-specific fields
      login: rawProfile.login,
      nodeId: rawProfile.node_id,
      bio: rawProfile.bio,
      company: rawProfile.company,
      blog: rawProfile.blog,
      location: rawProfile.location,
      publicRepos: rawProfile.public_repos,
      publicGists: rawProfile.public_gists,
      followers: rawProfile.followers,
      following: rawProfile.following,
      createdAt: rawProfile.created_at,
      updatedAt: rawProfile.updated_at,

      // Metadata
      provider: 'github',
      profileSource: 'api',
      raw: rawProfile
    };
  }

  /**
   * Parse GitHub error response
   *
   * @param {string} errorBody - Error response body
   * @returns {string|null} Parsed error message
   * @private
   */
  parseGitHubError(errorBody) {
    try {
      const error = JSON.parse(errorBody);

      if (error.error_description) {
        return error.error_description;
      }

      if (error.message) {
        return error.message;
      }

      if (error.error) {
        // Map GitHub error codes to user-friendly messages
        const errorMessages = {
          'bad_verification_code': 'Authorization code is invalid or expired',
          'incorrect_client_credentials': 'Invalid client credentials',
          'redirect_uri_mismatch': 'Redirect URI does not match registered callback',
          'application_suspended': 'GitHub application has been suspended',
          'invalid_request': 'Invalid request parameters',
          'access_denied': 'Access was denied by user'
        };

        return errorMessages[error.error] || error.error;
      }

      return null;
    } catch {
      // If parsing fails, try to extract message from HTML error page
      const match = errorBody.match(/<title>(.+?)<\/title>/i);
      if (match) {
        return match[1];
      }
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
      id: 'github',
      name: 'GitHub',
      displayName: 'GitHub',
      iconUrl: 'https://github.com/favicon.ico',
      brandColor: '#24292e',
      supportsRefresh: false, // OAuth Apps don't support refresh tokens
      supportsRevoke: true,
      supportsOpenIDConnect: false,
      defaultScopes: this.defaultScopes
    };
  }
}

export default GitHubOAuthProvider;
