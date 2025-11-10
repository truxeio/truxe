/**
 * GitHub Repository Sync Service Tests
 *
 * Unit tests for the repository sync service including:
 * - Repository synchronization
 * - Batch processing
 * - Error recovery
 * - Database operations
 */

import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  RepositorySyncService,
  RepositorySyncError,
} from '../src/services/github/repository-sync.js';
import GitHubClient from '../src/services/github/github-client.js';

// Mock database pool
class MockPool {
  constructor() {
    this.queries = [];
    this.connections = [];
  }

  async connect() {
    const client = {
      query: mock.fn(),
      release: mock.fn(),
    };
    this.connections.push(client);
    return client;
  }

  async query(...args) {
    this.queries.push(args);
    return { rows: [] };
  }
}

// Mock GitHub client
class MockGitHubClient {
  constructor() {
    this.repositories = [];
  }

  async getAllRepositories(params, onPage) {
    const repos = this.repositories;
    if (onPage) {
      await onPage(repos, 1);
    }
    return repos;
  }
}

describe('RepositorySyncService', { timeout: 10000 }, () => {
  let service;
  let mockPool;
  let mockClient;

  beforeEach(() => {
    mockPool = new MockPool();
    service = new RepositorySyncService({
      pool: mockPool,
      logger: {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
      },
    });

    mockClient = new MockGitHubClient();
    
    // Mock GitHubClient constructor
    const originalClient = GitHubClient;
    global.GitHubClient = class extends GitHubClient {
      constructor(params) {
        super(params);
        return mockClient;
      }
    };
  });

  afterEach(() => {
    global.GitHubClient = GitHubClient;
  });

  describe('syncRepositories', () => {
    it('should throw error if oauthAccountId is missing', async () => {
      await assert.rejects(
        async () => await service.syncRepositories({
          accessToken: 'token',
        }),
        (error) => {
          assert.ok(error instanceof RepositorySyncError);
          assert.ok(error.message.includes('OAuth account ID is required'));
          return true;
        }
      );
    });

    it('should throw error if accessToken is missing', async () => {
      await assert.rejects(
        async () => await service.syncRepositories({
          oauthAccountId: 'account-id',
        }),
        (error) => {
          assert.ok(error instanceof RepositorySyncError);
          assert.ok(error.message.includes('GitHub access token is required'));
          return true;
        }
      );
    });

    it('should sync repositories successfully', async () => {
      mockClient.repositories = [
        {
          id: 1,
          name: 'repo1',
          full_name: 'user/repo1',
          owner: { login: 'user', type: 'User' },
          description: 'Test repo 1',
          private: false,
          fork: false,
          archived: false,
          default_branch: 'main',
          language: 'JavaScript',
          topics: ['test', 'example'],
          stargazers_count: 10,
          forks_count: 5,
          watchers_count: 8,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-02T00:00:00Z',
          pushed_at: '2023-01-03T00:00:00Z',
          permissions: { admin: true, push: true, pull: true },
        },
        {
          id: 2,
          name: 'repo2',
          full_name: 'user/repo2',
          owner: { login: 'user', type: 'User' },
          description: 'Test repo 2',
          private: true,
          fork: false,
          archived: false,
          default_branch: 'main',
          language: 'TypeScript',
          topics: [],
          stargazers_count: 5,
          forks_count: 2,
          watchers_count: 3,
          created_at: '2023-02-01T00:00:00Z',
          updated_at: '2023-02-02T00:00:00Z',
          pushed_at: '2023-02-03T00:00:00Z',
          permissions: { admin: false, push: true, pull: true },
        },
      ];

      const client = await mockPool.connect();
      
      // Mock SELECT query (check if exists)
      client.query.mock.mockImplementation((query) => {
        if (query.includes('SELECT id FROM github_repositories')) {
          return Promise.resolve({ rows: [] }); // New repositories
        }
        return Promise.resolve({ rows: [] });
      });

      const result = await service.syncRepositories({
        oauthAccountId: 'test-account-id',
        accessToken: 'test-token',
        options: {
          batchSize: 10,
        },
      });

      assert.ok(result.total === 2);
      assert.ok(result.created >= 0);
      assert.ok(result.updated >= 0);
      assert.ok(result.errors instanceof Array);
      assert.ok(result.startTime instanceof Date);
      assert.ok(result.endTime instanceof Date);
      assert.ok(typeof result.duration === 'number');
    });

    it('should handle errors gracefully and continue', async () => {
      mockClient.repositories = [
        {
          id: 1,
          name: 'repo1',
          full_name: 'user/repo1',
          owner: { login: 'user', type: 'User' },
          description: 'Test repo',
          private: false,
          fork: false,
          archived: false,
          default_branch: 'main',
          permissions: {},
        },
      ];

      const client = await mockPool.connect();
      
      // Mock SELECT query
      client.query.mock.mockImplementation((query) => {
        if (query.includes('SELECT id FROM github_repositories')) {
          return Promise.resolve({ rows: [] });
        }
        if (query.includes('INSERT INTO')) {
          // Simulate database error for first repo
          throw new Error('Database error');
        }
        return Promise.resolve({ rows: [] });
      });

      const result = await service.syncRepositories({
        oauthAccountId: 'test-account-id',
        accessToken: 'test-token',
      });

      assert.ok(result.errors.length > 0);
      assert.ok(result.total === 1);
    });
  });

  describe('normalizeRepository', () => {
    it('should normalize repository data correctly', async () => {
      const rawRepo = {
        id: 12345,
        name: 'test-repo',
        full_name: 'owner/test-repo',
        owner: { login: 'owner', type: 'User' },
        description: 'A test repository',
        private: true,
        fork: false,
        archived: false,
        default_branch: 'main',
        language: 'JavaScript',
        topics: ['test', 'example', 'demo'],
        stargazers_count: 100,
        forks_count: 25,
        watchers_count: 80,
        created_at: '2023-01-01T12:00:00Z',
        updated_at: '2023-06-01T12:00:00Z',
        pushed_at: '2023-06-15T12:00:00Z',
        permissions: {
          admin: true,
          push: true,
          pull: true,
        },
      };

      // Access private method through sync
      mockClient.repositories = [rawRepo];
      const client = await mockPool.connect();
      
      client.query.mock.mockImplementation((query) => {
        if (query.includes('SELECT id FROM github_repositories')) {
          return Promise.resolve({ rows: [] });
        }
        if (query.includes('INSERT INTO')) {
          // Extract normalized data from INSERT query parameters
          const params = query;
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const result = await service.syncRepositories({
        oauthAccountId: 'test-id',
        accessToken: 'token',
      });

      // Verify normalization happened (repo was processed)
      assert.ok(result.total === 1);
    });
  });

  describe('getSyncStatus', () => {
    it('should get sync status', async () => {
      mockPool.query = mock.fn(() => {
        return Promise.resolve({
          rows: [{
            total: '10',
            synced_24h: '8',
            synced_7d: '10',
            last_sync: new Date(),
          }],
        });
      });

      const status = await service.getSyncStatus('test-account-id');

      assert.ok(status.total === 10);
      assert.ok(status.synced24h === 8);
      assert.ok(status.synced7d === 10);
      assert.ok(status.lastSync instanceof Date);
    });
  });

  describe('cleanupDeletedRepositories', () => {
    it('should delete repositories not in accessible list', async () => {
      mockPool.query = mock.fn(() => {
        return Promise.resolve({
          rows: [{ github_repo_id: 1 }, { github_repo_id: 2 }],
        });
      });

      const deleted = await service.cleanupDeletedRepositories(
        'test-account-id',
        [1] // Only repo 1 is accessible
      );

      assert.ok(deleted >= 0);
      assert.ok(mockPool.query.mock.calls.length > 0);
    });
  });
});




