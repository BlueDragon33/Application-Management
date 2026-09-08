import { getControlDatabase } from "./control-device.server";

export type ManagedAppId = "hoa-nhap-nga";
export type ManagedAppDeviceStatus = "pending" | "approved" | "blocked";
export type ManagedDeviceClass = "computer" | "phone" | "tablet" | "unknown";

export type ManagedAppDevice = {
  appId: ManagedAppId;
  deviceId: string;
  deviceCode: string;
  status: ManagedAppDeviceStatus;
  label: string | null;
  deviceClass: ManagedDeviceClass;
  osName: string;
  browserName: string;
  modelHint: string | null;
  screen: string | null;
  createdAt: string;
  approvedAt: string | null;
  blockedAt: string | null;
  lastSeenAt: string;
  approvedBy: string | null;
  active: boolean;
};

type DeviceRow = {
  app_id: ManagedAppId;
  device_id: string;
  display_code: string;
  public_key_jwk: string;
  status: ManagedAppDeviceStatus;
  label: string | null;
  device_class: ManagedDeviceClass;
  os_name: string;
  browser_name: string;
  model_hint: string | null;
  screen: string | null;
  created_at: string;
  approved_at: string | null;
  blocked_at: string | null;
  last_seen_at: string;
  approved_by: string | null;
};

export class ManagedAppDeviceError extends Error {
  status: number;
  code: string;
  device?: ManagedAppDevice;

  constructor(message: string, status: number, code: string, device?: ManagedAppDevice) {
    super(message);
    this.status = status;
    this.code = code;
    this.device = device;
  }
}

let tablesReady: Promise<void> | null = null;

