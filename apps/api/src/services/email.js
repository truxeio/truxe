/**
 * Email Service
 * 
 * Multi-provider email service supporting Resend, AWS SES, SMTP, and Brevo
 * with template rendering, delivery tracking, and comprehensive error handling.
 */

import nodemailer from 'nodemailer'
import { Resend } from 'resend'
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'
import * as brevo from '@getbrevo/brevo'
import config from '../config/index.js'
import { UI_CONSTANTS, MAGIC_LINK_CONSTANTS } from '../config/constants.js'

/**
 * Email Service Class
 */
export class EmailService {
  constructor() {
    this.provider = config.email.provider
    this.from = config.email.from
    this.fromName = config.email.fromName
    
    this.initializeProvider()
  }
  
  /**
   * Initialize email provider
   */
  initializeProvider() {
    switch (this.provider) {
      case 'resend':
        this.initializeResend()
        break
      case 'ses':
        this.initializeSES()
        break
      case 'smtp':
        this.initializeSMTP()
        break
      case 'brevo':
        this.initializeBrevo()
        break
      default:
        throw new Error(`Unsupported email provider: ${this.provider}`)
    }
    
    console.log(`Email service initialized with provider: ${this.provider}`)
  }
  
  /**
   * Initialize Resend provider
   */
  initializeResend() {
    if (!config.email.resend.apiKey) {
      throw new Error('Resend API key is required')
    }
    
    this.resend = new Resend(config.email.resend.apiKey)
  }
  
  /**
   * Initialize AWS SES provider
   */
  initializeSES() {
    if (!config.email.ses.accessKeyId || !config.email.ses.secretAccessKey) {
      throw new Error('AWS SES credentials are required')
    }
    
    this.sesClient = new SESClient({
      region: config.email.ses.region,
      credentials: {
        accessKeyId: config.email.ses.accessKeyId,
        secretAccessKey: config.email.ses.secretAccessKey,
      },
    })
  }
  
  /**
   * Initialize SMTP provider
   */
  initializeSMTP() {
    if (!config.email.smtp.host) {
      throw new Error('SMTP configuration is incomplete - host is required')
    }
    
    const transporterConfig = {
      host: config.email.smtp.host,
      port: config.email.smtp.port,
      secure: config.email.smtp.secure,
    }
    
    // Only add auth if user and pass are provided (not needed for MailHog)
    if (config.email.smtp.user && config.email.smtp.pass) {
      transporterConfig.auth = {
        user: config.email.smtp.user,
        pass: config.email.smtp.pass,
      }
    }
    
    this.transporter = nodemailer.createTransport(transporterConfig)
  }
  
  /**
   * Initialize Brevo provider
   */
  initializeBrevo() {
    if (!config.email.brevo.apiKey) {
      throw new Error('Brevo API key is required')
    }

    // Configure Brevo API (using proper Brevo SDK authentication)
    this.brevoApi = new brevo.TransactionalEmailsApi()
    this.brevoApi.authentications.apiKey.apiKey = config.email.brevo.apiKey
  }
  
  /**
   * Send magic link email
   */
  async sendMagicLink(payload) {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Magic link payload must be an object')
    }

    const {
      email,
      magicLinkUrl: providedUrl = null,
      token = null,
      orgName = null,
      expiresIn = MAGIC_LINK_CONSTANTS.DEFAULT_EXPIRES_IN_TEXT,
      requestedAt = new Date(),
      ipAddress = null,
      userAgent = null,
    } = payload

    if (!email) throw new Error('Recipient email is required')

    const baseUrl = config.magicLink?.baseUrl || MAGIC_LINK_CONSTANTS.DEFAULT_BASE_URL
    const normalizedBase = baseUrl?.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
    const url = providedUrl || (token
      ? `${normalizedBase || ''}/auth/verify?token=${encodeURIComponent(token)}`
      : null)

    if (!url) throw new Error('Magic link URL or token is required')

    const subject = orgName
      ? `Sign in to ${orgName}`
      : 'Your secure sign-in link'

    const requestDetails = {
      occurredAt: requestedAt,
      ipAddress,
      userAgent,
    }

    const html = this.renderMagicLinkTemplate({
      magicLinkUrl: url,
      orgName,
      expiresIn,
      requestDetails,
    })

    const text = this.renderMagicLinkTextTemplate({
      magicLinkUrl: url,
      orgName,
      expiresIn,
      requestDetails,
    })

