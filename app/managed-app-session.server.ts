import { getControlDatabase } from "./control-device.server";

export type ManagedAppSessionState = "active" | "revoked" | "expired";

export type ManagedAppSession = {
  sessionId: string;
  appId: "hoa-nhap-nga";
  deviceId: string;
  deviceCode: string;
  issuedAt: string;
  expiresAt: number;
  lastSeenAt: string;
  revokedAt: string | null;
  revokeReason: string | null;
  state: ManagedAppSessionState;
};

type SessionRow = {
  session_id: string;
  app_id: "hoa-nhap-nga";
  device_id: string;
  device_code: string;
  token_hash: string | null;
  issued_at: string;
  expires_at: number;
  last_seen_at: string;
  revoked_at: string | null;
  revoke_reason: string | null;
};

export class ManagedAppSessionError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let ready: Promise<void> | null = null;

async function ensureTable() {
  if (ready) return ready;
  ready = (async () => {
    const database = await getControlDatabase();
    await database.batch([
      database.prepare(`CREATE TABLE IF NOT EXISTS managed_app_sessions (
        session_id TEXT PRIMARY KEY NOT NULL,
        app_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        device_code TEXT NOT NULL,
        token_hash TEXT,
        issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at INTEGER NOT NULL,
        last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        revoked_at TEXT,
        revoke_reason TEXT
      )`),
      database.prepare("CREATE INDEX IF NOT EXISTS managed_app_sessions_app_state_idx ON managed_app_sessions(app_id, expires_at, revoked_at)"),
      database.prepare("CREATE INDEX IF NOT EXISTS managed_app_sessions_device_idx ON managed_app_sessions(app_id, device_id, issued_at)"),
    ]);

    const columns = await database.prepare("PRAGMA table_info(managed_app_sessions)").all<{ name: string }>();
    const names = new Set(columns.results.map((column) => column.name));
    if (!names.has("token_hash")) await database.prepare("ALTER TABLE managed_app_sessions ADD COLUMN token_hash TEXT").run();
    await database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS managed_app_sessions_token_hash_unique ON managed_app_sessions(token_hash) WHERE token_hash IS NOT NULL").run();
  })().catch((error) => {
    ready = null;
    throw error;
  });
  return ready;
}

function sessionId() {
  return [...crypto.getRandomValues(new Uint8Array(16))].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, "0")).join("");
}

function stateFor(row: SessionRow): ManagedAppSessionState {
  if (row.revoked_at) return "revoked";
  return row.expires_at > Date.now() ? "active" : "expired";
}

function publicState(row: SessionRow): ManagedAppSession {
  return {
    sessionId: row.session_id,
    appId: row.app_id,
    deviceId: row.device_id,
    deviceCode: row.device_code,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    lastSeenAt: row.last_seen_at,
    revokedAt: row.revoked_at,
    revokeReason: row.revoke_reason,
    state: stateFor(row),
  };
}

const SESSION_SELECT = `SELECT session_id, app_id, device_id, device_code, token_hash, issued_at, expires_at,
  last_seen_at, revoked_at, revoke_reason FROM managed_app_sessions`;

