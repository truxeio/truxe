/**
 * GitHub Organization Sync Integration Tests
 *
 * Integration tests for the complete sync workflow including:
 * - Organization creation/update
 * - Member synchronization
 * - Team synchronization
 * - Role mapping
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import OrganizationSyncService from '../src/services/github/organization-sync.js';
import TeamRoleMappingService from '../src/services/github/team-role-mapping.js';
import OrganizationSettingsService from '../src/services/github/organization-settings.js';

// Mock dependencies
jest.mock('../src/database/connection.js', () => ({
  getPool: jest.fn(() => ({
    connect: jest.fn(),
    query: jest.fn(),
  })),
}));

jest.mock('../src/services/organization.js', () => ({
  createOrganization: jest.fn(),
  getOrganizationById: jest.fn(),
  updateOrganization: jest.fn(),
}));

// Mock GitHubClient as a constructor
const mockGitHubClientInstance = {
  getOrganization: jest.fn(),
  getTeams: jest.fn(),
  getOrganizationMembers: jest.fn(),
  request: jest.fn(),
};

jest.mock('../src/services/github/github-client.js', () => {
  return {
    __esModule: true,
    default: jest.fn(() => mockGitHubClientInstance),
  };
});

import GitHubClient from '../src/services/github/github-client.js';

describe('GitHub Organization Sync Integration', () => {
  let syncService;
  let mockPool;
  let mockClient;
  let mockGitHubClient;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    mockPool = {
      connect: jest.fn(() => Promise.resolve({
        query: jest.fn(() => Promise.resolve({ rows: [] })),
        release: jest.fn(),
      })),
      query: jest.fn(() => Promise.resolve({ rows: [] })),
    };

    mockClient = {
      query: jest.fn(() => Promise.resolve({ rows: [] })),
      release: jest.fn(),
    };

    // Reset the mock GitHub client instance methods
    mockGitHubClientInstance.getOrganization.mockResolvedValue({});
    mockGitHubClientInstance.getTeams.mockResolvedValue([]);
    mockGitHubClientInstance.getOrganizationMembers.mockResolvedValue([]);
    mockGitHubClientInstance.request.mockResolvedValue({});

    syncService = new OrganizationSyncService({
      pool: mockPool,
      logger: console,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Full Organization Sync Workflow', () => {
    it('should complete full sync workflow', async () => {
      const githubOrg = {
        id: 12345,
        login: 'test-org',
        name: 'Test Organization',
        description: 'Test description',
        avatar_url: 'https://example.com/avatar.png',
        company: 'Test Company',
      };

      const githubMembers = [
        { id: 1, login: 'user1', email: 'user1@example.com' },
        { id: 2, login: 'user2', email: 'user2@example.com' },
      ];

      const githubTeams = [
        {
          id: 1,
          slug: 'engineering',
          name: 'Engineering',
          permission: 'write',
        },
        {
          id: 2,
          slug: 'devops',
          name: 'DevOps',
          permission: 'admin',
        },
      ];

      // Setup mocks
      mockGitHubClient.getOrganization.mockResolvedValue(githubOrg);
      mockGitHubClient.getOrganizationMembers.mockResolvedValue(githubMembers);
      mockGitHubClient.getTeams.mockResolvedValue(githubTeams);

      // Mock pool queries
      mockPool.connect.mockResolvedValue(mockClient);
      
      // Mock organization creation
      const { createOrganization } = await import('../src/services/organization.js');
      createOrganization.mockResolvedValue({
        id: 'truxe-org-id',
        name: 'Test Organization',
        slug: 'test-org',
        settings: {
          github: {
            org_id: githubOrg.id,
            org_login: githubOrg.login,
          },
        },
      });

      // Mock user lookup (findOrCreateUser)
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // No existing org check
        .mockResolvedValueOnce({
          rows: [{ id: 'user-1-id', email: 'user1@example.com' }],
        }) // User 1 found
        .mockResolvedValueOnce({
          rows: [{ id: 'user-2-id', email: 'user2@example.com' }],
        }) // User 2 found
        .mockResolvedValueOnce({ rows: [] }) // No existing membership for user 1
        .mockResolvedValueOnce({ rows: [] }) // No existing membership for user 2
        .mockResolvedValueOnce({ rows: [] }) // Team membership check
        .mockResolvedValueOnce({ rows: [] }); // Team membership check

      // Mock team membership API calls
      mockGitHubClient.request
        .mockResolvedValueOnce({
          state: 'active',
          role: 'member',
        }) // User 1 in engineering
        .mockResolvedValueOnce({
          state: 'active',
          role: 'member',
        }) // User 1 in devops
        .mockResolvedValueOnce({
          state: 'active',
          role: 'member',
        }); // User 2 in engineering

      // Execute sync
      const result = await syncService.syncGitHubOrganization({
        githubOrgLogin: 'test-org',
        accessToken: 'test-token',
        userId: 'test-user-id',
        options: {
          syncMembers: true,
          syncTeams: true,
        },
      });

      // Verify results
      expect(result.organization).toBeDefined();
      expect(result.organization.id).toBe('truxe-org-id');
      expect(result.members.total).toBe(2);
      expect(result.teams.total).toBe(2);
      
      // Verify organization was created
      expect(createOrganization).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Organization',
          slug: 'test-org',
        })
      );
    });

    it('should handle member sync errors gracefully', async () => {
      const githubOrg = {
        id: 12345,
        login: 'test-org',
        name: 'Test Organization',
      };

      const githubMembers = [
        { id: 1, login: 'user1', email: 'user1@example.com' },
        { id: 2, login: 'user2' }, // No email - might fail
      ];

      mockGitHubClient.getOrganization.mockResolvedValue(githubOrg);
      mockGitHubClient.getOrganizationMembers.mockResolvedValue(githubMembers);
      mockGitHubClient.getTeams.mockResolvedValue([]);

      mockPool.connect.mockResolvedValue(mockClient);
      
      const { createOrganization } = await import('../src/services/organization.js');
      createOrganization.mockResolvedValue({
        id: 'truxe-org-id',
        name: 'Test Organization',
        slug: 'test-org',
        settings: {},
      });

      // User 1 found, user 2 not found
      mockClient.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ id: 'user-1-id', email: 'user1@example.com' }],
        })
        .mockResolvedValueOnce({ rows: [] }) // User 2 not found
        .mockResolvedValueOnce({ rows: [] }) // Membership check
        .mockResolvedValueOnce({ rows: [] });

      const result = await syncService.syncGitHubOrganization({
        githubOrgLogin: 'test-org',
        accessToken: 'test-token',
        userId: 'test-user-id',
        options: {
          syncMembers: true,
          syncTeams: false,
        },
      });

      expect(result.members.total).toBe(2);
      expect(result.members.errors.length).toBeGreaterThan(0);
      expect(result.members.created).toBe(1); // Only user1 synced
    });
  });

  describe('Team Role Mapping Integration', () => {
    it('should map teams to roles correctly', () => {
      const orgSettings = {
        github: {
          teamMappings: {
            'engineering': {
              role: 'member',
              permissions: ['code:write', 'deploy:staging'],
            },
            'devops': {
              role: 'admin',
              permissions: ['deploy:production'],
            },
          },
        },
      };

      const mappingService = TeamRoleMappingService.prototype.constructor
        ? new TeamRoleMappingService()
        : TeamRoleMappingService;

      const service = new TeamRoleMappingService({
        customMappings: orgSettings.github.teamMappings,
      });

      const engineering = service.mapTeamToRole({
        permission: 'write',
        teamSlug: 'engineering',
      });

      const devops = service.mapTeamToRole({
        permission: 'admin',
        teamSlug: 'devops',
      });

      expect(engineering.role).toBe('member');
      expect(engineering.permissions).toContain('code:write');
      expect(engineering.source).toBe('custom');

      expect(devops.role).toBe('admin');
      expect(devops.permissions).toContain('deploy:production');
      expect(devops.source).toBe('custom');
    });

    it('should calculate effective role from multiple teams', () => {
      const service = new TeamRoleMappingService();

      const teamMemberships = [
        { permission: 'read', teamSlug: 'viewers' },
        { permission: 'write', teamSlug: 'developers' },
        { permission: 'admin', teamSlug: 'admins' },
      ];

      const effective = service.getEffectiveRole(teamMemberships);

      expect(effective.role).toBe('admin'); // Highest role
      expect(effective.permissions.length).toBeGreaterThan(0);
    });
  });

  describe('Settings Management Integration', () => {
    it('should validate and merge settings correctly', () => {
      const settingsService = new OrganizationSettingsService();

      const currentSettings = {
        github: {
          auto_sync_enabled: false,
          sync_interval: '1h',
          sync_members: true,
        },
      };

      const newSettings = {
        auto_sync_enabled: true,
        sync_interval: '6h',
      };

      const merged = settingsService.mergeSettings(
        currentSettings.github,
        newSettings
      );

      expect(merged.auto_sync_enabled).toBe(true);
      expect(merged.sync_interval).toBe('6h');
      expect(merged.sync_members).toBe(true); // Preserved
    });

    it('should reject invalid settings', () => {
      const settingsService = new OrganizationSettingsService();

      const invalidSettings = {
        sync_interval: 'invalid',
        allowed_ip_ranges: ['not-a-cidr'],
      };

      const validation = settingsService.validateSettings(invalidSettings);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });
});



