/**
 * GitHub Webhook Registration Service Tests
 *
 * Unit tests for webhook registration service including:
 * - Repository webhook registration
 * - Webhook listing and management
 * - Webhook testing
 * - Error handling
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { GitHubWebhookRegistrationService } from '../src/services/github/webhook-registration.js';
import GitHubClient from '../src/services/github/github-client.js';

// Mock dependencies
jest.mock('../src/database/connection.js', () => ({
  getPool: jest.fn(() => mockPool),
}));

jest.mock('../src/services/github/github-client.js', () => {
  return jest.fn().mockImplementation(() => mockGitHubClient);
});

// Mock database pool
const mockPool = {
  query: jest.fn(),
  connect: jest.fn(),
};

// Mock GitHub client
const mockGitHubClient = {
  createRepositoryWebhook: jest.fn(),
  getRepositoryWebhooks: jest.fn(),
  updateRepositoryWebhook: jest.fn(),
  deleteRepositoryWebhook: jest.fn(),
  testRepositoryWebhook: jest.fn(),
};

describe('GitHubWebhookRegistrationService', () => {
  let service;
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GitHubWebhookRegistrationService({
      pool: mockPool,
      logger: mockLogger,
      baseWebhookUrl: 'https://example.com/webhooks',
    });

    // Mock OAuth account query
    mockPool.query.mockResolvedValue({
      rows: [{
        access_token: 'encrypted-token',
        provider: 'github',
      }],
    });
  });

  describe('Repository Webhook Registration', () => {
    it('should register webhook successfully', async () => {
      const mockWebhook = {
        id: 123,
        config: {
          url: 'https://example.com/webhooks',
        },
        events: ['push', 'pull_request'],
        active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockGitHubClient.createRepositoryWebhook.mockResolvedValue(mockWebhook);

      const result = await service.registerRepositoryWebhook({
        userId: 'user-123',
        owner: 'test-owner',
        repo: 'test-repo',
        secret: 'webhook-secret',
        events: ['push', 'pull_request'],
        active: true,
      });

      expect(mockGitHubClient.createRepositoryWebhook).toHaveBeenCalledWith(
        'test-owner',
        'test-repo',
        expect.objectContaining({
          url: 'https://example.com/webhooks',
          secret: 'webhook-secret',
          events: ['push', 'pull_request'],
          active: true,
        })
      );

      expect(result.id).toBe(123);
      expect(result.events).toEqual(['push', 'pull_request']);
      expect(result.active).toBe(true);
    });

    it('should use default events if not provided', async () => {
      const mockWebhook = {
        id: 123,
        config: { url: 'https://example.com/webhooks' },
        events: ['push'],
        active: true,
      };

      mockGitHubClient.createRepositoryWebhook.mockResolvedValue(mockWebhook);

      await service.registerRepositoryWebhook({
        userId: 'user-123',
        owner: 'test-owner',
        repo: 'test-repo',
        secret: 'webhook-secret',
      });

      expect(mockGitHubClient.createRepositoryWebhook).toHaveBeenCalledWith(
        'test-owner',
        'test-repo',
        expect.objectContaining({
          events: ['push', 'pull_request'],
        })
      );
    });

    it('should throw error if required parameters missing', async () => {
      await expect(
        service.registerRepositoryWebhook({
          userId: 'user-123',
          // Missing owner, repo, secret
        })
      ).rejects.toThrow('userId, owner, and repo are required');

      await expect(
        service.registerRepositoryWebhook({
          userId: 'user-123',
          owner: 'test-owner',
          repo: 'test-repo',
          // Missing secret
        })
      ).rejects.toThrow('Webhook secret is required');
    });

    it('should throw error if GitHub OAuth account not found', async () => {
      mockPool.query.mockResolvedValue({
        rows: [],
      });

      await expect(
        service.registerRepositoryWebhook({
          userId: 'user-123',
          owner: 'test-owner',
          repo: 'test-repo',
          secret: 'webhook-secret',
        })
      ).rejects.toThrow('GitHub OAuth account not found');
    });

    it('should handle GitHub API errors', async () => {
      mockGitHubClient.createRepositoryWebhook.mockRejectedValue(
        new Error('GitHub API error')
      );

      await expect(
        service.registerRepositoryWebhook({
          userId: 'user-123',
          owner: 'test-owner',
          repo: 'test-repo',
          secret: 'webhook-secret',
        })
      ).rejects.toThrow('GitHub API error');
    });
  });

  describe('List Repository Webhooks', () => {
    it('should list webhooks for repository', async () => {
      const mockWebhooks = [
        { id: 1, config: { url: 'https://example.com/webhook1' } },
        { id: 2, config: { url: 'https://example.com/webhook2' } },
      ];

      mockGitHubClient.getRepositoryWebhooks.mockResolvedValue(mockWebhooks);

      const result = await service.listRepositoryWebhooks({
        userId: 'user-123',
        owner: 'test-owner',
        repo: 'test-repo',
      });

      expect(mockGitHubClient.getRepositoryWebhooks).toHaveBeenCalledWith(
        'test-owner',
        'test-repo'
      );
      expect(result).toEqual(mockWebhooks);
    });

    it('should throw error if required parameters missing', async () => {
      await expect(
        service.listRepositoryWebhooks({
          userId: 'user-123',
          // Missing owner, repo
        })
      ).rejects.toThrow('userId, owner, and repo are required');
    });
  });

  describe('Update Repository Webhook', () => {
    it('should update webhook successfully', async () => {
      const mockWebhook = {
        id: 123,
        events: ['push', 'issues'],
        active: false,
      };

      mockGitHubClient.updateRepositoryWebhook.mockResolvedValue(mockWebhook);

      const result = await service.updateRepositoryWebhook({
        userId: 'user-123',
        owner: 'test-owner',
        repo: 'test-repo',
        hookId: 123,
        config: {
          events: ['push', 'issues'],
          active: false,
        },
      });

      expect(mockGitHubClient.updateRepositoryWebhook).toHaveBeenCalledWith(
        'test-owner',
        'test-repo',
        123,
        expect.objectContaining({
          events: ['push', 'issues'],
          active: false,
        })
      );

      expect(result).toEqual(mockWebhook);
    });
  });

  describe('Delete Repository Webhook', () => {
    it('should delete webhook successfully', async () => {
      mockGitHubClient.deleteRepositoryWebhook.mockResolvedValue(undefined);

      await service.deleteRepositoryWebhook({
        userId: 'user-123',
        owner: 'test-owner',
        repo: 'test-repo',
        hookId: 123,
      });

      expect(mockGitHubClient.deleteRepositoryWebhook).toHaveBeenCalledWith(
        'test-owner',
        'test-repo',
        123
      );
    });
  });

  describe('Test Repository Webhook', () => {
    it('should test webhook successfully', async () => {
      const mockResult = { status: 'sent' };

      mockGitHubClient.testRepositoryWebhook.mockResolvedValue(mockResult);

      const result = await service.testRepositoryWebhook({
        userId: 'user-123',
        owner: 'test-owner',
        repo: 'test-repo',
        hookId: 123,
      });

      expect(mockGitHubClient.testRepositoryWebhook).toHaveBeenCalledWith(
        'test-owner',
        'test-repo',
        123
      );
      expect(result).toEqual(mockResult);
    });
  });
});




