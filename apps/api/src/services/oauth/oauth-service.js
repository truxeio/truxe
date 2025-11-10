import config from '../../config/index.js'
import { getPool } from '../../database/connection.js'
import OAuthStateManager from './state-manager.js'
import OAuthTokenEncryptor from './token-encryptor.js'
import {
  OAuthError,
  OAuthProviderError,
  OAuthStateError,
  OAuthPersistenceError,
  OAuthConfigurationError,
} from './errors.js'

/**
 * Core OAuth Service
 *
 * Coordinates provider registration, state validation, token exchange,
 * persistence, and multi-tenant callback handling.
 */
export class OAuthService {
  constructor(options = {}) {
    this.baseConfig = options.config || config.oauth
    this.redisConfig = options.redisConfig || config.redis
    this.logger = options.logger || console

    if (!this.baseConfig) {
      throw new OAuthConfigurationError('OAuth configuration is missing')
    }

    if (!this.baseConfig.tokenEncryption?.key) {
      throw new OAuthConfigurationError('OAuth token encryption key is not configured')
    }

    this.pool = options.pool || getPool()
    this.stateManager = options.stateManager || new OAuthStateManager({
      oauthConfig: this.baseConfig,
      redisConfig: this.redisConfig,
      logger: this.logger,
    })
    this.tokenEncryptor = options.tokenEncryptor || new OAuthTokenEncryptor({
      key: this.baseConfig.tokenEncryption.key,
      algorithm: this.baseConfig.tokenEncryption.algorithm,
    })

    this.providers = new Map()
  }

  /**
   * Register a provider implementation with the service.
   */
  registerProvider(providerId, providerInstance) {
    if (!providerId || typeof providerId !== 'string') {
      throw new OAuthConfigurationError('providerId is required when registering an OAuth provider')
    }

    if (!providerInstance || typeof providerInstance.getAuthorizationUrl !== 'function') {
      throw new OAuthConfigurationError(`Provider "${providerId}" is missing required methods`)
    }

    this.providers.set(providerId, providerInstance)
    this.logger.info?.(`OAuth provider registered: ${providerId}`)
  }

  /**
   * Retrieve a registered provider or throw a configuration error.
   */
  getProvider(providerId) {
    const provider = this.providers.get(providerId)
    if (!provider) {
      throw new OAuthConfigurationError(`OAuth provider "${providerId}" is not registered`)
    }
    return provider
  }

  /**
   * Get provider configuration from environment configuration.
   */
  getProviderConfig(providerId) {
    return this.baseConfig?.providers?.[providerId] || null
  }

  isProviderEnabled(providerId) {
    const providerConfig = this.getProviderConfig(providerId)
    return Boolean(
      this.baseConfig.enabled !== false &&
      providerConfig &&
      providerConfig.enabled !== false,
    )
  }

  /**
   * Build canonical callback URL for a provider and optional tenant.
   */
  buildCallbackUrl(providerId, { tenantId, stateContext } = {}) {
    const providerConfig = this.getProviderConfig(providerId)
    if (!providerConfig?.callbackPath) {
      throw new OAuthConfigurationError(`Callback path missing for provider "${providerId}"`)
    }

    const url = new URL(providerConfig.callbackPath, this.baseConfig.callbackBaseUrl)

    const resolvedTenant = tenantId ?? stateContext?.tenantId ?? stateContext?.tenant
    if (resolvedTenant) {
      url.searchParams.set(this.baseConfig.tenantParameter, resolvedTenant)
    }

    return url.toString()
  }

  /**
   * Validate redirect URI against allow list (if provided).
   */
  validateRedirectUri(redirectUri) {
    if (!redirectUri) return null

    try {
      const url = new URL(redirectUri)

      if (this.baseConfig.allowedRedirectHosts?.length) {
        if (!this.baseConfig.allowedRedirectHosts.includes(url.host)) {
          throw new OAuthError('Redirect URI host is not allowed', {
            code: 'OAUTH_REDIRECT_DISALLOWED',
            statusCode: 400,
          })
        }
      }

      return url.toString()
    } catch (error) {
      throw new OAuthError('Invalid redirect URI provided', {
        code: 'OAUTH_REDIRECT_INVALID',
        statusCode: 400,
        cause: error,
      })
    }
  }

