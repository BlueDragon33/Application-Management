import { getControlDatabase, type ControlRole } from "./control-device.server";

export type RuDeviceStatus = "pending" | "approved" | "blocked";
export type RuDeviceClass = "computer" | "phone" | "tablet" | "unknown";

type RuDeviceRow = {
  device_id: string;
  display_code: string;
  public_key_jwk: string;
  status: RuDeviceStatus;
  user_name: string | null;
  user_code: string | null;
  label: string | null;
  device_class: RuDeviceClass;
  detected_device_class: RuDeviceClass;
  device_class_override: RuDeviceClass | null;
  device_class_override_by: string | null;
  device_class_override_at: string | null;
  classification_confidence: number;
  classification_source: string | null;
  os_name: string | null;
  browser_name: string | null;
  model_hint: string | null;
  screen: string | null;
  profile_json: string;
  edit_enabled: number;
  created_at: string;
  approved_at: string | null;
  blocked_at: string | null;
  last_seen_at: string;
  approved_by: string | null;
  updated_at: string;
};

type SessionRow = {
  session_id: string;
  device_id: string;
  status: "active" | "revoked" | "expired";
  expires_at: number;
  created_at: string;
  last_seen_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
  revoke_reason: string | null;
  display_code: string;
  user_name: string | null;
  user_code: string | null;
  device_class: RuDeviceClass;
};

type TokenClaims = {
  v: 1;
  iss: "application-management";
  aud: "hoa-nhap-nga-device";
  appId: "hoa-nhap-nga";
  deviceId: string;
  deviceCode: string;
  jti: string;
  editEnabled: boolean;
  exp: number;
};

export class RuLifeAccessError extends Error {
  status: number;
  code: string;
  device?: ReturnType<typeof publicDevice>;
  constructor(message: string, status: number, code: string, device?: ReturnType<typeof publicDevice>) {
    super(message);
    this.status = status;
    this.code = code;
    this.device = device;
  }
}

function text(value: unknown, max = 160) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length > 4096) throw new RuLifeAccessError("Dữ liệu chữ ký không hợp lệ.", 400, "INVALID_SIGNATURE");
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  try { return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0)); }
  catch { throw new RuLifeAccessError("Dữ liệu chữ ký không hợp lệ.", 400, "INVALID_SIGNATURE"); }
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, "0")).join("");
}

function publicKeyShape(value: unknown): JsonWebKey {
  if (!value || typeof value !== "object") throw new RuLifeAccessError("Khóa thiết bị không hợp lệ.", 400, "INVALID_DEVICE_KEY");
  const source = value as Record<string, unknown>;
  const x = text(source.x, 60);
  const y = text(source.y, 60);
  if (source.kty !== "EC" || source.crv !== "P-256" || !/^[A-Za-z0-9_-]{42,44}$/.test(x) || !/^[A-Za-z0-9_-]{42,44}$/.test(y)) {
    throw new RuLifeAccessError("Khóa thiết bị không hợp lệ.", 400, "INVALID_DEVICE_KEY");
  }
  return { kty: "EC", crv: "P-256", x, y, ext: true, key_ops: ["verify"] };
}

function canonicalKey(value: JsonWebKey) {
  return JSON.stringify({ kty: value.kty, crv: value.crv, x: value.x, y: value.y });
}

function displayCodeFor(deviceId: string) {
  return `HN-${deviceId.slice(0, 4)}-${deviceId.slice(4, 8)}-${deviceId.slice(8, 12)}-${deviceId.slice(12, 16)}`.toUpperCase();
}

