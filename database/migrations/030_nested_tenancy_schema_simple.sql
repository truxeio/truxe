-- ===================================================================
-- MIGRATION 030: NESTED MULTI-TENANCY SCHEMA WITH DATA MIGRATION
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
-- STEP 1: RENAME EXISTING TABLES FOR MIGRATION
-- ===================================================================

-- Rename existing tables to preserve data
ALTER TABLE organizations RENAME TO organizations_old;
ALTER TABLE memberships RENAME TO memberships_old;

-- ===================================================================
-- STEP 2: CREATE NEW HIERARCHICAL SCHEMA
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

-- ===================================================================
-- STEP 3: MIGRATE EXISTING DATA
-- ===================================================================

-- Migrate organizations to tenants (as root-level workspaces)
INSERT INTO tenants (
  id, parent_tenant_id, tenant_type, level, path, max_depth,
  name, slug, description, settings, status, created_at, updated_at
)
SELECT 
  id, 
  NULL, -- root level
  'workspace', -- all existing orgs become workspaces
  0, -- root level
  ARRAY[id], -- path is just the ID
  5, -- default max depth
  name,
  slug,
  NULL, -- no description in old schema
  settings,
  'active', -- assume all existing orgs are active
  created_at,
  updated_at
FROM organizations_old;

-- Migrate memberships to tenant_members
INSERT INTO tenant_members (
  tenant_id, user_id, role, permissions, invited_by, invited_at, joined_at, created_at, updated_at
)
SELECT 
  org_id, -- maps to tenant_id
  user_id,
  role::text, -- cast membership_role enum to text
  permissions,
  invited_by,
  invited_at,
  joined_at,
  created_at,
  updated_at
FROM memberships_old;

-- ===================================================================
-- STEP 4: CREATE TRIGGERS AND FUNCTIONS
-- ===================================================================

-- Function: Auto-update materialized path and level
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

-- Function: Prevent circular references in hierarchy
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

-- Function: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tenant_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER tenant_path_trigger
  BEFORE INSERT OR UPDATE OF parent_tenant_id
  ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_path();

CREATE TRIGGER tenant_circular_check_trigger
  BEFORE INSERT OR UPDATE OF parent_tenant_id
  ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION check_tenant_circular_reference();

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

-- ===================================================================
-- STEP 5: CREATE BACKWARD COMPATIBILITY VIEWS
-- ===================================================================

-- Organizations view (maps to root workspaces)
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

-- Memberships view (maps to root workspace memberships)
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

-- ===================================================================
-- STEP 6: CREATE BASIC INDEXES (ESSENTIAL ONLY)
-- ===================================================================

-- Critical indexes for performance
CREATE INDEX idx_tenants_parent ON tenants(parent_tenant_id) WHERE parent_tenant_id IS NOT NULL;
CREATE INDEX idx_tenants_path ON tenants USING GIN(path);
CREATE INDEX idx_tenants_type_level ON tenants(tenant_type, level);
CREATE INDEX idx_tenants_slug ON tenants(slug);

CREATE UNIQUE INDEX idx_tenant_members_user_tenant ON tenant_members(user_id, tenant_id);
CREATE INDEX idx_tenant_members_tenant ON tenant_members(tenant_id);
CREATE INDEX idx_tenant_members_active ON tenant_members(user_id, tenant_id) WHERE joined_at IS NOT NULL;

CREATE INDEX idx_permissions_user_tenant ON permissions(user_id, tenant_id);
CREATE UNIQUE INDEX idx_permissions_unique ON permissions(user_id, tenant_id, resource_type, (COALESCE(resource_id, '')));

COMMIT;