-- Migration Rollback: 004_performance_monitoring_rollback.sql
-- Description: Rollback performance monitoring tables and functions
-- Author: Heimdall Team
-- Date: 2024-01-16

-- ============================================================================
-- ROLLBACK PERFORMANCE MONITORING
-- ============================================================================

-- Drop performance monitoring functions
DROP FUNCTION IF EXISTS collect_query_metrics(text, numeric, bigint, bigint, bigint, bigint, uuid, uuid, text);
DROP FUNCTION IF EXISTS analyze_slow_queries(integer, numeric);
DROP FUNCTION IF EXISTS get_tenant_performance_summary(uuid, integer);
DROP FUNCTION IF EXISTS check_database_health();
DROP FUNCTION IF EXISTS cleanup_performance_metrics(integer);
DROP FUNCTION IF EXISTS suggest_index_optimizations();

-- Drop performance monitoring tables
DROP TABLE IF EXISTS query_performance_metrics CASCADE;
DROP TABLE IF EXISTS tenant_performance_metrics CASCADE;
DROP TABLE IF EXISTS database_health_metrics CASCADE;

-- Migration metadata
DELETE FROM schema_migrations WHERE version = '004';
