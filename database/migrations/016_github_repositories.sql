-- Migration: 016_github_repositories.sql
-- Description: Create database schema for caching GitHub repository data
-- Author: Heimdall Team
-- Date: 2025-01-28

-- ============================================================================
-- GITHUB REPOSITORIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS github_repositories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    oauth_account_id UUID NOT NULL REFERENCES oauth_accounts(id) ON DELETE CASCADE,
    github_repo_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    owner_login VARCHAR(255) NOT NULL,
    owner_type VARCHAR(50) NOT NULL, -- User, Organization

    -- Repository details
    description TEXT,
    is_private BOOLEAN DEFAULT false,
    is_fork BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
    default_branch VARCHAR(255),

    -- Permissions (stored as JSONB for flexibility)
    permissions JSONB DEFAULT '{}'::JSONB, -- admin, push, pull

    -- Metadata
    language VARCHAR(100),
    topics TEXT[],
    stars_count INTEGER DEFAULT 0,
    forks_count INTEGER DEFAULT 0,
    watchers_count INTEGER DEFAULT 0,

    -- Timestamps from GitHub
    github_created_at TIMESTAMP WITH TIME ZONE,
    github_updated_at TIMESTAMP WITH TIME ZONE,
    github_pushed_at TIMESTAMP WITH TIME ZONE,

    -- Sync tracking
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    UNIQUE (oauth_account_id, github_repo_id),
    CONSTRAINT valid_owner_type CHECK (owner_type IN ('User', 'Organization')),
    CONSTRAINT non_negative_counts CHECK (
        stars_count >= 0 AND
        forks_count >= 0 AND
        watchers_count >= 0
    )
);

COMMENT ON TABLE github_repositories IS 'Cached GitHub repository data for authenticated users';
COMMENT ON COLUMN github_repositories.oauth_account_id IS 'Reference to OAuth account with GitHub access token';
COMMENT ON COLUMN github_repositories.github_repo_id IS 'GitHub repository ID (stable identifier)';
COMMENT ON COLUMN github_repositories.full_name IS 'Full repository name (owner/repo)';
COMMENT ON COLUMN github_repositories.permissions IS 'User permissions for this repository (admin, push, pull)';
COMMENT ON COLUMN github_repositories.topics IS 'Repository topics/tags';
COMMENT ON COLUMN github_repositories.synced_at IS 'Last successful synchronization timestamp';

-- ============================================================================
-- INDEXES FOR COMMON LOOKUPS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_github_repos_oauth_account
    ON github_repositories(oauth_account_id);

CREATE INDEX IF NOT EXISTS idx_github_repos_owner
    ON github_repositories(owner_login);

CREATE INDEX IF NOT EXISTS idx_github_repos_full_name
    ON github_repositories(full_name);

CREATE INDEX IF NOT EXISTS idx_github_repos_synced_at
    ON github_repositories(synced_at);

CREATE INDEX IF NOT EXISTS idx_github_repos_is_private
    ON github_repositories(is_private);

CREATE INDEX IF NOT EXISTS idx_github_repos_is_archived
    ON github_repositories(is_archived);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_github_repos_oauth_private
    ON github_repositories(oauth_account_id, is_private);

-- Full-text search index on name and description
CREATE INDEX IF NOT EXISTS idx_github_repos_fulltext
    ON github_repositories USING gin(to_tsvector('english', 
        COALESCE(name, '') || ' ' || 
        COALESCE(description, '') || ' ' || 
        COALESCE(full_name, '')
    ));

-- ============================================================================
-- AUTOMATIC UPDATED_AT MANAGEMENT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_github_repositories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_github_repositories_updated_at ON github_repositories;

CREATE TRIGGER trigger_update_github_repositories_updated_at
    BEFORE UPDATE ON github_repositories
    FOR EACH ROW
    EXECUTE FUNCTION update_github_repositories_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

ALTER TABLE github_repositories ENABLE ROW LEVEL SECURITY;

-- Users can only see repositories linked to their OAuth accounts
CREATE POLICY github_repositories_user_access
    ON github_repositories
    FOR ALL TO authenticated
    USING (
        oauth_account_id IN (
            SELECT id FROM oauth_accounts
            WHERE user_id = current_user_id()
        )
    )
    WITH CHECK (
        oauth_account_id IN (
            SELECT id FROM oauth_accounts
            WHERE user_id = current_user_id()
        )
    );

-- ============================================================================
-- CLEANUP FUNCTION FOR STALE DATA
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_stale_github_repositories()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete repositories that haven't been synced in 30 days
    -- and are linked to inactive OAuth accounts
    DELETE FROM github_repositories
    WHERE synced_at < NOW() - INTERVAL '30 days'
      AND oauth_account_id IN (
          SELECT id FROM oauth_accounts
          WHERE updated_at < NOW() - INTERVAL '90 days'
      );

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_stale_github_repositories() IS 
    'Remove stale GitHub repository cache entries (repos not synced in 30 days)';

-- ============================================================================
-- MIGRATION METADATA
-- ============================================================================

INSERT INTO schema_migrations (version, description, applied_at) 
VALUES ('016', 'GitHub repositories caching schema', NOW())
ON CONFLICT (version) DO NOTHING;




