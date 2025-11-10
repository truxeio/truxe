/**
 * Slug generation utility for tenants.
 *
 * Avoids introducing new dependencies by using a simple transliteration
 * strategy that normalizes input, strips unsafe characters, and enforces
 * length constraints defined in the tenant config.
 */

import crypto from 'crypto'
import {
  SLUG_MIN_LENGTH,
  SLUG_MAX_LENGTH,
} from '../config.js'

/**
 * Normalize input strings into slug-safe content.
 * @param {string} value
 * @returns {string}
 */
export function normalizeSlugValue(value) {
  if (!value) return ''
  return value
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .toLowerCase()
}

/**
 * Generate a random suffix to ensure slug uniqueness.
 * @param {number} length
 * @returns {string}
 */
export function randomSlugSuffix(length = 6) {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length)
}

/**
 * Compose a candidate slug from multiple parts.
 * @param {...string} parts
 * @returns {string}
 */
export function composeSlug(...parts) {
  const normalized = parts
    .filter(Boolean)
    .map(part => normalizeSlugValue(part))
    .filter(Boolean)
    .join('-')
    .replace(/-+/g, '-')

  if (normalized.length >= SLUG_MIN_LENGTH) {
    return normalized.slice(0, SLUG_MAX_LENGTH)
  }

  const fallback = normalized || randomSlugSuffix(SLUG_MIN_LENGTH)
  return fallback.slice(0, SLUG_MAX_LENGTH)
}

/**
 * Generate a slug from name and optional fallback components.
 *
 * @param {object} options
 * @param {string} options.name
 * @param {string[]} [options.fallbacks]
 * @returns {string}
 */
export function generateSlug({ name, fallbacks = [] }) {
  const baseSlug = composeSlug(name, ...fallbacks)
  if (baseSlug.length >= SLUG_MIN_LENGTH) return baseSlug
  return composeSlug(baseSlug, randomSlugSuffix(4))
}

export default generateSlug
