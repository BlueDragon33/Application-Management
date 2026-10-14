-- Production-only browser SSO authorization codes for Blueprint Hub.
-- One-time DELETE ... RETURNING enforces replay resistance across workers.
CREATE TABLE IF NOT EXISTS hub_sso_authorization_codes (
  code_hash TEXT PRIMARY KEY NOT NULL,
  client_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS hub_sso_expiry_idx ON hub_sso_authorization_codes(expires_at);
