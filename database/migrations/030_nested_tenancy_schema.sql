-- ===================================================================
-- MIGRATION 030: NESTED MULTI-TENANCY SCHEMA
-- ===================================================================
-- Description: Add hierarchical multi-tenancy support (2-5 levels)
-- Author: Developer B (Backend/Database)
-- Date: November 3, 2025
-- Branch: feature/nested-multi-tenancy
-- Dependencies: 029 (previous migration)
-- Rollback: 030_nested_tenancy_schema_rollback.sql
-- ===================================================================

BEGIN;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ===================================================================
-- CORE SCHEMA: HIERARCHICAL TENANTS TABLE
-- ===================================================================

-- Main tenants table with hierarchical support
CREATE TABLE tenants (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Hierarchy metadata
  tenant_type TEXT NOT NULL,  -- 'workspace', 'team', 'project', 'department', 'division'
  level INTEGER NOT NULL DEFAULT 0,  -- 0=root, 1=child, 2=grandchild, etc.
  path UUID[] NOT NULL DEFAULT '{}',  -- Materialized path: [root_id, parent_id, ..., this_id]
  max_depth INTEGER NOT NULL DEFAULT 5,  -- Maximum allowed depth for this tree
  
  -- Display information
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  
  -- Configuration
  settings JSONB DEFAULT '{}',  -- Tenant-specific settings
  metadata JSONB DEFAULT '{}',  -- Additional metadata
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active',  -- 'active', 'suspended', 'archived'
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT valid_level CHECK (level >= 0 AND level <= 10),
  CONSTRAINT max_depth_check CHECK (max_depth >= 2 AND max_depth <= 5),
  CONSTRAINT level_within_max CHECK (level <= max_depth),
  CONSTRAINT valid_slug CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'),
  CONSTRAINT slug_length CHECK (length(slug) >= 2 AND length(slug) <= 63),
  CONSTRAINT name_length CHECK (length(trim(name)) >= 1 AND length(name) <= 255),
  CONSTRAINT no_self_parent CHECK (id != parent_tenant_id),
  CONSTRAINT root_has_no_parent CHECK (
    (level = 0 AND parent_tenant_id IS NULL) OR 
    (level > 0 AND parent_tenant_id IS NOT NULL)
  ),
  CONSTRAINT valid_tenant_type CHECK (
    tenant_type IN ('workspace', 'team', 'project', 'department', 'division', 'organization')
  ),
  CONSTRAINT valid_status CHECK (status IN ('active', 'suspended', 'archived')),
  CONSTRAINT settings_is_object CHECK (jsonb_typeof(settings) = 'object'),
  CONSTRAINT metadata_is_object CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Unique constraints
  UNIQUE(parent_tenant_id, slug)  -- Slug must be unique within parent
);

-- Comments for documentation
COMMENT ON TABLE tenants IS 'Hierarchical multi-tenancy with support for 2-5 level nesting';
COMMENT ON COLUMN tenants.path IS 'Materialized path array for fast ancestor/descendant queries';
COMMENT ON COLUMN tenants.level IS 'Depth in hierarchy: 0=root, 1=child, 2=grandchild';
COMMENT ON COLUMN tenants.max_depth IS 'Maximum allowed depth for this tenant tree';
COMMENT ON COLUMN tenants.tenant_type IS 'Type of tenant: workspace, team, project, department, division, organization';
COMMENT ON COLUMN tenants.settings IS 'Tenant-specific configuration and branding';
COMMENT ON COLUMN tenants.metadata IS 'Additional metadata for custom properties';

-- ===================================================================
-- TENANT MEMBERS TABLE WITH RBAC
-- ===================================================================

