/**
 * GitHub Organization Settings Service
 *
 * Manages GitHub-specific organization settings including:
 * - Auto-sync configuration
 * - SSO settings
 * - Security settings
 * - Webhook settings
 * - Team mappings
 *
 * Features:
 * - Settings validation
 * - Default settings
 * - Settings migration
 * - Settings schema validation
 */

/**
 * Default GitHub organization settings
 */
export const DEFAULT_GITHUB_SETTINGS = {
  // Auto-sync settings
  auto_sync_enabled: false,
  sync_interval: '1h', // '1h', '6h', '12h', '24h'
  sync_members: true,
  sync_teams: true,
  sync_repositories: false,

  // SSO settings
  require_github_sso: false,
  allowed_organizations: [], // Array of GitHub org logins

  // Security settings
  require_2fa: false,
  allowed_ip_ranges: [], // Array of CIDR ranges

  // Webhook settings
  webhook_secret: null, // Encrypted webhook secret
  webhook_events: ['push', 'pull_request'], // Default events

  // Team mappings (custom role mappings)
  teamMappings: {},
};

/**
 * Valid sync intervals
 */
export const VALID_SYNC_INTERVALS = ['1h', '6h', '12h', '24h'];

/**
 * Valid webhook events
 */
export const VALID_WEBHOOK_EVENTS = [
  'push',
  'pull_request',
  'issues',
  'issue_comment',
  'create',
  'delete',
  'fork',
  'release',
  'organization',
  'member',
  'membership',
  'team',
  'workflow_run',
  'workflow_job',
  'security_advisory',
  'secret_scanning_alert',
  'code_scanning_alert',
];

/**
 * Organization Settings Service
 */
export class OrganizationSettingsService {
  constructor({ logger = console } = {}) {
    this.logger = logger;
  }

