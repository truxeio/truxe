-- Migration: 003_optimize_rls_performance.sql
-- Description: Optimize RLS policies for production scale performance
-- Author: Heimdall Team
-- Date: 2024-01-16

-- ============================================================================
-- PERFORMANCE-OPTIMIZED RLS POLICIES
-- ============================================================================

-- Drop existing policies to recreate with optimizations
DROP POLICY IF EXISTS org_member_access ON organizations;
DROP POLICY IF EXISTS org_create_access ON organizations;
DROP POLICY IF EXISTS org_modify_access ON organizations;
DROP POLICY IF EXISTS org_delete_access ON organizations;
DROP POLICY IF EXISTS org_hierarchical_access ON organizations;

DROP POLICY IF EXISTS membership_org_access ON memberships;
DROP POLICY IF EXISTS membership_invite_access ON memberships;
DROP POLICY IF EXISTS membership_self_accept ON memberships;
DROP POLICY IF EXISTS membership_admin_modify ON memberships;
DROP POLICY IF EXISTS membership_remove_access ON memberships;

DROP POLICY IF EXISTS session_owner_access ON sessions;
DROP POLICY IF EXISTS session_service_access ON sessions;

DROP POLICY IF EXISTS audit_org_read_access ON audit_logs;
DROP POLICY IF EXISTS audit_insert_access ON audit_logs;
DROP POLICY IF EXISTS audit_service_access ON audit_logs;

DROP POLICY IF EXISTS usage_metrics_org_access ON usage_metrics;
DROP POLICY IF EXISTS usage_metrics_system_access ON usage_metrics;
DROP POLICY IF EXISTS usage_metrics_update_access ON usage_metrics;

-- ============================================================================
-- OPTIMIZED UTILITY FUNCTIONS
-- ============================================================================

-- Create materialized view for user organization access (refreshed every 5 minutes)
CREATE MATERIALIZED VIEW user_org_access_cache AS
SELECT 
  m.user_id,
  m.org_id,
  m.role,
  o.parent_org_id,
  CASE 
    WHEN m.role IN ('owner', 'admin') THEN true 
    ELSE false 
  END as is_admin
FROM memberships m
JOIN organizations o ON m.org_id = o.id
WHERE m.joined_at IS NOT NULL;

-- Create indexes on materialized view
CREATE UNIQUE INDEX idx_user_org_access_cache_user_org ON user_org_access_cache(user_id, org_id);
CREATE INDEX idx_user_org_access_cache_user_id ON user_org_access_cache(user_id);
CREATE INDEX idx_user_org_access_cache_org_id ON user_org_access_cache(org_id);
CREATE INDEX idx_user_org_access_cache_admin ON user_org_access_cache(user_id) WHERE is_admin = true;

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_user_org_access_cache()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_org_access_cache;
END;
$$ LANGUAGE plpgsql;

