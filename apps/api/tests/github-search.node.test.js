/**
 * GitHub Search Service Tests
 *
 * Unit tests for GitHub Search service including:
 * - Repository search with filters
 * - Code search
 * - Issue search
 * - User search
 * - Query building
 * - Saved searches
 */

import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import GitHubSearchService from '../src/services/github/github-search.js';

describe('GitHubSearchService', { timeout: 10000 }, () => {
  let searchService;
  let mockGitHubClient;
  let mockPool;

  beforeEach(() => {
    mockGitHubClient = {
      request: mock.fn(),
    };

    mockPool = {
      connect: mock.fn(),
    };

    searchService = new GitHubSearchService({
      githubClient: mockGitHubClient,
      logger: {
        error: () => {},
      },
      pool: mockPool,
    });
  });

  afterEach(() => {
    mockGitHubClient.request.mockReset();
    mockPool.connect.mockReset();
  });

  describe('searchRepositories', () => {
    it('should search repositories with query', async () => {
      const mockResults = {
        total_count: 100,
        items: [{ id: 1, name: 'repo1' }, { id: 2, name: 'repo2' }],
      };

      mockGitHubClient.request.mock.mockImplementationOnce(async () => mockResults);

      const results = await searchService.searchRepositories({ q: 'test query' });

      assert.equal(results.total_count, 100);
      assert.equal(results.items.length, 2);
      assert.ok(mockGitHubClient.request.mock.calls[0][0].includes('/search/repositories'));
      assert.ok(mockGitHubClient.request.mock.calls[0][0].includes('q=test+query'));
    });

    it('should require query parameter', async () => {
      await assert.rejects(
        async () => await searchService.searchRepositories({}),
        /Search query.*required/
      );
    });

    it('should include sort and order parameters', async () => {
      const mockResults = { total_count: 0, items: [] };
      mockGitHubClient.request.mock.mockImplementationOnce(async () => mockResults);

      await searchService.searchRepositories({
        q: 'test',
        sort: 'stars',
        order: 'desc',
        perPage: 50,
        page: 2,
      });

      const call = mockGitHubClient.request.mock.calls[0][0];
      assert.ok(call.includes('sort=stars'));
      assert.ok(call.includes('order=desc'));
      assert.ok(call.includes('per_page=50'));
      assert.ok(call.includes('page=2'));
    });
  });

  describe('searchCode', () => {
    it('should search code', async () => {
      const mockResults = {
        total_count: 50,
        items: [{ name: 'file.js', path: 'src/file.js' }],
      };

      mockGitHubClient.request.mock.mockImplementationOnce(async () => mockResults);

      const results = await searchService.searchCode({ q: 'function test' });

      assert.equal(results.total_count, 50);
      assert.ok(mockGitHubClient.request.mock.calls[0][0].includes('/search/code'));
    });
  });

  describe('searchIssues', () => {
    it('should search issues', async () => {
      const mockResults = {
        total_count: 25,
        items: [{ number: 1, title: 'Bug fix' }],
      };

      mockGitHubClient.request.mock.mockImplementationOnce(async () => mockResults);

      const results = await searchService.searchIssues({ q: 'bug' });

      assert.equal(results.total_count, 25);
      assert.ok(mockGitHubClient.request.mock.calls[0][0].includes('/search/issues'));
    });
  });

  describe('searchUsers', () => {
    it('should search users', async () => {
      const mockResults = {
        total_count: 10,
        items: [{ login: 'user1', id: 1 }],
      };

      mockGitHubClient.request.mock.mockImplementationOnce(async () => mockResults);

      const results = await searchService.searchUsers({ q: 'john' });

      assert.equal(results.total_count, 10);
      assert.ok(mockGitHubClient.request.mock.calls[0][0].includes('/search/users'));
    });
  });

  describe('buildRepositoryQuery', () => {
    it('should build basic query', () => {
      const query = searchService.buildRepositoryQuery({
        query: 'test',
      });

      assert.equal(query, 'test');
    });

    it('should build query with language filter', () => {
      const query = searchService.buildRepositoryQuery({
        query: 'test',
        language: 'javascript',
      });

      assert.ok(query.includes('test'));
      assert.ok(query.includes('language:javascript'));
    });

    it('should build query with multiple filters', () => {
      const query = searchService.buildRepositoryQuery({
        query: 'test',
        language: 'javascript',
        topic: 'react',
        minStars: 100,
        maxStars: 1000,
        license: 'mit',
        archived: false,
        user: 'testorg',
      });

      assert.ok(query.includes('test'));
      assert.ok(query.includes('language:javascript'));
      assert.ok(query.includes('topic:react'));
      assert.ok(query.includes('stars:>=100'));
      assert.ok(query.includes('stars:<=1000'));
      assert.ok(query.includes('license:mit'));
      assert.ok(query.includes('archived:false'));
      assert.ok(query.includes('user:testorg'));
    });

    it('should handle empty filters', () => {
      const query = searchService.buildRepositoryQuery({});

      assert.equal(query, '');
    });
  });

  describe('saveSearch', () => {
    it('should save search query to database', async () => {
      const mockClient = {
        query: mock.fn().mockResolvedValue({
          rows: [{
            id: 'uuid-123',
            user_id: 'user-123',
            name: 'My Search',
            search_type: 'repository',
            query: 'test query',
            filters: JSON.stringify({ language: 'javascript' }),
            created_at: new Date(),
            updated_at: new Date(),
          }],
        }),
        release: mock.fn(),
      };

      mockPool.connect.mock.mockImplementationOnce(async () => mockClient);

      const searchData = {
        name: 'My Search',
        type: 'repository',
        query: 'test query',
        filters: { language: 'javascript' },
      };

      const result = await searchService.saveSearch('user-123', searchData);

      assert.equal(result.name, 'My Search');
      assert.equal(result.search_type, 'repository');
      assert.ok(mockClient.query.mock.calls.length > 0);
    });

    it('should throw error if pool not available', async () => {
      const serviceWithoutPool = new GitHubSearchService({
        githubClient: mockGitHubClient,
        logger: {},
        pool: null,
      });

      await assert.rejects(
        async () => await serviceWithoutPool.saveSearch('user-123', {}),
        /Database pool required/
      );
    });
  });

  describe('listSavedSearches', () => {
    it('should list saved searches for user', async () => {
      const mockClient = {
        query: mock.fn().mockResolvedValue({
          rows: [
            {
              id: 'uuid-1',
              name: 'Search 1',
              search_type: 'repository',
              query: 'query1',
              filters: JSON.stringify({}),
              created_at: new Date(),
              updated_at: new Date(),
            },
            {
              id: 'uuid-2',
              name: 'Search 2',
              search_type: 'code',
              query: 'query2',
              filters: JSON.stringify({}),
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        }),
        release: mock.fn(),
      };

      mockPool.connect.mock.mockImplementationOnce(async () => mockClient);

      const searches = await searchService.listSavedSearches('user-123');

      assert.equal(searches.length, 2);
      assert.equal(searches[0].name, 'Search 1');
      assert.ok(mockClient.query.mock.calls.length > 0);
    });

    it('should filter by type if specified', async () => {
      const mockClient = {
        query: mock.fn().mockResolvedValue({ rows: [] }),
        release: mock.fn(),
      };

      mockPool.connect.mock.mockImplementationOnce(async () => mockClient);

      await searchService.listSavedSearches('user-123', 'repository');

      const call = mockClient.query.mock.calls[0][0];
      assert.ok(call.includes('search_type'));
    });

    it('should return empty array if pool not available', async () => {
      const serviceWithoutPool = new GitHubSearchService({
        githubClient: mockGitHubClient,
        logger: {},
        pool: null,
      });

      const searches = await serviceWithoutPool.listSavedSearches('user-123');

      assert.deepEqual(searches, []);
    });
  });

  describe('deleteSavedSearch', () => {
    it('should delete saved search', async () => {
      const mockClient = {
        query: mock.fn().mockResolvedValue({}),
        release: mock.fn(),
      };

      mockPool.connect.mock.mockImplementationOnce(async () => mockClient);

      await searchService.deleteSavedSearch('user-123', 'search-id');

      assert.ok(mockClient.query.mock.calls.length > 0);
      const call = mockClient.query.mock.calls[0][0];
      assert.ok(call.includes('DELETE'));
      assert.ok(call.includes('search-id'));
    });

    it('should throw error if pool not available', async () => {
      const serviceWithoutPool = new GitHubSearchService({
        githubClient: mockGitHubClient,
        logger: {},
        pool: null,
      });

      await assert.rejects(
        async () => await serviceWithoutPool.deleteSavedSearch('user-123', 'search-id'),
        /Database pool required/
      );
    });
  });
});

