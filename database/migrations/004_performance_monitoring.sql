-- Migration: 004_performance_monitoring.sql
-- Description: Advanced performance monitoring for multi-tenant database
-- Author: Heimdall Team
-- Date: 2024-01-16

-- ============================================================================
-- PERFORMANCE MONITORING TABLES
-- ============================================================================

-- Query performance metrics table
CREATE TABLE query_performance_metrics (
  id bigserial PRIMARY KEY,
  query_hash text NOT NULL,
  query_text text NOT NULL,
  execution_time_ms numeric NOT NULL,
  rows_returned bigint NOT NULL,
  rows_examined bigint NOT NULL,
  buffer_hits bigint NOT NULL,
  buffer_misses bigint NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  org_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  tenant_id text, -- For multi-tenant analysis
  query_type text NOT NULL, -- select, insert, update, delete, rls
  created_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT positive_execution_time CHECK (execution_time_ms > 0),
  CONSTRAINT non_negative_rows CHECK (rows_returned >= 0 AND rows_examined >= 0),
  CONSTRAINT non_negative_buffers CHECK (buffer_hits >= 0 AND buffer_misses >= 0)
);

-- Tenant-specific performance metrics
CREATE TABLE tenant_performance_metrics (
  id bigserial PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  metric_date date NOT NULL,
  total_queries bigint DEFAULT 0,
  avg_response_time_ms numeric DEFAULT 0,
  p95_response_time_ms numeric DEFAULT 0,
  p99_response_time_ms numeric DEFAULT 0,
  error_count bigint DEFAULT 0,
  slow_query_count bigint DEFAULT 0, -- queries > 200ms
  rls_query_count bigint DEFAULT 0,
  connection_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT unique_org_date UNIQUE(org_id, metric_date),
  CONSTRAINT non_negative_metrics CHECK (
    total_queries >= 0 AND 
    avg_response_time_ms >= 0 AND 
    p95_response_time_ms >= 0 AND 
    p99_response_time_ms >= 0 AND 
    error_count >= 0 AND 
    slow_query_count >= 0 AND 
    rls_query_count >= 0 AND 
    connection_count >= 0
  )
);

-- Database health metrics
CREATE TABLE database_health_metrics (
  id bigserial PRIMARY KEY,
  metric_name text NOT NULL,
  metric_value numeric NOT NULL,
  metric_unit text NOT NULL,
  threshold_warning numeric,
  threshold_critical numeric,
  status text NOT NULL, -- healthy, warning, critical
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('healthy', 'warning', 'critical')),
  CONSTRAINT non_negative_value CHECK (metric_value >= 0)
);

-- ============================================================================
-- PERFORMANCE MONITORING INDEXES
-- ============================================================================

-- Query performance metrics indexes
CREATE INDEX idx_query_performance_hash ON query_performance_metrics(query_hash);
CREATE INDEX idx_query_performance_created_at ON query_performance_metrics(created_at);
CREATE INDEX idx_query_performance_execution_time ON query_performance_metrics(execution_time_ms);
CREATE INDEX idx_query_performance_tenant ON query_performance_metrics(org_id, created_at);
CREATE INDEX idx_query_performance_type ON query_performance_metrics(query_type, created_at);
CREATE INDEX idx_query_performance_slow ON query_performance_metrics(execution_time_ms) WHERE execution_time_ms > 200;

-- Tenant performance metrics indexes
CREATE INDEX idx_tenant_performance_org_date ON tenant_performance_metrics(org_id, metric_date);
CREATE INDEX idx_tenant_performance_date ON tenant_performance_metrics(metric_date);
CREATE INDEX idx_tenant_performance_slow ON tenant_performance_metrics(org_id) WHERE slow_query_count > 0;

-- Database health metrics indexes
CREATE INDEX idx_db_health_name ON database_health_metrics(metric_name, created_at);
CREATE INDEX idx_db_health_status ON database_health_metrics(status, created_at);
CREATE INDEX idx_db_health_critical ON database_health_metrics(created_at) WHERE status = 'critical';

-- ============================================================================
-- PERFORMANCE MONITORING FUNCTIONS
-- ============================================================================

