-- Migration Rollback: 003_optimize_rls_performance_rollback.sql
-- Description: Rollback RLS performance optimizations
-- Author: Heimdall Team
-- Date: 2024-01-16

-- ============================================================================
-- ROLLBACK RLS PERFORMANCE OPTIMIZATIONS
-- ============================================================================

-- Drop optimized policies
DROP POLICY IF EXISTS org_member_access_optimized ON organizations;
DROP POLICY IF EXISTS org_create_access_optimized ON organizations;
DROP POLICY IF EXISTS org_modify_access_optimized ON organizations;
DROP POLICY IF EXISTS org_delete_access_optimized ON organizations;
DROP POLICY IF EXISTS org_hierarchical_access_optimized ON organizations;

DROP POLICY IF EXISTS membership_org_access_optimized ON memberships;
DROP POLICY IF EXISTS membership_invite_access_optimized ON memberships;
DROP POLICY IF EXISTS membership_self_accept_optimized ON memberships;
DROP POLICY IF EXISTS membership_admin_modify_optimized ON memberships;
DROP POLICY IF EXISTS membership_remove_access_optimized ON memberships;

DROP POLICY IF EXISTS session_owner_access_optimized ON sessions;
DROP POLICY IF EXISTS session_service_access_optimized ON sessions;

DROP POLICY IF EXISTS audit_org_read_access_optimized ON audit_logs;
DROP POLICY IF EXISTS audit_insert_access_optimized ON audit_logs;
DROP POLICY IF EXISTS audit_service_access_optimized ON audit_logs;

DROP POLICY IF EXISTS usage_metrics_org_access_optimized ON usage_metrics;
DROP POLICY IF EXISTS usage_metrics_system_access_optimized ON usage_metrics;
DROP POLICY IF EXISTS usage_metrics_update_access_optimized ON usage_metrics;

-- Recreate original policies
CREATE POLICY org_member_access ON organizations
FOR ALL TO authenticated
USING (
  id IN (
    SELECT org_id FROM memberships 
    WHERE user_id = current_setting('app.current_user_id')::uuid
  )
);

CREATE POLICY org_create_access ON organizations
FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY org_modify_access ON organizations
FOR UPDATE TO authenticated
USING (
  id IN (
    SELECT org_id FROM memberships 
    WHERE user_id = current_setting('app.current_user_id')::uuid
    AND role IN ('owner', 'admin')
  )
)
WITH CHECK (
  id IN (
    SELECT org_id FROM memberships 
    WHERE user_id = current_setting('app.current_user_id')::uuid
    AND role IN ('owner', 'admin')
  )
);

CREATE POLICY org_delete_access ON organizations
FOR DELETE TO authenticated
USING (
  user_has_role_in_org(current_user_id(), id, 'owner')
);

CREATE POLICY org_hierarchical_access ON organizations
FOR SELECT TO authenticated
USING (
  id IN (
    SELECT org_id FROM memberships 
    WHERE user_id = current_setting('app.current_user_id')::uuid
  )
  OR 
  parent_org_id IN (
    SELECT org_id FROM memberships 
    WHERE user_id = current_setting('app.current_user_id')::uuid
    AND role IN ('owner', 'admin')
  )
);

CREATE POLICY membership_org_access ON memberships
FOR SELECT TO authenticated
USING (
  org_id IN (
    SELECT org_id FROM memberships 
    WHERE user_id = current_setting('app.current_user_id')::uuid
  )
);

CREATE POLICY membership_invite_access ON memberships
FOR INSERT TO authenticated
WITH CHECK (
  org_id IN (
    SELECT org_id FROM memberships 
    WHERE user_id = current_setting('app.current_user_id')::uuid
    AND role IN ('owner', 'admin')
  )
  AND invited_by = current_setting('app.current_user_id')::uuid
);

CREATE POLICY membership_self_accept ON memberships
FOR UPDATE TO authenticated
USING (
  user_id = current_setting('app.current_user_id')::uuid
  AND joined_at IS NULL
)
WITH CHECK (
  user_id = current_setting('app.current_user_id')::uuid
  AND joined_at IS NOT NULL
);

