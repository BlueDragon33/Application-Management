CREATE TABLE IF NOT EXISTS desktop_agent_devices (
  device_id TEXT PRIMARY KEY NOT NULL,
  device_code TEXT NOT NULL UNIQUE,
  app_id TEXT NOT NULL,
  public_key_jwk TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  device_type TEXT NOT NULL DEFAULT 'desktop-native',
  app_version TEXT NOT NULL DEFAULT 'unknown',
  release_channel TEXT NOT NULL DEFAULT 'stable',
  entitlement_state TEXT NOT NULL DEFAULT 'pending',
  update_policy TEXT NOT NULL DEFAULT 'notify',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at TEXT,
  blocked_at TEXT,
  last_seen_at TEXT
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS desktop_agent_devices_status_seen_idx
  ON desktop_agent_devices(status, last_seen_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS desktop_agent_challenges (
  nonce TEXT PRIMARY KEY NOT NULL,
  device_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS desktop_agent_challenges_device_idx
  ON desktop_agent_challenges(device_id, expires_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS desktop_agent_commands (
  command_id TEXT PRIMARY KEY NOT NULL,
  device_id TEXT NOT NULL,
  command_type TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'queued',
  issued_by TEXT NOT NULL,
  issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at INTEGER NOT NULL,
  delivered_at TEXT,
  completed_at TEXT,
  result_json TEXT NOT NULL DEFAULT '{}'
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS desktop_agent_commands_device_state_idx
  ON desktop_agent_commands(device_id, state, issued_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS desktop_agent_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS desktop_agent_audit_target_idx
  ON desktop_agent_audit(target, created_at);