    return await this.sendEmail({
      to: email,
      subject,
      html,
      text,
      template: 'magic-link',
      data: {
        magicLinkUrl: url,
        orgName,
        expiresIn,
        requestedAt,
        ipAddress,
        userAgent,
      },
    })
  }

  /**
   * Send email verification email
   */
  async sendEmailVerification({
    email,
    verificationUrl,
    userName = null,
    expiresIn = '24 hours',
  }) {
    if (!email) throw new Error('Recipient email is required')
    if (!verificationUrl) throw new Error('Verification URL is required')

    const html = this.renderEmailVerificationTemplate({
      verificationUrl,
      userName,
      expiresIn,
    })

    const text = this.renderEmailVerificationTextTemplate({
      verificationUrl,
      userName,
      expiresIn,
    })

    return await this.sendEmail({
      to: email,
      subject: 'Verify your email address',
      html,
      text,
      template: 'email-verification',
      data: { verificationUrl, expiresIn },
    })
  }

  /**
   * Send email verified confirmation email
   */
  async sendEmailVerifiedConfirmation({
    email,
    userName = null,
    verifiedAt = new Date(),
    loginUrl = null,
  }) {
    if (!email) throw new Error('Recipient email is required')

    const html = this.renderEmailVerifiedTemplate({
      userName,
      verifiedAt,
      loginUrl,
    })

    const text = this.renderEmailVerifiedTextTemplate({
      userName,
      verifiedAt,
      loginUrl,
    })

    return await this.sendEmail({
      to: email,
      subject: 'Your email has been verified',
      html,
      text,
      template: 'email-verified',
      data: { verifiedAt, loginUrl },
    })
  }
  
  /**
   * Send welcome email
   */
  async sendWelcomeEmail({ email, userName = null, orgName = null }) {
    const subject = orgName 
      ? `Welcome to ${orgName}!` 
      : 'Welcome to Truxe!'
    
    const html = this.renderWelcomeTemplate({
      userName: userName || email.split('@')[0],
      orgName,
    })
    
    const text = this.renderWelcomeTextTemplate({
      userName: userName || email.split('@')[0],
      orgName,
    })
    
    return await this.sendEmail({
      to: email,
      subject,
      html,
      text,
      template: 'welcome',
      data: { userName, orgName },
    })
  }
  
  /**
   * Send organization invitation email
   */
  async sendOrganizationInvite({
    email,
    orgName,
    inviterName,
    inviteUrl,
    role = 'member',
  }) {
    const subject = `You're invited to join ${orgName}`
    
    const html = this.renderInviteTemplate({
      orgName,
      inviterName,
      inviteUrl,
      role,
    })
    
    const text = this.renderInviteTextTemplate({
      orgName,
      inviterName,
      inviteUrl,
      role,
    })
    
    return await this.sendEmail({
      to: email,
      subject,
      html,
      text,
      template: 'organization-invite',
      data: { orgName, inviterName, inviteUrl, role },
    })
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(arg1, arg2, arg3 = {}) {
    let email = null
    let resetToken = null
    let options = {}

    if (arg1 && typeof arg1 === 'object' && !Array.isArray(arg1)) {
      email = arg1.email || arg1.to
      resetToken = arg1.resetToken || arg1.token
      const { email: _email, to: _to, resetToken: _resetToken, token: _token, ...rest } = arg1
      options = { ...rest }
    } else {
      email = arg1
      resetToken = arg2
      options = { ...(arg3 || {}) }
    }

    if (!email) throw new Error('Recipient email is required for password reset email')
    if (!resetToken) throw new Error('Reset token is required for password reset email')

    const {
      expiresInMinutes = 60,
      resetUrl: providedResetUrl = null,
      requestedAt = new Date(),
      ipAddress = null,
      userAgent = null,
    } = options

    const fallbackBase = config.app.publicBaseUrl || 'https://yourapp.com'
    const normalizedBase = fallbackBase.endsWith('/') ? fallbackBase.slice(0, -1) : fallbackBase
    const resetUrl = providedResetUrl || `${normalizedBase}/reset-password?token=${encodeURIComponent(resetToken)}`
    const subject = 'Reset your password'

    const requestDetails = {
      occurredAt: requestedAt,
      ipAddress,
      userAgent,
    }

    const html = this.renderPasswordResetTemplate({ resetUrl, expiresInMinutes, requestDetails })
    const text = this.renderPasswordResetTextTemplate({ resetUrl, expiresInMinutes, requestDetails })

    return await this.sendEmail({
      to: email,
      subject,
      html,
      text,
      template: 'password-reset',
      data: {
        expiresInMinutes,
        resetUrl,
        requestedAt,
        ipAddress,
        userAgent,
      },
    })
  }

  /**
   * Send password reset confirmation email
   */
  async sendPasswordResetConfirmation({
    email,
    resetAt = new Date(),
    ipAddress = null,
    userAgent = null,
  }) {
    if (!email) throw new Error('Recipient email is required for password reset confirmation email')

    const details = {
      occurredAt: resetAt,
      ipAddress,
      userAgent,
    }

    const html = this.renderPasswordResetConfirmationTemplate({ details })
    const text = this.renderPasswordResetConfirmationTextTemplate({ details })

    return await this.sendEmail({
      to: email,
      subject: 'Your password was reset',
      html,
      text,
      template: 'password-reset-confirmation',
      data: {
        resetAt,
        ipAddress,
        userAgent,
      },
    })
  }

  /**
   * Send password changed security notification
   */
  async sendPasswordChangedNotification({
    email,
    changedAt = new Date(),
    ipAddress = null,
    userAgent = null,
  }) {
    if (!email) throw new Error('Recipient email is required for password change notification email')

    const details = {
      occurredAt: changedAt,
      ipAddress,
      userAgent,
    }

    const html = this.renderPasswordChangedTemplate({ details })
    const text = this.renderPasswordChangedTextTemplate({ details })

    return await this.sendEmail({
      to: email,
      subject: 'Your password was changed',
      html,
      text,
      template: 'password-change-notification',
      data: {
        changedAt,
        ipAddress,
        userAgent,
      },
    })
  }

  /**
   * Send account locked notification
   */
  async sendAccountLockedNotification({
    email,
    lockedAt = new Date(),
    lockedUntil = null,
    attemptCount = null,
    ipAddress = null,
    userAgent = null,
  }) {
    if (!email) throw new Error('Recipient email is required for account locked notification email')

    const details = {
      occurredAt: lockedAt,
      ipAddress,
      userAgent,
    }

    const html = this.renderAccountLockedTemplate({ lockedUntil, attemptCount, details })
    const text = this.renderAccountLockedTextTemplate({ lockedUntil, attemptCount, details })

    return await this.sendEmail({
      to: email,
      subject: 'Your account has been temporarily locked',
      html,
      text,
      template: 'account-locked',
      data: {
        lockedAt,
        lockedUntil,
        attemptCount,
        ipAddress,
        userAgent,
      },
    })
  }

  /**
   * Send account unlocked notification
   */
  async sendAccountUnlockedNotification({
    email,
    unlockedAt = new Date(),
    unlockedBy = null,
    ipAddress = null,
    userAgent = null,
  }) {
    if (!email) throw new Error('Recipient email is required for account unlocked notification email')

    const details = {
      occurredAt: unlockedAt,
      ipAddress,
      userAgent,
      actor: unlockedBy ? `Unlocked by ${unlockedBy}` : null,
    }

    const html = this.renderAccountUnlockedTemplate({ details })
    const text = this.renderAccountUnlockedTextTemplate({ details })

    return await this.sendEmail({
      to: email,
      subject: 'Your account is unlocked',
      html,
      text,
      template: 'account-unlocked',
      data: {
        unlockedAt,
        unlockedBy,
        ipAddress,
        userAgent,
      },
    })
  }

  /**
   * Render password reset email template
   */
  renderPasswordResetTemplate({ resetUrl, expiresInMinutes, requestDetails = {} }) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Password Reset</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: ${UI_CONSTANTS.EMAIL_CONTAINER_MAX_WIDTH}; margin: 0 auto; padding: ${UI_CONSTANTS.EMAIL_CONTAINER_PADDING}; }
            .header { text-align: center; margin-bottom: ${UI_CONSTANTS.EMAIL_HEADER_MARGIN_BOTTOM}; }
            .logo { font-size: ${UI_CONSTANTS.EMAIL_LOGO_FONT_SIZE}; font-weight: bold; color: ${UI_CONSTANTS.PRIMARY_COLOR}; }
            .content { background: ${UI_CONSTANTS.BACKGROUND_COLOR}; padding: ${UI_CONSTANTS.EMAIL_CONTENT_PADDING}; border-radius: ${UI_CONSTANTS.BORDER_RADIUS}; margin-bottom: 30px; }
            .button { display: inline-block; padding: ${UI_CONSTANTS.EMAIL_BUTTON_PADDING}; background: ${UI_CONSTANTS.PRIMARY_COLOR}; color: white; text-decoration: none; border-radius: ${UI_CONSTANTS.BUTTON_BORDER_RADIUS}; font-weight: 500; }
            .button:hover { background: ${UI_CONSTANTS.PRIMARY_COLOR_HOVER}; }
            .footer { text-align: center; font-size: ${UI_CONSTANTS.EMAIL_FOOTER_FONT_SIZE}; color: ${UI_CONSTANTS.MUTED_TEXT_COLOR}; }
            .security-note { background: ${UI_CONSTANTS.WARNING_COLOR}; border: 1px solid ${UI_CONSTANTS.WARNING_BORDER_COLOR}; padding: ${UI_CONSTANTS.EMAIL_SECURITY_NOTE_PADDING}; border-radius: ${UI_CONSTANTS.SECURITY_NOTE_BORDER_RADIUS}; margin-top: 20px; }
            .activity-details { background: #f8f9fa; border: 1px solid #e9ecef; padding: 18px; border-radius: 6px; margin-top: 20px; }
            .activity-details h3 { margin-top: 0; margin-bottom: 10px; font-size: 16px; }
            .activity-details ul { list-style: none; padding: 0; margin: 0; }
            .activity-details li { margin: 4px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🛡️ Truxe</div>
            </div>
            <div class="content">
              <h2>Reset your password</h2>
              <p>We received a request to reset your password. This link will expire in ${expiresInMinutes} minutes.</p>

              <p style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </p>

              <p>If the button doesn't work, copy and paste this URL into your browser:</p>
              <p style="word-break: break-all; background: #e9ecef; padding: 10px; border-radius: 4px; font-family: monospace;">${resetUrl}</p>

              ${this.renderActivityDetailsHTML(requestDetails)}

              <div class="security-note">
                <strong>Security Note:</strong> If you did not request a password reset, you can safely ignore this email.
              </div>
            </div>
            <div class="footer">
              <p>For your security, this link can only be used once.</p>
            </div>
          </div>
        </body>
      </html>
    `
  }

  /**
   * Render password reset text template
   */
  renderPasswordResetTextTemplate({ resetUrl, expiresInMinutes, requestDetails = {} }) {
    const detailsText = this.renderActivityDetailsText(requestDetails)
    return `
Reset your password

We received a request to reset your password. This link will expire in ${expiresInMinutes} minutes.

${resetUrl}

${detailsText ? `${detailsText}\n\n` : ''}If this was not you, secure your account by updating your password and enabling MFA.

If you did not request a password reset, you can safely ignore this email.

--
Truxe Security
    `.trim()
  }

  /**
   * Render password reset confirmation HTML template
   */
  renderPasswordResetConfirmationTemplate({ details = {} }) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Password reset successful</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: ${UI_CONSTANTS.EMAIL_CONTAINER_MAX_WIDTH}; margin: 0 auto; padding: ${UI_CONSTANTS.EMAIL_CONTAINER_PADDING}; }
            .header { text-align: center; margin-bottom: ${UI_CONSTANTS.EMAIL_HEADER_MARGIN_BOTTOM}; }
            .logo { font-size: ${UI_CONSTANTS.EMAIL_LOGO_FONT_SIZE}; font-weight: bold; color: ${UI_CONSTANTS.SUCCESS_COLOR}; }
            .content { background: ${UI_CONSTANTS.BACKGROUND_COLOR}; padding: ${UI_CONSTANTS.EMAIL_CONTENT_PADDING}; border-radius: ${UI_CONSTANTS.BORDER_RADIUS}; margin-bottom: 30px; }
            .security-note { background: ${UI_CONSTANTS.WARNING_COLOR}; border: 1px solid ${UI_CONSTANTS.WARNING_BORDER_COLOR}; padding: ${UI_CONSTANTS.EMAIL_SECURITY_NOTE_PADDING}; border-radius: ${UI_CONSTANTS.SECURITY_NOTE_BORDER_RADIUS}; margin-top: 20px; }
            .footer { text-align: center; font-size: ${UI_CONSTANTS.EMAIL_FOOTER_FONT_SIZE}; color: ${UI_CONSTANTS.MUTED_TEXT_COLOR}; }
            .activity-details { background: #f8f9fa; border: 1px solid #e9ecef; padding: 18px; border-radius: 6px; margin-top: 20px; }
            .activity-details h3 { margin-top: 0; margin-bottom: 10px; font-size: 16px; }
            .activity-details ul { list-style: none; padding: 0; margin: 0; }
            .activity-details li { margin: 4px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🔐 Truxe</div>
            </div>
            <div class="content">
              <h2>Password reset successful</h2>
              <p>We wanted to let you know that your password was just reset. This confirmation is sent to help you keep track of important security changes.</p>
              ${this.renderActivityDetailsHTML(details)}
              <div class="security-note">
                <strong>If this wasn't you:</strong> Reset your password immediately and reach out to your administrator or Truxe support so we can secure your account.
              </div>
            </div>
            <div class="footer">
              <p>You are receiving this email because password changes impact your account security.</p>
            </div>
          </div>
        </body>
      </html>
    `
  }

  /**
   * Render password reset confirmation text template
   */
  renderPasswordResetConfirmationTextTemplate({ details = {} }) {
    const detailsText = this.renderActivityDetailsText(details)
    return `
Your password was reset.

For your security, we're confirming that your password was just reset.${detailsText ? `\n\n${detailsText}` : ''}

If this wasn't you, reset your password immediately and contact support.

--
Truxe Security Team
    `.trim()
  }

  /**
   * Render password changed HTML template
   */
  renderPasswordChangedTemplate({ details = {} }) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Password changed</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: ${UI_CONSTANTS.EMAIL_CONTAINER_MAX_WIDTH}; margin: 0 auto; padding: ${UI_CONSTANTS.EMAIL_CONTAINER_PADDING}; }
            .header { text-align: center; margin-bottom: ${UI_CONSTANTS.EMAIL_HEADER_MARGIN_BOTTOM}; }
            .logo { font-size: ${UI_CONSTANTS.EMAIL_LOGO_FONT_SIZE}; font-weight: bold; color: ${UI_CONSTANTS.PRIMARY_COLOR}; }
            .content { background: ${UI_CONSTANTS.BACKGROUND_COLOR}; padding: ${UI_CONSTANTS.EMAIL_CONTENT_PADDING}; border-radius: ${UI_CONSTANTS.BORDER_RADIUS}; margin-bottom: 30px; }
            .security-note { background: ${UI_CONSTANTS.WARNING_COLOR}; border: 1px solid ${UI_CONSTANTS.WARNING_BORDER_COLOR}; padding: ${UI_CONSTANTS.EMAIL_SECURITY_NOTE_PADDING}; border-radius: ${UI_CONSTANTS.SECURITY_NOTE_BORDER_RADIUS}; margin-top: 20px; }
            .footer { text-align: center; font-size: ${UI_CONSTANTS.EMAIL_FOOTER_FONT_SIZE}; color: ${UI_CONSTANTS.MUTED_TEXT_COLOR}; }
            .activity-details { background: #f8f9fa; border: 1px solid #e9ecef; padding: 18px; border-radius: 6px; margin-top: 20px; }
            .activity-details h3 { margin-top: 0; margin-bottom: 10px; font-size: 16px; }
            .activity-details ul { list-style: none; padding: 0; margin: 0; }
            .activity-details li { margin: 4px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🛡️ Truxe</div>
            </div>
            <div class="content">
              <h2>Your password was changed</h2>
              <p>This is a confirmation that your password was changed from within the account. No further action is required if this was you.</p>
              ${this.renderActivityDetailsHTML(details)}
              <div class="security-note">
                <strong>Keep your account safe:</strong> Enable multi-factor authentication (MFA) and avoid reusing passwords across services.
              </div>
            </div>
            <div class="footer">
              <p>Questions? Contact your administrator or Truxe support.</p>
            </div>
          </div>
        </body>
      </html>
    `
  }

  /**
   * Render password changed text template
   */
  renderPasswordChangedTextTemplate({ details = {} }) {
    const detailsText = this.renderActivityDetailsText(details)
    return `
Your password was changed successfully.${detailsText ? `\n\n${detailsText}` : ''}

If you did not make this change, update your password immediately and enable MFA.

--
Truxe Security
    `.trim()
  }

  /**
   * Render account locked HTML template
   */
  renderAccountLockedTemplate({ lockedUntil, attemptCount, details = {} }) {
    const unlockTime = this.formatDateTime(lockedUntil)
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Account locked</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: ${UI_CONSTANTS.EMAIL_CONTAINER_MAX_WIDTH}; margin: 0 auto; padding: ${UI_CONSTANTS.EMAIL_CONTAINER_PADDING}; }
            .header { text-align: center; margin-bottom: ${UI_CONSTANTS.EMAIL_HEADER_MARGIN_BOTTOM}; }
            .logo { font-size: ${UI_CONSTANTS.EMAIL_LOGO_FONT_SIZE}; font-weight: bold; color: #dc3545; }
            .content { background: #fff5f5; padding: ${UI_CONSTANTS.EMAIL_CONTENT_PADDING}; border-radius: ${UI_CONSTANTS.BORDER_RADIUS}; border: 1px solid #f5c6cb; margin-bottom: 30px; }
            .security-note { background: ${UI_CONSTANTS.WARNING_COLOR}; border: 1px solid ${UI_CONSTANTS.WARNING_BORDER_COLOR}; padding: ${UI_CONSTANTS.EMAIL_SECURITY_NOTE_PADDING}; border-radius: ${UI_CONSTANTS.SECURITY_NOTE_BORDER_RADIUS}; margin-top: 20px; }
            .footer { text-align: center; font-size: ${UI_CONSTANTS.EMAIL_FOOTER_FONT_SIZE}; color: ${UI_CONSTANTS.MUTED_TEXT_COLOR}; }
            .activity-details { background: #fef2f2; border: 1px solid #f8d7da; padding: 18px; border-radius: 6px; margin-top: 20px; }
            .activity-details h3 { margin-top: 0; margin-bottom: 10px; font-size: 16px; }
            .activity-details ul { list-style: none; padding: 0; margin: 0; }
            .activity-details li { margin: 4px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🚨 Truxe Security</div>
            </div>
            <div class="content">
              <h2>Your account is temporarily locked</h2>
              <p>Multiple unsuccessful sign-in attempts triggered an automatic lock to protect your account.${attemptCount ? ` (${attemptCount} attempts detected.)` : ''}</p>
              ${unlockTime ? `<p><strong>Unlocks automatically:</strong> ${unlockTime}</p>` : ''}
              ${this.renderActivityDetailsHTML(details)}
              <div class="security-note">
                <strong>Need access sooner?</strong> Wait until the lock expires or contact your administrator to unlock your account.
              </div>
            </div>
            <div class="footer">
              <p>This lock helps prevent unauthorized access to your account.</p>
            </div>
          </div>
        </body>
      </html>
    `
  }

  /**
   * Render account locked text template
   */
  renderAccountLockedTextTemplate({ lockedUntil, attemptCount, details = {} }) {
    const unlockTime = this.formatDateTime(lockedUntil)
    const detailsText = this.renderActivityDetailsText(details)
    return `
Your account is temporarily locked.

We detected too many unsuccessful sign-in attempts.${attemptCount ? ` Attempts recorded: ${attemptCount}.` : ''}${unlockTime ? ` The account will unlock automatically at ${unlockTime}.` : ''}${detailsText ? `\n\n${detailsText}` : ''}

If this wasn't you, contact your administrator. Otherwise, wait for the lock to expire before trying again.

--
Truxe Security Team
    `.trim()
  }

  /**
   * Render account unlocked HTML template
   */
  renderAccountUnlockedTemplate({ details = {} }) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Account unlocked</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: ${UI_CONSTANTS.EMAIL_CONTAINER_MAX_WIDTH}; margin: 0 auto; padding: ${UI_CONSTANTS.EMAIL_CONTAINER_PADDING}; }
            .header { text-align: center; margin-bottom: ${UI_CONSTANTS.EMAIL_HEADER_MARGIN_BOTTOM}; }
            .logo { font-size: ${UI_CONSTANTS.EMAIL_LOGO_FONT_SIZE}; font-weight: bold; color: ${UI_CONSTANTS.SUCCESS_COLOR}; }
            .content { background: ${UI_CONSTANTS.BACKGROUND_COLOR}; padding: ${UI_CONSTANTS.EMAIL_CONTENT_PADDING}; border-radius: ${UI_CONSTANTS.BORDER_RADIUS}; margin-bottom: 30px; }
            .footer { text-align: center; font-size: ${UI_CONSTANTS.EMAIL_FOOTER_FONT_SIZE}; color: ${UI_CONSTANTS.MUTED_TEXT_COLOR}; }
            .activity-details { background: #f8f9fa; border: 1px solid #e9ecef; padding: 18px; border-radius: 6px; margin-top: 20px; }
            .activity-details h3 { margin-top: 0; margin-bottom: 10px; font-size: 16px; }
            .activity-details ul { list-style: none; padding: 0; margin: 0; }
            .activity-details li { margin: 4px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">✅ Truxe</div>
            </div>
            <div class="content">
              <h2>Your account is unlocked</h2>
              <p>Good news—your account is unlocked and available for sign-in again.</p>
              ${this.renderActivityDetailsHTML(details)}
              <p>We recommend updating your password if you suspect someone else attempted to access your account.</p>
            </div>
            <div class="footer">
              <p>Need help? Contact support or your administrator.</p>
            </div>
          </div>
        </body>
      </html>
    `
  }

  /**
   * Render account unlocked text template
   */
  renderAccountUnlockedTextTemplate({ details = {} }) {
    const detailsText = this.renderActivityDetailsText(details)
    return `
Your account is unlocked and ready to use.${detailsText ? `\n\n${detailsText}` : ''}

If you suspect unauthorized access, update your password and enable MFA.

--
Truxe Support
    `.trim()
  }

  /**
   * Render email verification HTML template
   */
  renderEmailVerificationTemplate({ verificationUrl, userName, expiresIn }) {
    const greetingName = userName || 'there'

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Verify your email</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: ${UI_CONSTANTS.EMAIL_CONTAINER_MAX_WIDTH}; margin: 0 auto; padding: ${UI_CONSTANTS.EMAIL_CONTAINER_PADDING}; }
            .header { text-align: center; margin-bottom: ${UI_CONSTANTS.EMAIL_HEADER_MARGIN_BOTTOM}; }
            .logo { font-size: ${UI_CONSTANTS.EMAIL_LOGO_FONT_SIZE}; font-weight: bold; color: ${UI_CONSTANTS.PRIMARY_COLOR}; }
            .content { background: ${UI_CONSTANTS.BACKGROUND_COLOR}; padding: ${UI_CONSTANTS.EMAIL_CONTENT_PADDING}; border-radius: ${UI_CONSTANTS.BORDER_RADIUS}; margin-bottom: 30px; }
            .button { display: inline-block; padding: ${UI_CONSTANTS.EMAIL_BUTTON_PADDING}; background: ${UI_CONSTANTS.PRIMARY_COLOR}; color: white; text-decoration: none; border-radius: ${UI_CONSTANTS.BUTTON_BORDER_RADIUS}; font-weight: 500; }
            .button:hover { background: ${UI_CONSTANTS.PRIMARY_COLOR_HOVER}; }
            .footer { text-align: center; font-size: ${UI_CONSTANTS.EMAIL_FOOTER_FONT_SIZE}; color: ${UI_CONSTANTS.MUTED_TEXT_COLOR}; }
            .security-note { background: ${UI_CONSTANTS.WARNING_COLOR}; border: 1px solid ${UI_CONSTANTS.WARNING_BORDER_COLOR}; padding: ${UI_CONSTANTS.EMAIL_SECURITY_NOTE_PADDING}; border-radius: ${UI_CONSTANTS.SECURITY_NOTE_BORDER_RADIUS}; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🛡️ Truxe</div>
            </div>
            <div class="content">
              <h2>Hi ${greetingName}, confirm your email</h2>
              <p>Please verify this email address to activate your account. This helps keep your account secure and ensures we can reach you if you need support.</p>
              ${expiresIn ? `<p>This verification link will expire in ${expiresIn}.</p>` : ''}
              <p style="text-align: center; margin: 30px 0;">
                <a href="${verificationUrl}" class="button">Verify Email</a>
              </p>
              <p>If the button doesn't work, copy and paste this URL into your browser:</p>
              <p style="word-break: break-all; background: #e9ecef; padding: 10px; border-radius: 4px; font-family: monospace;">${verificationUrl}</p>
              <div class="security-note">
                <strong>Security Note:</strong> If you did not create an account with Truxe, you can ignore this email safely.
              </div>
            </div>
            <div class="footer">
              <p>Thank you for securing your account.</p>
            </div>
          </div>
        </body>
      </html>
    `
  }

  /**
   * Render email verification text template
   */
  renderEmailVerificationTextTemplate({ verificationUrl, userName, expiresIn }) {
    const greetingName = userName || 'there'
    return `
Hi ${greetingName},

Please verify this email address to activate your account.${expiresIn ? ` This link expires in ${expiresIn}.` : ''}

${verificationUrl}

If you did not create an account, you can ignore this email.

--
Truxe Security
    `.trim()
  }

  /**
   * Render email verified confirmation HTML template
   */
  renderEmailVerifiedTemplate({ userName, verifiedAt, loginUrl }) {
    const greetingName = userName || 'there'
    const formattedDate = verifiedAt ? new Date(verifiedAt).toLocaleString() : null

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Email verified</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: ${UI_CONSTANTS.EMAIL_CONTAINER_MAX_WIDTH}; margin: 0 auto; padding: ${UI_CONSTANTS.EMAIL_CONTAINER_PADDING}; }
            .header { text-align: center; margin-bottom: ${UI_CONSTANTS.EMAIL_HEADER_MARGIN_BOTTOM}; }
            .logo { font-size: ${UI_CONSTANTS.EMAIL_LOGO_FONT_SIZE}; font-weight: bold; color: ${UI_CONSTANTS.SUCCESS_COLOR}; }
            .content { background: ${UI_CONSTANTS.BACKGROUND_COLOR}; padding: ${UI_CONSTANTS.EMAIL_CONTENT_PADDING}; border-radius: ${UI_CONSTANTS.BORDER_RADIUS}; margin-bottom: 30px; }
            .button { display: inline-block; padding: ${UI_CONSTANTS.EMAIL_BUTTON_PADDING}; background: ${UI_CONSTANTS.PRIMARY_COLOR}; color: white; text-decoration: none; border-radius: ${UI_CONSTANTS.BUTTON_BORDER_RADIUS}; font-weight: 500; }
            .button:hover { background: ${UI_CONSTANTS.PRIMARY_COLOR_HOVER}; }
            .footer { text-align: center; font-size: ${UI_CONSTANTS.EMAIL_FOOTER_FONT_SIZE}; color: ${UI_CONSTANTS.MUTED_TEXT_COLOR}; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">✅ Truxe</div>
            </div>
            <div class="content">
              <h2>Your email is verified!</h2>
              <p>Hi ${greetingName}, we've confirmed your email address and unlocked the full experience.</p>
              ${formattedDate ? `<p>Verified at: <strong>${formattedDate}</strong></p>` : ''}
              ${loginUrl ? `
              <p style="text-align: center; margin: 30px 0;">
                <a href="${loginUrl}" class="button">Continue to Dashboard</a>
              </p>` : ''}
              <p>Next step: enable multi-factor authentication (MFA) to add another layer of protection to your account.</p>
            </div>
            <div class="footer">
              <p>Stay safe,<br/>The Truxe Team</p>
            </div>
          </div>
        </body>
      </html>
    `
  }

  /**
   * Render email verified confirmation text template
   */
  renderEmailVerifiedTextTemplate({ userName, verifiedAt, loginUrl }) {
    const greetingName = userName || 'there'
    const formattedDate = verifiedAt ? new Date(verifiedAt).toLocaleString() : null
    return `
Hi ${greetingName},

Your email address has been verified successfully.${formattedDate ? ` Verified at: ${formattedDate}.` : ''}

${loginUrl ? `Continue here: ${loginUrl}\n\n` : ''}Keep your account secure by enabling MFA.

--
The Truxe Team
    `.trim()
  }
  /**
   * Send invitation email (alias for sendOrganizationInvite)
   */
  async sendInvitationEmail({
    email,
    organizationName,
    inviterName,
    role,
    invitationUrl,
    message,
  }) {
    return await this.sendOrganizationInvite({
      email,
      orgName: organizationName,
      inviterName,
      inviteUrl: invitationUrl,
      role,
    })
  }
  
  /**
   * Send security alert email
   */
  async sendSecurityAlert({ email, alertType, details = {} }) {
    const subject = `Security Alert: ${this.getAlertTitle(alertType)}`
    
    const html = this.renderSecurityAlertTemplate({
      alertType,
      details,
    })
    
    const text = this.renderSecurityAlertTextTemplate({
      alertType,
      details,
    })
    
    return await this.sendEmail({
      to: email,
      subject,
      html,
      text,
      template: 'security-alert',
      data: { alertType, details },
    })
  }
  
  /**
   * Generic email sending method
   */
  async sendEmail({ to, subject, html, text, template = null, data = {} }) {
    try {
      const emailData = {
        from: `${this.fromName} <${this.from}>`,
        to,
        subject,
        html,
        text,
      }
      
      let result
      
      switch (this.provider) {
        case 'resend':
          result = await this.sendWithResend(emailData)
          break
        case 'ses':
          result = await this.sendWithSES(emailData)
          break
        case 'smtp':
          result = await this.sendWithSMTP(emailData)
          break
        case 'brevo':
          result = await this.sendWithBrevo(emailData)
          break
        default:
          throw new Error(`Unsupported provider: ${this.provider}`)
      }
      
      // Log successful email sending
      console.log('Email sent successfully:', {
        provider: this.provider,
        to: to.substring(0, 3) + '***',
        subject,
        template,
        messageId: result.messageId,
      })
      
      return {
        success: true,
        messageId: result.messageId,
        provider: this.provider,
        template,
        data,
      }
    } catch (error) {
      console.error('Failed to send email:', {
        provider: this.provider,
        to: to.substring(0, 3) + '***',
        subject,
        template,
        error: error.message,
      })
      
      throw new Error(`Email sending failed: ${error.message}`)
    }
  }
  
  /**
   * Send email with Resend
   */
  async sendWithResend(emailData) {
    const result = await this.resend.emails.send(emailData)
    
    if (result.error) {
      throw new Error(result.error.message)
    }
    
    return {
      messageId: result.data.id,
      provider: 'resend',
    }
  }
  
  /**
   * Send email with AWS SES
   */
  async sendWithSES(emailData) {
    const command = new SendEmailCommand({
      Source: emailData.from,
      Destination: {
        ToAddresses: [emailData.to],
      },
      Message: {
        Subject: {
          Data: emailData.subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: emailData.html,
            Charset: 'UTF-8',
          },
          Text: {
            Data: emailData.text,
            Charset: 'UTF-8',
          },
        },
      },
    })
    
    const result = await this.sesClient.send(command)
    
    return {
      messageId: result.MessageId,
      provider: 'ses',
    }
  }
  
  /**
   * Send email with SMTP
   */
  async sendWithSMTP(emailData) {
    const result = await this.transporter.sendMail(emailData)
    
    return {
      messageId: result.messageId,
      provider: 'smtp',
    }
  }
  
  /**
   * Send email with Brevo
   */
  async sendWithBrevo(emailData) {
    try {
      const sendSmtpEmail = new brevo.SendSmtpEmail()

      // Set sender
      sendSmtpEmail.sender = { email: this.from, name: this.fromName }

      // Set recipient
      sendSmtpEmail.to = [{ email: emailData.to }]

      // Set subject
      sendSmtpEmail.subject = emailData.subject

      // Set content
      sendSmtpEmail.htmlContent = emailData.html
      sendSmtpEmail.textContent = emailData.text

      console.log('Brevo request data:', {
        sender: sendSmtpEmail.sender,
        to: sendSmtpEmail.to,
        subject: sendSmtpEmail.subject,
        htmlLength: emailData.html?.length,
        textLength: emailData.text?.length,
      })

      const result = await this.brevoApi.sendTransacEmail(sendSmtpEmail)

      return {
        messageId: result.messageId,
        provider: 'brevo',
      }
    } catch (error) {
      console.error('Brevo API error details:', {
        message: error.message,
        response: error.response?.data || error.response,
        body: error.body,
        statusCode: error.statusCode,
        stack: error.stack,
      })
      throw error
    }
  }
  
  /**
   * Render magic link email template
   */
  renderMagicLinkTemplate({ magicLinkUrl, orgName, expiresIn, requestDetails = {} }) {
    const orgText = orgName ? ` to ${orgName}` : ''
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Sign in${orgText}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: ${UI_CONSTANTS.EMAIL_CONTAINER_MAX_WIDTH}; margin: 0 auto; padding: ${UI_CONSTANTS.EMAIL_CONTAINER_PADDING}; }
            .header { text-align: center; margin-bottom: ${UI_CONSTANTS.EMAIL_HEADER_MARGIN_BOTTOM}; }
            .logo { font-size: ${UI_CONSTANTS.EMAIL_LOGO_FONT_SIZE}; font-weight: bold; color: ${UI_CONSTANTS.PRIMARY_COLOR}; }
            .content { background: ${UI_CONSTANTS.BACKGROUND_COLOR}; padding: ${UI_CONSTANTS.EMAIL_CONTENT_PADDING}; border-radius: ${UI_CONSTANTS.BORDER_RADIUS}; margin-bottom: 30px; }
            .button { display: inline-block; padding: ${UI_CONSTANTS.EMAIL_BUTTON_PADDING}; background: ${UI_CONSTANTS.PRIMARY_COLOR}; color: white; text-decoration: none; border-radius: ${UI_CONSTANTS.BUTTON_BORDER_RADIUS}; font-weight: 500; }
            .button:hover { background: ${UI_CONSTANTS.PRIMARY_COLOR_HOVER}; }
            .footer { text-align: center; font-size: ${UI_CONSTANTS.EMAIL_FOOTER_FONT_SIZE}; color: ${UI_CONSTANTS.MUTED_TEXT_COLOR}; }
            .security-note { background: ${UI_CONSTANTS.WARNING_COLOR}; border: 1px solid ${UI_CONSTANTS.WARNING_BORDER_COLOR}; padding: ${UI_CONSTANTS.EMAIL_SECURITY_NOTE_PADDING}; border-radius: ${UI_CONSTANTS.SECURITY_NOTE_BORDER_RADIUS}; margin-top: 20px; }
            .activity-details { background: #f8f9fa; border: 1px solid #e9ecef; padding: 18px; border-radius: 6px; margin-top: 20px; }
            .activity-details h3 { margin-top: 0; margin-bottom: 10px; font-size: 16px; }
            .activity-details ul { list-style: none; padding: 0; margin: 0; }
            .activity-details li { margin: 4px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🛡️ Truxe</div>
            </div>
            
            <div class="content">
              <h2>Sign in${orgText}</h2>
              <p>Click the button below to securely sign in${orgText}. This link will expire in ${expiresIn}.</p>
              
              <p style="text-align: center; margin: 30px 0;">
                <a href="${magicLinkUrl}" class="button">Sign In Securely</a>
              </p>
              
              <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
              <p style="word-break: break-all; background: #e9ecef; padding: 10px; border-radius: 4px; font-family: monospace;">
                ${magicLinkUrl}
              </p>

              ${this.renderActivityDetailsHTML(requestDetails)}
              
              <div class="security-note">
                <strong>Security Note:</strong> This email contains a secure login link. Don't forward this email or share the link with anyone.
              </div>
            </div>
            
            <div class="footer">
              <p>If you didn't request this sign-in link, you can safely ignore this email.</p>
              <p>This link was sent to you because someone requested access${orgText}.</p>
            </div>
          </div>
        </body>
      </html>
    `
  }
  
  /**
   * Render magic link text template
   */
  renderMagicLinkTextTemplate({ magicLinkUrl, orgName, expiresIn, requestDetails = {} }) {
    const orgText = orgName ? ` to ${orgName}` : ''
    const detailsText = this.renderActivityDetailsText(requestDetails)
    
    return `
Sign in${orgText}

Click the link below to securely sign in${orgText}. This link will expire in ${expiresIn}.

${magicLinkUrl}

${detailsText ? `${detailsText}\n\n` : ''}SECURITY NOTE: This email contains a secure login link. Don't forward this email or share the link with anyone.

If you didn't request this sign-in link, you can safely ignore this email.

--
Truxe Authentication
    `.trim()
  }
  
  /**
   * Render welcome email template
   */
  renderWelcomeTemplate({ userName, orgName }) {
    const orgText = orgName ? ` to ${orgName}` : ''
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Welcome${orgText}!</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: ${UI_CONSTANTS.EMAIL_CONTAINER_MAX_WIDTH}; margin: 0 auto; padding: ${UI_CONSTANTS.EMAIL_CONTAINER_PADDING}; }
            .header { text-align: center; margin-bottom: ${UI_CONSTANTS.EMAIL_HEADER_MARGIN_BOTTOM}; }
            .logo { font-size: ${UI_CONSTANTS.EMAIL_LOGO_FONT_SIZE}; font-weight: bold; color: ${UI_CONSTANTS.PRIMARY_COLOR}; }
            .content { background: ${UI_CONSTANTS.BACKGROUND_COLOR}; padding: ${UI_CONSTANTS.EMAIL_CONTENT_PADDING}; border-radius: ${UI_CONSTANTS.BORDER_RADIUS}; margin-bottom: 30px; }
            .footer { text-align: center; font-size: ${UI_CONSTANTS.EMAIL_FOOTER_FONT_SIZE}; color: ${UI_CONSTANTS.MUTED_TEXT_COLOR}; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🛡️ Truxe</div>
            </div>
            
            <div class="content">
              <h2>Welcome${orgText}, ${userName}! 🎉</h2>
              <p>Your account has been successfully created and verified. You can now sign in securely using magic links.</p>
              
              <h3>What's Next?</h3>
              <ul>
                <li>Set up your profile and preferences</li>
                <li>Explore the features available to you</li>
                <li>Invite team members if you're an admin</li>
              </ul>
              
              <p>If you have any questions, feel free to reach out to our support team.</p>
            </div>
            
            <div class="footer">
              <p>Welcome to secure, passwordless authentication!</p>
            </div>
          </div>
        </body>
      </html>
    `
  }
  
  /**
   * Render welcome text template
   */
  renderWelcomeTextTemplate({ userName, orgName }) {
    const orgText = orgName ? ` to ${orgName}` : ''
    
    return `
Welcome${orgText}, ${userName}!

Your account has been successfully created and verified. You can now sign in securely using magic links.

What's Next?
- Set up your profile and preferences
- Explore the features available to you
- Invite team members if you're an admin

If you have any questions, feel free to reach out to our support team.

Welcome to secure, passwordless authentication!

--
Truxe Authentication
    `.trim()
  }

  /**
   * Render invitation email template
   */
  renderInviteTemplate({ orgName, inviterName, inviteUrl, role }) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>You're invited to join ${orgName}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: ${UI_CONSTANTS.EMAIL_CONTAINER_MAX_WIDTH}; margin: 0 auto; padding: ${UI_CONSTANTS.EMAIL_CONTAINER_PADDING}; }
            .header { text-align: center; margin-bottom: ${UI_CONSTANTS.EMAIL_HEADER_MARGIN_BOTTOM}; }
            .logo { font-size: ${UI_CONSTANTS.EMAIL_LOGO_FONT_SIZE}; font-weight: bold; color: ${UI_CONSTANTS.PRIMARY_COLOR}; }
            .content { background: ${UI_CONSTANTS.BACKGROUND_COLOR}; padding: ${UI_CONSTANTS.EMAIL_CONTENT_PADDING}; border-radius: ${UI_CONSTANTS.BORDER_RADIUS}; margin-bottom: 30px; }
            .button { display: inline-block; padding: 12px 24px; background: #28a745; color: white; text-decoration: none; border-radius: 6px; font-weight: 500; }
            .button:hover { background: #218838; }
            .footer { text-align: center; font-size: ${UI_CONSTANTS.EMAIL_FOOTER_FONT_SIZE}; color: ${UI_CONSTANTS.MUTED_TEXT_COLOR}; }
            .role-badge { background: #e9ecef; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; text-transform: uppercase; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🛡️ Truxe</div>
            </div>
            
            <div class="content">
              <h2>You're invited to join ${orgName}! 🎉</h2>
              <p><strong>${inviterName}</strong> has invited you to join <strong>${orgName}</strong> as a <span class="role-badge">${role}</span>.</p>
              
              <p>Click the button below to accept the invitation and get started:</p>
              
              <p style="text-align: center; margin: 30px 0;">
                <a href="${inviteUrl}" class="button">Accept Invitation</a>
              </p>
              
              <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
              <p style="word-break: break-all; background: #e9ecef; padding: 10px; border-radius: 4px; font-family: monospace;">
                ${inviteUrl}
              </p>
              
              <h3>What happens next?</h3>
              <ul>
                <li>Click the invitation link to join ${orgName}</li>
                <li>Complete your profile setup</li>
                <li>Start collaborating with your team</li>
              </ul>
            </div>
            
            <div class="footer">
              <p>If you don't want to join ${orgName}, you can safely ignore this email.</p>
              <p>This invitation was sent by ${inviterName} from ${orgName}.</p>
            </div>
          </div>
        </body>
      </html>
    `
  }

  /**
   * Render invitation text template
   */
  renderInviteTextTemplate({ orgName, inviterName, inviteUrl, role }) {
    return `
You're invited to join ${orgName}!

${inviterName} has invited you to join ${orgName} as a ${role}.

Click the link below to accept the invitation and get started:

${inviteUrl}

What happens next?
- Click the invitation link to join ${orgName}
- Complete your profile setup
- Start collaborating with your team

If you don't want to join ${orgName}, you can safely ignore this email.

This invitation was sent by ${inviterName} from ${orgName}.

--
Truxe Authentication
    `.trim()
  }

  /**
   * Format date/time values safely
   */
  formatDateTime(value) {
    if (!value) return null
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return null
    return date.toLocaleString()
  }

  /**
   * Normalize activity detail entries for rendering
   */
  normalizeActivityDetails(details = {}) {
    if (!details || typeof details !== 'object') return []

    const entries = []
    const occurredAt = details.occurredAt ?? details.time ?? details.timestamp ?? null
    const formattedTime = this.formatDateTime(occurredAt)
    if (formattedTime) entries.push({ label: 'Time', value: formattedTime })

    const ipAddress = details.ipAddress ?? details.ip ?? null
    if (ipAddress) entries.push({ label: 'IP address', value: ipAddress })

    const location = details.location ?? details.geo ?? null
    if (location) entries.push({ label: 'Location', value: location })

    const userAgent = details.userAgent ?? details.device ?? null
    if (userAgent) entries.push({ label: 'Device', value: userAgent })

    const actor = details.actor ?? details.performedBy ?? null
    if (actor) entries.push({ label: 'Actor', value: actor })

    return entries
  }

  /**
   * Render shared HTML block for activity details
   */
  renderActivityDetailsHTML(details = {}) {
    const entries = this.normalizeActivityDetails(details)
    if (!entries.length) return ''

    return `
              <div class="activity-details">
                <h3>Activity details</h3>
                <ul>
                  ${entries.map(({ label, value }) => `<li><strong>${label}:</strong> ${value}</li>`).join('')}
                </ul>
              </div>
    `
  }

  /**
   * Render shared text block for activity details
   */
  renderActivityDetailsText(details = {}) {
    const entries = this.normalizeActivityDetails(details)
    if (!entries.length) return ''

    return `
Activity details:
${entries.map(({ label, value }) => `- ${label}: ${value}`).join('\n')}
    `.trim()
  }
  
  /**
   * Get alert title for security alerts
   */
  getAlertTitle(alertType) {
    const titles = {
      'new_device': 'New Device Sign-in',
      'suspicious_activity': 'Suspicious Activity Detected',
      'password_reset': 'Password Reset Request',
      'password_reset_success': 'Password Reset Successful',
      'password_changed': 'Password Changed',
      'account_locked': 'Account Locked',
      'account_unlocked': 'Account Unlocked',
      'multiple_failed_attempts': 'Multiple Failed Sign-in Attempts',
    }
    
    return titles[alertType] || 'Security Alert'
  }
  
  /**
   * Render security alert template
   */
  renderSecurityAlertTemplate({ alertType, details }) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Security Alert</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: ${UI_CONSTANTS.EMAIL_CONTAINER_MAX_WIDTH}; margin: 0 auto; padding: ${UI_CONSTANTS.EMAIL_CONTAINER_PADDING}; }
            .header { text-align: center; margin-bottom: ${UI_CONSTANTS.EMAIL_HEADER_MARGIN_BOTTOM}; }
            .logo { font-size: 24px; font-weight: bold; color: #dc3545; }
            .content { background: #fff5f5; border: 1px solid #f5c6cb; padding: 30px; border-radius: 8px; margin-bottom: 30px; }
            .alert { background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 4px; margin-bottom: 20px; }
            .footer { text-align: center; font-size: ${UI_CONSTANTS.EMAIL_FOOTER_FONT_SIZE}; color: ${UI_CONSTANTS.MUTED_TEXT_COLOR}; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🚨 Security Alert</div>
            </div>
            
            <div class="content">
              <div class="alert">
                <strong>${this.getAlertTitle(alertType)}</strong>
              </div>
              
              <p>We detected potentially suspicious activity on your account:</p>
              
              <ul>
                ${Object.entries(details).map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`).join('')}
              </ul>
              
              <p>If this was you, no action is needed. If you don't recognize this activity, please contact support immediately.</p>
            </div>
            
            <div class="footer">
              <p>This is an automated security notification from Truxe.</p>
            </div>
          </div>
        </body>
      </html>
    `
  }
  
  /**
   * Render security alert text template
   */
  renderSecurityAlertTextTemplate({ alertType, details }) {
    const detailsText = Object.entries(details)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n')
    
    return `
SECURITY ALERT: ${this.getAlertTitle(alertType)}

We detected potentially suspicious activity on your account:

${detailsText}

If this was you, no action is needed. If you don't recognize this activity, please contact support immediately.

--
Truxe Authentication Security Team
    `.trim()
  }
  
  /**
   * Test email configuration
   */
  async testConfiguration() {
    try {
      const testEmail = {
        to: 'test@example.com',
        subject: 'Truxe Email Service Test',
        html: '<p>This is a test email from Truxe.</p>',
        text: 'This is a test email from Truxe.',
      }
      
      // Don't actually send, just validate configuration
      switch (this.provider) {
        case 'resend':
          if (!this.resend) throw new Error('Resend not initialized')
          break
        case 'ses':
          if (!this.sesClient) throw new Error('SES not initialized')
          break
        case 'smtp':
          if (!this.transporter) throw new Error('SMTP not initialized')
          await this.transporter.verify()
          break
        case 'brevo':
          if (!this.brevoApi) throw new Error('Brevo not initialized')
          break
      }
      
      return { success: true, provider: this.provider }
    } catch (error) {
      return { success: false, error: error.message, provider: this.provider }
    }
  }
  
  /**
   * Get service health status
   */
  async getHealthStatus() {
    try {
      const configTest = await this.testConfiguration()
      
      return {
        status: configTest.success ? 'healthy' : 'unhealthy',
        provider: this.provider,
        from: this.from,
        fromName: this.fromName,
        configurationValid: configTest.success,
        error: configTest.error,
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        provider: this.provider,
        error: error.message,
      }
    }
  }
}

// Create singleton instance
const emailService = new EmailService()

// Export singleton and class
export default emailService
