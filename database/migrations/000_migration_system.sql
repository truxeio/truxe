-- Migration System Bootstrap
-- Description: Create migration tracking infrastructure
-- Author: Heimdall Team
-- Date: 2024-01-15

-- Enable required extensions for migration system
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Schema migrations tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  description text NOT NULL,
  checksum text,
  applied_at timestamptz DEFAULT now(),
  applied_by text DEFAULT current_user,
  execution_time_ms integer,
  
  -- Constraints
  CONSTRAINT version_format CHECK (version ~ '^\d{3}$'),
  CONSTRAINT positive_execution_time CHECK (execution_time_ms IS NULL OR execution_time_ms >= 0)
);

-- Migration execution log for debugging
CREATE TABLE IF NOT EXISTS migration_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('up', 'down')),
  status text NOT NULL CHECK (status IN ('started', 'completed', 'failed', 'rolled_back')),
  error_message text,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  executed_by text DEFAULT current_user,
  
  -- Constraints
  CONSTRAINT completion_time_check CHECK (
    (status IN ('started') AND completed_at IS NULL) OR
    (status IN ('completed', 'failed', 'rolled_back') AND completed_at IS NOT NULL)
  )
);

-- Indexes for migration tables
CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at ON schema_migrations(applied_at);
CREATE INDEX IF NOT EXISTS idx_migration_log_version ON migration_log(version);
CREATE INDEX IF NOT EXISTS idx_migration_log_status ON migration_log(status);
CREATE INDEX IF NOT EXISTS idx_migration_log_started_at ON migration_log(started_at);

-- Function to log migration start
CREATE OR REPLACE FUNCTION log_migration_start(
  migration_version text,
  migration_operation text
) RETURNS uuid AS $$
DECLARE
  log_id uuid;
BEGIN
  INSERT INTO migration_log (version, operation, status)
  VALUES (migration_version, migration_operation, 'started')
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- Function to log migration completion
CREATE OR REPLACE FUNCTION log_migration_completion(
  log_id uuid,
  migration_status text,
  error_msg text DEFAULT NULL
) RETURNS void AS $$
BEGIN
  UPDATE migration_log 
  SET 
    status = migration_status,
    error_message = error_msg,
    completed_at = now()
  WHERE id = log_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get current schema version
CREATE OR REPLACE FUNCTION get_current_schema_version()
RETURNS text AS $$
BEGIN
  RETURN (
    SELECT version 
    FROM schema_migrations 
    ORDER BY version DESC 
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql;

-- Function to check if migration exists
CREATE OR REPLACE FUNCTION migration_exists(migration_version text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM schema_migrations WHERE version = migration_version
  );
END;
$$ LANGUAGE plpgsql;

-- Function to validate migration integrity
CREATE OR REPLACE FUNCTION validate_migration_integrity()
RETURNS TABLE(
  version text,
  status text,
  issue text
) AS $$
BEGIN
  -- Check for gaps in migration sequence
  RETURN QUERY
  WITH expected_versions AS (
    SELECT lpad(generate_series(1, (
      SELECT max(version::integer) FROM schema_migrations
    ))::text, 3, '0') as version
  ),
  missing_versions AS (
    SELECT ev.version
    FROM expected_versions ev
    LEFT JOIN schema_migrations sm ON ev.version = sm.version
    WHERE sm.version IS NULL
  )
  SELECT 
    mv.version,
    'missing'::text as status,
    'Migration gap detected'::text as issue
  FROM missing_versions mv;
  
  -- Check for failed migrations
  RETURN QUERY
  SELECT 
    ml.version,
    'failed'::text as status,
    'Migration failed: ' || COALESCE(ml.error_message, 'Unknown error') as issue
  FROM migration_log ml
  WHERE ml.status = 'failed'
  AND NOT EXISTS (
    SELECT 1 FROM migration_log ml2 
    WHERE ml2.version = ml.version 
    AND ml2.status = 'completed'
    AND ml2.started_at > ml.started_at
  );
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE schema_migrations IS 'Tracks applied database migrations';
COMMENT ON TABLE migration_log IS 'Detailed log of migration execution for debugging';
COMMENT ON FUNCTION log_migration_start IS 'Records the start of a migration operation';
COMMENT ON FUNCTION log_migration_completion IS 'Records the completion of a migration operation';
COMMENT ON FUNCTION get_current_schema_version IS 'Returns the highest applied migration version';
COMMENT ON FUNCTION migration_exists IS 'Checks if a specific migration has been applied';
COMMENT ON FUNCTION validate_migration_integrity IS 'Validates migration sequence integrity';

-- Bootstrap log entry
DO $$
DECLARE
  log_id uuid;
BEGIN
  log_id := log_migration_start('000', 'up');
  
  -- Record this migration as applied
  INSERT INTO schema_migrations (version, description) 
  VALUES ('000', 'Migration system bootstrap')
  ON CONFLICT (version) DO NOTHING;
  
  PERFORM log_migration_completion(log_id, 'completed');
  
  RAISE NOTICE 'Migration system initialized successfully';
END $$;
