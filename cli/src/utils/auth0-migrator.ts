/**
 * Auth0 Migrator
 * 
 * Handles migration of users and organizations from Auth0 to Heimdall
 */

import axios from 'axios';
import { Logger } from './logger';
import { HeimdallError } from './error-handler';

export interface Auth0Config {
  domain: string;
  clientId: string;
  clientSecret: string;
  audience?: string;
}

export interface Auth0User {
  user_id: string;
  email: string;
  email_verified: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  user_metadata?: any;
  app_metadata?: any;
  identities: Array<{
    provider: string;
    user_id: string;
    connection: string;
    isSocial: boolean;
  }>;
  created_at: string;
  updated_at: string;
  last_login?: string;
  last_ip?: string;
  logins_count: number;
  blocked?: boolean;
}

export interface Auth0Organization {
  id: string;
  name: string;
  display_name: string;
  branding?: {
    logo_url?: string;
    colors?: {
      primary?: string;
      page_background?: string;
    };
  };
  metadata?: any;
  created_at: string;
  updated_at: string;
}

export interface Auth0OrganizationMember {
  user_id: string;
  roles: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
}

export interface Auth0MigrationData {
  users: Auth0User[];
  organizations?: Auth0Organization[];
  organizationMembers?: Record<string, Auth0OrganizationMember[]>;
  connections?: any[];
  rules?: any[];
  actions?: any[];
  exportedAt: string;
  domain: string;
}

export interface MigrationProgress {
  total: number;
  completed: number;
  percentage: number;
  currentItem?: string;
}

export interface MigrationOptions {
  batchSize: number;
  onProgress?: (progress: MigrationProgress) => void;
}

export interface DryRunResult {
  usersToMigrate: number;
  organizationsToCreate: number;
  issues: Array<{
    type: string;
    message: string;
    item?: any;
  }>;
}

export interface MigrationResult {
  usersMigrated: number;
  organizationsCreated: number;
  failedUsers: Array<{
    email: string;
    error: string;
    originalData: any;
  }>;
  failedOrganizations: Array<{
    name: string;
    error: string;
    originalData: any;
  }>;
  migrationId: string;
  completedAt: string;
}

export interface RollbackResult {
  usersRemoved: number;
  organizationsRemoved: number;
  failedRemovals: Array<{
    type: string;
    id: string;
    error: string;
  }>;
}

export class Auth0Migrator {
  private config: any;
  private logger: Logger;
  private truxeApiUrl: string;
  private truxeApiKey: string;

  constructor(config: any) {
    this.config = config;
    this.logger = new Logger();
    this.truxeApiUrl = config.api?.url || 'http://localhost:21001';
    this.truxeApiKey = config.api?.key || process.env.TRUXE_API_KEY;
  }

