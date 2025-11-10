-- Rollback Migration: 002_row_level_security_rollback.sql
-- Description: Rollback Row Level Security policies
-- Author: Heimdall Team
-- Date: 2024-01-15

-- Remove migration record
DELETE FROM schema_migrations WHERE version = '002';

-- ============================================================================
-- DROP RLS POLICIES
-- ============================================================================

-- Drop usage metrics policies
DROP POLICY IF EXISTS usage_metrics_update_access ON usage_metrics;
DROP POLICY IF EXISTS usage_metrics_system_access ON usage_metrics;
DROP POLICY IF EXISTS usage_metrics_org_access ON usage_metrics;

-- Drop audit logs policies
DROP POLICY IF EXISTS audit_service_access ON audit_logs;
DROP POLICY IF EXISTS audit_insert_access ON audit_logs;
DROP POLICY IF EXISTS audit_org_read_access ON audit_logs;

-- Drop sessions policies
DROP POLICY IF EXISTS session_service_access ON sessions;
DROP POLICY IF EXISTS session_owner_access ON sessions;

-- Drop memberships policies
DROP POLICY IF EXISTS membership_remove_access ON memberships;
DROP POLICY IF EXISTS membership_admin_modify ON memberships;
DROP POLICY IF EXISTS membership_self_accept ON memberships;
DROP POLICY IF EXISTS membership_invite_access ON memberships;
DROP POLICY IF EXISTS membership_org_access ON memberships;

-- Drop organizations policies
DROP POLICY IF EXISTS org_hierarchical_access ON organizations;
DROP POLICY IF EXISTS org_delete_access ON organizations;
DROP POLICY IF EXISTS org_modify_access ON organizations;
DROP POLICY IF EXISTS org_create_access ON organizations;
DROP POLICY IF EXISTS org_member_access ON organizations;

-- ============================================================================
-- DISABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE usage_metrics DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE memberships DISABLE ROW LEVEL SECURITY;
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- DROP UTILITY FUNCTIONS
-- ============================================================================

DROP FUNCTION IF EXISTS validate_cross_tenant_isolation();
DROP FUNCTION IF EXISTS test_rls_isolation(uuid, uuid);
DROP FUNCTION IF EXISTS user_admin_orgs(uuid);
DROP FUNCTION IF EXISTS user_accessible_orgs(uuid);
DROP FUNCTION IF EXISTS user_has_role_in_org(uuid, uuid, membership_role);
DROP FUNCTION IF EXISTS current_org_id();
DROP FUNCTION IF EXISTS current_user_id();

-- Log rollback completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 002 (RLS) rollback completed successfully at %', now();
END $$;