function classifyProfile(profileValue: unknown): { deviceClass: RuDeviceClass; confidence: number; source: string; profile: Record<string, unknown> } {
  const profile = profileValue && typeof profileValue === "object" ? profileValue as Record<string, unknown> : {};
  const ua = text(profile.userAgent, 500).toLowerCase();
  const platform = text(profile.platformHint, 100).toLowerCase();
  const model = text(profile.modelHint, 100).toLowerCase();
  const touchPoints = Math.max(0, Math.min(20, Number(profile.touchPoints) || 0));
  const coarsePointer = profile.coarsePointer === true;
  const mobileHint = profile.mobileHint === true;
  const screen = text(profile.screen, 60);
  const screenMatch = screen.match(/^(\d{2,5})x(\d{2,5})/i);
  const shortSide = screenMatch ? Math.min(Number(screenMatch[1]), Number(screenMatch[2])) : 0;

  if (ua.includes("ipad") || model.includes("ipad") || (platform.includes("mac") && touchPoints > 1)) {
    return { deviceClass: "tablet", confidence: 98, source: "ipad-signal", profile };
  }
  if (ua.includes("iphone") || ua.includes("ipod") || model.includes("iphone")) {
    return { deviceClass: "phone", confidence: 99, source: "iphone-signal", profile };
  }
  if (ua.includes("android")) {
    if (ua.includes("mobile") || mobileHint) return { deviceClass: "phone", confidence: 96, source: "android-mobile", profile };
    return { deviceClass: "tablet", confidence: 94, source: "android-tablet", profile };
  }
  if (mobileHint && touchPoints > 0) {
    return shortSide >= 600
      ? { deviceClass: "tablet", confidence: 82, source: "mobile-hint-large-touch", profile }
      : { deviceClass: "phone", confidence: 90, source: "mobile-hint", profile };
  }
  if ((ua.includes("windows") || ua.includes("macintosh") || ua.includes("linux") || ua.includes("cros") || /windows|mac|linux|chrome os/.test(platform)) && !mobileHint) {
    return { deviceClass: "computer", confidence: 94, source: "desktop-platform", profile };
  }
  if (coarsePointer && touchPoints > 0 && shortSide > 0) {
    return shortSide >= 600
      ? { deviceClass: "tablet", confidence: 72, source: "touch-screen-size", profile }
      : { deviceClass: "phone", confidence: 70, source: "touch-screen-size", profile };
  }
  return { deviceClass: "unknown", confidence: 30, source: "insufficient-signals", profile };
}

function publicDevice(row: RuDeviceRow) {
  const lastSeen = Date.parse(row.last_seen_at);
  const active = row.status === "approved" && Number.isFinite(lastSeen) && Date.now() - lastSeen <= 150_000;
  return {
    appId: "hoa-nhap-nga" as const,
    deviceId: row.device_id,
    deviceCode: row.display_code,
    status: row.status,
    userName: row.user_name,
    userCode: row.user_code,
    label: row.label,
    deviceClass: row.device_class,
    detectedDeviceClass: row.detected_device_class,
    deviceClassOverride: row.device_class_override,
    deviceClassOverrideBy: row.device_class_override_by,
    deviceClassOverrideAt: row.device_class_override_at,
    classificationConfidence: row.classification_confidence,
    classificationSource: row.classification_source,
    osName: row.os_name ?? "Unknown",
    browserName: row.browser_name ?? "Unknown",
    modelHint: row.model_hint,
    screen: row.screen,
    editEnabled: row.edit_enabled === 1,
    createdAt: row.created_at,
    approvedAt: row.approved_at,
    blockedAt: row.blocked_at,
    lastSeenAt: row.last_seen_at,
    approvedBy: row.approved_by,
    active,
    offlineSinceAt: active || !Number.isFinite(lastSeen) ? null : new Date(lastSeen + 150_000).toISOString(),
  };
}

async function deviceRow(deviceId: string) {
  const database = await getControlDatabase();
  return database.prepare("SELECT * FROM ru_life_devices WHERE device_id = ?").bind(deviceId).first<RuDeviceRow>();
}

