/**
 * Authorization Service
 * 
 * High-level authorization API that orchestrates RBAC, ABAC, and hierarchical
 * inheritance for comprehensive access control decisions.
 */

import PermissionService from './permission-service.js'
import PolicyEngine from './policy-engine.js'
import RoleService from './role-service.js'
import ResourceRegistry from './resource-registry.js'
import { RBAC_CONFIG, DEFAULT_ROLES, CACHE_KEYS, AUDIT_EVENTS } from './config.js'

export class AuthorizationService {
  constructor(database, auditLogger, cache = null, tenantHierarchyService = null) {
    this.db = database
    this.auditLogger = auditLogger
    this.cache = cache
    this.tenantHierarchy = tenantHierarchyService
    
    // Initialize component services
    this.permissionService = new PermissionService(database, auditLogger, cache)
    this.policyEngine = new PolicyEngine(database, auditLogger, cache)
    this.roleService = new RoleService(database, auditLogger, cache)
    this.resourceRegistry = new ResourceRegistry()
    
    this.cachePrefix = 'rbac:auth:'
    this.cacheTTL = RBAC_CONFIG.PERMISSION_CACHE_TTL
  }

  // ===================================================================
  // PRIMARY AUTHORIZATION
  // ===================================================================

  /**
   * Primary authorization check - orchestrates all access control mechanisms
   */
  async authorize(userId, tenantId, action, resource, context = {}) {
    const startTime = Date.now()
    
    try {
      // Parse resource
      const parsed = this.resourceRegistry.resolveResource(resource)
      
      // Enhance context with request metadata
      const enhancedContext = {
        ...context,
        userId,
        tenantId,
        resource: parsed,
        action,
        timestamp: new Date()
      }

      // Check cache first
      const cacheKey = this._getCacheKey('authorize', {
        userId, tenantId, resource, action
      })
      
      if (this.cache) {
        const cached = await this.cache.get(cacheKey)
        if (cached) {
          const result = JSON.parse(cached)
          result.metadata.cacheHit = true
          return result
        }
      }

      // Execute authorization decision tree
      const decision = await this._executeAuthorizationDecisionTree(
        userId, tenantId, parsed, action, enhancedContext
      )

      const evaluationTime = Date.now() - startTime
      
      const result = {
        allowed: decision.allowed,
        reason: decision.reason,
        source: decision.source,
        expiresAt: decision.expiresAt,
        conditions: decision.conditions,
        metadata: {
          evaluationTime,
          policiesEvaluated: decision.policiesEvaluated || 0,
          cacheHit: false,
          tenantId,
          userId,
          resource: parsed.resourceString,
          action,
          evaluatedAt: new Date()
        }
      }

      // Log audit event
      await this.auditLogger.logEvent({
        action: decision.allowed ? AUDIT_EVENTS.ACCESS_GRANTED : AUDIT_EVENTS.ACCESS_DENIED,
        orgId: tenantId,
        actorUserId: userId,
        targetType: 'resource',
        targetId: parsed.id || parsed.type,
        details: {
          resource: parsed.resourceString,
          action,
          allowed: decision.allowed,
          source: decision.source,
          reason: decision.reason,
          evaluationTime
        },
        category: 'rbac'
      })

      // Cache successful results
      if (this.cache && decision.allowed) {
        const cacheTTL = decision.expiresAt ? 
          Math.min(this.cacheTTL, Math.floor((new Date(decision.expiresAt) - new Date()) / 1000)) :
          this.cacheTTL
        
        await this.cache.setex(cacheKey, cacheTTL, JSON.stringify(result))
      }

      return result
    } catch (error) {
      const evaluationTime = Date.now() - startTime
      
      // Log error
      await this.auditLogger.logEvent({
        action: AUDIT_EVENTS.ACCESS_DENIED,
        orgId: tenantId,
        actorUserId: userId,
        targetType: 'resource',
        targetId: resource,
        details: {
          resource,
          action,
          error: error.message,
          evaluationTime
        },
        category: 'rbac'
      })

      return {
        allowed: false,
        reason: `Authorization error: ${error.message}`,
        source: 'error',
        metadata: {
          evaluationTime,
          error: error.message,
          evaluatedAt: new Date()
        }
      }
    }
  }

