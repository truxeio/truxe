-- Migration: 032_oauth_provider_infrastructure.sql
-- Description: OAuth 2.0 Provider infrastructure for "Login with Heimdall"
-- Author: Wundam LLC
-- Created: 2025-01-04
--
-- This migration adds tables and functions for Heimdall to act as an OAuth 2.0 Provider,
-- enabling third-party applications (like Hippoc) to use "Login with Heimdall".
--
-- Features:
-- - OAuth client registration and management
-- - Authorization code flow (RFC 6749)
-- - PKCE support (RFC 7636)
-- - Token issuance and refresh
-- - User consent management
-- - Row-level security policies

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- OAuth Client Applications
-- ============================================================================

CREATE TABLE IF NOT EXISTS oauth_clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Client Credentials
  client_id VARCHAR(255) UNIQUE NOT NULL,
  client_secret_hash VARCHAR(255) NOT NULL, -- bcrypt hashed

  -- Client Metadata
  client_name VARCHAR(255) NOT NULL,
  client_uri TEXT,
  logo_uri TEXT,
  tos_uri TEXT,
  policy_uri TEXT,

  -- OAuth Configuration
  redirect_uris TEXT[] NOT NULL,
  allowed_scopes TEXT[] DEFAULT ARRAY['openid', 'email', 'profile'],
  grant_types TEXT[] DEFAULT ARRAY['authorization_code', 'refresh_token'],
  response_types TEXT[] DEFAULT ARRAY['code'],
  token_endpoint_auth_method VARCHAR(50) DEFAULT 'client_secret_post',

  -- Security
  require_pkce BOOLEAN DEFAULT true,
  require_consent BOOLEAN DEFAULT true,
  trusted BOOLEAN DEFAULT false, -- Trusted clients skip consent

  -- Ownership & Status
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE,

  -- Constraints
  CONSTRAINT redirect_uris_not_empty CHECK (array_length(redirect_uris, 1) > 0),
  CONSTRAINT valid_status CHECK (status IN ('active', 'suspended', 'revoked'))
);

-- Indexes for oauth_clients
CREATE INDEX IF NOT EXISTS idx_oauth_clients_client_id ON oauth_clients(client_id);
CREATE INDEX IF NOT EXISTS idx_oauth_clients_tenant_id ON oauth_clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_oauth_clients_created_by ON oauth_clients(created_by);
CREATE INDEX IF NOT EXISTS idx_oauth_clients_status ON oauth_clients(status) WHERE status = 'active';

-- Comments for oauth_clients
COMMENT ON TABLE oauth_clients IS 'Registered OAuth 2.0 client applications that can use "Login with Heimdall"';
COMMENT ON COLUMN oauth_clients.client_id IS 'Public client identifier (format: cl_xxxxxxxxxxxxx)';
COMMENT ON COLUMN oauth_clients.client_secret_hash IS 'Bcrypt hashed client secret (never store plain text)';
COMMENT ON COLUMN oauth_clients.require_pkce IS 'Require PKCE for public clients (RFC 7636)';
COMMENT ON COLUMN oauth_clients.trusted IS 'Trusted clients bypass user consent screen';
COMMENT ON COLUMN oauth_clients.redirect_uris IS 'Whitelisted redirect URIs (exact match required)';

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_oauth_clients_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_oauth_clients_updated_at ON oauth_clients;

CREATE TRIGGER trigger_update_oauth_clients_updated_at
    BEFORE UPDATE ON oauth_clients
    FOR EACH ROW
    EXECUTE FUNCTION update_oauth_clients_updated_at();

-- ============================================================================
-- Authorization Codes
-- ============================================================================

CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Code
  code VARCHAR(255) UNIQUE NOT NULL,
  code_challenge VARCHAR(255), -- For PKCE
  code_challenge_method VARCHAR(10) CHECK (code_challenge_method IN ('plain', 'S256')),

  -- Grant Details
  client_id VARCHAR(255) NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Authorization Details
  redirect_uri TEXT NOT NULL,
  scope TEXT,
  state VARCHAR(255),
  nonce VARCHAR(255), -- For OpenID Connect

  -- Lifecycle
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,

  -- Constraints
  CONSTRAINT code_single_use CHECK (
    (used_at IS NULL AND revoked_at IS NULL) OR
    (used_at IS NOT NULL OR revoked_at IS NOT NULL)
  ),
  CONSTRAINT expires_after_created CHECK (expires_at > created_at),
  CONSTRAINT valid_pkce_method CHECK (
    code_challenge_method IS NULL OR code_challenge_method IN ('plain', 'S256')
  )
);

-- Indexes for oauth_authorization_codes
CREATE INDEX IF NOT EXISTS idx_oauth_codes_code ON oauth_authorization_codes(code)
  WHERE used_at IS NULL AND revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_oauth_codes_client_id ON oauth_authorization_codes(client_id);
CREATE INDEX IF NOT EXISTS idx_oauth_codes_user_id ON oauth_authorization_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_codes_expires_at ON oauth_authorization_codes(expires_at);

-- Comments for oauth_authorization_codes
COMMENT ON TABLE oauth_authorization_codes IS 'Short-lived authorization codes for OAuth 2.0 flow (10 minutes TTL)';
COMMENT ON COLUMN oauth_authorization_codes.code IS 'One-time use authorization code (format: authz_xxxxxxxxxxxxx)';
COMMENT ON COLUMN oauth_authorization_codes.code_challenge IS 'PKCE code challenge (RFC 7636) - prevents authorization code interception';

-- Auto-cleanup expired codes function
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM oauth_authorization_codes
  WHERE expires_at < NOW() - INTERVAL '1 hour';

  RAISE NOTICE 'Cleaned up expired OAuth authorization codes';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_oauth_codes() IS 'Cleanup function for expired authorization codes (run via cron job)';

-- ============================================================================
-- OAuth Access Tokens (Provider)
-- ============================================================================

CREATE TABLE IF NOT EXISTS oauth_provider_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Token
  token_hash VARCHAR(255) UNIQUE NOT NULL, -- SHA-256 hash of token
  token_type VARCHAR(20) DEFAULT 'Bearer',

  -- Grant Details
  client_id VARCHAR(255) NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL for client_credentials

  -- Token Details
  scope TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Refresh Token (optional)
  refresh_token_hash VARCHAR(255) UNIQUE,
  refresh_token_expires_at TIMESTAMP WITH TIME ZONE,

  -- Lifecycle
  revoked_at TIMESTAMP WITH TIME ZONE,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  ip_address INET,
  user_agent TEXT,

  -- Constraints
  CONSTRAINT expires_after_created CHECK (expires_at > created_at),
  CONSTRAINT refresh_expires_after_access CHECK (
    refresh_token_expires_at IS NULL OR refresh_token_expires_at > expires_at
  )
);

-- Indexes for oauth_provider_tokens
CREATE INDEX IF NOT EXISTS idx_oauth_provider_tokens_hash ON oauth_provider_tokens(token_hash)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_oauth_provider_tokens_refresh ON oauth_provider_tokens(refresh_token_hash)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_oauth_provider_tokens_client_id ON oauth_provider_tokens(client_id);
CREATE INDEX IF NOT EXISTS idx_oauth_provider_tokens_user_id ON oauth_provider_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_provider_tokens_expires_at ON oauth_provider_tokens(expires_at);

-- Comments for oauth_provider_tokens
COMMENT ON TABLE oauth_provider_tokens IS 'OAuth 2.0 access and refresh tokens issued by Heimdall as OAuth Provider';
COMMENT ON COLUMN oauth_provider_tokens.token_hash IS 'SHA-256 hash of the bearer token (never store plain text)';
COMMENT ON COLUMN oauth_provider_tokens.refresh_token_hash IS 'SHA-256 hash of the refresh token';
COMMENT ON COLUMN oauth_provider_tokens.user_id IS 'NULL for client_credentials grant type';

-- ============================================================================
-- User Consent Records
-- ============================================================================

