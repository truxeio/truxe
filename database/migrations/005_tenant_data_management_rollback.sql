-- Migration Rollback: 005_tenant_data_management_rollback.sql
-- Description: Rollback tenant data management tables and functions
-- Author: Heimdall Team
-- Date: 2024-01-16

-- ============================================================================
-- ROLLBACK TENANT DATA MANAGEMENT
-- ============================================================================

-- Drop tenant data management functions
DROP FUNCTION IF EXISTS archive_tenant_data(uuid, text, text[], uuid);
DROP FUNCTION IF EXISTS restore_archived_data(bigint, text[]);
DROP FUNCTION IF EXISTS get_tenant_data_stats(uuid);
DROP FUNCTION IF EXISTS cleanup_old_archived_data(integer);
DROP FUNCTION IF EXISTS run_scheduled_archival();
DROP FUNCTION IF EXISTS cleanup_inactive_tenant_data(integer);
DROP FUNCTION IF EXISTS optimize_tenant_storage();

-- Drop archived data tables
DROP TABLE IF EXISTS archived_sessions CASCADE;
DROP TABLE IF EXISTS archived_audit_logs CASCADE;
DROP TABLE IF EXISTS archived_usage_metrics CASCADE;

-- Drop tenant archival tracking table
DROP TABLE IF EXISTS tenant_archival_logs CASCADE;

-- Migration metadata
DELETE FROM schema_migrations WHERE version = '005';
