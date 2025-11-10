/**
 * GitHub Team to Heimdall Role Mapping Service
 *
 * Maps GitHub team permissions and team names to Heimdall roles and permissions.
 * Supports custom team-based mappings and configurable role translations.
 *
 * Features:
 * - Default GitHub permission to Heimdall role mapping
 * - Custom team-based role assignments
 * - Permission inheritance
 * - Team slug pattern matching
 * - Validation and error handling
 */

/**
 * Default mapping from GitHub permissions to Heimdall roles
 */
export const GITHUB_TEAM_ROLE_MAPPING = {
  // GitHub permission → Heimdall role
  admin: 'admin',
  maintain: 'admin',
  write: 'member',
  triage: 'member',
  read: 'viewer',
};

/**
 * Default permission sets for each Heimdall role
 */
export const TRUXE_ROLE_PERMISSIONS = {
  owner: ['*'], // All permissions
  admin: [
    'org:manage',
    'members:manage',
    'settings:manage',
    'github:sync',
    'github:webhooks',
  ],
  member: [
    'code:read',
    'code:write',
    'deploy:staging',
    'github:repos:read',
  ],
  viewer: [
    'code:read',
    'github:repos:read',
  ],
};

/**
 * Team Role Mapping Service
 */
export class TeamRoleMappingService {
  constructor({ customMappings = {}, logger = console } = {}) {
    this.customMappings = customMappings;
    this.logger = logger;
  }

  /**
   * Map GitHub team permission to Heimdall role
   *
   * @param {Object} params
   * @param {string} params.permission - GitHub team permission (admin, maintain, write, triage, read)
   * @param {string} params.teamSlug - GitHub team slug
   * @param {string} params.teamName - GitHub team name (optional)
   * @returns {Object} Role and permissions mapping
   */
  mapTeamToRole({ permission, teamSlug, teamName = null }) {
    // Check for custom team mapping first
    const customMapping = this.findCustomMapping(teamSlug, teamName);
    if (customMapping) {
      this.logger.debug('Using custom team mapping', {
        teamSlug,
        teamName,
        mapping: customMapping,
      });
      return {
        role: customMapping.role,
        permissions: customMapping.permissions || this.getDefaultPermissions(customMapping.role),
        source: 'custom',
      };
    }

    // Use default permission-based mapping
    const role = GITHUB_TEAM_ROLE_MAPPING[permission] || 'viewer';
    const permissions = this.getDefaultPermissions(role);

    return {
      role,
      permissions,
      source: 'default',
    };
  }

  /**
   * Find custom mapping for a team
   *
   * @param {string} teamSlug - Team slug
   * @param {string} teamName - Team name
   * @returns {Object|null} Custom mapping or null
   * @private
   */
  findCustomMapping(teamSlug, teamName) {
    // Check exact slug match
    if (this.customMappings[teamSlug]) {
      return this.customMappings[teamSlug];
    }

    // Check exact name match (case-insensitive)
    if (teamName) {
      const nameKey = Object.keys(this.customMappings).find(
        key => key.toLowerCase() === teamName.toLowerCase()
      );
      if (nameKey) {
        return this.customMappings[nameKey];
      }
    }

    // Check pattern matching (e.g., "engineering-*")
    for (const [pattern, mapping] of Object.entries(this.customMappings)) {
      if (this.matchesPattern(teamSlug, pattern) || (teamName && this.matchesPattern(teamName, pattern))) {
        return mapping;
      }
    }

    return null;
  }

  /**
   * Check if a value matches a pattern (supports wildcards)
   *
   * @param {string} value - Value to check
   * @param {string} pattern - Pattern with optional wildcards (*)
   * @returns {boolean}
   * @private
   */
  matchesPattern(value, pattern) {
    if (!pattern.includes('*')) {
      return value.toLowerCase() === pattern.toLowerCase();
    }

    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').toLowerCase() + '$'
    );
    return regex.test(value.toLowerCase());
  }

  /**
   * Get default permissions for a role
   *
   * @param {string} role - Heimdall role
   * @returns {Array<string>} Permission list
   * @private
   */
  getDefaultPermissions(role) {
    return TRUXE_ROLE_PERMISSIONS[role] || TRUXE_ROLE_PERMISSIONS.viewer;
  }

  /**
   * Validate a role mapping configuration
   *
   * @param {Object} mapping - Mapping configuration
   * @returns {Object} Validation result
   */
  validateMapping(mapping) {
    const errors = [];

    if (!mapping.role) {
      errors.push('Role is required');
    } else if (!['owner', 'admin', 'member', 'viewer'].includes(mapping.role)) {
      errors.push(`Invalid role: ${mapping.role}. Must be one of: owner, admin, member, viewer`);
    }

    if (mapping.permissions) {
      if (!Array.isArray(mapping.permissions)) {
        errors.push('Permissions must be an array');
      } else {
        // Validate permission format
        mapping.permissions.forEach(perm => {
          if (typeof perm !== 'string') {
            errors.push('Each permission must be a string');
          }
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Load custom mappings from organization settings
   *
   * @param {Object} orgSettings - Organization settings
   * @returns {Object} Custom mappings
   */
  loadFromSettings(orgSettings) {
    const githubSettings = orgSettings?.github;
    if (!githubSettings) {
      return {};
    }

    return githubSettings.teamMappings || {};
  }

  /**
   * Get effective role for a user based on multiple teams
   *
   * When a user is in multiple teams, we use the highest role
   * (owner > admin > member > viewer) and merge permissions.
   *
   * @param {Array<Object>} teamMemberships - Array of team memberships
   * @returns {Object} Effective role and merged permissions
   */
  getEffectiveRole(teamMemberships) {
    if (!teamMemberships || teamMemberships.length === 0) {
      return {
        role: 'viewer',
        permissions: this.getDefaultPermissions('viewer'),
      };
    }

    const rolePriority = {
      owner: 4,
      admin: 3,
      member: 2,
      viewer: 1,
    };

    let highestRole = 'viewer';
    let highestPriority = 0;
    const allPermissions = new Set();

    for (const membership of teamMemberships) {
      const mapping = this.mapTeamToRole({
        permission: membership.permission || 'read',
        teamSlug: membership.teamSlug,
        teamName: membership.teamName,
      });

      const priority = rolePriority[mapping.role] || 0;
      if (priority > highestPriority) {
        highestPriority = priority;
        highestRole = mapping.role;
      }

      // Merge permissions
      mapping.permissions.forEach(perm => allPermissions.add(perm));
    }

    return {
      role: highestRole,
      permissions: Array.from(allPermissions).sort(),
    };
  }
}

/**
 * Create mapping service instance with organization settings
 *
 * @param {Object} params
 * @param {Object} params.orgSettings - Organization settings
 * @param {Object} params.options - Additional options
 * @returns {TeamRoleMappingService}
 */
export function createMappingService({ orgSettings, ...options } = {}) {
  const service = new TeamRoleMappingService(options);
  
  if (orgSettings) {
    const customMappings = service.loadFromSettings(orgSettings);
    service.customMappings = { ...service.customMappings, ...customMappings };
  }

  return service;
}

export default TeamRoleMappingService;



