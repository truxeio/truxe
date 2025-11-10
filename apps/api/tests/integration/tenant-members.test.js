import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import TenantMemberService from '../../src/services/tenant/members.js'

describe('Tenant Member Integration', () => {
  let repository
  let validation
  let auditLogger

  beforeEach(() => {
    repository = {
      transaction: jest.fn(async (_opts, cb) => cb({})),
      query: jest.fn(),
    }

    validation = {
      _assertRole: jest.fn().mockResolvedValue(true),
    }

    auditLogger = {
      logEvent: jest.fn(),
    }
  })

  it('adds multiple members atomically', async () => {
    const memberService = new TenantMemberService({
      repository,
      validationService: validation,
      auditLogger,
    })

    repository.query.mockResolvedValue({
      rows: [{ id: 'membership-1', tenant_id: 'tenant-1', user_id: 'user-2', role: 'member' }],
    })

    await memberService.addMultipleMembers('tenant-1', [
      { userId: 'user-2', role: 'member' },
    ], 'user-1')

    expect(repository.query).toHaveBeenCalled()
    expect(auditLogger.logEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'tenant.member.added',
    }))
  })
})
