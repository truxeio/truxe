/**
 * GitHub Organization Sync Service Tests
 *
 * Tests for organization synchronization, team mapping, and settings management.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import OrganizationSyncService from '../src/services/github/organization-sync.js';
import TeamRoleMappingService, {
  createMappingService,
  GITHUB_TEAM_ROLE_MAPPING,
} from '../src/services/github/team-role-mapping.js';
import OrganizationSettingsService from '../src/services/github/organization-settings.js';
import GitHubClient from '../src/services/github/github-client.js';

// Mock dependencies
jest.mock('../src/services/github/github-client.js');
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

describe('TeamRoleMappingService', () => {
  let mappingService;

  beforeEach(() => {
    mappingService = new TeamRoleMappingService();
  });

  describe('mapTeamToRole', () => {
    it('should map GitHub admin permission to admin role', () => {
      const result = mappingService.mapTeamToRole({
        permission: 'admin',
        teamSlug: 'admins',
      });

      expect(result.role).toBe('admin');
      expect(result.permissions).toContain('org:manage');
      expect(result.source).toBe('default');
    });

    it('should map GitHub read permission to viewer role', () => {
      const result = mappingService.mapTeamToRole({
        permission: 'read',
        teamSlug: 'viewers',
      });

      expect(result.role).toBe('viewer');
      expect(result.source).toBe('default');
    });

    it('should use custom mapping when provided', () => {
      const customMappings = {
        'engineering': {
          role: 'member',
          permissions: ['code:write', 'deploy:staging'],
        },
      };

      const service = new TeamRoleMappingService({ customMappings });
      const result = service.mapTeamToRole({
        permission: 'read',
        teamSlug: 'engineering',
      });

      expect(result.role).toBe('member');
      expect(result.permissions).toContain('code:write');
      expect(result.source).toBe('custom');
    });

    it('should match pattern-based custom mappings', () => {
      const customMappings = {
        'engineering-*': {
          role: 'member',
          permissions: ['code:write'],
        },
      };

      const service = new TeamRoleMappingService({ customMappings });
      const result = service.mapTeamToRole({
        permission: 'read',
        teamSlug: 'engineering-backend',
      });

      expect(result.role).toBe('member');
      expect(result.source).toBe('custom');
    });
  });

  describe('getEffectiveRole', () => {
    it('should return highest role from multiple teams', () => {
      const teamMemberships = [
        { permission: 'read', teamSlug: 'viewers' },
        { permission: 'write', teamSlug: 'developers' },
        { permission: 'admin', teamSlug: 'admins' },
      ];

      const result = mappingService.getEffectiveRole(teamMemberships);

      expect(result.role).toBe('admin');
      expect(result.permissions.length).toBeGreaterThan(0);
    });

    it('should merge permissions from all teams', () => {
      const teamMemberships = [
        { permission: 'read', teamSlug: 'viewers' },
        { permission: 'write', teamSlug: 'developers' },
      ];

      const result = mappingService.getEffectiveRole(teamMemberships);

      expect(result.role).toBe('member'); // write maps to member
      expect(result.permissions).toContain('code:read');
      expect(result.permissions).toContain('code:write');
    });

    it('should default to viewer when no teams provided', () => {
      const result = mappingService.getEffectiveRole([]);

      expect(result.role).toBe('viewer');
    });
  });

  describe('validateMapping', () => {
    it('should validate correct mapping', () => {
      const mapping = {
        role: 'admin',
        permissions: ['org:manage', 'members:manage'],
      };

      const result = mappingService.validateMapping(mapping);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid role', () => {
      const mapping = {
        role: 'invalid',
        permissions: [],
      };

      const result = mappingService.validateMapping(mapping);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject non-array permissions', () => {
      const mapping = {
        role: 'admin',
        permissions: 'not-an-array',
      };

      const result = mappingService.validateMapping(mapping);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Permissions must be an array');
    });
  });
});

describe('OrganizationSettingsService', () => {
  let settingsService;

  beforeEach(() => {
    settingsService = new OrganizationSettingsService();
  });

  describe('validateSettings', () => {
    it('should validate correct settings', () => {
      const settings = {
        auto_sync_enabled: true,
        sync_interval: '1h',
        sync_members: true,
        allowed_organizations: ['org1', 'org2'],
      };

      const result = settingsService.validateSettings(settings);

      expect(result.valid).toBe(true);
    });

    it('should reject invalid sync interval', () => {
      const settings = {
        sync_interval: 'invalid',
      };

      const result = settingsService.validateSettings(settings);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject invalid CIDR ranges', () => {
      const settings = {
        allowed_ip_ranges: ['not-a-cidr'],
      };

      const result = settingsService.validateSettings(settings);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should accept valid CIDR ranges', () => {
      const settings = {
        allowed_ip_ranges: ['192.168.1.0/24', '10.0.0.0/8'],
      };

      const result = settingsService.validateSettings(settings);

      expect(result.valid).toBe(true);
    });
  });

  describe('mergeSettings', () => {
    it('should merge with defaults', () => {
      const newSettings = {
        auto_sync_enabled: true,
        sync_members: false,
      };

      const merged = settingsService.mergeSettings({}, newSettings);

      expect(merged.auto_sync_enabled).toBe(true);
      expect(merged.sync_members).toBe(false);
      expect(merged.sync_interval).toBe('1h'); // From defaults
    });

    it('should preserve existing settings', () => {
      const current = {
        auto_sync_enabled: true,
        sync_interval: '6h',
      };

      const newSettings = {
        sync_members: false,
      };

      const merged = settingsService.mergeSettings(current, newSettings);

      expect(merged.auto_sync_enabled).toBe(true);
      expect(merged.sync_interval).toBe('6h');
      expect(merged.sync_members).toBe(false);
    });
  });

  describe('extractGitHubSettings', () => {
    it('should extract GitHub settings from organization settings', () => {
      const orgSettings = {
        github: {
          auto_sync_enabled: true,
          sync_interval: '12h',
        },
        other: 'setting',
      };

      const github = settingsService.extractGitHubSettings(orgSettings);

      expect(github.auto_sync_enabled).toBe(true);
      expect(github.sync_interval).toBe('12h');
    });

    it('should return defaults when no GitHub settings', () => {
      const orgSettings = {
        other: 'setting',
      };

      const github = settingsService.extractGitHubSettings(orgSettings);

      expect(github.auto_sync_enabled).toBe(false);
      expect(github.sync_interval).toBe('1h');
    });
  });

  describe('getSyncIntervalMs', () => {
    it('should convert 1h to milliseconds', () => {
      const orgSettings = {
        github: { sync_interval: '1h' },
      };

      const ms = settingsService.getSyncIntervalMs(orgSettings);

      expect(ms).toBe(60 * 60 * 1000);
    });

    it('should convert 24h to milliseconds', () => {
      const orgSettings = {
        github: { sync_interval: '24h' },
      };

      const ms = settingsService.getSyncIntervalMs(orgSettings);

      expect(ms).toBe(24 * 60 * 60 * 1000);
    });
  });
});

describe('OrganizationSyncService', () => {
  let syncService;
  let mockPool;
  let mockClient;

  beforeEach(() => {
    mockPool = {
      connect: jest.fn(() => Promise.resolve({
        query: jest.fn(() => Promise.resolve({ rows: [] })),
        release: jest.fn(),
      })),
      query: jest.fn(() => Promise.resolve({ rows: [] })),
    };

    mockClient = {
      getOrganization: jest.fn(),
      getTeams: jest.fn(),
      getOrganizationMembers: jest.fn(),
      request: jest.fn(),
    };

    syncService = new OrganizationSyncService({
      pool: mockPool,
      logger: console,
    });

    // Mock GitHubClient constructor
    GitHubClient.mockImplementation(() => mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('syncGitHubOrganization', () => {
    it('should throw error if orgLogin is missing', async () => {
      await expect(
        syncService.syncGitHubOrganization({
          accessToken: 'token',
          userId: 'user-id',
        })
      ).rejects.toThrow('GitHub organization login is required');
    });

    it('should throw error if accessToken is missing', async () => {
      await expect(
        syncService.syncGitHubOrganization({
          githubOrgLogin: 'org',
          userId: 'user-id',
        })
      ).rejects.toThrow('GitHub access token is required');
    });

    it('should throw error if userId is missing', async () => {
      await expect(
        syncService.syncGitHubOrganization({
          githubOrgLogin: 'org',
          accessToken: 'token',
        })
      ).rejects.toThrow('User ID is required');
    });

    it('should fetch organization from GitHub', async () => {
      const githubOrg = {
        id: 12345,
        login: 'test-org',
        name: 'Test Org',
        avatar_url: 'https://example.com/avatar',
        description: 'Test description',
      };

      mockClient.getOrganization.mockResolvedValue(githubOrg);
      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // No existing org
        .mockResolvedValueOnce({ rows: [] }); // Membership check

      // Mock organization service
      const { createOrganization } = await import('../src/services/organization.js');
      createOrganization.mockResolvedValue({
        id: 'truxe-org-id',
        name: 'Test Org',
        slug: 'test-org',
        settings: {},
      });

      const result = await syncService.syncGitHubOrganization({
        githubOrgLogin: 'test-org',
        accessToken: 'token',
        userId: 'user-id',
        options: {
          syncMembers: false,
          syncTeams: false,
        },
      });

      expect(mockClient.getOrganization).toHaveBeenCalledWith('test-org');
      expect(result.organization).toBeDefined();
    });
  });
});

describe('createMappingService', () => {
  it('should create service with organization settings', () => {
    const orgSettings = {
      github: {
        teamMappings: {
          'engineering': {
            role: 'member',
            permissions: ['code:write'],
          },
        },
      },
    };

    const service = createMappingService({ orgSettings });

    expect(service).toBeInstanceOf(TeamRoleMappingService);
    
    const result = service.mapTeamToRole({
      permission: 'read',
      teamSlug: 'engineering',
    });

    expect(result.role).toBe('member');
    expect(result.source).toBe('custom');
  });
});



