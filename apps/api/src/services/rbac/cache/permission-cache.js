/**
 * Permission Cache Manager
 * 
 * High-performance caching layer for RBAC operations with support for
 * multiple caching strategies (memory, Redis, hybrid) and intelligent
 * cache invalidation.
 */

import { RBAC_CONFIG, CACHE_KEYS } from '../config.js'

/**
 * Memory cache implementation
 */
class MemoryCache {
  constructor(options = {}) {
    this.cache = new Map()
    this.ttlMap = new Map()
    this.maxSize = options.maxSize || 10000
    this.defaultTTL = options.defaultTTL || 300 // 5 minutes
    this.cleanupInterval = options.cleanupInterval || 60000 // 1 minute
    
    // Start cleanup timer
    this.cleanupTimer = setInterval(() => this._cleanup(), this.cleanupInterval)
  }

  async get(key) {
    const item = this.cache.get(key)
    if (!item) return null

    const expiry = this.ttlMap.get(key)
    if (expiry && Date.now() > expiry) {
      this.cache.delete(key)
      this.ttlMap.delete(key)
      return null
    }

    return item
  }

  async set(key, value, ttl = this.defaultTTL) {
    // Evict oldest items if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
      this.ttlMap.delete(firstKey)
    }

    this.cache.set(key, value)
    this.ttlMap.set(key, Date.now() + (ttl * 1000))
    return true
  }

  async setex(key, ttl, value) {
    return this.set(key, value, ttl)
  }

  async del(key) {
    const deleted = this.cache.delete(key)
    this.ttlMap.delete(key)
    return deleted ? 1 : 0
  }

  async exists(key) {
    return this.cache.has(key) ? 1 : 0
  }

  async ping() {
    return 'PONG'
  }

  async flushall() {
    this.cache.clear()
    this.ttlMap.clear()
    return true
  }

  _cleanup() {
    const now = Date.now()
    for (const [key, expiry] of this.ttlMap.entries()) {
      if (now > expiry) {
        this.cache.delete(key)
        this.ttlMap.delete(key)
      }
    }
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this.hitCount / (this.hitCount + this.missCount) || 0,
      memoryUsage: process.memoryUsage()
    }
  }

  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
    this.cache.clear()
    this.ttlMap.clear()
  }
}

/**
 * Redis cache wrapper
 */
class RedisCache {
  constructor(redisClient) {
    this.redis = redisClient
    this.hitCount = 0
    this.missCount = 0
  }

  async get(key) {
    try {
      const value = await this.redis.get(key)
      if (value) {
        this.hitCount++
        return JSON.parse(value)
      } else {
        this.missCount++
        return null
      }
    } catch (error) {
      console.error('Redis get error:', error)
      return null
    }
  }

  async set(key, value, ttl = 300) {
    try {
      return await this.redis.setex(key, ttl, JSON.stringify(value))
    } catch (error) {
      console.error('Redis set error:', error)
      return false
    }
  }

  async setex(key, ttl, value) {
    return this.set(key, value, ttl)
  }

  async del(key) {
    try {
      return await this.redis.del(key)
    } catch (error) {
      console.error('Redis del error:', error)
      return 0
    }
  }

  async exists(key) {
    try {
      return await this.redis.exists(key)
    } catch (error) {
      console.error('Redis exists error:', error)
      return 0
    }
  }

  async ping() {
    try {
      return await this.redis.ping()
    } catch (error) {
      throw new Error(`Redis ping failed: ${error.message}`)
    }
  }

  async flushall() {
    try {
      return await this.redis.flushall()
    } catch (error) {
      console.error('Redis flushall error:', error)
      return false
    }
  }

  getStats() {
    return {
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: this.hitCount / (this.hitCount + this.missCount) || 0
    }
  }
}

/**
 * Hybrid cache (Memory L1 + Redis L2)
 */
class HybridCache {
  constructor(redisClient, options = {}) {
    this.l1Cache = new MemoryCache(options.memory || {})
    this.l2Cache = new RedisCache(redisClient)
    this.l1TTL = options.l1TTL || 60 // 1 minute for L1
    this.l2TTL = options.l2TTL || 300 // 5 minutes for L2
  }

  async get(key) {
    // Try L1 cache first
    let value = await this.l1Cache.get(key)
    if (value !== null) {
      return value
    }

    // Try L2 cache
    value = await this.l2Cache.get(key)
    if (value !== null) {
      // Populate L1 cache
      await this.l1Cache.set(key, value, this.l1TTL)
      return value
    }

    return null
  }

  async set(key, value, ttl = this.l2TTL) {
    // Set in both caches
    await Promise.all([
      this.l1Cache.set(key, value, Math.min(ttl, this.l1TTL)),
      this.l2Cache.set(key, value, ttl)
    ])
    return true
  }

