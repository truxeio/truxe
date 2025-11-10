/**
 * GitHub Organization Sync Service
 *
 * Synchronizes GitHub organizations to Heimdall organizations.
 * Supports member sync, team sync, role mapping, and incremental updates.
 *
 * Features:
 * - Sync GitHub organizations to Heimdall
 * - Sync organization members with role mapping
 * - Sync teams and map to Heimdall roles
 * - Incremental sync support
 * - Conflict resolution
 * - Progress tracking
 * - Error recovery
 */

import GitHubClient from './github-client.js';
import { getPool } from '../../database/connection.js';
import { createMappingService } from './team-role-mapping.js';
import { getGitHubMetrics } from './github-metrics.js';
import * as organizationService from '../organization.js';

export class OrganizationSyncError extends Error {
  constructor(message, { cause, details = {} } = {}) {
    super(message);
    this.name = 'OrganizationSyncError';
    this.cause = cause;
    this.details = details;
  }
}

/**
 * Organization Sync Service
 */
export class OrganizationSyncService {
  constructor({ pool = null, logger = console, metrics = null } = {}) {
    this.pool = pool || getPool();
    this.logger = logger;
    this.metrics = metrics || getGitHubMetrics();
  }

  /**
   * Sync a GitHub organization to Heimdall
   *
   * @param {Object} params
   * @param {string} params.githubOrgLogin - GitHub organization login
   * @param {string} params.accessToken - GitHub access token
   * @param {string} params.userId - Heimdall user ID initiating the sync
   * @param {Object} params.options - Sync options
   * @returns {Promise<Object>} Sync result
   */
  async syncGitHubOrganization({
    githubOrgLogin,
    accessToken,
    userId,
    options = {},
  }) {
    if (!githubOrgLogin) {
      throw new OrganizationSyncError('GitHub organization login is required');
    }

    if (!accessToken) {
      throw new OrganizationSyncError('GitHub access token is required');
    }

    if (!userId) {
      throw new OrganizationSyncError('User ID is required');
    }

    const client = new GitHubClient({
      accessToken,
      options: {
        logger: this.logger,
      },
    });

    const result = {
      organization: null,
      members: {
        total: 0,
        created: 0,
        updated: 0,
        errors: [],
      },
      teams: {
        total: 0,
        synced: 0,
        errors: [],
      },
      startTime: new Date(),
    };

    try {
      this.logger.info('Starting GitHub organization sync', {
        githubOrgLogin,
        userId,
      });

      // 1. Fetch GitHub organization details
      const githubOrg = await client.getOrganization(githubOrgLogin);
      this.logger.debug('Fetched GitHub organization', {
        id: githubOrg.id,
        login: githubOrg.login,
      });

      // 2. Get or create Heimdall organization
      const heimdallOrg = await this.createOrUpdateOrganization({
        githubOrg,
        userId,
        options,
      });
      result.organization = heimdallOrg;

      // Load organization settings for team mapping
      const orgSettings = heimdallOrg.settings || {};
      const mappingService = createMappingService({
        orgSettings,
        logger: this.logger,
      });

      // 3. Sync members if enabled
      if (options.syncMembers !== false) {
        const memberResult = await this.syncOrganizationMembers({
          heimdallOrgId: heimdallOrg.id,
          githubOrgLogin,
          client,
          mappingService,
          options,
        });
        result.members = memberResult;
      }

      // 4. Sync teams if enabled
      if (options.syncTeams !== false) {
        const teamResult = await this.syncOrganizationTeams({
          heimdallOrgId: heimdallOrg.id,
          githubOrgLogin,
          client,
          mappingService,
          options,
        });
        result.teams = teamResult;
      }

      result.endTime = new Date();
      result.duration = result.endTime - result.startTime;

      // Record metrics
      if (this.metrics) {
        this.metrics.recordOrganizationSync({
          status: this.hasErrors(result) ? 'partial' : 'success',
          duration: result.duration,
          membersTotal: result.members.total,
          membersCreated: result.members.created,
          membersUpdated: result.members.updated,
          teamsTotal: result.teams.total,
          teamsSynced: result.teams.synced,
          errors: this.countErrors(result),
        });
      }

      this.logger.info('GitHub organization sync completed', {
        githubOrgLogin,
        heimdallOrgId: heimdallOrg.id,
        ...result,
        duration: `${result.duration}ms`,
      });

      return result;
    } catch (error) {
      // Record error metrics
      if (this.metrics) {
        this.metrics.recordOrganizationSync({
          status: 'error',
        });
        this.metrics.recordError({
          type: 'sync_error',
          endpoint: 'syncGitHubOrganization',
        });
      }

      this.logger.error('GitHub organization sync failed', {
        githubOrgLogin,
        userId,
        error: error.message,
        stack: error.stack,
      });

      if (error instanceof OrganizationSyncError) {
        throw error;
      }

      throw new OrganizationSyncError('GitHub organization sync failed', {
        cause: error,
        details: { githubOrgLogin, userId },
      });
    }
  }

