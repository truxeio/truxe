/**
 * Migration Validator
 * 
 * Validates migration data from Auth0 and Clerk before processing
 */

import { Logger } from './logger';
import { Auth0MigrationData, Auth0User, Auth0Organization } from './auth0-migrator';
import { ClerkMigrationData, ClerkUser, ClerkOrganization } from './clerk-migrator';

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
  item?: any;
}

export interface ValidationStats {
  totalUsers: number;
  totalOrganizations: number;
  totalConnections?: number;
  totalRules?: number;
  totalActions?: number;
  totalWebhooks?: number;
  validUsers: number;
  invalidUsers: number;
  verifiedUsers: number;
  unverifiedUsers: number;
  blockedUsers: number;
  socialUsers: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  stats: ValidationStats;
}

export class MigrationValidator {
  private source: 'auth0' | 'clerk';
  private logger: Logger;

  constructor(source: 'auth0' | 'clerk') {
    this.source = source;
    this.logger = new Logger();
  }

  /**
   * Validate Auth0 migration data
   */
  async validateAuth0Data(data: Auth0MigrationData): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    
    // Basic structure validation
    if (!data.users || !Array.isArray(data.users)) {
      errors.push({
        field: 'users',
        message: 'Users array is required',
        severity: 'error',
      });
      
      return {
        valid: false,
        errors,
        warnings,
        stats: this.getEmptyStats(),
      };
    }

    // Validate each user
    let validUsers = 0;
    let invalidUsers = 0;
    let verifiedUsers = 0;
    let unverifiedUsers = 0;
    let blockedUsers = 0;
    let socialUsers = 0;

    for (let i = 0; i < data.users.length; i++) {
      const user = data.users[i];
      const userErrors = this.validateAuth0User(user, i);
      
      if (userErrors.length > 0) {
        errors.push(...userErrors.filter(e => e.severity === 'error'));
        warnings.push(...userErrors.filter(e => e.severity === 'warning'));
        invalidUsers++;
      } else {
        validUsers++;
      }

      // Count user characteristics
      if (user.email_verified) {
        verifiedUsers++;
      } else {
        unverifiedUsers++;
      }

      if (user.blocked) {
        blockedUsers++;
      }

      if (user.identities?.some(id => id.isSocial)) {
        socialUsers++;
      }
    }

    // Validate organizations if present
    let totalOrganizations = 0;
    if (data.organizations) {
      totalOrganizations = data.organizations.length;
      
      for (let i = 0; i < data.organizations.length; i++) {
        const org = data.organizations[i];
        const orgErrors = this.validateAuth0Organization(org, i);
        
        errors.push(...orgErrors.filter(e => e.severity === 'error'));
        warnings.push(...orgErrors.filter(e => e.severity === 'warning'));
      }
    }

    // Check for duplicate emails
    const emailMap = new Map<string, number>();
    for (let i = 0; i < data.users.length; i++) {
      const email = data.users[i].email?.toLowerCase();
      if (email) {
        if (emailMap.has(email)) {
          errors.push({
            field: `users[${i}].email`,
            message: `Duplicate email address: ${email} (also at index ${emailMap.get(email)})`,
            severity: 'error',
            item: data.users[i],
          });
        } else {
          emailMap.set(email, i);
        }
      }
    }

    // Check for duplicate organization slugs
    if (data.organizations) {
      const slugMap = new Map<string, number>();
      for (let i = 0; i < data.organizations.length; i++) {
        const slug = this.generateSlugFromName(data.organizations[i].display_name);
        if (slug) {
          if (slugMap.has(slug)) {
            errors.push({
              field: `organizations[${i}].slug`,
              message: `Duplicate organization slug: ${slug} (also at index ${slugMap.get(slug)})`,
              severity: 'error',
              item: data.organizations[i],
            });
          } else {
            slugMap.set(slug, i);
          }
        }
      }
    }

    // Warnings for features that need manual migration
    if (data.rules && data.rules.length > 0) {
      warnings.push({
        field: 'rules',
        message: `${data.rules.length} Auth0 rules found - these will need manual migration to Heimdall webhooks`,
        severity: 'warning',
      });
    }

    if (data.actions && data.actions.length > 0) {
      warnings.push({
        field: 'actions',
        message: `${data.actions.length} Auth0 actions found - these will need manual migration to Heimdall webhooks`,
        severity: 'warning',
      });
    }

