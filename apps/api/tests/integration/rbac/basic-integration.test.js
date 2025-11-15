/**
 * RBAC System Integration Test
 * 
 * Basic integration test to verify RBAC system works with real database
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { testDatabase, setupTestData, cleanupTestData } from '../../helpers/test-database.js'

// Import RBAC services
import PermissionService from '../../../src/services/rbac/permission-service.js'
import RoleService from '../../../src/services/rbac/role-service.js'
import AuthorizationService from '../../../src/services/rbac/authorization-service.js'
import PolicyEngine from '../../../src/services/rbac/policy-engine.js'

describe('RBAC System Integration', () => {
  let permissionService
  let authService
  let policyEngine
  let roleService
  let testData

  beforeEach(async () => {
    // Mock audit logger for tests
    const mockAuditLogger = {
      logEvent: jest.fn(async (event) => {
        // Silent audit logging for tests
        return { id: 'mock-audit-id', ...event }
      }),
      logAuth: jest.fn(async (event) => ({ id: 'mock-auth-id' })),
      logAccess: jest.fn(async (event) => ({ id: 'mock-access-id' }))
    }
    
    // Mock cache service
    const mockCache = {
      get: jest.fn(async (key) => null),
      set: jest.fn(async (key, value, ttl) => true),
      setex: jest.fn(async (key, ttl, value) => true),
      delete: jest.fn(async (key) => true),
      del: jest.fn(async (key) => true),
      clear: jest.fn(async () => true),
      ping: jest.fn(async () => 'PONG')
    }
    
    // Initialize services with real database
    permissionService = new PermissionService(testDatabase, mockAuditLogger, mockCache)
    policyEngine = new PolicyEngine(testDatabase, mockAuditLogger, mockCache)
    roleService = new RoleService(testDatabase, mockAuditLogger, mockCache)
    authService = new AuthorizationService(
      testDatabase,
      mockAuditLogger,
      mockCache
    )

    // Setup test data
    testData = await setupTestData()
  })

  afterEach(async () => {
    await cleanupTestData(testData.testId)
  })

  describe('Basic Permission Management', () => {
    it('should grant and check permissions', async () => {
      const { users, tenants } = testData

      // Grant permission
      const permission = await permissionService.grantPermission(
        users.alice.id,
        tenants.child.id,
        'documents',
        ['read', 'write']
      )

      expect(permission).toBeDefined()
      expect(permission.userId).toBe(users.alice.id)
      expect(permission.tenantId).toBe(tenants.child.id)
      expect(permission.resourceType).toBe('documents')
      expect(permission.actions).toEqual(['read', 'write'])

      // Check permission
      const hasRead = await permissionService.hasPermission(
        users.alice.id,
        tenants.child.id,
        'documents',
        'read'
      )

      expect(hasRead.allowed).toBe(true)
      expect(hasRead.source).toBe('direct')

      const hasDelete = await permissionService.hasPermission(
        users.alice.id,
        tenants.child.id,
        'documents',
        'delete'
      )

      expect(hasDelete.allowed).toBe(false)
    })

    it('should handle hierarchical permissions', async () => {
      const { users, tenants } = testData

      // Grant permission at parent level
      await permissionService.grantPermission(
        users.alice.id,
        tenants.parent.id,
        'documents',
        ['read']
      )

      // Should be accessible in child tenant through inheritance
      const inherited = await permissionService.getInheritedPermissions(
        users.alice.id,
        tenants.child.id
      )

      expect(inherited).toHaveLength(1)
      expect(inherited[0].inherited).toBe(true)
      expect(inherited[0].sourceTenantId).toBe(tenants.parent.id)
    })
  })

  describe('Authorization Service', () => {
    it('should authorize with direct permissions', async () => {
      const { users, tenants } = testData

      // Grant permission
      await permissionService.grantPermission(
        users.alice.id,
        tenants.child.id,
        'projects',
        ['read', 'write']
      )

      // Test authorization
      const result = await authService.authorize(
        users.alice.id,
        tenants.child.id,
        'read',
        'projects'
      )

      expect(result.allowed).toBe(true)
      expect(result.source).toBe('direct')
    })

    it('should generate permission matrix', async () => {
      const { users, tenants } = testData

      // Grant multiple permissions
      await permissionService.grantPermission(
        users.alice.id,
        tenants.child.id,
        'documents',
        ['read', 'write']
      )

      await permissionService.grantPermission(
        users.alice.id,
        tenants.child.id,
        'projects',
        ['read']
      )

      // Get permission matrix
      const matrix = await authService.getPermissionMatrix(
        users.alice.id,
        tenants.child.id
      )

      expect(matrix.userId).toBe(users.alice.id)
      expect(matrix.tenantId).toBe(tenants.child.id)
      expect(matrix.permissions.documents.read).toBe(true)
      expect(matrix.permissions.documents.write).toBe(true)
      expect(matrix.permissions.projects.read).toBe(true)
      expect(matrix.summary.directPermissions).toBeGreaterThan(0)
    })
  })

  describe('Policy Engine', () => {
    it('should create and evaluate policies', async () => {
      const { tenants } = testData

      // Create time-based policy
      const policy = await policyEngine.createPolicy({
        name: 'business-hours-test',
        tenantId: tenants.child.id,
        conditions: {
          timeRange: {
            start: '09:00',
            end: '17:00',
            timezone: 'UTC'
          }
        },
        effect: 'allow',
        resources: ['documents'],
        actions: ['read']
      })

      expect(policy).toBeDefined()
      expect(policy.name).toBe('business-hours-test')
      expect(policy.effect).toBe('allow')

      // Evaluate policy during business hours
      const businessHoursContext = {
        timestamp: new Date('2024-01-15T10:00:00Z') // 10 AM UTC
      }

      const evaluation = await policyEngine.evaluatePolicy(
        policy.id,
        businessHoursContext
      )

      expect(evaluation.result).toBe(true)
      expect(evaluation.reason).toContain('time condition')
    })
  })

  describe('Role Management', () => {
    it('should work with default system roles', async () => {
      const { tenants } = testData

      // Get admin role permissions
      const adminPermissions = await roleService.getRolePermissions(
        'admin',
        tenants.child.id
      )

      expect(adminPermissions).toBeDefined()
      expect(adminPermissions.length).toBeGreaterThan(0)
      expect(adminPermissions).toContain('members:admin')
    })

    it('should assign and check user roles', async () => {
      const { users, tenants } = testData

      // Assign admin role
      await roleService.assignRole(
        users.alice.id,
        tenants.child.id,
        'admin',
        users.admin.id
      )

      // Check user roles
      const userRoles = await roleService.getUserRoles(
        users.alice.id,
        tenants.child.id
      )

      expect(userRoles).toHaveLength(1)
      expect(userRoles[0].name).toBe('admin')
    })
  })

  describe('Health Check', () => {
    it('should report healthy status', async () => {
      const health = await authService.healthCheck()

      expect(health.database).toBe('healthy')
      expect(health.status).toBe('operational')
    })
  })
})

export default describe