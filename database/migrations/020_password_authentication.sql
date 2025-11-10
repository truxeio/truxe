-- Migration: 020_password_authentication
-- Target Release: v0.3.3
-- Purpose: Add password authentication schema: user password fields, password history,
--          reset tokens, and account lockout fields.
-- Best Practices: Uses IF NOT EXISTS for idempotency, proper data types, FK cascades,
--                 and indexes on foreign keys and frequently queried columns.
-- Rollback Strategy (manual):
--   1) Drop indexes created here (if present)
--   2) Drop tables: password_reset_tokens, password_history
--   3) Optionally remove columns from users (password_hash, password_updated_at,
--      failed_login_attempts, locked_until) if safe
-- Note: Execute rollback steps carefully to avoid data loss.

BEGIN;

-- Ensure required extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Modify users table (idempotent adds)
ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS password_updated_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;

ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

-- 2. Create password_history table
CREATE TABLE IF NOT EXISTS password_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for password_history
CREATE INDEX IF NOT EXISTS idx_password_history_user_id ON password_history(user_id);
CREATE INDEX IF NOT EXISTS idx_password_history_created_at ON password_history(created_at);

-- 3. Create password_reset_tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (token)
);

-- Indexes for password_reset_tokens
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
-- Redundant with UNIQUE but maintained for explicit lookup patterns
CREATE UNIQUE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

COMMIT;