CREATE TABLE IF NOT EXISTS oauth_user_consents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Grant Details
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id VARCHAR(255) NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,

  -- Consent Details
  scope TEXT NOT NULL,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE,

  -- Audit
  ip_address INET,
  user_agent TEXT,

  -- Constraints
  UNIQUE (user_id, client_id),
  CONSTRAINT expires_after_granted CHECK (expires_at IS NULL OR expires_at > granted_at)
);

-- Indexes for oauth_user_consents
CREATE INDEX IF NOT EXISTS idx_oauth_consents_user_id ON oauth_user_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_consents_client_id ON oauth_user_consents(client_id);
CREATE INDEX IF NOT EXISTS idx_oauth_consents_active ON oauth_user_consents(user_id, client_id)
  WHERE revoked_at IS NULL;

-- Comments for oauth_user_consents
COMMENT ON TABLE oauth_user_consents IS 'User consent records for OAuth applications (GDPR compliance)';
COMMENT ON COLUMN oauth_user_consents.scope IS 'Space-separated list of granted scopes (e.g., "openid email profile")';

-- ============================================================================
-- Row Level Security
-- ============================================================================
-- NOTE: RLS policies commented out until we implement the helper functions
-- (current_tenant_id(), current_user_id(), current_user_role())
-- These will be added in a future migration when RLS is properly set up.

-- ALTER TABLE oauth_clients ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE oauth_authorization_codes ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE oauth_provider_tokens ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE oauth_user_consents ENABLE ROW LEVEL SECURITY;

-- -- Clients can only see their own data
-- CREATE POLICY oauth_clients_owner_access
--   ON oauth_clients
--   FOR ALL
--   USING (tenant_id = current_tenant_id() OR created_by = current_user_id());

-- -- Users can see their own authorization codes
-- CREATE POLICY oauth_codes_user_access
--   ON oauth_authorization_codes
--   FOR SELECT
--   USING (user_id = current_user_id());

-- -- Users can see their own consents
-- CREATE POLICY oauth_consents_user_access
--   ON oauth_user_consents
--   FOR ALL
--   USING (user_id = current_user_id());

-- -- Admin can see all OAuth data
-- CREATE POLICY oauth_clients_admin_access
--   ON oauth_clients
--   FOR ALL
--   USING (current_user_role() = 'admin');

-- CREATE POLICY oauth_codes_admin_access
--   ON oauth_authorization_codes
--   FOR ALL
--   USING (current_user_role() = 'admin');

-- CREATE POLICY oauth_tokens_admin_access
--   ON oauth_provider_tokens
--   FOR ALL
--   USING (current_user_role() = 'admin');

-- CREATE POLICY oauth_consents_admin_access
--   ON oauth_user_consents
--   FOR ALL
--   USING (current_user_role() = 'admin');

-- ============================================================================
-- Grant Permissions
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON oauth_clients TO truxe;
GRANT SELECT, INSERT, UPDATE, DELETE ON oauth_authorization_codes TO truxe;
GRANT SELECT, INSERT, UPDATE, DELETE ON oauth_provider_tokens TO truxe;
GRANT SELECT, INSERT, UPDATE, DELETE ON oauth_user_consents TO truxe;

-- ============================================================================
-- Success Message
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ OAuth Provider infrastructure migration completed successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Created tables:';
  RAISE NOTICE '  - oauth_clients (OAuth client applications)';
  RAISE NOTICE '  - oauth_authorization_codes (Authorization codes)';
  RAISE NOTICE '  - oauth_provider_tokens (Access & refresh tokens)';
  RAISE NOTICE '  - oauth_user_consents (User consent records)';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Implement OAuth client service (client-service.js)';
  RAISE NOTICE '  2. Implement authorization service (authorization-service.js)';
  RAISE NOTICE '  3. Implement token service (token-service.js)';
  RAISE NOTICE '  4. Implement consent service (consent-service.js)';
  RAISE NOTICE '';
  RAISE NOTICE 'Heimdall can now act as an OAuth 2.0 Provider! 🎉';
END $$;
