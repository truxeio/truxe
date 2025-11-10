/**
 * API Integration Script for Nested Multi-Tenancy
 * 
 * Integrates the new tenant routes and services with the existing
 * Fastify-based Heimdall API while maintaining backward compatibility.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Register tenant routes with Fastify
 */
export async function registerTenantRoutes(fastify, options) {
  // Import tenant routes (converted to Fastify format)
  const { default: tenantRoutes } = await import('./routes/tenants-fastify.js');
  
  // Register tenant routes under /tenants prefix
  await fastify.register(tenantRoutes, { prefix: '/tenants' });
  
  fastify.log.info('✅ Tenant routes registered at /tenants');
}

/**
 * Register tenant middleware
 */
export async function registerTenantMiddleware(fastify, options) {
  // Import tenant services for dependency injection
  const { tenantService } = await import('./services/tenant/index.js');
  const { hierarchyService } = await import('./services/tenant/hierarchy.js');
  const { permissionService } = await import('./services/tenant/permissions.js');
  
  // Add tenant services to Fastify context
  fastify.decorate('tenantService', tenantService);
  fastify.decorate('hierarchyService', hierarchyService);
  fastify.decorate('permissionService', permissionService);
  
  // Add tenant-aware permission middleware
  fastify.addHook('preHandler', async (request, reply) => {
    // Skip tenant checks for non-tenant routes
    if (!request.url.startsWith('/tenants') && !request.query.hierarchical) {
      return;
    }
    
    // Add tenant context to request
    if (request.params.id) {
      try {
        const tenant = await tenantService.getTenantById(request.params.id);
        if (tenant) {
          request.tenant = tenant;
          
          // Check if user has access to this tenant
          const hasAccess = await tenantService.hasUserAccess(
            request.params.id, 
            request.user?.id
          );
          
          if (!hasAccess && request.method !== 'GET') {
            throw new Error('Access denied to this tenant');
          }
        }
      } catch (error) {
        fastify.log.warn(`Tenant access check failed: ${error.message}`);
      }
    }
  });
  
  fastify.log.info('✅ Tenant middleware registered');
}

/**
 * Setup tenant permissions integration
 */
export async function setupTenantPermissions(fastify, options) {
  // Extend existing RBAC middleware to support hierarchical permissions
  const originalRbac = fastify.rbac;
  
  fastify.decorate('tenantRbac', {
    ...originalRbac,
    
    // Enhanced permission check that considers tenant hierarchy
    async checkPermission(userId, tenantId, resource, action) {
      // Check direct permissions first
      const hasDirectPermission = await originalRbac.checkPermission(
        userId, tenantId, resource, action
      );
      
      if (hasDirectPermission) return true;
      
      // Check inherited permissions from parent tenants
      if (fastify.tenantService) {
        return await fastify.tenantService.checkInheritedPermission(
          userId, tenantId, resource, action
        );
      }
      
      return false;
    },
    
    // Get effective permissions across tenant hierarchy
    async getEffectivePermissions(userId, tenantId) {
      const directPermissions = await originalRbac.getUserPermissions(userId, tenantId);
      
      if (fastify.tenantService) {
        const inheritedPermissions = await fastify.tenantService.getInheritedPermissions(
          userId, tenantId
        );
        
        return {
          direct: directPermissions,
          inherited: inheritedPermissions,
          effective: [...directPermissions, ...inheritedPermissions]
        };
      }
      
      return {
        direct: directPermissions,
        inherited: [],
        effective: directPermissions
      };
    }
  });
  
  fastify.log.info('✅ Tenant RBAC integration setup complete');
}

/**
 * Initialize tenant database connections
 */
export async function initializeTenantDatabase(fastify, options) {
  try {
    // Initialize tenant service with database connection
    const { DatabasePool } = await import('./database/connection.js');
    const pool = new DatabasePool({
      enableRLS: true,
      retryAttempts: 3,
      healthCheckInterval: 30000
    });
    
    // Wait for database connection
    await new Promise((resolve, reject) => {
      pool.on('initialized', resolve);
      pool.on('error', reject);
      setTimeout(() => reject(new Error('Database connection timeout')), 10000);
    });
    
    // Store pool in Fastify context
    fastify.decorate('tenantDbPool', pool);
    
    // Add graceful shutdown
    fastify.addHook('onClose', async () => {
      if (pool) {
        await pool.close();
        fastify.log.info('✅ Tenant database pool closed');
      }
    });
    
    fastify.log.info('✅ Tenant database initialized');
  } catch (error) {
    fastify.log.error(`❌ Failed to initialize tenant database: ${error.message}`);
    throw error;
  }
}

/**
 * Main plugin to register all tenant functionality
 */
export default async function tenantPlugin(fastify, options) {
  // Initialize in order
  await initializeTenantDatabase(fastify, options);
  await registerTenantMiddleware(fastify, options);
  await setupTenantPermissions(fastify, options);
  await registerTenantRoutes(fastify, options);
  
  // Add health check endpoint for tenant system
  fastify.get('/health/tenants', async (request, reply) => {
    try {
      // Check database connectivity
      const dbStatus = await fastify.tenantDbPool.query('SELECT 1 as healthy');
      
      // Check tenant service
      const serviceStatus = await fastify.tenantService.healthCheck();
      
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: dbStatus.rows[0]?.healthy === 1,
        services: serviceStatus,
        version: '1.0.0'
      };
    } catch (error) {
      reply.code(503);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  });
  
  fastify.log.info('✅ Nested Multi-Tenancy Plugin Loaded');
}