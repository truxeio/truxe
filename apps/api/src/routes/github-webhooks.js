/**
 * GitHub Webhooks Routes
 *
 * RESTful API endpoints for receiving and managing GitHub webhooks:
 * - POST /api/github/webhooks - Receive GitHub webhook events
 * - GET /api/github/webhooks/events - List webhook events
 * - POST /api/github/webhooks/events/:id/retry - Retry failed event
 * - GET /api/github/webhooks/stats - Get webhook statistics
 */

import GitHubWebhookHandler from '../services/github/webhook-handler.js';
import GitHubWebhookRegistrationService from '../services/github/webhook-registration.js';
import { getPool } from '../database/connection.js';
import config from '../config/index.js';

/**
 * GitHub webhooks routes plugin
 */
export default async function githubWebhookRoutes(fastify, options) {
  const webhookHandler = new GitHubWebhookHandler({
    pool: getPool(),
    logger: fastify.log,
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET || config.github?.webhookSecret,
  });

  const webhookRegistration = new GitHubWebhookRegistrationService({
    pool: getPool(),
    logger: fastify.log,
    baseWebhookUrl: process.env.GITHUB_WEBHOOK_BASE_URL ||
      `${config.app.url || `http://localhost:${process.env.TRUXE_API_PORT || 87001}`}/api/github/webhooks`,
  });

  // WebSocket clients for real-time updates
  const wsClients = new Set();

  // Set up event listeners for real-time updates
  webhookHandler.on('eventProcessed', (data) => {
    broadcastToClients({ type: 'event_processed', data });
  });

  webhookHandler.on('eventFailed', (data) => {
    broadcastToClients({ type: 'event_failed', data });
  });

  function broadcastToClients(message) {
    const jsonMessage = JSON.stringify(message);
    wsClients.forEach(client => {
      if (client.readyState === client.OPEN) {
        try {
          client.send(jsonMessage);
        } catch (error) {
          fastify.log.error('Failed to send WebSocket message', { error: error.message });
        }
      }
    });
  }

  /**
   * Register content type parser for raw body (needed for signature verification)
   * This preserves the raw request body before JSON parsing
   */
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    try {
      // Store raw body for signature verification
      req.rawBody = body;
      // Parse JSON normally
      const json = JSON.parse(body);
      done(null, json);
    } catch (error) {
      done(error, undefined);
    }
  });

  /**
   * Receive GitHub webhook
   * 
   * This endpoint receives webhooks from GitHub and processes them.
   * It verifies the HMAC signature, stores the event, and processes it asynchronously.
   */
  fastify.post('/', {
    // Disable authentication for webhook endpoint (GitHub uses signature verification)
    schema: {
      description: 'Receive GitHub webhook events',
      tags: ['GitHub Webhooks'],
      headers: {
        type: 'object',
        required: ['x-github-event', 'x-github-delivery'],
        properties: {
          'x-github-event': {
            type: 'string',
            description: 'GitHub webhook event type',
          },
          'x-github-delivery': {
            type: 'string',
            description: 'Unique delivery ID for this webhook',
          },
          'x-hub-signature-256': {
            type: 'string',
            description: 'HMAC SHA-256 signature for webhook verification',
          },
          'x-hub-signature': {
            type: 'string',
            description: 'HMAC SHA-1 signature (deprecated, use x-hub-signature-256)',
          },
          'x-github-installation-id': {
            type: 'string',
            description: 'GitHub App installation ID',
          },
        },
      },
      body: {
        type: 'object',
        description: 'GitHub webhook payload',
        additionalProperties: true,
      },
      response: {
        200: {
          type: 'object',
          properties: {
            received: { type: 'boolean' },
            deliveryId: { type: 'string' },
            event: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      return await webhookHandler.handleWebhook(request, reply);
    } catch (error) {
      fastify.log.error({ err: error }, 'Failed to handle GitHub webhook');
      return reply.code(500).send({
        error: 'Failed to process webhook',
        message: error.message,
      });
    }
  });

  /**
   * List webhook events
   */
  fastify.get('/events', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'List GitHub webhook events',
      tags: ['GitHub Webhooks'],
      querystring: {
        type: 'object',
        properties: {
          event_type: {
            type: 'string',
            description: 'Filter by event type',
          },
          processed: {
            type: 'boolean',
            description: 'Filter by processed status',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 1000,
            default: 100,
            description: 'Number of events to return',
          },
          offset: {
            type: 'integer',
            minimum: 0,
            default: 0,
            description: 'Number of events to skip',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            events: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  delivery_id: { type: 'string' },
                  event_type: { type: 'string' },
                  processed: { type: 'boolean' },
                  processed_at: { type: 'string', format: 'date-time', nullable: true },
                  processing_error: { type: 'string', nullable: true },
                  retry_count: { type: 'integer' },
                  received_at: { type: 'string', format: 'date-time' },
                  installation_id: { type: 'string', nullable: true },
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
      const { event_type, processed, limit = 100, offset = 0 } = request.query;

      const events = await webhookHandler.getEvents({
        eventType: event_type,
        processed,
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

      // Get total count for pagination (simplified - in production you might want a separate count query)
      const total = events.length;

      return reply.send({
        events: events.map(event => ({
          id: event.id,
          delivery_id: event.delivery_id,
          event_type: event.event_type,
          processed: event.processed,
          processed_at: event.processed_at?.toISOString(),
          processing_error: event.processing_error,
          retry_count: event.retry_count,
          received_at: event.received_at?.toISOString(),
          installation_id: event.installation_id,
        })),
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total,
        },
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Failed to list webhook events');
      return reply.code(500).send({
        error: 'Failed to list webhook events',
        message: error.message,
      });
    }
  });

  /**
   * Get webhook event by ID
   */
  fastify.get('/events/:id', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'Get GitHub webhook event by ID',
      tags: ['GitHub Webhooks'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            delivery_id: { type: 'string' },
            event_type: { type: 'string' },
            payload: { type: 'object', additionalProperties: true },
            processed: { type: 'boolean' },
            processed_at: { type: 'string', format: 'date-time', nullable: true },
            processing_error: { type: 'string', nullable: true },
            retry_count: { type: 'integer' },
            received_at: { type: 'string', format: 'date-time' },
            installation_id: { type: 'string', nullable: true },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const pool = getPool();
      const result = await pool.query(
        `SELECT * FROM github_webhook_events WHERE id = $1`,
        [request.params.id]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({
          error: 'Event not found',
        });
      }

      const event = result.rows[0];

      return reply.send({
        id: event.id,
        delivery_id: event.delivery_id,
        event_type: event.event_type,
        payload: typeof event.payload === 'string' 
          ? JSON.parse(event.payload) 
          : event.payload,
        processed: event.processed,
        processed_at: event.processed_at?.toISOString(),
        processing_error: event.processing_error,
        retry_count: event.retry_count,
        received_at: event.received_at?.toISOString(),
        installation_id: event.installation_id,
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Failed to get webhook event');
      return reply.code(500).send({
        error: 'Failed to get webhook event',
        message: error.message,
      });
    }
  });

  /**
   * Retry failed webhook event
   */
  fastify.post('/events/:id/retry', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'Retry processing a failed GitHub webhook event',
      tags: ['GitHub Webhooks'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
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
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      await webhookHandler.retryEvent(request.params.id);

      return reply.send({
        success: true,
        message: 'Event retry initiated',
      });
    } catch (error) {
      if (error.message === 'Event not found') {
        return reply.code(404).send({
          error: 'Event not found',
        });
      }

      fastify.log.error({ err: error }, 'Failed to retry webhook event');
      return reply.code(500).send({
        error: 'Failed to retry webhook event',
        message: error.message,
      });
    }
  });

  /**
   * Get webhook statistics
   */
  fastify.get('/stats', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'Get GitHub webhook statistics',
      tags: ['GitHub Webhooks'],
      querystring: {
        type: 'object',
        properties: {
          since: {
            type: 'string',
            format: 'date-time',
            description: 'Get statistics since this timestamp (default: 24 hours ago)',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            statistics: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  event_type: { type: 'string' },
                  total_count: { type: 'integer' },
                  processed_count: { type: 'integer' },
                  failed_count: { type: 'integer' },
                  avg_processing_time_ms: { type: 'number', nullable: true },
                },
              },
            },
            handler_metrics: {
              type: 'object',
              description: 'Runtime metrics from webhook handler',
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const pool = getPool();
      const since = request.query.since 
        ? new Date(request.query.since)
        : new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

      const result = await pool.query(
        `SELECT * FROM get_github_webhook_stats($1)`,
        [since]
      );

      // Get handler metrics
      const handlerMetrics = webhookHandler.getMetrics();

      return reply.send({
        statistics: result.rows.map(row => ({
          event_type: row.event_type,
          total_count: parseInt(row.total_count),
          processed_count: parseInt(row.processed_count),
          failed_count: parseInt(row.failed_count),
          avg_processing_time_ms: row.avg_processing_time_ms 
            ? parseFloat(row.avg_processing_time_ms) 
            : null,
        })),
        handler_metrics: handlerMetrics,
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Failed to get webhook statistics');
      return reply.code(500).send({
        error: 'Failed to get webhook statistics',
        message: error.message,
      });
    }
  });

  /**
   * Get webhook handler metrics
   */
  fastify.get('/metrics', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'Get GitHub webhook handler runtime metrics',
      tags: ['GitHub Webhooks'],
      response: {
        200: {
          type: 'object',
          properties: {
            metrics: {
              type: 'object',
              properties: {
                totalReceived: { type: 'integer' },
                totalProcessed: { type: 'integer' },
                totalFailed: { type: 'integer' },
                totalRetries: { type: 'integer' },
                signatureFailures: { type: 'integer' },
                replayAttempts: { type: 'integer' },
                rateLimitHits: { type: 'integer' },
                queueSize: { type: 'integer' },
                activeProcessing: { type: 'integer' },
                replayProtectionSize: { type: 'integer' },
                timestamp: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const metrics = webhookHandler.getMetrics();
      return reply.send({ metrics });
    } catch (error) {
      fastify.log.error({ err: error }, 'Failed to get webhook metrics');
      return reply.code(500).send({
        error: 'Failed to get webhook metrics',
        message: error.message,
      });
    }
  });

  /**
   * Register webhook for repository
   */
  fastify.post('/register', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'Register GitHub webhook for a repository',
      tags: ['GitHub Webhooks'],
      body: {
        type: 'object',
        required: ['owner', 'repo', 'secret', 'events'],
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner (user or organization)',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          webhookUrl: {
            type: 'string',
            format: 'uri',
            description: 'Custom webhook URL (optional, uses default if not provided)',
          },
          secret: {
            type: 'string',
            description: 'Webhook secret for signature verification',
          },
          events: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            description: 'Events to subscribe to',
          },
          active: {
            type: 'boolean',
            default: true,
            description: 'Whether webhook is active',
          },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            webhook: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                url: { type: 'string' },
                events: { type: 'array', items: { type: 'string' } },
                active: { type: 'boolean' },
                created_at: { type: 'string' },
                updated_at: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { owner, repo, webhookUrl, secret, events, active } = request.body;
      const userId = request.user.id;

      const webhook = await webhookRegistration.registerRepositoryWebhook({
        userId,
        owner,
        repo,
        webhookUrl,
        secret,
        events,
        active,
      });

      return reply.code(201).send({
        success: true,
        webhook,
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Failed to register webhook');
      return reply.code(400).send({
        error: 'Failed to register webhook',
        message: error.message,
      });
    }
  });

  /**
   * List webhooks for repository
   */
  fastify.get('/repos/:owner/:repo/webhooks', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'List webhooks for a repository',
      tags: ['GitHub Webhooks'],
      params: {
        type: 'object',
        required: ['owner', 'repo'],
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            webhooks: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { owner, repo } = request.params;
      const userId = request.user.id;

      const webhooks = await webhookRegistration.listRepositoryWebhooks({
        userId,
        owner,
        repo,
      });

      return reply.send({ webhooks });
    } catch (error) {
      fastify.log.error({ err: error }, 'Failed to list webhooks');
      return reply.code(400).send({
        error: 'Failed to list webhooks',
        message: error.message,
      });
    }
  });

  /**
   * Test webhook (ping)
   */
  fastify.post('/repos/:owner/:repo/webhooks/:hookId/test', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'Test a repository webhook',
      tags: ['GitHub Webhooks'],
      params: {
        type: 'object',
        required: ['owner', 'repo', 'hookId'],
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
          hookId: { type: 'integer' },
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
      const { owner, repo, hookId } = request.params;
      const userId = request.user.id;

      await webhookRegistration.testRepositoryWebhook({
        userId,
        owner,
        repo,
        hookId: parseInt(hookId),
      });

      return reply.send({
        success: true,
        message: 'Webhook test triggered',
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Failed to test webhook');
      return reply.code(400).send({
        error: 'Failed to test webhook',
        message: error.message,
      });
    }
  });

  /**
   * Delete webhook
   */
  fastify.delete('/repos/:owner/:repo/webhooks/:hookId', {
    preHandler: [(request, reply) => fastify.authenticate(request, reply)],
    schema: {
      description: 'Delete a repository webhook',
      tags: ['GitHub Webhooks'],
      params: {
        type: 'object',
        required: ['owner', 'repo', 'hookId'],
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
          hookId: { type: 'integer' },
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
      const { owner, repo, hookId } = request.params;
      const userId = request.user.id;

      await webhookRegistration.deleteRepositoryWebhook({
        userId,
        owner,
        repo,
        hookId: parseInt(hookId),
      });

      return reply.send({
        success: true,
        message: 'Webhook deleted',
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Failed to delete webhook');
      return reply.code(400).send({
        error: 'Failed to delete webhook',
        message: error.message,
      });
    }
  });

  /**
   * WebSocket endpoint for real-time webhook updates
   */
  fastify.get('/ws', {
    websocket: true,
    schema: {
      description: 'WebSocket endpoint for real-time GitHub webhook events',
      tags: ['GitHub Webhooks'],
    },
  }, (connection, request) => {
    // Add connection to clients
    wsClients.add(connection);
    fastify.log.info('GitHub webhook WebSocket client connected');

    // Send initial metrics
    const initialMetrics = webhookHandler.getMetrics();
    connection.send(JSON.stringify({
      type: 'initial_metrics',
      data: initialMetrics,
    }));

    // Set up periodic metrics updates
    const metricsInterval = setInterval(() => {
      if (connection.readyState === connection.OPEN) {
        try {
          const metrics = webhookHandler.getMetrics();
          connection.send(JSON.stringify({
            type: 'metrics_update',
            data: metrics,
          }));
        } catch (error) {
          fastify.log.error('Failed to send metrics update', { error: error.message });
        }
      } else {
        clearInterval(metricsInterval);
        wsClients.delete(connection);
      }
    }, 5000); // Update every 5 seconds

    // Handle client messages
    connection.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'ping') {
          connection.send(JSON.stringify({ type: 'pong' }));
        }
      } catch (error) {
        fastify.log.warn('Invalid WebSocket message', { error: error.message });
      }
    });

    // Handle connection close
    connection.on('close', () => {
      clearInterval(metricsInterval);
      wsClients.delete(connection);
      fastify.log.info('GitHub webhook WebSocket client disconnected');
    });

    // Handle errors
    connection.on('error', (error) => {
      fastify.log.error('WebSocket error', { error: error.message });
      clearInterval(metricsInterval);
      wsClients.delete(connection);
    });
  });
}

