/**
 * Membership Service
 * 
 * Business logic for organization membership management including:
 * - Member invitation and management
 * - Role assignment and permission checking
 * - Invitation acceptance and rejection
 * - Membership audit logging
 */

import { Pool } from 'pg'
import config from '../config/index.js'
import { v4 as uuidv4 } from 'uuid'
import crypto from 'crypto'

// Database connection pool
const pool = new Pool({
  connectionString: config.database.url,
  ssl: config.database.ssl,
  min: config.database.poolMin,
  max: config.database.poolMax,
  connectionTimeoutMillis: config.database.connectionTimeout,
  statement_timeout: config.database.statementTimeout,
})

/**
 * Create membership invitation
 */
export async function createInvitation({
  orgId,
  email,
  role,
  permissions = [],
  invitedBy,
  message = '',
  ip,
  userAgent,
}) {
  const client = await pool.connect()
  
  try {
    await client.query('BEGIN')
    
    // Set user context for RLS
    await client.query('SET app.current_user_id = $1', [invitedBy])
    
    // Check if user has admin/owner role
    const roleCheck = await client.query(`
      SELECT role FROM memberships 
      WHERE org_id = $1 AND user_id = $2 AND joined_at IS NOT NULL
    `, [orgId, invitedBy])
    
    if (roleCheck.rows.length === 0) {
      throw new Error('Organization not found or access denied')
    }
    
    const userRole = roleCheck.rows[0].role
    if (!['owner', 'admin'].includes(userRole)) {
      throw new Error('Insufficient permissions to invite members')
    }
    
    // Check if user already exists
    const userCheck = await client.query(`
      SELECT id FROM users WHERE email = $1
    `, [email])
    
    let userId
    if (userCheck.rows.length > 0) {
      userId = userCheck.rows[0].id
      
      // Check if user is already a member
      const membershipCheck = await client.query(`
        SELECT id FROM memberships 
        WHERE org_id = $1 AND user_id = $2
      `, [orgId, userId])
      
      if (membershipCheck.rows.length > 0) {
        throw new Error('User is already a member of this organization')
      }
    } else {
      // Create user account
      const userResult = await client.query(`
        INSERT INTO users (email, status, created_at, updated_at)
        VALUES ($1, 'pending', now(), now())
        RETURNING id
      `, [email])
      
      userId = userResult.rows[0].id
    }
    
    // Generate invitation token
    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    
    // Create membership record
    const membershipResult = await client.query(`
      INSERT INTO memberships (org_id, user_id, role, permissions, invited_by, invited_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, now(), now(), now())
      RETURNING *
    `, [orgId, userId, role, JSON.stringify(permissions), invitedBy])
    
    const membership = membershipResult.rows[0]
    
    // Store invitation token
    await client.query(`
      INSERT INTO magic_link_challenges (id, email, token_hash, org_slug, expires_at, created_at)
      VALUES ($1, $2, $3, $4, $5, now())
    `, [uuidv4(), email, tokenHash, null, expiresAt])
    
    // Get organization and inviter details for email
    const orgResult = await client.query(`
      SELECT name, slug FROM organizations WHERE id = $1
    `, [orgId])
    
    const inviterResult = await client.query(`
      SELECT email, metadata FROM users WHERE id = $1
    `, [invitedBy])
    
    const organization = orgResult.rows[0]
    const inviter = inviterResult.rows[0]
    
    await client.query('COMMIT')
    
    return {
      id: membership.id,
      email,
      role: membership.role,
      permissions: membership.permissions,
      invitedAt: membership.invited_at,
      expiresAt,
      token,
      organization: {
        id: orgId,
        name: organization.name,
        slug: organization.slug,
      },
      inviter: {
        id: invitedBy,
        email: inviter.email,
        name: inviter.metadata?.name || inviter.email,
      },
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/**
 * Accept invitation
 */
export async function acceptInvitation({
  token,
  userId,
  ip,
  userAgent,
}) {
  const client = await pool.connect()
  
  try {
    await client.query('BEGIN')
    
    // Verify invitation token
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const tokenResult = await client.query(`
      SELECT email, expires_at FROM magic_link_challenges 
      WHERE token_hash = $1 AND used_at IS NULL
    `, [tokenHash])
    
    if (tokenResult.rows.length === 0) {
      throw new Error('Invalid or expired invitation token')
    }
    
    const { email, expires_at } = tokenResult.rows[0]
    
    if (new Date() > new Date(expires_at)) {
      throw new Error('Invitation token has expired')
    }
    
    // Get user by email
    const userResult = await client.query(`
      SELECT id FROM users WHERE email = $1
    `, [email])
    
    if (userResult.rows.length === 0) {
      throw new Error('User not found')
    }
    
    const tokenUserId = userResult.rows[0].id
    
    // Verify user ID matches (if provided)
    if (userId && userId !== tokenUserId) {
      throw new Error('Invalid user for this invitation')
    }
    
    // Get pending membership
    const membershipResult = await client.query(`
      SELECT m.*, o.name as org_name, o.slug as org_slug
      FROM memberships m
      JOIN organizations o ON m.org_id = o.id
      WHERE m.user_id = $1 AND m.joined_at IS NULL
      ORDER BY m.invited_at DESC
      LIMIT 1
    `, [tokenUserId])
    
    if (membershipResult.rows.length === 0) {
      throw new Error('No pending invitation found')
    }
    
    const membership = membershipResult.rows[0]
    
    // Update membership to accepted
    await client.query(`
      UPDATE memberships 
      SET joined_at = now(), updated_at = now()
      WHERE org_id = $1 AND user_id = $2
    `, [membership.org_id, tokenUserId])
    
    // Mark token as used
    await client.query(`
      UPDATE magic_link_challenges 
      SET used_at = now()
      WHERE token_hash = $1
    `, [tokenHash])
    
    // Log membership acceptance
    await client.query(`
      INSERT INTO audit_logs (org_id, actor_user_id, action, target_type, target_id, details, ip, user_agent, created_at)
      VALUES ($1, $2, 'membership.joined', 'user', $3, $4, $5, $6, now())
    `, [
      membership.org_id,
      tokenUserId,
      tokenUserId,
      JSON.stringify({
        role: membership.role,
        permissions: membership.permissions,
      }),
      ip,
      userAgent,
    ])
    
    await client.query('COMMIT')
    
    return {
      success: true,
      membership: {
        orgId: membership.org_id,
        userId: membership.user_id,
        role: membership.role,
        permissions: membership.permissions,
        joinedAt: new Date(),
      },
      organization: {
        id: membership.org_id,
        name: membership.org_name,
        slug: membership.org_slug,
      },
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/**
 * Create membership (for existing users)
 */
export async function createMembership({
  orgId,
  userId,
  role,
  permissions = [],
  invitedBy,
  joinedAt = null,
}) {
  const client = await pool.connect()
  
  try {
    await client.query('BEGIN')
    
    // Check if membership already exists
    const existingCheck = await client.query(`
      SELECT id FROM memberships 
      WHERE org_id = $1 AND user_id = $2
    `, [orgId, userId])
    
    if (existingCheck.rows.length > 0) {
      throw new Error('User is already a member of this organization')
    }
    
    // Create membership
    const result = await client.query(`
      INSERT INTO memberships (org_id, user_id, role, permissions, invited_by, invited_at, joined_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, now(), $6, now(), now())
      RETURNING *
    `, [orgId, userId, role, JSON.stringify(permissions), invitedBy, joinedAt])
    
    const membership = result.rows[0]
    
    // Log membership creation
    await client.query(`
      INSERT INTO audit_logs (org_id, actor_user_id, action, target_type, target_id, details, created_at)
      VALUES ($1, $2, 'membership.created', 'user', $3, $4, now())
    `, [
      orgId,
      invitedBy,
      userId,
      JSON.stringify({
        role,
        permissions,
        joinedAt: joinedAt ? 'immediate' : 'pending',
      }),
    ])
    
    await client.query('COMMIT')
    
    return {
      id: membership.id,
      orgId: membership.org_id,
      userId: membership.user_id,
      role: membership.role,
      permissions: membership.permissions,
      invitedBy: membership.invited_by,
      invitedAt: membership.invited_at,
      joinedAt: membership.joined_at,
      createdAt: membership.created_at,
      updatedAt: membership.updated_at,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/**
 * Update membership role and permissions
 */
export async function updateMembership({
  orgId,
  userId,
  role,
  permissions,
  updatedBy,
  ip,
  userAgent,
}) {
  const client = await pool.connect()
  
  try {
    await client.query('BEGIN')
    
    // Set user context for RLS
    await client.query('SET app.current_user_id = $1', [updatedBy])
    
    // Check if updater has admin/owner role
    const updaterRoleCheck = await client.query(`
      SELECT role FROM memberships 
      WHERE org_id = $1 AND user_id = $2 AND joined_at IS NOT NULL
    `, [orgId, updatedBy])
    
    if (updaterRoleCheck.rows.length === 0) {
      throw new Error('Organization not found or access denied')
    }
    
    const updaterRole = updaterRoleCheck.rows[0].role
    if (!['owner', 'admin'].includes(updaterRole)) {
      throw new Error('Insufficient permissions to update member role')
    }
    
    // Check if target user is a member
    const memberCheck = await client.query(`
      SELECT role, permissions FROM memberships 
      WHERE org_id = $1 AND user_id = $2 AND joined_at IS NOT NULL
    `, [orgId, userId])
    
    if (memberCheck.rows.length === 0) {
      throw new Error('Member not found in organization')
    }
    
    const currentMembership = memberCheck.rows[0]
    
    // Prevent non-owners from changing owner roles
    if (updaterRole !== 'owner' && (currentMembership.role === 'owner' || role === 'owner')) {
      throw new Error('Only organization owners can change owner roles')
    }
    
    // Prevent users from changing their own role to owner
    if (updatedBy === userId && role === 'owner') {
      throw new Error('Users cannot promote themselves to owner')
    }
    
    // Update membership
    const updateFields = []
    const updateValues = []
    let paramIndex = 1
    
    if (role !== undefined) {
      updateFields.push(`role = $${paramIndex}`)
      updateValues.push(role)
      paramIndex++
    }
    
    if (permissions !== undefined) {
      updateFields.push(`permissions = $${paramIndex}`)
      updateValues.push(JSON.stringify(permissions))
      paramIndex++
    }
    
    if (updateFields.length === 0) {
      throw new Error('No valid fields to update')
    }
    
    updateFields.push(`updated_at = now()`)
    updateValues.push(orgId, userId)
    
    const updateQuery = `
      UPDATE memberships 
      SET ${updateFields.join(', ')}
      WHERE org_id = $${paramIndex} AND user_id = $${paramIndex + 1}
      RETURNING *
    `
    
    const result = await client.query(updateQuery, updateValues)
    
    if (result.rows.length === 0) {
      throw new Error('Membership not found')
    }
    
    const updatedMembership = result.rows[0]
    
    // Log membership update
    await client.query(`
      INSERT INTO audit_logs (org_id, actor_user_id, action, target_type, target_id, details, ip, user_agent, created_at)
      VALUES ($1, $2, 'membership.role_changed', 'user', $3, $4, $5, $6, now())
    `, [
      orgId,
      updatedBy,
      userId,
      JSON.stringify({
        previousRole: currentMembership.role,
        newRole: role,
        previousPermissions: currentMembership.permissions,
        newPermissions: permissions,
      }),
      ip,
      userAgent,
    ])
    
    await client.query('COMMIT')
    
    return {
      id: updatedMembership.id,
      orgId: updatedMembership.org_id,
      userId: updatedMembership.user_id,
      role: updatedMembership.role,
      permissions: updatedMembership.permissions,
      updatedAt: updatedMembership.updated_at,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/**
 * Remove membership
 */
export async function removeMembership({
  orgId,
  userId,
  removedBy,
  ip,
  userAgent,
}) {
  const client = await pool.connect()
  
  try {
    await client.query('BEGIN')
    
    // Set user context for RLS
    await client.query('SET app.current_user_id = $1', [removedBy])
    
    // Check if remover has admin/owner role or is removing themselves
    const removerRoleCheck = await client.query(`
      SELECT role FROM memberships 
      WHERE org_id = $1 AND user_id = $2 AND joined_at IS NOT NULL
    `, [orgId, removedBy])
    
    if (removerRoleCheck.rows.length === 0) {
      throw new Error('Organization not found or access denied')
    }
    
    const removerRole = removerRoleCheck.rows[0].role
    const isSelfRemoval = removedBy === userId
    
    if (!isSelfRemoval && !['owner', 'admin'].includes(removerRole)) {
      throw new Error('Insufficient permissions to remove members')
    }
    
    // Check if target user is a member
    const memberCheck = await client.query(`
      SELECT role FROM memberships 
      WHERE org_id = $1 AND user_id = $2 AND joined_at IS NOT NULL
    `, [orgId, userId])
    
    if (memberCheck.rows.length === 0) {
      throw new Error('Member not found in organization')
    }
    
    const memberRole = memberCheck.rows[0].role
    
    // Prevent non-owners from removing owners
    if (!isSelfRemoval && removerRole !== 'owner' && memberRole === 'owner') {
      throw new Error('Only organization owners can remove other owners')
    }
    
    // Prevent owners from removing themselves if they're the only owner
    if (isSelfRemoval && memberRole === 'owner') {
      const ownerCount = await client.query(`
        SELECT COUNT(*) as count FROM memberships 
        WHERE org_id = $1 AND role = 'owner' AND joined_at IS NOT NULL
      `, [orgId])
      
      if (parseInt(ownerCount.rows[0].count) <= 1) {
        throw new Error('Cannot remove the last owner from organization')
      }
    }
    
    // Get member details for audit log
    const memberDetails = await client.query(`
      SELECT u.email, m.role, m.permissions
      FROM memberships m
      JOIN users u ON m.user_id = u.id
      WHERE m.org_id = $1 AND m.user_id = $2
    `, [orgId, userId])
    
    const member = memberDetails.rows[0]
    
    // Remove membership
    await client.query(`
      DELETE FROM memberships 
      WHERE org_id = $1 AND user_id = $2
    `, [orgId, userId])
    
    // Log membership removal
    await client.query(`
      INSERT INTO audit_logs (org_id, actor_user_id, action, target_type, target_id, details, ip, user_agent, created_at)
      VALUES ($1, $2, 'membership.removed', 'user', $3, $4, $5, $6, now())
    `, [
      orgId,
      removedBy,
      userId,
      JSON.stringify({
        memberEmail: member.email,
        memberRole: member.role,
        memberPermissions: member.permissions,
        removedBy: isSelfRemoval ? 'self' : 'admin',
      }),
      ip,
      userAgent,
    ])
    
    await client.query('COMMIT')
    
    return { success: true }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/**
 * Get organization members
 */
export async function getOrganizationMembers({
  orgId,
  userId,
  role = null,
  limit = 50,
  offset = 0,
}) {
  const client = await pool.connect()
  
  try {
    // Set user context for RLS
    await client.query('SET app.current_user_id = $1', [userId])
    
    let whereClause = 'm.org_id = $1 AND m.joined_at IS NOT NULL'
    const params = [orgId, limit, offset]
    let paramIndex = 4
    
    if (role) {
      whereClause += ` AND m.role = $${paramIndex}`
      params.push(role)
      paramIndex++
    }
    
    // Get members with pagination
    const result = await client.query(`
      SELECT 
        m.user_id,
        u.email,
        m.role,
        m.permissions,
        m.joined_at,
        m.invited_at,
        u.created_at as user_created_at
      FROM memberships m
      JOIN users u ON m.user_id = u.id
      WHERE ${whereClause}
      ORDER BY m.joined_at DESC
      LIMIT $2 OFFSET $3
    `, params)
    
    // Get total count
    const countResult = await client.query(`
      SELECT COUNT(*) as total
      FROM memberships m
      WHERE m.org_id = $1 AND m.joined_at IS NOT NULL
      ${role ? `AND m.role = $2` : ''}
    `, role ? [orgId, role] : [orgId])
    
    const total = parseInt(countResult.rows[0].total)
    
    const members = result.rows.map(row => ({
      userId: row.user_id,
      email: row.email,
      role: row.role,
      permissions: row.permissions,
      joinedAt: row.joined_at,
      invitedAt: row.invited_at,
      userCreatedAt: row.user_created_at,
    }))
    
    return {
      members,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    }
  } finally {
    client.release()
  }
}

/**
 * Check user permissions in organization
 */
export async function checkUserPermissions({
  orgId,
  userId,
  requiredPermissions = [],
  requiredRole = null,
}) {
  const client = await pool.connect()
  
  try {
    // Set user context for RLS
    await client.query('SET app.current_user_id = $1', [userId])
    
    const result = await client.query(`
      SELECT role, permissions FROM memberships 
      WHERE org_id = $1 AND user_id = $2 AND joined_at IS NOT NULL
    `, [orgId, userId])
    
    if (result.rows.length === 0) {
      return { hasAccess: false, reason: 'Not a member of organization' }
    }
    
    const membership = result.rows[0]
    const userRole = membership.role
    const userPermissions = membership.permissions || []
    
    // Check role requirement
    if (requiredRole) {
      const roleHierarchy = ['viewer', 'member', 'admin', 'owner']
      const userRoleIndex = roleHierarchy.indexOf(userRole)
      const requiredRoleIndex = roleHierarchy.indexOf(requiredRole)
      
      if (userRoleIndex < requiredRoleIndex) {
        return { 
          hasAccess: false, 
          reason: `Insufficient role. Required: ${requiredRole}, Current: ${userRole}` 
        }
      }
    }
    
    // Check permission requirements
    if (requiredPermissions.length > 0) {
      const missingPermissions = requiredPermissions.filter(
        permission => !userPermissions.includes(permission)
      )
      
      if (missingPermissions.length > 0) {
        return { 
          hasAccess: false, 
          reason: `Missing permissions: ${missingPermissions.join(', ')}` 
        }
      }
    }
    
    return { 
      hasAccess: true, 
      role: userRole, 
      permissions: userPermissions 
    }
  } finally {
    client.release()
  }
}

export default {
  createInvitation,
  acceptInvitation,
  createMembership,
  updateMembership,
  removeMembership,
  getOrganizationMembers,
  checkUserPermissions,
}
