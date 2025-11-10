/**
 * Authorization Service Integration Tests
 * 
 * End-to-end tests for complete authorization workflows
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import AuthorizationService from '../../src/services/rbac/authorization-service.js'
import PermissionService from '../../src/services/rbac/permission-service.js'
import PolicyEngine from '../../src/services/rbac/policy-engine.js'
import { testDatabase, setupTestData, cleanupTestData } from '../helpers/test-database.js'

describe('Authorization Service Integration Tests', () => {
  let authService
  let permissionService
  let policyEngine
  let testData

  beforeEach(async () => {
    // Setup test services with real database
    permissionService = new PermissionService(testDatabase)
    policyEngine = new PolicyEngine(testDatabase)
    authService = new AuthorizationService(
      permissionService,
      policyEngine,
      testDatabase
    )

    // Setup test data
    testData = await setupTestData()
  })

  afterEach(async () => {
    await cleanupTestData()
  })

  describe('Complete Authorization Workflow', () => {
    it('should handle complex authorization scenario', async () => {
      const { users, tenants, permissions, policies } = testData

      // Grant base permission to user in parent tenant
      await permissionService.grantPermission(
        users.alice.id,
        tenants.parent.id,
        'documents',
        ['read', 'write']
      )

      // Create conditional policy for child tenant
      await policyEngine.createPolicy({
        name: 'time-restricted-access',
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

      // Test authorization with different contexts
      const context = {
        timestamp: new Date('2024-01-15T10:00:00Z'), // Within allowed time
        ipAddress: '192.168.1.1',
        userAgent: 'test-agent',
        requestId: 'req-123'
      }

      // Should allow access due to inherited permission and time policy
      const result = await authService.authorize(
        users.alice.id,
        tenants.child.id,
        'documents',
        'read',
        null,
        context
      )

      expect(result).toEqual({
        allowed: true,
        source: 'inherited',
        reason: 'Permission inherited from parent tenant',
        sourceTenantId: tenants.parent.id,
        policy: expect.objectContaining({
          name: 'time-restricted-access',
          effect: 'allow'
        }),
        context: expect.objectContaining({
          evaluationTime: expect.any(Number),
          requestId: 'req-123'
        })
      })
    })

    it('should deny access outside time restrictions', async () => {
      const { users, tenants } = testData

      // Create time-restricted policy
      await policyEngine.createPolicy({
        name: 'business-hours-only',
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

      // Test outside business hours
      const context = {
        timestamp: new Date('2024-01-15T20:00:00Z') // 8 PM UTC
      }

      const result = await authService.authorize(
        users.alice.id,
        tenants.child.id,
        'documents',
        'read',
        null,
        context
      )

      expect(result).toEqual({
        allowed: false,
        source: 'policy',
        reason: 'Access denied by time restriction policy',
        policy: expect.objectContaining({
          name: 'business-hours-only',
          effect: 'deny'
        })
      })
    })

    it('should handle IP-based restrictions', async () => {
      const { users, tenants } = testData

      // Grant permission with IP restriction
      await permissionService.grantPermissionWithConditions(
        users.bob.id,
        tenants.child.id,
        'settings',
        ['admin'],
        {
          ipWhitelist: ['192.168.1.0/24', '10.0.0.0/8']
        }
      )

      // Test from allowed IP
      const allowedContext = {
        ipAddress: '192.168.1.100'
      }

      const allowedResult = await authService.authorize(
        users.bob.id,
        tenants.child.id,
        'settings',
        'admin',
        null,
        allowedContext
      )

      expect(allowedResult.allowed).toBe(true)

      // Test from blocked IP
      const blockedContext = {
        ipAddress: '203.0.113.1' // Public IP not in whitelist
      }

      const blockedResult = await authService.authorize(
        users.bob.id,
        tenants.child.id,
        'settings',
        'admin',
        null,
        blockedContext
      )

      expect(blockedResult.allowed).toBe(false)
      expect(blockedResult.reason).toContain('IP address not allowed')
    })
  })

  describe('Permission Matrix Generation', () => {
    it('should generate comprehensive permission matrix', async () => {
      const { users, tenants } = testData

      // Grant various permissions
      await permissionService.grantPermission(
        users.alice.id,
        tenants.parent.id,
        'documents',
        ['read', 'write']
      )

      await permissionService.grantPermission(
        users.alice.id,
        tenants.child.id,
        'projects',
        ['create', 'delete']
      )

      const matrix = await authService.getPermissionMatrix(
        users.alice.id,
        tenants.child.id
      )

      expect(matrix).toEqual({
        userId: users.alice.id,
        tenantId: tenants.child.id,
        permissions: expect.objectContaining({
          documents: expect.objectContaining({
            read: true,
            write: true,
            delete: false,
            admin: false
          }),
          projects: expect.objectContaining({
            read: false,
            write: false,
            create: true,
            delete: true
          })
        }),
        inheritedFrom: expect.arrayContaining([
          expect.objectContaining({
            tenantId: tenants.parent.id,
            permissions: expect.any(Object)
          })
        ]),
        summary: expect.objectContaining({
          totalPermissions: expect.any(Number),
          directPermissions: expect.any(Number),
          inheritedPermissions: expect.any(Number)
        })
      })
    })

    it('should handle empty permission matrix', async () => {
      const { users, tenants } = testData

      const matrix = await authService.getPermissionMatrix(
        users.charlie.id, // User with no permissions
        tenants.child.id
      )

      expect(matrix).toEqual({
        userId: users.charlie.id,
        tenantId: tenants.child.id,
        permissions: {},
        inheritedFrom: [],
        summary: {
          totalPermissions: 0,
          directPermissions: 0,
          inheritedPermissions: 0
        }
      })
    })
  })

  describe('Hierarchical Access Resolution', () => {
    it('should resolve access across tenant hierarchy', async () => {
      const { users, tenants } = testData

      // Grant admin access at root level
      await permissionService.grantPermission(
        users.admin.id,
        tenants.root.id,
        'tenants',
        ['admin']
      )

      // Check access at different levels
      const rootAccess = await authService.resolveInheritedAccess(
        users.admin.id,
        tenants.root.id,
        'tenants',
        'admin'
      )

      const parentAccess = await authService.resolveInheritedAccess(
        users.admin.id,
        tenants.parent.id,
        'tenants',
        'admin'
      )

      const childAccess = await authService.resolveInheritedAccess(
        users.admin.id,
        tenants.child.id,
        'tenants',
        'admin'
      )

      expect(rootAccess).toEqual({
        allowed: true,
        source: 'direct',
        tenantId: tenants.root.id
      })

      expect(parentAccess).toEqual({
        allowed: true,
        source: 'inherited',
        sourceTenantId: tenants.root.id,
        inheritanceLevel: 1
      })

      expect(childAccess).toEqual({
        allowed: true,
        source: 'inherited',
        sourceTenantId: tenants.root.id,
        inheritanceLevel: 2
      })
    })

    it('should respect inheritance blocking', async () => {
      const { users, tenants } = testData

      // Grant permission with inheritance blocking
      await permissionService.grantPermission(
        users.alice.id,
        tenants.parent.id,
        'documents',
        ['read'],
        { blockInheritance: true }
      )

      // Should not be available in child tenant
      const childAccess = await authService.resolveInheritedAccess(
        users.alice.id,
        tenants.child.id,
        'documents',
        'read'
      )

      expect(childAccess).toEqual({
        allowed: false,
        source: 'none',
        reason: 'Permission inheritance blocked'
      })
    })
  })

  describe('Performance and Caching', () => {
    it('should cache authorization decisions', async () => {
      const { users, tenants } = testData

      await permissionService.grantPermission(
        users.alice.id,
        tenants.child.id,
        'documents',
        ['read']
      )

      // First call - should hit database
      const startTime = Date.now()
      const result1 = await authService.authorize(
        users.alice.id,
        tenants.child.id,
        'documents',
        'read'
      )
      const firstCallTime = Date.now() - startTime

      // Second call - should be cached
      const cachedStartTime = Date.now()
      const result2 = await authService.authorize(
        users.alice.id,
        tenants.child.id,
        'documents',
        'read'
      )
      const cachedCallTime = Date.now() - cachedStartTime

      expect(result1.allowed).toBe(true)
      expect(result2.allowed).toBe(true)
      expect(cachedCallTime).toBeLessThan(firstCallTime)
    })

    it('should handle high-volume authorization requests', async () => {
      const { users, tenants } = testData

      // Grant permissions for test
      await permissionService.grantPermission(
        users.alice.id,
        tenants.child.id,
        'documents',
        ['read', 'write']
      )

      // Create 100 concurrent authorization requests
      const requests = Array(100).fill().map(() =>
        authService.authorize(
          users.alice.id,
          tenants.child.id,
          'documents',
          'read'
        )
      )

      const startTime = Date.now()
      const results = await Promise.all(requests)
      const totalTime = Date.now() - startTime

      // All should succeed
      expect(results.every(r => r.allowed)).toBe(true)
      
      // Should complete within reasonable time (100 requests < 1 second)
      expect(totalTime).toBeLessThan(1000)
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid user gracefully', async () => {
      const { tenants } = testData

      const result = await authService.authorize(
        'invalid-user-id',
        tenants.child.id,
        'documents',
        'read'
      )

      expect(result).toEqual({
        allowed: false,
        source: 'error',
        reason: 'User not found',
        error: expect.any(String)
      })
    })

    it('should handle invalid tenant gracefully', async () => {
      const { users } = testData

      const result = await authService.authorize(
        users.alice.id,
        'invalid-tenant-id',
        'documents',
        'read'
      )

      expect(result).toEqual({
        allowed: false,
        source: 'error',
        reason: 'Tenant not found',
        error: expect.any(String)
      })
    })

    it('should handle policy evaluation errors', async () => {
      const { users, tenants } = testData

      // Create policy with invalid condition
      await policyEngine.createPolicy({
        name: 'invalid-policy',
        tenantId: tenants.child.id,
        conditions: {
          invalidCondition: { value: 'test' }
        },
        effect: 'allow',
        resources: ['documents'],
        actions: ['read']
      })

      const result = await authService.authorize(
        users.alice.id,
        tenants.child.id,
        'documents',
        'read'
      )

      expect(result).toEqual({
        allowed: false,
        source: 'error',
        reason: 'Policy evaluation failed',
        error: expect.stringContaining('Unknown condition type')
      })
    })
  })
})

export default describe