-- Tenant memberships with roles and permissions
CREATE TABLE tenant_members (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Access control
  role TEXT NOT NULL,  -- 'owner', 'admin', 'member', 'viewer', 'custom'
  permissions JSONB DEFAULT '[]',  -- Additional permissions beyond role
  inherited_from UUID REFERENCES tenants(id),  -- For permission inheritance tracking
  
  -- Invitation tracking
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ,  -- NULL = pending invitation
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_role CHECK (
    role IN ('owner', 'admin', 'member', 'viewer', 'custom', 'guest')
  ),
  CONSTRAINT permissions_is_array CHECK (jsonb_typeof(permissions) = 'array'),
  CONSTRAINT joined_after_invited CHECK (joined_at IS NULL OR joined_at >= invited_at),
  CONSTRAINT self_invite_check CHECK (user_id != invited_by),
  
  -- Unique constraint
  UNIQUE(tenant_id, user_id)
);

-- Comments
COMMENT ON TABLE tenant_members IS 'User memberships in tenants with roles and permissions';
COMMENT ON COLUMN tenant_members.inherited_from IS 'Parent tenant from which permissions are inherited';
COMMENT ON COLUMN tenant_members.joined_at IS 'NULL indicates pending invitation';
COMMENT ON COLUMN tenant_members.role IS 'User role: owner, admin, member, viewer, custom, guest';
COMMENT ON COLUMN tenant_members.permissions IS 'Additional granular permissions beyond role';

-- ===================================================================
-- PERMISSIONS TABLE WITH RBAC + ABAC
-- ===================================================================

-- Resource-based permissions (RBAC + ABAC)
CREATE TABLE permissions (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Resource targeting
  resource_type TEXT NOT NULL,  -- 'integration', 'memory', 'project', 'user', 'settings'
  resource_id TEXT,  -- Specific resource UUID or NULL for all
  
  -- Actions allowed
  actions TEXT[] NOT NULL,  -- ['read', 'write', 'delete', 'admin', 'share']
  
  -- ABAC conditions (future-proof)
  conditions JSONB DEFAULT '{}',
  
  -- Metadata
  granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,  -- Optional expiration
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT actions_not_empty CHECK (array_length(actions, 1) > 0),
  CONSTRAINT valid_actions CHECK (
    actions <@ ARRAY['read', 'write', 'delete', 'admin', 'share', 'invite', 'manage']
  ),
  CONSTRAINT conditions_is_object CHECK (jsonb_typeof(conditions) = 'object'),
  CONSTRAINT resource_consistency CHECK (
    (resource_id IS NULL) OR (resource_type IS NOT NULL AND resource_id IS NOT NULL)
  )
);

-- Comments
COMMENT ON TABLE permissions IS 'Fine-grained resource permissions with RBAC and ABAC support';
COMMENT ON COLUMN permissions.resource_id IS 'NULL means permission applies to all resources of this type';
COMMENT ON COLUMN permissions.conditions IS 'ABAC conditions for advanced access control (future)';
COMMENT ON COLUMN permissions.actions IS 'Array of allowed actions: read, write, delete, admin, share, invite, manage';

-- ===================================================================
-- TENANT INDEXES FOR HIGH PERFORMANCE
-- ===================================================================

-- 1. Parent-child relationship queries
CREATE INDEX idx_tenants_parent 
ON tenants(parent_tenant_id) 
WHERE parent_tenant_id IS NOT NULL;
-- Use case: Find all children of a tenant
-- Query: SELECT * FROM tenants WHERE parent_tenant_id = ?

-- 2. Materialized path for ancestor/descendant queries (CRITICAL)
CREATE INDEX idx_tenants_path 
ON tenants USING GIN(path);
-- Use case: Find all ancestors or descendants
-- Query: SELECT * FROM tenants WHERE path @> ARRAY[?]::uuid[]
-- Query: SELECT * FROM tenants WHERE path <@ ARRAY[?]::uuid[]

-- 3. Level-based filtering
CREATE INDEX idx_tenants_level 
ON tenants(level);
-- Use case: Get all root tenants or tenants at specific level
-- Query: SELECT * FROM tenants WHERE level = 0

-- 4. Tenant type filtering
CREATE INDEX idx_tenants_type 
ON tenants(tenant_type);
-- Use case: Get all workspaces or all teams
-- Query: SELECT * FROM tenants WHERE tenant_type = 'team'