export async function recordManagedAppSession(input: {
  appId: "hoa-nhap-nga";
  deviceId: string;
  deviceCode: string;
  accessToken: string;
  expiresAt: number;
}) {
  await ensureTable();
  const database = await getControlDatabase();
  const id = sessionId();
  const tokenHash = await sha256(input.accessToken);
  await database.batch([
    database.prepare(`UPDATE managed_app_sessions
      SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP), revoke_reason = COALESCE(revoke_reason, 'renewed')
      WHERE app_id = ? AND device_id = ? AND revoked_at IS NULL AND expires_at > ?`)
      .bind(input.appId, input.deviceId, Date.now()),
    database.prepare(`INSERT INTO managed_app_sessions
      (session_id, app_id, device_id, device_code, token_hash, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(id, input.appId, input.deviceId, input.deviceCode, tokenHash, input.expiresAt),
    database.prepare("DELETE FROM managed_app_sessions WHERE expires_at < ? AND issued_at < datetime('now', '-30 day')")
      .bind(Date.now() - 30 * 24 * 60 * 60 * 1000),
  ]);
  return id;
}

export async function revokeManagedAppDeviceSessions(appId: "hoa-nhap-nga", deviceId: string, reason: string) {
  await ensureTable();
  const database = await getControlDatabase();
  await database.prepare(`UPDATE managed_app_sessions
    SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP), revoke_reason = COALESCE(revoke_reason, ?)
    WHERE app_id = ? AND device_id = ? AND revoked_at IS NULL AND expires_at > ?`)
    .bind(reason.slice(0, 80), appId, deviceId, Date.now()).run();
}

export async function revokeManagedAppSessionsBulk(appId: "hoa-nhap-nga", deviceIds: string[], reason: string) {
  const unique = [...new Set(deviceIds.filter((value) => /^[a-f0-9]{64}$/.test(value)))];
  for (const deviceId of unique.slice(0, 50)) await revokeManagedAppDeviceSessions(appId, deviceId, reason);
}

export async function introspectManagedAppSession(appId: "hoa-nhap-nga", accessToken: unknown) {
  if (typeof accessToken !== "string" || accessToken.length < 40 || accessToken.length > 4096) {
    throw new ManagedAppSessionError("Phiên Hòa nhập Nga không hợp lệ.", 400, "INVALID_SESSION_TOKEN");
  }
  await ensureTable();
  const database = await getControlDatabase();
  const tokenHash = await sha256(accessToken);
  const row = await database.prepare(`${SESSION_SELECT} WHERE app_id = ? AND token_hash = ? LIMIT 1`)
    .bind(appId, tokenHash).first<SessionRow>();
  if (!row) throw new ManagedAppSessionError("Phiên Hòa nhập Nga không còn được Trung tâm công nhận.", 403, "SESSION_NOT_TRACKED");
  if (row.revoked_at) throw new ManagedAppSessionError("Phiên Hòa nhập Nga đã bị thu hồi.", 403, "SESSION_REVOKED");
  if (row.expires_at <= Date.now()) throw new ManagedAppSessionError("Phiên Hòa nhập Nga đã hết hạn.", 403, "SESSION_EXPIRED");

  const device = await database.prepare("SELECT status FROM managed_app_devices WHERE app_id = ? AND device_id = ?")
    .bind(appId, row.device_id).first<{ status: string }>();
  if (!device || device.status !== "approved") {
    await database.prepare(`UPDATE managed_app_sessions SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP),
      revoke_reason = COALESCE(revoke_reason, 'device-not-approved') WHERE session_id = ?`).bind(row.session_id).run();
    throw new ManagedAppSessionError("Quyền thiết bị đã bị thu hồi hoặc khóa.", 403, "SESSION_DEVICE_REVOKED");
  }

  await database.prepare("UPDATE managed_app_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE session_id = ?").bind(row.session_id).run();
  return { ...publicState(row), lastSeenAt: new Date().toISOString(), state: "active" as const };
}

export async function listManagedAppSessions(appId: "hoa-nhap-nga", limit = 40) {
  await ensureTable();
  const database = await getControlDatabase();
  const rows = await database.prepare(`${SESSION_SELECT} WHERE app_id = ? ORDER BY issued_at DESC LIMIT ?`)
    .bind(appId, Math.max(1, Math.min(100, limit))).all<SessionRow>();
  return rows.results.map(publicState);
}

export function managedAppSessionErrorResponse(error: unknown) {
  const headers = { "cache-control": "no-store, private", "x-content-type-options": "nosniff" };
  if (error instanceof ManagedAppSessionError) {
    return Response.json({ ok: false, error: error.message, code: error.code }, { status: error.status, headers });
  }
  return Response.json({ ok: false, error: "Không thể kiểm tra phiên Hòa nhập Nga.", code: "SESSION_SERVICE_ERROR" }, { status: 500, headers });
}
