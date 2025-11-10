-- Migration: 003_port_management_schema.sql
-- Description: Create port management and analytics tables
-- Author: Heimdall Team
-- Date: 2024-01-16

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create custom types for port management
CREATE TYPE port_conflict_type AS ENUM ('process_conflict', 'service_conflict', 'system_reserved', 'range_violation');
CREATE TYPE port_resolution_method AS ENUM ('kill_process', 'reassign_port', 'ignore', 'manual');
CREATE TYPE port_environment AS ENUM ('development', 'staging', 'production', 'testing');

-- ============================================================================
-- PORT MANAGEMENT TABLES
-- ============================================================================

-- Port conflicts tracking
CREATE TABLE port_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  port integer NOT NULL,
  environment port_environment NOT NULL,
  conflict_type port_conflict_type NOT NULL,
  conflicting_process text,
  conflicting_service text,
  detected_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  resolution_method port_resolution_method,
  resolution_details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_port_range CHECK (port >= 1 AND port <= 65535),
  CONSTRAINT resolution_consistency CHECK (
    (resolved_at IS NULL AND resolution_method IS NULL) OR
    (resolved_at IS NOT NULL AND resolution_method IS NOT NULL)
  ),
  CONSTRAINT resolution_details_is_object CHECK (jsonb_typeof(resolution_details) = 'object')
);

-- Port usage logging
CREATE TABLE port_usage_log (
  id bigserial PRIMARY KEY,
  port integer NOT NULL,
  service_name text NOT NULL,
  environment port_environment NOT NULL,
  process_name text,
  process_id integer,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_port_range CHECK (port >= 1 AND port <= 65535),
  CONSTRAINT valid_duration CHECK (
    (ended_at IS NULL AND duration_seconds IS NULL) OR
    (ended_at IS NOT NULL AND duration_seconds IS NOT NULL AND duration_seconds >= 0)
  ),
  CONSTRAINT metadata_is_object CHECK (jsonb_typeof(metadata) = 'object')
);

-- Port performance metrics
CREATE TABLE port_performance_metrics (
  id bigserial PRIMARY KEY,
  port integer NOT NULL,
  service_name text NOT NULL,
  environment port_environment NOT NULL,
  response_time numeric(10,3),
  throughput numeric(15,3),
  error_rate numeric(5,2),
  uptime_percentage numeric(5,2),
  cpu_usage numeric(5,2),
  memory_usage bigint,
  connection_count integer,
  measured_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_port_range CHECK (port >= 1 AND port <= 65535),
  CONSTRAINT valid_response_time CHECK (response_time IS NULL OR response_time >= 0),
  CONSTRAINT valid_throughput CHECK (throughput IS NULL OR throughput >= 0),
  CONSTRAINT valid_error_rate CHECK (error_rate IS NULL OR (error_rate >= 0 AND error_rate <= 100)),
  CONSTRAINT valid_uptime CHECK (uptime_percentage IS NULL OR (uptime_percentage >= 0 AND uptime_percentage <= 100)),
  CONSTRAINT valid_cpu_usage CHECK (cpu_usage IS NULL OR (cpu_usage >= 0 AND cpu_usage <= 100)),
  CONSTRAINT valid_memory_usage CHECK (memory_usage IS NULL OR memory_usage >= 0),
  CONSTRAINT valid_connection_count CHECK (connection_count IS NULL OR connection_count >= 0)
);

-- Port configuration templates
CREATE TABLE port_configuration_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  environment port_environment NOT NULL,
  configuration jsonb NOT NULL,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT unique_template_name_env UNIQUE(name, environment),
  CONSTRAINT configuration_is_object CHECK (jsonb_typeof(configuration) = 'object')
);

-- Port allocation history
CREATE TABLE port_allocation_history (
  id bigserial PRIMARY KEY,
  port integer NOT NULL,
  service_name text NOT NULL,
  environment port_environment NOT NULL,
  allocation_method text NOT NULL,
  allocated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  allocated_at timestamptz DEFAULT now(),
  deallocated_at timestamptz,
  reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Constraints
  CONSTRAINT valid_port_range CHECK (port >= 1 AND port <= 65535),
  CONSTRAINT metadata_is_object CHECK (jsonb_typeof(metadata) = 'object')
);

