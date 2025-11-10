/**
 * Test Admin Queue Management Endpoints
 *
 * Validates admin queue API functionality
 */

import config from '../src/config/index.js'

const API_BASE = process.env.API_URL || 'http://localhost:3001'
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'test-admin-token'

console.log('🧪 Testing Admin Queue Management API')
console.log('='.repeat(50))
console.log(`API Base: ${API_BASE}`)
console.log(`BullMQ Enabled: ${config.features.useBullMQQueues}`)
console.log('='.repeat(50))

/**
 * Make authenticated admin API request
 */
async function adminRequest(endpoint, method = 'GET', body = null) {
  const url = `${API_BASE}/api/admin${endpoint}`
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${ADMIN_TOKEN}`,
      'Content-Type': 'application/json'
    }
  }

  if (body) {
    options.body = JSON.stringify(body)
  }

  try {
    const response = await fetch(url, options)
    const data = await response.json()
    return { status: response.status, data }
  } catch (error) {
    return { status: 0, error: error.message }
  }
}

async function runTests() {
  try {
    // Test 1: Get queue health
    console.log('\n1️⃣  Testing GET /api/admin/queues/health')
    const healthResult = await adminRequest('/queues/health')
    console.log(`   Status: ${healthResult.status}`)
    console.log(`   Enabled: ${healthResult.data?.data?.enabled}`)
    console.log(`   Mode: ${healthResult.data?.data?.mode}`)

    if (!config.features.useBullMQQueues) {
      console.log('\n⚠️  BullMQ is disabled - skipping queue tests')
      console.log('   Set USE_BULLMQ_QUEUES=true to test queue management')
      process.exit(0)
    }

    // Test 2: Get all queues
    console.log('\n2️⃣  Testing GET /api/admin/queues')
    const queuesResult = await adminRequest('/queues')
    console.log(`   Status: ${queuesResult.status}`)
    console.log(`   Total Queues: ${queuesResult.data?.data?.totalQueues || 0}`)
    if (queuesResult.data?.data?.queues) {
      queuesResult.data.data.queues.forEach(q => {
        console.log(`   - ${q.name}: ${q.waiting} waiting, ${q.active} active, ${q.completed} completed, ${q.failed} failed`)
      })
    }

    // Test 3: Get specific queue stats
    if (queuesResult.data?.data?.queues?.length > 0) {
      const queueName = queuesResult.data.data.queues[0].name
      console.log(`\n3️⃣  Testing GET /api/admin/queues/${queueName}/stats`)
      const statsResult = await adminRequest(`/queues/${queueName}/stats`)
      console.log(`   Status: ${statsResult.status}`)
      console.log(`   Queue: ${statsResult.data?.data?.name}`)
      console.log(`   Waiting: ${statsResult.data?.data?.waiting}`)
      console.log(`   Active: ${statsResult.data?.data?.active}`)
      console.log(`   Completed: ${statsResult.data?.data?.completed}`)
      console.log(`   Failed: ${statsResult.data?.data?.failed}`)

      // Test 4: Pause queue
      console.log(`\n4️⃣  Testing POST /api/admin/queues/${queueName}/pause`)
      const pauseResult = await adminRequest(`/queues/${queueName}/pause`, 'POST')
      console.log(`   Status: ${pauseResult.status}`)
      console.log(`   Message: ${pauseResult.data?.message}`)

      // Test 5: Resume queue
      console.log(`\n5️⃣  Testing POST /api/admin/queues/${queueName}/resume`)
      const resumeResult = await adminRequest(`/queues/${queueName}/resume`, 'POST')
      console.log(`   Status: ${resumeResult.status}`)
      console.log(`   Message: ${resumeResult.data?.message}`)

      // Test 6: Clear failed jobs (if any)
      if (statsResult.data?.data?.failed > 0) {
        console.log(`\n6️⃣  Testing DELETE /api/admin/queues/${queueName}/failed`)
        const clearResult = await adminRequest(`/queues/${queueName}/failed`, 'DELETE')
        console.log(`   Status: ${clearResult.status}`)
        console.log(`   Cleared: ${clearResult.data?.clearedCount || 0} jobs`)
      } else {
        console.log(`\n6️⃣  Skipping clear failed jobs (no failed jobs)`)
      }
    }

    console.log('\n' + '='.repeat(50))
    console.log('✅ All admin queue API tests completed!')
    console.log('='.repeat(50))

    process.exit(0)
  } catch (error) {
    console.error('\n❌ Test failed:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// Run tests
runTests()
