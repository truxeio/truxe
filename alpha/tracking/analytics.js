// Heimdall Alpha User Analytics and Tracking
// Privacy-focused analytics for alpha program insights

const { EventEmitter } = require('events');
const crypto = require('crypto');

class AlphaAnalytics extends EventEmitter {
  constructor(options = {}) {
    super();
    this.config = {
      enabled: process.env.NODE_ENV === 'production',
      anonymize: true,
      batchSize: 50,
      flushInterval: 30000, // 30 seconds
      endpoints: {
        events: process.env.ANALYTICS_ENDPOINT || 'https://analytics.truxe.io/events',
        metrics: process.env.METRICS_ENDPOINT || 'https://metrics.truxe.io/alpha'
      },
      ...options
    };
    
    this.eventQueue = [];
    this.userSessions = new Map();
    this.startTime = Date.now();
    
    // Auto-flush events periodically
    if (this.config.enabled) {
      this.flushTimer = setInterval(() => this.flush(), this.config.flushInterval);
    }
  }

  // Track alpha user signup
  trackAlphaSignup(userData) {
    const event = {
      type: 'alpha_signup',
      timestamp: Date.now(),
      user_id: this.hashUserId(userData.email),
      properties: {
        source: userData.source || 'direct',
        company: userData.company,
        role: userData.role,
        use_case: userData.useCase,
        team_size: userData.teamSize,
        current_solution: userData.currentSolution,
        referrer: userData.referrer
      },
      metadata: {
        user_agent: userData.userAgent,
        ip_hash: this.hashIP(userData.ip),
        country: userData.country
      }
    };
    
    this.track(event);
    this.emit('alpha_signup', event);
  }

  // Track onboarding progress
  trackOnboardingStep(userId, step, data = {}) {
    const event = {
      type: 'onboarding_step',
      timestamp: Date.now(),
      user_id: this.hashUserId(userId),
      properties: {
        step: step,
        completed: data.completed || false,
        time_spent: data.timeSpent,
        errors: data.errors,
        help_used: data.helpUsed,
        ...data
      }
    };
    
    this.track(event);
    this.emit('onboarding_progress', event);
  }

  // Track feature usage
  trackFeatureUsage(userId, feature, action, metadata = {}) {
    const event = {
      type: 'feature_usage',
      timestamp: Date.now(),
      user_id: this.hashUserId(userId),
      properties: {
        feature: feature,
        action: action,
        success: metadata.success !== false,
        duration: metadata.duration,
        error: metadata.error,
        context: metadata.context
      }
    };
    
    this.track(event);
    this.emit('feature_usage', event);
  }

  // Track deployment attempts
  trackDeployment(userId, deploymentData) {
    const event = {
      type: 'deployment',
      timestamp: Date.now(),
      user_id: this.hashUserId(userId),
      properties: {
        method: deploymentData.method, // docker, kubernetes, dokploy
        success: deploymentData.success,
        duration: deploymentData.duration,
        environment: deploymentData.environment,
        errors: deploymentData.errors,
        config: {
          database: deploymentData.config?.database,
          redis: deploymentData.config?.redis,
          email_provider: deploymentData.config?.emailProvider
        }
      }
    };
    
    this.track(event);
    this.emit('deployment', event);
  }

  // Track feedback submission
  trackFeedback(userId, feedbackData) {
    const event = {
      type: 'feedback_submitted',
      timestamp: Date.now(),
      user_id: this.hashUserId(userId),
      properties: {
        survey_id: feedbackData.surveyId,
        week: feedbackData.week,
        nps_score: feedbackData.npsScore,
        satisfaction: feedbackData.satisfaction,
        completion_rate: feedbackData.completionRate,
        time_spent: feedbackData.timeSpent,
        categories: feedbackData.categories
      }
    };
    
    this.track(event);
    this.emit('feedback_submitted', event);
  }

  // Track API usage patterns
  trackAPIUsage(userId, apiData) {
    const event = {
      type: 'api_usage',
      timestamp: Date.now(),
      user_id: this.hashUserId(userId),
      properties: {
        endpoint: apiData.endpoint,
        method: apiData.method,
        status_code: apiData.statusCode,
        response_time: apiData.responseTime,
        user_agent: this.hashUserAgent(apiData.userAgent),
        daily_requests: apiData.dailyRequests,
        unique_endpoints: apiData.uniqueEndpoints
      }
    };
    
    this.track(event);
  }

  // Track user session
  startSession(userId, sessionData = {}) {
    const sessionId = crypto.randomUUID();
    const session = {
      id: sessionId,
      user_id: this.hashUserId(userId),
      start_time: Date.now(),
      properties: {
        platform: sessionData.platform,
        version: sessionData.version,
        environment: sessionData.environment
      }
    };
    
    this.userSessions.set(userId, session);
    
    const event = {
      type: 'session_start',
      timestamp: Date.now(),
      user_id: this.hashUserId(userId),
      session_id: sessionId,
      properties: session.properties
    };
    
    this.track(event);
    return sessionId;
  }

  endSession(userId, sessionData = {}) {
    const session = this.userSessions.get(userId);
    if (!session) return;
    
    const duration = Date.now() - session.start_time;
    
    const event = {
      type: 'session_end',
      timestamp: Date.now(),
      user_id: this.hashUserId(userId),
      session_id: session.id,
      properties: {
        duration: duration,
        actions_performed: sessionData.actionsPerformed || 0,
        errors_encountered: sessionData.errorsEncountered || 0,
        features_used: sessionData.featuresUsed || [],
        ...sessionData
      }
    };
    
    this.track(event);
    this.userSessions.delete(userId);
  }

