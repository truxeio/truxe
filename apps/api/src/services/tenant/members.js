/**
 * Tenant Member Service
 *
 * Handles RBAC membership logic for tenants including invitations, role
 * updates, and permission inheritance.
 */

import crypto from 'crypto'
import TenantRepository from './repository.js'
import TenantValidationService, { TenantValidationError } from './validation.js'
import CacheManager from './utils/cache-manager.js'
import {
  MEMBER_ROLES,
} from './config.js'
import { AuditLoggerService } from '../audit-logger.js'

const ROLE_PRIORITY = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
  guest: 0,
  custom: 1,
}

export class TenantMemberService {
  constructor({
    repository = new TenantRepository(),
    validationService = new TenantValidationService({ repository }),
    auditLogger = new AuditLoggerService(),
    cache = new CacheManager({ ttl: 60 }),
  } = {}) {
    this.repository = repository
    this.validation = validationService
    this.auditLogger = auditLogger
    this.cache = cache
  }

  async addMember(tenantId, userId, role, invitedBy, { client = null } = {}) {
    if (!MEMBER_ROLES.includes(role)) {
      throw new TenantValidationError('Invalid role specified', { code: 'INVALID_ROLE' })
    }

    const executor = async (trxClient) => {
      const result = await this.repository.query({
        text: `
          INSERT INTO tenant_members (
            tenant_id, user_id, role, permissions, invited_by, invited_at, joined_at, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), NOW(), NOW())
          ON CONFLICT (tenant_id, user_id)
          DO UPDATE SET
            role = EXCLUDED.role,
            permissions = EXCLUDED.permissions,
            invited_by = EXCLUDED.invited_by,
            invited_at = EXCLUDED.invited_at,
            joined_at = NOW(),
            updated_at = NOW()
          RETURNING *
        `,
        values: [tenantId, userId, role, JSON.stringify([]), invitedBy],
        client: trxClient,
        userId: invitedBy,
      })

      await this.auditLogger.logEvent({
        action: 'tenant.member.added',
        orgId: tenantId,
        actorUserId: invitedBy,
        targetType: 'tenant_member',
        targetId: result.rows[0].id,
        details: {
          tenantId,
          userId,
          role,
        },
        category: 'tenant',
      })

      this.cache.delete(CacheManager.key('member', tenantId, userId))

      return this._mapMemberRow(result.rows[0])
    }

    if (client) {
      return executor(client)
    }

    return this.repository.transaction({ userId: invitedBy }, executor)
  }

  async removeMember(tenantId, userId, removedBy, { client = null } = {}) {
    await this.validation._assertRole(removedBy, tenantId, ['owner', 'admin'], {
      client,
      code: 'REMOVE_DENIED',
      action: 'remove member',
    })

    await this._ensureNotLastOwner(tenantId, userId, { client })

    const result = await this.repository.query({
      text: `
        DELETE FROM tenant_members
        WHERE tenant_id = $1 AND user_id = $2
        RETURNING *
      `,
      values: [tenantId, userId],
      userId: removedBy,
      client,
    })

    if (result.rowCount === 0) {
      throw new TenantValidationError('Member not found', { code: 'MEMBER_NOT_FOUND' })
    }

    await this.auditLogger.logEvent({
      action: 'tenant.member.removed',
      orgId: tenantId,
      actorUserId: removedBy,
      targetType: 'tenant_member',
      targetId: result.rows[0].id,
      details: { tenantId, userId },
      category: 'tenant',
    })

    this.cache.delete(CacheManager.key('member', tenantId, userId))
    return this._mapMemberRow(result.rows[0])
  }

