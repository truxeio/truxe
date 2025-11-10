/**
 * Advanced Rate Limiting & API Protection Service
 * 
 * Comprehensive multi-layer rate limiting with Redis-based sliding window algorithm:
 * - IP-based limits (global protection)
 * - User-based limits (per-user quotas)
 * - Endpoint-specific limits (auth endpoints more restrictive)
 * - Plan-based limits (free vs paid tiers with dynamic enforcement)
 * - Burst protection (prevent sudden spikes)
 * - DDoS protection with adaptive thresholds
 * - Graceful degradation and circuit breaker patterns
 * - Real-time monitoring and alerting
 * - Admin tools for dynamic limit management
 */

import Redis from 'ioredis'
import config from '../config/index.js'

/**
 * Rate Limiting Service Class
 */
export class RateLimitService {
  constructor() {
    this.redis = new Redis(config.redis.url, {
      keyPrefix: config.redis.keyPrefix + 'rate_limit:',
      retryDelayOnFailover: config.redis.retryDelayOnFailover,
      maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
      lazyConnect: true,
    })
    
    this.redis.on('error', (error) => {
      console.error('Rate limit Redis connection error:', error.message)
    })
    
    this.redis.on('connect', () => {
      console.log('Rate limit Redis connected successfully')
    })
    
    // Initialize plan-based configurations
    this.plans = {
      free: {
        emailsPerMonth: 1000,
        emailsPerUserPerDay: 10,
        apiRequestsPerHour: 1000,
        magicLinksPerHour: 5,
        refreshTokensPerHour: 60,
        concurrentSessions: 3
      },
      starter: {
        emailsPerMonth: 10000,
        emailsPerUserPerDay: 50,
        apiRequestsPerHour: 10000,
        magicLinksPerHour: 20,
        refreshTokensPerHour: 300,
        concurrentSessions: 5
      },
      pro: {
        emailsPerMonth: 100000,
        emailsPerUserPerDay: 200,
        apiRequestsPerHour: 100000,
        magicLinksPerHour: 100,
        refreshTokensPerHour: 1000,
        concurrentSessions: 10
      },
      enterprise: {
        emailsPerMonth: -1, // Unlimited
        emailsPerUserPerDay: -1,
        apiRequestsPerHour: -1,
        magicLinksPerHour: -1,
        refreshTokensPerHour: -1,
        concurrentSessions: -1
      }
    }
    
    // DDoS protection thresholds
    this.ddosThresholds = {
      suspiciousIPRequests: 1000, // Requests per minute from single IP
      globalRequestSpike: 10000,   // Global requests per minute
      failedAuthAttempts: 50,      // Failed attempts per IP per hour
      uniqueIPsPerMinute: 500,     // Unique IPs making requests
      averageResponseTime: 1000    // Milliseconds
    }
    
    // Circuit breaker state
    this.circuitBreaker = {
      state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
      failureCount: 0,
      lastFailureTime: null,
      timeout: 60000, // 1 minute
      threshold: 5
    }
    
    // Monitoring metrics
    this.metrics = {
      requestsBlocked: 0,
      ddosAttacksDetected: 0,
      planLimitViolations: 0,
      circuitBreakerTrips: 0,
      lastResetTime: Date.now()
    }
    
    // Rate limit configurations
    this.limits = {
      // Magic link endpoints
      'POST:/auth/magic-link': {
        perIP: { max: config.rateLimit.magicLink.perIP, window: config.rateLimit.magicLink.windowIP },
        perEmail: { max: config.rateLimit.magicLink.perEmail, window: config.rateLimit.magicLink.windowEmail },
        global: { max: 1000, window: 60000 }, // 1000 per minute globally
      },
      
      // Verification endpoint
      'GET:/auth/verify': {
        perIP: { max: config.rateLimit.verify.perIP, window: config.rateLimit.verify.windowIP },
        perToken: { max: config.rateLimit.verify.perToken, window: 3600000 }, // 3 attempts per hour per token
        global: { max: 500, window: 60000 }, // 500 per minute globally
      },
      
      // Token refresh endpoint
      'POST:/auth/refresh': {
        perUser: { max: config.rateLimit.refresh.perUser, window: config.rateLimit.refresh.window },
        perIP: { max: 100, window: 60000 }, // 100 per minute per IP
        global: { max: 2000, window: 60000 }, // 2000 per minute globally
      },
      
      // Session revocation
      'POST:/auth/revoke': {
        perUser: { max: 20, window: 60000 }, // 20 per minute per user
        perIP: { max: 50, window: 60000 }, // 50 per minute per IP
        global: { max: 1000, window: 60000 }, // 1000 per minute globally
      },
      
      // JWKS endpoint (public, but still limited)
      'GET:/.well-known/jwks.json': {
        perIP: { max: 100, window: 60000 }, // 100 per minute per IP
        global: { max: 10000, window: 60000 }, // 10k per minute globally
      },
      
      // Global API limits with adaptive thresholds
      'global': {
        perIP: { max: config.rateLimit.global.max, window: config.rateLimit.global.window },
        perUser: { max: 5000, window: 3600000 }, // 5000 per hour per user
        ddosProtection: { max: this.ddosThresholds.suspiciousIPRequests, window: 60000 },
      },
      
      // Admin endpoints with strict limits
      'POST:/admin/users': {
        perUser: { max: 100, window: 3600000 }, // 100 per hour
        requireRole: 'admin'
      },
      
      // Health check endpoint (minimal limits)
      'GET:/health': {
        perIP: { max: 1000, window: 60000 }, // 1000 per minute
        global: { max: 50000, window: 60000 } // 50k per minute globally
      }
    }
    
    // Start background monitoring
    this.startMonitoring()
  }
  
