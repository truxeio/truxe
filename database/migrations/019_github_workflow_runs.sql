-- Migration: 019_github_workflow_runs.sql
-- Description: GitHub Actions workflow runs tracking
-- Author: Heimdall Team
-- Created: 2024-10-29

-- ============================================================================
-- GITHUB WORKFLOW RUNS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS github_workflow_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_run_id BIGINT UNIQUE NOT NULL,
    
    -- Repository info
    repository_owner VARCHAR(255) NOT NULL,
    repository_name VARCHAR(255) NOT NULL,
    repository_id UUID REFERENCES github_repositories(id) ON DELETE SET NULL,
    
    -- Workflow info
    workflow_id BIGINT NOT NULL,
    workflow_name VARCHAR(255),
    
    -- Run status
    status VARCHAR(50) NOT NULL, -- queued, in_progress, completed
    conclusion VARCHAR(50), -- success, failure, cancelled, skipped (null if status != completed)
    
    -- Event and actor
    event VARCHAR(100) NOT NULL, -- push, pull_request, workflow_dispatch, etc.
    actor VARCHAR(255), -- GitHub username who triggered
    
    -- Git info
    head_branch VARCHAR(255),
    head_sha VARCHAR(40),
    
    -- URLs
    workflow_url TEXT,
    
    -- Timestamps
    github_created_at TIMESTAMP WITH TIME ZONE,
    github_updated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_status CHECK (status IN ('queued', 'in_progress', 'completed')),
    CONSTRAINT valid_conclusion CHECK (
        conclusion IS NULL OR 
        conclusion IN ('success', 'failure', 'cancelled', 'skipped', 'neutral', 'timed_out', 'action_required')
    )
);

COMMENT ON TABLE github_workflow_runs IS 'Tracked GitHub Actions workflow runs';
COMMENT ON COLUMN github_workflow_runs.workflow_run_id IS 'GitHub workflow run ID';
COMMENT ON COLUMN github_workflow_runs.status IS 'Current workflow run status';
COMMENT ON COLUMN github_workflow_runs.conclusion IS 'Workflow run conclusion (when completed)';
COMMENT ON COLUMN github_workflow_runs.event IS 'Event that triggered the workflow';
COMMENT ON COLUMN github_workflow_runs.repository_id IS 'Linked Heimdall repository record';

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_github_workflow_runs_workflow_run_id
    ON github_workflow_runs(workflow_run_id);

CREATE INDEX IF NOT EXISTS idx_github_workflow_runs_repository
    ON github_workflow_runs(repository_owner, repository_name);

CREATE INDEX IF NOT EXISTS idx_github_workflow_runs_repository_id
    ON github_workflow_runs(repository_id)
    WHERE repository_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_github_workflow_runs_workflow
    ON github_workflow_runs(workflow_id);

CREATE INDEX IF NOT EXISTS idx_github_workflow_runs_status
    ON github_workflow_runs(status);

CREATE INDEX IF NOT EXISTS idx_github_workflow_runs_created_at
    ON github_workflow_runs(github_created_at DESC);

CREATE INDEX IF NOT EXISTS idx_github_workflow_runs_event
    ON github_workflow_runs(event);

-- ============================================================================
-- AUTOMATIC UPDATED_AT MANAGEMENT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_github_workflow_runs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_github_workflow_runs_updated_at ON github_workflow_runs;

CREATE TRIGGER trigger_update_github_workflow_runs_updated_at
    BEFORE UPDATE ON github_workflow_runs
    FOR EACH ROW
    EXECUTE FUNCTION update_github_workflow_runs_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

ALTER TABLE github_workflow_runs ENABLE ROW LEVEL SECURITY;

-- Users can view workflow runs for repositories they have access to
CREATE POLICY github_workflow_runs_repo_access
    ON github_workflow_runs
    FOR SELECT TO authenticated
    USING (
        repository_id IS NULL OR
        repository_id IN (
            SELECT gr.id FROM github_repositories gr
            INNER JOIN oauth_accounts oa ON gr.oauth_account_id = oa.id
            WHERE oa.user_id = current_user_id()
        )
    );

-- System-only write access
CREATE POLICY github_workflow_runs_system_write
    ON github_workflow_runs
    FOR ALL TO authenticated
    USING (false)
    WITH CHECK (false);