-- ============================================================================
-- INDEXES FOR OPTIMAL PERFORMANCE
-- ============================================================================

-- Port conflicts indexes
CREATE INDEX idx_port_conflicts_port ON port_conflicts(port);
CREATE INDEX idx_port_conflicts_environment ON port_conflicts(environment);
CREATE INDEX idx_port_conflicts_detected_at ON port_conflicts(detected_at);
CREATE INDEX idx_port_conflicts_resolved_at ON port_conflicts(resolved_at) WHERE resolved_at IS NOT NULL;
CREATE INDEX idx_port_conflicts_unresolved ON port_conflicts(port, environment) WHERE resolved_at IS NULL;

-- Port usage log indexes
CREATE INDEX idx_port_usage_port ON port_usage_log(port);
CREATE INDEX idx_port_usage_service ON port_usage_log(service_name);
CREATE INDEX idx_port_usage_environment ON port_usage_log(environment);
CREATE INDEX idx_port_usage_started_at ON port_usage_log(started_at);
CREATE INDEX idx_port_usage_active ON port_usage_log(port, service_name) WHERE ended_at IS NULL;

-- Port performance metrics indexes
CREATE INDEX idx_port_performance_port ON port_performance_metrics(port);
CREATE INDEX idx_port_performance_service ON port_performance_metrics(service_name);
CREATE INDEX idx_port_performance_environment ON port_performance_metrics(environment);
CREATE INDEX idx_port_performance_measured_at ON port_performance_metrics(measured_at);
CREATE INDEX idx_port_performance_recent ON port_performance_metrics(port, measured_at) WHERE measured_at >= now() - interval '24 hours';

-- Port configuration templates indexes
CREATE INDEX idx_port_templates_environment ON port_configuration_templates(environment);
CREATE INDEX idx_port_templates_active ON port_configuration_templates(environment, is_active) WHERE is_active = true;
CREATE INDEX idx_port_templates_created_by ON port_configuration_templates(created_by) WHERE created_by IS NOT NULL;

-- Port allocation history indexes
CREATE INDEX idx_port_allocation_port ON port_allocation_history(port);
CREATE INDEX idx_port_allocation_service ON port_allocation_history(service_name);
CREATE INDEX idx_port_allocation_environment ON port_allocation_history(environment);
CREATE INDEX idx_port_allocation_allocated_at ON port_allocation_history(allocated_at);
CREATE INDEX idx_port_allocation_active ON port_allocation_history(port, service_name) WHERE deallocated_at IS NULL;

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_port_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_port_conflicts_updated_at 
  BEFORE UPDATE ON port_conflicts 
  FOR EACH ROW EXECUTE FUNCTION update_port_updated_at_column();

CREATE TRIGGER update_port_templates_updated_at 
  BEFORE UPDATE ON port_configuration_templates 
  FOR EACH ROW EXECUTE FUNCTION update_port_updated_at_column();

-- Function to calculate port usage duration
CREATE OR REPLACE FUNCTION calculate_port_usage_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL THEN
    NEW.duration_seconds = EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at))::integer;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_port_duration_trigger
  BEFORE UPDATE ON port_usage_log
  FOR EACH ROW EXECUTE FUNCTION calculate_port_usage_duration();

-- Function to cleanup old port data
CREATE OR REPLACE FUNCTION cleanup_old_port_data()
RETURNS TABLE(
  cleaned_conflicts integer,
  cleaned_usage_logs integer,
  cleaned_performance_metrics integer,
  cleaned_allocation_history integer
) AS $$
DECLARE
  conflict_count integer := 0;
  usage_count integer := 0;
  metrics_count integer := 0;
  allocation_count integer := 0;
