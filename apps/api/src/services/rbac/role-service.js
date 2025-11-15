/**
 * Role Service
 * 
 * Manages role definitions, assignments, and permission templates
 * for the RBAC system.
 */

import { DEFAULT_ROLES, RBAC_CONFIG, ERROR_CODES, AUDIT_EVENTS } from './config.js'
import ResourceRegistry from './resource-registry.js'

export class RoleService {
  constructor(database, auditLogger, cache = null) {
    this.db = database
    this.auditLogger = auditLogger
    this.cache = cache
    this.resourceRegistry = new ResourceRegistry()
    this.cachePrefix = 'rbac:role:'
    this.cacheTTL = 300 // 5 minutes
  }

  /**
   * Create a new role for a tenant
   */
  async createRole(tenantId, roleDefinition, createdBy) {
    const {
      name,
      description = '',
      permissions = [],
      priority = 50,
      expiryDays = null,
      conditions = {}
    } = roleDefinition

    // Validate role name
    if (!name || typeof name !== 'string') {
      throw new Error('Role name is required and must be a string')
    }

    // Prevent creation of roles with built-in names
    if (RBAC_CONFIG.DEFAULT_ROLES.includes(name)) {
      throw new Error(`Cannot create role with reserved name: ${name}`)
    }

    // Validate permissions format
    this._validatePermissions(permissions)

    try {
      const result = await this.db.query(`
        INSERT INTO roles (
          tenant_id, name, description, permissions, priority, 
          expiry_days, conditions, created_by, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING *
      `, [
        tenantId, name, description, JSON.stringify(permissions),
        priority, expiryDays, JSON.stringify(conditions), createdBy
      ])

      const role = this._mapRoleRow(result.rows[0])

      // Log audit event
      await this.auditLogger.logEvent({
        action: AUDIT_EVENTS.ROLE_ASSIGNED,
        orgId: tenantId,
        actorUserId: createdBy,
        targetType: 'role',
        targetId: role.id,
        details: { roleName: name, permissions },
        category: 'rbac'
      })

      // Clear cache
      await this._clearTenantRoleCache(tenantId)

      return role
    } catch (error) {
      if (error.code === '23505') { // Unique constraint violation
        throw new Error(`Role '${name}' already exists for this tenant`)
      }
      throw new Error(`Failed to create role: ${error.message}`)
    }
  }

  /**
   * Update an existing role
   */
  async updateRole(tenantId, roleId, updates, updatedBy) {
    const existingRole = await this.getRole(tenantId, roleId)
    if (!existingRole) {
      throw new Error(`Role not found: ${roleId}`)
    }

    // Prevent modification of immutable roles
    if (existingRole.immutable) {
      throw new Error(`Cannot modify immutable role: ${existingRole.name}`)
    }

    const allowedFields = ['description', 'permissions', 'priority', 'expiryDays', 'conditions']
    const filteredUpdates = Object.keys(updates)
      .filter(key => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updates[key]
        return obj
      }, {})

    if (Object.keys(filteredUpdates).length === 0) {
      throw new Error('No valid fields to update')
    }

    // Validate permissions if provided
    if (filteredUpdates.permissions) {
      this._validatePermissions(filteredUpdates.permissions)
    }

    const setClauses = []
    const values = [tenantId, roleId]
    let paramIndex = 3

    for (const [field, value] of Object.entries(filteredUpdates)) {
      const dbField = this._mapFieldToColumn(field)
      if (field === 'permissions' || field === 'conditions') {
        setClauses.push(`${dbField} = $${paramIndex}`)
        values.push(JSON.stringify(value))
      } else {
        setClauses.push(`${dbField} = $${paramIndex}`)
        values.push(value)
      }
      paramIndex++
    }

    setClauses.push('updated_at = NOW()')