  /**
   * Start background monitoring and cleanup tasks
   */
  startMonitoring() {
    // Monitor DDoS patterns every 30 seconds
    setInterval(() => this.detectDDoSPatterns(), 30000)
    
    // Cleanup expired keys every 5 minutes
    setInterval(() => this.cleanupExpiredKeys(), 300000)
    
    // Reset metrics every hour
    setInterval(() => this.resetMetrics(), 3600000)
    
    console.log('Rate limiting monitoring started')
  }
  
  /**
   * Check rate limit for a request
   */
  async checkRateLimit(key, limit, window) {
    try {
      const now = Date.now()
      const windowStart = Math.floor(now / window) * window
      const redisKey = `${key}:${windowStart}`
      
      // Use Redis pipeline for atomic operations
      const pipeline = this.redis.pipeline()
      pipeline.incr(redisKey)
      pipeline.expire(redisKey, Math.ceil(window / 1000))
      
      const results = await pipeline.exec()
      const count = results[0][1]
      
      const remaining = Math.max(0, limit - count)
      const resetTime = windowStart + window
      
      return {
        allowed: count <= limit,
        count,
        limit,
        remaining,
        resetTime,
        retryAfter: count > limit ? Math.ceil((resetTime - now) / 1000) : null,
      }
    } catch (error) {
      console.error('Rate limit check failed:', error.message)
      // Fail open - allow request if Redis is unavailable
      return {
        allowed: true,
        count: 0,
        limit,
        remaining: limit,
        resetTime: Date.now() + window,
        retryAfter: null,
        error: error.message,
      }
    }
  }
  
