#!/usr/bin/env node
/**
 * Verbose Alert Test with Configuration Check
 */

import config from './src/config/index.js'
import alertNotifier from './src/services/alert-notifier.js'

console.log('🧪 Truxe Alert Notification Test\n')

console.log('📋 Alert Configuration:')
console.log('  Enabled:', config.alertNotifications.enabled)
console.log('  Channels:')
console.log('    Email:')
console.log('      Enabled:', config.alertNotifications.channels.email.enabled)
console.log('      Recipients:', config.alertNotifications.channels.email.recipients)
console.log('    Slack:')
console.log('      Enabled:', config.alertNotifications.channels.slack.enabled)
console.log('      Webhook:', config.alertNotifications.channels.slack.webhookUrl ? '✅ Configured' : '❌ Missing')
console.log('      Channel:', config.alertNotifications.channels.slack.channel)
console.log('    PagerDuty:')
console.log('      Enabled:', config.alertNotifications.channels.pagerDuty.enabled)
console.log('      Key:', config.alertNotifications.channels.pagerDuty.integrationKey ? '✅ Configured' : '❌ Missing')
console.log('')

// Test alerts with different severities
const testAlerts = [
  {
    type: 'system',
    severity: 'info',
    title: '📘 Info Alert Test',
    message: 'This is an informational alert (should go to Slack only)',
    metadata: { test: 'info' }
  },
  {
    type: 'security',
    severity: 'warning',
    title: '⚠️ Warning Alert Test',
    message: 'This is a warning alert (should go to Slack only)',
    metadata: { test: 'warning' }
  },
  {
    type: 'security',
    severity: 'critical',
    title: '🚨 Critical Alert Test',
    message: 'This is a CRITICAL alert (should go to Slack AND Email)',
    metadata: { test: 'critical' }
  }
]

async function runTests() {
  for (const alert of testAlerts) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`Testing: ${alert.title}`)
    console.log(`Severity: ${alert.severity}`)
    console.log(`${'='.repeat(60)}`)

    try {
      const result = await alertNotifier.notify(alert)
      console.log('✅ Result:', JSON.stringify(result, null, 2))

      // Wait for worker to process
      await new Promise(resolve => setTimeout(resolve, 2000))

    } catch (error) {
      console.error('❌ Error:', error.message)
    }
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log('📊 Final Metrics:')
  console.log(JSON.stringify(alertNotifier.getMetrics(), null, 2))
  console.log(`${'='.repeat(60)}`)

  console.log('\n✅ Test complete! Check your notification channels:')
  console.log('  💬 Slack: Check #alerts channel')
  console.log('  📧 Email: Check configured email addresses (critical only)')

  process.exit(0)
}

runTests().catch(error => {
  console.error('Test failed:', error)
  process.exit(1)
})
