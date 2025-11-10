/**
 * Truxe Authentication API Server
 * 
 * High-performance authentication service built with Fastify:
 * - JWT-based authentication with RS256
 * - Magic link passwordless authentication
 * - Multi-layer rate limiting
 * - Session management with JTI revocation
 * - OpenAPI documentation with Swagger UI
 * - Comprehensive security headers
 * - Health monitoring and metrics
 */

import crypto from 'crypto'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import cookie from '@fastify/cookie'
import redis from '@fastify/redis'
import fastifyStatic from '@fastify/static'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

import config from './config/index.js'
import { validateStartup } from './startup-validation.js'
import authMiddleware from './middleware/auth.js'
import apiKeyAuthMiddleware from './middleware/api-key-auth.js'
import securityMiddleware from './middleware/security.js'
import securityHardeningPlugin from './middleware/security-hardening.js'
import rateLimitService from './services/rate-limit.js'
import monitoringService from './services/monitoring.js'
import { productionIntegrationPlugin } from './services/production-integration.js'
import { performanceOptimizerPlugin } from './services/performance-optimizer.js'
import { monitoringPlugin } from './services/monitoring-observability.js'
import authRoutes from './routes/auth.js'
import oauthRoutes from './routes/oauth.js'
import oauthProviderRoutes from './routes/oauth-provider/index.js'
import serviceAccountRoutes from './routes/service-accounts.js'
import apiKeysRoutes from './routes/api-keys.js'
import jwksRoutes from './routes/jwks.js'
import securityRoutes from './routes/security.js'
import adminRoutes from './routes/admin.js'
import organizationRoutes from './routes/organizations.js'
// import tenantRoutes from './routes/tenants.js' // TODO: Convert from Express to Fastify format
import portDashboardRoutes from './routes/port-dashboard.js'
import webhookRoutes from './routes/webhooks.js'
import webhookTestingRoutes from './routes/webhook-testing.js'
import githubRepositoryRoutes from './routes/github-repositories.js'
import githubWebhookRoutes from './routes/github-webhooks.js'
import githubOrganizationRoutes from './routes/github-organizations.js'
import githubAppRoutes from './routes/github-apps.js'
import githubTemplatesRoutes from './routes/github-templates.js'
import githubActionsRoutes from './routes/github-actions.js'
import githubSearchRoutes from './routes/github-search.js'
import mfaRoutes from './routes/mfa.js'
import passwordAuthRoutes from './routes/password-auth.js'
import emailVerificationRoutes from './routes/email-verification.js'
// import dashboardRoutes from './routes/dashboard.js' // Temporarily disabled for alpha release

/**
 * Create and configure Fastify server
 */
async function createServer() {
  const fastify = Fastify({
    logger: {
      level: config.app.logLevel,
      transport: config.app.environment === 'development' ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      } : undefined,
    },
    genReqId: () => crypto.randomUUID(),
    trustProxy: true,
    disableRequestLogging: !config.features.requestLogging,
  })
  
  // Register plugins
  await registerPlugins(fastify)
  
  // Register routes
  await registerRoutes(fastify)
  
  // Register error handlers
  registerErrorHandlers(fastify)
  
  return fastify
}

/**
 * Register Fastify plugins
 */
