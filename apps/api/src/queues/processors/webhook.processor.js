/**
 * Webhook Processor
 *
 * Background job processor for delivering webhooks with retry logic.
 * Replaces the in-memory webhook queue with a persistent, reliable queue.
 */

import crypto from 'crypto'
import { getPool } from '../../database/connection.js'

/**
 * Process webhook delivery job
 * @param {Job} job - BullMQ job instance
 * @returns {Promise<Object>} Delivery result
 */
export async function webhookProcessor(job) {
  const { webhookId, event, payload, url, secret } = job.data
  const db = getPool()

  try {
    console.log(`[WebhookQueue] Processing webhook ${webhookId} for event: ${event}`)

    // Create HMAC signature for webhook security
    const signature = crypto
      .createHmac('sha256', secret || 'default-secret')
      .update(JSON.stringify(payload))
      .digest('hex')

    const timestamp = Date.now()

    // Make HTTP request to webhook URL
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Heimdall-Signature': signature,
        'X-Heimdall-Event': event,
        'X-Heimdall-Delivery': job.id,
        'X-Heimdall-Timestamp': timestamp.toString(),
        'User-Agent': 'Heimdall-Webhooks/1.0',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    })

    const responseTime = Date.now() - timestamp
    const responseBody = await response.text()

    // Update webhook delivery record in database
    await db.query(
      `
      UPDATE webhook_deliveries
      SET
        status = $1,
        response_status = $2,
        response_body = $3,
        delivered_at = NOW(),
        delivery_attempts = delivery_attempts + 1,
        updated_at = NOW()
      WHERE id = $5
    `,
      [
        response.ok ? 'delivered' : 'failed',
        response.status,
        responseBody.substring(0, 1000), // Limit response body size
        webhookId,
      ]
    )

    if (!response.ok) {
      throw new Error(
        `Webhook delivery failed with status ${response.status}: ${responseBody.substring(0, 100)}`
      )
    }

    console.log(`[WebhookQueue] Webhook ${webhookId} delivered successfully (${responseTime}ms)`)

    return {
      success: true,
      webhookId,
      event,
      statusCode: response.status,
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    console.error(`[WebhookQueue] Error delivering webhook ${webhookId}:`, error.message)

    // Update webhook delivery record with failure
    await db.query(
      `
      UPDATE webhook_deliveries
      SET
        status = 'failed',
        error_message = $1,
        delivery_attempts = delivery_attempts + 1,
        updated_at = NOW(),
        next_retry_at = CASE
          WHEN delivery_attempts < max_attempts THEN NOW() + (INTERVAL '1 minute' * POWER(2, delivery_attempts))
          ELSE NULL
        END
      WHERE id = $2
    `,
      [error.message.substring(0, 500), webhookId]
    )

    // Re-throw to mark job as failed (will trigger retry)
    throw error
  }
}

export default webhookProcessor