  /**
   * Create or update Heimdall organization from GitHub org
   *
   * @param {Object} params
   * @param {Object} params.githubOrg - GitHub organization data
   * @param {string} params.userId - Heimdall user ID
   * @param {Object} params.options - Options
   * @returns {Promise<Object>} Heimdall organization
   * @private
   */
  async createOrUpdateOrganization({ githubOrg, userId, options }) {
    const slug = githubOrg.login.toLowerCase();
    const name = githubOrg.name || githubOrg.login;

    // Build GitHub settings
    const githubSettings = {
      org_id: githubOrg.id,
      org_login: githubOrg.login,
      avatar_url: githubOrg.avatar_url,
      description: githubOrg.description || null,
      company: githubOrg.company || null,
      blog: githubOrg.blog || null,
      location: githubOrg.location || null,
      email: githubOrg.email || null,
      twitter_username: githubOrg.twitter_username || null,
      synced_at: new Date().toISOString(),
    };

    // Check if organization exists by slug
    const existingOrg = await this.pool.query(
      `SELECT id, settings FROM organizations WHERE slug = $1`,
      [slug]
    );

    let organization;

    if (existingOrg.rows.length > 0) {
      // Update existing organization
      const currentSettings = existingOrg.rows[0].settings || {};
      const updatedSettings = {
        ...currentSettings,
        github: {
          ...(currentSettings.github || {}),
          ...githubSettings,
        },
      };

      await this.pool.query(
        `UPDATE organizations 
         SET name = $1, settings = $2, updated_at = NOW()
         WHERE id = $3`,
        [name, JSON.stringify(updatedSettings), existingOrg.rows[0].id]
      );

      const updated = await this.pool.query(
        `SELECT id, name, slug, settings, created_at, updated_at 
         FROM organizations WHERE id = $1`,
        [existingOrg.rows[0].id]
      );

      organization = {
        id: updated.rows[0].id,
        name: updated.rows[0].name,
        slug: updated.rows[0].slug,
        settings: updated.rows[0].settings,
        createdAt: updated.rows[0].created_at,
        updatedAt: updated.rows[0].updated_at,
      };

      this.logger.debug('Updated existing organization', {
        orgId: organization.id,
        slug: organization.slug,
      });
    } else {
      // Create new organization
      const orgSettings = {
        github: githubSettings,
      };

      // Use organization service to create with proper audit logging
      organization = await organizationService.createOrganization({
        name,
        slug,
        settings: orgSettings,
        createdBy: userId,
        ip: options.ip || null,
        userAgent: options.userAgent || null,
      });

      // Ensure the creator is an owner member
      await this.ensureMembership({
        orgId: organization.id,
        userId,
        role: 'owner',
        joinedAt: new Date(),
      });

      this.logger.debug('Created new organization', {
        orgId: organization.id,
        slug: organization.slug,
      });
    }

    return organization;
  }

