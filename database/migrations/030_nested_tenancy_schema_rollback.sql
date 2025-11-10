-- ===================================================================
-- ROLLBACK 030: NESTED MULTI-TENANCY SCHEMA
-- ===================================================================
-- Description: Rollback nested tenancy schema to previous state
-- Author: Developer B (Backend/Database)
-- Date: November 3, 2025
-- Branch: feature/nested-multi-tenancy
-- ===================================================================

BEGIN;

-- Drop views first (dependent on tables)
DROP VIEW IF EXISTS memberships CASCADE;
DROP VIEW IF EXISTS organizations CASCADE;

-- Drop materialized views
DROP MATERIALIZED VIEW IF EXISTS user_tenant_access CASCADE;

-- Drop triggers
DROP TRIGGER IF EXISTS tenant_path_trigger ON tenants;
DROP TRIGGER IF EXISTS tenant_circular_check_trigger ON tenants;
DROP TRIGGER IF EXISTS tenant_cascade_path_trigger ON tenants;
DROP TRIGGER IF EXISTS tenant_updated_at_trigger ON tenants;
DROP TRIGGER IF EXISTS tenant_members_updated_at_trigger ON tenant_members;
DROP TRIGGER IF EXISTS permissions_updated_at_trigger ON permissions;

-- Drop functions
DROP FUNCTION IF EXISTS update_tenant_path() CASCADE;
DROP FUNCTION IF EXISTS check_tenant_circular_reference() CASCADE;
DROP FUNCTION IF EXISTS cascade_tenant_path_updates() CASCADE;
DROP FUNCTION IF EXISTS update_tenant_updated_at() CASCADE;
DROP FUNCTION IF EXISTS refresh_user_tenant_access() CASCADE;
DROP FUNCTION IF EXISTS user_has_tenant_access(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS user_is_tenant_admin(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS get_user_tenant_role(UUID, UUID) CASCADE;

-- Drop tables (in reverse dependency order)
DROP TABLE IF EXISTS permissions CASCADE;
DROP TABLE IF EXISTS tenant_members CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;

COMMIT;