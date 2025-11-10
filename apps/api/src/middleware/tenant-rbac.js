/**
 * Enhanced RBAC Middleware for Hierarchical Tenancy
 * 
 * Integrates with the hierarchical permission system to provide
 * context-aware access control across tenant hierarchies.
 */

import HierarchicalPermissionService from '../services/permission/hierarchical-permission.js';

export class TenantRBACMiddleware {
  constructor(permissionService, cache) {
    this.permissions = permissionService || new HierarchicalPermissionService();
    this.cache = cache;
  }

  // ===================================================================
  // PERMISSION MIDDLEWARE FACTORIES
  // ===================================================================

  /**
   * Require specific permission on tenant
   */
  requirePermission(resource, action, options = {}) {
    return async (request, reply) => {
      try {
        const userId = request.user?.id;
        const tenantId = request.params.id || request.params.tenantId || request.body.tenantId;
        
        if (!userId) {
          return reply.code(401).send({
            success: false,
            error: 'Authentication required'
          });
        }

        if (!tenantId) {
          return reply.code(400).send({
            success: false,
            error: 'Tenant ID required'
          });
        }

        // Build context for ABAC evaluation
        const context = {
          userId,
          tenantId,
          userAgent: request.headers['user-agent'],
          ip: request.ip,
          method: request.method,
          path: request.url,
          ...options.context
        };

        const hasPermission = await this.permissions.checkPermission(
          userId, tenantId, resource, action, context
        );

        if (!hasPermission) {
          return reply.code(403).send({
            success: false,
            error: `Insufficient permissions: ${action} on ${resource}`,
            required: { resource, action },
            tenant: tenantId
          });
        }

        // Add permission context to request for downstream handlers
        request.permission = {
          resource,
          action,
          tenantId,
          verified: true
        };

      } catch (error) {
        request.log.error('Permission check failed:', error);
        return reply.code(500).send({
          success: false,
          error: 'Permission verification failed'
        });
      }
    };
  }

  /**
   * Require specific role on tenant
   */
  requireRole(roles, options = {}) {
    const roleArray = Array.isArray(roles) ? roles : [roles];
    
    return async (request, reply) => {
      try {
        const userId = request.user?.id;
        const tenantId = request.params.id || request.params.tenantId;
        
        if (!userId || !tenantId) {
          return reply.code(400).send({
            success: false,
            error: 'User ID and Tenant ID required'
          });
        }

        const userRole = await this.getUserRole(userId, tenantId, options.includeInherited);

        if (!userRole || !roleArray.includes(userRole)) {
          return reply.code(403).send({
            success: false,
            error: `Required role: ${roleArray.join(' or ')}`,
            userRole: userRole || 'none'
          });
        }

        request.userRole = userRole;
        request.tenantId = tenantId;

      } catch (error) {
        request.log.error('Role check failed:', error);
        return reply.code(500).send({
          success: false,
          error: 'Role verification failed'
        });
      }
    };
  }

  /**
   * Require tenant membership (any role)
   */
  requireMembership(options = {}) {
    return async (request, reply) => {
      try {
        const userId = request.user?.id;
        const tenantId = request.params.id || request.params.tenantId;
        
        if (!userId || !tenantId) {
          return reply.code(400).send({
            success: false,
            error: 'User ID and Tenant ID required'
          });
        }

        const isMember = await this.checkMembership(userId, tenantId, options.includeInherited);

        if (!isMember) {
          return reply.code(403).send({
            success: false,
            error: 'Tenant membership required'
          });
        }

        request.isTenantMember = true;
        request.tenantId = tenantId;

      } catch (error) {
        request.log.error('Membership check failed:', error);
        return reply.code(500).send({
          success: false,
          error: 'Membership verification failed'
        });
      }
    };
  }

  /**
   * Optional permission check (doesn't block request)
   */
  checkOptionalPermission(resource, action) {
    return async (request, reply) => {
      try {
        const userId = request.user?.id;
        const tenantId = request.params.id || request.params.tenantId;
        
        if (userId && tenantId) {
          const hasPermission = await this.permissions.checkPermission(
            userId, tenantId, resource, action
          );
          
          request.hasPermission = hasPermission;
          request.checkedPermission = { resource, action };
        }
      } catch (error) {
        request.log.warn('Optional permission check failed:', error);
        request.hasPermission = false;
      }
    };
  }

  // ===================================================================
  // HIERARCHY-AWARE MIDDLEWARE
  // ===================================================================

  /**
   * Require permission on tenant or any parent tenant
   */
  requireHierarchicalPermission(resource, action) {
    return async (request, reply) => {
      try {
        const userId = request.user?.id;
        const tenantId = request.params.id || request.params.tenantId;
        
        if (!userId || !tenantId) {
          return reply.code(400).send({
            success: false,
            error: 'User ID and Tenant ID required'
          });
        }

        // This automatically checks inheritance via the permission service
        const hasPermission = await this.permissions.checkPermission(
          userId, tenantId, resource, action
        );

        if (!hasPermission) {
          return reply.code(403).send({
            success: false,
            error: `Insufficient hierarchical permissions: ${action} on ${resource}`
          });
        }

        request.hasHierarchicalPermission = true;

      } catch (error) {
        request.log.error('Hierarchical permission check failed:', error);
        return reply.code(500).send({
          success: false,
          error: 'Hierarchical permission verification failed'
        });
      }
    };
  }

  /**
   * Require admin access on tenant or parent tenant
   */
  requireHierarchicalAdmin() {
    return this.requireHierarchicalPermission('tenant', 'admin');
  }

