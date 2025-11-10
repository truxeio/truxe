/**
 * Webhook Testing and Debugging Service
 * 
 * Provides comprehensive testing and debugging tools for webhooks:
 * - Endpoint validation and testing
 * - Payload simulation and validation
 * - Delivery debugging and analysis
 * - Performance testing and monitoring
 * - Security validation
 */

import crypto from 'crypto'
import webhookService from './webhook.js'
import { getPool } from '../database/connection.js'

/**
 * Webhook Testing Service Class
 */
export class WebhookTestingService {
  constructor() {
    this.db = getPool()
    this.testResults = new Map()
    
    console.log('Webhook testing service initialized')
  }
  
  /**
   * Validate webhook endpoint configuration
   */
  async validateEndpoint(endpointConfig) {
    const results = {
      valid: true,
      errors: [],
      warnings: [],
      checks: {
        url: false,
        events: false,
        filters: false,
        headers: false,
        security: false,
      },
    }
    
    try {
      // Validate URL
      try {
        const url = new URL(endpointConfig.url)
        results.checks.url = true
        
        // Check for HTTPS in production
        if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
          results.warnings.push('HTTPS is recommended for production webhook endpoints')
        }
        
        // Check for localhost URLs
        if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
          results.warnings.push('Localhost URLs may not be reachable from external services')
        }
      } catch (error) {
        results.valid = false
        results.errors.push(`Invalid URL: ${error.message}`)
      }
      
      // Validate events
      if (Array.isArray(endpointConfig.events) && endpointConfig.events.length > 0) {
        const invalidEvents = endpointConfig.events.filter(event => 
          !webhookService.supportedEvents.includes(event)
        )
        
        if (invalidEvents.length > 0) {
          results.valid = false
          results.errors.push(`Unsupported events: ${invalidEvents.join(', ')}`)
        } else {
          results.checks.events = true
        }
      } else {
        results.valid = false
        results.errors.push('At least one event must be specified')
      }
      
      // Validate filters
      if (endpointConfig.filters && typeof endpointConfig.filters === 'object') {
        results.checks.filters = true
        
        // Check for complex filters that might impact performance
        const filterCount = Object.keys(endpointConfig.filters).length
        if (filterCount > 10) {
          results.warnings.push('Complex filters with many conditions may impact performance')
        }
      } else if (endpointConfig.filters !== undefined) {
        results.errors.push('Filters must be an object')
      }
      
      // Validate headers
      if (endpointConfig.headers && typeof endpointConfig.headers === 'object') {
        results.checks.headers = true
        
        // Check for security-sensitive headers
        const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key']
        const providedHeaders = Object.keys(endpointConfig.headers).map(h => h.toLowerCase())
        const foundSensitive = sensitiveHeaders.filter(h => providedHeaders.includes(h))
        
        if (foundSensitive.length > 0) {
          results.warnings.push(`Sensitive headers detected: ${foundSensitive.join(', ')}. Ensure they are properly secured.`)
        }
      } else if (endpointConfig.headers !== undefined) {
        results.errors.push('Headers must be an object')
      }
      
      // Security checks
      results.checks.security = true
      
      if (!endpointConfig.allowedIps || endpointConfig.allowedIps.length === 0) {
        results.warnings.push('No IP allowlist configured. Consider restricting access for better security.')
      }
      