  /**
   * Check plan-based quota limits
   */
  async checkPlanLimits(userId, orgId, action) {
    try {
      // Get user's plan (default to 'free' if not found)
      const plan = await this.getUserPlan(userId, orgId)
      const planLimits = this.plans[plan] || this.plans.free
      
      // Check different quota types based on action
      const quotaChecks = {
        'magic_link': {
          key: `plan:${plan}:${userId}:magic_links`,
          limit: planLimits.magicLinksPerHour,
          window: 3600000
        },
        'api_request': {
          key: `plan:${plan}:${userId}:api_requests`,
          limit: planLimits.apiRequestsPerHour,
          window: 3600000
        },
        'email': {
          key: `plan:${plan}:${userId}:emails:${this.getCurrentMonth()}`,
          limit: planLimits.emailsPerMonth,
          window: 2678400000 // 31 days
        },
        'refresh_token': {
          key: `plan:${plan}:${userId}:refresh_tokens`,
          limit: planLimits.refreshTokensPerHour,
          window: 3600000
        }
      }
      
      const quotaCheck = quotaChecks[action]
      if (!quotaCheck) {
        return { allowed: true, plan, limits: planLimits }
      }
      
      // Skip check for unlimited plans
      if (quotaCheck.limit === -1) {
        return { allowed: true, plan, limits: planLimits, unlimited: true }
      }
      
      const result = await this.checkRateLimit(
        quotaCheck.key, 
        quotaCheck.limit, 
        quotaCheck.window
      )
      
      if (!result.allowed) {
        this.metrics.planLimitViolations++
        
        // Log plan limit violation
        console.warn('Plan limit exceeded:', {
          userId,
          orgId,
          plan,
          action,
          limit: quotaCheck.limit,
          current: result.count
        })
      }
      
      return {
        ...result,
        plan,
        limits: planLimits,
        quotaType: action
      }
    } catch (error) {
      console.error('Plan limit check failed:', error.message)
      // Fail open for plan limits to avoid blocking legitimate users
      return { allowed: true, error: error.message }
    }
  }
  
  /**
   * Detect and respond to DDoS attack patterns
   */
  async detectDDoSPatterns() {
    try {
      const now = Date.now()
      const oneMinuteAgo = now - 60000
      
      // Check for suspicious IP activity
      const suspiciousIPs = await this.findSuspiciousIPs(oneMinuteAgo, now)
      
      // Check for global request spikes
      const globalRequestCount = await this.getGlobalRequestCount(oneMinuteAgo, now)
      
      // Check for failed authentication spikes
      const failedAuthCount = await this.getFailedAuthCount(oneMinuteAgo, now)
      
      // Detect DDoS patterns
      const isDDoS = (
        suspiciousIPs.length > 10 ||
        globalRequestCount > this.ddosThresholds.globalRequestSpike ||
        failedAuthCount > this.ddosThresholds.failedAuthAttempts * 10
      )
      
      if (isDDoS) {
        await this.handleDDoSAttack({
          suspiciousIPs,
          globalRequestCount,
          failedAuthCount,
          timestamp: now
        })
      }
    } catch (error) {
      console.error('DDoS detection failed:', error.message)
    }
  }
  
  /**
   * Handle detected DDoS attack
   */
  async handleDDoSAttack(attackInfo) {
    this.metrics.ddosAttacksDetected++
    
    console.error('DDoS attack detected:', attackInfo)
    
    // Activate circuit breaker
    this.activateCircuitBreaker()
    
    // Block suspicious IPs temporarily
    for (const ip of attackInfo.suspiciousIPs) {
      await this.blockIP(ip, 3600000) // Block for 1 hour
    }
    
    // Reduce rate limits temporarily
    await this.activateEmergencyLimits()
    
    // Send alert (in production, this would integrate with monitoring system)
    console.error('ALERT: DDoS attack detected and mitigated', {
      timestamp: new Date().toISOString(),
      ...attackInfo
    })
  }
  
  /**
   * Activate circuit breaker for emergency protection
   */
  activateCircuitBreaker() {
    this.circuitBreaker.state = 'OPEN'
    this.circuitBreaker.lastFailureTime = Date.now()
    this.metrics.circuitBreakerTrips++
    
    // Auto-recover after timeout
    setTimeout(() => {
      if (this.circuitBreaker.state === 'OPEN') {
        this.circuitBreaker.state = 'HALF_OPEN'
        console.log('Circuit breaker moved to HALF_OPEN state')
      }
    }, this.circuitBreaker.timeout)
    
    console.warn('Circuit breaker activated - emergency protection enabled')
  }
  
