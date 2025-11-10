/**
 * Tenant API Routes - Gradual Migration Approach
 * 
 * Implements new /tenants endpoints while maintaining backward compatibility
 * with existing /organizations routes via compatibility views.
 */

const express = require('express');
const router = express.Router();
const { tenantService } = require('../services/tenant');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { validateTenantData, validateHierarchyMove } = require('../middleware/validation');

// ===================================================================
// ROOT TENANT OPERATIONS (Workspaces)
// ===================================================================

/**
 * POST /tenants
 * Create a new root workspace (equivalent to organization)
 */
router.post('/', requireAuth, validateTenantData, async (req, res) => {
  try {
    const { name, slug, description, settings, maxDepth = 3 } = req.body;
    const userId = req.user.id;

    const workspace = await tenantService.createTenant({
      name,
      slug,
      tenantType: 'workspace',
      description,
      settings,
      maxDepth,
      createdBy: userId
    });

    // Automatically add creator as admin
    await tenantService.addMember(workspace.id, userId, 'admin');

    res.status(201).json({
      success: true,
      data: workspace,
      message: 'Workspace created successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /tenants
 * List all workspaces user has access to
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { includeArchived = false, hierarchical = false } = req.query;

    const tenants = await tenantService.getUserTenants(userId, {
      includeArchived: includeArchived === 'true',
      hierarchical: hierarchical === 'true',
      rootOnly: !hierarchical // Only root workspaces if not hierarchical
    });

    res.json({
      success: true,
      data: tenants,
      count: tenants.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===================================================================
// INDIVIDUAL TENANT OPERATIONS
// ===================================================================

/**
 * GET /tenants/:id
 * Get specific tenant details
 */
router.get('/:id', requireAuth, requirePermission('read'), async (req, res) => {
  try {
    const { id } = req.params;
    const { includeMembers = false, includePermissions = false } = req.query;

    const tenant = await tenantService.getTenantById(id, {
      includeMembers: includeMembers === 'true',
      includePermissions: includePermissions === 'true'
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found'
      });
    }

    res.json({
      success: true,
      data: tenant
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /tenants/:id
 * Update tenant details
 */
router.put('/:id', requireAuth, requirePermission('write'), validateTenantData, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const userId = req.user.id;

    const updatedTenant = await tenantService.updateTenant(id, updateData, userId);

    res.json({
      success: true,
      data: updatedTenant,
      message: 'Tenant updated successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /tenants/:id
 * Archive tenant (soft delete)
 */
router.delete('/:id', requireAuth, requirePermission('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await tenantService.archiveTenant(id, userId);

    res.json({
      success: true,
      message: 'Tenant archived successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// ===================================================================
// HIERARCHY OPERATIONS
// ===================================================================

/**
 * POST /tenants/:id/children
 * Create child tenant (team/project under parent)
 */
router.post('/:id/children', requireAuth, requirePermission('admin'), validateTenantData, async (req, res) => {
  try {
    const parentId = req.params.id;
    const { name, slug, tenantType, description, settings } = req.body;
    const userId = req.user.id;

    // Validate tenant type hierarchy
    const validChildTypes = {
      workspace: ['team', 'department'],
      team: ['project'],
      department: ['team'],
      project: [],
      division: ['department']
    };

    const parent = await tenantService.getTenantById(parentId);
    if (!validChildTypes[parent.tenantType]?.includes(tenantType)) {
      return res.status(400).json({
        success: false,
        error: `Cannot create ${tenantType} under ${parent.tenantType}`
      });
    }

    const childTenant = await tenantService.createTenant({
      name,
      slug,
      tenantType,
      description,
      settings,
      parentId,
      createdBy: userId
    });

    res.status(201).json({
      success: true,
      data: childTenant,
      message: 'Child tenant created successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /tenants/:id/hierarchy
 * Get complete hierarchy tree for tenant
 */
router.get('/:id/hierarchy', requireAuth, requirePermission('read'), async (req, res) => {
  try {
    const { id } = req.params;
    const { maxDepth = 5 } = req.query;

    const hierarchy = await tenantService.getTenantHierarchy(id, {
      maxDepth: parseInt(maxDepth)
    });

    res.json({
      success: true,
      data: hierarchy
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /tenants/:id/ancestors
 * Get parent chain (breadcrumb path)
 */
router.get('/:id/ancestors', requireAuth, requirePermission('read'), async (req, res) => {
  try {
    const { id } = req.params;

    const ancestors = await tenantService.getTenantAncestors(id);

    res.json({
      success: true,
      data: ancestors
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /tenants/:id/descendants
 * Get all children (recursive)
 */
router.get('/:id/descendants', requireAuth, requirePermission('read'), async (req, res) => {
  try {
    const { id } = req.params;
    const { maxDepth = 5, includeArchived = false } = req.query;

    const descendants = await tenantService.getTenantDescendants(id, {
      maxDepth: parseInt(maxDepth),
      includeArchived: includeArchived === 'true'
    });

    res.json({
      success: true,
      data: descendants,
      count: descendants.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /tenants/:id/move
 * Move tenant to new parent
 */
router.put('/:id/move', requireAuth, requirePermission('admin'), validateHierarchyMove, async (req, res) => {
  try {
    const { id } = req.params;
    const { newParentId } = req.body;
    const userId = req.user.id;

    const movedTenant = await tenantService.moveTenant(id, newParentId, userId);

    res.json({
      success: true,
      data: movedTenant,
      message: 'Tenant moved successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// ===================================================================
// MEMBER MANAGEMENT
// ===================================================================

/**
 * GET /tenants/:id/members
 * List tenant members with roles
 */
router.get('/:id/members', requireAuth, requirePermission('read'), async (req, res) => {
  try {
    const { id } = req.params;
    const { includeInherited = false } = req.query;

    const members = await tenantService.getTenantMembers(id, {
      includeInherited: includeInherited === 'true'
    });

    res.json({
      success: true,
      data: members,
      count: members.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /tenants/:id/members
 * Add member to tenant with role
 */
router.post('/:id/members', requireAuth, requirePermission('admin'), async (req, res) => {
  try {
    const tenantId = req.params.id;
    const { userId, role = 'member', permissions = [] } = req.body;
    const invitedBy = req.user.id;

    const membership = await tenantService.addMember(tenantId, userId, role, {
      permissions,
      invitedBy
    });

    res.status(201).json({
      success: true,
      data: membership,
      message: 'Member added successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /tenants/:id/members/:userId
 * Update member role/permissions
 */
router.put('/:id/members/:userId', requireAuth, requirePermission('admin'), async (req, res) => {
  try {
    const { id: tenantId, userId } = req.params;
    const { role, permissions } = req.body;
    const updatedBy = req.user.id;

    const membership = await tenantService.updateMember(tenantId, userId, {
      role,
      permissions,
      updatedBy
    });

    res.json({
      success: true,
      data: membership,
      message: 'Member updated successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /tenants/:id/members/:userId
 * Remove member from tenant
 */
router.delete('/:id/members/:userId', requireAuth, requirePermission('admin'), async (req, res) => {
  try {
    const { id: tenantId, userId } = req.params;
    const removedBy = req.user.id;

    await tenantService.removeMember(tenantId, userId, removedBy);

    res.json({
      success: true,
      message: 'Member removed successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// ===================================================================
// ARCHIVE OPERATIONS
// ===================================================================

/**
 * POST /tenants/:id/archive
 * Archive tenant with cascading options
 */
router.post('/:id/archive', requireAuth, requirePermission('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { cascade = false, reason } = req.body;
    const userId = req.user.id;

    const result = await tenantService.archiveTenant(id, {
      cascade,
      reason,
      archivedBy: userId
    });

    res.json({
      success: true,
      data: result,
      message: `Tenant ${cascade ? 'and children' : ''} archived successfully`
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /tenants/:id/restore
 * Restore archived tenant
 */
router.post('/:id/restore', requireAuth, requirePermission('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const restoredTenant = await tenantService.restoreTenant(id, userId);

    res.json({
      success: true,
      data: restoredTenant,
      message: 'Tenant restored successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;