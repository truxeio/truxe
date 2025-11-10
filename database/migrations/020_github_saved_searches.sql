-- Migration: 020_github_saved_searches.sql
-- Description: Saved GitHub search queries
-- Author: Heimdall Team
-- Created: 2024-10-29

-- ============================================================================
-- GITHUB SAVED SEARCHES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS github_saved_searches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Search metadata
    name VARCHAR(255) NOT NULL,
    search_type VARCHAR(50) NOT NULL, -- repository, code, issues, users
    query TEXT NOT NULL,
    filters JSONB DEFAULT '{}'::JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_search_type CHECK (
        search_type IN ('repository', 'code', 'issues', 'users')
    ),
    CONSTRAINT unique_user_search_name UNIQUE (user_id, name)
);

COMMENT ON TABLE github_saved_searches IS 'Saved GitHub search queries for users';
COMMENT ON COLUMN github_saved_searches.user_id IS 'User who saved this search';
COMMENT ON COLUMN github_saved_searches.name IS 'User-friendly name for the search';
COMMENT ON COLUMN github_saved_searches.search_type IS 'Type of search (repository, code, issues, users)';
COMMENT ON COLUMN github_saved_searches.query IS 'GitHub search query string';
COMMENT ON COLUMN github_saved_searches.filters IS 'Additional search filters as JSON';

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_github_saved_searches_user_id
    ON github_saved_searches(user_id);

CREATE INDEX IF NOT EXISTS idx_github_saved_searches_search_type
    ON github_saved_searches(search_type);

CREATE INDEX IF NOT EXISTS idx_github_saved_searches_user_type
    ON github_saved_searches(user_id, search_type);

CREATE INDEX IF NOT EXISTS idx_github_saved_searches_updated_at
    ON github_saved_searches(updated_at DESC);

-- ============================================================================
-- AUTOMATIC UPDATED_AT MANAGEMENT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_github_saved_searches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_github_saved_searches_updated_at ON github_saved_searches;

CREATE TRIGGER trigger_update_github_saved_searches_updated_at
    BEFORE UPDATE ON github_saved_searches
    FOR EACH ROW
    EXECUTE FUNCTION update_github_saved_searches_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

ALTER TABLE github_saved_searches ENABLE ROW LEVEL SECURITY;

-- Users can only access their own saved searches
CREATE POLICY github_saved_searches_user_access
    ON github_saved_searches
    FOR ALL TO authenticated
    USING (user_id = current_user_id())
    WITH CHECK (user_id = current_user_id());

