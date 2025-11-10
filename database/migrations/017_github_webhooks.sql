-- Migration: 017_github_webhooks.sql
-- Description: Create database schema for storing GitHub webhook events
-- Author: Heimdall Team
-- Date: 2025-01-28

-- ============================================================================
-- GITHUB WEBHOOK EVENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS github_webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    signature VARCHAR(255),
    installation_id VARCHAR(255),

    -- Processing status
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP WITH TIME ZONE,
    processing_error TEXT,
    retry_count INTEGER DEFAULT 0,

    -- Metadata
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT non_negative_retry_count CHECK (retry_count >= 0)
);

COMMENT ON TABLE github_webhook_events IS 'Stores all incoming GitHub webhook events for processing and audit trail';
COMMENT ON COLUMN github_webhook_events.delivery_id IS 'Unique GitHub delivery ID for this webhook event';
COMMENT ON COLUMN github_webhook_events.event_type IS 'Type of GitHub webhook event (push, pull_request, etc.)';
COMMENT ON COLUMN github_webhook_events.payload IS 'Complete webhook payload from GitHub';
COMMENT ON COLUMN github_webhook_events.signature IS 'HMAC signature from GitHub for verification';
COMMENT ON COLUMN github_webhook_events.installation_id IS 'GitHub App installation ID (if applicable)';
COMMENT ON COLUMN github_webhook_events.processed IS 'Whether event has been successfully processed';
COMMENT ON COLUMN github_webhook_events.processing_error IS 'Error message if processing failed';
COMMENT ON COLUMN github_webhook_events.retry_count IS 'Number of retry attempts for failed processing';

-- ============================================================================
-- INDEXES FOR QUERY PERFORMANCE
-- ============================================================================

-- Index for looking up events by type
CREATE INDEX IF NOT EXISTS idx_github_webhooks_event_type
    ON github_webhook_events(event_type);

-- Index for finding unprocessed events (most common query)
CREATE INDEX IF NOT EXISTS idx_github_webhooks_processed
    ON github_webhook_events(processed)
    WHERE NOT processed;

-- Index for delivery ID lookups
CREATE INDEX IF NOT EXISTS idx_github_webhooks_delivery_id
    ON github_webhook_events(delivery_id);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_github_webhooks_received_at
    ON github_webhook_events(received_at DESC);

-- Index for finding events with errors
CREATE INDEX IF NOT EXISTS idx_github_webhooks_errors
    ON github_webhook_events(processing_error)
    WHERE processing_error IS NOT NULL;

-- Composite index for common filtering patterns
CREATE INDEX IF NOT EXISTS idx_github_webhooks_type_processed
    ON github_webhook_events(event_type, processed, received_at DESC);

-- ============================================================================
-- AUTOMATIC UPDATED_AT MANAGEMENT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_github_webhook_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_github_webhook_events_updated_at ON github_webhook_events;

CREATE TRIGGER trigger_update_github_webhook_events_updated_at
    BEFORE UPDATE ON github_webhook_events
    FOR EACH ROW
    EXECUTE FUNCTION update_github_webhook_events_updated_at();

-- ============================================================================
-- CLEANUP FUNCTION FOR OLD EVENTS
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_github_webhook_events()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete processed events older than 90 days
    -- Keep unprocessed events for retry
    DELETE FROM github_webhook_events
    WHERE processed = true
      AND processed_at < NOW() - INTERVAL '90 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_github_webhook_events() IS 
    'Remove old processed GitHub webhook events (older than 90 days)';

-- ============================================================================
-- HELPER FUNCTION TO GET EVENT STATISTICS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_github_webhook_stats(
    since_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '24 hours'
)
RETURNS TABLE (
    event_type VARCHAR(100),
    total_count BIGINT,
    processed_count BIGINT,
    failed_count BIGINT,
    avg_processing_time_ms NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gwe.event_type,
        COUNT(*)::BIGINT as total_count,
        COUNT(*) FILTER (WHERE gwe.processed = true)::BIGINT as processed_count,
        COUNT(*) FILTER (WHERE gwe.processing_error IS NOT NULL)::BIGINT as failed_count,
        AVG(
            EXTRACT(EPOCH FROM (gwe.processed_at - gwe.received_at)) * 1000
        ) FILTER (WHERE gwe.processed = true)::NUMERIC as avg_processing_time_ms
    FROM github_webhook_events gwe
    WHERE gwe.received_at >= since_timestamp
    GROUP BY gwe.event_type
    ORDER BY total_count DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_github_webhook_stats(TIMESTAMP WITH TIME ZONE) IS
    'Get statistics about GitHub webhook events processed in the given time window';

-- ============================================================================
-- MIGRATION METADATA
-- ============================================================================

INSERT INTO schema_migrations (version, description, applied_at) 
VALUES ('017', 'GitHub webhook events storage schema', NOW())
ON CONFLICT (version) DO NOTHING;