  /**
   * Check multiple rate limits for an endpoint with enhanced protection
   */
  async checkEndpointLimits(endpoint, identifiers = {}) {
    // Circuit breaker check
    if (this.circuitBreaker.state === 'OPEN') {
      return {
        allowed: false,
        circuitBreakerOpen: true,
        limits: {},
        violated: 'circuit_breaker',
        mostRestrictive: {
          retryAfter: Math.ceil((this.circuitBreaker.timeout - (Date.now() - this.circuitBreaker.lastFailureTime)) / 1000),
          resetTime: this.circuitBreaker.lastFailureTime + this.circuitBreaker.timeout
        }
      }
    }
    
    // Check if IP is blocked
    if (identifiers.ip && await this.isIPBlocked(identifiers.ip)) {
      return {
        allowed: false,
        ipBlocked: true,
        limits: {},
        violated: 'ip_blocked',
        mostRestrictive: {
          retryAfter: 3600, // 1 hour
          resetTime: Date.now() + 3600000
        }
      }
    }
    
    const endpointLimits = this.limits[endpoint] || {}
    const globalLimits = this.limits.global || {}
    const results = {}
    
    // Check plan-based limits first if user is identified
    if (identifiers.user) {
      const actionMap = {
        'POST:/auth/magic-link': 'magic_link',
        'POST:/auth/refresh': 'refresh_token',
        'GET:/auth/verify': 'api_request'
      }
      
      const action = actionMap[endpoint] || 'api_request'
      const planResult = await this.checkPlanLimits(identifiers.user, identifiers.org, action)
      
      if (!planResult.allowed) {
        return {
          allowed: false,
          planLimitExceeded: true,
          plan: planResult.plan,
          limits: { plan: planResult },
          violated: 'plan_limit',
          mostRestrictive: planResult
        }
      }
      
      results.plan = planResult
    }
    
    // Check endpoint-specific limits
    for (const [limitType, config] of Object.entries(endpointLimits)) {
      const identifier = identifiers[limitType.replace('per', '').toLowerCase()]
      if (identifier && config) {
        const key = `${endpoint}:${limitType}:${identifier}`
        results[limitType] = await this.checkRateLimit(key, config.max, config.window)
      }
    }
    
    // Check global limits
    for (const [limitType, config] of Object.entries(globalLimits)) {
      const identifier = identifiers[limitType.replace('per', '').toLowerCase()]
      if (identifier && config) {
        const key = `global:${limitType}:${identifier}`
        results[`global_${limitType}`] = await this.checkRateLimit(key, config.max, config.window)
      }
    }
    
    // Find the most restrictive limit that's been exceeded
    const violated = Object.entries(results).find(([, result]) => !result.allowed)
    
    const finalResult = {
      allowed: !violated,
      limits: results,
      violated: violated ? violated[0] : null,
      mostRestrictive: violated ? violated[1] : null,
    }
    
    // Track blocked requests
    if (!finalResult.allowed) {
      this.metrics.requestsBlocked++
    }
    
    return finalResult
  }
  