-- 5. Combined type + level for fast filtering
CREATE INDEX idx_tenants_type_level 
ON tenants(tenant_type, level);
-- Use case: Get all root workspaces
-- Query: SELECT * FROM tenants WHERE tenant_type = 'workspace' AND level = 0

-- 6. Slug lookup (for user-friendly URLs)
CREATE INDEX idx_tenants_slug 
ON tenants(slug);
-- Use case: Lookup tenant by slug
-- Query: SELECT * FROM tenants WHERE slug = ?

-- 7. Parent + slug for unique constraint enforcement
CREATE UNIQUE INDEX idx_tenants_parent_slug 
ON tenants((COALESCE(parent_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)), slug);
-- Use case: Enforce unique slug within parent
-- Handles NULL parent_tenant_id case

-- 8. Status filtering (exclude archived tenants)
CREATE INDEX idx_tenants_status 
ON tenants(status) 
WHERE status != 'archived';
-- Use case: Get active tenants only
-- Query: SELECT * FROM tenants WHERE status = 'active'

-- 9. Full-text search on name (for search functionality)
CREATE INDEX idx_tenants_name_trgm 
ON tenants USING gin(name gin_trgm_ops);
-- Requires: CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- Use case: Fuzzy search by name
-- Query: SELECT * FROM tenants WHERE name ILIKE '%search%'

-- 10. Covering index for common queries
CREATE INDEX idx_tenants_cover 
ON tenants(id, parent_tenant_id, tenant_type, name, slug, level, status);
-- Use case: Index-only scans for list queries
-- Covers most SELECT queries without table access

-- 11. Created timestamp for pagination
CREATE INDEX idx_tenants_created 
ON tenants(created_at DESC);
-- Use case: Paginated queries sorted by creation time
-- Query: SELECT * FROM tenants ORDER BY created_at DESC LIMIT ?

-- ===================================================================
-- TENANT MEMBERS INDEXES FOR FAST PERMISSION CHECKS
-- ===================================================================

-- 1. User lookup (most common query)
CREATE INDEX idx_tenant_members_user 
ON tenant_members(user_id);
-- Use case: Get all tenants for a user
-- Query: SELECT * FROM tenant_members WHERE user_id = ?

-- 2. Tenant lookup
CREATE INDEX idx_tenant_members_tenant 
ON tenant_members(tenant_id);
-- Use case: Get all members of a tenant
-- Query: SELECT * FROM tenant_members WHERE tenant_id = ?

-- 3. Combined user + tenant (for membership checks) - CRITICAL
CREATE UNIQUE INDEX idx_tenant_members_user_tenant 
ON tenant_members(user_id, tenant_id);
-- Use case: Check if user is member of tenant
-- Query: SELECT * FROM tenant_members WHERE user_id = ? AND tenant_id = ?

-- 4. Role filtering
CREATE INDEX idx_tenant_members_role 
ON tenant_members(role);
-- Use case: Get all admins or owners
-- Query: SELECT * FROM tenant_members WHERE role IN ('owner', 'admin')

-- 5. Combined tenant + role (for admin lookup)
CREATE INDEX idx_tenant_members_tenant_role 
ON tenant_members(tenant_id, role);
-- Use case: Get all admins of a tenant
-- Query: SELECT * FROM tenant_members WHERE tenant_id = ? AND role = 'admin'

-- 6. Pending invitations
CREATE INDEX idx_tenant_members_pending 
ON tenant_members(tenant_id) 
WHERE joined_at IS NULL;
-- Use case: Get pending invitations for a tenant
-- Query: SELECT * FROM tenant_members WHERE tenant_id = ? AND joined_at IS NULL

-- 7. Active memberships (joined users only)
CREATE INDEX idx_tenant_members_active 
ON tenant_members(user_id, tenant_id) 
WHERE joined_at IS NOT NULL;
-- Use case: Get active memberships only
-- Query: SELECT * FROM tenant_members WHERE user_id = ? AND joined_at IS NOT NULL