  async setex(key, ttl, value) {
    return this.set(key, value, ttl)
  }

  async del(key) {
    // Delete from both caches
    const [l1Result, l2Result] = await Promise.all([
      this.l1Cache.del(key),
      this.l2Cache.del(key)
    ])
    return Math.max(l1Result, l2Result)
  }

  async exists(key) {
    // Check L1 first, then L2
    const l1Exists = await this.l1Cache.exists(key)
    if (l1Exists) return 1

    return await this.l2Cache.exists(key)
  }

  async ping() {
    await this.l2Cache.ping() // Only ping Redis
    return 'PONG'
  }

  async flushall() {
    await Promise.all([
      this.l1Cache.flushall(),
      this.l2Cache.flushall()
    ])
    return true
  }

  getStats() {
    const l1Stats = this.l1Cache.getStats()
    const l2Stats = this.l2Cache.getStats()
    
    return {
      l1: l1Stats,
      l2: l2Stats,
      combined: {
        hitRate: (l1Stats.hitRate + l2Stats.hitRate) / 2
      }
    }
  }

  destroy() {
    this.l1Cache.destroy()
  }
}

/**
 * Main Permission Cache Manager
 */
export class PermissionCacheManager {
  constructor(options = {}) {
    this.strategy = options.strategy || RBAC_CONFIG.CACHE_STRATEGY
    this.defaultTTL = options.defaultTTL || RBAC_CONFIG.PERMISSION_CACHE_TTL
    this.keyPrefix = options.keyPrefix || 'rbac:'
    
    // Initialize cache based on strategy
    this._initializeCache(options)
    
    // Statistics
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0
    }
  }

  // ===================================================================
  // CACHE OPERATIONS
  // ===================================================================

  /**
   * Cache user permissions
   */
  async cachePermissions(userId, tenantId, permissions) {
    const key = this._formatKey(CACHE_KEYS.USER_PERMISSIONS, { userId, tenantId })
    
    try {
      await this.cache.set(key, permissions, this.defaultTTL)
      this.stats.sets++
      return true
    } catch (error) {
      this.stats.errors++
      console.error('Failed to cache permissions:', error)
      return false
    }
  }

  /**
   * Get cached permissions
   */
  async getCachedPermissions(userId, tenantId) {
    const key = this._formatKey(CACHE_KEYS.USER_PERMISSIONS, { userId, tenantId })
    
    try {
      const permissions = await this.cache.get(key)
      if (permissions) {
        this.stats.hits++
        return permissions
      } else {
        this.stats.misses++
        return null
      }
    } catch (error) {
      this.stats.errors++
      console.error('Failed to get cached permissions:', error)
      return null
    }
  }

  /**
   * Invalidate user cache
   */
  async invalidateCache(userId, tenantId) {
    const patterns = [
      CACHE_KEYS.USER_PERMISSIONS,
      CACHE_KEYS.EFFECTIVE_PERMISSIONS,
      CACHE_KEYS.INHERITANCE,
      CACHE_KEYS.MATRIX
    ]

    let deletedCount = 0
    
    for (const pattern of patterns) {
      const key = this._formatKey(pattern, { userId, tenantId })
      try {
        const deleted = await this.cache.del(key)
        deletedCount += deleted
        this.stats.deletes++
      } catch (error) {
        this.stats.errors++
        console.error('Failed to invalidate cache:', error)
      }
    }

    return deletedCount
  }

  /**
   * Invalidate all tenant cache
   */
  async invalidateTenantCache(tenantId) {
    // This is a simplified implementation
    // In practice, you'd need pattern-based deletion
    const patterns = [
      `${this.keyPrefix}*:tenant:${tenantId}`,
      `${this.keyPrefix}*:${tenantId}:*`
    ]

    let deletedCount = 0
    
    for (const pattern of patterns) {
      try {
        // Note: This requires Redis SCAN or similar pattern matching
        // For memory cache, you'd iterate through all keys
        deletedCount += await this._deleteByPattern(pattern)
      } catch (error) {
        this.stats.errors++
        console.error('Failed to invalidate tenant cache:', error)
      }
    }

    return deletedCount
  }

  /**
   * Invalidate all user cache
   */
  async invalidateUserCache(userId) {
    const patterns = [
      `${this.keyPrefix}*user:${userId}*`,
      `${this.keyPrefix}*:${userId}:*`
    ]

    let deletedCount = 0
    
    for (const pattern of patterns) {
      try {
        deletedCount += await this._deleteByPattern(pattern)
      } catch (error) {
        this.stats.errors++
        console.error('Failed to invalidate user cache:', error)
      }
    }

    return deletedCount
  }

  // ===================================================================
  // CACHE WARMING
  // ===================================================================

  /**
   * Warm cache for user
   */
  async warmCache(userId, tenantIds = []) {
    const results = []
    
    for (const tenantId of tenantIds) {
      try {
        // This would typically call the permission service to populate cache
        // For now, we'll just mark the cache as warmed
        const key = this._formatKey(CACHE_KEYS.USER_PERMISSIONS, { userId, tenantId })
        await this.cache.set(`${key}:warmed`, true, this.defaultTTL)
        results.push({ tenantId, status: 'warmed' })
      } catch (error) {
        results.push({ tenantId, status: 'failed', error: error.message })
      }
    }

    return {
      userId,
      warmed: results.filter(r => r.status === 'warmed').length,
      failed: results.filter(r => r.status === 'failed').length,
      results
    }
  }

  /**
   * Warm cache for tenant
   */
  async warmTenantCache(tenantId) {
    try {
      // Mark tenant cache as warmed
      const key = `${this.keyPrefix}tenant:${tenantId}:warmed`
      await this.cache.set(key, true, this.defaultTTL)
      
      return { tenantId, status: 'warmed' }
    } catch (error) {
      return { tenantId, status: 'failed', error: error.message }
    }
  }

  // ===================================================================
  // CACHE STATISTICS
  // ===================================================================

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const baseStats = {
      strategy: this.strategy,
      ...this.stats,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0
    }

    if (this.cache.getStats) {
      return {
        ...baseStats,
        backend: this.cache.getStats()
      }
    }

    return baseStats
  }

  /**
   * Get cache hit rate
   */
  getCacheHitRate() {
    return this.stats.hits / (this.stats.hits + this.stats.misses) || 0
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0
    }
  }

  // ===================================================================
  // CACHE STRATEGIES
  // ===================================================================

  /**
   * Set caching strategy
   */
  async setStrategy(strategy, options = {}) {
    if (!['memory', 'redis', 'hybrid'].includes(strategy)) {
      throw new Error('Invalid cache strategy. Must be "memory", "redis", or "hybrid"')
    }

    // Clean up current cache
    if (this.cache && this.cache.destroy) {
      this.cache.destroy()
    }

    this.strategy = strategy
    this._initializeCache({ strategy, ...options })

    return { strategy, initialized: true }
  }

  /**
   * Get current strategy
   */
  getStrategy() {
    return this.strategy
  }

  // ===================================================================
  // INTERNAL METHODS
  // ===================================================================

  /**
   * Initialize cache based on strategy
   */
  _initializeCache(options) {
    switch (this.strategy) {
      case 'memory':
        this.cache = new MemoryCache(options.memory || {})
        break
      
      case 'redis':
        if (!options.redisClient) {
          throw new Error('Redis client required for Redis caching strategy')
        }
        this.cache = new RedisCache(options.redisClient)
        break
      
      case 'hybrid':
        if (!options.redisClient) {
          throw new Error('Redis client required for hybrid caching strategy')
        }
        this.cache = new HybridCache(options.redisClient, options.hybrid || {})
        break
      
      default:
        this.cache = new MemoryCache()
    }
  }

  /**
   * Format cache key from pattern
   */
  _formatKey(pattern, params) {
    let key = `${this.keyPrefix}${pattern}`
    
    for (const [param, value] of Object.entries(params)) {
      key = key.replace(`{${param}}`, value)
    }
    
    return key
  }

  /**
   * Delete keys by pattern
   */
  async _deleteByPattern(pattern) {
    // This is a simplified implementation
    // In production, you'd use Redis SCAN or similar
    if (this.strategy === 'memory' && this.cache.cache) {
      let count = 0
      for (const key of this.cache.cache.keys()) {
        if (this._matchesPattern(key, pattern)) {
          await this.cache.del(key)
          count++
        }
      }
      return count
    }
    
    return 0
  }

  /**
   * Check if key matches pattern
   */
  _matchesPattern(key, pattern) {
    // Convert glob pattern to regex
    const regex = new RegExp(
      pattern
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.')
    )
    return regex.test(key)
  }

  /**
   * Health check for cache manager
   */
  async healthCheck() {
    try {
      await this.cache.ping()
      
      const stats = this.getCacheStats()
      
      return {
        status: 'healthy',
        strategy: this.strategy,
        hitRate: stats.hitRate,
        operations: {
          hits: stats.hits,
          misses: stats.misses,
          errors: stats.errors
        }
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        strategy: this.strategy,
        error: error.message
      }
    }
  }

  /**
   * Cleanup and destroy cache
   */
  destroy() {
    if (this.cache && this.cache.destroy) {
      this.cache.destroy()
    }
  }
}

export default PermissionCacheManager