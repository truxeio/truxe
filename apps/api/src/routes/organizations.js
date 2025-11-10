/**
 * Organization Management Routes
 * 
 * RESTful API endpoints for multi-tenant organization management:
 * - POST /organizations - Create organization
 * - GET /organizations - List user's organizations
 * - PUT /organizations/:id - Update organization
 * - POST /organizations/:id/invite - Invite member
 * - PUT /organizations/:id/members/:userId - Update member role
 * - DELETE /organizations/:id/members/:userId - Remove member
 * - POST /auth/switch-org - Switch organization context
 */

import organizationService from '../services/organization.js'
import membershipService from '../services/membership.js'
import emailService from '../services/email.js'
import rbac from '../middleware/rbac.js'
import config from '../config/index.js'

/**
 * Organization routes plugin
 */
export default async function organizationRoutes(fastify, options) {
  // Create organization
  fastify.post('/', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'Create a new organization',
      tags: ['Organizations'],
      body: {
        type: 'object',
        required: ['name', 'slug'],
        properties: {
          name: {
            type: 'string',
            minLength: 1,
            maxLength: 255,
            description: 'Organization name',
          },
          slug: {
            type: 'string',
            pattern: '^[a-z0-9][a-z0-9-]*[a-z0-9]$',
            minLength: 2,
            maxLength: 63,
            description: 'URL-safe organization identifier',
          },
          parentOrgId: {
            type: 'string',
            format: 'uuid',
            description: 'Parent organization ID for hierarchical structure',
          },
          settings: {
            type: 'object',
            description: 'Organization-specific settings and configuration',
            properties: {
              branding: {
                type: 'object',
                properties: {
                  logo: { type: 'string' },
                  primaryColor: { type: 'string' },
                  secondaryColor: { type: 'string' },
                },
              },
              features: {
                type: 'object',
                properties: {
                  sso: { type: 'boolean' },
                  auditLogs: { type: 'boolean' },
                  webhooks: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            organization: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                slug: { type: 'string' },
                parentOrgId: { type: 'string' },
                settings: { type: 'object' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
              },
            },
            membership: {
              type: 'object',
              properties: {
                role: { type: 'string' },
                permissions: { type: 'array' },
                joinedAt: { type: 'string' },
              },
            },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
        409: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { name, slug, parentOrgId, settings = {} } = request.body
      const userId = request.user.id
      const ip = request.ip
      const userAgent = request.headers['user-agent']

      // Create organization
      const organization = await organizationService.createOrganization({
        name,
        slug,
        parentOrgId,
        settings,
        createdBy: userId,
        ip,
        userAgent,
      })

      // Create owner membership for creator
      const membership = await membershipService.createMembership({
        orgId: organization.id,
        userId,
        role: 'owner',
        invitedBy: userId,
        joinedAt: new Date(),
      })

      return reply.code(201).send({
        success: true,
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          parentOrgId: organization.parentOrgId,
          settings: organization.settings,
          createdAt: organization.createdAt,
          updatedAt: organization.updatedAt,
        },
        membership: {
          role: membership.role,
          permissions: membership.permissions,
          joinedAt: membership.joinedAt,
        },
      })
    } catch (error) {
      fastify.log.error('Organization creation failed:', error.message)

      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        return reply.code(409).send({
          error: 'Conflict',
          message: 'An organization with this slug already exists',
        })
      }

      if (error.message.includes('invalid') || error.message.includes('validation')) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: error.message,
        })
      }

      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create organization',
      })
    }
  })

  // List user's organizations
  fastify.get('/', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'List organizations accessible to the current user',
      tags: ['Organizations'],
      querystring: {
        type: 'object',
        properties: {
          role: {
            type: 'string',
            enum: ['owner', 'admin', 'member', 'viewer'],
            description: 'Filter by user role in organization',
          },
          includeHierarchy: {
            type: 'boolean',
            description: 'Include child organizations for admin/owner users',
            default: false,
          },
          hierarchical: {
            type: 'boolean',
            description: 'Use new nested tenancy system (gradual migration)',
            default: false,
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 50,
            description: 'Maximum number of organizations to return',
          },
          offset: {
            type: 'integer',
            minimum: 0,
            default: 0,
            description: 'Number of organizations to skip',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            organizations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  slug: { type: 'string' },
                  parentOrgId: { type: 'string' },
                  settings: { type: 'object' },
                  membership: {
                    type: 'object',
                    properties: {
                      role: { type: 'string' },
                      permissions: { type: 'array' },
                      joinedAt: { type: 'string' },
                    },
                  },
                  memberCount: { type: 'integer' },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                },
              },
            },
            pagination: {
              type: 'object',
              properties: {
                total: { type: 'integer' },
                limit: { type: 'integer' },
                offset: { type: 'integer' },
                hasMore: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { role, includeHierarchy = false, hierarchical = false, limit = 50, offset = 0 } = request.query
      const userId = request.user.id

      // Use new tenant service if hierarchical=true (gradual migration)
      if (hierarchical) {
        const { tenantService } = await import('../services/tenant/index.js');
        
        const tenants = await tenantService.getUserTenants(userId, {
          includeArchived: false,
          hierarchical: includeHierarchy,
          rootOnly: !includeHierarchy
        });

        // Transform tenants to organizations format for backward compatibility
        const organizations = tenants.map(tenant => ({
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          parentOrgId: tenant.parentTenantId,
          settings: tenant.settings,
          membership: {
            role: tenant.userRole,
            permissions: tenant.userPermissions || [],
            joinedAt: tenant.userJoinedAt
          },
          memberCount: tenant.memberCount || 0,
          createdAt: tenant.createdAt,
          updatedAt: tenant.updatedAt,
          // New hierarchical fields
          tenantType: tenant.tenantType,
          level: tenant.level,
          path: tenant.path,
          children: tenant.children || []
        }));

        return reply.send({
          success: true,
          organizations,
          pagination: {
            total: organizations.length,
            limit,
            offset: 0,
            hasMore: false
          },
          // Flag to indicate this uses new tenant system
          usingHierarchicalTenancy: true
        });
      }

      // Original logic for backward compatibility
      const result = await organizationService.getUserOrganizations({
        userId,
        role,
        includeHierarchy,
        limit: Math.min(limit, 100),
        offset,
      })

      return reply.send({
        success: true,
        organizations: result.organizations,
        pagination: result.pagination,
      })
    } catch (error) {
      fastify.log.error('Failed to list organizations:', error.message)

      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve organizations',
      })
    }
  })

  // Get specific organization
  fastify.get('/:id', {
    preHandler: [
      (request, reply) => fastify.authenticate(request, reply),
      rbac.requireOrganizationMembership()
    ],
    schema: {
      description: 'Get organization details by ID',
      tags: ['Organizations'],
      params: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Organization ID',
          },
        },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            organization: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                slug: { type: 'string' },
                parentOrgId: { type: 'string' },
                settings: { type: 'object' },
                membership: {
                  type: 'object',
                  properties: {
                    role: { type: 'string' },
                    permissions: { type: 'array' },
                    joinedAt: { type: 'string' },
                  },
                },
                memberCount: { type: 'integer' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
              },
            },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params
      const userId = request.user.id

      const organization = await organizationService.getOrganizationById({
        orgId: id,
        userId,
      })

      if (!organization) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Organization not found or access denied',
        })
      }

      return reply.send({
        success: true,
        organization,
      })
    } catch (error) {
      fastify.log.error('Failed to get organization:', error.message)

      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve organization',
      })
    }
  })

  // Update organization
  fastify.put('/:id', {
    preHandler: [
      (request, reply) => fastify.authenticate(request, reply),
      rbac.requireAdmin()
    ],
    schema: {
      description: 'Update organization details',
      tags: ['Organizations'],
      params: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Organization ID',
          },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            minLength: 1,
            maxLength: 255,
            description: 'Organization name',
          },
          settings: {
            type: 'object',
            description: 'Organization-specific settings and configuration',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            organization: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                slug: { type: 'string' },
                parentOrgId: { type: 'string' },
                settings: { type: 'object' },
                updatedAt: { type: 'string' },
              },
            },
          },
        },
        403: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params
      const { name, settings } = request.body
      const userId = request.user.id
      const ip = request.ip
      const userAgent = request.headers['user-agent']

      const organization = await organizationService.updateOrganization({
        orgId: id,
        userId,
        updates: { name, settings },
        ip,
        userAgent,
      })

      return reply.send({
        success: true,
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          parentOrgId: organization.parentOrgId,
          settings: organization.settings,
          updatedAt: organization.updatedAt,
        },
      })
    } catch (error) {
      fastify.log.error('Organization update failed:', error.message)

      if (error.message.includes('not found')) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Organization not found',
        })
      }

      if (error.message.includes('permission') || error.message.includes('unauthorized')) {
        return reply.code(403).send({
          error: 'Forbidden',
          message: 'Insufficient permissions to update organization',
        })
      }

      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update organization',
      })
    }
  })

  // Invite member to organization
  fastify.post('/:id/invite', {
    preHandler: [
      (request, reply) => fastify.authenticate(request, reply),
      rbac.requireAdmin()
    ],
    schema: {
      description: 'Invite a member to the organization',
      tags: ['Organizations'],
      params: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Organization ID',
          },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        required: ['email', 'role'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            description: 'Email address of the user to invite',
          },
          role: {
            type: 'string',
            enum: ['admin', 'member', 'viewer'],
            description: 'Role to assign to the invited user',
          },
          permissions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Additional permissions for the user',
          },
          message: {
            type: 'string',
            maxLength: 500,
            description: 'Personal message to include in invitation',
          },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            invitation: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                role: { type: 'string' },
                permissions: { type: 'array' },
                invitedAt: { type: 'string' },
                expiresAt: { type: 'string' },
              },
            },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
        403: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
        409: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params
      const { email, role, permissions = [], message } = request.body
      const userId = request.user.id
      const ip = request.ip
      const userAgent = request.headers['user-agent']

      // Create invitation
      const invitation = await membershipService.createInvitation({
        orgId: id,
        email: email.toLowerCase(),
        role,
        permissions,
        invitedBy: userId,
        message,
        ip,
        userAgent,
      })

      // Send invitation email
      await emailService.sendInvitationEmail({
        email: email.toLowerCase(),
        organizationName: invitation.organization.name,
        inviterName: invitation.inviter.name || invitation.inviter.email,
        role,
        invitationUrl: `${config.magicLink.baseUrl}/invite/${invitation.token}`,
        message,
      })

      return reply.code(201).send({
        success: true,
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          permissions: invitation.permissions,
          invitedAt: invitation.invitedAt,
          expiresAt: invitation.expiresAt,
        },
      })
    } catch (error) {
      fastify.log.error('Member invitation failed:', error.message)

      if (error.message.includes('already exists') || error.message.includes('duplicate')) {
        return reply.code(409).send({
          error: 'Conflict',
          message: 'User is already a member of this organization',
        })
      }

      if (error.message.includes('permission') || error.message.includes('unauthorized')) {
        return reply.code(403).send({
          error: 'Forbidden',
          message: 'Insufficient permissions to invite members',
        })
      }

      if (error.message.includes('invalid') || error.message.includes('validation')) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: error.message,
        })
      }

      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to send invitation',
      })
    }
  })

  // Update member role
  fastify.put('/:id/members/:userId', {
    preHandler: [
      (request, reply) => fastify.authenticate(request, reply),
      rbac.requireAdmin()
    ],
    schema: {
      description: 'Update member role in organization',
      tags: ['Organizations'],
      params: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Organization ID',
          },
          userId: {
            type: 'string',
            format: 'uuid',
            description: 'User ID',
          },
        },
        required: ['id', 'userId'],
      },
      body: {
        type: 'object',
        required: ['role'],
        properties: {
          role: {
            type: 'string',
            enum: ['owner', 'admin', 'member', 'viewer'],
            description: 'New role for the user',
          },
          permissions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Additional permissions for the user',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            membership: {
              type: 'object',
              properties: {
                userId: { type: 'string' },
                role: { type: 'string' },
                permissions: { type: 'array' },
                updatedAt: { type: 'string' },
              },
            },
          },
        },
        403: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id, userId } = request.params
      const { role, permissions } = request.body
      const currentUserId = request.user.id
      const ip = request.ip
      const userAgent = request.headers['user-agent']

      const membership = await membershipService.updateMembership({
        orgId: id,
        userId,
        role,
        permissions,
        updatedBy: currentUserId,
        ip,
        userAgent,
      })

      return reply.send({
        success: true,
        membership: {
          userId: membership.userId,
          role: membership.role,
          permissions: membership.permissions,
          updatedAt: membership.updatedAt,
        },
      })
    } catch (error) {
      fastify.log.error('Member role update failed:', error.message)

      if (error.message.includes('not found')) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Member not found in organization',
        })
      }

      if (error.message.includes('permission') || error.message.includes('unauthorized')) {
        return reply.code(403).send({
          error: 'Forbidden',
          message: 'Insufficient permissions to update member role',
        })
      }

      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update member role',
      })
    }
  })

  // Remove member from organization
  fastify.delete('/:id/members/:userId', {
    preHandler: [
      (request, reply) => fastify.authenticate(request, reply),
      rbac.requireAdmin()
    ],
    schema: {
      description: 'Remove member from organization',
      tags: ['Organizations'],
      params: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Organization ID',
          },
          userId: {
            type: 'string',
            format: 'uuid',
            description: 'User ID',
          },
        },
        required: ['id', 'userId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
        403: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id, userId } = request.params
      const currentUserId = request.user.id
      const ip = request.ip
      const userAgent = request.headers['user-agent']

      await membershipService.removeMembership({
        orgId: id,
        userId,
        removedBy: currentUserId,
        ip,
        userAgent,
      })

      return reply.send({
        success: true,
        message: 'Member removed from organization',
      })
    } catch (error) {
      fastify.log.error('Member removal failed:', error.message)

      if (error.message.includes('not found')) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Member not found in organization',
        })
      }

      if (error.message.includes('permission') || error.message.includes('unauthorized')) {
        return reply.code(403).send({
          error: 'Forbidden',
          message: 'Insufficient permissions to remove member',
        })
      }

      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to remove member',
      })
    }
  })

  // Get organization hierarchy
  fastify.get('/:id/hierarchy', {
    preHandler: [
      (request, reply) => fastify.authenticate(request, reply),
      rbac.requireOrganizationMembership()
    ],
    schema: {
      description: 'Get organization hierarchy (parent and children)',
      tags: ['Organizations'],
      params: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Organization ID',
          },
        },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            organization: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                slug: { type: 'string' },
                parentOrg: { type: 'object' },
                childOrgs: { type: 'array' },
                depth: { type: 'integer' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params
      const userId = request.user.id

      const organizationService = (await import('../services/organization.js')).default
      const hierarchy = await organizationService.getOrganizationHierarchy({
        orgId: id,
        userId,
      })

      if (!hierarchy) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Organization not found or access denied',
        })
      }

      return reply.send({
        success: true,
        organization: hierarchy,
      })
    } catch (error) {
      fastify.log.error('Failed to get organization hierarchy:', error.message)

      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve organization hierarchy',
      })
    }
  })

  // Update organization settings
  fastify.put('/:id/settings', {
    preHandler: [
      (request, reply) => fastify.authenticate(request, reply),
      rbac.requireAdmin()
    ],
    schema: {
      description: 'Update organization settings',
      tags: ['Organizations'],
      params: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Organization ID',
          },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          settings: {
            type: 'object',
            description: 'Organization settings to update',
            properties: {
              branding: {
                type: 'object',
                properties: {
                  logo: { type: 'string' },
                  primaryColor: { type: 'string' },
                  secondaryColor: { type: 'string' },
                },
              },
              features: {
                type: 'object',
                properties: {
                  sso: { type: 'boolean' },
                  auditLogs: { type: 'boolean' },
                  webhooks: { type: 'boolean' },
                },
              },
              security: {
                type: 'object',
                properties: {
                  requireMfa: { type: 'boolean' },
                  sessionTimeout: { type: 'integer' },
                  allowedDomains: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        required: ['settings'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            settings: { type: 'object' },
            updatedAt: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params
      const { settings } = request.body
      const userId = request.user.id
      const ip = request.ip
      const userAgent = request.headers['user-agent']

      const organizationService = (await import('../services/organization.js')).default
      const result = await organizationService.updateOrganizationSettings({
        orgId: id,
        userId,
        settings,
        ip,
        userAgent,
      })

      return reply.send({
        success: true,
        settings: result.settings,
        updatedAt: result.updatedAt,
      })
    } catch (error) {
      fastify.log.error('Organization settings update failed:', error.message)

      if (error.message.includes('not found')) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Organization not found',
        })
      }

      if (error.message.includes('permission') || error.message.includes('unauthorized')) {
        return reply.code(403).send({
          error: 'Forbidden',
          message: 'Insufficient permissions to update organization settings',
        })
      }

      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update organization settings',
      })
    }
  })

  // List organization members
  fastify.get('/:id/members', {
    preHandler: [
      (request, reply) => fastify.authenticate(request, reply),
      rbac.requireOrganizationMembership()
    ],
    schema: {
      description: 'List organization members',
      tags: ['Organizations'],
      params: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Organization ID',
          },
        },
        required: ['id'],
      },
      querystring: {
        type: 'object',
        properties: {
          role: {
            type: 'string',
            enum: ['owner', 'admin', 'member', 'viewer'],
            description: 'Filter by role',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 50,
            description: 'Maximum number of members to return',
          },
          offset: {
            type: 'integer',
            minimum: 0,
            default: 0,
            description: 'Number of members to skip',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            members: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  userId: { type: 'string' },
                  email: { type: 'string' },
                  role: { type: 'string' },
                  permissions: { type: 'array' },
                  joinedAt: { type: 'string' },
                  invitedAt: { type: 'string' },
                },
              },
            },
            pagination: {
              type: 'object',
              properties: {
                total: { type: 'integer' },
                limit: { type: 'integer' },
                offset: { type: 'integer' },
                hasMore: { type: 'boolean' },
              },
            },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params
      const { role, limit = 50, offset = 0 } = request.query
      const userId = request.user.id

      const result = await membershipService.getOrganizationMembers({
        orgId: id,
        userId,
        role,
        limit: Math.min(limit, 100),
        offset,
      })

      return reply.send({
        success: true,
        members: result.members,
        pagination: result.pagination,
      })
    } catch (error) {
      fastify.log.error('Failed to list members:', error.message)

      if (error.message.includes('not found')) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Organization not found or access denied',
        })
      }

      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve members',
      })
    }
  })
}
