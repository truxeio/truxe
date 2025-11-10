/**
 * Tenant Service
 *
 * Core service orchestrating tenant CRUD operations, validation, lifecycle
 * management, and hierarchy-aware queries.
 */

import TenantRepository from './repository.js'
import TenantValidationService from './validation.js'
import HierarchyService from './hierarchy.js'
import PathService from './path.js'
import TenantLifecycleService from './lifecycle.js'
import TenantMemberService from './members.js'
import CacheManager from './utils/cache-manager.js'
import generateSlug from './utils/slug-generator.js'
import {
  MAX_TENANT_DEPTH,
  TENANT_TYPES,
} from './config.js'
import { AuditLoggerService } from '../audit-logger.js'
import { TenantValidationError } from './validation.js'

export class TenantService {
  constructor({
    repository = new TenantRepository(),
    validationService = new TenantValidationService({ repository }),
    hierarchyService = new HierarchyService({ repository }),
    pathService = new PathService({ repository }),
    lifecycleService = null,
    memberService = new TenantMemberService({ repository }),
    auditLogger = new AuditLoggerService(),
    cache = new CacheManager({ ttl: 60 }),
  } = {}) {
    this.repository = repository
    this.validation = validationService
    this.hierarchy = hierarchyService
    this.path = pathService
    this.lifecycle = lifecycleService || new TenantLifecycleService({
      repository,
      validationService,
      hierarchyService,
      pathService,
      memberService,
      auditLogger,
    })
    this.members = memberService
    this.auditLogger = auditLogger
    this.cache = cache
  }

  async createTenant(data, userId, { client = null } = {}) {
    const isRoot = !data.parentId
    if (isRoot) return this.createRootTenant(data, userId, { client })
    return this.createChildTenant(data.parentId, data, userId, { client })
  }

  async createRootTenant(data, userId, { client = null } = {}) {
    if (!TENANT_TYPES.includes(data.tenantType || '')) {
      throw new TenantValidationError('Invalid tenant type', { code: 'INVALID_TENANT_TYPE' })
    }
    if (data.parentId) {
      throw new TenantValidationError('Root tenants cannot have parent', { code: 'INVALID_PARENT' })
    }

    await this.validation.validateTenantQuota(userId, { client })

    return this.repository.transaction({ userId }, async trxClient => {
      const name = this.validation.enforceNamingConvention(data.name, data.tenantType)
      const rawSlug = data.slug || generateSlug({ name })
      const slug = await this.validation.validateSlug(rawSlug, null, { client: trxClient })

      const result = await this.repository.query({
        text: `
          INSERT INTO tenants (
            parent_tenant_id,
            tenant_type,
            max_depth,
            name,
            slug,
            description,
            settings,
            metadata,
            status,
            created_at,
            updated_at
          ) VALUES (
            NULL,
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            'active',
            NOW(),
            NOW()
          )
          RETURNING *
        `,
        values: [
          data.tenantType,
          data.maxDepth || MAX_TENANT_DEPTH,
          name,
          slug,
          data.description || null,
          this.validation.validateSettings(data.settings),
          this.validation.validateMetadata(data.metadata),
        ],
        client: trxClient,
        userId,
      })

      const tenant = result.rows[0]
      await this.members.addMember(tenant.id, userId, 'owner', userId, { client: trxClient })
      await this.path.rebuildPaths(tenant.id, { userId })
      await this.auditLogger.logEvent({
        action: 'tenant.created.root',
        orgId: tenant.id,
        actorUserId: userId,
        targetType: 'tenant',
        targetId: tenant.id,
        details: { tenantId: tenant.id, name },
        category: 'tenant',
      })
      return tenant
    })
  }

  async createChildTenant(parentId, data, userId, { client = null } = {}) {
    await this.validation.canCreateTenant(userId, parentId, { client })
    await this.validation.validateTenantQuota(userId, { client })
    const parent = await this.validation.validateParent(null, parentId, { client })

    return this.repository.transaction({ userId }, async trxClient => {
      const name = this.validation.enforceNamingConvention(data.name, data.tenantType)
      const rawSlug = data.slug || generateSlug({ name, fallbacks: [parent.slug] })
      const slug = await this.validation.validateSlug(rawSlug, parentId, { client: trxClient })

      const result = await this.repository.query({
        text: `
          INSERT INTO tenants (
            parent_tenant_id,
            tenant_type,
            max_depth,
            name,
            slug,
            description,
            settings,
            metadata,
            status,
            created_at,
            updated_at
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            'active',
            NOW(),
            NOW()
          )
          RETURNING *
        `,
        values: [
          parentId,
          this.validation.validateTenantType(data.tenantType, parent.level + 1),
          data.maxDepth || parent.maxDepth,
          name,
          slug,
          data.description || null,
          this.validation.validateSettings(data.settings),
          this.validation.validateMetadata(data.metadata),
        ],
        client: trxClient,
        userId,
      })

      const tenant = result.rows[0]
      await this.path.rebuildPaths(parentId, { userId })
      await this.members.addMember(tenant.id, userId, 'owner', userId, { client: trxClient })

      await this.auditLogger.logEvent({
        action: 'tenant.created.child',
        orgId: tenant.id,
        actorUserId: userId,
        targetType: 'tenant',
        targetId: tenant.id,
        details: { tenantId: tenant.id, parentId },
        category: 'tenant',
      })

      return tenant
    })
  }

