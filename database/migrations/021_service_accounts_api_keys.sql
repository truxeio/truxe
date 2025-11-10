-- Migration: Service Accounts and API Keys
-- Version: 0.3.0
-- Description: Add service accounts and API key authentication (M2M)

BEGIN;

-- ==========================================
-- Service Accounts Table
-- ==========================================

CREATE TABLE service_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'active',

  CONSTRAINT fk_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_creator FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT valid_status CHECK (status IN ('active', 'revoked', 'expired'))
);

CREATE INDEX idx_service_accounts_org ON service_accounts(organization_id);
CREATE INDEX idx_service_accounts_status ON service_accounts(status);
CREATE INDEX idx_service_accounts_created_at ON service_accounts(created_at DESC);

COMMENT ON TABLE service_accounts IS 'Service accounts for M2M authentication';
COMMENT ON COLUMN service_accounts.name IS 'Human-readable name for the service account';
COMMENT ON COLUMN service_accounts.status IS 'active, revoked, or expired';

-- ==========================================
-- API Keys Table
-- ==========================================

CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_account_id UUID NOT NULL REFERENCES service_accounts(id) ON DELETE CASCADE,

  -- Key identification
  key_identifier VARCHAR(8) NOT NULL UNIQUE,
  key_hash TEXT NOT NULL,
  key_prefix VARCHAR(50) NOT NULL,

  -- Metadata
  name VARCHAR(255) NOT NULL,
  description TEXT,
  environment VARCHAR(10) DEFAULT 'live',
  key_type VARCHAR(10) DEFAULT 'pk',

  -- Security
  permissions JSONB DEFAULT '[]'::jsonb,
  allowed_ips INET[],
  rate_limit_tier VARCHAR(20) DEFAULT 'standard',

  -- Lifecycle
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'active',

  -- Audit
  created_by UUID NOT NULL REFERENCES users(id),
  revoked_by UUID REFERENCES users(id),
  revoke_reason TEXT,

  CONSTRAINT fk_service_account FOREIGN KEY (service_account_id) REFERENCES service_accounts(id),
  CONSTRAINT fk_creator FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_revoker FOREIGN KEY (revoked_by) REFERENCES users(id),
  CONSTRAINT valid_environment CHECK (environment IN ('live', 'test')),
  CONSTRAINT valid_key_type CHECK (key_type IN ('pk', 'sk')),
  CONSTRAINT valid_status CHECK (status IN ('active', 'revoked', 'expired')),
  CONSTRAINT valid_rate_limit_tier CHECK (rate_limit_tier IN ('standard', 'high', 'unlimited'))
);

CREATE UNIQUE INDEX idx_api_keys_identifier ON api_keys(key_identifier);
CREATE INDEX idx_api_keys_service_account ON api_keys(service_account_id);
CREATE INDEX idx_api_keys_status ON api_keys(status);
CREATE INDEX idx_api_keys_expires_at ON api_keys(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_api_keys_last_used ON api_keys(last_used_at DESC NULLS LAST);

COMMENT ON TABLE api_keys IS 'API keys for service account authentication';
COMMENT ON COLUMN api_keys.key_identifier IS '8-character unique identifier (public)';
COMMENT ON COLUMN api_keys.key_hash IS 'bcrypt hash of full API key';
COMMENT ON COLUMN api_keys.key_prefix IS 'Display prefix (e.g., heimdall_pk_live_2k8x9m4p)';
COMMENT ON COLUMN api_keys.permissions IS 'JSON array of permission scopes';
COMMENT ON COLUMN api_keys.allowed_ips IS 'IP whitelist (optional)';

-- ==========================================
-- API Key Usage Table (TimescaleDB optional)
-- ==========================================

CREATE TABLE api_key_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,

  -- Request details
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER,

  -- Client details
  ip_address INET,
  user_agent TEXT,

  -- Metadata
  request_id VARCHAR(100),
  error_message TEXT,

  CONSTRAINT fk_api_key FOREIGN KEY (api_key_id) REFERENCES api_keys(id),
  CONSTRAINT valid_method CHECK (method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'))
);

-- Create hypertable for time-series optimization (if TimescaleDB is available)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
    PERFORM create_hypertable('api_key_usage', 'timestamp');
    PERFORM add_retention_policy('api_key_usage', INTERVAL '90 days');
    CREATE MATERIALIZED VIEW api_key_usage_hourly
    WITH (timescaledb.continuous) AS
    SELECT
      time_bucket('1 hour', timestamp) AS hour,
      api_key_id,
      COUNT(*) as request_count,
      AVG(response_time_ms) as avg_response_time,
      COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count
    FROM api_key_usage
    GROUP BY hour, api_key_id;
    PERFORM add_continuous_aggregate_policy('api_key_usage_hourly',
      start_offset => INTERVAL '3 hours',
      end_offset => INTERVAL '1 hour',
      schedule_interval => INTERVAL '1 hour');
  END IF;
END$$;

CREATE INDEX idx_api_key_usage_key ON api_key_usage(api_key_id, timestamp DESC);
CREATE INDEX idx_api_key_usage_endpoint ON api_key_usage(endpoint, timestamp DESC);
CREATE INDEX idx_api_key_usage_status ON api_key_usage(status_code, timestamp DESC);

COMMENT ON TABLE api_key_usage IS 'API key usage logs and analytics';

-- ==========================================
-- Row-Level Security (RLS)
-- ==========================================
-- Note: RLS policies will be added in a future migration
-- For now, access control is handled at the application level

-- ==========================================
-- Triggers and Helper Functions
-- ==========================================

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_service_account_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER service_accounts_updated_at
  BEFORE UPDATE ON service_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_service_account_updated_at();

-- Function to auto-expire API keys
CREATE OR REPLACE FUNCTION auto_expire_api_keys()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE api_keys
  SET status = 'expired'
  WHERE status = 'active'
    AND expires_at IS NOT NULL
    AND expires_at < NOW();
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auto_expire_api_keys() IS 'Auto-expire API keys that have passed their expiration date';

-- Composite indexes for frequent queries
CREATE INDEX idx_api_keys_sa_status ON api_keys(service_account_id, status);
CREATE INDEX idx_api_keys_env_status ON api_keys(environment, status);

COMMIT;
