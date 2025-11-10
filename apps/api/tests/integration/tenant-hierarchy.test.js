import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import TenantService from '../../src/services/tenant/index.js'
import HierarchyService from '../../src/services/tenant/hierarchy.js'
import PathService from '../../src/services/tenant/path.js'

const buildSharedMocks = () => {
  const repository = {
    transaction: jest.fn(async (_opts, cb) => cb({})),
    query: jest.fn(),
    findById: jest.fn(),
    findBySlug: jest.fn(),
    findByFilters: jest.fn(),
  }

  const validation = {
    canCreateTenant: jest.fn().mockResolvedValue(true),
    validateTenantQuota: jest.fn().mockResolvedValue(true),
    validateParent: jest.fn().mockResolvedValue({
      id: 'root',
      slug: 'root',
      level: 0,
      maxDepth: 5,
    }),
    enforceNamingConvention: jest.fn(name => name.trim()),
    validateSlug: jest.fn(async slug => slug),
    validateSettings: jest.fn(settings => settings || {}),
    validateMetadata: jest.fn(metadata => metadata || {}),
    validateTenantType: jest.fn(type => type),
    canUpdateTenant: jest.fn().mockResolvedValue(true),
    canMoveTenant: jest.fn().mockResolvedValue(true),
  }

  const cache = {
    get: jest.fn().mockReturnValue(null),
    set: jest.fn(),
  }

  const path = new PathService({
    repository,
    cache,
  })

  const hierarchy = new HierarchyService({
    repository,
    cache,
  })

  const lifecycle = {
    archiveTenant: jest.fn(),
    restoreTenant: jest.fn(),
    moveTenant: jest.fn(),
    permanentlyDelete: jest.fn(),
  }

  const members = {
    addMember: jest.fn(),
  }

  const auditLogger = { logEvent: jest.fn() }
  const service = new TenantService({
    repository,
    validationService: validation,
    hierarchyService: hierarchy,
    pathService: path,
    lifecycleService: lifecycle,
    memberService: members,
    auditLogger,
    cache,
  })

  return {
    repository,
    validation,
    hierarchy,
    path,
    lifecycle,
    members,
    auditLogger,
    service,
    cache,
  }
}

describe('Tenant Hierarchy Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should traverse hierarchy efficiently', async () => {
    const mocks = buildSharedMocks()
    mocks.repository.findById.mockResolvedValueOnce({
      id: 'tenant-1',
      parentId: null,
      level: 0,
      path: ['tenant-1'],
      status: 'active',
    })
    mocks.hierarchy.getChildren = jest.fn().mockResolvedValue([
      { id: 'tenant-2', parentId: 'tenant-1', level: 1 },
    ])
    mocks.hierarchy.getAncestors = jest.fn().mockResolvedValue([])

    const tenant = await mocks.service.getTenantById('tenant-1', 'user-1')
    expect(tenant.id).toBe('tenant-1')
    expect(mocks.hierarchy.getChildren).toHaveBeenCalled()
  })

  it('should move tenant between parents', async () => {
    const mocks = buildSharedMocks()
    mocks.lifecycle.moveTenant.mockResolvedValue({ success: true })
    const result = await mocks.service.moveTenant('tenant-2', 'tenant-1', 'user-1')
    expect(mocks.lifecycle.moveTenant).toHaveBeenCalledWith('tenant-2', 'tenant-1', 'user-1', {})
    expect(result).toEqual({ success: true })
  })
})