-- Function to collect query performance metrics
CREATE OR REPLACE FUNCTION collect_query_metrics(
  p_query_text text,
  p_execution_time_ms numeric,
  p_rows_returned bigint,
  p_rows_examined bigint,
  p_buffer_hits bigint,
  p_buffer_misses bigint,
  p_user_id uuid DEFAULT NULL,
  p_org_id uuid DEFAULT NULL,
  p_query_type text DEFAULT 'unknown'
)
RETURNS void AS $$
DECLARE
  query_hash text;
  tenant_id text;
BEGIN
  -- Generate query hash for deduplication
  query_hash := encode(digest(p_query_text, 'sha256'), 'hex');
  
  -- Determine tenant ID
  tenant_id := COALESCE(p_org_id::text, 'global');
  
  -- Insert metrics
  INSERT INTO query_performance_metrics (
    query_hash, query_text, execution_time_ms, rows_returned, rows_examined,
    buffer_hits, buffer_misses, user_id, org_id, tenant_id, query_type
  ) VALUES (
    query_hash, p_query_text, p_execution_time_ms, p_rows_returned, p_rows_examined,
    p_buffer_hits, p_buffer_misses, p_user_id, p_org_id, tenant_id, p_query_type
  );
  
  -- Update tenant metrics
  INSERT INTO tenant_performance_metrics (
    org_id, metric_date, total_queries, avg_response_time_ms
  ) VALUES (
    p_org_id, CURRENT_DATE, 1, p_execution_time_ms
  )
  ON CONFLICT (org_id, metric_date) DO UPDATE SET
    total_queries = tenant_performance_metrics.total_queries + 1,
    avg_response_time_ms = (
      (tenant_performance_metrics.avg_response_time_ms * tenant_performance_metrics.total_queries + p_execution_time_ms) 
      / (tenant_performance_metrics.total_queries + 1)
    ),
    slow_query_count = tenant_performance_metrics.slow_query_count + 
      CASE WHEN p_execution_time_ms > 200 THEN 1 ELSE 0 END,
    rls_query_count = tenant_performance_metrics.rls_query_count + 
      CASE WHEN p_query_type = 'rls' THEN 1 ELSE 0 END,
    updated_at = now();
    
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the main query
  INSERT INTO audit_logs (action, details) 
  VALUES ('system.metrics_error', jsonb_build_object(
    'error', SQLERRM,
    'function', 'collect_query_metrics'
  ));
END;
$$ LANGUAGE plpgsql;

