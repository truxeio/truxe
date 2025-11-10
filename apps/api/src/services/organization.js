/**
 * Organization Service
 * 
 * Business logic for organization management including:
 * - Organization CRUD operations
 * - Hierarchical organization support
 * - Organization settings and customization
 * - Usage tracking and quotas
 */

import { Pool } from 'pg'
import config from '../config/index.js'
import { v4 as uuidv4 } from 'uuid'

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
 * Create a new organization
 */
export async function createOrganization({
  name,
  slug,
  parentOrgId = null,
  settings = {},
  createdBy,
  ip,
  userAgent,
}) {
  const client = await pool.connect()
  
  try {
    await client.query('BEGIN')
    
    // Validate slug uniqueness
    const slugCheck = await client.query(
      'SELECT id FROM organizations WHERE slug = $1',
      [slug]
    )
    
    if (slugCheck.rows.length > 0) {
      throw new Error('Organization slug already exists')
    }
    
    // Validate parent organization if provided
    if (parentOrgId) {
      const parentCheck = await client.query(
        'SELECT id FROM organizations WHERE id = $1',
        [parentOrgId]
      )
      
      if (parentCheck.rows.length === 0) {
        throw new Error('Parent organization not found')
      }
    }
    
    // Create organization
    const orgResult = await client.query(`
      INSERT INTO organizations (name, slug, parent_org_id, settings, created_at, updated_at)
      VALUES ($1, $2, $3, $4, now(), now())
      RETURNING id, name, slug, parent_org_id, settings, created_at, updated_at
    `, [name, slug, parentOrgId, JSON.stringify(settings)])
    
    const organization = orgResult.rows[0]
    
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
        parentOrgId,
        settings,
      }),
      ip,
      userAgent,
    ])
    
    await client.query('COMMIT')
    
    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      parentOrgId: organization.parent_org_id,
      settings: organization.settings,
      createdAt: organization.created_at,
      updatedAt: organization.updated_at,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/**
 * Get organization by ID with user access validation
 */
