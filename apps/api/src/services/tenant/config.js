/**
 * Tenant Service Configuration
 *
 * Centralizes hierarchy limits, naming rules, caching, and performance
 * thresholds for the tenant service layer. These values mirror the
 * multi-tenancy database schema defaults (see migration 030).
 */

export const MAX_TENANT_DEPTH = 5
export const MIN_TENANT_DEPTH = 2
export const MAX_CHILDREN_PER_TENANT = 100

export const SLUG_MIN_LENGTH = 2
export const SLUG_MAX_LENGTH = 63
export const NAME_MIN_LENGTH = 1
export const NAME_MAX_LENGTH = 255

export const TENANT_TYPES = [
  'workspace',
  'team',
  'project',
  'department',
  'division',
  'organization',
]

export const MEMBER_ROLES = [
  'owner',
  'admin',
  'member',
  'viewer',
  'guest',
  'custom',
]

export const CACHE_TTL = 300 // seconds
export const ENABLE_CACHING = true

export const QUERY_TIMEOUT = 5000 // milliseconds
export const MAX_BATCH_SIZE = 100

export default {
  MAX_TENANT_DEPTH,
  MIN_TENANT_DEPTH,
  MAX_CHILDREN_PER_TENANT,
  SLUG_MIN_LENGTH,
  SLUG_MAX_LENGTH,
  NAME_MIN_LENGTH,
  NAME_MAX_LENGTH,
  TENANT_TYPES,
  MEMBER_ROLES,
  CACHE_TTL,
  ENABLE_CACHING,
  QUERY_TIMEOUT,
  MAX_BATCH_SIZE,
}