-- 8. Permission inheritance tracking
CREATE INDEX idx_tenant_members_inherited 
ON tenant_members(inherited_from) 
WHERE inherited_from IS NOT NULL;
-- Use case: Find all inherited permissions from a tenant
-- Query: SELECT * FROM tenant_members WHERE inherited_from = ?

-- 9. Invitation tracking
CREATE INDEX idx_tenant_members_inviter 
ON tenant_members(invited_by) 
WHERE invited_by IS NOT NULL;
-- Use case: Get all invitations sent by a user
-- Query: SELECT * FROM tenant_members WHERE invited_by = ?

-- 10. Covering index for permission checks
CREATE INDEX idx_tenant_members_permission_check 
ON tenant_members(user_id, tenant_id, role, joined_at) 
WHERE joined_at IS NOT NULL;
-- Use case: Fast permission checks with all needed data

-- ===================================================================
-- PERMISSIONS INDEXES FOR SUB-10MS PERMISSION CHECKS
-- ===================================================================

-- 1. User + tenant lookup (CRITICAL - most common query)
CREATE INDEX idx_permissions_user_tenant 
ON permissions(user_id, tenant_id);
-- Use case: Get all permissions for user in tenant
-- Query: SELECT * FROM permissions WHERE user_id = ? AND tenant_id = ?

-- 2. Resource type filtering
CREATE INDEX idx_permissions_resource_type 
ON permissions(resource_type);
-- Use case: Get all integration permissions
-- Query: SELECT * FROM permissions WHERE resource_type = 'integration'

-- 3. Specific resource lookup
CREATE INDEX idx_permissions_resource 
ON permissions(resource_type, resource_id) 
WHERE resource_id IS NOT NULL;
-- Use case: Check permissions for specific resource
-- Query: SELECT * FROM permissions WHERE resource_type = ? AND resource_id = ?

-- 4. Actions array (for action-based filtering)
CREATE INDEX idx_permissions_actions 
ON permissions USING GIN(actions);
-- Use case: Find all users with 'admin' action
-- Query: SELECT * FROM permissions WHERE actions @> ARRAY['admin']

-- 5. Combined user + tenant + resource (unique enforcement)
CREATE UNIQUE INDEX idx_permissions_unique 
ON permissions(user_id, tenant_id, resource_type, (COALESCE(resource_id, '')));
-- Use case: Ensure one permission record per user/tenant/resource
-- Handles NULL resource_id case

-- 6. Expiring permissions
CREATE INDEX idx_permissions_expiring 
ON permissions(expires_at) 
WHERE expires_at IS NOT NULL;
-- Use case: Find expiring permissions for cleanup
-- Query: SELECT * FROM permissions WHERE expires_at < NOW()

-- 7. Granted by tracking (audit)
CREATE INDEX idx_permissions_granted_by 
ON permissions(granted_by) 
WHERE granted_by IS NOT NULL;
-- Use case: Find all permissions granted by a user
-- Query: SELECT * FROM permissions WHERE granted_by = ?

-- 8. Covering index for permission checks (CRITICAL FOR PERFORMANCE)
CREATE INDEX idx_permissions_check_cover 
ON permissions(user_id, tenant_id, resource_type, resource_id, actions);
-- Use case: Index-only scans for permission checks
-- Query: SELECT actions FROM permissions WHERE user_id = ? AND tenant_id = ? AND resource_type = ?

-- ===================================================================
-- MATERIALIZED VIEW FOR SUB-10MS PERMISSION CHECKS
-- ===================================================================

CREATE MATERIALIZED VIEW user_tenant_access AS
SELECT 
  -- Identity
  tm.user_id,
  tm.tenant_id,
  t.tenant_type,
  t.name AS tenant_name,
  t.slug AS tenant_slug,
  t.level AS tenant_level,
  t.path AS tenant_path,
  
  -- Membership info
  tm.role,
  tm.joined_at,
  tm.inherited_from,
  
  -- Simplified aggregations
  array_agg(DISTINCT p.resource_type) FILTER (WHERE p.resource_type IS NOT NULL) AS accessible_resources,
  
  -- Permission details (for complex checks)
  jsonb_agg(DISTINCT jsonb_build_object(
    'resource_type', p.resource_type,
    'resource_id', p.resource_id,
    'actions', p.actions
  )) FILTER (WHERE p.resource_type IS NOT NULL) AS permission_details,
  
  -- Flags for quick checks
  (tm.role IN ('owner', 'admin')) AS is_admin,
  (t.level = 0) AS is_root_tenant
  
