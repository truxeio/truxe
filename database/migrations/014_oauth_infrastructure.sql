-- Migration: 014_oauth_infrastructure.sql
-- Description: Core OAuth account storage, indexing, and RLS policies
-- Author: Heimdall Team
-- Created: 2024-04-08

-- ============================================================================
-- OAUTH ACCOUNTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS oauth_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    provider_account_id VARCHAR(255) NOT NULL,
    provider_email VARCHAR(255),
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    scope TEXT,
    id_token TEXT,
    profile_data JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (provider, provider_account_id)
);

COMMENT ON TABLE oauth_accounts IS 'Linked external OAuth identities for Heimdall users';
COMMENT ON COLUMN oauth_accounts.user_id IS 'Reference to internal Heimdall user';
COMMENT ON COLUMN oauth_accounts.provider IS 'OAuth provider identifier (google, github, apple, etc.)';
COMMENT ON COLUMN oauth_accounts.provider_account_id IS 'Stable identifier provided by the OAuth provider';
COMMENT ON COLUMN oauth_accounts.access_token IS 'Encrypted access token for the provider';
COMMENT ON COLUMN oauth_accounts.refresh_token IS 'Encrypted refresh token for the provider';
COMMENT ON COLUMN oauth_accounts.id_token IS 'Encrypted ID token / identity assertion';
COMMENT ON COLUMN oauth_accounts.profile_data IS 'Cached profile attributes from the provider';

-- ============================================================================
-- INDEXES FOR COMMON LOOKUPS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user_id
    ON oauth_accounts (user_id);

CREATE INDEX IF NOT EXISTS idx_oauth_accounts_provider_account
    ON oauth_accounts (provider, provider_account_id);

CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user_provider
    ON oauth_accounts (user_id, provider);

-- ============================================================================
-- AUTOMATIC UPDATED_AT MANAGEMENT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_oauth_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_oauth_accounts_updated_at ON oauth_accounts;

CREATE TRIGGER trigger_update_oauth_accounts_updated_at
    BEFORE UPDATE ON oauth_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_oauth_accounts_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

ALTER TABLE oauth_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY oauth_accounts_user_access
    ON oauth_accounts
    FOR ALL TO authenticated
    USING (user_id = current_user_id())
    WITH CHECK (user_id = current_user_id());

-- ============================================================================
-- AUDIT SUPPORT
-- ============================================================================

COMMENT ON TRIGGER trigger_update_oauth_accounts_updated_at ON oauth_accounts
    IS 'Maintains updated_at timestamp for OAuth accounts table';
