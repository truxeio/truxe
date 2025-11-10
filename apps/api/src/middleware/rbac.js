/**
 * RBAC Middleware
 * 
 * Fastify middleware for request authorization using the RBAC system.
 * Provides decorators and preHandlers for protecting routes.
 */

import AuthorizationService from '../services/rbac/authorization-service.js'
import { ERROR_CODES } from '../services/rbac/config.js'

// Global authorization service instance
let authService = null

/**
 * Initialize RBAC middleware with dependencies
 */
export function initializeRBAC(database, auditLogger, cache = null, tenantHierarchy = null) {
  authService = new AuthorizationService(database, auditLogger, cache, tenantHierarchy)
  return authService
}

/**
 * Get authorization service instance
 */
export function getAuthorizationService() {
  if (!authService) {
    throw new Error('RBAC middleware not initialized. Call initializeRBAC() first.')
  }
  return authService
}

/**
 * Permission middleware factory
 * 
 * @param {string} resource - Resource identifier (e.g., 'documents', 'projects:123')
 * @param {string|string[]} action - Action(s) required (e.g., 'read', ['read', 'write'])
 * @param {Object} options - Additional options
 * @returns {Function} Fastify preHandler
 */
export function requirePermission(resource, action, options = {}) {
  const {
    extractTenantId = (request) => request.params.tenantId || request.headers['x-tenant-id'],
    extractUserId = (request) => request.user?.id,
    extractContext = (request) => ({}),
    onDenied = null,
    allowSuperAdmin = false
  } = options

  return async function permissionHandler(request, reply) {
    try {
      // Extract user information
      const userId = extractUserId(request)
      if (!userId) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'User authentication required',
          code: 'USER_NOT_AUTHENTICATED'
        })
      }

      // Extract tenant context
      const tenantId = extractTenantId(request)
      if (!tenantId) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Tenant context required',
          code: 'TENANT_CONTEXT_MISSING'
        })
      }

      // Check for super admin bypass
      if (allowSuperAdmin && request.user?.role === 'super_admin') {
        request.authDecision = {
          allowed: true,
          reason: 'Super admin access',
          source: 'super_admin',
          metadata: { bypassedPermission: true }
        }
        return
      }

      // Build authorization context
      const context = {
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        time: new Date(),
        request: {
          method: request.method,
          path: request.url,
          params: request.params,
          query: request.query,
          headers: request.headers
        },
        user: request.user,
        tenant: { id: tenantId },
        ...extractContext(request)
      }

      // Handle multiple actions
      const actions = Array.isArray(action) ? action : [action]
      let authDecision = null

      // Check each action (any one passing is sufficient)
      for (const singleAction of actions) {
        const decision = await authService.authorize(
          userId,
          tenantId,
          singleAction,
          resource,
          context
        )

        if (decision.allowed) {
          authDecision = decision
          break
        }
      }

      // If no action was allowed, use the last decision for error details
      if (!authDecision || !authDecision.allowed) {
        const finalDecision = await authService.authorize(
          userId,
          tenantId,
          actions[0], // Use first action for error reporting
          resource,
          context
        )

        // Call custom denied handler if provided
        if (onDenied) {
          const customResponse = await onDenied(request, reply, finalDecision)
          if (customResponse) return customResponse
        }

        return reply.code(403).send({
          error: 'Forbidden',
          message: finalDecision.reason || 'Insufficient permissions',
          code: ERROR_CODES.PERMISSION_DENIED,
          required: {
            resource,
            action: actions.length === 1 ? actions[0] : actions,
            tenant: tenantId
          },
          details: {
            source: finalDecision.source,
            evaluationTime: finalDecision.metadata?.evaluationTime
          }
        })
      }

      // Attach authorization decision to request
      request.authDecision = authDecision
      request.rbacContext = {
        userId,
        tenantId,
        resource,
        action: actions,
        allowed: true
      }

    } catch (error) {
      request.log.error({ error, resource, action }, 'Permission check failed')
      
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Permission evaluation failed',
        code: 'PERMISSION_CHECK_ERROR'
      })
    }
  }
}

/**
 * Role middleware factory
 * 
 * @param {string|string[]} role - Required role(s)
 * @param {Object} options - Additional options
 * @returns {Function} Fastify preHandler
 */
