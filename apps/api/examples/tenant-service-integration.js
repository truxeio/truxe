#!/usr/bin/env node
/**
 * Tenant Service Integration Examples
 *
 * This file demonstrates how to use the Tenant Service Layer directly
 * without needing the REST API routes.
 *
 * Use cases:
 * 1. Integrate tenant management into existing endpoints
 * 2. Create custom business logic with tenant hierarchy
 * 3. Batch operations for data migration
 * 4. Background jobs and scheduled tasks
 */

import { TenantService } from '../src/services/tenant/index.js';
import TenantRepository from '../src/services/tenant/repository.js';
import { Pool } from 'pg';

// ===================================================================
// SETUP: Initialize Service Layer
// ===================================================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://truxe.io_password_change_me@localhost:21432/truxe.io',
  max: 10,
});

const repository = new TenantRepository({ pool });
const tenantService = new TenantService({ repository });

// ===================================================================
// EXAMPLE 1: Create Workspace (Root Tenant)
// ===================================================================

async function example1_createWorkspace(userId) {
  console.log('\n📦 EXAMPLE 1: Create Workspace');
  console.log('=' .repeat(60));

  try {
    const workspace = await tenantService.createTenant({
      name: 'Acme Corporation',
      slug: 'acme-corp',
      tenantType: 'workspace',
      description: 'Main workspace for Acme Corporation',
      maxDepth: 4, // Support up to 4 levels
      settings: {
        features: {
          projects: true,
          teams: true,
          departments: true,
        },
        branding: {
          primaryColor: '#0066cc',
          logo: '/logos/acme.png',
        },
      },
    }, userId);

    console.log('✅ Workspace created successfully');
    console.log(`   ID: ${workspace.id}`);
    console.log(`   Name: ${workspace.name}`);
    console.log(`   Slug: ${workspace.slug}`);
    console.log(`   Type: ${workspace.tenant_type}`);
    console.log(`   Level: ${workspace.level}`);

    return workspace.id;
  } catch (error) {
    console.error('❌ Error creating workspace:', error.message);
    throw error;
  }
}

// ===================================================================
// EXAMPLE 2: Create Child Tenant (Team under Workspace)
// ===================================================================

async function example2_createTeam(workspaceId, userId) {
  console.log('\n👥 EXAMPLE 2: Create Team under Workspace');
  console.log('=' .repeat(60));

  try {
    const team = await tenantService.createTenant({
      name: 'Engineering Team',
      slug: 'engineering',
      tenantType: 'team',
      parentId: workspaceId,
      description: 'Software engineering team',
      settings: {
        defaultRole: 'member',
        requireApproval: false,
      },
    }, userId);

    console.log('✅ Team created successfully');
    console.log(`   ID: ${team.id}`);
    console.log(`   Parent: ${team.parent_tenant_id}`);
    console.log(`   Level: ${team.level}`);
    console.log(`   Path length: ${team.path.length}`);

    return team.id;
  } catch (error) {
    console.error('❌ Error creating team:', error.message);
    throw error;
  }
}

// ===================================================================
// EXAMPLE 3: Create Project under Team
// ===================================================================

async function example3_createProject(teamId, userId) {
  console.log('\n📁 EXAMPLE 3: Create Project under Team');
  console.log('=' .repeat(60));

  try {
    const project = await tenantService.createTenant({
      name: 'Mobile App Redesign',
      slug: 'mobile-redesign',
      tenantType: 'project',
      parentId: teamId,
      description: 'Redesign of mobile application',
      settings: {
        status: 'active',
        dueDate: '2025-12-31',
        priority: 'high',
      },
    }, userId);

    console.log('✅ Project created successfully');
    console.log(`   ID: ${project.id}`);
    console.log(`   Hierarchy depth: ${project.level}`);

    return project.id;
  } catch (error) {
    console.error('❌ Error creating project:', error.message);
    throw error;
  }
}

// ===================================================================
// EXAMPLE 4: Query Hierarchy
// ===================================================================

async function example4_queryHierarchy(workspaceId, userId) {
  console.log('\n🌲 EXAMPLE 4: Query Tenant Hierarchy');
  console.log('=' .repeat(60));

  try {
    // Get full tenant details with children
    const workspace = await tenantService.getTenantById(workspaceId, userId);

    console.log('✅ Hierarchy retrieved:');
    console.log(`   Root: ${workspace.name}`);
    console.log(`   Children: ${workspace.children?.length || 0}`);

    if (workspace.children) {
      workspace.children.forEach(child => {
        console.log(`     - ${child.name} (${child.tenant_type})`);
      });
    }

    // Get ancestors and descendants using hierarchy service
    const hierarchy = tenantService.hierarchy;

    // Example: Get all descendants
    const descendants = await hierarchy.getDescendants(workspaceId, { userId });
    console.log(`\n   Total descendants: ${descendants.length}`);

    return { workspace, descendants };
  } catch (error) {
    console.error('❌ Error querying hierarchy:', error.message);
    throw error;
  }
}

