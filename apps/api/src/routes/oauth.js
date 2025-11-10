/**
 * OAuth Routes
 *
 * Provides endpoints for initiating OAuth authorization flows and handling
 * provider callbacks with state validation and account linking support.
 */

import oauthService, {
  OAuthError,
  OAuthStateError,
  OAuthProviderError,
  OAuthConfigurationError,
} from '../services/oauth/index.js'
import config from '../config/index.js'
import {
  GITHUB_SCOPES,
  GITHUB_SCOPE_PRESETS,
  validateGitHubScopes,
  getScopePreset,
  getAvailablePresets,
} from '../services/oauth/providers/github-scopes.js'
import { getPool } from '../database/connection.js'

function sanitizeProfile(profile) {
  if (!profile || typeof profile !== 'object') {
    return null
  }

  return {
    id: profile.id || profile.sub || null,
    email: profile.email || null,
    emailVerified: Boolean(profile.email_verified ?? profile.emailVerified),
    name: profile.name || null,
    givenName: profile.givenName || profile.given_name || null,
    familyName: profile.familyName || profile.family_name || null,
    avatarUrl: profile.picture || profile.avatar_url || null,
  }
}

function buildOAuthErrorResponse(error) {
  const isKnown =
    error instanceof OAuthError ||
    error instanceof OAuthStateError ||
    error instanceof OAuthProviderError ||
    error instanceof OAuthConfigurationError

  if (!isKnown) {
    return {
      statusCode: 500,
      payload: {
        error: 'OAUTH_INTERNAL_ERROR',
        message: 'OAuth processing failed due to an unexpected error',
      },
    }
  }

  return {
    statusCode: error.statusCode || 400,
    payload: {
      error: error.code || 'OAUTH_ERROR',
      message: error.message,
      details: error.details,
    },
  }
}