  /**
   * Validate GitHub settings
   *
   * @param {Object} settings - Settings to validate
   * @returns {Object} Validation result
   */
  validateSettings(settings) {
    const errors = [];

    if (!settings || typeof settings !== 'object') {
      return {
        valid: false,
        errors: ['Settings must be an object'],
      };
    }

    // Validate sync interval
    if (settings.sync_interval && !VALID_SYNC_INTERVALS.includes(settings.sync_interval)) {
      errors.push(
        `Invalid sync_interval: ${settings.sync_interval}. Must be one of: ${VALID_SYNC_INTERVALS.join(', ')}`
      );
    }

    // Validate allowed_organizations
    if (settings.allowed_organizations) {
      if (!Array.isArray(settings.allowed_organizations)) {
        errors.push('allowed_organizations must be an array');
      } else {
        settings.allowed_organizations.forEach((org, index) => {
          if (typeof org !== 'string' || org.trim().length === 0) {
            errors.push(`allowed_organizations[${index}] must be a non-empty string`);
          }
        });
      }
    }

    // Validate allowed_ip_ranges
    if (settings.allowed_ip_ranges) {
      if (!Array.isArray(settings.allowed_ip_ranges)) {
        errors.push('allowed_ip_ranges must be an array');
      } else {
        settings.allowed_ip_ranges.forEach((range, index) => {
          if (typeof range !== 'string' || !this.isValidCIDR(range)) {
            errors.push(`allowed_ip_ranges[${index}] must be a valid CIDR range (e.g., 192.168.1.0/24)`);
          }
        });
      }
    }

    // Validate webhook_events
    if (settings.webhook_events) {
      if (!Array.isArray(settings.webhook_events)) {
        errors.push('webhook_events must be an array');
      } else {
        settings.webhook_events.forEach((event, index) => {
          if (!VALID_WEBHOOK_EVENTS.includes(event)) {
            errors.push(
              `webhook_events[${index}] "${event}" is not a valid webhook event. Must be one of: ${VALID_WEBHOOK_EVENTS.join(', ')}`
            );
          }
        });
      }
    }

    // Validate teamMappings
    if (settings.teamMappings) {
      if (typeof settings.teamMappings !== 'object') {
        errors.push('teamMappings must be an object');
      } else {
        for (const [teamSlug, mapping] of Object.entries(settings.teamMappings)) {
          if (!mapping.role || !['owner', 'admin', 'member', 'viewer'].includes(mapping.role)) {
            errors.push(`teamMappings["${teamSlug}"].role must be one of: owner, admin, member, viewer`);
          }

          if (mapping.permissions && !Array.isArray(mapping.permissions)) {
            errors.push(`teamMappings["${teamSlug}"].permissions must be an array`);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if a string is a valid CIDR range
   *
   * @param {string} cidr - CIDR range string
   * @returns {boolean}
   * @private
   */
  isValidCIDR(cidr) {
    const cidrRegex = /^([0-9]{1,3}\.){3}[0-9]{1,3}\/([0-9]|[1-2][0-9]|3[0-2])$/;
    if (!cidrRegex.test(cidr)) {
      return false;
    }

    const [ip, prefix] = cidr.split('/');
    const parts = ip.split('.');

    return parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    }) && parseInt(prefix, 10) >= 0 && parseInt(prefix, 10) <= 32;
  }

  /**
   * Get default GitHub settings
   *
   * @returns {Object} Default settings
   */
  getDefaultSettings() {
    return { ...DEFAULT_GITHUB_SETTINGS };
  }

  /**
   * Merge settings with defaults
   *
   * @param {Object} currentSettings - Current settings
   * @param {Object} newSettings - New settings to merge
   * @returns {Object} Merged settings
   */
  mergeSettings(currentSettings = {}, newSettings = {}) {
    const defaults = this.getDefaultSettings();
    const current = { ...defaults, ...currentSettings };
    const merged = { ...current, ...newSettings };

    // Deep merge for nested objects like teamMappings
    if (current.teamMappings && newSettings.teamMappings) {
      merged.teamMappings = {
        ...current.teamMappings,
        ...newSettings.teamMappings,
      };
    }

    // Deep merge for allowed_organizations (replace, not merge arrays)
    if (newSettings.allowed_organizations !== undefined) {
      merged.allowed_organizations = newSettings.allowed_organizations;
    }

    if (newSettings.allowed_ip_ranges !== undefined) {
      merged.allowed_ip_ranges = newSettings.allowed_ip_ranges;
    }

    if (newSettings.webhook_events !== undefined) {
      merged.webhook_events = newSettings.webhook_events;
    }

    return merged;
  }

  /**
   * Extract GitHub settings from organization settings
   *
   * @param {Object} orgSettings - Full organization settings
   * @returns {Object} GitHub settings or defaults
   */
  extractGitHubSettings(orgSettings) {
    if (!orgSettings || !orgSettings.github) {
      return this.getDefaultSettings();
    }

    return this.mergeSettings(orgSettings.github, {});
  }

  /**
   * Update GitHub settings in organization settings
   *
   * @param {Object} orgSettings - Full organization settings
   * @param {Object} githubSettings - GitHub settings to update
   * @returns {Object} Updated organization settings
   */
  updateGitHubSettings(orgSettings = {}, githubSettings = {}) {
    const validation = this.validateSettings(githubSettings);
    if (!validation.valid) {
      throw new Error(`Invalid GitHub settings: ${validation.errors.join(', ')}`);
    }

    const currentGitHub = this.extractGitHubSettings(orgSettings);
    const mergedGitHub = this.mergeSettings(currentGitHub, githubSettings);

    return {
      ...orgSettings,
      github: mergedGitHub,
    };
  }

  /**
   * Check if auto-sync is enabled
   *
   * @param {Object} orgSettings - Organization settings
   * @returns {boolean}
   */
  isAutoSyncEnabled(orgSettings) {
    const github = this.extractGitHubSettings(orgSettings);
    return github.auto_sync_enabled === true;
  }

  /**
   * Get sync interval in milliseconds
   *
   * @param {Object} orgSettings - Organization settings
   * @returns {number} Interval in milliseconds
   */
  getSyncIntervalMs(orgSettings) {
    const github = this.extractGitHubSettings(orgSettings);
    const interval = github.sync_interval || '1h';

    const intervals = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '12h': 12 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
    };

    return intervals[interval] || intervals['1h'];
  }

  /**
   * Check if organization requires GitHub SSO
   *
   * @param {Object} orgSettings - Organization settings
   * @returns {boolean}
   */
  requiresGitHubSSO(orgSettings) {
    const github = this.extractGitHubSettings(orgSettings);
    return github.require_github_sso === true;
  }

  /**
   * Check if a GitHub organization is allowed
   *
   * @param {Object} orgSettings - Organization settings
   * @param {string} githubOrgLogin - GitHub organization login
   * @returns {boolean}
   */
  isOrganizationAllowed(orgSettings, githubOrgLogin) {
    const github = this.extractGitHubSettings(orgSettings);
    const allowed = github.allowed_organizations || [];

    if (allowed.length === 0) {
      return true; // No restrictions
    }

    return allowed.includes(githubOrgLogin);
  }

  /**
   * Check if an IP address is allowed
   *
   * @param {Object} orgSettings - Organization settings
   * @param {string} ipAddress - IP address to check
   * @returns {boolean}
   */
  isIPAllowed(orgSettings, ipAddress) {
    const github = this.extractGitHubSettings(orgSettings);
    const allowedRanges = github.allowed_ip_ranges || [];

    if (allowedRanges.length === 0) {
      return true; // No restrictions
    }

    // Simple CIDR matching (for production, use a proper CIDR library)
    // This is a simplified version
    for (const range of allowedRanges) {
      if (this.isIPInRange(ipAddress, range)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if an IP is in a CIDR range (simplified)
   *
   * @param {string} ip - IP address
   * @param {string} cidr - CIDR range
   * @returns {boolean}
   * @private
   */
  isIPInRange(ip, cidr) {
    try {
      const [rangeIP, prefix] = cidr.split('/');
      const prefixLength = parseInt(prefix, 10);

      const ipToLong = (ipStr) => {
        return ipStr.split('.').reduce((acc, octet) => acc * 256 + parseInt(octet, 10), 0);
      };

      const mask = ~(2 ** (32 - prefixLength) - 1);
      const ipLong = ipToLong(ip);
      const rangeIPLong = ipToLong(rangeIP);

      return (ipLong & mask) === (rangeIPLong & mask);
    } catch {
      return false;
    }
  }
}

export default OrganizationSettingsService;



