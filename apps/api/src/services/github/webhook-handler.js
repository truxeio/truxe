/**
 * GitHub Webhook Handler
 *
 * Handles incoming webhooks from GitHub, verifies signatures,
 * processes events, and stores them for downstream processing.
 *
 * Features:
 * - HMAC SHA-256 signature verification
 * - Event storage and processing
 * - Exponential backoff retry logic
 * - Rate limiting and queue management
 * - IP allowlisting (optional)
 * - Replay attack prevention
 * - Comprehensive error handling
 * - Security best practices
 *
 * @see https://docs.github.com/en/webhooks-and-events/webhooks
 */

import crypto from 'crypto';
import { getPool } from '../../database/connection.js';
import auditLoggerService from '../audit-logger.js';
import { EventEmitter } from 'events';

/**
 * GitHub Webhook Handler Class
 */
export class GitHubWebhookHandler extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.pool = options.pool || getPool();
    this.logger = options.logger || console;
    this.webhookSecret = options.webhookSecret || process.env.GITHUB_WEBHOOK_SECRET;
    
    // Configuration
    this.maxRetries = options.maxRetries || parseInt(process.env.GITHUB_WEBHOOK_MAX_RETRIES || '3');
    this.retryDelay = options.retryDelay || parseInt(process.env.GITHUB_WEBHOOK_RETRY_DELAY || '1000');
    this.maxRetryDelay = options.maxRetryDelay || parseInt(process.env.GITHUB_WEBHOOK_MAX_RETRY_DELAY || '60000');
    this.processingTimeout = options.processingTimeout || parseInt(process.env.GITHUB_WEBHOOK_PROCESSING_TIMEOUT || '30000');
    
    // IP allowlisting (optional)
    this.allowedIPs = options.allowedIPs || (process.env.GITHUB_WEBHOOK_ALLOWED_IPS 
      ? process.env.GITHUB_WEBHOOK_ALLOWED_IPS.split(',').map(ip => ip.trim())
      : null);
    
    // Rate limiting
    this.rateLimitWindow = options.rateLimitWindow || parseInt(process.env.GITHUB_WEBHOOK_RATE_LIMIT_WINDOW || '60000');
    this.rateLimitMax = options.rateLimitMax || parseInt(process.env.GITHUB_WEBHOOK_RATE_LIMIT_MAX || '1000');
    this.rateLimitMap = new Map(); // Track requests per IP
    
    // Replay attack prevention
    this.receivedDeliveryIds = new Set();
    this.replayWindow = options.replayWindow || parseInt(process.env.GITHUB_WEBHOOK_REPLAY_WINDOW || '3600000'); // 1 hour
    
    // Queue for processing events
    this.processingQueue = [];
    this.isProcessing = false;
    this.maxConcurrentProcessing = options.maxConcurrentProcessing || parseInt(process.env.GITHUB_WEBHOOK_MAX_CONCURRENT || '5');
    this.activeProcessing = new Set();
    
    // Metrics
    this.metrics = {
      totalReceived: 0,
      totalProcessed: 0,
      totalFailed: 0,
      totalRetries: 0,
      signatureFailures: 0,
      replayAttempts: 0,
      rateLimitHits: 0,
    };
    
    if (!this.webhookSecret) {
      this.logger.warn('GITHUB_WEBHOOK_SECRET not configured - webhook verification will fail');
    }

    // Clean up replay protection set periodically
    this.startReplayCleanup();

    // Supported webhook events
    this.supportedEvents = [
      // Repository events
      'push',
      'pull_request',
      'pull_request_review',
      'pull_request_review_comment',
      'issues',
      'issue_comment',
      'create',
      'delete',
      'fork',
      'release',
      'repository',
      'repository_vulnerability_alert',
      
      // Organization events
      'organization',
      'member',
      'membership',
      'team',
      'team_add',
      
      // Workflow events
      'workflow_run',
      'workflow_job',
      'check_run',
      'check_suite',
      
      // Security events
      'security_advisory',
      'secret_scanning_alert',
      'code_scanning_alert',
      'dependabot_alert',
      
      // Discussion events
      'discussion',
      'discussion_comment',
      
      // Other events
      'star',
      'gollum',
      'watch',
      'public',
      'status',
      'deployment',
      'deployment_status',
      'page_build',
      'meta',
      'ping',
    ];
  }

  /**
   * Start replay cleanup timer
   * @private
   */
  startReplayCleanup() {
    // Clean up old delivery IDs every hour
    setInterval(() => {
      // The Set will automatically handle cleanup, but we track timestamps
      // For more sophisticated cleanup if needed in the future
      if (this.receivedDeliveryIds.size > 10000) {
        this.logger.warn('Replay protection set is large, consider increasing cleanup frequency', {
          size: this.receivedDeliveryIds.size,
        });
      }
    }, 3600000); // 1 hour
  }

  /**
   * Check if IP is allowed
   * @private
   */
  isIPAllowed(ip) {
    if (!this.allowedIPs) return true; // No allowlist configured
    
    // Check exact match or CIDR notation
    for (const allowedIP of this.allowedIPs) {
      if (allowedIP === ip) return true;
      
      // Check CIDR notation (basic implementation)
      if (allowedIP.includes('/')) {
        // For production, use a proper CIDR library like ipaddr.js
        const [network, prefixLength] = allowedIP.split('/');
        // Simple check - in production use proper CIDR matching
        if (ip.startsWith(network.split('.').slice(0, parseInt(prefixLength) / 8).join('.'))) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Check rate limit for IP
   * @private
   */
  checkRateLimit(ip) {
    const now = Date.now();
    const windowStart = now - this.rateLimitWindow;
    
    let requestTimes = this.rateLimitMap.get(ip) || [];
    
    // Remove old requests outside window
    requestTimes = requestTimes.filter(timestamp => timestamp > windowStart);
    
    // Check if limit exceeded
    if (requestTimes.length >= this.rateLimitMax) {
      this.metrics.rateLimitHits++;
      return false;
    }
    
    // Add current request
    requestTimes.push(now);
    this.rateLimitMap.set(ip, requestTimes);
    
    return true;
  }

  /**
   * Check for replay attack
   * @private
   */
  isReplayAttack(deliveryId) {
    if (this.receivedDeliveryIds.has(deliveryId)) {
      this.metrics.replayAttempts++;
      return true;
    }
    
    this.receivedDeliveryIds.add(deliveryId);
    return false;
  }

  /**
   * Handle incoming webhook request
   *
   * @param {Object} req - Fastify request object
   * @param {Object} res - Fastify reply object
   * @returns {Promise<Object>} Response
   */
  async handleWebhook(req, res) {
    const startTime = Date.now();
    this.metrics.totalReceived++;
    
    // Extract headers and client info
    const signature = req.headers['x-hub-signature-256'] || req.headers['x-hub-signature'];
    const event = req.headers['x-github-event'];
    const deliveryId = req.headers['x-github-delivery'];
    const installationId = req.headers['x-github-installation-id'];
    const action = req.body?.action; // For action-based events
    const clientIP = req.ip || req.socket.remoteAddress;

    // Log incoming webhook
    this.logger.info('GitHub webhook received', {
      event,
      deliveryId,
      installationId,
      action,
      hasSignature: !!signature,
      ip: clientIP,
    });

    // Validate required headers
    if (!deliveryId) {
      this.logger.warn('GitHub webhook missing delivery ID');
      return res.code(400).send({
        error: 'Missing X-GitHub-Delivery header',
      });
    }

    if (!event) {
      this.logger.warn('GitHub webhook missing event type');
      return res.code(400).send({
        error: 'Missing X-GitHub-Event header',
      });
    }

    // IP allowlisting check
    if (this.allowedIPs && !this.isIPAllowed(clientIP)) {
      this.logger.warn('GitHub webhook from unauthorized IP', {
        ip: clientIP,
        deliveryId,
        event,
      });

      await auditLoggerService.log({
        action: 'github_webhook_unauthorized_ip',
        resource: 'github_webhook',
        metadata: {
          deliveryId,
          event,
          ip: clientIP,
          userAgent: req.headers['user-agent'],
        },
      });

      return res.code(403).send({
        error: 'IP address not allowed',
      });
    }

    // Rate limiting
    if (!this.checkRateLimit(clientIP)) {
      this.logger.warn('GitHub webhook rate limit exceeded', {
        ip: clientIP,
        deliveryId,
        event,
      });

      return res.code(429).send({
        error: 'Rate limit exceeded',
        message: 'Too many requests from this IP address',
      });
    }

    // Replay attack prevention
    if (this.isReplayAttack(deliveryId)) {
      this.logger.warn('GitHub webhook replay attack detected', {
        deliveryId,
        event,
        ip: clientIP,
      });

      await auditLoggerService.log({
        action: 'github_webhook_replay_attack',
        resource: 'github_webhook',
        metadata: {
          deliveryId,
          event,
          ip: clientIP,
        },
      });

      return res.code(400).send({
        error: 'Duplicate delivery ID',
        message: 'This webhook has already been processed',
      });
    }

    // Verify signature
    // Use raw body if available (for signature verification), otherwise stringify parsed body
    if (this.webhookSecret) {
      const payload = req.rawBody || JSON.stringify(req.body);
      if (!this.verifySignature(payload, signature)) {
        this.logger.error('GitHub webhook signature verification failed', {
          deliveryId,
          event,
        });

        // Log security incident
        this.metrics.signatureFailures++;
        
        await auditLoggerService.log({
          action: 'github_webhook_signature_failed',
          resource: 'github_webhook',
          metadata: {
            deliveryId,
            event,
            ip: clientIP,
            userAgent: req.headers['user-agent'],
          },
        });

        return res.code(401).send({
          error: 'Invalid signature',
        });
      }
    }

    // Handle ping event (webhook configuration test)
    if (event === 'ping') {
      this.logger.info('GitHub webhook ping received', {
        deliveryId,
        hookId: req.body?.hook_id,
        hook: req.body?.hook,
      });

      return res.code(200).send({
        received: true,
        message: 'Webhook endpoint is active',
        event: 'ping',
      });
    }

    try {
      // Store webhook event
      const eventId = await this.storeWebhookEvent({
        deliveryId,
        event,
        payload: req.body,
        signature,
        installationId,
        receivedAt: new Date(),
      });

      // Queue event for processing (don't block response)
      this.queueEventForProcessing({
        eventId,
        event,
        payload: req.body,
        deliveryId,
        action,
        startTime,
      });

      // Respond immediately to GitHub (webhook must respond quickly)
      return res.code(200).send({
        received: true,
        deliveryId,
        event,
      });
    } catch (error) {
      this.logger.error('GitHub webhook storage failed', {
        deliveryId,
        event,
        error: error.message,
        stack: error.stack,
      });

      // Still respond 200 to GitHub to prevent retries for storage errors
      // Log error for investigation
      return res.code(200).send({
        received: true,
        error: 'Event stored with errors',
      });
    }
  }

  /**
   * Verify webhook signature using HMAC SHA-256
   *
   * @param {string} payload - Raw request body as string
   * @param {string} signature - Signature from X-Hub-Signature-256 header
   * @returns {boolean} True if signature is valid
   */
  verifySignature(payload, signature) {
    if (!signature || !this.webhookSecret) {
      return false;
    }

    try {
      // GitHub sends signature as "sha256=<hash>"
      const expectedSignature = signature.startsWith('sha256=')
        ? signature.substring(7)
        : signature;

      // Calculate HMAC
      const hmac = crypto.createHmac('sha256', this.webhookSecret);
      const digest = hmac.update(payload).digest('hex');

      // Use timing-safe comparison to prevent timing attacks
      const providedSignature = Buffer.from(expectedSignature, 'hex');
      const calculatedSignature = Buffer.from(digest, 'hex');

      // Compare lengths first
      if (providedSignature.length !== calculatedSignature.length) {
        return false;
      }

      // Timing-safe comparison
      return crypto.timingSafeEqual(providedSignature, calculatedSignature);
    } catch (error) {
      this.logger.error('Signature verification error', {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Store webhook event in database
   *
   * @param {Object} eventData - Event data
   * @returns {Promise<string>} Event ID
   */
  async storeWebhookEvent(eventData) {
    const {
      deliveryId,
      event,
      payload,
      signature,
      installationId,
      receivedAt,
    } = eventData;

    try {
      const result = await this.pool.query(
        `INSERT INTO github_webhook_events (
          delivery_id,
          event_type,
          payload,
          signature,
          installation_id,
          received_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id`,
        [
          deliveryId,
          event,
          JSON.stringify(payload),
          signature || null,
          installationId || null,
          receivedAt || new Date(),
        ]
      );

      return result.rows[0].id;
    } catch (error) {
      this.logger.error('Failed to store webhook event', {
        deliveryId,
        event,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Mark event as processed
   *
   * @param {string} eventId - Event ID
   */
  async markEventProcessed(eventId) {
    try {
      await this.pool.query(
        `UPDATE github_webhook_events
         SET processed = true,
             processed_at = NOW(),
             retry_count = 0
         WHERE id = $1`,
        [eventId]
      );
    } catch (error) {
      this.logger.error('Failed to mark event as processed', {
        eventId,
        error: error.message,
      });
    }
  }

  /**
   * Mark event with error
   *
   * @param {string} eventId - Event ID
   * @param {string} errorMessage - Error message
   * @param {number} retryCount - Current retry count
   */
  async markEventError(eventId, errorMessage, retryCount = null) {
    try {
      const query = retryCount !== null
        ? `UPDATE github_webhook_events
           SET processing_error = $1,
               retry_count = $3,
               processed = false
           WHERE id = $2`
        : `UPDATE github_webhook_events
           SET processing_error = $1,
               retry_count = retry_count + 1,
               processed = false
           WHERE id = $2`;
      
      const params = retryCount !== null
        ? [errorMessage, eventId, retryCount]
        : [errorMessage, eventId];
      
      await this.pool.query(query, params);
    } catch (error) {
      this.logger.error('Failed to mark event error', {
        eventId,
        error: error.message,
      });
    }
  }

  /**
   * Queue event for processing
   * @private
   */
  queueEventForProcessing(eventData) {
    this.processingQueue.push(eventData);
    this.processQueue();
  }

  /**
   * Process queue with concurrency control
   * @private
   */
  async processQueue() {
    // Don't start multiple queue processors
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    while (this.processingQueue.length > 0 && this.activeProcessing.size < this.maxConcurrentProcessing) {
      const eventData = this.processingQueue.shift();
      if (!eventData) break;
      
      // Process event with timeout and concurrency control
      this.processEventWithRetry(eventData).catch(error => {
        this.logger.error('Queue processing error', {
          error: error.message,
          eventId: eventData.eventId,
        });
      });
    }
    
    this.isProcessing = false;
  }

  /**
   * Process event with exponential backoff retry
   * @private
   */
  async processEventWithRetry(eventData) {
    const { eventId, event, payload, deliveryId, action, startTime } = eventData;
    this.activeProcessing.add(eventId);
    
    try {
      // Set timeout for processing
      await Promise.race([
        this.processEventWithTimeout(event, payload, deliveryId, action),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Processing timeout')), this.processingTimeout)
        ),
      ]);
      
      // Update event as processed
      await this.markEventProcessed(eventId);
      this.metrics.totalProcessed++;
      
      const duration = Date.now() - startTime;
      this.logger.info('GitHub webhook processed successfully', {
        deliveryId,
        event,
        eventId,
        duration,
      });
      
      this.emit('eventProcessed', { eventId, event, deliveryId, duration });
      
    } catch (error) {
      const currentRetryCount = await this.getEventRetryCount(eventId);
      
      if (currentRetryCount < this.maxRetries) {
        // Calculate exponential backoff delay
        const delay = Math.min(
          this.retryDelay * Math.pow(2, currentRetryCount),
          this.maxRetryDelay
        );
        
        this.metrics.totalRetries++;
        
        this.logger.warn('GitHub webhook processing failed, will retry', {
          deliveryId,
          event,
          eventId,
          retryCount: currentRetryCount + 1,
          maxRetries: this.maxRetries,
          delay,
          error: error.message,
        });
        
        // Schedule retry with exponential backoff
        setTimeout(async () => {
          // Re-queue for retry
          this.queueEventForProcessing(eventData);
        }, delay);
        
        await this.markEventError(eventId, error.message, currentRetryCount + 1);
      } else {
        // Max retries exceeded
        this.metrics.totalFailed++;
        
        this.logger.error('GitHub webhook processing failed after max retries', {
          deliveryId,
          event,
          eventId,
          retryCount: currentRetryCount,
          error: error.message,
          stack: error.stack,
        });
        
        await this.markEventError(eventId, `Max retries exceeded: ${error.message}`, currentRetryCount);
        
        this.emit('eventFailed', { eventId, event, deliveryId, error: error.message });
      }
    } finally {
      this.activeProcessing.delete(eventId);
      // Continue processing queue
      setImmediate(() => this.processQueue());
    }
  }

  /**
   * Process event with timeout wrapper
   * @private
   */
  async processEventWithTimeout(event, payload, deliveryId, action) {
    return this.processEvent(event, payload, deliveryId, action);
  }

  /**
   * Get current retry count for event
   * @private
   */
  async getEventRetryCount(eventId) {
    try {
      const result = await this.pool.query(
        `SELECT retry_count FROM github_webhook_events WHERE id = $1`,
        [eventId]
      );
      return result.rows[0]?.retry_count || 0;
    } catch (error) {
      this.logger.error('Failed to get retry count', {
        eventId,
        error: error.message,
      });
      return 0;
    }
  }

  /**
   * Process webhook event based on event type
   *
   * @param {string} event - Event type
   * @param {Object} payload - Event payload
   * @param {string} deliveryId - Delivery ID
   * @param {string} action - Action (for action-based events)
   */
  async processEvent(event, payload, deliveryId, action) {
    this.logger.debug('Processing GitHub webhook event', {
      event,
      deliveryId,
      action,
    });

    // Route to event-specific handlers
    switch (event) {
      case 'push':
        await this.handlePush(payload);
        break;

      case 'pull_request':
        await this.handlePullRequest(payload, action);
        break;

      case 'pull_request_review':
        await this.handlePullRequestReview(payload, action);
        break;

      case 'issues':
        await this.handleIssues(payload, action);
        break;

      case 'issue_comment':
        await this.handleIssueComment(payload, action);
        break;

      case 'create':
        await this.handleCreate(payload);
        break;

      case 'delete':
        await this.handleDelete(payload);
        break;

      case 'fork':
        await this.handleFork(payload);
        break;

      case 'release':
        await this.handleRelease(payload, action);
        break;

      case 'repository':
        await this.handleRepository(payload, action);
        break;

      case 'organization':
        await this.handleOrganization(payload, action);
        break;

      case 'member':
        await this.handleMember(payload, action);
        break;

      case 'membership':
        await this.handleMembership(payload, action);
        break;

      case 'team':
        await this.handleTeam(payload, action);
        break;

      case 'workflow_run':
        await this.handleWorkflowRun(payload, action);
        break;

      case 'workflow_job':
        await this.handleWorkflowJob(payload, action);
        break;

      case 'check_run':
        await this.handleCheckRun(payload, action);
        break;

      case 'check_suite':
        await this.handleCheckSuite(payload, action);
        break;

      case 'security_advisory':
        await this.handleSecurityAdvisory(payload, action);
        break;

      case 'secret_scanning_alert':
        await this.handleSecretScanningAlert(payload, action);
        break;

      case 'code_scanning_alert':
        await this.handleCodeScanningAlert(payload, action);
        break;

      case 'dependabot_alert':
        await this.handleDependabotAlert(payload, action);
        break;

      case 'discussion':
        await this.handleDiscussion(payload, action);
        break;

      case 'star':
        await this.handleStar(payload, action);
        break;

      default:
        this.logger.debug('Unhandled GitHub webhook event', {
          event,
          deliveryId,
        });
        // Store but don't process - allows for future handlers
        break;
    }
  }

  /**
   * Handle push event
   */
  async handlePush(payload) {
    const { repository, pusher, ref, commits, before, after } = payload;
    
    this.logger.info('Processing push event', {
      repository: repository?.full_name,
      branch: ref?.replace('refs/heads/', ''),
      commits: commits?.length,
      pusher: pusher?.name,
    });

    // Emit event for other services to listen
    // This allows repository sync service to refresh cache, etc.
    // You can emit custom events here that other services can subscribe to

    // Example: Trigger repository cache refresh
    // await repositorySyncService.refreshRepository(repository.id);
  }

  /**
   * Handle pull request event
   */
  async handlePullRequest(payload, action) {
    const { pull_request, repository } = payload;
    
    this.logger.info('Processing pull_request event', {
      repository: repository?.full_name,
      action,
      number: pull_request?.number,
      state: pull_request?.state,
    });

    // Handle different PR actions
    switch (action) {
      case 'opened':
      case 'synchronize':
      case 'reopened':
        // PR opened or updated - might want to trigger checks
        break;
      case 'closed':
        // PR closed - check if merged
        if (pull_request?.merged) {
          // PR was merged
        }
        break;
    }
  }

  /**
   * Handle pull request review event
   */
  async handlePullRequestReview(payload, action) {
    const { review, pull_request, repository } = payload;
    
    this.logger.info('Processing pull_request_review event', {
      repository: repository?.full_name,
      action,
      state: review?.state,
      pr: pull_request?.number,
    });
  }

  /**
   * Handle issues event
   */
  async handleIssues(payload, action) {
    const { issue, repository } = payload;
    
    this.logger.info('Processing issues event', {
      repository: repository?.full_name,
      action,
      number: issue?.number,
    });
  }

  /**
   * Handle issue comment event
   */
  async handleIssueComment(payload, action) {
    const { comment, issue, repository } = payload;
    
    this.logger.info('Processing issue_comment event', {
      repository: repository?.full_name,
      action,
      issue: issue?.number,
    });
  }

  /**
   * Handle create event (branch/tag created)
   */
  async handleCreate(payload) {
    const { ref_type, ref, repository } = payload;
    
    this.logger.info('Processing create event', {
      repository: repository?.full_name,
      refType: ref_type,
      ref,
    });
  }

  /**
   * Handle delete event (branch/tag deleted)
   */
  async handleDelete(payload) {
    const { ref_type, ref, repository } = payload;
    
    this.logger.info('Processing delete event', {
      repository: repository?.full_name,
      refType: ref_type,
      ref,
    });
  }

  /**
   * Handle fork event
   */
  async handleFork(payload) {
    const { forkee, repository } = payload;
    
    this.logger.info('Processing fork event', {
      repository: repository?.full_name,
      fork: forkee?.full_name,
    });
  }

  /**
   * Handle release event
   */
  async handleRelease(payload, action) {
    const { release, repository } = payload;
    
    this.logger.info('Processing release event', {
      repository: repository?.full_name,
      action,
      tag: release?.tag_name,
    });
  }

  /**
   * Handle repository event
   */
  async handleRepository(payload, action) {
    const { repository } = payload;
    
    this.logger.info('Processing repository event', {
      repository: repository?.full_name,
      action,
    });
  }

  /**
   * Handle organization event
   */
  async handleOrganization(payload, action) {
    const { organization, membership } = payload;
    
    this.logger.info('Processing organization event', {
      organization: organization?.login,
      action,
    });
  }

  /**
   * Handle member event
   */
  async handleMember(payload, action) {
    const { member, repository, organization } = payload;
    
    this.logger.info('Processing member event', {
      repository: repository?.full_name,
      organization: organization?.login,
      action,
      member: member?.login,
    });
  }

  /**
   * Handle membership event
   */
  async handleMembership(payload, action) {
    const { member, organization, team } = payload;
    
    this.logger.info('Processing membership event', {
      organization: organization?.login,
      team: team?.name,
      action,
      member: member?.login,
    });
  }

  /**
   * Handle team event
   */
  async handleTeam(payload, action) {
    const { team, organization, repository } = payload;
    
    this.logger.info('Processing team event', {
      organization: organization?.login,
      team: team?.name,
      action,
    });
  }

  /**
   * Handle workflow_run event
   */
  async handleWorkflowRun(payload, action) {
    const { workflow_run, repository } = payload;
    
    this.logger.info('Processing workflow_run event', {
      repository: repository?.full_name,
      action,
      workflow: workflow_run?.name,
      status: workflow_run?.status,
      conclusion: workflow_run?.conclusion,
    });
  }

  /**
   * Handle workflow_job event
   */
  async handleWorkflowJob(payload, action) {
    const { workflow_job, repository } = payload;
    
    this.logger.info('Processing workflow_job event', {
      repository: repository?.full_name,
      action,
      job: workflow_job?.name,
      status: workflow_job?.status,
      conclusion: workflow_job?.conclusion,
    });
  }

  /**
   * Handle check_run event
   */
  async handleCheckRun(payload, action) {
    const { check_run, repository } = payload;
    
    this.logger.info('Processing check_run event', {
      repository: repository?.full_name,
      action,
      name: check_run?.name,
      status: check_run?.status,
      conclusion: check_run?.conclusion,
    });
  }

  /**
   * Handle check_suite event
   */
  async handleCheckSuite(payload, action) {
    const { check_suite, repository } = payload;
    
    this.logger.info('Processing check_suite event', {
      repository: repository?.full_name,
      action,
      status: check_suite?.status,
      conclusion: check_suite?.conclusion,
    });
  }

  /**
   * Handle security_advisory event
   */
  async handleSecurityAdvisory(payload, action) {
    const { security_advisory, repository } = payload;
    
    this.logger.warn('Processing security_advisory event', {
      repository: repository?.full_name,
      action,
      ghsaId: security_advisory?.ghsa_id,
      severity: security_advisory?.severity,
    });

    // This is a security-critical event - consider alerting
  }

  /**
   * Handle secret_scanning_alert event
   */
  async handleSecretScanningAlert(payload, action) {
    const { alert, repository } = payload;
    
    this.logger.warn('Processing secret_scanning_alert event', {
      repository: repository?.full_name,
      action,
      alertNumber: alert?.number,
      secretType: alert?.secret_type,
    });

    // This is a security-critical event - consider alerting
  }

  /**
   * Handle code_scanning_alert event
   */
  async handleCodeScanningAlert(payload, action) {
    const { alert, repository } = payload;
    
    this.logger.info('Processing code_scanning_alert event', {
      repository: repository?.full_name,
      action,
      alertNumber: alert?.number,
      rule: alert?.rule?.name,
    });
  }

  /**
   * Handle dependabot_alert event
   */
  async handleDependabotAlert(payload, action) {
    const { alert, repository } = payload;
    
    this.logger.info('Processing dependabot_alert event', {
      repository: repository?.full_name,
      action,
      alertNumber: alert?.number,
      severity: alert?.security_vulnerability?.severity,
    });
  }

  /**
   * Handle discussion event
   */
  async handleDiscussion(payload, action) {
    const { discussion, repository, organization } = payload;
    
    this.logger.info('Processing discussion event', {
      repository: repository?.full_name,
      organization: organization?.login,
      action,
      number: discussion?.number,
    });
  }

  /**
   * Handle star event
   */
  async handleStar(payload, action) {
    const { starred_at, repository, sender } = payload;
    
    this.logger.info('Processing star event', {
      repository: repository?.full_name,
      action,
      sender: sender?.login,
    });
  }

  /**
   * Get webhook events (for API access)
   *
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Events
   */
  async getEvents(filters = {}) {
    const {
      eventType,
      processed,
      limit = 100,
      offset = 0,
    } = filters;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (eventType) {
      conditions.push(`event_type = $${paramIndex}`);
      params.push(eventType);
      paramIndex++;
    }

    if (processed !== undefined) {
      conditions.push(`processed = $${paramIndex}`);
      params.push(processed);
      paramIndex++;
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    params.push(limit, offset);

    try {
      const result = await this.pool.query(
        `SELECT * FROM github_webhook_events
         ${whereClause}
         ORDER BY received_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        params
      );

      return result.rows;
    } catch (error) {
      this.logger.error('Failed to get webhook events', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Retry failed webhook events
   *
   * @param {string} eventId - Event ID to retry
   * @returns {Promise<boolean>} Success status
   */
  async retryEvent(eventId) {
    try {
      const result = await this.pool.query(
        `SELECT * FROM github_webhook_events WHERE id = $1`,
        [eventId]
      );

      if (result.rows.length === 0) {
        throw new Error('Event not found');
      }

      const event = result.rows[0];

      // Reset error state and reprocess
      await this.pool.query(
        `UPDATE github_webhook_events
         SET processing_error = NULL,
             retry_count = 0,
             processed = false
         WHERE id = $1`,
        [eventId]
      );

      // Queue for reprocessing with retry logic
      const payload = typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload;
      
      this.queueEventForProcessing({
        eventId,
        event: event.event_type,
        payload,
        deliveryId: event.delivery_id,
        action: payload?.action,
        startTime: Date.now(),
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to retry event', {
        eventId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get webhook handler metrics
   *
   * @returns {Object} Metrics object
   */
  getMetrics() {
    return {
      ...this.metrics,
      queueSize: this.processingQueue.length,
      activeProcessing: this.activeProcessing.size,
      replayProtectionSize: this.receivedDeliveryIds.size,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      totalReceived: 0,
      totalProcessed: 0,
      totalFailed: 0,
      totalRetries: 0,
      signatureFailures: 0,
      replayAttempts: 0,
      rateLimitHits: 0,
    };
  }
}

export default GitHubWebhookHandler;

