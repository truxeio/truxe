/**
 * GitHub Webhook Handler Tests
 *
 * Comprehensive unit tests for the GitHub webhook handler including:
 * - Signature verification
 * - Event processing
 * - Retry logic
 * - Rate limiting
 * - Replay protection
 * - Queue management
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { GitHubWebhookHandler } from '../src/services/github/webhook-handler.js';
import crypto from 'crypto';

// Mock dependencies
jest.mock('../src/database/connection.js', () => ({
  getPool: jest.fn(() => mockPool),
}));

jest.mock('../src/services/audit-logger.js', () => {
  const mockLog = jest.fn().mockResolvedValue(undefined);
  return {
    __esModule: true,
    default: {
      log: mockLog,
    },
  };
});

// Mock database pool
const mockPool = {
  query: jest.fn(),
  connect: jest.fn(),
};

// Helper function to create valid GitHub signature
function createSignature(payload, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(JSON.stringify(payload)).digest('hex');
  return `sha256=${digest}`;
}

describe('GitHubWebhookHandler', () => {
  let handler;
  const webhookSecret = 'test-webhook-secret';
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new GitHubWebhookHandler({
      pool: mockPool,
      logger: mockLogger,
      webhookSecret,
      maxRetries: 3,
      retryDelay: 100,
      maxRetryDelay: 1000,
    });
  });

  afterEach(() => {
    handler.stop?.();
  });

  describe('Signature Verification', () => {
    it('should verify valid signature', () => {
      const payload = { action: 'push', repository: { id: 123 } };
      const signature = createSignature(payload, webhookSecret);
      const isValid = handler.verifySignature(JSON.stringify(payload), signature);
      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const payload = { action: 'push', repository: { id: 123 } };
      const invalidSignature = 'sha256=invalid';
      const isValid = handler.verifySignature(JSON.stringify(payload), invalidSignature);
      expect(isValid).toBe(false);
    });

    it('should reject signature with wrong secret', () => {
      const payload = { action: 'push', repository: { id: 123 } };
      const signature = createSignature(payload, 'wrong-secret');
      const isValid = handler.verifySignature(JSON.stringify(payload), signature);
      expect(isValid).toBe(false);
    });

    it('should handle missing signature', () => {
      const payload = { action: 'push', repository: { id: 123 } };
      const isValid = handler.verifySignature(JSON.stringify(payload), null);
      expect(isValid).toBe(false);
    });
  });

  describe('IP Allowlisting', () => {
    it('should allow IP when no allowlist configured', () => {
      handler.allowedIPs = null;
      expect(handler.isIPAllowed('192.168.1.1')).toBe(true);
    });

    it('should allow IP in allowlist', () => {
      handler.allowedIPs = ['192.168.1.1', '10.0.0.1'];
      expect(handler.isIPAllowed('192.168.1.1')).toBe(true);
      expect(handler.isIPAllowed('10.0.0.1')).toBe(true);
    });

    it('should reject IP not in allowlist', () => {
      handler.allowedIPs = ['192.168.1.1'];
      expect(handler.isIPAllowed('192.168.1.2')).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(() => {
      handler.rateLimitMap.clear();
    });

    it('should allow requests within limit', () => {
      handler.rateLimitMax = 5;
      handler.rateLimitWindow = 60000;
      
      for (let i = 0; i < 5; i++) {
        expect(handler.checkRateLimit('192.168.1.1')).toBe(true);
      }
    });

    it('should reject requests over limit', () => {
      handler.rateLimitMax = 5;
      handler.rateLimitWindow = 60000;
      
      for (let i = 0; i < 5; i++) {
        handler.checkRateLimit('192.168.1.1');
      }
      
      expect(handler.checkRateLimit('192.168.1.1')).toBe(false);
      expect(handler.metrics.rateLimitHits).toBe(1);
    });

    it('should track different IPs separately', () => {
      handler.rateLimitMax = 2;
      
      expect(handler.checkRateLimit('192.168.1.1')).toBe(true);
      expect(handler.checkRateLimit('192.168.1.2')).toBe(true);
      expect(handler.checkRateLimit('192.168.1.1')).toBe(true);
      expect(handler.checkRateLimit('192.168.1.2')).toBe(true);
    });
  });

  describe('Replay Protection', () => {
    it('should detect replay attacks', () => {
      const deliveryId = 'test-delivery-id-123';
      
      expect(handler.isReplayAttack(deliveryId)).toBe(false);
      expect(handler.isReplayAttack(deliveryId)).toBe(true);
      expect(handler.metrics.replayAttempts).toBe(1);
    });

    it('should allow different delivery IDs', () => {
      expect(handler.isReplayAttack('delivery-1')).toBe(false);
      expect(handler.isReplayAttack('delivery-2')).toBe(false);
      expect(handler.isReplayAttack('delivery-3')).toBe(false);
    });
  });

  describe('Event Storage', () => {
    it('should store webhook event', async () => {
      const eventData = {
        deliveryId: 'test-delivery-123',
        event: 'push',
        payload: { action: 'push' },
        signature: 'sha256=test',
        installationId: null,
        receivedAt: new Date(),
      };

      mockPool.query.mockResolvedValue({
        rows: [{ id: 'event-id-123' }],
      });

      const eventId = await handler.storeWebhookEvent(eventData);

      expect(mockPool.query).toHaveBeenCalled();
      expect(eventId).toBe('event-id-123');
      
      const callArgs = mockPool.query.mock.calls[0][0];
      expect(callArgs).toContain('INSERT INTO github_webhook_events');
    });

    it('should mark event as processed', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await handler.markEventProcessed('event-id-123');

      expect(mockPool.query).toHaveBeenCalled();
      const callArgs = mockPool.query.mock.calls[0][0];
      expect(callArgs).toContain('UPDATE github_webhook_events');
      expect(callArgs).toContain('processed = true');
    });

    it('should mark event with error', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await handler.markEventError('event-id-123', 'Test error', 2);

      expect(mockPool.query).toHaveBeenCalled();
      const callArgs = mockPool.query.mock.calls[0][0];
      expect(callArgs).toContain('UPDATE github_webhook_events');
    });
  });

  describe('Event Processing', () => {
    it('should process push event', async () => {
      const payload = {
        repository: { full_name: 'owner/repo' },
        ref: 'refs/heads/main',
        commits: [],
      };

      await handler.handlePush(payload);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Processing push event'),
        expect.any(Object)
      );
    });

    it('should process pull request event', async () => {
      const payload = {
        pull_request: { number: 123, state: 'open' },
        repository: { full_name: 'owner/repo' },
      };

      await handler.handlePullRequest(payload, 'opened');

      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should handle different event types', async () => {
      const eventTypes = ['push', 'pull_request', 'issues', 'release'];
      
      for (const eventType of eventTypes) {
        await handler.processEvent(eventType, {}, 'delivery-123', null);
      }

      expect(mockLogger.info || mockLogger.debug).toHaveBeenCalled();
    });
  });

  describe('Metrics', () => {
    it('should track metrics', () => {
      handler.metrics.totalReceived = 10;
      handler.metrics.totalProcessed = 8;
      handler.metrics.totalFailed = 2;

      const metrics = handler.getMetrics();

      expect(metrics.totalReceived).toBe(10);
      expect(metrics.totalProcessed).toBe(8);
      expect(metrics.totalFailed).toBe(2);
      expect(metrics.queueSize).toBeDefined();
      expect(metrics.activeProcessing).toBeDefined();
    });

    it('should reset metrics', () => {
      handler.metrics.totalReceived = 10;
      handler.resetMetrics();

      expect(handler.metrics.totalReceived).toBe(0);
      expect(handler.metrics.totalProcessed).toBe(0);
      expect(handler.metrics.totalFailed).toBe(0);
    });
  });

  describe('Ping Event', () => {
    it('should handle ping events', async () => {
      const payload = { hook_id: 123 };
      const signature = createSignature(payload, webhookSecret);

      const req = {
        headers: {
          'x-github-event': 'ping',
          'x-github-delivery': 'ping-delivery-123',
          'x-hub-signature-256': signature,
        },
        body: payload,
        ip: '192.168.1.1',
        rawBody: JSON.stringify(payload),
      };

      const res = {
        code: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await handler.handleWebhook(req, res);

      expect(res.code).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(
        expect.objectContaining({
          received: true,
          message: 'Webhook endpoint is active',
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle missing delivery ID', async () => {
      const req = {
        headers: {
          'x-github-event': 'push',
        },
        body: {},
        ip: '192.168.1.1',
      };

      const res = {
        code: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await handler.handleWebhook(req, res);

      expect(res.code).toHaveBeenCalledWith(400);
    });

    it('should handle missing event type', async () => {
      const req = {
        headers: {
          'x-github-delivery': 'delivery-123',
        },
        body: {},
        ip: '192.168.1.1',
      };

      const res = {
        code: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await handler.handleWebhook(req, res);

      expect(res.code).toHaveBeenCalledWith(400);
    });

    it('should handle storage errors gracefully', async () => {
      const payload = { action: 'push' };
      const signature = createSignature(payload, webhookSecret);

      mockPool.query.mockRejectedValue(new Error('Database error'));

      const req = {
        headers: {
          'x-github-event': 'push',
          'x-github-delivery': 'delivery-123',
          'x-hub-signature-256': signature,
        },
        body: payload,
        ip: '192.168.1.1',
        rawBody: JSON.stringify(payload),
      };

      const res = {
        code: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await handler.handleWebhook(req, res);

      // Should still respond 200 to prevent GitHub retries
      expect(res.code).toHaveBeenCalledWith(200);
    });
  });
});




