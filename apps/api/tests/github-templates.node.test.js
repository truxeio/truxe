/**
 * Repository Templates Service Tests
 *
 * Unit tests for Repository Templates service including:
 * - Template listing
 * - Template retrieval
 * - Repository creation from templates
 * - Template file listing
 * - README retrieval
 */

import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import RepositoryTemplatesService from '../src/services/github/repository-templates.js';
import { GitHubClient } from '../src/services/github/github-client.js';

describe('RepositoryTemplatesService', { timeout: 10000 }, () => {
  let templatesService;
  let mockGitHubClient;

  beforeEach(() => {
    // Mock GitHub client
    mockGitHubClient = {
      request: mock.fn(),
      getRepository: mock.fn(),
    };

    templatesService = new RepositoryTemplatesService({
      githubClient: mockGitHubClient,
      logger: {
        error: () => {},
        info: () => {},
      },
    });
  });

  afterEach(() => {
    mockGitHubClient.request.mockReset();
    mockGitHubClient.getRepository.mockReset();
  });

  describe('listTemplates', () => {
    it('should list templates for an owner', async () => {
      const mockRepos = [
        { id: 1, name: 'template-1', is_template: true },
        { id: 2, name: 'regular-repo', is_template: false },
        { id: 3, name: 'template-2', is_template: true },
      ];

      mockGitHubClient.request.mock.mockImplementationOnce(async () => mockRepos);

      const templates = await templatesService.listTemplates('testorg');

      assert.equal(templates.length, 2);
      assert.equal(templates[0].name, 'template-1');
      assert.equal(templates[1].name, 'template-2');
      assert.ok(mockGitHubClient.request.mock.calls.length > 0);
    });

    it('should filter out non-template repositories', async () => {
      const mockRepos = [
        { id: 1, name: 'regular-repo-1', is_template: false },
        { id: 2, name: 'regular-repo-2', is_template: false },
      ];

      mockGitHubClient.request.mock.mockImplementationOnce(async () => mockRepos);

      const templates = await templatesService.listTemplates('testorg');

      assert.equal(templates.length, 0);
    });

    it('should handle errors gracefully', async () => {
      mockGitHubClient.request.mock.mockImplementationOnce(async () => {
        throw new Error('API error');
      });

      await assert.rejects(
        async () => await templatesService.listTemplates('testorg'),
        /API error/
      );
    });
  });

  describe('getTemplate', () => {
    it('should get template repository details', async () => {
      const mockRepo = {
        id: 1,
        name: 'template-repo',
        full_name: 'testorg/template-repo',
        is_template: true,
        description: 'A template repository',
      };

      mockGitHubClient.getRepository.mock.mockImplementationOnce(async () => mockRepo);

      const template = await templatesService.getTemplate('testorg', 'template-repo');

      assert.deepEqual(template, mockRepo);
      assert.ok(mockGitHubClient.getRepository.mock.calls.length > 0);
    });

    it('should throw error if repository is not a template', async () => {
      const mockRepo = {
        id: 1,
        name: 'regular-repo',
        is_template: false,
      };

      mockGitHubClient.getRepository.mock.mockImplementationOnce(async () => mockRepo);

      await assert.rejects(
        async () => await templatesService.getTemplate('testorg', 'regular-repo'),
        /is not a template/
      );
    });
  });

  describe('createFromTemplate', () => {
    it('should create repository from template', async () => {
      const mockResponse = {
        id: 100,
        name: 'new-repo',
        full_name: 'testorg/new-repo',
        private: false,
      };

      mockGitHubClient.request.mock.mockImplementationOnce(async () => mockResponse);

      const result = await templatesService.createFromTemplate(
        'templateorg',
        'template-repo',
        {
          name: 'new-repo',
          private: false,
        }
      );

      assert.deepEqual(result, mockResponse);
      assert.ok(mockGitHubClient.request.mock.calls.length > 0);
      const call = mockGitHubClient.request.mock.calls[0];
      assert.ok(call[0].includes('/generate'));
    });

    it('should require repository name', async () => {
      await assert.rejects(
        async () => await templatesService.createFromTemplate('org', 'template', {}),
        /Repository name is required/
      );
    });

    it('should include all branches if specified', async () => {
      const mockResponse = { id: 100, name: 'new-repo' };
      mockGitHubClient.request.mock.mockImplementationOnce(async () => mockResponse);

      await templatesService.createFromTemplate('org', 'template', {
        name: 'new-repo',
        include_all_branches: true,
      });

      const call = mockGitHubClient.request.mock.calls[0];
      const body = JSON.parse(call[1]?.body || '{}');
      assert.equal(body.include_all_branches, true);
    });
  });

  describe('getTemplateFiles', () => {
    it('should get template files', async () => {
      const mockRepo = {
        default_branch: 'main',
      };
      const mockContents = [
        { type: 'file', path: 'README.md', name: 'README.md', size: 1024 },
        { type: 'dir', path: 'src', name: 'src' },
        { type: 'file', path: 'package.json', name: 'package.json', size: 512 },
      ];

      mockGitHubClient.getRepository.mock.mockImplementationOnce(async () => mockRepo);
      mockGitHubClient.request.mock.mockImplementationOnce(async () => mockContents);

      const files = await templatesService.getTemplateFiles('org', 'template');

      assert.equal(files.length, 2); // Only files, not directories
      assert.equal(files[0].name, 'README.md');
      assert.equal(files[1].name, 'package.json');
    });

    it('should use provided ref if specified', async () => {
      const mockRepo = { default_branch: 'main' };
      const mockContents = [];

      mockGitHubClient.getRepository.mock.mockImplementationOnce(async () => mockRepo);
      mockGitHubClient.request.mock.mockImplementationOnce(async () => mockContents);

      await templatesService.getTemplateFiles('org', 'template', 'v1.0.0');

      const call = mockGitHubClient.request.mock.calls[0];
      assert.ok(call[0].includes('ref=v1.0.0'));
    });
  });

  describe('getTemplateReadme', () => {
    it('should get README content', async () => {
      const mockFile = {
        content: Buffer.from('# Template README').toString('base64'),
      };

      mockGitHubClient.request.mock.mockImplementationOnce(async () => mockFile);

      const readme = await templatesService.getTemplateReadme('org', 'template');

      assert.equal(readme, '# Template README');
    });

    it('should try multiple README filenames', async () => {
      // First attempt fails
      mockGitHubClient.request.mock.mockImplementationOnce(async () => {
        throw new Error('Not found');
      });

      // Second attempt succeeds
      mockGitHubClient.request.mock.mockImplementationOnce(async () => ({
        content: Buffer.from('# README').toString('base64'),
      }));

      const readme = await templatesService.getTemplateReadme('org', 'template');

      assert.equal(readme, '# README');
      assert.ok(mockGitHubClient.request.mock.calls.length >= 2);
    });

    it('should return null if README not found', async () => {
      mockGitHubClient.request.mock.mockImplementation(async () => {
        throw new Error('Not found');
      });

      const readme = await templatesService.getTemplateReadme('org', 'template');

      assert.equal(readme, null);
    });
  });

  describe('validateTemplate', () => {
    it('should return true for valid template', async () => {
      mockGitHubClient.getRepository.mock.mockImplementationOnce(async () => ({
        is_template: true,
      }));

      const isValid = await templatesService.validateTemplate('org', 'template');

      assert.equal(isValid, true);
    });

    it('should return false for non-template repository', async () => {
      mockGitHubClient.getRepository.mock.mockImplementationOnce(async () => ({
        is_template: false,
      }));

      const isValid = await templatesService.validateTemplate('org', 'repo');

      assert.equal(isValid, false);
    });

    it('should return false on error', async () => {
      mockGitHubClient.getRepository.mock.mockImplementationOnce(async () => {
        throw new Error('Not found');
      });

      const isValid = await templatesService.validateTemplate('org', 'invalid');

      assert.equal(isValid, false);
    });
  });
});

