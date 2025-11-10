/**
 * Permission Service
 * 
 * Core permission management with RBAC and hierarchical inheritance support.
 * Handles granting, revoking, and checking permissions across the tenant hierarchy.
 */

import { RBAC_CONFIG, CACHE_KEYS, AUDIT_EVENTS, ERROR_CODES } from './config.js'
import ResourceRegistry from './resource-registry.js'

export class PermissionService {
  constructor(database, auditLogger, cache = null) {
    this.db = database
    this.auditLogger = auditLogger
    this.cache = cache
    this.resourceRegistry = new ResourceRegistry()
    this.cachePrefix = 'rbac:perm:'
    this.cacheTTL = RBAC_CONFIG.PERMISSION_CACHE_TTL
  }

  // ===================================================================
  // GRANT OPERATIONS
  // ===================================================================

  /**
   * Grant permission to user
   */
  async grantPermission(userId, tenantId, resource, actions, options = {}) {
    const {
      grantedBy,
      expiresAt = null,
      conditions = null,
      resourceId = null
    } = options

    // Validate inputs
    const parsed = this.resourceRegistry.resolveResource(resource)
    const normalizedActions = Array.isArray(actions) ? actions : [actions]
    
    for (const action of normalizedActions) {
      const validation = this.resourceRegistry.validatePermission(parsed.type, action)
      if (!validation.valid) {
        throw new Error(validation.error)
      }
    }

    // Validate expiry
    if (expiresAt && expiresAt <= new Date()) {
      throw new Error('Expiration date must be in the future')
    }

    if (expiresAt && expiresAt > new Date(Date.now() + RBAC_CONFIG.MAX_PERMISSION_EXPIRY * 1000)) {
      throw new Error('Expiration date exceeds maximum allowed period')
    }

    try {
      const result = await this.db.query(`
        INSERT INTO permissions (
          user_id, tenant_id, resource_type, resource_id, actions, 
          conditions, granted_by, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (user_id, tenant_id, resource_type, COALESCE(resource_id, '')) 
        DO UPDATE SET 
          actions = array(SELECT DISTINCT unnest(permissions.actions || EXCLUDED.actions)),
          conditions = CASE 
            WHEN EXCLUDED.conditions IS NOT NULL THEN EXCLUDED.conditions 
            ELSE permissions.conditions 
          END,
          granted_by = EXCLUDED.granted_by,
          expires_at = CASE 
            WHEN EXCLUDED.expires_at IS NOT NULL THEN EXCLUDED.expires_at 
            ELSE permissions.expires_at 
          END,
          updated_at = NOW()
        RETURNING *
      `, [
        userId, tenantId, parsed.type, parsed.id || resourceId, 
        normalizedActions, conditions ? JSON.stringify(conditions) : null, 
        grantedBy, expiresAt
      ])

      const permission = this._mapPermissionRow(result.rows[0])

      // Log audit event
      await this.auditLogger.logEvent({
        action: AUDIT_EVENTS.PERMISSION_GRANTED,
        orgId: tenantId,
        actorUserId: grantedBy,
        targetType: 'permission',
        targetId: permission.id,
        details: {
          userId,
          resource: parsed.resourceString,
          actions: normalizedActions,
          conditions,
          expiresAt
        },
        category: 'rbac'
      })

      // Clear cache
      await this._clearUserPermissionCache(userId, tenantId)

      return permission
    } catch (error) {
      throw new Error(`Failed to grant permission: ${error.message}`)
    }
  }

  /**
   * Grant permission with conditions (ABAC)
   */
  async grantPermissionWithConditions(userId, tenantId, resource, actions, conditions) {
    if (!conditions || typeof conditions !== 'object') {
      throw new Error('Conditions must be a valid object')
    }

    return this.grantPermission(userId, tenantId, resource, actions, { conditions })
  }

  /**
   * Grant permission with expiry
   */
  async grantPermissionWithExpiry(userId, tenantId, resource, actions, expiresAt) {
    if (!expiresAt || !(expiresAt instanceof Date)) {
      throw new Error('Expiry date must be a valid Date object')
    }

    return this.grantPermission(userId, tenantId, resource, actions, { expiresAt })
  }

