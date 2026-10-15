-- Universal browser SSO registration, with exact HTTPS callback and an atomic
-- one-time PKCE grant per client. Deliberately separate from old Blueprint
-- pilot tables; migration preserves already-linked Blueprint sessions.
CREATE TABLE IF NOT EXISTS managed_browser_sso_clients (
  client_id TEXT PRIMARY KEY NOT NULL,
  redirect_uri TEXT NOT NULL,
  required_role TEXT NOT NULL DEFAULT 'owner' CHECK(required_role IN ('owner')),
  status TEXT NOT NULL DEFAULT 'disabled' CHECK(status IN ('enabled','disabled')),
  registered_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS managed_browser_sso_codes (
  code_hash TEXT PRIMARY KEY NOT NULL,
  client_id TEXT NOT NULL REFERENCES managed_browser_sso_clients(client_id),
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS managed_browser_sso_codes_expiry_idx
  ON managed_browser_sso_codes(expires_at);
-- Register only a known existing consumer. Bauman and other clients remain
-- unregistered until their server-side adapters are independently verified.
INSERT OR IGNORE INTO managed_browser_sso_clients
 (client_id, redirect_uri, required_role, status, registered_at)
VALUES ('software-blueprint-hub',
 'https://software-blueprint-hub-git-main-dinhnam3391-4708.vercel.app/api/sso/callback',
 'owner','enabled',1792080000);