  /**
   * Export data from Auth0 using Management API
   */
  async exportFromAuth0(auth0Config: Auth0Config): Promise<Auth0MigrationData> {
    try {
      // Get Auth0 Management API token
      const tokenResponse = await axios.post(`https://${auth0Config.domain}/oauth/token`, {
        client_id: auth0Config.clientId,
        client_secret: auth0Config.clientSecret,
        audience: `https://${auth0Config.domain}/api/v2/`,
        grant_type: 'client_credentials',
      });

      const accessToken = tokenResponse.data.access_token;
      const apiClient = axios.create({
        baseURL: `https://${auth0Config.domain}/api/v2`,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      this.logger.info('Exporting users from Auth0...');
      
      // Export users with pagination
      const users: Auth0User[] = [];
      let page = 0;
      const perPage = 100;
      let hasMore = true;

      while (hasMore) {
        const response = await apiClient.get('/users', {
          params: {
            page,
            per_page: perPage,
            include_totals: true,
          },
        });

        users.push(...response.data.users);
        hasMore = response.data.users.length === perPage;
        page++;
        
        this.logger.info(`Exported ${users.length} users...`);
      }

      this.logger.info('Exporting organizations from Auth0...');
      
      // Export organizations (if available)
      let organizations: Auth0Organization[] = [];
      let organizationMembers: Record<string, Auth0OrganizationMember[]> = {};

      try {
        const orgsResponse = await apiClient.get('/organizations');
        organizations = orgsResponse.data;

        // Export organization members
        for (const org of organizations) {
          try {
            const membersResponse = await apiClient.get(`/organizations/${org.id}/members`);
            organizationMembers[org.id] = membersResponse.data;
          } catch (error) {
            this.logger.warning(`Failed to export members for organization ${org.name}: ${error.message}`);
          }
        }
      } catch (error) {
        this.logger.warning('Organizations not available or accessible in this Auth0 plan');
      }

      // Export connections
      this.logger.info('Exporting connections from Auth0...');
      let connections: any[] = [];
      try {
        const connectionsResponse = await apiClient.get('/connections');
        connections = connectionsResponse.data;
      } catch (error) {
        this.logger.warning(`Failed to export connections: ${error.message}`);
      }

      // Export rules
      this.logger.info('Exporting rules from Auth0...');
      let rules: any[] = [];
      try {
        const rulesResponse = await apiClient.get('/rules');
        rules = rulesResponse.data;
      } catch (error) {
        this.logger.warning(`Failed to export rules: ${error.message}`);
      }

      // Export actions (Auth0 Actions)
      this.logger.info('Exporting actions from Auth0...');
      let actions: any[] = [];
      try {
        const actionsResponse = await apiClient.get('/actions/actions');
        actions = actionsResponse.data.actions || [];
      } catch (error) {
        this.logger.warning(`Failed to export actions: ${error.message}`);
      }

      return {
        users,
        organizations,
        organizationMembers,
        connections,
        rules,
        actions,
        exportedAt: new Date().toISOString(),
        domain: auth0Config.domain,
      };

    } catch (error) {
      throw new HeimdallError(
        `Failed to export data from Auth0: ${error.message}`,
        'AUTH0_EXPORT_FAILED',
        [
          'Check your Auth0 domain and credentials',
          'Ensure the client has Management API access',
          'Verify network connectivity to Auth0',
        ]
      );
    }
  }

  /**
   * Perform a dry run migration to identify potential issues
   */
  async performDryRun(migrationData: Auth0MigrationData, options: MigrationOptions): Promise<DryRunResult> {
    const issues: Array<{ type: string; message: string; item?: any }> = [];
    
    // Validate users
    let usersToMigrate = 0;
    for (const user of migrationData.users) {
      if (!user.email) {
        issues.push({
          type: 'missing_email',
          message: `User ${user.user_id} has no email address`,
          item: user,
        });
        continue;
      }

      if (!this.isValidEmail(user.email)) {
        issues.push({
          type: 'invalid_email',
          message: `User ${user.user_id} has invalid email: ${user.email}`,
          item: user,
        });
        continue;
      }

      if (user.blocked) {
        issues.push({
          type: 'blocked_user',
          message: `User ${user.email} is blocked in Auth0`,
          item: user,
        });
      }

      // Check for social identities that need special handling
      const socialIdentities = user.identities?.filter(id => id.isSocial) || [];
      if (socialIdentities.length > 0) {
        issues.push({
          type: 'social_identity',
          message: `User ${user.email} has social identities that need manual setup: ${socialIdentities.map(id => id.provider).join(', ')}`,
          item: user,
        });
      }

      usersToMigrate++;
    }

    // Validate organizations
    let organizationsToCreate = 0;
    if (migrationData.organizations) {
      for (const org of migrationData.organizations) {
        if (!org.name || !org.display_name) {
          issues.push({
            type: 'invalid_organization',
            message: `Organization ${org.id} missing name or display_name`,
            item: org,
          });
          continue;
        }

        // Check for slug conflicts
        const slug = this.generateSlugFromName(org.display_name);
        if (slug.length < 2) {
          issues.push({
            type: 'invalid_slug',
            message: `Organization ${org.display_name} would generate invalid slug: ${slug}`,
            item: org,
          });
          continue;
        }

        organizationsToCreate++;
      }
    }

    // Check for rules that need manual migration
    if (migrationData.rules && migrationData.rules.length > 0) {
      issues.push({
        type: 'auth0_rules',
        message: `${migrationData.rules.length} Auth0 rules found - these need manual migration to Heimdall webhooks`,
      });
    }

    // Check for actions that need manual migration
    if (migrationData.actions && migrationData.actions.length > 0) {
      issues.push({
        type: 'auth0_actions',
        message: `${migrationData.actions.length} Auth0 actions found - these need manual migration to Heimdall webhooks`,
      });
    }

    return {
      usersToMigrate,
      organizationsToCreate,
      issues,
    };
  }

  /**
   * Perform the actual migration
   */
  async performMigration(migrationData: Auth0MigrationData, options: MigrationOptions): Promise<MigrationResult> {
    const migrationId = `auth0_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const failedUsers: MigrationResult['failedUsers'] = [];
    const failedOrganizations: MigrationResult['failedOrganizations'] = [];
    
    let usersMigrated = 0;
    let organizationsCreated = 0;

    try {
      // Create Heimdall API client
      const heimdallClient = axios.create({
        baseURL: this.truxeApiUrl,
        headers: {
          'Authorization': `Bearer ${this.truxeApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      // Migrate organizations first (if any)
      if (migrationData.organizations && migrationData.organizations.length > 0) {
        this.logger.info(`Migrating ${migrationData.organizations.length} organizations...`);
        
        for (const org of migrationData.organizations) {
          try {
            const slug = this.generateSlugFromName(org.display_name);
            
            const heimdallOrg = await heimdallClient.post('/organizations', {
              name: org.display_name,
              slug,
              settings: {
                branding: org.branding,
                auth0Id: org.id,
                metadata: org.metadata,
              },
            });

            organizationsCreated++;
            this.logger.info(`Created organization: ${org.display_name} (${slug})`);

          } catch (error) {
            failedOrganizations.push({
              name: org.display_name,
              error: error.response?.data?.message || error.message,
              originalData: org,
            });
            this.logger.error(`Failed to create organization ${org.display_name}: ${error.message}`);
          }
        }
      }

      // Migrate users in batches
      const totalUsers = migrationData.users.length;
      const batches = Math.ceil(totalUsers / options.batchSize);
      
      this.logger.info(`Migrating ${totalUsers} users in ${batches} batches...`);

      for (let batch = 0; batch < batches; batch++) {
        const startIdx = batch * options.batchSize;
        const endIdx = Math.min(startIdx + options.batchSize, totalUsers);
        const batchUsers = migrationData.users.slice(startIdx, endIdx);

        for (const user of batchUsers) {
          try {
            // Skip users without email or with invalid email
            if (!user.email || !this.isValidEmail(user.email)) {
              failedUsers.push({
                email: user.email || 'no-email',
                error: 'Missing or invalid email address',
                originalData: user,
              });
              continue;
            }

            // Transform Auth0 user to Heimdall format
            const heimdallUser = this.transformAuth0User(user);

            // Create user in Heimdall
            const response = await heimdallClient.post('/admin/users', heimdallUser);
            
            usersMigrated++;

            // Report progress
            if (options.onProgress) {
              options.onProgress({
                total: totalUsers,
                completed: usersMigrated + failedUsers.length,
                percentage: Math.round(((usersMigrated + failedUsers.length) / totalUsers) * 100),
                currentItem: user.email,
              });
            }

          } catch (error) {
            failedUsers.push({
              email: user.email,
              error: error.response?.data?.message || error.message,
              originalData: user,
            });
            
            this.logger.error(`Failed to migrate user ${user.email}: ${error.message}`);
          }
        }

        // Small delay between batches to avoid overwhelming the API
        if (batch < batches - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      return {
        usersMigrated,
        organizationsCreated,
        failedUsers,
        failedOrganizations,
        migrationId,
        completedAt: new Date().toISOString(),
      };

    } catch (error) {
      throw new HeimdallError(
        `Migration failed: ${error.message}`,
        'MIGRATION_FAILED',
        [
          'Check Heimdall API connectivity',
          'Verify API key permissions',
          'Check database connection',
        ]
      );
    }
  }

  /**
   * Rollback a migration
   */
  async rollbackMigration(migration: any): Promise<RollbackResult> {
    const failedRemovals: RollbackResult['failedRemovals'] = [];
    let usersRemoved = 0;
    let organizationsRemoved = 0;

    try {
      const heimdallClient = axios.create({
        baseURL: this.truxeApiUrl,
        headers: {
          'Authorization': `Bearer ${this.truxeApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      // Remove users that were migrated
      if (migration.result?.usersMigrated > 0) {
        this.logger.info('Rolling back migrated users...');
        
        // Get users with Auth0 metadata
        const usersResponse = await heimdallClient.get('/admin/users', {
          params: {
            'metadata.auth0Id': { $exists: true },
            limit: 1000,
          },
        });

        for (const user of usersResponse.data.users || []) {
          try {
            await heimdallClient.delete(`/admin/users/${user.id}`);
            usersRemoved++;
          } catch (error) {
            failedRemovals.push({
              type: 'user',
              id: user.email,
              error: error.message,
            });
          }
        }
      }

      // Remove organizations that were created
      if (migration.result?.organizationsCreated > 0) {
        this.logger.info('Rolling back created organizations...');
        
        // Get organizations with Auth0 metadata
        const orgsResponse = await heimdallClient.get('/admin/organizations', {
          params: {
            'settings.auth0Id': { $exists: true },
            limit: 1000,
          },
        });

        for (const org of orgsResponse.data.organizations || []) {
          try {
            await heimdallClient.delete(`/admin/organizations/${org.id}`);
            organizationsRemoved++;
          } catch (error) {
            failedRemovals.push({
              type: 'organization',
              id: org.name,
              error: error.message,
            });
          }
        }
      }

      return {
        usersRemoved,
        organizationsRemoved,
        failedRemovals,
      };

    } catch (error) {
      throw new HeimdallError(
        `Rollback failed: ${error.message}`,
        'ROLLBACK_FAILED',
        [
          'Check Heimdall API connectivity',
          'Verify API key permissions',
          'Some items may need manual cleanup',
        ]
      );
    }
  }

  /**
   * Transform Auth0 user to Heimdall format
   */
  private transformAuth0User(auth0User: Auth0User): any {
    return {
      email: auth0User.email.toLowerCase(),
      emailVerified: auth0User.email_verified,
      status: auth0User.blocked ? 'blocked' : 'active',
      metadata: {
        // Core profile data
        firstName: auth0User.given_name || auth0User.user_metadata?.given_name,
        lastName: auth0User.family_name || auth0User.user_metadata?.family_name,
        name: auth0User.name,
        picture: auth0User.picture,
        
        // Auth0 specific data
        auth0Id: auth0User.user_id,
        auth0CreatedAt: auth0User.created_at,
        auth0UpdatedAt: auth0User.updated_at,
        auth0LastLogin: auth0User.last_login,
        auth0LoginsCount: auth0User.logins_count,
        
        // Preserve user metadata
        ...auth0User.user_metadata,
        
        // App metadata (if allowed)
        appMetadata: auth0User.app_metadata,
        
        // Identity providers
        identities: auth0User.identities?.map(identity => ({
          provider: identity.provider,
          connection: identity.connection,
          isSocial: identity.isSocial,
        })),
      },
    };
  }

  /**
   * Generate a URL-safe slug from organization name
   */
  private generateSlugFromName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .trim()
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  }

  /**
   * Validate email address format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
