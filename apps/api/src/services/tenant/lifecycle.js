/**
 * Tenant Lifecycle Service
 *
 * Handles advanced tenant lifecycle operations such as archiving, moving,
 * merging, and copying tenants. All operations are transactionally safe and
 * integrate with validation, hierarchy, and membership services.
 */

import TenantRepository from './repository.js'
import TenantValidationService from './validation.js'
import HierarchyService from './hierarchy.js'
import PathService from './path.js'
import TenantMemberService from './members.js'
import { AuditLoggerService } from '../audit-logger.js'
import { TenantValidationError } from './validation.js'

export class TenantLifecycleService {
  constructor({
    repository = new TenantRepository(),
    validationService = new TenantValidationService({ repository }),
    hierarchyService = new HierarchyService({ repository }),
    pathService = new PathService({ repository }),
    memberService = new TenantMemberService({ repository }),
    auditLogger = new AuditLoggerService(),
  } = {}) {
    this.repository = repository
    this.validation = validationService
    this.hierarchy = hierarchyService
    this.path = pathService
    this.members = memberService
    this.auditLogger = auditLogger
  }

  async archiveTenant(tenantId, userId, { client = null } = {}) {
    await this.validation.canDeleteTenant(userId, tenantId, { client })

    return this.repository.transaction({ userId }, async trxClient => {
      const tenant = await this.repository.findById(tenantId, { client: trxClient, includeArchived: true })
      if (!tenant) {
        throw new TenantValidationError('Tenant not found', { code: 'TENANT_NOT_FOUND' })
      }

      const result = await this.repository.query({
        text: `
          UPDATE tenants
          SET status = 'archived',
              archived_at = NOW(),
              updated_at = NOW()
          WHERE id = $1
          RETURNING *
        `,
        values: [tenantId],
        client: trxClient,
        userId,
      })

      await this.auditLogger.logEvent({
        action: 'tenant.archived',
        orgId: tenantId,
        actorUserId: userId,
        targetType: 'tenant',
        targetId: tenantId,
        details: { tenantId },
        category: 'tenant',
      })

      return result.rows[0]
    })
  }

  async archiveSubtree(tenantId, userId, { client = null } = {}) {
    await this.validation.canDeleteTenant(userId, tenantId, { client })

    return this.repository.transaction({ userId }, async trxClient => {
      const result = await this.repository.query({
        text: `
          UPDATE tenants
          SET status = 'archived',
              archived_at = NOW(),
              updated_at = NOW()
          WHERE path @> ARRAY[$1]::uuid[]
          RETURNING id
        `,
        values: [tenantId],
        client: trxClient,
        userId,
      })

      await this.auditLogger.logEvent({
        action: 'tenant.subtree.archived',
        orgId: tenantId,
        actorUserId: userId,
        targetType: 'tenant',
        targetId: tenantId,
        details: { tenantId, archivedCount: result.rowCount },
        category: 'tenant',
      })

      return { archived: result.rowCount }
    })
  }

