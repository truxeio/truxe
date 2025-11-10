/**
 * Tenant Validation Service
 *
 * Provides schema validation, hierarchy constraint checks, and permission
 * enforcement for tenant operations. Uses Zod for structural validation and
 * relies on repository/database queries for business rule enforcement.
 */

import { z } from 'zod'
import TenantRepository from './repository.js'
import CacheManager from './utils/cache-manager.js'
import {
  MAX_TENANT_DEPTH,
  MIN_TENANT_DEPTH,
  MAX_CHILDREN_PER_TENANT,
  SLUG_MIN_LENGTH,
  SLUG_MAX_LENGTH,
  NAME_MIN_LENGTH,
  NAME_MAX_LENGTH,
  TENANT_TYPES,
  MEMBER_ROLES,
} from './config.js'

export class TenantValidationError extends Error {
  constructor(message, { code = 'VALIDATION_ERROR', details = null } = {}) {
    super(message)
    this.name = 'TenantValidationError'
    this.code = code
    this.details = details
  }
}

const settingsSchema = z.record(z.any()).max(1000, { message: 'Settings payload too large' })
const metadataSchema = z.record(z.any()).max(1000, { message: 'Metadata payload too large' })

const slugSchema = z
  .string()
  .min(SLUG_MIN_LENGTH)
  .max(SLUG_MAX_LENGTH)
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Slug must use lowercase letters, numbers, and hyphens')

const nameSchema = z
  .string()
  .min(NAME_MIN_LENGTH, 'Name is required')
  .max(NAME_MAX_LENGTH, 'Name is too long')
  .transform(value => value.trim())

const tenantTypeSchema = z.enum(TENANT_TYPES)

const roleSchema = z.enum(MEMBER_ROLES)

const DEFAULT_TENANT_QUOTA = 200

/**
 * Validation service for tenant operations.
 */
export class TenantValidationService {
  constructor({
    repository = new TenantRepository(),
    cache = new CacheManager({ ttl: 60 }),
    tenantQuota = DEFAULT_TENANT_QUOTA,
  } = {}) {
    this.repository = repository
    this.cache = cache
    this.tenantQuota = tenantQuota
  }

  /**
   * Validate tenant name and return trimmed value.
   */
  validateName(name) {
    try {
      return nameSchema.parse(name)
    } catch (error) {
      throw new TenantValidationError(error.message, { code: 'INVALID_NAME' })
    }
  }

  /**
   * Validate tenant slug and ensure uniqueness within parent scope.
   */
  async validateSlug(slug, parentId, { client } = {}) {
    let parsedSlug
    try {
      parsedSlug = slugSchema.parse(slug)
    } catch (error) {
      throw new TenantValidationError(error.message, { code: 'INVALID_SLUG' })
    }

    const existing = await this.repository.findBySlug(parsedSlug, {
      parentId,
      includeArchived: false,
      client,
    })

    if (existing) {
      throw new TenantValidationError('Slug already in use for this parent tenant', {
        code: 'DUPLICATE_SLUG',
      })
    }

    return parsedSlug
  }

  /**
   * Validate tenant type for a given level.
   */
  validateTenantType(type, level = 0) {
    try {
      tenantTypeSchema.parse(type)
    } catch (error) {
      throw new TenantValidationError(error.message, { code: 'INVALID_TENANT_TYPE' })
    }

    // Example rule: Root tenants must be workspace/organization
    if (level === 0 && !['workspace', 'organization'].includes(type)) {
      throw new TenantValidationError('Root tenants must be workspace or organization', {
        code: 'INVALID_ROOT_TYPE',
      })
    }

    return type
  }

  /**
   * Validate tenant settings against schema.
   */
  validateSettings(settings) {
    try {
      return settingsSchema.parse(settings || {})
    } catch (error) {
      throw new TenantValidationError(error.message, { code: 'INVALID_SETTINGS' })
    }
  }

  /**
   * Validate tenant metadata payload.
   */
  validateMetadata(metadata) {
    try {
      return metadataSchema.parse(metadata || {})
    } catch (error) {
      throw new TenantValidationError(error.message, { code: 'INVALID_METADATA' })
    }
  }

  /**
   * Validate parent relationship constraints.
   */
  async validateParent(tenantId, parentId, { client } = {}) {
    if (!parentId) return null
    if (tenantId && tenantId === parentId) {
      throw new TenantValidationError('Tenant cannot be its own parent', {
        code: 'INVALID_PARENT',
      })
    }

    const parent = await this.repository.findById(parentId, { client })
    if (!parent) {
      throw new TenantValidationError('Parent tenant not found', {
        code: 'PARENT_NOT_FOUND',
      })
    }

    if (parent.status === 'archived') {
      throw new TenantValidationError('Cannot assign archived tenant as parent', {
        code: 'ARCHIVED_PARENT',
      })
    }

    return parent
  }