export default async function oauthRoutes(fastify) {
  if (!config.features.oauth || !config.oauth?.enabled) {
    fastify.log.warn('OAuth feature disabled; OAuth routes will not be registered')
    return
  }

  // Expose service instance on Fastify for other plugins if needed
  fastify.decorate('oauthService', oauthService)

  const optionalAuth = typeof fastify.optionalAuth === 'function'
    ? fastify.optionalAuth.bind(fastify)
    : async (request, reply) => { request.user = null }

  /**
   * Initiate OAuth Authorization
   */
  fastify.post('/:provider/start', {
    schema: {
      description: 'Generate provider authorization URL and state for OAuth login/link',
      tags: ['OAuth'],
      params: {
        type: 'object',
        required: ['provider'],
        properties: {
          provider: { type: 'string', minLength: 2 },
        },
      },
      body: {
        type: 'object',
        properties: {
          redirectUri: {
            anyOf: [
              { type: 'string', format: 'uri' },
              { type: 'null' }
            ]
          },
          tenantId: {
            anyOf: [
              { type: 'string' },
              { type: 'null' }
            ]
          },
          scopes: {
            anyOf: [
              { type: 'array', items: { type: 'string' } },
              { type: 'string' },
              { type: 'null' }
            ],
          },
          prompt: {
            anyOf: [
              { type: 'string' },
              { type: 'null' }
            ]
          },
          state: { type: 'object', additionalProperties: true },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            provider: { type: 'string' },
            authorizationUrl: { type: 'string' },
            state: { type: 'string' },
            expiresAt: { type: 'string', format: 'date-time' },
            tenantId: {
              anyOf: [
                { type: 'string' },
                { type: 'null' }
              ]
            },
            scopes: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      },
    },
    preHandler: optionalAuth,
  }, async (request, reply) => {
    const { provider } = request.params
    const {
      redirectUri = null,
      tenantId = null,
      scopes = null,
      prompt = null,
      state: extraState = {},
    } = request.body || {}

    try {
      const result = await oauthService.createAuthorizationRequest({
        providerId: provider,
        tenantId: tenantId || extraState?.tenantId || null,
        userId: request.user?.id || null,
        redirectUri,
        scopes,
        prompt,
        extraState,
      })

      return reply.send({
        provider,
        authorizationUrl: result.authorizationUrl,
        state: result.state,
        expiresAt: result.expiresAt.toISOString(),
        tenantId: result.tenantId,
        scopes: result.scopes,
      })
    } catch (error) {
      const { statusCode, payload } = buildOAuthErrorResponse(error)
      fastify.log.error({ err: error, provider }, 'Failed to create OAuth authorization request')
      return reply.code(statusCode).send(payload)
    }
  })

  /**
   * OAuth Callback Handler
   */
  fastify.get('/callback/:provider', {
    schema: {
      description: 'OAuth provider callback endpoint',
      tags: ['OAuth'],
      params: {
        type: 'object',
        required: ['provider'],
        properties: {
          provider: { type: 'string', minLength: 2 },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          state: { type: 'string' },
          error: { type: 'string' },
          error_description: { type: 'string' },
        },
        required: ['state'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            provider: { type: 'string' },
            tenantId: {
              anyOf: [
                { type: 'string' },
                { type: 'null' }
              ]
            },
            linked: { type: 'boolean' },
            account: {
              anyOf: [
                { type: 'object' },
                { type: 'null' }
              ]
            },
            profile: {
              anyOf: [
                { type: 'object', additionalProperties: true },
                { type: 'null' }
              ]
            },
            tokenMetadata: {
              type: 'object',
              properties: {
                scope: {
                  anyOf: [
                    { type: 'string' },
                    { type: 'null' }
                  ]
                },
                tokenType: {
                  anyOf: [
                    { type: 'string' },
                    { type: 'null' }
                  ]
                },
                expiresAt: {
                  anyOf: [
                    { type: 'string', format: 'date-time' },
                    { type: 'null' }
                  ]
                },
                hasRefreshToken: { type: 'boolean' },
              },
            },
            state: {
              type: 'object',
              properties: {
                redirectUri: {
                  anyOf: [
                    { type: 'string' },
                    { type: 'null' }
                  ]
                },
                nonce: {
                  anyOf: [
                    { type: 'string' },
                    { type: 'null' }
                  ]
                },
              },
            },
          },
        },
      },
    },
    preHandler: optionalAuth,
  }, async (request, reply) => {
    const { provider } = request.params
    const { code, state, error: providerError, error_description: errorDescription } = request.query

    const tenantParamName = config.oauth?.tenantParameter || 'tenant'
    const tenantFromQuery = request.query?.[tenantParamName] || request.query?.tenant || null
    const tenantFromHeaders = request.headers['x-tenant-id'] || request.headers['x-org-id'] || null

    try {
      const result = await oauthService.handleCallback({
        providerId: provider,
        code,
        state,
        error: providerError,
        errorDescription,
        tenantId: tenantFromQuery || tenantFromHeaders,
        userId: request.user?.id || null,
      })

      return reply.send({
        success: true,
        provider: result.provider,
        tenantId: result.tenantId,
        linked: Boolean(result.account),
        account: result.account,
        profile: result.profile,
        tokenMetadata: {
          scope: result.tokens.scope,
          tokenType: result.tokens.tokenType,
          expiresAt: result.tokens.expiresAt ? result.tokens.expiresAt.toISOString?.() || result.tokens.expiresAt : null,
          hasRefreshToken: Boolean(result.tokens.refreshToken),
        },
        state: {
          redirectUri: result.state.redirectUri || null,
          nonce: result.state.nonce || null,
        },
      })
    } catch (error) {
      const { statusCode, payload } = buildOAuthErrorResponse(error)
      fastify.log.error({ err: error, provider }, 'OAuth callback processing failed')
      return reply.code(statusCode).send(payload)
    }
  })

  /**
   * GitHub-specific: List available scopes and user's current scopes
   */
  fastify.get('/github/scopes', {
    schema: {
      description: 'List available GitHub scopes and current user scopes',
      tags: ['OAuth', 'GitHub'],
      response: {
        200: {
          type: 'object',
          properties: {
            availableScopes: {
              type: 'object',
              additionalProperties: {
                type: 'string'
              }
            },
            scopePresets: {
              type: 'object',
              additionalProperties: {
                type: 'array',
                items: { type: 'string' }
              }
            },
            availablePresets: {
              type: 'array',
              items: { type: 'string' }
            },
            currentScopes: {
              anyOf: [
                { type: 'array', items: { type: 'string' } },
                { type: 'null' }
              ]
            }
          }
        }
      }
    },
    preHandler: (request, reply) => {
      if (fastify.authenticate) {
        return fastify.authenticate(request, reply)
      }
      return reply.code(401).send({ error: 'Authentication required' })
    },
  }, async (request, reply) => {
    try {
      const userId = request.user?.id

      if (!userId) {
        return reply.code(401).send({
          error: 'OAUTH_UNAUTHORIZED',
          message: 'Authentication required'
        })
      }

      // Get user's current GitHub account scopes
      let currentScopes = null
      try {
        const accounts = await oauthService.listAccountsForUser(userId, { includeTokens: false })
        const githubAccount = accounts.find(acc => acc.provider === 'github')
        if (githubAccount?.scope) {
          // Scope can be a string (space-separated) or array
          currentScopes = typeof githubAccount.scope === 'string'
            ? githubAccount.scope.split(' ').filter(Boolean)
            : Array.isArray(githubAccount.scope) ? githubAccount.scope : null
        }
      } catch (error) {
        fastify.log.warn('Failed to fetch user GitHub account', { error: error.message })
      }

      return reply.send({
        availableScopes: GITHUB_SCOPES,
        scopePresets: GITHUB_SCOPE_PRESETS,
        availablePresets: getAvailablePresets(),
        currentScopes
      })
    } catch (error) {
      const { statusCode, payload } = buildOAuthErrorResponse(error)
      fastify.log.error({ err: error }, 'Failed to list GitHub scopes')
      return reply.code(statusCode).send(payload)
    }
  })

  /**
   * GitHub-specific: Request additional scopes (upgrade authorization)
   */
  fastify.post('/github/scopes/upgrade', {
    schema: {
      description: 'Request additional GitHub scopes by redirecting to GitHub authorization',
      tags: ['OAuth', 'GitHub'],
      body: {
        type: 'object',
        required: ['scopes'],
        properties: {
          scopes: {
            anyOf: [
              { type: 'array', items: { type: 'string' } },
              { type: 'string' }
            ]
          },
          redirectUri: {
            anyOf: [
              { type: 'string', format: 'uri' },
              { type: 'null' }
            ]
          },
          preset: {
            anyOf: [
              { type: 'string' },
              { type: 'null' }
            ]
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            authorizationUrl: { type: 'string' },
            state: { type: 'string' },
            expiresAt: { type: 'string', format: 'date-time' },
            scopes: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        }
      }
    },
    preHandler: (request, reply) => {
      if (fastify.authenticate) {
        return fastify.authenticate(request, reply)
      }
      return reply.code(401).send({ error: 'Authentication required' })
    },
  }, async (request, reply) => {
    try {
      const userId = request.user?.id

      if (!userId) {
        return reply.code(401).send({
          error: 'OAUTH_UNAUTHORIZED',
          message: 'Authentication required'
        })
      }

      const { scopes, redirectUri, preset } = request.body || {}

      // Use preset if provided
      let requestedScopes = scopes
      if (preset) {
        const presetScopes = getScopePreset(preset)
        if (!presetScopes) {
          return reply.code(400).send({
            error: 'OAUTH_INVALID_PRESET',
            message: `Invalid scope preset: ${preset}`,
            availablePresets: getAvailablePresets()
          })
        }
        requestedScopes = presetScopes
      }

      // Validate scopes
      if (!requestedScopes || (Array.isArray(requestedScopes) && requestedScopes.length === 0)) {
        return reply.code(400).send({
          error: 'OAUTH_SCOPES_REQUIRED',
          message: 'Scopes are required for scope upgrade'
        })
      }

      // Normalize scopes to array
      const scopesArray = Array.isArray(requestedScopes)
        ? requestedScopes
        : typeof requestedScopes === 'string'
          ? requestedScopes.split(',').map(s => s.trim()).filter(Boolean)
          : []

      // Validate GitHub scopes
      const validation = validateGitHubScopes(scopesArray)
      if (!validation.valid) {
        return reply.code(400).send({
          error: 'OAUTH_INVALID_SCOPES',
          message: 'Invalid GitHub scopes provided',
          invalidScopes: validation.invalid,
          warnings: validation.warnings
        })
      }

      // Create authorization request with new scopes
      const result = await oauthService.createAuthorizationRequest({
        providerId: 'github',
        userId,
        redirectUri: redirectUri || null,
        scopes: scopesArray,
        extraState: {
          scopeUpgrade: true,
          originalScopes: scopesArray
        }
      })

      return reply.send({
        authorizationUrl: result.authorizationUrl,
        state: result.state,
        expiresAt: result.expiresAt.toISOString(),
        scopes: result.scopes
      })
    } catch (error) {
      const { statusCode, payload } = buildOAuthErrorResponse(error)
      fastify.log.error({ err: error }, 'Failed to upgrade GitHub scopes')
      return reply.code(statusCode).send(payload)
    }
  })

  /**
   * GitHub-specific: Disconnect GitHub account (revoke token and unlink)
   */
  fastify.post('/github/disconnect', {
    schema: {
      description: 'Disconnect GitHub account by revoking token and unlinking account',
      tags: ['OAuth', 'GitHub'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            remainingMethods: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        }
      }
    },
    preHandler: (request, reply) => {
      if (fastify.authenticate) {
        return fastify.authenticate(request, reply)
      }
      return reply.code(401).send({ error: 'Authentication required' })
    },
  }, async (request, reply) => {
    try {
      const userId = request.user?.id

      if (!userId) {
        return reply.code(401).send({
          error: 'OAUTH_UNAUTHORIZED',
          message: 'Authentication required'
        })
      }

      const pool = getPool()
      const client = await pool.connect()

      try {
        // Get GitHub account
        const accountResult = await client.query(
          'SELECT * FROM oauth_accounts WHERE user_id = $1 AND provider = $2',
          [userId, 'github']
        )

        if (accountResult.rows.length === 0) {
          return reply.code(404).send({
            error: 'OAUTH_ACCOUNT_NOT_FOUND',
            message: 'GitHub account not linked'
          })
        }

        const account = accountResult.rows[0]

        // Decrypt and revoke token if available
        if (account.access_token) {
          try {
            const provider = oauthService.getProvider('github')
            const accessToken = oauthService.tokenEncryptor.decrypt(account.access_token)
            await provider.revokeToken({
              token: accessToken,
              account
            })
          } catch (error) {
            // Log but continue - token revocation failure is non-critical
            fastify.log.warn('Failed to revoke GitHub token', { error: error.message })
          }
        }

        // Unlink account
        await oauthService.unlinkAccount({
          userId,
          providerId: 'github',
          providerAccountId: account.provider_account_id
        })

        // Check remaining authentication methods
        const remainingAccounts = await oauthService.listAccountsForUser(userId)
        const remainingMethods = remainingAccounts.map(acc => acc.provider)

        // Check if user has password or magic link
        const userResult = await client.query(
          'SELECT id, email FROM users WHERE id = $1',
          [userId]
        )

        if (userResult.rows.length > 0) {
          // User can still use email/password or magic link
          remainingMethods.push('email')
          remainingMethods.push('magic_link')
        }

        return reply.send({
          success: true,
          message: 'GitHub account disconnected successfully',
          remainingMethods: [...new Set(remainingMethods)]
        })
      } finally {
        client.release()
      }
    } catch (error) {
      const { statusCode, payload } = buildOAuthErrorResponse(error)
      fastify.log.error({ err: error }, 'Failed to disconnect GitHub account')
      return reply.code(statusCode).send(payload)
    }
  })
}