// ===================================================================
// EXAMPLE 5: Member Management
// ===================================================================

async function example5_manageMember(tenantId, newUserId, adminUserId) {
  console.log('\n👤 EXAMPLE 5: Add Member to Tenant');
  console.log('=' .repeat(60));

  try {
    // Add member with role
    await tenantService.members.addMember(
      tenantId,
      newUserId,
      'member', // role: owner, admin, member, viewer, guest
      adminUserId
    );

    console.log('✅ Member added successfully');
    console.log(`   User: ${newUserId}`);
    console.log(`   Role: member`);

    // List all members
    const members = await tenantService.members.getMembers(tenantId, { userId: adminUserId });
    console.log(`\n   Total members: ${members.length}`);

    members.forEach(member => {
      console.log(`     - User ${member.user_id.substring(0, 8)}...: ${member.role}`);
    });

    return members;
  } catch (error) {
    console.error('❌ Error managing members:', error.message);
    throw error;
  }
}

// ===================================================================
// EXAMPLE 6: Update Tenant Settings
// ===================================================================

async function example6_updateTenant(tenantId, userId) {
  console.log('\n⚙️  EXAMPLE 6: Update Tenant Settings');
  console.log('=' .repeat(60));

  try {
    const updated = await tenantService.updateTenantSettings(
      tenantId,
      {
        features: {
          analytics: true,
          apiAccess: true,
        },
        limits: {
          maxMembers: 50,
          maxProjects: 20,
        },
      },
      userId
    );

    console.log('✅ Tenant settings updated');
    console.log(`   Updated at: ${updated.updated_at}`);

    return updated;
  } catch (error) {
    console.error('❌ Error updating tenant:', error.message);
    throw error;
  }
}

// ===================================================================
// EXAMPLE 7: Move Tenant to Different Parent
// ===================================================================

async function example7_moveTenant(tenantId, newParentId, userId) {
  console.log('\n🔄 EXAMPLE 7: Move Tenant to Different Parent');
  console.log('=' .repeat(60));

  try {
    const moved = await tenantService.moveTenant(
      tenantId,
      newParentId,
      userId
    );

    console.log('✅ Tenant moved successfully');
    console.log(`   New parent: ${moved.parent_tenant_id}`);
    console.log(`   New path length: ${moved.path.length}`);

    return moved;
  } catch (error) {
    console.error('❌ Error moving tenant:', error.message);
    throw error;
  }
}

// ===================================================================
// EXAMPLE 8: Archive and Restore
// ===================================================================

async function example8_archiveRestore(tenantId, userId) {
  console.log('\n📦 EXAMPLE 8: Archive and Restore Tenant');
  console.log('=' .repeat(60));

  try {
    // Archive tenant
    await tenantService.archiveTenant(tenantId, userId);
    console.log('✅ Tenant archived');

    // Restore tenant
    const restored = await tenantService.restoreTenant(tenantId, userId);
    console.log('✅ Tenant restored');
    console.log(`   Status: ${restored.status}`);

    return restored;
  } catch (error) {
    console.error('❌ Error archiving/restoring:', error.message);
    throw error;
  }
}

// ===================================================================
// EXAMPLE 9: Batch Operations
// ===================================================================

async function example9_batchOperations(workspaceId, userId) {
  console.log('\n⚡ EXAMPLE 9: Batch Create Multiple Teams');
  console.log('=' .repeat(60));

  const teams = [
    { name: 'Product Team', slug: 'product' },
    { name: 'Design Team', slug: 'design' },
    { name: 'Marketing Team', slug: 'marketing' },
  ];

  try {
    const created = await Promise.all(
      teams.map(team =>
        tenantService.createTenant({
          ...team,
          tenantType: 'team',
          parentId: workspaceId,
        }, userId)
      )
    );

    console.log(`✅ Created ${created.length} teams in batch`);
    created.forEach(team => {
      console.log(`   - ${team.name}`);
    });

    return created;
  } catch (error) {
    console.error('❌ Error in batch operations:', error.message);
    throw error;
  }
}

