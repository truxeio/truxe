#!/usr/bin/env node
/**
 * Email Alert Notification Test
 *
 * Tests critical email alerts which should be sent to configured recipients.
 * Email alerts are only sent for CRITICAL severity alerts.
 */

import config from './src/config/index.js'
import alertNotifier from './src/services/alert-notifier.js'

console.log('📧 Truxe Email Alert Test\n')
console.log('=' .repeat(60))

// Display email configuration
console.log('\n📋 Email Alert Configuration:')
console.log('  Global enabled:', config.alertNotifications.enabled)
console.log('  Email channel enabled:', config.alertNotifications.channels.email.enabled)
console.log('  Recipients:', config.alertNotifications.channels.email.recipients)
console.log('  Email provider:', config.email.provider)
console.log('  From address:', config.email.from)
console.log('  From name:', config.email.fromName)

if (!config.alertNotifications.channels.email.enabled) {
  console.error('\n❌ Email alerts are disabled!')
  console.error('Set ALERT_EMAIL_ENABLED=true in .env')
  process.exit(1)
}

if (config.alertNotifications.channels.email.recipients.length === 0) {
  console.error('\n❌ No email recipients configured!')
  console.error('Set ALERT_EMAIL_RECIPIENTS=your.email@example.com in .env')
  process.exit(1)
}

console.log('\n' + '='.repeat(60))
console.log('📨 Sending Test Email Alerts...\n')

// Test critical alerts (should trigger email)
const criticalAlerts = [
  {
    type: 'system',
    severity: 'critical',
    title: '🚨 Database Connection Failure',
    message: 'Primary database connection pool exhausted. Immediate attention required.',
    source: 'database-monitor',
    queueName: 'system-health',
    metadata: {
      test: true,
      component: 'database',
      connectionAttempts: 5,
      lastError: 'ETIMEDOUT',
      impact: 'All write operations failing'
    }
  },
  {
    type: 'security',
    severity: 'critical',
    title: '🔒 Security Incident Detected',
    message: 'Multiple failed authentication attempts from suspicious IP addresses detected.',
    source: 'security-monitor',
    queueName: 'security-events',
    metadata: {
      test: true,
      component: 'security',
      ipAddress: '192.168.1.100',
      attemptCount: 50,
      timeWindow: '5 minutes',
      action: 'IP temporarily blocked'
    }
  },
  {
    type: 'performance',
    severity: 'critical',
    title: '⚡ System Performance Degradation',
    message: 'API response times exceeding 5 seconds. Service degradation in progress.',
    source: 'performance-monitor',
    queueName: 'api-health',
    metadata: {
      test: true,
      component: 'api',
      avgResponseTime: '5234ms',
      p95ResponseTime: '8901ms',
      affectedEndpoints: ['/api/auth/login', '/api/auth/verify'],
      queueDepth: 1500
    }
  }
]

// Test non-critical alerts (should NOT trigger email)
const nonCriticalAlerts = [
  {
    type: 'system',
    severity: 'warning',
    title: '⚠️ High Memory Usage',
    message: 'Memory usage at 85% - monitoring',
    source: 'system-monitor',
    queueName: 'system-health',
    metadata: { test: true, severity: 'warning' }
  },
  {
    type: 'system',
    severity: 'info',
    title: 'ℹ️ Scheduled Maintenance Notice',
    message: 'Database backup completed successfully',
    source: 'maintenance-scheduler',
    queueName: 'maintenance',
    metadata: { test: true, severity: 'info' }
  }
]

async function runTests() {
  console.log('🔴 CRITICAL ALERTS (should send to email + Slack):')
  console.log('-'.repeat(60))

  for (const alert of criticalAlerts) {
    console.log(`\n${alert.title}`)
    try {
      const result = await alertNotifier.notify(alert)
      console.log(`  ✅ Queued: Job ${result.jobId}`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    } catch (error) {
      console.error(`  ❌ Failed: ${error.message}`)
    }
  }

  console.log('\n\n' + '='.repeat(60))
  console.log('🟡 NON-CRITICAL ALERTS (should send to Slack only):')
  console.log('-'.repeat(60))

  for (const alert of nonCriticalAlerts) {
    console.log(`\n${alert.title}`)
    try {
      const result = await alertNotifier.notify(alert)
      console.log(`  ✅ Queued: Job ${result.jobId}`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    } catch (error) {
      console.error(`  ❌ Failed: ${error.message}`)
    }
  }

  console.log('\n\n' + '='.repeat(60))
  console.log('✅ All test alerts sent!\n')

  console.log('📬 Expected Results:')
  console.log('  • 3 critical alerts → Email + Slack')
  console.log('  • 2 non-critical alerts → Slack only')
  console.log('')
  console.log('📧 Check your email:', config.alertNotifications.channels.email.recipients.join(', '))
  console.log('💬 Check Slack channel:', config.alertNotifications.channels.slack.channel)
  console.log('')
  console.log('⏱️  Emails may take 1-2 minutes to arrive')
  console.log('=' .repeat(60))

  process.exit(0)
}

runTests().catch(error => {
  console.error('\n❌ Test failed:', error)
  process.exit(1)
})
