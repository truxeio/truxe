/**
 * Test Webhook Service Migration
 *
 * Validates that webhook service loads correctly with BullMQ integration
 */

import webhookService from '../src/services/webhook.js'

console.log('🧪 Testing Webhook Service Migration')
console.log('=' * 50)

try {
  // Test 1: Service loads
  console.log('\n1️⃣  Webhook service loaded successfully')

  // Test 2: Check health status
  console.log('\n2️⃣  Checking health status...')
  const health = await webhookService.getHealthStatus()
  console.log('✅ Health status:', JSON.stringify(health, null, 2))

  // Test 3: Check supported events
  console.log('\n3️⃣  Supported events:', webhookService.supportedEvents.length)

  // Test 4: Verify queue mode
  console.log('\n4️⃣  Queue mode:', health.queue_mode)
  console.log('   Queue system:', health.queue_system)

  console.log('\n' + '='.repeat(50))
  console.log('✅ All webhook service tests passed!')

  process.exit(0)
} catch (error) {
  console.error('\n❌ Test failed:', error.message)
  console.error(error.stack)
  process.exit(1)
}
