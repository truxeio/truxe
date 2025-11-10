/**
 * Permission Management Routes
 * 
 * RESTful endpoints for managing hierarchical permissions across
 * the tenant system with granular access control.
 */

export default async function permissionRoutes(fastify, options) {
  
  // ===================================================================
  // PERMISSION CRUD OPERATIONS
  // ===================================================================

  /**
   * GET /tenants/:id/permissions
   * List all permissions for a tenant
   */
  fastify.get('/:id/permissions', {
    preHandler: [
      fastify.authenticate,
      fastify.tenantRbac.requirePermission('permission', 'read')
    ],
    schema: {
      description: 'List tenant permissions',
      tags: ['Permissions'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid' },
          resource: { type: 'string' },
          includeInherited: { type: 'boolean', default: false },
          includeExpired: { type: 'boolean', default: false }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id: tenantId } = request.params;
      const { userId, resource, includeInherited = false, includeExpired = false } = request.query;

      let permissions;

      if (userId) {
        // Get permissions for specific user
        permissions = await fastify.permissionService.getEffectivePermissions(userId, tenantId);
        
        if (includeInherited) {
          const inherited = await fastify.permissionService.getInheritedPermissions(userId, tenantId);
          permissions.inherited = inherited;
        }
      } else {
        // Get all permissions for tenant
        const result = await fastify.tenantDbPool.query(`
          SELECT 
            p.*,
            u.email as user_email,
            grantor.email as granted_by_email
          FROM permissions p
          JOIN users u ON p.user_id = u.id
          LEFT JOIN users grantor ON p.granted_by = grantor.id
          WHERE p.tenant_id = $1
            ${resource ? 'AND p.resource_type = $2' : ''}
            ${!includeExpired ? 'AND (p.expires_at IS NULL OR p.expires_at > NOW())' : ''}
          ORDER BY p.created_at DESC
        `, resource ? [tenantId, resource] : [tenantId]);

        permissions = result.rows;
      }

      return reply.send({
        success: true,
        data: permissions,
        count: Array.isArray(permissions) ? permissions.length : Object.keys(permissions).length
      });
    } catch (error) {
      fastify.log.error('Failed to list permissions:', error);
      return reply.code(500).send({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /tenants/:id/permissions
   * Grant permission to user
   */
  fastify.post('/:id/permissions', {
    preHandler: [
      fastify.authenticate,
      fastify.tenantRbac.requirePermission('permission', 'grant')
    ],
    schema: {
      description: 'Grant permission to user',
      tags: ['Permissions'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      },
      body: {
        type: 'object',
        required: ['userId', 'resource', 'actions'],
        properties: {
          userId: { type: 'string', format: 'uuid' },
          resource: { type: 'string' },
          resourceId: { type: 'string' },
          actions: { 
            type: 'array', 
            items: { 
              type: 'string',
              enum: ['read', 'write', 'delete', 'admin', 'share', 'invite', 'manage']
            },
            minItems: 1
          },
          conditions: { type: 'object' },
          expiresAt: { type: 'string', format: 'date-time' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id: tenantId } = request.params;
      const { userId, resource, resourceId, actions, conditions, expiresAt } = request.body;
      const grantedBy = request.user.id;

      // Validate that user is member of tenant
      const isMember = await fastify.tenantRbac.checkMembership(userId, tenantId);
      if (!isMember) {
        return reply.code(400).send({
          success: false,
          error: 'User must be a member of the tenant to receive permissions'
        });
      }

      // Grant permission
      const permission = await fastify.permissionService.grantPermission(
        tenantId, userId, resource, actions, grantedBy, {
          resourceId,
          conditions,
          expiresAt: expiresAt ? new Date(expiresAt) : null
        }
      );

      return reply.code(201).send({
        success: true,
        data: permission,
        message: 'Permission granted successfully'
      });
    } catch (error) {
      fastify.log.error('Failed to grant permission:', error);
      return reply.code(400).send({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * PUT /tenants/:id/permissions/:permissionId
   * Update permission
   */
  fastify.put('/:id/permissions/:permissionId', {
    preHandler: [
      fastify.authenticate,
      fastify.tenantRbac.requirePermission('permission', 'admin')
    ],
    schema: {
      description: 'Update permission',
      tags: ['Permissions'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          permissionId: { type: 'string', format: 'uuid' }
        }
      },
      body: {
        type: 'object',
        properties: {
          actions: { 
            type: 'array', 
            items: { 
              type: 'string',
              enum: ['read', 'write', 'delete', 'admin', 'share', 'invite', 'manage']
            }
          },
          conditions: { type: 'object' },
          expiresAt: { type: 'string', format: 'date-time' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id: tenantId, permissionId } = request.params;
      const { actions, conditions, expiresAt } = request.body;

      const result = await fastify.tenantDbPool.query(`
        UPDATE permissions 
        SET 
          actions = COALESCE($1, actions),
          conditions = COALESCE($2, conditions),
          expires_at = COALESCE($3, expires_at),
          updated_at = NOW()
        WHERE id = $4 AND tenant_id = $5
        RETURNING *
      `, [
        actions, 
        conditions, 
        expiresAt ? new Date(expiresAt) : null, 
        permissionId, 
        tenantId
      ]);

      if (result.rows.length === 0) {
        return reply.code(404).send({
          success: false,
          error: 'Permission not found'
        });
      }

      // Clear cache
      await fastify.permissionService.clearUserPermissionCache(
        result.rows[0].user_id, 
        tenantId
      );

      return reply.send({
        success: true,
        data: result.rows[0],
        message: 'Permission updated successfully'
      });
    } catch (error) {
      fastify.log.error('Failed to update permission:', error);
      return reply.code(400).send({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * DELETE /tenants/:id/permissions/:permissionId
   * Revoke permission
   */
  fastify.delete('/:id/permissions/:permissionId', {
    preHandler: [
      fastify.authenticate,
      fastify.tenantRbac.requirePermission('permission', 'revoke')
    ],
    schema: {
      description: 'Revoke permission',
      tags: ['Permissions'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          permissionId: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { permissionId } = request.params;
      const revokedBy = request.user.id;

      const success = await fastify.permissionService.revokePermission(permissionId, revokedBy);

      if (!success) {
        return reply.code(404).send({
          success: false,
          error: 'Permission not found'
        });
      }

      return reply.send({
        success: true,
        message: 'Permission revoked successfully'
      });
    } catch (error) {
      fastify.log.error('Failed to revoke permission:', error);
      return reply.code(400).send({
        success: false,
        error: error.message
      });
    }
  });

  // ===================================================================
  // PERMISSION ANALYSIS & DEBUGGING
  // ===================================================================

  /**
   * GET /tenants/:id/permissions/check
   * Check specific permission for user
   */
  fastify.get('/:id/permissions/check', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Check specific permission',
      tags: ['Permissions'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      },
      querystring: {
        type: 'object',
        required: ['userId', 'resource', 'action'],
        properties: {
          userId: { type: 'string', format: 'uuid' },
          resource: { type: 'string' },
          action: { type: 'string' },
          context: { type: 'string' } // JSON string
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id: tenantId } = request.params;
      const { userId, resource, action, context } = request.query;

      // Parse context if provided
      let contextObj = {};
      if (context) {
        try {
          contextObj = JSON.parse(context);
        } catch (e) {
          return reply.code(400).send({
            success: false,
            error: 'Invalid context JSON'
          });
        }
      }

      // Only allow checking own permissions unless admin
      const isAdmin = await fastify.tenantRbac.getUserRole(request.user.id, tenantId);
      if (userId !== request.user.id && !['admin', 'owner'].includes(isAdmin)) {
        return reply.code(403).send({
          success: false,
          error: 'Can only check own permissions'
        });
      }

      const hasPermission = await fastify.permissionService.checkPermission(
        userId, tenantId, resource, action, contextObj
      );

      // Get detailed breakdown for debugging
      const breakdown = await this.getPermissionBreakdown(userId, tenantId, resource, action);

      return reply.send({
        success: true,
        data: {
          hasPermission,
          userId,
          tenantId,
          resource,
          action,
          context: contextObj,
          breakdown
        }
      });
    } catch (error) {
      fastify.log.error('Permission check failed:', error);
      return reply.code(500).send({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /tenants/:id/permissions/effective/:userId
   * Get effective permissions for user
   */
  fastify.get('/:id/permissions/effective/:userId', {
    preHandler: [
      fastify.authenticate,
      fastify.tenantRbac.requirePermission('permission', 'read')
    ],
    schema: {
      description: 'Get effective permissions for user',
      tags: ['Permissions'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          userId: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id: tenantId, userId } = request.params;

      const [permissions, summary] = await Promise.all([
        fastify.permissionService.getEffectivePermissions(userId, tenantId),
        fastify.tenantRbac.getPermissionSummary(userId, tenantId)
      ]);

      return reply.send({
        success: true,
        data: {
          permissions,
          summary,
          tenant: tenantId,
          user: userId
        }
      });
    } catch (error) {
      fastify.log.error('Failed to get effective permissions:', error);
      return reply.code(500).send({
        success: false,
        error: error.message
      });
    }
  });

  // ===================================================================
  // ROLE MANAGEMENT
  // ===================================================================

  /**
   * PUT /tenants/:id/members/:userId/role
   * Update member role
   */
  fastify.put('/:id/members/:userId/role', {
    preHandler: [
      fastify.authenticate,
      fastify.tenantRbac.requirePermission('member', 'admin')
    ],
    schema: {
      description: 'Update member role',
      tags: ['Permissions'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          userId: { type: 'string', format: 'uuid' }
        }
      },
      body: {
        type: 'object',
        required: ['role'],
        properties: {
          role: { 
            type: 'string', 
            enum: ['owner', 'admin', 'member', 'viewer', 'guest'] 
          },
          reason: { type: 'string', maxLength: 500 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id: tenantId, userId } = request.params;
      const { role, reason } = request.body;
      const updatedBy = request.user.id;

      // Prevent self-demotion from owner
      if (userId === updatedBy) {
        const currentRole = await fastify.tenantRbac.getUserRole(userId, tenantId);
        if (currentRole === 'owner' && role !== 'owner') {
          return reply.code(400).send({
            success: false,
            error: 'Owners cannot demote themselves'
          });
        }
      }

      const result = await fastify.tenantDbPool.query(`
        UPDATE tenant_members 
        SET 
          role = $1,
          updated_at = NOW()
        WHERE tenant_id = $2 AND user_id = $3
        RETURNING *
      `, [role, tenantId, userId]);

      if (result.rows.length === 0) {
        return reply.code(404).send({
          success: false,
          error: 'Member not found'
        });
      }

      // Clear permission cache
      await fastify.permissionService.clearUserPermissionCache(userId, tenantId);

      // Log role change
      await fastify.tenantDbPool.query(`
        INSERT INTO audit_logs (
          tenant_id, user_id, action, resource_type, resource_id, 
          details, performed_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        tenantId, userId, 'role_updated', 'member', userId,
        { oldRole: 'unknown', newRole: role, reason },
        updatedBy
      ]);

      return reply.send({
        success: true,
        data: result.rows[0],
        message: 'Member role updated successfully'
      });
    } catch (error) {
      fastify.log.error('Failed to update member role:', error);
      return reply.code(400).send({
        success: false,
        error: error.message
      });
    }
  });

  // ===================================================================
  // UTILITY METHODS
  // ===================================================================

  /**
   * Get detailed permission breakdown for debugging
   */
  async function getPermissionBreakdown(userId, tenantId, resource, action) {
    try {
      const [direct, role, inherited] = await Promise.all([
        fastify.permissionService.checkDirectPermission(userId, tenantId, resource, action),
        fastify.permissionService.checkRolePermission(userId, tenantId, resource, action),
        fastify.permissionService.checkInheritedPermission(userId, tenantId, resource, action)
      ]);

      return {
        direct,
        role,
        inherited,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}