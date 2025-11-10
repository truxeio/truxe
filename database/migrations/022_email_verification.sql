-- Migration 022: Email Verification
-- Description: Add email verification support with tokens and user verification status
-- Date: 2025-11-01

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

BEGIN;

-- Add email verification columns to users table
ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

-- Create email_verification_tokens table
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id
  ON email_verification_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_token
  ON email_verification_tokens(token);

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires_at
  ON email_verification_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_users_email_verified
  ON users(email_verified) WHERE email_verified = FALSE;

-- Add comments
COMMENT ON TABLE email_verification_tokens IS 'Stores email verification tokens for user email verification flow';
COMMENT ON COLUMN users.email_verified IS 'Whether the user has verified their email address';
COMMENT ON COLUMN users.email_verified_at IS 'Timestamp when email was verified';
COMMENT ON COLUMN email_verification_tokens.token IS 'SHA-256 hashed verification token';
COMMENT ON COLUMN email_verification_tokens.expires_at IS 'Token expiration time (24 hours from creation)';
COMMENT ON COLUMN email_verification_tokens.used_at IS 'Timestamp when token was used (single-use enforcement)';

COMMIT;
