---
title: Tenant Hierarchy Service
description: Service-layer architecture for hierarchical tenant management in Truxe.
---

# Tenant Hierarchy Service

## Overview

The Tenant Hierarchy Service provides the core business layer for Truxe's nested multi-tenancy model.
It sits between the PostgreSQL schema (Migration 030) and the API layer (Ticket #4B) and exposes
high-level primitives for creating, navigating, and maintaining hierarchical tenant structures.

> **Key Capabilities**
>
> - Multi-level tenant CRUD with hierarchy enforcement
> - Materialized path traversal and analysis helpers
> - Lifecycle workflows (archive, restore, move, merge, duplicate)
> - Member and permission orchestration with RBAC safeguards
> - Validation and business-rule enforcement backed by Zod schemas
> - Transaction-safe operations with audit logging and caching

The service layer is organized as a collection of focused modules that share the `TenantRepository`
abstraction to communicate with PostgreSQL. Each module is written in Node.js (ESM) and designed to be
composable through dependency injection, making it straightforward to substitute mocks in unit tests.

```
api/src/services/tenant/
├── config.js                 # Shared configuration constants
├── index.js                  # TenantService orchestrator (CRUD & façade)
├── repository.js             # PostgreSQL abstraction & transaction helpers
├── validation.js             # Zod-backed validation & permission checks
├── hierarchy.js              # Parent/child traversal and analytics
├── path.js                   # Materialized path queries & maintenance
├── lifecycle.js              # Archive/restore/move/merge/copy operations
├── members.js                # Tenant member & permission workflows
└── utils/
    ├── cache-manager.js      # TTL cache for hot paths
    ├── path-formatter.js     # Path display helpers
    └── slug-generator.js     # Slug normalization utilities
```

## Database Assumptions

All modules assume migration `030_nested_tenancy_schema.sql` has been applied. Specifically:

- `tenants` table contains `parent_tenant_id`, `level`, `path`, `max_depth`, and RLS policies.
- `tenant_members` table tracks role-based membership with `joined_at` semantics.
- `permissions` table stores resource-specific permissions.
- Materialized view `user_tenant_access` exists for permission lookups.
- Triggers (`tenant_path_trigger`, `tenant_circular_check_trigger`) maintain path and guard against loops.

## Shared Repository Layer

`TenantRepository` encapsulates database access:

- Ensures `SET LOCAL statement_timeout` for every transaction (default 5 seconds).
- Applies `SET LOCAL app.current_user_id` when `userId` is provided to honor RLS policies.
- Provides `transaction`, `beginTransaction`, `commit`, and `rollback` helpers.
- Normalizes tenant rows to camelCase (via `mapTenant`) and exposes filter/aggregation helpers.

> **Usage Example**
>
> ```js
> const repository = new TenantRepository()
> const tenant = await repository.findById(tenantId, { userId })
> ```

## TenantService (api/src/services/tenant/index.js)

The façade that API controllers interact with. Responsibilities include:

- Root & child tenant creation (`createRootTenant`, `createChildTenant`, `createTenant`).
- Tenant reads (`getTenantById`, `getTenantBySlug`, `listTenants`, `searchTenants`).
- Updates (`updateTenant`, `updateTenantSettings`, `moveTenant`).
- Lifecycle hooks (`deleteTenant`, `archiveTenant`, `restoreTenant`).
- Permission checks, slug generation, and audit logging.

Internally it composes `TenantValidationService`, `HierarchyService`, `PathService`, `TenantLifecycleService`,
and `TenantMemberService`. All create/update operations run inside repository transactions; audit events are
recorded through `AuditLoggerService`.

### Common Patterns

```js
const tenantService = new TenantService()

// Create workspace root
const workspace = await tenantService.createRootTenant({
  name: 'Apollo Federation',
  tenantType: 'workspace',
  settings: { ssoEnforced: true },
}, ownerId)

// Create child team
await tenantService.createChildTenant(workspace.id, {
  name: 'Platform Team',
  tenantType: 'team',
}, ownerId)

// List descendants
const hierarchy = await tenantService.getTenantById(workspace.id, ownerId)
console.log(hierarchy.children.length) // -> 1
```

> **Error Handling**
>
> All validation errors throw `TenantValidationError` with `code` and `details`. API handlers should map
> to HTTP 4xx responses:
>
> ```js
> try {
>   await tenantService.updateTenant(tenantId, payload, userId)
> } catch (error) {
>   if (error instanceof TenantValidationError) {
>     reply.code(400).send({ message: error.message, code: error.code, details: error.details })
>     return
>   }
>   throw error
> }
> ```

## Validation Layer (validation.js)

Key validation routines:

- **Schema validation**: Names, slugs, settings, metadata via Zod.
- **Hierarchy constraints**: Maximum depth, circular references, children limits.
- **Permission checks**: `canCreateTenant`, `canUpdateTenant`, `canDeleteTenant`, `canMoveTenant`.
- **Business rules**: Naming conventions, tenant quotas, move validation.

All expensive checks leverage the repository and are cached for 60 seconds when appropriate (e.g., role checks,
children counts). Validation helpers are reusable outside the service (e.g., from Fastify preHandlers).

## Hierarchy Navigation (hierarchy.js)

`HierarchyService` exposes read-heavy helpers optimized for materialized path operations:

- `getParent`, `getChildren`, `getSiblings`, `getRoot`
- `getAncestors`, `getDescendants`, `getAncestorChain`
- `getLevel`, `getDepth`, `getTenantCount`
- Relationship tests: `isAncestor`, `isDescendant`
- Bulk structure retrieval: `getMultipleTenantTrees`, `getFullHierarchy`

Results are cached (default 120s) through `CacheManager` to drive <50ms traversal SLA.

```js
const hierarchyService = new HierarchyService()
const descendants = await hierarchyService.getDescendants(rootId, 3)
```

## Path Queries (path.js)

`PathService` delivers materialized path operations:

- Pattern lookups with wildcards (`getTenantsByPath`)
- Depth searches & subtree filters (`searchByPathDepth`, `findInSubtree`)
- Relationship helpers (`getCommonAncestor`, `getRelationship`, `getTenantDistance`)
- Path maintenance (`validatePaths`, `rebuildPaths`)
- Formatting utilities (`getPathString`)

Rebuild operations are transaction-safe and recompute path/level for entire subtrees, ensuring recovery from
unexpected inconsistencies (e.g., manual DB edits).

## Lifecycle Management (lifecycle.js)

Handles complex operations with transactional safety:

- Archive/restore individual tenants or entire subtrees.
- Move tenants or subtrees with depth validation.
- Merge tenants (members, permissions, child reassignment).
- Copy/duplicate tenants and subtrees (with optional settings cloning).
- Convert tenants to root and adjust `max_depth`.

All operations leverage `AuditLoggerService` for audit trails and re-use validation/membership services to ensure
RBAC and business rules are respected.

## Membership Management (members.js)

- Owner/admin membership enforcement (no last-owner removal).
- Bulk member invitations & acceptance flows.
- Permission inheritance and propagation across subtrees.
- Ownership transfer and role upgrades with transactional safety.

`TenantMemberService` integrates with the existing `users`, `tenant_members`, and `permissions` tables and emits
audit events (`tenant.member.*`).

## Utilities

- **Slug generator** (`utils/slug-generator.js`): Normalizes names, enforces length, appends randomness.
- **Path formatter** (`utils/path-formatter.js`): Renders `"root > workspace > team"` strings and computes path distance.
- **Cache manager** (`utils/cache-manager.js`): TTL-based memoization for hot lookups to maintain <10ms permission checks.

## Configuration

`config.js` centralizes service defaults:

| Constant | Description | Default |
|----------|-------------|---------|
| `MAX_TENANT_DEPTH` | Maximum depth allowed for tenant trees | `5` |
| `MAX_CHILDREN_PER_TENANT` | Optional children cap per parent | `100` |
| `TENANT_TYPES` | Supported types (workspace, team, project, etc.) | array |
| `MEMBER_ROLES` | Roles used in RBAC validation | array |
| `CACHE_TTL` | Seconds for cache expiration | `300` |
| `QUERY_TIMEOUT` | Statement timeout enforced per query | `5000 ms` |

Override defaults by importing config constants or wrapping services with custom parameters.

## Testing Strategy

- Unit tests (`api/tests/unit`) mock the repository and validate service behaviour without a database.
- Integration tests (`api/tests/integration`) verify coordination between services using shared mocks.
- Performance tests (`api/tests/performance`) exercise caching and guard against redundant queries.

Run Jest suites from the API package:

```bash
cd api
npm run test:jest -- tests/unit/tenant-service.test.js
```

> **Note:** To execute database-backed tests, ensure a Postgres instance with migration 030 applied and update
> `DATABASE_URL` / `config.database.testUrl`.

## Operational Guidelines

- **Transactions:** Always use `TenantRepository.transaction` for multi-step operations to avoid partial writes.
- **User Context:** Pass `userId` to repository methods to leverage RLS policies (`SET app.current_user_id`).
- **Caching:** Invalidate caches (`cache.delete`) when mutating operations occur (e.g., membership changes).
- **Audit Logging:** Provide contextual `details` payloads when invoking lifecycle/member operations.
- **Error Codes:** Bubble `TenantValidationError.code` through API responses to keep clients actionable.

## Migration Notes

For projects migrating from flat organizations:

1. Migrate existing organizations into the `tenants` table (root level).
2. Populate `tenant_members` using existing memberships.
3. Rebuild materialized view `user_tenant_access`.
4. Wire API routes to `TenantService` and dependent modules.

Refer to `README-nested-tenancy.md` for SQL examples and migration recipes.

## Future Enhancements

- Redis-backed cache manager for distributed deployments.
- Background job to refresh `user_tenant_access` via `cron`.
- Batch copy/move endpoints exposed through the API layer.
- Tenant analytics module consuming `TenantRepository.getStatistics`.

---

For implementation guidance or further questions, reach out to the Backend/Database guild (#dev-backend-db).
