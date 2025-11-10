-- Rollback Migration: 001_initial_schema_rollback.sql
-- Description: Rollback initial database schema for Heimdall authentication system
-- Author: Heimdall Team
-- Date: 2024-01-15

-- ============================================================================
-- ROLLBACK SCRIPT - REVERSE ORDER OF CREATION
-- ============================================================================

-- Remove migration record
DELETE FROM schema_migrations WHERE version = '001';

-- Drop rules
DROP RULE IF EXISTS audit_logs_no_delete ON audit_logs;
DROP RULE IF EXISTS audit_logs_no_update ON audit_logs;

-- Drop triggers
DROP TRIGGER IF EXISTS membership_audit_trigger ON memberships;
DROP TRIGGER IF EXISTS check_org_hierarchy_trigger ON organizations;
DROP TRIGGER IF EXISTS update_memberships_updated_at ON memberships;
DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;

-- Drop functions
DROP FUNCTION IF EXISTS cleanup_expired_data();
DROP FUNCTION IF EXISTS log_membership_changes();
DROP FUNCTION IF EXISTS check_org_hierarchy();
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop indexes (in reverse order)
-- Rate limits indexes
DROP INDEX IF EXISTS idx_rate_limits_cleanup;
DROP INDEX IF EXISTS idx_rate_limits_key_window;

-- Usage metrics indexes
DROP INDEX IF EXISTS idx_usage_metrics_created_at;
DROP INDEX IF EXISTS idx_usage_metrics_type;
DROP INDEX IF EXISTS idx_usage_metrics_org_period;

-- Magic link challenges indexes
DROP INDEX IF EXISTS idx_magic_links_unused;
DROP INDEX IF EXISTS idx_magic_links_org_slug;
DROP INDEX IF EXISTS idx_magic_links_expires_at;
DROP INDEX IF EXISTS idx_magic_links_email;
DROP INDEX IF EXISTS idx_magic_links_token_hash;

-- Audit logs indexes
DROP INDEX IF EXISTS idx_audit_logs_request_id;
DROP INDEX IF EXISTS idx_audit_logs_target;
DROP INDEX IF EXISTS idx_audit_logs_created_at;
DROP INDEX IF EXISTS idx_audit_logs_action;
DROP INDEX IF EXISTS idx_audit_logs_actor;
DROP INDEX IF EXISTS idx_audit_logs_org_id;

-- Sessions indexes
DROP INDEX IF EXISTS idx_sessions_last_used;
DROP INDEX IF EXISTS idx_sessions_active;
DROP INDEX IF EXISTS idx_sessions_refresh_jti;
DROP INDEX IF EXISTS idx_sessions_expires_at;
DROP INDEX IF EXISTS idx_sessions_org_id;
DROP INDEX IF EXISTS idx_sessions_user_id;

-- Memberships indexes
DROP INDEX IF EXISTS idx_org_admins;
DROP INDEX IF EXISTS idx_memberships_user_org;
DROP INDEX IF EXISTS idx_memberships_joined_at;
DROP INDEX IF EXISTS idx_memberships_invited_at;
DROP INDEX IF EXISTS idx_memberships_role;
DROP INDEX IF EXISTS idx_memberships_user_id;

-- Organizations indexes
DROP INDEX IF EXISTS idx_organizations_name_trgm;
DROP INDEX IF EXISTS idx_organizations_created_at;
DROP INDEX IF EXISTS idx_organizations_parent;
DROP INDEX IF EXISTS idx_organizations_slug;

-- Users indexes
DROP INDEX IF EXISTS idx_users_email_verified;
DROP INDEX IF EXISTS idx_users_created_at;
DROP INDEX IF EXISTS idx_users_status;
DROP INDEX IF EXISTS idx_users_email;

-- Revoke permissions
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM service_account;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM service_account;
REVOKE USAGE ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
REVOKE SELECT, INSERT, UPDATE ON rate_limits FROM authenticated;
REVOKE SELECT, INSERT, UPDATE ON usage_metrics FROM authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON magic_link_challenges FROM authenticated;
REVOKE SELECT, INSERT ON audit_logs FROM authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON sessions FROM authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON memberships FROM authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON organizations FROM authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON users FROM authenticated;

-- Drop roles
DROP ROLE IF EXISTS service_account;
DROP ROLE IF EXISTS authenticated;

-- Drop tables (in reverse dependency order)
DROP TABLE IF EXISTS rate_limits;
DROP TABLE IF EXISTS usage_metrics;
DROP TABLE IF EXISTS magic_link_challenges;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS memberships;
DROP TABLE IF EXISTS organizations;
DROP TABLE IF EXISTS users;

-- Drop custom types
DROP TYPE IF EXISTS audit_action;
DROP TYPE IF EXISTS membership_role;
DROP TYPE IF EXISTS user_status;

-- Drop extensions (only if they were created by this migration)
-- Note: Be careful with this in production - other applications might use these
-- DROP EXTENSION IF EXISTS "pg_stat_statements";
-- DROP EXTENSION IF EXISTS "citext";
-- DROP EXTENSION IF EXISTS "uuid-ossp";

-- Log rollback completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 001 rollback completed successfully at %', now();
END $$;
