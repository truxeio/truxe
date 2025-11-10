/**
 * Email Queue Adapter
 *
 * Integrates BullMQ queue system with the existing email service.
 * Provides backward compatibility with feature flag support.
 *
 * When USE_BULLMQ_QUEUES=true:
 * - Emails sent asynchronously through BullMQ
 * - Better scalability and API response times
 * - Automatic retry on failures
 *
 * When USE_BULLMQ_QUEUES=false:
 * - Falls back to synchronous email sending
 * - Maintains existing behavior
 */

import config from '../config/index.js'
import queueManager from './queue-manager.js'
import emailService from './email.js'

export class EmailQueueAdapter {
  constructor() {
    this.useBullMQ = config.features.useBullMQQueues || false
    console.log(`Email queue adapter initialized (BullMQ: ${this.useBullMQ ? 'enabled' : 'disabled'})`)
  }

  /**
   * Send magic link email (async if BullMQ enabled)
   * @param {string} to - Recipient email
   * @param {string} token - Magic link token
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Result
   */
  async sendMagicLink(payload, tokenOrOptions, maybeOptions = {}) {
    let normalized = {}

    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      normalized = { ...payload }
    } else {
      normalized = { to: payload }
      if (typeof tokenOrOptions === 'string' || tokenOrOptions instanceof String) {
        normalized.token = tokenOrOptions
        Object.assign(normalized, maybeOptions)
      } else if (tokenOrOptions && typeof tokenOrOptions === 'object') {
        Object.assign(normalized, tokenOrOptions)
      }
    }

    const { to, token = null, magicLinkUrl = null, ...data } = normalized
    if (!to) throw new Error('Recipient email is required for magic link email')
    if (!token && !magicLinkUrl) throw new Error('Token or magic link URL is required for magic link email')

    if (!this.useBullMQ) {
      return await emailService.sendMagicLink({
        email: to,
        token,
        magicLinkUrl,
        ...data,
      })
    }

    const job = await queueManager.addJob('email', {
      to,
      template: 'magic-link',
      data: { token, magicLinkUrl, ...data },
    }, {
      priority: 5, // High priority for auth emails
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    })

