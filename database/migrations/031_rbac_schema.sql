-- RBAC Schema Migration
-- Adds comprehensive Role-Based Access Control and Attribute-Based Access Control tables

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create roles table for RBAC
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    permissions JSONB DEFAULT '[]'::jsonb,
    inherits_from UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    UNIQUE(tenant_id, name)
);

-- Create policies table for ABAC
CREATE TABLE IF NOT EXISTS policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    conditions JSONB DEFAULT '{}'::jsonb,
    effect VARCHAR(10) NOT NULL CHECK (effect IN ('allow', 'deny')),
    resources TEXT[] NOT NULL,
    actions TEXT[] NOT NULL,
    priority INTEGER DEFAULT 0,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    UNIQUE(tenant_id, name)
);

-- Create role_permissions junction table
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    granted_by UUID REFERENCES users(id),
    PRIMARY KEY (role_id, permission_id)
);

-- Create user_roles junction table for role assignments
CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id),
    expires_at TIMESTAMPTZ,
    PRIMARY KEY (user_id, role_id, tenant_id)
);

-- Update permissions table to add RBAC-specific columns if they don't exist
DO $$ 
BEGIN
    -- Add conditions column for ABAC if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'permissions' AND column_name = 'conditions') THEN
        ALTER TABLE permissions ADD COLUMN conditions JSONB DEFAULT '{}'::jsonb;
    END IF;
    
    -- Add granted_by column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'permissions' AND column_name = 'granted_by') THEN
        ALTER TABLE permissions ADD COLUMN granted_by UUID REFERENCES users(id);
    END IF;
    
    -- Add expires_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'permissions' AND column_name = 'expires_at') THEN
        ALTER TABLE permissions ADD COLUMN expires_at TIMESTAMPTZ;
    END IF;
    
    -- Add block_inheritance column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'permissions' AND column_name = 'block_inheritance') THEN
        ALTER TABLE permissions ADD COLUMN block_inheritance BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Create indexes for optimal query performance
CREATE INDEX IF NOT EXISTS idx_roles_tenant_id ON roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);
CREATE INDEX IF NOT EXISTS idx_roles_system ON roles(is_system) WHERE is_system = TRUE;

CREATE INDEX IF NOT EXISTS idx_policies_tenant_id ON policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_policies_enabled ON policies(enabled) WHERE enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_policies_resources ON policies USING GIN(resources);
CREATE INDEX IF NOT EXISTS idx_policies_actions ON policies USING GIN(actions);
CREATE INDEX IF NOT EXISTS idx_policies_priority ON policies(priority DESC);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_tenant_id ON user_roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_expires ON user_roles(expires_at) WHERE expires_at IS NOT NULL;

-- Update existing permissions indexes
CREATE INDEX IF NOT EXISTS idx_permissions_user_tenant ON permissions(user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_permissions_conditions ON permissions USING GIN(conditions) WHERE conditions != '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_permissions_expires ON permissions(expires_at) WHERE expires_at IS NOT NULL;

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_roles_updated_at ON roles;
CREATE TRIGGER update_roles_updated_at 
    BEFORE UPDATE ON roles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_policies_updated_at ON policies;
CREATE TRIGGER update_policies_updated_at 
    BEFORE UPDATE ON policies 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default system roles
INSERT INTO roles (name, tenant_id, description, is_system, permissions) 
SELECT 
    'owner',
    t.id,
    'Full ownership and administrative access to the tenant',
    TRUE,
    '["tenants:admin", "members:admin", "permissions:admin", "documents:admin", "files:admin", "projects:admin", "integrations:admin", "settings:admin"]'::jsonb
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM roles r WHERE r.name = 'owner' AND r.tenant_id = t.id
);

INSERT INTO roles (name, tenant_id, description, is_system, permissions) 
SELECT 
    'admin',
    t.id,
    'Administrative access excluding ownership transfer',
    TRUE,
    '["members:admin", "permissions:write", "documents:admin", "files:admin", "projects:admin", "integrations:admin", "settings:write"]'::jsonb
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM roles r WHERE r.name = 'admin' AND r.tenant_id = t.id
);

INSERT INTO roles (name, tenant_id, description, is_system, permissions) 
SELECT 
    'member',
    t.id,
    'Standard member access to assigned resources',
    TRUE,
    '["documents:write", "files:write", "projects:write", "integrations:read", "settings:read"]'::jsonb
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM roles r WHERE r.name = 'member' AND r.tenant_id = t.id
);

INSERT INTO roles (name, tenant_id, description, is_system, permissions) 
SELECT 
    'viewer',
    t.id,
    'Read-only access to public resources',
    TRUE,
    '["documents:read", "files:read", "projects:read", "integrations:read"]'::jsonb
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM roles r WHERE r.name = 'viewer' AND r.tenant_id = t.id
);

INSERT INTO roles (name, tenant_id, description, is_system, permissions) 
SELECT 
    'guest',
    t.id,
    'Limited access to public content only',
    TRUE,
    '["documents:read", "files:read"]'::jsonb
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM roles r WHERE r.name = 'guest' AND r.tenant_id = t.id
);

-- Create some default policies for demonstration
INSERT INTO policies (name, tenant_id, conditions, effect, resources, actions, priority)
SELECT 
    'business-hours-access',
    t.id,
    '{"timeRange": {"start": "09:00", "end": "17:00", "timezone": "UTC", "daysOfWeek": [1,2,3,4,5]}}'::jsonb,
    'allow',
    ARRAY['documents', 'projects'],
    ARRAY['read', 'write'],
    100
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM policies p WHERE p.name = 'business-hours-access' AND p.tenant_id = t.id
);

-- Add helpful comments
COMMENT ON TABLE roles IS 'RBAC roles with hierarchical inheritance and permission templates';
COMMENT ON TABLE policies IS 'ABAC policies with conditional access rules';
COMMENT ON TABLE role_permissions IS 'Junction table linking roles to specific permissions';
COMMENT ON TABLE user_roles IS 'User role assignments with optional expiration';

COMMENT ON COLUMN roles.inherits_from IS 'Array of role IDs this role inherits permissions from';
COMMENT ON COLUMN policies.conditions IS 'JSONB conditions for policy evaluation (time, IP, attributes)';
COMMENT ON COLUMN policies.priority IS 'Policy priority (higher numbers processed first)';
COMMENT ON COLUMN permissions.conditions IS 'ABAC conditions attached to specific permissions';
COMMENT ON COLUMN permissions.block_inheritance IS 'Prevents this permission from being inherited by child tenants';

-- Grant necessary permissions to the application user
GRANT SELECT, INSERT, UPDATE, DELETE ON roles TO truxe;
GRANT SELECT, INSERT, UPDATE, DELETE ON policies TO truxe;
GRANT SELECT, INSERT, UPDATE, DELETE ON role_permissions TO truxe;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_roles TO truxe;

-- Print completion message
DO $$
BEGIN
    RAISE NOTICE 'RBAC schema migration completed successfully!';
    RAISE NOTICE 'Created tables: roles, policies, role_permissions, user_roles';
    RAISE NOTICE 'Enhanced permissions table with ABAC columns';
    RAISE NOTICE 'Added performance indexes and triggers';
    RAISE NOTICE 'Inserted default system roles for all tenants';
END $$;