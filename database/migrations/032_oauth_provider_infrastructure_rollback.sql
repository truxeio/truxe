-- Rollback Migration: 032_oauth_provider_infrastructure_rollback.sql
-- Description: Rollback OAuth 2.0 Provider infrastructure
-- Author: Wundam LLC
-- Created: 2025-01-04
--
-- This migration rolls back the OAuth Provider infrastructure by dropping all tables,
-- functions, and policies created in 032_oauth_provider_infrastructure.sql

-- ============================================================================
-- Drop Row Level Security Policies
-- ============================================================================

DROP POLICY IF EXISTS oauth_clients_owner_access ON oauth_clients;
DROP POLICY IF EXISTS oauth_clients_admin_access ON oauth_clients;
DROP POLICY IF EXISTS oauth_codes_user_access ON oauth_authorization_codes;
DROP POLICY IF EXISTS oauth_codes_admin_access ON oauth_authorization_codes;
DROP POLICY IF EXISTS oauth_tokens_admin_access ON oauth_provider_tokens;
DROP POLICY IF EXISTS oauth_consents_user_access ON oauth_user_consents;
DROP POLICY IF EXISTS oauth_consents_admin_access ON oauth_user_consents;

-- ============================================================================
-- Drop Tables (reverse order due to foreign keys)
-- ============================================================================

DROP TABLE IF EXISTS oauth_user_consents CASCADE;
DROP TABLE IF EXISTS oauth_provider_tokens CASCADE;
DROP TABLE IF EXISTS oauth_authorization_codes CASCADE;
DROP TABLE IF EXISTS oauth_clients CASCADE;

-- ============================================================================
-- Drop Functions
-- ============================================================================

DROP FUNCTION IF EXISTS cleanup_expired_oauth_codes();
DROP FUNCTION IF EXISTS update_oauth_clients_updated_at();

-- ============================================================================
-- Success Message
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ OAuth Provider infrastructure rollback completed successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Dropped tables:';
  RAISE NOTICE '  - oauth_user_consents';
  RAISE NOTICE '  - oauth_provider_tokens';
  RAISE NOTICE '  - oauth_authorization_codes';
  RAISE NOTICE '  - oauth_clients';
  RAISE NOTICE '';
  RAISE NOTICE 'Dropped functions:';
  RAISE NOTICE '  - cleanup_expired_oauth_codes()';
  RAISE NOTICE '  - update_oauth_clients_updated_at()';
  RAISE NOTICE '';
  RAISE NOTICE 'OAuth Provider infrastructure has been removed.';
END $$;
