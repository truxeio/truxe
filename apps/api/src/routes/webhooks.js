/**
 * Webhook Management Routes
 * 
 * RESTful API endpoints for webhook management:
 * - POST /webhooks/endpoints - Create webhook endpoint
 * - GET /webhooks/endpoints - List webhook endpoints
 * - GET /webhooks/endpoints/:id - Get webhook endpoint
 * - PUT /webhooks/endpoints/:id - Update webhook endpoint
 * - DELETE /webhooks/endpoints/:id - Delete webhook endpoint
 * - POST /webhooks/endpoints/:id/test - Test webhook endpoint
 * - GET /webhooks/deliveries - List webhook deliveries
 * - GET /webhooks/deliveries/:id - Get webhook delivery details
 * - POST /webhooks/deliveries/:id/retry - Retry failed delivery
 * - GET /webhooks/events - List webhook events
 * - GET /webhooks/stats - Get delivery statistics
 */

import webhookService from '../services/webhook.js'
import rbac from '../middleware/rbac.js'
import auditLoggerService from '../services/audit-logger.js'

/**
 * Webhook routes plugin
 */
export default async function webhookRoutes(fastify, options) {
  
  // Create webhook endpoint
  fastify.post('/endpoints', {
    preHandler: [
      (request, reply) => fastify.authenticate(request, reply),
      (request, reply) => rbac.requirePermission('webhooks:write')(request, reply)
    ],
    schema: {
      description: 'Create a new webhook endpoint',
      tags: ['Webhooks'],
      body: {
        type: 'object',
        required: ['name', 'url', 'events'],
        properties: {
          name: {
            type: 'string',
            minLength: 1,
            maxLength: 255,
            description: 'Webhook endpoint name',
          },
          url: {
            type: 'string',
            format: 'uri',
            description: 'Webhook endpoint URL',
          },
          events: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            description: 'List of events to subscribe to',
          },
          filters: {
            type: 'object',
            description: 'Event filters (optional)',
          },
          rateLimit: {
            type: 'integer',
            minimum: 1,
            maximum: 1000,
            default: 100,
            description: 'Rate limit (requests per window)',
          },
          rateLimitWindow: {
            type: 'integer',
            minimum: 60,
            maximum: 86400,
            default: 3600,
            description: 'Rate limit window in seconds',
          },
          allowedIps: {
            type: 'array',
            items: { type: 'string' },
            description: 'Allowed IP addresses (optional)',
          },
          headers: {
            type: 'object',
            description: 'Custom headers to send (optional)',
          },
          metadata: {
            type: 'object',
            description: 'Additional metadata (optional)',
          },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            endpoint: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                url: { type: 'string' },
                events: { type: 'array' },
                filters: { type: 'object' },
                is_active: { type: 'boolean' },
                rate_limit: { type: 'integer' },
                rate_limit_window: { type: 'integer' },
                created_at: { type: 'string' },
              },
            },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const {
        name,
        url,
        events,
        filters = {},
        rateLimit = 100,
        rateLimitWindow = 3600,
        allowedIps = [],
        headers = {},
        metadata = {},
      } = request.body
      
      // Get current organization context
      const orgId = request.user.orgId
      if (!orgId) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Organization context is required',
        })
      }
      
      const endpoint = await webhookService.createWebhookEndpoint({
        orgId,
        name,
        url,
        events,
        filters,
        rateLimit,
        rateLimitWindow,
        allowedIps,
        headers,
        metadata,
        createdBy: request.user.id,
      })
      
      return reply.code(201).send({
        success: true,
        endpoint,
      })
    } catch (error) {
      fastify.log.error('Failed to create webhook endpoint:', error.message)
      
      return reply.code(400).send({
        error: 'Bad Request',
        message: error.message,
      })
    }
  })
  
  // List webhook endpoints
  fastify.get('/endpoints', {
    preHandler: [
      (request, reply) => fastify.authenticate(request, reply),
      (request, reply) => rbac.requirePermission('webhooks:read')(request, reply)
    ],
    schema: {
      description: 'List webhook endpoints for the current organization',
      tags: ['Webhooks'],
      querystring: {
        type: 'object',
        properties: {
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 50,
            description: 'Number of endpoints to return',
          },
          offset: {
            type: 'integer',
            minimum: 0,
            default: 0,
            description: 'Number of endpoints to skip',
          },
          active: {
            type: 'boolean',
            description: 'Filter by active status',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            endpoints: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  url: { type: 'string' },
                  events: { type: 'array' },
                  is_active: { type: 'boolean' },
                  created_at: { type: 'string' },
                },
              },
            },
            pagination: {
              type: 'object',
              properties: {
                limit: { type: 'integer' },
                offset: { type: 'integer' },
                total: { type: 'integer' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { limit = 50, offset = 0, active } = request.query
      const orgId = request.user.orgId
      
      if (!orgId) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Organization context is required',
        })
      }
      
      const endpoints = await webhookService.getWebhookEndpoints(orgId, {
        limit,
        offset,
        active,
      })
      
      return reply.send({
        success: true,
        endpoints,
        pagination: {
          limit,
          offset,
          total: endpoints.length, // TODO: Get actual total count
        },
      })
    } catch (error) {
      fastify.log.error('Failed to list webhook endpoints:', error.message)
      
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve webhook endpoints',
      })
    }
  })
  
  // Get webhook endpoint by ID
  fastify.get('/endpoints/:id', {
    preHandler: [
      (request, reply) => fastify.authenticate(request, reply),
      (request, reply) => rbac.requirePermission('webhooks:read')(request, reply)
    ],
    schema: {
      description: 'Get webhook endpoint by ID',
      tags: ['Webhooks'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Webhook endpoint ID',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            endpoint: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                url: { type: 'string' },
                events: { type: 'array' },
                filters: { type: 'object' },
                is_active: { type: 'boolean' },
                rate_limit: { type: 'integer' },
                rate_limit_window: { type: 'integer' },
                allowed_ips: { type: 'array' },
                headers: { type: 'object' },
                metadata: { type: 'object' },
                created_at: { type: 'string' },
                updated_at: { type: 'string' },
              },
            },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params
      const orgId = request.user.orgId
      
      const endpoints = await webhookService.getWebhookEndpoints(orgId)
      const endpoint = endpoints.find(e => e.id === id)
      
      if (!endpoint) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Webhook endpoint not found',
        })
      }
      
      return reply.send({
        success: true,
        endpoint,
      })
    } catch (error) {
      fastify.log.error('Failed to get webhook endpoint:', error.message)
      
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve webhook endpoint',
      })
    }
  })
  
  // Update webhook endpoint
  fastify.put('/endpoints/:id', {
    preHandler: [
      (request, reply) => fastify.authenticate(request, reply),
      (request, reply) => rbac.requirePermission('webhooks:write')(request, reply)
    ],
    schema: {
      description: 'Update webhook endpoint',
      tags: ['Webhooks'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Webhook endpoint ID',
          },
        },
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          url: { type: 'string', format: 'uri' },
          events: { type: 'array', items: { type: 'string' } },
          filters: { type: 'object' },
          is_active: { type: 'boolean' },
          rateLimit: { type: 'integer', minimum: 1, maximum: 1000 },
          rateLimitWindow: { type: 'integer', minimum: 60, maximum: 86400 },
          allowedIps: { type: 'array', items: { type: 'string' } },
          headers: { type: 'object' },
          metadata: { type: 'object' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            endpoint: { type: 'object' },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params
      const updates = request.body
      
      // Convert camelCase to snake_case for database fields
      const dbUpdates = {}
      if (updates.rateLimit !== undefined) dbUpdates.rate_limit = updates.rateLimit
      if (updates.rateLimitWindow !== undefined) dbUpdates.rate_limit_window = updates.rateLimitWindow
      if (updates.allowedIps !== undefined) dbUpdates.allowed_ips = updates.allowedIps
      if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive
      
      // Copy other fields directly
      const directFields = ['name', 'url', 'events', 'filters', 'headers', 'metadata']
      for (const field of directFields) {
        if (updates[field] !== undefined) {
          dbUpdates[field] = updates[field]
        }
      }
      
      const endpoint = await webhookService.updateWebhookEndpoint(
        id,
        dbUpdates,
        request.user.id
      )
      
      return reply.send({
        success: true,
        endpoint,
      })
    } catch (error) {
      fastify.log.error('Failed to update webhook endpoint:', error.message)
      
      if (error.message.includes('not found')) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Webhook endpoint not found',
        })
      }
      
      return reply.code(400).send({
        error: 'Bad Request',
        message: error.message,
      })
    }
  })
  
  // Delete webhook endpoint
  fastify.delete('/endpoints/:id', {
    preHandler: [
      (request, reply) => fastify.authenticate(request, reply),
      (request, reply) => rbac.requirePermission('webhooks:write')(request, reply)
    ],
    schema: {
      description: 'Delete webhook endpoint',
      tags: ['Webhooks'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Webhook endpoint ID',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params
      
      await webhookService.deleteWebhookEndpoint(id, request.user.id)
      
      return reply.send({
        success: true,
        message: 'Webhook endpoint deleted successfully',
      })
    } catch (error) {
      fastify.log.error('Failed to delete webhook endpoint:', error.message)
      
      if (error.message.includes('not found')) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Webhook endpoint not found',
        })
      }
      
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to delete webhook endpoint',
      })
    }
  })
  
  // Test webhook endpoint
  fastify.post('/endpoints/:id/test', {
    preHandler: [
      (request, reply) => fastify.authenticate(request, reply),
      (request, reply) => rbac.requirePermission('webhooks:write')(request, reply)
    ],
    schema: {
      description: 'Test webhook endpoint with a test event',
      tags: ['Webhooks'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Webhook endpoint ID',
          },
        },
      },
      body: {
        type: 'object',
        properties: {
          eventType: {
            type: 'string',
            default: 'webhook.test',
            description: 'Event type for test',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            test_result: {
              type: 'object',
              properties: {
                delivery_id: { type: 'string' },
                status: { type: 'string' },
                response_status: { type: 'integer' },
                response_body: { type: 'string' },
                error_message: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params
      const { eventType = 'webhook.test' } = request.body
      
      const testResult = await webhookService.testWebhookEndpoint(id, eventType)
      
      return reply.send({
        success: true,
        test_result: testResult,
      })
    } catch (error) {
      fastify.log.error('Failed to test webhook endpoint:', error.message)
      
      return reply.code(400).send({
        error: 'Bad Request',
        message: error.message,
      })
    }
  })
  
  // List webhook deliveries
  fastify.get('/deliveries', {
    preHandler: [
      (request, reply) => fastify.authenticate(request, reply),
      (request, reply) => rbac.requirePermission('webhooks:read')(request, reply)
    ],
    schema: {
      description: 'List webhook deliveries for the current organization',
      tags: ['Webhooks'],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 },
          status: { type: 'string', enum: ['pending', 'delivered', 'failed', 'retrying', 'permanently_failed'] },
          endpoint_id: { type: 'string', format: 'uuid' },
          event_type: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            deliveries: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  endpoint_id: { type: 'string' },
                  event_type: { type: 'string' },
                  status: { type: 'string' },
                  delivery_attempts: { type: 'integer' },
                  response_status: { type: 'integer' },
                  created_at: { type: 'string' },
                  delivered_at: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { limit = 50, offset = 0, status, endpoint_id, event_type } = request.query
      const orgId = request.user.orgId
      
      if (!orgId) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Organization context is required',
        })
      }
      
      let query = `
        SELECT d.id, d.endpoint_id, d.event_type, d.status, d.delivery_attempts,
               d.response_status, d.created_at, d.delivered_at, d.error_message,
               e.name as endpoint_name, e.url as endpoint_url
        FROM webhook_deliveries d
        JOIN webhook_endpoints e ON d.endpoint_id = e.id
        WHERE e.org_id = $1
      `
      const values = [orgId]
      let valueIndex = 2
      
      if (status) {
        query += ` AND d.status = $${valueIndex}`
        values.push(status)
        valueIndex++
      }
      
      if (endpoint_id) {
        query += ` AND d.endpoint_id = $${valueIndex}`
        values.push(endpoint_id)
        valueIndex++
      }
      
      if (event_type) {
        query += ` AND d.event_type = $${valueIndex}`
        values.push(event_type)
        valueIndex++
      }
      
      query += ` ORDER BY d.created_at DESC LIMIT $${valueIndex} OFFSET $${valueIndex + 1}`
      values.push(limit, offset)
      
      const result = await webhookService.db.query(query, values)
      
      return reply.send({
        success: true,
        deliveries: result.rows,
        pagination: {
          limit,
          offset,
          total: result.rows.length,
        },
      })
    } catch (error) {
      fastify.log.error('Failed to list webhook deliveries:', error.message)
      
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve webhook deliveries',
      })
    }
  })
  
  // Get webhook delivery details
  fastify.get('/deliveries/:id', {
    preHandler: [
      (request, reply) => fastify.authenticate(request, reply),
      (request, reply) => rbac.requirePermission('webhooks:read')(request, reply)
    ],
    schema: {
      description: 'Get webhook delivery details',
      tags: ['Webhooks'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Webhook delivery ID',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            delivery: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                endpoint_id: { type: 'string' },
                event_type: { type: 'string' },
                payload: { type: 'object' },
                status: { type: 'string' },
                delivery_attempts: { type: 'integer' },
                response_status: { type: 'integer' },
                response_body: { type: 'string' },
                response_headers: { type: 'object' },
                error_message: { type: 'string' },
                created_at: { type: 'string' },
                delivered_at: { type: 'string' },
              },
            },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params
      const orgId = request.user.orgId
      
      const result = await webhookService.db.query(`
        SELECT d.*, e.name as endpoint_name, e.url as endpoint_url
        FROM webhook_deliveries d
        JOIN webhook_endpoints e ON d.endpoint_id = e.id
        WHERE d.id = $1 AND e.org_id = $2
      `, [id, orgId])
      
      if (result.rows.length === 0) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Webhook delivery not found',
        })
      }
      
      return reply.send({
        success: true,
        delivery: result.rows[0],
      })
    } catch (error) {
      fastify.log.error('Failed to get webhook delivery:', error.message)
      
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve webhook delivery',
      })
    }
  })
  
  // Retry failed webhook delivery
  fastify.post('/deliveries/:id/retry', {
    preHandler: [
      (request, reply) => fastify.authenticate(request, reply),
      (request, reply) => rbac.requirePermission('webhooks:write')(request, reply)
    ],
    schema: {
      description: 'Retry a failed webhook delivery',
      tags: ['Webhooks'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Webhook delivery ID',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params
      const orgId = request.user.orgId
      
      // Get delivery details
      const result = await webhookService.db.query(`
        SELECT d.*, e.url, e.secret, e.headers, e.allowed_ips
        FROM webhook_deliveries d
        JOIN webhook_endpoints e ON d.endpoint_id = e.id
        WHERE d.id = $1 AND e.org_id = $2 AND d.status IN ('failed', 'permanently_failed')
      `, [id, orgId])
      
      if (result.rows.length === 0) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Failed webhook delivery not found',
        })
      }
      
      const delivery = result.rows[0]
      
      // Reset delivery status and schedule immediate retry
      await webhookService.db.query(`
        UPDATE webhook_deliveries 
        SET 
          status = 'retrying',
          next_retry_at = now(),
          updated_at = now()
        WHERE id = $1
      `, [id])
      
      // Add to delivery queue
      webhookService.deliveryQueue.push({
        deliveryId: delivery.id,
        endpointId: delivery.endpoint_id,
        url: delivery.url,
        payload: delivery.payload,
        signature: delivery.signature,
        headers: delivery.headers || {},
        allowedIps: delivery.allowed_ips || [],
      })
      
      // Log retry action
      await auditLoggerService.logEvent({
        orgId,
        userId: request.user.id,
        action: 'webhook_delivery.retry',
        resourceType: 'webhook_delivery',
        resourceId: id,
        details: {
          event_type: delivery.event_type,
          endpoint_id: delivery.endpoint_id,
        },
      })
      
      return reply.send({
        success: true,
        message: 'Webhook delivery scheduled for retry',
      })
    } catch (error) {
      fastify.log.error('Failed to retry webhook delivery:', error.message)
      
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retry webhook delivery',
      })
    }
  })
  
  // Get webhook events
  fastify.get('/events', {
    preHandler: [
      (request, reply) => fastify.authenticate(request, reply),
      (request, reply) => rbac.requirePermission('webhooks:read')(request, reply)
    ],
    schema: {
      description: 'List webhook events for the current organization',
      tags: ['Webhooks'],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 },
          event_type: { type: 'string' },
          resource_type: { type: 'string' },
          resource_id: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            events: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  event_type: { type: 'string' },
                  resource_type: { type: 'string' },
                  resource_id: { type: 'string' },
                  payload: { type: 'object' },
                  triggered_by: { type: 'string' },
                  created_at: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { limit = 50, offset = 0, event_type, resource_type, resource_id } = request.query
      const orgId = request.user.orgId
      
      if (!orgId) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Organization context is required',
        })
      }
      
      let query = `
        SELECT * FROM webhook_events 
        WHERE org_id = $1
      `
      const values = [orgId]
      let valueIndex = 2
      
      if (event_type) {
        query += ` AND event_type = $${valueIndex}`
        values.push(event_type)
        valueIndex++
      }
      
      if (resource_type) {
        query += ` AND resource_type = $${valueIndex}`
        values.push(resource_type)
        valueIndex++
      }
      
      if (resource_id) {
        query += ` AND resource_id = $${valueIndex}`
        values.push(resource_id)
        valueIndex++
      }
      
      query += ` ORDER BY created_at DESC LIMIT $${valueIndex} OFFSET $${valueIndex + 1}`
      values.push(limit, offset)
      
      const result = await webhookService.db.query(query, values)
      
      return reply.send({
        success: true,
        events: result.rows,
        pagination: {
          limit,
          offset,
          total: result.rows.length,
        },
      })
    } catch (error) {
      fastify.log.error('Failed to list webhook events:', error.message)
      
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve webhook events',
      })
    }
  })
  
  // Get delivery statistics
  fastify.get('/stats', {
    preHandler: [
      (request, reply) => fastify.authenticate(request, reply),
      (request, reply) => rbac.requirePermission('webhooks:read')(request, reply)
    ],
    schema: {
      description: 'Get webhook delivery statistics',
      tags: ['Webhooks'],
      querystring: {
        type: 'object',
        properties: {
          start_date: { type: 'string', format: 'date' },
          end_date: { type: 'string', format: 'date' },
          endpoint_id: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            stats: {
              type: 'object',
              properties: {
                summary: {
                  type: 'object',
                  properties: {
                    total_deliveries: { type: 'string' },
                    successful_deliveries: { type: 'string' },
                    failed_deliveries: { type: 'string' },
                    success_rate: { type: 'number' },
                    avg_delivery_time_ms: { type: 'number' },
                  },
                },
                by_event_type: { type: 'array' },
                by_endpoint: { type: 'array' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { start_date, end_date, endpoint_id } = request.query
      const orgId = request.user.orgId
      
      if (!orgId) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Organization context is required',
        })
      }
      
      const options = {}
      if (start_date) options.startDate = new Date(start_date)
      if (end_date) options.endDate = new Date(end_date)
      if (endpoint_id) options.endpointId = endpoint_id
      
      const stats = await webhookService.getDeliveryStats(orgId, options)
      
      return reply.send({
        success: true,
        stats,
      })
    } catch (error) {
      fastify.log.error('Failed to get webhook stats:', error.message)
      
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve webhook statistics',
      })
    }
  })
  
  // Get supported events
  fastify.get('/supported-events', {
    preHandler: [
      (request, reply) => fastify.authenticate(request, reply)
    ],
    schema: {
      description: 'Get list of supported webhook events',
      tags: ['Webhooks'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            events: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  category: { type: 'string' },
                  description: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const eventCategories = {
      'user.created': { category: 'User', description: 'User account created' },
      'user.updated': { category: 'User', description: 'User account updated' },
      'user.deleted': { category: 'User', description: 'User account deleted' },
      'user.login': { category: 'User', description: 'User logged in' },
      'user.logout': { category: 'User', description: 'User logged out' },
      'user.password_reset': { category: 'User', description: 'User password reset' },
      'organization.created': { category: 'Organization', description: 'Organization created' },
      'organization.updated': { category: 'Organization', description: 'Organization updated' },
      'organization.deleted': { category: 'Organization', description: 'Organization deleted' },
      'membership.created': { category: 'Membership', description: 'Organization membership created' },
      'membership.updated': { category: 'Membership', description: 'Organization membership updated' },
      'membership.deleted': { category: 'Membership', description: 'Organization membership deleted' },
      'session.created': { category: 'Session', description: 'User session created' },
      'session.expired': { category: 'Session', description: 'User session expired' },
      'session.revoked': { category: 'Session', description: 'User session revoked' },
      'security.suspicious_activity': { category: 'Security', description: 'Suspicious activity detected' },
      'security.breach_detected': { category: 'Security', description: 'Security breach detected' },
      'security.new_device_login': { category: 'Security', description: 'Login from new device' },
      'security.impossible_travel': { category: 'Security', description: 'Impossible travel detected' },
      'security.account_takeover': { category: 'Security', description: 'Account takeover detected' },
    }
    
    const events = webhookService.supportedEvents.map(eventName => ({
      name: eventName,
      category: eventCategories[eventName]?.category || 'Other',
      description: eventCategories[eventName]?.description || 'Event description',
    }))
    
    return reply.send({
      success: true,
      events,
    })
  })
  
  // Health check endpoint
  fastify.get('/health', {
    schema: {
      description: 'Webhook service health check',
      tags: ['Webhooks'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            queue_size: { type: 'integer' },
            processing_queue: { type: 'boolean' },
            recent_deliveries: { type: 'integer' },
            recent_success_rate: { type: 'number' },
            supported_events: { type: 'integer' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const health = await webhookService.getHealthStatus()
      
      return reply.send(health)
    } catch (error) {
      return reply.code(503).send({
        status: 'unhealthy',
        error: error.message,
      })
    }
  })
}
