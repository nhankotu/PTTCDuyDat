-- ====================================================================
-- Sync missing columns & tables introduced in v1 models/controllers
-- ====================================================================

ALTER TABLE app_user ADD COLUMN IF NOT EXISTS scope_type VARCHAR(50) NOT NULL DEFAULT 'ALL';
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS scope_node_id VARCHAR(100);
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS scope_node_name VARCHAR(255);
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS scope_node_role VARCHAR(100);

ALTER TABLE employee ADD COLUMN IF NOT EXISTS region_name VARCHAR(150);
ALTER TABLE employee ADD COLUMN IF NOT EXISTS position VARCHAR(50);
ALTER TABLE employee ADD COLUMN IF NOT EXISTS level INT;
ALTER TABLE employee ADD COLUMN IF NOT EXISTS manager_name VARCHAR(200);
ALTER TABLE employee ADD COLUMN IF NOT EXISTS status VARCHAR(50);
ALTER TABLE employee ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS permission_preset (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(150) NOT NULL,
    description     TEXT,
    scope_type      VARCHAR(50) NOT NULL DEFAULT 'ALL',
    scope_node_id   VARCHAR(100),
    scope_node_name VARCHAR(255),
    scope_node_role VARCHAR(100),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      VARCHAR(100) NOT NULL DEFAULT 'admin'
);

-- Replace legacy placeholder admin hash if present so admin / admin123 works
UPDATE app_user
SET password_hash = '$2a$11$5i3IrMPdu15AK.CypuDGVuVmO5oEjTCW.7TJLDCrnTwl978ifJ8we'
WHERE username = 'admin'
  AND password_hash = '$2a$11$q9hI6hZ7WpA2R7iT4TfNq.OvhH6V9m3L.s2kHkG7R/d0eK9i3lH8C';
