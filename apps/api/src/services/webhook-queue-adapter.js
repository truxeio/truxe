/**
 * Webhook Queue Adapter
 *
 * Integrates BullMQ queue system with the existing webhook service.
 * Provides backward compatibility with feature flag support.
 *
 * When USE_BULLMQ_QUEUES=true:
 * - Webhook deliveries go through BullMQ for persistence and retry
 * - Retry processing handled by BullMQ workers
 * - Better scalability and reliability
 *
 * When USE_BULLMQ_QUEUES=false:
 * - Falls back to original in-memory queue system
 * - Uses existing setInterval-based retry logic
 */

import config from '../config/index.js'
import queueManager from './queue-manager.js'

export class WebhookQueueAdapter {
  constructor() {
    this.useBullMQ = config.features.useBullMQQueues || false
    console.log(`Webhook queue adapter initialized (BullMQ: ${this.useBullMQ ? 'enabled' : 'disabled'})`)
  }

  /**
   * Queue webhook delivery
   * @param {Object} delivery - Delivery object
   * @returns {Promise<string|null>} Job ID if BullMQ, null if legacy
   */
  async queueDelivery(delivery) {
    if (!this.useBullMQ) {
      // Legacy mode - caller handles in-memory queue
      return null
    }

    // BullMQ mode - add to persistent queue
    const job = await queueManager.addJob('webhook', {
      webhookId: delivery.deliveryId,
      event: delivery.payload.event,
      payload: delivery.payload,
      url: delivery.url,
      secret: delivery.secret,
      headers: delivery.headers || {},
      allowedIps: delivery.allowedIps || [],
    }, {
      priority: delivery.priority || 5,
      attempts: delivery.maxAttempts || 3,
      backoff: {
        type: 'exponential',
        delay: 2000, // Start with 2 seconds
      },
      removeOnComplete: {
        count: 100,
        age: 24 * 3600, // 24 hours
      },
      removeOnFail: {
        count: 1000,
        age: 7 * 24 * 3600, // 7 days
      },
    })

    return job.id
  }

  /**
   * Queue webhook retry
   * @param {Object} retry - Retry object with delivery data
   * @returns {Promise<string|null>} Job ID if BullMQ, null if legacy
   */
  async queueRetry(retry) {
    if (!this.useBullMQ) {
      // Legacy mode - caller handles in-memory queue
      return null
    }

    // Calculate delay based on attempt number
    const attempt = retry.delivery_attempts || 1
    const baseDelay = 2000 // 2 seconds
    const maxDelay = 30000 // 30 seconds
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay)

    // BullMQ mode - schedule retry with delay
    const job = await queueManager.addJob('webhook', {
      webhookId: retry.id,
      event: retry.event_type,
      payload: retry.payload,
      url: retry.url,
      secret: retry.secret,
      headers: retry.headers || {},
      allowedIps: retry.allowed_ips || [],
      isRetry: true,
      attemptNumber: attempt,
    }, {
      delay, // Delayed delivery for retry
      priority: 3, // Higher priority for retries
      attempts: retry.max_attempts - attempt, // Remaining attempts
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    })

    return job.id
  }

  /**
   * Process pending retries (legacy mode only)
   * In BullMQ mode, retries are handled automatically by the worker
   *
   * @param {Function} processCallback - Callback to process each retry
   * @returns {Promise<number>} Number of retries queued
   */
  async processPendingRetries(processCallback) {
    if (this.useBullMQ) {
      // BullMQ mode - retries handled automatically, nothing to do
      return 0
    }

    // Legacy mode - call the provided callback
    return await processCallback()
  }

  /**
   * Get queue health status
   * @returns {Promise<Object>} Health status
   */
  async getQueueHealth() {
    if (!this.useBullMQ) {
      return {
        mode: 'legacy',
        queueSystem: 'in-memory',
      }
    }

    try {
      const metrics = await queueManager.getQueueMetrics('webhook')
      return {
        mode: 'bullmq',
        queueSystem: 'redis-persistent',
        ...metrics,
      }
    } catch (error) {
      return {
        mode: 'bullmq',
        queueSystem: 'redis-persistent',
        error: error.message,
        status: 'unhealthy',
      }
    }
  }

  /**
   * Clear failed jobs (BullMQ only)
   * @returns {Promise<number>} Number of jobs cleared
   */
  async clearFailedJobs() {
    if (!this.useBullMQ) {
      return 0
    }

    const queue = queueManager.getQueue('webhook')
    if (!queue) {
      return 0
    }

    const failedJobs = await queue.getFailed()
    await Promise.all(failedJobs.map(job => job.remove()))
    return failedJobs.length
  }

  /**
   * Pause webhook queue (BullMQ only)
   * @returns {Promise<boolean>} Success status
   */
  async pauseQueue() {
    if (!this.useBullMQ) {
      return false
    }

    await queueManager.pauseQueue('webhook')
    return true
  }

  /**
   * Resume webhook queue (BullMQ only)
   * @returns {Promise<boolean>} Success status
   */
  async resumeQueue() {
    if (!this.useBullMQ) {
      return false
    }

    await queueManager.resumeQueue('webhook')
    return true
  }
}

// Export singleton
const webhookQueueAdapter = new WebhookQueueAdapter()
export default webhookQueueAdapter