  async updateMemberRole(tenantId, userId, newRole, updatedBy, { client = null } = {}) {
    if (!MEMBER_ROLES.includes(newRole)) {
      throw new TenantValidationError('Invalid role specified', { code: 'INVALID_ROLE' })
    }
    await this.validation._assertRole(updatedBy, tenantId, ['owner', 'admin'], {
      client,
      code: 'ROLE_UPDATE_DENIED',
      action: 'update roles',
    })

    await this._ensureNotLastOwner(tenantId, userId, { client, allowDemotion: newRole === 'owner' })

    const result = await this.repository.query({
      text: `
        UPDATE tenant_members
        SET role = $3,
            updated_at = NOW()
        WHERE tenant_id = $1 AND user_id = $2
        RETURNING *
      `,
      values: [tenantId, userId, newRole],
      userId: updatedBy,
      client,
    })

    if (result.rowCount === 0) {
      throw new TenantValidationError('Member not found', { code: 'MEMBER_NOT_FOUND' })
    }

    await this.auditLogger.logEvent({
      action: 'tenant.member.role_updated',
      orgId: tenantId,
      actorUserId: updatedBy,
      targetType: 'tenant_member',
      targetId: result.rows[0].id,
      details: { tenantId, userId, role: newRole },
      category: 'tenant',
    })

    this.cache.delete(CacheManager.key('member', tenantId, userId))
    return this._mapMemberRow(result.rows[0])
  }

  async getMember(tenantId, userId, { client = null } = {}) {
    const cacheKey = CacheManager.key('member', tenantId, userId)
    const cached = this.cache.get(cacheKey)
    if (cached) return cached

    const result = await this.repository.query({
      text: `
        SELECT tm.*, u.email, u.metadata
        FROM tenant_members tm
        LEFT JOIN users u ON u.id = tm.user_id
        WHERE tm.tenant_id = $1 AND tm.user_id = $2
        LIMIT 1
      `,
      values: [tenantId, userId],
      client,
    })
    if (result.rowCount === 0) return null
    const member = this._mapMemberRow(result.rows[0])
    member.user = {
      id: result.rows[0].user_id,
      email: result.rows[0].email || null,
      metadata: result.rows[0].metadata || {},
    }
    this.cache.set(cacheKey, member, 60)
    return member
  }

  async listMembers(tenantId, { filters = {}, client = null } = {}) {
    const values = [tenantId]
    const where = ['tm.tenant_id = $1']

    if (filters.role) {
      values.push(filters.role)
      where.push(`tm.role = $${values.length}`)
    }
    if (filters.joined !== undefined) {
      if (filters.joined) {
        where.push('tm.joined_at IS NOT NULL')
      } else {
        where.push('tm.joined_at IS NULL')
      }
    }

    const result = await this.repository.query({
      text: `
        SELECT tm.*, u.email, u.metadata
        FROM tenant_members tm
        LEFT JOIN users u ON u.id = tm.user_id
        WHERE ${where.join(' AND ')}
        ORDER BY tm.role DESC, tm.joined_at DESC NULLS LAST
      `,
      values,
      client,
    })
    return result.rows.map(row => ({
      ...this._mapMemberRow(row),
      user: {
        id: row.user_id,
        email: row.email || null,
        metadata: row.metadata || {},
      },
    }))
  }

  async inviteMember(tenantId, email, role, invitedBy, { client = null } = {}) {
    if (!MEMBER_ROLES.includes(role)) {
      throw new TenantValidationError('Invalid role specified', { code: 'INVALID_ROLE' })
    }
    await this.validation._assertRole(invitedBy, tenantId, ['owner', 'admin'], {
      client,
      code: 'INVITE_DENIED',
      action: 'invite members',
    })

    const token = crypto.randomBytes(32).toString('hex')
    await this.repository.query({
      text: `
        INSERT INTO tenant_members (
          tenant_id, user_id, role, permissions, invited_by, invited_at, joined_at, created_at, updated_at
        )
        VALUES (
          $1,
          (SELECT id FROM users WHERE email = $2),
          $3,
          '[]'::jsonb,
          $4,
          NOW(),
          NULL,
          NOW(),
          NOW()
        )
        ON CONFLICT (tenant_id, user_id)
        DO UPDATE SET
          role = EXCLUDED.role,
          invited_by = EXCLUDED.invited_by,
          invited_at = NOW(),
          joined_at = NULL,
          updated_at = NOW()
      `,
      values: [tenantId, email, role, invitedBy],
      client,
      userId: invitedBy,
    })

    await this.auditLogger.logEvent({
      action: 'tenant.member.invited',
      orgId: tenantId,
      actorUserId: invitedBy,
      targetType: 'tenant_member_invitation',
      targetId: email,
      details: { email, role, token },
      category: 'tenant',
    })

    return { token, email, role }
  }

