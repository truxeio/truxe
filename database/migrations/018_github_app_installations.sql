-- Migration: 018_github_app_installations.sql
-- Description: GitHub App installations and token storage
-- Author: Heimdall Team
-- Created: 2024-10-29

-- ============================================================================
-- GITHUB APP INSTALLATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS github_app_installations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    installation_id BIGINT UNIQUE NOT NULL,
    
    -- Installation account (user or organization)
    account_type VARCHAR(50), -- 'User' or 'Organization'
    account_id BIGINT,
    account_login VARCHAR(255),
    
    -- Installation target
    target_type VARCHAR(50), -- 'Organization' or 'User'
    target_id BIGINT,
    
    -- Permissions and settings
    permissions JSONB DEFAULT '{}'::JSONB,
    repository_selection VARCHAR(50), -- 'all' or 'selected'
    
    -- Heimdall organization link
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    
    -- Suspension info
    suspended_at TIMESTAMP WITH TIME ZONE,
    suspended_by VARCHAR(255),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_account_type CHECK (account_type IN ('User', 'Organization')),
    CONSTRAINT valid_target_type CHECK (target_type IN ('Organization', 'User') OR target_type IS NULL),
    CONSTRAINT valid_repository_selection CHECK (repository_selection IN ('all', 'selected') OR repository_selection IS NULL)
);

COMMENT ON TABLE github_app_installations IS 'GitHub App installations linked to Heimdall organizations';
COMMENT ON COLUMN github_app_installations.installation_id IS 'GitHub installation ID (from GitHub API)';
COMMENT ON COLUMN github_app_installations.account_type IS 'Type of account (User or Organization)';
COMMENT ON COLUMN github_app_installations.account_id IS 'GitHub account ID';
COMMENT ON COLUMN github_app_installations.account_login IS 'GitHub account login/username';
COMMENT ON COLUMN github_app_installations.target_type IS 'Installation target type (Organization or User)';
COMMENT ON COLUMN github_app_installations.target_id IS 'GitHub target ID';
COMMENT ON COLUMN github_app_installations.permissions IS 'App permissions granted by installation';
COMMENT ON COLUMN github_app_installations.repository_selection IS 'Repository selection scope (all or selected)';
COMMENT ON COLUMN github_app_installations.organization_id IS 'Linked Heimdall organization';

-- ============================================================================
-- GITHUB APP TOKENS TABLE (Cache for installation access tokens)
-- ============================================================================

CREATE TABLE IF NOT EXISTS github_app_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    installation_id BIGINT NOT NULL REFERENCES github_app_installations(installation_id) ON DELETE CASCADE,
    
    -- Token storage (should be encrypted in production)
    token_hash TEXT NOT NULL, -- Base64 encoded token (use encryption in production)
    
    -- Token metadata
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    permissions JSONB DEFAULT '{}'::JSONB,
    repository_selection VARCHAR(50),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE (installation_id)
);

COMMENT ON TABLE github_app_tokens IS 'Cached installation access tokens (temporary, expire after ~1 hour)';
COMMENT ON COLUMN github_app_tokens.token_hash IS 'Cached access token (should use encryption in production)';
COMMENT ON COLUMN github_app_tokens.expires_at IS 'Token expiration time';
COMMENT ON COLUMN github_app_tokens.permissions IS 'Token permissions';

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_github_app_installations_installation_id
    ON github_app_installations(installation_id);

CREATE INDEX IF NOT EXISTS idx_github_app_installations_account
    ON github_app_installations(account_id, account_type);

CREATE INDEX IF NOT EXISTS idx_github_app_installations_organization
    ON github_app_installations(organization_id)
    WHERE organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_github_app_installations_target
    ON github_app_installations(target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_github_app_tokens_installation
    ON github_app_tokens(installation_id);

CREATE INDEX IF NOT EXISTS idx_github_app_tokens_expires_at
    ON github_app_tokens(expires_at)
    WHERE expires_at > NOW();

-- ============================================================================
-- AUTOMATIC UPDATED_AT MANAGEMENT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_github_app_installations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_github_app_installations_updated_at ON github_app_installations;

CREATE TRIGGER trigger_update_github_app_installations_updated_at
    BEFORE UPDATE ON github_app_installations
    FOR EACH ROW
    EXECUTE FUNCTION update_github_app_installations_updated_at();

-- ============================================================================
-- CLEANUP FUNCTION FOR EXPIRED TOKENS
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_github_app_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM github_app_tokens
    WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_github_app_tokens IS 'Remove expired GitHub App installation tokens';

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

ALTER TABLE github_app_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_app_tokens ENABLE ROW LEVEL SECURITY;

-- Users can view installations for their organizations
CREATE POLICY github_app_installations_org_member_access
    ON github_app_installations
    FOR SELECT TO authenticated
    USING (
        organization_id IS NULL OR
        organization_id IN (
            SELECT org_id FROM memberships
            WHERE user_id = current_user_id()
        )
    );

-- Only system can insert/update/delete installations
CREATE POLICY github_app_installations_system_access
    ON github_app_installations
    FOR ALL TO authenticated
    USING (false)
    WITH CHECK (false);

-- Tokens are system-only
CREATE POLICY github_app_tokens_system_access
    ON github_app_tokens
    FOR ALL TO authenticated
    USING (false)
    WITH CHECK (false);

