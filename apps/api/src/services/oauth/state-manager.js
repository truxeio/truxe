import crypto from 'crypto'
import Redis from 'ioredis'
import config from '../../config/index.js'
import { OAuthConfigurationError, OAuthStateError } from './errors.js'

/**
 * OAuth State Manager
 *
 * Handles generation, persistence, and validation of OAuth state parameters
 * with Redis-backed storage (and an in-memory fallback for resilience).
 */
export class OAuthStateManager {
  constructor(options = {}) {
    const oauthConfig = options.oauthConfig || config.oauth
    const redisConfig = options.redisConfig || config.redis

    this.secret = options.secret || oauthConfig?.state?.secret
    this.ttlMs = options.ttl ?? oauthConfig?.state?.ttl ?? 600000
    this.stateLength = options.stateLength ?? oauthConfig?.state?.length ?? 32
    this.keyPrefix = options.keyPrefix || `${redisConfig?.keyPrefix || ''}${oauthConfig?.state?.keyPrefix || 'oauth:state:'}`
    this.logger = options.logger || console
    this.useExternalRedis = Boolean(options.redisClient)
    this.memoryStore = new Map()

    if (!this.secret) {
      throw new OAuthConfigurationError('OAuth state secret is required')
    }

    if (this.stateLength < 16) {
      throw new OAuthConfigurationError('OAuth state length must be at least 16 characters')
    }

    if (this.ttlMs < 1000) {
      throw new OAuthConfigurationError('OAuth state TTL must be at least 1000 milliseconds')
    }

    this.redis = options.redisClient || this.createRedisClient(redisConfig)
  }

  createRedisClient(redisConfig) {
    if (!redisConfig?.url) {
      return null
    }

    const client = new Redis(redisConfig.url, {
      lazyConnect: true,
      maxRetriesPerRequest: redisConfig.maxRetriesPerRequest,
      retryDelayOnFailover: redisConfig.retryDelayOnFailover,
    })

    client.on('error', (error) => {
      this.logger.error?.('OAuth state Redis error:', error.message)
    })

    client.on('connect', () => {
      this.logger.info?.('OAuth state Redis connected')
    })

    return client
  }

  buildKey(stateId) {
    return `${this.keyPrefix}${stateId}`
  }

  generateRandomStateId() {
    const bytesNeeded = Math.max(16, Math.ceil(this.stateLength * 0.75))
    return crypto.randomBytes(bytesNeeded).toString('base64url').slice(0, this.stateLength)
  }

  signState(stateId) {
    const hmac = crypto.createHmac('sha256', this.secret)
    hmac.update(stateId)
    return hmac.digest('base64url')
  }

  async storeState(stateId, value) {
    const expiresAt = Date.now() + this.ttlMs
    const payload = {
      ...value,
      expiresAt,
      createdAt: value?.createdAt || new Date().toISOString(),
    }

    const serialized = JSON.stringify(payload)

    // Attempt Redis persistence first
    if (this.redis) {
      try {
        await this.redis.set(this.buildKey(stateId), serialized, 'PX', this.ttlMs)
        return payload
      } catch (error) {
        this.logger.error?.('Failed to persist OAuth state in Redis, falling back to memory store:', error.message)
      }
    }

    // Memory fallback with TTL
    this.memoryStore.set(stateId, payload)
    this.purgeExpiredMemoryEntries()
    return payload
  }

  async getState(stateId) {
    // Try Redis
    if (this.redis) {
      try {
        const data = await this.redis.get(this.buildKey(stateId))
        if (data) {
          return JSON.parse(data)
        }
      } catch (error) {
        this.logger.error?.('Failed to read OAuth state from Redis:', error.message)
      }
    }

    // Fallback to memory
    const entry = this.memoryStore.get(stateId)
    if (!entry) return null

    if (entry.expiresAt <= Date.now()) {
      this.memoryStore.delete(stateId)
      return null
    }

    return entry
  }

  async deleteState(stateId) {
    if (this.redis) {
      try {
        await this.redis.del(this.buildKey(stateId))
      } catch (error) {
        this.logger.error?.('Failed to delete OAuth state from Redis:', error.message)
      }
    }

    this.memoryStore.delete(stateId)
  }

  purgeExpiredMemoryEntries() {
    const now = Date.now()
    for (const [stateId, entry] of this.memoryStore.entries()) {
      if (entry.expiresAt <= now) {
        this.memoryStore.delete(stateId)
      }
    }
  }

  timingSafeCompare(a, b) {
    const aBuffer = Buffer.from(a)
    const bBuffer = Buffer.from(b)

    if (aBuffer.length !== bBuffer.length) {
      return false
    }

    return crypto.timingSafeEqual(aBuffer, bBuffer)
  }

  /**
   * Generate a new OAuth state parameter and persist context.
   */
  async generateState(context = {}) {
    const stateId = this.generateRandomStateId()
    const signature = this.signState(stateId)
    const state = `${stateId}.${signature}`

    const payload = {
      ...context,
      nonce: context.nonce || crypto.randomUUID(),
    }

    await this.storeState(stateId, payload)

    return {
      state,
      stateId,
      context: payload,
    }
  }

  /**
   * Validate a returned state parameter, ensuring it matches signature and
   * retrieving the stored context from Redis (or memory fallback).
   */
  async validateState(stateValue, { expectedProvider = null, consume = true } = {}) {
    if (!stateValue || typeof stateValue !== 'string') {
      throw new OAuthStateError('Missing OAuth state parameter')
    }

    const parts = stateValue.split('.')
    if (parts.length !== 2) {
      throw new OAuthStateError('Malformed OAuth state parameter')
    }

    const [stateId, signature] = parts
    const expectedSignature = this.signState(stateId)

    if (!this.timingSafeCompare(signature, expectedSignature)) {
      throw new OAuthStateError('Invalid OAuth state signature')
    }

    const payload = await this.getState(stateId)
    if (!payload) {
      throw new OAuthStateError('OAuth state has expired or is invalid')
    }

    if (expectedProvider && payload.provider && payload.provider !== expectedProvider) {
      throw new OAuthStateError('OAuth state provider mismatch', {
        details: { expectedProvider, actualProvider: payload.provider },
      })
    }

    if (consume) {
      await this.deleteState(stateId)
    }

    return {
      stateId,
      ...payload,
    }
  }

  /**
   * Teardown resources created by the state manager.
   */
  async destroy() {
    if (this.redis && !this.useExternalRedis) {
      try {
        await this.redis.quit()
      } catch (error) {
        this.logger.error?.('Failed to close OAuth state Redis connection:', error.message)
      }
    }
    this.memoryStore.clear()
  }
}

export default OAuthStateManager
