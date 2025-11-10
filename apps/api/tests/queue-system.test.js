/**
 * Background Jobs Queue System Tests
 *
 * CRITICAL: These tests must pass before merging to main
 *
 * Test Coverage:
 * - Queue Manager functionality
 * - Job Processors (session, email, webhook)
 * - Worker lifecycle
 * - Restart resilience
 */

import { describe, test, expect, afterAll, jest, beforeEach } from '@jest/globals'

// Mock database before imports
const mockDb = {
  query: jest.fn(),
  pool: {
    connect: jest.fn(),
  },
}

jest.mock('../src/database/connection.js', () => ({
  getPool: () => mockDb,
  closePool: jest.fn(),
}))

// Mock email service before imports
// Note: The mock structure must match the actual module export structure
jest.mock('../src/services/email.js', () => ({
  __esModule: true,
  default: {
    sendMagicLink: jest.fn(() => Promise.resolve({ messageId: 'mock-123' })),
    sendWelcomeEmail: jest.fn(() => Promise.resolve({ messageId: 'mock-456' })),
    sendPasswordResetEmail: jest.fn(() => Promise.resolve({ messageId: 'mock-789' })),
    sendMFABackupCodes: jest.fn(() => Promise.resolve({ messageId: 'mock-mfa' })),
    sendEmail: jest.fn(() => Promise.resolve({ messageId: 'mock-direct' })),
  },
}))

// Mock fetch for webhook tests
global.fetch = jest.fn()

// Now import after mocks are in place
import queueManager from '../src/services/queue-manager.js'
import { sessionCleanupProcessor } from '../src/queues/processors/session-cleanup.processor.js'
import { emailProcessor } from '../src/queues/processors/email.processor.js'
import { webhookProcessor } from '../src/queues/processors/webhook.processor.js'
import emailService from '../src/services/email.js'

// Access the mocked email service for assertions
const mockEmailService = emailService

describe('Queue Manager', () => {
  afterAll(async () => {
    await queueManager.shutdown(5000)
  })

  describe('Queue Creation', () => {
    test('should create a new queue', () => {
      const queue = queueManager.createQueue('test-queue-create')
      expect(queue).toBeDefined()
      expect(queue.name).toBe('test-queue-create')
    })

    test('should return existing queue if already created', () => {
      const queue1 = queueManager.createQueue('test-queue-existing')
      const queue2 = queueManager.createQueue('test-queue-existing')
      expect(queue1).toBe(queue2)
    })

    test('should get queue by name', () => {
      queueManager.createQueue('test-queue-get')
      const queue = queueManager.getQueue('test-queue-get')
      expect(queue).toBeDefined()
      expect(queue.name).toBe('test-queue-get')
    })

    test('should return null for non-existent queue', () => {
      const queue = queueManager.getQueue('non-existent-queue')
      expect(queue).toBeNull()
    })
  })

  describe('Job Management', () => {
    test('should add job to queue', async () => {
      const job = await queueManager.addJob('test-jobs', { test: 'data' })
      expect(job).toBeDefined()
      expect(job.id).toBeDefined()
      expect(job.data).toEqual({ test: 'data' })
    })

    test('should add job with priority', async () => {
      const job = await queueManager.addJob(
        'test-priority',
        { test: 'priority-data' },
        { priority: 1 }
      )
      expect(job).toBeDefined()
      expect(job.opts.priority).toBe(1)
    })

    test('should add job with delay', async () => {
      const job = await queueManager.addJob(
        'test-delay',
        { test: 'delayed-data' },
        { delay: 5000 }
      )
      expect(job).toBeDefined()
      expect(job.opts.delay).toBe(5000)
    })

    test('should get queue metrics', async () => {
      await queueManager.addJob('metrics-test', { test: 'data' })
      const metrics = await queueManager.getQueueMetrics('metrics-test')

      expect(metrics).toBeDefined()
      expect(metrics.name).toBe('metrics-test')
      expect(metrics).toHaveProperty('waiting')
      expect(metrics).toHaveProperty('active')
      expect(metrics).toHaveProperty('completed')
      expect(metrics).toHaveProperty('failed')
      expect(metrics.total).toBeGreaterThanOrEqual(0)
    })

    test('should get all queue metrics', async () => {
      const metrics = await queueManager.getAllQueueMetrics()
      expect(metrics).toBeDefined()
      expect(Array.isArray(metrics)).toBe(true)
    })
  })

  describe('Worker Management', () => {
    test('should create worker', () => {
      const processorFn = jest.fn(async (job) => {
        return { success: true }
      })

      const worker = queueManager.createWorker('worker-test', processorFn)
      expect(worker).toBeDefined()
    })

    test('should process job with worker', async () => {
      let jobProcessed = false
      const processorFn = jest.fn(async (job) => {
        jobProcessed = true
        return { success: true, data: job.data }
      })

      queueManager.createWorker('worker-process-test', processorFn, { concurrency: 1 })
      await queueManager.addJob('worker-process-test', { test: 'process-data' })

      // Wait for job to be processed
      await new Promise((resolve) => setTimeout(resolve, 2000))

      expect(jobProcessed).toBe(true)
      expect(processorFn).toHaveBeenCalled()
    }, 10000)
  })

  describe('Queue Operations', () => {
    test('should pause queue', async () => {
      const queue = queueManager.createQueue('pause-test')
      await queueManager.pauseQueue('pause-test')
      const isPaused = await queue.isPaused()
      expect(isPaused).toBe(true)
    })

    test('should resume paused queue', async () => {
      const queue = queueManager.createQueue('resume-test')
      await queueManager.pauseQueue('resume-test')
      await queueManager.resumeQueue('resume-test')
      const isPaused = await queue.isPaused()
      expect(isPaused).toBe(false)
    })
  })

  describe('Health Check', () => {
    test('should return health status', async () => {
      const health = await queueManager.healthCheck()

      expect(health).toBeDefined()
      expect(health.status).toBeDefined()
      expect(['healthy', 'degraded']).toContain(health.status)
      expect(health).toHaveProperty('queues')
      expect(health).toHaveProperty('workerCount')
      expect(health).toHaveProperty('queueCount')
    })
  })
})

