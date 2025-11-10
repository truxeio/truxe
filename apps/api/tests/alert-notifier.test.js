import { describe, beforeEach, afterEach, test, expect, jest } from '@jest/globals'

jest.mock('../src/config/index.js', () => ({
  __esModule: true,
  default: {
    app: { environment: 'test' },
    features: { useBullMQQueues: false },
    alertNotifications: {
      enabled: true,
      deduplicationWindowMs: 300000,
      maxRetries: 2,
      retryDelayMs: 50,
      retryBackoffMs: 200,
      channels: {
        email: { enabled: true, recipients: ['ops@example.com'] },
        slack: { enabled: true, webhookUrl: 'https://slack.example.com', channel: '#alerts' },
        pagerDuty: { enabled: true, integrationKey: 'pd-integration-key', source: 'unit-tests', service: 'alerting' },
      },
    },
  },
}))

jest.mock('../src/services/queue-manager.js', () => ({
  __esModule: true,
  default: {
    addJob: jest.fn(),
  },
}))

jest.mock('../src/services/email.js', () => ({
  __esModule: true,
  default: {
    sendEmail: jest.fn(),
  },
}))

import queueManager from '../src/services/queue-manager.js'
import emailService from '../src/services/email.js'
import { AlertNotifierService } from '../src/services/alert-notifier.js'

describe('AlertNotifierService', () => {
  let service

  beforeEach(() => {
    emailService.sendEmail.mockResolvedValue({ success: true })
    queueManager.addJob.mockResolvedValue({ id: 'job-123' })
    global.fetch = jest.fn(() => Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: () => Promise.resolve('OK'),
    }))
    service = new AlertNotifierService()
  })

  afterEach(() => {
    if (service?.cleanupInterval) {
      clearInterval(service.cleanupInterval)
    }
    jest.clearAllMocks()
    delete global.fetch
  })

  test('dispatches critical alert to all configured channels', async () => {
    const alert = {
      type: 'queue_depth',
      severity: 'critical',
      message: 'Queue backlog exceeded threshold',
      queueName: 'email-jobs',
    }

    const result = await service.dispatchAlert(alert, { origin: 'unit-test' })

    expect(result.dispatched).toBe(true)
    expect(emailService.sendEmail).toHaveBeenCalledTimes(1)
    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(global.fetch.mock.calls[0][0]).toBe('https://slack.example.com')
    expect(global.fetch.mock.calls[1][0]).toBe('https://events.pagerduty.com/v2/enqueue')
  })

  test('deduplicates identical alerts within the configured window', async () => {
    const alert = {
      type: 'queue_depth',
      severity: 'critical',
      message: 'Queue backlog exceeded threshold',
      queueName: 'email-jobs',
    }

    const first = await service.notify(alert, { bypassQueue: true })
    expect(first.dispatched).toBe(true)

    await new Promise(resolve => setTimeout(resolve, 10))

    const second = await service.notify(alert)
    expect(second.skipped).toBe(true)
    expect(second.reason).toBe('deduplicated')
    expect(service.metrics.deduplicated).toBe(1)
  })

  test('queues alert when BullMQ feature flag is enabled', async () => {
    service.features.useBullMQQueues = true
    queueManager.addJob.mockResolvedValueOnce({ id: 'job-999' })

    const result = await service.notify({
      type: 'failed_jobs',
      severity: 'critical',
      message: 'More than 10 failed jobs detected',
      queueName: 'critical-jobs',
    })

    expect(result.queued).toBe(true)
    expect(result.jobId).toBe('job-999')
    expect(queueManager.addJob).toHaveBeenCalledWith(
      'alert-notifications',
      expect.objectContaining({ alert: expect.any(Object) }),
      expect.objectContaining({ attempts: expect.any(Number) }),
    )
    expect(emailService.sendEmail).not.toHaveBeenCalled()
  })
})
