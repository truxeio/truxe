# Brevo Email Integration Guide

This guide explains how to configure and use Brevo (formerly Sendinblue) as an email provider in Truxe.

## Overview

Brevo is a transactional email service that provides reliable email delivery with advanced features like analytics, templates, and deliverability optimization. Truxe supports Brevo alongside other email providers like Resend, AWS SES, and SMTP.

## Prerequisites

1. A Brevo account (sign up at [brevo.com](https://www.brevo.com))
2. A verified sender domain in Brevo
3. A Brevo API key

## Configuration

### 1. Get Your Brevo API Key

1. Log in to your Brevo account
2. Go to **SMTP & API** in the left sidebar
3. Click on **API Keys**
4. Create a new API key or use an existing one
5. Copy the API key (it starts with `xkeys-`)

### 2. Configure Environment Variables

Add the following environment variables to your `.env` file:

```bash
# Email Configuration
EMAIL_PROVIDER=brevo
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=Your App Name

# Brevo Configuration
BREVO_API_KEY=xkeys-your-api-key-here
```

### 3. Verify Sender Domain

Before sending emails, you need to verify your sender domain in Brevo:

1. Go to **Senders & IP** in your Brevo dashboard
2. Click on **Domains**
3. Add your domain (e.g., `yourdomain.com`)
4. Follow the DNS verification process
5. Wait for verification to complete

## Usage

Once configured, Truxe will automatically use Brevo for all email operations:

- Magic link emails
- Welcome emails
- Organization invitations
- Security alerts

### Example: Sending a Magic Link

```javascript
import { EmailService } from './src/services/email.js'

const emailService = new EmailService()

await emailService.sendMagicLink({
  email: 'user@example.com',
  magicLinkUrl: 'https://yourapp.com/auth/verify?token=abc123',
  orgName: 'My Organization'
})
```

## Features

### Supported Email Types

- **Magic Links**: Passwordless authentication
- **Welcome Emails**: New user onboarding
- **Invitations**: Organization member invitations
- **Security Alerts**: Account security notifications

### Email Templates

All emails use responsive HTML templates with:
- Professional styling
- Mobile-friendly design
- Security best practices
- Brand customization

### Delivery Tracking

Brevo provides:
- Delivery status tracking
- Open rate analytics
- Click tracking
- Bounce handling
- Spam complaint monitoring

## Configuration Options

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `EMAIL_PROVIDER` | Email provider to use | Yes | `resend` |
| `EMAIL_FROM` | Sender email address | Yes | `noreply@truxe.io` |
| `EMAIL_FROM_NAME` | Sender display name | No | `Truxe Auth` |
| `BREVO_API_KEY` | Brevo API key | Yes | - |

### Advanced Configuration

You can customize email behavior through additional environment variables:

```bash
# Magic Link Configuration
MAGIC_LINK_TTL=15m
MAGIC_LINK_BASE_URL=https://yourapp.com

# Rate Limiting
RATE_LIMIT_MAGIC_LINK_PER_IP=5
RATE_LIMIT_MAGIC_LINK_WINDOW=1m
```

## Testing

### Test Configuration

You can test your Brevo configuration using the health check endpoint:

```bash
curl http://localhost:3001/health/email
```

### Test Email Sending

```javascript
import { EmailService } from './src/services/email.js'

const emailService = new EmailService()

// Test configuration
const configTest = await emailService.testConfiguration()
console.log('Configuration valid:', configTest.success)

// Test health status
const healthStatus = await emailService.getHealthStatus()
console.log('Health status:', healthStatus)
```

## Troubleshooting

### Common Issues

#### 1. "Brevo API key is required" Error

**Cause**: Missing or invalid `BREVO_API_KEY` environment variable.

**Solution**: 
- Verify the API key is correctly set in your environment
- Check that the API key is valid in your Brevo dashboard
- Ensure there are no extra spaces or characters

#### 2. "Sender not verified" Error

**Cause**: The sender email domain is not verified in Brevo.

**Solution**:
- Verify your domain in the Brevo dashboard
- Use a verified sender email address
- Wait for DNS propagation (can take up to 24 hours)

#### 3. "Invalid recipient" Error

**Cause**: Invalid email address format or recipient domain issues.

**Solution**:
- Validate email address format
- Check for typos in recipient addresses
- Ensure recipient domain is valid

#### 4. Rate Limiting

**Cause**: Exceeding Brevo's rate limits.

**Solution**:
- Check your Brevo account limits
- Implement proper rate limiting in your application
- Consider upgrading your Brevo plan

### Debug Mode

Enable debug logging to troubleshoot issues:

```bash
LOG_LEVEL=debug
```

This will show detailed logs including:
- Email sending attempts
- API responses
- Error details
- Configuration validation

## Best Practices

### 1. Sender Reputation

- Use a dedicated domain for transactional emails
- Keep your sender reputation high
- Monitor bounce rates and spam complaints
- Use consistent sender information

### 2. Email Content

- Use clear, professional subject lines
- Include both HTML and text versions
- Avoid spam trigger words
- Test emails across different clients

### 3. Security

- Never expose API keys in client-side code
- Use environment variables for configuration
- Regularly rotate API keys
- Monitor for suspicious activity

### 4. Monitoring

- Set up alerts for failed email deliveries
- Monitor bounce rates and spam complaints
- Track email performance metrics
- Implement proper error handling

## Migration from Other Providers

### From Resend

1. Update `EMAIL_PROVIDER` to `brevo`
2. Replace `RESEND_API_KEY` with `BREVO_API_KEY`
3. Verify your sender domain in Brevo
4. Test email delivery

### From AWS SES

1. Update `EMAIL_PROVIDER` to `brevo`
2. Replace AWS credentials with `BREVO_API_KEY`
3. Verify your sender domain in Brevo
4. Update any SES-specific configurations

### From SMTP

1. Update `EMAIL_PROVIDER` to `brevo`
2. Replace SMTP credentials with `BREVO_API_KEY`
3. Verify your sender domain in Brevo
4. Remove SMTP-specific configurations

## Support

For additional help:

- [Brevo Documentation](https://developers.brevo.com/)
- [Brevo Support](https://help.brevo.com/)
- [Truxe Issues](https://github.com/your-org/truxe/issues)

## Changelog

### v1.0.0
- Initial Brevo integration
- Support for all email types
- Configuration validation
- Health check endpoints
- Comprehensive error handling
