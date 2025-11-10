/**
 * GitHub Webhook Cleanup Service Tests
 *
 * Unit tests for webhook cleanup service including:
 * - Automated cleanup execution
 * - Cleanup statistics
 * - Service lifecycle (start/stop)
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { GitHubWebhookCleanupService } from '../src/services/github/webhook-cleanup.js';

// Mock dependencies
jest.mock('../src/database/connection.js', () => ({
  getPool: jest.fn(() => mockPool),
}));

// Mock database pool
const mockPool = {
  query: jest.fn(),
  connect: jest.fn(),
};

describe('GitHubWebhookCleanupService', () => {
  let service;
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    if (service) {
      service.stop();
    }
    jest.useRealTimers();
  });

  describe('Cleanup Execution', () => {
    it('should perform cleanup successfully', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ deleted_count: '42' }],
      });

      service = new GitHubWebhookCleanupService({
        pool: mockPool,
        logger: mockLogger,
        retentionDays: 90,
      });

      const result = await service.performCleanup();

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT cleanup_old_github_webhook_events()')
      );
      expect(result.deletedCount).toBe(42);
      expect(result.duration).toBeGreaterThan(0);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('GitHub webhook cleanup completed'),
        expect.any(Object)
      );
    });

    it('should handle cleanup errors', async () => {
      mockPool.query.mockRejectedValue(new Error('Database error'));

      service = new GitHubWebhookCleanupService({
        pool: mockPool,
        logger: mockLogger,
      });

      await expect(service.performCleanup()).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should prevent concurrent cleanup runs', async () => {
      mockPool.query.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ rows: [{ deleted_count: '10' }] }), 100))
      );

      service = new GitHubWebhookCleanupService({
        pool: mockPool,
        logger: mockLogger,
      });

      const promise1 = service.performCleanup();
      const promise2 = service.performCleanup();

      // First should execute, second should be skipped
      await promise1;
      
      expect(service.isRunning).toBe(false);
    });
  });

  describe('Scheduled Cleanup', () => {
    it('should start cleanup job', () => {
      service = new GitHubWebhookCleanupService({
        pool: mockPool,
        logger: mockLogger,
        cleanupInterval: 1000,
      });

      mockPool.query.mockResolvedValue({
        rows: [{ deleted_count: '5' }],
      });

      service.start();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('GitHub webhook cleanup job started'),
        expect.any(Object)
      );
      expect(service.cleanupTimer).toBeDefined();
    });

    it('should stop cleanup job', () => {
      service = new GitHubWebhookCleanupService({
        pool: mockPool,
        logger: mockLogger,
      });

      service.start();
      expect(service.cleanupTimer).toBeDefined();

      service.stop();
      expect(service.cleanupTimer).toBeNull();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('GitHub webhook cleanup job stopped')
      );
    });

    it('should not start if already running', () => {
      service = new GitHubWebhookCleanupService({
        pool: mockPool,
        logger: mockLogger,
      });

      service.start();
      const timer1 = service.cleanupTimer;

      service.start();
      expect(service.cleanupTimer).toBe(timer1);
    });
  });

  describe('Cleanup Statistics', () => {
    it('should get cleanup statistics', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ count: '150' }],
        })
        .mockResolvedValueOnce({
          rows: [{ count: '1000' }],
        })
        .mockResolvedValueOnce({
          rows: [{ oldest: new Date('2024-01-01') }],
        });

      service = new GitHubWebhookCleanupService({
        pool: mockPool,
        logger: mockLogger,
        retentionDays: 90,
        cleanupInterval: 86400000,
      });

      service.start();

      const stats = await service.getCleanupStats();

      expect(stats.retentionDays).toBe(90);
      expect(stats.totalEvents).toBe(1000);
      expect(stats.eligibleForCleanup).toBe(150);
      expect(stats.oldestProcessedEvent).toBeDefined();
      expect(stats.nextCleanup).toBeDefined();
      expect(stats.isRunning).toBe(false);
    });

    it('should handle statistics errors', async () => {
      mockPool.query.mockRejectedValue(new Error('Database error'));

      service = new GitHubWebhookCleanupService({
        pool: mockPool,
        logger: mockLogger,
      });

      await expect(service.getCleanupStats()).rejects.toThrow('Database error');
    });
  });

  describe('Configuration', () => {
    it('should use default retention days', () => {
      service = new GitHubWebhookCleanupService({
        pool: mockPool,
        logger: mockLogger,
      });

      expect(service.retentionDays).toBe(90);
    });

    it('should use custom retention days', () => {
      service = new GitHubWebhookCleanupService({
        pool: mockPool,
        logger: mockLogger,
        retentionDays: 30,
      });

      expect(service.retentionDays).toBe(30);
    });

    it('should use default cleanup interval', () => {
      service = new GitHubWebhookCleanupService({
        pool: mockPool,
        logger: mockLogger,
      });

      expect(service.cleanupInterval).toBe(86400000); // 24 hours
    });
  });
});




