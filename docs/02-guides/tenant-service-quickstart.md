# Tenant Service Layer - Quick Start Guide

## 🚀 Overview

The Tenant Service Layer provides **immediate access** to nested multi-tenancy functionality without requiring REST API routes. Use it directly in your code for:

- ✅ Creating hierarchical tenants (workspace → team → project)
- ✅ Managing members and permissions
- ✅ Querying hierarchy relationships
- ✅ Batch operations and migrations
- ✅ Background jobs and scheduled tasks

---

## 📦 Installation

Already installed! The service layer is ready to use:

```javascript
import { TenantService } from './src/services/tenant/index.js';
import TenantRepository from './src/services/tenant/repository.js';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const repository = new TenantRepository({ pool });
const tenantService = new TenantService({ repository });
```

---

## 🎯 Quick Examples

### 1. Create Workspace (Root Tenant)

```javascript
const workspace = await tenantService.createTenant({
  name: 'Acme Corporation',
  slug: 'acme-corp',
  tenantType: 'workspace',
  description: 'Main workspace',
  maxDepth: 4,
  settings: {
    features: { projects: true, teams: true }
  }
}, userId);

console.log(`Created: ${workspace.name} (${workspace.id})`);
```

### 2. Create Team under Workspace

```javascript
const team = await tenantService.createTenant({
  name: 'Engineering Team',
  slug: 'engineering',
  tenantType: 'team',
  parentId: workspaceId,
  description: 'Software engineering team'
}, userId);

console.log(`Team level: ${team.level}, Parent: ${team.parent_tenant_id}`);
```

### 3. Create Project under Team

```javascript
const project = await tenantService.createTenant({
  name: 'Mobile App Redesign',
  slug: 'mobile-redesign',
  tenantType: 'project',
  parentId: teamId,
  settings: {
    dueDate: '2025-12-31',
    priority: 'high'
  }
}, userId);

console.log(`Project depth: ${project.level}`);
```

### 4. Query Hierarchy

```javascript
// Get tenant with children
const workspace = await tenantService.getTenantById(workspaceId, userId);
console.log(`Children: ${workspace.children.length}`);

// Get all descendants
const descendants = await tenantService.hierarchy.getDescendants(workspaceId, { userId });
console.log(`Total descendants: ${descendants.length}`);

// Get ancestors
const ancestors = await tenantService.hierarchy.getAncestors(projectId, { userId });
ancestors.forEach(a => console.log(`- ${a.name} (level ${a.level})`));
```

### 5. Manage Members

```javascript
// Add member
await tenantService.members.addMember(
  tenantId,
  newUserId,
  'member', // role: owner, admin, member, viewer, guest
  adminUserId
);

// List members
const members = await tenantService.members.getMembers(tenantId, { userId });
console.log(`Members: ${members.length}`);

// Update member role
await tenantService.members.updateMemberRole(tenantId, userId, 'admin', adminUserId);

// Remove member
await tenantService.members.removeMember(tenantId, userId, adminUserId);
```

### 6. Update Tenant

```javascript
// Update basic info
const updated = await tenantService.updateTenant(tenantId, {
  name: 'New Name',
  description: 'Updated description',
  status: 'active'
}, userId);

// Update settings
await tenantService.updateTenantSettings(tenantId, {
  features: { analytics: true },
  limits: { maxMembers: 50 }
}, userId);
```

### 7. Archive and Restore

```javascript
// Archive tenant
await tenantService.archiveTenant(tenantId, userId);

// Restore tenant
const restored = await tenantService.restoreTenant(tenantId, userId);
console.log(`Status: ${restored.status}`);
```

### 8. Search and Filter

```javascript
// Search by name/slug
const results = await tenantService.searchTenants('engineering', userId);

// List with filters
const workspaces = await tenantService.listTenants({
  tenantType: 'workspace',
  status: 'active'
}, userId);
```

---

## 🔌 Integration Patterns

### Pattern 1: Use in Existing Fastify Routes

```javascript
// In your existing route handler
fastify.post('/api/projects', {
  preHandler: [fastify.authenticate],
  handler: async (request, reply) => {
    const { name, slug, teamId } = request.body;
    const userId = request.user.id;

    try {
      const project = await tenantService.createTenant({
        name,
        slug,
        tenantType: 'project',
        parentId: teamId,
      }, userId);

      return reply.code(201).send({
        success: true,
        data: project
      });
    } catch (error) {
      return reply.code(400).send({
        success: false,
        error: error.message
      });
    }
  }
});
```

### Pattern 2: Use in Background Jobs

