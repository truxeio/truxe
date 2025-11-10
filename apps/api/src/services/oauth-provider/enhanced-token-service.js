/**
 * Enhanced OAuth Token Service with Security Features
 * 
 * Wraps the base token service with:
 * - Rate limiting for brute force protection
 * - Comprehensive metrics collection
 * - Audit logging for security trail
 * - Performance tracking
 * - Anomaly detection
 */

import tokenService from './token-service.js';
import rateLimitService from '../rate-limit.js';
import auditLogger from '../audit-logger.js';
import tokenMetrics from './token-metrics.js';

class EnhancedTokenService {
  
  // ============================================================================
  // TOKEN GENERATION with Rate Limiting, Metrics & Audit
  // ============================================================================
  
  /**
   * Generate token pair with full security features
   */
  async generateTokenPair({ clientId, userId, scope, userInfo, ip, userAgent, requestId }) {
    const startTime = Date.now();
    
    try {
      // 1. Check rate limits
      const rateLimitResult = await rateLimitService.checkEndpointLimits(
        'POST:/oauth/token',
        {
          ip,
          user: userId,
        }
      );
      
      if (!rateLimitResult.allowed) {
        // Track failed attempt
        await tokenMetrics.trackFailedAuth({
          clientId,
          reason: 'rate_limit_exceeded',
          ip,
        });
        
        // Audit log
        await auditLogger.logSecurityEvent({
          action: 'token.generation.rate_limited',
          actorUserId: userId,
          details: {
            clientId,
            scope,
            rateLimitType: rateLimitResult.violated,
            retryAfter: rateLimitResult.mostRestrictive?.retryAfter,
          },
          severity: 'warning',
          ip,
          userAgent,
          requestId,
        });
        
        const error = new Error('Rate limit exceeded');
        error.code = 'RATE_LIMIT_EXCEEDED';
        error.retryAfter = rateLimitResult.mostRestrictive?.retryAfter;
        throw error;
      }
      
      // 2. Generate token pair
      const tokens = await tokenService.generateTokenPair({
        clientId,
        userId,
        scope,
        userInfo,
      });
      
      // 3. Track metrics
      const duration = Date.now() - startTime;
      await Promise.all([
        tokenMetrics.trackTokenGeneration({
          clientId,
          userId,
          scope,
          success: true,
        }),
        tokenMetrics.trackDuration('token_generation', duration, { client_id: clientId }),
      ]);
      
      // 4. Audit log
      await auditLogger.logSecurityEvent({
        action: 'token.generated',
        actorUserId: userId,
        targetType: 'oauth_token',
        details: {
          clientId,
          scope,
          tokenType: 'bearer',
          expiresIn: tokens.expires_in,
        },
        severity: 'info',
        ip,
        userAgent,
        requestId,
      });
      
      return tokens;
      
    } catch (error) {
      // Track error metrics
      await tokenMetrics.trackTokenGeneration({
        clientId,
        userId,
        scope,
        success: false,
        errorType: error.code || error.message,
      });
      
      // Audit log failure (if not rate limit - already logged)
      if (error.code !== 'RATE_LIMIT_EXCEEDED') {
        await auditLogger.logSecurityEvent({
          action: 'token.generation.failed',
          actorUserId: userId,
          details: {
            clientId,
            scope,
            error: error.message,
            errorCode: error.code,
          },
          severity: 'error',
          ip,
          userAgent,
          requestId,
        });
      }
      
      throw error;
    }
  }
  
  // ============================================================================
  // TOKEN REFRESH with Rate Limiting, Metrics & Audit
  // ============================================================================
  