  async getTenantById(tenantId, userId, { includeArchived = false } = {}) {
    const cacheKey = CacheManager.key('tenant', tenantId, userId, includeArchived)
    const cached = this.cache.get(cacheKey)
    if (cached) return cached

    const tenant = await this.repository.findById(tenantId, {
      userId,
      includeArchived,
    })

    if (!tenant) return null
    const ancestors = await this.hierarchy.getAncestors(tenantId, { userId })
    const children = await this.hierarchy.getChildren(tenantId, { userId })
    const enriched = { ...tenant, ancestors, children }
    this.cache.set(cacheKey, enriched)
    return enriched
  }

  async getTenantBySlug(slug, userId, options = {}) {
    const tenant = await this.repository.findBySlug(slug, {
      userId,
      includeArchived: options.includeArchived,
      parentId: options.parentId || null,
    })
    if (!tenant) return null
    const pathString = await this.path.getPathString(tenant.id, { userId })
    return { ...tenant, pathString }
  }

  async listTenants(filters = {}, userId) {
    return this.repository.findByFilters({ filters, userId })
  }

  async searchTenants(query, userId) {
    if (!query) return []
    const result = await this.repository.query({
      text: `
        SELECT *
        FROM tenants
        WHERE (name ILIKE $1 OR slug ILIKE $1)
        AND status != 'archived'
        ORDER BY similarity(name, $2) DESC, created_at DESC
        LIMIT 50
      `,
      values: [`%${query}%`, query],
      userId,
    })
    return result.rows
  }

  async updateTenant(tenantId, updates, userId, { client = null } = {}) {
    await this.validation.canUpdateTenant(userId, tenantId, { client })

    const allowedFields = ['name', 'description', 'tenantType', 'status']
    const setClauses = []
    const values = []
    let index = 1

    if (updates.name) {
      const validatedName = this.validation.enforceNamingConvention(updates.name, updates.tenantType)
      setClauses.push(`name = $${index++}`)
      values.push(validatedName)
    }

    if (updates.description !== undefined) {
      setClauses.push(`description = $${index++}`)
      values.push(updates.description)
    }

    if (updates.tenantType) {
      setClauses.push(`tenant_type = $${index++}`)
      values.push(this.validation.validateTenantType(updates.tenantType))
    }

    if (updates.status) {
      if (!['active', 'suspended', 'archived'].includes(updates.status)) {
        throw new TenantValidationError('Invalid status', { code: 'INVALID_STATUS' })
      }
      setClauses.push(`status = $${index++}`)
      values.push(updates.status)
    }

    if (updates.slug) {
      const tenant = await this.repository.findById(tenantId, { userId, client })
      const validatedSlug = await this.validation.validateSlug(updates.slug, tenant.parentId, { client })
      setClauses.push(`slug = $${index++}`)
      values.push(validatedSlug)
    }

    if (updates.settings) {
      setClauses.push(`settings = $${index++}`)
      values.push(this.validation.validateSettings(updates.settings))
    }

    if (setClauses.length === 0) return this.getTenantById(tenantId, userId)

    values.push(tenantId)

    const result = await this.repository.query({
      text: `
        UPDATE tenants
        SET ${setClauses.join(', ')},
            updated_at = NOW()
        WHERE id = $${index}
        RETURNING *
      `,
      values,
      userId,
      client,
    })

    await this.auditLogger.logEvent({
      action: 'tenant.updated',
      orgId: tenantId,
      actorUserId: userId,
      targetType: 'tenant',
      targetId: tenantId,
      details: { tenantId, fields: allowedFields.filter(field => updates[field] !== undefined) },
      category: 'tenant',
    })

    this.cache.delete(CacheManager.key('tenant', tenantId, userId, false))
    return this.getTenantById(tenantId, userId)
  }

  async updateTenantSettings(tenantId, settings, userId, options = {}) {
    await this.validation.canUpdateTenant(userId, tenantId, options)
    const validatedSettings = this.validation.validateSettings(settings)

    const result = await this.repository.query({
      text: `
        UPDATE tenants
        SET settings = $2,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      values: [tenantId, validatedSettings],
      userId,
    })

    await this.auditLogger.logEvent({
      action: 'tenant.settings.updated',
      orgId: tenantId,
      actorUserId: userId,
      targetType: 'tenant',
      targetId: tenantId,
      details: { tenantId },
      category: 'tenant',
    })

    return this.getTenantById(tenantId, userId)
  }

  async moveTenant(tenantId, newParentId, userId, options = {}) {
    return this.lifecycle.moveTenant(tenantId, newParentId, userId, options)
  }

  async deleteTenant(tenantId, userId, options = {}) {
    return this.lifecycle.permanentlyDelete(tenantId, userId, options)
  }

  async archiveTenant(tenantId, userId, options = {}) {
    return this.lifecycle.archiveTenant(tenantId, userId, options)
  }

  async restoreTenant(tenantId, userId, options = {}) {
    return this.lifecycle.restoreTenant(tenantId, userId, options)
  }
}

export default TenantService