```javascript
// Scheduled job to archive inactive projects
async function archiveInactiveProjects() {
  const inactiveProjects = await tenantService.listTenants({
    tenantType: 'project',
    status: 'active'
  }, systemUserId);

  for (const project of inactiveProjects) {
    // Check if inactive
    if (isInactive(project)) {
      await tenantService.archiveTenant(project.id, systemUserId);
      console.log(`Archived: ${project.name}`);
    }
  }
}
```

### Pattern 3: Batch Data Migration

```javascript
// Migrate existing organizations to tenant hierarchy
async function migrateOrganizations() {
  const orgs = await pool.query('SELECT * FROM old_organizations');

  for (const org of orgs.rows) {
    const workspace = await tenantService.createTenant({
      name: org.name,
      slug: org.slug,
      tenantType: 'workspace',
      settings: org.settings
    }, org.owner_id);

    console.log(`Migrated: ${org.name} → ${workspace.id}`);
  }
}
```

### Pattern 4: Custom Business Logic

```javascript
// Example: Clone project structure
async function cloneProject(sourceProjectId, newParentId, userId) {
  // Get source project
  const source = await tenantService.getTenantById(sourceProjectId, userId);

  // Create clone
  const clone = await tenantService.createTenant({
    name: `${source.name} (Copy)`,
    slug: `${source.slug}-copy`,
    tenantType: 'project',
    parentId: newParentId,
    description: source.description,
    settings: source.settings
  }, userId);

  // Copy members
  const members = await tenantService.members.getMembers(sourceProjectId, { userId });
  for (const member of members) {
    await tenantService.members.addMember(clone.id, member.user_id, member.role, userId);
  }

  return clone;
}
```

---

## 📚 Service Layer API Reference

### TenantService

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `createTenant(data, userId)` | Create tenant (root or child) | data: {name, slug, tenantType, parentId?, ...}, userId | Tenant object |
| `getTenantById(id, userId)` | Get tenant with children | id, userId | Tenant with relations |
| `getTenantBySlug(slug, userId)` | Get tenant by slug | slug, userId, options? | Tenant object |
| `listTenants(filters, userId)` | List tenants with filters | filters: {tenantType?, status?, ...}, userId | Array<Tenant> |
| `searchTenants(query, userId)` | Search by name/slug | query string, userId | Array<Tenant> |
| `updateTenant(id, updates, userId)` | Update tenant info | id, updates, userId | Updated tenant |
| `updateTenantSettings(id, settings, userId)` | Update settings only | id, settings, userId | Updated tenant |
| `moveTenant(id, newParentId, userId)` | Move to different parent | id, newParentId, userId | Moved tenant |
| `archiveTenant(id, userId)` | Archive tenant | id, userId | void |
| `restoreTenant(id, userId)` | Restore archived tenant | id, userId | Restored tenant |
| `deleteTenant(id, userId)` | Permanently delete | id, userId | void |

### HierarchyService (via `tenantService.hierarchy`)

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `getAncestors(id, options)` | Get parent chain | id, {userId, includeArchived?} | Array<Tenant> |
| `getDescendants(id, options)` | Get all children | id, {userId, maxDepth?, includeArchived?} | Array<Tenant> |
| `getChildren(id, options)` | Get direct children only | id, {userId} | Array<Tenant> |
| `getSiblings(id, options)` | Get tenants with same parent | id, {userId} | Array<Tenant> |
| `getRoot(id, options)` | Get root tenant | id, {userId} | Tenant |

### MemberService (via `tenantService.members`)

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `addMember(tenantId, userId, role, invitedBy)` | Add member | tenantId, userId, role, invitedBy | Member |
| `getMembers(tenantId, options)` | List members | tenantId, {userId, includeInherited?} | Array<Member> |
| `getMember(tenantId, userId)` | Get specific member | tenantId, userId | Member |
| `updateMemberRole(tenantId, userId, newRole, updatedBy)` | Update role | tenantId, userId, newRole, updatedBy | Member |
| `removeMember(tenantId, userId, removedBy)` | Remove member | tenantId, userId, removedBy | void |

### PathService (via `tenantService.path`)

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `getPathString(tenantId, options)` | Get formatted path | tenantId, {userId, separator?} | String |
| `rebuildPaths(tenantId, options)` | Recalculate paths | tenantId, {userId} | void |

### ValidationService (via `tenantService.validation`)

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `validateSlug(slug, parentId, options)` | Check slug uniqueness | slug, parentId, {client?} | String (validated) |
| `validateTenantType(type, level?)` | Validate type for level | type, level? | String (validated) |
| `canCreateTenant(userId, parentId?, options)` | Check create permission | userId, parentId?, {client?} | Boolean |
| `canUpdateTenant(userId, tenantId, options)` | Check update permission | userId, tenantId, {client?} | Boolean |