async function audit(actor: string, action: string, target: string, detail: Record<string, unknown> = {}) {
  const database = await getControlDatabase();
  await database.prepare("INSERT INTO ru_life_audit_log (actor, action, target, detail_json) VALUES (?, ?, ?, ?)")
    .bind(text(actor, 160) || "system", text(action, 120), text(target, 200), JSON.stringify(detail)).run();
}

export async function registerRuLifeDevice(publicKey: unknown, profileValue: unknown) {
  const key = publicKeyShape(publicKey);
  const serialized = canonicalKey(key);
  const deviceId = await sha256(serialized);
  const classification = classifyProfile(profileValue);
  const profile = classification.profile;
  const database = await getControlDatabase();
  const existing = await deviceRow(deviceId);
  const osName = text(profile.osName, 80) || null;
  const browserName = text(profile.browserName, 80) || null;
  const modelHint = text(profile.modelHint, 100) || null;
  const screen = text(profile.screen, 60) || null;
  if (existing) {
    await database.prepare(
      `UPDATE ru_life_devices SET
        detected_device_class = ?,
        device_class = CASE WHEN device_class_override IS NULL THEN ? ELSE device_class END,
        classification_confidence = ?, classification_source = ?, os_name = ?, browser_name = ?, model_hint = ?, screen = ?,
        profile_json = ?, last_seen_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE device_id = ?`,
    ).bind(
      classification.deviceClass, classification.deviceClass, classification.confidence, classification.source,
      osName, browserName, modelHint, screen, JSON.stringify(profile), deviceId,
    ).run();
  } else {
    await database.prepare(
      `INSERT INTO ru_life_devices
        (device_id, display_code, public_key_jwk, detected_device_class, device_class, classification_confidence,
         classification_source, os_name, browser_name, model_hint, screen, profile_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      deviceId, displayCodeFor(deviceId), serialized, classification.deviceClass, classification.deviceClass,
      classification.confidence, classification.source, osName, browserName, modelHint, screen, JSON.stringify(profile),
    ).run();
    await audit("system", "device_registered", deviceId, { deviceCode: displayCodeFor(deviceId), detectedDeviceClass: classification.deviceClass });
  }
  const row = await deviceRow(deviceId);
  if (!row) throw new RuLifeAccessError("Không thể tạo hồ sơ thiết bị Hòa nhập Nga.", 500, "DEVICE_CREATE_FAILED");
  return publicDevice(row);
}

export async function createRuLifeChallenge(deviceIdValue: unknown) {
  const deviceId = text(deviceIdValue, 80).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(deviceId)) throw new RuLifeAccessError("Mã thiết bị không hợp lệ.", 400, "INVALID_DEVICE");
  const row = await deviceRow(deviceId);
  if (!row) throw new RuLifeAccessError("Không tìm thấy thiết bị Hòa nhập Nga.", 404, "DEVICE_NOT_FOUND");
  const device = publicDevice(row);
  if (row.status !== "approved") throw new RuLifeAccessError(row.status === "blocked" ? "Thiết bị đã bị khóa." : "Thiết bị đang chờ cấp quyền.", 403, row.status === "blocked" ? "DEVICE_BLOCKED" : "DEVICE_PENDING", device);
  if (!row.user_name || !row.user_code) throw new RuLifeAccessError("Thiết bị chưa được gắn người sử dụng.", 409, "DEVICE_USER_REQUIRED", device);
  const nonce = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const expiresAt = Date.now() + 120_000;
  const database = await getControlDatabase();
  await database.batch([
    database.prepare("DELETE FROM ru_life_challenges WHERE expires_at < ?").bind(Date.now()),
    database.prepare("INSERT INTO ru_life_challenges (nonce, device_id, expires_at) VALUES (?, ?, ?)").bind(nonce, deviceId, expiresAt),
    database.prepare(`DELETE FROM ru_life_challenges WHERE device_id = ? AND nonce NOT IN (
      SELECT nonce FROM ru_life_challenges WHERE device_id = ? ORDER BY rowid DESC LIMIT 8
    )`).bind(deviceId, deviceId),
  ]);
  return { challenge: nonce, expiresAt, device };
}

async function serviceSecret() {
  const workers = await import("cloudflare:workers");
  const values = workers.env as unknown as Record<string, unknown>;
  const secret = typeof values.RU_LIFE_CONTROL_SERVICE_SECRET === "string" ? values.RU_LIFE_CONTROL_SERVICE_SECRET : "";
  if (secret.length < 32) throw new RuLifeAccessError("Secret Hòa nhập Nga chưa được cấu hình.", 503, "RU_LIFE_SECRET_UNAVAILABLE");
  return secret;
}

async function hmacSignature(secret: string, value: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

async function verifyTokenSignature(secret: string, signedInput: string, signature: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  return crypto.subtle.verify("HMAC", key, fromBase64Url(signature), new TextEncoder().encode(signedInput));
}

export async function authorizeRuLifeDevice(payload: Record<string, unknown>) {
  const deviceId = text(payload.deviceId, 80).toLowerCase();
  const challenge = text(payload.challenge, 160);
  const signature = text(payload.signature, 256);
  if (!/^[a-f0-9]{64}$/.test(deviceId) || !/^[A-Za-z0-9_-]{40,160}$/.test(challenge) || !signature) {
    throw new RuLifeAccessError("Bằng chứng thiết bị không hợp lệ.", 400, "INVALID_DEVICE_PROOF");
  }
  const row = await deviceRow(deviceId);
  if (!row) throw new RuLifeAccessError("Không tìm thấy thiết bị.", 404, "DEVICE_NOT_FOUND");
  const device = publicDevice(row);
  if (row.status !== "approved") throw new RuLifeAccessError(row.status === "blocked" ? "Thiết bị đã bị khóa." : "Thiết bị đang chờ cấp quyền.", 403, row.status === "blocked" ? "DEVICE_BLOCKED" : "DEVICE_PENDING", device);
  const database = await getControlDatabase();
  const proof = await database.prepare("SELECT expires_at FROM ru_life_challenges WHERE nonce = ? AND device_id = ?").bind(challenge, deviceId).first<{ expires_at: number }>();
  await database.prepare("DELETE FROM ru_life_challenges WHERE nonce = ? AND device_id = ?").bind(challenge, deviceId).run();
  if (!proof || proof.expires_at < Date.now()) throw new RuLifeAccessError("Challenge đã hết hạn.", 401, "DEVICE_PROOF_EXPIRED", device);
  const key = await crypto.subtle.importKey("jwk", publicKeyShape(JSON.parse(row.public_key_jwk)), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  const message = new TextEncoder().encode(`managed-app:hoa-nhap-nga:${deviceId}:${challenge}`);
  const valid = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, fromBase64Url(signature), message);
  if (!valid) throw new RuLifeAccessError("Thiết bị không khớp khóa đã đăng ký.", 403, "DEVICE_MISMATCH", device);

  const secret = await serviceSecret();
  const expiresAt = Date.now() + 15 * 60 * 1000;
  const sessionId = base64Url(crypto.getRandomValues(new Uint8Array(24)));
  const claims: TokenClaims = {
    v: 1,
    iss: "application-management",
    aud: "hoa-nhap-nga-device",
    appId: "hoa-nhap-nga",
    deviceId,
    deviceCode: row.display_code,
    jti: sessionId,
    editEnabled: row.edit_enabled === 1,
    exp: expiresAt,
  };
  const encoded = base64Url(new TextEncoder().encode(JSON.stringify(claims)));
  const signedInput = `v1.${encoded}`;
  const accessToken = `${signedInput}.${await hmacSignature(secret, signedInput)}`;
  await database.batch([
    database.prepare("UPDATE ru_life_devices SET last_seen_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE device_id = ?").bind(deviceId),
    database.prepare("INSERT INTO ru_life_sessions (session_id, device_id, status, expires_at) VALUES (?, ?, 'active', ?)").bind(sessionId, deviceId, expiresAt),
  ]);
  await audit("system", "session_issued", sessionId, { deviceId, deviceCode: row.display_code });
  return { accessToken, expiresAt, device: publicDevice({ ...row, last_seen_at: new Date().toISOString() }) };
}

export async function verifyRuLifeAccessToken(tokenValue: unknown, touch = true) {
  const token = text(tokenValue, 8192);
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") throw new RuLifeAccessError("Access token không hợp lệ.", 401, "INVALID_ACCESS_TOKEN");
  const secret = await serviceSecret();
  const signedInput = `${parts[0]}.${parts[1]}`;
  if (!(await verifyTokenSignature(secret, signedInput, parts[2]))) throw new RuLifeAccessError("Chữ ký access token không hợp lệ.", 401, "INVALID_ACCESS_SIGNATURE");
  let claims: Partial<TokenClaims>;
  try { claims = JSON.parse(new TextDecoder().decode(fromBase64Url(parts[1]))) as Partial<TokenClaims>; }
  catch { throw new RuLifeAccessError("Access token không hợp lệ.", 401, "INVALID_ACCESS_CLAIMS"); }
  if (
    claims.v !== 1 || claims.iss !== "application-management" || claims.aud !== "hoa-nhap-nga-device" || claims.appId !== "hoa-nhap-nga"
    || typeof claims.deviceId !== "string" || !/^[a-f0-9]{64}$/.test(claims.deviceId)
    || typeof claims.deviceCode !== "string" || !/^HN-[A-F0-9-]+$/.test(claims.deviceCode)
    || typeof claims.jti !== "string" || !/^[A-Za-z0-9_-]{24,80}$/.test(claims.jti)
    || typeof claims.exp !== "number" || claims.exp <= Date.now() || claims.exp > Date.now() + 20 * 60 * 1000
  ) throw new RuLifeAccessError("Access token đã hết hạn hoặc sai phạm vi.", 401, "INVALID_ACCESS_CLAIMS");

  const database = await getControlDatabase();
  const session = await database.prepare(
    `SELECT s.status, s.expires_at, d.status AS device_status FROM ru_life_sessions s
     JOIN ru_life_devices d ON d.device_id = s.device_id WHERE s.session_id = ? AND s.device_id = ?`,
  ).bind(claims.jti, claims.deviceId).first<{ status: string; expires_at: number; device_status: string }>();
  if (!session || session.status !== "active" || session.device_status !== "approved" || session.expires_at <= Date.now()) {
    throw new RuLifeAccessError("Phiên Hòa nhập Nga đã bị thu hồi hoặc hết hạn.", 403, "SESSION_REVOKED");
  }
  if (touch) {
    await database.batch([
      database.prepare("UPDATE ru_life_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE session_id = ?").bind(claims.jti),
      database.prepare("UPDATE ru_life_devices SET last_seen_at = CURRENT_TIMESTAMP WHERE device_id = ?").bind(claims.deviceId),
    ]);
  }
  return claims as TokenClaims;
}

export async function listRuLifeDevices() {
  const database = await getControlDatabase();
  const rows = await database.prepare("SELECT * FROM ru_life_devices ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, last_seen_at DESC LIMIT 400").all<RuDeviceRow>();
  return rows.results.map(publicDevice);
}

export async function listRuLifeSessions() {
  const database = await getControlDatabase();
  await database.prepare("UPDATE ru_life_sessions SET status = 'expired' WHERE status = 'active' AND expires_at <= ?").bind(Date.now()).run();
  const rows = await database.prepare(
    `SELECT s.session_id, s.device_id, s.status, s.expires_at, s.created_at, s.last_seen_at, s.revoked_at, s.revoked_by, s.revoke_reason,
            d.display_code, d.user_name, d.user_code, d.device_class
       FROM ru_life_sessions s JOIN ru_life_devices d ON d.device_id = s.device_id
      ORDER BY s.created_at DESC LIMIT 300`,
  ).all<SessionRow>();
  return rows.results.map((row) => ({
    sessionId: row.session_id,
    deviceId: row.device_id,
    deviceCode: row.display_code,
    userName: row.user_name,
    userCode: row.user_code,
    deviceClass: row.device_class,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    revokedAt: row.revoked_at,
    revokedBy: row.revoked_by,
    revokeReason: row.revoke_reason,
    active: row.status === "active" && row.expires_at > Date.now(),
  }));
}

export async function listRuLifeAudit() {
  const database = await getControlDatabase();
  const rows = await database.prepare("SELECT id, actor, action, target, detail_json, created_at FROM ru_life_audit_log ORDER BY id DESC LIMIT 200")
    .all<{ id: number; actor: string; action: string; target: string; detail_json: string; created_at: string }>();
  return rows.results.map((row) => {
    let detail: Record<string, unknown> = {};
    try { detail = JSON.parse(row.detail_json) as Record<string, unknown>; } catch { detail = {}; }
    return { id: `ru-${row.id}`, actor: row.actor, action: row.action, target: row.target, detail, createdAt: row.created_at };
  });
}

export async function manageRuLifeDevice(actor: string, role: ControlRole, payload: Record<string, unknown>) {
  if (role !== "publisher" && role !== "owner") throw new RuLifeAccessError("Không có quyền thay đổi thiết bị Hòa nhập Nga.", 403, "PUBLISHER_REQUIRED");
  const deviceId = text(payload.targetDeviceId, 80).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(deviceId)) throw new RuLifeAccessError("Mã thiết bị không hợp lệ.", 400, "INVALID_DEVICE");
  const current = await deviceRow(deviceId);
  if (!current) throw new RuLifeAccessError("Không tìm thấy thiết bị Hòa nhập Nga.", 404, "DEVICE_NOT_FOUND");
  const action = text(payload.operation, 60);
  const database = await getControlDatabase();

  if (action === "approve") {
    const userName = text(payload.userName, 120);
    const userCode = text(payload.userCode, 80);
    if (!userName || !userCode) throw new RuLifeAccessError("Phải gắn Họ tên và Mã người dùng trước khi cấp quyền.", 400, "USER_BINDING_REQUIRED");
    await database.prepare(`UPDATE ru_life_devices SET status='approved', user_name=?, user_code=?, approved_at=CURRENT_TIMESTAMP,
      blocked_at=NULL, approved_by=?, updated_at=CURRENT_TIMESTAMP WHERE device_id=?`)
      .bind(userName, userCode, actor, deviceId).run();
    await audit(actor, "device_approved", deviceId, { deviceCode: current.display_code, userName, userCode });
  } else if (action === "block") {
    await database.batch([
      database.prepare("UPDATE ru_life_devices SET status='blocked', blocked_at=CURRENT_TIMESTAMP, edit_enabled=0, updated_at=CURRENT_TIMESTAMP WHERE device_id=?").bind(deviceId),
      database.prepare("UPDATE ru_life_sessions SET status='revoked', revoked_at=CURRENT_TIMESTAMP, revoked_by=?, revoke_reason='Thiết bị bị khóa' WHERE device_id=? AND status='active'").bind(actor, deviceId),
    ]);
    await audit(actor, "device_blocked", deviceId, { deviceCode: current.display_code });
  } else if (action === "unblock") {
    await database.prepare("UPDATE ru_life_devices SET status='approved', blocked_at=NULL, approved_at=COALESCE(approved_at,CURRENT_TIMESTAMP), updated_at=CURRENT_TIMESTAMP WHERE device_id=?").bind(deviceId).run();
    await audit(actor, "device_unblocked", deviceId, { deviceCode: current.display_code });
  } else if (action === "enable-edit" || action === "disable-edit") {
    if (current.status !== "approved") throw new RuLifeAccessError("Chỉ thiết bị đã được cấp quyền mới có thể thay đổi quyền sửa.", 409, "DEVICE_ACCESS_REQUIRED");
    const enabled = action === "enable-edit";
    await database.prepare("UPDATE ru_life_devices SET edit_enabled=?, updated_at=CURRENT_TIMESTAMP WHERE device_id=?").bind(enabled ? 1 : 0, deviceId).run();
    await audit(actor, enabled ? "device_edit_enabled" : "device_edit_disabled", deviceId, { deviceCode: current.display_code });
  } else if (action === "label") {
    const label = text(payload.label, 100);
    await database.prepare("UPDATE ru_life_devices SET label=?, updated_at=CURRENT_TIMESTAMP WHERE device_id=?").bind(label || null, deviceId).run();
    await audit(actor, "device_label_updated", deviceId, { label });
  } else if (action === "set-device-class") {
    const deviceClass = payload.deviceClass;
    if (!["computer", "phone", "tablet", "unknown"].includes(String(deviceClass))) throw new RuLifeAccessError("Loại thiết bị không hợp lệ.", 400, "INVALID_DEVICE_CLASS");
    await database.prepare(`UPDATE ru_life_devices SET device_class=?, device_class_override=?, device_class_override_by=?,
      device_class_override_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE device_id=?`)
      .bind(deviceClass, deviceClass, actor, deviceId).run();
    await audit(actor, "device_class_overridden", deviceId, { deviceClass });
  } else if (action === "clear-device-class") {
    await database.prepare(`UPDATE ru_life_devices SET device_class=detected_device_class, device_class_override=NULL,
      device_class_override_by=NULL, device_class_override_at=NULL, updated_at=CURRENT_TIMESTAMP WHERE device_id=?`).bind(deviceId).run();
    await audit(actor, "device_class_override_cleared", deviceId, {});
  } else {
    throw new RuLifeAccessError("Thao tác thiết bị Hòa nhập Nga không hợp lệ.", 400, "INVALID_DEVICE_ACTION");
  }
  const updated = await deviceRow(deviceId);
  return updated ? publicDevice(updated) : null;
}

export async function revokeRuLifeSession(actor: string, role: ControlRole, sessionIdValue: unknown) {
  if (role !== "publisher" && role !== "owner") throw new RuLifeAccessError("Không có quyền thu hồi phiên Hòa nhập Nga.", 403, "PUBLISHER_REQUIRED");
  const sessionId = text(sessionIdValue, 100);
  if (!/^[A-Za-z0-9_-]{24,80}$/.test(sessionId)) throw new RuLifeAccessError("Mã phiên không hợp lệ.", 400, "INVALID_SESSION");
  const database = await getControlDatabase();
  const row = await database.prepare("SELECT device_id FROM ru_life_sessions WHERE session_id = ?").bind(sessionId).first<{ device_id: string }>();
  if (!row) throw new RuLifeAccessError("Không tìm thấy phiên.", 404, "SESSION_NOT_FOUND");
  await database.prepare("UPDATE ru_life_sessions SET status='revoked', revoked_at=CURRENT_TIMESTAMP, revoked_by=?, revoke_reason='Thu hồi từ Application Management' WHERE session_id=? AND status='active'")
    .bind(actor, sessionId).run();
  await audit(actor, "session_revoked", sessionId, { deviceId: row.device_id });
}

export function ruLifeErrorResponse(error: unknown) {
  if (error instanceof RuLifeAccessError) {
    return Response.json({ error: error.message, code: error.code, device: error.device }, { status: error.status, headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" } });
  }
  return Response.json({ error: "Dịch vụ Hòa nhập Nga đang tạm gián đoạn.", code: "RU_LIFE_SERVICE_ERROR" }, { status: 500, headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" } });
}