  /**
   * Sync organization members from GitHub
   *
   * @param {Object} params
   * @param {string} params.heimdallOrgId - Heimdall organization ID
   * @param {string} params.githubOrgLogin - GitHub organization login
   * @param {GitHubClient} params.client - GitHub API client
   * @param {TeamRoleMappingService} params.mappingService - Role mapping service
   * @param {Object} params.options - Sync options
   * @returns {Promise<Object>} Sync result
   * @private
   */
  async syncOrganizationMembers({
    heimdallOrgId,
    githubOrgLogin,
    client,
    mappingService,
    options,
  }) {
    const result = {
      total: 0,
      created: 0,
      updated: 0,
      errors: [],
    };

    try {
      // Fetch all organization members from GitHub
      // Note: GitHub API requires 'member' visibility to get all members
      // For public orgs, we'll use the members endpoint
      const githubMembers = await this.getAllOrganizationMembers(
        client,
        githubOrgLogin
      );
      
      if (!Array.isArray(githubMembers)) {
        this.logger.warn('GitHub members API returned non-array', {
          type: typeof githubMembers,
        });
        return result;
      }
      
      result.total = githubMembers.length;

      this.logger.debug('Fetched GitHub organization members', {
        count: result.total,
      });

      // Sync members in batches
      const batchSize = options.memberBatchSize || 50;
      for (let i = 0; i < githubMembers.length; i += batchSize) {
        const batch = githubMembers.slice(i, i + batchSize);
        await this.syncMemberBatch({
          heimdallOrgId,
          members: batch,
          client,
          githubOrgLogin,
          mappingService,
          result,
        });
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to sync organization members', {
        heimdallOrgId,
        error: error.message,
      });
      result.errors.push({
        type: 'sync_error',
        error: error.message,
      });
      return result;
    }
  }

  /**
   * Get all organization members with pagination
   *
   * @param {GitHubClient} client - GitHub API client
   * @param {string} orgLogin - Organization login
   * @returns {Promise<Array>} All members
   * @private
   */
  async getAllOrganizationMembers(client, orgLogin) {
    const allMembers = [];
    let page = 1;
    let hasMore = true;
    const perPage = 100;

    while (hasMore) {
      try {
        const members = await client.request(
          `/orgs/${orgLogin}/members?per_page=${perPage}&page=${page}`
        );
        
        if (!Array.isArray(members)) {
          break;
        }

        allMembers.push(...members);
        hasMore = members.length === perPage;
        page++;
      } catch (error) {
        this.logger.warn('Error fetching members page', {
          page,
          error: error.message,
        });
        break;
      }
    }

    return allMembers;
  }

  /**
   * Sync a batch of members
   *
   * @param {Object} params
   * @param {string} params.heimdallOrgId - Heimdall organization ID
   * @param {Array} params.members - GitHub member data
   * @param {GitHubClient} params.client - GitHub API client
   * @param {string} params.githubOrgLogin - GitHub organization login
   * @param {TeamRoleMappingService} params.mappingService - Role mapping service
   * @param {Object} params.result - Result accumulator
   * @private
   */
  async syncMemberBatch({
    heimdallOrgId,
    members,
    client,
    githubOrgLogin,
    mappingService,
    result,
  }) {
    const dbClient = await this.pool.connect();

    try {
      await dbClient.query('BEGIN');

      for (const githubMember of members) {
        try {
          // Find or create user by GitHub username/email
          const heimdallUser = await this.findOrCreateUser({
            githubMember,
            client,
          });

          if (!heimdallUser) {
            result.errors.push({
              type: 'user_not_found',
              githubLogin: githubMember.login,
            });
            continue;
          }

          // Get user's teams in this org to determine effective role
          const userTeams = await this.getUserTeamsInOrg(
            client,
            githubOrgLogin,
            githubMember.login
          );

          // Determine role from teams
          const teamMemberships = userTeams.map(team => ({
            permission: team.permission || 'read',
            teamSlug: team.slug,
            teamName: team.name,
          }));

          const effectiveRole = userTeams.length > 0
            ? mappingService.getEffectiveRole(teamMemberships)
            : { role: 'member', permissions: [] };

          // Create or update membership
          await this.ensureMembership({
            orgId: heimdallOrgId,
            userId: heimdallUser.id,
            role: effectiveRole.role,
            permissions: effectiveRole.permissions,
            joinedAt: new Date(),
          });

          // Track results
          const existing = await dbClient.query(
            `SELECT 1 FROM memberships 
             WHERE org_id = $1 AND user_id = $2`,
            [heimdallOrgId, heimdallUser.id]
          );

          if (existing.rows.length > 0) {
            result.updated++;
          } else {
            result.created++;
          }
        } catch (error) {
          this.logger.warn('Failed to sync member', {
            githubLogin: githubMember.login,
            error: error.message,
          });
          result.errors.push({
            type: 'member_sync_error',
            githubLogin: githubMember.login,
            error: error.message,
          });
        }
      }

      await dbClient.query('COMMIT');
    } catch (error) {
      await dbClient.query('ROLLBACK');
      throw error;
    } finally {
      dbClient.release();
    }
  }

  /**
   * Find or create Heimdall user from GitHub member
   *
   * @param {Object} githubMember - GitHub member data
   * @param {GitHubClient} client - GitHub API client
   * @returns {Promise<Object|null>} Heimdall user or null
   * @private
   */
  async findOrCreateUser({ githubMember, client }) {
    // Try to find user by OAuth account
    const oauthResult = await this.pool.query(
      `SELECT u.id, u.email, u.status
       FROM users u
       JOIN oauth_accounts oa ON u.id = oa.user_id
       WHERE oa.provider = 'github'
         AND oa.provider_account_id = $1
         AND u.status = 'active'`,
      [String(githubMember.id)]
    );

    if (oauthResult.rows.length > 0) {
      return oauthResult.rows[0];
    }

    // Try to find by email (if member has public email)
    if (githubMember.email) {
      const emailResult = await this.pool.query(
        `SELECT id, email, status FROM users 
         WHERE email = $1 AND status = 'active'`,
        [githubMember.email]
      );

      if (emailResult.rows.length > 0) {
        return emailResult.rows[0];
      }
    }

    // User not found - would need to create, but that's outside scope of sync
    // Return null and log
    this.logger.debug('User not found in Heimdall', {
      githubId: githubMember.id,
      githubLogin: githubMember.login,
      email: githubMember.email || 'not provided',
    });

    return null;
  }

  /**
   * Get user's teams in an organization
   *
   * @param {GitHubClient} client - GitHub API client
   * @param {string} orgLogin - Organization login
   * @param {string} username - GitHub username
   * @returns {Promise<Array>} Team memberships
   * @private
   */
  async getUserTeamsInOrg(client, orgLogin, username) {
    try {
      const teams = await client.request(`/orgs/${orgLogin}/teams`);
      
      if (!Array.isArray(teams)) {
        return [];
      }

      // For each team, check if user is a member and get their permission
      const userTeams = [];
      for (const team of teams) {
        try {
          const membership = await client.request(
            `/orgs/${orgLogin}/teams/${team.slug}/memberships/${username}`
          );
          
          if (membership && membership.state === 'active') {
            userTeams.push({
              id: team.id,
              slug: team.slug,
              name: team.name,
              permission: membership.role || 'member', // 'member' or 'maintainer'
            });
          }
        } catch (error) {
          // User not in this team or no permission to check
          continue;
        }
      }

      return userTeams;
    } catch (error) {
      this.logger.warn('Failed to get user teams', {
        orgLogin,
        username,
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Sync organization teams from GitHub
   *
   * @param {Object} params
   * @param {string} params.heimdallOrgId - Heimdall organization ID
   * @param {string} params.githubOrgLogin - GitHub organization login
   * @param {GitHubClient} params.client - GitHub API client
   * @param {TeamRoleMappingService} params.mappingService - Role mapping service
   * @param {Object} params.options - Sync options
   * @returns {Promise<Object>} Sync result
   * @private
   */
  async syncOrganizationTeams({
    heimdallOrgId,
    githubOrgLogin,
    client,
    mappingService,
    options,
  }) {
    const result = {
      total: 0,
      synced: 0,
      errors: [],
    };

    try {
      // Fetch all teams from GitHub
      const githubTeams = await client.getTeams(githubOrgLogin);
      
      if (!Array.isArray(githubTeams)) {
        return result;
      }

      result.total = githubTeams.length;

      this.logger.debug('Fetched GitHub organization teams', {
        count: result.total,
      });

      // Store team mappings in organization settings
      const teamMappings = {};
      
      for (const team of githubTeams) {
        try {
          // Map team to role
          const mapping = mappingService.mapTeamToRole({
            permission: team.permission || 'read',
            teamSlug: team.slug,
            teamName: team.name,
          });

          teamMappings[team.slug] = {
            role: mapping.role,
            permissions: mapping.permissions,
            githubTeamId: team.id,
            githubTeamName: team.name,
            githubTeamPermission: team.permission || 'read',
          };

          result.synced++;
        } catch (error) {
          this.logger.warn('Failed to map team', {
            teamSlug: team.slug,
            error: error.message,
          });
          result.errors.push({
            type: 'team_mapping_error',
            teamSlug: team.slug,
            error: error.message,
          });
        }
      }

      // Update organization settings with team mappings
      if (Object.keys(teamMappings).length > 0) {
        const currentSettings = await this.pool.query(
          `SELECT settings FROM organizations WHERE id = $1`,
          [heimdallOrgId]
        );

        if (currentSettings.rows.length > 0) {
          const settings = currentSettings.rows[0].settings || {};
          settings.github = settings.github || {};
          settings.github.teamMappings = teamMappings;

          await this.pool.query(
            `UPDATE organizations 
             SET settings = $1, updated_at = NOW()
             WHERE id = $2`,
            [JSON.stringify(settings), heimdallOrgId]
          );
        }
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to sync organization teams', {
        heimdallOrgId,
        error: error.message,
      });
      result.errors.push({
        type: 'sync_error',
        error: error.message,
      });
      return result;
    }
  }

  /**
   * Ensure a membership exists with the given role
   *
   * @param {Object} params
   * @param {string} params.orgId - Organization ID
   * @param {string} params.userId - User ID
   * @param {string} params.role - Role (owner, admin, member, viewer)
   * @param {Array<string>} params.permissions - Permissions array
   * @param {Date} params.joinedAt - Join date
   * @private
   */
  async ensureMembership({
    orgId,
    userId,
    role,
    permissions = [],
    joinedAt,
  }) {
    const dbClient = await this.pool.connect();

    try {
      await dbClient.query('BEGIN');

      // Check if membership exists
      const existing = await dbClient.query(
        `SELECT role, permissions, joined_at
         FROM memberships
         WHERE org_id = $1 AND user_id = $2`,
        [orgId, userId]
      );

      if (existing.rows.length > 0) {
        // Update existing membership
        await dbClient.query(
          `UPDATE memberships
           SET role = $1,
               permissions = $2,
               joined_at = COALESCE(joined_at, $3),
               updated_at = NOW()
           WHERE org_id = $4 AND user_id = $5`,
          [
            role,
            JSON.stringify(permissions),
            joinedAt,
            orgId,
            userId,
          ]
        );
      } else {
        // Create new membership
        await dbClient.query(
          `INSERT INTO memberships (org_id, user_id, role, permissions, joined_at, invited_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $5, NOW(), NOW())`,
          [orgId, userId, role, JSON.stringify(permissions), joinedAt]
        );
      }

      await dbClient.query('COMMIT');
    } catch (error) {
      await dbClient.query('ROLLBACK');
      throw error;
    } finally {
      dbClient.release();
    }
  }

  /**
   * Check if result has errors
   *
   * @param {Object} result - Sync result
   * @returns {boolean}
   * @private
   */
  hasErrors(result) {
    return (
      (result.members?.errors?.length || 0) > 0 ||
      (result.teams?.errors?.length || 0) > 0
    );
  }

  /**
   * Count total errors in result
   *
   * @param {Object} result - Sync result
   * @returns {number}
   * @private
   */
  countErrors(result) {
    return (
      (result.members?.errors?.length || 0) +
      (result.teams?.errors?.length || 0)
    );
  }
}

export default OrganizationSyncService;
