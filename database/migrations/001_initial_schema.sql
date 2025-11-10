-- Migration: 001_initial_schema.sql
-- Description: Create initial database schema for Heimdall authentication system
-- Author: Heimdall Team
-- Date: 2024-01-15

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create custom types
CREATE TYPE user_status AS ENUM ('active', 'blocked', 'pending');
CREATE TYPE membership_role AS ENUM ('owner', 'admin', 'member', 'viewer');
CREATE TYPE audit_action AS ENUM (
  'user.login', 'user.logout', 'user.signup', 'user.blocked', 'user.activated',
  'org.created', 'org.updated', 'org.deleted',
  'membership.invited', 'membership.joined', 'membership.role_changed', 'membership.removed',
  'session.created', 'session.revoked', 'session.expired',
  'settings.updated', 'api_key.created', 'api_key.revoked',
  'magic_link.sent', 'magic_link.verified', 'magic_link.expired'
);

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Users table - Core user identity
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext UNIQUE NOT NULL,
  email_verified boolean DEFAULT false,
  status user_status DEFAULT 'pending',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_email CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT metadata_is_object CHECK (jsonb_typeof(metadata) = 'object')
);

-- Organizations table - Multi-tenant isolation
CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug citext UNIQUE NOT NULL,
  name text NOT NULL,
  parent_org_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_slug CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'),
  CONSTRAINT slug_length CHECK (length(slug) >= 2 AND length(slug) <= 63),
  CONSTRAINT name_length CHECK (length(trim(name)) >= 1 AND length(name) <= 255),
  CONSTRAINT no_self_parent CHECK (id != parent_org_id),
  CONSTRAINT settings_is_object CHECK (jsonb_typeof(settings) = 'object')
);

-- Memberships table - User-Organization relationships with RBAC
CREATE TABLE memberships (
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  role membership_role DEFAULT 'member',
  permissions jsonb DEFAULT '[]'::jsonb,
  invited_by uuid REFERENCES users(id) ON DELETE SET NULL,
  invited_at timestamptz DEFAULT now(),
  joined_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  PRIMARY KEY (org_id, user_id),
  
  -- Constraints
  CONSTRAINT permissions_is_array CHECK (jsonb_typeof(permissions) = 'array'),
  CONSTRAINT joined_after_invited CHECK (joined_at IS NULL OR joined_at >= invited_at),
  CONSTRAINT self_invite_check CHECK (user_id != invited_by)
);

-- Sessions table - JWT session management with device tracking
CREATE TABLE sessions (
  jti uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  refresh_jti uuid UNIQUE,
  
  -- Device & Security Information
  device_info jsonb DEFAULT '{}'::jsonb,
  ip inet,
  user_agent text,
  
  -- Session Management
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_used_at timestamptz DEFAULT now(),
  revoked_at timestamptz,
  revoked_reason text,
  
  -- Constraints
  CONSTRAINT device_info_is_object CHECK (jsonb_typeof(device_info) = 'object'),
  CONSTRAINT expires_after_created CHECK (expires_at > created_at),
  CONSTRAINT revoked_after_created CHECK (revoked_at IS NULL OR revoked_at >= created_at),
  CONSTRAINT revoked_reason_when_revoked CHECK (
    (revoked_at IS NULL AND revoked_reason IS NULL) OR
    (revoked_at IS NOT NULL AND revoked_reason IS NOT NULL)
  )
);

-- Audit logs table - Immutable audit trail (append-only)
CREATE TABLE audit_logs (
  id bigserial PRIMARY KEY,
  org_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  
  -- Event Details
  action audit_action NOT NULL,
  target_type text,
  target_id text,
  details jsonb DEFAULT '{}'::jsonb,
  
  -- Request Context
  ip inet,
  user_agent text,
  request_id uuid,
  
  -- Immutable timestamp
  created_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT details_is_object CHECK (jsonb_typeof(details) = 'object'),
  CONSTRAINT target_consistency CHECK (
    (target_type IS NULL AND target_id IS NULL) OR
    (target_type IS NOT NULL AND target_id IS NOT NULL)
  )
);