    return {
      success: true,
      jobId: job.id,
      message: 'Email queued for delivery',
    }
  }

  /**
   * Send welcome email (async if BullMQ enabled)
   * @param {string} to - Recipient email
   * @param {Object} data - Email data
   * @returns {Promise<Object>} Result
   */
  async sendWelcomeEmail(payload, extra = {}) {
    const normalized = typeof payload === 'string' || payload instanceof String
      ? { to: payload, ...extra }
      : { ...(payload || {}) }

    const { to, userName = null, orgName = null } = normalized
    if (!to) throw new Error('Recipient email is required for welcome email')

    if (!this.useBullMQ) {
      return await emailService.sendWelcomeEmail({
        email: to,
        userName,
        orgName,
      })
    }

    const job = await queueManager.addJob('email', {
      to,
      template: 'welcome',
      data: { userName, orgName },
    }, {
      priority: 7, // Lower priority for non-critical emails
      attempts: 3,
    })

    return {
      success: true,
      jobId: job.id,
      message: 'Email queued for delivery',
    }
  }

  /**
   * Send invitation email (async if BullMQ enabled)
   * @param {Object} params - Invitation parameters
   * @returns {Promise<Object>} Result
   */
  async sendInvitationEmail({ to, orgName, inviterName, invitationToken }) {
    if (!this.useBullMQ) {
      return await emailService.sendInvitationEmail({ to, orgName, inviterName, invitationToken })
    }

    const job = await queueManager.addJob('email', {
      to,
      template: 'invitation',
      data: { orgName, inviterName, invitationToken },
    }, {
      priority: 6, // Medium-high priority for invitations
      attempts: 3,
    })

    return {
      success: true,
      jobId: job.id,
      message: 'Email queued for delivery',
    }
  }

  /**
   * Send password reset email (async if BullMQ enabled)
   * @param {string} to - Recipient email
   * @param {string} resetToken - Reset token
   * @param {Object} data - Additional data
   * @returns {Promise<Object>} Result
   */
  async sendPasswordResetEmail(payload, resetToken, extra = {}) {
    const normalized = typeof payload === 'object' && payload !== null && !Array.isArray(payload)
      ? { ...payload }
      : { to: payload, resetToken, ...extra }

    const { to, resetToken: token, ...data } = normalized
    if (!to) throw new Error('Recipient email is required for password reset email')
    if (!token) throw new Error('Reset token is required for password reset email')

    if (!this.useBullMQ) {
      return await emailService.sendPasswordResetEmail({
        email: to,
        resetToken: token,
        ...data,
      })
    }

    const job = await queueManager.addJob('email', {
      to,
      template: 'password-reset',
      data: { resetToken: token, ...data },
    }, {
      priority: 5, // High priority for auth emails
      attempts: 3,
    })

    return {
      success: true,
      jobId: job.id,
      message: 'Email queued for delivery',
    }
  }

  /**
   * Send password reset confirmation email
   * @param {Object|string} payload - Email payload or recipient string
   * @returns {Promise<Object>} Result
   */
  async sendPasswordResetConfirmation(payload = {}) {
    const normalized = typeof payload === 'string' || payload instanceof String
      ? { to: payload }
      : { ...(payload || {}) }

    const { to, ...data } = normalized
    if (!to) throw new Error('Recipient email is required for password reset confirmation email')

    if (!this.useBullMQ) {
      return await emailService.sendPasswordResetConfirmation({
        email: to,
        ...data,
      })
    }

    const job = await queueManager.addJob('email', {
      to,
      template: 'password-reset-confirmation',
      data,
    }, {
      priority: 5,
      attempts: 3,
    })

    return {
      success: true,
      jobId: job.id,
      message: 'Email queued for delivery',
    }
  }

  /**
   * Send password changed notification email
   * @param {Object|string} payload - Email payload or recipient string
   * @returns {Promise<Object>} Result
   */
  async sendPasswordChangedNotification(payload = {}) {
    const normalized = typeof payload === 'string' || payload instanceof String
      ? { to: payload }
      : { ...(payload || {}) }

    const { to, ...data } = normalized
    if (!to) throw new Error('Recipient email is required for password change notification email')

    if (!this.useBullMQ) {
      return await emailService.sendPasswordChangedNotification({
        email: to,
        ...data,
      })
    }

    const job = await queueManager.addJob('email', {
      to,
      template: 'password-change-notification',
      data,
    }, {
      priority: 5,
      attempts: 3,
    })

    return {
      success: true,
      jobId: job.id,
      message: 'Email queued for delivery',
    }
  }

  /**
   * Send account locked notification email
   * @param {Object|string} payload - Email payload or recipient string
   * @returns {Promise<Object>} Result
   */
  async sendAccountLockedNotification(payload = {}) {
    const normalized = typeof payload === 'string' || payload instanceof String
      ? { to: payload }
      : { ...(payload || {}) }

    const { to, ...data } = normalized
    if (!to) throw new Error('Recipient email is required for account locked notification email')

    if (!this.useBullMQ) {
      return await emailService.sendAccountLockedNotification({
        email: to,
        ...data,
      })
    }

    const job = await queueManager.addJob('email', {
      to,
      template: 'account-locked',
      data,
    }, {
      priority: 4,
      attempts: 3,
    })

    return {
      success: true,
      jobId: job.id,
      message: 'Email queued for delivery',
    }
  }

  /**
   * Send account unlocked notification email
   * @param {Object|string} payload - Email payload or recipient string
   * @returns {Promise<Object>} Result
   */
  async sendAccountUnlockedNotification(payload = {}) {
    const normalized = typeof payload === 'string' || payload instanceof String
      ? { to: payload }
      : { ...(payload || {}) }

    const { to, ...data } = normalized
    if (!to) throw new Error('Recipient email is required for account unlocked notification email')

    if (!this.useBullMQ) {
      return await emailService.sendAccountUnlockedNotification({
        email: to,
        ...data,
      })
    }

    const job = await queueManager.addJob('email', {
      to,
      template: 'account-unlocked',
      data,
    }, {
      priority: 6,
      attempts: 3,
    })

    return {
      success: true,
      jobId: job.id,
      message: 'Email queued for delivery',
    }
  }

  /**
   * Send email verification email (async if BullMQ enabled)
   * @param {string} to - Recipient email
   * @param {string} verificationUrl - Verification URL containing token
   * @param {Object} data - Additional template data
   * @returns {Promise<Object>} Result
   */
  async sendEmailVerification(to, verificationUrl, data = {}) {
    if (!this.useBullMQ) {
      return await emailService.sendEmailVerification({
        email: to,
        verificationUrl,
        ...data,
      })
    }

    const job = await queueManager.addJob('email', {
      to,
      template: 'email-verification',
      data: { verificationUrl, ...data },
    }, {
      priority: 5, // High priority for auth emails
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    })

    return {
      success: true,
      jobId: job.id,
      message: 'Email queued for delivery',
    }
  }

  /**
   * Send security alert email (async if BullMQ enabled)
   * @param {Object|string} payload - Email payload or recipient string
   * @returns {Promise<Object>} Result
   */
  async sendSecurityAlert(payload = {}) {
    const normalized = typeof payload === 'string' || payload instanceof String
      ? { to: payload }
      : { ...(payload || {}) }

    const { to, alertType, details = {} } = normalized
    if (!to) throw new Error('Recipient email is required for security alert email')

    if (!this.useBullMQ) {
      return await emailService.sendSecurityAlert({
        email: to,
        alertType,
        details,
      })
    }

    const job = await queueManager.addJob('email', {
      to,
      template: 'security-alert',
      data: { alertType, details },
    }, {
      priority: 4,
      attempts: 3,
    })

    return {
      success: true,
      jobId: job.id,
      message: 'Email queued for delivery',
    }
  }

  /**
   * Send email verified confirmation (async if BullMQ enabled)
   * @param {string} to - Recipient email
   * @param {Object} data - Additional template data
   * @returns {Promise<Object>} Result
   */
  async sendEmailVerifiedConfirmation(to, data = {}) {
    if (!this.useBullMQ) {
      return await emailService.sendEmailVerifiedConfirmation({
        email: to,
        ...data,
      })
    }

    const job = await queueManager.addJob('email', {
      to,
      template: 'email-verified-confirmation',
      data,
    }, {
      priority: 6, // Medium-high priority for confirmation emails
      attempts: 3,
    })

    return {
      success: true,
      jobId: job.id,
      message: 'Email queued for delivery',
    }
  }

  /**
   * Send MFA backup codes email (async if BullMQ enabled)
   * @param {string} to - Recipient email
   * @param {Array} backupCodes - Backup codes
   * @param {Object} data - Additional data
   * @returns {Promise<Object>} Result
   */
  async sendMFABackupCodes(to, backupCodes, data = {}) {
    if (!this.useBullMQ) {
      return await emailService.sendMFABackupCodes(to, backupCodes, data)
    }

    const job = await queueManager.addJob('email', {
      to,
      template: 'mfa-backup-codes',
      data: { backupCodes, ...data },
    }, {
      priority: 6, // Medium-high priority for security emails
      attempts: 3,
    })

    return {
      success: true,
      jobId: job.id,
      message: 'Email queued for delivery',
    }
  }

  /**
   * Send generic email (async if BullMQ enabled)
   * @param {Object} params - Email parameters
   * @returns {Promise<Object>} Result
   */
  async sendEmail({ to, subject, html, text }) {
    if (!this.useBullMQ) {
      return await emailService.sendEmail({ to, subject, html, text })
    }

    const job = await queueManager.addJob('email', {
      to,
      subject,
      html,
      text,
    }, {
      priority: 8, // Lower priority for generic emails
      attempts: 3,
    })

    return {
      success: true,
      jobId: job.id,
      message: 'Email queued for delivery',
    }
  }

  /**
   * Get queue health status
   * @returns {Promise<Object>} Health status
   */
  async getQueueHealth() {
    if (!this.useBullMQ) {
      return {
        mode: 'legacy',
        queueSystem: 'synchronous',
      }
    }

    try {
      const metrics = await queueManager.getQueueMetrics('email')
      return {
        mode: 'bullmq',
        queueSystem: 'redis-persistent',
        ...metrics,
      }
    } catch (error) {
      return {
        mode: 'bullmq',
        queueSystem: 'redis-persistent',
        error: error.message,
        status: 'unhealthy',
      }
    }
  }

  /**
   * Clear failed email jobs (BullMQ only)
   * @returns {Promise<number>} Number of jobs cleared
   */
  async clearFailedJobs() {
    if (!this.useBullMQ) {
      return 0
    }

    const queue = queueManager.getQueue('email')
    if (!queue) {
      return 0
    }

    const failedJobs = await queue.getFailed()
    await Promise.all(failedJobs.map(job => job.remove()))
    return failedJobs.length
  }

  /**
   * Pause email queue (BullMQ only)
   * @returns {Promise<boolean>} Success status
   */
  async pauseQueue() {
    if (!this.useBullMQ) {
      return false
    }

    await queueManager.pauseQueue('email')
    return true
  }

  /**
   * Resume email queue (BullMQ only)
   * @returns {Promise<boolean>} Success status
   */
  async resumeQueue() {
    if (!this.useBullMQ) {
      return false
    }

    await queueManager.resumeQueue('email')
    return true
  }
}

// Export singleton
const emailQueueAdapter = new EmailQueueAdapter()
export default emailQueueAdapter
