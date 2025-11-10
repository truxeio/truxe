/**
 * Clerk Migrator
 * 
 * Handles migration of users and organizations from Clerk to Heimdall
 */

import axios from 'axios';
import { Logger } from './logger';
import { HeimdallError } from './error-handler';

export interface ClerkUser {
  id: string;
  email_addresses: Array<{
    id: string;
    email_address: string;
    verification: {
      status: string;
      strategy: string;
    };
  }>;
  phone_numbers?: Array<{
    id: string;
    phone_number: string;
    verification: {
      status: string;
    };
  }>;
  first_name?: string;
  last_name?: string;
  username?: string;
  image_url?: string;
  profile_image_url?: string;
  public_metadata: any;
  private_metadata: any;
  unsafe_metadata: any;
  created_at: number;
  updated_at: number;
  last_sign_in_at?: number;
  banned: boolean;
  locked: boolean;
  verification_attempts_remaining?: number;
}

export interface ClerkOrganization {
  id: string;
  name: string;
  slug: string;
  image_url?: string;
  public_metadata: any;
  private_metadata: any;
  created_at: number;
  updated_at: number;
  members_count?: number;
}

export interface ClerkOrganizationMembership {
  id: string;
  user_id: string;
  organization_id: string;
  role: string;
  permissions: string[];
  public_metadata: any;
  private_metadata: any;
  created_at: number;
  updated_at: number;
}

export interface ClerkMigrationData {
  users: ClerkUser[];
  organizations?: ClerkOrganization[];
  organizationMemberships?: ClerkOrganizationMembership[];
  webhooks?: any[];
  exportedAt: string;
  instanceId?: string;
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

export class ClerkMigrator {
  private config: any;
  private logger: Logger;
  private heimdallApiUrl: string;
  private heimdallApiKey: string;

  constructor(config: any) {
    this.config = config;
    this.logger = new Logger();
    this.heimdallApiUrl = config.api?.url || 'http://localhost:21001';
    this.heimdallApiKey = config.api?.key || process.env.TRUXE_API_KEY;
  }

