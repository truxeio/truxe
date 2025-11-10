#!/usr/bin/env node
/**
 * Direct Alert Test
 * Tests the alert notification system directly without requiring authentication
 */

import alertNotifier from './src/services/alert-notifier.js'

console.log('🧪 Testing Alert Notification System...\n')

const testAlert = {
  type: 'system',
  severity: 'info',
  title: 'Alert System Test',
  message: 'This is a test alert from Truxe Alert System',
  metadata: {
    test: true,
    timestamp: new Date().toISOString(),
    component: 'direct-test'
  }
}

try {
  console.log('📤 Sending test alert...')
  const result = await alertNotifier.notify(testAlert)

  console.log('\n✅ Alert sent successfully!')
  console.log('Result:', JSON.stringify(result, null, 2))

  console.log('\n📋 Check your notification channels:')
  console.log('  📧 Email: Check your configured email addresses')
  console.log('  💬 Slack: Check your #alerts channel')
  console.log('  🔔 PagerDuty: Check your incidents')

  process.exit(0)
} catch (error) {
  console.error('\n❌ Alert test failed:', error.message)
  console.error(error)
  process.exit(1)
}
