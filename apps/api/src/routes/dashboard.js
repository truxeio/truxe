/**
 * Dashboard API Routes
 * 
 * Provides REST endpoints for the service status dashboard:
 * - Dashboard data and metrics
 * - Service management operations
 * - Port management operations
 * - System status and health checks
 * 
 * @author CLI Developer
 * @version 1.0.0
 */

import { DashboardService } from '../services/dashboard.js'

/**
 * Register dashboard routes
 */
export default async function dashboardRoutes(fastify, options) {
  // Initialize dashboard service if not already done
  if (!fastify.dashboardService) {
    // Import required services
    const { default: monitoringService } = await import('../services/monitoring.js')
    
    // Create port manager instance with environment-aware configuration
    const portManager = {
      getEnvironmentConfig: (env) => {
        // Environment-based port ranges (87XXX)
        const envPortMap = {
          development: {
            api: parseInt(process.env.TRUXE_API_PORT) || 87001,
            database: parseInt(process.env.TRUXE_DB_PORT) || 87032,
            redis: parseInt(process.env.TRUXE_REDIS_PORT) || 87079,
            mailhog_web: parseInt(process.env.TRUXE_MAILHOG_WEB_PORT) || 87825,
            mailhog_smtp: parseInt(process.env.TRUXE_MAILHOG_SMTP_PORT) || 87025,
            monitoring: parseInt(process.env.TRUXE_MONITORING_PORT) || 87090,
            grafana: parseInt(process.env.TRUXE_GRAFANA_PORT) || 87091,
            prometheus: parseInt(process.env.TRUXE_PROMETHEUS_PORT) || 87092
          },
          testing: {
            api: 87101,
            database: 87132,
            redis: 87179,
            mailhog_web: 87925,
            mailhog_smtp: 87125,
            monitoring: 87190,
            grafana: 87191,
            prometheus: 87192
          },
          staging: {
            api: 87201,
            database: 87232,
            redis: 87279,
            mailhog_smtp: 87225,
            monitoring: 87290,
            grafana: 87291,
            prometheus: 87292
          },
          production: {
            api: 87301,
            database: 87332,
            redis: 87379,
            monitoring: 87390,
            grafana: 87391,
            prometheus: 87392
          }
        };

        const currentEnv = process.env.TRUXE_ENV || process.env.NODE_ENV || 'development';
        return {
          services: envPortMap[currentEnv] || envPortMap.development
        };
      }
    }
    
    fastify.dashboardService = new DashboardService(
      fastify.server,
      portManager,
      monitoringService
    )
    
    // Start monitoring
    fastify.dashboardService.startMonitoring(5000)
    
    // Cleanup on server close
    fastify.addHook('onClose', async () => {
      await fastify.dashboardService.cleanup()
    })
  }
  
  // Dashboard overview endpoint
  fastify.get('/overview', {
    schema: {
      description: 'Get comprehensive dashboard overview',
      tags: ['Dashboard'],
      response: {
        200: {
          type: 'object',
          properties: {
            services: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  port: { type: 'number' },
                  status: { type: 'string' },
                  responseTime: { type: 'number' },
                  lastCheck: { type: 'number' }
                }
              }
            },
            ports: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  port: { type: 'number' },
                  serviceName: { type: 'string' },
                  inUse: { type: 'boolean' },
                  pid: { type: 'number' }
                }
              }
            },
            system: {
              type: 'object',
              properties: {
                cpu: { type: 'number' },
                memory: { type: 'number' },
                uptime: { type: 'number' },
                loadAverage: { type: 'array' }
              }
            },
            alerts: { type: 'array' },
            lastUpdate: { type: 'number' },
            isMonitoring: { type: 'boolean' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const dashboardData = fastify.dashboardService.getComprehensiveDashboardData()
      return reply.send(dashboardData)
    } catch (error) {
      fastify.log.error('Failed to get dashboard overview:', error.message)
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve dashboard data'
      })
    }
  })
  
  // Service status endpoint
  fastify.get('/services', {
    schema: {
      description: 'Get all service statuses',
      tags: ['Dashboard'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              port: { type: 'number' },
              status: { type: 'string' },
              responseTime: { type: 'number' },
              lastCheck: { type: 'number' },
              details: { type: 'string' }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const dashboardData = fastify.dashboardService.getComprehensiveDashboardData()
      return reply.send(dashboardData.services)
    } catch (error) {
      fastify.log.error('Failed to get service statuses:', error.message)
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve service data'
      })
    }
  })
  
  // Individual service details
  fastify.get('/services/:serviceId', {
    schema: {
      description: 'Get detailed information about a specific service',
      tags: ['Dashboard'],
      params: {
        type: 'object',
        properties: {
          serviceId: { type: 'string' }
        },
        required: ['serviceId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            port: { type: 'number' },
            status: { type: 'string' },
            responseTime: { type: 'number' },
            lastCheck: { type: 'number' },
            details: { type: 'string' },
            logs: { type: 'array' },
            dependencies: { type: 'array' },
            configuration: { type: 'object' }
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { serviceId } = request.params
      const dashboardData = fastify.dashboardService.getComprehensiveDashboardData()
      const service = dashboardData.services.find(s => s.id === serviceId)
      
      if (!service) {
        return reply.code(404).send({
          error: 'Not Found',
          message: `Service '${serviceId}' not found`
        })
      }
      
      // Get additional service details
      const serviceDetails = {
        ...service,
        logs: await fastify.dashboardService.getServiceLogs(serviceId),
        dependencies: fastify.dashboardService.getServiceDependencies(serviceId),
        configuration: fastify.dashboardService.getServiceConfiguration(serviceId)
      }
      
      return reply.send(serviceDetails)
    } catch (error) {
      fastify.log.error('Failed to get service details:', error.message)
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve service details'
      })
    }
  })
  
  // Port status endpoint
  fastify.get('/ports', {
    schema: {
      description: 'Get all port statuses',
      tags: ['Dashboard'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              port: { type: 'number' },
              serviceName: { type: 'string' },
              inUse: { type: 'boolean' },
              pid: { type: 'number' },
              command: { type: 'string' },
              lastCheck: { type: 'number' }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const dashboardData = fastify.dashboardService.getComprehensiveDashboardData()
      return reply.send(dashboardData.ports)
    } catch (error) {
      fastify.log.error('Failed to get port statuses:', error.message)
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve port data'
      })
    }
  })
  
  // Individual port details
  fastify.get('/ports/:port', {
    schema: {
      description: 'Get detailed information about a specific port',
      tags: ['Dashboard'],
      params: {
        type: 'object',
        properties: {
          port: { type: 'number' }
        },
        required: ['port']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            port: { type: 'number' },
            serviceName: { type: 'string' },
            inUse: { type: 'boolean' },
            pid: { type: 'number' },
            command: { type: 'string' },
            connections: { type: 'number' },
            history: { type: 'array' },
            lastCheck: { type: 'number' }
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { port } = request.params
      const dashboardData = fastify.dashboardService.getComprehensiveDashboardData()
      const portData = dashboardData.ports.find(p => p.port === parseInt(port))
      
      if (!portData) {
        return reply.code(404).send({
          error: 'Not Found',
          message: `Port ${port} not found in monitoring`
        })
      }
      
      // Get additional port details
      const portDetails = {
        ...portData,
        connections: await fastify.dashboardService.getPortConnections(port),
        history: await fastify.dashboardService.getPortHistory(port)
      }
      
      return reply.send(portDetails)
    } catch (error) {
      fastify.log.error('Failed to get port details:', error.message)
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve port details'
      })
    }
  })
  
  // System metrics endpoint
  fastify.get('/system', {
    schema: {
      description: 'Get system resource metrics',
      tags: ['Dashboard'],
      response: {
        200: {
          type: 'object',
          properties: {
            cpu: { type: 'number' },
            memory: { type: 'number' },
            uptime: { type: 'number' },
            loadAverage: { type: 'array' },
            totalMemory: { type: 'number' },
            freeMemory: { type: 'number' },
            cpuCount: { type: 'number' },
            platform: { type: 'string' },
            arch: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const dashboardData = fastify.dashboardService.getComprehensiveDashboardData()
      return reply.send(dashboardData.system)
    } catch (error) {
      fastify.log.error('Failed to get system metrics:', error.message)
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve system metrics'
      })
    }
  })
  
  // Performance metrics endpoint
  fastify.get('/performance', {
    schema: {
      description: 'Get performance metrics and time series data',
      tags: ['Dashboard'],
      response: {
        200: {
          type: 'object',
          properties: {
            requestCount: { type: 'number' },
            errorRate: { type: 'number' },
            averageResponseTime: { type: 'number' },
            rateLimitViolations: { type: 'number' },
            securityThreats: { type: 'number' },
            timeSeries: { type: 'object' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const dashboardData = fastify.dashboardService.getComprehensiveDashboardData()
      return reply.send(dashboardData.performance)
    } catch (error) {
      fastify.log.error('Failed to get performance metrics:', error.message)
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve performance metrics'
      })
    }
  })
  
  // Alerts endpoint
  fastify.get('/alerts', {
    schema: {
      description: 'Get current alerts and notifications',
      tags: ['Dashboard'],
      querystring: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['low', 'warning', 'critical'] },
          type: { type: 'string', enum: ['system', 'service', 'port', 'performance'] },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 50 }
        }
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              type: { type: 'string' },
              severity: { type: 'string' },
              message: { type: 'string' },
              timestamp: { type: 'number' },
              data: { type: 'object' }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { severity, type, limit = 50 } = request.query
      const dashboardData = fastify.dashboardService.getComprehensiveDashboardData()
      
      let alerts = dashboardData.alerts
      
      // Filter by severity
      if (severity) {
        alerts = alerts.filter(alert => alert.severity === severity)
      }
      
      // Filter by type
      if (type) {
        alerts = alerts.filter(alert => alert.type === type)
      }
      
      // Limit results
      alerts = alerts.slice(0, limit)
      
      return reply.send(alerts)
    } catch (error) {
      fastify.log.error('Failed to get alerts:', error.message)
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve alerts'
      })
    }
  })
  
  // Service management endpoints
  
  // Restart service
  fastify.post('/services/:serviceId/restart', {
    schema: {
      description: 'Restart a specific service',
      tags: ['Dashboard'],
      params: {
        type: 'object',
        properties: {
          serviceId: { type: 'string' }
        },
        required: ['serviceId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            serviceId: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { serviceId } = request.params
      
      // For now, return not implemented
      return reply.send({
        success: false,
        message: 'Service restart not implemented yet',
        serviceId
      })
    } catch (error) {
      fastify.log.error('Failed to restart service:', error.message)
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to restart service'
      })
    }
  })
  
  // Kill port process
  fastify.post('/ports/:port/kill', {
    schema: {
      description: 'Kill process using a specific port',
      tags: ['Dashboard'],
      params: {
        type: 'object',
        properties: {
          port: { type: 'number' }
        },
        required: ['port']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            port: { type: 'number' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { port } = request.params
      
      // Get current port status
      const dashboardData = fastify.dashboardService.getComprehensiveDashboardData()
      const portData = dashboardData.ports.find(p => p.port === parseInt(port))
      
      if (!portData || !portData.inUse || !portData.pid) {
        return reply.send({
          success: false,
          message: 'No process found on port',
          port: parseInt(port)
        })
      }
      
      // Kill the process
      const { execSync } = await import('child_process')
      
      try {
        execSync(`kill -TERM ${portData.pid}`, { timeout: 5000 })
        
        return reply.send({
          success: true,
          message: 'Process termination signal sent',
          port: parseInt(port)
        })
      } catch (killError) {
        return reply.send({
          success: false,
          message: `Failed to kill process: ${killError.message}`,
          port: parseInt(port)
        })
      }
    } catch (error) {
      fastify.log.error('Failed to kill port process:', error.message)
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to kill port process'
      })
    }
  })
  
  // Dashboard health check
  fastify.get('/health', {
    schema: {
      description: 'Get dashboard service health status',
      tags: ['Dashboard'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            isMonitoring: { type: 'boolean' },
            clientCount: { type: 'number' },
            lastUpdate: { type: 'number' },
            scanDuration: { type: 'number' },
            servicesMonitored: { type: 'number' },
            portsMonitored: { type: 'number' },
            activeAlerts: { type: 'number' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const healthStatus = fastify.dashboardService.getHealthStatus()
      return reply.send(healthStatus)
    } catch (error) {
      fastify.log.error('Failed to get dashboard health:', error.message)
      return reply.code(503).send({
        status: 'unhealthy',
        error: error.message
      })
    }
  })
  
  // Start/stop monitoring
  fastify.post('/monitoring/start', {
    schema: {
      description: 'Start dashboard monitoring',
      tags: ['Dashboard'],
      body: {
        type: 'object',
        properties: {
          interval: { type: 'number', minimum: 1000, maximum: 60000, default: 5000 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            interval: { type: 'number' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { interval = 5000 } = request.body || {}
      
      if (fastify.dashboardService.isMonitoring) {
        return reply.send({
          success: false,
          message: 'Monitoring is already active',
          interval
        })
      }
      
      fastify.dashboardService.startMonitoring(interval)
      
      return reply.send({
        success: true,
        message: 'Monitoring started successfully',
        interval
      })
    } catch (error) {
      fastify.log.error('Failed to start monitoring:', error.message)
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to start monitoring'
      })
    }
  })
  
  fastify.post('/monitoring/stop', {
    schema: {
      description: 'Stop dashboard monitoring',
      tags: ['Dashboard'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      if (!fastify.dashboardService.isMonitoring) {
        return reply.send({
          success: false,
          message: 'Monitoring is not active'
        })
      }
      
      fastify.dashboardService.stopMonitoring()
      
      return reply.send({
        success: true,
        message: 'Monitoring stopped successfully'
      })
    } catch (error) {
      fastify.log.error('Failed to stop monitoring:', error.message)
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to stop monitoring'
      })
    }
  })
}
