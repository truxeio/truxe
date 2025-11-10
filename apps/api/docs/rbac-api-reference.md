# RBAC System API Reference

## Table of Contents

1. [AuthorizationService](#authorizationservice)
2. [PermissionService](#permissionservice)
3. [PolicyEngine](#policyengine)
4. [RoleService](#roleservice)
5. [ResourceRegistry](#resourceregistry)
6. [PermissionCacheManager](#permissioncachemanager)
7. [Middleware Functions](#middleware-functions)
8. [Type Definitions](#type-definitions)

## AuthorizationService

High-level authorization orchestration service that combines RBAC and ABAC.

### Constructor

```javascript
new AuthorizationService(permissionService, policyEngine, roleService, resourceRegistry, database, auditLogger, cache)
```

### Methods

#### `authorize(userId, tenantId, resource, action, resourceId?, context?)`

Main authorization method that evaluates permissions and policies.

**Parameters:**
- `userId` (string): User identifier
- `tenantId` (string): Tenant identifier  
- `resource` (string): Resource type
- `action` (string): Action to check
- `resourceId` (string, optional): Specific resource ID
- `context` (AuthContext, optional): Request context

**Returns:** `Promise<AuthorizationResult>`

**Example:**
```javascript
const result = await authService.authorize(
  'user-123',
  'tenant-456', 
  'documents',
  'read',
  'doc-789',
  { ipAddress: '192.168.1.1', timestamp: new Date() }
)
```

#### `getPermissionMatrix(userId, tenantId)`

Generate comprehensive permission matrix for user.

**Returns:** `Promise<PermissionMatrix>`

#### `resolveInheritedAccess(userId, tenantId, resource, action)`

Resolve access through tenant hierarchy inheritance.

**Returns:** `Promise<InheritedAccessResult>`

#### `healthCheck()`

Check health status of authorization system.

**Returns:** `Promise<HealthCheckResult>`

---

## PermissionService

Core service for managing user permissions.

### Constructor

```javascript
new PermissionService(database, auditLogger?, cache?, resourceRegistry?)
```

### Methods

#### `grantPermission(userId, tenantId, resource, actions, options?)`

Grant permissions to a user.

**Parameters:**
- `userId` (string): User identifier
- `tenantId` (string): Tenant identifier
- `resource` (string): Resource type
- `actions` (string[]): Array of actions to grant
- `options` (PermissionOptions, optional): Additional options

**Options:**
```typescript
{
  grantedBy?: string,
  expiresAt?: Date,
  conditions?: object,
  blockInheritance?: boolean
}
```

**Returns:** `Promise<Permission>`

#### `grantPermissionWithConditions(userId, tenantId, resource, actions, conditions)`

Grant permissions with ABAC conditions.

**Returns:** `Promise<Permission>`

#### `grantPermissionWithExpiry(userId, tenantId, resource, actions, expiresAt)`

Grant temporary permissions with expiration.

**Returns:** `Promise<Permission>`

#### `revokePermission(userId, tenantId, resource, actions, revokedBy)`

Revoke specific actions from user permission.

**Returns:** `Promise<RevocationResult>`

#### `hasPermission(userId, tenantId, resource, action, resourceId?, context?)`

Check if user has specific permission.

**Returns:** `Promise<PermissionCheckResult>`

#### `getEffectivePermissions(userId, tenantId, includeInherited?)`

Get all effective permissions for user in tenant.

**Returns:** `Promise<Permission[]>`

#### `getInheritedPermissions(userId, tenantId)`

Get permissions inherited from parent tenants.

**Returns:** `Promise<InheritedPermission[]>`

#### `bulkGrantPermissions(grants, grantedBy)`

Grant multiple permissions in single transaction.

**Parameters:**
- `grants` (PermissionGrant[]): Array of permission grants
- `grantedBy` (string): User granting permissions

**Returns:** `Promise<BulkOperationResult>`

#### `bulkRevokePermissions(revocations, revokedBy)`

Revoke multiple permissions in single transaction.

**Returns:** `Promise<BulkOperationResult>`

---

## PolicyEngine

ABAC policy management and evaluation engine.

### Constructor

```javascript
new PolicyEngine(database, auditLogger?, cache?)
```

### Methods

#### `createPolicy(policyData)`

Create new ABAC policy.

**Parameters:**
```typescript
{
  name: string,
  tenantId: string,
  conditions: PolicyConditions,
  effect: 'allow' | 'deny',
  resources: string[],
  actions: string[],
  priority?: number,
  enabled?: boolean
}
```

**Returns:** `Promise<Policy>`

#### `updatePolicy(policyId, updates)`

Update existing policy.

**Returns:** `Promise<Policy>`

#### `deletePolicy(policyId, deletedBy)`

Delete policy (soft delete).

**Returns:** `Promise<void>`

#### `evaluatePolicy(policyId, context)`

Evaluate policy against context.

**Returns:** `Promise<PolicyEvaluationResult>`

#### `evaluatePoliciesForResource(tenantId, resource, action, context)`

Evaluate all policies for resource/action.

**Returns:** `Promise<PolicyEvaluationResult[]>`

#### `listPolicies(tenantId, filters?)`

List policies for tenant with optional filters.

**Returns:** `Promise<Policy[]>`

### Condition Evaluators

#### Time-based Conditions

```javascript
{
  timeRange: {
    start: '09:00',        // Start time (HH:mm)
    end: '17:00',          // End time (HH:mm)
    timezone: 'UTC',       // Timezone
    daysOfWeek: [1,2,3,4,5] // Days (1=Monday, 7=Sunday)
  }
}
```

#### IP-based Conditions

```javascript
{
  ipWhitelist: ['192.168.1.0/24'],
  ipBlacklist: ['203.0.113.0/24']
}
```

#### Attribute-based Conditions

```javascript
{
  userAttributes: {
    department: 'engineering',
    clearanceLevel: { gte: 3 }
  },
  resourceAttributes: {
    classification: 'public'
  }
}
```

---

## RoleService

Role management service for RBAC.

### Constructor

```javascript
new RoleService(database, auditLogger?, cache?)
```

### Methods

#### `createRole(roleData)`

Create custom role.

**Parameters:**
```typescript
{
  name: string,
  tenantId: string,
  permissions: string[],
  inheritsFrom?: string[],
  description?: string
}
```

**Returns:** `Promise<Role>`

#### `updateRole(roleId, updates)`

Update role definition.

**Returns:** `Promise<Role>`

#### `deleteRole(roleId, deletedBy)`

Delete custom role.

**Returns:** `Promise<void>`

#### `assignRole(userId, tenantId, roleName, assignedBy)`

Assign role to user.

**Returns:** `Promise<RoleAssignment>`

#### `revokeRole(userId, tenantId, roleName, revokedBy)`

Revoke role from user.

**Returns:** `Promise<void>`

#### `getUserRoles(userId, tenantId)`

Get user's roles in tenant.

**Returns:** `Promise<Role[]>`

#### `getRolePermissions(roleName, tenantId?)`

Get permissions for role.

**Returns:** `Promise<string[]>`

---

## ResourceRegistry

Resource type management and validation.

### Constructor

```javascript
new ResourceRegistry()
```

### Methods

#### `registerResourceType(resourceType, definition)`

Register new resource type.

**Parameters:**
```typescript
{
  actions: string[],
  inheritanceRules?: { [action: string]: string[] },
  validationRules?: object,
  description?: string
}
```

#### `validatePermission(resource, action)`

Validate resource/action combination.

**Returns:** `boolean`

#### `getResourceActions(resource)`

Get available actions for resource.

**Returns:** `string[]`

#### `resolveResource(resource, resourceId?, context?)`

Resolve resource with context.

**Returns:** `ResolvedResource`

---

## PermissionCacheManager

Multi-strategy caching for permissions.

### Constructor

```javascript
new PermissionCacheManager(strategy, config?)
```

### Strategies

- `'memory'`: In-memory LRU cache
- `'redis'`: Redis-based cache
- `'hybrid'`: Memory + Redis combination

### Methods

#### `get(key)`

Get cached value.

**Returns:** `Promise<any>`

#### `set(key, value, ttl?)`

Set cached value.

**Returns:** `Promise<void>`

#### `del(key)`

Delete cached value.

**Returns:** `Promise<void>`

#### `invalidatePattern(pattern)`

Invalidate cache entries matching pattern.

**Returns:** `Promise<void>`

#### `getStats()`

Get cache statistics.

**Returns:** `CacheStats`

---

## Middleware Functions

Fastify middleware for request authorization.

### `requirePermission(resource, action, options?)`

Middleware to require specific permission.

**Parameters:**
- `resource` (string): Resource type
- `action` (string): Required action
- `options` (object, optional): Middleware options

**Options:**
```typescript
{
  resourceIdParam?: string,    // Request param for resource ID
  skipIfOwner?: boolean,       // Skip check if user is owner
  customContext?: (req) => object // Custom context provider
}
```

**Example:**
```javascript
fastify.get('/api/documents/:id', {
  preHandler: requirePermission('documents', 'read', {
    resourceIdParam: 'id'
  })
}, handler)
```

### `requireRole(role, options?)`

Middleware to require specific role.

**Parameters:**
- `role` (string): Required role name
- `options` (object, optional): Middleware options

**Example:**
```javascript
fastify.post('/api/tenants', {
  preHandler: requireRole('admin')
}, handler)
```

### `requireAnyPermission(permissions)`

Middleware to require any of multiple permissions.

**Parameters:**
- `permissions` (Array<{resource: string, action: string}>): Permission alternatives

### `requireAllPermissions(permissions)`

Middleware to require all specified permissions.

### Common Middleware Presets

```javascript
import { commonMiddleware } from '@/middleware/rbac.js'

// Pre-configured middleware
fastify.get('/api/admin/*', {
  preHandler: commonMiddleware.adminOnly
}, handler)

fastify.get('/api/tenants/:tenantId/*', {
  preHandler: commonMiddleware.tenantMember
}, handler)
```

---

## Type Definitions

### AuthorizationResult

```typescript
{
  allowed: boolean,
  source: 'direct' | 'inherited' | 'role' | 'policy' | 'error',
  reason: string,
  sourceTenantId?: string,
  policy?: PolicyEvaluationResult,
  context?: {
    evaluationTime: number,
    requestId?: string,
    [key: string]: any
  }
}
```

### Permission

```typescript
{
  id: string,
  userId: string,
  tenantId: string,
  resourceType: string,
  resourceId?: string,
  actions: string[],
  conditions: object,
  grantedBy?: string,
  expiresAt?: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Policy

```typescript
{
  id: string,
  name: string,
  tenantId: string,
  conditions: PolicyConditions,
  effect: 'allow' | 'deny',
  resources: string[],
  actions: string[],
  priority: number,
  enabled: boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### PolicyEvaluationResult

```typescript
{
  policy: Policy,
  result: boolean,
  reason: string,
  evaluatedConditions: { [key: string]: boolean },
  evaluationTime: number
}
```

### PermissionMatrix

```typescript
{
  userId: string,
  tenantId: string,
  permissions: {
    [resource: string]: {
      [action: string]: boolean
    }
  },
  inheritedFrom: Array<{
    tenantId: string,
    permissions: object
  }>,
  summary: {
    totalPermissions: number,
    directPermissions: number,
    inheritedPermissions: number
  }
}
```

### AuthContext

```typescript
{
  timestamp?: Date,
  ipAddress?: string,
  userAgent?: string,
  requestId?: string,
  sessionId?: string,
  [key: string]: any
}
```

### HealthCheckResult

```typescript
{
  database: 'healthy' | 'unhealthy',
  cache: 'healthy' | 'unhealthy' | 'unknown',
  resourceRegistry?: {
    status: 'healthy' | 'unhealthy',
    registeredTypes: number
  },
  status: 'operational' | 'degraded' | 'failing',
  error?: string
}
```

---

## Error Handling

All methods throw descriptive errors that can be caught and handled:

```javascript
try {
  await authService.authorize(userId, tenantId, resource, action)
} catch (error) {
  if (error.name === 'PermissionDeniedError') {
    // Handle permission denied
  } else if (error.name === 'ValidationError') {
    // Handle validation error
  } else {
    // Handle other errors
  }
}
```

### Common Error Types

- `PermissionDeniedError`: Access denied
- `ValidationError`: Invalid input parameters
- `NotFoundError`: Resource not found
- `PolicyEvaluationError`: Policy evaluation failed
- `CacheError`: Cache operation failed
- `DatabaseError`: Database operation failed

For detailed examples and usage patterns, refer to the test suites and main documentation.