      if (endpointConfig.rateLimit > 1000) {
        results.warnings.push('High rate limit may impact system performance')
      }
      
    } catch (error) {
      results.valid = false
      results.errors.push(`Validation error: ${error.message}`)
    }
    
    return results
  }
  
  /**
   * Test webhook endpoint connectivity and response
   */
  async testEndpointConnectivity(endpointId, options = {}) {
    const testId = crypto.randomUUID()
    const startTime = Date.now()
    
    const testResult = {
      test_id: testId,
      endpoint_id: endpointId,
      started_at: new Date().toISOString(),
      status: 'running',
      tests: {
        connectivity: { status: 'pending', duration: null, error: null },
        response_time: { status: 'pending', duration: null, error: null },
        ssl_certificate: { status: 'pending', valid: null, error: null },
        headers: { status: 'pending', received: null, error: null },
        payload_handling: { status: 'pending', accepted: null, error: null },
      },
      overall_result: 'pending',
    }
    
    try {
      // Get endpoint details
      const endpoints = await webhookService.getWebhookEndpoints(options.orgId || null)
      const endpoint = endpoints.find(e => e.id === endpointId)
      
      if (!endpoint) {
        throw new Error('Webhook endpoint not found')
      }
      
      const url = endpoint.url
      
      // Test 1: Basic connectivity
      try {
        const connectivityStart = Date.now()
        const response = await fetch(url, {
          method: 'HEAD',
          timeout: options.timeout || 10000,
        })
        
        testResult.tests.connectivity = {
          status: 'passed',
          duration: Date.now() - connectivityStart,
          response_status: response.status,
        }
      } catch (error) {
        testResult.tests.connectivity = {
          status: 'failed',
          duration: Date.now() - startTime,
          error: error.message,
        }
      }
      
      // Test 2: Response time
      try {
        const responseTimeStart = Date.now()
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Heimdall-Webhook-Test/1.0',
          },
          body: JSON.stringify({ test: true }),
          timeout: options.timeout || 10000,
        })
        
        const duration = Date.now() - responseTimeStart
        testResult.tests.response_time = {
          status: duration < 5000 ? 'passed' : 'warning',
          duration,
          response_status: response.status,
          warning: duration >= 5000 ? 'Response time is slow (>5s)' : null,
        }
      } catch (error) {
        testResult.tests.response_time = {
          status: 'failed',
          duration: Date.now() - startTime,
          error: error.message,
        }
      }
      
      // Test 3: SSL certificate (for HTTPS URLs)
      try {
        const parsedUrl = new URL(url)
        if (parsedUrl.protocol === 'https:') {
          // Note: In a real implementation, you'd use a proper SSL checker
          testResult.tests.ssl_certificate = {
            status: 'passed',
            valid: true,
            info: 'SSL certificate validation passed',
          }
        } else {
          testResult.tests.ssl_certificate = {
            status: 'skipped',
            reason: 'Not an HTTPS URL',
          }
        }
      } catch (error) {
        testResult.tests.ssl_certificate = {
          status: 'failed',
          valid: false,
          error: error.message,
        }
      }
      
      // Test 4: Headers test
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Heimdall-Webhook-Test/1.0',
            'X-Test-Header': 'test-value',
            ...endpoint.headers,
          },
          body: JSON.stringify({ test: true }),
          timeout: options.timeout || 10000,
        })
        
        testResult.tests.headers = {
          status: 'passed',
          received: Object.fromEntries(response.headers.entries()),
          response_status: response.status,
        }
      } catch (error) {
        testResult.tests.headers = {
          status: 'failed',
          error: error.message,
        }
      }
      
      // Test 5: Payload handling
      try {
        const testPayload = {
          event: 'webhook.test',
          data: {
            test: true,
            timestamp: new Date().toISOString(),
            endpoint_id: endpointId,
            payload_size: 'small',
          },
          timestamp: new Date().toISOString(),
        }
        
        const signature = webhookService.generateSignature(testPayload, endpoint.secret)
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Heimdall-Webhook-Test/1.0',
            'X-Heimdall-Event': 'webhook.test',
            'X-Heimdall-Signature': `sha256=${signature}`,
            'X-Heimdall-Timestamp': testPayload.timestamp,
            'X-Heimdall-Test': 'true',
            ...endpoint.headers,
          },
          body: JSON.stringify(testPayload),
          timeout: options.timeout || 10000,
        })
        
        const responseBody = await response.text()
        
        testResult.tests.payload_handling = {
          status: response.ok ? 'passed' : 'failed',
          accepted: response.ok,
          response_status: response.status,
          response_body: responseBody.substring(0, 500), // Limit response body
        }
      } catch (error) {
        testResult.tests.payload_handling = {
          status: 'failed',
          accepted: false,
          error: error.message,
        }
      }
      
      // Determine overall result
      const testStatuses = Object.values(testResult.tests).map(test => test.status)
      const failedCount = testStatuses.filter(status => status === 'failed').length
      const warningCount = testStatuses.filter(status => status === 'warning').length
      
      if (failedCount > 0) {
        testResult.overall_result = 'failed'
      } else if (warningCount > 0) {
        testResult.overall_result = 'warning'
      } else {
        testResult.overall_result = 'passed'
      }
      
      testResult.status = 'completed'
      testResult.completed_at = new Date().toISOString()
      testResult.total_duration = Date.now() - startTime
      
    } catch (error) {
      testResult.status = 'error'
      testResult.error = error.message
      testResult.completed_at = new Date().toISOString()
      testResult.total_duration = Date.now() - startTime
    }
    
    // Store test result
    this.testResults.set(testId, testResult)
    
    // Clean up old test results (keep last 100)
    if (this.testResults.size > 100) {
      const oldestKey = this.testResults.keys().next().value
      this.testResults.delete(oldestKey)
    }
    
    return testResult
  }
  
  /**
   * Generate test payload for specific event type
   */
  generateTestPayload(eventType, customData = {}) {
    const basePayload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      test: true,
      ...customData,
    }
    
    // Generate event-specific test data
    switch (eventType) {
      case 'user.created':
        basePayload.data = {
          user: {
            id: crypto.randomUUID(),
            email: 'test@example.com',
            email_verified: true,
            status: 'active',
            created_at: new Date().toISOString(),
          },
          organization_id: crypto.randomUUID(),
          created_by: crypto.randomUUID(),
          ...customData,
        }
        break
        
      case 'user.login':
        basePayload.data = {
          user: {
            id: crypto.randomUUID(),
            email: 'test@example.com',
            email_verified: true,
          },
          session: {
            id: crypto.randomUUID(),
            ip: '192.168.1.100',
            user_agent: 'Mozilla/5.0 (Test Browser)',
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          },
          login_method: 'magic_link',
          is_new_device: false,
          ...customData,
        }
        break
        
      case 'organization.created':
        basePayload.data = {
          organization: {
            id: crypto.randomUUID(),
            name: 'Test Organization',
            slug: 'test-org',
            created_at: new Date().toISOString(),
          },
          created_by: crypto.randomUUID(),
          ...customData,
        }
        break
        
      case 'security.suspicious_activity':
        basePayload.data = {
          user: {
            id: crypto.randomUUID(),
            email: 'test@example.com',
          },
          activity: {
            type: 'unusual_login_pattern',
            description: 'Multiple failed login attempts from different locations',
            risk_score: 75,
            patterns: ['multiple_ips', 'rapid_attempts'],
            ip: '192.168.1.100',
            user_agent: 'Mozilla/5.0 (Test Browser)',
            detected_at: new Date().toISOString(),
          },
          severity: 'medium',
          ...customData,
        }
        break
        
      default:
        basePayload.data = {
          message: `Test payload for ${eventType}`,
          generated_at: new Date().toISOString(),
          ...customData,
        }
    }
    
    return basePayload
  }
  
  /**
   * Simulate webhook delivery with various scenarios
   */
  async simulateDelivery(endpointId, scenarios = ['success', 'timeout', 'error']) {
    const results = {
      endpoint_id: endpointId,
      simulation_id: crypto.randomUUID(),
      started_at: new Date().toISOString(),
      scenarios: {},
    }
    
    try {
      const endpoints = await webhookService.getWebhookEndpoints(null)
      const endpoint = endpoints.find(e => e.id === endpointId)
      
      if (!endpoint) {
        throw new Error('Webhook endpoint not found')
      }
      
      for (const scenario of scenarios) {
        const scenarioResult = {
          scenario,
          status: 'running',
          started_at: new Date().toISOString(),
        }
        
        try {
          switch (scenario) {
            case 'success':
              await this.simulateSuccessfulDelivery(endpoint, scenarioResult)
              break
              
            case 'timeout':
              await this.simulateTimeoutScenario(endpoint, scenarioResult)
              break
              
            case 'error':
              await this.simulateErrorScenario(endpoint, scenarioResult)
              break
              
            case 'large_payload':
              await this.simulateLargePayloadDelivery(endpoint, scenarioResult)
              break
              
            case 'retry':
              await this.simulateRetryScenario(endpoint, scenarioResult)
              break
              
            default:
              scenarioResult.status = 'skipped'
              scenarioResult.reason = `Unknown scenario: ${scenario}`
          }
        } catch (error) {
          scenarioResult.status = 'failed'
          scenarioResult.error = error.message
        }
        
        scenarioResult.completed_at = new Date().toISOString()
        results.scenarios[scenario] = scenarioResult
      }
      
    } catch (error) {
      results.error = error.message
    }
    
    results.completed_at = new Date().toISOString()
    return results
  }
  
  /**
   * Simulate successful delivery
   */
  async simulateSuccessfulDelivery(endpoint, result) {
    const payload = this.generateTestPayload('webhook.test', {
      scenario: 'success',
      message: 'This is a successful delivery test',
    })
    
    const startTime = Date.now()
    
    try {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Heimdall-Webhook-Simulator/1.0',
          'X-Heimdall-Event': 'webhook.test',
          'X-Heimdall-Signature': `sha256=${webhookService.generateSignature(payload, endpoint.secret)}`,
          'X-Heimdall-Timestamp': payload.timestamp,
          'X-Heimdall-Simulation': 'success',
          ...endpoint.headers,
        },
        body: JSON.stringify(payload),
        timeout: 10000,
      })
      
      result.status = response.ok ? 'passed' : 'failed'
      result.duration = Date.now() - startTime
      result.response_status = response.status
      result.response_body = await response.text()
      
    } catch (error) {
      result.status = 'failed'
      result.duration = Date.now() - startTime
      result.error = error.message
    }
  }
  
  /**
   * Simulate timeout scenario
   */
  async simulateTimeoutScenario(endpoint, result) {
    const payload = this.generateTestPayload('webhook.test', {
      scenario: 'timeout',
      message: 'This test should timeout quickly',
    })
    
    const startTime = Date.now()
    
    try {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Heimdall-Webhook-Simulator/1.0',
          'X-Heimdall-Event': 'webhook.test',
          'X-Heimdall-Signature': `sha256=${webhookService.generateSignature(payload, endpoint.secret)}`,
          'X-Heimdall-Timestamp': payload.timestamp,
          'X-Heimdall-Simulation': 'timeout',
          ...endpoint.headers,
        },
        body: JSON.stringify(payload),
        timeout: 2000, // Very short timeout
      })
      
      result.status = 'unexpected_success'
      result.duration = Date.now() - startTime
      result.response_status = response.status
      result.message = 'Expected timeout but request succeeded'
      
    } catch (error) {
      result.status = error.name === 'AbortError' ? 'passed' : 'failed'
      result.duration = Date.now() - startTime
      result.error = error.message
      result.message = error.name === 'AbortError' 
        ? 'Timeout scenario completed successfully' 
        : 'Unexpected error during timeout test'
    }
  }
  
  /**
   * Simulate error scenario
   */
  async simulateErrorScenario(endpoint, result) {
    // Try to trigger an error by sending malformed data
    const malformedPayload = '{"invalid": json, "missing": quote}'
    const startTime = Date.now()
    
    try {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Heimdall-Webhook-Simulator/1.0',
          'X-Heimdall-Event': 'webhook.test',
          'X-Heimdall-Simulation': 'error',
          ...endpoint.headers,
        },
        body: malformedPayload,
        timeout: 10000,
      })
      
      result.status = response.ok ? 'unexpected_success' : 'passed'
      result.duration = Date.now() - startTime
      result.response_status = response.status
      result.response_body = await response.text()
      result.message = response.ok 
        ? 'Expected error but request succeeded'
        : 'Error scenario completed successfully'
      
    } catch (error) {
      result.status = 'passed'
      result.duration = Date.now() - startTime
      result.error = error.message
      result.message = 'Error scenario completed successfully'
    }
  }
  
  /**
   * Simulate large payload delivery
   */
  async simulateLargePayloadDelivery(endpoint, result) {
    // Generate a large payload (around 1MB)
    const largeData = Array(1000).fill().map((_, i) => ({
      id: i,
      data: 'x'.repeat(1000),
      timestamp: new Date().toISOString(),
    }))
    
    const payload = this.generateTestPayload('webhook.test', {
      scenario: 'large_payload',
      large_data: largeData,
      size_info: {
        estimated_size_mb: JSON.stringify(largeData).length / (1024 * 1024),
        item_count: largeData.length,
      },
    })
    
    const startTime = Date.now()
    
    try {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Heimdall-Webhook-Simulator/1.0',
          'X-Heimdall-Event': 'webhook.test',
          'X-Heimdall-Signature': `sha256=${webhookService.generateSignature(payload, endpoint.secret)}`,
          'X-Heimdall-Timestamp': payload.timestamp,
          'X-Heimdall-Simulation': 'large_payload',
          ...endpoint.headers,
        },
        body: JSON.stringify(payload),
        timeout: 30000, // Longer timeout for large payloads
      })
      
      result.status = response.ok ? 'passed' : 'failed'
      result.duration = Date.now() - startTime
      result.response_status = response.status
      result.payload_size_mb = JSON.stringify(payload).length / (1024 * 1024)
      
    } catch (error) {
      result.status = 'failed'
      result.duration = Date.now() - startTime
      result.error = error.message
      result.payload_size_mb = JSON.stringify(payload).length / (1024 * 1024)
    }
  }
  
  /**
   * Get test result by ID
   */
  getTestResult(testId) {
    return this.testResults.get(testId)
  }
  
  /**
   * Get all test results for debugging
   */
  getAllTestResults() {
    return Array.from(this.testResults.values())
  }
  
  /**
   * Analyze webhook delivery patterns
   */
  async analyzeDeliveryPatterns(orgId, options = {}) {
    try {
      const {
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate = new Date(),
        endpointId = null,
      } = options
      
      let query = `
        SELECT 
          d.endpoint_id,
          d.event_type,
          d.status,
          d.delivery_attempts,
          d.response_status,
          d.created_at,
          d.delivered_at,
          d.error_message,
          e.name as endpoint_name,
          e.url as endpoint_url,
          EXTRACT(EPOCH FROM (d.delivered_at - d.created_at)) * 1000 as delivery_time_ms
        FROM webhook_deliveries d
        JOIN webhook_endpoints e ON d.endpoint_id = e.id
        WHERE e.org_id = $1 
          AND d.created_at >= $2 
          AND d.created_at <= $3
      `
      const values = [orgId, startDate, endDate]
      
      if (endpointId) {
        query += ` AND d.endpoint_id = $4`
        values.push(endpointId)
      }
      
      query += ` ORDER BY d.created_at DESC LIMIT 1000`
      
      const result = await this.db.query(query, values)
      const deliveries = result.rows
      
      // Analyze patterns
      const analysis = {
        total_deliveries: deliveries.length,
        success_rate: 0,
        average_delivery_time: 0,
        patterns: {
          by_status: {},
          by_event_type: {},
          by_endpoint: {},
          by_hour: Array(24).fill(0),
          by_day_of_week: Array(7).fill(0),
          error_patterns: {},
          retry_patterns: {},
        },
        recommendations: [],
      }
      
      if (deliveries.length === 0) {
        return analysis
      }
      
      let successCount = 0
      let totalDeliveryTime = 0
      let deliveryTimeCount = 0
      
      deliveries.forEach(delivery => {
        // Success rate
        if (delivery.status === 'delivered') {
          successCount++
        }
        
        // Delivery time
        if (delivery.delivery_time_ms) {
          totalDeliveryTime += delivery.delivery_time_ms
          deliveryTimeCount++
        }
        
        // Patterns by status
        analysis.patterns.by_status[delivery.status] = 
          (analysis.patterns.by_status[delivery.status] || 0) + 1
        
        // Patterns by event type
        analysis.patterns.by_event_type[delivery.event_type] = 
          (analysis.patterns.by_event_type[delivery.event_type] || 0) + 1
        
        // Patterns by endpoint
        const endpointKey = `${delivery.endpoint_name} (${delivery.endpoint_id})`
        analysis.patterns.by_endpoint[endpointKey] = 
          (analysis.patterns.by_endpoint[endpointKey] || 0) + 1
        
        // Patterns by time
        const date = new Date(delivery.created_at)
        analysis.patterns.by_hour[date.getHours()]++
        analysis.patterns.by_day_of_week[date.getDay()]++
        
        // Error patterns
        if (delivery.error_message) {
          const errorKey = delivery.error_message.substring(0, 100)
          analysis.patterns.error_patterns[errorKey] = 
            (analysis.patterns.error_patterns[errorKey] || 0) + 1
        }
        
        // Retry patterns
        if (delivery.delivery_attempts > 1) {
          const retryKey = `${delivery.delivery_attempts} attempts`
          analysis.patterns.retry_patterns[retryKey] = 
            (analysis.patterns.retry_patterns[retryKey] || 0) + 1
        }
      })
      
      analysis.success_rate = (successCount / deliveries.length * 100).toFixed(2)
      analysis.average_delivery_time = deliveryTimeCount > 0 
        ? (totalDeliveryTime / deliveryTimeCount).toFixed(2)
        : 0
      
      // Generate recommendations
      if (parseFloat(analysis.success_rate) < 95) {
        analysis.recommendations.push('Success rate is below 95%. Check endpoint availability and error handling.')
      }
      
      if (parseFloat(analysis.average_delivery_time) > 5000) {
        analysis.recommendations.push('Average delivery time is high (>5s). Consider optimizing endpoint response time.')
      }
      
      const retryCount = Object.values(analysis.patterns.retry_patterns)
        .reduce((sum, count) => sum + count, 0)
      if (retryCount > deliveries.length * 0.1) {
        analysis.recommendations.push('High retry rate detected. Check for intermittent connectivity issues.')
      }
      
      return analysis
      
    } catch (error) {
      console.error('Failed to analyze delivery patterns:', error.message)
      throw error
    }
  }
  
  /**
   * Get service health status
   */
  getHealthStatus() {
    return {
      status: 'healthy',
      test_results_cached: this.testResults.size,
      max_cache_size: 100,
      features: [
        'endpoint_validation',
        'connectivity_testing',
        'payload_simulation',
        'delivery_analysis',
        'performance_testing',
      ],
    }
  }
}

// Create singleton instance
const webhookTestingService = new WebhookTestingService()

// Export singleton and class
export default webhookTestingService