describe('Session Cleanup Processor', () => {
  const mockJob = {
    id: '1',
    data: {},
  }

  beforeEach(() => {
    mockDb.query.mockClear()
  })

  test('should be defined', () => {
    expect(sessionCleanupProcessor).toBeDefined()
    expect(typeof sessionCleanupProcessor).toBe('function')
  })

  test('should process session cleanup job', async () => {
    mockDb.query.mockResolvedValueOnce({ rowCount: 5 }) // sessions
    mockDb.query.mockResolvedValueOnce({ rowCount: 3 }) // jti
    mockDb.query.mockResolvedValueOnce({ rowCount: 10 }) // activity

    const result = await sessionCleanupProcessor(mockJob)

    expect(result).toBeDefined()
    expect(result.success).toBe(true)
    expect(result.expiredSessions).toBe(5)
    expect(result.expiredJtiEntries).toBe(3)
    expect(result.cleanedActivityLogs).toBe(10)
    expect(result.totalCleaned).toBe(18)
    expect(mockDb.query).toHaveBeenCalledTimes(3)
  })

  test('should handle errors gracefully', async () => {
    mockDb.query.mockRejectedValueOnce(new Error('Database error'))

    await expect(sessionCleanupProcessor(mockJob)).rejects.toThrow('Database error')
  })
})

