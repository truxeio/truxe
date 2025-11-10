/**
 * Migration Routes
 * 
 * API endpoints for migration operations and status
 */

import migrationService from '../services/migration.js';
import rbac from '../middleware/rbac.js';
import config from '../config/index.js';

/**
 * Migration routes plugin
 */
export default async function migrationRoutes(fastify, options) {
  // Get migration statistics
  fastify.get('/stats', {
    preHandler: [
      (request, reply) => fastify.authenticate(request, reply),
      async (request, reply) => rbac.requireRole(request, reply, ['admin'])
    ],
    schema: {
      description: 'Get migration statistics',
      tags: ['Migration'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            stats: {
              type: 'object',
              properties: {
                usersBySource: { type: 'object' },
                organizationsBySource: { type: 'object' },
                recentMigrations: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      migrationId: { type: 'string' },
                      sourceSystem: { type: 'string' },
                      userCount: { type: 'number' },
                      startedAt: { type: 'string' },
                      completedAt: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const stats = await migrationService.getMigrationStats();
      
      return reply.send({
        success: true,
        stats,
      });
    } catch (error) {
      fastify.log.error('Failed to get migration stats:', error.message);
      
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get migration statistics',
      });
    }
  });

  // Get migration by ID
  fastify.get('/:migrationId', {
    preHandler: [
      (request, reply) => fastify.authenticate(request, reply),
      async (request, reply) => rbac.requireRole(request, reply, ['admin'])
    ],
    schema: {
      description: 'Get migration details by ID',
      tags: ['Migration'],
      params: {
        type: 'object',
        required: ['migrationId'],
        properties: {
          migrationId: {
            type: 'string',
            description: 'Migration ID',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            migration: {
              type: 'object',
              properties: {
                migrationId: { type: 'string' },
                users: { type: 'array' },
                organizations: { type: 'array' },
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
      const { migrationId } = request.params;
      
      const [users, organizations] = await Promise.all([
        migrationService.getUsersByMigrationId(migrationId),
        migrationService.getOrganizationsByMigrationId(migrationId),
      ]);
      
      if (users.length === 0 && organizations.length === 0) {
        return reply.code(404).send({
          error: 'Migration Not Found',
          message: `No migration found with ID: ${migrationId}`,
        });
      }
      
      return reply.send({
        success: true,
        migration: {
          migrationId,
          users,
          organizations,
        },
      });
    } catch (error) {
      fastify.log.error('Failed to get migration:', error.message);
      
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get migration details',
      });
    }
  });

  // Create user from migration
  fastify.post('/users', {
    preHandler: [
      (request, reply) => fastify.authenticate(request, reply),
      async (request, reply) => rbac.requireRole(request, reply, ['admin'])
    ],
    schema: {
      description: 'Create user from migration data',
      tags: ['Migration'],
      body: {
        type: 'object',
        required: ['email', 'migrationId', 'sourceSystem', 'sourceUserId'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address',
          },
          emailVerified: {
            type: 'boolean',
            description: 'Whether email is verified',
            default: false,
          },
          status: {
            type: 'string',
            enum: ['active', 'blocked', 'pending'],
            description: 'User status',
            default: 'active',
          },
          metadata: {
            type: 'object',
            description: 'User metadata',
            default: {},
          },
          migrationId: {
            type: 'string',
            description: 'Migration ID',
          },
          sourceSystem: {
            type: 'string',
            enum: ['auth0', 'clerk'],
            description: 'Source system',
          },
          sourceUserId: {
            type: 'string',
            description: 'Original user ID from source system',
          },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                emailVerified: { type: 'boolean' },
                status: { type: 'string' },
                metadata: { type: 'object' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
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
      },
    },
  }, async (request, reply) => {
    try {
      const {
        email,
        emailVerified,
        status,
        metadata,
        migrationId,
        sourceSystem,
        sourceUserId,
      } = request.body;
      
      const user = await migrationService.createMigrationUser({
        email,
        emailVerified,
        status,
        metadata,
        createdBy: request.user.id,
        migrationId,
        sourceSystem,
        sourceUserId,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });
      
      return reply.code(201).send({
        success: true,
        user,
      });
    } catch (error) {
      fastify.log.error('Failed to create migration user:', error.message);
      
      if (error.message.includes('already exists')) {
        return reply.code(400).send({
          error: 'User Already Exists',
          message: error.message,
        });
      }
      
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create user from migration data',
      });
    }
  });

  // Create organization from migration
  fastify.post('/organizations', {
    preHandler: [
      (request, reply) => fastify.authenticate(request, reply),
      async (request, reply) => rbac.requireRole(request, reply, ['admin'])
    ],
    schema: {
      description: 'Create organization from migration data',
      tags: ['Migration'],
      body: {
        type: 'object',
        required: ['name', 'slug', 'migrationId', 'sourceSystem', 'sourceOrgId'],
        properties: {
          name: {
            type: 'string',
            description: 'Organization name',
          },
          slug: {
            type: 'string',
            pattern: '^[a-z0-9][a-z0-9-]*[a-z0-9]$',
            description: 'Organization slug',
          },
          settings: {
            type: 'object',
            description: 'Organization settings',
            default: {},
          },
          migrationId: {
            type: 'string',
            description: 'Migration ID',
          },
          sourceSystem: {
            type: 'string',
            enum: ['auth0', 'clerk'],
            description: 'Source system',
          },
          sourceOrgId: {
            type: 'string',
            description: 'Original organization ID from source system',
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
                settings: { type: 'object' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
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
      },
    },
  }, async (request, reply) => {
    try {
      const {
        name,
        slug,
        settings,
        migrationId,
        sourceSystem,
        sourceOrgId,
      } = request.body;
      
      const organization = await migrationService.createMigrationOrganization({
        name,
        slug,
        settings,
        createdBy: request.user.id,
        migrationId,
        sourceSystem,
        sourceOrgId,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });
      
      return reply.code(201).send({
        success: true,
        organization,
      });
    } catch (error) {
      fastify.log.error('Failed to create migration organization:', error.message);
      
      if (error.message.includes('already exists')) {
        return reply.code(400).send({
          error: 'Organization Already Exists',
          message: error.message,
        });
      }
      
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create organization from migration data',
      });
    }
  });

  // Create organization membership from migration
  fastify.post('/memberships', {
    preHandler: [
      (request, reply) => fastify.authenticate(request, reply),
      async (request, reply) => rbac.requireRole(request, reply, ['admin'])
    ],
    schema: {
      description: 'Create organization membership from migration data',
      tags: ['Migration'],
      body: {
        type: 'object',
        required: ['orgId', 'userId', 'migrationId', 'sourceSystem'],
        properties: {
          orgId: {
            type: 'string',
            format: 'uuid',
            description: 'Organization ID',
          },
          userId: {
            type: 'string',
            format: 'uuid',
            description: 'User ID',
          },
          role: {
            type: 'string',
            enum: ['owner', 'admin', 'member', 'viewer'],
            description: 'User role',
            default: 'member',
          },
          permissions: {
            type: 'array',
            items: { type: 'string' },
            description: 'User permissions',
            default: [],
          },
          migrationId: {
            type: 'string',
            description: 'Migration ID',
          },
          sourceSystem: {
            type: 'string',
            enum: ['auth0', 'clerk'],
            description: 'Source system',
          },
          sourceMembershipId: {
            type: 'string',
            description: 'Original membership ID from source system',
          },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            membership: {
              type: 'object',
              properties: {
                orgId: { type: 'string' },
                userId: { type: 'string' },
                role: { type: 'string' },
                permissions: { type: 'array' },
                invitedAt: { type: 'string' },
                joinedAt: { type: 'string' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
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
      },
    },
  }, async (request, reply) => {
    try {
      const {
        orgId,
        userId,
        role,
        permissions,
        migrationId,
        sourceSystem,
        sourceMembershipId,
      } = request.body;
      
      const membership = await migrationService.createMigrationMembership({
        orgId,
        userId,
        role,
        permissions,
        invitedBy: request.user.id,
        migrationId,
        sourceSystem,
        sourceMembershipId,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });
      
      return reply.code(201).send({
        success: true,
        membership,
      });
    } catch (error) {
      fastify.log.error('Failed to create migration membership:', error.message);
      
      if (error.message.includes('already exists')) {
        return reply.code(400).send({
          error: 'Membership Already Exists',
          message: error.message,
        });
      }
      
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create membership from migration data',
      });
    }
  });

  // Rollback migration
  fastify.post('/:migrationId/rollback', {
    preHandler: [
      (request, reply) => fastify.authenticate(request, reply),
      async (request, reply) => rbac.requireRole(request, reply, ['admin'])
    ],
    schema: {
      description: 'Rollback a migration by ID',
      tags: ['Migration'],
      params: {
        type: 'object',
        required: ['migrationId'],
        properties: {
          migrationId: {
            type: 'string',
            description: 'Migration ID to rollback',
          },
        },
      },
      body: {
        type: 'object',
        properties: {
          confirm: {
            type: 'boolean',
            description: 'Confirmation flag',
            default: false,
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            rollback: {
              type: 'object',
              properties: {
                migrationId: { type: 'string' },
                usersRemoved: { type: 'number' },
                organizationsRemoved: { type: 'number' },
                failedRemovals: { type: 'array' },
                rolledBackAt: { type: 'string' },
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
      const { migrationId } = request.params;
      const { confirm } = request.body;
      
      if (!confirm) {
        return reply.code(400).send({
          error: 'Confirmation Required',
          message: 'Migration rollback requires explicit confirmation',
        });
      }
      
      // Check if migration exists
      const [users, organizations] = await Promise.all([
        migrationService.getUsersByMigrationId(migrationId),
        migrationService.getOrganizationsByMigrationId(migrationId),
      ]);
      
      if (users.length === 0 && organizations.length === 0) {
        return reply.code(404).send({
          error: 'Migration Not Found',
          message: `No migration found with ID: ${migrationId}`,
        });
      }
      
      const rollback = await migrationService.rollbackMigration({
        migrationId,
        performedBy: request.user.id,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });
      
      return reply.send({
        success: true,
        rollback,
      });
    } catch (error) {
      fastify.log.error('Failed to rollback migration:', error.message);
      
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to rollback migration',
      });
    }
  });

  // Validate migration integrity
  fastify.post('/:migrationId/validate', {
    preHandler: [
      (request, reply) => fastify.authenticate(request, reply),
      async (request, reply) => rbac.requireRole(request, reply, ['admin'])
    ],
    schema: {
      description: 'Validate migration data integrity',
      tags: ['Migration'],
      params: {
        type: 'object',
        required: ['migrationId'],
        properties: {
          migrationId: {
            type: 'string',
            description: 'Migration ID to validate',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            validation: {
              type: 'object',
              properties: {
                migrationId: { type: 'string' },
                valid: { type: 'boolean' },
                issues: { type: 'array' },
                checkedAt: { type: 'string' },
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
      const { migrationId } = request.params;
      
      // Check if migration exists
      const [users, organizations] = await Promise.all([
        migrationService.getUsersByMigrationId(migrationId),
        migrationService.getOrganizationsByMigrationId(migrationId),
      ]);
      
      if (users.length === 0 && organizations.length === 0) {
        return reply.code(404).send({
          error: 'Migration Not Found',
          message: `No migration found with ID: ${migrationId}`,
        });
      }
      
      const validation = await migrationService.validateMigrationIntegrity(migrationId);
      
      return reply.send({
        success: true,
        validation,
      });
    } catch (error) {
      fastify.log.error('Failed to validate migration:', error.message);
      
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to validate migration integrity',
      });
    }
  });

  // Send migration notification
  fastify.post('/notifications', {
    preHandler: [
      (request, reply) => fastify.authenticate(request, reply),
      async (request, reply) => rbac.requireRole(request, reply, ['admin'])
    ],
    schema: {
      description: 'Send migration notification email',
      tags: ['Migration'],
      body: {
        type: 'object',
        required: ['email', 'migrationType', 'status', 'migrationId'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            description: 'Recipient email address',
          },
          migrationType: {
            type: 'string',
            enum: ['auth0', 'clerk'],
            description: 'Type of migration',
          },
          status: {
            type: 'string',
            enum: ['started', 'completed', 'failed', 'rolled_back'],
            description: 'Migration status',
          },
          usersMigrated: {
            type: 'number',
            description: 'Number of users migrated',
            default: 0,
          },
          organizationsCreated: {
            type: 'number',
            description: 'Number of organizations created',
            default: 0,
          },
          migrationId: {
            type: 'string',
            description: 'Migration ID',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            notification: {
              type: 'object',
              properties: {
                sent: { type: 'boolean' },
                notificationId: { type: 'string' },
                sentAt: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const {
        email,
        migrationType,
        status,
        usersMigrated,
        organizationsCreated,
        migrationId,
      } = request.body;
      
      const notification = await migrationService.sendMigrationNotification({
        email,
        migrationType,
        status,
        usersMigrated,
        organizationsCreated,
        migrationId,
      });
      
      return reply.send({
        success: true,
        notification,
      });
    } catch (error) {
      fastify.log.error('Failed to send migration notification:', error.message);
      
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to send migration notification',
      });
    }
  });
}
