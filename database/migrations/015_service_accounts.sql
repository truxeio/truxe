-- Migration: Service Accounts for Backend-to-Backend Authentication
-- Description: Add service account support for API clients like Hippoc
-- Version: 015
-- Date: 2025-10-28

BEGIN;

-- Service accounts table for API clients
CREATE TABLE IF NOT EXISTS service_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  client_id VARCHAR(255) NOT NULL UNIQUE,
  client_secret_hash TEXT NOT NULL,
  scopes TEXT[] DEFAULT ARRAY[]::TEXT[],
  enabled BOOLEAN DEFAULT true,
  rate_limit_per_minute INTEGER DEFAULT 1000,
  ip_whitelist TEXT[],
  metadata JSONB DEFAULT '{}'::jsonb,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id),

  CONSTRAINT unique_org_client_id UNIQUE (organization_id, client_id)
);

-- Service account tokens (short-lived JWT tokens)
CREATE TABLE IF NOT EXISTS service_account_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_account_id UUID NOT NULL REFERENCES service_accounts(id) ON DELETE CASCADE,
  jti UUID NOT NULL UNIQUE,
  token_hash TEXT NOT NULL,
  scopes TEXT[] DEFAULT ARRAY[]::TEXT[],
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMPTZ,
  ip_address INET,
  user_agent TEXT,

  CONSTRAINT valid_expiration CHECK (expires_at > created_at)
);

-- API usage logs for service accounts
CREATE TABLE IF NOT EXISTS service_account_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_account_id UUID NOT NULL REFERENCES service_accounts(id) ON DELETE CASCADE,
  endpoint VARCHAR(500) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER,
  ip_address INET,
  user_agent TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_service_accounts_org_id ON service_accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_service_accounts_client_id ON service_accounts(client_id);
CREATE INDEX IF NOT EXISTS idx_service_accounts_enabled ON service_accounts(enabled) WHERE enabled = true;

CREATE INDEX IF NOT EXISTS idx_service_account_tokens_sa_id ON service_account_tokens(service_account_id);
CREATE INDEX IF NOT EXISTS idx_service_account_tokens_jti ON service_account_tokens(jti);
CREATE INDEX IF NOT EXISTS idx_service_account_tokens_expires ON service_account_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_service_account_logs_sa_id ON service_account_logs(service_account_id);
CREATE INDEX IF NOT EXISTS idx_service_account_logs_created_at ON service_account_logs(created_at DESC);

-- Note: Partitioning can be added later if needed
-- For now, using regular table with index on created_at

-- Update trigger
CREATE OR REPLACE FUNCTION update_service_account_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER service_accounts_updated_at
  BEFORE UPDATE ON service_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_service_account_updated_at();

-- RLS Policies
ALTER TABLE service_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_account_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_account_logs ENABLE ROW LEVEL SECURITY;

-- Service accounts can only be accessed by organization members
CREATE POLICY service_accounts_org_access ON service_accounts
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = current_setting('app.current_user_id', true)::uuid
    )
  );

-- Service account tokens can only be accessed by the service account itself
CREATE POLICY service_account_tokens_access ON service_account_tokens
  FOR ALL
  USING (
    service_account_id IN (
      SELECT id FROM service_accounts
      WHERE organization_id IN (
        SELECT organization_id FROM memberships
        WHERE user_id = current_setting('app.current_user_id', true)::uuid
      )
    )
  );

-- Service account logs can only be accessed by organization members
CREATE POLICY service_account_logs_access ON service_account_logs
  FOR ALL
  USING (
    service_account_id IN (
      SELECT id FROM service_accounts
      WHERE organization_id IN (
        SELECT organization_id FROM memberships
        WHERE user_id = current_setting('app.current_user_id', true)::uuid
      )
    )
  );

-- Insert Hippoc service account
INSERT INTO service_accounts (
  organization_id,
  name,
  description,
  client_id,
  client_secret_hash,
  scopes,
  enabled,
  rate_limit_per_minute,
  metadata
) VALUES (
  (SELECT id FROM organizations WHERE slug = 'hippoc-ai'),
  'Hippoc Backend',
  'Backend service account for Hippoc AI application',
  'hippoc-backend-prod',
  -- Client secret: Pjzj+MW7pgCOXNGVLP7WcUrk1DYx7SLeubAGyXi74ew=
  -- Hashed with argon2
  '$argon2id$v=19$m=65536,t=3,p=4$KSjVsJRFK+MCziDHD5zXaQ$m9TL/2kFQLADwEK6b1Wup4ZDjR4428s1DUQhuV+Z0ws',
  ARRAY['users:read', 'users:write', 'oauth:read', 'sessions:read'],
  true,
  2000,
  '{
    "environment": "production",
    "app": "hippoc-ai"
  }'::jsonb
);

COMMIT;
