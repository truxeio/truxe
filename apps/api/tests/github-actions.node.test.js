/**
 * GitHub Actions Service Tests
 *
 * Unit tests for GitHub Actions service including:
 * - Workflow listing and retrieval
 * - Workflow triggering
 * - Workflow run management
 * - Log access
 * - Secret management
 */

import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import GitHubActionsService from '../src/services/github/github-actions.js';

describe('GitHubActionsService', { timeout: 10000 }, () => {
  let actionsService;
  let mockGitHubClient;
  let mockPool;

  beforeEach(() => {
    mockGitHubClient = {
      request: mock.fn(),
      baseUrl: 'https://api.github.com',
      accessToken: 'test_token',
    };

    mockPool = {
      connect: mock.fn(),
      query: mock.fn(),
    };

    actionsService = new GitHubActionsService({
      githubClient: mockGitHubClient,
      logger: {
        error: () => {},
        warn: () => {},
        info: () => {},
      },
      pool: mockPool,
    });
  });

  afterEach(() => {
    mockGitHubClient.request.mockReset();
    mockPool.connect.mockReset();
    mockPool.query.mockReset();
  });

  describe('listWorkflows', () => {
    it('should list workflows for a repository', async () => {
      const mockResponse = {
        total_count: 2,
        workflows: [
          { id: 1, name: 'CI', path: '.github/workflows/ci.yml' },
          { id: 2, name: 'Deploy', path: '.github/workflows/deploy.yml' },
        ],
      };

      mockGitHubClient.request.mock.mockImplementationOnce(async () => mockResponse);

      const workflows = await actionsService.listWorkflows('owner', 'repo');

      assert.equal(workflows.total_count, 2);
      assert.equal(workflows.workflows.length, 2);
      assert.ok(mockGitHubClient.request.mock.calls[0][0].includes('/actions/workflows'));
    });
  });

  describe('getWorkflow', () => {
    it('should get workflow details', async () => {
      const mockWorkflow = {
        id: 123,
        name: 'CI Workflow',
        path: '.github/workflows/ci.yml',
        state: 'active',
      };

      mockGitHubClient.request.mock.mockImplementationOnce(async () => mockWorkflow);

      const workflow = await actionsService.getWorkflow('owner', 'repo', 123);

      assert.deepEqual(workflow, mockWorkflow);
      assert.ok(mockGitHubClient.request.mock.calls[0][0].includes('/actions/workflows/123'));
    });
  });

  describe('triggerWorkflow', () => {
    it('should trigger workflow dispatch', async () => {
      mockGitHubClient.request.mock.mockImplementationOnce(async () => undefined);

      await actionsService.triggerWorkflow('owner', 'repo', '123', {
        ref: 'main',
        inputs: { environment: 'production' },
      });

      const call = mockGitHubClient.request.mock.calls[0];
      assert.ok(call[0].includes('/actions/workflows/123/dispatches'));
      assert.equal(call[1]?.method, 'POST');
      const body = JSON.parse(call[1]?.body || '{}');
      assert.equal(body.ref, 'main');
      assert.deepEqual(body.inputs, { environment: 'production' });
    });

    it('should require ref parameter', async () => {
      await assert.rejects(
        async () => await actionsService.triggerWorkflow('owner', 'repo', '123', {}),
        /Git reference.*required/
      );
    });
  });

  describe('listWorkflowRuns', () => {
    it('should list workflow runs with filters', async () => {
      const mockRuns = {
        total_count: 10,
        workflow_runs: [
          { id: 1, status: 'completed', conclusion: 'success' },
          { id: 2, status: 'in_progress', conclusion: null },
        ],
      };

      mockGitHubClient.request.mock.mockImplementationOnce(async () => mockRuns);

      const runs = await actionsService.listWorkflowRuns('owner', 'repo', {
        status: 'completed',
        branch: 'main',
        perPage: 10,
      });

      assert.equal(runs.total_count, 10);
      assert.equal(runs.workflow_runs.length, 2);

      const call = mockGitHubClient.request.mock.calls[0];
      assert.ok(call[0].includes('/actions/runs'));
      assert.ok(call[0].includes('status=completed'));
      assert.ok(call[0].includes('branch=main'));
    });

    it('should list all runs when no filters provided', async () => {
      const mockRuns = { total_count: 0, workflow_runs: [] };
      mockGitHubClient.request.mock.mockImplementationOnce(async () => mockRuns);

      await actionsService.listWorkflowRuns('owner', 'repo');

      const call = mockGitHubClient.request.mock.calls[0];
      assert.ok(call[0].includes('/actions/runs'));
      assert.ok(!call[0].includes('status='));
    });
  });

  describe('getWorkflowRun', () => {
    it('should get workflow run details', async () => {
      const mockRun = {
        id: 12345,
        status: 'completed',
        conclusion: 'success',
        event: 'push',
        actor: { login: 'testuser' },
      };

      mockGitHubClient.request.mock.mockImplementationOnce(async () => mockRun);

      const run = await actionsService.getWorkflowRun('owner', 'repo', 12345);

      assert.deepEqual(run, mockRun);
      assert.ok(mockGitHubClient.request.mock.calls[0][0].includes('/actions/runs/12345'));
    });
  });

  describe('cancelWorkflowRun', () => {
    it('should cancel a workflow run', async () => {
      mockGitHubClient.request.mock.mockImplementationOnce(async () => undefined);

      await actionsService.cancelWorkflowRun('owner', 'repo', 12345);

      const call = mockGitHubClient.request.mock.calls[0];
      assert.ok(call[0].includes('/actions/runs/12345/cancel'));
      assert.equal(call[1]?.method, 'POST');
    });
  });

  describe('getWorkflowRunLogs', () => {
    it('should get workflow run logs URL', async () => {
      // Mock fetch for logs endpoint
      const mockFetch = mock.fn();
      global.fetch = mockFetch;

      const mockResponse = {
        status: 302,
        headers: new Map([['Location', 'https://logs.example.com/archive.zip']]),
      };

      mockFetch.mock.mockImplementationOnce(async () => mockResponse);

      const logs = await actionsService.getWorkflowRunLogs('owner', 'repo', 12345);

      assert.ok(logs.url);
      assert.equal(logs.url, 'https://logs.example.com/archive.zip');

      global.fetch = undefined;
    });

    it('should handle logs not available', async () => {
      const mockFetch = mock.fn();
      global.fetch = mockFetch;

      const mockResponse = {
        status: 204,
        headers: new Map(),
      };

      mockFetch.mock.mockImplementationOnce(async () => mockResponse);

      const logs = await actionsService.getWorkflowRunLogs('owner', 'repo', 12345);

      assert.equal(logs.url, null);
      assert.ok(logs.message.includes('not available'));

      global.fetch = undefined;
    });
  });

  describe('listSecrets', () => {
    it('should list repository secrets', async () => {
      const mockSecrets = {
        total_count: 2,
        secrets: [
          { name: 'API_KEY', created_at: '2024-01-01T00:00:00Z' },
          { name: 'DATABASE_URL', created_at: '2024-01-02T00:00:00Z' },
        ],
      };

      mockGitHubClient.request.mock.mockImplementationOnce(async () => mockSecrets);

      const secrets = await actionsService.listSecrets('owner', 'repo');

      assert.equal(secrets.total_count, 2);
      assert.ok(mockGitHubClient.request.mock.calls[0][0].includes('/actions/secrets'));
    });
  });

  describe('getPublicKey', () => {
    it('should get repository public key for encryption', async () => {
      const mockKey = {
        key_id: '123456',
        key: 'ssh-rsa AAAAB3...',
      };

      mockGitHubClient.request.mock.mockImplementationOnce(async () => mockKey);

      const key = await actionsService.getPublicKey('owner', 'repo');

      assert.equal(key.key_id, '123456');
      assert.ok(mockGitHubClient.request.mock.calls[0][0].includes('/actions/secrets/public-key'));
    });
  });

  describe('storeWorkflowRun', () => {
    it('should store workflow run in database', async () => {
      const mockClient = {
        query: mock.fn().mockResolvedValue({
          rows: [{
            id: 'uuid-123',
            workflow_run_id: 12345,
            repository_owner: 'owner',
            repository_name: 'repo',
            status: 'completed',
            conclusion: 'success',
          }],
        }),
        release: mock.fn(),
      };

      mockPool.connect.mock.mockImplementationOnce(async () => mockClient);

      const runData = {
        id: 12345,
        repository: { owner: { login: 'owner' }, name: 'repo' },
        workflow_id: 123,
        name: 'CI',
        status: 'completed',
        conclusion: 'success',
        event: 'push',
        actor: { login: 'testuser' },
        head_branch: 'main',
        head_sha: 'abc123',
        html_url: 'https://github.com/owner/repo/actions/runs/12345',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T01:00:00Z',
      };

      const result = await actionsService.storeWorkflowRun(runData);

      assert.ok(result);
      assert.equal(result.workflow_run_id, 12345);
      assert.ok(mockClient.query.mock.calls.length > 0);
    });

    it('should handle database pool not available', async () => {
      const serviceWithoutPool = new GitHubActionsService({
        githubClient: mockGitHubClient,
        logger: { warn: () => {} },
        pool: null,
      });

      const runData = { id: 12345, repository: { owner: { login: 'owner' }, name: 'repo' } };
      const result = await serviceWithoutPool.storeWorkflowRun(runData);

      // Should return runData when pool not available
      assert.deepEqual(result, runData);
    });
  });
});