    const stats: ValidationStats = {
      totalUsers: data.users.length,
      totalOrganizations,
      totalConnections: data.connections?.length || 0,
      totalRules: data.rules?.length || 0,
      totalActions: data.actions?.length || 0,
      validUsers,
      invalidUsers,
      verifiedUsers,
      unverifiedUsers,
      blockedUsers,
      socialUsers,
    };

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      stats,
    };
  }

  /**
   * Validate Clerk migration data
   */
  async validateClerkData(data: ClerkMigrationData): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    
    // Basic structure validation
    if (!data.users || !Array.isArray(data.users)) {
      errors.push({
        field: 'users',
        message: 'Users array is required',
        severity: 'error',
      });
      
      return {
        valid: false,
        errors,
        warnings,
        stats: this.getEmptyStats(),
      };
    }

    // Validate each user
    let validUsers = 0;
    let invalidUsers = 0;
    let verifiedUsers = 0;
    let unverifiedUsers = 0;
    let blockedUsers = 0;

    for (let i = 0; i < data.users.length; i++) {
      const user = data.users[i];
      const userErrors = this.validateClerkUser(user, i);
      
      if (userErrors.length > 0) {
        errors.push(...userErrors.filter(e => e.severity === 'error'));
        warnings.push(...userErrors.filter(e => e.severity === 'warning'));
        invalidUsers++;
      } else {
        validUsers++;
      }

      // Count user characteristics
      const primaryEmail = user.email_addresses?.[0];
      if (primaryEmail?.verification?.status === 'verified') {
        verifiedUsers++;
      } else {
        unverifiedUsers++;
      }

      if (user.banned || user.locked) {
        blockedUsers++;
      }
    }

    // Validate organizations if present
    let totalOrganizations = 0;
    if (data.organizations) {
      totalOrganizations = data.organizations.length;
      
      for (let i = 0; i < data.organizations.length; i++) {
        const org = data.organizations[i];
        const orgErrors = this.validateClerkOrganization(org, i);
        
        errors.push(...orgErrors.filter(e => e.severity === 'error'));
        warnings.push(...orgErrors.filter(e => e.severity === 'warning'));
      }
    }

    // Check for duplicate emails
    const emailMap = new Map<string, number>();
    for (let i = 0; i < data.users.length; i++) {
      const email = data.users[i].email_addresses?.[0]?.email_address?.toLowerCase();
      if (email) {
        if (emailMap.has(email)) {
          errors.push({
            field: `users[${i}].email_addresses[0].email_address`,
            message: `Duplicate email address: ${email} (also at index ${emailMap.get(email)})`,
            severity: 'error',
            item: data.users[i],
          });
        } else {
          emailMap.set(email, i);
        }
      }
    }

    // Check for duplicate organization slugs
    if (data.organizations) {
      const slugMap = new Map<string, number>();
      for (let i = 0; i < data.organizations.length; i++) {
        const slug = data.organizations[i].slug;
        if (slug) {
          if (slugMap.has(slug)) {
            errors.push({
              field: `organizations[${i}].slug`,
              message: `Duplicate organization slug: ${slug} (also at index ${slugMap.get(slug)})`,
              severity: 'error',
              item: data.organizations[i],
            });
          } else {
            slugMap.set(slug, i);
          }
        }
      }
    }

    // Warnings for features that need manual migration
    if (data.webhooks && data.webhooks.length > 0) {
      warnings.push({
        field: 'webhooks',
        message: `${data.webhooks.length} Clerk webhooks found - these will need manual migration to Heimdall webhooks`,
        severity: 'warning',
      });
    }

    const stats: ValidationStats = {
      totalUsers: data.users.length,
      totalOrganizations,
      totalWebhooks: data.webhooks?.length || 0,
      validUsers,
      invalidUsers,
      verifiedUsers,
      unverifiedUsers,
      blockedUsers,
      socialUsers: 0, // Clerk doesn't have explicit social identity tracking
    };

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      stats,
    };
  }

  /**
   * Validate individual Auth0 user
   */
  private validateAuth0User(user: Auth0User, index: number): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Required fields
    if (!user.user_id) {
      errors.push({
        field: `users[${index}].user_id`,
        message: 'User ID is required',
        severity: 'error',
        item: user,
      });
    }

    if (!user.email) {
      errors.push({
        field: `users[${index}].email`,
        message: 'Email is required',
        severity: 'error',
        item: user,
      });
    } else if (!this.isValidEmail(user.email)) {
      errors.push({
        field: `users[${index}].email`,
        message: `Invalid email format: ${user.email}`,
        severity: 'error',
        item: user,
      });
    }

    // Warnings for potential issues
    if (!user.email_verified) {
      errors.push({
        field: `users[${index}].email_verified`,
        message: `User ${user.email} has unverified email`,
        severity: 'warning',
        item: user,
      });
    }

    if (user.blocked) {
      errors.push({
        field: `users[${index}].blocked`,
        message: `User ${user.email} is blocked`,
        severity: 'warning',
        item: user,
      });
    }

    // Check for social identities
    const socialIdentities = user.identities?.filter(id => id.isSocial) || [];
    if (socialIdentities.length > 0) {
      errors.push({
        field: `users[${index}].identities`,
        message: `User ${user.email} has social identities (${socialIdentities.map(id => id.provider).join(', ')}) that need manual setup`,
        severity: 'warning',
        item: user,
      });
    }

    return errors;
  }

  /**
   * Validate individual Clerk user
   */
  private validateClerkUser(user: ClerkUser, index: number): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Required fields
    if (!user.id) {
      errors.push({
        field: `users[${index}].id`,
        message: 'User ID is required',
        severity: 'error',
        item: user,
      });
    }

    if (!user.email_addresses || user.email_addresses.length === 0) {
      errors.push({
        field: `users[${index}].email_addresses`,
        message: 'At least one email address is required',
        severity: 'error',
        item: user,
      });
    } else {
      const primaryEmail = user.email_addresses[0];
      if (!primaryEmail.email_address) {
        errors.push({
          field: `users[${index}].email_addresses[0].email_address`,
          message: 'Primary email address is required',
          severity: 'error',
          item: user,
        });
      } else if (!this.isValidEmail(primaryEmail.email_address)) {
        errors.push({
          field: `users[${index}].email_addresses[0].email_address`,
          message: `Invalid email format: ${primaryEmail.email_address}`,
          severity: 'error',
          item: user,
        });
      }

      // Check verification status
      if (primaryEmail.verification?.status !== 'verified') {
        errors.push({
          field: `users[${index}].email_addresses[0].verification.status`,
          message: `User ${primaryEmail.email_address} has unverified email`,
          severity: 'warning',
          item: user,
        });
      }
    }

    // Warnings for potential issues
    if (user.banned) {
      errors.push({
        field: `users[${index}].banned`,
        message: `User is banned`,
        severity: 'warning',
        item: user,
      });
    }

    if (user.locked) {
      errors.push({
        field: `users[${index}].locked`,
        message: `User is locked`,
        severity: 'warning',
        item: user,
      });
    }

    // Check for phone numbers that need manual handling
    if (user.phone_numbers && user.phone_numbers.length > 0) {
      errors.push({
        field: `users[${index}].phone_numbers`,
        message: `User has phone numbers that need manual handling`,
        severity: 'warning',
        item: user,
      });
    }

    return errors;
  }

  /**
   * Validate individual Auth0 organization
   */
  private validateAuth0Organization(org: Auth0Organization, index: number): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Required fields
    if (!org.id) {
      errors.push({
        field: `organizations[${index}].id`,
        message: 'Organization ID is required',
        severity: 'error',
        item: org,
      });
    }

    if (!org.name) {
      errors.push({
        field: `organizations[${index}].name`,
        message: 'Organization name is required',
        severity: 'error',
        item: org,
      });
    }

    if (!org.display_name) {
      errors.push({
        field: `organizations[${index}].display_name`,
        message: 'Organization display name is required',
        severity: 'error',
        item: org,
      });
    }

    // Validate generated slug
    if (org.display_name) {
      const slug = this.generateSlugFromName(org.display_name);
      if (!slug || slug.length < 2) {
        errors.push({
          field: `organizations[${index}].display_name`,
          message: `Organization "${org.display_name}" would generate invalid slug: "${slug}"`,
          severity: 'error',
          item: org,
        });
      }
    }

    return errors;
  }

  /**
   * Validate individual Clerk organization
   */
  private validateClerkOrganization(org: ClerkOrganization, index: number): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Required fields
    if (!org.id) {
      errors.push({
        field: `organizations[${index}].id`,
        message: 'Organization ID is required',
        severity: 'error',
        item: org,
      });
    }

    if (!org.name) {
      errors.push({
        field: `organizations[${index}].name`,
        message: 'Organization name is required',
        severity: 'error',
        item: org,
      });
    }

    if (!org.slug) {
      errors.push({
        field: `organizations[${index}].slug`,
        message: 'Organization slug is required',
        severity: 'error',
        item: org,
      });
    } else if (!this.isValidSlug(org.slug)) {
      errors.push({
        field: `organizations[${index}].slug`,
        message: `Invalid organization slug: ${org.slug}`,
        severity: 'error',
        item: org,
      });
    }

    return errors;
  }

  /**
   * Generate a URL-safe slug from organization name
   */
  private generateSlugFromName(name: string): string {
    if (!name) return '';
    
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

  /**
   * Validate slug format
   */
  private isValidSlug(slug: string): boolean {
    const slugRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
    return slug.length >= 2 && slug.length <= 63 && slugRegex.test(slug);
  }

  /**
   * Get empty stats object
   */
  private getEmptyStats(): ValidationStats {
    return {
      totalUsers: 0,
      totalOrganizations: 0,
      validUsers: 0,
      invalidUsers: 0,
      verifiedUsers: 0,
      unverifiedUsers: 0,
      blockedUsers: 0,
      socialUsers: 0,
    };
  }
}