-- Magic link challenges table - Passwordless authentication tokens
CREATE TABLE magic_link_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL,
  token_hash text NOT NULL,
  org_slug text,
  
  -- Expiration & Usage Tracking
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  attempts integer DEFAULT 0,
  
  -- Request Context
  ip inet,
  user_agent text,
  
  created_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT token_hash_length CHECK (length(token_hash) >= 32),
  CONSTRAINT max_attempts CHECK (attempts >= 0 AND attempts <= 5),
  CONSTRAINT expires_after_created CHECK (expires_at > created_at),
  CONSTRAINT used_after_created CHECK (used_at IS NULL OR used_at >= created_at),
  CONSTRAINT valid_email CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- ============================================================================
-- PERFORMANCE & MONITORING TABLES
-- ============================================================================

-- Usage metrics table - For billing and rate limiting
CREATE TABLE usage_metrics (
  id bigserial PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  metric_type text NOT NULL,
  metric_value bigint NOT NULL DEFAULT 0,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT unique_org_metric_period UNIQUE(org_id, metric_type, period_start),
  CONSTRAINT valid_period CHECK (period_end > period_start),
  CONSTRAINT non_negative_value CHECK (metric_value >= 0),
  CONSTRAINT metadata_is_object CHECK (jsonb_typeof(metadata) = 'object')
);

-- Rate limits table - Alternative to Redis for rate limiting
CREATE TABLE rate_limits (
  id bigserial PRIMARY KEY,
  key_hash text NOT NULL,
  window_start timestamptz NOT NULL,
  request_count integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT unique_key_window UNIQUE(key_hash, window_start),
  CONSTRAINT positive_count CHECK (request_count > 0)
);

-- ============================================================================
-- INDEXES FOR OPTIMAL PERFORMANCE
-- ============================================================================

-- Users table indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status) WHERE status != 'active';
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_email_verified ON users(email_verified) WHERE email_verified = false;

-- Organizations table indexes
CREATE UNIQUE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_parent ON organizations(parent_org_id) WHERE parent_org_id IS NOT NULL;
CREATE INDEX idx_organizations_created_at ON organizations(created_at);
CREATE INDEX idx_organizations_name_trgm ON organizations USING gin(name gin_trgm_ops);

-- Memberships table indexes
CREATE INDEX idx_memberships_user_id ON memberships(user_id);
CREATE INDEX idx_memberships_role ON memberships(role);
CREATE INDEX idx_memberships_invited_at ON memberships(invited_at);
CREATE INDEX idx_memberships_joined_at ON memberships(joined_at) WHERE joined_at IS NOT NULL;
CREATE INDEX idx_memberships_user_org ON memberships(user_id, org_id);
CREATE INDEX idx_org_admins ON memberships(org_id) WHERE role IN ('owner', 'admin');