  /**
   * Batch authorization for multiple checks
   */
  async authorizeMany(userId, tenantId, checks) {
    if (!Array.isArray(checks) || checks.length === 0) {
      throw new Error('Checks must be a non-empty array')
    }

    const results = await Promise.all(
      checks.map(async (check, index) => {
        try {
          const { action, resource, context = {} } = check
          const result = await this.authorize(userId, tenantId, action, resource, context)
          return { index, ...result }
        } catch (error) {
          return {
            index,
            allowed: false,
            reason: `Authorization error: ${error.message}`,
            source: 'error',
            metadata: { error: error.message }
          }
        }
      })
    )

    return {
      userId,
      tenantId,
      total: checks.length,
      allowed: results.filter(r => r.allowed).length,
      denied: results.filter(r => !r.allowed).length,
      results
    }
  }

  /**
   * Get permission matrix for user
   */
  async getPermissionMatrix(userId, tenantId) {
    const cacheKey = this._getCacheKey('matrix', { userId, tenantId })
    
    if (this.cache) {
      const cached = await this.cache.get(cacheKey)
      if (cached) return JSON.parse(cached)
    }

    try {
      // Get all resource types
      const resourceTypes = this.resourceRegistry.listResourceTypes()
      
      // Get user's effective permissions
      const effectivePermissions = await this.permissionService.getEffectivePermissions(userId, tenantId)
      
      // Get user's role
      const member = await this.db.query(`
        SELECT role FROM tenant_members 
        WHERE user_id = $1 AND tenant_id = $2 AND joined_at IS NOT NULL
      `, [userId, tenantId])
      
      const userRole = member.rows[0]?.role || null
      
      // Build permission matrix
      const matrix = {}
      
      for (const resourceType of resourceTypes) {
        matrix[resourceType.type] = {}
        
        for (const action of resourceType.actions) {
          // Check if user has this permission
          const hasPermission = await this._checkPermissionInMatrix(
            userId, tenantId, resourceType.type, action, effectivePermissions, userRole
          )
          
          matrix[resourceType.type][action] = hasPermission
        }
      }

      const result = {
        userId,
        tenantId,
        role: userRole,
        matrix,
        generatedAt: new Date(),
        effectivePermissions: effectivePermissions.combined.length
      }

      if (this.cache) {
        await this.cache.setex(cacheKey, this.cacheTTL, JSON.stringify(result))
      }

      return result
    } catch (error) {
      throw new Error(`Failed to generate permission matrix: ${error.message}`)
    }
  }

  // ===================================================================
  // ACCESS CHECKS
  // ===================================================================

  /**
   * Simple access check
   */
  async canAccess(userId, resource, action, context = {}) {
    // Extract tenant ID from context or resource
    const tenantId = context.tenantId || this._extractTenantFromContext(context)
    if (!tenantId) {
      throw new Error('Tenant ID required for access check')
    }

    const result = await this.authorize(userId, tenantId, action, resource, context)
    return result.allowed
  }

  /**
   * Multiple resource access check
   */
  async canAccessMultiple(userId, resources, action) {
    const results = {}
    
    for (const resource of resources) {
      try {
        const tenantId = this._extractTenantFromResource(resource)
        results[resource] = await this.canAccess(userId, resource, action, { tenantId })
      } catch (error) {
        results[resource] = false
      }
    }
    
    return results
  }

  // ===================================================================
  // ROLE-BASED CHECKS
  // ===================================================================

  /**
   * Check if user has role
   */
  async hasRole(userId, tenantId, role) {
    try {
      const result = await this.db.query(`
        SELECT 1 FROM tenant_members 
        WHERE user_id = $1 AND tenant_id = $2 AND role = $3 AND joined_at IS NOT NULL
      `, [userId, tenantId, role])

      return result.rows.length > 0
    } catch (error) {
      throw new Error(`Failed to check role: ${error.message}`)
    }
  }