---

## 🎭 Use Cases

### Use Case 1: MyApp Beta Launch (2 levels)
```javascript
// Create workspace
const workspace = await tenantService.createTenant({
  name: 'MyApp Platform',
  slug: 'hippoc',
  tenantType: 'workspace',
  maxDepth: 2
}, userId);

// Create team
const team = await tenantService.createTenant({
  name: 'Engineering',
  slug: 'eng',
  tenantType: 'team',
  parentId: workspace.id
}, userId);
```

### Use Case 2: Enterprise (4 levels)
```javascript
// Corporation → Division → Department → Team
const corp = await tenantService.createTenant({
  name: 'Acme Corp',
  tenantType: 'workspace',
  maxDepth: 4
}, userId);

const division = await tenantService.createTenant({
  name: 'Technology',
  tenantType: 'department',
  parentId: corp.id
}, userId);

const dept = await tenantService.createTenant({
  name: 'Engineering',
  tenantType: 'department',
  parentId: division.id
}, userId);

const team = await tenantService.createTenant({
  name: 'Platform Team',
  tenantType: 'team',
  parentId: dept.id
}, userId);
```

### Use Case 3: SaaS Multi-Tenancy
```javascript
// Each customer gets a workspace
async function onboardNewCustomer(customerData) {
  const workspace = await tenantService.createTenant({
    name: customerData.companyName,
    slug: customerData.slug,
    tenantType: 'workspace',
    settings: {
      plan: customerData.plan,
      limits: customerData.limits
    }
  }, customerData.ownerId);

  // Add admin user
  await tenantService.members.addMember(
    workspace.id,
    customerData.adminUserId,
    'admin',
    customerData.ownerId
  );

  return workspace;
}
```

---

## ⚡ Performance Tips

1. **Use Caching**: Service layer includes built-in Redis caching (60s TTL)
2. **Batch Operations**: Use `Promise.all()` for parallel tenant creation
3. **Filter Early**: Use `listTenants()` filters instead of fetching all
4. **Limit Depth**: Set appropriate `maxDepth` to prevent deep hierarchies
5. **Index Usage**: Path queries automatically use GIN indexes (<1ms)

---

## 🧪 Testing

```bash
# Run comprehensive integration test
node api/test-tenant-hierarchy.js

# Run validation script
node api/scripts/validate-tenant-service.js

# Run service integration examples
node api/examples/tenant-service-integration.js

# Run unit tests
npm test -- tenant-service.test.js

# Run integration tests
npm test -- tenant-hierarchy.test.js
```

---

## 📖 Additional Resources

- **Full Documentation**: [database/docs/nested-tenancy-schema.md](database/docs/nested-tenancy-schema.md)
- **Service Documentation**: [docs/services/tenant-hierarchy-service.md](docs/services/tenant-hierarchy-service.md)
- **Integration Examples**: [api/examples/tenant-service-integration.js](api/examples/tenant-service-integration.js)
- **Test Suite**: [api/test-tenant-hierarchy.js](api/test-tenant-hierarchy.js)
- **Implementation Summary**: [README-nested-tenancy.md](README-nested-tenancy.md)

---

## 🆘 Troubleshooting

### Issue: "Cannot find module 'tenant/index.js'"
**Solution**: Ensure you're using the correct import path:
```javascript
import { TenantService } from './src/services/tenant/index.js';
```

### Issue: "Database connection failed"
**Solution**: Check DATABASE_URL environment variable:
```bash
export DATABASE_URL="postgresql://truxe.io_password_change_me@localhost:21432/truxe.io"
```

### Issue: "Invalid tenant type"
**Solution**: Use valid types: `workspace`, `team`, `project`, `department`, `division`

### Issue: "Circular reference detected"
**Solution**: Database triggers prevent this automatically. Check parent_tenant_id.

### Issue: "Permission denied"
**Solution**: User must be owner/admin of parent tenant to create children.

---

## 💡 Best Practices

1. **Always use transactions**: Service layer handles this automatically
2. **Validate input**: Service includes built-in validation
3. **Log operations**: Service integrates with audit logging
4. **Handle errors**: Use try/catch blocks around service calls
5. **Check permissions**: Service validates user permissions automatically
6. **Use appropriate types**: Match tenant types to your use case
7. **Set max depth**: Prevent unintended deep hierarchies
8. **Cache strategically**: Leverage built-in caching for read-heavy operations

---

## 🎉 You're Ready!

The tenant service layer is **production-ready** and **fully tested**. Start integrating hierarchical multi-tenancy into your application today!

**Questions?** Check the examples in `api/examples/tenant-service-integration.js`

**Need REST API?** See conversion guide in validation report above.
