import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import TenantValidationService, { TenantValidationError } from '../../src/services/tenant/validation.js'

describe('TenantValidationService', () => {
  let repository
  let cache

  beforeEach(() => {
    repository = {
      findBySlug: jest.fn(),
      findById: jest.fn(),
      query: jest.fn(),
    }
    cache = {
      get: jest.fn().mockReturnValue(null),
      set: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
    }
  })

  it('validates unique slug', async () => {
    repository.findBySlug.mockResolvedValue(null)
    const service = new TenantValidationService({ repository, cache })
    await expect(service.validateSlug('child-tenant', 'parent-1')).resolves.toBe('child-tenant')
  })

  it('throws when slug already exists', async () => {
    repository.findBySlug.mockResolvedValue({ id: 'duplicate' })
    const service = new TenantValidationService({ repository, cache })
    await expect(service.validateSlug('duplicate', 'parent-1')).rejects.toThrow(TenantValidationError)
  })

  it('prevents circular references', async () => {
    repository.query.mockResolvedValue({ rowCount: 1 })
    const service = new TenantValidationService({ repository, cache })
    await expect(service.validateCircularReference('tenant-1', 'tenant-2')).rejects.toThrow('Circular reference')
  })

  it('checks permission roles', async () => {
    repository.query.mockResolvedValueOnce({
      rows: [{ role: 'admin' }],
      rowCount: 1,
    })
    const service = new TenantValidationService({ repository, cache })
    await expect(service.canUpdateTenant('user-1', 'tenant-1')).resolves.toBe(true)
  })
})
