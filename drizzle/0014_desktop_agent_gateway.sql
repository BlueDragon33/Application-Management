-- P8 Desktop Agent Gateway for outbound-only native Windows clients.
-- No client opens an inbound port; all device traffic is initiated by the desktop agent.

CREATE TABLE IF NOT EXISTS desktop_agent_devices (
  device_id TEXT PRIMARY KEY,
  display_code TEXT NOT NULL UNIQUE,
  public_key_jwk TEXT NOT NULL,
  app_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  device_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  app_version TEXT NOT NULL DEFAULT '',
  release_channel TEXT NOT NULL DEFAULT 'stable',
  entitlement_state TEXT NOT NULL DEFAULT 'unknown',
  update_policy_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at TEXT,
  blocked_at TEXT,
  last_seen_at TEXT
);

CREATE INDEX IF NOT EXISTS desktop_agent_devices_status_seen_idx
  ON desktop_agent_devices(status, last_seen_at);

CREATE TABLE IF NOT EXISTS desktop_agent_challenges (
  nonce TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS desktop_agent_challenges_device_idx
  ON desktop_agent_challenges(device_id, expires_at);

CREATE TABLE IF NOT EXISTS desktop_agent_commands (
  command_id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  command_type TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'queued',
  delivery_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  delivered_at TEXT,
  completed_at TEXT,
  result_json TEXT
);

CREATE INDEX IF NOT EXISTS desktop_agent_commands_delivery_idx
  ON desktop_agent_commands(device_id, status, delivered_at, created_at);
