/**
 * RBAC + ABAC Configuration
 * 
 * Centralized configuration for Role-Based Access Control (RBAC) and
 * Attribute-Based Access Control (ABAC) systems.
 */

export const RBAC_CONFIG = {
  // Permission settings
  DEFAULT_PERMISSION_TTL: 3600, // seconds
  MAX_PERMISSION_EXPIRY: 365 * 24 * 3600, // 1 year
  PERMISSION_CACHE_TTL: 300, // 5 minutes
  
  // Policy settings
  POLICY_EVALUATION_TIMEOUT: 1000, // ms
  MAX_POLICIES_PER_TENANT: 100,
  ENABLE_POLICY_CACHING: true,
  
  // Performance
  BATCH_GRANT_SIZE: 50,
  CACHE_STRATEGY: 'memory', // 'memory' | 'redis' | 'hybrid'
  ENABLE_MATERIALIZED_VIEW: true,
  
  // Default roles
  DEFAULT_ROLES: ['owner', 'admin', 'member', 'viewer', 'guest'],
  IMMUTABLE_ROLES: ['owner', 'admin'],
  
  // Inheritance
  ENABLE_HIERARCHICAL_INHERITANCE: true,
  INHERIT_FROM_PARENTS: true,
  MAX_INHERITANCE_DEPTH: 5
}

/**
 * Default role definitions with permissions
 */
export const DEFAULT_ROLES = {
  owner: {
    permissions: ['*:*'], // All actions on all resources
    description: 'Full control over tenant',
    immutable: true,
    priority: 100
  },
  admin: {
    permissions: [
      'tenants:read,update',
      'members:*',
      'permissions:grant,revoke',
      'resources:*',
      'integrations:*',
      'projects:*',
      'settings:read,write'
    ],
    description: 'Administrative access',
    immutable: true,
    priority: 90
  },
  member: {
    permissions: [
      'tenants:read',
      'members:read',
      'resources:read,write',
      'integrations:read,write',
      'projects:read,write',
      'settings:read'
    ],
    description: 'Standard member access',
    priority: 50
  },
  viewer: {
    permissions: [
      'tenants:read',
      'members:read',
      'resources:read',
      'integrations:read',
      'projects:read',
      'settings:read'
    ],
    description: 'Read-only access',
    priority: 30
  },
  guest: {
    permissions: [
      'resources:read',
      'projects:read'
    ],
    description: 'Limited guest access',
    expiryDays: 7,
    priority: 10
  }
}

/**
 * Built-in resource types and their available actions
 */
export const RESOURCE_TYPES = {
  tenants: {
    actions: ['read', 'write', 'delete', 'admin', 'create'],
    attributes: ['level', 'type', 'status', 'owner'],
    hierarchical: true,
    inheritable: true,
    description: 'Tenant management'
  },
  members: {
    actions: ['read', 'write', 'invite', 'remove', 'manage'],
    attributes: ['role', 'status', 'joinedAt'],
    hierarchical: true,
    inheritable: true,
    description: 'Member management'
  },
  permissions: {
    actions: ['read', 'write', 'grant', 'revoke', 'admin'],
    attributes: ['resource', 'action', 'grantedBy'],
    hierarchical: true,
    inheritable: false,
    description: 'Permission management'
  },
  documents: {
    actions: ['read', 'write', 'delete', 'share', 'admin'],
    attributes: ['classification', 'department', 'createdBy', 'size'],
    hierarchical: true,
    inheritable: true,
    description: 'Document resources'
  },
  files: {
    actions: ['read', 'write', 'delete', 'share', 'upload'],
    attributes: ['type', 'size', 'createdBy', 'classification'],
    hierarchical: true,
    inheritable: true,
    description: 'File resources'
  },
  projects: {
    actions: ['read', 'write', 'delete', 'admin', 'create', 'manage'],
    attributes: ['status', 'owner', 'department', 'priority'],
    hierarchical: true,
    inheritable: true,
    description: 'Project resources'
  },
  integrations: {
    actions: ['read', 'write', 'delete', 'admin', 'create', 'configure'],
    attributes: ['type', 'status', 'provider', 'owner'],
    hierarchical: true,
    inheritable: true,
    description: 'Integration management'
  },
  settings: {
    actions: ['read', 'write', 'admin'],
    attributes: ['category', 'scope', 'visibility'],
    hierarchical: true,
    inheritable: false,
    description: 'Settings management'
  }
}

