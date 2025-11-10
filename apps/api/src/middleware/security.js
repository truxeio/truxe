/**
 * Advanced Security Middleware
 * 
 * Comprehensive security middleware that provides:
 * - Rate limiting integration
 * - Request validation and sanitization
 * - Attack pattern detection
 * - Security headers management
 * - Threat intelligence integration
 */

import rateLimitService from '../services/rate-limit.js'
import config from '../config/index.js'

/**
 * Security middleware plugin for Fastify
 */
export default async function securityMiddleware(fastify, options) {
  
  /**
   * Request security analysis hook
   */
  fastify.addHook('preHandler', async function securityAnalysis(request, reply) {
    // Skip security analysis for health checks and admin endpoints
    if (request.url.startsWith('/health') || request.url.startsWith('/.well-known/')) {
      return
    }
    
    const startTime = Date.now()
    
    try {
      // Analyze request for security threats
      const securityAnalysis = await analyzeRequestSecurity(request)
      
      // Add security context to request
      request.security = securityAnalysis
      
      // Block if high-risk request detected
      if (securityAnalysis.riskLevel === 'critical') {
        const duration = Date.now() - startTime
        
        // Log security event
        fastify.log.error('Critical security threat blocked:', {
          ip: request.ip,
          url: request.url,
          method: request.method,
          userAgent: request.headers['user-agent'],
          threats: securityAnalysis.threats,
          duration
        })
        
        // Temporarily block IP
        await rateLimitService.blockIP(request.ip, 3600000) // 1 hour
        
        return reply.code(403).send({
          error: 'Request Blocked',
          message: 'Your request has been blocked due to security concerns.',
          requestId: request.id
        })
      }
      
      // Add security headers
      addSecurityHeaders(reply, securityAnalysis)
      
    } catch (error) {
      fastify.log.error('Security analysis failed:', error)
      // Continue processing on security analysis failure
    }
  })
  
  /**
   * Response security hook
   */
  fastify.addHook('onSend', async function responseSecurityCheck(request, reply, payload) {
    // Add additional security headers
    reply.header('X-Request-ID', request.id)
    reply.header('X-Response-Time', Date.now() - request.startTime)
    
    // Prevent sensitive data leakage in error responses
    if (reply.statusCode >= 400 && payload) {
      try {
        const parsedPayload = JSON.parse(payload)
        if (parsedPayload.stack || parsedPayload.trace) {
          // Remove stack traces in production
          if (config.app.environment === 'production') {
            delete parsedPayload.stack
            delete parsedPayload.trace
            return JSON.stringify(parsedPayload)
          }
        }
      } catch (e) {
        // Payload is not JSON, continue
      }
    }
    
    return payload
  })
  
  /**
   * Error handling with security context
   */
  fastify.setErrorHandler(async function securityErrorHandler(error, request, reply) {
    // Log security-related errors
    if (request.security?.riskLevel === 'high' || request.security?.riskLevel === 'critical') {
      fastify.log.error('Security-related error:', {
        error: error.message,
        ip: request.ip,
        url: request.url,
        security: request.security
      })
    }
    
    // Don't expose internal errors in production
    if (config.app.environment === 'production') {
      const publicError = {
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
        requestId: request.id
      }
      
      // Only expose specific error types
      if (error.statusCode && error.statusCode < 500) {
        publicError.error = error.message
        publicError.message = error.message
      }
      
      return reply.code(error.statusCode || 500).send(publicError)
    }
    
    // In development, expose full error details
    return reply.code(error.statusCode || 500).send({
      error: error.name || 'Error',
      message: error.message,
      stack: error.stack,
      requestId: request.id
    })
  })
}

/**
 * Analyze request for security threats
 */