  /**
   * Create an authorization request (state + authorization URL).
   */
  async createAuthorizationRequest({
    providerId,
    tenantId = null,
    userId = null,
    redirectUri = null,
    scopes = null,
    prompt = null,
    extraState = {},
  }) {
    if (!providerId) {
      throw new OAuthError('providerId is required to start OAuth flow', {
        code: 'OAUTH_PROVIDER_REQUIRED',
      })
    }

    if (!this.isProviderEnabled(providerId)) {
      throw new OAuthError(`OAuth provider "${providerId}" is disabled`, {
        code: 'OAUTH_PROVIDER_DISABLED',
        statusCode: 503,
      })
    }

    const providerConfig = this.getProviderConfig(providerId)
    const provider = this.getProvider(providerId)

    if (!providerConfig?.clientId) {
      throw new OAuthConfigurationError(`Client ID missing for provider "${providerId}"`)
    }

    // Build backend callback URL for OAuth provider
    const providerCallbackUrl = this.buildCallbackUrl(providerId, { tenantId })

    // Validate final redirect URI if provided (where user will be sent after OAuth)
    const finalRedirectUri = redirectUri
      ? this.validateRedirectUri(redirectUri)
      : null

    const resolvedScopes = this.normalizeScopes(scopes ?? providerConfig.scopes)

    const {
      state,
      stateId,
      context,
    } = await this.stateManager.generateState({
      provider: providerId,
      tenantId,
      userId,
      redirectUri: finalRedirectUri,
      scopes: resolvedScopes,
      ...extraState,
    })

    const authorizationUrl = await provider.getAuthorizationUrl({
      state,
      redirectUri: providerCallbackUrl,
      scopes: resolvedScopes,
      tenantId,
      prompt,
      context,
      providerConfig,
    })

    if (!authorizationUrl || typeof authorizationUrl !== 'string') {
      throw new OAuthProviderError(`Provider "${providerId}" did not return a valid authorization URL`)
    }

    return {
      authorizationUrl,
      state,
      stateId,
      expiresAt: new Date(Date.now() + this.baseConfig.state.ttl),
      tenantId,
      scopes: resolvedScopes,
    }
  }

  normalizeScopes(scopes) {
    if (!scopes) return []
    if (Array.isArray(scopes)) {
      return scopes.map(scope => scope.trim()).filter(Boolean)
    }

    return String(scopes)
      .replace(/,/g, ' ')
      .split(/\s+/)
      .map(scope => scope.trim())
      .filter(Boolean)
  }

  /**
   * Handle OAuth callback by validating state, exchanging code for tokens,
   * optionally linking the account, and returning profile data.
   */
  async handleCallback({
    providerId,
    code,
    state,
    error,
    errorDescription,
    tenantId = null,
    userId = null,
    redirectUri = null,
  }) {
    if (error) {
      throw new OAuthProviderError(errorDescription || 'OAuth provider returned an error', {
        details: { error, errorDescription },
      })
    }

    if (!code) {
      throw new OAuthError('Authorization code is required', {
        code: 'OAUTH_CODE_REQUIRED',
      })
    }

    const statePayload = await this.stateManager.validateState(state, {
      expectedProvider: providerId,
    })

    const providerConfig = this.getProviderConfig(providerId)
    const provider = this.getProvider(providerId)

    // Always use backend callback URL for token exchange (must match authorization request)
    const providerCallbackUrl = this.buildCallbackUrl(providerId, { tenantId, stateContext: statePayload })

    const tokenResponse = await provider.exchangeCodeForToken({
      code,
      redirectUri: providerCallbackUrl,
      state: statePayload,
      providerConfig,
    })

    const tokens = this.normalizeTokenResponse(tokenResponse)

    const profile = await provider.getUserProfile({
      accessToken: tokens.accessToken,
      idToken: tokens.idToken,
      rawTokenResponse: tokens.raw,
      state: statePayload,
      providerConfig,
    })

    const resolvedTenantId = tenantId ?? statePayload.tenantId ?? null
    const account = userId
      ? await this.linkAccount({
        userId,
        providerId,
        providerAccountId: profile?.id || profile?.sub || tokens.subject || tokens.userId,
        email: profile?.email,
        tokens,
        scope: tokens.scope,
        profile,
      })
      : null

    const result = {
      provider: providerId,
      tenantId: resolvedTenantId,
      state: statePayload,
      tokens,
      profile,
      account,
    }

    this.logger.info('handleCallback returning:', JSON.stringify({
      provider: result.provider,
      hasProfile: !!result.profile,
      profileKeys: result.profile ? Object.keys(result.profile) : [],
      profile: result.profile
    }))

    return result
  }

  normalizeTokenResponse(raw) {
    if (!raw) {
      throw new OAuthProviderError('OAuth provider did not return a token response')
    }

    const accessToken = raw.access_token || raw.accessToken
    if (!accessToken) {
      throw new OAuthProviderError('OAuth provider did not include an access token in response')
    }

    const refreshToken = raw.refresh_token || raw.refreshToken || null
    const idToken = raw.id_token || raw.idToken || null
    const tokenType = raw.token_type || raw.tokenType || 'Bearer'
    const scope = raw.scope || raw.scopes?.join?.(' ') || null

    const expiresInSeconds = Number(raw.expires_in || raw.expiresIn || 0) || null
    const expiresAt = raw.expires_at
      ? new Date(raw.expires_at)
      : expiresInSeconds
        ? new Date(Date.now() + expiresInSeconds * 1000)
        : null

    return {
      accessToken,
      refreshToken,
      idToken,
      tokenType,
      scope,
      expiresIn: expiresInSeconds,
      expiresAt,
      raw,
    }
  }

