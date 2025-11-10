/**
 * GitHub Organizations API Routes Tests
 *
 * Integration tests for GitHub organization API endpoints.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import Fastify from 'fastify';
import githubOrganizationRoutes from '../src/routes/github-organizations.js';

// Mock dependencies
jest.mock('../src/services/github/organization-sync.js');
jest.mock('../src/services/github/organization-settings.js');
jest.mock('../src/services/github/github-client.js');
jest.mock('../src/database/connection.js', () => ({
  getPool: jest.fn(() => ({
    query: jest.fn(() => Promise.resolve({ rows: [] })),
    connect: jest.fn(() => Promise.resolve({
      query: jest.fn(() => Promise.resolve({ rows: [] })),
      release: jest.fn(),
    })),
  })),
}));
jest.mock('../src/services/organization.js', () => ({
  createOrganization: jest.fn(),
  getOrganizationById: jest.fn(),
  updateOrganization: jest.fn(),
}));
jest.mock('../src/services/oauth/token-encryptor.js', () => ({
  default: jest.fn().mockImplementation(() => ({
    decrypt: jest.fn((token) => `decrypted-${token}`),
  })),
}));

describe('GitHub Organizations API Routes', () => {
  let app;
  let authToken;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    
    // Mock authentication
    app.decorate('authenticate', async (request, reply) => {
      if (!request.headers.authorization) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }
      request.user = {
        id: 'test-user-id',
        email: 'test@example.com',
      };
    });

    await app.register(githubOrganizationRoutes, { prefix: '/api/github/organizations' });

    // Generate test token
    authToken = 'Bearer test-token';

    // Setup default mocks
    const { getPool } = await import('../src/database/connection.js');
    getPool().query.mockResolvedValue({
      rows: [{
        access_token: 'encrypted-token',
        refresh_token: null,
      }],
    });
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  describe('POST /api/github/organizations/sync', () => {
    it('should sync GitHub organization successfully', async () => {
      const OrganizationSyncService = (await import('../src/services/github/organization-sync.js')).default;
      const mockSync = jest.fn().mockResolvedValue({
        organization: {
          id: 'org-id',
          name: 'Test Org',
          slug: 'test-org',
        },
        members: {
          total: 10,
          created: 5,
          updated: 5,
          errors: [],
        },
        teams: {
          total: 3,
          synced: 3,
          errors: [],
        },
        duration: 1000,
      });

      OrganizationSyncService.mockImplementation(() => ({
        syncGitHubOrganization: mockSync,
      }));

      const response = await app.inject({
        method: 'POST',
        url: '/api/github/organizations/sync',
        headers: {
          authorization: authToken,
        },
        payload: {
          orgLogin: 'test-org',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.result.organization).toBeDefined();
      expect(body.result.members.total).toBe(10);
    });

    it('should return 401 if GitHub account not linked', async () => {
      const { getPool } = await import('../src/database/connection.js');
      getPool().query.mockResolvedValueOnce({
        rows: [], // No OAuth account
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/github/organizations/sync',
        headers: {
          authorization: authToken,
        },
        payload: {
          orgLogin: 'test-org',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('GitHub account not linked');
    });

    it('should accept sync options', async () => {
      const OrganizationSyncService = (await import('../src/services/github/organization-sync.js')).default;
      const mockSync = jest.fn().mockResolvedValue({
        organization: { id: 'org-id', name: 'Test Org' },
        members: { total: 0, created: 0, updated: 0, errors: [] },
        teams: { total: 0, synced: 0, errors: [] },
        duration: 500,
      });

      OrganizationSyncService.mockImplementation(() => ({
        syncGitHubOrganization: mockSync,
      }));

      const response = await app.inject({
        method: 'POST',
        url: '/api/github/organizations/sync',
        headers: {
          authorization: authToken,
        },
        payload: {
          orgLogin: 'test-org',
          syncMembers: false,
          syncTeams: true,
          memberBatchSize: 25,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockSync).toHaveBeenCalledWith(
        expect.objectContaining({
          githubOrgLogin: 'test-org',
          options: expect.objectContaining({
            syncMembers: false,
            syncTeams: true,
            memberBatchSize: 25,
          }),
        })
      );
    });
  });

  describe('GET /api/github/organizations', () => {
    it('should list user GitHub organizations', async () => {
      const GitHubClient = (await import('../src/services/github/github-client.js')).default;
      const mockGetOrganizations = jest.fn().mockResolvedValue([
        { id: 1, login: 'org1', name: 'Organization 1' },
        { id: 2, login: 'org2', name: 'Organization 2' },
      ]);

      GitHubClient.mockImplementation(() => ({
        getOrganizations: mockGetOrganizations,
      }));

      const response = await app.inject({
        method: 'GET',
        url: '/api/github/organizations',
        headers: {
          authorization: authToken,
        },
        query: {
          limit: '10',
          page: '1',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.organizations).toHaveLength(2);
      expect(body.pagination.total).toBe(2);
    });

    it('should paginate results correctly', async () => {
      const GitHubClient = (await import('../src/services/github/github-client.js')).default;
      const mockOrgs = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        login: `org${i + 1}`,
        name: `Organization ${i + 1}`,
      }));

      GitHubClient.mockImplementation(() => ({
        getOrganizations: jest.fn().mockResolvedValue(mockOrgs),
      }));

      const response = await app.inject({
        method: 'GET',
        url: '/api/github/organizations?limit=10&page=2',
        headers: {
          authorization: authToken,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.organizations).toHaveLength(10);
      expect(body.pagination.page).toBe(2);
      expect(body.pagination.hasMore).toBe(true);
    });
  });

  describe('GET /api/github/organizations/:orgLogin', () => {
    it('should get GitHub organization details', async () => {
      const GitHubClient = (await import('../src/services/github/github-client.js')).default;
      const mockOrg = {
        id: 12345,
        login: 'test-org',
        name: 'Test Organization',
        description: 'Test description',
      };

      GitHubClient.mockImplementation(() => ({
        getOrganization: jest.fn().mockResolvedValue(mockOrg),
      }));

      const { getPool } = await import('../src/database/connection.js');
      getPool().query
        .mockResolvedValueOnce({
          rows: [{
            access_token: 'encrypted-token',
          }],
        })
        .mockResolvedValueOnce({
          rows: [], // No Truxe org
        });

      const response = await app.inject({
        method: 'GET',
        url: '/api/github/organizations/test-org',
        headers: {
          authorization: authToken,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.organization.login).toBe('test-org');
      expect(body.organization.truxe).toBeNull();
    });

    it('should include Truxe organization if exists', async () => {
      const GitHubClient = (await import('../src/services/github/github-client.js')).default;
      GitHubClient.mockImplementation(() => ({
        getOrganization: jest.fn().mockResolvedValue({
          id: 12345,
          login: 'test-org',
          name: 'Test Organization',
        }),
      }));

      const { getPool } = await import('../src/database/connection.js');
      getPool().query
        .mockResolvedValueOnce({
          rows: [{ access_token: 'encrypted-token' }],
        })
        .mockResolvedValueOnce({
          rows: [{
            id: 'truxe-org-id',
            name: 'Test Organization',
            slug: 'test-org',
          }],
        });

      const response = await app.inject({
        method: 'GET',
        url: '/api/github/organizations/test-org',
        headers: {
          authorization: authToken,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.organization.truxe).toBeDefined();
      expect(body.organization.truxe.id).toBe('truxe-org-id');
    });
  });

  describe('GET /api/github/organizations/:orgLogin/settings', () => {
    it('should get organization GitHub settings', async () => {
      const OrganizationSettingsService = (await import('../src/services/github/organization-settings.js')).default;
      const mockExtractSettings = jest.fn().mockReturnValue({
        auto_sync_enabled: true,
        sync_interval: '6h',
        sync_members: true,
      });

      OrganizationSettingsService.mockImplementation(() => ({
        extractGitHubSettings: mockExtractSettings,
      }));

      const { getPool } = await import('../src/database/connection.js');
      getPool().query.mockResolvedValue({
        rows: [{
          id: 'org-id',
          name: 'Test Org',
          slug: 'test-org',
          settings: {
            github: {
              auto_sync_enabled: true,
            },
          },
        }],
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/github/organizations/test-org/settings',
        headers: {
          authorization: authToken,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.settings).toBeDefined();
    });

    it('should return 404 if organization not found', async () => {
      const { getPool } = await import('../src/database/connection.js');
      getPool().query.mockResolvedValue({
        rows: [],
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/github/organizations/nonexistent/settings',
        headers: {
          authorization: authToken,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PUT /api/github/organizations/:orgLogin/settings', () => {
    it('should update organization settings', async () => {
      const OrganizationSettingsService = (await import('../src/services/github/organization-settings.js')).default;
      const mockUpdateSettings = jest.fn().mockReturnValue({
        github: {
          auto_sync_enabled: true,
          sync_interval: '12h',
        },
      });

      const mockExtractSettings = jest.fn().mockReturnValue({
        auto_sync_enabled: true,
        sync_interval: '12h',
      });

      OrganizationSettingsService.mockImplementation(() => ({
        updateGitHubSettings: mockUpdateSettings,
        extractGitHubSettings: mockExtractSettings,
      }));

      const { getPool } = await import('../src/database/connection.js');
      getPool().query.mockResolvedValue({
        rows: [{
          id: 'org-id',
          name: 'Test Org',
          slug: 'test-org',
          settings: {},
        }],
      });

      const { updateOrganization } = await import('../src/services/organization.js');
      updateOrganization.mockResolvedValue({
        id: 'org-id',
        name: 'Test Org',
        settings: {
          github: {
            auto_sync_enabled: true,
            sync_interval: '12h',
          },
        },
      });

      const response = await app.inject({
        method: 'PUT',
        url: '/api/github/organizations/test-org/settings',
        headers: {
          authorization: authToken,
        },
        payload: {
          auto_sync_enabled: true,
          sync_interval: '12h',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.settings.auto_sync_enabled).toBe(true);
    });

    it('should validate settings before updating', async () => {
      const OrganizationSettingsService = (await import('../src/services/github/organization-settings.js')).default;
      OrganizationSettingsService.mockImplementation(() => ({
        updateGitHubSettings: jest.fn().mockImplementation(() => {
          throw new Error('Invalid sync_interval: invalid. Must be one of: 1h, 6h, 12h, 24h');
        }),
        extractGitHubSettings: jest.fn(),
      }));

      const { getPool } = await import('../src/database/connection.js');
      getPool().query.mockResolvedValue({
        rows: [{
          id: 'org-id',
          name: 'Test Org',
          slug: 'test-org',
          settings: {},
        }],
      });

      const response = await app.inject({
        method: 'PUT',
        url: '/api/github/organizations/test-org/settings',
        headers: {
          authorization: authToken,
        },
        payload: {
          sync_interval: 'invalid',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Failed to update settings');
    });
  });

  describe('GET /api/github/organizations/:orgLogin/teams', () => {
    it('should list organization teams', async () => {
      const GitHubClient = (await import('../src/services/github/github-client.js')).default;
      const mockTeams = [
        { id: 1, slug: 'engineering', name: 'Engineering' },
        { id: 2, slug: 'design', name: 'Design' },
      ];

      GitHubClient.mockImplementation(() => ({
        getTeams: jest.fn().mockResolvedValue(mockTeams),
      }));

      const response = await app.inject({
        method: 'GET',
        url: '/api/github/organizations/test-org/teams',
        headers: {
          authorization: authToken,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.teams).toHaveLength(2);
    });
  });

  describe('GET /api/github/organizations/:orgLogin/members', () => {
    it('should list organization members', async () => {
      const GitHubClient = (await import('../src/services/github/github-client.js')).default;
      const mockMembers = Array.from({ length: 25 }, (_, i) => ({
        id: i + 1,
        login: `user${i + 1}`,
        avatar_url: `https://example.com/avatar${i + 1}`,
      }));

      GitHubClient.mockImplementation(() => ({
        getOrganizationMembers: jest.fn().mockResolvedValue(mockMembers),
      }));

      const response = await app.inject({
        method: 'GET',
        url: '/api/github/organizations/test-org/members?limit=10&page=1',
        headers: {
          authorization: authToken,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.members).toHaveLength(10);
      expect(body.pagination.total).toBe(25);
      expect(body.pagination.hasMore).toBe(true);
    });
  });
});