async function analyzeRequestSecurity(request) {
  const threats = []
  let riskScore = 0
  
  // Analyze URL for common attack patterns
  const urlThreats = analyzeURLThreats(request.url)
  threats.push(...urlThreats.threats)
  riskScore += urlThreats.score
  
  // Analyze headers for suspicious patterns
  const headerThreats = analyzeHeaderThreats(request.headers)
  threats.push(...headerThreats.threats)
  riskScore += headerThreats.score
  
  // Analyze request body for injection attempts
  if (request.body) {
    const bodyThreats = analyzeBodyThreats(request.body)
    threats.push(...bodyThreats.threats)
    riskScore += bodyThreats.score
  }
  
  // Analyze user agent for bot patterns
  const userAgentThreats = analyzeUserAgentThreats(request.headers['user-agent'])
  threats.push(...userAgentThreats.threats)
  riskScore += userAgentThreats.score
  
  // Normalize risk score
  const normalizedScore = Math.min(riskScore, 1.0)
  
  return {
    riskScore: normalizedScore,
    riskLevel: getRiskLevel(normalizedScore),
    threats,
    timestamp: Date.now()
  }
}

/**
 * Analyze URL for attack patterns
 */
function analyzeURLThreats(url) {
  const threats = []
  let score = 0
  
  // SQL Injection patterns
  const sqlPatterns = [
    /(\bunion\b.*\bselect\b)/i,
    /(\bselect\b.*\bfrom\b)/i,
    /(\binsert\b.*\binto\b)/i,
    /(\bdelete\b.*\bfrom\b)/i,
    /(\bdrop\b.*\btable\b)/i,
    /('.*or.*'.*=.*')/i,
    /(--|\#|\/\*)/,
    /(\bexec\b|\bexecute\b)/i
  ]
  
  for (const pattern of sqlPatterns) {
    if (pattern.test(url)) {
      threats.push({
        type: 'sql_injection',
        pattern: pattern.toString(),
        severity: 'high'
      })
      score += 0.8
      break // One detection is enough
    }
  }
  
  // XSS patterns
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe[^>]*>/i,
    /eval\s*\(/i,
    /expression\s*\(/i
  ]
  
  for (const pattern of xssPatterns) {
    if (pattern.test(url)) {
      threats.push({
        type: 'xss_attempt',
        pattern: pattern.toString(),
        severity: 'high'
      })
      score += 0.7
      break
    }
  }
  
  // Path traversal patterns
  const pathTraversalPatterns = [
    /\.\.\//,
    /\.\.\\\\/,
    /%2e%2e%2f/i,
    /%2e%2e%5c/i,
    /\.\.\%2f/i
  ]
  
  for (const pattern of pathTraversalPatterns) {
    if (pattern.test(url)) {
      threats.push({
        type: 'path_traversal',
        pattern: pattern.toString(),
        severity: 'medium'
      })
      score += 0.5
      break
    }
  }
  
  // Command injection patterns
  const commandPatterns = [
    /[;&|`$()]/,
    /\bcat\b|\bls\b|\bps\b|\bwhoami\b/i,
    /\bcurl\b|\bwget\b/i
  ]
  
  for (const pattern of commandPatterns) {
    if (pattern.test(url)) {
      threats.push({
        type: 'command_injection',
        pattern: pattern.toString(),
        severity: 'high'
      })
      score += 0.6
      break
    }
  }
  
  return { threats, score }
}

/**
 * Analyze headers for suspicious patterns
 */
function analyzeHeaderThreats(headers) {
  const threats = []
  let score = 0
  
  // Check for suspicious user agents
  const userAgent = headers['user-agent'] || ''
  
  // Known attack tools
  const attackTools = [
    'sqlmap', 'nikto', 'nmap', 'masscan', 'zap', 'burp',
    'metasploit', 'havij', 'pangolin', 'webscarab'
  ]
  
  for (const tool of attackTools) {
    if (userAgent.toLowerCase().includes(tool)) {
      threats.push({
        type: 'attack_tool',
        tool,
        severity: 'critical'
      })
      score += 0.9
      break
    }
  }
  
  // Check for header injection attempts
  const suspiciousHeaders = ['x-forwarded-for', 'x-real-ip', 'x-originating-ip']
  
  for (const headerName of suspiciousHeaders) {
    const headerValue = headers[headerName]
    if (headerValue && (headerValue.includes('\n') || headerValue.includes('\r'))) {
      threats.push({
        type: 'header_injection',
        header: headerName,
        severity: 'medium'
      })
      score += 0.4
    }
  }
  
  // Check for unusually long headers (potential buffer overflow)
  for (const [name, value] of Object.entries(headers)) {
    if (typeof value === 'string' && value.length > 8192) {
      threats.push({
        type: 'oversized_header',
        header: name,
        length: value.length,
        severity: 'medium'
      })
      score += 0.3
    }
  }
  
  return { threats, score }
}

/**
 * Analyze request body for threats
 */
function analyzeBodyThreats(body) {
  const threats = []
  let score = 0
  
  if (!body || typeof body !== 'object') {
    return { threats, score }
  }
  
  // Convert body to string for analysis
  const bodyStr = JSON.stringify(body).toLowerCase()
  
  // Check for SQL injection in body
  const sqlPatterns = [
    /union.*select/,
    /insert.*into/,
    /delete.*from/,
    /drop.*table/,
    /'.*or.*'.*=/
  ]
  
  for (const pattern of sqlPatterns) {
    if (pattern.test(bodyStr)) {
      threats.push({
        type: 'sql_injection_body',
        severity: 'high'
      })
      score += 0.7
      break
    }
  }
  
  // Check for XSS in body
  const xssPatterns = [
    /<script/,
    /javascript:/,
    /on\w+\s*=/,
    /<iframe/
  ]
  
  for (const pattern of xssPatterns) {
    if (pattern.test(bodyStr)) {
      threats.push({
        type: 'xss_body',
        severity: 'medium'
      })
      score += 0.5
      break
    }
  }
  
  // Check for oversized payloads
  if (bodyStr.length > 1024000) { // 1MB limit
    threats.push({
      type: 'oversized_payload',
      size: bodyStr.length,
      severity: 'medium'
    })
    score += 0.4
  }
  
  return { threats, score }
}

/**
 * Analyze user agent for bot patterns
 */
function analyzeUserAgentThreats(userAgent) {
  const threats = []
  let score = 0
  
  if (!userAgent) {
    threats.push({
      type: 'missing_user_agent',
      severity: 'low'
    })
    score += 0.2
    return { threats, score }
  }
  
  // Check for bot patterns
  const botPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /curl/i,
    /wget/i,
    /python-requests/i,
    /node-fetch/i
  ]
  
  for (const pattern of botPatterns) {
    if (pattern.test(userAgent)) {
      threats.push({
        type: 'automated_client',
        pattern: pattern.toString(),
        severity: 'low'
      })
      score += 0.1
      break
    }
  }
  
  // Check for suspicious user agent patterns
  if (userAgent.length < 10 || userAgent.length > 500) {
    threats.push({
      type: 'suspicious_user_agent_length',
      length: userAgent.length,
      severity: 'low'
    })
    score += 0.1
  }
  
  return { threats, score }
}

/**
 * Add security headers to response
 */
function addSecurityHeaders(reply, securityAnalysis) {
  // Basic security headers
  reply.header('X-Content-Type-Options', 'nosniff')
  reply.header('X-Frame-Options', 'DENY')
  reply.header('X-XSS-Protection', '1; mode=block')
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // Add security risk level header for monitoring
  if (securityAnalysis.riskLevel !== 'low') {
    reply.header('X-Security-Risk-Level', securityAnalysis.riskLevel)
  }
  
  // Strict Transport Security (HTTPS only)
  if (config.app.environment === 'production') {
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  
  // Content Security Policy for API responses
  reply.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
}

/**
 * Get risk level from score
 */
function getRiskLevel(score) {
  if (score >= 0.8) return 'critical'
  if (score >= 0.6) return 'high'
  if (score >= 0.3) return 'medium'
  return 'low'
}