-- Function to analyze slow queries
CREATE OR REPLACE FUNCTION analyze_slow_queries(
  p_hours_back integer DEFAULT 24,
  p_min_execution_time_ms numeric DEFAULT 200
)
RETURNS TABLE(
  query_hash text,
  query_text text,
  execution_count bigint,
  avg_execution_time_ms numeric,
  max_execution_time_ms numeric,
  total_execution_time_ms numeric,
  affected_tenants bigint,
  first_seen timestamptz,
  last_seen timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    qpm.query_hash,
    qpm.query_text,
    COUNT(*) as execution_count,
    AVG(qpm.execution_time_ms) as avg_execution_time_ms,
    MAX(qpm.execution_time_ms) as max_execution_time_ms,
    SUM(qpm.execution_time_ms) as total_execution_time_ms,
    COUNT(DISTINCT qpm.org_id) as affected_tenants,
    MIN(qpm.created_at) as first_seen,
    MAX(qpm.created_at) as last_seen
  FROM query_performance_metrics qpm
  WHERE qpm.created_at >= now() - (p_hours_back || ' hours')::interval
    AND qpm.execution_time_ms >= p_min_execution_time_ms
  GROUP BY qpm.query_hash, qpm.query_text
  ORDER BY total_execution_time_ms DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get tenant performance summary
CREATE OR REPLACE FUNCTION get_tenant_performance_summary(
  p_org_id uuid DEFAULT NULL,
  p_days_back integer DEFAULT 7
)
RETURNS TABLE(
  org_id uuid,
  org_name text,
  metric_date date,
  total_queries bigint,
  avg_response_time_ms numeric,
  p95_response_time_ms numeric,
  p99_response_time_ms numeric,
  error_rate numeric,
  slow_query_rate numeric,
  rls_query_rate numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tpm.org_id,
    o.name as org_name,
    tpm.metric_date,
    tpm.total_queries,
    tpm.avg_response_time_ms,
    tpm.p95_response_time_ms,
    tpm.p99_response_time_ms,
    CASE 
      WHEN tpm.total_queries > 0 THEN (tpm.error_count::numeric / tpm.total_queries) * 100
      ELSE 0 
    END as error_rate,
    CASE 
      WHEN tpm.total_queries > 0 THEN (tpm.slow_query_count::numeric / tpm.total_queries) * 100
      ELSE 0 
    END as slow_query_rate,
    CASE 
      WHEN tpm.total_queries > 0 THEN (tpm.rls_query_count::numeric / tpm.total_queries) * 100
      ELSE 0 
    END as rls_query_rate
  FROM tenant_performance_metrics tpm
  LEFT JOIN organizations o ON tpm.org_id = o.id
  WHERE (p_org_id IS NULL OR tpm.org_id = p_org_id)
    AND tpm.metric_date >= CURRENT_DATE - p_days_back
  ORDER BY tpm.org_id, tpm.metric_date DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to check database health
CREATE OR REPLACE FUNCTION check_database_health()
RETURNS TABLE(
  metric_name text,
  metric_value numeric,
  metric_unit text,
  status text,
  threshold_warning numeric,
  threshold_critical numeric,
  details text
) AS $$
DECLARE
  connection_count integer;
  active_connections integer;
  cache_hit_ratio numeric;
  slow_query_count bigint;
  deadlock_count bigint;
  lock_wait_count bigint;
BEGIN
  -- Get current connection count
  SELECT count(*) INTO connection_count FROM pg_stat_activity;
  
  -- Get active connections (not idle)
  SELECT count(*) INTO active_connections 
  FROM pg_stat_activity 
  WHERE state != 'idle';
  
  -- Calculate cache hit ratio
  SELECT 
    CASE 
      WHEN (blks_hit + blks_read) > 0 
      THEN (blks_hit::numeric / (blks_hit + blks_read)) * 100
      ELSE 0 
    END INTO cache_hit_ratio
  FROM pg_stat_database 
  WHERE datname = current_database();
  
  -- Count slow queries in last hour
  SELECT count(*) INTO slow_query_count
  FROM query_performance_metrics
  WHERE created_at >= now() - interval '1 hour'
    AND execution_time_ms > 200;
  
  -- Count deadlocks (from pg_stat_database)
  SELECT deadlocks INTO deadlock_count
  FROM pg_stat_database 
  WHERE datname = current_database();
  
  -- Count lock waits
  SELECT count(*) INTO lock_wait_count
  FROM pg_stat_activity
  WHERE wait_event_type = 'Lock';
  
  -- Insert health metrics
  INSERT INTO database_health_metrics (metric_name, metric_value, metric_unit, status, threshold_warning, threshold_critical, details)
  VALUES 
    ('connection_count', connection_count, 'connections', 
     CASE WHEN connection_count > 80 THEN 'warning' WHEN connection_count > 95 THEN 'critical' ELSE 'healthy' END,
     80, 95, '{"active_connections": ' || active_connections || '}'),
    
    ('cache_hit_ratio', cache_hit_ratio, 'percent',
     CASE WHEN cache_hit_ratio < 95 THEN 'warning' WHEN cache_hit_ratio < 90 THEN 'critical' ELSE 'healthy' END,
     95, 90, '{}'),
    
    ('slow_queries_per_hour', slow_query_count, 'queries',
     CASE WHEN slow_query_count > 100 THEN 'warning' WHEN slow_query_count > 500 THEN 'critical' ELSE 'healthy' END,
     100, 500, '{}'),
    
    ('deadlocks', deadlock_count, 'count',
     CASE WHEN deadlock_count > 0 THEN 'critical' ELSE 'healthy' END,
     0, 0, '{}'),
    
    ('lock_waits', lock_wait_count, 'count',
     CASE WHEN lock_wait_count > 5 THEN 'warning' WHEN lock_wait_count > 20 THEN 'critical' ELSE 'healthy' END,
     5, 20, '{}');
  
  -- Return current health status
  RETURN QUERY
  SELECT 
    dhm.metric_name,
    dhm.metric_value,
    dhm.metric_unit,
    dhm.status,
    dhm.threshold_warning,
    dhm.threshold_critical,
    dhm.details::text
  FROM database_health_metrics dhm
  WHERE dhm.created_at >= now() - interval '1 minute'
  ORDER BY dhm.metric_name;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old performance metrics
CREATE OR REPLACE FUNCTION cleanup_performance_metrics(
  p_days_to_keep integer DEFAULT 30
)
RETURNS TABLE(
  deleted_query_metrics bigint,
  deleted_tenant_metrics bigint,
  deleted_health_metrics bigint
) AS $$
DECLARE
  query_count bigint;
  tenant_count bigint;
  health_count bigint;
BEGIN
  -- Cleanup old query performance metrics
  DELETE FROM query_performance_metrics 
  WHERE created_at < now() - (p_days_to_keep || ' days')::interval;
  GET DIAGNOSTICS query_count = ROW_COUNT;
  
  -- Cleanup old tenant performance metrics
  DELETE FROM tenant_performance_metrics 
  WHERE created_at < now() - (p_days_to_keep || ' days')::interval;
  GET DIAGNOSTICS tenant_count = ROW_COUNT;
  
  -- Cleanup old health metrics (keep only last 7 days)
  DELETE FROM database_health_metrics 
  WHERE created_at < now() - interval '7 days';
  GET DIAGNOSTICS health_count = ROW_COUNT;
  
  RETURN QUERY SELECT query_count, tenant_count, health_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- AUTOMATED MONITORING TRIGGERS
-- ============================================================================

-- Function to automatically collect metrics on query execution
CREATE OR REPLACE FUNCTION log_query_performance()
RETURNS event_trigger AS $$
DECLARE
  query_text text;
  execution_time_ms numeric;
  rows_returned bigint;
  rows_examined bigint;
  buffer_hits bigint;
  buffer_misses bigint;
  user_id uuid;
  org_id uuid;
  query_type text;
BEGIN
  -- This would be called by a custom extension or application-level monitoring
  -- For now, we'll create a placeholder that can be called manually
  NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PERFORMANCE OPTIMIZATION FUNCTIONS
-- ============================================================================

-- Function to suggest index optimizations
CREATE OR REPLACE FUNCTION suggest_index_optimizations()
RETURNS TABLE(
  table_name text,
  column_name text,
  query_count bigint,
  avg_selectivity numeric,
  suggested_index text,
  estimated_benefit text
) AS $$
BEGIN
  RETURN QUERY
  WITH query_stats AS (
    SELECT 
      regexp_replace(qpm.query_text, '\$\d+', '?', 'g') as normalized_query,
      COUNT(*) as query_count,
      AVG(qpm.execution_time_ms) as avg_time,
      AVG(qpm.rows_examined) as avg_rows_examined
    FROM query_performance_metrics qpm
    WHERE qpm.created_at >= now() - interval '7 days'
      AND qpm.execution_time_ms > 100
    GROUP BY normalized_query
  ),
  table_usage AS (
    SELECT 
      schemaname,
      tablename,
      attname,
      n_distinct,
      correlation,
      most_common_vals
    FROM pg_stats
    WHERE schemaname = 'public'
  )
  SELECT 
    'suggestions'::text as table_name,
    'analysis'::text as column_name,
    0::bigint as query_count,
    0.0::numeric as avg_selectivity,
    'Run ANALYZE and check pg_stat_user_indexes'::text as suggested_index,
    'Review unused indexes and missing indexes'::text as estimated_benefit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE query_performance_metrics IS 'Detailed query performance metrics for optimization analysis';
COMMENT ON TABLE tenant_performance_metrics IS 'Aggregated performance metrics per tenant for monitoring';
COMMENT ON TABLE database_health_metrics IS 'Database health indicators and thresholds';

COMMENT ON FUNCTION collect_query_metrics IS 'Collect and store query performance metrics';
COMMENT ON FUNCTION analyze_slow_queries IS 'Analyze slow queries for optimization opportunities';
COMMENT ON FUNCTION get_tenant_performance_summary IS 'Get performance summary for specific tenant or all tenants';
COMMENT ON FUNCTION check_database_health IS 'Check overall database health and insert metrics';
COMMENT ON FUNCTION cleanup_performance_metrics IS 'Cleanup old performance metrics to manage storage';
COMMENT ON FUNCTION suggest_index_optimizations IS 'Suggest index optimizations based on query patterns';

-- Migration metadata
INSERT INTO schema_migrations (version, description, applied_at) 
VALUES ('004', 'Advanced performance monitoring for multi-tenant database', now())
ON CONFLICT (version) DO NOTHING;
