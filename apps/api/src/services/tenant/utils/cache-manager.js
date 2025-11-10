/**
 * Lightweight in-memory cache manager with TTL support.
 *
 * Designed for short-lived caching of tenant hierarchy lookups to avoid
 * repeated database queries during hot code paths. Not a replacement for
 * Redis or distributed cache but adequate for API-layer memoization.
 */

import { ENABLE_CACHING, CACHE_TTL } from '../config.js'

/**
 * @template T
 */
class CacheManager {
  constructor({ ttl = CACHE_TTL, enabled = ENABLE_CACHING } = {}) {
    this.ttl = ttl
    this.enabled = enabled
    this.store = new Map()
  }

  /**
   * Generate storage key, supporting composite inputs.
   * @param {...any} parts
   * @returns {string}
   */
  static key(...parts) {
    return parts
      .flat()
      .map(part => (typeof part === 'object' ? JSON.stringify(part) : String(part)))
      .join(':')
  }

  /**
   * Retrieve cached value when available.
   * @param {string} key
   * @returns {T|null}
   */
  get(key) {
    if (!this.enabled || !this.store.has(key)) return null
    const { value, expiresAt } = this.store.get(key)
    if (Date.now() > expiresAt) {
      this.store.delete(key)
      return null
    }
    return value
  }

  /**
   * Set cache value.
   * @param {string} key
   * @param {T} value
   * @param {number} [ttlOverride]
   */
  set(key, value, ttlOverride) {
    if (!this.enabled) return
    const ttl = typeof ttlOverride === 'number' ? ttlOverride : this.ttl
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttl * 1000,
    })
  }

  /**
   * Remove cache value.
   * @param {string} key
   */
  delete(key) {
    this.store.delete(key)
  }

  /**
   * Clear cache entirely.
   */
  clear() {
    this.store.clear()
  }
}

export default CacheManager
