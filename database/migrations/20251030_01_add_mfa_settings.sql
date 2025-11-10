-- MFA Settings Table
-- Tracks TOTP configuration and backup codes per user

BEGIN;

CREATE TABLE IF NOT EXISTS mfa_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  totp_secret TEXT,
  totp_verified BOOLEAN DEFAULT FALSE,
  backup_codes TEXT[],
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure one MFA settings row per user
CREATE UNIQUE INDEX IF NOT EXISTS ux_mfa_settings_user_id ON mfa_settings(user_id);

-- Partial index to speed up queries for enabled MFA
CREATE INDEX IF NOT EXISTS ix_mfa_settings_verified ON mfa_settings(user_id) WHERE totp_verified IS TRUE;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION set_updated_at_timestamp() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mfa_settings_updated_at ON mfa_settings;
CREATE TRIGGER trg_mfa_settings_updated_at
BEFORE UPDATE ON mfa_settings
FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

COMMIT;