  /**
   * Export data from Clerk using Backend API
   */
  async exportFromClerk(apiKey: string): Promise<ClerkMigrationData> {
    try {
      const clerkClient = axios.create({
        baseURL: 'https://api.clerk.com/v1',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      this.logger.info('Exporting users from Clerk...');
      
      // Export users with pagination
      const users: ClerkUser[] = [];
      let offset = 0;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        const response = await clerkClient.get('/users', {
          params: {
            limit,
            offset,
            order_by: '-created_at',
          },
        });

        const batchUsers = response.data;
        users.push(...batchUsers);
        hasMore = batchUsers.length === limit;
        offset += limit;
        
        this.logger.info(`Exported ${users.length} users...`);
      }

      this.logger.info('Exporting organizations from Clerk...');
      
      // Export organizations
      const organizations: ClerkOrganization[] = [];
      const organizationMemberships: ClerkOrganizationMembership[] = [];
      
      try {
        offset = 0;
        hasMore = true;

        while (hasMore) {
          const orgsResponse = await clerkClient.get('/organizations', {
            params: {
              limit,
              offset,
              order_by: '-created_at',
            },
          });

          const batchOrgs = orgsResponse.data;
          organizations.push(...batchOrgs);
          hasMore = batchOrgs.length === limit;
          offset += limit;
        }

        // Export organization memberships
        for (const org of organizations) {
          try {
            const membersResponse = await clerkClient.get(`/organizations/${org.id}/memberships`, {
              params: {
                limit: 100,
              },
            });
            
            organizationMemberships.push(...membersResponse.data);
          } catch (error) {
            this.logger.warning(`Failed to export memberships for organization ${org.name}: ${error.message}`);
          }
        }

        this.logger.info(`Exported ${organizations.length} organizations with ${organizationMemberships.length} memberships`);

      } catch (error) {
        this.logger.warning(`Failed to export organizations: ${error.message}`);
      }

      // Export webhooks
      this.logger.info('Exporting webhooks from Clerk...');
      let webhooks: any[] = [];
      try {
        const webhooksResponse = await clerkClient.get('/webhooks');
        webhooks = webhooksResponse.data;
      } catch (error) {
        this.logger.warning(`Failed to export webhooks: ${error.message}`);
      }

      return {
        users,
        organizations,
        organizationMemberships,
        webhooks,
        exportedAt: new Date().toISOString(),
      };

    } catch (error) {
      throw new HeimdallError(
        `Failed to export data from Clerk: ${error.message}`,
        'CLERK_EXPORT_FAILED',
        [
          'Check your Clerk API key',
          'Ensure the API key has the required permissions',
          'Verify network connectivity to Clerk',
        ]
      );
    }
  }

  /**
   * Perform a dry run migration to identify potential issues
   */
  async performDryRun(migrationData: ClerkMigrationData, options: MigrationOptions): Promise<DryRunResult> {
    const issues: Array<{ type: string; message: string; item?: any }> = [];
    
    // Validate users
    let usersToMigrate = 0;
    for (const user of migrationData.users) {
      const primaryEmail = user.email_addresses?.[0];
      
      if (!primaryEmail) {
        issues.push({
          type: 'missing_email',
          message: `User ${user.id} has no email addresses`,
          item: user,
        });
        continue;
      }

      if (!this.isValidEmail(primaryEmail.email_address)) {
        issues.push({
          type: 'invalid_email',
          message: `User ${user.id} has invalid email: ${primaryEmail.email_address}`,
          item: user,
        });
        continue;
      }

      if (user.banned) {
        issues.push({
          type: 'banned_user',
          message: `User ${primaryEmail.email_address} is banned in Clerk`,
          item: user,
        });
      }

      if (user.locked) {
        issues.push({
          type: 'locked_user',
          message: `User ${primaryEmail.email_address} is locked in Clerk`,
          item: user,
        });
      }

      // Check for unverified email addresses
      if (primaryEmail.verification?.status !== 'verified') {
        issues.push({
          type: 'unverified_email',
          message: `User ${primaryEmail.email_address} has unverified email address`,
          item: user,
        });
      }

      // Check for phone numbers that need manual handling
      if (user.phone_numbers && user.phone_numbers.length > 0) {
        issues.push({
          type: 'phone_numbers',
          message: `User ${primaryEmail.email_address} has phone numbers that need manual handling`,
          item: user,
        });
      }

      usersToMigrate++;
    }

    // Validate organizations
    let organizationsToCreate = 0;
    if (migrationData.organizations) {
      for (const org of migrationData.organizations) {
        if (!org.name) {
          issues.push({
            type: 'invalid_organization',
            message: `Organization ${org.id} missing name`,
            item: org,
          });
          continue;
        }

        // Check for slug conflicts
        if (!org.slug || org.slug.length < 2) {
          issues.push({
            type: 'invalid_slug',
            message: `Organization ${org.name} has invalid slug: ${org.slug}`,
            item: org,
          });
          continue;
        }

        organizationsToCreate++;
      }
    }

    // Check for webhooks that need manual migration
    if (migrationData.webhooks && migrationData.webhooks.length > 0) {
      issues.push({
        type: 'clerk_webhooks',
        message: `${migrationData.webhooks.length} Clerk webhooks found - these need manual migration to Heimdall webhooks`,
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
  async performMigration(migrationData: ClerkMigrationData, options: MigrationOptions): Promise<MigrationResult> {
    const migrationId = `clerk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const failedUsers: MigrationResult['failedUsers'] = [];
    const failedOrganizations: MigrationResult['failedOrganizations'] = [];
    
    let usersMigrated = 0;
    let organizationsCreated = 0;

    try {
      // Create Heimdall API client
      const heimdallClient = axios.create({
        baseURL: this.heimdallApiUrl,
        headers: {
          'Authorization': `Bearer ${this.heimdallApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      // Create a mapping of Clerk org IDs to Heimdall org IDs
      const orgIdMapping: Record<string, string> = {};

      // Migrate organizations first (if any)
      if (migrationData.organizations && migrationData.organizations.length > 0) {
        this.logger.info(`Migrating ${migrationData.organizations.length} organizations...`);
        
        for (const org of migrationData.organizations) {
          try {
            const heimdallOrg = await heimdallClient.post('/organizations', {
              name: org.name,
              slug: org.slug,
              settings: {
                imageUrl: org.image_url,
                clerkId: org.id,
                publicMetadata: org.public_metadata,
                privateMetadata: org.private_metadata,
              },
            });

            orgIdMapping[org.id] = heimdallOrg.data.id;
            organizationsCreated++;
            this.logger.info(`Created organization: ${org.name} (${org.slug})`);

          } catch (error) {
            failedOrganizations.push({
              name: org.name,
              error: error.response?.data?.message || error.message,
              originalData: org,
            });
            this.logger.error(`Failed to create organization ${org.name}: ${error.message}`);
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
            const primaryEmail = user.email_addresses?.[0];
            
            // Skip users without email or with invalid email
            if (!primaryEmail || !this.isValidEmail(primaryEmail.email_address)) {
              failedUsers.push({
                email: primaryEmail?.email_address || 'no-email',
                error: 'Missing or invalid email address',
                originalData: user,
              });
              continue;
            }

            // Transform Clerk user to Heimdall format
            const heimdallUser = this.transformClerkUser(user);

            // Create user in Heimdall
            const response = await heimdallClient.post('/admin/users', heimdallUser);
            const createdUser = response.data;
            
            // Handle organization memberships
            if (migrationData.organizationMemberships) {
              const userMemberships = migrationData.organizationMemberships.filter(
                membership => membership.user_id === user.id
              );

              for (const membership of userMemberships) {
                const heimdallOrgId = orgIdMapping[membership.organization_id];
                if (heimdallOrgId) {
                  try {
                    await heimdallClient.post(`/organizations/${heimdallOrgId}/members`, {
                      userId: createdUser.id,
                      role: this.mapClerkRoleToHeimdall(membership.role),
                      permissions: membership.permissions || [],
                    });
                  } catch (membershipError) {
                    this.logger.warning(`Failed to add user ${primaryEmail.email_address} to organization: ${membershipError.message}`);
                  }
                }
              }
            }

            usersMigrated++;

            // Report progress
            if (options.onProgress) {
              options.onProgress({
                total: totalUsers,
                completed: usersMigrated + failedUsers.length,
                percentage: Math.round(((usersMigrated + failedUsers.length) / totalUsers) * 100),
                currentItem: primaryEmail.email_address,
              });
            }

          } catch (error) {
            const primaryEmail = user.email_addresses?.[0];
            failedUsers.push({
              email: primaryEmail?.email_address || 'unknown',
              error: error.response?.data?.message || error.message,
              originalData: user,
            });
            
            this.logger.error(`Failed to migrate user ${primaryEmail?.email_address}: ${error.message}`);
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
        baseURL: this.heimdallApiUrl,
        headers: {
          'Authorization': `Bearer ${this.heimdallApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      // Remove users that were migrated
      if (migration.result?.usersMigrated > 0) {
        this.logger.info('Rolling back migrated users...');
        
        // Get users with Clerk metadata
        const usersResponse = await heimdallClient.get('/admin/users', {
          params: {
            'metadata.clerkId': { $exists: true },
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
        
        // Get organizations with Clerk metadata
        const orgsResponse = await heimdallClient.get('/admin/organizations', {
          params: {
            'settings.clerkId': { $exists: true },
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
   * Transform Clerk user to Heimdall format
   */
  private transformClerkUser(clerkUser: ClerkUser): any {
    const primaryEmail = clerkUser.email_addresses?.[0];
    
    return {
      email: primaryEmail.email_address.toLowerCase(),
      emailVerified: primaryEmail.verification?.status === 'verified',
      status: clerkUser.banned || clerkUser.locked ? 'blocked' : 'active',
      metadata: {
        // Core profile data
        firstName: clerkUser.first_name,
        lastName: clerkUser.last_name,
        username: clerkUser.username,
        imageUrl: clerkUser.image_url || clerkUser.profile_image_url,
        
        // Clerk specific data
        clerkId: clerkUser.id,
        clerkCreatedAt: new Date(clerkUser.created_at).toISOString(),
        clerkUpdatedAt: new Date(clerkUser.updated_at).toISOString(),
        clerkLastSignInAt: clerkUser.last_sign_in_at ? new Date(clerkUser.last_sign_in_at).toISOString() : null,
        
        // Preserve metadata
        publicMetadata: clerkUser.public_metadata,
        privateMetadata: clerkUser.private_metadata,
        unsafeMetadata: clerkUser.unsafe_metadata,
        
        // Email addresses (in case there are multiple)
        emailAddresses: clerkUser.email_addresses?.map(email => ({
          email: email.email_address,
          verified: email.verification?.status === 'verified',
        })),
        
        // Phone numbers (for reference)
        phoneNumbers: clerkUser.phone_numbers?.map(phone => ({
          number: phone.phone_number,
          verified: phone.verification?.status === 'verified',
        })),
      },
    };
  }

  /**
   * Map Clerk role to Heimdall role
   */
  private mapClerkRoleToHeimdall(clerkRole: string): string {
    const roleMapping: Record<string, string> = {
      'admin': 'admin',
      'basic_member': 'member',
      'org:admin': 'admin',
      'org:member': 'member',
    };
    
    return roleMapping[clerkRole] || 'member';
  }

  /**
   * Validate email address format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
