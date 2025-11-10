/**
 * Test Queue System
 *
 * Simple script to test the BullMQ queue system setup
 */

import queueManager from '../src/services/queue-manager.js'
import { sessionCleanupProcessor } from '../src/queues/processors/index.js'

console.log('🧪 Testing Queue System Setup')
console.log('=' .repeat(50))

async function testQueueSystem() {
  try {
    console.log('\n1️⃣  Creating test queue...')
    const queue = queueManager.createQueue('test-queue')
    console.log('✅ Queue created:', queue.name)

    console.log('\n2️⃣  Adding test job to queue...')
    const job = await queueManager.addJob('test-queue', {
      test: 'data',
      timestamp: new Date().toISOString(),
    })
    console.log('✅ Job added with ID:', job.id)

    console.log('\n3️⃣  Getting queue metrics...')
    const metrics = await queueManager.getQueueMetrics('test-queue')
    console.log('✅ Queue metrics:', metrics)

    console.log('\n4️⃣  Creating test worker...')
    const worker = queueManager.createWorker(
      'test-queue',
      async (job) => {
        console.log(`  📋 Processing job ${job.id}:`, job.data)
        await new Promise((resolve) => setTimeout(resolve, 1000)) // Simulate work
        return { success: true, processedAt: new Date().toISOString() }
      },
      { concurrency: 1 }
    )
    console.log('✅ Worker created and listening')

    console.log('\n5️⃣  Waiting for job to process (3 seconds)...')
    await new Promise((resolve) => setTimeout(resolve, 3000))

    const finalMetrics = await queueManager.getQueueMetrics('test-queue')
    console.log('✅ Final metrics:', finalMetrics)

    console.log('\n6️⃣  Testing health check...')
    const health = await queueManager.healthCheck()
    console.log('✅ Health status:', health.status)
    console.log('   Queues:', Object.keys(health.queues))

    console.log('\n7️⃣  Cleaning up...')
    await queueManager.shutdown()
    console.log('✅ Shutdown complete')

    console.log('\n' + '='.repeat(50))
    console.log('✅ All tests passed!')
    console.log('='.repeat(50))

    process.exit(0)
  } catch (error) {
    console.error('\n❌ Test failed:', error)
    await queueManager.shutdown()
    process.exit(1)
  }
}

testQueueSystem()