  /**
   * Check if user has any of the specified roles
   */
  async hasAnyRole(userId, tenantId, roles) {
    const normalizedRoles = Array.isArray(roles) ? roles : [roles]
    
    try {
      const result = await this.db.query(`
        SELECT 1 FROM tenant_members 
        WHERE user_id = $1 AND tenant_id = $2 AND role = ANY($3::text[]) AND joined_at IS NOT NULL
      `, [userId, tenantId, normalizedRoles])

      return result.rows.length > 0
    } catch (error) {
      throw new Error(`Failed to check roles: ${error.message}`)
    }
  }

  /**
   * Get user roles for tenant
   */
  async getRoles(userId, tenantId) {
    try {
      const result = await this.db.query(`
        SELECT role, joined_at FROM tenant_members 
        WHERE user_id = $1 AND tenant_id = $2 AND joined_at IS NOT NULL
      `, [userId, tenantId])

      return result.rows.map(row => ({
        role: row.role,
        assignedAt: row.joined_at
      }))
    } catch (error) {
      throw new Error(`Failed to get roles: ${error.message}`)
    }
  }

  // ===================================================================
  // HIERARCHICAL INHERITANCE
  // ===================================================================

  /**
   * Get accessible tenants for user
   */
  async getAccessibleTenants(userId) {
    try {
      // Get direct tenant memberships
      const directResult = await this.db.query(`
        SELECT t.id, t.name, t.slug, t.level, tm.role
        FROM tenants t
        JOIN tenant_members tm ON tm.tenant_id = t.id
        WHERE tm.user_id = $1 AND tm.joined_at IS NOT NULL
        ORDER BY t.level ASC, t.name ASC
      `, [userId])

      const accessibleTenants = directResult.rows.map(row => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        level: row.level,
        role: row.role,
        accessType: 'direct'
      }))

      // Add inherited access if enabled
      if (RBAC_CONFIG.ENABLE_HIERARCHICAL_INHERITANCE && this.tenantHierarchy) {
        for (const tenant of accessibleTenants) {
          if (['owner', 'admin'].includes(tenant.role)) {
            // Get descendant tenants
            const descendants = await this.tenantHierarchy.getDescendants(tenant.id)
            
            for (const descendant of descendants) {
              // Check if not already directly accessible
              if (!accessibleTenants.find(t => t.id === descendant.id)) {
                accessibleTenants.push({
                  id: descendant.id,
                  name: descendant.name,
                  slug: descendant.slug,
                  level: descendant.level,
                  role: 'inherited',
                  accessType: 'inherited',
                  inheritedFrom: tenant.id,
                  inheritedRole: tenant.role
                })
              }
            }
          }
        }
      }

