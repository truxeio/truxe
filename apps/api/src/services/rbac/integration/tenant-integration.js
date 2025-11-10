/**
 * Tenant RBAC Integration
 * 
 * Provides hooks for tenant service lifecycle events to maintain
 * RBAC consistency across the tenant hierarchy.
 */

import { DEFAULT_ROLES, AUDIT_EVENTS } from '../config.js'

export class TenantRBACIntegration {
  constructor(database, auditLogger, permissionService, authorizationService) {
    this.db = database
    this.auditLogger = auditLogger
    this.permissionService = permissionService
    this.authorizationService = authorizationService
  }

  // ===================================================================
  // TENANT LIFECYCLE HOOKS
  // ===================================================================

  /**
   * Handle tenant creation - set up initial permissions
   */
  async onTenantCreated(tenant, ownerId) {
    try {
      // Begin transaction
      const client = await this.db.connect()
      await client.query('BEGIN')

      try {
        // Grant owner permissions to creator
        await this.permissionService.grantPermission(
          ownerId,
          tenant.id,
          'tenants:*',
          ['read', 'write', 'admin', 'delete'],
          { 
            grantedBy: ownerId, 
            client 
          }
        )

        // Grant comprehensive permissions for tenant management
        const ownerPermissions = [
          { resource: 'members:*', actions: ['read', 'write', 'invite', 'remove', 'manage'] },
          { resource: 'permissions:*', actions: ['read', 'write', 'grant', 'revoke', 'admin'] },
          { resource: 'projects:*', actions: ['read', 'write', 'create', 'delete', 'admin'] },
          { resource: 'integrations:*', actions: ['read', 'write', 'create', 'delete', 'configure'] },
          { resource: 'settings:*', actions: ['read', 'write', 'admin'] }
        ]

        for (const perm of ownerPermissions) {
          await this.permissionService.grantPermission(
            ownerId,
            tenant.id,
            perm.resource,
            perm.actions,
            { grantedBy: ownerId, client }
          )
        }

        // Log audit event
        await this.auditLogger.logEvent({
          action: 'tenant.rbac.initialized',
          orgId: tenant.id,
          actorUserId: ownerId,
          targetType: 'tenant',
          targetId: tenant.id,
          details: {
            tenantName: tenant.name,
            permissionsGranted: ownerPermissions.length + 1,
            role: 'owner'
          },
          category: 'rbac'
        })

        await client.query('COMMIT')
        return { success: true, permissionsGranted: ownerPermissions.length + 1 }
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    } catch (error) {
      console.error('Failed to initialize RBAC for new tenant:', error)
      throw new Error(`RBAC initialization failed: ${error.message}`)
    }
  }

  /**
   * Handle tenant deletion - clean up permissions
   */
  async onTenantDeleted(tenantId) {
    try {
      // Get all users with permissions on this tenant
      const permissionUsers = await this.db.query(`
        SELECT DISTINCT user_id FROM permissions WHERE tenant_id = $1
      `, [tenantId])

      // Delete all permissions for this tenant
      const deleteResult = await this.db.query(`
        DELETE FROM permissions WHERE tenant_id = $1
      `, [tenantId])

      // Delete all policies for this tenant
      const policyDeleteResult = await this.db.query(`
        DELETE FROM policies WHERE tenant_id = $1
      `, [tenantId])

      // Clear cache for affected users
      for (const row of permissionUsers.rows) {
        await this.authorizationService.cache?.invalidateUserCache?.(row.user_id)
      }

      // Log audit event
      await this.auditLogger.logEvent({
        action: 'tenant.rbac.cleaned_up',
        orgId: tenantId,
        targetType: 'tenant',
        targetId: tenantId,
        details: {
          permissionsDeleted: deleteResult.rowCount,
          policiesDeleted: policyDeleteResult.rowCount,
          affectedUsers: permissionUsers.rows.length
        },
        category: 'rbac'
      })

      return {
        success: true,
        permissionsDeleted: deleteResult.rowCount,
        policiesDeleted: policyDeleteResult.rowCount,
        affectedUsers: permissionUsers.rows.length
      }
    } catch (error) {
      console.error('Failed to clean up RBAC for deleted tenant:', error)
      throw new Error(`RBAC cleanup failed: ${error.message}`)
    }
  }

  /**
   * Handle tenant archival - disable permissions without deleting
   */
  async onTenantArchived(tenantId) {
    try {
      // Add expiry to all active permissions (effectively disabling them)
      const expiredAt = new Date()
      
      const updateResult = await this.db.query(`
        UPDATE permissions 
        SET expires_at = $2, updated_at = NOW()
        WHERE tenant_id = $1 AND (expires_at IS NULL OR expires_at > NOW())
      `, [tenantId, expiredAt])

      // Disable all policies
      const policyUpdateResult = await this.db.query(`
        UPDATE policies 
        SET effect = 'deny', updated_at = NOW()
        WHERE tenant_id = $1 AND effect = 'allow'
      `, [tenantId])

      // Clear all caches for this tenant
      await this.authorizationService.cache?.invalidateTenantCache?.(tenantId)

      // Log audit event
      await this.auditLogger.logEvent({
        action: 'tenant.rbac.archived',
        orgId: tenantId,
        targetType: 'tenant',
        targetId: tenantId,
        details: {
          permissionsExpired: updateResult.rowCount,
          policiesDisabled: policyUpdateResult.rowCount
        },
        category: 'rbac'
      })

      return {
        success: true,
        permissionsExpired: updateResult.rowCount,
        policiesDisabled: policyUpdateResult.rowCount
      }
    } catch (error) {
      console.error('Failed to archive RBAC for tenant:', error)
      throw new Error(`RBAC archival failed: ${error.message}`)
    }
  }

  /**
   * Handle tenant movement in hierarchy - update inherited permissions
   */
  async onTenantMoved(tenantId, newParentId, oldParentId = null) {
    try {
      // Clear inheritance cache for this tenant and all descendants
      await this._clearInheritanceCache(tenantId)

      // Get all descendant tenants that might be affected
      const descendants = await this.db.query(`
        SELECT id FROM tenants 
        WHERE path @> ARRAY[$1]::uuid[] AND id != $1
      `, [tenantId])

      // Clear cache for all descendants
      for (const descendant of descendants.rows) {
        await this._clearInheritanceCache(descendant.id)
      }

      // Re-propagate permissions from new parent hierarchy
      await this.propagatePermissions(tenantId)

      // Log audit event
      await this.auditLogger.logEvent({
        action: 'tenant.rbac.hierarchy_updated',
        orgId: tenantId,
        targetType: 'tenant',
        targetId: tenantId,
        details: {
          newParentId,
          oldParentId,
          descendantsAffected: descendants.rows.length
        },
        category: 'rbac'
      })

      return {
        success: true,
        descendantsAffected: descendants.rows.length,
        newParentId,
        oldParentId
      }
    } catch (error) {
      console.error('Failed to update RBAC for moved tenant:', error)
      throw new Error(`RBAC hierarchy update failed: ${error.message}`)
    }
  }

  // ===================================================================
  // MEMBER LIFECYCLE HOOKS
  // ===================================================================

  /**
   * Handle member addition - apply role permissions
   */
  async onMemberAdded(tenantId, userId, role) {
    try {
      // Get default permissions for the role
      const rolePermissions = DEFAULT_ROLES[role]?.permissions || []
      
      if (rolePermissions.length === 0) {
        // For custom roles, get from database
        const customRole = await this.db.query(`
          SELECT permissions FROM roles WHERE tenant_id = $1 AND name = $2
        `, [tenantId, role])
        
        if (customRole.rows.length > 0) {
          rolePermissions.push(...customRole.rows[0].permissions)
        }
      }

      // Grant role-based permissions
      let permissionsGranted = 0
      for (const permission of rolePermissions) {
        if (permission === '*:*') {
          // Grant admin permission on all resources
          const resourceTypes = ['tenants', 'members', 'permissions', 'projects', 'integrations', 'settings']
          for (const resourceType of resourceTypes) {
            await this.permissionService.grantPermission(
              userId,
              tenantId,
              `${resourceType}:*`,
              ['admin'],
              { grantedBy: 'system' }
            )
            permissionsGranted++
          }
        } else {
          // Parse and grant specific permission
          const [resource, actions] = permission.split(':')
          const actionList = actions.split(',').map(a => a.trim())
          
          await this.permissionService.grantPermission(
            userId,
            tenantId,
            `${resource}:*`,
            actionList,
            { grantedBy: 'system' }
          )
          permissionsGranted++
        }
      }

      // Clear user cache
      await this.authorizationService.cache?.invalidateUserCache?.(userId)

      // Log audit event
      await this.auditLogger.logEvent({
        action: AUDIT_EVENTS.ROLE_ASSIGNED,
        orgId: tenantId,
        actorUserId: 'system',
        targetType: 'member',
        targetId: userId,
        details: {
          role,
          permissionsGranted,
          autoGranted: true
        },
        category: 'rbac'
      })

      return { success: true, permissionsGranted, role }
    } catch (error) {
      console.error('Failed to apply RBAC for new member:', error)
      throw new Error(`Member RBAC setup failed: ${error.message}`)
    }
  }

  /**
   * Handle member removal - revoke permissions
   */
  async onMemberRemoved(tenantId, userId) {
    try {
      // Revoke all permissions for this user on this tenant
      const result = await this.permissionService.revokeAllPermissions(
        userId, 
        tenantId, 
        'system'
      )

      // Clear user cache
      await this.authorizationService.cache?.invalidateUserCache?.(userId)

      // Log audit event
      await this.auditLogger.logEvent({
        action: AUDIT_EVENTS.ROLE_REMOVED,
        orgId: tenantId,
        actorUserId: 'system',
        targetType: 'member',
        targetId: userId,
        details: {
          permissionsRevoked: result.count,
          autoRevoked: true
        },
        category: 'rbac'
      })

      return { success: true, permissionsRevoked: result.count }
    } catch (error) {
      console.error('Failed to clean up RBAC for removed member:', error)
      throw new Error(`Member RBAC cleanup failed: ${error.message}`)
    }
  }

  /**
   * Handle role change - update permissions
   */
  async onRoleChanged(tenantId, userId, oldRole, newRole) {
    try {
      // Remove old role permissions and add new ones
      await this.onMemberRemoved(tenantId, userId)
      const result = await this.onMemberAdded(tenantId, userId, newRole)

      // Log audit event
      await this.auditLogger.logEvent({
        action: 'member.role.changed',
        orgId: tenantId,
        actorUserId: 'system',
        targetType: 'member',
        targetId: userId,
        details: {
          oldRole,
          newRole,
          permissionsGranted: result.permissionsGranted
        },
        category: 'rbac'
      })

      return { 
        success: true, 
        oldRole, 
        newRole, 
        permissionsGranted: result.permissionsGranted 
      }
    } catch (error) {
      console.error('Failed to update RBAC for role change:', error)
      throw new Error(`Role change RBAC update failed: ${error.message}`)
    }
  }

  // ===================================================================
  // PERMISSION PROPAGATION
  // ===================================================================

  /**
   * Propagate permissions through tenant hierarchy
   */
  async propagatePermissions(tenantId) {
    try {
      // Get all members of this tenant with admin/owner roles
      const adminMembers = await this.db.query(`
        SELECT user_id, role FROM tenant_members 
        WHERE tenant_id = $1 AND role IN ('owner', 'admin') AND joined_at IS NOT NULL
      `, [tenantId])

      // Get all descendant tenants
      const descendants = await this.db.query(`
        SELECT id, name, level FROM tenants 
        WHERE path @> ARRAY[$1]::uuid[] AND id != $1
        ORDER BY level ASC
      `, [tenantId])

      let propagatedCount = 0

      // For each admin/owner, check if they should have inherited access to descendants
      for (const member of adminMembers.rows) {
        for (const descendant of descendants.rows) {
          // Check if user is not already a direct member
          const directMember = await this.db.query(`
            SELECT 1 FROM tenant_members 
            WHERE user_id = $1 AND tenant_id = $2 AND joined_at IS NOT NULL
          `, [member.user_id, descendant.id])

          if (directMember.rows.length === 0) {
            // User could have inherited access - clear their cache
            await this.authorizationService.cache?.invalidateCache?.(member.user_id, descendant.id)
            propagatedCount++
          }
        }
      }

      return { 
        success: true, 
        propagatedCount,
        descendantsChecked: descendants.rows.length,
        adminMembers: adminMembers.rows.length
      }
    } catch (error) {
      console.error('Failed to propagate permissions:', error)
      throw new Error(`Permission propagation failed: ${error.message}`)
    }
  }

  /**
   * Sync inherited permissions for tenant
   */
  async syncInheritedPermissions(tenantId) {
    try {
      // Get all users who might have inherited permissions
      const inheritedUsers = await this.db.query(`
        SELECT DISTINCT tm.user_id
        FROM tenants t
        JOIN tenants ancestor ON ancestor.id = ANY(t.path[1:array_length(t.path,1)-1])
        JOIN tenant_members tm ON tm.tenant_id = ancestor.id
        WHERE t.id = $1 AND tm.role IN ('owner', 'admin') AND tm.joined_at IS NOT NULL
      `, [tenantId])

      // Clear inheritance cache for all these users
      for (const user of inheritedUsers.rows) {
        await this._clearInheritanceCache(tenantId, user.user_id)
      }

      return {
        success: true,
        usersAffected: inheritedUsers.rows.length
      }
    } catch (error) {
      console.error('Failed to sync inherited permissions:', error)
      throw new Error(`Inherited permission sync failed: ${error.message}`)
    }
  }

  // ===================================================================
  // INTERNAL HELPERS
  // ===================================================================

  /**
   * Clear inheritance cache for tenant/user
   */
  async _clearInheritanceCache(tenantId, userId = null) {
    if (!this.authorizationService.cache) return

    if (userId) {
      // Clear specific user-tenant cache
      await this.authorizationService.cache.invalidateCache(userId, tenantId)
    } else {
      // Clear all cache for tenant
      await this.authorizationService.cache.invalidateTenantCache(tenantId)
    }
  }

  /**
   * Health check for integration
   */
  async healthCheck() {
    try {
      // Test database connectivity
      await this.db.query('SELECT 1')
      
      return {
        status: 'healthy',
        database: 'connected',
        permissionService: 'available',
        authorizationService: 'available',
        auditLogger: 'available'
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      }
    }
  }
}

export default TenantRBACIntegration