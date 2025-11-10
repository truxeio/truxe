/**
 * Hierarchical Permission System
 * 
 * Implements permission inheritance across tenant hierarchies with
 * role-based access control (RBAC) and attribute-based access control (ABAC).
 */

export class HierarchicalPermissionService {
  constructor(database, cache) {
    this.db = database;
    this.cache = cache;
    this.cachePrefix = 'permissions:';
    this.cacheTTL = 300; // 5 minutes
  }

  // ===================================================================
  // PERMISSION INHERITANCE
  // ===================================================================

  /**
   * Check if user has permission on tenant (with inheritance)
   */
  async checkPermission(userId, tenantId, resource, action, context = {}) {
    const cacheKey = `${this.cachePrefix}check:${userId}:${tenantId}:${resource}:${action}`;
    
    // Try cache first
    if (this.cache) {
      const cached = await this.cache.get(cacheKey);
      if (cached !== null) return JSON.parse(cached);
    }

    try {
      // 1. Check direct permissions
      const directPermission = await this.checkDirectPermission(userId, tenantId, resource, action);
      if (directPermission) {
        await this.cacheResult(cacheKey, true);
        return true;
      }

      // 2. Check role-based permissions
      const rolePermission = await this.checkRolePermission(userId, tenantId, resource, action);
      if (rolePermission) {
        await this.cacheResult(cacheKey, true);
        return true;
      }

      // 3. Check inherited permissions from parent tenants
      const inheritedPermission = await this.checkInheritedPermission(userId, tenantId, resource, action);
      if (inheritedPermission) {
        await this.cacheResult(cacheKey, true);
        return true;
      }

      // 4. Check ABAC conditions
      const abacPermission = await this.checkABACPermission(userId, tenantId, resource, action, context);
      
      await this.cacheResult(cacheKey, abacPermission);
      return abacPermission;

    } catch (error) {
      console.error('Permission check failed:', error);
      return false;
    }
  }

  /**
   * Check direct permission grants
   */
  async checkDirectPermission(userId, tenantId, resource, action) {
    const result = await this.db.query(`
      SELECT 1 FROM permissions 
      WHERE user_id = $1 
        AND tenant_id = $2 
        AND resource_type = $3 
        AND $4 = ANY(actions)
        AND (expires_at IS NULL OR expires_at > NOW())
    `, [userId, tenantId, resource, action]);

    return result.rows.length > 0;
  }

  /**
   * Check role-based permissions
   */
  async checkRolePermission(userId, tenantId, resource, action) {
    const result = await this.db.query(`
      SELECT tm.role
      FROM tenant_members tm
      WHERE tm.user_id = $1 
        AND tm.tenant_id = $2
        AND tm.joined_at IS NOT NULL
    `, [userId, tenantId]);

    if (result.rows.length === 0) return false;

    const role = result.rows[0].role;
    return this.roleHasPermission(role, resource, action);
  }