async function registerPlugins(fastify) {
  // Security headers
  if (config.features.helmet) {
    await fastify.register(helmet, {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  }
  
  // CORS
  await fastify.register(cors, {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true)

      const allowedOrigins = Array.isArray(config.security.corsOrigin)
        ? config.security.corsOrigin
        : [config.security.corsOrigin]

      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true)
      }

      return callback(new Error('Not allowed by CORS'), false)
    },
    credentials: config.security.corsCredentials,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Truxe-Publishable-Key',
      'X-Organization-Id',
    ],
  })
  
  // Cookie support
  await fastify.register(cookie, {
    secret: config.security.cookieSecret,
    parseOptions: {
      httpOnly: true,
      secure: config.app.environment === 'production',
      sameSite: 'lax',
    },
  })
  
  // Redis connection
  await fastify.register(redis, {
    url: config.redis.url,
    keyPrefix: config.redis.keyPrefix,
    lazyConnect: true,
  })
  
  // Rate limiting - ENABLED for OAuth security
  if (config.features.rateLimiting) {
    await fastify.register(rateLimitService.createFastifyPlugin())
  }
  
  // OpenAPI documentation
  if (config.features.swagger) {
    await fastify.register(swagger, {
      openapi: {
        openapi: '3.0.0',
        info: {
          title: 'Truxe Authentication API',
          description: 'Secure, scalable authentication service with passwordless magic links and JWT tokens',
          version: config.app.version,
          contact: {
            name: 'Wundam LLC',
            url: 'https://truxe.io',
            email: 'support@truxe.io',
          },
          license: {
            name: 'MIT',
            url: 'https://opensource.org/licenses/MIT',
          },
        },
        servers: [
          {
            url: `http://localhost:${config.app.port}`,
            description: 'Development server',
          },
          {
            url: config.jwt.issuer,
            description: 'Production server',
          },
        ],
        components: {
          securitySchemes: {
            BearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
              description: 'JWT access token',
            },
            CookieAuth: {
              type: 'apiKey',
              in: 'cookie',
              name: 'truxe_access_token',
              description: 'JWT access token in HTTP-only cookie',
            },
          },
        },
        security: [
          { BearerAuth: [] },
          { CookieAuth: [] },
        ],
        tags: [
          {
            name: 'Authentication',
            description: 'User authentication and session management',
          },
          {
            name: 'OAuth',
            description: 'OAuth authorization flows and provider callbacks',
          },
          {
            name: 'Organizations',
            description: 'Multi-tenant organization management and member invitations',
          },
          {
            name: 'Port Dashboard',
            description: 'Real-time port monitoring and service status dashboard',
          },
          {
            name: 'JWKS',
            description: 'JSON Web Key Set and OpenID Connect Discovery',
          },
          {
            name: 'Health',
            description: 'Service health and monitoring endpoints',
          },
          {
            name: 'Security',
            description: 'Security monitoring and session management',
          },
          {
            name: 'GitHub Organizations',
            description: 'GitHub organization synchronization and management',
          },
        ],
      },
    })
    
    await fastify.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: false,
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
      },
      uiHooks: {
        onRequest: function (request, reply, next) {
          next()
        },
        preHandler: function (request, reply, next) {
          next()
        },
      },
      staticCSP: true,
      transformStaticCSP: (header) => header,
    })
  }
  
  // Security hardening middleware
  if (config.app.environment === 'production' || process.env.ENABLE_SECURITY_HARDENING === 'true') {
    await fastify.register(securityHardeningPlugin, {
      enableThreatDetection: true,
      enableSecurityHeaders: true,
      enableCorsHardening: true
    })
  }
  
  // Production integration services
  if (config.app.environment === 'production' || process.env.ENABLE_PRODUCTION_HARDENING === 'true') {
    await fastify.register(productionIntegrationPlugin, {
      enableErrorHandler: true,
      enablePerformanceOptimizer: true,
      enableMonitoring: true,
      enableDisasterRecovery: process.env.ENABLE_AUTOMATED_BACKUPS === 'true',
      errorHandlerOptions: {
        failureThreshold: parseInt(process.env.ERROR_HANDLER_FAILURE_THRESHOLD) || 5,
        recoveryTimeout: parseInt(process.env.ERROR_HANDLER_RECOVERY_TIMEOUT) || 60000,
        maxRecoveryAttempts: parseInt(process.env.ERROR_HANDLER_MAX_RECOVERY_ATTEMPTS) || 3
      },
      performanceOptions: {
        cacheStrategy: process.env.CACHE_STRATEGY || 'cache_aside',
        cacheTTL: parseInt(process.env.CACHE_TTL) || 3600,
        enableQueryOptimization: process.env.ENABLE_QUERY_OPTIMIZATION === 'true',
        slowQueryThreshold: parseInt(process.env.SLOW_QUERY_THRESHOLD) || 1000
      },
      monitoringOptions: {
        enablePrometheus: process.env.ENABLE_PROMETHEUS_METRICS === 'true',
        enableStructuredLogging: process.env.ENABLE_STRUCTURED_LOGGING === 'true',
        enableAlerting: process.env.ENABLE_REAL_TIME_ALERTS === 'true',
        webhookUrl: process.env.WEBHOOK_URL,
        slackWebhookUrl: process.env.SLACK_WEBHOOK_URL
      },
      disasterRecoveryOptions: {
        s3Bucket: process.env.S3_BACKUP_BUCKET,
        s3Region: process.env.AWS_REGION || 'us-east-1',
        backupRetention: {
          full: parseInt(process.env.BACKUP_RETENTION_DAYS) || 90,
          incremental: 7,
          differential: 30
        },
        encryptionEnabled: process.env.BACKUP_ENCRYPTION_ENABLED === 'true'
      }
    })
  }
  
  // Performance optimizer (can be enabled separately)
  if (process.env.ENABLE_PERFORMANCE_OPTIMIZER === 'true') {
    await fastify.register(performanceOptimizerPlugin, {
      cacheStrategy: process.env.CACHE_STRATEGY || 'cache_aside',
      cacheTTL: parseInt(process.env.CACHE_TTL) || 3600,
      enableQueryOptimization: process.env.ENABLE_QUERY_OPTIMIZATION === 'true'
    })
  }
  
  // Monitoring and observability (can be enabled separately)
  if (process.env.ENABLE_MONITORING_SERVICE === 'true') {
    await fastify.register(monitoringPlugin, {
      enablePrometheus: process.env.ENABLE_PROMETHEUS_METRICS === 'true',
      enableStructuredLogging: process.env.ENABLE_STRUCTURED_LOGGING === 'true',
      enableAlerting: process.env.ENABLE_REAL_TIME_ALERTS === 'true'
    })
  }
  
  // Security middleware (must be before rate limiting) - temporarily disabled
  // await fastify.register(securityMiddleware)

  // Authentication middleware
  await fastify.register(authMiddleware)

  // API Key authentication middleware
  await fastify.register(apiKeyAuthMiddleware)

  // Static file serving for dashboards
  await fastify.register(fastifyStatic, {
    root: path.join(__dirname, '..', 'public'),
    prefix: '/public/',
  })
  
  // Serve GitHub webhook dashboard
  fastify.get('/github-webhooks', async (request, reply) => {
    return reply.sendFile('github-webhook-dashboard.html')
  })
}

