import { describe, it, expect, jest } from '@jest/globals'
import HierarchyService from '../../src/services/tenant/hierarchy.js'

describe('Tenant Query Performance', () => {
  it('should cache descendant queries to avoid repeated database calls', async () => {
    const repository = {
      query: jest.fn().mockResolvedValue({
        rows: [
          { id: 'tenant-1', parent_tenant_id: null, tenant_type: 'workspace', level: 0, path: ['tenant-1'], max_depth: 5, name: 'Root', slug: 'root', status: 'active', description: null, settings: {}, metadata: {} },
          { id: 'tenant-2', parent_tenant_id: 'tenant-1', tenant_type: 'team', level: 1, path: ['tenant-1', 'tenant-2'], max_depth: 5, name: 'Child', slug: 'child', status: 'active', description: null, settings: {}, metadata: {} },
        ],
      }),
    }
    const cache = {
      get: jest.fn().mockReturnValueOnce(null).mockReturnValueOnce([{ id: 'tenant-2' }]),
      set: jest.fn(),
    }

    const hierarchyService = new HierarchyService({ repository, cache })
    await hierarchyService.getDescendants('tenant-1')
    await hierarchyService.getDescendants('tenant-1')

    expect(repository.query).toHaveBeenCalledTimes(1)
    expect(cache.set).toHaveBeenCalledWith(expect.any(String), expect.any(Array), 60)
  })
})