async function ensureTables() {
  if (tablesReady) return tablesReady;
  tablesReady = (async () => {
    const database = await getControlDatabase();
    await database.batch([
      database.prepare(`CREATE TABLE IF NOT EXISTS managed_app_devices (
        app_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        display_code TEXT NOT NULL,
        public_key_jwk TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        label TEXT,
        device_class TEXT NOT NULL DEFAULT 'unknown',
        os_name TEXT NOT NULL DEFAULT 'Unknown',
        browser_name TEXT NOT NULL DEFAULT 'Unknown',
        model_hint TEXT,
        screen TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        approved_at TEXT,
        blocked_at TEXT,
        last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        approved_by TEXT,
        PRIMARY KEY (app_id, device_id)
      )`),
      database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS managed_app_devices_code_unique ON managed_app_devices(display_code)"),
      database.prepare("CREATE INDEX IF NOT EXISTS managed_app_devices_app_status_idx ON managed_app_devices(app_id, status, created_at)"),
      database.prepare(`CREATE TABLE IF NOT EXISTS managed_app_challenges (
        nonce TEXT PRIMARY KEY NOT NULL,
        app_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      database.prepare("CREATE INDEX IF NOT EXISTS managed_app_challenges_device_idx ON managed_app_challenges(app_id, device_id, expires_at)"),
    ]);
  })().catch((error) => {
    tablesReady = null;
    throw error;
  });
  return tablesReady;
}

function assertAppId(value: unknown): ManagedAppId {
  if (value === "hoa-nhap-nga") return value;
  throw new ManagedAppDeviceError("Ứng dụng không hợp lệ.", 400, "INVALID_APP_ID");
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length > 256) throw new ManagedAppDeviceError("Chữ ký thiết bị không hợp lệ.", 400, "INVALID_DEVICE_SIGNATURE");
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  try { return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0)); }
  catch { throw new ManagedAppDeviceError("Chữ ký thiết bị không hợp lệ.", 400, "INVALID_DEVICE_SIGNATURE"); }
}

function publicKeyShape(value: unknown): JsonWebKey {
  if (!value || typeof value !== "object") throw new ManagedAppDeviceError("Khóa thiết bị không hợp lệ.", 400, "INVALID_DEVICE_KEY");
  const source = value as Record<string, unknown>;
  const x = typeof source.x === "string" ? source.x : "";
  const y = typeof source.y === "string" ? source.y : "";
  if (source.kty !== "EC" || source.crv !== "P-256" || !/^[A-Za-z0-9_-]{42,44}$/.test(x) || !/^[A-Za-z0-9_-]{42,44}$/.test(y)) {
    throw new ManagedAppDeviceError("Khóa thiết bị không hợp lệ.", 400, "INVALID_DEVICE_KEY");
  }
  return { kty: "EC", crv: "P-256", x, y, ext: true, key_ops: ["verify"] };
}

function canonicalKey(value: JsonWebKey) {
  return JSON.stringify({ kty: value.kty, crv: value.crv, x: value.x, y: value.y });
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, "0")).join("");
}

function deviceCodeFor(appId: ManagedAppId, deviceId: string) {
  const prefix = appId === "hoa-nhap-nga" ? "HN" : "APP";
  return `${prefix}-${deviceId.slice(0, 4)}-${deviceId.slice(4, 8)}-${deviceId.slice(8, 12)}-${deviceId.slice(12, 16)}`.toUpperCase();
}

function clean(value: unknown, max = 120) {
  return typeof value === "string" ? value.trim().replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, max) : "";
}

function inferProfile(userAgent: string, provided: unknown) {
  const source = provided && typeof provided === "object" ? provided as Record<string, unknown> : {};
  const ua = userAgent.slice(0, 500);
  let deviceClass: ManagedDeviceClass = "unknown";
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) deviceClass = "tablet";
  else if (/iPhone|Android.*Mobile|Mobile/i.test(ua)) deviceClass = "phone";
  else if (/Windows|Macintosh|CrOS|Linux/i.test(ua)) deviceClass = "computer";

  let osName = "Unknown";
  if (/Windows NT/i.test(ua)) osName = "Windows";
  else if (/CrOS/i.test(ua)) osName = "ChromeOS";
  else if (/iPad|iPhone|iPod/i.test(ua)) osName = "iOS/iPadOS";
  else if (/Android/i.test(ua)) osName = "Android";
  else if (/Macintosh|Mac OS X/i.test(ua)) osName = "macOS";
  else if (/Linux/i.test(ua)) osName = "Linux";

  let browserName = "Unknown";
  if (/Edg\//i.test(ua)) browserName = "Microsoft Edge";
  else if (/OPR\//i.test(ua)) browserName = "Opera";
  else if (/Chrome\//i.test(ua) || /CriOS\//i.test(ua)) browserName = "Google Chrome";
  else if (/Firefox\//i.test(ua) || /FxiOS\//i.test(ua)) browserName = "Firefox";
  else if (/Safari\//i.test(ua)) browserName = "Safari";

  const hintedClass = clean(source.deviceClass, 30);
  if (["computer", "phone", "tablet", "unknown"].includes(hintedClass)) deviceClass = hintedClass as ManagedDeviceClass;
  const hintedOs = clean(source.osName, 80);
  const hintedBrowser = clean(source.browserName, 80);
  const modelHint = clean(source.modelHint, 100) || (() => {
    const android = ua.match(/Android[^;]*;\s*([^;)]+?)(?:\s+Build\/|;|\))/i)?.[1]?.trim();
    if (android) return android.slice(0, 100);
    if (/iPhone/i.test(ua)) return "iPhone";
    if (/iPad/i.test(ua)) return "iPad";
    return "";
  })();
  const screen = clean(source.screen, 40);

  return {
    deviceClass,
    osName: hintedOs || osName,
    browserName: hintedBrowser || browserName,
    modelHint: modelHint || null,
    screen: screen || null,
  };
}

function publicState(row: DeviceRow): ManagedAppDevice {
  const lastSeen = Date.parse(row.last_seen_at);
  return {
    appId: row.app_id,
    deviceId: row.device_id,
    deviceCode: row.display_code,
    status: row.status,
    label: row.label,
    deviceClass: row.device_class,
    osName: row.os_name,
    browserName: row.browser_name,
    modelHint: row.model_hint,
    screen: row.screen,
    createdAt: row.created_at,
    approvedAt: row.approved_at,
    blockedAt: row.blocked_at,
    lastSeenAt: row.last_seen_at,
    approvedBy: row.approved_by,
    active: Number.isFinite(lastSeen) && Date.now() - lastSeen < 5 * 60 * 1000,
  };
}

async function rowFor(appId: ManagedAppId, deviceId: string) {
  await ensureTables();
  const database = await getControlDatabase();
  return database.prepare(
    `SELECT app_id, device_id, display_code, public_key_jwk, status, label, device_class, os_name,
            browser_name, model_hint, screen, created_at, approved_at, blocked_at, last_seen_at, approved_by
       FROM managed_app_devices WHERE app_id = ? AND device_id = ?`,
  ).bind(appId, deviceId).first<DeviceRow>();
}

export async function registerManagedAppDevice(appIdValue: unknown, publicKeyValue: unknown, profileValue: unknown, request: Request) {
  const appId = assertAppId(appIdValue);
  const key = publicKeyShape(publicKeyValue);
  const serialized = canonicalKey(key);
  const deviceId = await sha256(serialized);
  const profile = inferProfile(request.headers.get("user-agent") || "", profileValue);
  await ensureTables();
  const database = await getControlDatabase();
  const existing = await rowFor(appId, deviceId);
  if (!existing) {
    await database.prepare(
      `INSERT INTO managed_app_devices
        (app_id, device_id, display_code, public_key_jwk, device_class, os_name, browser_name, model_hint, screen)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(appId, deviceId, deviceCodeFor(appId, deviceId), serialized, profile.deviceClass, profile.osName, profile.browserName, profile.modelHint, profile.screen).run();
  } else if (canonicalKey(publicKeyShape(JSON.parse(existing.public_key_jwk))) !== serialized) {
    throw new ManagedAppDeviceError("Khóa thiết bị không khớp hồ sơ đã đăng ký.", 403, "DEVICE_KEY_MISMATCH");
  } else {
    await database.prepare(
      `UPDATE managed_app_devices SET device_class = ?, os_name = ?, browser_name = ?, model_hint = ?, screen = ?, last_seen_at = CURRENT_TIMESTAMP
        WHERE app_id = ? AND device_id = ?`,
    ).bind(profile.deviceClass, profile.osName, profile.browserName, profile.modelHint, profile.screen, appId, deviceId).run();
  }
  const created = await rowFor(appId, deviceId);
  if (!created) throw new ManagedAppDeviceError("Không thể tạo hồ sơ thiết bị Hòa nhập Nga.", 500, "DEVICE_CREATE_FAILED");
  return publicState(created);
}

export async function createManagedAppChallenge(appIdValue: unknown, deviceIdValue: unknown) {
  const appId = assertAppId(appIdValue);
  const deviceId = typeof deviceIdValue === "string" ? deviceIdValue : "";
  if (!/^[a-f0-9]{64}$/.test(deviceId)) throw new ManagedAppDeviceError("Mã thiết bị không hợp lệ.", 400, "INVALID_DEVICE");
  const row = await rowFor(appId, deviceId);
  if (!row) throw new ManagedAppDeviceError("Thiết bị chưa đăng ký.", 404, "DEVICE_NOT_FOUND");
  const state = publicState(row);
  if (row.status !== "approved") {
    throw new ManagedAppDeviceError(row.status === "blocked" ? "Thiết bị đã bị Site Quản trị khóa." : "Thiết bị đang chờ Site Quản trị cấp quyền.", 403, row.status === "blocked" ? "DEVICE_BLOCKED" : "DEVICE_PENDING", state);
  }
  const nonce = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const expiresAt = Date.now() + 2 * 60 * 1000;
  const database = await getControlDatabase();
  await database.batch([
    database.prepare("DELETE FROM managed_app_challenges WHERE expires_at < ?").bind(Date.now()),
    database.prepare("INSERT INTO managed_app_challenges (nonce, app_id, device_id, expires_at) VALUES (?, ?, ?, ?)").bind(nonce, appId, deviceId, expiresAt),
    database.prepare(`DELETE FROM managed_app_challenges
      WHERE app_id = ? AND device_id = ? AND nonce NOT IN (
        SELECT nonce FROM managed_app_challenges WHERE app_id = ? AND device_id = ? ORDER BY rowid DESC LIMIT 8
      )`).bind(appId, deviceId, appId, deviceId),
  ]);
  return { challenge: nonce, expiresAt, device: state };
}

async function serviceSecret() {
  const workers = await import("cloudflare:workers");
  const value = (workers.env as unknown as Record<string, unknown>).MEDICINE_SERVICE_SECRET;
  if (typeof value !== "string" || value.length < 32) throw new ManagedAppDeviceError("Kết nối Hòa nhập Nga chưa được cấu hình.", 503, "APP_SERVICE_SECRET_UNAVAILABLE");
  return value;
}

async function signHmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

export async function authorizeManagedAppDevice(payload: Record<string, unknown>) {
  const appId = assertAppId(payload.appId);
  const deviceId = typeof payload.deviceId === "string" ? payload.deviceId : "";
  const challenge = typeof payload.challenge === "string" ? payload.challenge : "";
  const signature = typeof payload.signature === "string" ? payload.signature : "";
  if (!/^[a-f0-9]{64}$/.test(deviceId) || !/^[A-Za-z0-9_-]{40,100}$/.test(challenge)) throw new ManagedAppDeviceError("Bằng chứng thiết bị không hợp lệ.", 400, "INVALID_DEVICE_PROOF");
  const row = await rowFor(appId, deviceId);
  if (!row) throw new ManagedAppDeviceError("Thiết bị chưa đăng ký.", 404, "DEVICE_NOT_FOUND");
  const state = publicState(row);
  if (row.status !== "approved") throw new ManagedAppDeviceError(row.status === "blocked" ? "Thiết bị đã bị Site Quản trị khóa." : "Thiết bị đang chờ Site Quản trị cấp quyền.", 403, row.status === "blocked" ? "DEVICE_BLOCKED" : "DEVICE_PENDING", state);
  const database = await getControlDatabase();
  const proof = await database.prepare("SELECT expires_at FROM managed_app_challenges WHERE nonce = ? AND app_id = ? AND device_id = ?")
    .bind(challenge, appId, deviceId).first<{ expires_at: number }>();
  await database.prepare("DELETE FROM managed_app_challenges WHERE nonce = ? AND app_id = ? AND device_id = ?").bind(challenge, appId, deviceId).run();
  if (!proof || proof.expires_at < Date.now()) throw new ManagedAppDeviceError("Phiên xác thực thiết bị đã hết hạn.", 401, "DEVICE_PROOF_EXPIRED");

  const publicKey = publicKeyShape(JSON.parse(row.public_key_jwk));
  const key = await crypto.subtle.importKey("jwk", publicKey, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  const message = new TextEncoder().encode(`managed-app:${appId}:${deviceId}:${challenge}`);
  const valid = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, fromBase64Url(signature), message);
  if (!valid) throw new ManagedAppDeviceError("Thiết bị không khớp quyền đã cấp.", 403, "DEVICE_MISMATCH", state);

  await database.prepare("UPDATE managed_app_devices SET last_seen_at = CURRENT_TIMESTAMP WHERE app_id = ? AND device_id = ?").bind(appId, deviceId).run();
  const expiresAt = Date.now() + 15 * 60 * 1000;
  const body = base64Url(new TextEncoder().encode(JSON.stringify({
    v: 1,
    iss: "quan-ly-hoc-tap",
    aud: "hoa-nhap-nga-device",
    appId,
    deviceId,
    deviceCode: row.display_code,
    exp: expiresAt,
  })));
  const signedInput = `v1.${body}`;
  const secret = await serviceSecret();
  const accessToken = `${signedInput}.${await signHmac(secret, signedInput)}`;
  return { device: { ...state, lastSeenAt: new Date().toISOString(), active: true }, accessToken, expiresAt };
}

export async function listManagedAppDevices(appIdValue: unknown) {
  const appId = assertAppId(appIdValue);
  await ensureTables();
  const database = await getControlDatabase();
  const result = await database.prepare(
    `SELECT app_id, device_id, display_code, public_key_jwk, status, label, device_class, os_name,
            browser_name, model_hint, screen, created_at, approved_at, blocked_at, last_seen_at, approved_by
       FROM managed_app_devices WHERE app_id = ?
       ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, created_at DESC`,
  ).bind(appId).all<DeviceRow>();
  return result.results.map(publicState);
}

export async function updateManagedAppDevice(input: {
  appId: unknown;
  deviceId: unknown;
  status?: unknown;
  label?: unknown;
  actor: string;
}) {
  const appId = assertAppId(input.appId);
  const deviceId = typeof input.deviceId === "string" ? input.deviceId : "";
  if (!/^[a-f0-9]{64}$/.test(deviceId)) throw new ManagedAppDeviceError("Mã thiết bị không hợp lệ.", 400, "INVALID_DEVICE");
  const existing = await rowFor(appId, deviceId);
  if (!existing) throw new ManagedAppDeviceError("Không tìm thấy thiết bị.", 404, "DEVICE_NOT_FOUND");
  const status = typeof input.status === "string" && ["pending", "approved", "blocked"].includes(input.status)
    ? input.status as ManagedAppDeviceStatus
    : existing.status;
  const label = input.label === undefined ? existing.label : (clean(input.label, 120) || null);
  const database = await getControlDatabase();
  await database.prepare(
    `UPDATE managed_app_devices SET status = ?, label = ?,
      approved_at = CASE WHEN ? = 'approved' THEN COALESCE(approved_at, CURRENT_TIMESTAMP) ELSE approved_at END,
      approved_by = CASE WHEN ? = 'approved' THEN ? ELSE approved_by END,
      blocked_at = CASE WHEN ? = 'blocked' THEN CURRENT_TIMESTAMP WHEN ? <> 'blocked' THEN NULL ELSE blocked_at END
     WHERE app_id = ? AND device_id = ?`,
  ).bind(status, label, status, status, input.actor, status, status, appId, deviceId).run();
  await database.prepare(
    "INSERT INTO control_audit_log (actor, action, target, detail_json) VALUES (?, ?, ?, ?)",
  ).bind(input.actor, "managed_app_device.updated", `${appId}:${deviceId}`, JSON.stringify({ status, label })).run();
  const updated = await rowFor(appId, deviceId);
  if (!updated) throw new ManagedAppDeviceError("Không thể cập nhật thiết bị.", 500, "DEVICE_UPDATE_FAILED");
  return publicState(updated);
}

export function managedAppDeviceErrorResponse(error: unknown, headers?: HeadersInit) {
  const baseHeaders = { "cache-control": "no-store, private", "x-content-type-options": "nosniff", ...(headers || {}) };
  if (error instanceof ManagedAppDeviceError) {
    return Response.json({ error: error.message, code: error.code, device: error.device }, { status: error.status, headers: baseHeaders });
  }
  return Response.json({ error: "Dịch vụ cấp quyền thiết bị đang tạm gián đoạn.", code: "DEVICE_SERVICE_ERROR" }, { status: 500, headers: baseHeaders });
}
