import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import TenantService from '../../src/services/tenant/index.js'
import { TenantValidationError } from '../../src/services/tenant/validation.js'

const buildMocks = () => {
  const mockClient = {}
  const repository = {
    transaction: jest.fn(async (_opts, callback) => callback(mockClient)),
    query: jest.fn(),
    findById: jest.fn(),
    findBySlug: jest.fn(),
    findByFilters: jest.fn(),
  }

  const validation = {
    canCreateTenant: jest.fn().mockResolvedValue(true),
    validateTenantQuota: jest.fn().mockResolvedValue(true),
    validateParent: jest.fn().mockResolvedValue({
      id: 'parent-1',
      slug: 'parent',
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

  const hierarchy = {
    getAncestors: jest.fn().mockResolvedValue([]),
    getChildren: jest.fn().mockResolvedValue([]),
  }

  const path = {
    rebuildPaths: jest.fn().mockResolvedValue(true),
    getPathString: jest.fn().mockResolvedValue('root > child'),
  }

  const lifecycle = {
    archiveTenant: jest.fn(),
    restoreTenant: jest.fn(),
    moveTenant: jest.fn(),
    permanentlyDelete: jest.fn(),
  }

  const members = {
    addMember: jest.fn().mockResolvedValue(true),
  }

  const auditLogger = {
    logEvent: jest.fn(),
  }

  const cache = {
    get: jest.fn().mockReturnValue(null),
    set: jest.fn(),
    delete: jest.fn(),
  }

  return {
    repository,
    validation,
    hierarchy,
    path,
    lifecycle,
    members,
    auditLogger,
    cache,
    mockClient,
  }
}

describe('TenantService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates child tenant with generated slug', async () => {
    const mocks = buildMocks()
    mocks.repository.query.mockResolvedValueOnce({
      rows: [{
        id: 'child-1',
        parent_tenant_id: 'parent-1',
        slug: 'child',
        name: 'Child',
        tenant_type: 'team',
        status: 'active',
      }],
    })

    const service = new TenantService({
      repository: mocks.repository,
      validationService: mocks.validation,
      hierarchyService: mocks.hierarchy,
      pathService: mocks.path,
      lifecycleService: mocks.lifecycle,
      memberService: mocks.members,
      auditLogger: mocks.auditLogger,
      cache: mocks.cache,
    })

    const tenant = await service.createChildTenant('parent-1', {
      name: 'Child',
      tenantType: 'team',
    }, 'user-1')

    expect(mocks.validation.canCreateTenant).toHaveBeenCalledWith('user-1', 'parent-1', expect.any(Object))
    expect(mocks.validation.validateSlug).toHaveBeenCalled()
    expect(mocks.repository.query).toHaveBeenCalledWith(expect.objectContaining({
      client: mocks.mockClient,
    }))
    expect(mocks.path.rebuildPaths).toHaveBeenCalledWith('parent-1', { userId: 'user-1' })
    expect(mocks.members.addMember).toHaveBeenCalledWith('child-1', 'user-1', 'owner', 'user-1', expect.objectContaining({ client: mocks.mockClient }))
    expect(tenant.id).toBe('child-1')
  })

  it('throws when updateTenant receives invalid status', async () => {
    const mocks = buildMocks()
    const service = new TenantService({
      repository: mocks.repository,
      validationService: mocks.validation,
      hierarchyService: mocks.hierarchy,
      pathService: mocks.path,
      lifecycleService: mocks.lifecycle,
      memberService: mocks.members,
      auditLogger: mocks.auditLogger,
      cache: mocks.cache,
    })

    await expect(
      service.updateTenant('tenant-1', { status: 'unknown' }, 'user-1')
    ).rejects.toThrow(TenantValidationError)
  })

  it('delegates archiveTenant to lifecycle service', async () => {
    const mocks = buildMocks()
    mocks.lifecycle.archiveTenant.mockResolvedValue({ archived: true })
    const service = new TenantService({
      repository: mocks.repository,
      validationService: mocks.validation,
      hierarchyService: mocks.hierarchy,
      pathService: mocks.path,
      lifecycleService: mocks.lifecycle,
      memberService: mocks.members,
      auditLogger: mocks.auditLogger,
      cache: mocks.cache,
    })

    const result = await service.archiveTenant('tenant-1', 'user-1')
    expect(mocks.lifecycle.archiveTenant).toHaveBeenCalledWith('tenant-1', 'user-1', {})
    expect(result).toEqual({ archived: true })
  })
})