  async acceptInvitation(tenantId, userId, { client = null } = {}) {
    const result = await this.repository.query({
      text: `
        UPDATE tenant_members
        SET joined_at = NOW(),
            updated_at = NOW()
        WHERE tenant_id = $1 AND user_id = $2
        RETURNING *
      `,
      values: [tenantId, userId],
      client,
      userId,
    })

    if (result.rowCount === 0) {
      throw new TenantValidationError('Invitation not found', { code: 'INVITATION_NOT_FOUND' })
    }

    await this.auditLogger.logEvent({
      action: 'tenant.member.invitation.accepted',
      orgId: tenantId,
      actorUserId: userId,
      targetType: 'tenant_member',
      targetId: result.rows[0].id,
      details: { tenantId, userId },
      category: 'tenant',
    })

    this.cache.delete(CacheManager.key('member', tenantId, userId))

    return this._mapMemberRow(result.rows[0])
  }

  async rejectInvitation(tenantId, userId, { client = null } = {}) {
    const result = await this.repository.query({
      text: `
        DELETE FROM tenant_members
        WHERE tenant_id = $1 AND user_id = $2 AND joined_at IS NULL
        RETURNING *
      `,
      values: [tenantId, userId],
      client,
      userId,
    })
    if (result.rowCount === 0) {
      throw new TenantValidationError('Invitation not found', { code: 'INVITATION_NOT_FOUND' })
    }
    await this.auditLogger.logEvent({
      action: 'tenant.member.invitation.rejected',
      orgId: tenantId,
      actorUserId: userId,
      targetType: 'tenant_member_invitation',
      targetId: result.rows[0].id,
      details: { tenantId, userId },
      category: 'tenant',
    })
    return true
  }

  async cancelInvitation(tenantId, userId, canceledBy, { client = null } = {}) {
    await this.validation._assertRole(canceledBy, tenantId, ['owner', 'admin'], {
      client,
      code: 'CANCEL_INVITE_DENIED',
      action: 'cancel invitation',
    })

    const result = await this.repository.query({
      text: `
        DELETE FROM tenant_members
        WHERE tenant_id = $1 AND user_id = $2 AND joined_at IS NULL
        RETURNING *
      `,
      values: [tenantId, userId],
      client,
      userId: canceledBy,
    })
    if (result.rowCount === 0) {
      throw new TenantValidationError('Invitation not found', { code: 'INVITATION_NOT_FOUND' })
    }
    await this.auditLogger.logEvent({
      action: 'tenant.member.invitation.cancelled',
      orgId: tenantId,
      actorUserId: canceledBy,
      targetType: 'tenant_member_invitation',
      targetId: result.rows[0].id,
      details: { tenantId, userId },
      category: 'tenant',
    })
    return true
  }

  async listPendingInvitations(tenantId, { client = null } = {}) {
    const result = await this.repository.query({
      text: `
        SELECT tm.*, u.email
        FROM tenant_members tm
        LEFT JOIN users u ON u.id = tm.user_id
        WHERE tm.tenant_id = $1 AND tm.joined_at IS NULL
        ORDER BY tm.invited_at DESC
      `,
      values: [tenantId],
      client,
    })
    return result.rows.map(row => ({
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      email: row.email,
      role: row.role,
      invitedAt: row.invited_at,
      invitedBy: row.invited_by,
    }))
  }