export function requireRole(role, options = {}) {
  const {
    extractTenantId = (request) => request.params.tenantId || request.headers['x-tenant-id'],
    extractUserId = (request) => request.user?.id,
    requireAll = false // If true, user must have ALL roles; if false, ANY role
  } = options

  return async function roleHandler(request, reply) {
    try {
      const userId = extractUserId(request)
      if (!userId) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'User authentication required',
          code: 'USER_NOT_AUTHENTICATED'
        })
      }

      const tenantId = extractTenantId(request)
      if (!tenantId) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Tenant context required',
          code: 'TENANT_CONTEXT_MISSING'
        })
      }

      const roles = Array.isArray(role) ? role : [role]
      let hasRequiredRole = false

      if (requireAll) {
        // Check if user has ALL required roles
        hasRequiredRole = true
        for (const requiredRole of roles) {
          if (!(await authService.hasRole(userId, tenantId, requiredRole))) {
            hasRequiredRole = false
            break
          }
        }
      } else {
        // Check if user has ANY required role
        hasRequiredRole = await authService.hasAnyRole(userId, tenantId, roles)
      }

      if (!hasRequiredRole) {
        return reply.code(403).send({
          error: 'Forbidden',
          message: `Required role(s): ${roles.join(requireAll ? ' AND ' : ' OR ')}`,
          code: ERROR_CODES.INVALID_ROLE,
          required: {
            roles,
            tenant: tenantId,
            requireAll
          }
        })
      }

      // Attach role information to request
      request.rbacContext = {
        ...request.rbacContext,
        roles: await authService.getRoles(userId, tenantId),
        hasRequiredRole: true
      }

    } catch (error) {
      request.log.error({ error, role }, 'Role check failed')
      
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Role evaluation failed',
        code: 'ROLE_CHECK_ERROR'
      })
    }
  }
}

/**
 * Multiple roles middleware - requires ANY of the specified roles
 */
export function requireAnyRole(roles, options = {}) {
  return requireRole(roles, { ...options, requireAll: false })
}

/**
 * Multiple roles middleware - requires ALL of the specified roles
 */
export function requireAllRoles(roles, options = {}) {
  return requireRole(roles, { ...options, requireAll: true })
}

/**
 * Tenant access middleware - ensures user has access to tenant
 */
export function requireTenantAccess(options = {}) {
  return requirePermission('tenants', 'read', options)
}

/**
 * Tenant admin middleware - ensures user has admin access to tenant
 */
export function requireTenantAdmin(options = {}) {
  return requireAnyRole(['owner', 'admin'], options)
}

/**
 * Admin middleware - ensures user has admin role
 */
export function requireAdmin(options = {}) {
  return requireRole('admin', options)
}

/**
 * Require user to be a member of the organization
 */
export function requireOrganizationMembership(options = {}) {
  const {
    extractOrganizationId = (request) => request.params.id || request.params.organizationId,
    extractUserId = (request) => request.user?.id,
  } = options

  return async function organizationMembershipHandler(request, reply) {
    try {
      const organizationId = extractOrganizationId(request)
      const userId = extractUserId(request)

      if (!userId) {
        return reply.code(401).send({
          success: false,
          error: 'Authentication required'
        })
      }

      if (!organizationId) {
        return reply.code(400).send({
          success: false,
          error: 'Organization ID required'
        })
      }

      // Check if user is a member of the organization
      const authService = getAuthorizationService()
      const isMember = await authService.hasRole(userId, organizationId, ['owner', 'admin', 'member', 'viewer'])

      if (!isMember) {
        return reply.code(403).send({
          success: false,
          error: 'Not a member of this organization'
        })
      }

      // User is a member, continue
      return
    } catch (error) {
      request.log.error({ err: error }, 'Organization membership check failed')
      return reply.code(500).send({
        success: false,
        error: 'Failed to verify organization membership'
      })
    }
  }
}

/**
 * Get user's organizations with their roles
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Organizations with roles
 */
export async function getUserOrganizationsWithRoles(userId) {
  const authService = getAuthorizationService()
  const db = authService.database

  const result = await db.query(`
    SELECT
      o.id,
      o.name,
      o.slug,
      o.parent_id,
      ur.role
    FROM organizations_old o
    INNER JOIN user_roles ur ON o.id = ur.tenant_id
    WHERE ur.user_id = $1
    ORDER BY o.name
  `, [userId])

  return result.rows
}