export async function getOrganizationById({ orgId, userId }) {
  const client = await pool.connect()
  
  try {
    // Set user context for RLS
    await client.query('SET app.current_user_id = $1', [userId])
    
    const result = await client.query(`
      SELECT 
        o.id,
        o.name,
        o.slug,
        o.parent_org_id,
        o.settings,
        o.created_at,
        o.updated_at,
        m.role,
        m.permissions,
        m.joined_at,
        (SELECT COUNT(*) FROM memberships WHERE org_id = o.id AND joined_at IS NOT NULL) as member_count
      FROM organizations o
      LEFT JOIN memberships m ON o.id = m.org_id AND m.user_id = $1
      WHERE o.id = $2 AND m.joined_at IS NOT NULL
    `, [userId, orgId])
    
    if (result.rows.length === 0) {
      return null
    }
    
    const row = result.rows[0]
    
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      parentOrgId: row.parent_org_id,
      settings: row.settings,
      memberCount: parseInt(row.member_count),
      membership: {
        role: row.role,
        permissions: row.permissions,
        joinedAt: row.joined_at,
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  } finally {
    client.release()
  }
}

/**
 * Get user's accessible organizations
 */
export async function getUserOrganizations({
  userId,
  role = null,
  includeHierarchy = false,
  limit = 50,
  offset = 0,
}) {
  const client = await pool.connect()
  
  try {
    // Set user context for RLS
    await client.query('SET app.current_user_id = $1', [userId])
    
    let whereClause = 'm.joined_at IS NOT NULL'
    const params = [userId, limit, offset]
    let paramIndex = 4
    
    if (role) {
      whereClause += ` AND m.role = $${paramIndex}`
      params.push(role)
      paramIndex++
    }
    
    if (includeHierarchy) {
      // Include child organizations for admin/owner users
      whereClause += ` AND (m.role IN ('owner', 'admin') OR o.parent_org_id IN (
        SELECT org_id FROM memberships 
        WHERE user_id = $1 AND role IN ('owner', 'admin') AND joined_at IS NOT NULL
      ))`
    }
    
    // Get organizations with pagination
    const result = await client.query(`
      SELECT 
        o.id,
        o.name,
        o.slug,
        o.parent_org_id,
        o.settings,
        o.created_at,
        o.updated_at,
        m.role,
        m.permissions,
        m.joined_at,
        (SELECT COUNT(*) FROM memberships WHERE org_id = o.id AND joined_at IS NOT NULL) as member_count
      FROM organizations o
      JOIN memberships m ON o.id = m.org_id
      WHERE m.user_id = $1 AND ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT $2 OFFSET $3
    `, params)
    
    // Get total count
    const countResult = await client.query(`
      SELECT COUNT(*) as total
      FROM organizations o
      JOIN memberships m ON o.id = m.org_id
      WHERE m.user_id = $1 AND ${whereClause}
    `, [userId, ...params.slice(3)])
    
    const total = parseInt(countResult.rows[0].total)
    
    const organizations = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      parentOrgId: row.parent_org_id,
      settings: row.settings,
      memberCount: parseInt(row.member_count),
      membership: {
        role: row.role,
        permissions: row.permissions,
        joinedAt: row.joined_at,
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
    
    return {
      organizations,
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
 * Update organization
 */
export async function updateOrganization({
  orgId,
  userId,
  updates,
  ip,
  userAgent,
}) {
  const client = await pool.connect()
  
  try {
    await client.query('BEGIN')
    
    // Set user context for RLS
    await client.query('SET app.current_user_id = $1', [userId])
    
    // Check if user has admin/owner role
    const roleCheck = await client.query(`
      SELECT role FROM memberships 
      WHERE org_id = $1 AND user_id = $2 AND joined_at IS NOT NULL
    `, [orgId, userId])
    
    if (roleCheck.rows.length === 0) {
      throw new Error('Organization not found or access denied')
    }
    
    const userRole = roleCheck.rows[0].role
    if (!['owner', 'admin'].includes(userRole)) {
      throw new Error('Insufficient permissions to update organization')
    }
    
    // Build update query dynamically
    const updateFields = []
    const updateValues = []
    let paramIndex = 1
    
    if (updates.name !== undefined) {
      updateFields.push(`name = $${paramIndex}`)
      updateValues.push(updates.name)
      paramIndex++
    }
    
    if (updates.settings !== undefined) {
      updateFields.push(`settings = $${paramIndex}`)
      updateValues.push(JSON.stringify(updates.settings))
      paramIndex++
    }
    
    if (updateFields.length === 0) {
      throw new Error('No valid fields to update')
    }
    
    updateFields.push(`updated_at = now()`)
    updateValues.push(orgId, userId)
    
    const updateQuery = `
      UPDATE organizations 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, name, slug, parent_org_id, settings, updated_at
    `
    
    const result = await client.query(updateQuery, updateValues)
    
    if (result.rows.length === 0) {
      throw new Error('Organization not found')
    }
    
    const organization = result.rows[0]
    
    // Log organization update
    await client.query(`
      INSERT INTO audit_logs (org_id, actor_user_id, action, target_type, target_id, details, ip, user_agent, created_at)
      VALUES ($1, $2, 'org.updated', 'organization', $3, $4, $5, $6, now())
    `, [
      orgId,
      userId,
      orgId,
      JSON.stringify(updates),
      ip,
      userAgent,
    ])
    
    await client.query('COMMIT')
    
    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      parentOrgId: organization.parent_org_id,
      settings: organization.settings,
      updatedAt: organization.updated_at,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/**
 * Delete organization (owner only)
 */
export async function deleteOrganization({
  orgId,
  userId,
  ip,
  userAgent,
}) {
  const client = await pool.connect()
  
  try {
    await client.query('BEGIN')
    
    // Set user context for RLS
    await client.query('SET app.current_user_id = $1', [userId])
    
    // Check if user is owner
    const roleCheck = await client.query(`
      SELECT role FROM memberships 
      WHERE org_id = $1 AND user_id = $2 AND joined_at IS NOT NULL
    `, [orgId, userId])
    
    if (roleCheck.rows.length === 0) {
      throw new Error('Organization not found or access denied')
    }
    
    if (roleCheck.rows[0].role !== 'owner') {
      throw new Error('Only organization owners can delete organizations')
    }
    
    // Get organization details for audit log
    const orgResult = await client.query(`
      SELECT name, slug FROM organizations WHERE id = $1
    `, [orgId])
    
    if (orgResult.rows.length === 0) {
      throw new Error('Organization not found')
    }
    
    const orgDetails = orgResult.rows[0]
    
    // Delete organization (cascades to memberships, sessions, etc.)
    await client.query('DELETE FROM organizations WHERE id = $1', [orgId])
    
    // Log organization deletion
    await client.query(`
      INSERT INTO audit_logs (org_id, actor_user_id, action, target_type, target_id, details, ip, user_agent, created_at)
      VALUES ($1, $2, 'org.deleted', 'organization', $3, $4, $5, $6, now())
    `, [
      orgId,
      userId,
      orgId,
      JSON.stringify({
        name: orgDetails.name,
        slug: orgDetails.slug,
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
 * Get organization usage metrics
 */
export async function getOrganizationUsage({
  orgId,
  userId,
  period = 'month',
}) {
  const client = await pool.connect()
  
  try {
    // Set user context for RLS
    await client.query('SET app.current_user_id = $1', [userId])
    
    // Check if user has access to organization
    const accessCheck = await client.query(`
      SELECT role FROM memberships 
      WHERE org_id = $1 AND user_id = $2 AND joined_at IS NOT NULL
    `, [orgId, userId])
    
    if (accessCheck.rows.length === 0) {
      throw new Error('Organization not found or access denied')
    }
    
    const userRole = accessCheck.rows[0].role
    if (!['owner', 'admin'].includes(userRole)) {
      throw new Error('Insufficient permissions to view usage metrics')
    }
    
    // Calculate period boundaries
    const now = new Date()
    let periodStart
    
    switch (period) {
      case 'day':
        periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'week':
        periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'year':
        periodStart = new Date(now.getFullYear(), 0, 1)
        break
      default:
        periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }
    
    // Get usage metrics
    const result = await client.query(`
      SELECT 
        metric_type,
        SUM(metric_value) as total_value,
        COUNT(*) as data_points
      FROM usage_metrics 
      WHERE org_id = $1 AND period_start >= $2
      GROUP BY metric_type
      ORDER BY metric_type
    `, [orgId, periodStart])
    
    const metrics = {}
    result.rows.forEach(row => {
      metrics[row.metric_type] = {
        total: parseInt(row.total_value),
        dataPoints: parseInt(row.data_points),
      }
    })
    
    // Get member count
    const memberCountResult = await client.query(`
      SELECT COUNT(*) as member_count
      FROM memberships 
      WHERE org_id = $1 AND joined_at IS NOT NULL
    `, [orgId])
    
    const memberCount = parseInt(memberCountResult.rows[0].member_count)
    
    return {
      period,
      periodStart,
      periodEnd: now,
      memberCount,
      metrics,
    }
  } finally {
    client.release()
  }
}

/**
 * Update organization settings
 */
export async function updateOrganizationSettings({
  orgId,
  userId,
  settings,
  ip,
  userAgent,
}) {
  const client = await pool.connect()
  
  try {
    await client.query('BEGIN')
    
    // Set user context for RLS
    await client.query('SET app.current_user_id = $1', [userId])
    
    // Check if user has admin/owner role
    const roleCheck = await client.query(`
      SELECT role FROM memberships 
      WHERE org_id = $1 AND user_id = $2 AND joined_at IS NOT NULL
    `, [orgId, userId])
    
    if (roleCheck.rows.length === 0) {
      throw new Error('Organization not found or access denied')
    }
    
    const userRole = roleCheck.rows[0].role
    if (!['owner', 'admin'].includes(userRole)) {
      throw new Error('Insufficient permissions to update organization settings')
    }
    
    // Get current settings
    const currentResult = await client.query(`
      SELECT settings FROM organizations WHERE id = $1
    `, [orgId])
    
    if (currentResult.rows.length === 0) {
      throw new Error('Organization not found')
    }
    
    const currentSettings = currentResult.rows[0].settings || {}
    const mergedSettings = { ...currentSettings, ...settings }
    
    // Update settings
    await client.query(`
      UPDATE organizations 
      SET settings = $1, updated_at = now()
      WHERE id = $2
    `, [JSON.stringify(mergedSettings), orgId])
    
    // Log settings update
    await client.query(`
      INSERT INTO audit_logs (org_id, actor_user_id, action, target_type, target_id, details, ip, user_agent, created_at)
      VALUES ($1, $2, 'settings.updated', 'organization', $3, $4, $5, $6, now())
    `, [
      orgId,
      userId,
      orgId,
      JSON.stringify({
        previousSettings: currentSettings,
        newSettings: settings,
        mergedSettings,
      }),
      ip,
      userAgent,
    ])
    
    await client.query('COMMIT')
    
    return {
      settings: mergedSettings,
      updatedAt: new Date(),
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/**
 * Get organization hierarchy (parent and children)
 */
export async function getOrganizationHierarchy({ orgId, userId }) {
  const client = await pool.connect()
  
  try {
    // Set user context for RLS
    await client.query('SET app.current_user_id = $1', [userId])
    
    // Get the organization with its parent
    const orgResult = await client.query(`
      SELECT 
        o.id,
        o.name,
        o.slug,
        o.parent_org_id,
        o.settings,
        o.created_at,
        o.updated_at,
        parent.id as parent_id,
        parent.name as parent_name,
        parent.slug as parent_slug,
        m.role,
        m.permissions,
        m.joined_at
      FROM organizations o
      LEFT JOIN organizations parent ON o.parent_org_id = parent.id
      LEFT JOIN memberships m ON o.id = m.org_id AND m.user_id = $1
      WHERE o.id = $2 AND m.joined_at IS NOT NULL
    `, [userId, orgId])
    
    if (orgResult.rows.length === 0) {
      return null
    }
    
    const org = orgResult.rows[0]
    
    // Get child organizations
    const childrenResult = await client.query(`
      SELECT 
        o.id,
        o.name,
        o.slug,
        o.created_at,
        (SELECT COUNT(*) FROM memberships WHERE org_id = o.id AND joined_at IS NOT NULL) as member_count
      FROM organizations o
      JOIN memberships m ON o.id = m.org_id
      WHERE o.parent_org_id = $1 AND m.user_id = $2 AND m.joined_at IS NOT NULL
      ORDER BY o.created_at DESC
    `, [orgId, userId])
    
    // Calculate depth in hierarchy
    let depth = 0
    let currentParentId = org.parent_org_id
    while (currentParentId && depth < 10) { // Prevent infinite loops
      const parentResult = await client.query(`
        SELECT parent_org_id FROM organizations WHERE id = $1
      `, [currentParentId])
      
      if (parentResult.rows.length > 0) {
        currentParentId = parentResult.rows[0].parent_org_id
        depth++
      } else {
        break
      }
    }
    
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      settings: org.settings,
      parentOrg: org.parent_id ? {
        id: org.parent_id,
        name: org.parent_name,
        slug: org.parent_slug,
      } : null,
      childOrgs: childrenResult.rows.map(child => ({
        id: child.id,
        name: child.name,
        slug: child.slug,
        memberCount: parseInt(child.member_count),
        createdAt: child.created_at,
      })),
      depth,
      membership: {
        role: org.role,
        permissions: org.permissions,
        joinedAt: org.joined_at,
      },
      createdAt: org.created_at,
      updatedAt: org.updated_at,
    }
  } finally {
    client.release()
  }
}

export default {
  createOrganization,
  getOrganizationById,
  getUserOrganizations,
  updateOrganization,
  deleteOrganization,
  getOrganizationUsage,
  updateOrganizationSettings,
  getOrganizationHierarchy,
}