  /**
   * Validate maximum depth constraint.
   */
  validateDepth(level, maxDepth) {
    if (level < 0) {
      throw new TenantValidationError('Level must be non-negative', { code: 'INVALID_LEVEL' })
    }
    if (maxDepth < MIN_TENANT_DEPTH || maxDepth > MAX_TENANT_DEPTH) {
      throw new TenantValidationError('Max depth out of bounds', { code: 'INVALID_MAX_DEPTH' })
    }
    if (level > maxDepth) {
      throw new TenantValidationError('Hierarchy depth exceeds maximum allowed', {
        code: 'DEPTH_EXCEEDED',
      })
    }
    return true
  }

  /**
   * Ensure no circular reference when changing parent.
   */
  async validateCircularReference(tenantId, parentId, { client } = {}) {
    if (!tenantId || !parentId) return true

    const result = await this.repository.query({
      text: `
        SELECT 1
        FROM tenants
        WHERE id = $1
        AND $2 = ANY(path)
        LIMIT 1
      `,
      values: [parentId, tenantId],
      client,
    })

    if (result.rowCount > 0) {
      throw new TenantValidationError('Circular reference detected in tenant hierarchy', {
        code: 'CIRCULAR_REFERENCE',
      })
    }
    return true
  }

  /**
   * Validate children count for business rule enforcement.
   */
  async validateMaxChildren(parentId, { client } = {}) {
    if (!parentId || !MAX_CHILDREN_PER_TENANT) return true

    const cacheKey = CacheManager.key('child-count', parentId)
    const cached = this.cache.get(cacheKey)
    if (cached !== null) {
      if (cached >= MAX_CHILDREN_PER_TENANT) {
        throw new TenantValidationError('Parent tenant has reached maximum children count', {
          code: 'MAX_CHILDREN_REACHED',
        })
      }
      return true
    }

    const result = await this.repository.query({
      text: `
        SELECT COUNT(*)::int AS child_count
        FROM tenants
        WHERE parent_tenant_id = $1
        AND status != 'archived'
      `,
      values: [parentId],
      client,
    })
    const childCount = Number(result.rows[0]?.child_count || 0)
    this.cache.set(cacheKey, childCount, 30)

    if (childCount >= MAX_CHILDREN_PER_TENANT) {
      throw new TenantValidationError('Parent tenant has reached maximum children count', {
        code: 'MAX_CHILDREN_REACHED',
        details: { count: childCount, limit: MAX_CHILDREN_PER_TENANT },
      })
    }
    return true
  }

  /**
   * Ensure user has permission to create tenant.
   */
  async canCreateTenant(userId, parentId, { client } = {}) {
    if (!userId) {
      throw new TenantValidationError('User ID required for permission check', {
        code: 'INVALID_USER',
      })
    }
    if (!parentId) {
      // Root tenant creation is system-level; assume higher-level verification
      return true
    }
    const cacheKey = CacheManager.key('create', userId, parentId)
    const cached = this.cache.get(cacheKey)
    if (cached !== null) return cached

    const result = await this.repository.query({
      text: `
        SELECT role
        FROM tenant_members
        WHERE tenant_id = $1
        AND user_id = $2
        AND joined_at IS NOT NULL
        LIMIT 1
      `,
      values: [parentId, userId],
      client,
    })

    if (result.rowCount === 0) {
      throw new TenantValidationError('User does not have access to parent tenant', {
        code: 'PERMISSION_DENIED',
      })
    }

    const role = result.rows[0].role
    if (!['owner', 'admin'].includes(role)) {
      throw new TenantValidationError('Only owners or admins can create child tenants', {
        code: 'INSUFFICIENT_ROLE',
        details: { role },
      })
    }

    this.cache.set(cacheKey, true, 60)
    return true
  }

  /**
   * Permission check for tenant updates.
   */
  async canUpdateTenant(userId, tenantId, { client } = {}) {
    return this._assertRole(userId, tenantId, ['owner', 'admin'], {
      client,
      code: 'UPDATE_DENIED',
      action: 'update tenant',
    })
  }

  /**
   * Permission check for deleting tenants.
   */
  async canDeleteTenant(userId, tenantId, { client } = {}) {
    return this._assertRole(userId, tenantId, ['owner'], {
      client,
      code: 'DELETE_DENIED',
      action: 'delete tenant',
    })
  }

  /**
   * Permission check for moving tenants.
   */
  async canMoveTenant(userId, tenantId, newParentId, { client } = {}) {
    await this._assertRole(userId, tenantId, ['owner', 'admin'], {
      client,
      code: 'MOVE_DENIED',
      action: 'move tenant',
    })
    if (newParentId) {
      return this._assertRole(userId, newParentId, ['owner', 'admin'], {
        client,
        code: 'MOVE_DENIED',
        action: 'move tenant to new parent',
      })
    }
    return true
  }

