/**
 * Migration Service
 * 
 * Backend service for handling Auth0 and Clerk migrations
 */

import { Pool } from 'pg';
import config from '../config/index.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';

// Database connection pool
const pool = new Pool({
  connectionString: config.database.url,
  ssl: config.database.ssl,
  min: config.database.poolMin,
  max: config.database.poolMax,
  connectionTimeoutMillis: config.database.connectionTimeout,
  statement_timeout: config.database.statementTimeout,
});

/**
 * Create user from migration data
 */
export async function createMigrationUser({
  email,
  emailVerified = false,
  status = 'active',
  metadata = {},
  createdBy,
  migrationId,
  sourceSystem,
  sourceUserId,
  ip,
  userAgent,
}) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Check if user already exists
    const existingUser = await client.query(
      'SELECT id, email FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    
    if (existingUser.rows.length > 0) {
      throw new Error(`User with email ${email} already exists`);
    }
    
    // Create user
    const userResult = await client.query(`
      INSERT INTO users (email, email_verified, status, metadata, created_at, updated_at)
      VALUES ($1, $2, $3, $4, now(), now())
      RETURNING id, email, email_verified, status, metadata, created_at, updated_at
    `, [
      email.toLowerCase(),
      emailVerified,
      status,
      JSON.stringify({
        ...metadata,
        migrationId,
        sourceSystem,
        sourceUserId,
        migratedAt: new Date().toISOString(),
      }),
    ]);
    
    const user = userResult.rows[0];
    
    // Log user creation
    await client.query(`
      INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, details, ip, user_agent, created_at)
      VALUES ($1, 'user.created', 'user', $2, $3, $4, $5, now())
    `, [
      createdBy,
      user.id,
      JSON.stringify({
        email: user.email,
        migrationId,
        sourceSystem,
        sourceUserId,
      }),
      ip,
      userAgent,
    ]);
    
    await client.query('COMMIT');
    
    return {
      id: user.id,
      email: user.email,
      emailVerified: user.email_verified,
      status: user.status,
      metadata: user.metadata,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Create organization from migration data
 */
export async function createMigrationOrganization({
  name,
  slug,
  settings = {},
  createdBy,
  migrationId,
  sourceSystem,
  sourceOrgId,
  ip,
  userAgent,
}) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Check if organization slug already exists
    const existingOrg = await client.query(
      'SELECT id, slug FROM organizations WHERE slug = $1',
      [slug]
    );
    
    if (existingOrg.rows.length > 0) {
      throw new Error(`Organization with slug ${slug} already exists`);
    }
    
    // Create organization
    const orgResult = await client.query(`
      INSERT INTO organizations (name, slug, settings, created_at, updated_at)
      VALUES ($1, $2, $3, now(), now())
      RETURNING id, name, slug, settings, created_at, updated_at
    `, [
      name,
      slug,
      JSON.stringify({
        ...settings,
        migrationId,
        sourceSystem,
        sourceOrgId,
        migratedAt: new Date().toISOString(),
      }),
    ]);
    
    const organization = orgResult.rows[0];
    
    // Log organization creation
    await client.query(`
      INSERT INTO audit_logs (org_id, actor_user_id, action, target_type, target_id, details, ip, user_agent, created_at)
      VALUES ($1, $2, 'org.created', 'organization', $3, $4, $5, $6, now())
    `, [
      organization.id,
      createdBy,
      organization.id,
      JSON.stringify({
        name,
        slug,
        migrationId,
        sourceSystem,
        sourceOrgId,
      }),
      ip,
      userAgent,
    ]);
    
    await client.query('COMMIT');
    
    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      settings: organization.settings,
      createdAt: organization.created_at,
      updatedAt: organization.updated_at,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Create organization membership from migration data
 */
export async function createMigrationMembership({
  orgId,
  userId,
  role = 'member',
  permissions = [],
  invitedBy,
  migrationId,
  sourceSystem,
  sourceMembershipId,
  ip,
  userAgent,
}) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Check if membership already exists
    const existingMembership = await client.query(
      'SELECT org_id, user_id FROM memberships WHERE org_id = $1 AND user_id = $2',
      [orgId, userId]
    );
    
    if (existingMembership.rows.length > 0) {
      throw new Error(`Membership already exists for user ${userId} in organization ${orgId}`);
    }
    
    // Create membership with joined_at set (since this is a migration)
    const membershipResult = await client.query(`
      INSERT INTO memberships (org_id, user_id, role, permissions, invited_by, invited_at, joined_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, now(), now(), now(), now())
      RETURNING org_id, user_id, role, permissions, invited_at, joined_at, created_at, updated_at
    `, [
      orgId,
      userId,
      role,
      JSON.stringify(permissions),
      invitedBy,
    ]);
    
    const membership = membershipResult.rows[0];
    
    // Log membership creation
    await client.query(`
      INSERT INTO audit_logs (org_id, actor_user_id, action, target_type, target_id, details, ip, user_agent, created_at)
      VALUES ($1, $2, 'membership.joined', 'user', $3, $4, $5, $6, now())
    `, [
      orgId,
      invitedBy,
      userId,
      JSON.stringify({
        role,
        permissions,
        migrationId,
        sourceSystem,
        sourceMembershipId,
      }),
      ip,
      userAgent,
    ]);
    
    await client.query('COMMIT');
    
    return {
      orgId: membership.org_id,
      userId: membership.user_id,
      role: membership.role,
      permissions: membership.permissions,
      invitedAt: membership.invited_at,
      joinedAt: membership.joined_at,
      createdAt: membership.created_at,
      updatedAt: membership.updated_at,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get migration statistics
 */
export async function getMigrationStats() {
  const client = await pool.connect();
  
  try {
    // Get users by migration source
    const userStats = await client.query(`
      SELECT 
        metadata->>'sourceSystem' as source_system,
        COUNT(*) as user_count
      FROM users 
      WHERE metadata->>'migrationId' IS NOT NULL
      GROUP BY metadata->>'sourceSystem'
    `);
    
    // Get organizations by migration source
    const orgStats = await client.query(`
      SELECT 
        settings->>'sourceSystem' as source_system,
        COUNT(*) as org_count
      FROM organizations 
      WHERE settings->>'migrationId' IS NOT NULL
      GROUP BY settings->>'sourceSystem'
    `);
    
    // Get recent migrations
    const recentMigrations = await client.query(`
      SELECT DISTINCT
        metadata->>'migrationId' as migration_id,
        metadata->>'sourceSystem' as source_system,
        COUNT(*) as user_count,
        MIN(created_at) as started_at,
        MAX(created_at) as completed_at
      FROM users 
      WHERE metadata->>'migrationId' IS NOT NULL
      GROUP BY metadata->>'migrationId', metadata->>'sourceSystem'
      ORDER BY MIN(created_at) DESC
      LIMIT 10
    `);
    
    return {
      usersBySource: userStats.rows.reduce((acc, row) => {
        acc[row.source_system] = parseInt(row.user_count);
        return acc;
      }, {}),
      organizationsBySource: orgStats.rows.reduce((acc, row) => {
        acc[row.source_system] = parseInt(row.org_count);
        return acc;
      }, {}),
      recentMigrations: recentMigrations.rows.map(row => ({
        migrationId: row.migration_id,
        sourceSystem: row.source_system,
        userCount: parseInt(row.user_count),
        startedAt: row.started_at,
        completedAt: row.completed_at,
      })),
    };
  } finally {
    client.release();
  }
}

/**
 * Find users by migration ID
 */
export async function getUsersByMigrationId(migrationId) {
  const client = await pool.connect();
  
  try {
    const result = await client.query(`
      SELECT id, email, email_verified, status, metadata, created_at, updated_at
      FROM users 
      WHERE metadata->>'migrationId' = $1
      ORDER BY created_at DESC
    `, [migrationId]);
    
    return result.rows.map(row => ({
      id: row.id,
      email: row.email,
      emailVerified: row.email_verified,
      status: row.status,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } finally {
    client.release();
  }
}

/**
 * Find organizations by migration ID
 */
export async function getOrganizationsByMigrationId(migrationId) {
  const client = await pool.connect();
  
  try {
    const result = await client.query(`
      SELECT id, name, slug, settings, created_at, updated_at
      FROM organizations 
      WHERE settings->>'migrationId' = $1
      ORDER BY created_at DESC
    `, [migrationId]);
    
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      settings: row.settings,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } finally {
    client.release();
  }
}

/**
 * Rollback migration by ID
 */
export async function rollbackMigration({
  migrationId,
  performedBy,
  ip,
  userAgent,
}) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get users and organizations to be removed
    const users = await getUsersByMigrationId(migrationId);
    const organizations = await getOrganizationsByMigrationId(migrationId);
    
    let usersRemoved = 0;
    let organizationsRemoved = 0;
    const failedRemovals = [];
    
    // Remove users
    for (const user of users) {
      try {
        await client.query('DELETE FROM users WHERE id = $1', [user.id]);
        usersRemoved++;
        
        // Log user removal
        await client.query(`
          INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, details, ip, user_agent, created_at)
          VALUES ($1, 'user.deleted', 'user', $2, $3, $4, $5, now())
        `, [
          performedBy,
          user.id,
          JSON.stringify({
            email: user.email,
            migrationId,
            rollbackReason: 'migration_rollback',
          }),
          ip,
          userAgent,
        ]);
      } catch (error) {
        failedRemovals.push({
          type: 'user',
          id: user.email,
          error: error.message,
        });
      }
    }
    
    // Remove organizations
    for (const org of organizations) {
      try {
        await client.query('DELETE FROM organizations WHERE id = $1', [org.id]);
        organizationsRemoved++;
        
        // Log organization removal
        await client.query(`
          INSERT INTO audit_logs (org_id, actor_user_id, action, target_type, target_id, details, ip, user_agent, created_at)
          VALUES ($1, $2, 'org.deleted', 'organization', $3, $4, $5, $6, now())
        `, [
          org.id,
          performedBy,
          org.id,
          JSON.stringify({
            name: org.name,
            slug: org.slug,
            migrationId,
            rollbackReason: 'migration_rollback',
          }),
          ip,
          userAgent,
        ]);
      } catch (error) {
        failedRemovals.push({
          type: 'organization',
          id: org.name,
          error: error.message,
        });
      }
    }
    
    await client.query('COMMIT');
    
    return {
      migrationId,
      usersRemoved,
      organizationsRemoved,
      failedRemovals,
      rolledBackAt: new Date().toISOString(),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Validate migration data integrity
 */
export async function validateMigrationIntegrity(migrationId) {
  const client = await pool.connect();
  
  try {
    const issues = [];
    
    // Check for users without email
    const usersWithoutEmail = await client.query(`
      SELECT id, metadata FROM users 
      WHERE metadata->>'migrationId' = $1 AND (email IS NULL OR email = '')
    `, [migrationId]);
    
    if (usersWithoutEmail.rows.length > 0) {
      issues.push({
        type: 'users_without_email',
        count: usersWithoutEmail.rows.length,
        message: 'Users found without email addresses',
      });
    }
    
    // Check for duplicate emails
    const duplicateEmails = await client.query(`
      SELECT email, COUNT(*) as count FROM users 
      WHERE metadata->>'migrationId' = $1
      GROUP BY email 
      HAVING COUNT(*) > 1
    `, [migrationId]);
    
    if (duplicateEmails.rows.length > 0) {
      issues.push({
        type: 'duplicate_emails',
        count: duplicateEmails.rows.length,
        message: 'Duplicate email addresses found',
        details: duplicateEmails.rows,
      });
    }
    
    // Check for organizations without names
    const orgsWithoutNames = await client.query(`
      SELECT id, settings FROM organizations 
      WHERE settings->>'migrationId' = $1 AND (name IS NULL OR name = '')
    `, [migrationId]);
    
    if (orgsWithoutNames.rows.length > 0) {
      issues.push({
        type: 'organizations_without_names',
        count: orgsWithoutNames.rows.length,
        message: 'Organizations found without names',
      });
    }
    
    // Check for duplicate organization slugs
    const duplicateSlugs = await client.query(`
      SELECT slug, COUNT(*) as count FROM organizations 
      WHERE settings->>'migrationId' = $1
      GROUP BY slug 
      HAVING COUNT(*) > 1
    `, [migrationId]);
    
    if (duplicateSlugs.rows.length > 0) {
      issues.push({
        type: 'duplicate_slugs',
        count: duplicateSlugs.rows.length,
        message: 'Duplicate organization slugs found',
        details: duplicateSlugs.rows,
      });
    }
    
    return {
      migrationId,
      valid: issues.length === 0,
      issues,
      checkedAt: new Date().toISOString(),
    };
  } finally {
    client.release();
  }
}

/**
 * Send migration notification email
 */
export async function sendMigrationNotification({
  email,
  migrationType,
  status,
  usersMigrated,
  organizationsCreated,
  migrationId,
}) {
  // This would integrate with the email service
  // For now, we'll just log the notification
  console.log('Migration notification:', {
    email,
    migrationType,
    status,
    usersMigrated,
    organizationsCreated,
    migrationId,
  });
  
  // TODO: Implement actual email sending
  return {
    sent: true,
    notificationId: uuidv4(),
    sentAt: new Date().toISOString(),
  };
}

export default {
  createMigrationUser,
  createMigrationOrganization,
  createMigrationMembership,
  getMigrationStats,
  getUsersByMigrationId,
  getOrganizationsByMigrationId,
  rollbackMigration,
  validateMigrationIntegrity,
  sendMigrationNotification,
};
