/**
 * Email Processor
 *
 * Background job processor for sending emails asynchronously.
 * Improves API response time by offloading email sending to background workers.
 */

import emailService from '../../services/email.js'

/**
 * Process email sending job
 * @param {Job} job - BullMQ job instance
 * @returns {Promise<Object>} Email sending result
 */
export async function emailProcessor(job) {
  const { to, template, data, subject, html } = job.data

  try {
    console.log(`[EmailQueue] Processing email job ${job.id} to ${to}`)

    let result

    // Support both template-based and direct HTML emails
    if (template) {
      // Template-based email (magic link, welcome, etc.)
      switch (template) {
        case 'magic-link':
          result = await emailService.sendMagicLink({
            email: to,
            token: data.token,
            magicLinkUrl: data.magicLinkUrl,
            ...data,
          })
          break

        case 'welcome':
          result = await emailService.sendWelcomeEmail({
            email: to,
            ...data,
          })
          break

        case 'password-reset':
          result = await emailService.sendPasswordResetEmail({
            email: to,
            resetToken: data.resetToken,
            ...data,
          })
          break

        case 'password-reset-confirmation':
          result = await emailService.sendPasswordResetConfirmation({
            email: to,
            ...data,
          })
          break

        case 'password-change-notification':
          result = await emailService.sendPasswordChangedNotification({
            email: to,
            ...data,
          })
          break

        case 'account-locked':
          result = await emailService.sendAccountLockedNotification({
            email: to,
            ...data,
          })
          break

        case 'account-unlocked':
          result = await emailService.sendAccountUnlockedNotification({
            email: to,
            ...data,
          })
          break

        case 'security-alert':
          result = await emailService.sendSecurityAlert({
            email: to,
            alertType: data.alertType,
            details: data.details,
          })
          break

        case 'mfa-backup-codes':
          result = await emailService.sendMFABackupCodes(to, data.backupCodes, data)
          break

        default:
          throw new Error(`Unknown email template: ${template}`)
      }
    } else if (html) {
      // Direct HTML email
      result = await emailService.sendEmail({
        to,
        subject,
        html,
      })
    } else {
      throw new Error('Either template or html must be provided')
    }

    console.log(`[EmailQueue] Email sent successfully to ${to}`)

    return {
      success: true,
      to,
      template,
      messageId: result?.messageId,
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    console.error(`[EmailQueue] Error sending email to ${to}:`, error.message)

    // Return error details for monitoring
    throw new Error(`Email sending failed: ${error.message}`)
  }
}

export default emailProcessor
