/**
 * OAuth Provider Interface
 *
 * Defines the contract that each OAuth provider implementation must follow.
 * Concrete providers (Google, GitHub, Apple, etc.) should extend this class
 * and implement provider-specific logic while keeping a consistent API for
 * the OAuthService orchestrator.
 */

export class OAuthProviderInterface {
  constructor(providerId, options = {}) {
    if (!providerId) {
      throw new Error('providerId is required for OAuth providers')
    }

    this.id = providerId
    this.displayName = options.displayName || providerId
    this.scopeSeparator = options.scopeSeparator || ' '
  }

  /**
   * Build the authorization URL for the provider.
   * Implementations should return a complete URL string that the client
   * can redirect the user to in order to begin the OAuth flow.
   *
   * @param {Object} params
   * @param {string} params.state - CSRF state token
   * @param {string} params.redirectUri - Registered redirect/callback URI
   * @param {string[]} params.scopes - Scopes requested for this authorization
   * @param {string|null} params.tenantId - Tenant identifier (if multi-tenant)
   * @param {Object} params.context - Additional context persisted in state
   */
  // eslint-disable-next-line no-unused-vars
  async getAuthorizationUrl(params) {
    throw new Error('getAuthorizationUrl must be implemented by OAuth providers')
  }

  /**
   * Exchange the authorization code for access/refresh tokens.
   *
   * @param {Object} params
   * @param {string} params.code - Authorization code returned by the provider
   * @param {string} params.redirectUri - Redirect URI used during authorization
   * @param {Object} params.state - State payload returned by the state manager
   */
  // eslint-disable-next-line no-unused-vars
  async exchangeCodeForToken(params) {
    throw new Error('exchangeCodeForToken must be implemented by OAuth providers')
  }

  /**
   * Retrieve the user profile from the provider using the access token.
   *
   * @param {Object} params
   * @param {string} params.accessToken - Access token from token exchange response
   * @param {string|null} params.idToken - ID token (if provided by provider)
   * @param {Object} params.rawTokenResponse - Full raw token response
   * @param {Object} params.state - State payload returned by the state manager
   */
  // eslint-disable-next-line no-unused-vars
  async getUserProfile(params) {
    throw new Error('getUserProfile must be implemented by OAuth providers')
  }

  /**
   * Refresh an access token using a refresh token.
   *
   * @param {Object} params
   * @param {string} params.refreshToken - Refresh token stored for the account
   * @param {Object} params.account - Database record for the OAuth account
   */
  // eslint-disable-next-line no-unused-vars
  async refreshAccessToken(params) {
    throw new Error('refreshAccessToken must be implemented by OAuth providers')
  }

  /**
   * Revoke a token with the provider.
   *
   * @param {Object} params
   * @param {string} params.token - Token to revoke
   * @param {string} params.tokenTypeHint - Optional hint for the provider
   * @param {Object} params.account - Database record for the OAuth account
   */
  // eslint-disable-next-line no-unused-vars
  async revokeToken(params) {
    throw new Error('revokeToken must be implemented by OAuth providers')
  }
}

export default OAuthProviderInterface