/**
 * Register API routes
 */
async function registerRoutes(fastify) {
  // Health check endpoint
  fastify.get('/health', {
    schema: {
      description: 'Service health check',
      tags: ['Health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            version: { type: 'string' },
            environment: { type: 'string' },
            services: {
              type: 'object',
              properties: {
                database: { type: 'object' },
                redis: { type: 'object' },
                jwt: { type: 'object' },
                email: { type: 'object' },
                rateLimit: { type: 'object' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      // Import services dynamically to avoid circular dependencies
      const { default: jwtService } = await import('./services/jwt.js')
      const { default: sessionService } = await import('./services/session.js')
      const { default: magicLinkService } = await import('./services/magic-link.js')
      const { default: emailService } = await import('./services/email.js')

      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: config.app.version,
        environment: config.app.environment,
        services: {},
      }

      // Check each service with error handling
      try {
        health.services.database = await sessionService.getHealthStatus()
      } catch (error) {
        health.services.database = { status: 'unhealthy', error: error.message }
      }

      health.services.redis = { status: 'healthy', message: 'Redis connection available' }

      try {
        health.services.jwt = jwtService.getHealthStatus()
      } catch (error) {
        health.services.jwt = { status: 'unhealthy', error: error.message }
      }

      try {
        health.services.magicLink = await magicLinkService.getHealthStatus()
      } catch (error) {
        health.services.magicLink = { status: 'unhealthy', error: error.message }
      }

      try {
        health.services.email = await emailService.getHealthStatus()
      } catch (error) {
        health.services.email = { status: 'unhealthy', error: error.message }
      }

      try {
        health.services.monitoring = await monitoringService.getHealthStatus()
      } catch (error) {
        health.services.monitoring = { status: 'unhealthy', error: error.message }
      }

      // Determine overall health status
      const serviceStatuses = Object.values(health.services).map(service => service.status)
      const overallStatus = serviceStatuses.every(status => status === 'healthy') ? 'healthy' : 'degraded'

      health.status = overallStatus

      // Return 200 for both healthy and degraded, 503 only for complete failure
      const statusCode = overallStatus === 'unhealthy' ? 503 : 200

      return reply.code(statusCode).send(health)
    } catch (error) {
      fastify.log.error('Health check failed:', error.message)
      fastify.log.error('Health check error stack:', error.stack)

      return reply.code(503).send({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
      })
    }
  })
  
  // Metrics endpoint (if enabled) - temporarily disabled
  /*
  if (config.features.metrics) {
    fastify.get('/metrics', {
      schema: {
        description: 'Service metrics for monitoring',
        tags: ['Health'],
        response: {
          200: {
            type: 'object',
            properties: {
              timestamp: { type: 'string' },
              uptime: { type: 'number' },
              memory: { type: 'object' },
              requests: { type: 'object' },
              database: { type: 'object' },
              redis: { type: 'object' },
            },
          },
        },
      },
    }, async (request, reply) => {
      const metrics = {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        requests: {
          total: fastify.server.requestsTotal || 0,
          active: fastify.server.requestsActive || 0,
        },
        // Add more metrics as needed
      }
      
      return reply.send(metrics)
    })
  }
  */
  
  // API version endpoint
  fastify.get('/version', {
    schema: {
      description: 'API version information',
      tags: ['Health'],
      response: {
        200: {
          type: 'object',
          properties: {
            version: { type: 'string' },
            apiVersion: { type: 'string' },
            buildDate: { type: 'string' },
            gitCommit: { type: 'string' },
            environment: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    return reply.send({
      version: config.app.version,
      apiVersion: config.app.apiVersion,
      buildDate: process.env.BUILD_DATE || new Date().toISOString(),
      gitCommit: process.env.GIT_COMMIT || 'unknown',
      environment: config.app.environment,
    })
  })
  
  // Register auth routes
  await fastify.register(authRoutes, { prefix: '/auth' })

  // Register password auth routes under /api/auth
  await fastify.register(passwordAuthRoutes, { prefix: '/api/auth' })

  // Register email verification routes
  await fastify.register(emailVerificationRoutes, { prefix: '/api/auth/email' })

  // Register OAuth routes under /auth to benefit from same middleware setup
  await fastify.register(oauthRoutes, { prefix: '/auth/oauth' })

  // Register OAuth Provider routes under /api/oauth
  await fastify.register(oauthProviderRoutes, { prefix: '/api/oauth' })

  // Register MFA routes
  await fastify.register(mfaRoutes, { prefix: '/auth/mfa' })

  // Register service account routes (legacy)
  await fastify.register(serviceAccountRoutes, { prefix: '/api/service-accounts' })

  // Register API Keys routes (new M2M authentication)
  await fastify.register(apiKeysRoutes, { prefix: '/api' })

  // Register organization routes
  await fastify.register(organizationRoutes, { prefix: '/organizations' })

  // Register tenant routes (hierarchical multi-tenancy)
  // TODO: Convert tenant routes from Express to Fastify format
  // await fastify.register(tenantRoutes, { prefix: '/tenants' })

  // Register webhook routes
  await fastify.register(webhookRoutes, { prefix: '/webhooks' })
  
  // Register webhook testing routes
  await fastify.register(webhookTestingRoutes, { prefix: '/webhook-testing' })
  
  // Register port dashboard routes
  await fastify.register(portDashboardRoutes, { prefix: '/dashboard' })
  
  // Register security monitoring routes
  await fastify.register(securityRoutes, { prefix: '/security' })
  
  // Register GitHub repository routes
  await fastify.register(githubRepositoryRoutes, { prefix: '/api/github/repositories' })
  
  // Register GitHub webhook routes
  await fastify.register(githubWebhookRoutes, { prefix: '/api/github/webhooks' })
  
  // Register GitHub organization routes
  await fastify.register(githubOrganizationRoutes, { prefix: '/api/github/organizations' })
  
  // Register GitHub App routes (Phase 5.1)
  await fastify.register(githubAppRoutes, { prefix: '/api/github/apps' })
  
  // Register GitHub templates routes (Phase 5.2)
  await fastify.register(githubTemplatesRoutes, { prefix: '/api/github/templates' })
  
  // Register GitHub Actions routes (Phase 5.3)
  await fastify.register(githubActionsRoutes, { prefix: '/api/github/actions' })
  
  // Register GitHub search routes (Phase 5.4)
  await fastify.register(githubSearchRoutes, { prefix: '/api/github/search' })

  // Initialize GitHub webhook cleanup service
  if (process.env.GITHUB_WEBHOOK_CLEANUP_ENABLED !== 'false') {
    try {
      const { default: GitHubWebhookCleanupService } = await import('./services/github/webhook-cleanup.js')
      const cleanupService = new GitHubWebhookCleanupService({
        logger: fastify.log,
      })
      cleanupService.start()
      fastify.log.info('GitHub webhook cleanup service started')
    } catch (error) {
      fastify.log.warn('Failed to start GitHub webhook cleanup service', { error: error.message })
    }
  }

  // Initialize GitHub organization auto-sync scheduler
  if (process.env.GITHUB_ORG_AUTO_SYNC_ENABLED !== 'false') {
    try {
      const { default: OrganizationSyncScheduler } = await import('./services/github/organization-sync-scheduler.js')
      const scheduler = new OrganizationSyncScheduler({
        logger: fastify.log,
        enabled: process.env.GITHUB_ORG_AUTO_SYNC_ENABLED === 'true' || false,
        options: {
          checkInterval: parseInt(process.env.GITHUB_ORG_SYNC_CHECK_INTERVAL) || 5 * 60 * 1000, // 5 minutes
          maxConcurrentSyncs: parseInt(process.env.GITHUB_ORG_SYNC_MAX_CONCURRENT) || 3,
        },
      })
      scheduler.start()
      fastify.log.info('GitHub organization auto-sync scheduler started')
      
      // Register shutdown handler
      fastify.addHook('onClose', async () => {
        await scheduler.shutdown()
      })
    } catch (error) {
      fastify.log.warn('Failed to start GitHub organization auto-sync scheduler', { error: error.message })
    }
  }
  
  // Register admin routes (protected) - temporarily disabled
  // Register admin routes
  await fastify.register(adminRoutes, { prefix: '/api/admin' })
  
  // Register JWKS routes (well-known endpoints)
  await fastify.register(jwksRoutes)
  
  // Root endpoint
  fastify.get('/', {
    schema: {
      description: 'API root endpoint',
      response: {
        200: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            version: { type: 'string' },
            description: { type: 'string' },
            documentation: { type: 'string' },
            endpoints: {
              type: 'object',
              properties: {
                auth: { type: 'string' },
                security: { type: 'string' },
                admin: { type: 'string' },
                jwks: { type: 'string' },
                health: { type: 'string' },
                docs: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    // Build base URL - omit port for standard HTTP/HTTPS ports
    const isStandardPort = (request.protocol === 'http' && request.port === 80) ||
                          (request.protocol === 'https' && request.port === 443)
    const baseUrl = isStandardPort
      ? `${request.protocol}://${request.hostname}`
      : `${request.protocol}://${request.hostname}:${request.port}`

    return reply.send({
      name: config.app.name,
      version: config.app.version,
      description: 'Secure, scalable authentication service',
      documentation: config.features.swagger ? `${baseUrl}/docs` : null,
      endpoints: {
        auth: `${baseUrl}/auth`,
        security: `${baseUrl}/security`,
        admin: `${baseUrl}/admin`,
        jwks: `${baseUrl}/.well-known/jwks.json`,
        health: `${baseUrl}/health`,
        docs: config.features.swagger ? `${baseUrl}/docs` : null,
      },
    })
  })
  
  // Register dashboard routes (temporarily disabled for alpha release)
  // await fastify.register(dashboardRoutes, { prefix: '/dashboard' })
  
  // All other route modules temporarily disabled for testing
  // await fastify.register(authRoutes, { prefix: '/auth' })
  // await fastify.register(jwksRoutes)
  // Security routes already registered above at line 486
  // await fastify.register(adminRoutes, { prefix: '/admin' })
}

/**
 * Register error handlers
 */
function registerErrorHandlers(fastify) {
  // Global error handler
  fastify.setErrorHandler((error, request, reply) => {
    // Log error details
    if (error.statusCode >= 500) {
      fastify.log.error({
        error: error.message,
        stack: error.stack,
        url: request.url,
        method: request.method,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      }, 'Server error occurred')
    } else {
      fastify.log.warn({
        error: error.message,
        statusCode: error.statusCode,
        url: request.url,
        method: request.method,
      }, 'Client error occurred')
    }
    
    // Send appropriate error response
    const statusCode = error.statusCode || 500
    const response = {
      error: error.name || 'Error',
      message: error.message || 'An error occurred',
      statusCode,
      timestamp: new Date().toISOString(),
    }
    
    // Add request ID for tracking
    if (request.id) {
      response.requestId = request.id
    }
    
    // Don't expose stack traces in production
    if (config.app.environment !== 'production' && error.stack) {
      response.stack = error.stack
    }
    
    reply.code(statusCode).send(response)
  })
  
  // 404 handler
  fastify.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error: 'Not Found',
      message: `Route ${request.method} ${request.url} not found`,
      statusCode: 404,
      timestamp: new Date().toISOString(),
    })
  })
}

/**
 * Start the server with comprehensive validation
 */
async function start() {
  try {
    // Run startup validation first
    console.log('🔧 Running startup validation...');
    const validationResult = await validateStartup();

    if (!validationResult.canStart) {
      console.error('🚨 Startup validation failed. Server cannot start safely.');
      console.error('');
      console.error('⚠️  CONFIGURATION REQUIRED ⚠️');
      console.error('Please check the critical issues listed above and update environment variables in Dokploy.');
      console.error('');
      console.error('Common issues:');
      console.error('  • DATABASE_URL: Ensure DB_PASSWORD is set or use DATABASE_URL with URL-encoded password');
      console.error('  • JWT_PRIVATE_KEY_BASE64 and JWT_PUBLIC_KEY_BASE64: Must be a matching RSA key pair');
      console.error('');
      console.error('Container will sleep for 60 seconds to prevent rapid restart loops.');
      console.error('This reduces CPU usage while you fix the configuration.');
      console.error('');

      // Sleep for 60 seconds before exiting to prevent rapid restart loops
      // This significantly reduces CPU usage when there are configuration errors
      await new Promise(resolve => setTimeout(resolve, 60000));

      // Exit with code 1 to indicate failure
      process.exit(1);
    }

    if (validationResult.status === 'warning') {
      console.warn('⚠️  Server starting with warnings. Please address issues when possible.');
    }
    
    const server = await createServer()
    
    // Graceful shutdown handling
    const gracefulShutdown = async (signal) => {
      server.log.info(`Received ${signal}, shutting down gracefully...`)
      
      try {
        await server.close()
        // await rateLimitService.close() // Disabled with rate limiting
        await monitoringService.redis.quit()
        server.log.info('Server shut down successfully')
        process.exit(0)
      } catch (error) {
        server.log.error('Error during shutdown:', error.message)
        process.exit(1)
      }
    }
    
    process.on('SIGINT', () => gracefulShutdown('SIGINT'))
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
    
    // Start listening
    await server.listen({
      port: config.app.port,
      host: config.app.host,
    })
    
    server.log.info({
      port: config.app.port,
      host: config.app.host,
      environment: config.app.environment,
      version: config.app.version,
      docs: config.features.swagger ? `http://${config.app.host}:${config.app.port}/docs` : null,
    }, 'Truxe API server started successfully')

    // Initialize scheduled jobs and monitoring (if BullMQ enabled)
    if (config.features.useBullMQQueues) {
      try {
        const { default: scheduledJobsService } = await import('./services/scheduled-jobs.js')
        const { default: queueMonitoringService } = await import('./services/queue-monitoring.js')

        await scheduledJobsService.initialize()
        queueMonitoringService.start()

        server.log.info('Background jobs system initialized')
      } catch (error) {
        server.log.error('Failed to initialize background jobs system:', error.message)
      }
    }

  } catch (error) {
    console.error('Failed to start server:', error.message)
    process.exit(1)
  }
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  start()
}

export { createServer, start }
export default createServer