FROM tenant_members tm
JOIN tenants t ON tm.tenant_id = t.id
LEFT JOIN permissions p ON tm.user_id = p.user_id AND tm.tenant_id = p.tenant_id
WHERE tm.joined_at IS NOT NULL  -- Only active memberships
GROUP BY tm.user_id, tm.tenant_id, t.tenant_type, t.name, t.slug, t.level, t.path, tm.role, tm.joined_at, tm.inherited_from;

-- Indexes on materialized view
CREATE UNIQUE INDEX idx_user_tenant_access_pk 
ON user_tenant_access(user_id, tenant_id);

CREATE INDEX idx_user_tenant_access_user 
ON user_tenant_access(user_id);

CREATE INDEX idx_user_tenant_access_tenant 
ON user_tenant_access(tenant_id);

CREATE INDEX idx_user_tenant_access_type 
ON user_tenant_access(tenant_type);

CREATE INDEX idx_user_tenant_access_admin 
ON user_tenant_access(user_id) 
WHERE is_admin = true;

-- Comments
COMMENT ON MATERIALIZED VIEW user_tenant_access IS 'Denormalized view for ultra-fast permission checks, refreshed every 5 minutes';

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_user_tenant_access()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_tenant_access;
END;
$$ LANGUAGE plpgsql;

-- Schedule refresh every 5 minutes (requires pg_cron extension)
-- Run manually for now: SELECT cron.schedule('refresh-user-tenant-access', '*/5 * * * *', 'SELECT refresh_user_tenant_access();');

-- ===================================================================
-- FUNCTIONS AND TRIGGERS FOR NESTED TENANCY
-- ===================================================================

-- ===================================================================
-- FUNCTION: Auto-update materialized path and level
-- ===================================================================

CREATE OR REPLACE FUNCTION update_tenant_path()
RETURNS TRIGGER AS $$
DECLARE
  parent_path UUID[];
  parent_level INTEGER;
BEGIN
  -- Handle root tenant (no parent)
  IF NEW.parent_tenant_id IS NULL THEN
    NEW.path := ARRAY[NEW.id];
    NEW.level := 0;
    RETURN NEW;
  END IF;
  
  -- Get parent's path and level
  SELECT path, level 
  INTO parent_path, parent_level
  FROM tenants
  WHERE id = NEW.parent_tenant_id;
  
  -- Parent must exist
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent tenant % does not exist', NEW.parent_tenant_id;
  END IF;
  
  -- Calculate new path and level
  NEW.path := parent_path || NEW.id;
  NEW.level := parent_level + 1;
  
  -- Validate max depth
  IF NEW.level > NEW.max_depth THEN
    RAISE EXCEPTION 'Maximum tenant depth exceeded: % > % (parent: %, level: %)', 
      NEW.level, NEW.max_depth, NEW.parent_tenant_id, parent_level;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
CREATE TRIGGER tenant_path_trigger
  BEFORE INSERT OR UPDATE OF parent_tenant_id
  ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_path();

-- Comments
COMMENT ON FUNCTION update_tenant_path() IS 'Auto-calculates path array and level based on parent';

-- ===================================================================
-- FUNCTION: Prevent circular references in hierarchy
-- ===================================================================

