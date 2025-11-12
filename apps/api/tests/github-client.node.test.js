/**
 * GitHub API Client Tests
 *
 * Unit tests for the GitHub API client including:
 * - Authenticated requests
 * - Rate limit handling
 * - Retry logic with exponential backoff
 * - Error handling
 * - Pagination support
 */

import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { GitHubClient, GitHubAPIError } from '../src/services/github/github-client.js';

describe('GitHubClient', { timeout: 10000 }, () => {
  let client;
  let fetchMock;
  const mockAccessToken = 'test_access_token_123';

  beforeEach(() => {
    // Mock global fetch
    fetchMock = mock.fn();
    global.fetch = fetchMock;
    client = new GitHubClient({
      accessToken: mockAccessToken,
      options: {
        timeout: 5000,
        maxRetries: 2,
        retryDelay: 100,
        logger: {
          warn: () => {},
          error: () => {},
          debug: () => {},
        },
      },
    });
  });

  afterEach(() => {
    fetchMock.mockReset();
  });

  describe('constructor', () => {
    it('should create client with access token', () => {
      assert.ok(client instanceof GitHubClient);
      assert.equal(client.accessToken, mockAccessToken);
    });

    it('should throw error if access token is missing', () => {
      assert.throws(() => {
        new GitHubClient({});
      }, /GitHub access token is required/);
    });

    it('should use default options', () => {
      const defaultClient = new GitHubClient({ accessToken: 'token' });
      assert.equal(defaultClient.baseUrl, 'https://api.github.com');
      assert.equal(defaultClient.apiVersion, '2022-11-28');
      assert.equal(defaultClient.timeout, 30000);
      assert.equal(defaultClient.maxRetries, 3);
    });

    it('should use custom options', () => {
      const customClient = new GitHubClient({
        accessToken: 'token',
        options: {
          enterpriseUrl: 'https://github.example.com',
          apiVersion: '2023-01-01',
          timeout: 10000,
          maxRetries: 5,
        },
      });
      assert.equal(customClient.baseUrl, 'https://github.example.com');
      assert.equal(customClient.apiVersion, '2023-01-01');
      assert.equal(customClient.timeout, 10000);
      assert.equal(customClient.maxRetries, 5);
    });
  });

  describe('request method', () => {
    it('should make successful authenticated request', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([
          ['x-ratelimit-limit', '5000'],
          ['x-ratelimit-remaining', '4999'],
          ['x-ratelimit-reset', String(Math.floor(Date.now() / 1000) + 3600)],
        ]),
        json: async () => ({ id: 1, name: 'test' }),
      };

      fetchMock.mock.mockImplementationOnce(() => Promise.resolve(mockResponse));

      const result = await client.request('/user');

      assert.ok(fetchMock.mock.calls.length === 1);
      const call = fetchMock.mock.calls[0][0];
      assert.equal(call, 'https://api.github.com/user');
      
      const options = fetchMock.mock.calls[0][1];
      assert.equal(options.headers['Authorization'], `Bearer ${mockAccessToken}`);
      assert.equal(options.headers['Accept'], 'application/vnd.github+json');
      assert.equal(options.headers['X-GitHub-Api-Version'], '2022-11-28');
      
      assert.deepEqual(result, { id: 1, name: 'test' });
    });

    it('should update rate limit info from headers', async () => {
      const resetTime = Math.floor(Date.now() / 1000) + 3600;
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([
          ['x-ratelimit-limit', '5000'],
          ['x-ratelimit-remaining', '4999'],
          ['x-ratelimit-reset', String(resetTime)],
        ]),
        json: async () => ({}),
      };

      fetchMock.mock.mockImplementationOnce(() => Promise.resolve(mockResponse));

      await client.request('/user');

      const rateLimit = client.getRateLimit();
      assert.equal(rateLimit.limit, 5000);
      assert.equal(rateLimit.remaining, 4999);
      assert.equal(rateLimit.reset, resetTime);
    });

    it('should handle rate limit with retry-after', async () => {
      const resetTime = Math.floor(Date.now() / 1000) + 60;
      
      // First response: rate limited
      const rateLimitResponse = {
        ok: false,
        status: 403,
        headers: new Map([
          ['x-ratelimit-limit', '5000'],
          ['x-ratelimit-remaining', '0'],
          ['x-ratelimit-reset', String(resetTime)],
          ['retry-after', '5'],
        ]),
        json: async () => ({ message: 'API rate limit exceeded' }),
      };

      // Second response: success after retry
      const successResponse = {
        ok: true,
        status: 200,
        headers: new Map([
          ['x-ratelimit-limit', '5000'],
          ['x-ratelimit-remaining', '4999'],
          ['x-ratelimit-reset', String(resetTime + 60)],
        ]),
        json: async () => ({ id: 1 }),
      };

      fetchMock.mock
        .mockImplementationOnce(() => Promise.resolve(rateLimitResponse))
        .mockImplementationOnce(() => Promise.resolve(successResponse));

      const result = await client.request('/user');

      assert.ok(fetchMock.mock.calls.length === 2);
      assert.deepEqual(result, { id: 1 });
    });

    it('should throw GitHubAPIError on rate limit without retry', async () => {
      const resetTime = Math.floor(Date.now() / 1000) + 60;
      const mockResponse = {
        ok: false,
        status: 403,
        headers: new Map([
          ['x-ratelimit-limit', '5000'],
          ['x-ratelimit-remaining', '0'],
          ['x-ratelimit-reset', String(resetTime)],
        ]),
        json: async () => ({ message: 'API rate limit exceeded' }),
      };

      fetchMock.mock.mockImplementationOnce(() => Promise.resolve(mockResponse));

      const client = new GitHubClient({
        accessToken: 'token',
        options: { maxRetries: 0 },
      });

      await assert.rejects(
        async () => await client.request('/user'),
        (error) => {
          assert.ok(error instanceof GitHubAPIError);
          assert.equal(error.statusCode, 403);
          assert.ok(error.rateLimit);
          return true;
        }
      );
    });

    it('should retry on network errors with exponential backoff', async () => {
      const error = new Error('Network error');
      
      fetchMock.mock
        .mockImplementationOnce(() => Promise.reject(error))
        .mockImplementationOnce(() => Promise.resolve({
          ok: true,
          status: 200,
          headers: new Map(),
          json: async () => ({ id: 1 }),
        }));

      const result = await client.request('/user');

      assert.ok(fetchMock.mock.calls.length === 2);
      assert.deepEqual(result, { id: 1 });
    });

    it('should throw GitHubAPIError on 4xx errors', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        headers: new Map(),
        json: async () => ({ message: 'Not Found' }),
      };

      fetchMock.mock.mockImplementationOnce(() => Promise.resolve(mockResponse));

      await assert.rejects(
        async () => await client.request('/user'),
        (error) => {
          assert.ok(error instanceof GitHubAPIError);
          assert.equal(error.statusCode, 404);
          return true;
        }
      );
    });

    it('should handle timeout', async () => {
      fetchMock.mock.mockImplementationOnce(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              status: 200,
              headers: new Map(),
              json: async () => ({}),
            });
          }, 10000); // Longer than timeout
        });
      });

      const client = new GitHubClient({
        accessToken: 'token',
        options: { timeout: 100 },
      });

      await assert.rejects(
        async () => await client.request('/user'),
        (error) => {
          assert.ok(error instanceof GitHubAPIError);
          assert.equal(error.statusCode, 504);
          return true;
        }
      );
    });
  });

  describe('repository methods', () => {
    it('should get user repositories', async () => {
      const mockRepos = [
        { id: 1, name: 'repo1', full_name: 'user/repo1' },
        { id: 2, name: 'repo2', full_name: 'user/repo2' },
      ];

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map(),
        json: async () => mockRepos,
      };

      fetchMock.mock.mockImplementationOnce(() => Promise.resolve(mockResponse));

      const repos = await client.getRepositories({ type: 'all', per_page: 30 });

      assert.ok(fetchMock.mock.calls.length === 1);
      const url = new URL(fetchMock.mock.calls[0][0]);
      assert.equal(url.pathname, '/user/repos');
      assert.equal(url.searchParams.get('type'), 'all');
      assert.equal(url.searchParams.get('per_page'), '30');
      assert.deepEqual(repos, mockRepos);
    });

    it('should get repository details', async () => {
      const mockRepo = {
        id: 1,
        name: 'test-repo',
        full_name: 'owner/test-repo',
        description: 'Test repository',
      };

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map(),
        json: async () => mockRepo,
      };

      fetchMock.mock.mockImplementationOnce(() => Promise.resolve(mockResponse));

      const repo = await client.getRepository('owner', 'test-repo');

      assert.ok(fetchMock.mock.calls.length === 1);
      assert.equal(fetchMock.mock.calls[0][0], 'https://api.github.com/repos/owner/test-repo');
      assert.deepEqual(repo, mockRepo);
    });

    it('should get repository commits', async () => {
      const mockCommits = [
        { sha: 'abc123', message: 'Initial commit' },
        { sha: 'def456', message: 'Update README' },
      ];

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map(),
        json: async () => mockCommits,
      };

      fetchMock.mock.mockImplementationOnce(() => Promise.resolve(mockResponse));

      const commits = await client.getRepositoryCommits('owner', 'repo', {
        sha: 'main',
        per_page: 10,
      });

      assert.ok(fetchMock.mock.calls.length === 1);
      const url = new URL(fetchMock.mock.calls[0][0]);
      assert.equal(url.pathname, '/repos/owner/repo/commits');
      assert.equal(url.searchParams.get('sha'), 'main');
      assert.equal(url.searchParams.get('per_page'), '10');
      assert.deepEqual(commits, mockCommits);
    });
  });

  describe('organization methods', () => {
    it('should get user organizations', async () => {
      const mockOrgs = [
        { id: 1, login: 'org1', name: 'Organization 1' },
        { id: 2, login: 'org2', name: 'Organization 2' },
      ];

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map(),
        json: async () => mockOrgs,
      };

      fetchMock.mock.mockImplementationOnce(() => Promise.resolve(mockResponse));

      const orgs = await client.getOrganizations();

      assert.equal(fetchMock.mock.calls[0][0], 'https://api.github.com/user/orgs');
      assert.deepEqual(orgs, mockOrgs);
    });

    it('should get organization details', async () => {
      const mockOrg = {
        id: 1,
        login: 'test-org',
        name: 'Test Organization',
      };

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map(),
        json: async () => mockOrg,
      };

      fetchMock.mock.mockImplementationOnce(() => Promise.resolve(mockResponse));

      const org = await client.getOrganization('test-org');

      assert.equal(fetchMock.mock.calls[0][0], 'https://api.github.com/orgs/test-org');
      assert.deepEqual(org, mockOrg);
    });
  });
});