CREATE POLICY membership_admin_modify ON memberships
FOR UPDATE TO authenticated
USING (
  org_id IN (
    SELECT org_id FROM memberships 
    WHERE user_id = current_setting('app.current_user_id')::uuid
    AND role IN ('owner', 'admin')
  )
  AND user_id != current_setting('app.current_user_id')::uuid
)
WITH CHECK (
  org_id IN (
    SELECT org_id FROM memberships 
    WHERE user_id = current_setting('app.current_user_id')::uuid
    AND role IN ('owner', 'admin')
  )
);

CREATE POLICY membership_remove_access ON memberships
FOR DELETE TO authenticated
USING (
  org_id IN (
    SELECT org_id FROM memberships 
    WHERE user_id = current_setting('app.current_user_id')::uuid
    AND role IN ('owner', 'admin')
  )
  OR user_id = current_setting('app.current_user_id')::uuid
);

CREATE POLICY session_owner_access ON sessions
FOR ALL TO authenticated
USING (user_id = current_setting('app.current_user_id')::uuid);

CREATE POLICY session_service_access ON sessions
FOR ALL TO service_account
USING (true);

CREATE POLICY audit_org_read_access ON audit_logs
FOR SELECT TO authenticated
USING (
  org_id IN (
    SELECT org_id FROM memberships 
    WHERE user_id = current_setting('app.current_user_id')::uuid
    AND role IN ('owner', 'admin')
  )
);

CREATE POLICY audit_insert_access ON audit_logs
FOR INSERT TO authenticated
WITH CHECK (
  org_id IS NULL 
  OR org_id IN (
    SELECT org_id FROM memberships 
    WHERE user_id = current_setting('app.current_user_id')::uuid
  )
);

CREATE POLICY audit_service_access ON audit_logs
FOR SELECT TO service_account
USING (true);

CREATE POLICY usage_metrics_org_access ON usage_metrics
FOR SELECT TO authenticated
USING (
  org_id IN (
    SELECT org_id FROM memberships 
    WHERE user_id = current_setting('app.current_user_id')::uuid
    AND role IN ('owner', 'admin')
  )
);

CREATE POLICY usage_metrics_system_access ON usage_metrics
FOR ALL TO service_account
USING (true);

CREATE POLICY usage_metrics_update_access ON usage_metrics
FOR INSERT TO authenticated
WITH CHECK (
  org_id IN (
    SELECT org_id FROM memberships 
    WHERE user_id = current_setting('app.current_user_id')::uuid
  )
);

-- Drop optimized functions
DROP FUNCTION IF EXISTS user_accessible_orgs_optimized(uuid);
DROP FUNCTION IF EXISTS user_admin_orgs_optimized(uuid);
DROP FUNCTION IF EXISTS user_has_org_access_optimized(uuid, uuid);
DROP FUNCTION IF EXISTS refresh_user_org_access_cache();
DROP FUNCTION IF EXISTS refresh_user_org_access_cache_safe();
DROP FUNCTION IF EXISTS analyze_rls_performance(uuid, uuid);

-- Drop materialized view and indexes
DROP INDEX IF EXISTS idx_user_org_access_cache_user_org;
DROP INDEX IF EXISTS idx_user_org_access_cache_user_id;
DROP INDEX IF EXISTS idx_user_org_access_cache_org_id;
DROP INDEX IF EXISTS idx_user_org_access_cache_admin;
DROP MATERIALIZED VIEW IF EXISTS user_org_access_cache;

-- Drop additional performance indexes
DROP INDEX IF EXISTS idx_memberships_user_org_role;
DROP INDEX IF EXISTS idx_organizations_parent_id;
DROP INDEX IF EXISTS idx_sessions_active_user;
DROP INDEX IF EXISTS idx_memberships_active_user;
DROP INDEX IF EXISTS idx_organizations_cover;
DROP INDEX IF EXISTS idx_memberships_cover;

-- Migration metadata
DELETE FROM schema_migrations WHERE version = '003';