  async restoreTenant(tenantId, userId, { client = null } = {}) {
    await this.validation.canUpdateTenant(userId, tenantId, { client })

    const result = await this.repository.query({
      text: `
        UPDATE tenants
        SET status = 'active',
            archived_at = NULL,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      values: [tenantId],
      userId,
      client,
    })
    if (result.rowCount === 0) {
      throw new TenantValidationError('Tenant not found', { code: 'TENANT_NOT_FOUND' })
    }

    await this.auditLogger.logEvent({
      action: 'tenant.restored',
      orgId: tenantId,
      actorUserId: userId,
      targetType: 'tenant',
      targetId: tenantId,
      details: { tenantId },
      category: 'tenant',
    })
    return result.rows[0]
  }

  async permanentlyDelete(tenantId, userId, { client = null } = {}) {
    await this.validation.canDeleteTenant(userId, tenantId, { client })

    return this.repository.transaction({ userId }, async trxClient => {
      await this.repository.query({
        text: `
          DELETE FROM tenants
          WHERE path @> ARRAY[$1]::uuid[]
        `,
        values: [tenantId],
        client: trxClient,
        userId,
      })

      await this.auditLogger.logEvent({
        action: 'tenant.deleted',
        orgId: tenantId,
        actorUserId: userId,
        targetType: 'tenant',
        targetId: tenantId,
        details: { tenantId },
        category: 'tenant',
      })

      return true
    })
  }

  async moveTenant(tenantId, newParentId, userId, { client = null } = {}) {
    await this.validation.canMoveTenant(userId, tenantId, newParentId, { client })
    const { parent } = await this.validation.validateMove(tenantId, newParentId, { client })

    return this.repository.transaction({ userId }, async trxClient => {
      await this.repository.query({
        text: `
          UPDATE tenants
          SET parent_tenant_id = $2,
              max_depth = COALESCE($3, max_depth),
              updated_at = NOW()
          WHERE id = $1
        `,
        values: [tenantId, newParentId, parent?.maxDepth ?? null],
        client: trxClient,
        userId,
      })

      await this.path.rebuildPaths(newParentId || tenantId, { userId })

      await this.auditLogger.logEvent({
        action: 'tenant.moved',
        orgId: tenantId,
        actorUserId: userId,
        targetType: 'tenant',
        targetId: tenantId,
        details: { tenantId, newParentId },
        category: 'tenant',
      })

      return this.repository.findById(tenantId, { client: trxClient })
    })
  }

  async moveSubtree(tenantId, newParentId, userId, options = {}) {
    await this.validation.canMoveTenant(userId, tenantId, newParentId, options)

    const subtree = await this.hierarchy.getFullHierarchy(tenantId, options)
    if (!subtree.length) {
      throw new TenantValidationError('Tenant not found', { code: 'TENANT_NOT_FOUND' })
    }

    if (newParentId) {
      const parent = await this.repository.findById(newParentId, options)
      if (!parent) {
        throw new TenantValidationError('Destination parent not found', { code: 'PARENT_NOT_FOUND' })
      }
      const maxDepth = parent.maxDepth
      const deepestLevel = subtree.reduce(
        (depth, node) => Math.max(depth, node.level),
        subtree[0].level,
      )
      const depthDelta = deepestLevel - subtree[0].level
      if (parent.level + depthDelta >= maxDepth) {
        throw new TenantValidationError('Move would exceed maximum depth of destination', {
          code: 'DEPTH_EXCEEDED',
        })
      }
    }

    return this.moveTenant(tenantId, newParentId, userId, options)
  }

  async validateMove(tenantId, newParentId, options = {}) {
    return this.validation.validateMove(tenantId, newParentId, options)
  }

  async mergeTenants(sourceTenantId, targetTenantId, userId, options = {}) {
    if (sourceTenantId === targetTenantId) {
      throw new TenantValidationError('Cannot merge tenant with itself', {
        code: 'INVALID_MERGE',
      })
    }

    await this.validation.canUpdateTenant(userId, targetTenantId, options)
    await this.validation.canDeleteTenant(userId, sourceTenantId, options)

    return this.repository.transaction({ userId }, async client => {
      // Merge members and permissions
      await this.mergeMembers(sourceTenantId, targetTenantId, { client, userId })
      await this.mergePermissions(sourceTenantId, targetTenantId, { client, userId })

      // Re-parent children of source to target
      await this.repository.query({
        text: `
          UPDATE tenants
          SET parent_tenant_id = $2,
              updated_at = NOW()
          WHERE parent_tenant_id = $1
        `,
        values: [sourceTenantId, targetTenantId],
        client,
        userId,
      })

      // Archive source tenant after merge
      await this.repository.query({
        text: `
          UPDATE tenants
          SET status = 'archived',
              archived_at = NOW(),
              updated_at = NOW()
          WHERE id = $1
        `,
        values: [sourceTenantId],
        client,
        userId,
      })

      await this.auditLogger.logEvent({
        action: 'tenant.merged',
        orgId: targetTenantId,
        actorUserId: userId,
        targetType: 'tenant',
        targetId: targetTenantId,
        details: { sourceTenantId, targetTenantId },
        category: 'tenant',
      })

      await this.path.rebuildPaths(targetTenantId, { userId })
      return true
    })
  }

  async mergeMembers(sourceTenantId, targetTenantId, { client = null, userId = null } = {}) {
    const sourceMembers = await this.members.listMembers(sourceTenantId, { client })
    const targetMembers = await this.members.listMembers(targetTenantId, { client })
    const targetRoles = new Map(targetMembers.map(member => [member.userId, member.role]))

    for (const member of sourceMembers) {
      const existingRole = targetRoles.get(member.userId)
      if (existingRole) {
        // Promote to higher role if necessary
        const promotedRole = this._higherRole(existingRole, member.role)
        if (promotedRole !== existingRole) {
          await this.members.updateMemberRole(targetTenantId, member.userId, promotedRole, userId, { client })
        }
      } else {
        await this.members.addMember(targetTenantId, member.userId, member.role, userId, { client })
      }
    }
    return { merged: sourceMembers.length }
  }

  async mergePermissions(sourceTenantId, targetTenantId, { client = null, userId = null } = {}) {
    await this.repository.query({
      text: `
        INSERT INTO permissions (
          user_id, tenant_id, resource_type, resource_id, actions, conditions, granted_by, expires_at, created_at, updated_at
        )
        SELECT
          user_id,
          $2,
          resource_type,
          resource_id,
          actions,
          conditions,
          granted_by,
          expires_at,
          NOW(),
          NOW()
        FROM permissions
        WHERE tenant_id = $1
        ON CONFLICT (user_id, tenant_id, resource_type, (COALESCE(resource_id, '')))
        DO UPDATE SET
          actions = ARRAY(SELECT DISTINCT unnest(permissions.actions || EXCLUDED.actions)),
          updated_at = NOW()
      `,
      values: [sourceTenantId, targetTenantId],
      client,
      userId,
    })
    return true
  }

  async copyTenant(tenantId, newParentId, userId, { cloneSettings = true, client = null } = {}) {
    await this.validation.canCreateTenant(userId, newParentId, { client })

    return this.repository.transaction({ userId }, async trxClient => {
      const tenant = await this.repository.findById(tenantId, { client: trxClient })
      if (!tenant) {
        throw new TenantValidationError('Tenant not found', { code: 'TENANT_NOT_FOUND' })
      }

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
          SELECT
            $2,
            tenant_type,
            max_depth,
            name || ' Copy',
            slug || '-' || substr(md5(gen_random_uuid()::text), 1, 6),
            description,
            CASE WHEN $4 THEN settings ELSE '{}'::jsonb END,
            metadata,
            'active',
            NOW(),
            NOW()
          FROM tenants
          WHERE id = $1
          RETURNING *
        `,
        values: [tenantId, newParentId, userId, cloneSettings],
        client: trxClient,
        userId,
      })

      const newTenant = result.rows[0]
      await this.path.rebuildPaths(newTenant.id, { userId })

      await this.auditLogger.logEvent({
        action: 'tenant.copied',
        orgId: tenantId,
        actorUserId: userId,
        targetType: 'tenant',
        targetId: newTenant.id,
        details: { tenantId, newTenantId: newTenant.id, newParentId },
        category: 'tenant',
      })

      return newTenant
    })
  }

  async duplicateSubtree(tenantId, newParentId, userId, options = {}) {
    const subtree = await this.hierarchy.getFullHierarchy(tenantId, options)
    if (subtree.length === 0) {
      throw new TenantValidationError('Tenant not found', { code: 'TENANT_NOT_FOUND' })
    }

    return this.repository.transaction({ userId }, async client => {
      const sourceToNewId = new Map()
      for (const node of subtree) {
        const parentNewId = node.parentId ? sourceToNewId.get(node.parentId) || newParentId : newParentId
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
              $5 || '-' || substr(md5(gen_random_uuid()::text), 1, 6),
              $6,
              $7,
              $8,
              'active',
              NOW(),
              NOW()
            )
            RETURNING id
          `,
          values: [
            parentNewId,
            node.tenantType,
            node.maxDepth,
            `${node.name} Copy`,
            node.slug,
            node.description,
            node.settings,
            node.metadata,
          ],
          client,
          userId,
        })
        sourceToNewId.set(node.id, result.rows[0].id)
      }

      await this.path.rebuildPaths(sourceToNewId.get(subtree[0].id), { userId })
      return { created: sourceToNewId.size, rootId: sourceToNewId.get(subtree[0].id) }
    })
  }

  async convertToRootTenant(tenantId, userId, options = {}) {
    await this.validation.canMoveTenant(userId, tenantId, null, options)
    return this.moveTenant(tenantId, null, userId, options)
  }

  async changeMaxDepth(tenantId, newMaxDepth, userId, options = {}) {
    await this.validation.canUpdateTenant(userId, tenantId, options)
    await this.validation.validateDepthChange(tenantId, newMaxDepth, options)

    const result = await this.repository.query({
      text: `
        UPDATE tenants
        SET max_depth = $2,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      values: [tenantId, newMaxDepth],
      userId,
    })

    await this.auditLogger.logEvent({
      action: 'tenant.max_depth_changed',
      orgId: tenantId,
      actorUserId: userId,
      targetType: 'tenant',
      targetId: tenantId,
      details: { tenantId, newMaxDepth },
      category: 'tenant',
    })

    return result.rows[0]
  }

  _higherRole(roleA, roleB) {
    return (ROLE_PRIORITY[roleA] || 0) >= (ROLE_PRIORITY[roleB] || 0) ? roleA : roleB
  }
}

const ROLE_PRIORITY = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
  guest: 0,
  custom: 1,
}

export default TenantLifecycleService