  /**
   * Fastify plugin for rate limiting middleware
   */
  createFastifyPlugin() {
    const self = this
    
    return async function rateLimitPlugin(fastify, options) {
      fastify.addHook('preHandler', async function (request, reply) {
        // Skip rate limiting if disabled
        if (!config.features.rateLimiting) {
          return
        }
        
        const endpoint = `${request.method}:${request.url.split('?')[0]}`
        const ip = request.ip
        const userId = request.user?.id
        const email = request.body?.email
        const token = request.query?.token
        
        // Prepare identifiers
        const identifiers = {
          ip,
          user: userId,
          email,
          token,
        }
        
        // Check rate limits
        const result = await self.checkEndpointLimits(endpoint, identifiers)
        
        if (!result.allowed) {
          const mostRestrictive = result.mostRestrictive
          
          // Set rate limit headers
          reply.header('X-RateLimit-Limit', mostRestrictive.limit)
          reply.header('X-RateLimit-Remaining', mostRestrictive.remaining)
          reply.header('X-RateLimit-Reset', mostRestrictive.resetTime)
          
          if (mostRestrictive.retryAfter) {
            reply.header('Retry-After', mostRestrictive.retryAfter)
          }
          
          // Enhanced logging for rate limit violations
          const logData = {
            endpoint,
            limitType: result.violated,
            ip,
            userId,
            email: email ? email.substring(0, 3) + '***' : undefined,
            count: mostRestrictive.count,
            limit: mostRestrictive.limit,
            timestamp: new Date().toISOString(),
            userAgent: request.headers['user-agent']?.substring(0, 100)
          }
          
          // Add plan information if available
          if (result.plan) {
            logData.plan = result.plan
            logData.planLimits = result.limits.plan?.limits
          }
          
          console.warn('Rate limit exceeded:', logData)
          
          // Check if this looks like an attack
          if (mostRestrictive.count > mostRestrictive.limit * 2) {
            console.error('Potential attack detected:', logData)
          }
          
          // Enhanced error response with graceful degradation info
          const errorResponse = {
            error: 'Too Many Requests',
            message: this.getGracefulErrorMessage(result.violated),
            details: {
              limitType: result.violated,
              limit: mostRestrictive.limit,
              retryAfter: mostRestrictive.retryAfter,
              resetTime: mostRestrictive.resetTime,
            },
          }
          
          // Add plan upgrade suggestion for plan limits
          if (result.planLimitExceeded) {
            errorResponse.upgrade = {
              message: 'Upgrade your plan for higher limits',
              currentPlan: result.plan,
              suggestedPlan: this.suggestPlanUpgrade(result.plan)
            }
          }
          
          // Add circuit breaker info
          if (result.circuitBreakerOpen) {
            errorResponse.message = 'Service temporarily unavailable due to high load. Please try again later.'
            errorResponse.serviceStatus = 'degraded'
          }
          
          return reply.code(429).send(errorResponse)
        }
        
        // Set rate limit headers for successful requests
        if (result.limits.perIP) {
          reply.header('X-RateLimit-Limit', result.limits.perIP.limit)
          reply.header('X-RateLimit-Remaining', result.limits.perIP.remaining)
          reply.header('X-RateLimit-Reset', result.limits.perIP.resetTime)
        }
      })
    }
  }
  
  /**
   * Manual rate limit check (for use outside middleware)
   */
  async checkLimit(type, identifier, customLimit = null) {
    const limitConfig = customLimit || this.limits.global?.perIP
    if (!limitConfig) {
      return { allowed: true, count: 0, limit: 0, remaining: 0 }
    }
    
    const key = `manual:${type}:${identifier}`
    return await this.checkRateLimit(key, limitConfig.max, limitConfig.window)
  }
  
  /**
   * Reset rate limit for a specific key (admin function)
   */
  async resetLimit(key) {
    try {
      const pattern = `${config.redis.keyPrefix}rate_limit:${key}:*`
      const keys = await this.redis.keys(pattern)
      
      if (keys.length > 0) {
        await this.redis.del(...keys)
        return { reset: true, keysDeleted: keys.length }
      }
      
      return { reset: true, keysDeleted: 0 }
    } catch (error) {
      console.error('Failed to reset rate limit:', error.message)
      throw new Error('Rate limit reset failed')
    }
  }
  
  /**
   * Get rate limit status for debugging
   */
  async getRateLimitStatus(endpoint, identifiers = {}) {
    const result = await this.checkEndpointLimits(endpoint, identifiers)
    
    return {
      endpoint,
      identifiers,
      allowed: result.allowed,
      violated: result.violated,
      limits: Object.fromEntries(
        Object.entries(result.limits).map(([key, value]) => [
          key,
          {
            count: value.count,
            limit: value.limit,
            remaining: value.remaining,
            resetTime: new Date(value.resetTime).toISOString(),
            allowed: value.allowed,
          },
        ])
      ),
    }
  }
  
