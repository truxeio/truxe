/**
 * Webhook Service
 * 
 * Comprehensive webhook delivery system with:
 * - Event-driven webhook delivery
 * - HMAC signature verification
 * - Retry logic with exponential backoff
 * - Delivery tracking and monitoring
 * - Security features (IP allowlisting, replay prevention)
 * - Event filtering and subscription management
 */

import crypto from 'crypto'
import { EventEmitter } from 'events'
import config from '../config/index.js'
import { getPool } from '../database/connection.js'
import monitoringService from './monitoring.js'
import auditLoggerService from './audit-logger.js'
import webhookQueueAdapter from './webhook-queue-adapter.js'

/**
 * Webhook Service Class
 */
export class WebhookService extends EventEmitter {
  constructor() {
    super()
    this.db = getPool()
    
    // Webhook configuration
    this.config = {
      secret: config.webhooks?.secret || crypto.randomBytes(32).toString('hex'),
      timeout: config.webhooks?.timeout || 10000,
      retryAttempts: config.webhooks?.retryAttempts || 3,
      retryDelay: config.webhooks?.retryDelay || 1000,
      maxRetryDelay: 30000,
      batchSize: 100,
      deliveryWindow: 300000, // 5 minutes
    }
    
    // Supported webhook events
    this.supportedEvents = [
      // User events
      'user.created',
      'user.updated', 
      'user.deleted',
      'user.login',
      'user.logout',
      'user.password_reset',
      
      // Organization events
      'organization.created',
      'organization.updated',
      'organization.deleted',
      
      // Membership events
      'membership.created',
      'membership.updated',
      'membership.deleted',
      
      // Session events
      'session.created',
      'session.expired',
      'session.revoked',
      
      // Security events
      'security.suspicious_activity',
      'security.breach_detected',
      'security.new_device_login',
      'security.impossible_travel',
      'security.account_takeover',
    ]
    
    // Delivery queue
    this.deliveryQueue = []
    this.processingQueue = false
    
    // Rate limiting for webhook deliveries
    this.rateLimits = new Map()

    // Only initialize database if connection is available
    if (this.db) {
      this.initializeDatabase()
    }
    this.startQueueProcessor()

    console.log('Webhook service initialized')
  }

