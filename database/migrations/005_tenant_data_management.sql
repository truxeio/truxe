-- Migration: 005_tenant_data_management.sql
-- Description: Tenant data archival and cleanup procedures for production scale
-- Author: Heimdall Team
-- Date: 2024-01-16

-- ============================================================================
-- TENANT DATA ARCHIVAL TABLES
-- ============================================================================

-- Tenant data archival tracking
CREATE TABLE tenant_archival_logs (
  id bigserial PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  archival_type text NOT NULL, -- 'scheduled', 'manual', 'compliance'
  status text NOT NULL, -- 'pending', 'in_progress', 'completed', 'failed'
  data_types text[] NOT NULL, -- ['sessions', 'audit_logs', 'usage_metrics']
  retention_policy text NOT NULL, -- '7_days', '30_days', '90_days', '1_year'
  records_archived bigint DEFAULT 0,
  records_deleted bigint DEFAULT 0,
  archival_size_bytes bigint DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  
  -- Constraints
  CONSTRAINT valid_archival_type CHECK (archival_type IN ('scheduled', 'manual', 'compliance')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  CONSTRAINT valid_retention_policy CHECK (retention_policy IN ('7_days', '30_days', '90_days', '1_year')),
  CONSTRAINT non_negative_counts CHECK (records_archived >= 0 AND records_deleted >= 0),
  CONSTRAINT non_negative_size CHECK (archival_size_bytes >= 0)
);

-- Archived data storage (for compliance and recovery)
CREATE TABLE archived_sessions (
  id bigserial PRIMARY KEY,
  original_jti uuid NOT NULL,
  user_id uuid NOT NULL,
  org_id uuid NOT NULL,
  device_info jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  last_used_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text,
  archived_at timestamptz DEFAULT now(),
  archival_batch_id bigint REFERENCES tenant_archival_logs(id)
);

CREATE TABLE archived_audit_logs (
  id bigserial PRIMARY KEY,
  original_id bigint NOT NULL,
  org_id uuid NOT NULL,
  actor_user_id uuid,
  action text NOT NULL,
  target_type text,
  target_id text,
  details jsonb,
  ip inet,
  user_agent text,
  request_id uuid,
  created_at timestamptz NOT NULL,
  archived_at timestamptz DEFAULT now(),
  archival_batch_id bigint REFERENCES tenant_archival_logs(id)
);

CREATE TABLE archived_usage_metrics (
  id bigserial PRIMARY KEY,
  original_id bigint NOT NULL,
  org_id uuid NOT NULL,
  metric_type text NOT NULL,
  metric_value bigint NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL,
  archived_at timestamptz DEFAULT now(),
  archival_batch_id bigint REFERENCES tenant_archival_logs(id)
);

-- ============================================================================
-- ARCHIVAL PROCEDURE INDEXES
-- ============================================================================

-- Tenant archival logs indexes
CREATE INDEX idx_tenant_archival_org ON tenant_archival_logs(org_id, created_at);
CREATE INDEX idx_tenant_archival_status ON tenant_archival_logs(status, created_at);
CREATE INDEX idx_tenant_archival_type ON tenant_archival_logs(archival_type, created_at);

-- Archived data indexes
CREATE INDEX idx_archived_sessions_org ON archived_sessions(org_id, archived_at);
CREATE INDEX idx_archived_sessions_user ON archived_sessions(user_id, archived_at);
CREATE INDEX idx_archived_sessions_batch ON archived_sessions(archival_batch_id);

CREATE INDEX idx_archived_audit_org ON archived_audit_logs(org_id, archived_at);
CREATE INDEX idx_archived_audit_action ON archived_audit_logs(action, archived_at);
CREATE INDEX idx_archived_audit_batch ON archived_audit_logs(archival_batch_id);

CREATE INDEX idx_archived_metrics_org ON archived_usage_metrics(org_id, archived_at);
CREATE INDEX idx_archived_metrics_type ON archived_usage_metrics(metric_type, archived_at);
CREATE INDEX idx_archived_metrics_batch ON archived_usage_metrics(archival_batch_id);

-- ============================================================================
-- TENANT DATA ARCHIVAL FUNCTIONS
-- ============================================================================

-- Function to archive tenant data based on retention policy
CREATE OR REPLACE FUNCTION archive_tenant_data(
  p_org_id uuid,
  p_retention_policy text,
  p_data_types text[],
  p_created_by uuid DEFAULT NULL
)
RETURNS TABLE(
  archival_id bigint,
  records_archived bigint,
  records_deleted bigint,
  archival_size_bytes bigint,
  status text
) AS $$
DECLARE
  archival_log_id bigint;
  cutoff_date timestamptz;
  total_archived bigint := 0;
  total_deleted bigint := 0;
  total_size bigint := 0;
  current_type text;
  type_archived bigint;
  type_deleted bigint;
  type_size bigint;
BEGIN
  -- Determine cutoff date based on retention policy
  CASE p_retention_policy
    WHEN '7_days' THEN cutoff_date := now() - interval '7 days';
    WHEN '30_days' THEN cutoff_date := now() - interval '30 days';
    WHEN '90_days' THEN cutoff_date := now() - interval '90 days';
    WHEN '1_year' THEN cutoff_date := now() - interval '1 year';
    ELSE RAISE EXCEPTION 'Invalid retention policy: %', p_retention_policy;
  END CASE;
  
  -- Create archival log entry
  INSERT INTO tenant_archival_logs (
    org_id, archival_type, status, data_types, retention_policy, 
    started_at, created_by
  ) VALUES (
    p_org_id, 'manual', 'in_progress', p_data_types, p_retention_policy,
    now(), p_created_by
  ) RETURNING id INTO archival_log_id;
  
  -- Archive each data type
  FOREACH current_type IN ARRAY p_data_types
  LOOP
    CASE current_type
      WHEN 'sessions' THEN
        -- Archive sessions
        WITH archived AS (
          INSERT INTO archived_sessions (
            original_jti, user_id, org_id, device_info, ip, user_agent,
            created_at, expires_at, last_used_at, revoked_at, revoked_reason,
            archival_batch_id
          )
          SELECT 
            jti, user_id, org_id, device_info, ip, user_agent,
            created_at, expires_at, last_used_at, revoked_at, revoked_reason,
            archival_log_id
          FROM sessions
          WHERE org_id = p_org_id
            AND created_at < cutoff_date
          RETURNING *
        ),
        deleted AS (
          DELETE FROM sessions
          WHERE org_id = p_org_id
            AND created_at < cutoff_date
          RETURNING *
        )
        SELECT 
          (SELECT count(*) FROM archived),
          (SELECT count(*) FROM deleted),
          (SELECT COALESCE(sum(pg_column_size(device_info)), 0) FROM archived)
        INTO type_archived, type_deleted, type_size;
        
      WHEN 'audit_logs' THEN
        -- Archive audit logs
        WITH archived AS (
          INSERT INTO archived_audit_logs (
            original_id, org_id, actor_user_id, action, target_type, target_id,
            details, ip, user_agent, request_id, created_at, archival_batch_id
          )
          SELECT 
            id, org_id, actor_user_id, action, target_type, target_id,
            details, ip, user_agent, request_id, created_at, archival_log_id
          FROM audit_logs
          WHERE org_id = p_org_id
            AND created_at < cutoff_date
          RETURNING *
        ),
        deleted AS (
          DELETE FROM audit_logs
          WHERE org_id = p_org_id
            AND created_at < cutoff_date
          RETURNING *
        )
        SELECT 
          (SELECT count(*) FROM archived),
          (SELECT count(*) FROM deleted),
          (SELECT COALESCE(sum(pg_column_size(details)), 0) FROM archived)
        INTO type_archived, type_deleted, type_size;
        
      WHEN 'usage_metrics' THEN
        -- Archive usage metrics
        WITH archived AS (
          INSERT INTO archived_usage_metrics (
            original_id, org_id, metric_type, metric_value, period_start,
            period_end, metadata, created_at, archival_batch_id
          )
          SELECT 
            id, org_id, metric_type, metric_value, period_start,
            period_end, metadata, created_at, archival_log_id
          FROM usage_metrics
          WHERE org_id = p_org_id
            AND created_at < cutoff_date
          RETURNING *
        ),
        deleted AS (
          DELETE FROM usage_metrics
          WHERE org_id = p_org_id
            AND created_at < cutoff_date
          RETURNING *
        )
        SELECT 
          (SELECT count(*) FROM archived),
          (SELECT count(*) FROM deleted),
          (SELECT COALESCE(sum(pg_column_size(metadata)), 0) FROM archived)
        INTO type_archived, type_deleted, type_size;
        
      ELSE
        RAISE EXCEPTION 'Unknown data type: %', current_type;
    END CASE;
    
    total_archived := total_archived + type_archived;
    total_deleted := total_deleted + type_deleted;
    total_size := total_size + type_size;
  END LOOP;
  
  -- Update archival log with results
  UPDATE tenant_archival_logs
  SET 
    status = 'completed',
    records_archived = total_archived,
    records_deleted = total_deleted,
    archival_size_bytes = total_size,
    completed_at = now()
  WHERE id = archival_log_id;
  
  RETURN QUERY SELECT 
    archival_log_id,
    total_archived,
    total_deleted,
    total_size,
    'completed'::text;
    
EXCEPTION WHEN OTHERS THEN
  -- Update archival log with error
  UPDATE tenant_archival_logs
  SET 
    status = 'failed',
    error_message = SQLERRM,
    completed_at = now()
  WHERE id = archival_log_id;
  
  RAISE;
END;
$$ LANGUAGE plpgsql;

-- Function to restore archived data
CREATE OR REPLACE FUNCTION restore_archived_data(
  p_archival_batch_id bigint,
  p_restore_data_types text[]
)
RETURNS TABLE(
  restored_sessions bigint,
  restored_audit_logs bigint,
  restored_usage_metrics bigint
) AS $$
DECLARE
  sessions_restored bigint := 0;
  audit_logs_restored bigint := 0;
  usage_metrics_restored bigint := 0;
  current_type text;
BEGIN
  -- Restore each data type
  FOREACH current_type IN ARRAY p_restore_data_types
  LOOP
    CASE current_type
      WHEN 'sessions' THEN
        WITH restored AS (
          INSERT INTO sessions (
            jti, user_id, org_id, device_info, ip, user_agent,
            created_at, expires_at, last_used_at, revoked_at, revoked_reason
          )
          SELECT 
            original_jti, user_id, org_id, device_info, ip, user_agent,
            created_at, expires_at, last_used_at, revoked_at, revoked_reason
          FROM archived_sessions
          WHERE archival_batch_id = p_archival_batch_id
          RETURNING *
        )
        SELECT count(*) INTO sessions_restored FROM restored;
        
      WHEN 'audit_logs' THEN
        WITH restored AS (
          INSERT INTO audit_logs (
            org_id, actor_user_id, action, target_type, target_id,
            details, ip, user_agent, request_id, created_at
          )
          SELECT 
            org_id, actor_user_id, action, target_type, target_id,
            details, ip, user_agent, request_id, created_at
          FROM archived_audit_logs
          WHERE archival_batch_id = p_archival_batch_id
          RETURNING *
        )
        SELECT count(*) INTO audit_logs_restored FROM restored;
        
      WHEN 'usage_metrics' THEN
        WITH restored AS (
          INSERT INTO usage_metrics (
            org_id, metric_type, metric_value, period_start,
            period_end, metadata, created_at
          )
          SELECT 
            org_id, metric_type, metric_value, period_start,
            period_end, metadata, created_at
          FROM archived_usage_metrics
          WHERE archival_batch_id = p_archival_batch_id
          RETURNING *
        )
        SELECT count(*) INTO usage_metrics_restored FROM restored;
        
      ELSE
        RAISE EXCEPTION 'Unknown data type: %', current_type;
    END CASE;
  END LOOP;
  
  RETURN QUERY SELECT 
    sessions_restored,
    audit_logs_restored,
    usage_metrics_restored;
END;
$$ LANGUAGE plpgsql;

-- Function to get tenant data statistics
CREATE OR REPLACE FUNCTION get_tenant_data_stats(p_org_id uuid)
RETURNS TABLE(
  data_type text,
  record_count bigint,
  total_size_bytes bigint,
  oldest_record timestamptz,
  newest_record timestamptz,
  recommended_archival boolean
) AS $$
BEGIN
  RETURN QUERY
  WITH data_stats AS (
    SELECT 
      'sessions'::text as data_type,
      count(*) as record_count,
      COALESCE(sum(pg_column_size(device_info)), 0) as total_size_bytes,
      min(created_at) as oldest_record,
      max(created_at) as newest_record,
      (min(created_at) < now() - interval '90 days') as recommended_archival
    FROM sessions
    WHERE org_id = p_org_id
    
    UNION ALL
    
    SELECT 
      'audit_logs'::text,
      count(*),
      COALESCE(sum(pg_column_size(details)), 0),
      min(created_at),
      max(created_at),
      (min(created_at) < now() - interval '1 year')
    FROM audit_logs
    WHERE org_id = p_org_id
    
    UNION ALL
    
    SELECT 
      'usage_metrics'::text,
      count(*),
      COALESCE(sum(pg_column_size(metadata)), 0),
      min(created_at),
      max(created_at),
      (min(created_at) < now() - interval '1 year')
    FROM usage_metrics
    WHERE org_id = p_org_id
  )
  SELECT * FROM data_stats
  ORDER BY data_type;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old archived data
CREATE OR REPLACE FUNCTION cleanup_old_archived_data(
  p_retention_years integer DEFAULT 7
)
RETURNS TABLE(
  deleted_sessions bigint,
  deleted_audit_logs bigint,
  deleted_usage_metrics bigint,
  deleted_archival_logs bigint
) AS $$
DECLARE
  sessions_deleted bigint := 0;
  audit_logs_deleted bigint := 0;
  usage_metrics_deleted bigint := 0;
  archival_logs_deleted bigint := 0;
  cutoff_date timestamptz;
BEGIN
  cutoff_date := now() - (p_retention_years || ' years')::interval;
  
  -- Delete old archived sessions
  DELETE FROM archived_sessions 
  WHERE archived_at < cutoff_date;
  GET DIAGNOSTICS sessions_deleted = ROW_COUNT;
  
  -- Delete old archived audit logs
  DELETE FROM archived_audit_logs 
  WHERE archived_at < cutoff_date;
  GET DIAGNOSTICS audit_logs_deleted = ROW_COUNT;
  
  -- Delete old archived usage metrics
  DELETE FROM archived_usage_metrics 
  WHERE archived_at < cutoff_date;
  GET DIAGNOSTICS usage_metrics_deleted = ROW_COUNT;
  
  -- Delete old archival logs
  DELETE FROM tenant_archival_logs 
  WHERE completed_at < cutoff_date
    AND status = 'completed';
  GET DIAGNOSTICS archival_logs_deleted = ROW_COUNT;
  
  RETURN QUERY SELECT 
    sessions_deleted,
    audit_logs_deleted,
    usage_metrics_deleted,
    archival_logs_deleted;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- AUTOMATED ARCHIVAL PROCEDURES
-- ============================================================================

-- Function to run scheduled archival for all tenants
CREATE OR REPLACE FUNCTION run_scheduled_archival()
RETURNS TABLE(
  org_id uuid,
  archival_id bigint,
  status text,
  records_archived bigint
) AS $$
DECLARE
  tenant_record RECORD;
  archival_result RECORD;
BEGIN
  -- Get all active organizations
  FOR tenant_record IN 
    SELECT id, slug, name 
    FROM organizations 
    WHERE id NOT IN (
      SELECT DISTINCT org_id 
      FROM tenant_archival_logs 
      WHERE status = 'in_progress'
        AND started_at > now() - interval '1 hour'
    )
  LOOP
    -- Check if tenant needs archival
    IF EXISTS (
      SELECT 1 FROM get_tenant_data_stats(tenant_record.id) 
      WHERE recommended_archival = true
    ) THEN
      -- Run archival for this tenant
      BEGIN
        SELECT * INTO archival_result
        FROM archive_tenant_data(
          tenant_record.id,
          '90_days',
          ARRAY['sessions', 'audit_logs'],
          NULL
        );
        
        RETURN QUERY SELECT 
          tenant_record.id,
          archival_result.archival_id,
          'completed'::text,
          archival_result.records_archived;
          
      EXCEPTION WHEN OTHERS THEN
        -- Log error and continue with next tenant
        INSERT INTO audit_logs (org_id, action, details)
        VALUES (
          tenant_record.id,
          'system.archival_error',
          jsonb_build_object(
            'error', SQLERRM,
            'tenant', tenant_record.slug
          )
        );
        
        RETURN QUERY SELECT 
          tenant_record.id,
          NULL::bigint,
          'failed'::text,
          0::bigint;
      END;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TENANT DATA CLEANUP FUNCTIONS
-- ============================================================================

-- Function to cleanup inactive tenant data
CREATE OR REPLACE FUNCTION cleanup_inactive_tenant_data(
  p_inactive_days integer DEFAULT 365
)
RETURNS TABLE(
  org_id uuid,
  org_slug text,
  cleanup_type text,
  records_cleaned bigint,
  space_freed_bytes bigint
) AS $$
DECLARE
  tenant_record RECORD;
  cutoff_date timestamptz;
  sessions_cleaned bigint;
  audit_cleaned bigint;
  metrics_cleaned bigint;
  total_space_freed bigint;
BEGIN
  cutoff_date := now() - (p_inactive_days || ' days')::interval;
  
  -- Find inactive tenants (no activity in specified days)
  FOR tenant_record IN
    SELECT o.id, o.slug, o.name
    FROM organizations o
    WHERE o.id NOT IN (
      SELECT DISTINCT org_id 
      FROM audit_logs 
      WHERE created_at > cutoff_date
    )
    AND o.created_at < cutoff_date
  LOOP
    total_space_freed := 0;
    
    -- Cleanup sessions
    DELETE FROM sessions 
    WHERE org_id = tenant_record.id;
    GET DIAGNOSTICS sessions_cleaned = ROW_COUNT;
    
    -- Cleanup audit logs (keep some for compliance)
    DELETE FROM audit_logs 
    WHERE org_id = tenant_record.id
      AND created_at < cutoff_date;
    GET DIAGNOSTICS audit_cleaned = ROW_COUNT;
    
    -- Cleanup usage metrics
    DELETE FROM usage_metrics 
    WHERE org_id = tenant_record.id;
    GET DIAGNOSTICS metrics_cleaned = ROW_COUNT;
    
    -- Calculate space freed (approximate)
    total_space_freed := (sessions_cleaned + audit_cleaned + metrics_cleaned) * 1000;
    
    RETURN QUERY SELECT 
      tenant_record.id,
      tenant_record.slug,
      'inactive_cleanup'::text,
      sessions_cleaned + audit_cleaned + metrics_cleaned,
      total_space_freed;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to optimize tenant data storage
CREATE OR REPLACE FUNCTION optimize_tenant_storage()
RETURNS TABLE(
  optimization_type text,
  records_affected bigint,
  space_saved_bytes bigint
) AS $$
DECLARE
  sessions_optimized bigint := 0;
  audit_optimized bigint := 0;
  space_saved bigint := 0;
BEGIN
  -- Optimize sessions table
  WITH optimized AS (
    DELETE FROM sessions 
    WHERE revoked_at IS NOT NULL 
      AND revoked_at < now() - interval '30 days'
    RETURNING *
  )
  SELECT count(*) INTO sessions_optimized FROM optimized;
  
  -- Optimize audit logs (remove very old logs)
  WITH optimized AS (
    DELETE FROM audit_logs 
    WHERE created_at < now() - interval '2 years'
      AND action NOT IN ('user.login', 'user.logout', 'membership.joined')
    RETURNING *
  )
  SELECT count(*) INTO audit_optimized FROM optimized;
  
  -- Calculate space saved (approximate)
  space_saved := (sessions_optimized + audit_optimized) * 500;
  
  RETURN QUERY
  SELECT 'sessions_cleanup'::text, sessions_optimized, sessions_optimized * 500
  UNION ALL
  SELECT 'audit_cleanup'::text, audit_optimized, audit_optimized * 500;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE tenant_archival_logs IS 'Tracks tenant data archival operations for compliance and recovery';
COMMENT ON TABLE archived_sessions IS 'Archived session data for compliance and recovery purposes';
COMMENT ON TABLE archived_audit_logs IS 'Archived audit log data for compliance and recovery purposes';
COMMENT ON TABLE archived_usage_metrics IS 'Archived usage metrics for compliance and recovery purposes';

COMMENT ON FUNCTION archive_tenant_data IS 'Archive tenant data based on retention policy';
COMMENT ON FUNCTION restore_archived_data IS 'Restore archived data from specific archival batch';
COMMENT ON FUNCTION get_tenant_data_stats IS 'Get statistics about tenant data for archival decisions';
COMMENT ON FUNCTION cleanup_old_archived_data IS 'Cleanup old archived data after retention period';
COMMENT ON FUNCTION run_scheduled_archival IS 'Run scheduled archival for all tenants';
COMMENT ON FUNCTION cleanup_inactive_tenant_data IS 'Cleanup data for inactive tenants';
COMMENT ON FUNCTION optimize_tenant_storage IS 'Optimize tenant data storage by removing old data';

-- Migration metadata
INSERT INTO schema_migrations (version, description, applied_at) 
VALUES ('005', 'Tenant data archival and cleanup procedures for production scale', now())
ON CONFLICT (version) DO NOTHING;
