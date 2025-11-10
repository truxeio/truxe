/**
 * Scheduled Jobs Service
 *
 * Manages recurring background jobs using BullMQ repeatable jobs.
 * Provides cron-like scheduling for maintenance and periodic tasks.
 *
 * Job Types:
 * - Hourly: Session cleanup, metrics collection
 * - Daily: JTI cleanup, webhook delivery cleanup, database optimization
 * - Weekly: Security log archival, statistics aggregation
 */

import config from '../config/index.js'
import queueManager from './queue-manager.js'

export class ScheduledJobsService {
  constructor() {
    this.enabled = config.features.useBullMQQueues || false
    this.jobs = new Map()

    console.log(`Scheduled jobs service initialized (enabled: ${this.enabled})`)
  }

  /**
   * Initialize all scheduled jobs
   */
  async initialize() {
    if (!this.enabled) {
      console.log('Scheduled jobs disabled (USE_BULLMQ_QUEUES=false)')
      return
    }

    try {
      // Hourly jobs
      await this.scheduleHourlySessionCleanup()

      // Daily jobs
      await this.scheduleDailyJTICleanup()
      await this.scheduleDailyWebhookCleanup()
      await this.scheduleDailyMetricsAggregation()

      // Weekly jobs
      await this.scheduleWeeklySecurityArchival()
      await this.scheduleWeeklyStatisticsReport()

      console.log(`✅ Scheduled ${this.jobs.size} recurring jobs`)
      this.logScheduledJobs()
    } catch (error) {
      console.error('Failed to initialize scheduled jobs:', error.message)
      throw error
    }
  }

  /**
   * Schedule hourly session cleanup
   * Cleans expired sessions, JTI blacklist, and old activity logs
   */
  async scheduleHourlySessionCleanup() {
    const queue = queueManager.getQueue('session-cleanup') || queueManager.createQueue('session-cleanup')

    const job = await queue.add(
      'hourly-cleanup',
      {
        type: 'scheduled',
        schedule: 'hourly'
      },
      {
        repeat: {
          pattern: '0 * * * *', // Every hour at :00
        },
        jobId: 'scheduled-hourly-session-cleanup',
        removeOnComplete: { count: 24, age: 86400 }, // Keep last 24 hours
        removeOnFail: { count: 100, age: 604800 }, // Keep failed jobs for 7 days
      }
    )

    this.jobs.set('hourly-session-cleanup', {
      name: 'Hourly Session Cleanup',
      schedule: 'Every hour at :00',
      queue: 'session-cleanup',
      jobId: job.id,
    })

    console.log('✅ Scheduled: Hourly session cleanup')
  }

  /**
   * Schedule daily JTI cleanup
   * Removes expired JTI blacklist entries at 2 AM daily
   */
  async scheduleDailyJTICleanup() {
    const queue = queueManager.getQueue('session-cleanup') || queueManager.createQueue('session-cleanup')

    const job = await queue.add(
      'daily-jti-cleanup',
      {
        type: 'scheduled',
        schedule: 'daily',
        task: 'jti-cleanup'
      },
      {
        repeat: {
          pattern: '0 2 * * *', // Daily at 2:00 AM
        },
        jobId: 'scheduled-daily-jti-cleanup',
        removeOnComplete: { count: 30, age: 2592000 }, // Keep last 30 days
        removeOnFail: { count: 50, age: 604800 },
      }
    )

    this.jobs.set('daily-jti-cleanup', {
      name: 'Daily JTI Cleanup',
      schedule: 'Daily at 2:00 AM',
      queue: 'session-cleanup',
      jobId: job.id,
    })

    console.log('✅ Scheduled: Daily JTI cleanup')
  }

  /**
   * Schedule daily webhook delivery cleanup
   * Removes old webhook delivery records at 3 AM daily
   */
  async scheduleDailyWebhookCleanup() {
    const queue = queueManager.getQueue('webhook') || queueManager.createQueue('webhook')

    const job = await queue.add(
      'daily-webhook-cleanup',
      {
        type: 'scheduled',
        schedule: 'daily',
        task: 'webhook-cleanup',
        retentionDays: 30 // Keep webhook deliveries for 30 days
      },
      {
        repeat: {
          pattern: '0 3 * * *', // Daily at 3:00 AM
        },
        jobId: 'scheduled-daily-webhook-cleanup',
        removeOnComplete: { count: 30 },
        removeOnFail: { count: 50 },
      }
    )

    this.jobs.set('daily-webhook-cleanup', {
      name: 'Daily Webhook Cleanup',
      schedule: 'Daily at 3:00 AM',
      queue: 'webhook',
      jobId: job.id,
    })

    console.log('✅ Scheduled: Daily webhook cleanup')
  }

