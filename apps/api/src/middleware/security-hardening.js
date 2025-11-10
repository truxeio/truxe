/**
 * Truxe Security Hardening Middleware
 * 
 * Enterprise-grade security hardening for production environments including
 * security headers, CORS policies, DDoS protection, input validation,
 * and comprehensive security monitoring.
 * 
 * @author Security Engineering Team
 * @version 1.0.0
 */

import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import config from '../config/index.js';

/**
 * Security Policy Levels
 */
export const SecurityLevel = {
  DEVELOPMENT: 'development',
  STAGING: 'staging',
  PRODUCTION: 'production',
  HIGH_SECURITY: 'high_security'
};

/**
 * CORS Configuration for different environments
 */
const getCorsConfig = (environment = 'production') => {
  const configs = {
    development: {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-API-Key',
        'X-Client-Version',
        'X-Request-ID'
      ]
    },
    
    staging: {
      origin: [
        'https://staging.truxe.io',
        'https://staging-api.truxe.io',
        'https://preview.truxe.io',
        /^https:\/\/.*\.truxe\.dev$/,
        /^https:\/\/.*\.vercel\.app$/,
        /^https:\/\/.*\.netlify\.app$/
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-API-Key',
        'X-Client-Version',
        'X-Request-ID'
      ],
      maxAge: 86400 // 24 hours
    },
    
    production: {
      origin: [
        'https://truxe.io',
        'https://www.truxe.io',
        'https://app.truxe.io',
        'https://api.truxe.io',
        // Add client domains from environment
        ...(config.security?.allowedOrigins || [])
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-API-Key',
        'X-Client-Version'
      ],
      exposedHeaders: [
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
        'X-Request-ID'
      ],
      maxAge: 86400 // 24 hours
    },
    
    high_security: {
      origin: false, // No cross-origin requests allowed
      credentials: false,
      methods: ['GET', 'POST'],
      allowedHeaders: [
        'Content-Type',
        'Authorization'
      ],
      maxAge: 3600 // 1 hour
    }
  };

  return configs[environment] || configs.production;
};

/**
 * Security Headers Configuration
 */
const getSecurityHeaders = (environment = 'production') => {
  const baseConfig = {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'", // Required for some admin tools in non-prod
          "https://cdn.jsdelivr.net",
          "https://unpkg.com"
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://cdn.jsdelivr.net"
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "data:"
        ],
        imgSrc: [
          "'self'",
          "data:",
          "https:",
          "blob:"
        ],
        connectSrc: [
          "'self'",
          "https://api.truxe.io",
          "wss://api.truxe.io"
        ],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: environment === 'production'
      }
    },
    
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    
    frameguard: {
      action: 'deny'
    },
    
    noSniff: true,
    
    xssFilter: true,
    
    referrerPolicy: {
      policy: ['strict-origin-when-cross-origin']
    },
    
    permittedCrossDomainPolicies: false,
    
    crossOriginEmbedderPolicy: environment === 'production' ? 'require-corp' : false,
    
    crossOriginOpenerPolicy: 'same-origin',
    
    crossOriginResourcePolicy: {
      policy: 'cross-origin'
    },
    
    originAgentCluster: true
  };

  // Production-specific hardening
  if (environment === 'production' || environment === 'high_security') {
    baseConfig.contentSecurityPolicy.directives.scriptSrc = [
      "'self'",
      "'sha256-your-inline-script-hash'" // Replace with actual hashes
    ];
    
    baseConfig.contentSecurityPolicy.directives.styleSrc = [
      "'self'",
      "'sha256-your-inline-style-hash'" // Replace with actual hashes
    ];
    
    baseConfig.contentSecurityPolicy.directives.upgradeInsecureRequests = true;
    baseConfig.crossOriginEmbedderPolicy = 'require-corp';
  }

  return baseConfig;
};

/**
 * Input Validation and Sanitization
 */