CREATE OR REPLACE FUNCTION check_tenant_circular_reference()
RETURNS TRIGGER AS $$
BEGIN
  -- Only check on UPDATE when parent changes
  IF TG_OP = 'UPDATE' AND NEW.parent_tenant_id IS NOT DISTINCT FROM OLD.parent_tenant_id THEN
    RETURN NEW;
  END IF;
  
  -- Skip if no parent (root tenant)
  IF NEW.parent_tenant_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Check if new parent is a descendant of this tenant
  -- This would create a circular reference
  IF EXISTS (
    SELECT 1 FROM tenants
    WHERE id = NEW.parent_tenant_id
    AND NEW.id = ANY(path)
  ) THEN
    RAISE EXCEPTION 'Circular reference detected: Cannot set parent to % because it is a descendant of %', 
      NEW.parent_tenant_id, NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger (BEFORE path update trigger)
CREATE TRIGGER tenant_circular_check_trigger
  BEFORE INSERT OR UPDATE OF parent_tenant_id
  ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION check_tenant_circular_reference();

-- Comments
COMMENT ON FUNCTION check_tenant_circular_reference() IS 'Prevents circular references in tenant hierarchy';

-- ===================================================================
-- FUNCTION: Cascade path updates to descendants when parent changes
-- ===================================================================

CREATE OR REPLACE FUNCTION cascade_tenant_path_updates()
RETURNS TRIGGER AS $$
DECLARE
  old_path UUID[];
  new_path UUID[];
  child_record RECORD;
BEGIN
  -- Only on UPDATE when path changes
  IF TG_OP = 'UPDATE' AND NEW.path = OLD.path THEN
    RETURN NEW;
  END IF;
  
  old_path := OLD.path;
  new_path := NEW.path;
  
  -- Update all descendants' paths
  FOR child_record IN 
    SELECT id, path 
    FROM tenants 
    WHERE OLD.id = ANY(path) AND id != NEW.id
  LOOP
    UPDATE tenants
    SET path = new_path || path[array_position(child_record.path, OLD.id) + 1:]
    WHERE id = child_record.id;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger (AFTER path update)
CREATE TRIGGER tenant_cascade_path_trigger
  AFTER UPDATE OF path
  ON tenants
  FOR EACH ROW
  WHEN (OLD.path IS DISTINCT FROM NEW.path)
  EXECUTE FUNCTION cascade_tenant_path_updates();

-- Comments
COMMENT ON FUNCTION cascade_tenant_path_updates() IS 'Updates all descendant paths when a tenant moves';

-- ===================================================================
-- FUNCTION: Auto-update updated_at timestamp
-- ===================================================================

CREATE OR REPLACE FUNCTION update_tenant_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for all tables
CREATE TRIGGER tenant_updated_at_trigger
  BEFORE UPDATE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_updated_at();

CREATE TRIGGER tenant_members_updated_at_trigger
  BEFORE UPDATE ON tenant_members
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_updated_at();

CREATE TRIGGER permissions_updated_at_trigger
  BEFORE UPDATE ON permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_updated_at();

-- Comments
COMMENT ON FUNCTION update_tenant_updated_at() IS 'Auto-updates updated_at timestamp on table updates';

-- ===================================================================
-- BACKWARD COMPATIBILITY VIEWS AND ROW LEVEL SECURITY
-- ===================================================================

-- ===================================================================
-- BACKWARD COMPATIBILITY VIEWS
-- ===================================================================

-- 1. Organizations view (maps to root workspaces)
CREATE VIEW organizations AS
SELECT 
  id,
  slug,
  name,
  settings,
  created_at,
  updated_at
FROM tenants
WHERE tenant_type = 'workspace' AND level = 0 AND status = 'active';

-- 2. Memberships view (maps to root workspace memberships)
CREATE VIEW memberships AS
SELECT 
  tm.tenant_id AS org_id,
  tm.user_id,
  tm.role,
  tm.permissions,
  tm.invited_by,
  tm.invited_at,
  tm.joined_at,
  tm.created_at,
  tm.updated_at
FROM tenant_members tm
JOIN tenants t ON tm.tenant_id = t.id
WHERE t.tenant_type = 'workspace' AND t.level = 0 AND t.status = 'active';