/**
 * Validate organization access for a user
 * @param {string} organizationId - Organization ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Access validation result
 */
export async function validateOrganizationAccess(organizationId, userId) {
  const authService = getAuthorizationService()

  try {
    const hasRole = await authService.hasRole(userId, organizationId, ['owner', 'admin', 'member', 'viewer'])

    return {
      hasAccess: hasRole,
      organizationId,
      userId
    }
  } catch (error) {
    return {
      hasAccess: false,
      organizationId,
      userId,
      error: error.message
    }
  }
}

/**
 * Log access attempt for audit purposes
 * @param {Object} attempt - Access attempt details
 * @returns {Promise<void>}
 */
export async function logAccessAttempt(attempt) {
  const authService = getAuthorizationService()
  const { userId, orgId, resource, action, granted, reason } = attempt

  // Use audit logger if available
  if (authService.auditLogger) {
    await authService.auditLogger.logAccessAttempt({
      userId,
      tenantId: orgId,
      resource,
      action,
      granted: granted || false,
      reason: reason || 'Access denied',
      timestamp: new Date().toISOString()
    })
  }
}

/**
 * Fastify plugin for RBAC
 */
export function rbacPlugin(fastify, options, done) {
  // Decorate fastify instance with RBAC utilities
  fastify.decorate('rbac', {
    authorize: async (userId, tenantId, action, resource, context = {}) => {
      return await authService.authorize(userId, tenantId, action, resource, context)
    },
    hasPermission: async (userId, tenantId, resource, action, context = {}) => {
      const result = await authService.authorize(userId, tenantId, action, resource, context)
      return result.allowed
    },
    hasRole: async (userId, tenantId, role) => {
      return await authService.hasRole(userId, tenantId, role)
    },
    getPermissionMatrix: async (userId, tenantId) => {
      return await authService.getPermissionMatrix(userId, tenantId)
    }
  })

  // Decorate request with RBAC context
  fastify.decorateRequest('rbacContext', {})
  fastify.decorateRequest('authDecision', {})

  // Add hooks for logging
  fastify.addHook('onRequest', async (request, reply) => {
    request.rbacContext = {}
  })

  // Add response hook for audit logging
  fastify.addHook('onResponse', async (request, reply) => {
    if (request.rbacContext && Object.keys(request.rbacContext).length > 0) {
      // Log RBAC decisions for audit trail
      request.log.info({
        rbac: request.rbacContext,
        authDecision: request.authDecision,
        statusCode: reply.statusCode
      }, 'RBAC decision logged')
    }
  })

  done()
}

/**
 * Health check endpoint for RBAC middleware
 */
export async function rbacHealthCheck() {
  if (!authService) {
    return {
      status: 'unhealthy',
      error: 'RBAC service not initialized'
    }
  }

  return await authService.healthCheck()
}

// Export convenience middleware combinations
export const commonMiddleware = {
  // Tenant owner or admin
  tenantAdmin: () => requireAnyRole(['owner', 'admin']),
  
  // Basic tenant access
  tenantMember: () => requirePermission('tenants', 'read'),
  
  // Document management
  documentRead: () => requirePermission('documents', 'read'),
  documentWrite: () => requirePermission('documents', 'write'),
  documentAdmin: () => requirePermission('documents', 'admin'),
  
  // Project management
  projectRead: () => requirePermission('projects', 'read'),
  projectWrite: () => requirePermission('projects', 'write'),
  projectAdmin: () => requirePermission('projects', 'admin'),
  
  // Member management
  memberRead: () => requirePermission('members', 'read'),
  memberWrite: () => requirePermission('members', 'write'),
  memberAdmin: () => requirePermission('members', 'admin'),
  
  // Settings management
  settingsRead: () => requirePermission('settings', 'read'),
  settingsWrite: () => requirePermission('settings', 'write')
}

export default {
  initializeRBAC,
  getAuthorizationService,
  requirePermission,
  requireRole,
  requireAnyRole,
  requireAllRoles,
  requireTenantAccess,
  requireTenantAdmin,
  requireAdmin,
  requireOrganizationMembership,
  getUserOrganizationsWithRoles,
  validateOrganizationAccess,
  logAccessAttempt,
  rbacPlugin,
  rbacHealthCheck,
  commonMiddleware
}