  async getEffectivePermissions(userId, tenantId, { client = null } = {}) {
    const result = await this.repository.query({
      text: `
        SELECT 
          tm.role,
          tm.permissions,
          p.resource_type,
          p.resource_id,
          p.actions
        FROM tenant_members tm
        LEFT JOIN permissions p ON p.user_id = tm.user_id AND p.tenant_id = tm.tenant_id
        WHERE tm.tenant_id = $1 AND tm.user_id = $2 AND tm.joined_at IS NOT NULL
      `,
      values: [tenantId, userId],
      client,
    })
    if (result.rowCount === 0) return null

    const role = result.rows[0].role
    const permissions = result.rows
      .filter(row => row.resource_type)
      .map(row => ({
        resourceType: row.resource_type,
        resourceId: row.resource_id,
        actions: row.actions,
      }))

    return { role, permissions, customPermissions: result.rows[0].permissions || [] }
  }

  async getInheritedPermissions(userId, tenantId, { client = null } = {}) {
    const result = await this.repository.query({
      text: `
        SELECT DISTINCT tm.role, tm.permissions
        FROM tenants t
        JOIN tenants ancestor ON ancestor.id = ANY(t.path)
        JOIN tenant_members tm ON tm.tenant_id = ancestor.id AND tm.user_id = $1
        WHERE t.id = $2 AND tm.joined_at IS NOT NULL
        ORDER BY ancestor.level ASC
      `,
      values: [userId, tenantId],
      client,
    })
    return result.rows.map(row => ({
      role: row.role,
      permissions: row.permissions,
    }))
  }

  async propagatePermissions(tenantId, { client = null } = {}) {
    const members = await this.listMembers(tenantId, { client })
    for (const member of members) {
      await this.repository.query({
        text: `
          UPDATE tenant_members
          SET inherited_from = $1,
              updated_at = NOW()
          WHERE tenant_id IN (
            SELECT descendant.id
            FROM tenants ancestor
            JOIN tenants descendant ON descendant.path @> ARRAY[ancestor.id]
            WHERE ancestor.id = $1 AND descendant.id != ancestor.id
          )
          AND user_id = $2
        `,
        values: [tenantId, member.userId],
        client,
        userId: member.userId,
      })
    }
    return { propagated: members.length }
  }

  async addMultipleMembers(tenantId, members, invitedBy, { client = null } = {}) {
    const results = []
    for (const member of members) {
      results.push(await this.addMember(tenantId, member.userId, member.role, invitedBy, { client }))
    }
    return results
  }

  async transferOwnership(tenantId, fromUserId, toUserId, { client = null } = {}) {
    await this._ensureNotLastOwner(tenantId, fromUserId, { client, allowDemotion: false })
    await this.repository.transaction({ userId: fromUserId }, async trxClient => {
      await this.updateMemberRole(tenantId, toUserId, 'owner', fromUserId, { client: trxClient })
      await this.updateMemberRole(tenantId, fromUserId, 'admin', fromUserId, { client: trxClient })
    })
    await this.auditLogger.logEvent({
      action: 'tenant.member.ownership_transferred',
      orgId: tenantId,
      actorUserId: fromUserId,
      targetType: 'tenant_member',
      targetId: toUserId,
      details: { tenantId, fromUserId, toUserId },
      category: 'tenant',
    })
    return true
  }

  _mapMemberRow(row) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      role: row.role,
      permissions: row.permissions || [],
      inheritedFrom: row.inherited_from,
      invitedBy: row.invited_by,
      invitedAt: row.invited_at,
      joinedAt: row.joined_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  async _ensureNotLastOwner(tenantId, userId, { client = null, allowDemotion = false } = {}) {
    const result = await this.repository.query({
      text: `
        SELECT COUNT(*)::int AS owner_count
        FROM tenant_members
        WHERE tenant_id = $1 AND role = 'owner' AND joined_at IS NOT NULL
      `,
      values: [tenantId],
      client,
    })
    const ownerCount = Number(result.rows[0]?.owner_count || 0)
    if (ownerCount <= 1) {
      const member = await this.getMember(tenantId, userId, { client })
      if (member?.role === 'owner' && !allowDemotion) {
        throw new TenantValidationError('Cannot remove the last owner of tenant', {
          code: 'LAST_OWNER',
        })
      }
    }
  }
}

export default TenantMemberService