  /**
   * Enforce simple naming convention rules.
   */
  enforceNamingConvention(name, type) {
    const trimmed = this.validateName(name)
    if (/^\d+$/.test(trimmed)) {
      throw new TenantValidationError('Tenant name cannot be numeric only', {
        code: 'INVALID_NAME_FORMAT',
      })
    }

    if (type === 'project' && !/[a-zA-Z]/.test(trimmed)) {
      throw new TenantValidationError('Project names must include letters', {
        code: 'INVALID_NAME_FORMAT',
      })
    }
    return trimmed
  }

  /**
   * Ensure total tenant count stays within quota for user.
   */
  async validateTenantQuota(userId, { client } = {}) {
    if (!userId) return true
    const cacheKey = CacheManager.key('quota', userId)
    const cached = this.cache.get(cacheKey)
    if (cached !== null && cached.count < this.tenantQuota) {
      return true
    }

    const result = await this.repository.query({
      text: `
        SELECT COUNT(*)::int AS tenant_count
        FROM tenant_members
        WHERE user_id = $1
        AND joined_at IS NOT NULL
      `,
      values: [userId],
      client,
    })

    const tenantCount = Number(result.rows[0]?.tenant_count || 0)
    this.cache.set(cacheKey, { count: tenantCount }, 120)

    if (tenantCount >= this.tenantQuota) {
      throw new TenantValidationError('Tenant quota exceeded for user', {
        code: 'TENANT_QUOTA_EXCEEDED',
        details: { count: tenantCount, quota: this.tenantQuota },
      })
    }
    return true
  }

  /**
   * Enforce aggregate tenant limits for parent.
   */
  async enforceTenantLimits(parentId, { client } = {}) {
    return this.validateMaxChildren(parentId, { client })
  }

  /**
   * Validate move operation constraints.
   */
  async validateMove(tenantId, newParentId, { client } = {}) {
    if (!tenantId) {
      throw new TenantValidationError('Tenant ID is required for move validation', {
        code: 'INVALID_TENANT',
      })
    }
    if (tenantId === newParentId) {
      throw new TenantValidationError('Tenant cannot be moved under itself', {
        code: 'INVALID_PARENT',
      })
    }
    const tenant = await this.repository.findById(tenantId, { client })
    if (!tenant) {
      throw new TenantValidationError('Tenant not found', { code: 'TENANT_NOT_FOUND' })
    }
    const parent = await this.validateParent(tenantId, newParentId, { client })
    if (parent) {
      this.validateDepth(parent.level + 1, parent.maxDepth)
      await this.validateCircularReference(tenantId, newParentId, { client })
      await this.validateMaxChildren(newParentId, { client })
    }
    return { tenant, parent }
  }

  /**
   * Validate change of max depth constraint.
   */
  async validateDepthChange(tenantId, newMaxDepth, { client } = {}) {
    if (newMaxDepth < MIN_TENANT_DEPTH || newMaxDepth > MAX_TENANT_DEPTH) {
      throw new TenantValidationError('New max depth is out of allowed range', {
        code: 'INVALID_MAX_DEPTH',
      })
    }
    const tenant = await this.repository.findById(tenantId, { client })
    if (!tenant) {
      throw new TenantValidationError('Tenant not found', { code: 'TENANT_NOT_FOUND' })
    }
    if (tenant.level > newMaxDepth) {
      throw new TenantValidationError('Tenant level exceeds the new max depth', {
        code: 'DEPTH_EXCEEDED',
        details: { level: tenant.level, newMaxDepth },
      })
    }
    return tenant
  }

  /**
   * Internal helper to assert user role membership.
   */
  async _assertRole(userId, tenantId, allowedRoles, { client, code, action }) {
    if (!userId || !tenantId) {
      throw new TenantValidationError('User and tenant required for permission check', {
        code: 'INVALID_PERMISSION_CONTEXT',
      })
    }

    const cacheKey = CacheManager.key('role', userId, tenantId)
    const cached = this.cache.get(cacheKey)
    if (cached) {
      if (!allowedRoles.includes(cached.role)) {
        throw new TenantValidationError(`User cannot ${action}`, {
          code,
          details: { role: cached.role, allowedRoles },
        })
      }
      return true
    }

    const result = await this.repository.query({
      text: `
        SELECT role
        FROM tenant_members
        WHERE tenant_id = $1
        AND user_id = $2
        AND joined_at IS NOT NULL
        LIMIT 1
      `,
      values: [tenantId, userId],
      client,
    })

    if (result.rowCount === 0) {
      throw new TenantValidationError(`User is not a member of this tenant`, {
        code,
        details: { allowedRoles },
      })
    }

    const role = result.rows[0].role
    this.cache.set(cacheKey, { role }, 60)

    if (!allowedRoles.includes(role)) {
      throw new TenantValidationError(`User cannot ${action}`, {
        code,
        details: { role, allowedRoles },
      })
    }

    return true
  }
}

export default TenantValidationService
