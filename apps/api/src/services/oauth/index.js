import oauthService, { OAuthService } from './oauth-service.js'
import OAuthStateManager from './state-manager.js'
import OAuthTokenEncryptor from './token-encryptor.js'
import OAuthProviderInterface from './provider-interface.js'
import {
  OAuthError,
  OAuthProviderError,
  OAuthStateError,
  OAuthPersistenceError,
  OAuthConfigurationError,
} from './errors.js'

// OAuth Providers
import { GoogleOAuthProvider } from './providers/google.js'
import { GitHubOAuthProvider } from './providers/github.js'
import { AppleOAuthProvider } from './providers/apple.js'
import { MicrosoftOAuthProvider } from './providers/microsoft.js'

// Register providers with OAuth service
import config from '../../config/index.js'

// Simple logger (console fallback)
const logger = console

/**
 * Initialize and register OAuth providers
 */
function initializeOAuthProviders() {
  const providers = config.oauth?.providers || {}

  // Register Google provider
  if (providers.google?.enabled) {
    try {
      const googleProvider = new GoogleOAuthProvider({
        clientId: providers.google.clientId,
        clientSecret: providers.google.clientSecret,
        ...providers.google
      })
      oauthService.registerProvider('google', googleProvider)
      logger.info('Google OAuth provider registered')
    } catch (error) {
      logger.error('Failed to initialize Google OAuth provider', {
        error: error.message
      })
    }
  }

  // Register GitHub provider
  if (providers.github?.enabled) {
    try {
      const githubProvider = new GitHubOAuthProvider({
        clientId: providers.github.clientId,
        clientSecret: providers.github.clientSecret,
        authUrl: providers.github.authorizationUrl,
        tokenUrl: providers.github.tokenUrl,
        userInfoUrl: providers.github.userInfoUrl,
        apiVersion: providers.github.apiVersion,
        userAgent: providers.github.userAgent,
        enterpriseUrl: providers.github.enterpriseUrl,
        ...providers.github
      })
      oauthService.registerProvider('github', githubProvider)
      logger.info('GitHub OAuth provider registered')
    } catch (error) {
      logger.error('Failed to initialize GitHub OAuth provider', {
        error: error.message
      })
    }
  }

  // Register Apple provider
  if (providers.apple?.enabled) {
    try {
      const appleProvider = new AppleOAuthProvider({
        clientId: providers.apple.clientId,
        teamId: providers.apple.teamId,
        keyId: providers.apple.keyId,
        privateKey: providers.apple.privateKey,
        ...providers.apple
      })
      oauthService.registerProvider('apple', appleProvider)
      logger.info('Apple OAuth provider registered')
    } catch (error) {
      logger.error('Failed to initialize Apple OAuth provider', {
        error: error.message
      })
    }
  }

  // Register Microsoft provider
  if (providers.microsoft?.enabled) {
    try {
      const microsoftProvider = new MicrosoftOAuthProvider({
        clientId: providers.microsoft.clientId,
        clientSecret: providers.microsoft.clientSecret,
        tenant: providers.microsoft.tenant,
        ...providers.microsoft
      })
      oauthService.registerProvider('microsoft', microsoftProvider)
      logger.info('Microsoft OAuth provider registered')
    } catch (error) {
      logger.error('Failed to initialize Microsoft OAuth provider', {
        error: error.message
      })
    }
  }
}

// Auto-initialize providers when module is loaded
if (config.oauth?.enabled) {
  initializeOAuthProviders()
}

export {
  oauthService,
  OAuthService,
  OAuthStateManager,
  OAuthTokenEncryptor,
  OAuthProviderInterface,
  GoogleOAuthProvider,
  GitHubOAuthProvider,
  AppleOAuthProvider,
  MicrosoftOAuthProvider,
  OAuthError,
  OAuthProviderError,
  OAuthStateError,
  OAuthPersistenceError,
  OAuthConfigurationError,
}

export default oauthService