    try {
      const result = await this.db.query(`
        UPDATE roles 
        SET ${setClauses.join(', ')}
        WHERE tenant_id = $1 AND id = $2
        RETURNING *
      `, values)

      if (result.rows.length === 0) {
        throw new Error('Role not found')
      }

      const updatedRole = this._mapRoleRow(result.rows[0])

      // Log audit event
      await this.auditLogger.logEvent({
        action: 'role.updated',
        orgId: tenantId,
        actorUserId: updatedBy,
        targetType: 'role',
        targetId: roleId,
        details: { updates: filteredUpdates },
        category: 'rbac'
      })

      // Clear cache
      await this._clearTenantRoleCache(tenantId)
      await this._clearRoleCache(tenantId, roleId)

      return updatedRole
    } catch (error) {
      throw new Error(`Failed to update role: ${error.message}`)
    }
  }

  /**
   * Delete a role
   */
  async deleteRole(tenantId, roleId, deletedBy) {
    const existingRole = await this.getRole(tenantId, roleId)
    if (!existingRole) {
      throw new Error(`Role not found: ${roleId}`)
    }

    // Prevent deletion of immutable roles
    if (existingRole.immutable) {
      throw new Error(`Cannot delete immutable role: ${existingRole.name}`)
    }

    // Check if role is in use
    const usageResult = await this.db.query(`
      SELECT COUNT(*)::int as count
      FROM tenant_members 
      WHERE tenant_id = $1 AND role = $2
    `, [tenantId, existingRole.name])

    if (usageResult.rows[0].count > 0) {
      throw new Error(`Cannot delete role '${existingRole.name}' - it is assigned to ${usageResult.rows[0].count} members`)
    }

    try {
      const result = await this.db.query(`
        DELETE FROM roles 
        WHERE tenant_id = $1 AND id = $2
        RETURNING *
      `, [tenantId, roleId])

      // Log audit event
      await this.auditLogger.logEvent({
        action: 'role.deleted',
        orgId: tenantId,
        actorUserId: deletedBy,
        targetType: 'role',
        targetId: roleId,
        details: { roleName: existingRole.name },
        category: 'rbac'
      })

      // Clear cache
      await this._clearTenantRoleCache(tenantId)
      await this._clearRoleCache(tenantId, roleId)

      return this._mapRoleRow(result.rows[0])
    } catch (error) {
      throw new Error(`Failed to delete role: ${error.message}`)
    }
  }

  /**
   * Get a specific role
   */
  async getRole(tenantId, roleId) {
    // Try cache first
    const cacheKey = `${this.cachePrefix}${tenantId}:${roleId}`
    if (this.cache) {
      const cached = await this.cache.get(cacheKey)
      if (cached) return JSON.parse(cached)
    }

    // Check if it's a built-in role
    if (DEFAULT_ROLES[roleId]) {
      const builtInRole = {
        id: roleId,
        tenantId,
        name: roleId,
        description: DEFAULT_ROLES[roleId].description,
        permissions: DEFAULT_ROLES[roleId].permissions,
        priority: DEFAULT_ROLES[roleId].priority || 50,
        immutable: DEFAULT_ROLES[roleId].immutable || false,
        builtIn: true,
        createdAt: null,
        updatedAt: null
      }

      if (this.cache) {
        await this.cache.setex(cacheKey, this.cacheTTL, JSON.stringify(builtInRole))
      }

      return builtInRole
    }

    try {
      const result = await this.db.query(`
        SELECT * FROM roles 
        WHERE tenant_id = $1 AND id = $2
      `, [tenantId, roleId])

      if (result.rows.length === 0) {
        return null
      }

      const role = this._mapRoleRow(result.rows[0])

      if (this.cache) {
        await this.cache.setex(cacheKey, this.cacheTTL, JSON.stringify(role))
      }

      return role
    } catch (error) {
      throw new Error(`Failed to get role: ${error.message}`)
    }
  }

  /**
   * Get role by name
   */
  async getRoleByName(tenantId, roleName) {
    // Check built-in roles first
    if (DEFAULT_ROLES[roleName]) {
      return this.getRole(tenantId, roleName)
    }

    try {
      const result = await this.db.query(`
        SELECT * FROM roles 
        WHERE tenant_id = $1 AND name = $2
      `, [tenantId, roleName])

      if (result.rows.length === 0) {
        return null
      }

      return this._mapRoleRow(result.rows[0])
    } catch (error) {
      throw new Error(`Failed to get role by name: ${error.message}`)
    }
  }

  /**
   * List all roles for a tenant
   */
  async listRoles(tenantId, filters = {}) {
    const values = [tenantId]
    const where = ['tenant_id = $1']
    let paramIndex = 2

    if (filters.builtIn !== undefined) {
      // Will handle built-in roles separately
    }

    try {
      // Get custom roles from database
      const result = await this.db.query(`
        SELECT * FROM roles 
        WHERE ${where.join(' AND ')}
        ORDER BY priority DESC, name ASC
      `, values)

      let roles = result.rows.map(row => this._mapRoleRow(row))

      // Add built-in roles if not filtered out
      if (filters.builtIn !== false) {
        const builtInRoles = Object.entries(DEFAULT_ROLES).map(([name, definition]) => ({
          id: name,
          tenantId,
          name,
          description: definition.description,
          permissions: definition.permissions,
          priority: definition.priority || 50,
          immutable: definition.immutable || false,
          builtIn: true,
          createdAt: null,
          updatedAt: null
        }))

        roles = [...builtInRoles, ...roles]
      }

      // Apply additional filters
      if (filters.immutable !== undefined) {
        roles = roles.filter(role => role.immutable === filters.immutable)
      }

      return roles.sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name))
    } catch (error) {
      throw new Error(`Failed to list roles: ${error.message}`)
    }
  }

  /**
   * Assign role to user (delegates to TenantMemberService)
   */
  async assignRole(userId, tenantId, roleName, assignedBy) {
    // Validate role exists
    const role = await this.getRoleByName(tenantId, roleName)
    if (!role) {
      throw new Error(`Role '${roleName}' not found`)
    }

    // This would typically delegate to TenantMemberService
    // For now, we'll return a placeholder
    return {
      userId,
      tenantId,
      role: roleName,
      assignedBy,
      assignedAt: new Date()
    }
  }

  /**
   * Remove role from user (delegates to TenantMemberService)
   */
  async removeRole(userId, tenantId, removedBy) {
    // This would typically delegate to TenantMemberService
    return {
      userId,
      tenantId,
      removedBy,
      removedAt: new Date()
    }
  }

  /**
   * Get default permissions for a role
   */
  async getDefaultPermissions(roleName) {
    if (DEFAULT_ROLES[roleName]) {
      return DEFAULT_ROLES[roleName].permissions
    }

    // For custom roles, get from database
    const result = await this.db.query(`
      SELECT permissions FROM roles WHERE name = $1 LIMIT 1
    `, [roleName])

    if (result.rows.length === 0) {
      throw new Error(`Role '${roleName}' not found`)
    }

    return result.rows[0].permissions
  }

  /**
   * Apply role permissions to user
   */
  async applyRolePermissions(userId, tenantId, roleName, appliedBy) {
    const permissions = await this.getDefaultPermissions(roleName)
    
    // This would typically delegate to PermissionService
    // For now, return the permissions that would be applied
    return {
      userId,
      tenantId,
      role: roleName,
      permissions,
      appliedBy,
      appliedAt: new Date()
    }
  }

  /**
   * Get role hierarchy for a tenant
   */
  async getRoleHierarchy(tenantId) {
    const roles = await this.listRoles(tenantId)
    
    // Sort by priority (higher priority = higher in hierarchy)
    const hierarchy = roles.sort((a, b) => b.priority - a.priority)
    
    return hierarchy.map(role => ({
      name: role.name,
      priority: role.priority,
      immutable: role.immutable,
      builtIn: role.builtIn,
      permissions: role.permissions
    }))
  }

  /**
   * Get roles assigned to a user in a tenant
   */
  async getUserRoles(userId, tenantId) {
    try {
      const result = await this.db.query(`
        SELECT r.*
        FROM roles r
        INNER JOIN user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id = $1 AND r.tenant_id = $2
        ORDER BY r.created_at ASC
      `, [userId, tenantId])

      return result.rows.map(row => this._mapRoleRow(row))
    } catch (error) {
      throw new Error(`Failed to get user roles: ${error.message}`)
    }
  }

  /**
   * Get permissions for a specific role
   */
  async getRolePermissions(tenantId, roleName) {
    const role = await this.getRoleByName(tenantId, roleName)
    if (!role) {
      throw new Error(`Role '${roleName}' not found`)
    }

    return {
      role: roleName,
      permissions: role.permissions,
      expandedPermissions: this._expandPermissions(role.permissions)
    }
  }

  /**
   * Validate role permissions format
   */
  _validatePermissions(permissions) {
    if (!Array.isArray(permissions)) {
      throw new Error('Permissions must be an array')
    }

    for (const permission of permissions) {
      if (typeof permission !== 'string') {
        throw new Error('Each permission must be a string')
      }

      // Validate permission format (resource:actions)
      if (permission === '*:*') continue // Allow wildcard

      const parts = permission.split(':')
      if (parts.length !== 2) {
        throw new Error(`Invalid permission format: ${permission}. Expected 'resource:action' or 'resource:action1,action2'`)
      }

      const [resource, actions] = parts
      const actionList = actions.split(',').map(a => a.trim())

      // Validate resource exists
      if (resource !== '*' && !this.resourceRegistry.getResourceType(resource)) {
        throw new Error(`Unknown resource type: ${resource}`)
      }

      // Validate actions exist for resource
      if (resource !== '*' && actions !== '*') {
        const availableActions = this.resourceRegistry.getAvailableActions(resource)
        for (const action of actionList) {
          if (!availableActions.includes(action)) {
            throw new Error(`Action '${action}' not available for resource '${resource}'`)
          }
        }
      }
    }
  }

  /**
   * Expand permissions to include hierarchical actions
   */
  _expandPermissions(permissions) {
    const expanded = new Set()

    for (const permission of permissions) {
      if (permission === '*:*') {
        expanded.add(permission)
        continue
      }

      const [resource, actions] = permission.split(':')
      const actionList = actions.split(',').map(a => a.trim())

      for (const action of actionList) {
        if (action === '*') {
          expanded.add(`${resource}:*`)
        } else {
          // Add the action itself
          expanded.add(`${resource}:${action}`)
          
          // Add all actions included by this action through hierarchy
          const includedActions = this.resourceRegistry.getIncludedActions(action)
          for (const includedAction of includedActions) {
            if (includedAction !== action) {
              expanded.add(`${resource}:${includedAction}`)
            }
          }
        }
      }
    }

    return Array.from(expanded)
  }

  /**
   * Map database field names to object properties
   */
  _mapFieldToColumn(field) {
    const mapping = {
      expiryDays: 'expiry_days'
    }
    return mapping[field] || field
  }

  /**
   * Map database row to role object
   */
  _mapRoleRow(row) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      permissions: row.permissions || [],
      priority: row.priority,
      expiryDays: row.expiry_days,
      conditions: row.conditions || {},
      immutable: false,
      builtIn: false,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }

  /**
   * Clear tenant role cache
   */
  async _clearTenantRoleCache(tenantId) {
    if (!this.cache) return

    // This would clear all role-related cache keys for the tenant
    const pattern = `${this.cachePrefix}${tenantId}:*`
    // Implementation depends on cache backend
  }

  /**
   * Clear specific role cache
   */
  async _clearRoleCache(tenantId, roleId) {
    if (!this.cache) return

    const cacheKey = `${this.cachePrefix}${tenantId}:${roleId}`
    await this.cache.del(cacheKey)
  }

  /**
   * Health check for role service
   */
  async healthCheck() {
    try {
      // Test database connectivity
      await this.db.query('SELECT 1')
      
      // Test cache connectivity
      if (this.cache) {
        await this.cache.ping()
      }

      return {
        database: 'healthy',
        cache: this.cache ? 'healthy' : 'not_configured',
        builtInRoles: Object.keys(DEFAULT_ROLES).length,
        status: 'operational'
      }
    } catch (error) {
      return {
        database: 'unhealthy',
        cache: 'unknown',
        status: 'degraded',
        error: error.message
      }
    }
  }
}

export default RoleService