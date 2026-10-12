-- Durable control-plane intent ledger. Client databases remain authoritative
-- for actual automation values; pending/failed intents are never served as LIVE.
CREATE TABLE IF NOT EXISTS automation_policy_changes (
  change_id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL,
  field TEXT NOT NULL,
  desired_json TEXT NOT NULL,
  observed_json TEXT,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','applied','failed')),
  requested_by TEXT NOT NULL,
  error_code TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS automation_policy_changes_app_idx
  ON automation_policy_changes(app_id, created_at);