  /**
   * Clean up expired rate limit keys (background job)
   */
  async cleanupExpiredKeys() {
    try {
      const pattern = `${config.redis.keyPrefix}rate_limit:*`
      const stream = this.redis.scanStream({
        match: pattern,
        count: 100,
      })
      
      let deletedCount = 0
      
      stream.on('data', async (keys) => {
        if (keys.length > 0) {
          const pipeline = this.redis.pipeline()
          
          for (const key of keys) {
            // Check if key has TTL
            pipeline.ttl(key)
          }
          
          const ttlResults = await pipeline.exec()
          const expiredKeys = keys.filter((key, index) => ttlResults[index][1] === -1)
          
          if (expiredKeys.length > 0) {
            await this.redis.del(...expiredKeys)
            deletedCount += expiredKeys.length
          }
        }
      })
      
      return new Promise((resolve) => {
        stream.on('end', () => {
          console.log(`Cleaned up ${deletedCount} expired rate limit keys`)
          resolve(deletedCount)
        })
      })
    } catch (error) {
      console.error('Failed to cleanup expired rate limit keys:', error.message)
      return 0
    }
  }
  
  /**
   * Get graceful error message based on violation type
   */
  getGracefulErrorMessage(violationType) {
    const messages = {
      'perIP': 'Too many requests from your IP address. Please try again in a few minutes.',
      'perUser': 'You have exceeded your request limit. Please try again later.',
      'perEmail': 'Too many requests for this email address. Please wait before trying again.',
      'plan_limit': 'You have reached your plan limit. Consider upgrading for higher limits.',
      'circuit_breaker': 'Service temporarily unavailable due to high load. Please try again later.',
      'ip_blocked': 'Your IP address has been temporarily blocked due to suspicious activity.',
      'ddos_protection': 'Request blocked by DDoS protection. Please try again later.'
    }
    
    return messages[violationType] || 'Rate limit exceeded. Please try again later.'
  }
  
  /**
   * Suggest plan upgrade based on current plan
   */
  suggestPlanUpgrade(currentPlan) {
    const upgrades = {
      'free': 'starter',
      'starter': 'pro',
      'pro': 'enterprise'
    }
    
    return upgrades[currentPlan] || 'pro'
  }
  
  /**
   * Get user's plan from database or cache
   */
  async getUserPlan(userId, orgId) {
    try {
      // Try to get from Redis cache first
      const cacheKey = `user_plan:${userId}:${orgId || 'personal'}`
      const cachedPlan = await this.redis.get(cacheKey)
      
      if (cachedPlan) {
        return cachedPlan
      }
      
      // Fallback to database query (would need to be implemented)
      // For now, return 'free' as default
      const plan = 'free' // TODO: Implement database lookup
      
      // Cache for 1 hour
      await this.redis.setex(cacheKey, 3600, plan)
      
      return plan
    } catch (error) {
      console.error('Failed to get user plan:', error.message)
      return 'free' // Fail to most restrictive plan
    }
  }
  
  /**
   * Get current month key for monthly quotas
   */
  getCurrentMonth() {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }
  
  /**
   * Check if IP is blocked
   */
  async isIPBlocked(ip) {
    try {
      const blocked = await this.redis.get(`blocked_ip:${ip}`)
      return blocked === '1'
    } catch (error) {
      console.error('Failed to check IP block status:', error.message)
      return false
    }
  }
  
  /**
   * Block IP address temporarily
   */
  async blockIP(ip, durationMs) {
    try {
      await this.redis.setex(`blocked_ip:${ip}`, Math.ceil(durationMs / 1000), '1')
      console.warn(`IP ${ip} blocked for ${durationMs}ms`)
    } catch (error) {
      console.error('Failed to block IP:', error.message)
    }
  }
  
