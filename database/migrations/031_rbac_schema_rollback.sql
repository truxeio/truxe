-- RBAC Schema Rollback Migration
-- Removes RBAC/ABAC tables and columns

-- Drop indexes first
DROP INDEX IF EXISTS idx_roles_tenant_id;
DROP INDEX IF EXISTS idx_roles_name;
DROP INDEX IF EXISTS idx_roles_system;

DROP INDEX IF EXISTS idx_policies_tenant_id;
DROP INDEX IF EXISTS idx_policies_enabled;
DROP INDEX IF EXISTS idx_policies_resources;
DROP INDEX IF EXISTS idx_policies_actions;
DROP INDEX IF EXISTS idx_policies_priority;

DROP INDEX IF EXISTS idx_role_permissions_role_id;
DROP INDEX IF EXISTS idx_role_permissions_permission_id;

DROP INDEX IF EXISTS idx_user_roles_user_id;
DROP INDEX IF EXISTS idx_user_roles_role_id;
DROP INDEX IF EXISTS idx_user_roles_tenant_id;
DROP INDEX IF EXISTS idx_user_roles_expires;

DROP INDEX IF EXISTS idx_permissions_user_tenant;
DROP INDEX IF EXISTS idx_permissions_resource;
DROP INDEX IF EXISTS idx_permissions_conditions;
DROP INDEX IF EXISTS idx_permissions_expires;

-- Drop triggers
DROP TRIGGER IF EXISTS update_roles_updated_at ON roles;
DROP TRIGGER IF EXISTS update_policies_updated_at ON policies;

-- Drop tables (in reverse dependency order)
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS policies CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

-- Remove RBAC columns from permissions table
DO $$ 
BEGIN
    -- Remove conditions column
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'permissions' AND column_name = 'conditions') THEN
        ALTER TABLE permissions DROP COLUMN conditions;
    END IF;
    
    -- Remove granted_by column
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'permissions' AND column_name = 'granted_by') THEN
        ALTER TABLE permissions DROP COLUMN granted_by;
    END IF;
    
    -- Remove expires_at column
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'permissions' AND column_name = 'expires_at') THEN
        ALTER TABLE permissions DROP COLUMN expires_at;
    END IF;
    
    -- Remove block_inheritance column
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'permissions' AND column_name = 'block_inheritance') THEN
        ALTER TABLE permissions DROP COLUMN block_inheritance;
    END IF;
END $$;

-- Print completion message
DO $$
BEGIN
    RAISE NOTICE 'RBAC schema rollback completed successfully!';
    RAISE NOTICE 'Removed tables: roles, policies, role_permissions, user_roles';
    RAISE NOTICE 'Removed RBAC columns from permissions table';
    RAISE NOTICE 'Removed all indexes and triggers';
END $$;