  /**
   * Refresh token with full security features
   */
  async refreshToken({ refreshToken, clientId, scope, ip, userAgent, requestId }) {
    const startTime = Date.now();
    
    try {
      // 1. Check rate limits (stricter for refresh endpoint)
      const rateLimitResult = await rateLimitService.checkEndpointLimits(
        'POST:/oauth/token/refresh',
        {
          ip,
          client: clientId,
        }
      );
      
      if (!rateLimitResult.allowed) {
        // Track failed attempt
        await tokenMetrics.trackFailedAuth({
          clientId,
          reason: 'refresh_rate_limit_exceeded',
          ip,
        });
        
        // Audit log
        await auditLogger.logSecurityEvent({
          action: 'token.refresh.rate_limited',
          details: {
            clientId,
            rateLimitType: rateLimitResult.violated,
            retryAfter: rateLimitResult.mostRestrictive?.retryAfter,
          },
          severity: 'warning',
          ip,
          userAgent,
          requestId,
        });
        
        const error = new Error('Rate limit exceeded');
        error.code = 'RATE_LIMIT_EXCEEDED';
        error.retryAfter = rateLimitResult.mostRestrictive?.retryAfter;
        throw error;
      }
      
      // 2. Refresh token
      const tokens = await tokenService.refreshToken({
        refreshToken,
        clientId,
        scope,
      });
      
      // 3. Track metrics
      const duration = Date.now() - startTime;
      await Promise.all([
        tokenMetrics.trackTokenRefresh({
          clientId,
          userId: null, // We don't have userId at this point
          success: true,
        }),
        tokenMetrics.trackDuration('token_refresh', duration, { client_id: clientId }),
      ]);
      
      // 4. Audit log
      await auditLogger.logSecurityEvent({
        action: 'token.refreshed',
        details: {
          clientId,
          scope: tokens.scope,
          oldTokenRevoked: true,
        },
        severity: 'info',
        ip,
        userAgent,
        requestId,
      });
      
      return tokens;
      
    } catch (error) {
      // Track error metrics
      await tokenMetrics.trackTokenRefresh({
        clientId,
        userId: null,
        success: false,
        errorType: error.code || error.message,
      });
      
      // Audit log failure
      if (error.code !== 'RATE_LIMIT_EXCEEDED') {
        await auditLogger.logSecurityEvent({
          action: 'token.refresh.failed',
          details: {
            clientId,
            error: error.message,
            errorCode: error.code,
          },
          severity: 'warning',
          ip,
          userAgent,
          requestId,
        });
      }
      
      throw error;
    }
  }
  
  // ============================================================================
  // TOKEN INTROSPECTION with Rate Limiting, Metrics & Audit
  // ============================================================================
  
  /**
   * Introspect token with full security features
   */
  async introspectToken({ token, clientId, tokenTypeHint, ip, userAgent, requestId }) {
    const startTime = Date.now();
    
    try {
      // 1. Check rate limits (lighter for introspection)
      const rateLimitResult = await rateLimitService.checkEndpointLimits(
        'POST:/oauth/introspect',
        {
          ip,
          client: clientId,
        }
      );
      
      if (!rateLimitResult.allowed) {
        // Track failed attempt
        await tokenMetrics.trackFailedAuth({
          clientId,
          reason: 'introspect_rate_limit_exceeded',
          ip,
        });
        
        const error = new Error('Rate limit exceeded');
        error.code = 'RATE_LIMIT_EXCEEDED';
        error.retryAfter = rateLimitResult.mostRestrictive?.retryAfter;
        throw error;
      }
      
      // 2. Introspect token
      const result = await tokenService.introspectToken({
        token,
        clientId,
        tokenTypeHint,
      });
      
      // 3. Track metrics
      const duration = Date.now() - startTime;
      await Promise.all([
        tokenMetrics.trackTokenIntrospection({
          clientId,
          active: result.active,
          tokenType: tokenTypeHint || 'access_token',
        }),
        tokenMetrics.trackDuration('token_introspection', duration, { client_id: clientId }),
      ]);
      
      // 4. Audit log (only if token is active for privacy)
      if (result.active) {
        await auditLogger.logSecurityEvent({
          action: 'token.introspected',
          actorUserId: result.sub,
          details: {
            clientId,
            tokenType: tokenTypeHint,
            active: result.active,
            scope: result.scope,
          },
          severity: 'info',
          ip,
          userAgent,
          requestId,
        });
      }
      
      return result;
      
    } catch (error) {
      // Audit log failure
      if (error.code !== 'RATE_LIMIT_EXCEEDED') {
        await auditLogger.logSecurityEvent({
          action: 'token.introspection.failed',
          details: {
            clientId,
            error: error.message,
            errorCode: error.code,
          },
          severity: 'warning',
          ip,
          userAgent,
          requestId,
        });
      }
      
      throw error;
    }
  }
  
  // ============================================================================
  // TOKEN REVOCATION with Metrics & Audit
  // ============================================================================
  