const inputValidationRules = {
  // Email validation
  email: {
    pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    maxLength: 254,
    sanitize: (value) => value.toLowerCase().trim()
  },
  
  // URL validation
  url: {
    pattern: /^https?:\/\/.+/,
    maxLength: 2048,
    sanitize: (value) => value.trim()
  },
  
  // Username validation
  username: {
    pattern: /^[a-zA-Z0-9_-]+$/,
    minLength: 3,
    maxLength: 30,
    sanitize: (value) => value.toLowerCase().trim()
  },
  
  // Organization slug validation
  orgSlug: {
    pattern: /^[a-z0-9-]+$/,
    minLength: 3,
    maxLength: 50,
    sanitize: (value) => value.toLowerCase().trim()
  },
  
  // Generic text validation
  text: {
    maxLength: 1000,
    sanitize: (value) => value.trim().replace(/[<>]/g, '')
  }
};

/**
 * SQL Injection Detection Patterns
 */
const sqlInjectionPatterns = [
  /(\bunion\b.*\bselect\b)/i,
  /(\bselect\b.*\bfrom\b)/i,
  /(\binsert\b.*\binto\b)/i,
  /(\bupdate\b.*\bset\b)/i,
  /(\bdelete\b.*\bfrom\b)/i,
  /(\bdrop\b.*\btable\b)/i,
  /(\balter\b.*\btable\b)/i,
  /('.*or.*'.*=.*')/i,
  /(;.*--)/i,
  /(\bexec\b.*\()/i,
  /(\bsp_\w+)/i,
  /(\bxp_\w+)/i
];

/**
 * XSS Detection Patterns
 */
const xssPatterns = [
  /<script[^>]*>.*?<\/script>/gi,
  /<iframe[^>]*>.*?<\/iframe>/gi,
  /<object[^>]*>.*?<\/object>/gi,
  /<embed[^>]*>/gi,
  /<link[^>]*>/gi,
  /<meta[^>]*>/gi,
  /javascript:/gi,
  /vbscript:/gi,
  /data:text\/html/gi,
  /on\w+\s*=/gi,
  /<img[^>]*src\s*=\s*["']javascript:/gi
];

/**
 * Command Injection Detection Patterns
 */
const commandInjectionPatterns = [
  /[;&|`$()]/,
  /\b(cat|ls|pwd|whoami|id|uname|ps|netstat|ifconfig|ping|curl|wget)\b/i,
  /\.\.\//,
  /\/etc\/passwd/i,
  /\/proc\//i,
  /\\\\|\/\//
];

/**
 * Security Hardening Middleware Plugin
 */
export default async function securityHardeningPlugin(fastify, options) {
  const environment = options.environment || config.app.environment || 'production';
  const securityLevel = options.securityLevel || SecurityLevel.PRODUCTION;
  
  // Register Helmet for security headers
  await fastify.register(helmet, getSecurityHeaders(environment));

  // NOTE: CORS is already registered in server.js
  // Registering it again here causes "decorator already added" error
  // await fastify.register(cors, getCorsConfig(environment));

  // Register rate limiting
  await fastify.register(rateLimit, {
    max: options.globalRateLimit?.max || 1000,
    timeWindow: options.globalRateLimit?.timeWindow || '1 hour',
    redis: config.redis.connection,
    keyGenerator: (request) => {
      // Use IP and user ID for more granular rate limiting
      return `global_${request.ip}_${request.user?.id || 'anonymous'}`;
    },
    errorResponseBuilder: (request, context) => {
      return {
        error: 'Rate Limit Exceeded',
        message: 'Too many requests. Please try again later.',
        statusCode: 429,
        retryAfter: Math.round(context.ttl / 1000),
        limit: context.max,
        remaining: context.remaining,
        reset: new Date(Date.now() + context.ttl)
      };
    }
  });

  // Add security validation hooks
  fastify.addHook('preValidation', async (request, reply) => {
    // Skip validation for health checks and metrics
    if (request.url.startsWith('/health') || request.url.startsWith('/metrics')) {
      return;
    }

    // Validate and sanitize input
    await validateAndSanitizeInput(request, reply);
    
    // Check for malicious patterns
    await checkMaliciousPatterns(request, reply);
    
    // Add security headers to response
    addSecurityHeaders(request, reply, environment);
  });

  // Add request logging hook
  fastify.addHook('onRequest', async (request, reply) => {
    // Add request ID for tracking
    request.id = request.id || generateRequestId();
    
    // Log security-relevant information
    if (shouldLogRequest(request)) {
      fastify.log.info({
        requestId: request.id,
        method: request.method,
        url: request.url,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        origin: request.headers.origin,
        referer: request.headers.referer
      }, 'Security log: Request received');
    }
  });

  // Add response logging hook
  fastify.addHook('onSend', async (request, reply, payload) => {
    // Log security violations
    if (reply.statusCode === 429 || reply.statusCode === 403) {
      fastify.log.warn({
        requestId: request.id,
        statusCode: reply.statusCode,
        ip: request.ip,
        url: request.url,
        userAgent: request.headers['user-agent']
      }, 'Security log: Blocked request');
    }
    
    return payload;
  });
}

/**
 * Validate and sanitize request input
 */
async function validateAndSanitizeInput(request, reply) {
  const validationErrors = [];

  // Validate body parameters
  if (request.body && typeof request.body === 'object') {
    for (const [key, value] of Object.entries(request.body)) {
      if (typeof value === 'string') {
        const validation = validateField(key, value);
        if (!validation.valid) {
          validationErrors.push({
            field: key,
            error: validation.error,
            value: validation.sanitized || value
          });
        } else if (validation.sanitized !== value) {
          // Update with sanitized value
          request.body[key] = validation.sanitized;
        }
      }
    }
  }

  // Validate query parameters
  if (request.query && typeof request.query === 'object') {
    for (const [key, value] of Object.entries(request.query)) {
      if (typeof value === 'string') {
        const validation = validateField(key, value);
        if (!validation.valid) {
          validationErrors.push({
            field: key,
            error: validation.error,
            value: validation.sanitized || value
          });
        } else if (validation.sanitized !== value) {
          // Update with sanitized value
          request.query[key] = validation.sanitized;
        }
      }
    }
  }

  // If validation errors, return 400
  if (validationErrors.length > 0) {
    reply.code(400).send({
      error: 'Validation Error',
      message: 'Invalid input data detected',
      details: validationErrors,
      timestamp: new Date().toISOString()
    });
    return;
  }
}

/**
 * Validate individual field
 */
function validateField(fieldName, value) {
  const result = {
    valid: true,
    sanitized: value,
    error: null
  };

  // Determine validation rule based on field name
  let rule = null;
  if (fieldName.includes('email')) {
    rule = inputValidationRules.email;
  } else if (fieldName.includes('url') || fieldName.includes('link')) {
    rule = inputValidationRules.url;
  } else if (fieldName.includes('username') || fieldName === 'name') {
    rule = inputValidationRules.username;
  } else if (fieldName.includes('slug') || fieldName.includes('org')) {
    rule = inputValidationRules.orgSlug;
  } else {
    rule = inputValidationRules.text;
  }

  // Apply sanitization
  if (rule.sanitize) {
    result.sanitized = rule.sanitize(value);
  }

  // Check pattern
  if (rule.pattern && !rule.pattern.test(result.sanitized)) {
    result.valid = false;
    result.error = `Invalid format for field: ${fieldName}`;
    return result;
  }

  // Check length constraints
  if (rule.minLength && result.sanitized.length < rule.minLength) {
    result.valid = false;
    result.error = `Field ${fieldName} is too short (minimum ${rule.minLength} characters)`;
    return result;
  }

  if (rule.maxLength && result.sanitized.length > rule.maxLength) {
    result.valid = false;
    result.error = `Field ${fieldName} is too long (maximum ${rule.maxLength} characters)`;
    return result;
  }

  return result;
}

/**
 * Check for malicious patterns in request
 */
async function checkMaliciousPatterns(request, reply) {
  const threats = [];
  const requestData = JSON.stringify({
    body: request.body,
    query: request.query,
    params: request.params
  });

  // Check for SQL injection
  for (const pattern of sqlInjectionPatterns) {
    if (pattern.test(requestData)) {
      threats.push({
        type: 'sql_injection',
        pattern: pattern.toString(),
        severity: 'high'
      });
    }
  }

  // Check for XSS
  for (const pattern of xssPatterns) {
    if (pattern.test(requestData)) {
      threats.push({
        type: 'xss',
        pattern: pattern.toString(),
        severity: 'high'
      });
    }
  }

  // Check for command injection
  for (const pattern of commandInjectionPatterns) {
    if (pattern.test(requestData)) {
      threats.push({
        type: 'command_injection',
        pattern: pattern.toString(),
        severity: 'critical'
      });
    }
  }

  // Check User-Agent for known attack tools
  const userAgent = request.headers['user-agent'] || '';
  const suspiciousUserAgents = [
    /sqlmap/i,
    /nikto/i,
    /nmap/i,
    /burpsuite/i,
    /owasp/i,
    /scanner/i,
    /crawler/i,
    /bot.*attack/i
  ];

  for (const pattern of suspiciousUserAgents) {
    if (pattern.test(userAgent)) {
      threats.push({
        type: 'suspicious_user_agent',
        pattern: pattern.toString(),
        severity: 'medium'
      });
    }
  }

  // If threats detected, log and potentially block
  if (threats.length > 0) {
    const highSeverityThreats = threats.filter(t => t.severity === 'critical' || t.severity === 'high');
    
    // Log all threats
    request.log.warn({
      requestId: request.id,
      ip: request.ip,
      url: request.url,
      threats,
      userAgent
    }, 'Security threats detected in request');

    // Block high/critical severity threats
    if (highSeverityThreats.length > 0) {
      reply.code(403).send({
        error: 'Security Violation',
        message: 'Malicious request pattern detected',
        requestId: request.id,
        timestamp: new Date().toISOString()
      });
      return;
    }
  }
}

/**
 * Add additional security headers
 */
function addSecurityHeaders(request, reply, environment) {
  // Add custom security headers
  reply.header('X-Request-ID', request.id);
  reply.header('X-Environment', environment);
  reply.header('X-Powered-By', 'Truxe'); // Override default
  
  // Add security policy headers
  if (environment === 'production') {
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    reply.header('X-Permitted-Cross-Domain-Policies', 'none');
    reply.header('Cross-Origin-Embedder-Policy', 'require-corp');
    reply.header('Cross-Origin-Opener-Policy', 'same-origin');
  }

  // Add cache control for sensitive endpoints
  if (request.url.includes('/auth/') || request.url.includes('/admin/')) {
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    reply.header('Pragma', 'no-cache');
    reply.header('Expires', '0');
  }
}

/**
 * Determine if request should be logged
 */
function shouldLogRequest(request) {
  // Always log authentication and admin requests
  if (request.url.includes('/auth/') || request.url.includes('/admin/')) {
    return true;
  }

  // Log POST, PUT, DELETE requests
  if (['POST', 'PUT', 'DELETE'].includes(request.method)) {
    return true;
  }

  // Log requests with suspicious patterns
  const userAgent = request.headers['user-agent'] || '';
  if (userAgent.includes('bot') || userAgent.includes('crawler')) {
    return true;
  }

  // Log requests from unknown origins
  const origin = request.headers.origin;
  if (origin && !origin.includes('truxe.io')) {
    return true;
  }

  return false;
}

/**
 * Generate unique request ID
 */
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Security hardening configuration builder
 */
export function buildSecurityConfig(options = {}) {
  const {
    environment = 'production',
    securityLevel = SecurityLevel.PRODUCTION,
    customOrigins = [],
    enableStrictCSP = true,
    enableHSTS = true,
    globalRateLimit = { max: 1000, timeWindow: '1 hour' }
  } = options;

  return {
    environment,
    securityLevel,
    cors: getCorsConfig(environment),
    helmet: getSecurityHeaders(environment),
    globalRateLimit,
    customOrigins,
    enableStrictCSP,
    enableHSTS,
    inputValidation: {
      enabled: true,
      rules: inputValidationRules
    },
    threatDetection: {
      enabled: true,
      sqlInjection: true,
      xss: true,
      commandInjection: true,
      suspiciousUserAgents: true
    }
  };
}

export {
  getCorsConfig,
  getSecurityHeaders,
  inputValidationRules,
  sqlInjectionPatterns,
  xssPatterns,
  commandInjectionPatterns
};