BEGIN
  -- Cleanup resolved conflicts older than 30 days
  DELETE FROM port_conflicts 
  WHERE resolved_at < now() - interval '30 days';
  GET DIAGNOSTICS conflict_count = ROW_COUNT;
  
  -- Cleanup usage logs older than 90 days
  DELETE FROM port_usage_log 
  WHERE ended_at < now() - interval '90 days';
  GET DIAGNOSTICS usage_count = ROW_COUNT;
  
  -- Cleanup performance metrics older than 30 days
  DELETE FROM port_performance_metrics 
  WHERE measured_at < now() - interval '30 days';
  GET DIAGNOSTICS metrics_count = ROW_COUNT;
  
  -- Cleanup allocation history older than 1 year
  DELETE FROM port_allocation_history 
  WHERE deallocated_at < now() - interval '1 year';
  GET DIAGNOSTICS allocation_count = ROW_COUNT;
  
  RETURN QUERY SELECT conflict_count, usage_count, metrics_count, allocation_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get port usage statistics
CREATE OR REPLACE FUNCTION get_port_usage_stats(
  p_environment port_environment DEFAULT NULL,
  p_timeframe interval DEFAULT interval '24 hours'
)
RETURNS TABLE(
  environment port_environment,
  total_ports bigint,
  active_ports bigint,
  conflict_count bigint,
  avg_response_time numeric,
  avg_uptime numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH port_stats AS (
    SELECT 
      pul.environment,
      COUNT(DISTINCT pul.port) as total_ports,
      COUNT(DISTINCT CASE WHEN pul.ended_at IS NULL THEN pul.port END) as active_ports
    FROM port_usage_log pul
    WHERE (p_environment IS NULL OR pul.environment = p_environment)
      AND pul.started_at >= now() - p_timeframe
    GROUP BY pul.environment
  ),
  conflict_stats AS (
    SELECT 
      pc.environment,
      COUNT(*) as conflict_count
    FROM port_conflicts pc
    WHERE (p_environment IS NULL OR pc.environment = p_environment)
      AND pc.detected_at >= now() - p_timeframe
    GROUP BY pc.environment
  ),
  performance_stats AS (
    SELECT 
      ppm.environment,
      AVG(ppm.response_time) as avg_response_time,
      AVG(ppm.uptime_percentage) as avg_uptime
    FROM port_performance_metrics ppm
    WHERE (p_environment IS NULL OR ppm.environment = p_environment)
      AND ppm.measured_at >= now() - p_timeframe
    GROUP BY ppm.environment
  )
  SELECT 
    ps.environment,
    COALESCE(ps.total_ports, 0),
    COALESCE(ps.active_ports, 0),
    COALESCE(cs.conflict_count, 0),
    COALESCE(perf.avg_response_time, 0),
    COALESCE(perf.avg_uptime, 0)
  FROM port_stats ps
  FULL OUTER JOIN conflict_stats cs ON ps.environment = cs.environment
  FULL OUTER JOIN performance_stats perf ON ps.environment = perf.environment
  ORDER BY ps.environment;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE port_conflicts IS 'Tracking of port conflicts and their resolution';
COMMENT ON COLUMN port_conflicts.port IS 'Port number that experienced the conflict';
COMMENT ON COLUMN port_conflicts.conflict_type IS 'Type of conflict detected';
COMMENT ON COLUMN port_conflicts.resolution_method IS 'Method used to resolve the conflict';

COMMENT ON TABLE port_usage_log IS 'Historical log of port usage by services';
COMMENT ON COLUMN port_usage_log.duration_seconds IS 'Duration the port was in use (calculated automatically)';

COMMENT ON TABLE port_performance_metrics IS 'Performance metrics for services using specific ports';
COMMENT ON COLUMN port_performance_metrics.response_time IS 'Average response time in milliseconds';
COMMENT ON COLUMN port_performance_metrics.throughput IS 'Requests per second';

COMMENT ON TABLE port_configuration_templates IS 'Reusable port configuration templates';
COMMENT ON COLUMN port_configuration_templates.configuration IS 'JSON configuration for port allocation';

COMMENT ON TABLE port_allocation_history IS 'History of port allocations and deallocations';
COMMENT ON COLUMN port_allocation_history.allocation_method IS 'Method used to allocate the port (manual, automatic, etc.)';

-- Migration metadata
INSERT INTO schema_migrations (version, description, applied_at) 
VALUES ('003', 'Port management and analytics schema', now())
ON CONFLICT (version) DO NOTHING;
