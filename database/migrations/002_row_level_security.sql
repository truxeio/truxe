-- Migration: 002_row_level_security.sql
-- Description: Implement comprehensive Row Level Security policies for multi-tenant isolation
-- Author: Heimdall Team
-- Date: 2024-01-15

-- ============================================================================
-- ROW LEVEL SECURITY SETUP
-- ============================================================================

-- Enable Row Level Security on all tenant-scoped tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_metrics ENABLE ROW LEVEL SECURITY;

-- Users table doesn't need RLS as it contains global user data
-- Magic link challenges don't need RLS as they're temporary and validated by token

-- ============================================================================
-- UTILITY FUNCTIONS FOR RLS POLICIES
-- ============================================================================

-- Function to get current user ID from session variable
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS uuid AS $$
BEGIN
  RETURN current_setting('app.current_user_id', true)::uuid;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current organization ID from session variable
CREATE OR REPLACE FUNCTION current_org_id()
RETURNS uuid AS $$
BEGIN
  RETURN current_setting('app.current_org_id', true)::uuid;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has specific role in organization
CREATE OR REPLACE FUNCTION user_has_role_in_org(
  check_user_id uuid,
  check_org_id uuid,
  required_role membership_role
)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.user_id = check_user_id
    AND m.org_id = check_org_id
    AND (
      CASE required_role
        WHEN 'owner' THEN m.role = 'owner'
        WHEN 'admin' THEN m.role IN ('owner', 'admin')
        WHEN 'member' THEN m.role IN ('owner', 'admin', 'member')
        WHEN 'viewer' THEN m.role IN ('owner', 'admin', 'member', 'viewer')
      END
    )
    AND m.joined_at IS NOT NULL -- User must have accepted invitation
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's accessible organizations
CREATE OR REPLACE FUNCTION user_accessible_orgs(check_user_id uuid)
RETURNS uuid[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT m.org_id 
    FROM memberships m 
    WHERE m.user_id = check_user_id
    AND m.joined_at IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's admin organizations (for hierarchical access)
CREATE OR REPLACE FUNCTION user_admin_orgs(check_user_id uuid)
RETURNS uuid[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT m.org_id 
    FROM memberships m 
    WHERE m.user_id = check_user_id
    AND m.role IN ('owner', 'admin')
    AND m.joined_at IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ORGANIZATIONS TABLE RLS POLICIES
-- ============================================================================

-- Policy: Users can access organizations they're members of
CREATE POLICY org_member_access ON organizations
FOR ALL TO authenticated
USING (
  id = ANY(user_accessible_orgs(current_user_id()))
);

-- Policy: Users can create organizations (they become owner automatically)
CREATE POLICY org_create_access ON organizations
FOR INSERT TO authenticated
WITH CHECK (true); -- Creation is handled by application logic

-- Policy: Only owners/admins can modify organizations
CREATE POLICY org_modify_access ON organizations
FOR UPDATE TO authenticated
USING (
  id = ANY(user_admin_orgs(current_user_id()))
)
WITH CHECK (
  id = ANY(user_admin_orgs(current_user_id()))
);

-- Policy: Only owners can delete organizations
CREATE POLICY org_delete_access ON organizations
FOR DELETE TO authenticated
USING (
  user_has_role_in_org(current_user_id(), id, 'owner')
);

-- Policy: Support hierarchical organization access for admins
CREATE POLICY org_hierarchical_access ON organizations
FOR SELECT TO authenticated
USING (
  id = ANY(user_accessible_orgs(current_user_id()))
  OR 
  -- Allow access to child organizations if user is admin/owner of parent
  parent_org_id = ANY(user_admin_orgs(current_user_id()))
);

-- ============================================================================
-- MEMBERSHIPS TABLE RLS POLICIES
-- ============================================================================

-- Policy: Users can see memberships in their organizations
CREATE POLICY membership_org_access ON memberships
FOR SELECT TO authenticated
USING (
  org_id = ANY(user_accessible_orgs(current_user_id()))
);

-- Policy: Admins can invite users to their organizations
CREATE POLICY membership_invite_access ON memberships
FOR INSERT TO authenticated
WITH CHECK (
  org_id = ANY(user_admin_orgs(current_user_id()))
  AND invited_by = current_user_id()
);

-- Policy: Users can accept their own invitations
CREATE POLICY membership_self_accept ON memberships
FOR UPDATE TO authenticated
USING (
  user_id = current_user_id()
  AND joined_at IS NULL -- Only for pending invitations
)
WITH CHECK (
  user_id = current_user_id()
  AND joined_at IS NOT NULL -- Must be setting joined_at
);

-- Policy: Admins can modify memberships in their organizations
CREATE POLICY membership_admin_modify ON memberships
FOR UPDATE TO authenticated
USING (
  org_id = ANY(user_admin_orgs(current_user_id()))
  AND user_id != current_user_id() -- Cannot modify own membership
)
WITH CHECK (
  org_id = ANY(user_admin_orgs(current_user_id()))
);

-- Policy: Admins can remove memberships, users can remove themselves
CREATE POLICY membership_remove_access ON memberships
FOR DELETE TO authenticated
USING (
  org_id = ANY(user_admin_orgs(current_user_id()))
  OR user_id = current_user_id() -- Users can leave organizations
);

-- ============================================================================
-- SESSIONS TABLE RLS POLICIES
-- ============================================================================

-- Policy: Users can only access their own sessions
CREATE POLICY session_owner_access ON sessions
FOR ALL TO authenticated
USING (user_id = current_user_id());

-- Policy: Service accounts can access all sessions (for cleanup, etc.)
CREATE POLICY session_service_access ON sessions
FOR ALL TO service_account
USING (true);

-- ============================================================================
-- AUDIT LOGS TABLE RLS POLICIES
-- ============================================================================

-- Policy: Users can see audit logs for their organizations (read-only)
CREATE POLICY audit_org_read_access ON audit_logs
FOR SELECT TO authenticated
USING (
  org_id = ANY(user_admin_orgs(current_user_id()))
);

-- Policy: System can insert audit logs with proper org context
CREATE POLICY audit_insert_access ON audit_logs
FOR INSERT TO authenticated
WITH CHECK (
  -- Either no org context (global events) or user has access to org
  org_id IS NULL 
  OR org_id = ANY(user_accessible_orgs(current_user_id()))
);

-- Policy: Service accounts can access all audit logs
CREATE POLICY audit_service_access ON audit_logs
FOR SELECT TO service_account
USING (true);

-- ============================================================================
-- USAGE METRICS TABLE RLS POLICIES
-- ============================================================================

-- Policy: Users can see usage metrics for their organizations
CREATE POLICY usage_metrics_org_access ON usage_metrics
FOR SELECT TO authenticated
USING (
  org_id = ANY(user_admin_orgs(current_user_id()))
);

-- Policy: System can insert/update usage metrics
CREATE POLICY usage_metrics_system_access ON usage_metrics
FOR ALL TO service_account
USING (true);

-- Policy: Allow system to update metrics for accessible orgs
CREATE POLICY usage_metrics_update_access ON usage_metrics
FOR INSERT TO authenticated
WITH CHECK (
  org_id = ANY(user_accessible_orgs(current_user_id()))
);

-- ============================================================================
-- SECURITY VALIDATION FUNCTIONS
-- ============================================================================

-- Function to test RLS isolation
CREATE OR REPLACE FUNCTION test_rls_isolation(
  test_user_id uuid,
  test_org_id uuid
) RETURNS TABLE(
  table_name text,
  policy_name text,
  access_granted boolean,
  error_message text
) AS $$
DECLARE
  original_user_id text;
  original_org_id text;
BEGIN
  -- Save original session variables
  original_user_id := current_setting('app.current_user_id', true);
  original_org_id := current_setting('app.current_org_id', true);
  
  -- Set test context
  PERFORM set_config('app.current_user_id', test_user_id::text, true);
  PERFORM set_config('app.current_org_id', test_org_id::text, true);
  
  -- Test organizations access
  BEGIN
    PERFORM count(*) FROM organizations WHERE id = test_org_id;
    RETURN QUERY SELECT 'organizations'::text, 'org_member_access'::text, true, null::text;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'organizations'::text, 'org_member_access'::text, false, SQLERRM;
  END;
  
  -- Test memberships access
  BEGIN
    PERFORM count(*) FROM memberships WHERE org_id = test_org_id;
    RETURN QUERY SELECT 'memberships'::text, 'membership_org_access'::text, true, null::text;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'memberships'::text, 'membership_org_access'::text, false, SQLERRM;
  END;
  
  -- Test sessions access
  BEGIN
    PERFORM count(*) FROM sessions WHERE user_id = test_user_id;
    RETURN QUERY SELECT 'sessions'::text, 'session_owner_access'::text, true, null::text;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'sessions'::text, 'session_owner_access'::text, false, SQLERRM;
  END;
  
  -- Test audit logs access
  BEGIN
    PERFORM count(*) FROM audit_logs WHERE org_id = test_org_id;
    RETURN QUERY SELECT 'audit_logs'::text, 'audit_org_read_access'::text, true, null::text;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'audit_logs'::text, 'audit_org_read_access'::text, false, SQLERRM;
  END;
  
  -- Restore original session variables
  PERFORM set_config('app.current_user_id', original_user_id, true);
  PERFORM set_config('app.current_org_id', original_org_id, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate cross-tenant isolation
CREATE OR REPLACE FUNCTION validate_cross_tenant_isolation()
RETURNS TABLE(
  test_name text,
  passed boolean,
  details text
) AS $$
DECLARE
  user1_id uuid;
  user2_id uuid;
  org1_id uuid;
  org2_id uuid;
  cross_tenant_count integer;
BEGIN
  -- Create test data
  INSERT INTO users (email, status) VALUES ('test1@example.com', 'active') RETURNING id INTO user1_id;
  INSERT INTO users (email, status) VALUES ('test2@example.com', 'active') RETURNING id INTO user2_id;
  INSERT INTO organizations (slug, name) VALUES ('test-org-1', 'Test Org 1') RETURNING id INTO org1_id;
  INSERT INTO organizations (slug, name) VALUES ('test-org-2', 'Test Org 2') RETURNING id INTO org2_id;
  
  -- Create memberships
  INSERT INTO memberships (org_id, user_id, role, joined_at) VALUES (org1_id, user1_id, 'owner', now());
  INSERT INTO memberships (org_id, user_id, role, joined_at) VALUES (org2_id, user2_id, 'owner', now());
  
  -- Test 1: User1 cannot see User2's organization
  PERFORM set_config('app.current_user_id', user1_id::text, true);
  SELECT count(*) INTO cross_tenant_count FROM organizations WHERE id = org2_id;
  
  RETURN QUERY SELECT 
    'Cross-tenant organization access'::text,
    cross_tenant_count = 0,
    format('User1 saw %s organizations from User2 (should be 0)', cross_tenant_count);
  
  -- Test 2: User2 cannot see User1's memberships
  PERFORM set_config('app.current_user_id', user2_id::text, true);
  SELECT count(*) INTO cross_tenant_count FROM memberships WHERE org_id = org1_id;
  
  RETURN QUERY SELECT 
    'Cross-tenant membership access'::text,
    cross_tenant_count = 0,
    format('User2 saw %s memberships from Org1 (should be 0)', cross_tenant_count);
  
  -- Cleanup test data
  DELETE FROM memberships WHERE org_id IN (org1_id, org2_id);
  DELETE FROM organizations WHERE id IN (org1_id, org2_id);
  DELETE FROM users WHERE id IN (user1_id, user2_id);
  
  -- Reset session
  PERFORM set_config('app.current_user_id', null, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION current_user_id IS 'Get current user ID from session variable for RLS';
COMMENT ON FUNCTION current_org_id IS 'Get current organization ID from session variable for RLS';
COMMENT ON FUNCTION user_has_role_in_org IS 'Check if user has specific role in organization';
COMMENT ON FUNCTION user_accessible_orgs IS 'Get array of organization IDs user can access';
COMMENT ON FUNCTION user_admin_orgs IS 'Get array of organization IDs where user is admin/owner';
COMMENT ON FUNCTION test_rls_isolation IS 'Test RLS policy effectiveness for given user/org';
COMMENT ON FUNCTION validate_cross_tenant_isolation IS 'Validate that cross-tenant data access is blocked';

-- Migration metadata
INSERT INTO schema_migrations (version, description, applied_at) 
VALUES ('002', 'Row Level Security policies for multi-tenant isolation', now())
ON CONFLICT (version) DO NOTHING;
