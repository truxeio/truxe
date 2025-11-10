# RBAC + ABAC Engine Implementation

## Overview

This comprehensive Role-Based Access Control (RBAC) and Attribute-Based Access Control (ABAC) engine provides enterprise-grade authorization capabilities for multi-tenant applications. The system combines traditional role-based permissions with dynamic attribute-based policies for flexible, scalable access control.

## Architecture

### Core Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Authorization   │    │ Permission      │    │ Policy          │
│ Service         │◄──►│ Service         │◄──►│ Engine          │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Cache Manager   │    │ Resource        │    │ Role Service    │
│                 │    │ Registry        │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Key Features

- **Hierarchical Permissions**: Tenant-based inheritance with materialized paths
- **Dynamic Policies**: Time-based, IP-based, and attribute-based conditions
- **Multi-Strategy Caching**: Memory, Redis, and hybrid caching for performance
- **Audit Logging**: Comprehensive access control decision tracking
- **API Middleware**: Seamless Fastify integration with request authorization
- **Bulk Operations**: Efficient batch permission management

## Quick Start

### 1. Installation

The RBAC system is already integrated into the Truxe API. No additional installation required.

### 2. Basic Usage

```javascript
import { AuthorizationService } from '@/services/rbac/authorization-service.js'

// Initialize authorization service
const authService = new AuthorizationService()

// Check user permission
const result = await authService.authorize(
  'user-123',          // User ID
  'tenant-456',        // Tenant ID
  'documents',         // Resource type
  'read',              // Action
  'doc-789',           // Resource ID (optional)
  { ipAddress: '192.168.1.1' } // Context (optional)
)

if (result.allowed) {
  console.log('Access granted:', result.reason)
} else {
  console.log('Access denied:', result.reason)
}
```

### 3. API Middleware

```javascript
import { requirePermission, requireRole } from '@/middleware/rbac.js'

// Protect route with permission check
fastify.get('/api/documents/:id', {
  preHandler: requirePermission('documents', 'read')
}, async (request, reply) => {
  // Handler code - user is authorized
})

// Protect route with role check
fastify.post('/api/tenants', {
  preHandler: requireRole('admin')
}, async (request, reply) => {
  // Handler code - user has admin role
})
```

## API Reference

### AuthorizationService

#### `authorize(userId, tenantId, resource, action, resourceId?, context?)`

Main authorization method that combines RBAC and ABAC evaluation.

**Parameters:**
- `userId` (string): User identifier
- `tenantId` (string): Tenant identifier
- `resource` (string): Resource type (e.g., 'documents', 'projects')
- `action` (string): Action to perform (e.g., 'read', 'write', 'delete')
- `resourceId` (string, optional): Specific resource identifier
- `context` (object, optional): Request context for policy evaluation

**Returns:**
```typescript
{
  allowed: boolean,
  source: 'direct' | 'inherited' | 'role' | 'policy' | 'error',
  reason: string,
  sourceTenantId?: string,
  policy?: PolicyEvaluationResult,
  context?: EvaluationContext
}
```

#### `getPermissionMatrix(userId, tenantId)`

Generate comprehensive permission matrix for a user in a tenant.

**Returns:**
```typescript
{
  userId: string,
  tenantId: string,
  permissions: { [resource: string]: { [action: string]: boolean } },
  inheritedFrom: Array<{ tenantId: string, permissions: object }>,
  summary: {
    totalPermissions: number,
    directPermissions: number,
    inheritedPermissions: number
  }
}
```

### PermissionService

#### `grantPermission(userId, tenantId, resource, actions, options?)`

Grant permissions to a user for a specific resource.

**Parameters:**
- `actions` (string[]): Array of actions to grant
- `options` (object, optional): Additional options
  - `grantedBy` (string): ID of user granting permission
  - `expiresAt` (Date): Expiration date
  - `conditions` (object): ABAC conditions

#### `revokePermission(userId, tenantId, resource, actions, revokedBy)`

Revoke specific actions from a user's permission.

#### `hasPermission(userId, tenantId, resource, action, resourceId?, context?)`

Check if user has a specific permission.

### PolicyEngine

#### `createPolicy(policyData)`

Create a new ABAC policy.

**Example:**
```javascript
await policyEngine.createPolicy({
  name: 'business-hours-access',
  tenantId: 'tenant-123',
  conditions: {
    timeRange: {
      start: '09:00',
      end: '17:00',
      timezone: 'UTC',
      daysOfWeek: [1, 2, 3, 4, 5] // Monday-Friday
    }
  },
  effect: 'allow',
  resources: ['documents'],
  actions: ['read', 'write']
})
```

#### `evaluatePolicy(policyId, context)`

Evaluate a policy against given context.

## Configuration

### Environment Variables

```bash
# Database configuration
DATABASE_URL=postgresql://user:pass@localhost:5432/truxe
REDIS_URL=redis://localhost:6379

# RBAC configuration
RBAC_CACHE_TTL=300
RBAC_ENABLE_AUDIT=true
RBAC_DEFAULT_CACHE_STRATEGY=hybrid

# Performance tuning
RBAC_MAX_INHERITANCE_DEPTH=10
RBAC_BULK_OPERATION_LIMIT=50
```

### RBAC Configuration