-- Optimized function to get user's accessible organizations (uses materialized view)
CREATE OR REPLACE FUNCTION user_accessible_orgs_optimized(check_user_id uuid)
RETURNS uuid[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT uoa.org_id 
    FROM user_org_access_cache uoa
    WHERE uoa.user_id = check_user_id
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Optimized function to get user's admin organizations
CREATE OR REPLACE FUNCTION user_admin_orgs_optimized(check_user_id uuid)
RETURNS uuid[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT uoa.org_id 
    FROM user_org_access_cache uoa
    WHERE uoa.user_id = check_user_id
    AND uoa.is_admin = true
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check if user has access to specific organization (optimized)
CREATE OR REPLACE FUNCTION user_has_org_access_optimized(
  check_user_id uuid,
  check_org_id uuid
)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_org_access_cache uoa
    WHERE uoa.user_id = check_user_id
    AND uoa.org_id = check_org_id
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- OPTIMIZED ORGANIZATIONS TABLE RLS POLICIES
-- ============================================================================

-- Policy: Users can access organizations they're members of (optimized)
CREATE POLICY org_member_access_optimized ON organizations
FOR ALL TO authenticated
USING (
  id = ANY(user_accessible_orgs_optimized(current_user_id()))
);

-- Policy: Users can create organizations
CREATE POLICY org_create_access_optimized ON organizations
FOR INSERT TO authenticated
WITH CHECK (true);

-- Policy: Only owners/admins can modify organizations (optimized)
CREATE POLICY org_modify_access_optimized ON organizations
FOR UPDATE TO authenticated
USING (
  id = ANY(user_admin_orgs_optimized(current_user_id()))
)
WITH CHECK (
  id = ANY(user_admin_orgs_optimized(current_user_id()))
);

-- Policy: Only owners can delete organizations (optimized)
CREATE POLICY org_delete_access_optimized ON organizations
FOR DELETE TO authenticated
USING (
  user_has_role_in_org(current_user_id(), id, 'owner')
);

-- Policy: Support hierarchical organization access for admins (optimized)
CREATE POLICY org_hierarchical_access_optimized ON organizations
FOR SELECT TO authenticated
USING (
  id = ANY(user_accessible_orgs_optimized(current_user_id()))
  OR 
  -- Allow access to child organizations if user is admin/owner of parent
  parent_org_id = ANY(user_admin_orgs_optimized(current_user_id()))
);

-- ============================================================================
-- OPTIMIZED MEMBERSHIPS TABLE RLS POLICIES
-- ============================================================================

-- Policy: Users can see memberships in their organizations (optimized)
CREATE POLICY membership_org_access_optimized ON memberships
FOR SELECT TO authenticated
USING (
  org_id = ANY(user_accessible_orgs_optimized(current_user_id()))
);

-- Policy: Admins can invite users to their organizations (optimized)
CREATE POLICY membership_invite_access_optimized ON memberships
FOR INSERT TO authenticated
WITH CHECK (
  org_id = ANY(user_admin_orgs_optimized(current_user_id()))
  AND invited_by = current_user_id()
);

-- Policy: Users can accept their own invitations (optimized)
CREATE POLICY membership_self_accept_optimized ON memberships
FOR UPDATE TO authenticated
USING (
  user_id = current_user_id()
  AND joined_at IS NULL
)
WITH CHECK (
  user_id = current_user_id()
  AND joined_at IS NOT NULL
);

-- Policy: Admins can modify memberships in their organizations (optimized)
CREATE POLICY membership_admin_modify_optimized ON memberships
FOR UPDATE TO authenticated
USING (
  org_id = ANY(user_admin_orgs_optimized(current_user_id()))
  AND user_id != current_user_id()
)
WITH CHECK (
  org_id = ANY(user_admin_orgs_optimized(current_user_id()))
);

-- Policy: Admins can remove memberships, users can remove themselves (optimized)
CREATE POLICY membership_remove_access_optimized ON memberships
FOR DELETE TO authenticated
USING (
  org_id = ANY(user_admin_orgs_optimized(current_user_id()))
  OR user_id = current_user_id()
);

-- ============================================================================
-- OPTIMIZED SESSIONS TABLE RLS POLICIES
-- ============================================================================

-- Policy: Users can only access their own sessions (optimized with index hint)
CREATE POLICY session_owner_access_optimized ON sessions
FOR ALL TO authenticated
USING (user_id = current_user_id());

-- Policy: Service accounts can access all sessions
CREATE POLICY session_service_access_optimized ON sessions
FOR ALL TO service_account
USING (true);

-- ============================================================================
-- OPTIMIZED AUDIT LOGS TABLE RLS POLICIES
-- ============================================================================

-- Policy: Users can see audit logs for their organizations (optimized)
CREATE POLICY audit_org_read_access_optimized ON audit_logs
FOR SELECT TO authenticated
USING (
  org_id = ANY(user_admin_orgs_optimized(current_user_id()))
);

-- Policy: System can insert audit logs with proper org context (optimized)
CREATE POLICY audit_insert_access_optimized ON audit_logs
FOR INSERT TO authenticated
WITH CHECK (
  org_id IS NULL 
  OR org_id = ANY(user_accessible_orgs_optimized(current_user_id()))
);

-- Policy: Service accounts can access all audit logs
CREATE POLICY audit_service_access_optimized ON audit_logs
FOR SELECT TO service_account
USING (true);

-- ============================================================================
-- OPTIMIZED USAGE METRICS TABLE RLS POLICIES
-- ============================================================================

-- Policy: Users can see usage metrics for their organizations (optimized)
CREATE POLICY usage_metrics_org_access_optimized ON usage_metrics
FOR SELECT TO authenticated
USING (
  org_id = ANY(user_admin_orgs_optimized(current_user_id()))
);

-- Policy: System can insert/update usage metrics
CREATE POLICY usage_metrics_system_access_optimized ON usage_metrics
FOR ALL TO service_account
USING (true);

-- Policy: Allow system to update metrics for accessible orgs (optimized)
CREATE POLICY usage_metrics_update_access_optimized ON usage_metrics
FOR INSERT TO authenticated
WITH CHECK (
  org_id = ANY(user_accessible_orgs_optimized(current_user_id()))
);

-- ============================================================================
-- ADDITIONAL PERFORMANCE INDEXES
-- ============================================================================

-- Composite indexes for common RLS query patterns
CREATE INDEX CONCURRENTLY idx_memberships_user_org_role ON memberships(user_id, org_id, role) WHERE joined_at IS NOT NULL;
CREATE INDEX CONCURRENTLY idx_organizations_parent_id ON organizations(parent_org_id) WHERE parent_org_id IS NOT NULL;

-- Partial indexes for active data
CREATE INDEX CONCURRENTLY idx_sessions_active_user ON sessions(user_id, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX CONCURRENTLY idx_memberships_active_user ON memberships(user_id, org_id) WHERE joined_at IS NOT NULL;

-- Covering indexes for common queries
CREATE INDEX CONCURRENTLY idx_organizations_cover ON organizations(id, slug, name, parent_org_id);
CREATE INDEX CONCURRENTLY idx_memberships_cover ON memberships(user_id, org_id, role, joined_at);

-- ============================================================================
-- QUERY PLAN ANALYSIS FUNCTIONS
-- ============================================================================

-- Function to analyze RLS policy performance
CREATE OR REPLACE FUNCTION analyze_rls_performance(
  test_user_id uuid,
  test_org_id uuid
) RETURNS TABLE(
  policy_name text,
  execution_time_ms numeric,
  plan_rows bigint,
  actual_rows bigint,
  index_usage text[]
) AS $$
DECLARE
  start_time timestamp;
  end_time timestamp;
  plan_result record;
  actual_rows_count bigint;
BEGIN
  -- Set test context
  PERFORM set_config('app.current_user_id', test_user_id::text, true);
  PERFORM set_config('app.current_org_id', test_org_id::text, true);
  
  -- Test organization access policy
  start_time := clock_timestamp();
  EXECUTE 'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT count(*) FROM organizations WHERE id = $1' 
    USING test_org_id INTO plan_result;
  end_time := clock_timestamp();
  
  SELECT count(*) INTO actual_rows_count FROM organizations WHERE id = test_org_id;
  
  RETURN QUERY SELECT 
    'org_member_access_optimized'::text,
    EXTRACT(EPOCH FROM (end_time - start_time)) * 1000,
    (plan_result.plan->0->>'Plan Rows')::bigint,
    actual_rows_count,
    ARRAY[]::text[]; -- Index usage would need more complex parsing
  
  -- Reset context
  PERFORM set_config('app.current_user_id', null, true);
  PERFORM set_config('app.current_org_id', null, true);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- AUTOMATED CACHE REFRESH
-- ============================================================================

-- Create a function to refresh cache with error handling
CREATE OR REPLACE FUNCTION refresh_user_org_access_cache_safe()
RETURNS void AS $$
BEGIN
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY user_org_access_cache;
    
    -- Log successful refresh
    INSERT INTO audit_logs (action, details) 
    VALUES ('system.cache_refreshed', '{"cache": "user_org_access_cache", "status": "success"}');
    
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail
    INSERT INTO audit_logs (action, details) 
    VALUES ('system.cache_error', jsonb_build_object(
      'cache', 'user_org_access_cache',
      'status', 'error',
      'error', SQLERRM
    ));
  END;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON MATERIALIZED VIEW user_org_access_cache IS 'Cached user-organization access for optimized RLS performance';
COMMENT ON FUNCTION user_accessible_orgs_optimized IS 'Optimized function to get user accessible organizations using materialized view';
COMMENT ON FUNCTION user_admin_orgs_optimized IS 'Optimized function to get user admin organizations using materialized view';
COMMENT ON FUNCTION user_has_org_access_optimized IS 'Optimized function to check user access to specific organization';
COMMENT ON FUNCTION refresh_user_org_access_cache IS 'Refresh the user organization access cache';
COMMENT ON FUNCTION refresh_user_org_access_cache_safe IS 'Safely refresh cache with error handling and logging';
COMMENT ON FUNCTION analyze_rls_performance IS 'Analyze RLS policy performance for optimization';

-- Migration metadata
INSERT INTO schema_migrations (version, description, applied_at) 
VALUES ('003', 'Optimize RLS policies for production scale performance', now())
ON CONFLICT (version) DO NOTHING;