  // Track errors and issues
  trackError(userId, errorData) {
    const event = {
      type: 'error',
      timestamp: Date.now(),
      user_id: userId ? this.hashUserId(userId) : null,
      properties: {
        error_type: errorData.type,
        error_message: errorData.message,
        stack_trace_hash: errorData.stackTrace ? this.hashString(errorData.stackTrace) : null,
        context: errorData.context,
        severity: errorData.severity || 'error',
        component: errorData.component,
        version: errorData.version
      }
    };
    
    this.track(event);
    this.emit('error_tracked', event);
  }

  // Generate alpha program metrics
  generateAlphaMetrics() {
    return {
      timestamp: Date.now(),
      total_signups: this.getMetric('alpha_signup'),
      active_users: this.getMetric('active_users'),
      onboarding_completion: this.getMetric('onboarding_completion'),
      feature_adoption: this.getMetric('feature_adoption'),
      deployment_success_rate: this.getMetric('deployment_success_rate'),
      average_nps: this.getMetric('average_nps'),
      feedback_response_rate: this.getMetric('feedback_response_rate'),
      common_issues: this.getMetric('common_issues'),
      popular_features: this.getMetric('popular_features')
    };
  }

  // Privacy-focused helper methods
  hashUserId(userId) {
    if (!this.config.anonymize) return userId;
    return crypto.createHash('sha256').update(userId + process.env.ANALYTICS_SALT).digest('hex').substring(0, 16);
  }

  hashIP(ip) {
    if (!ip) return null;
    return crypto.createHash('sha256').update(ip + process.env.ANALYTICS_SALT).digest('hex').substring(0, 8);
  }

  hashUserAgent(userAgent) {
    if (!userAgent) return null;
    return crypto.createHash('sha256').update(userAgent).digest('hex').substring(0, 8);
  }

  hashString(str) {
    return crypto.createHash('sha256').update(str).digest('hex').substring(0, 16);
  }

  // Core tracking method
  track(event) {
    if (!this.config.enabled) {
      console.log('[Analytics] Event tracked (disabled):', event.type);
      return;
    }

    // Add common metadata
    event.id = crypto.randomUUID();
    event.session_id = event.session_id || 'anonymous';
    event.version = process.env.TRUXE_VERSION || '1.0.0';
    
    this.eventQueue.push(event);
    
    // Auto-flush if queue is full
    if (this.eventQueue.length >= this.config.batchSize) {
      this.flush();
    }
  }

  // Flush events to analytics service
  async flush() {
    if (this.eventQueue.length === 0) return;
    
    const events = this.eventQueue.splice(0, this.config.batchSize);
    
    try {
      const response = await fetch(this.config.endpoints.events, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.ANALYTICS_API_KEY}`,
          'User-Agent': 'Heimdall-Analytics/1.0'
        },
        body: JSON.stringify({
          events: events,
          metadata: {
            source: 'heimdall-alpha',
            version: process.env.TRUXE_VERSION,
            timestamp: Date.now()
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`Analytics API error: ${response.status}`);
      }
      
      console.log(`[Analytics] Flushed ${events.length} events`);
      this.emit('events_flushed', { count: events.length });
      
    } catch (error) {
      console.error('[Analytics] Failed to flush events:', error);
      // Re-queue events for retry
      this.eventQueue.unshift(...events);
      this.emit('flush_error', error);
    }
  }

  // Get aggregated metrics (placeholder for actual implementation)
  getMetric(metricName) {
    // This would typically query a database or analytics service
    // For now, return placeholder values
    const placeholders = {
      alpha_signup: 150,
      active_users: 89,
      onboarding_completion: 0.73,
      feature_adoption: 0.65,
      deployment_success_rate: 0.82,
      average_nps: 7.8,
      feedback_response_rate: 0.45,
      common_issues: ['setup_time', 'documentation', 'docker_issues'],
      popular_features: ['magic_links', 'jwt_tokens', 'rate_limiting']
    };
    
    return placeholders[metricName] || 0;
  }

  // Cleanup
  destroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush(); // Final flush
  }
}

// Alpha program specific tracking helpers
class AlphaProgramTracker {
  constructor(analytics) {
    this.analytics = analytics;
  }

  // Track weekly cohort progress
  trackWeeklyCohort(week, cohortData) {
    this.analytics.track({
      type: 'weekly_cohort',
      timestamp: Date.now(),
      properties: {
        week: week,
        total_users: cohortData.totalUsers,
        active_users: cohortData.activeUsers,
        completed_onboarding: cohortData.completedOnboarding,
        deployed_production: cohortData.deployedProduction,
        submitted_feedback: cohortData.submittedFeedback,
        retention_rate: cohortData.retentionRate
      }
    });
  }

  // Track feature request patterns
  trackFeatureRequest(userId, requestData) {
    this.analytics.track({
      type: 'feature_request',
      timestamp: Date.now(),
      user_id: this.analytics.hashUserId(userId),
      properties: {
        feature: requestData.feature,
        priority: requestData.priority,
        use_case: requestData.useCase,
        current_workaround: requestData.currentWorkaround,
        votes: requestData.votes || 1
      }
    });
  }

  // Track community engagement
  trackCommunityEngagement(userId, engagementData) {
    this.analytics.track({
      type: 'community_engagement',
      timestamp: Date.now(),
      user_id: this.analytics.hashUserId(userId),
      properties: {
        platform: engagementData.platform, // discord, github, email
        action: engagementData.action, // message, reaction, issue, pr
        channel: engagementData.channel,
        engagement_score: engagementData.engagementScore
      }
    });
  }
}

module.exports = {
  AlphaAnalytics,
  AlphaProgramTracker
};