The system uses a centralized configuration in `/src/services/rbac/config.js`:

```javascript
export const RBAC_CONFIG = {
  cache: {
    defaultTTL: 300,
    strategies: ['memory', 'redis', 'hybrid'],
    maxSize: 10000
  },
  audit: {
    enabled: true,
    retention: 90
  },
  performance: {
    maxInheritanceDepth: 10,
    bulkOperationLimit: 50
  }
}
```

## Resource Types

### Built-in Resources

- **tenants**: Tenant management
- **members**: Member management
- **permissions**: Permission management
- **documents**: Document access
- **files**: File operations
- **projects**: Project management
- **integrations**: Integration management
- **settings**: System settings

### Custom Resources

Register custom resource types:

```javascript
import { ResourceRegistry } from '@/services/rbac/resource-registry.js'

const registry = new ResourceRegistry()

registry.registerResourceType('custom-resource', {
  actions: ['read', 'write', 'admin'],
  inheritanceRules: {
    'read': [],
    'write': ['read'],
    'admin': ['read', 'write']
  }
})
```

## Default Roles

### System Roles

- **owner**: Full access to tenant and all resources
- **admin**: Administrative access excluding ownership transfer
- **member**: Standard user access to assigned resources
- **viewer**: Read-only access to public resources
- **guest**: Limited access to public content

### Role Hierarchy

```
owner
├── admin
│   ├── member
│   │   ├── viewer
│   │   └── guest
```

## Condition Types

### Time-Based Conditions

```javascript
{
  timeRange: {
    start: '09:00',
    end: '17:00',
    timezone: 'UTC',
    daysOfWeek: [1, 2, 3, 4, 5]
  }
}
```

### IP-Based Conditions

```javascript
{
  ipWhitelist: ['192.168.1.0/24', '10.0.0.0/8'],
  ipBlacklist: ['203.0.113.0/24']
}
```

### Attribute-Based Conditions

```javascript
{
  userAttributes: {
    department: 'engineering',
    clearanceLevel: { gte: 3 }
  },
  resourceAttributes: {
    classification: 'public',
    project: { in: ['proj-1', 'proj-2'] }
  }
}
```

## Performance Optimization

### Caching Strategies

1. **Memory Cache**: Fastest, limited capacity
2. **Redis Cache**: Persistent, shared across instances
3. **Hybrid Cache**: Memory + Redis for optimal performance

### Database Optimization

- Indexed queries for permission lookups
- Materialized path for tenant hierarchy
- Bulk operations for batch permission management

### Performance Targets

- Permission check: < 10ms (cached: < 2ms)
- Permission grant: < 20ms
- Policy evaluation: < 15ms
- Bulk operations: < 2ms per operation

## Security Considerations

### Access Control

- All permission changes are audited
- Sensitive operations require elevated privileges
- Policy conditions are validated and sanitized

### Data Protection

- No sensitive data in cache keys
- Encrypted policy conditions in database
- Rate limiting on permission operations

### Audit Trail

Complete audit logging for:
- Permission grants and revocations
- Policy evaluations
- Authorization decisions
- Administrative actions

## Testing

### Running Tests

```bash
# Run all RBAC tests
npm run test:rbac

# Run specific test suites
npm run test:rbac:unit
npm run test:rbac:integration
npm run test:rbac:performance

# Run with coverage
npm run test:rbac -- --coverage

# Run in watch mode
npm run test:rbac -- --watch
```

### Test Coverage

Current test coverage:
- **Unit Tests**: 92% coverage across all services
- **Integration Tests**: End-to-end authorization workflows
- **Performance Tests**: Load testing and benchmarking

## Troubleshooting

### Common Issues

1. **Permission Denied Errors**
   - Check user has correct role or permission
   - Verify tenant hierarchy is correct
   - Ensure policies are not blocking access

2. **Performance Issues**
   - Enable caching if disabled
   - Check database query performance
   - Review policy complexity

3. **Cache Issues**
   - Verify Redis connection
   - Check cache TTL settings
   - Monitor cache hit rates

### Debug Mode

Enable debug logging:

```bash
DEBUG=rbac:* npm start
```

### Health Checks

Monitor system health:

```javascript
const health = await authService.healthCheck()
console.log('RBAC System Health:', health)
```

## Migration Guide

### From Legacy RBAC

1. Export existing permissions
2. Map to new resource types
3. Import using bulk operations
4. Test authorization flows
5. Update API middleware

### Database Schema

The system requires these tables:
- `permissions`: User permissions
- `policies`: ABAC policies
- `tenants`: Tenant hierarchy
- `users`: User information

## Best Practices

### Permission Design

- Use principle of least privilege
- Group related actions into logical roles
- Design for scalability and maintainability

### Policy Management

- Keep policies simple and testable
- Use descriptive names and documentation
- Regular review and cleanup of unused policies

### Performance

- Cache frequently accessed permissions
- Use bulk operations for batch changes
- Monitor and optimize slow queries

## Support

For questions or issues with the RBAC system:

1. Check this documentation
2. Review test cases for examples
3. Check system logs for errors
4. Contact the development team

---

*This documentation covers the comprehensive RBAC + ABAC engine implementation. For additional technical details, refer to the inline code documentation and test suites.*