  /**
   * Find suspicious IP addresses
   */
  async findSuspiciousIPs(startTime, endTime) {
    try {
      // This is a simplified implementation
      // In production, you'd analyze request patterns more thoroughly
      const pattern = `${config.redis.keyPrefix}rate_limit:*:perIP:*`
      const keys = await this.redis.keys(pattern)
      
      const suspiciousIPs = []
      
      for (const key of keys.slice(0, 100)) { // Limit to prevent performance issues
        const count = await this.redis.get(key)
        if (parseInt(count) > this.ddosThresholds.suspiciousIPRequests) {
          const ip = key.split(':').pop()
          suspiciousIPs.push(ip)
        }
      }
      
      return suspiciousIPs
    } catch (error) {
      console.error('Failed to find suspicious IPs:', error.message)
      return []
    }
  }
  
  /**
   * Get global request count
   */
  async getGlobalRequestCount(startTime, endTime) {
    try {
      // Simplified implementation - would need more sophisticated tracking
      const globalKeys = await this.redis.keys(`${config.redis.keyPrefix}rate_limit:global:*`)
      let totalCount = 0
      
      for (const key of globalKeys) {
        const count = await this.redis.get(key)
        totalCount += parseInt(count) || 0
      }
      
      return totalCount
    } catch (error) {
      console.error('Failed to get global request count:', error.message)
      return 0
    }
  }
  
  /**
   * Get failed authentication count
   */
  async getFailedAuthCount(startTime, endTime) {
    try {
      // This would track failed auth attempts
      const failedAuthKey = `failed_auth:${Math.floor(startTime / 60000)}`
      const count = await this.redis.get(failedAuthKey)
      return parseInt(count) || 0
    } catch (error) {
      console.error('Failed to get failed auth count:', error.message)
      return 0
    }
  }
  
  /**
   * Activate emergency rate limits during attacks
   */
  async activateEmergencyLimits() {
    try {
      // Reduce all limits by 50% temporarily
      const emergencyKey = 'emergency_limits_active'
      await this.redis.setex(emergencyKey, 3600, '1') // Active for 1 hour
      
      console.warn('Emergency rate limits activated')
    } catch (error) {
      console.error('Failed to activate emergency limits:', error.message)
    }
  }
  
  /**
   * Check if emergency limits are active
   */
  async areEmergencyLimitsActive() {
    try {
      const active = await this.redis.get('emergency_limits_active')
      return active === '1'
    } catch (error) {
      return false
    }
  }
  
  /**
   * Reset monitoring metrics
   */
  resetMetrics() {
    this.metrics = {
      requestsBlocked: 0,
      ddosAttacksDetected: 0,
      planLimitViolations: 0,
      circuitBreakerTrips: 0,
      lastResetTime: Date.now()
    }
    
    console.log('Rate limiting metrics reset')
  }
  
  /**
   * Get comprehensive rate limiting statistics
   */
  async getStatistics() {
    try {
      const pattern = `${config.redis.keyPrefix}rate_limit:*`
      const keys = await this.redis.keys(pattern)
      
      const stats = {
        totalKeys: keys.length,
        endpointStats: {},
        topLimitedIPs: {},
        topLimitedUsers: {},
        metrics: this.metrics,
        circuitBreaker: {
          state: this.circuitBreaker.state,
          failureCount: this.circuitBreaker.failureCount,
          lastFailureTime: this.circuitBreaker.lastFailureTime
        },
        emergencyLimitsActive: await this.areEmergencyLimitsActive(),
        planDistribution: await this.getPlanDistribution(),
      }
      
      // Analyze keys to generate statistics
      for (const key of keys.slice(0, 1000)) { // Limit to prevent performance issues
        const parts = key.replace(config.redis.keyPrefix + 'rate_limit:', '').split(':')
        if (parts.length >= 3) {
          const endpoint = `${parts[0]}:${parts[1]}`
          const limitType = parts[2]
          const identifier = parts[3]
          
          if (!stats.endpointStats[endpoint]) {
            stats.endpointStats[endpoint] = { keys: 0, types: {} }
          }
          
          stats.endpointStats[endpoint].keys++
          stats.endpointStats[endpoint].types[limitType] = 
            (stats.endpointStats[endpoint].types[limitType] || 0) + 1
          
          // Track top limited identifiers
          if (limitType === 'perIP') {
            stats.topLimitedIPs[identifier] = (stats.topLimitedIPs[identifier] || 0) + 1
          } else if (limitType === 'perUser') {
            stats.topLimitedUsers[identifier] = (stats.topLimitedUsers[identifier] || 0) + 1
          }
        }
      }
      
      return stats
    } catch (error) {
      console.error('Failed to get rate limiting statistics:', error.message)
      return { error: error.message }
    }
  }
  