  /**
   * Schedule daily metrics aggregation
   * Aggregates daily statistics at 4 AM daily
   */
  async scheduleDailyMetricsAggregation() {
    const queue = queueManager.getQueue('metrics') || queueManager.createQueue('metrics')

    const job = await queue.add(
      'daily-metrics',
      {
        type: 'scheduled',
        schedule: 'daily',
        task: 'metrics-aggregation'
      },
      {
        repeat: {
          pattern: '0 4 * * *', // Daily at 4:00 AM
        },
        jobId: 'scheduled-daily-metrics',
        removeOnComplete: { count: 30 },
        removeOnFail: { count: 50 },
      }
    )

    this.jobs.set('daily-metrics', {
      name: 'Daily Metrics Aggregation',
      schedule: 'Daily at 4:00 AM',
      queue: 'metrics',
      jobId: job.id,
    })

    console.log('✅ Scheduled: Daily metrics aggregation')
  }

  /**
   * Schedule weekly security log archival
   * Archives old security logs every Sunday at 1 AM
   */
  async scheduleWeeklySecurityArchival() {
    const queue = queueManager.getQueue('archival') || queueManager.createQueue('archival')

    const job = await queue.add(
      'weekly-security-archival',
      {
        type: 'scheduled',
        schedule: 'weekly',
        task: 'security-archival',
        archivalPeriodDays: 90 // Archive logs older than 90 days
      },
      {
        repeat: {
          pattern: '0 1 * * 0', // Every Sunday at 1:00 AM
        },
        jobId: 'scheduled-weekly-security-archival',
        removeOnComplete: { count: 12 }, // Keep last 12 weeks
        removeOnFail: { count: 20 },
      }
    )

    this.jobs.set('weekly-security-archival', {
      name: 'Weekly Security Log Archival',
      schedule: 'Every Sunday at 1:00 AM',
      queue: 'archival',
      jobId: job.id,
    })

    console.log('✅ Scheduled: Weekly security archival')
  }

  /**
   * Schedule weekly statistics report
   * Generates weekly statistics every Monday at 9 AM
   */
  async scheduleWeeklyStatisticsReport() {
    const queue = queueManager.getQueue('reports') || queueManager.createQueue('reports')

    const job = await queue.add(
      'weekly-statistics',
      {
        type: 'scheduled',
        schedule: 'weekly',
        task: 'statistics-report'
      },
      {
        repeat: {
          pattern: '0 9 * * 1', // Every Monday at 9:00 AM
        },
        jobId: 'scheduled-weekly-statistics',
        removeOnComplete: { count: 12 },
        removeOnFail: { count: 20 },
      }
    )

    this.jobs.set('weekly-statistics', {
      name: 'Weekly Statistics Report',
      schedule: 'Every Monday at 9:00 AM',
      queue: 'reports',
      jobId: job.id,
    })

    console.log('✅ Scheduled: Weekly statistics report')
  }

  /**
   * Get all scheduled jobs
   * @returns {Array} List of scheduled jobs
   */
  getScheduledJobs() {
    return Array.from(this.jobs.entries()).map(([key, value]) => ({
      id: key,
      ...value,
    }))
  }

  /**
   * Remove a scheduled job
   * @param {string} jobKey - Job identifier
   */
  async removeScheduledJob(jobKey) {
    if (!this.jobs.has(jobKey)) {
      throw new Error(`Scheduled job not found: ${jobKey}`)
    }

    const job = this.jobs.get(jobKey)
    const queue = queueManager.getQueue(job.queue)

    if (queue) {
      await queue.removeRepeatable('repeatable', {
        jobId: job.jobId,
      })
    }

    this.jobs.delete(jobKey)
    console.log(`Removed scheduled job: ${jobKey}`)
  }

  /**
   * Log all scheduled jobs
   */
  logScheduledJobs() {
    console.log('\n📅 Scheduled Jobs:')
    console.log('━'.repeat(70))

    for (const [key, job] of this.jobs) {
      console.log(`  ${job.name}`)
      console.log(`    Schedule: ${job.schedule}`)
      console.log(`    Queue: ${job.queue}`)
      console.log(`    ID: ${key}`)
      console.log()
    }

    console.log('━'.repeat(70))
  }

  /**
   * Get scheduled jobs status
   * @returns {Object} Status information
   */
  async getStatus() {
    if (!this.enabled) {
      return {
        enabled: false,
        message: 'Scheduled jobs are disabled',
      }
    }

    const jobs = this.getScheduledJobs()

    // Get next run times from queues
    const jobsWithNextRun = await Promise.all(
      jobs.map(async (job) => {
        try {
          const queue = queueManager.getQueue(job.queue)
          if (queue) {
            const repeatableJobs = await queue.getRepeatableJobs()
            const repeatableJob = repeatableJobs.find(rj => rj.id === job.jobId)

            return {
              ...job,
              nextRunTime: repeatableJob?.next ? new Date(repeatableJob.next).toISOString() : null,
            }
          }
          return job
        } catch (error) {
          return { ...job, error: error.message }
        }
      })
    )

    return {
      enabled: true,
      totalJobs: jobs.length,
      jobs: jobsWithNextRun,
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      if (!this.enabled) {
        return {
          status: 'disabled',
          message: 'Scheduled jobs are disabled',
        }
      }

      const status = await this.getStatus()

      return {
        status: 'healthy',
        totalScheduledJobs: status.totalJobs,
        jobs: status.jobs,
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
      }
    }
  }
}

// Create singleton instance
const scheduledJobsService = new ScheduledJobsService()

// Export singleton
export default scheduledJobsService