-- Comments
COMMENT ON VIEW organizations IS 'Backward compatibility view for flat organization structure';
COMMENT ON VIEW memberships IS 'Backward compatibility view for organization memberships';

-- ===================================================================
-- ROW LEVEL SECURITY POLICIES
-- ===================================================================

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;

-- ===================================================================
-- 1. TENANTS TABLE POLICIES
-- ===================================================================

-- Policy: Users can see tenants they are members of (direct or inherited)
CREATE POLICY tenants_member_access ON tenants
FOR ALL TO authenticated
USING (
  id IN (
    SELECT tm.tenant_id 
    FROM tenant_members tm
    WHERE tm.user_id = current_setting('app.current_user_id')::uuid
    AND tm.joined_at IS NOT NULL
  )
  OR
  -- Also allow access to descendants of tenants user is member of
  path && ARRAY(
    SELECT tm.tenant_id 
    FROM tenant_members tm
    WHERE tm.user_id = current_setting('app.current_user_id')::uuid
    AND tm.joined_at IS NOT NULL
  )
);

-- Policy: Users can create tenants if they're admin/owner of parent
CREATE POLICY tenants_create_policy ON tenants
FOR INSERT TO authenticated
WITH CHECK (
  -- Root tenant: must be system admin (checked by application)
  (level = 0) OR
  -- Child tenant: must be admin/owner of parent
  (parent_tenant_id IN (
    SELECT tm.tenant_id 
    FROM tenant_members tm
    WHERE tm.user_id = current_setting('app.current_user_id')::uuid
    AND tm.role IN ('owner', 'admin')
    AND tm.joined_at IS NOT NULL
  ))
);

-- Policy: Users can update tenants if they're admin/owner
CREATE POLICY tenants_update_policy ON tenants
FOR UPDATE TO authenticated
USING (
  id IN (
    SELECT tm.tenant_id 
    FROM tenant_members tm
    WHERE tm.user_id = current_setting('app.current_user_id')::uuid
    AND tm.role IN ('owner', 'admin')
    AND tm.joined_at IS NOT NULL
  )
);

-- Policy: Only owners can delete tenants
CREATE POLICY tenants_delete_policy ON tenants
FOR DELETE TO authenticated
USING (
  id IN (
    SELECT tm.tenant_id 
    FROM tenant_members tm
    WHERE tm.user_id = current_setting('app.current_user_id')::uuid
    AND tm.role = 'owner'
    AND tm.joined_at IS NOT NULL
  )
);

-- ===================================================================
-- 2. TENANT_MEMBERS TABLE POLICIES
-- ===================================================================

-- Policy: Users can see memberships in tenants they have access to
CREATE POLICY tenant_members_view_policy ON tenant_members
FOR SELECT TO authenticated
USING (
  tenant_id IN (
    SELECT tm.tenant_id 
    FROM tenant_members tm
    WHERE tm.user_id = current_setting('app.current_user_id')::uuid
    AND tm.joined_at IS NOT NULL
  )
);

-- Policy: Admins/owners can add members to their tenants
CREATE POLICY tenant_members_add_policy ON tenant_members
FOR INSERT TO authenticated
WITH CHECK (
  tenant_id IN (
    SELECT tm.tenant_id 
    FROM tenant_members tm
    WHERE tm.user_id = current_setting('app.current_user_id')::uuid
    AND tm.role IN ('owner', 'admin')
    AND tm.joined_at IS NOT NULL
  )
);

-- Policy: Admins/owners can update memberships
CREATE POLICY tenant_members_update_policy ON tenant_members
FOR UPDATE TO authenticated
USING (
  tenant_id IN (
    SELECT tm.tenant_id 
    FROM tenant_members tm
    WHERE tm.user_id = current_setting('app.current_user_id')::uuid
    AND tm.role IN ('owner', 'admin')
    AND tm.joined_at IS NOT NULL
  )
);

