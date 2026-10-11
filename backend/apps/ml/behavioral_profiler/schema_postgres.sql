-- ============================================================
-- CyberShield AI – Behavioral Profiler Database Schema
-- PostgreSQL compatible
-- ============================================================

-- 1. Contacts table
CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,                     -- composite: contact_id + "_" + platform
    contact_id TEXT NOT NULL,                -- original contact ID from the platform
    platform TEXT NOT NULL,                  -- WhatsApp, Instagram, etc.
    first_seen TIMESTAMP NOT NULL,
    last_seen TIMESTAMP NOT NULL,
    total_messages INTEGER DEFAULT 0,
    average_severity REAL DEFAULT 0.0,
    escalation_flag BOOLEAN DEFAULT FALSE
);

-- 2. Messages table
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    contact_id TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    text TEXT NOT NULL,
    intent TEXT NOT NULL,
    severity_score REAL NOT NULL,
    CONSTRAINT fk_messages_contact FOREIGN KEY (contact_id)
        REFERENCES contacts(id) ON DELETE CASCADE
);

-- 3. Alerts table
CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    contact_id TEXT NOT NULL,
    alert_time TIMESTAMP NOT NULL,
    severity_before REAL NOT NULL,
    severity_after REAL NOT NULL,
    trigger_message TEXT NOT NULL,
    CONSTRAINT fk_alerts_contact FOREIGN KEY (contact_id)
        REFERENCES contacts(id) ON DELETE CASCADE
);

-- ============================================================
-- Indexes for performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_messages_contact ON messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_alerts_contact ON alerts(contact_id);
CREATE INDEX IF NOT EXISTS idx_alerts_time ON alerts(alert_time);

-- ============================================================
-- View: Behavioral Profiles (with recent alerts as a text list)
-- ============================================================

CREATE OR REPLACE VIEW v_behavioral_profiles AS
SELECT
    c.id,
    c.contact_id,
    c.platform,
    c.first_seen,
    c.last_seen,
    c.total_messages,
    c.average_severity,
    c.escalation_flag,
    (SELECT COUNT(*) FROM alerts a WHERE a.contact_id = c.id) AS alert_count,
    COALESCE(
        (SELECT array_to_string(
            array_agg(trigger_message ORDER BY alert_time DESC),
            ' | '
        ) FROM alerts a WHERE a.contact_id = c.id),
        ''
    ) AS recent_alerts
FROM contacts c;