-- Sessions table indexes
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_org_id ON sessions(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_sessions_refresh_jti ON sessions(refresh_jti) WHERE refresh_jti IS NOT NULL;
CREATE INDEX idx_sessions_active ON sessions(user_id, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX idx_sessions_last_used ON sessions(last_used_at);

-- Audit logs table indexes
CREATE INDEX idx_audit_logs_org_id ON audit_logs(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_user_id) WHERE actor_user_id IS NOT NULL;
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_target ON audit_logs(target_type, target_id) WHERE target_type IS NOT NULL;
CREATE INDEX idx_audit_logs_request_id ON audit_logs(request_id) WHERE request_id IS NOT NULL;

-- Magic link challenges indexes
CREATE INDEX idx_magic_links_token_hash ON magic_link_challenges(token_hash);
CREATE INDEX idx_magic_links_email ON magic_link_challenges(email);
CREATE INDEX idx_magic_links_expires_at ON magic_link_challenges(expires_at);
CREATE INDEX idx_magic_links_org_slug ON magic_link_challenges(org_slug) WHERE org_slug IS NOT NULL;
CREATE INDEX idx_magic_links_unused ON magic_link_challenges(email, expires_at) WHERE used_at IS NULL;

-- Usage metrics indexes
CREATE INDEX idx_usage_metrics_org_period ON usage_metrics(org_id, period_start);
CREATE INDEX idx_usage_metrics_type ON usage_metrics(metric_type);
CREATE INDEX idx_usage_metrics_created_at ON usage_metrics(created_at);

-- Rate limits indexes
CREATE INDEX idx_rate_limits_key_window ON rate_limits(key_hash, window_start);
CREATE INDEX idx_rate_limits_cleanup ON rate_limits(window_start);

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organizations_updated_at 
  BEFORE UPDATE ON organizations 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_memberships_updated_at 
  BEFORE UPDATE ON memberships 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to prevent circular organization hierarchy
CREATE OR REPLACE FUNCTION check_org_hierarchy()
RETURNS TRIGGER AS $$
BEGIN
  -- Only check if parent_org_id is being set
  IF NEW.parent_org_id IS NOT NULL THEN
    -- Prevent cycles using recursive CTE
    WITH RECURSIVE org_path AS (
      SELECT id, parent_org_id, 1 as depth
      FROM organizations 
      WHERE id = NEW.parent_org_id
      
      UNION ALL
      
      SELECT o.id, o.parent_org_id, op.depth + 1
      FROM organizations o
      JOIN org_path op ON o.id = op.parent_org_id
      WHERE op.depth < 10 -- Prevent infinite recursion
    )
    SELECT 1 FROM org_path WHERE id = NEW.id;
    
    IF FOUND THEN
      RAISE EXCEPTION 'Circular reference detected in organization hierarchy';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_org_hierarchy_trigger
  BEFORE INSERT OR UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION check_org_hierarchy();

-- Function to auto-log membership changes
CREATE OR REPLACE FUNCTION log_membership_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (org_id, actor_user_id, action, target_type, target_id, details)
    VALUES (NEW.org_id, NEW.invited_by, 'membership.invited', 'user', NEW.user_id::text, 
            jsonb_build_object('role', NEW.role, 'permissions', NEW.permissions));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Log role changes
    IF OLD.role != NEW.role THEN
      INSERT INTO audit_logs (org_id, actor_user_id, action, target_type, target_id, details)
      VALUES (NEW.org_id, current_setting('app.current_user_id', true)::uuid, 
              'membership.role_changed', 'user', NEW.user_id::text,
              jsonb_build_object('old_role', OLD.role, 'new_role', NEW.role));
    END IF;
    -- Log when user joins (invited_at -> joined_at)
    IF OLD.joined_at IS NULL AND NEW.joined_at IS NOT NULL THEN
      INSERT INTO audit_logs (org_id, actor_user_id, action, target_type, target_id, details)
      VALUES (NEW.org_id, NEW.user_id, 'membership.joined', 'user', NEW.user_id::text,
              jsonb_build_object('role', NEW.role));
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (org_id, actor_user_id, action, target_type, target_id, details)
    VALUES (OLD.org_id, current_setting('app.current_user_id', true)::uuid, 
            'membership.removed', 'user', OLD.user_id::text,
            jsonb_build_object('role', OLD.role));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER membership_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON memberships
  FOR EACH ROW EXECUTE FUNCTION log_membership_changes();

-- Function to cleanup expired data
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS TABLE(
  expired_sessions integer,
  expired_magic_links integer,
  old_rate_limits integer
) AS $$
DECLARE
  session_count integer := 0;
  magic_link_count integer := 0;
  rate_limit_count integer := 0;
BEGIN
  -- Cleanup expired sessions (keep for 7 days after expiration for audit)
  DELETE FROM sessions 
  WHERE expires_at < now() - interval '7 days' OR revoked_at < now() - interval '7 days';
  GET DIAGNOSTICS session_count = ROW_COUNT;
  
  -- Cleanup expired magic links (keep for 1 day after expiration)
  DELETE FROM magic_link_challenges 
  WHERE expires_at < now() - interval '1 day';
  GET DIAGNOSTICS magic_link_count = ROW_COUNT;
  
  -- Cleanup old rate limit data (keep for 1 hour)
  DELETE FROM rate_limits 
  WHERE window_start < now() - interval '1 hour';
  GET DIAGNOSTICS rate_limit_count = ROW_COUNT;
  
  RETURN QUERY SELECT session_count, magic_link_count, rate_limit_count;
END;
$$ LANGUAGE plpgsql;

-- Prevent modifications to audit logs (append-only)
CREATE RULE audit_logs_no_update AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;
CREATE RULE audit_logs_no_delete AS ON DELETE TO audit_logs DO INSTEAD NOTHING;

-- ============================================================================
-- SECURITY ROLES
-- ============================================================================

-- Create application roles
CREATE ROLE authenticated;
CREATE ROLE service_account;

-- Grant basic permissions to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON memberships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sessions TO authenticated;
GRANT SELECT, INSERT ON audit_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON magic_link_challenges TO authenticated;
GRANT SELECT, INSERT, UPDATE ON usage_metrics TO authenticated;
GRANT SELECT, INSERT, UPDATE ON rate_limits TO authenticated;

-- Grant sequence permissions
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant additional permissions to service account
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_account;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_account;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE users IS 'Core user identities with email-based authentication';
COMMENT ON COLUMN users.email IS 'Case-insensitive email address, used as primary identifier';
COMMENT ON COLUMN users.email_verified IS 'Whether the email address has been verified via magic link';
COMMENT ON COLUMN users.status IS 'User account status: active, blocked, or pending verification';
COMMENT ON COLUMN users.metadata IS 'Flexible JSON storage for additional user properties';

COMMENT ON TABLE organizations IS 'Multi-tenant organizations with hierarchical support';
COMMENT ON COLUMN organizations.slug IS 'URL-safe identifier for custom domains and routing';
COMMENT ON COLUMN organizations.parent_org_id IS 'Parent organization for hierarchical tenancy';
COMMENT ON COLUMN organizations.settings IS 'Organization-specific configuration and branding';

COMMENT ON TABLE memberships IS 'User-organization relationships with role-based access control';
COMMENT ON COLUMN memberships.role IS 'Primary role: owner, admin, member, or viewer';
COMMENT ON COLUMN memberships.permissions IS 'Array of granular permission strings';
COMMENT ON COLUMN memberships.invited_at IS 'When the membership invitation was created';
COMMENT ON COLUMN memberships.joined_at IS 'When the user accepted the invitation (NULL = pending)';

COMMENT ON TABLE sessions IS 'JWT session management with device tracking and revocation';
COMMENT ON COLUMN sessions.jti IS 'JWT ID for access tokens, used for revocation';
COMMENT ON COLUMN sessions.refresh_jti IS 'JWT ID for refresh tokens';
COMMENT ON COLUMN sessions.device_info IS 'Browser/device fingerprinting data for security';
COMMENT ON COLUMN sessions.revoked_at IS 'When the session was manually revoked';

COMMENT ON TABLE audit_logs IS 'Immutable audit trail for compliance and security monitoring';
COMMENT ON COLUMN audit_logs.action IS 'Standardized action type from audit_action enum';
COMMENT ON COLUMN audit_logs.target_type IS 'Type of resource being acted upon';
COMMENT ON COLUMN audit_logs.target_id IS 'ID of the specific resource instance';
COMMENT ON COLUMN audit_logs.details IS 'Additional context about the action';

COMMENT ON TABLE magic_link_challenges IS 'Passwordless authentication challenges with rate limiting';
COMMENT ON COLUMN magic_link_challenges.token_hash IS 'Argon2 hash of the magic link token';
COMMENT ON COLUMN magic_link_challenges.org_slug IS 'Organization context for direct login';
COMMENT ON COLUMN magic_link_challenges.attempts IS 'Number of verification attempts (max 5)';

COMMENT ON TABLE usage_metrics IS 'Aggregated usage data for billing and rate limiting';
COMMENT ON COLUMN usage_metrics.metric_type IS 'Type of metric: monthly_active_users, emails_sent, etc.';
COMMENT ON COLUMN usage_metrics.period_start IS 'Start of the measurement period';
COMMENT ON COLUMN usage_metrics.period_end IS 'End of the measurement period';

COMMENT ON TABLE rate_limits IS 'Rate limiting data (alternative to Redis)';
COMMENT ON COLUMN rate_limits.key_hash IS 'Hash of the rate limit key (IP, email, etc.)';
COMMENT ON COLUMN rate_limits.window_start IS 'Start of the rate limit window';

-- Migration metadata
INSERT INTO schema_migrations (version, description, applied_at) 
VALUES ('001', 'Initial database schema with multi-tenant authentication', now())
ON CONFLICT (version) DO NOTHING;
