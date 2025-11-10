#!/usr/bin/env node
/**
 * Background Worker Process
 *
 * Standalone Node.js process that processes background jobs from BullMQ queues.
 * This worker should be run separately from the API server for better resource isolation.
 *
 * Usage:
 *   node src/queues/workers/worker.js
 *   npm run worker
 */

import queueManager from '../../services/queue-manager.js'
import {
  sessionCleanupProcessor,
  emailProcessor,
  webhookProcessor,
  alertNotificationsProcessor,
} from '../processors/index.js'

console.log('🚀 Starting Heimdall Background Worker...')
console.log('=====================================')

// Worker configuration
const WORKER_CONFIG = {
  'session-cleanup': {
    processor: sessionCleanupProcessor,
    concurrency: 1, // Only 1 cleanup job at a time
    limiter: {
      max: 10,
      duration: 60000, // Max 10 jobs per minute
    },
  },
  email: {
    processor: emailProcessor,
    concurrency: 5, // 5 concurrent email jobs
    limiter: {
      max: 100,
      duration: 1000, // Max 100 emails per second
    },
  },
  webhook: {
    processor: webhookProcessor,
    concurrency: 3, // 3 concurrent webhook deliveries
    limiter: {
      max: 50,
      duration: 1000, // Max 50 webhooks per second
    },
  },
  'alert-notifications': {
    processor: alertNotificationsProcessor,
    concurrency: 4, // Fan-out notifications across channels
    limiter: {
      max: 60,
      duration: 1000, // Max 60 notifications per second
    },
  },
}

// Initialize workers
async function startWorkers() {
  try {
    console.log('\n📋 Registering workers...')

    for (const [queueName, config] of Object.entries(WORKER_CONFIG)) {
      console.log(`  ✓ ${queueName} worker (concurrency: ${config.concurrency})`)

      queueManager.createWorker(queueName, config.processor, {
        concurrency: config.concurrency,
        limiter: config.limiter,
      })
    }

    console.log('\n✅ All workers registered and ready')
    console.log('📊 Worker is now processing jobs...\n')

    // Health check every 60 seconds
    setInterval(async () => {
      const health = await queueManager.healthCheck()
      console.log('\n💓 Health Check:', {
        status: health.status,
        queues: Object.keys(health.queues).length,
        workers: health.workerCount,
      })
    }, 60000)
  } catch (error) {
    console.error('❌ Error starting workers:', error)
    process.exit(1)
  }
}

// Graceful shutdown handling
async function shutdown(signal) {
  console.log(`\n⚠️  Received ${signal}, shutting down gracefully...`)

  try {
    await queueManager.shutdown(30000) // 30 second timeout
    console.log('✅ Worker shutdown complete')
    process.exit(0)
  } catch (error) {
    console.error('❌ Error during shutdown:', error)
    process.exit(1)
  }
}

// Handle shutdown signals
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error)
  shutdown('uncaughtException')
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason)
  shutdown('unhandledRejection')
})

// Start the workers
startWorkers()