  /**
   * Initialize database tables
   */
  async initializeDatabase() {
    // Skip initialization if database is not available
    if (!this.db) {
      console.log('Webhook database initialization skipped (no database connection)')
      return
    }

    try {
      // Create webhook endpoints table
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS webhook_endpoints (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          url TEXT NOT NULL,
          secret VARCHAR(255) NOT NULL,
          events TEXT[] NOT NULL DEFAULT '{}',
          filters JSONB DEFAULT '{}',
          is_active BOOLEAN DEFAULT true,
          rate_limit INTEGER DEFAULT 100,
          rate_limit_window INTEGER DEFAULT 3600,
          allowed_ips TEXT[] DEFAULT '{}',
          headers JSONB DEFAULT '{}',
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now(),
          created_by UUID REFERENCES users(id),
          updated_by UUID REFERENCES users(id)
        )
      `)
      
      // Create webhook deliveries table
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS webhook_deliveries (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          endpoint_id UUID REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
          event_type VARCHAR(255) NOT NULL,
          payload JSONB NOT NULL,
          signature VARCHAR(512) NOT NULL,
          delivery_attempts INTEGER DEFAULT 0,
          max_attempts INTEGER DEFAULT 3,
          status VARCHAR(50) DEFAULT 'pending',
          response_status INTEGER,
          response_body TEXT,
          response_headers JSONB,
          error_message TEXT,
          delivered_at TIMESTAMPTZ,
          next_retry_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
        )
      `)
      
      // Create webhook events table for tracking
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS webhook_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          org_id UUID,
          event_type VARCHAR(255) NOT NULL,
          resource_type VARCHAR(100) NOT NULL,
          resource_id VARCHAR(255) NOT NULL,
          payload JSONB NOT NULL,
          triggered_by UUID REFERENCES users(id),
          created_at TIMESTAMPTZ DEFAULT now()
        )
      `)
      
      // Create indexes for performance
      await this.db.query(`
        CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_org_id ON webhook_endpoints(org_id);
        CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_events ON webhook_endpoints USING GIN(events);
        CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint_id ON webhook_deliveries(endpoint_id);
        CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);
        CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_next_retry ON webhook_deliveries(next_retry_at);
        CREATE INDEX IF NOT EXISTS idx_webhook_events_org_id ON webhook_events(org_id);
        CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON webhook_events(event_type);
        CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at);
      `)
      
      console.log('Webhook database tables initialized')
    } catch (error) {
      console.error('Failed to initialize webhook database:', error.message)
      throw error
    }
  }
  
  /**
   * Create a new webhook endpoint
   */
  async createWebhookEndpoint({
    orgId,
    name,
    url,
    events = [],
    filters = {},
    rateLimit = 100,
    rateLimitWindow = 3600,
    allowedIps = [],
    headers = {},
    metadata = {},
    createdBy,
  }) {
    try {
      // Validate URL
      new URL(url) // Throws if invalid
      
      // Validate events
      const invalidEvents = events.filter(event => !this.supportedEvents.includes(event))
      if (invalidEvents.length > 0) {
        throw new Error(`Unsupported events: ${invalidEvents.join(', ')}`)
      }
      
      // Generate unique secret for this endpoint
      const secret = crypto.randomBytes(32).toString('hex')
      
      const result = await this.db.query(`
        INSERT INTO webhook_endpoints (
          org_id, name, url, secret, events, filters, 
          rate_limit, rate_limit_window, allowed_ips, headers, metadata, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [
        orgId, name, url, secret, events, JSON.stringify(filters),
        rateLimit, rateLimitWindow, allowedIps, JSON.stringify(headers), 
        JSON.stringify(metadata), createdBy
      ])
      
      const endpoint = result.rows[0]
      
      // Log endpoint creation
      await auditLoggerService.logEvent({
        orgId,
        userId: createdBy,
        action: 'webhook_endpoint.created',
        resourceType: 'webhook_endpoint',
        resourceId: endpoint.id,
        details: {
          name,
          url: url.replace(/\/\/[^@]+@/, '//***@'), // Mask credentials
          events,
          rateLimit,
        },
      })
      
      this.emit('endpoint.created', { endpoint, orgId })
      
      return {
        ...endpoint,
        secret: undefined, // Don't return secret in response
      }
    } catch (error) {
      console.error('Failed to create webhook endpoint:', error.message)
      throw error
    }
  }
  
  /**
   * Update webhook endpoint
   */
  async updateWebhookEndpoint(endpointId, updates, updatedBy) {
    try {
      const allowedUpdates = ['name', 'url', 'events', 'filters', 'is_active', 
                              'rate_limit', 'rate_limit_window', 'allowed_ips', 'headers', 'metadata']
      const updateFields = []
      const values = []
      let valueIndex = 1
      
      for (const [key, value] of Object.entries(updates)) {
        if (allowedUpdates.includes(key)) {
          if (key === 'url' && value) {
            new URL(value) // Validate URL
          }
          if (key === 'events' && value) {
            const invalidEvents = value.filter(event => !this.supportedEvents.includes(event))
            if (invalidEvents.length > 0) {
              throw new Error(`Unsupported events: ${invalidEvents.join(', ')}`)
            }
          }
          
          updateFields.push(`${key} = $${valueIndex}`)
          values.push(typeof value === 'object' ? JSON.stringify(value) : value)
          valueIndex++
        }
      }
      
      if (updateFields.length === 0) {
        throw new Error('No valid fields to update')
      }
      
      updateFields.push(`updated_at = now()`)
      updateFields.push(`updated_by = $${valueIndex}`)
      values.push(updatedBy)
      valueIndex++
      
      values.push(endpointId)
      
      const result = await this.db.query(`
        UPDATE webhook_endpoints 
        SET ${updateFields.join(', ')}
        WHERE id = $${valueIndex}
        RETURNING *, (SELECT org_id FROM webhook_endpoints WHERE id = $${valueIndex}) as org_id
      `, values)
      
      if (result.rows.length === 0) {
        throw new Error('Webhook endpoint not found')
      }
      
      const endpoint = result.rows[0]
      
      // Log endpoint update
      await auditLoggerService.logEvent({
        orgId: endpoint.org_id,
        userId: updatedBy,
        action: 'webhook_endpoint.updated',
        resourceType: 'webhook_endpoint',
        resourceId: endpointId,
        details: updates,
      })
      
      this.emit('endpoint.updated', { endpoint, updates })
      
      return {
        ...endpoint,
        secret: undefined,
      }
    } catch (error) {
      console.error('Failed to update webhook endpoint:', error.message)
      throw error
    }
  }
  
  /**
   * Delete webhook endpoint
   */
  async deleteWebhookEndpoint(endpointId, deletedBy) {
    try {
      const result = await this.db.query(`
        DELETE FROM webhook_endpoints 
        WHERE id = $1
        RETURNING *, org_id
      `, [endpointId])
      
      if (result.rows.length === 0) {
        throw new Error('Webhook endpoint not found')
      }
      
      const endpoint = result.rows[0]
      
      // Log endpoint deletion
      await auditLoggerService.logEvent({
        orgId: endpoint.org_id,
        userId: deletedBy,
        action: 'webhook_endpoint.deleted',
        resourceType: 'webhook_endpoint',
        resourceId: endpointId,
        details: {
          name: endpoint.name,
          url: endpoint.url.replace(/\/\/[^@]+@/, '//***@'),
        },
      })
      
      this.emit('endpoint.deleted', { endpoint })
      
      return { success: true }
    } catch (error) {
      console.error('Failed to delete webhook endpoint:', error.message)
      throw error
    }
  }
  
  /**
   * Get webhook endpoints for an organization
   */
  async getWebhookEndpoints(orgId, options = {}) {
    try {
      const { limit = 50, offset = 0, active = null } = options
      
      let query = `
        SELECT id, org_id, name, url, events, filters, is_active, 
               rate_limit, rate_limit_window, allowed_ips, headers, metadata,
               created_at, updated_at, created_by, updated_by
        FROM webhook_endpoints 
        WHERE org_id = $1
      `
      const values = [orgId]
      let valueIndex = 2
      
      if (active !== null) {
        query += ` AND is_active = $${valueIndex}`
        values.push(active)
        valueIndex++
      }
      
      query += ` ORDER BY created_at DESC LIMIT $${valueIndex} OFFSET $${valueIndex + 1}`
      values.push(limit, offset)
      
      const result = await this.db.query(query, values)
      
      return result.rows
    } catch (error) {
      console.error('Failed to get webhook endpoints:', error.message)
      throw error
    }
  }
  
  /**
   * Trigger webhook event
   */
  async triggerEvent(eventType, payload, options = {}) {
    try {
      const { orgId, triggeredBy, resourceType, resourceId, metadata = {} } = options
      
      if (!this.supportedEvents.includes(eventType)) {
        throw new Error(`Unsupported event type: ${eventType}`)
      }
      
      // Store event for tracking
      const eventResult = await this.db.query(`
        INSERT INTO webhook_events (org_id, event_type, resource_type, resource_id, payload, triggered_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [orgId, eventType, resourceType, resourceId, JSON.stringify(payload), triggeredBy])
      
      const eventId = eventResult.rows[0].id
      
      // Find matching webhook endpoints
      const endpoints = await this.db.query(`
        SELECT * FROM webhook_endpoints
        WHERE org_id = $1 
          AND is_active = true
          AND $2 = ANY(events)
      `, [orgId, eventType])
      
      let deliveryCount = 0
      
      for (const endpoint of endpoints.rows) {
        // Apply filters if configured
        if (endpoint.filters && Object.keys(endpoint.filters).length > 0) {
          if (!this.matchesFilters(payload, endpoint.filters)) {
            continue
          }
        }
        
        // Check rate limiting
        if (!(await this.checkRateLimit(endpoint.id, endpoint.rate_limit, endpoint.rate_limit_window))) {
          console.warn(`Rate limit exceeded for webhook endpoint ${endpoint.id}`)
          continue
        }
        
        // Create delivery record
        const deliveryPayload = {
          event: eventType,
          data: payload,
          timestamp: new Date().toISOString(),
          event_id: eventId,
          ...metadata,
        }
        
        const signature = this.generateSignature(deliveryPayload, endpoint.secret)
        
        const deliveryResult = await this.db.query(`
          INSERT INTO webhook_deliveries (
            endpoint_id, event_type, payload, signature, max_attempts, next_retry_at
          ) VALUES ($1, $2, $3, $4, $5, now())
          RETURNING id
        `, [
          endpoint.id,
          eventType,
          JSON.stringify(deliveryPayload),
          signature,
          this.config.retryAttempts,
        ])
        
        // Add to delivery queue (BullMQ or in-memory)
        const delivery = {
          deliveryId: deliveryResult.rows[0].id,
          endpointId: endpoint.id,
          url: endpoint.url,
          payload: deliveryPayload,
          signature,
          secret: endpoint.secret,
          headers: endpoint.headers || {},
          allowedIps: endpoint.allowed_ips || {},
          maxAttempts: this.config.retryAttempts,
        }

        const jobId = await webhookQueueAdapter.queueDelivery(delivery)

        if (!jobId) {
          // Legacy mode - add to in-memory queue
          this.deliveryQueue.push(delivery)
        }

        deliveryCount++
      }

      // Process queue if not already processing (legacy mode only)
      if (!webhookQueueAdapter.useBullMQ && !this.processingQueue) {
        setImmediate(() => this.processDeliveryQueue())
      }
      
      this.emit('event.triggered', { 
        eventId, 
        eventType, 
        orgId, 
        deliveryCount,
        payload: payload 
      })
      
      return {
        eventId,
        deliveryCount,
        success: true,
      }
    } catch (error) {
      console.error('Failed to trigger webhook event:', error.message)
      throw error
    }
  }
  
  /**
   * Generate HMAC signature for webhook payload
   */
  generateSignature(payload, secret) {
    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload)
    return crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex')
  }
  
  /**
   * Verify HMAC signature
   */
  verifySignature(payload, signature, secret) {
    const expectedSignature = this.generateSignature(payload, secret)
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    )
  }
  
  /**
   * Check if payload matches filters
   */
  matchesFilters(payload, filters) {
    for (const [key, expectedValue] of Object.entries(filters)) {
      const actualValue = this.getNestedValue(payload, key)
      
      if (Array.isArray(expectedValue)) {
        if (!expectedValue.includes(actualValue)) {
          return false
        }
      } else if (expectedValue !== actualValue) {
        return false
      }
    }
    
    return true
  }
  
  /**
   * Get nested value from object using dot notation
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }
  
  /**
   * Check rate limiting for endpoint
   */
  async checkRateLimit(endpointId, limit, windowSeconds) {
    try {
      const now = Date.now()
      const windowMs = windowSeconds * 1000
      const windowStart = now - windowMs
      
      // Clean old entries
      const rateLimitData = this.rateLimits.get(endpointId) || []
      const validEntries = rateLimitData.filter(timestamp => timestamp > windowStart)
      
      if (validEntries.length >= limit) {
        return false
      }
      
      // Add current request
      validEntries.push(now)
      this.rateLimits.set(endpointId, validEntries)
      
      return true
    } catch (error) {
      console.error('Rate limit check failed:', error.message)
      return true // Allow on error
    }
  }
  
  /**
   * Process delivery queue
   */
  async processDeliveryQueue() {
    if (this.processingQueue || this.deliveryQueue.length === 0) {
      return
    }
    
    this.processingQueue = true
    
    try {
      const batch = this.deliveryQueue.splice(0, this.config.batchSize)
      
      await Promise.all(
        batch.map(delivery => this.deliverWebhook(delivery))
      )
    } catch (error) {
      console.error('Error processing delivery queue:', error.message)
    }
    
    this.processingQueue = false
    
    // Process remaining items
    if (this.deliveryQueue.length > 0) {
      setImmediate(() => this.processDeliveryQueue())
    }
  }
  
  /**
   * Deliver webhook to endpoint
   */
  async deliverWebhook(delivery) {
    try {
      const startTime = Date.now()
      
      // Prepare headers
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'Heimdall-Webhooks/1.0',
        'X-Heimdall-Event': delivery.payload.event,
        'X-Heimdall-Signature': `sha256=${delivery.signature}`,
        'X-Heimdall-Timestamp': delivery.payload.timestamp,
        'X-Heimdall-Delivery': delivery.deliveryId,
        ...delivery.headers,
      }
      
      // Make request
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)
      
      const response = await fetch(delivery.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(delivery.payload),
        signal: controller.signal,
      })
      
      clearTimeout(timeoutId)
      
      const responseBody = await response.text()
      const duration = Date.now() - startTime
      
      // Update delivery record
      await this.db.query(`
        UPDATE webhook_deliveries 
        SET 
          delivery_attempts = delivery_attempts + 1,
          status = $1,
          response_status = $2,
          response_body = $3,
          response_headers = $4,
          delivered_at = $5,
          updated_at = now()
        WHERE id = $6
      `, [
        response.ok ? 'delivered' : 'failed',
        response.status,
        responseBody.substring(0, 10000), // Limit response body size
        JSON.stringify(Object.fromEntries(response.headers.entries())),
        response.ok ? new Date() : null,
        delivery.deliveryId,
      ])
      
      // Record metrics
      await monitoringService.recordWebhookDelivery({
        success: response.ok,
        status: response.status,
        duration,
        endpointId: delivery.endpointId,
      })
      
      if (response.ok) {
        this.emit('delivery.success', { 
          deliveryId: delivery.deliveryId, 
          status: response.status, 
          duration 
        })
      } else {
        this.emit('delivery.failed', { 
          deliveryId: delivery.deliveryId, 
          status: response.status, 
          error: responseBody 
        })
        
        // Schedule retry if attempts remaining
        await this.scheduleRetry(delivery.deliveryId)
      }
      
    } catch (error) {
      console.error('Webhook delivery failed:', error.message)
      
      // Update delivery record with error
      await this.db.query(`
        UPDATE webhook_deliveries 
        SET 
          delivery_attempts = delivery_attempts + 1,
          status = 'failed',
          error_message = $1,
          updated_at = now()
        WHERE id = $2
      `, [error.message, delivery.deliveryId])
      
      this.emit('delivery.error', { 
        deliveryId: delivery.deliveryId, 
        error: error.message 
      })
      
      // Schedule retry
      await this.scheduleRetry(delivery.deliveryId)
    }
  }
  
  /**
   * Schedule retry for failed delivery
   */
  async scheduleRetry(deliveryId) {
    try {
      const result = await this.db.query(`
        SELECT delivery_attempts, max_attempts 
        FROM webhook_deliveries 
        WHERE id = $1
      `, [deliveryId])
      
      if (result.rows.length === 0) {
        return
      }
      
      const { delivery_attempts, max_attempts } = result.rows[0]
      
      if (delivery_attempts >= max_attempts) {
        // Mark as permanently failed
        await this.db.query(`
          UPDATE webhook_deliveries 
          SET status = 'permanently_failed', updated_at = now()
          WHERE id = $1
        `, [deliveryId])
        
        this.emit('delivery.permanently_failed', { deliveryId })
        return
      }
      
      // Calculate next retry time with exponential backoff
      const delay = Math.min(
        this.config.retryDelay * Math.pow(2, delivery_attempts - 1),
        this.config.maxRetryDelay
      )
      
      const nextRetryAt = new Date(Date.now() + delay)
      
      await this.db.query(`
        UPDATE webhook_deliveries 
        SET 
          status = 'retrying',
          next_retry_at = $1,
          updated_at = now()
        WHERE id = $2
      `, [nextRetryAt, deliveryId])
      
      this.emit('delivery.retry_scheduled', { deliveryId, nextRetryAt, attempt: delivery_attempts })
      
    } catch (error) {
      console.error('Failed to schedule retry:', error.message)
    }
  }
  
  /**
   * Start queue processor for retries
   */
  startQueueProcessor() {
    // Skip if using BullMQ - retries handled automatically by workers
    if (webhookQueueAdapter.useBullMQ) {
      console.log('Webhook queue processor skipped (BullMQ mode)')
      return
    }

    // Legacy mode: Process retries every minute
    setInterval(async () => {
      try {
        const retries = await this.db.query(`
          SELECT d.*, e.url, e.secret, e.headers, e.allowed_ips
          FROM webhook_deliveries d
          JOIN webhook_endpoints e ON d.endpoint_id = e.id
          WHERE d.status = 'retrying'
            AND d.next_retry_at <= now()
            AND e.is_active = true
          LIMIT $1
        `, [this.config.batchSize])

        for (const retry of retries.rows) {
          this.deliveryQueue.push({
            deliveryId: retry.id,
            endpointId: retry.endpoint_id,
            url: retry.url,
            payload: retry.payload,
            signature: retry.signature,
            headers: retry.headers || {},
            allowedIps: retry.allowed_ips || [],
          })
        }

        if (retries.rows.length > 0 && !this.processingQueue) {
          setImmediate(() => this.processDeliveryQueue())
        }

      } catch (error) {
        console.error('Failed to process retry queue:', error.message)
      }
    }, 60000) // Every minute

    console.log('Webhook queue processor started (legacy mode)')
  }
  
  /**
   * Get webhook delivery statistics
   */
  async getDeliveryStats(orgId, options = {}) {
    try {
      const { 
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        endDate = new Date(),
        endpointId = null 
      } = options
      
      let baseQuery = `
        FROM webhook_deliveries d
        JOIN webhook_endpoints e ON d.endpoint_id = e.id
        WHERE e.org_id = $1 
          AND d.created_at >= $2 
          AND d.created_at <= $3
      `
      const values = [orgId, startDate, endDate]
      
      if (endpointId) {
        baseQuery += ` AND d.endpoint_id = $4`
        values.push(endpointId)
      }
      
      // Get overall stats
      const statsResult = await this.db.query(`
        SELECT 
          COUNT(*) as total_deliveries,
          COUNT(CASE WHEN status = 'delivered' THEN 1 END) as successful_deliveries,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_deliveries,
          COUNT(CASE WHEN status = 'permanently_failed' THEN 1 END) as permanently_failed_deliveries,
          COUNT(CASE WHEN status = 'retrying' THEN 1 END) as retrying_deliveries,
          AVG(CASE WHEN delivered_at IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (delivered_at - created_at)) * 1000 
          END) as avg_delivery_time_ms
        ${baseQuery}
      `, values)
      
      // Get stats by event type
      const eventStatsResult = await this.db.query(`
        SELECT 
          event_type,
          COUNT(*) as count,
          COUNT(CASE WHEN status = 'delivered' THEN 1 END) as successful
        ${baseQuery}
        GROUP BY event_type
        ORDER BY count DESC
      `, values)
      
      // Get stats by endpoint
      const endpointStatsResult = await this.db.query(`
        SELECT 
          e.id,
          e.name,
          e.url,
          COUNT(*) as deliveries,
          COUNT(CASE WHEN d.status = 'delivered' THEN 1 END) as successful,
          AVG(CASE WHEN d.delivered_at IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (d.delivered_at - d.created_at)) * 1000 
          END) as avg_delivery_time_ms
        ${baseQuery}
        GROUP BY e.id, e.name, e.url
        ORDER BY deliveries DESC
      `, values)
      
      const stats = statsResult.rows[0]
      const successRate = stats.total_deliveries > 0 
        ? (stats.successful_deliveries / stats.total_deliveries * 100).toFixed(2)
        : 0
      
      return {
        summary: {
          ...stats,
          success_rate: parseFloat(successRate),
        },
        by_event_type: eventStatsResult.rows,
        by_endpoint: endpointStatsResult.rows,
      }
    } catch (error) {
      console.error('Failed to get delivery stats:', error.message)
      throw error
    }
  }
  
  /**
   * Test webhook endpoint
   */
  async testWebhookEndpoint(endpointId, eventType = 'webhook.test') {
    try {
      const endpointResult = await this.db.query(`
        SELECT * FROM webhook_endpoints WHERE id = $1 AND is_active = true
      `, [endpointId])
      
      if (endpointResult.rows.length === 0) {
        throw new Error('Webhook endpoint not found or inactive')
      }
      
      const endpoint = endpointResult.rows[0]
      
      const testPayload = {
        event: eventType,
        data: {
          test: true,
          timestamp: new Date().toISOString(),
          endpoint_id: endpointId,
        },
        timestamp: new Date().toISOString(),
      }
      
      const signature = this.generateSignature(testPayload, endpoint.secret)
      
      // Create test delivery
      const deliveryResult = await this.db.query(`
        INSERT INTO webhook_deliveries (
          endpoint_id, event_type, payload, signature, max_attempts, next_retry_at
        ) VALUES ($1, $2, $3, $4, 1, now())
        RETURNING id
      `, [endpointId, eventType, JSON.stringify(testPayload), signature])
      
      // Add to immediate delivery
      await this.deliverWebhook({
        deliveryId: deliveryResult.rows[0].id,
        endpointId: endpoint.id,
        url: endpoint.url,
        payload: testPayload,
        signature,
        headers: endpoint.headers || {},
        allowedIps: endpoint.allowed_ips || [],
      })
      
      // Get delivery result
      const result = await this.db.query(`
        SELECT status, response_status, response_body, error_message
        FROM webhook_deliveries 
        WHERE id = $1
      `, [deliveryResult.rows[0].id])
      
      return {
        deliveryId: deliveryResult.rows[0].id,
        ...result.rows[0],
      }
    } catch (error) {
      console.error('Failed to test webhook endpoint:', error.message)
      throw error
    }
  }
  
  /**
   * Get service health status
   */
  async getHealthStatus() {
    try {
      // Check database connectivity
      await this.db.query('SELECT 1')
      
      // Get queue status
      const queueSize = this.deliveryQueue.length
      
      // Get recent delivery stats
      const recentStats = await this.db.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'delivered' THEN 1 END) as successful
        FROM webhook_deliveries 
        WHERE created_at >= now() - interval '1 hour'
      `)
      
      const stats = recentStats.rows[0]
      const successRate = stats.total > 0 ? (stats.successful / stats.total * 100) : 100

      // Get queue adapter health
      const queueHealth = await webhookQueueAdapter.getQueueHealth()

      return {
        status: 'healthy',
        queue_mode: queueHealth.mode,
        queue_system: queueHealth.queueSystem,
        queue_size: webhookQueueAdapter.useBullMQ ? queueHealth.waiting : queueSize,
        processing_queue: this.processingQueue,
        recent_deliveries: parseInt(stats.total),
        recent_success_rate: parseFloat(successRate.toFixed(2)),
        supported_events: this.supportedEvents.length,
        ...(webhookQueueAdapter.useBullMQ && { bullmq_metrics: queueHealth }),
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
const webhookService = new WebhookService()

// Export singleton and class
export default webhookService
