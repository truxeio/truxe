/**
 * Permission Service Unit Tests
 * 
 * Comprehensive test suite for the Permission Service
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import PermissionService from '../../../src/services/rbac/permission-service.js'

// Mock dependencies
const mockDatabase = {
  query: jest.fn(),
  connect: jest.fn(() => ({
    query: jest.fn(),
    release: jest.fn()
  }))
}

const mockAuditLogger = {
  logEvent: jest.fn()
}

const mockCache = {
  get: jest.fn(() => Promise.resolve(null)),
  set: jest.fn(() => Promise.resolve('OK')),
  setex: jest.fn(() => Promise.resolve('OK')),
  del: jest.fn(() => Promise.resolve(1)),
  ping: jest.fn(() => Promise.resolve('PONG'))
}

describe('PermissionService', () => {
  let permissionService

  beforeEach(() => {
    jest.clearAllMocks()
    // Re-establish default mock implementations after clearAllMocks
    mockCache.get.mockResolvedValue(null)
    mockCache.set.mockResolvedValue('OK')
    mockCache.setex.mockResolvedValue('OK')
    mockCache.del.mockResolvedValue(1)
    mockCache.ping.mockResolvedValue('PONG')
    permissionService = new PermissionService(mockDatabase, mockAuditLogger, mockCache)
  })

  describe('grantPermission', () => {
    it('should grant a permission successfully', async () => {
      const mockPermissionRow = {
        id: 'perm-123',
        user_id: 'user-123',
        tenant_id: 'tenant-123',
        resource_type: 'documents',
        resource_id: null,
        actions: ['read', 'write'],
        conditions: null,
        granted_by: 'admin-123',
        expires_at: null,
        created_at: new Date(),
        updated_at: new Date()
      }

      mockDatabase.query.mockResolvedValue({ rows: [mockPermissionRow] })

      const result = await permissionService.grantPermission(
        'user-123',
        'tenant-123',
        'documents',
        ['read', 'write'],
        { grantedBy: 'admin-123' }
      )

      expect(result).toEqual({
        id: 'perm-123',
        userId: 'user-123',
        tenantId: 'tenant-123',
        resourceType: 'documents',
        resourceId: null,
        actions: ['read', 'write'],
        conditions: {},
        grantedBy: 'admin-123',
        expiresAt: null,
        createdAt: mockPermissionRow.created_at,
        updatedAt: mockPermissionRow.updated_at
      })

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO permissions'),
        expect.arrayContaining(['user-123', 'tenant-123', 'documents'])
      )

      expect(mockAuditLogger.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'permission.granted',
          orgId: 'tenant-123'
        })
      )
    })

    it('should grant permission with conditions', async () => {
      const conditions = { timeRange: { start: '09:00', end: '17:00' } }
      const mockPermissionRow = {
        id: 'perm-124',
        user_id: 'user-123',
        tenant_id: 'tenant-123',
        resource_type: 'documents',
        resource_id: null,
        actions: ['read'],
        conditions: conditions,
        granted_by: 'admin-123',
        expires_at: null,
        created_at: new Date(),
        updated_at: new Date()
      }

      mockDatabase.query.mockResolvedValue({ rows: [mockPermissionRow] })

      const result = await permissionService.grantPermissionWithConditions(
        'user-123',
        'tenant-123',
        'documents',
        ['read'],
        conditions
      )

      expect(result.conditions).toEqual(conditions)
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO permissions'),
        expect.arrayContaining([
          'user-123',
          'tenant-123',
          'documents',
          null,
          ['read'],
          JSON.stringify(conditions)
        ])
      )
    })

    it('should grant permission with expiry', async () => {
      const expiresAt = new Date(Date.now() + 86400000) // 1 day from now
      const mockPermissionRow = {
        id: 'perm-125',
        user_id: 'user-123',
        tenant_id: 'tenant-123',
        resource_type: 'documents',
        resource_id: null,
        actions: ['read'],
        conditions: null,
        granted_by: 'admin-123',
        expires_at: expiresAt,
        created_at: new Date(),
        updated_at: new Date()
      }

      mockDatabase.query.mockResolvedValue({ rows: [mockPermissionRow] })

      const result = await permissionService.grantPermissionWithExpiry(
        'user-123',
        'tenant-123',
        'documents',
        ['read'],
        expiresAt
      )

      expect(result.expiresAt).toEqual(expiresAt)
    })

    it('should validate expiry date', async () => {
      const pastDate = new Date(Date.now() - 86400000) // 1 day ago

      await expect(
        permissionService.grantPermissionWithExpiry(
          'user-123',
          'tenant-123',
          'documents',
          ['read'],
          pastDate
        )
      ).rejects.toThrow('Expiration date must be in the future')
    })

    it('should validate resource and action', async () => {
      await expect(
        permissionService.grantPermission(
          'user-123',
          'tenant-123',
          'invalid-resource',
          ['read']
        )
      ).rejects.toThrow('Unknown resource type')
    })
  })

  describe('revokePermission', () => {
    it('should revoke permission successfully', async () => {
      const mockCurrentPermission = {
        id: 'perm-123',
        actions: ['read', 'write', 'delete']
      }

      const mockUpdatedPermission = {
        id: 'perm-123',
        actions: ['read', 'write']
      }

      mockDatabase.query
        .mockResolvedValueOnce({ rows: [mockCurrentPermission] }) // Get current
        .mockResolvedValueOnce({ rows: [mockUpdatedPermission] }) // Update

      const result = await permissionService.revokePermission(
        'user-123',
        'tenant-123',
        'documents',
        ['delete'],
        'admin-123'
      )

      expect(result).toEqual({
        revoked: true,
        revokedActions: ['delete'],
        remainingActions: ['read', 'write'],
        permissionRemoved: false
      })

      expect(mockAuditLogger.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'permission.revoked'
        })
      )
    })

    it('should remove permission entirely when no actions remain', async () => {
      const mockCurrentPermission = {
        id: 'perm-123',
        actions: ['read']
      }

      mockDatabase.query
        .mockResolvedValueOnce({ rows: [mockCurrentPermission] }) // Get current
        .mockResolvedValueOnce({ rows: [mockCurrentPermission] }) // Delete

      const result = await permissionService.revokePermission(
        'user-123',
        'tenant-123',
        'documents',
        ['read'],
        'admin-123'
      )

      expect(result).toEqual({
        revoked: true,
        revokedActions: ['read'],
        remainingActions: [],
        permissionRemoved: true
      })
    })

    it('should throw error if permission not found', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] })

      await expect(
        permissionService.revokePermission(
          'user-123',
          'tenant-123',
          'documents',
          ['read'],
          'admin-123'
        )
      ).rejects.toThrow('Permission not found')
    })
  })

  describe('hasPermission', () => {
    it('should return true for direct permission', async () => {
      const mockResult = {
        allowed: true,
        source: 'direct',
        permission: { id: 'perm-123' }
      }

      // Mock the internal check method
      jest.spyOn(permissionService, '_checkPermissionInternal')
        .mockResolvedValue(mockResult)

      const result = await permissionService.hasPermission(
        'user-123',
        'tenant-123',
        'documents',
        'read'
      )

      expect(result).toEqual(mockResult)
      expect(mockCache.setex).toHaveBeenCalled()
    })

    it('should return cached result', async () => {
      const cachedResult = JSON.stringify({
        allowed: true,
        source: 'direct'
      })

      mockCache.get.mockResolvedValue(cachedResult)

      const result = await permissionService.hasPermission(
        'user-123',
        'tenant-123',
        'documents',
        'read'
      )

      expect(result).toEqual({
        allowed: true,
        source: 'direct'
      })

      // Should not call database if cached
      expect(mockDatabase.query).not.toHaveBeenCalled()
    })
  })

  describe('getInheritedPermissions', () => {
    it('should return inherited permissions from parent tenants', async () => {
      const mockTenantPath = {
        path: ['root-tenant', 'parent-tenant', 'current-tenant']
      }

      const mockInheritedPermissions = [
        {
          id: 'perm-parent-1',
          user_id: 'user-123',
          tenant_id: 'parent-tenant',
          resource_type: 'documents',
          actions: ['read'],
          source_tenant_id: 'parent-tenant',
          source_tenant_name: 'Parent Tenant',
          level: 1
        }
      ]

      mockDatabase.query
        .mockResolvedValueOnce({ rows: [mockTenantPath] }) // Get path
        .mockResolvedValueOnce({ rows: mockInheritedPermissions }) // Get inherited

      const result = await permissionService.getInheritedPermissions(
        'user-123',
        'current-tenant'
      )

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(
        expect.objectContaining({
          inherited: true,
          sourceTenantId: 'parent-tenant',
          sourceTenantName: 'Parent Tenant'
        })
      )
    })

    it('should return empty array for root tenant', async () => {
      const mockTenantPath = {
        path: ['root-tenant'] // Only self in path
      }

      mockDatabase.query.mockResolvedValue({ rows: [mockTenantPath] })

      const result = await permissionService.getInheritedPermissions(
        'user-123',
        'root-tenant'
      )

      expect(result).toEqual([])
    })
  })

  describe('bulkGrantPermissions', () => {
    it('should grant multiple permissions successfully', async () => {
      const grants = [
        {
          userId: 'user-123',
          tenantId: 'tenant-123',
          resource: 'documents',
          actions: ['read']
        },
        {
          userId: 'user-123',
          tenantId: 'tenant-123',
          resource: 'projects',
          actions: ['write']
        }
      ]

      // Mock database client for transaction
      const mockClient = {
        query: jest.fn(),
        release: jest.fn()
      }

      mockDatabase.connect.mockResolvedValue(mockClient)
      mockClient.query.mockResolvedValue({ rows: [] })

      // Mock individual grant calls
      jest.spyOn(permissionService, 'grantPermission')
        .mockResolvedValueOnce({ id: 'perm-1' })
        .mockResolvedValueOnce({ id: 'perm-2' })

      const result = await permissionService.bulkGrantPermissions(grants, 'admin-123')

      expect(result).toEqual({
        success: true,
        granted: 2,
        errors: 0,
        results: expect.arrayContaining([
          { index: 0, permission: { id: 'perm-1' } },
          { index: 1, permission: { id: 'perm-2' } }
        ])
      })

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN')
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT')
    })

    it('should rollback on errors', async () => {
      const grants = [
        {
          userId: 'user-123',
          tenantId: 'tenant-123',
          resource: 'invalid-resource',
          actions: ['read']
        }
      ]

      const mockClient = {
        query: jest.fn(),
        release: jest.fn()
      }

      mockDatabase.connect.mockResolvedValue(mockClient)

      jest.spyOn(permissionService, 'grantPermission')
        .mockRejectedValue(new Error('Unknown resource type'))

      await expect(
        permissionService.bulkGrantPermissions(grants, 'admin-123')
      ).rejects.toThrow('Bulk grant failed')

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK')
    })

    it('should validate batch size', async () => {
      const tooManyGrants = Array(60).fill({
        userId: 'user-123',
        tenantId: 'tenant-123',
        resource: 'documents',
        actions: ['read']
      })

      await expect(
        permissionService.bulkGrantPermissions(tooManyGrants, 'admin-123')
      ).rejects.toThrow('Bulk operation exceeds maximum size')
    })
  })

  describe('healthCheck', () => {
    it('should return healthy status', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] })
      mockCache.ping.mockResolvedValue('PONG')

      const result = await permissionService.healthCheck()

      expect(result).toEqual({
        database: 'healthy',
        cache: 'healthy',
        resourceRegistry: expect.objectContaining({
          status: 'healthy'
        }),
        status: 'operational'
      })
    })

    it('should return unhealthy status on database error', async () => {
      mockDatabase.query.mockRejectedValue(new Error('Connection failed'))

      const result = await permissionService.healthCheck()

      expect(result).toEqual({
        database: 'unhealthy',
        cache: 'unknown',
        status: 'degraded',
        error: 'Connection failed'
      })
    })
  })
})

export default describe