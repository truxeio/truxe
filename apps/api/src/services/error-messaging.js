/**
 * Enhanced Error Messaging System
 * 
 * Provides actionable guidance and intelligent error resolution suggestions
 * for organization management, port conflicts, and authentication issues.
 */

import config from '../config/index.js'

/**
 * Error categories and their resolution strategies
 */
export const ERROR_CATEGORIES = {
  ORGANIZATION: 'organization',
  MEMBERSHIP: 'membership',
  AUTHENTICATION: 'authentication',
  PORT_CONFLICT: 'port_conflict',
  PERMISSION: 'permission',
  VALIDATION: 'validation',
  RATE_LIMIT: 'rate_limit',
  SYSTEM: 'system',
}

/**
 * Error severity levels
 */
export const ERROR_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
}

/**
 * Enhanced error message generator
 */
export class ErrorMessagingService {
  constructor() {
    this.errorPatterns = this.initializeErrorPatterns()
    this.resolutionStrategies = this.initializeResolutionStrategies()
  }

  /**
   * Generate enhanced error message with actionable guidance
   */
  generateEnhancedError(error, context = {}) {
    const errorInfo = this.analyzeError(error, context)
    const resolution = this.generateResolution(errorInfo, context)
    
    return {
      error: errorInfo,
      resolution,
      timestamp: new Date().toISOString(),
      requestId: context.requestId,
    }
  }

  /**
   * Analyze error and categorize it
   */
  analyzeError(error, context) {
    const message = error.message || error.toString()
    const code = error.code || error.statusCode || 'UNKNOWN'
    
    // Determine error category
    const category = this.categorizeError(message, code, context)
    
    // Determine severity
    const severity = this.determineSeverity(category, code, context)
    
    // Extract key information
    const keyInfo = this.extractKeyInformation(message, context)
    
    return {
      originalMessage: message,
      code,
      category,
      severity,
      keyInfo,
      context: this.sanitizeContext(context),
    }
  }

  /**
   * Generate resolution strategy
   */
  generateResolution(errorInfo, context) {
    const strategy = this.resolutionStrategies[errorInfo.category]?.[errorInfo.code]
    
    if (!strategy) {
      return this.generateGenericResolution(errorInfo, context)
    }

    return {
      strategy: strategy.name,
      description: strategy.description,
      actions: this.generateActionableSteps(strategy, errorInfo, context),
      prevention: strategy.prevention || [],
      related: strategy.related || [],
      estimatedTime: strategy.estimatedTime || '5-10 minutes',
    }
  }

  /**
   * Categorize error based on message and context
   */
  categorizeError(message, code, context) {
    const lowerMessage = message.toLowerCase()
    
    // Organization-related errors
    if (lowerMessage.includes('organization') || lowerMessage.includes('org')) {
      if (lowerMessage.includes('not found') || lowerMessage.includes('does not exist')) {
        return ERROR_CATEGORIES.ORGANIZATION
      }
      if (lowerMessage.includes('permission') || lowerMessage.includes('access')) {
        return ERROR_CATEGORIES.PERMISSION
      }
    }
    
    // Membership-related errors
    if (lowerMessage.includes('member') || lowerMessage.includes('invitation')) {
      if (lowerMessage.includes('already exists') || lowerMessage.includes('duplicate')) {
        return ERROR_CATEGORIES.MEMBERSHIP
      }
      if (lowerMessage.includes('permission') || lowerMessage.includes('role')) {
        return ERROR_CATEGORIES.PERMISSION
      }
    }
    
    // Authentication errors
    if (lowerMessage.includes('token') || lowerMessage.includes('auth') || lowerMessage.includes('login')) {
      return ERROR_CATEGORIES.AUTHENTICATION
    }
    
    // Port conflict errors
    if (lowerMessage.includes('port') && (lowerMessage.includes('conflict') || lowerMessage.includes('in use'))) {
      return ERROR_CATEGORIES.PORT_CONFLICT
    }
    
    // Rate limiting errors
    if (lowerMessage.includes('rate limit') || lowerMessage.includes('too many requests')) {
      return ERROR_CATEGORIES.RATE_LIMIT
    }
    
    // Validation errors
    if (lowerMessage.includes('invalid') || lowerMessage.includes('validation') || lowerMessage.includes('required')) {
      return ERROR_CATEGORIES.VALIDATION
    }
    
    return ERROR_CATEGORIES.SYSTEM
  }

