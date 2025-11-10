/**
 * Webhook Testing Routes
 * 
 * RESTful API endpoints for webhook testing and debugging:
 * - POST /webhook-testing/validate - Validate webhook endpoint configuration
 * - POST /webhook-testing/connectivity/:id - Test endpoint connectivity
 * - POST /webhook-testing/simulate/:id - Simulate webhook deliveries
 * - GET /webhook-testing/analysis/:orgId - Analyze delivery patterns
 * - GET /webhook-testing/results/:testId - Get test results
 */

import webhookTestingService from '../services/webhook-testing.js'
import rbac from '../middleware/rbac.js'

/**
 * Webhook testing routes plugin
 */
export default async function webhookTestingRoutes(fastify, options) {
  
  // Validate webhook endpoint configuration
  fastify.post('/validate', {
    preHandler: [
      (request, reply) => fastify.authenticate(request, reply),
      (request, reply) => rbac.requirePermission('webhooks:test')(request, reply)
    ],
    schema: {
      description: 'Validate webhook endpoint configuration',
      tags: ['Webhook Testing'],
      body: {
        type: 'object',
        required: ['url', 'events'],
        properties: {
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
          headers: {
            type: 'object',
            description: 'Custom headers (optional)',
          },
          rateLimit: {
            type: 'integer',
            minimum: 1,
            maximum: 1000,
            description: 'Rate limit (optional)',
          },
          allowedIps: {
            type: 'array',
            items: { type: 'string' },
            description: 'Allowed IP addresses (optional)',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            validation: {
              type: 'object',
              properties: {
                valid: { type: 'boolean' },
                errors: { type: 'array' },
                warnings: { type: 'array' },
                checks: { type: 'object' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const validation = await webhookTestingService.validateEndpoint(request.body)
      
      return reply.send({
        success: true,
        validation,
      })
    } catch (error) {
      fastify.log.error('Failed to validate webhook endpoint:', error.message)
      
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to validate webhook endpoint',
      })
    }
  })
  
  // Test endpoint connectivity
  fastify.post('/connectivity/:id', {
    preHandler: [
      (request, reply) => fastify.authenticate(request, reply),
      (request, reply) => rbac.requirePermission('webhooks:test')(request, reply)
    ],
    schema: {
      description: 'Test webhook endpoint connectivity and response',
      tags: ['Webhook Testing'],
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
          timeout: {
            type: 'integer',
            minimum: 1000,
            maximum: 30000,
            default: 10000,
            description: 'Request timeout in milliseconds',
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
                test_id: { type: 'string' },
                endpoint_id: { type: 'string' },
                status: { type: 'string' },
                overall_result: { type: 'string' },
                total_duration: { type: 'integer' },
                tests: { type: 'object' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params
      const { timeout = 10000 } = request.body
      const orgId = request.user.orgId
      
      const testResult = await webhookTestingService.testEndpointConnectivity(id, {
        timeout,
        orgId,
      })
      
      return reply.send({
        success: true,
        test_result: testResult,
      })
    } catch (error) {
      fastify.log.error('Failed to test endpoint connectivity:', error.message)
      
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to test endpoint connectivity',
      })
    }
  })
  
  // Simulate webhook deliveries
  fastify.post('/simulate/:id', {
    preHandler: [
      (request, reply) => fastify.authenticate(request, reply),
      (request, reply) => rbac.requirePermission('webhooks:test')(request, reply)
    ],
    schema: {
      description: 'Simulate webhook deliveries with various scenarios',
      tags: ['Webhook Testing'],
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
          scenarios: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['success', 'timeout', 'error', 'large_payload', 'retry'],
            },
            default: ['success', 'timeout', 'error'],
            description: 'Test scenarios to run',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            simulation_result: {
              type: 'object',
              properties: {
                endpoint_id: { type: 'string' },
                simulation_id: { type: 'string' },
                scenarios: { type: 'object' },
                started_at: { type: 'string' },
                completed_at: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params
      const { scenarios = ['success', 'timeout', 'error'] } = request.body
      
      const simulationResult = await webhookTestingService.simulateDelivery(id, scenarios)
      
      return reply.send({
        success: true,
        simulation_result: simulationResult,
      })
    } catch (error) {
      fastify.log.error('Failed to simulate webhook delivery:', error.message)
      
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to simulate webhook delivery',
      })
    }
  })
  
  // Analyze delivery patterns
  fastify.get('/analysis/:orgId', {
    preHandler: [
      (request, reply) => fastify.authenticate(request, reply),
      (request, reply) => rbac.requirePermission('webhooks:read')(request, reply)
    ],
    schema: {
      description: 'Analyze webhook delivery patterns for an organization',
      tags: ['Webhook Testing'],
      params: {
        type: 'object',
        required: ['orgId'],
        properties: {
          orgId: {
            type: 'string',
            format: 'uuid',
            description: 'Organization ID',
          },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          start_date: {
            type: 'string',
            format: 'date',
            description: 'Analysis start date',
          },
          end_date: {
            type: 'string',
            format: 'date',
            description: 'Analysis end date',
          },
          endpoint_id: {
            type: 'string',
            format: 'uuid',
            description: 'Specific endpoint to analyze',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            analysis: {
              type: 'object',
              properties: {
                total_deliveries: { type: 'integer' },
                success_rate: { type: 'number' },
                average_delivery_time: { type: 'number' },
                patterns: { type: 'object' },
                recommendations: { type: 'array' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { orgId } = request.params
      const { start_date, end_date, endpoint_id } = request.query
      
      const options = {}
      if (start_date) options.startDate = new Date(start_date)
      if (end_date) options.endDate = new Date(end_date)
      if (endpoint_id) options.endpointId = endpoint_id
      
      const analysis = await webhookTestingService.analyzeDeliveryPatterns(orgId, options)
      
      return reply.send({
        success: true,
        analysis,
      })
    } catch (error) {
      fastify.log.error('Failed to analyze delivery patterns:', error.message)
      
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to analyze delivery patterns',
      })
    }
  })
  
  // Get test results
  fastify.get('/results/:testId', {
    preHandler: [
      (request, reply) => fastify.authenticate(request, reply),
      (request, reply) => rbac.requirePermission('webhooks:read')(request, reply)
    ],
    schema: {
      description: 'Get webhook test results by test ID',
      tags: ['Webhook Testing'],
      params: {
        type: 'object',
        required: ['testId'],
        properties: {
          testId: {
            type: 'string',
            format: 'uuid',
            description: 'Test result ID',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            test_result: { type: 'object' },
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
      const { testId } = request.params
      
      const testResult = webhookTestingService.getTestResult(testId)
      
      if (!testResult) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Test result not found',
        })
      }
      
      return reply.send({
        success: true,
        test_result: testResult,
      })
    } catch (error) {
      fastify.log.error('Failed to get test result:', error.message)
      
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve test result',
      })
    }
  })
  
  // Generate test payload
  fastify.post('/generate-payload', {
    preHandler: [
      (request, reply) => fastify.authenticate(request, reply)
    ],
    schema: {
      description: 'Generate test payload for specific event type',
      tags: ['Webhook Testing'],
      body: {
        type: 'object',
        required: ['event_type'],
        properties: {
          event_type: {
            type: 'string',
            description: 'Event type to generate payload for',
          },
          custom_data: {
            type: 'object',
            description: 'Custom data to include in payload',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            payload: { type: 'object' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { event_type, custom_data = {} } = request.body
      
      const payload = webhookTestingService.generateTestPayload(event_type, custom_data)
      
      return reply.send({
        success: true,
        payload,
      })
    } catch (error) {
      fastify.log.error('Failed to generate test payload:', error.message)
      
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to generate test payload',
      })
    }
  })
  
  // Health check
  fastify.get('/health', {
    schema: {
      description: 'Webhook testing service health check',
      tags: ['Webhook Testing'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            test_results_cached: { type: 'integer' },
            max_cache_size: { type: 'integer' },
            features: { type: 'array' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const health = webhookTestingService.getHealthStatus()
      
      return reply.send(health)
    } catch (error) {
      return reply.code(503).send({
        status: 'unhealthy',
        error: error.message,
      })
    }
  })
}
