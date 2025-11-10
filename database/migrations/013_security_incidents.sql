-- Migration: Add security incidents table
-- Description: Create table for tracking security incidents and automated responses

-- Create security incidents table
CREATE TABLE IF NOT EXISTS security_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    category VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    source VARCHAR(50) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ip INET,
    user_agent TEXT,
    device_info JSONB,
    details JSONB NOT NULL DEFAULT '{}',
    risk_score DECIMAL(3,1) NOT NULL DEFAULT 0.0 CHECK (risk_score >= 0 AND risk_score <= 10),
    escalation_level INTEGER NOT NULL DEFAULT 1 CHECK (escalation_level >= 1 AND escalation_level <= 4),
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution TEXT
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_security_incidents_type ON security_incidents(type);
CREATE INDEX IF NOT EXISTS idx_security_incidents_severity ON security_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_security_incidents_status ON security_incidents(status);
CREATE INDEX IF NOT EXISTS idx_security_incidents_priority ON security_incidents(priority);
CREATE INDEX IF NOT EXISTS idx_security_incidents_user_id ON security_incidents(user_id);
CREATE INDEX IF NOT EXISTS idx_security_incidents_ip ON security_incidents(ip);
CREATE INDEX IF NOT EXISTS idx_security_incidents_created_at ON security_incidents(created_at);
CREATE INDEX IF NOT EXISTS idx_security_incidents_risk_score ON security_incidents(risk_score);
CREATE INDEX IF NOT EXISTS idx_security_incidents_escalation_level ON security_incidents(escalation_level);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_security_incidents_status_severity ON security_incidents(status, severity);
CREATE INDEX IF NOT EXISTS idx_security_incidents_user_created ON security_incidents(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_security_incidents_ip_created ON security_incidents(ip, created_at);
CREATE INDEX IF NOT EXISTS idx_security_incidents_type_severity ON security_incidents(type, severity);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_security_incidents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_security_incidents_updated_at
    BEFORE UPDATE ON security_incidents
    FOR EACH ROW
    EXECUTE FUNCTION update_security_incidents_updated_at();

-- Add comments for documentation
COMMENT ON TABLE security_incidents IS 'Security incidents and automated response tracking';
COMMENT ON COLUMN security_incidents.id IS 'Unique identifier for the incident';
COMMENT ON COLUMN security_incidents.type IS 'Type of security incident (e.g., brute_force_attack, account_takeover)';
COMMENT ON COLUMN security_incidents.severity IS 'Severity level of the incident';
COMMENT ON COLUMN security_incidents.category IS 'Category of the incident (e.g., attack, anomaly, compromise)';
COMMENT ON COLUMN security_incidents.status IS 'Current status of the incident';
COMMENT ON COLUMN security_incidents.priority IS 'Priority level for handling the incident';
COMMENT ON COLUMN security_incidents.source IS 'Source that detected the incident';
COMMENT ON COLUMN security_incidents.user_id IS 'User associated with the incident (if applicable)';
COMMENT ON COLUMN security_incidents.ip IS 'IP address associated with the incident';
COMMENT ON COLUMN security_incidents.user_agent IS 'User agent string associated with the incident';
COMMENT ON COLUMN security_incidents.device_info IS 'Device fingerprint information';
COMMENT ON COLUMN security_incidents.details IS 'Additional incident details and metadata';
COMMENT ON COLUMN security_incidents.risk_score IS 'Calculated risk score (0-10)';
COMMENT ON COLUMN security_incidents.escalation_level IS 'Current escalation level (1-4)';
COMMENT ON COLUMN security_incidents.assigned_to IS 'User assigned to handle the incident';
COMMENT ON COLUMN security_incidents.created_at IS 'When the incident was created';
COMMENT ON COLUMN security_incidents.updated_at IS 'When the incident was last updated';
COMMENT ON COLUMN security_incidents.resolved_at IS 'When the incident was resolved';
COMMENT ON COLUMN security_incidents.resolution IS 'Resolution details and notes';
