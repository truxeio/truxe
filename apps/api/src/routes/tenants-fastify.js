/**
 * Tenant API Routes - Fastify Implementation
 * 
 * Fastify-compatible version of the tenant routes for the Truxe API.
 * Provides RESTful endpoints for hierarchical tenant management.
 */

export default async function tenantRoutes(fastify, options) {
  
  // ===================================================================
  // ROOT TENANT OPERATIONS (Workspaces)
  // ===================================================================

  /**
   * POST /tenants
   * Create a new root workspace
   */
  fastify.post('/', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Create a new workspace (root tenant)',
      tags: ['Tenants'],
      body: {
        type: 'object',
        required: ['name', 'slug'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          slug: { 
            type: 'string', 
            pattern: '^[a-z0-9][a-z0-9-]*[a-z0-9]$',
            minLength: 2, 
            maxLength: 63 
          },
          description: { type: 'string', maxLength: 1000 },
          settings: { type: 'object' },
          maxDepth: { type: 'integer', minimum: 2, maximum: 5, default: 3 }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { 
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                slug: { type: 'string' },
                tenantType: { type: 'string' },
                level: { type: 'integer' },
                path: { type: 'array', items: { type: 'string' } }
              }
            },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { name, slug, description, settings, maxDepth = 3 } = request.body;
      const userId = request.user.id;

      const workspace = await fastify.tenantService.createTenant({
        name,
        slug,
        tenantType: 'workspace',
        description,
        settings,
        maxDepth,
        createdBy: userId
      });

      // Add creator as admin
      await fastify.tenantService.addMember(workspace.id, userId, 'admin');

      return reply.code(201).send({
        success: true,
        data: workspace,
        message: 'Workspace created successfully'
      });
    } catch (error) {
      fastify.log.error('Workspace creation failed:', error);
      return reply.code(400).send({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /tenants
   * List tenants user has access to
   */
  fastify.get('/', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'List accessible tenants',
      tags: ['Tenants'],
      querystring: {
        type: 'object',
        properties: {
          includeArchived: { type: 'boolean', default: false },
          hierarchical: { type: 'boolean', default: false },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userId = request.user.id;
      const { includeArchived = false, hierarchical = false, limit = 50, offset = 0 } = request.query;

      const tenants = await fastify.tenantService.getUserTenants(userId, {
        includeArchived,
        hierarchical,
        rootOnly: !hierarchical,
        limit,
        offset
      });

      return reply.send({
        success: true,
        data: tenants,
        count: tenants.length
      });
    } catch (error) {
      fastify.log.error('Failed to list tenants:', error);
      return reply.code(500).send({
        success: false,
        error: error.message
      });
    }
  });

  // ===================================================================
  // INDIVIDUAL TENANT OPERATIONS
  // ===================================================================

  /**
   * GET /tenants/:id
   * Get specific tenant details
   */
  fastify.get('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get tenant details',
      tags: ['Tenants'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          includeMembers: { type: 'boolean', default: false },
          includePermissions: { type: 'boolean', default: false }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const { includeMembers = false, includePermissions = false } = request.query;

      // Check permissions
      const hasAccess = await fastify.tenantService.hasUserAccess(id, request.user.id);
      if (!hasAccess) {
        return reply.code(403).send({
          success: false,
          error: 'Access denied'
        });
      }

      const tenant = await fastify.tenantService.getTenantById(id, {
        includeMembers,
        includePermissions
      });

      if (!tenant) {
        return reply.code(404).send({
          success: false,
          error: 'Tenant not found'
        });
      }

      return reply.send({
        success: true,
        data: tenant
      });
    } catch (error) {
      fastify.log.error('Failed to get tenant:', error);
      return reply.code(500).send({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * PUT /tenants/:id
   * Update tenant details
   */
  fastify.put('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Update tenant details',
      tags: ['Tenants'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          description: { type: 'string', maxLength: 1000 },
          settings: { type: 'object' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const updateData = request.body;
      const userId = request.user.id;

      // Check write permissions
      const hasWriteAccess = await fastify.tenantRbac.checkPermission(
        userId, id, 'tenant', 'write'
      );
      
      if (!hasWriteAccess) {
        return reply.code(403).send({
          success: false,
          error: 'Insufficient permissions'
        });
      }

      const updatedTenant = await fastify.tenantService.updateTenant(id, updateData, userId);

      return reply.send({
        success: true,
        data: updatedTenant,
        message: 'Tenant updated successfully'
      });
    } catch (error) {
      fastify.log.error('Failed to update tenant:', error);
      return reply.code(400).send({
        success: false,
        error: error.message
      });
    }
  });

  // ===================================================================
  // HIERARCHY OPERATIONS
  // ===================================================================

  /**
   * POST /tenants/:id/children
   * Create child tenant
   */
  fastify.post('/:id/children', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Create child tenant',
      tags: ['Tenants'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      },
      body: {
        type: 'object',
        required: ['name', 'slug', 'tenantType'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          slug: { 
            type: 'string', 
            pattern: '^[a-z0-9][a-z0-9-]*[a-z0-9]$',
            minLength: 2, 
            maxLength: 63 
          },
          tenantType: { 
            type: 'string', 
            enum: ['team', 'project', 'department', 'division'] 
          },
          description: { type: 'string', maxLength: 1000 },
          settings: { type: 'object' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const parentId = request.params.id;
      const { name, slug, tenantType, description, settings } = request.body;
      const userId = request.user.id;

      // Check admin permissions on parent
      const hasAdminAccess = await fastify.tenantRbac.checkPermission(
        userId, parentId, 'tenant', 'admin'
      );
      
      if (!hasAdminAccess) {
        return reply.code(403).send({
          success: false,
          error: 'Admin permissions required'
        });
      }

      const childTenant = await fastify.tenantService.createTenant({
        name,
        slug,
        tenantType,
        description,
        settings,
        parentId,
        createdBy: userId
      });

      return reply.code(201).send({
        success: true,
        data: childTenant,
        message: 'Child tenant created successfully'
      });
    } catch (error) {
      fastify.log.error('Failed to create child tenant:', error);
      return reply.code(400).send({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /tenants/:id/hierarchy
   * Get complete hierarchy tree
   */
  fastify.get('/:id/hierarchy', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get tenant hierarchy tree',
      tags: ['Tenants'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          maxDepth: { type: 'integer', minimum: 1, maximum: 10, default: 5 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const { maxDepth = 5 } = request.query;

      // Check read permissions
      const hasReadAccess = await fastify.tenantService.hasUserAccess(id, request.user.id);
      if (!hasReadAccess) {
        return reply.code(403).send({
          success: false,
          error: 'Access denied'
        });
      }

      const hierarchy = await fastify.hierarchyService.getTenantHierarchy(id, {
        maxDepth
      });

      return reply.send({
        success: true,
        data: hierarchy
      });
    } catch (error) {
      fastify.log.error('Failed to get hierarchy:', error);
      return reply.code(500).send({
        success: false,
        error: error.message
      });
    }
  });

  // ===================================================================
  // MEMBER MANAGEMENT
  // ===================================================================

  /**
   * GET /tenants/:id/members
   * List tenant members
   */
  fastify.get('/:id/members', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'List tenant members',
      tags: ['Tenants'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params;

      // Check read permissions
      const hasReadAccess = await fastify.tenantService.hasUserAccess(id, request.user.id);
      if (!hasReadAccess) {
        return reply.code(403).send({
          success: false,
          error: 'Access denied'
        });
      }

      const members = await fastify.tenantService.getTenantMembers(id);

      return reply.send({
        success: true,
        data: members,
        count: members.length
      });
    } catch (error) {
      fastify.log.error('Failed to list members:', error);
      return reply.code(500).send({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /tenants/:id/members
   * Add member to tenant
   */
  fastify.post('/:id/members', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Add member to tenant',
      tags: ['Tenants'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      },
      body: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string', format: 'uuid' },
          role: { 
            type: 'string', 
            enum: ['admin', 'member', 'viewer', 'guest'],
            default: 'member' 
          },
          permissions: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const tenantId = request.params.id;
      const { userId, role = 'member', permissions = [] } = request.body;
      const invitedBy = request.user.id;

      // Check admin permissions
      const hasAdminAccess = await fastify.tenantRbac.checkPermission(
        invitedBy, tenantId, 'tenant', 'admin'
      );
      
      if (!hasAdminAccess) {
        return reply.code(403).send({
          success: false,
          error: 'Admin permissions required'
        });
      }

      const membership = await fastify.tenantService.addMember(tenantId, userId, role, {
        permissions,
        invitedBy
      });

      return reply.code(201).send({
        success: true,
        data: membership,
        message: 'Member added successfully'
      });
    } catch (error) {
      fastify.log.error('Failed to add member:', error);
      return reply.code(400).send({
        success: false,
        error: error.message
      });
    }
  });

  // Health check for tenant system
  fastify.get('/health', async (request, reply) => {
    try {
      const health = await fastify.tenantService.healthCheck();
      return reply.send({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        details: health
      });
    } catch (error) {
      return reply.code(503).send({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  });
}