  /**
   * Bulk grant permissions
   */
  async bulkGrantPermissions(grants, grantedBy) {
    if (!Array.isArray(grants) || grants.length === 0) {
      throw new Error('Grants must be a non-empty array')
    }

    if (grants.length > RBAC_CONFIG.BATCH_GRANT_SIZE) {
      throw new Error(`Bulk operation exceeds maximum size of ${RBAC_CONFIG.BATCH_GRANT_SIZE}`)
    }

    const results = []
    const errors = []

    // Validate all grants first
    for (const [index, grant] of grants.entries()) {
      try {
        const { userId, tenantId, resource, actions } = grant
        if (!userId || !tenantId || !resource || !actions) {
          throw new Error('Missing required fields: userId, tenantId, resource, actions')
        }
      } catch (error) {
        errors.push({ index, grant, error: error.message })
      }
    }

    if (errors.length > 0) {
      throw new Error(`Validation errors in bulk grant: ${JSON.stringify(errors)}`)
    }

    // Use transaction for atomicity
    const client = await this.db.connect()
    
    try {
      await client.query('BEGIN')

      for (const [index, grant] of grants.entries()) {
        try {
          const permission = await this.grantPermission(
            grant.userId,
            grant.tenantId,
            grant.resource,
            grant.actions,
            { ...grant.options, grantedBy }
          )
          results.push({ index, permission })
        } catch (error) {
          errors.push({ index, grant, error: error.message })
        }
      }

      if (errors.length === 0) {
        await client.query('COMMIT')
      } else {
        await client.query('ROLLBACK')
        throw new Error(`Bulk grant failed with ${errors.length} errors: ${JSON.stringify(errors)}`)
      }

      return {
        success: true,
        granted: results.length,
        errors: errors.length,
        results
      }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  // ===================================================================
  // REVOKE OPERATIONS
  // ===================================================================

  /**
   * Revoke permission from user
   */
  async revokePermission(userId, tenantId, resource, actions, revokedBy) {
    const parsed = this.resourceRegistry.resolveResource(resource)
    const normalizedActions = Array.isArray(actions) ? actions : [actions]

    try {
      // Get current permission
      const currentResult = await this.db.query(`
        SELECT * FROM permissions 
        WHERE user_id = $1 AND tenant_id = $2 AND resource_type = $3 
        AND (resource_id = $4 OR (resource_id IS NULL AND $4 IS NULL))
      `, [userId, tenantId, parsed.type, parsed.id])

      if (currentResult.rows.length === 0) {
        throw new Error('Permission not found')
      }

      const currentPermission = currentResult.rows[0]
      const currentActions = currentPermission.actions || []
      const remainingActions = currentActions.filter(action => !normalizedActions.includes(action))

      let result
      if (remainingActions.length === 0) {
        // Remove permission entirely
        result = await this.db.query(`
          DELETE FROM permissions 
          WHERE user_id = $1 AND tenant_id = $2 AND resource_type = $3 
          AND (resource_id = $4 OR (resource_id IS NULL AND $4 IS NULL))
          RETURNING *
        `, [userId, tenantId, parsed.type, parsed.id])
      } else {
        // Update with remaining actions
        result = await this.db.query(`
          UPDATE permissions 
          SET actions = $5, updated_at = NOW()
          WHERE user_id = $1 AND tenant_id = $2 AND resource_type = $3 
          AND (resource_id = $4 OR (resource_id IS NULL AND $4 IS NULL))
          RETURNING *
        `, [userId, tenantId, parsed.type, parsed.id, remainingActions])
      }

      // Log audit event
      await this.auditLogger.logEvent({
        action: AUDIT_EVENTS.PERMISSION_REVOKED,
        orgId: tenantId,
        actorUserId: revokedBy,
        targetType: 'permission',
        targetId: currentPermission.id,
        details: {
          userId,
          resource: parsed.resourceString,
          revokedActions: normalizedActions,
          remainingActions
        },
        category: 'rbac'
      })

      // Clear cache
      await this._clearUserPermissionCache(userId, tenantId)

      return {
        revoked: true,
        revokedActions: normalizedActions,
        remainingActions,
        permissionRemoved: remainingActions.length === 0
      }
    } catch (error) {
      throw new Error(`Failed to revoke permission: ${error.message}`)
    }
  }

  /**
   * Revoke all permissions for user on tenant
   */
  async revokeAllPermissions(userId, tenantId, revokedBy) {
    try {
      const result = await this.db.query(`
        DELETE FROM permissions 
        WHERE user_id = $1 AND tenant_id = $2
        RETURNING *
      `, [userId, tenantId])

      // Log audit event
      await this.auditLogger.logEvent({
        action: AUDIT_EVENTS.PERMISSION_REVOKED,
        orgId: tenantId,
        actorUserId: revokedBy,
        targetType: 'user_permissions',
        targetId: userId,
        details: {
          userId,
          revokedCount: result.rows.length,
          allPermissions: true
        },
        category: 'rbac'
      })

      // Clear cache
      await this._clearUserPermissionCache(userId, tenantId)

      return {
        revoked: true,
        count: result.rows.length
      }
    } catch (error) {
      throw new Error(`Failed to revoke all permissions: ${error.message}`)
    }
  }

  /**
   * Remove expired permissions
   */
  async revokeExpiredPermissions() {
    try {
      const result = await this.db.query(`
        DELETE FROM permissions 
        WHERE expires_at IS NOT NULL AND expires_at <= NOW()
        RETURNING user_id, tenant_id, resource_type, actions
      `)

      // Clear cache for affected users
      const affectedUsers = new Set()
      for (const row of result.rows) {
        affectedUsers.add(`${row.user_id}:${row.tenant_id}`)
      }

      for (const userTenant of affectedUsers) {
        const [userId, tenantId] = userTenant.split(':')
        await this._clearUserPermissionCache(userId, tenantId)
      }

      return {
        expired: true,
        count: result.rows.length,
        affectedUsers: affectedUsers.size
      }
    } catch (error) {
      throw new Error(`Failed to revoke expired permissions: ${error.message}`)
    }
  }

  // ===================================================================
  // QUERY OPERATIONS
  // ===================================================================

  /**
   * Get user permissions for tenant
   */
  async getUserPermissions(userId, tenantId, options = {}) {
    const { includeExpired = false, includeInherited = true } = options

    const cacheKey = this._getCacheKey(CACHE_KEYS.USER_PERMISSIONS, { userId, tenantId })
    
    // Try cache first
    if (this.cache && !includeExpired) {
      const cached = await this.cache.get(cacheKey)
      if (cached) return JSON.parse(cached)
    }

    try {
      let whereClause = 'user_id = $1 AND tenant_id = $2'
      if (!includeExpired) {
        whereClause += ' AND (expires_at IS NULL OR expires_at > NOW())'
      }

      const result = await this.db.query(`
        SELECT * FROM permissions 
        WHERE ${whereClause}
        ORDER BY resource_type, resource_id NULLS FIRST
      `, [userId, tenantId])

      let permissions = result.rows.map(row => this._mapPermissionRow(row))

      // Add inherited permissions if requested
      if (includeInherited) {
        const inheritedPermissions = await this.getInheritedPermissions(userId, tenantId)
        permissions = [...permissions, ...inheritedPermissions]
      }

      const permissionData = {
        userId,
        tenantId,
        directPermissions: result.rows.length,
        totalPermissions: permissions.length,
        permissions
      }

      // Cache result if not including expired
      if (this.cache && !includeExpired) {
        await this.cache.setex(cacheKey, this.cacheTTL, JSON.stringify(permissionData))
      }

      return permissionData
    } catch (error) {
      throw new Error(`Failed to get user permissions: ${error.message}`)
    }
  }

  /**
   * Get permissions for specific resource
   */
  async getResourcePermissions(tenantId, resourceType, resourceId = null) {
    try {
      const result = await this.db.query(`
        SELECT p.*, u.email as user_email
        FROM permissions p
        LEFT JOIN users u ON u.id = p.user_id
        WHERE p.tenant_id = $1 AND p.resource_type = $2 
        AND (p.resource_id = $3 OR (p.resource_id IS NULL AND $3 IS NULL))
        AND (p.expires_at IS NULL OR p.expires_at > NOW())
        ORDER BY p.created_at DESC
      `, [tenantId, resourceType, resourceId])

      return result.rows.map(row => ({
        ...this._mapPermissionRow(row),
        userEmail: row.user_email
      }))
    } catch (error) {
      throw new Error(`Failed to get resource permissions: ${error.message}`)
    }
  }

  /**
   * List permissions with filters
   */
  async listPermissions(filters = {}) {
    const {
      tenantId,
      userId,
      resourceType,
      action,
      includeExpired = false,
      limit = 100,
      offset = 0
    } = filters

    const where = []
    const values = []
    let paramIndex = 1

    if (tenantId) {
      where.push(`tenant_id = $${paramIndex++}`)
      values.push(tenantId)
    }

    if (userId) {
      where.push(`user_id = $${paramIndex++}`)
      values.push(userId)
    }

    if (resourceType) {
      where.push(`resource_type = $${paramIndex++}`)
      values.push(resourceType)
    }

    if (action) {
      where.push(`$${paramIndex++} = ANY(actions)`)
      values.push(action)
    }

    if (!includeExpired) {
      where.push('(expires_at IS NULL OR expires_at > NOW())')
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''

    try {
      const countResult = await this.db.query(`
        SELECT COUNT(*)::int as total FROM permissions ${whereClause}
      `, values)

      const result = await this.db.query(`
        SELECT p.*, u.email as user_email, t.name as tenant_name
        FROM permissions p
        LEFT JOIN users u ON u.id = p.user_id
        LEFT JOIN tenants t ON t.id = p.tenant_id
        ${whereClause}
        ORDER BY p.created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `, [...values, limit, offset])

      return {
        total: countResult.rows[0].total,
        limit,
        offset,
        permissions: result.rows.map(row => ({
          ...this._mapPermissionRow(row),
          userEmail: row.user_email,
          tenantName: row.tenant_name
        }))
      }
    } catch (error) {
      throw new Error(`Failed to list permissions: ${error.message}`)
    }
  }

  // ===================================================================
  // PERMISSION CHECKS
  // ===================================================================

  /**
   * Check if user has permission
   */
  async hasPermission(userId, tenantId, resource, action, context = {}) {
    const cacheKey = this._getCacheKey(CACHE_KEYS.PERMISSION_CHECK, {
      userId, tenantId, resource, action
    })

    // Try cache first
    if (this.cache) {
      const cached = await this.cache.get(cacheKey)
      if (cached !== null) return JSON.parse(cached)
    }

    try {
      const result = await this._checkPermissionInternal(userId, tenantId, resource, action, context)
      
      // Cache the result
      if (this.cache) {
        await this.cache.setex(cacheKey, this.cacheTTL, JSON.stringify(result))
      }

      return result
    } catch (error) {
      throw new Error(`Permission check failed: ${error.message}`)
    }
  }

  /**
   * Check if user has any of the specified permissions
   */
  async hasAnyPermission(userId, tenantId, resource, actions) {
    const normalizedActions = Array.isArray(actions) ? actions : [actions]
    
    for (const action of normalizedActions) {
      if (await this.hasPermission(userId, tenantId, resource, action)) {
        return true
      }
    }
    
    return false
  }

  /**
   * Check if user has all specified permissions
   */
  async hasAllPermissions(userId, tenantId, resource, actions) {
    const normalizedActions = Array.isArray(actions) ? actions : [actions]
    
    for (const action of normalizedActions) {
      if (!(await this.hasPermission(userId, tenantId, resource, action))) {
        return false
      }
    }
    
    return true
  }

  // ===================================================================
  // INHERITANCE
  // ===================================================================

  /**
   * Get inherited permissions from parent tenants
   */
  async getInheritedPermissions(userId, tenantId) {
    if (!RBAC_CONFIG.ENABLE_HIERARCHICAL_INHERITANCE) {
      return []
    }

    const cacheKey = this._getCacheKey(CACHE_KEYS.INHERITANCE, { userId, tenantId })
    
    if (this.cache) {
      const cached = await this.cache.get(cacheKey)
      if (cached) return JSON.parse(cached)
    }

    try {
      // Get tenant path to find all parent tenants
      const pathResult = await this.db.query(`
        SELECT path FROM tenants WHERE id = $1
      `, [tenantId])

      if (pathResult.rows.length === 0) {
        return []
      }

      const path = pathResult.rows[0].path
      const parentIds = path.slice(0, -1) // All parents, excluding self

      if (parentIds.length === 0) {
        return []
      }

      // Get permissions from parent tenants
      const result = await this.db.query(`
        SELECT p.*, t.id as source_tenant_id, t.name as source_tenant_name, t.level
        FROM permissions p
        JOIN tenants t ON t.id = p.tenant_id
        WHERE p.user_id = $1 
        AND p.tenant_id = ANY($2::uuid[])
        AND (p.expires_at IS NULL OR p.expires_at > NOW())
        ORDER BY t.level ASC
      `, [userId, parentIds])

      const inheritedPermissions = result.rows.map(row => ({
        ...this._mapPermissionRow(row),
        inherited: true,
        sourceTenantId: row.source_tenant_id,
        sourceTenantName: row.source_tenant_name,
        sourceLevel: row.level
      }))

      if (this.cache) {
        await this.cache.setex(cacheKey, this.cacheTTL, JSON.stringify(inheritedPermissions))
      }

      return inheritedPermissions
    } catch (error) {
      throw new Error(`Failed to get inherited permissions: ${error.message}`)
    }
  }

  /**
   * Get effective permissions (direct + inherited)
   */
  async getEffectivePermissions(userId, tenantId) {
    const cacheKey = this._getCacheKey(CACHE_KEYS.EFFECTIVE_PERMISSIONS, { userId, tenantId })
    
    if (this.cache) {
      const cached = await this.cache.get(cacheKey)
      if (cached) return JSON.parse(cached)
    }

    try {
      const [directPerms, inheritedPerms] = await Promise.all([
        this.getUserPermissions(userId, tenantId, { includeInherited: false }),
        this.getInheritedPermissions(userId, tenantId)
      ])

      const effectivePermissions = {
        userId,
        tenantId,
        direct: directPerms.permissions,
        inherited: inheritedPerms,
        combined: [...directPerms.permissions, ...inheritedPerms],
        summary: this._summarizePermissions([...directPerms.permissions, ...inheritedPerms])
      }

      if (this.cache) {
        await this.cache.setex(cacheKey, this.cacheTTL, JSON.stringify(effectivePermissions))
      }

      return effectivePermissions
    } catch (error) {
      throw new Error(`Failed to get effective permissions: ${error.message}`)
    }
  }

  // ===================================================================
  // INTERNAL METHODS
  // ===================================================================

  /**
   * Internal permission check implementation
   */
  async _checkPermissionInternal(userId, tenantId, resource, action, context) {
    const parsed = this.resourceRegistry.resolveResource(resource)
    
    // Check direct permissions
    const directResult = await this.db.query(`
      SELECT * FROM permissions 
      WHERE user_id = $1 AND tenant_id = $2 AND resource_type = $3
      AND (resource_id = $4 OR resource_id IS NULL)
      AND (expires_at IS NULL OR expires_at > NOW())
    `, [userId, tenantId, parsed.type, parsed.id])

    for (const permission of directResult.rows) {
      if (this._checkActionMatch(permission.actions, action) &&
          this._evaluateConditions(permission.conditions, context)) {
        return {
          allowed: true,
          source: 'direct',
          permission: this._mapPermissionRow(permission)
        }
      }
    }

    // Check inherited permissions
    if (RBAC_CONFIG.ENABLE_HIERARCHICAL_INHERITANCE) {
      const inheritedPermissions = await this.getInheritedPermissions(userId, tenantId)
      
      for (const permission of inheritedPermissions) {
        if (permission.resourceType === parsed.type &&
            (permission.resourceId === parsed.id || permission.resourceId === null) &&
            this._checkActionMatch(permission.actions, action) &&
            this._evaluateConditions(permission.conditions, context)) {
          return {
            allowed: true,
            source: 'inherited',
            permission
          }
        }
      }
    }

    return {
      allowed: false,
      source: null,
      permission: null
    }
  }

  /**
   * Check if action matches permission actions (including hierarchy)
   */
  _checkActionMatch(permissionActions, requestedAction) {
    if (!Array.isArray(permissionActions)) return false
    
    // Direct match
    if (permissionActions.includes(requestedAction)) return true
    
    // Check action hierarchy
    for (const permAction of permissionActions) {
      const includedActions = this.resourceRegistry.getIncludedActions(permAction)
      if (includedActions.includes(requestedAction)) return true
    }
    
    return false
  }

  /**
   * Evaluate ABAC conditions
   */
  _evaluateConditions(conditions, context) {
    if (!conditions || Object.keys(conditions).length === 0) return true
    
    try {
      // Simple condition evaluation - can be extended
      for (const [key, expectedValue] of Object.entries(conditions)) {
        const contextValue = this._getNestedValue(context, key)
        if (contextValue !== expectedValue) {
          return false
        }
      }
      return true
    } catch (error) {
      console.error('Condition evaluation error:', error)
      return false
    }
  }

  /**
   * Get nested value from object using dot notation
   */
  _getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  /**
   * Summarize permissions for display
   */
  _summarizePermissions(permissions) {
    const summary = new Map()
    
    for (const permission of permissions) {
      const key = `${permission.resourceType}:${permission.resourceId || '*'}`
      if (!summary.has(key)) {
        summary.set(key, new Set())
      }
      permission.actions.forEach(action => summary.get(key).add(action))
    }
    
    const result = {}
    summary.forEach((actions, resource) => {
      result[resource] = Array.from(actions)
    })
    
    return result
  }

  /**
   * Map database row to permission object
   */
  _mapPermissionRow(row) {
    return {
      id: row.id,
      userId: row.user_id,
      tenantId: row.tenant_id,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      actions: row.actions || [],
      conditions: row.conditions || {},
      grantedBy: row.granted_by,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }

  /**
   * Generate cache key from pattern and parameters
   */
  _getCacheKey(pattern, params) {
    let key = pattern
    for (const [param, value] of Object.entries(params)) {
      key = key.replace(`{${param}}`, value)
    }
    return key
  }

  /**
   * Clear user permission cache
   */
  async _clearUserPermissionCache(userId, tenantId) {
    if (!this.cache) return

    const patterns = [
      this._getCacheKey(CACHE_KEYS.PERMISSION_CHECK, { userId, tenantId, resource: '*', action: '*' }),
      this._getCacheKey(CACHE_KEYS.USER_PERMISSIONS, { userId, tenantId }),
      this._getCacheKey(CACHE_KEYS.EFFECTIVE_PERMISSIONS, { userId, tenantId }),
      this._getCacheKey(CACHE_KEYS.INHERITANCE, { userId, tenantId })
    ]

    for (const pattern of patterns) {
      // This implementation depends on cache backend
      // For Redis: await this.cache.del(pattern)
      // For memory cache: might need to iterate and delete matching keys
    }
  }

  /**
   * Health check for permission service
   */
  async healthCheck() {
    try {
      await this.db.query('SELECT 1')
      
      if (this.cache) {
        await this.cache.ping()
      }

      return {
        database: 'healthy',
        cache: this.cache ? 'healthy' : 'not_configured',
        resourceRegistry: this.resourceRegistry.healthCheck(),
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

export default PermissionService