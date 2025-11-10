/**
 * Queue Manager Service
 *
 * Centralized management of BullMQ queues and workers for background job processing.
 * Provides a clean interface for adding jobs, monitoring queues, and managing workers.
 */

import { Queue, Worker, QueueEvents } from 'bullmq'
import config from '../config/index.js'

class QueueManager {
  constructor() {
    this.queues = new Map()
    this.workers = new Map()
    this.queueEvents = new Map()
    this.isShuttingDown = false

    // Redis connection configuration from existing config
    this.connection = {
      host: config.redis.url.split(':')[1].replace('//', ''),
      port: parseInt(config.redis.url.split(':')[2]) || 6379,
      maxRetriesPerRequest: null, // BullMQ requirement
      enableReadyCheck: false,
      password: config.redis.password || undefined,
    }

    // Default job options
    this.defaultJobOptions = {
      removeOnComplete: {
        count: 100, // Keep last 100 completed jobs
        age: 24 * 3600, // Keep for 24 hours
      },
      removeOnFail: {
        count: 1000, // Keep last 1000 failed jobs
        age: 7 * 24 * 3600, // Keep for 7 days
      },
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    }
  }

  /**
   * Create or get a queue
   * @param {string} name - Queue name
   * @param {Object} options - Queue options
   * @returns {Queue} BullMQ Queue instance
   */
  createQueue(name, options = {}) {
    if (this.queues.has(name)) {
      return this.queues.get(name)
    }

    const queue = new Queue(name, {
      connection: this.connection,
      defaultJobOptions: {
        ...this.defaultJobOptions,
        ...options.defaultJobOptions,
      },
      ...options,
    })

    // Setup queue events for monitoring
    const queueEvents = new QueueEvents(name, {
      connection: this.connection,
    })

    queueEvents.on('completed', ({ jobId }) => {
      console.log(`[Queue:${name}] Job ${jobId} completed`)
    })

    queueEvents.on('failed', ({ jobId, failedReason }) => {
      console.error(`[Queue:${name}] Job ${jobId} failed:`, failedReason)
    })

    this.queues.set(name, queue)
    this.queueEvents.set(name, queueEvents)

    return queue
  }

  /**
   * Get an existing queue
   * @param {string} name - Queue name
   * @returns {Queue|null} Queue instance or null
   */
  getQueue(name) {
    return this.queues.get(name) || null
  }

  /**
   * Add a job to a queue
   * @param {string} queueName - Queue name
   * @param {Object} data - Job data
   * @param {Object} options - Job options (priority, delay, etc.)
   * @returns {Promise<Job>} BullMQ Job instance
   */
  async addJob(queueName, data = {}, options = {}) {
    let queue = this.getQueue(queueName)

    if (!queue) {
      queue = this.createQueue(queueName)
    }

    const job = await queue.add(queueName, data, options)
    return job
  }

  /**
   * Create a worker to process jobs from a queue
   * @param {string} name - Queue/Worker name
   * @param {Function} processor - Job processor function
   * @param {Object} options - Worker options
   * @returns {Worker} BullMQ Worker instance
   */
  createWorker(name, processor, options = {}) {
    if (this.workers.has(name)) {
      console.warn(`Worker ${name} already exists`)
      return this.workers.get(name)
    }

    const worker = new Worker(name, processor, {
      connection: this.connection,
      concurrency: options.concurrency || 1,
      limiter: options.limiter,
      ...options,
    })

    // Worker event handlers
    worker.on('completed', (job) => {
      console.log(`[Worker:${name}] Completed job ${job.id}`)
    })

    worker.on('failed', (job, err) => {
      console.error(`[Worker:${name}] Failed job ${job?.id}:`, err.message)
    })

    worker.on('error', (err) => {
      console.error(`[Worker:${name}] Error:`, err)
    })

    this.workers.set(name, worker)
    return worker
  }

  /**
   * Get queue statistics and metrics
   * @param {string} name - Queue name
   * @returns {Promise<Object>} Queue metrics
   */
  async getQueueMetrics(name) {
    const queue = this.getQueue(name)
    if (!queue) {
      return null
    }

    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.isPaused(),
    ])

    return {
      name,
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused,
      total: waiting + active + delayed,
    }
  }

  /**
   * Get all queue metrics
   * @returns {Promise<Array>} Array of queue metrics
   */
  async getAllQueueMetrics() {
    const metrics = []

    for (const [name, queue] of this.queues) {
      const queueMetrics = await this.getQueueMetrics(name)
      metrics.push(queueMetrics)
    }

    return metrics
  }

  /**
   * Pause a queue
   * @param {string} name - Queue name
   */
  async pauseQueue(name) {
    const queue = this.getQueue(name)
    if (queue) {
      await queue.pause()
    }
  }

  /**
   * Resume a paused queue
   * @param {string} name - Queue name
   */
  async resumeQueue(name) {
    const queue = this.getQueue(name)
    if (queue) {
      await queue.resume()
    }
  }

  /**
   * Clean old jobs from a queue
   * @param {string} name - Queue name
   * @param {number} grace - Grace period in milliseconds
   * @param {string} status - Job status to clean (completed, failed, etc.)
   */
  async cleanQueue(name, grace = 0, status = 'completed') {
    const queue = this.getQueue(name)
    if (queue) {
      await queue.clean(grace, 1000, status)
    }
  }

  /**
   * Graceful shutdown - close all queues and workers
   * @param {number} timeout - Shutdown timeout in milliseconds
   */
  async shutdown(timeout = 30000) {
    if (this.isShuttingDown) {
      console.log('Shutdown already in progress')
      return
    }

    this.isShuttingDown = true
    console.log('🛑 Shutting down Queue Manager...')

    const shutdownPromises = []

    // Close all workers first (stop processing new jobs)
    for (const [name, worker] of this.workers) {
      console.log(`  Closing worker: ${name}`)
      shutdownPromises.push(
        worker.close().catch((err) => {
          console.error(`  Error closing worker ${name}:`, err.message)
        })
      )
    }

    // Close all queue events
    for (const [name, queueEvents] of this.queueEvents) {
      console.log(`  Closing queue events: ${name}`)
      shutdownPromises.push(
        queueEvents.close().catch((err) => {
          console.error(`  Error closing queue events ${name}:`, err.message)
        })
      )
    }

    // Close all queues
    for (const [name, queue] of this.queues) {
      console.log(`  Closing queue: ${name}`)
      shutdownPromises.push(
        queue.close().catch((err) => {
          console.error(`  Error closing queue ${name}:`, err.message)
        })
      )
    }

    // Wait for all shutdowns with timeout
    await Promise.race([
      Promise.all(shutdownPromises),
      new Promise((resolve) => setTimeout(resolve, timeout)),
    ])

    this.queues.clear()
    this.workers.clear()
    this.queueEvents.clear()

    console.log('✅ Queue Manager shutdown complete')
  }

  /**
   * Health check for queue system
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    const queues = {}
    let healthy = true

    for (const [name, queue] of this.queues) {
      try {
        await queue.client.ping()
        const metrics = await this.getQueueMetrics(name)

        queues[name] = {
          status: 'healthy',
          metrics,
        }
      } catch (error) {
        healthy = false
        queues[name] = {
          status: 'unhealthy',
          error: error.message,
        }
      }
    }

    return {
      status: healthy ? 'healthy' : 'degraded',
      queues,
      workerCount: this.workers.size,
      queueCount: this.queues.size,
    }
  }
}

// Export singleton instance
export default new QueueManager()