  /**
   * Determine error severity
   */
  determineSeverity(category, code, context) {
    // Critical errors
    if (code === 500 || code === 'INTERNAL_ERROR') {
      return ERROR_SEVERITY.CRITICAL
    }
    
    // High severity
    if (category === ERROR_CATEGORIES.AUTHENTICATION || category === ERROR_CATEGORIES.PERMISSION) {
      return ERROR_SEVERITY.HIGH
    }
    
    // Medium severity
    if (category === ERROR_CATEGORIES.ORGANIZATION || category === ERROR_CATEGORIES.MEMBERSHIP) {
      return ERROR_SEVERITY.MEDIUM
    }
    
    // Low severity
    if (category === ERROR_CATEGORIES.VALIDATION || category === ERROR_CATEGORIES.RATE_LIMIT) {
      return ERROR_SEVERITY.LOW
    }
    
    return ERROR_SEVERITY.MEDIUM
  }

  /**
   * Extract key information from error message
   */
  extractKeyInformation(message, context) {
    const info = {}
    
    // Extract organization ID if present
    const orgIdMatch = message.match(/organization[^a-zA-Z]*([a-f0-9-]{36})/i)
    if (orgIdMatch) {
      info.organizationId = orgIdMatch[1]
    }
    
    // Extract user ID if present
    const userIdMatch = message.match(/user[^a-zA-Z]*([a-f0-9-]{36})/i)
    if (userIdMatch) {
      info.userId = userIdMatch[1]
    }
    
    // Extract port number if present
    const portMatch = message.match(/port[^a-zA-Z]*(\d+)/i)
    if (portMatch) {
      info.port = parseInt(portMatch[1])
    }
    
    // Extract role if present
    const roleMatch = message.match(/role[^a-zA-Z]*(owner|admin|member|viewer)/i)
    if (roleMatch) {
      info.role = roleMatch[1]
    }
    
    return info
  }

  /**
   * Generate actionable steps for resolution
   */
  generateActionableSteps(strategy, errorInfo, context) {
    const steps = []
    
    // Add context-specific steps
    if (strategy.steps) {
      steps.push(...strategy.steps.map(step => this.personalizeStep(step, errorInfo, context)))
    }
    
    // Add category-specific steps
    const categorySteps = this.getCategorySpecificSteps(errorInfo.category, errorInfo, context)
    steps.push(...categorySteps)
    
    return steps
  }

  /**
   * Personalize step with actual values
   */
  personalizeStep(step, errorInfo, context) {
    let personalizedStep = step
    
    // Replace placeholders with actual values
    if (errorInfo.keyInfo.organizationId) {
      personalizedStep = personalizedStep.replace('{orgId}', errorInfo.keyInfo.organizationId)
    }
    
    if (errorInfo.keyInfo.userId) {
      personalizedStep = personalizedStep.replace('{userId}', errorInfo.keyInfo.userId)
    }
    
    if (errorInfo.keyInfo.port) {
      personalizedStep = personalizedStep.replace('{port}', errorInfo.keyInfo.port)
    }
    
    if (errorInfo.keyInfo.role) {
      personalizedStep = personalizedStep.replace('{role}', errorInfo.keyInfo.role)
    }
    
    return personalizedStep
  }

  /**
   * Get category-specific steps
   */
  getCategorySpecificSteps(category, errorInfo, context) {
    const steps = []
    
    switch (category) {
      case ERROR_CATEGORIES.ORGANIZATION:
        steps.push('Verify the organization exists and you have access to it')
        steps.push('Check if the organization slug is correct')
        steps.push('Ensure you are a member of the organization')
        break
        
      case ERROR_CATEGORIES.MEMBERSHIP:
        steps.push('Check if the user is already a member')
        steps.push('Verify the invitation token is valid and not expired')
        steps.push('Ensure you have permission to invite members')
        break
        
      case ERROR_CATEGORIES.AUTHENTICATION:
        steps.push('Verify your access token is valid and not expired')
        steps.push('Try refreshing your session')
        steps.push('Check if your account is active')
        break
        
      case ERROR_CATEGORIES.PORT_CONFLICT:
        steps.push('Check what process is using the port: `lsof -i :{port}`')
        steps.push('Kill the conflicting process: `heimdall ports kill {port}`')
        steps.push('Use an alternative port: `heimdall ports suggest --port {port}`')
        break
        
      case ERROR_CATEGORIES.PERMISSION:
        steps.push('Verify you have the required role in the organization')
        steps.push('Check if the action requires admin or owner permissions')
        steps.push('Contact an organization admin for assistance')
        break
        
      case ERROR_CATEGORIES.RATE_LIMIT:
        steps.push('Wait for the rate limit window to reset')
        steps.push('Reduce the frequency of your requests')
        steps.push('Check if you need to upgrade your plan')
        break
        
      case ERROR_CATEGORIES.VALIDATION:
        steps.push('Check the request format and required fields')
        steps.push('Verify data types and constraints')
        steps.push('Review the API documentation for correct usage')
        break
    }
    
    return steps
  }

