/**
 * RBAC Performance Tests
 *
 * Performance benchmarks for RBAC system components
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import AuthorizationService from '../../src/services/rbac/authorization-service.js'
import PermissionService from '../../src/services/rbac/permission-service.js'
import { testDatabase, setupLargeTestData, cleanupTestData } from '../helpers/test-database.js'

describe('RBAC Performance Tests', () => {
  let authService
  let permissionService
  let testData

  beforeEach(async () => {
    // Mock audit logger for performance tests
    const mockAuditLogger = {
      logEvent: jest.fn(async (event) => ({ id: 'mock-audit-id', ...event })),
      logAuth: jest.fn(async (event) => ({ id: 'mock-auth-id' })),
      logAccess: jest.fn(async (event) => ({ id: 'mock-access-id' }))
    }

    // Mock cache service
    const mockCache = {
      get: jest.fn(async (key) => null),
      set: jest.fn(async (key, value, ttl) => true),
      delete: jest.fn(async (key) => true),
    }

    permissionService = new PermissionService(testDatabase, mockAuditLogger, mockCache)
    authService = new AuthorizationService(testDatabase, mockAuditLogger, mockCache)
    
    // Setup large dataset for performance testing
    testData = await setupLargeTestData({
      users: 1000,
      tenants: 100,
      permissions: 10000,
      policies: 500
    })
  })

  afterEach(async () => {
    await cleanupTestData()
  })

  describe('Permission Checking Performance', () => {
    it('should check permissions within performance targets', async () => {
      const { users, tenants } = testData
      
      // Test single permission check
      const startTime = process.hrtime.bigint()

      const result = await authService.authorize(
        users[0].id,
        tenants[0].id,
        'read',
        'documents'
      )

      const endTime = process.hrtime.bigint()
      const executionTime = Number(endTime - startTime) / 1000000 // Convert to milliseconds

      expect(result).toBeDefined()
      expect(executionTime).toBeLessThan(10) // Should complete within 10ms
    })

    it('should handle concurrent permission checks efficiently', async () => {
      const { users, tenants } = testData

      // Test 100 concurrent permission checks
      const requests = Array(100).fill().map((_, index) =>
        authService.authorize(
          users[index % users.length].id,
          tenants[index % tenants.length].id,
          'read',
          'documents'
        )
      )
      
      const startTime = process.hrtime.bigint()
      const results = await Promise.all(requests)
      const endTime = process.hrtime.bigint()
      
      const totalTime = Number(endTime - startTime) / 1000000
      const avgTime = totalTime / 100
      
      expect(results).toHaveLength(100)
      expect(avgTime).toBeLessThan(5) // Average should be under 5ms per check
      expect(totalTime).toBeLessThan(500) // Total should be under 500ms
    })

    it('should scale linearly with permission hierarchy depth', async () => {
      const { users, deepTenants } = testData
      
      const timings = []
      
      // Test permission checks at different hierarchy depths
      for (let depth = 1; depth <= 5; depth++) {
        const tenant = deepTenants[depth - 1]
        
        const startTime = process.hrtime.bigint()
        await authService.authorize(
          users[0].id,
          tenant.id,
          'read',
          'documents'
        )
        const endTime = process.hrtime.bigint()
        
        timings.push({
          depth,
          time: Number(endTime - startTime) / 1000000
        })
      }
      
      // Verify linear scaling (no exponential growth)
      const maxTime = Math.max(...timings.map(t => t.time))
      const minTime = Math.min(...timings.map(t => t.time))
      
      expect(maxTime / minTime).toBeLessThan(3) // Max 3x slowdown at depth 5
      expect(maxTime).toBeLessThan(25) // Even deepest check under 25ms
    })
  })

  describe('Cache Performance', () => {
    it('should demonstrate significant cache speedup', async () => {
      const { users, tenants } = testData
      
      // First call (cache miss)
      const coldStartTime = process.hrtime.bigint()
      await authService.authorize(users[0].id, tenants[0].id, 'read', 'documents')
      const coldEndTime = process.hrtime.bigint()
      const coldTime = Number(coldEndTime - coldStartTime) / 1000000
      
      // Second call (cache hit)
      const warmStartTime = process.hrtime.bigint()
      await authService.authorize(users[0].id, tenants[0].id, 'read', 'documents')
      const warmEndTime = process.hrtime.bigint()
      const warmTime = Number(warmEndTime - warmStartTime) / 1000000
      
      expect(warmTime).toBeLessThan(coldTime / 2) // Cache should be at least 2x faster
      expect(warmTime).toBeLessThan(2) // Cached response under 2ms
    })

    it('should handle cache invalidation efficiently', async () => {
      const { users, tenants } = testData
      
      // Initial authorization
      await authService.authorize(users[0].id, tenants[0].id, 'read', 'documents')
      
      // Grant new permission (should invalidate cache)
      const invalidationStart = process.hrtime.bigint()
      await permissionService.grantPermission(
        users[0].id,
        tenants[0].id,
        'documents',
        ['write']
      )
      const invalidationEnd = process.hrtime.bigint()
      
      const invalidationTime = Number(invalidationEnd - invalidationStart) / 1000000
      
      // Next authorization should reflect new permission
      const result = await authService.authorize(
        users[0].id,
        tenants[0].id,
        'write',
        'documents'
      )
      
      expect(result.allowed).toBe(true)
      expect(invalidationTime).toBeLessThan(20) // Cache invalidation under 20ms
    })
  })

  describe('Database Query Performance', () => {
    it('should use efficient queries for permission lookup', async () => {
      const { users, tenants } = testData
      
      // Mock query tracking
      const queryTracker = {
        queries: [],
        originalQuery: testDatabase.query
      }
      
      testDatabase.query = (...args) => {
        queryTracker.queries.push({
          query: args[0],
          params: args[1],
          timestamp: Date.now()
        })
        return queryTracker.originalQuery.apply(testDatabase, args)
      }
      
      try {
        await authService.authorize(users[0].id, tenants[0].id, 'read', 'documents')
        
        // Verify query efficiency
        expect(queryTracker.queries.length).toBeLessThan(5) // Should use minimal queries
        
        // Check for n+1 query problems
        const uniqueQueries = new Set(queryTracker.queries.map(q => q.query))
        expect(uniqueQueries.size).toBeLessThan(4) // Should reuse query patterns
        
      } finally {
        // Restore original query method
        testDatabase.query = queryTracker.originalQuery
      }
    })

    it('should handle bulk operations efficiently', async () => {
      const { users, tenants } = testData

      // Test bulk permission grant
      const bulkGrants = Array(50).fill().map((_, index) => ({
        userId: users[index % users.length].id,
        tenantId: tenants[index % tenants.length].id,
        resource: 'documents',
        actions: ['read']
      }))

      const startTime = process.hrtime.bigint()
      // Use first user as grantedBy (valid UUID)
      await permissionService.bulkGrantPermissions(bulkGrants, users[0].id)
      const endTime = process.hrtime.bigint()
      
      const totalTime = Number(endTime - startTime) / 1000000
      const avgTimePerGrant = totalTime / 50
      
      expect(avgTimePerGrant).toBeLessThan(2) // Under 2ms per grant
      expect(totalTime).toBeLessThan(100) // Total under 100ms
    })
  })

  describe('Memory Usage', () => {
    it('should maintain reasonable memory usage under load', async () => {
      const { users, tenants } = testData
      
      const initialMemory = process.memoryUsage()
      
      // Perform many authorization checks
      const promises = []
      for (let i = 0; i < 1000; i++) {
        promises.push(
          authService.authorize(
            users[i % users.length].id,
            tenants[i % tenants.length].id,
            'read',
            'documents'
          )
        )
      }
      
      await Promise.all(promises)
      
      const finalMemory = process.memoryUsage()
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed
      
      // Memory increase should be reasonable (under 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)
      
      // Verify no memory leaks by triggering GC and checking again
      if (global.gc) {
        global.gc()
        const postGcMemory = process.memoryUsage()
        const postGcIncrease = postGcMemory.heapUsed - initialMemory.heapUsed
        
        expect(postGcIncrease).toBeLessThan(20 * 1024 * 1024) // Under 20MB after GC
      }
    })
  })

  describe('Stress Testing', () => {
    it('should handle stress test scenarios', async () => {
      const { users, tenants } = testData
      
      // Rapid-fire authorization checks
      const stressTestDuration = 5000 // 5 seconds
      const startTime = Date.now()
      let requestCount = 0
      
      const stressTest = async () => {
        while (Date.now() - startTime < stressTestDuration) {
          await authService.authorize(
            users[requestCount % users.length].id,
            tenants[requestCount % tenants.length].id,
            'read',
            'documents'
          )
          requestCount++
        }
      }
      
      // Run 10 concurrent stress test workers
      const workers = Array(10).fill().map(() => stressTest())
      await Promise.all(workers)
      
      const totalRequests = requestCount
      const requestsPerSecond = totalRequests / (stressTestDuration / 1000)
      
      expect(totalRequests).toBeGreaterThan(1000) // Should handle 1000+ requests
      expect(requestsPerSecond).toBeGreaterThan(200) // Should handle 200+ RPS
    })

    it('should recover gracefully from high load', async () => {
      const { users, tenants } = testData
      
      // Create high load
      const highLoadPromises = Array(500).fill().map((_, index) =>
        authService.authorize(
          users[index % users.length].id,
          tenants[index % tenants.length].id,
          'read',
          'documents'
        )
      )
      
      // Measure time for high load
      const highLoadStart = process.hrtime.bigint()
      await Promise.all(highLoadPromises)
      const highLoadEnd = process.hrtime.bigint()
      
      // Wait a moment for recovery
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Test normal operation after high load
      const normalStart = process.hrtime.bigint()
      await authService.authorize(users[0].id, tenants[0].id, 'read', 'documents')
      const normalEnd = process.hrtime.bigint()
      
      const normalTime = Number(normalEnd - normalStart) / 1000000
      
      // Normal operation should still be fast after high load
      expect(normalTime).toBeLessThan(10) // Under 10ms for normal operation
    })
  })
})

export default describe