// ===================================================================
// EXAMPLE 10: Search and Filter
// ===================================================================

async function example10_searchTenants(userId) {
  console.log('\n🔍 EXAMPLE 10: Search and Filter Tenants');
  console.log('=' .repeat(60));

  try {
    // Search by name/slug
    const searchResults = await tenantService.searchTenants('engineering', userId);
    console.log(`✅ Search results: ${searchResults.length} tenants found`);

    searchResults.forEach(tenant => {
      console.log(`   - ${tenant.name} (${tenant.slug})`);
    });

    // List with filters
    const activeWorkspaces = await tenantService.listTenants({
      tenantType: 'workspace',
      status: 'active',
    }, userId);

    console.log(`\n✅ Active workspaces: ${activeWorkspaces.length}`);

    return { searchResults, activeWorkspaces };
  } catch (error) {
    console.error('❌ Error searching tenants:', error.message);
    throw error;
  }
}

// ===================================================================
// INTEGRATION PATTERN: Use in Existing Endpoint
// ===================================================================

/**
 * Example: Integrate tenant service in an existing Fastify route
 */
export function exampleFastifyIntegration(fastify) {
  // Example endpoint using tenant service
  fastify.post('/api/projects', {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      const { name, slug, teamId } = request.body;
      const userId = request.user.id;

      try {
        // Use tenant service to create project
        const project = await tenantService.createTenant({
          name,
          slug,
          tenantType: 'project',
          parentId: teamId,
        }, userId);

        return reply.code(201).send({
          success: true,
          data: project,
        });
      } catch (error) {
        return reply.code(400).send({
          success: false,
          error: error.message,
        });
      }
    },
  });

  // Example: Get user's accessible tenants
  fastify.get('/api/my-tenants', {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      const userId = request.user.id;

      try {
        // Query user's tenants via service layer
        const tenants = await tenantService.listTenants({}, userId);

        return reply.send({
          success: true,
          data: tenants,
          count: tenants.length,
        });
      } catch (error) {
        return reply.code(500).send({
          success: false,
          error: error.message,
        });
      }
    },
  });
}

// ===================================================================
// MAIN DEMO: Run All Examples
// ===================================================================

async function runDemo() {
  console.log('\n🚀 TENANT SERVICE INTEGRATION DEMO');
  console.log('=' .repeat(60));
  console.log('Demonstrating direct service layer usage\n');

  // Create test user
  const testUserId = await pool.query(`
    INSERT INTO users (email, email_verified, status)
    VALUES ($1, true, 'active')
    RETURNING id
  `, ['service-integration-demo@example.com']);
  const userId = testUserId.rows[0].id;

  try {
    // Run examples sequentially
    const workspaceId = await example1_createWorkspace(userId);
    const teamId = await example2_createTeam(workspaceId, userId);
    const projectId = await example3_createProject(teamId, userId);

    await example4_queryHierarchy(workspaceId, userId);
    await example5_manageMember(teamId, userId, userId);
    await example6_updateTenant(workspaceId, userId);

    // Create additional team for move example
    const team2Id = await example2_createTeam(workspaceId, userId);
    await example7_moveTenant(projectId, team2Id, userId);

    await example8_archiveRestore(projectId, userId);
    await example9_batchOperations(workspaceId, userId);
    await example10_searchTenants(userId);

    console.log('\n' + '=' .repeat(60));
    console.log('✅ ALL EXAMPLES COMPLETED SUCCESSFULLY');
    console.log('=' .repeat(60));
    console.log('\n📝 Key Takeaways:');
    console.log('   1. Service layer provides full tenant management');
    console.log('   2. No REST API needed for internal operations');
    console.log('   3. Transaction-safe with automatic rollback');
    console.log('   4. Audit logging built-in');
    console.log('   5. Cache layer for performance');
    console.log('\n💡 Use these patterns to integrate tenant hierarchy');
    console.log('   into your existing application logic!');

  } catch (error) {
    console.error('\n❌ Demo failed:', error.message);
    console.error(error.stack);
  } finally {
    // Cleanup
    await pool.query('DELETE FROM users WHERE email = $1', ['service-integration-demo@example.com']);
    await pool.end();
  }
}

// Run demo if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDemo().catch(console.error);
}

// Export for use in other modules
export {
  tenantService,
  example1_createWorkspace,
  example2_createTeam,
  example3_createProject,
  example4_queryHierarchy,
  example5_manageMember,
  example6_updateTenant,
  example7_moveTenant,
  example8_archiveRestore,
  example9_batchOperations,
  example10_searchTenants,
};
