/**
 * Admin Routes for Rate Limiting Management
 * 
 * Provides administrative endpoints for:
 * - Rate limit monitoring and statistics
 * - Dynamic rate limit adjustment
 * - IP blocking/unblocking
 * - User limit management
 * - DDoS protection controls
 */

import rateLimitService from '../services/rate-limit.js'
import queueManager from '../services/queue-manager.js'
import scheduledJobsService from '../services/scheduled-jobs.js'
import queueMonitoringService from '../services/queue-monitoring.js'
import config from '../config/index.js'
import db from '../database/connection.js'
import advancedSessionSecurityService from '../services/advanced-session-security.js'
import emailQueue from '../services/email-queue-adapter.js'
import alertNotifier from '../services/alert-notifier.js'

/**
 * Admin routes plugin for Fastify
 */
export default async function adminRoutes(fastify, options) {
  // Apply rate limiting for admin routes
  const rateLimitPlugin = rateLimitService.createFastifyPlugin()
  await fastify.register(rateLimitPlugin)

  // Prefer standardized authentication + RBAC
  // Routes below will use fastify.authenticate and fastify.requireRole('admin')
  
  /**
   * Get comprehensive rate limiting statistics
   */
  fastify.get('/rate-limits/stats', async (request, reply) => {
    try {
      const stats = await rateLimitService.getStatistics()
      
      return {
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      fastify.log.error('Failed to get rate limit statistics:', error)
      return reply.code(500).send({
        error: 'Failed to retrieve statistics',
        message: error.message
      })
    }
  })

  // POST /api/admin/users/:userId/unlock
  fastify.post('/users/:userId/unlock', {
    onRequest: [fastify.authenticate],
    preHandler: [fastify.requireRole(['admin', 'owner'])],
    schema: {
      description: 'Unlock a user account (admin only)',
      tags: ['Admin'],
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
        },
        required: ['userId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                user_id: { type: 'string' },
                failed_login_attempts: { type: 'number' },
                locked_until: { type: ['string', 'null'] },
                unlocked_by: { type: 'string' },
                unlocked_at: { type: 'string' },
              },
            },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        403: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const { userId } = request.params
    const adminUserId = request.user?.id || request.tokenPayload?.user_id || null
    const ip = request.ip
    const userAgent = request.headers['user-agent'] || null

    try {
      // Verify user exists
      const res = await db.query('SELECT id, email FROM users WHERE id = $1', [userId])
      if (res.rows.length === 0) {
        return reply.code(404).send({ error: 'User not found' })
      }

      // Reset counters and unlock
      await db.query(
        `UPDATE users SET failed_login_attempts = 0, locked_until = NULL, updated_at = NOW() WHERE id = $1`,
        [userId]
      )

      // Audit log
      await advancedSessionSecurityService.logSecurityEvent({
        userId: adminUserId,
        action: 'admin.user_unlocked',
        target: { type: 'user', id: userId },
        ip,
        userAgent,
        severity: 'info',
        details: { reason: 'manual_admin_unlock' },
      })

      const unlockedEmail = res.rows[0].email
      if (unlockedEmail) {
        try {
          await emailQueue.sendAccountUnlockedNotification({
            to: unlockedEmail,
            unlockedAt: new Date(),
            unlockedBy: adminUserId,
            ipAddress: ip,
            userAgent,
          })
        } catch (error) {
          request.log?.warn({ err: error, user_id: userId }, 'Failed to send account unlocked notification email')
        }
      }

      const nowIso = new Date().toISOString()
      return reply.code(200).send({
        success: true,
        message: 'User account unlocked successfully',
        data: {
          user_id: userId,
          failed_login_attempts: 0,
          locked_until: null,
          unlocked_by: adminUserId,
          unlocked_at: nowIso,
        },
      })
    } catch (error) {
      request.log.error('Failed to unlock user account:', error)
      return reply.code(500).send({ error: 'Failed to unlock user account' })
    }
  })
  
  /**
   * Get rate limit status for specific identifiers
   */
  fastify.post('/rate-limits/check', {
    schema: {
      body: {
        type: 'object',
        properties: {
          endpoint: { type: 'string' },
          identifiers: {
            type: 'object',
            properties: {
              ip: { type: 'string' },
              user: { type: 'string' },
              email: { type: 'string' },
              token: { type: 'string' }
            }
          }
        },
        required: ['endpoint', 'identifiers']
      }
    }
  }, async (request, reply) => {
    try {
      const { endpoint, identifiers } = request.body
      
      const status = await rateLimitService.getRateLimitStatus(endpoint, identifiers)
      
      return {
        success: true,
        data: status,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      fastify.log.error('Failed to check rate limit status:', error)
      return reply.code(500).send({
        error: 'Failed to check rate limit status',
        message: error.message
      })
    }
  })
  
  /**
   * Adjust rate limits dynamically
   */
  fastify.put('/rate-limits/adjust', {
    schema: {
      body: {
        type: 'object',
        properties: {
          endpoint: { type: 'string' },
          limitType: { type: 'string' },
          newLimit: { type: 'integer', minimum: 1 },
          windowMs: { type: 'integer', minimum: 1000 }
        },
        required: ['endpoint', 'limitType', 'newLimit', 'windowMs']
      }
    }
  }, async (request, reply) => {
    try {
      const { endpoint, limitType, newLimit, windowMs } = request.body
      
      const result = await rateLimitService.adjustRateLimit(
        endpoint, 
        limitType, 
        newLimit, 
        windowMs
      )
      
      fastify.log.info('Rate limit adjusted by admin:', result)
      
      return {
        success: true,
        data: result,
        message: `Rate limit adjusted: ${endpoint} ${limitType} = ${newLimit}/${windowMs}ms`
      }
    } catch (error) {
      fastify.log.error('Failed to adjust rate limit:', error)
      return reply.code(500).send({
        error: 'Failed to adjust rate limit',
        message: error.message
      })
    }
  })
  
  /**
   * Block IP address
   */
  fastify.post('/rate-limits/block-ip', {
    schema: {
      body: {
        type: 'object',
        properties: {
          ip: { type: 'string' },
          durationMs: { type: 'integer', minimum: 60000 }, // Minimum 1 minute
          reason: { type: 'string' }
        },
        required: ['ip', 'durationMs']
      }
    }
  }, async (request, reply) => {
    try {
      const { ip, durationMs, reason = 'admin_block' } = request.body
      
      await rateLimitService.blockIP(ip, durationMs)
      
      fastify.log.warn('IP blocked by admin:', { ip, durationMs, reason })
      
      return {
        success: true,
        data: { ip, durationMs, reason },
        message: `IP ${ip} blocked for ${Math.ceil(durationMs / 1000)} seconds`
      }
    } catch (error) {
      fastify.log.error('Failed to block IP:', error)
      return reply.code(500).send({
        error: 'Failed to block IP',
        message: error.message
      })
    }
  })
  
  /**
   * Unblock IP address
   */
  fastify.delete('/rate-limits/block-ip/:ip', async (request, reply) => {
    try {
      const { ip } = request.params
      
      const result = await rateLimitService.unblockIP(ip)
      
      fastify.log.info('IP unblocked by admin:', { ip })
      
      return {
        success: true,
        data: result,
        message: `IP ${ip} unblocked`
      }
    } catch (error) {
      fastify.log.error('Failed to unblock IP:', error)
      return reply.code(500).send({
        error: 'Failed to unblock IP',
        message: error.message
      })
    }
  })
  
  /**
   * Reset user's rate limits
   */
  fastify.delete('/rate-limits/user/:userId', async (request, reply) => {
    try {
      const { userId } = request.params
      const { orgId } = request.query
      
      const result = await rateLimitService.resetUserLimits(userId, orgId)
      
      fastify.log.info('User limits reset by admin:', { userId, orgId })
      
      return {
        success: true,
        data: result,
        message: `Rate limits reset for user ${userId}`
      }
    } catch (error) {
      fastify.log.error('Failed to reset user limits:', error)
      return reply.code(500).send({
        error: 'Failed to reset user limits',
        message: error.message
      })
    }
  })
  
  /**
   * Reset all rate limits (emergency function)
   */
  fastify.delete('/rate-limits/reset-all', async (request, reply) => {
    try {
      const { confirm } = request.query
      
      if (confirm !== 'yes-reset-all-limits') {
        return reply.code(400).send({
          error: 'Confirmation required',
          message: 'Add ?confirm=yes-reset-all-limits to confirm this action'
        })
      }
      
      // Reset all rate limit keys
      const pattern = `${config.redis.keyPrefix}rate_limit:*`
      const keys = await rateLimitService.redis.keys(pattern)
      
      if (keys.length > 0) {
        await rateLimitService.redis.del(...keys)
      }
      
      fastify.log.warn('ALL RATE LIMITS RESET BY ADMIN', { keysDeleted: keys.length })
      
      return {
        success: true,
        data: { keysDeleted: keys.length },
        message: `All rate limits reset (${keys.length} keys deleted)`
      }
    } catch (error) {
      fastify.log.error('Failed to reset all rate limits:', error)
      return reply.code(500).send({
        error: 'Failed to reset all rate limits',
        message: error.message
      })
    }
  })
  
  /**
   * Get DDoS protection status and metrics
   */
  fastify.get('/ddos/status', async (request, reply) => {
    try {
      const status = {
        circuitBreaker: {
          state: rateLimitService.circuitBreaker.state,
          failureCount: rateLimitService.circuitBreaker.failureCount,
          lastFailureTime: rateLimitService.circuitBreaker.lastFailureTime
        },
        metrics: rateLimitService.metrics,
        emergencyLimitsActive: await rateLimitService.areEmergencyLimitsActive(),
        thresholds: rateLimitService.ddosThresholds
      }
      
      return {
        success: true,
        data: status,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      fastify.log.error('Failed to get DDoS status:', error)
      return reply.code(500).send({
        error: 'Failed to get DDoS status',
        message: error.message
      })
    }
  })
  
  /**
   * Manually trigger DDoS protection
   */
  fastify.post('/ddos/activate', {
    schema: {
      body: {
        type: 'object',
        properties: {
          reason: { type: 'string' },
          durationMs: { type: 'integer', minimum: 60000 }
        },
        required: ['reason']
      }
    }
  }, async (request, reply) => {
    try {
      const { reason, durationMs = 3600000 } = request.body // Default 1 hour
      
      // Activate circuit breaker
      rateLimitService.activateCircuitBreaker()
      
      // Activate emergency limits
      await rateLimitService.activateEmergencyLimits()
      
      fastify.log.warn('DDoS protection manually activated:', { reason, durationMs })
      
      return {
        success: true,
        data: { reason, durationMs, activated: true },
        message: 'DDoS protection activated'
      }
    } catch (error) {
      fastify.log.error('Failed to activate DDoS protection:', error)
      return reply.code(500).send({
        error: 'Failed to activate DDoS protection',
        message: error.message
      })
    }
  })
  
  /**
   * Get plan usage statistics
   */
  fastify.get('/plans/usage', async (request, reply) => {
    try {
      const planStats = await rateLimitService.getPlanDistribution()
      
      return {
        success: true,
        data: {
          distribution: planStats,
          plans: rateLimitService.plans
        },
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      fastify.log.error('Failed to get plan usage:', error)
      return reply.code(500).send({
        error: 'Failed to get plan usage',
        message: error.message
      })
    }
  })

  // ============================================================================
  // Queue Management Endpoints (BullMQ)
  // ============================================================================

  /**
   * Get list of all queues
   * GET /api/admin/queues
   */
  fastify.get('/queues', async (request, reply) => {
    try {
      if (!config.features.useBullMQQueues) {
        return reply.code(501).send({
          success: false,
          error: 'Queue management is not enabled',
          message: 'Set USE_BULLMQ_QUEUES=true to enable queue management'
        })
      }

      const allMetrics = await queueManager.getAllQueueMetrics()

      return {
        success: true,
        data: {
          queues: allMetrics,
          totalQueues: allMetrics.length,
          timestamp: new Date().toISOString()
        }
      }
    } catch (error) {
      fastify.log.error('Failed to get queues:', error)
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve queues',
        message: error.message
      })
    }
  })

  /**
   * Get detailed statistics for a specific queue
   * GET /api/admin/queues/:name/stats
   */
  fastify.get('/queues/:name/stats', async (request, reply) => {
    try {
      if (!config.features.useBullMQQueues) {
        return reply.code(501).send({
          success: false,
          error: 'Queue management is not enabled'
        })
      }

      const { name } = request.params
      const metrics = await queueManager.getQueueMetrics(name)

      if (!metrics) {
        return reply.code(404).send({
          success: false,
          error: 'Queue not found',
          queueName: name
        })
      }

      // Get additional stats from the queue
      const queue = queueManager.getQueue(name)
      if (queue) {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          queue.getWaiting(),
          queue.getActive(),
          queue.getCompleted(),
          queue.getFailed(),
          queue.getDelayed()
        ])

        return {
          success: true,
          data: {
            ...metrics,
            jobs: {
              waiting: waiting.slice(0, 10).map(j => ({ id: j.id, data: j.data, timestamp: j.timestamp })),
              active: active.slice(0, 10).map(j => ({ id: j.id, data: j.data, timestamp: j.timestamp })),
              completed: completed.slice(0, 10).map(j => ({ id: j.id, returnvalue: j.returnvalue, timestamp: j.timestamp })),
              failed: failed.slice(0, 10).map(j => ({ id: j.id, failedReason: j.failedReason, timestamp: j.timestamp })),
              delayed: delayed.slice(0, 10).map(j => ({ id: j.id, data: j.data, delay: j.opts.delay }))
            },
            timestamp: new Date().toISOString()
          }
        }
      }

      return {
        success: true,
        data: {
          ...metrics,
          timestamp: new Date().toISOString()
        }
      }
    } catch (error) {
      fastify.log.error('Failed to get queue stats:', error)
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve queue statistics',
        message: error.message
      })
    }
  })

  /**
   * Pause a queue
   * POST /api/admin/queues/:name/pause
   */
  fastify.post('/queues/:name/pause', async (request, reply) => {
    try {
      if (!config.features.useBullMQQueues) {
        return reply.code(501).send({
          success: false,
          error: 'Queue management is not enabled'
        })
      }

      const { name } = request.params
      await queueManager.pauseQueue(name)

      fastify.log.info(`Queue paused: ${name}`)

      return {
        success: true,
        message: `Queue '${name}' has been paused`,
        queueName: name,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      fastify.log.error('Failed to pause queue:', error)
      return reply.code(500).send({
        success: false,
        error: 'Failed to pause queue',
        message: error.message
      })
    }
  })

  /**
   * Resume a paused queue
   * POST /api/admin/queues/:name/resume
   */
  fastify.post('/queues/:name/resume', async (request, reply) => {
    try {
      if (!config.features.useBullMQQueues) {
        return reply.code(501).send({
          success: false,
          error: 'Queue management is not enabled'
        })
      }

      const { name } = request.params
      await queueManager.resumeQueue(name)

      fastify.log.info(`Queue resumed: ${name}`)

      return {
        success: true,
        message: `Queue '${name}' has been resumed`,
        queueName: name,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      fastify.log.error('Failed to resume queue:', error)
      return reply.code(500).send({
        success: false,
        error: 'Failed to resume queue',
        message: error.message
      })
    }
  })

  /**
   * Clear failed jobs from a queue
   * DELETE /api/admin/queues/:name/failed
   */
  fastify.delete('/queues/:name/failed', async (request, reply) => {
    try {
      if (!config.features.useBullMQQueues) {
        return reply.code(501).send({
          success: false,
          error: 'Queue management is not enabled'
        })
      }

      const { name } = request.params
      const queue = queueManager.getQueue(name)

      if (!queue) {
        return reply.code(404).send({
          success: false,
          error: 'Queue not found',
          queueName: name
        })
      }

      const failedJobs = await queue.getFailed()
      const count = failedJobs.length

      await Promise.all(failedJobs.map(job => job.remove()))

      fastify.log.info(`Cleared ${count} failed jobs from queue: ${name}`)

      return {
        success: true,
        message: `Cleared ${count} failed job(s) from queue '${name}'`,
        queueName: name,
        clearedCount: count,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      fastify.log.error('Failed to clear failed jobs:', error)
      return reply.code(500).send({
        success: false,
        error: 'Failed to clear failed jobs',
        message: error.message
      })
    }
  })

  /**
   * Get queue health status
   * GET /api/admin/queues/health
   */
  fastify.get('/queues/health', async (request, reply) => {
    try {
      if (!config.features.useBullMQQueues) {
        return {
          success: true,
          data: {
            enabled: false,
            mode: 'legacy',
            message: 'BullMQ queue system is not enabled'
          }
        }
      }

      const health = await queueManager.healthCheck()

      return {
        success: true,
        data: {
          enabled: true,
          mode: 'bullmq',
          ...health,
          timestamp: new Date().toISOString()
        }
      }
    } catch (error) {
      fastify.log.error('Failed to get queue health:', error)
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve queue health',
        message: error.message
      })
    }
  })

  // ============================================================================
  // Scheduled Jobs Endpoints
  // ============================================================================

  /**
   * Get all scheduled jobs
   * GET /api/admin/scheduled-jobs
   */
  fastify.get('/scheduled-jobs', async (request, reply) => {
    try {
      const status = await scheduledJobsService.getStatus()

      return {
        success: true,
        data: status
      }
    } catch (error) {
      fastify.log.error('Failed to get scheduled jobs:', error)
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve scheduled jobs',
        message: error.message
      })
    }
  })

  /**
   * Get scheduled jobs health
   * GET /api/admin/scheduled-jobs/health
   */
  fastify.get('/scheduled-jobs/health', async (request, reply) => {
    try {
      const health = await scheduledJobsService.healthCheck()

      return {
        success: true,
        data: health
      }
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: 'Health check failed',
        message: error.message
      })
    }
  })

  // ============================================================================
  // Queue Monitoring & Alerts Endpoints
  // ============================================================================

  /**
   * Get queue alerts
   * GET /api/admin/alerts
   */
  fastify.get('/alerts', async (request, reply) => {
    try {
      const { resolved, severity, queueName } = request.query

      const alerts = queueMonitoringService.getAlerts({
        resolved: resolved === 'true' ? true : resolved === 'false' ? false : undefined,
        severity,
        queueName
      })

      return {
        success: true,
        data: {
          alerts,
          total: alerts.length,
          timestamp: new Date().toISOString()
        }
      }
    } catch (error) {
      fastify.log.error('Failed to get alerts:', error)
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve alerts',
        message: error.message
      })
    }
  })

  /**
   * Get alert statistics
   * GET /api/admin/alerts/stats
   */
  fastify.get('/alerts/stats', async (request, reply) => {
    try {
      const stats = queueMonitoringService.getAlertStats()

      return {
        success: true,
        data: {
          ...stats,
          timestamp: new Date().toISOString()
        }
      }
    } catch (error) {
      fastify.log.error('Failed to get alert stats:', error)
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve alert statistics',
        message: error.message
      })
    }
  })

  /**
   * Resolve an alert
   * POST /api/admin/alerts/:id/resolve
   */
  fastify.post('/alerts/:id/resolve', async (request, reply) => {
    try {
      const { id } = request.params
      queueMonitoringService.resolveAlert(id)

      return {
        success: true,
        message: `Alert '${id}' resolved`,
        alertId: id,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      fastify.log.error('Failed to resolve alert:', error)
      return reply.code(500).send({
        success: false,
        error: 'Failed to resolve alert',
        message: error.message
      })
    }
  })

  /**
   * Get monitoring thresholds
   * GET /api/admin/monitoring/thresholds
   */
  fastify.get('/monitoring/thresholds', async (request, reply) => {
    try {
      const thresholds = queueMonitoringService.getThresholds()

      return {
        success: true,
        data: thresholds
      }
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: 'Failed to get thresholds',
        message: error.message
      })
    }
  })

  /**
   * Update monitoring thresholds
   * PUT /api/admin/monitoring/thresholds
   */
  fastify.put('/monitoring/thresholds', async (request, reply) => {
    try {
      const thresholds = request.body
      queueMonitoringService.updateThresholds(thresholds)

      fastify.log.info('Monitoring thresholds updated:', thresholds)

      return {
        success: true,
        message: 'Thresholds updated successfully',
        data: queueMonitoringService.getThresholds()
      }
    } catch (error) {
      fastify.log.error('Failed to update thresholds:', error)
      return reply.code(500).send({
        success: false,
        error: 'Failed to update thresholds',
        message: error.message
      })
    }
  })

  /**
   * Get monitoring health
   * GET /api/admin/monitoring/health
   */
  fastify.get('/monitoring/health', async (request, reply) => {
    try {
      const health = await queueMonitoringService.healthCheck()

      return {
        success: true,
        data: health
      }
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: 'Health check failed',
        message: error.message
      })
    }
  })

  /**
   * Get alert notification channel status
   * GET /api/admin/alerts/notification-status
   */
  fastify.get('/alerts/notification-status', {
    onRequest: [fastify.authenticate],
    preHandler: [fastify.requireRole(['admin', 'owner'])],
    schema: {
      description: 'Get current configuration and health for alert notification channels',
      tags: ['Admin'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true },
            timestamp: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const status = alertNotifier.getStatus()
      return {
        success: true,
        data: status,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      request.log.error('Failed to get alert notification status:', error)
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch alert notification status',
        message: error.message,
      })
    }
  })

  /**
   * Trigger test alert across all notification channels
   * POST /api/admin/alerts/test
   */
  fastify.post('/alerts/test', {
    onRequest: [fastify.authenticate],
    preHandler: [fastify.requireRole(['admin', 'owner'])],
    schema: {
      description: 'Send a diagnostic alert to all configured notification channels',
      tags: ['Admin'],
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          severity: { type: 'string', enum: ['info', 'warning', 'error', 'critical'] },
          message: { type: 'string' },
          queueName: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object', additionalProperties: true },
            timestamp: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const body = request.body || {}
    try {
      const result = await alertNotifier.testNotifications({
        severity: body.severity,
        message: body.message,
        queueName: body.queueName,
        initiatedBy: request.user?.id || request.tokenPayload?.user_id || 'admin',
      })

      return {
        success: true,
        message: 'Test alert dispatched',
        data: result,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      request.log.error('Failed to send test alert notification:', error)
      return reply.code(500).send({
        success: false,
        error: 'Failed to dispatch test alert',
        message: error.message,
      })
    }
  })

  /**
   * Health check for admin services
   */
  fastify.get('/health', async (request, reply) => {
    try {
      const rateLimitHealth = await rateLimitService.getHealthStatus()
      
      return {
        success: true,
        data: {
          rateLimiting: rateLimitHealth,
          adminAPI: {
            status: 'healthy',
            timestamp: new Date().toISOString()
          }
        }
      }
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: 'Health check failed',
        message: error.message
      })
    }
  })
}
