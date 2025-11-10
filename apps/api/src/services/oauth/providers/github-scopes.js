/**
 * GitHub OAuth Scopes
 *
 * Comprehensive list of GitHub OAuth scopes and scope presets.
 * Used for requesting appropriate permissions based on use case.
 *
 * @see https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps
 */

/**
 * Standard GitHub OAuth Scopes
 */
export const GITHUB_SCOPES = {
  // User scopes
  USER_READ: 'read:user',              // Read user profile
  USER_EMAIL: 'user:email',            // Read email addresses
  USER_FOLLOW: 'user:follow',          // Follow/unfollow users
  
  // Repository scopes
  REPO: 'repo',                        // Full repo access (public and private)
  REPO_STATUS: 'repo:status',          // Access commit status
  REPO_DEPLOYMENT: 'repo_deployment',  // Access deployments
  PUBLIC_REPO: 'public_repo',          // Access public repos only
  REPO_INVITE: 'repo:invite',          // Accept repo invitations
  
  // Organization scopes
  ORG_READ: 'read:org',                // Read org data
  ORG_WRITE: 'write:org',              // Manage org
  ORG_ADMIN: 'admin:org',              // Full org access
  
  // Webhook scopes
  REPO_HOOK: 'admin:repo_hook',        // Manage repo webhooks
  ORG_HOOK: 'admin:org_hook',          // Manage org webhooks
  
  // GitHub Apps scopes
  GPG_KEY: 'admin:gpg_key',            // Manage GPG keys
  SSH_KEY: 'admin:public_key',         // Manage SSH keys
  
  // Workflow scopes
  WORKFLOW: 'workflow',                // Update GitHub Actions workflows
  
  // Package scopes
  PACKAGE_READ: 'read:packages',       // Download packages
  PACKAGE_WRITE: 'write:packages',     // Upload packages
  PACKAGE_DELETE: 'delete:packages',    // Delete packages
  
  // Discussion scopes
  DISCUSSION_READ: 'read:discussion',  // Read discussions
  DISCUSSION_WRITE: 'write:discussion', // Write discussions
};

/**
 * GitHub Scope Presets
 *
 * Pre-configured scope combinations for common use cases.
 */
export const GITHUB_SCOPE_PRESETS = {
  // Minimal - just authentication
  minimal: [
    GITHUB_SCOPES.USER_READ,
    GITHUB_SCOPES.USER_EMAIL
  ],

  // Profile - extended user info
  profile: [
    GITHUB_SCOPES.USER_READ,
    GITHUB_SCOPES.USER_EMAIL,
    GITHUB_SCOPES.USER_FOLLOW
  ],

  // Repository - read/write repos (public only)
  repository: [
    GITHUB_SCOPES.USER_READ,
    GITHUB_SCOPES.USER_EMAIL,
    GITHUB_SCOPES.PUBLIC_REPO,
    GITHUB_SCOPES.REPO_STATUS
  ],

  // Full repository - including private repos
  fullRepository: [
    GITHUB_SCOPES.USER_READ,
    GITHUB_SCOPES.USER_EMAIL,
    GITHUB_SCOPES.REPO,
    GITHUB_SCOPES.REPO_STATUS,
    GITHUB_SCOPES.REPO_DEPLOYMENT
  ],

  // Organization - org management
  organization: [
    GITHUB_SCOPES.USER_READ,
    GITHUB_SCOPES.USER_EMAIL,
    GITHUB_SCOPES.ORG_READ,
    GITHUB_SCOPES.ORG_WRITE
  ],

  // Webhooks - webhook management
  webhooks: [
    GITHUB_SCOPES.USER_READ,
    GITHUB_SCOPES.USER_EMAIL,
    GITHUB_SCOPES.REPO_HOOK,
    GITHUB_SCOPES.ORG_HOOK
  ],

  // Full access - everything (use with caution)
  full: [
    GITHUB_SCOPES.USER_READ,
    GITHUB_SCOPES.USER_EMAIL,
    GITHUB_SCOPES.USER_FOLLOW,
    GITHUB_SCOPES.REPO,
    GITHUB_SCOPES.REPO_STATUS,
    GITHUB_SCOPES.REPO_DEPLOYMENT,
    GITHUB_SCOPES.REPO_INVITE,
    GITHUB_SCOPES.ORG_ADMIN,
    GITHUB_SCOPES.REPO_HOOK,
    GITHUB_SCOPES.ORG_HOOK,
    GITHUB_SCOPES.WORKFLOW,
    GITHUB_SCOPES.GPG_KEY,
    GITHUB_SCOPES.SSH_KEY,
    GITHUB_SCOPES.PACKAGE_READ,
    GITHUB_SCOPES.PACKAGE_WRITE,
    GITHUB_SCOPES.DISCUSSION_READ,
    GITHUB_SCOPES.DISCUSSION_WRITE
  ]
};

/**
 * Validate GitHub scopes
 *
 * @param {string[]} scopes - Scopes to validate
 * @returns {{valid: boolean, invalid: string[], warnings: string[]}}
 */
export function validateGitHubScopes(scopes) {
  if (!Array.isArray(scopes) || scopes.length === 0) {
    return {
      valid: false,
      invalid: [],
      warnings: ['No scopes provided']
    };
  }

  const validScopes = Object.values(GITHUB_SCOPES);
  const invalid = [];
  const warnings = [];

  for (const scope of scopes) {
    if (!validScopes.includes(scope)) {
      invalid.push(scope);
    }
  }

  // Warn about potentially dangerous scope combinations
  if (scopes.includes(GITHUB_SCOPES.REPO) && scopes.includes(GITHUB_SCOPES.PUBLIC_REPO)) {
    warnings.push('REPO scope already includes PUBLIC_REPO, remove PUBLIC_REPO');
  }

  if (scopes.includes(GITHUB_SCOPES.ORG_ADMIN) && scopes.includes(GITHUB_SCOPES.ORG_READ)) {
    warnings.push('ORG_ADMIN scope already includes ORG_READ, remove ORG_READ');
  }

  if (scopes.includes(GITHUB_SCOPES.ORG_ADMIN) && scopes.includes(GITHUB_SCOPES.ORG_WRITE)) {
    warnings.push('ORG_ADMIN scope already includes ORG_WRITE, remove ORG_WRITE');
  }

  return {
    valid: invalid.length === 0,
    invalid,
    warnings
  };
}

/**
 * Get scope preset
 *
 * @param {string} presetName - Name of preset
 * @returns {string[]|null} Array of scopes or null if preset not found
 */
export function getScopePreset(presetName) {
  return GITHUB_SCOPE_PRESETS[presetName] || null;
}

/**
 * Get all available scope presets
 *
 * @returns {string[]} Array of preset names
 */
export function getAvailablePresets() {
  return Object.keys(GITHUB_SCOPE_PRESETS);
}

export default {
  GITHUB_SCOPES,
  GITHUB_SCOPE_PRESETS,
  validateGitHubScopes,
  getScopePreset,
  getAvailablePresets,
};