/**
 * ABAC condition operators for policy evaluation
 */
export const CONDITION_OPERATORS = {
  // Equality
  eq: (value, expected) => value === expected,
  ne: (value, expected) => value !== expected,
  
  // Array operations
  in: (value, expected) => Array.isArray(expected) && expected.includes(value),
  notIn: (value, expected) => Array.isArray(expected) && !expected.includes(value),
  
  // Comparison
  gt: (value, expected) => value > expected,
  gte: (value, expected) => value >= expected,
  lt: (value, expected) => value < expected,
  lte: (value, expected) => value <= expected,
  
  // String operations
  contains: (value, expected) => String(value).includes(String(expected)),
  startsWith: (value, expected) => String(value).startsWith(String(expected)),
  endsWith: (value, expected) => String(value).endsWith(String(expected)),
  matches: (value, expected) => new RegExp(expected).test(String(value)),
  
  // Time operations
  between: (value, expected) => {
    if (!Array.isArray(expected) || expected.length !== 2) return false;
    const [start, end] = expected;
    return value >= start && value <= end;
  }
}

/**
 * Permission action hierarchies
 * Higher-level actions include lower-level ones
 */
export const ACTION_HIERARCHY = {
  admin: ['manage', 'write', 'read'],
  manage: ['write', 'read'],
  write: ['read'],
  delete: [], // Special action, doesn't inherit
  share: [], // Special action, doesn't inherit
  invite: [], // Special action, doesn't inherit
  revoke: [], // Special action, doesn't inherit
  grant: [], // Special action, doesn't inherit
  configure: ['write', 'read'], // For integrations
  upload: ['write'] // For files
}

/**
 * Cache key patterns for different permission types
 */
export const CACHE_KEYS = {
  PERMISSION_CHECK: 'perm:check:{userId}:{tenantId}:{resource}:{action}',
  USER_PERMISSIONS: 'perm:user:{userId}:tenant:{tenantId}',
  EFFECTIVE_PERMISSIONS: 'perm:user:{userId}:effective',
  TENANT_PERMISSIONS: 'perm:tenant:{tenantId}:all',
  POLICY: 'policy:{tenantId}:{policyId}',
  ROLE_PERMISSIONS: 'role:{tenantId}:{role}',
  INHERITANCE: 'inherit:{userId}:{tenantId}',
  MATRIX: 'matrix:{userId}:{tenantId}'
}

/**
 * Audit event types for permission operations
 */
export const AUDIT_EVENTS = {
  PERMISSION_GRANTED: 'permission.granted',
  PERMISSION_REVOKED: 'permission.revoked',
  PERMISSION_CHECKED: 'permission.checked',
  POLICY_CREATED: 'policy.created',
  POLICY_UPDATED: 'policy.updated',
  POLICY_DELETED: 'policy.deleted',
  ROLE_ASSIGNED: 'role.assigned',
  ROLE_REMOVED: 'role.removed',
  ACCESS_DENIED: 'access.denied',
  ACCESS_GRANTED: 'access.granted'
}

/**
 * Error codes for RBAC operations
 */
export const ERROR_CODES = {
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  INVALID_RESOURCE: 'INVALID_RESOURCE',
  INVALID_ACTION: 'INVALID_ACTION',
  INVALID_ROLE: 'INVALID_ROLE',
  POLICY_EVALUATION_FAILED: 'POLICY_EVALUATION_FAILED',
  CACHE_ERROR: 'CACHE_ERROR',
  INHERITANCE_DEPTH_EXCEEDED: 'INHERITANCE_DEPTH_EXCEEDED',
  BULK_OPERATION_FAILED: 'BULK_OPERATION_FAILED',
  CONDITION_EVALUATION_ERROR: 'CONDITION_EVALUATION_ERROR'
}

export default {
  RBAC_CONFIG,
  DEFAULT_ROLES,
  RESOURCE_TYPES,
  CONDITION_OPERATORS,
  ACTION_HIERARCHY,
  CACHE_KEYS,
  AUDIT_EVENTS,
  ERROR_CODES
}