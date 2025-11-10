/**
 * Tenant path utilities for working with the materialized path column.
 */

/**
 * Format a tenant path array into a human-readable string.
 *
 * @param {Array<{ id: string, name: string }>|string[]} pathSegments
 * @param {object} options
 * @param {string} [options.separator=' > ']
 * @param {boolean} [options.includeIds=false]
 * @returns {string}
 */
export function formatPathString(pathSegments, { separator = ' > ', includeIds = false } = {}) {
  if (!Array.isArray(pathSegments) || pathSegments.length === 0) return ''

  return pathSegments
    .map(segment => {
      if (typeof segment === 'string') return segment
      if (!segment || typeof segment !== 'object') return ''
      return includeIds ? `${segment.name} (${segment.id})` : segment.name
    })
    .filter(Boolean)
    .join(separator)
}

/**
 * Convert a UUID array representing the path into SQL-ready text literal.
 * Useful for building dynamic queries.
 *
 * @param {string[]} ids
 * @returns {string}
 */
export function toPathLiteral(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return '{}'
  const escaped = ids.map(id => `"${id}"`).join(',')
  return `{${escaped}}`
}

/**
 * Determines the depth difference between two paths.
 *
 * @param {string[]} ancestorPath
 * @param {string[]} descendantPath
 * @returns {number|null}
 */
export function getPathDistance(ancestorPath, descendantPath) {
  if (!Array.isArray(ancestorPath) || !Array.isArray(descendantPath)) return null
  if (ancestorPath.length > descendantPath.length) return null
  const prefix = descendantPath.slice(0, ancestorPath.length)
  const isPrefix = prefix.every((value, index) => value === ancestorPath[index])
  if (!isPrefix) return null
  return descendantPath.length - ancestorPath.length
}

export default {
  formatPathString,
  toPathLiteral,
  getPathDistance,
}
