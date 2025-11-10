/**
 * OAuth Error Hierarchy
 *
 * Provides structured error types for the OAuth infrastructure so that
 * routes and middleware can map failures to appropriate HTTP responses
 * and user-facing messages without leaking sensitive details.
 */

export class OAuthError extends Error {
  constructor(message, {
    code = 'OAUTH_ERROR',
    statusCode = 400,
    cause = null,
    details = null,
  } = {}) {
    super(message)
    this.name = this.constructor.name
    this.code = code
    this.statusCode = statusCode
    this.details = details
    if (cause) {
      this.cause = cause
    }
    Error.captureStackTrace?.(this, this.constructor)
  }
}

export class OAuthProviderError extends OAuthError {
  constructor(message, options = {}) {
    super(message, {
      code: 'OAUTH_PROVIDER_ERROR',
      statusCode: 502,
      ...options,
    })
  }
}

export class OAuthStateError extends OAuthError {
  constructor(message, options = {}) {
    super(message, {
      code: 'OAUTH_STATE_INVALID',
      statusCode: 400,
      ...options,
    })
  }
}

export class OAuthConfigurationError extends OAuthError {
  constructor(message, options = {}) {
    super(message, {
      code: 'OAUTH_CONFIGURATION_ERROR',
      statusCode: 500,
      ...options,
    })
  }
}

export class OAuthPersistenceError extends OAuthError {
  constructor(message, options = {}) {
    super(message, {
      code: 'OAUTH_PERSISTENCE_ERROR',
      statusCode: 500,
      ...options,
    })
  }
}

export default {
  OAuthError,
  OAuthProviderError,
  OAuthStateError,
  OAuthConfigurationError,
  OAuthPersistenceError,
}
