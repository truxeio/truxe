import { describe, beforeEach, afterEach, test, expect, jest } from '@jest/globals'
import Fastify from 'fastify'

jest.mock('../src/services/rate-limit.js', () => ({
  __esModule: true,
  default: {
    createFastifyPlugin: () => async function rateLimitPlugin() {},
    getStatistics: jest.fn().mockResolvedValue({}),
    getHealthStatus: jest.fn().mockResolvedValue({ status: 'healthy' }),
  },
}))

jest.mock('../src/services/queue-manager.js', () => ({
  __esModule: true,
  default: {
    getAllQueueMetrics: jest.fn().mockResolvedValue([]),
    getQueueMetrics: jest.fn().mockResolvedValue({}),
    getQueue: jest.fn(),
    pauseQueue: jest.fn(),
    resumeQueue: jest.fn(),
    healthCheck: jest.fn().mockResolvedValue({ status: 'ok' }),
  },
}))

jest.mock('../src/services/scheduled-jobs.js', () => ({
  __esModule: true,
  default: {
    getStatus: jest.fn().mockResolvedValue({}),
    healthCheck: jest.fn().mockResolvedValue({ status: 'ok' }),
  },
}))

jest.mock('../src/services/queue-monitoring.js', () => ({
  __esModule: true,
  default: {
    getThresholds: jest.fn().mockReturnValue({}),
    updateThresholds: jest.fn(),
    healthCheck: jest.fn().mockResolvedValue({ status: 'healthy' }),
  },
}))

jest.mock('../src/services/email-queue-adapter.js', () => ({
  __esModule: true,
  default: {
    sendAccountUnlockedNotification: jest.fn().mockResolvedValue({}),
  },
}))

jest.mock('../src/database/connection.js', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}))

jest.mock('../src/services/advanced-session-security.js', () => ({
  __esModule: true,
  default: {
    logSecurityEvent: jest.fn(),
  },
}))

jest.mock('../src/config/index.js', () => ({
  __esModule: true,
  default: {
    redis: { keyPrefix: 'truxe:' },
    features: { useBullMQQueues: false },
    alertNotifications: { enabled: true },
  },
}))

jest.mock('../src/services/alert-notifier.js', () => ({
  __esModule: true,
  default: {
    testNotifications: jest.fn(),
    getStatus: jest.fn(),
  },
}))

import alertNotifier from '../src/services/alert-notifier.js'
import adminRoutes from '../src/routes/admin.js'

function decorateAuth(app) {
  app.decorate('authenticate', async (request, reply) => {
    request.user = { id: 'admin-1', roles: ['admin'] }
    request.tokenPayload = { user_id: 'admin-1' }
  })

  app.decorate('requireRole', () => async function allow() {})
}

describe('Admin Alert Routes', () => {
  let app

  beforeEach(async () => {
    app = Fastify({ logger: false })
    decorateAuth(app)
    await app.register(adminRoutes, { prefix: '/api/admin' })
  })

  afterEach(async () => {
    await app.close()
    jest.clearAllMocks()
  })

  test('GET /api/admin/alerts/notification-status returns notifier status', async () => {
    alertNotifier.getStatus.mockReturnValue({ enabled: true, metrics: {} })

    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/alerts/notification-status',
      headers: { Authorization: 'Bearer test' },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.data).toEqual(expect.objectContaining({ enabled: true }))
    expect(alertNotifier.getStatus).toHaveBeenCalledTimes(1)
  })

  test('POST /api/admin/alerts/test triggers alert notifier', async () => {
    alertNotifier.testNotifications.mockResolvedValue({ dispatched: true })

    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/alerts/test',
      headers: { Authorization: 'Bearer test' },
      payload: { severity: 'critical', message: 'Test alert' },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.success).toBe(true)
    expect(alertNotifier.testNotifications).toHaveBeenCalledWith(expect.objectContaining({ severity: 'critical', message: 'Test alert' }))
  })
})