  /**
   * Generate generic resolution when no specific strategy exists
   */
  generateGenericResolution(errorInfo, context) {
    return {
      strategy: 'General Troubleshooting',
      description: 'Follow these general steps to resolve the issue',
      actions: [
        'Check the error message for specific details',
        'Verify your request format and parameters',
        'Ensure you have the necessary permissions',
        'Try the operation again after a brief delay',
        'Contact support if the issue persists',
      ],
      prevention: [
        'Review API documentation before making requests',
        'Implement proper error handling in your application',
        'Use appropriate retry logic for transient errors',
      ],
      related: ['API Documentation', 'Support Center', 'Status Page'],
      estimatedTime: '10-15 minutes',
    }
  }

  /**
   * Sanitize context to remove sensitive information
   */
  sanitizeContext(context) {
    const sanitized = { ...context }
    
    // Remove sensitive fields
    delete sanitized.password
    delete sanitized.token
    delete sanitized.secret
    delete sanitized.key
    
    // Truncate long values
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'string' && sanitized[key].length > 100) {
        sanitized[key] = sanitized[key].substring(0, 100) + '...'
      }
    })
    
    return sanitized
  }

  /**
   * Initialize error patterns for matching
   */
  initializeErrorPatterns() {
    return {
      [ERROR_CATEGORIES.ORGANIZATION]: [
        /organization.*not found/i,
        /org.*does not exist/i,
        /invalid.*organization/i,
      ],
      [ERROR_CATEGORIES.MEMBERSHIP]: [
        /member.*already exists/i,
        /duplicate.*membership/i,
        /invitation.*expired/i,
      ],
      [ERROR_CATEGORIES.AUTHENTICATION]: [
        /invalid.*token/i,
        /token.*expired/i,
        /unauthorized/i,
        /authentication.*failed/i,
      ],
      [ERROR_CATEGORIES.PORT_CONFLICT]: [
        /port.*in use/i,
        /port.*conflict/i,
        /address.*already in use/i,
      ],
      [ERROR_CATEGORIES.PERMISSION]: [
        /permission.*denied/i,
        /insufficient.*permission/i,
        /access.*denied/i,
        /forbidden/i,
      ],
      [ERROR_CATEGORIES.RATE_LIMIT]: [
        /rate.*limit/i,
        /too many.*requests/i,
        /quota.*exceeded/i,
      ],
      [ERROR_CATEGORIES.VALIDATION]: [
        /invalid.*input/i,
        /validation.*failed/i,
        /required.*field/i,
        /bad.*request/i,
      ],
    }
  }

  /**
   * Initialize resolution strategies
   */
  initializeResolutionStrategies() {
    return {
      [ERROR_CATEGORIES.ORGANIZATION]: {
        'NOT_FOUND': {
          name: 'Organization Not Found',
          description: 'The requested organization does not exist or you do not have access to it',
          steps: [
            'Verify the organization ID: {orgId}',
            'Check if you are a member of this organization',
            'Ensure the organization slug is correct',
            'Contact the organization owner for access',
          ],
          prevention: [
            'Always verify organization IDs before making requests',
            'Implement proper error handling for missing organizations',
          ],
          estimatedTime: '5 minutes',
        },
        'DUPLICATE_SLUG': {
          name: 'Organization Slug Conflict',
          description: 'An organization with this slug already exists',
          steps: [
            'Choose a different slug for your organization',
            'Use a more specific or unique identifier',
            'Check existing organizations for similar names',
          ],
          prevention: [
            'Use descriptive and unique slugs',
            'Check slug availability before creating',
          ],
          estimatedTime: '2 minutes',
        },
      },
      [ERROR_CATEGORIES.MEMBERSHIP]: {
        'ALREADY_MEMBER': {
          name: 'User Already Member',
          description: 'The user is already a member of this organization',
          steps: [
            'Check the current membership status',
            'Update the existing membership if needed',
            'Remove and re-invite if necessary',
          ],
          prevention: [
            'Check membership status before inviting',
            'Implement proper duplicate handling',
          ],
          estimatedTime: '3 minutes',
        },
        'INVALID_INVITATION': {
          name: 'Invalid Invitation',
          description: 'The invitation token is invalid or expired',
          steps: [
            'Generate a new invitation',
            'Check if the token has expired',
            'Verify the invitation was sent to the correct email',
          ],
          prevention: [
            'Set appropriate expiration times for invitations',
            'Implement token validation',
          ],
          estimatedTime: '2 minutes',
        },
      },
      [ERROR_CATEGORIES.AUTHENTICATION]: {
        'INVALID_TOKEN': {
          name: 'Invalid Authentication Token',
          description: 'The provided token is invalid or malformed',
          steps: [
            'Verify the token format and content',
            'Check if the token has been tampered with',
            'Generate a new token if necessary',
          ],
          prevention: [
            'Implement proper token validation',
            'Use secure token storage',
          ],
          estimatedTime: '5 minutes',
        },
        'TOKEN_EXPIRED': {
          name: 'Token Expired',
          description: 'The authentication token has expired',
          steps: [
            'Refresh your authentication token',
            'Log in again to get a new token',
            'Check token expiration settings',
          ],
          prevention: [
            'Implement automatic token refresh',
            'Set appropriate token lifetimes',
          ],
          estimatedTime: '2 minutes',
        },
      },
      [ERROR_CATEGORIES.PORT_CONFLICT]: {
        'PORT_IN_USE': {
          name: 'Port Already in Use',
          description: 'The requested port is already being used by another process',
          steps: [
            'Identify the process using the port: `lsof -i :{port}`',
            'Kill the conflicting process: `heimdall ports kill {port}`',
            'Use an alternative port: `heimdall ports suggest --port {port}`',
            'Check if the port is reserved by the system',
          ],
          prevention: [
            'Use port management tools to check availability',
            'Implement port conflict detection',
            'Use environment-specific port ranges',
          ],
          estimatedTime: '5 minutes',
        },
      },
      [ERROR_CATEGORIES.PERMISSION]: {
        'INSUFFICIENT_PERMISSIONS': {
          name: 'Insufficient Permissions',
          description: 'You do not have the required permissions for this action',
          steps: [
            'Verify your role in the organization',
            'Check if the action requires admin or owner permissions',
            'Contact an organization admin for assistance',
            'Request permission elevation if appropriate',
          ],
          prevention: [
            'Implement proper permission checking',
            'Provide clear role requirements in documentation',
            'Use middleware to validate permissions',
          ],
          estimatedTime: '10 minutes',
        },
      },
      [ERROR_CATEGORIES.RATE_LIMIT]: {
        'RATE_LIMIT_EXCEEDED': {
          name: 'Rate Limit Exceeded',
          description: 'You have exceeded the allowed number of requests',
          steps: [
            'Wait for the rate limit window to reset',
            'Reduce the frequency of your requests',
            'Implement exponential backoff in your client',
            'Consider upgrading your plan for higher limits',
          ],
          prevention: [
            'Implement proper rate limiting in your client',
            'Use caching to reduce API calls',
            'Monitor your usage patterns',
          ],
          estimatedTime: '5-15 minutes',
        },
      },
      [ERROR_CATEGORIES.VALIDATION]: {
        'INVALID_INPUT': {
          name: 'Invalid Input Data',
          description: 'The provided input data is invalid or malformed',
          steps: [
            'Check the request format and required fields',
            'Verify data types and constraints',
            'Review the API documentation for correct usage',
            'Validate input data before sending requests',
          ],
          prevention: [
            'Implement client-side validation',
            'Use proper data types and formats',
            'Follow API documentation guidelines',
          ],
          estimatedTime: '5 minutes',
        },
      },
    }
  }
}

