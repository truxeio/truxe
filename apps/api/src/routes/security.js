/**
 * Security Routes
 * 
 * RESTful API endpoints for security monitoring and management:
 * - GET /security/dashboard - Security dashboard data
 * - GET /security/incidents - Security incidents
 * - GET /security/threats - Threat detection data
 * - GET /security/sessions - Session security data
 * - POST /security/incidents/:id/resolve - Resolve incident
 * - GET /security/health - Security services health
 */

import securityMonitoringService from '../services/security-monitoring.js'
import threatDetectionService from '../services/threat-detection.js'
import securityIncidentResponseService from '../services/security-incident-response.js'
import advancedSessionSecurityService from '../services/advanced-session-security.js'
import refreshTokenRotationService from '../services/refresh-token-rotation.js'
import config from '../config/index.js'

/**
 * Security routes plugin
 */
export default async function securityRoutes(fastify, options) {
  // Security dashboard
  fastify.get('/dashboard', {
    preHandler: [(request, reply) => fastify.requireRole(['admin', 'security'])(request, reply)],
    schema: {
      description: 'Get comprehensive security dashboard data',
      tags: ['Security'],
      querystring: {
        type: 'object',
        properties: {
          timeRange: {
            type: 'string',
            enum: ['1h', '24h', '7d', '30d'],
            default: '24h',
            description: 'Time range for data aggregation',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            timeRange: { type: 'string' },
            generatedAt: { type: 'string' },
            securityStatus: { type: 'string' },
            securityScore: { type: 'number' },
            metrics: {
              type: 'object',
              properties: {
                sessions: { type: 'object' },
                threats: { type: 'object' },
                incidents: { type: 'object' },
                tokens: { type: 'object' },
                devices: { type: 'object' },
                ips: { type: 'object' },
              },
            },
            alerts: { type: 'array' },
            trends: { type: 'array' },
            summary: { type: 'object' },
          },
        },
        403: {
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
      const { timeRange = '24h' } = request.query
      
      const dashboard = await securityMonitoringService.getSecurityDashboard(timeRange)
      
      return reply.send(dashboard)
    } catch (error) {
      fastify.log.error('Security dashboard failed:', error.message)
      
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve security dashboard data',
      })
    }
  })
  
  // Security incidents
  fastify.get('/incidents', {
    preHandler: [(request, reply) => fastify.requireRole(['admin', 'security'])(request, reply)],
    schema: {
      description: 'Get security incidents',
      tags: ['Security'],
      querystring: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['open', 'resolved', 'all'],
            default: 'all',
          },
          severity: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical', 'all'],
            default: 'all',
          },
          limit: {
            type: 'number',
            minimum: 1,
            maximum: 1000,
            default: 50,
          },
          offset: {
            type: 'number',
            minimum: 0,
            default: 0,
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            incidents: { type: 'array' },
            total: { type: 'number' },
            limit: { type: 'number' },
            offset: { type: 'number' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { status = 'all', severity = 'all', limit = 50, offset = 0 } = request.query
      
      // Get incidents from database
      let query = `
        SELECT id, type, severity, category, status, priority, source, user_id,
               ip, user_agent, device_info, details, risk_score, escalation_level,
               assigned_to, created_at, updated_at, resolved_at, resolution
        FROM security_incidents
        WHERE 1=1
      `
      const params = []
      let paramCount = 0
      
      if (status !== 'all') {
        paramCount++
        query += ` AND status = $${paramCount}`
        params.push(status)
      }
      
      if (severity !== 'all') {
        paramCount++
        query += ` AND severity = $${paramCount}`
        params.push(severity)
      }
      
      query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`
      params.push(limit, offset)
      
      const result = await fastify.pg.query(query, params)
      
      // Get total count
      let countQuery = 'SELECT COUNT(*) as total FROM security_incidents WHERE 1=1'
      const countParams = []
      let countParamCount = 0
      
      if (status !== 'all') {
        countParamCount++
        countQuery += ` AND status = $${countParamCount}`
        countParams.push(status)
      }
      
      if (severity !== 'all') {
        countParamCount++
        countQuery += ` AND severity = $${countParamCount}`
        countParams.push(severity)
      }
      
      const countResult = await fastify.pg.query(countQuery, countParams)
      const total = parseInt(countResult.rows[0].total)
      
      const incidents = result.rows.map(row => ({
        id: row.id,
        type: row.type,
        severity: row.severity,
        category: row.category,
        status: row.status,
        priority: row.priority,
        source: row.source,
        userId: row.user_id,
        ip: row.ip ? row.ip.substring(0, 8) + '***' : null,
        userAgent: row.user_agent,
        deviceInfo: row.device_info,
        details: row.details,
        riskScore: row.risk_score,
        escalationLevel: row.escalation_level,
        assignedTo: row.assigned_to,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        resolvedAt: row.resolved_at,
        resolution: row.resolution,
      }))
      
      return reply.send({
        incidents,
        total,
        limit,
        offset,
      })
    } catch (error) {
      fastify.log.error('Security incidents retrieval failed:', error.message)
      
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve security incidents',
      })
    }
  })
  
  // Get specific incident
  fastify.get('/incidents/:id', {
    preHandler: [(request, reply) => fastify.requireRole(['admin', 'security'])(request, reply)],
    schema: {
      description: 'Get specific security incident',
      tags: ['Security'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            incident: { type: 'object' },
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
      
      const incident = await securityIncidentResponseService.getIncident(id)
      
      if (!incident) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Security incident not found',
        })
      }
      
      return reply.send({ incident })
    } catch (error) {
      fastify.log.error('Security incident retrieval failed:', error.message)
      
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve security incident',
      })
    }
  })
  
  // Resolve incident
  fastify.post('/incidents/:id/resolve', {
    preHandler: [(request, reply) => fastify.requireRole(['admin', 'security'])(request, reply)],
    schema: {
      description: 'Resolve security incident',
      tags: ['Security'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          resolution: {
            type: 'string',
            description: 'Resolution details',
          },
          assignedTo: {
            type: 'string',
            description: 'User ID of assignee',
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
      const { resolution, assignedTo } = request.body
      
      const result = await securityIncidentResponseService.updateIncidentStatus(
        id,
        'resolved',
        resolution,
        assignedTo
      )
      
      if (!result.success) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Security incident not found or update failed',
        })
      }
      
      return reply.send({
        success: true,
        message: 'Security incident resolved successfully',
      })
    } catch (error) {
      fastify.log.error('Security incident resolution failed:', error.message)
      
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to resolve security incident',
      })
    }
  })
  
  // Threat detection data
  fastify.get('/threats', {
    preHandler: [(request, reply) => fastify.requireRole(['admin', 'security'])(request, reply)],
    schema: {
      description: 'Get threat detection data',
      tags: ['Security'],
      querystring: {
        type: 'object',
        properties: {
          timeRange: {
            type: 'string',
            enum: ['1h', '24h', '7d', '30d'],
            default: '24h',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            threats: { type: 'object' },
            bruteForce: { type: 'object' },
            accountTakeover: { type: 'object' },
            suspiciousActivity: { type: 'object' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { timeRange = '24h' } = request.query
      
      // Get threat detection health status
      const threatHealth = await threatDetectionService.getHealthStatus()
      
      // Get threat metrics from monitoring service
      const hours = timeRange === '1h' ? 1 : timeRange === '7d' ? 168 : timeRange === '30d' ? 720 : 24
      const threatMetrics = await securityMonitoringService.getThreatMetrics(hours)
      
      return reply.send({
        threats: threatMetrics,
        bruteForce: {
          enabled: threatHealth.config?.bruteForce?.enabled || false,
          maxAttempts: threatHealth.config?.bruteForce?.maxAttempts || 5,
          windowMinutes: threatHealth.config?.bruteForce?.windowMinutes || 15,
        },
        accountTakeover: {
          enabled: threatHealth.config?.accountTakeover?.enabled || false,
          suspiciousLoginThreshold: threatHealth.config?.accountTakeover?.suspiciousLoginThreshold || 3,
        },
        suspiciousActivity: {
          enabled: threatHealth.config?.suspiciousActivity?.enabled || false,
          rapidSessionCreation: threatHealth.config?.suspiciousActivity?.rapidSessionCreation || 10,
        },
      })
    } catch (error) {
      fastify.log.error('Threat detection data retrieval failed:', error.message)
      
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve threat detection data',
      })
    }
  })
  
  // Session security data
  fastify.get('/sessions', {
    preHandler: [(request, reply) => fastify.requireRole(['admin', 'security'])(request, reply)],
    schema: {
      description: 'Get session security data',
      tags: ['Security'],
      querystring: {
        type: 'object',
        properties: {
          timeRange: {
            type: 'string',
            enum: ['1h', '24h', '7d', '30d'],
            default: '24h',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            sessions: { type: 'object' },
            devices: { type: 'object' },
            ips: { type: 'object' },
            tokens: { type: 'object' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { timeRange = '24h' } = request.query
      
      // Get session security health status
      const sessionHealth = await advancedSessionSecurityService.getHealthStatus()
      
      // Get session metrics from monitoring service
      const hours = timeRange === '1h' ? 1 : timeRange === '7d' ? 168 : timeRange === '30d' ? 720 : 24
      const [sessionMetrics, deviceMetrics, ipMetrics, tokenMetrics] = await Promise.all([
        securityMonitoringService.getSessionMetrics(hours),
        securityMonitoringService.getDeviceMetrics(hours),
        securityMonitoringService.getIPMetrics(hours),
        securityMonitoringService.getTokenMetrics(hours),
      ])
      
      return reply.send({
        sessions: sessionMetrics,
        devices: deviceMetrics,
        ips: ipMetrics,
        tokens: tokenMetrics,
        config: {
          maxConcurrentSessions: sessionHealth.maxConcurrentSessions,
          deviceTracking: sessionHealth.deviceTracking,
          impossibleTravelDetection: sessionHealth.features?.impossibleTravelDetection,
        },
      })
    } catch (error) {
      fastify.log.error('Session security data retrieval failed:', error.message)
      
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve session security data',
      })
    }
  })
  
  // Security services health
  fastify.get('/health', {
    preHandler: [(request, reply) => fastify.requireRole(['admin', 'security'])(request, reply)],
    schema: {
      description: 'Get security services health status',
      tags: ['Security'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            services: { type: 'object' },
            database: { type: 'object' },
            config: { type: 'object' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const health = await securityMonitoringService.getHealthStatus()
      
      return reply.send(health)
    } catch (error) {
      fastify.log.error('Security health check failed:', error.message)
      
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to check security services health',
      })
    }
  })
  
  // Security alerts
  fastify.get('/alerts', {
    preHandler: [(request, reply) => fastify.requireRole(['admin', 'security'])(request, reply)],
    schema: {
      description: 'Get recent security alerts',
      tags: ['Security'],
      querystring: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            minimum: 1,
            maximum: 1000,
            default: 50,
          },
          severity: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical', 'all'],
            default: 'all',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            alerts: { type: 'array' },
            total: { type: 'number' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { limit = 50, severity = 'all' } = request.query
      
      const alerts = await securityMonitoringService.getRecentAlerts(limit)
      
      // Filter by severity if specified
      const filteredAlerts = severity === 'all' 
        ? alerts 
        : alerts.filter(alert => alert.severity === severity)
      
      return reply.send({
        alerts: filteredAlerts,
        total: filteredAlerts.length,
      })
    } catch (error) {
      fastify.log.error('Security alerts retrieval failed:', error.message)
      
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve security alerts',
      })
    }
  })
  
  // Security trends
  fastify.get('/trends', {
    preHandler: [(request, reply) => fastify.requireRole(['admin', 'security'])(request, reply)],
    schema: {
      description: 'Get security trends over time',
      tags: ['Security'],
      querystring: {
        type: 'object',
        properties: {
          timeRange: {
            type: 'string',
            enum: ['1h', '24h', '7d', '30d'],
            default: '24h',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            trends: { type: 'array' },
            timeRange: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { timeRange = '24h' } = request.query
      
      const hours = timeRange === '1h' ? 1 : timeRange === '7d' ? 168 : timeRange === '30d' ? 720 : 24
      const trends = await securityMonitoringService.getSecurityTrends(hours)
      
      return reply.send({
        trends,
        timeRange,
      })
    } catch (error) {
      fastify.log.error('Security trends retrieval failed:', error.message)
      
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve security trends',
      })
    }
  })
}