  /**
   * Revoke token with full security features
   */
  async revokeToken({ token, clientId, tokenTypeHint, userId, ip, userAgent, requestId }) {
    const startTime = Date.now();
    
    try {
      // 1. Check rate limits
      const rateLimitResult = await rateLimitService.checkEndpointLimits(
        'POST:/oauth/revoke',
        {
          ip,
          user: userId,
          client: clientId,
        }
      );
      
      if (!rateLimitResult.allowed) {
        const error = new Error('Rate limit exceeded');
        error.code = 'RATE_LIMIT_EXCEEDED';
        error.retryAfter = rateLimitResult.mostRestrictive?.retryAfter;
        throw error;
      }
      
      // 2. Revoke token
      await tokenService.revokeToken({
        token,
        clientId,
        tokenTypeHint,
      });
      
      // 3. Track metrics
      const duration = Date.now() - startTime;
      await Promise.all([
        tokenMetrics.trackTokenRevocation({
          clientId,
          tokenType: tokenTypeHint || 'access_token',
          success: true,
        }),
        tokenMetrics.trackDuration('token_revocation', duration, { client_id: clientId }),
      ]);
      
      // 4. Audit log - IMPORTANT for security
      await auditLogger.logSecurityEvent({
        action: 'token.revoked',
        actorUserId: userId,
        details: {
          clientId,
          tokenType: tokenTypeHint,
          revokedAt: new Date().toISOString(),
        },
        severity: 'info',
        ip,
        userAgent,
        requestId,
      });
      
      return { revoked: true };
      
    } catch (error) {
      // Track error metrics
      await tokenMetrics.trackTokenRevocation({
        clientId,
        tokenType: tokenTypeHint || 'access_token',
        success: false,
      });
      
      // Audit log failure
      if (error.code !== 'RATE_LIMIT_EXCEEDED') {
        await auditLogger.logSecurityEvent({
          action: 'token.revocation.failed',
          actorUserId: userId,
          details: {
            clientId,
            error: error.message,
            errorCode: error.code,
          },
          severity: 'warning',
          ip,
          userAgent,
          requestId,
        });
      }
      
      throw error;
    }
  }
  
  // ============================================================================
  // DELEGATE METHODS (pass-through to base service)
  // ============================================================================
  
  /**
   * Validate token (no rate limiting needed for internal use)
   */
  async validateToken(token) {
    return await tokenService.validateToken(token);
  }
  
  /**
   * Get user info by token
   */
  async getUserInfoByToken(token) {
    return await tokenService.getUserInfoByToken(token);
  }
  
  /**
   * Get user info by user ID
   */
  async getUserInfo(userId) {
    return await tokenService.getUserInfo(userId);
  }
  
  /**
   * Delete expired tokens
   */
  async deleteExpiredTokens() {
    const count = await tokenService.deleteExpiredTokens();
    
    // Audit log cleanup
    await auditLogger.logSystemEvent({
      action: 'tokens.expired_deleted',
      details: {
        count,
        timestamp: new Date().toISOString(),
      },
    });
    
    return count;
  }
  
  /**
   * Delete old revoked tokens
   */
  async deleteOldRevokedTokens() {
    const count = await tokenService.deleteOldRevokedTokens();
    
    // Audit log cleanup
    await auditLogger.logSystemEvent({
      action: 'tokens.revoked_deleted',
      details: {
        count,
        timestamp: new Date().toISOString(),
      },
    });
    
    return count;
  }
  
  // ============================================================================
  // SECURITY & MONITORING
  // ============================================================================
  
  /**
   * Get comprehensive security metrics
   */
  async getSecurityMetrics(timeframe = '1h') {
    const [metricsReport, anomalies] = await Promise.all([
      tokenMetrics.getMetricsReport(timeframe),
      tokenMetrics.detectAnomalies(),
    ]);
    
    return {
      ...metricsReport,
      security: {
        anomaliesDetected: anomalies.length,
        anomalies: anomalies.map(a => ({
          type: a.type,
          severity: a.severity,
          timestamp: new Date(a.timestamp).toISOString(),
        })),
      },
    };
  }
  
  /**
   * Get client-specific metrics
   */
  async getClientMetrics(clientId, timeframe = '1h') {
    return await tokenMetrics.getClientMetrics(clientId, timeframe);
  }
  
  /**
   * Get scope usage statistics
   */
  async getScopeStatistics() {
    return await tokenMetrics.getScopeStatistics();
  }
  
  /**
   * Check service health
   */
  async getHealthStatus() {
    const [baseHealth, metricsHealth, auditHealth] = await Promise.all([
      tokenService.getHealthStatus?.() || { status: 'unknown' },
      tokenMetrics.getHealthStatus(),
      auditLogger.getHealthStatus(),
    ]);
    
    const overallStatus = [baseHealth.status, metricsHealth.status, auditHealth.status]
      .includes('unhealthy') ? 'unhealthy' : 'healthy';
    
    return {
      status: overallStatus,
      components: {
        tokenService: baseHealth,
        metrics: metricsHealth,
        auditLog: auditHealth,
      },
    };
  }
}

// Create singleton instance
const enhancedTokenService = new EnhancedTokenService();

export default enhancedTokenService;