describe('Email Processor', () => {
  const mockJob = {
    id: '2',
    data: {},
  }

  beforeEach(() => {
    // Clear mock calls between tests
    jest.clearAllMocks()
  })

  test('should be defined', () => {
    expect(emailProcessor).toBeDefined()
    expect(typeof emailProcessor).toBe('function')
  })

  test('should process magic link email', async () => {
    const job = {
      ...mockJob,
      data: {
        to: 'test@example.com',
        template: 'magic-link',
        data: { token: 'abc123' },
      },
    }

    const result = await emailProcessor(job)

    expect(result).toBeDefined()
    expect(result.success).toBe(true)
    expect(result.to).toBe('test@example.com')
    expect(mockEmailService.sendMagicLink).toHaveBeenCalledWith(
      'test@example.com',
      'abc123',
      { token: 'abc123' }
    )
  })

  test('should process welcome email', async () => {
    const job = {
      ...mockJob,
      data: {
        to: 'newuser@example.com',
        template: 'welcome',
        data: { name: 'Test User' },
      },
    }

    const result = await emailProcessor(job)

    expect(result).toBeDefined()
    expect(result.success).toBe(true)
    expect(mockEmailService.sendWelcomeEmail).toHaveBeenCalled()
  })

  test('should process direct HTML email', async () => {
    const job = {
      ...mockJob,
      data: {
        to: 'user@example.com',
        subject: 'Test Email',
        html: '<p>Test content</p>',
      },
    }

    const result = await emailProcessor(job)

    expect(result).toBeDefined()
    expect(result.success).toBe(true)
    expect(mockEmailService.sendEmail).toHaveBeenCalled()
  })

  test('should throw error for unknown template', async () => {
    const job = {
      ...mockJob,
      data: {
        to: 'test@example.com',
        template: 'unknown-template',
        data: {},
      },
    }

    await expect(emailProcessor(job)).rejects.toThrow('Unknown email template')
  })

  test('should throw error when neither template nor html provided', async () => {
    const job = {
      ...mockJob,
      data: {
        to: 'test@example.com',
      },
    }

    await expect(emailProcessor(job)).rejects.toThrow(
      'Either template or html must be provided'
    )
  })
})

describe('Webhook Processor', () => {
  const mockJob = {
    id: '3',
    data: {},
  }

  beforeEach(() => {
    mockDb.query.mockClear()
    global.fetch.mockClear()
  })

  test('should be defined', () => {
    expect(webhookProcessor).toBeDefined()
    expect(typeof webhookProcessor).toBe('function')
  })

  test('should process webhook delivery successfully', async () => {
    mockDb.query.mockResolvedValue({ rowCount: 1 })

    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => 'OK',
    })

    const job = {
      ...mockJob,
      data: {
        webhookId: '123',
        event: 'user.created',
        payload: { userId: '456' },
        url: 'https://example.com/webhook',
        secret: 'test-secret',
      },
    }

    const result = await webhookProcessor(job)

    expect(result).toBeDefined()
    expect(result.success).toBe(true)
    expect(result.webhookId).toBe('123')
    expect(result.statusCode).toBe(200)
    expect(global.fetch).toHaveBeenCalled()
  })

  test('should handle failed webhook delivery', async () => {
    mockDb.query.mockResolvedValue({ rowCount: 1 })

    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    })

    const job = {
      ...mockJob,
      data: {
        webhookId: '789',
        event: 'user.deleted',
        payload: { userId: '101' },
        url: 'https://example.com/webhook',
        secret: 'test-secret',
      },
    }

    await expect(webhookProcessor(job)).rejects.toThrow()
  })

  test('should handle network errors', async () => {
    mockDb.query.mockResolvedValue({ rowCount: 1 })

    global.fetch.mockRejectedValueOnce(new Error('Network error'))

    const job = {
      ...mockJob,
      data: {
        webhookId: '999',
        event: 'test.event',
        payload: {},
        url: 'https://example.com/webhook',
        secret: 'test-secret',
      },
    }

    await expect(webhookProcessor(job)).rejects.toThrow('Network error')
  })
})

describe('Restart Resilience', () => {
  test('should persist jobs in Redis', async () => {
    // Create a queue and add a job
    const testQueue = queueManager.createQueue('restart-resilience-test')
    const job = await testQueue.add('restart-job', { test: 'restart-data' })

    // Verify job was created
    expect(job.id).toBeDefined()
    expect(job.data).toEqual({ test: 'restart-data' })

    // Get metrics to verify job is in queue
    const metrics = await queueManager.getQueueMetrics('restart-resilience-test')
    expect(metrics.total).toBeGreaterThan(0)

    // Jobs are persisted in Redis, so they survive application restarts
    // This test verifies the job exists and has an ID (persisted)
  })
})