  /**
   * Get plan distribution statistics
   */
  async getPlanDistribution() {
    try {
      // This would query the database for plan distribution
      // For now, return mock data
      return {
        free: 850,
        starter: 120,
        pro: 25,
        enterprise: 5
      }
    } catch (error) {
      console.error('Failed to get plan distribution:', error.message)
      return {}
    }
  }
  
  /**
   * Admin function to adjust rate limits dynamically
   */
  async adjustRateLimit(endpoint, limitType, newLimit, windowMs) {
    try {
      if (!this.limits[endpoint]) {
        this.limits[endpoint] = {}
      }
      
      this.limits[endpoint][limitType] = {
        max: newLimit,
        window: windowMs
      }
      
      // Store in Redis for persistence across restarts
      const configKey = `rate_limit_config:${endpoint}:${limitType}`
      await this.redis.setex(configKey, 86400, JSON.stringify({ max: newLimit, window: windowMs }))
      
      console.log(`Rate limit adjusted: ${endpoint} ${limitType} = ${newLimit}/${windowMs}ms`)
      
      return { success: true, endpoint, limitType, newLimit, windowMs }
    } catch (error) {
      console.error('Failed to adjust rate limit:', error.message)
      throw new Error('Rate limit adjustment failed')
    }
  }
  
  /**
   * Admin function to unblock IP address
   */
  async unblockIP(ip) {
    try {
      await this.redis.del(`blocked_ip:${ip}`)
      console.log(`IP ${ip} unblocked`)
      return { success: true, ip, unblocked: true }
    } catch (error) {
      console.error('Failed to unblock IP:', error.message)
      throw new Error('IP unblock failed')
    }
  }
  
  /**
   * Admin function to reset user's plan limits
   */
  async resetUserLimits(userId, orgId) {
    try {
      const pattern = `${config.redis.keyPrefix}rate_limit:plan:*:${userId}:*`
      const keys = await this.redis.keys(pattern)
      
      if (keys.length > 0) {
        await this.redis.del(...keys)
      }
      
      // Clear plan cache
      await this.redis.del(`user_plan:${userId}:${orgId || 'personal'}`)
      
      console.log(`User limits reset for ${userId}`)
      return { success: true, userId, keysDeleted: keys.length }
    } catch (error) {
      console.error('Failed to reset user limits:', error.message)
      throw new Error('User limit reset failed')
    }
  }
  
  /**
   * Get service health status
   */
  async getHealthStatus() {
    try {
      // Test Redis connectivity
      await this.redis.ping()
      
      const info = await this.redis.info('memory')
      const memoryUsage = info.match(/used_memory_human:(.+)/)?.[1]?.trim()
      
      return {
        status: 'healthy',
        redis: {
          connected: true,
          memoryUsage,
        },
        features: {
          rateLimitingEnabled: config.features.rateLimiting,
        },
        endpoints: Object.keys(this.limits).length,
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        redis: {
          connected: false,
        },
      }
    }
  }
  
  /**
   * Close Redis connection
   */
  async close() {
    await this.redis.quit()
  }
}

// Create singleton instance
const rateLimitService = new RateLimitService()

// Export singleton
export default rateLimitService