/**
 * Create error response with enhanced messaging
 */
export function createErrorResponse(error, context = {}) {
  const errorService = new ErrorMessagingService()
  const enhancedError = errorService.generateEnhancedError(error, context)
  
  return {
    success: false,
    error: {
      message: enhancedError.error.originalMessage,
      code: enhancedError.error.code,
      category: enhancedError.error.category,
      severity: enhancedError.error.severity,
    },
    resolution: enhancedError.resolution,
    timestamp: enhancedError.timestamp,
    requestId: enhancedError.requestId,
  }
}

/**
 * Middleware for enhanced error handling
 */
export function enhancedErrorMiddleware() {
  return (error, request, reply) => {
    const context = {
      requestId: request.id,
      method: request.method,
      url: request.url,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
      userId: request.user?.id,
      organizationId: request.organization?.id,
    }
    
    const errorResponse = createErrorResponse(error, context)
    
    // Log the enhanced error for monitoring
    request.log.error({
      error: errorResponse.error,
      resolution: errorResponse.resolution,
      context,
    }, 'Enhanced error response generated')
    
    // Send appropriate HTTP status code
    const statusCode = error.statusCode || 500
    reply.code(statusCode).send(errorResponse)
  }
}

export default {
  ErrorMessagingService,
  createErrorResponse,
  enhancedErrorMiddleware,
  ERROR_CATEGORIES,
  ERROR_SEVERITY,
}