-- Policy: Admins/owners can remove members (except themselves if they're the last owner)
CREATE POLICY tenant_members_remove_policy ON tenant_members
FOR DELETE TO authenticated
USING (
  tenant_id IN (
    SELECT tm.tenant_id 
    FROM tenant_members tm
    WHERE tm.user_id = current_setting('app.current_user_id')::uuid
    AND tm.role IN ('owner', 'admin')
    AND tm.joined_at IS NOT NULL
  )
  AND NOT (
    -- Prevent removing last owner
    role = 'owner' AND
    (SELECT COUNT(*) FROM tenant_members 
     WHERE tenant_id = tenant_members.tenant_id 
     AND role = 'owner' 
     AND joined_at IS NOT NULL) = 1
  )
);

-- ===================================================================
-- 3. PERMISSIONS TABLE POLICIES
-- ===================================================================

-- Policy: Users can see permissions in tenants they're members of
CREATE POLICY permissions_view_policy ON permissions
FOR SELECT TO authenticated
USING (
  tenant_id IN (
    SELECT tm.tenant_id 
    FROM tenant_members tm
    WHERE tm.user_id = current_setting('app.current_user_id')::uuid
    AND tm.joined_at IS NOT NULL
  )
);

-- Policy: Admins can grant permissions
CREATE POLICY permissions_grant_policy ON permissions
FOR INSERT TO authenticated
WITH CHECK (
  tenant_id IN (
    SELECT tm.tenant_id 
    FROM tenant_members tm
    WHERE tm.user_id = current_setting('app.current_user_id')::uuid
    AND tm.role IN ('owner', 'admin')
    AND tm.joined_at IS NOT NULL
  )
);

-- Policy: Admins can update permissions
CREATE POLICY permissions_update_policy ON permissions
FOR UPDATE TO authenticated
USING (
  tenant_id IN (
    SELECT tm.tenant_id 
    FROM tenant_members tm
    WHERE tm.user_id = current_setting('app.current_user_id')::uuid
    AND tm.role IN ('owner', 'admin')
    AND tm.joined_at IS NOT NULL
  )
);

-- Policy: Admins can revoke permissions
CREATE POLICY permissions_revoke_policy ON permissions
FOR DELETE TO authenticated
USING (
  tenant_id IN (
    SELECT tm.tenant_id 
    FROM tenant_members tm
    WHERE tm.user_id = current_setting('app.current_user_id')::uuid
    AND tm.role IN ('owner', 'admin')
    AND tm.joined_at IS NOT NULL
  )
);

-- ===================================================================
-- HELPER FUNCTIONS FOR PERMISSION CHECKS
-- ===================================================================

-- Check if user has access to tenant (direct or inherited)
CREATE OR REPLACE FUNCTION user_has_tenant_access(
  p_user_id UUID,
  p_tenant_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM tenant_members tm
    JOIN tenants t ON tm.tenant_id = t.id
    WHERE tm.user_id = p_user_id
    AND tm.joined_at IS NOT NULL
    AND (
      tm.tenant_id = p_tenant_id OR
      p_tenant_id = ANY(
        SELECT unnest(path) FROM tenants WHERE id = tm.tenant_id
      )
    )
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Check if user is admin/owner of tenant
CREATE OR REPLACE FUNCTION user_is_tenant_admin(
  p_user_id UUID,
  p_tenant_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM tenant_members
    WHERE user_id = p_user_id
    AND tenant_id = p_tenant_id
    AND role IN ('owner', 'admin')
    AND joined_at IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Get user's role in tenant
CREATE OR REPLACE FUNCTION get_user_tenant_role(
  p_user_id UUID,
  p_tenant_id UUID
) RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role 
    FROM tenant_members
    WHERE user_id = p_user_id
    AND tenant_id = p_tenant_id
    AND joined_at IS NOT NULL
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Comments
COMMENT ON FUNCTION user_has_tenant_access(UUID, UUID) IS 'Check if user has access to tenant (direct or inherited)';
COMMENT ON FUNCTION user_is_tenant_admin(UUID, UUID) IS 'Check if user is admin/owner of tenant';
COMMENT ON FUNCTION get_user_tenant_role(UUID, UUID) IS 'Get user role in tenant';

COMMIT;