  /**
   * Check inherited permissions from parent tenants
   */
  async checkInheritedPermission(userId, tenantId, resource, action) {
    // Get tenant path to check all parents
    const tenantResult = await this.db.query(`
      SELECT path FROM tenants WHERE id = $1
    `, [tenantId]);

    if (tenantResult.rows.length === 0) return false;

    const path = tenantResult.rows[0].path;
    
    // Check permissions on each parent tenant in the path
    for (let i = path.length - 2; i >= 0; i--) {
      const parentId = path[i];
      
      // Check if user has admin/owner role on parent (can manage children)
      const parentRole = await this.db.query(`
        SELECT role FROM tenant_members 
        WHERE user_id = $1 AND tenant_id = $2 AND joined_at IS NOT NULL
      `, [userId, parentId]);

      if (parentRole.rows.length > 0) {
        const role = parentRole.rows[0].role;
        
        // Admins and owners can manage child tenants
        if (['admin', 'owner'].includes(role)) {
          if (this.roleHasPermission(role, resource, action)) {
            return true;
          }
        }
      }

      // Check explicit inherited permissions
      const inheritedResult = await this.db.query(`
        SELECT 1 FROM permissions 
        WHERE user_id = $1 
          AND tenant_id = $2 
          AND resource_type = $3 
          AND $4 = ANY(actions)
          AND (expires_at IS NULL OR expires_at > NOW())
      `, [userId, parentId, resource, action]);

      if (inheritedResult.rows.length > 0) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check ABAC (Attribute-Based Access Control) conditions
   */
  async checkABACPermission(userId, tenantId, resource, action, context) {
    const result = await this.db.query(`
      SELECT conditions FROM permissions 
      WHERE user_id = $1 
        AND tenant_id = $2 
        AND resource_type = $3 
        AND $4 = ANY(actions)
        AND conditions IS NOT NULL
        AND jsonb_typeof(conditions) = 'object'
        AND (expires_at IS NULL OR expires_at > NOW())
    `, [userId, tenantId, resource, action]);

    for (const row of result.rows) {
      if (this.evaluateABACConditions(row.conditions, context)) {
        return true;
      }
    }

    return false;
  }

  // ===================================================================
  // ROLE-BASED PERMISSIONS
  // ===================================================================

  /**
   * Define role-based permissions matrix
   */
  roleHasPermission(role, resource, action) {
    const rolePermissions = {
      owner: {
        tenant: ['read', 'write', 'admin', 'delete'],
        member: ['read', 'write', 'admin', 'invite', 'remove'],
        permission: ['read', 'write', 'admin', 'grant', 'revoke'],
        integration: ['read', 'write', 'admin', 'create', 'delete'],
        project: ['read', 'write', 'admin', 'create', 'delete'],
        settings: ['read', 'write', 'admin']
      },
      admin: {
        tenant: ['read', 'write', 'admin'],
        member: ['read', 'write', 'invite', 'remove'],
        permission: ['read', 'write', 'grant'],
        integration: ['read', 'write', 'create'],
        project: ['read', 'write', 'create'],
        settings: ['read', 'write']
      },
      member: {
        tenant: ['read'],
        member: ['read'],
        permission: ['read'],
        integration: ['read', 'write'],
        project: ['read', 'write'],
        settings: ['read']
      },
      viewer: {
        tenant: ['read'],
        member: ['read'],
        permission: [],
        integration: ['read'],
        project: ['read'],
        settings: ['read']
      },
      guest: {
        tenant: [],
        member: [],
        permission: [],
        integration: [],
        project: ['read'],
        settings: []
      }
    };

    return rolePermissions[role]?.[resource]?.includes(action) || false;
  }

  // ===================================================================
  // PERMISSION MANAGEMENT
  // ===================================================================

  /**
   * Grant permission to user
   */
  async grantPermission(tenantId, userId, resource, actions, grantedBy, options = {}) {
    const { expiresAt, conditions } = options;

    try {
      const result = await this.db.query(`
        INSERT INTO permissions (
          user_id, tenant_id, resource_type, actions, 
          conditions, granted_by, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id, tenant_id, resource_type, resource_id) 
        DO UPDATE SET 
          actions = EXCLUDED.actions,
          conditions = EXCLUDED.conditions,
          granted_by = EXCLUDED.granted_by,
          expires_at = EXCLUDED.expires_at,
          updated_at = NOW()
        RETURNING *
      `, [userId, tenantId, resource, actions, conditions, grantedBy, expiresAt]);

      // Clear cache
      await this.clearUserPermissionCache(userId, tenantId);

      return result.rows[0];
    } catch (error) {
      console.error('Failed to grant permission:', error);
      throw new Error('Permission grant failed');
    }
  }

  /**
   * Revoke permission from user
   */
  async revokePermission(permissionId, revokedBy) {
    try {
      const result = await this.db.query(`
        DELETE FROM permissions 
        WHERE id = $1 
        RETURNING user_id, tenant_id
      `, [permissionId]);

      if (result.rows.length > 0) {
        const { user_id, tenant_id } = result.rows[0];
        await this.clearUserPermissionCache(user_id, tenant_id);
      }

      return result.rows.length > 0;
    } catch (error) {
      console.error('Failed to revoke permission:', error);
      throw new Error('Permission revocation failed');
    }
  }

  /**
   * Get effective permissions for user on tenant
   */
  async getEffectivePermissions(userId, tenantId) {
    const cacheKey = `${this.cachePrefix}effective:${userId}:${tenantId}`;
    
    if (this.cache) {
      const cached = await this.cache.get(cacheKey);
      if (cached) return JSON.parse(cached);
    }

    try {
      // Get direct permissions
      const directResult = await this.db.query(`
        SELECT resource_type, actions, conditions, expires_at
        FROM permissions 
        WHERE user_id = $1 AND tenant_id = $2
          AND (expires_at IS NULL OR expires_at > NOW())
      `, [userId, tenantId]);

      // Get role-based permissions
      const roleResult = await this.db.query(`
        SELECT role FROM tenant_members 
        WHERE user_id = $1 AND tenant_id = $2 AND joined_at IS NOT NULL
      `, [userId, tenantId]);

      // Get inherited permissions
      const inheritedPermissions = await this.getInheritedPermissions(userId, tenantId);

      const permissions = {
        direct: directResult.rows,
        role: roleResult.rows[0]?.role || null,
        inherited: inheritedPermissions,
        effective: this.combinePermissions(directResult.rows, roleResult.rows[0]?.role, inheritedPermissions)
      };

      if (this.cache) {
        await this.cache.setex(cacheKey, this.cacheTTL, JSON.stringify(permissions));
      }

      return permissions;
    } catch (error) {
      console.error('Failed to get effective permissions:', error);
      throw new Error('Permission lookup failed');
    }
  }

  // ===================================================================
  // UTILITY METHODS
  // ===================================================================

  /**
   * Evaluate ABAC conditions
   */
  evaluateABACConditions(conditions, context) {
    try {
      // Simple condition evaluation - can be extended for complex rules
      for (const [key, value] of Object.entries(conditions)) {
        if (context[key] !== value) {
          return false;
        }
      }
      return true;
    } catch (error) {
      console.error('ABAC evaluation error:', error);
      return false;
    }
  }

  /**
   * Get inherited permissions from parent tenants
   */
  async getInheritedPermissions(userId, tenantId) {
    const tenantResult = await this.db.query(`
      SELECT path FROM tenants WHERE id = $1
    `, [tenantId]);

    if (tenantResult.rows.length === 0) return [];

    const path = tenantResult.rows[0].path;
    const parentIds = path.slice(0, -1); // All parents

    if (parentIds.length === 0) return [];

    const inheritedResult = await this.db.query(`
      SELECT DISTINCT p.resource_type, p.actions, p.conditions, t.id as tenant_id, t.name as tenant_name
      FROM permissions p
      JOIN tenants t ON p.tenant_id = t.id
      WHERE p.user_id = $1 
        AND p.tenant_id = ANY($2::uuid[])
        AND (p.expires_at IS NULL OR p.expires_at > NOW())
    `, [userId, parentIds]);

    return inheritedResult.rows;
  }

  /**
   * Combine permissions from different sources
   */
  combinePermissions(direct, role, inherited) {
    const combined = new Map();

    // Add direct permissions
    direct.forEach(perm => {
      const key = perm.resource_type;
      if (!combined.has(key)) combined.set(key, new Set());
      perm.actions.forEach(action => combined.get(key).add(action));
    });

    // Add role-based permissions
    if (role) {
      Object.entries(this.rolePermissions[role] || {}).forEach(([resource, actions]) => {
        if (!combined.has(resource)) combined.set(resource, new Set());
        actions.forEach(action => combined.get(resource).add(action));
      });
    }

    // Add inherited permissions
    inherited.forEach(perm => {
      const key = perm.resource_type;
      if (!combined.has(key)) combined.set(key, new Set());
      perm.actions.forEach(action => combined.get(key).add(action));
    });

    // Convert to array format
    const result = [];
    combined.forEach((actions, resource) => {
      result.push({
        resource_type: resource,
        actions: Array.from(actions)
      });
    });

    return result;
  }

  /**
   * Clear permission cache for user
   */
  async clearUserPermissionCache(userId, tenantId) {
    if (!this.cache) return;

    const patterns = [
      `${this.cachePrefix}check:${userId}:${tenantId}:*`,
      `${this.cachePrefix}effective:${userId}:${tenantId}`,
      `${this.cachePrefix}inherited:${userId}:${tenantId}`
    ];

    for (const pattern of patterns) {
      await this.cache.del(pattern);
    }
  }

  /**
   * Cache permission result
   */
  async cacheResult(key, result) {
    if (this.cache) {
      await this.cache.setex(key, this.cacheTTL, JSON.stringify(result));
    }
  }

  /**
   * Health check for permission system
   */
  async healthCheck() {
    try {
      // Test database connectivity
      await this.db.query('SELECT 1');
      
      // Test cache connectivity
      if (this.cache) {
        await this.cache.ping();
      }

      return {
        database: 'healthy',
        cache: this.cache ? 'healthy' : 'not_configured',
        permissions: 'operational'
      };
    } catch (error) {
      return {
        database: 'unhealthy',
        cache: 'unknown',
        permissions: 'degraded',
        error: error.message
      };
    }
  }
}

export default HierarchicalPermissionService;