      return accessibleTenants.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
    } catch (error) {
      throw new Error(`Failed to get accessible tenants: ${error.message}`)
    }
  }

  /**
   * Get accessible resources for user in tenant
   */
  async getAccessibleResources(userId, tenantId, resourceType) {
    try {
      // Validate resource type
      if (!this.resourceRegistry.getResourceType(resourceType)) {
        throw new Error(`Unknown resource type: ${resourceType}`)
      }

      // Get user permissions for this resource type
      const permissions = await this.permissionService.getUserPermissions(userId, tenantId)
      
      const accessibleResources = permissions.permissions
        .filter(p => p.resourceType === resourceType)
        .map(p => ({
          resourceId: p.resourceId,
          actions: p.actions,
          source: p.inherited ? 'inherited' : 'direct',
          conditions: p.conditions,
          expiresAt: p.expiresAt
        }))

      return {
        resourceType,
        tenantId,
        userId,
        resources: accessibleResources,
        totalCount: accessibleResources.length
      }
    } catch (error) {
      throw new Error(`Failed to get accessible resources: ${error.message}`)
    }
  }

  /**
   * Resolve inherited access from parent tenants
   */
  async resolveInheritedAccess(userId, tenantId, action, resource) {
    if (!RBAC_CONFIG.ENABLE_HIERARCHICAL_INHERITANCE || !this.tenantHierarchy) {
      return { allowed: false, source: 'no_inheritance' }
    }

    try {
      // Get tenant ancestors
      const ancestors = await this.tenantHierarchy.getAncestors(tenantId)
      
      // Check each ancestor for admin/owner access
      for (const ancestor of ancestors) {
        const hasAdminAccess = await this.hasAnyRole(userId, ancestor.id, ['owner', 'admin'])
        
        if (hasAdminAccess) {
          // Check if admin role allows this action on this resource
          const rolePermissions = await this.roleService.getRolePermissions(ancestor.id, 'admin')
          
          if (this._checkRolePermission(rolePermissions.permissions, resource, action)) {
            return {
              allowed: true,
              source: 'inherited',
              ancestorId: ancestor.id,
              ancestorName: ancestor.name,
              ancestorLevel: ancestor.level
            }
          }
        }
      }

      return { allowed: false, source: 'no_inherited_access' }
    } catch (error) {
      return { 
        allowed: false, 
        source: 'inheritance_error',
        error: error.message 
      }
    }
  }

  // ===================================================================
  // INTERNAL METHODS
  // ===================================================================

  /**
   * Execute authorization decision tree
   */
  async _executeAuthorizationDecisionTree(userId, tenantId, resource, action, context) {
    let policiesEvaluated = 0

    // 1. Check direct permissions
    const directPermission = await this.permissionService.hasPermission(
      userId, tenantId, resource.resourceString, action, context
    )
    
    if (directPermission.allowed) {
      return {
        allowed: true,
        reason: 'Direct permission granted',
        source: directPermission.source,
        expiresAt: directPermission.permission?.expiresAt,
        conditions: directPermission.permission?.conditions
      }
    }

    // 2. Check role-based permissions
    const userRoles = await this.getRoles(userId, tenantId)
    
    for (const userRole of userRoles) {
      const rolePermissions = await this.roleService.getRolePermissions(tenantId, userRole.role)
      
      if (this._checkRolePermission(rolePermissions.permissions, resource.resourceString, action)) {
        return {
          allowed: true,
          reason: `Role-based permission (${userRole.role})`,
          source: 'role',
          role: userRole.role
        }
      }
    }

    // 3. Check inherited permissions
    if (RBAC_CONFIG.ENABLE_HIERARCHICAL_INHERITANCE) {
      const inheritedAccess = await this.resolveInheritedAccess(
        userId, tenantId, action, resource.resourceString
      )
      
      if (inheritedAccess.allowed) {
        return {
          allowed: true,
          reason: `Inherited from parent tenant (${inheritedAccess.ancestorName})`,
          source: 'inherited',
          ancestorId: inheritedAccess.ancestorId
        }
      }
    }

    // 4. Check ABAC policies
    const policies = await this.policyEngine.listPolicies({ 
      tenantId, 
      effect: 'allow',
      limit: RBAC_CONFIG.MAX_POLICIES_PER_TENANT 
    })
    
    for (const policy of policies.policies) {
      if (this._policyApplies(policy, resource.resourceString, action)) {
        const evaluation = await this.policyEngine.evaluatePolicy(policy, context)
        policiesEvaluated++
        
        if (evaluation.allowed) {
          return {
            allowed: true,
            reason: `ABAC policy: ${policy.name}`,
            source: 'policy',
            policy: policy,
            conditions: evaluation.conditions,
            policiesEvaluated
          }
        }
      }
    }

    // 5. Default deny
    return {
      allowed: false,
      reason: 'No matching permissions found',
      source: 'default_deny',
      policiesEvaluated
    }
  }

  /**
   * Check if permission exists in matrix
   */
  async _checkPermissionInMatrix(userId, tenantId, resourceType, action, effectivePermissions, userRole) {
    // Check direct permissions
    const hasDirectPermission = effectivePermissions.combined.some(p => 
      p.resourceType === resourceType && 
      this._checkActionMatch(p.actions, action)
    )
    
    if (hasDirectPermission) return true

    // Check role-based permission
    if (userRole && DEFAULT_ROLES[userRole]) {
      const rolePermissions = DEFAULT_ROLES[userRole].permissions
      return this._checkRolePermission(rolePermissions, `${resourceType}:*`, action)
    }

    return false
  }

  /**
   * Check if action matches permission actions
   */
  _checkActionMatch(permissionActions, requestedAction) {
    if (!Array.isArray(permissionActions)) return false
    
    // Direct match
    if (permissionActions.includes(requestedAction) || permissionActions.includes('*')) {
      return true
    }
    
    // Check action hierarchy
    for (const permAction of permissionActions) {
      const includedActions = this.resourceRegistry.getIncludedActions(permAction)
      if (includedActions.includes(requestedAction)) {
        return true
      }
    }
    
    return false
  }

  /**
   * Check role permission
   */
  _checkRolePermission(rolePermissions, resource, action) {
    for (const permission of rolePermissions) {
      if (permission === '*:*') return true
      
      const [permResource, permActions] = permission.split(':')
      if (permResource === '*' || permResource === resource.split(':')[0]) {
        const actions = permActions.split(',').map(a => a.trim())
        if (actions.includes('*') || actions.includes(action)) {
          return true
        }
        
        // Check action hierarchy
        for (const permAction of actions) {
          const includedActions = this.resourceRegistry.getIncludedActions(permAction)
          if (includedActions.includes(action)) {
            return true
          }
        }
      }
    }
    
    return false
  }

  /**
   * Check if policy applies to resource and action
   */
  _policyApplies(policy, resource, action) {
    const resourceType = resource.split(':')[0]
    
    // Check if policy covers this resource
    const resourceMatches = policy.resources.length === 0 || 
      policy.resources.some(r => 
        r === '*' || 
        r === resource || 
        r === `${resourceType}:*` ||
        r === resourceType
      )
    
    if (!resourceMatches) return false
    
    // Check if policy covers this action
    const actionMatches = policy.actions.length === 0 ||
      policy.actions.includes('*') ||
      policy.actions.includes(action)
    
    return actionMatches
  }

  /**
   * Extract tenant ID from context
   */
  _extractTenantFromContext(context) {
    return context.tenantId || 
           context.tenant?.id || 
           context.request?.params?.tenantId ||
           context.request?.headers?.['x-tenant-id']
  }

  /**
   * Extract tenant ID from resource
   */
  _extractTenantFromResource(resource) {
    // This is a simplified implementation
    // In practice, you'd need to query the database to find which tenant owns this resource
    return null
  }

  /**
   * Generate cache key
   */
  _getCacheKey(type, params) {
    const parts = [this.cachePrefix, type]
    for (const [key, value] of Object.entries(params)) {
      parts.push(`${key}:${value}`)
    }
    return parts.join(':')
  }

  /**
   * Health check for authorization service
   */
  async healthCheck() {
    try {
      const [permissionHealth, policyHealth, roleHealth, resourceHealth] = await Promise.all([
        this.permissionService.healthCheck(),
        this.policyEngine.healthCheck(),
        this.roleService.healthCheck(),
        this.resourceRegistry.healthCheck()
      ])

      const allHealthy = [permissionHealth, policyHealth, roleHealth, resourceHealth]
        .every(h => h.status === 'healthy' || h.status === 'operational')

      return {
        status: allHealthy ? 'operational' : 'degraded',
        components: {
          permissions: permissionHealth.status,
          policies: policyHealth.status,
          roles: roleHealth.status,
          resources: resourceHealth.status
        },
        database: permissionHealth.database,
        cache: permissionHealth.cache,
        hierarchicalInheritance: RBAC_CONFIG.ENABLE_HIERARCHICAL_INHERITANCE,
        tenantHierarchyAvailable: !!this.tenantHierarchy
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      }
    }
  }
}

export default AuthorizationService