  // ===================================================================
  // DYNAMIC PERMISSION MIDDLEWARE
  // ===================================================================

  /**
   * Permission middleware based on route parameters
   */
  dynamicPermission(resourceParam = 'resource', actionParam = 'action') {
    return async (request, reply) => {
      try {
        const resource = request.params[resourceParam] || request.query[resourceParam];
        const action = request.params[actionParam] || request.query[actionParam];
        
        if (!resource || !action) {
          return reply.code(400).send({
            success: false,
            error: `Resource and action parameters required: ${resourceParam}, ${actionParam}`
          });
        }

        // Delegate to requirePermission
        await this.requirePermission(resource, action)(request, reply);

      } catch (error) {
        request.log.error('Dynamic permission check failed:', error);
        return reply.code(500).send({
          success: false,
          error: 'Dynamic permission verification failed'
        });
      }
    };
  }

  /**
   * Context-aware permission middleware
   */
  contextualPermission(resource, action, contextBuilder) {
    return async (request, reply) => {
      try {
        const context = typeof contextBuilder === 'function' 
          ? await contextBuilder(request) 
          : contextBuilder || {};

        const userId = request.user?.id;
        const tenantId = request.params.id || request.params.tenantId;
        
        if (!userId || !tenantId) {
          return reply.code(400).send({
            success: false,
            error: 'User ID and Tenant ID required'
          });
        }

        const hasPermission = await this.permissions.checkPermission(
          userId, tenantId, resource, action, context
        );

        if (!hasPermission) {
          return reply.code(403).send({
            success: false,
            error: `Contextual permission denied: ${action} on ${resource}`,
            context: Object.keys(context)
          });
        }

        request.permissionContext = context;

      } catch (error) {
        request.log.error('Contextual permission check failed:', error);
        return reply.code(500).send({
          success: false,
          error: 'Contextual permission verification failed'
        });
      }
    };
  }

  // ===================================================================
  // UTILITY METHODS
  // ===================================================================

  /**
   * Get user role on tenant
   */
  async getUserRole(userId, tenantId, includeInherited = true) {
    try {
      // Direct role
      const directResult = await this.permissions.db.query(`
        SELECT role FROM tenant_members 
        WHERE user_id = $1 AND tenant_id = $2 AND joined_at IS NOT NULL
      `, [userId, tenantId]);

      if (directResult.rows.length > 0) {
        return directResult.rows[0].role;
      }

      // Check inherited role if requested
      if (includeInherited) {
        const inheritedRole = await this.getInheritedRole(userId, tenantId);
        return inheritedRole;
      }

      return null;
    } catch (error) {
      console.error('Failed to get user role:', error);
      return null;
    }
  }

  /**
   * Get inherited role from parent tenants
   */
  async getInheritedRole(userId, tenantId) {
    try {
      const result = await this.permissions.db.query(`
        WITH tenant_path AS (
          SELECT path FROM tenants WHERE id = $2
        )
        SELECT tm.role, t.level
        FROM tenant_members tm
        JOIN tenants t ON tm.tenant_id = t.id
        JOIN tenant_path tp ON t.id = ANY(tp.path[1:array_length(tp.path, 1)-1])
        WHERE tm.user_id = $1 
          AND tm.joined_at IS NOT NULL
          AND tm.role IN ('admin', 'owner')
        ORDER BY t.level DESC
        LIMIT 1
      `, [userId, tenantId]);

      return result.rows[0]?.role || null;
    } catch (error) {
      console.error('Failed to get inherited role:', error);
      return null;
    }
  }

  /**
   * Check if user has membership (direct or inherited)
   */
  async checkMembership(userId, tenantId, includeInherited = true) {
    try {
      // Direct membership
      const directResult = await this.permissions.db.query(`
        SELECT 1 FROM tenant_members 
        WHERE user_id = $1 AND tenant_id = $2 AND joined_at IS NOT NULL
      `, [userId, tenantId]);

      if (directResult.rows.length > 0) {
        return true;
      }

      // Inherited membership
      if (includeInherited) {
        const inheritedResult = await this.permissions.db.query(`
          WITH tenant_path AS (
            SELECT path FROM tenants WHERE id = $2
          )
          SELECT 1
          FROM tenant_members tm
          JOIN tenant_path tp ON tm.tenant_id = ANY(tp.path[1:array_length(tp.path, 1)-1])
          WHERE tm.user_id = $1 AND tm.joined_at IS NOT NULL
          LIMIT 1
        `, [userId, tenantId]);

        return inheritedResult.rows.length > 0;
      }

      return false;
    } catch (error) {
      console.error('Failed to check membership:', error);
      return false;
    }
  }

  /**
   * Get user's effective permissions summary
   */
  async getPermissionSummary(userId, tenantId) {
    try {
      const [role, permissions, membership] = await Promise.all([
        this.getUserRole(userId, tenantId, true),
        this.permissions.getEffectivePermissions(userId, tenantId),
        this.checkMembership(userId, tenantId, true)
      ]);

      return {
        userId,
        tenantId,
        role,
        isMember: membership,
        permissions: permissions.effective,
        sources: {
          direct: permissions.direct.length,
          inherited: permissions.inherited.length,
          role: !!permissions.role
        }
      };
    } catch (error) {
      console.error('Failed to get permission summary:', error);
      return null;
    }
  }
}

/**
 * Factory function to create RBAC middleware with dependencies
 */
export function createTenantRBACMiddleware(database, cache) {
  const permissionService = new HierarchicalPermissionService(database, cache);
  return new TenantRBACMiddleware(permissionService, cache);
}

export default TenantRBACMiddleware;