  /**
   * Link OAuth account data to an internal user.
   */
  async linkAccount({
    userId,
    providerId,
    providerAccountId,
    email = null,
    tokens = {},
    scope = null,
    profile = {},
  }) {
    if (!userId) {
      throw new OAuthPersistenceError('userId is required to link an OAuth account')
    }

    if (!providerAccountId) {
      throw new OAuthPersistenceError('Provider account identifier is required')
    }

    const client = await this.pool.connect()

    try {
      const existing = await client.query(
        'SELECT id, user_id FROM oauth_accounts WHERE provider = $1 AND provider_account_id = $2',
        [providerId, providerAccountId],
      )

      if (existing.rows.length > 0 && existing.rows[0].user_id !== userId) {
        throw new OAuthPersistenceError('OAuth account is already linked to another user', {
          code: 'OAUTH_ACCOUNT_CONFLICT',
          statusCode: 409,
        })
      }

      const encryptedAccessToken = tokens.accessToken
        ? this.tokenEncryptor.encrypt(tokens.accessToken)
        : null

      const encryptedRefreshToken = tokens.refreshToken
        ? this.tokenEncryptor.encrypt(tokens.refreshToken)
        : null

      const encryptedIdToken = tokens.idToken
        ? this.tokenEncryptor.encrypt(tokens.idToken)
        : null

      const result = await client.query(
        `
          INSERT INTO oauth_accounts (
            user_id,
            provider,
            provider_account_id,
            provider_email,
            access_token,
            refresh_token,
            token_expires_at,
            scope,
            id_token,
            profile_data,
            created_at,
            updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()
          )
          ON CONFLICT (provider, provider_account_id)
          DO UPDATE SET
            provider_email = EXCLUDED.provider_email,
            access_token = EXCLUDED.access_token,
            refresh_token = EXCLUDED.refresh_token,
            token_expires_at = EXCLUDED.token_expires_at,
            scope = EXCLUDED.scope,
            id_token = EXCLUDED.id_token,
            profile_data = EXCLUDED.profile_data,
            updated_at = NOW()
          WHERE oauth_accounts.user_id = EXCLUDED.user_id
          RETURNING *
        `,
        [
          userId,
          providerId,
          providerAccountId,
          email,
          encryptedAccessToken,
          encryptedRefreshToken,
          tokens.expiresAt ? new Date(tokens.expiresAt) : null,
          scope,
          encryptedIdToken,
          JSON.stringify(profile || {}),
        ],
      )

      if (result.rows.length === 0) {
        throw new OAuthPersistenceError('OAuth account is linked to a different user', {
          code: 'OAUTH_ACCOUNT_CONFLICT',
          statusCode: 409,
        })
      }

      return this.formatAccountRecord(result.rows[0], { includeTokens: false })
    } catch (error) {
      if (error instanceof OAuthError) {
        throw error
      }

      this.logger.error?.('Failed to link OAuth account:', error.message)
      throw new OAuthPersistenceError('Failed to link OAuth account', {
        cause: error,
      })
    } finally {
      client.release()
    }
  }

  /**
   * Remove provider linkage for a user.
   */
  async unlinkAccount({ userId, providerId, providerAccountId }) {
    const result = await this.pool.query(
      `
        DELETE FROM oauth_accounts
        WHERE user_id = $1 AND provider = $2 AND provider_account_id = $3
        RETURNING *
      `,
      [userId, providerId, providerAccountId],
    )

    if (result.rows.length === 0) {
      throw new OAuthError('OAuth account not found', {
        code: 'OAUTH_ACCOUNT_NOT_FOUND',
        statusCode: 404,
      })
    }

    return this.formatAccountRecord(result.rows[0], { includeTokens: false })
  }

  /**
   * Fetch all provider accounts for a user.
   */
  async listAccountsForUser(userId, { includeTokens = false } = {}) {
    const result = await this.pool.query(
      `
        SELECT * FROM oauth_accounts
        WHERE user_id = $1
        ORDER BY provider ASC, created_at DESC
      `,
      [userId],
    )

    return result.rows.map(row => this.formatAccountRecord(row, { includeTokens }))
  }

  /**
   * Format database row, optionally decrypting token values.
   */
  formatAccountRecord(row, { includeTokens = false } = {}) {
    if (!row) return null

    const formatted = {
      id: row.id,
      userId: row.user_id,
      provider: row.provider,
      providerAccountId: row.provider_account_id,
      email: row.provider_email,
      scope: row.scope,
      tokenExpiresAt: row.token_expires_at,
      profile: this.safeParseJSON(row.profile_data),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }

    if (includeTokens) {
      formatted.tokens = {
        accessToken: row.access_token ? this.tokenEncryptor.decrypt(row.access_token) : null,
        refreshToken: row.refresh_token ? this.tokenEncryptor.decrypt(row.refresh_token) : null,
        idToken: row.id_token ? this.tokenEncryptor.decrypt(row.id_token) : null,
      }
    } else {
      formatted.tokens = {
        hasAccessToken: Boolean(row.access_token),
        hasRefreshToken: Boolean(row.refresh_token),
        hasIdToken: Boolean(row.id_token),
      }
    }

    return formatted
  }

  safeParseJSON(data) {
    if (!data) return {}
    if (typeof data === 'object') return data

    try {
      return JSON.parse(data)
    } catch {
      return { raw: data }
    }
  }
}

// Singleton instance with default configuration
const oauthService = new OAuthService()

export default oauthService
