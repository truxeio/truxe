import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import HierarchyService from '../../src/services/tenant/hierarchy.js'

describe('HierarchyService', () => {
  let repository
  let cache

  beforeEach(() => {
    repository = {
      query: jest.fn(),
      findById: jest.fn(),
    }
    cache = {
      get: jest.fn().mockReturnValue(null),
      set: jest.fn(),
    }
  })

  it('returns ancestors in order', async () => {
    repository.query.mockResolvedValue({
      rows: [
        { id: 'root', name: 'Root', slug: 'root', tenant_type: 'workspace', level: 0, status: 'active' },
        { id: 'child', name: 'Child', slug: 'child', tenant_type: 'team', level: 1, status: 'active' },
      ],
    })
    const service = new HierarchyService({ repository, cache })
    const ancestors = await service.getAncestors('tenant-1')
    expect(repository.query).toHaveBeenCalled()
    expect(ancestors[0].id).toBe('root')
    expect(cache.set).toHaveBeenCalledWith(expect.any(String), expect.any(Array))
  })

  it('checks ancestor relationship', async () => {
    repository.query.mockResolvedValue({ rowCount: 1 })
    const service = new HierarchyService({ repository, cache })
    const result = await service.isAncestor('root', 'descendant')
    expect(result).toBe(true)
  })

  it('builds full hierarchy tree', async () => {
    repository.query.mockResolvedValue({
      rows: [
        { id: 'root', parent_tenant_id: null, tenant_type: 'workspace', level: 0, path: ['root'], max_depth: 5, name: 'Root', slug: 'root', description: null, status: 'active', settings: {}, metadata: {} },
        { id: 'child', parent_tenant_id: 'root', tenant_type: 'team', level: 1, path: ['root', 'child'], max_depth: 5, name: 'Child', slug: 'child', description: null, status: 'active', settings: {}, metadata: {} },
      ],
    })
    const service = new HierarchyService({ repository, cache })
    const tree = await service.getFullHierarchy('root')
    expect(tree).toHaveLength(1)
    expect(tree[0].children[0].id).toBe('child')
  })
})
