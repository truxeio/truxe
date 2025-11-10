/**
 * Port Dashboard Routes
 * 
 * Real-time service status dashboard with port monitoring:
 * - GET /dashboard/ports - Real-time port status
 * - GET /dashboard/ports/health - Service health check
 * - GET /dashboard/ports/analytics - Port usage analytics
 * - WebSocket /dashboard/ports/live - Live port monitoring
 */

import { WebSocketServer } from 'ws'
import PortAnalyticsService from '../services/port-analytics.js'
import { createErrorResponse } from '../services/error-messaging.js'

/**
 * Port dashboard routes plugin
 */
export default async function portDashboardRoutes(fastify, options) {
  // Store active WebSocket connections
  const activeConnections = new Set()
  
  // Initialize port analytics service
  const portAnalytics = new PortAnalyticsService()

  // Real-time port status
  fastify.get('/ports', {
    schema: {
      description: 'Get real-time port status and service information',
      tags: ['Port Dashboard'],
      querystring: {
        type: 'object',
        properties: {
          env: {
            type: 'string',
            enum: ['development', 'staging', 'production', 'testing'],
            default: 'development',
            description: 'Environment to check',
          },
          detailed: {
            type: 'boolean',
            default: false,
            description: 'Include detailed process information',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            environment: { type: 'string' },
            timestamp: { type: 'string' },
            summary: {
              type: 'object',
              properties: {
                totalServices: { type: 'integer' },
                healthyServices: { type: 'integer' },
                unhealthyServices: { type: 'integer' },
                portUtilization: { type: 'number' },
                conflicts: { type: 'integer' },
                overallStatus: { type: 'string' },
              },
            },
            services: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  port: { type: 'integer' },
                  status: { type: 'string' },
                  health: { type: 'string' },
                  responseTime: { type: 'number' },
                  uptime: { type: 'number' },
                  lastCheck: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { env = 'development', detailed = false } = request.query
      
      // Get real-time port status
      const portStatus = await getRealTimePortStatus(env, detailed)
      
      return reply.send({
        success: true,
        environment: env,
        timestamp: new Date().toISOString(),
        ...portStatus,
      })
    } catch (error) {
      fastify.log.error('Port status check failed:', error.message)
      
      const errorResponse = createErrorResponse(error, {
        requestId: request.id,
        endpoint: '/dashboard/ports',
        environment: request.query.env,
      })
      
      return reply.code(500).send(errorResponse)
    }
  })

  // Service health check
  fastify.get('/ports/health', {
    schema: {
      description: 'Get comprehensive service health information',
      tags: ['Port Dashboard'],
      querystring: {
        type: 'object',
        properties: {
          env: {
            type: 'string',
            enum: ['development', 'staging', 'production', 'testing'],
            default: 'development',
            description: 'Environment to check',
          },
          includeMetrics: {
            type: 'boolean',
            default: true,
            description: 'Include performance metrics',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            environment: { type: 'string' },
            timestamp: { type: 'string' },
            health: {
              type: 'object',
              properties: {
                overallHealth: { type: 'number' },
                healthScore: { type: 'number' },
                status: { type: 'string' },
                services: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      port: { type: 'integer' },
                      healthy: { type: 'boolean' },
                      responseTime: { type: 'number' },
                      error: { type: 'string' },
                      lastCheck: { type: 'string' },
                    },
                  },
                },
              },
            },
            metrics: {
              type: 'object',
              properties: {
                averageResponseTime: { type: 'number' },
                errorRate: { type: 'number' },
                uptime: { type: 'number' },
                throughput: { type: 'number' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { env = 'development', includeMetrics = true } = request.query
      
      // Get service health data
      const healthData = await portAnalytics.getServiceHealthData(env)
      
      // Get performance metrics if requested
      let metrics = null
      if (includeMetrics) {
        const analytics = await portAnalytics.getPortAnalytics({
          environment: env,
          timeframe: '1h',
          includeDetails: false,
          includeRecommendations: false,
        })
        metrics = analytics.performance.averages
      }
      
      return reply.send({
        success: true,
        environment: env,
        timestamp: new Date().toISOString(),
        health: {
          overallHealth: healthData.overallHealth,
          healthScore: Math.round(healthData.overallHealth * 100),
          status: healthData.overallHealth > 0.8 ? 'healthy' : 
                  healthData.overallHealth > 0.6 ? 'degraded' : 'unhealthy',
          services: healthData.services,
        },
        metrics,
      })
    } catch (error) {
      fastify.log.error('Health check failed:', error.message)
      
      const errorResponse = createErrorResponse(error, {
        requestId: request.id,
        endpoint: '/dashboard/ports/health',
        environment: request.query.env,
      })
      
      return reply.code(500).send(errorResponse)
    }
  })

  // Port usage analytics
  fastify.get('/ports/analytics', {
    schema: {
      description: 'Get port usage analytics and insights',
      tags: ['Port Dashboard'],
      querystring: {
        type: 'object',
        properties: {
          env: {
            type: 'string',
            enum: ['development', 'staging', 'production', 'testing'],
            default: 'development',
            description: 'Environment to analyze',
          },
          timeframe: {
            type: 'string',
            enum: ['1h', '24h', '7d', '30d'],
            default: '24h',
            description: 'Analysis timeframe',
          },
          includeRecommendations: {
            type: 'boolean',
            default: true,
            description: 'Include optimization recommendations',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            environment: { type: 'string' },
            timeframe: { type: 'string' },
            timestamp: { type: 'string' },
            analytics: {
              type: 'object',
              properties: {
                summary: { type: 'object' },
                utilization: { type: 'object' },
                conflicts: { type: 'object' },
                performance: { type: 'object' },
                recommendations: { type: 'array' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { 
        env = 'development', 
        timeframe = '24h', 
        includeRecommendations = true 
      } = request.query
      
      // Get port analytics
      const analytics = await portAnalytics.getPortAnalytics({
        environment: env,
        timeframe,
        includeDetails: true,
        includeRecommendations,
      })
      
      return reply.send({
        success: true,
        environment: env,
        timeframe,
        timestamp: analytics.timestamp,
        analytics: {
          summary: analytics.summary,
          utilization: analytics.utilization,
          conflicts: analytics.conflicts,
          performance: analytics.performance,
          recommendations: analytics.recommendations,
        },
      })
    } catch (error) {
      fastify.log.error('Analytics generation failed:', error.message)
      
      const errorResponse = createErrorResponse(error, {
        requestId: request.id,
        endpoint: '/dashboard/ports/analytics',
        environment: request.query.env,
        timeframe: request.query.timeframe,
      })
      
      return reply.code(500).send(errorResponse)
    }
  })

  // WebSocket for live monitoring
  fastify.get('/ports/live', {
    websocket: true,
    schema: {
      description: 'WebSocket endpoint for live port monitoring',
      tags: ['Port Dashboard'],
    },
  }, (connection, request) => {
    const { env = 'development' } = request.query
    
    // Add connection to active connections
    activeConnections.add(connection)
    
    fastify.log.info(`New WebSocket connection for port monitoring (${env})`)
    
    // Send initial data
    sendPortStatus(connection, env)
    
    // Set up periodic updates
    const interval = setInterval(async () => {
      if (connection.readyState === connection.OPEN) {
        try {
          await sendPortStatus(connection, env)
        } catch (error) {
          fastify.log.error('WebSocket update failed:', error.message)
        }
      } else {
        clearInterval(interval)
        activeConnections.delete(connection)
      }
    }, 5000) // Update every 5 seconds
    
    // Handle connection close
    connection.on('close', () => {
      clearInterval(interval)
      activeConnections.delete(connection)
      fastify.log.info('WebSocket connection closed')
    })
    
    // Handle errors
    connection.on('error', (error) => {
      fastify.log.error('WebSocket error:', error.message)
      clearInterval(interval)
      activeConnections.delete(connection)
    })
  })

  // Broadcast updates to all connected clients
  function broadcastUpdate(data) {
    const message = JSON.stringify(data)
    activeConnections.forEach(connection => {
      if (connection.readyState === connection.OPEN) {
        connection.send(message)
      }
    })
  }

  // Send port status to WebSocket client
  async function sendPortStatus(connection, env) {
    try {
      const portStatus = await getRealTimePortStatus(env, true)
      connection.send(JSON.stringify({
        type: 'port_status',
        timestamp: new Date().toISOString(),
        environment: env,
        data: portStatus,
      }))
    } catch (error) {
      connection.send(JSON.stringify({
        type: 'error',
        timestamp: new Date().toISOString(),
        error: error.message,
      }))
    }
  }

  // Get real-time port status
  async function getRealTimePortStatus(env, detailed) {
    const portUsage = await portAnalytics.getPortUsageData(env, new Date(Date.now() - 24 * 60 * 60 * 1000))
    const health = await portAnalytics.getServiceHealthData(env)
    const conflicts = await portAnalytics.getConflictData(env, new Date(Date.now() - 24 * 60 * 60 * 1000))
    
    // Calculate summary
    const summary = {
      totalServices: portUsage.totalPorts,
      healthyServices: health.healthyServices,
      unhealthyServices: health.unhealthyServices,
      portUtilization: Math.round((portUsage.usedPorts / portUsage.totalPorts) * 100),
      conflicts: conflicts.totalConflicts,
      overallStatus: health.overallHealth > 0.8 ? 'healthy' : 
                     health.overallHealth > 0.6 ? 'degraded' : 'unhealthy',
    }
    
    // Build services array
    const services = portUsage.ports.map(port => {
      const healthCheck = health.services.find(s => s.port === port.port)
      return {
        name: port.service,
        port: port.port,
        status: port.inUse ? 'running' : 'stopped',
        health: healthCheck ? (healthCheck.healthy ? 'healthy' : 'unhealthy') : 'unknown',
        responseTime: healthCheck ? healthCheck.responseTime : null,
        uptime: port.averageUptime || 0,
        lastCheck: new Date().toISOString(),
        process: detailed ? port.process : undefined,
        pid: detailed ? port.pid : undefined,
      }
    })
    
    return {
      summary,
      services,
    }
  }

  // Health check endpoint for the dashboard itself
  fastify.get('/health', {
    schema: {
      description: 'Dashboard health check',
      tags: ['Port Dashboard'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            status: { type: 'string' },
            timestamp: { type: 'string' },
            connections: { type: 'integer' },
            uptime: { type: 'number' },
          },
        },
      },
    },
  }, async (request, reply) => {
    return reply.send({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      connections: activeConnections.size,
      uptime: process.uptime(),
    })
  })

  // Cleanup on server close
  fastify.addHook('onClose', () => {
    activeConnections.forEach(connection => {
      if (connection.readyState === connection.OPEN) {
        connection.close()
      }
    })
    activeConnections.clear()
  })
}
