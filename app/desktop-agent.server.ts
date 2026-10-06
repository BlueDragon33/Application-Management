import { getControlDatabase, type ControlDeviceState } from "./control-device.server";

export const DESKTOP_AGENT_PROTOCOL = "application-management.desktop-agent/v1";
export const PC_MANAGER_IDENTITY = {
  appId: "pc-manager",
  platform: "windows",
  deviceType: "desktop-native",
} as const;

export const DESKTOP_AGENT_COMMANDS = [
  "CHECK_UPDATE",
  "RUN_HEALTH_SCAN",
  "REFRESH_DEVICE_STATUS",
  "DISABLE_LICENSE",
] as const;

export type DesktopAgentCommandType = (typeof DESKTOP_AGENT_COMMANDS)[number];
export type DesktopAgentStatus = "pending" | "approved" | "blocked";
export type DesktopAgentReleaseChannel = "dev" | "beta" | "stable";
export type DesktopAgentEntitlement = "unknown" | "active" | "trial" | "disabled";

type DeviceRow = {
  device_id: string;
  display_code: string;
  public_key_jwk: string;
  app_id: string;
  platform: string;
  device_type: string;
  status: DesktopAgentStatus;
  app_version: string;
  release_channel: DesktopAgentReleaseChannel;
  entitlement_state: DesktopAgentEntitlement;
  update_policy_json: string;
  created_at: string;
  approved_at: string | null;
  blocked_at: string | null;
  last_seen_at: string | null;
};

type CommandRow = {
  command_id: string;
  device_id: string;
  command_type: DesktopAgentCommandType;
  payload_json: string;
  status: "queued" | "delivered" | "completed" | "failed";
  delivery_count: number;
  created_by: string;
  created_at: string;
  delivered_at: string | null;
  completed_at: string | null;
  result_json: string | null;
};

export class DesktopAgentError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length > 256) {
    throw new DesktopAgentError("Chữ ký desktop agent không hợp lệ.", 400, "INVALID_AGENT_SIGNATURE");
  }
  const padded = value
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  try {
    return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  } catch {
    throw new DesktopAgentError("Chữ ký desktop agent không hợp lệ.", 400, "INVALID_AGENT_SIGNATURE");
  }
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((item) => item.toString(16).padStart(2, "0"))
    .join("");
}

function publicKeyShape(value: unknown): JsonWebKey {
  if (!value || typeof value !== "object") {
    throw new DesktopAgentError("Khóa thiết bị không hợp lệ.", 400, "INVALID_AGENT_KEY");
  }
  const source = value as Record<string, unknown>;
  const x = text(source.x);
  const y = text(source.y);
  if (
    source.kty !== "EC" ||
    source.crv !== "P-256" ||
    !/^[A-Za-z0-9_-]{42,44}$/.test(x) ||
    !/^[A-Za-z0-9_-]{42,44}$/.test(y)
  ) {
    throw new DesktopAgentError("Khóa thiết bị không hợp lệ.", 400, "INVALID_AGENT_KEY");
  }
  return { kty: "EC", crv: "P-256", x, y, ext: true, key_ops: ["verify"] };
}

function canonicalKey(value: JsonWebKey) {
  return JSON.stringify({ kty: value.kty, crv: value.crv, x: value.x, y: value.y });
}

function displayCodeFor(deviceId: string) {
  return `PC-${deviceId.slice(0, 4)}-${deviceId.slice(4, 8)}-${deviceId.slice(8, 12)}`.toUpperCase();
}

function releaseChannel(value: unknown): DesktopAgentReleaseChannel {
  return value === "dev" || value === "beta" || value === "stable" ? value : "stable";
}

function appVersion(value: unknown) {
  const version = text(value);
  if (!version || version.length > 64 || !/^[0-9A-Za-z._+-]+$/.test(version)) {
    throw new DesktopAgentError("Phiên bản ứng dụng không hợp lệ.", 400, "INVALID_APP_VERSION");
  }
  return version;
}

function exactIdentity(payload: Record<string, unknown>) {
  if (
    payload.appId !== PC_MANAGER_IDENTITY.appId ||
    payload.platform !== PC_MANAGER_IDENTITY.platform ||
    payload.deviceType !== PC_MANAGER_IDENTITY.deviceType
  ) {
    throw new DesktopAgentError("Desktop agent identity không khớp PC Manager.", 400, "INVALID_AGENT_IDENTITY");
  }
}

function parseJsonObject(value: string | null) {
  try {
    const parsed = JSON.parse(value || "{}");
    return record(parsed);
  } catch {
    return {};
  }
}

function publicDevice(row: DeviceRow) {
  const lastSeenMs = row.last_seen_at ? Date.parse(row.last_seen_at) : Number.NaN;
  const online = Number.isFinite(lastSeenMs) && Date.now() - lastSeenMs <= 120_000;
  return {
    deviceId: row.device_id,
    deviceCode: row.display_code,
    appId: row.app_id,
    platform: row.platform,
    deviceType: row.device_type,
    status: row.status,
    online,
    appVersion: row.app_version,
    releaseChannel: row.release_channel,
    entitlementState: row.entitlement_state,
    updatePolicy: parseJsonObject(row.update_policy_json),
    createdAt: row.created_at,
    approvedAt: row.approved_at,
    blockedAt: row.blocked_at,
    lastSeenAt: row.last_seen_at,
  };
}

async function rowFor(deviceId: string) {
  if (!/^[a-f0-9]{64}$/.test(deviceId)) {
    throw new DesktopAgentError("Mã desktop agent không hợp lệ.", 400, "INVALID_AGENT_DEVICE");
  }
  const database = await getControlDatabase();
  return database
    .prepare(
      `SELECT device_id, display_code, public_key_jwk, app_id, platform, device_type,
              status, app_version, release_channel, entitlement_state, update_policy_json,
              created_at, approved_at, blocked_at, last_seen_at
         FROM desktop_agent_devices WHERE device_id = ? LIMIT 1`,
    )
    .bind(deviceId)
    .first<DeviceRow>();
}

async function createChallengeFor(deviceId: string) {
  const row = await rowFor(deviceId);
  if (!row) {
    throw new DesktopAgentError("Desktop agent chưa đăng ký.", 404, "AGENT_NOT_FOUND");
  }
  const nonce = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const expiresAt = Date.now() + 2 * 60 * 1000;
  const database = await getControlDatabase();
  await database.batch([
    database
      .prepare("DELETE FROM desktop_agent_challenges WHERE expires_at < ?")
      .bind(Date.now()),
    database
      .prepare(
        "INSERT INTO desktop_agent_challenges (nonce, device_id, expires_at) VALUES (?, ?, ?)",
      )
      .bind(nonce, deviceId, expiresAt),
    database
      .prepare(
        `DELETE FROM desktop_agent_challenges
          WHERE device_id = ?
            AND nonce NOT IN (
              SELECT nonce FROM desktop_agent_challenges
               WHERE device_id = ? ORDER BY rowid DESC LIMIT 8
            )`,
      )
      .bind(deviceId, deviceId),
  ]);
  return { challenge: nonce, expiresAt };
}

async function verifyProof(
  deviceId: string,
  action: "heartbeat" | "result",
  proofValue: unknown,
) {
  const proof = record(proofValue);
  const challenge = text(proof.challenge);
  const signature = text(proof.signature);
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(challenge)) {
    throw new DesktopAgentError("Challenge desktop agent không hợp lệ.", 400, "INVALID_AGENT_CHALLENGE");
  }
  const row = await rowFor(deviceId);
  if (!row) throw new DesktopAgentError("Desktop agent chưa đăng ký.", 404, "AGENT_NOT_FOUND");

  const database = await getControlDatabase();
  const stored = await database
    .prepare(
      "SELECT expires_at FROM desktop_agent_challenges WHERE nonce = ? AND device_id = ? LIMIT 1",
    )
    .bind(challenge, deviceId)
    .first<{ expires_at: number }>();
  await database
    .prepare("DELETE FROM desktop_agent_challenges WHERE nonce = ? AND device_id = ?")
    .bind(challenge, deviceId)
    .run();

  if (!stored || stored.expires_at < Date.now()) {
    throw new DesktopAgentError("Challenge desktop agent đã hết hạn hoặc đã dùng.", 401, "AGENT_PROOF_EXPIRED");
  }

  const publicKey = publicKeyShape(JSON.parse(row.public_key_jwk));
  const key = await crypto.subtle.importKey(
    "jwk",
    publicKey,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
  const message = new TextEncoder().encode(
    `pc-manager-agent/v1:${deviceId}:${challenge}:${action}`,
  );
  const valid = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    fromBase64Url(signature),
    message,
  );
  if (!valid) {
    throw new DesktopAgentError("Không xác minh được chữ ký desktop agent.", 403, "AGENT_SIGNATURE_MISMATCH");
  }
  return row;
}

export async function registerDesktopAgent(payloadValue: unknown) {
  const payload = record(payloadValue);
  exactIdentity(payload);
  const key = publicKeyShape(payload.publicKey);
  const serialized = canonicalKey(key);
  const deviceId = await sha256(serialized);
  const database = await getControlDatabase();
  const existing = await rowFor(deviceId);
  const version = appVersion(payload.appVersion);
  const channel = releaseChannel(payload.releaseChannel);

  if (!existing) {
    await database
      .prepare(
        `INSERT INTO desktop_agent_devices
          (device_id, display_code, public_key_jwk, app_id, platform, device_type,
           status, app_version, release_channel)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      )
      .bind(
        deviceId,
        displayCodeFor(deviceId),
        serialized,
        PC_MANAGER_IDENTITY.appId,
        PC_MANAGER_IDENTITY.platform,
        PC_MANAGER_IDENTITY.deviceType,
        version,
        channel,
      )
      .run();
    await database
      .prepare(
        `INSERT INTO control_audit_log (actor, action, target, detail_json)
         VALUES ('desktop-agent', 'desktop-agent.register', ?, ?)`,
      )
      .bind(deviceId, JSON.stringify({ appId: PC_MANAGER_IDENTITY.appId, releaseChannel: channel }))
      .run();
  } else {
    if (existing.public_key_jwk !== serialized) {
      throw new DesktopAgentError("Khóa thiết bị không khớp registry.", 403, "AGENT_KEY_MISMATCH");
    }
    await database
      .prepare(
        "UPDATE desktop_agent_devices SET app_version = ?, release_channel = ? WHERE device_id = ?",
      )
      .bind(version, channel, deviceId)
      .run();
  }

  const device = await rowFor(deviceId);
  if (!device) throw new DesktopAgentError("Không thể tạo desktop agent.", 500, "AGENT_CREATE_FAILED");
  return {
    protocol: DESKTOP_AGENT_PROTOCOL,
    device: publicDevice(device),
    ...(await createChallengeFor(deviceId)),
  };
}

export async function challengeDesktopAgent(payloadValue: unknown) {
  const payload = record(payloadValue);
  const deviceId = text(payload.deviceId);
  return {
    protocol: DESKTOP_AGENT_PROTOCOL,
    deviceId,
    ...(await createChallengeFor(deviceId)),
  };
}

function normalizeTelemetry(payload: Record<string, unknown>) {
  exactIdentity(payload);
  return {
    appVersion: appVersion(payload.appVersion),
    releaseChannel: releaseChannel(payload.releaseChannel),
  };
}

async function commandsForHeartbeat(deviceId: string, approved: boolean) {
  if (!approved) return [];
  const database = await getControlDatabase();
  const result = await database
    .prepare(
      `SELECT command_id, device_id, command_type, payload_json, status, delivery_count,
              created_by, created_at, delivered_at, completed_at, result_json
         FROM desktop_agent_commands
        WHERE device_id = ?
          AND delivery_count < 5
          AND (
            status = 'queued'
            OR (status = 'delivered' AND delivered_at <= datetime('now', '-5 minutes'))
          )
        ORDER BY created_at ASC
        LIMIT 8`,
    )
    .bind(deviceId)
    .all<CommandRow>();
  const rows = result.results ?? [];
  if (rows.length) {
    await database.batch(
      rows.map((row) =>
        database
          .prepare(
            `UPDATE desktop_agent_commands
                SET status = 'delivered',
                    delivery_count = delivery_count + 1,
                    delivered_at = CURRENT_TIMESTAMP
              WHERE command_id = ? AND status IN ('queued','delivered')`,
          )
          .bind(row.command_id),
      ),
    );
  }
  return rows.map((row) => ({
    commandId: row.command_id,
    type: row.command_type,
    payload: parseJsonObject(row.payload_json),
    createdAt: row.created_at,
  }));
}

export async function heartbeatDesktopAgent(payloadValue: unknown) {
  const payload = record(payloadValue);
  const deviceId = text(payload.deviceId);
  const row = await verifyProof(deviceId, "heartbeat", payload.proof);
  const telemetry = normalizeTelemetry(record(payload.telemetry));
  const database = await getControlDatabase();
  await database
    .prepare(
      `UPDATE desktop_agent_devices
          SET app_version = ?, release_channel = ?, last_seen_at = CURRENT_TIMESTAMP
        WHERE device_id = ?`,
    )
    .bind(telemetry.appVersion, telemetry.releaseChannel, deviceId)
    .run();
  const refreshed = await rowFor(deviceId);
  if (!refreshed) throw new DesktopAgentError("Desktop agent không tồn tại.", 404, "AGENT_NOT_FOUND");

  return {
    protocol: DESKTOP_AGENT_PROTOCOL,
    serverTime: new Date().toISOString(),
    heartbeatAfterSeconds: 60,
    device: publicDevice(refreshed),
    commands: await commandsForHeartbeat(deviceId, refreshed.status === "approved"),
    ...(await createChallengeFor(deviceId)),
  };
}

export async function submitDesktopAgentResult(payloadValue: unknown) {
  const payload = record(payloadValue);
  const deviceId = text(payload.deviceId);
  await verifyProof(deviceId, "result", payload.proof);
  const commandId = text(payload.commandId);
  const status = payload.status === "completed" || payload.status === "failed" ? payload.status : "";
  if (!/^[0-9a-fA-F-]{36}$/.test(commandId) || !status) {
    throw new DesktopAgentError("Kết quả command không hợp lệ.", 400, "INVALID_COMMAND_RESULT");
  }
  const result = record(payload.result);
  const serialized = JSON.stringify(result);
  if (serialized.length > 4096) {
    throw new DesktopAgentError("Kết quả command vượt giới hạn.", 400, "COMMAND_RESULT_TOO_LARGE");
  }

  const database = await getControlDatabase();
  const command = await database
    .prepare(
      "SELECT command_id, device_id, status FROM desktop_agent_commands WHERE command_id = ? LIMIT 1",
    )
    .bind(commandId)
    .first<{ command_id: string; device_id: string; status: string }>();
  if (!command || command.device_id !== deviceId) {
    throw new DesktopAgentError("Command không thuộc desktop agent này.", 404, "COMMAND_NOT_FOUND");
  }
  if (command.status === "completed" || command.status === "failed") {
    return {
      protocol: DESKTOP_AGENT_PROTOCOL,
      accepted: true,
      replayed: true,
      ...(await createChallengeFor(deviceId)),
    };
  }

  await database
    .prepare(
      `UPDATE desktop_agent_commands
          SET status = ?, completed_at = CURRENT_TIMESTAMP, result_json = ?
        WHERE command_id = ?`,
    )
    .bind(status, serialized, commandId)
    .run();
  await database
    .prepare(
      `INSERT INTO control_audit_log (actor, action, target, detail_json)
       VALUES (?, 'desktop-agent.command-result', ?, ?)`,
    )
    .bind(deviceId, commandId, JSON.stringify({ status }))
    .run();

  return {
    protocol: DESKTOP_AGENT_PROTOCOL,
    accepted: true,
    replayed: false,
    ...(await createChallengeFor(deviceId)),
  };
}

function commandType(value: unknown): DesktopAgentCommandType {
  const type = text(value);
  if ((DESKTOP_AGENT_COMMANDS as readonly string[]).includes(type)) {
    return type as DesktopAgentCommandType;
  }
  throw new DesktopAgentError("Remote command không nằm trong allow-list.", 400, "COMMAND_NOT_ALLOWED");
}

function commandPayload(type: DesktopAgentCommandType, raw: unknown) {
  const payload = record(raw);
  if (type === "DISABLE_LICENSE") {
    const reason = text(payload.reason).slice(0, 240);
    return reason ? { reason } : {};
  }
  return {};
}

function uuid() {
  return crypto.randomUUID();
}

function requireMutationRole(actor: ControlDeviceState) {
  if (actor.role !== "publisher" && actor.role !== "owner") {
    throw new DesktopAgentError("Vai trò hiện tại không được thay đổi desktop agent.", 403, "PUBLISHER_REQUIRED");
  }
}

export async function listDesktopAgents() {
  const database = await getControlDatabase();
  const result = await database
    .prepare(
      `SELECT device_id, display_code, public_key_jwk, app_id, platform, device_type,
              status, app_version, release_channel, entitlement_state, update_policy_json,
              created_at, approved_at, blocked_at, last_seen_at
         FROM desktop_agent_devices
        ORDER BY created_at DESC LIMIT 250`,
    )
    .all<DeviceRow>();
  return (result.results ?? []).map(publicDevice);
}

export async function setDesktopAgentStatus(
  actor: ControlDeviceState,
  deviceId: string,
  nextStatusValue: unknown,
) {
  requireMutationRole(actor);
  const nextStatus =
    nextStatusValue === "approved" || nextStatusValue === "blocked"
      ? nextStatusValue
      : null;
  if (!nextStatus) {
    throw new DesktopAgentError("Trạng thái desktop agent không hợp lệ.", 400, "INVALID_AGENT_STATUS");
  }
  const existing = await rowFor(deviceId);
  if (!existing) throw new DesktopAgentError("Desktop agent không tồn tại.", 404, "AGENT_NOT_FOUND");
  const database = await getControlDatabase();
  await database
    .prepare(
      `UPDATE desktop_agent_devices
          SET status = ?,
              approved_at = CASE WHEN ? = 'approved' THEN CURRENT_TIMESTAMP ELSE approved_at END,
              blocked_at = CASE WHEN ? = 'blocked' THEN CURRENT_TIMESTAMP ELSE NULL END
        WHERE device_id = ?`,
    )
    .bind(nextStatus, nextStatus, nextStatus, deviceId)
    .run();
  await database
    .prepare(
      `INSERT INTO control_audit_log (actor, action, target, detail_json)
       VALUES (?, 'desktop-agent.status', ?, ?)`,
    )
    .bind(actor.email, deviceId, JSON.stringify({ from: existing.status, to: nextStatus }))
    .run();
  const updated = await rowFor(deviceId);
  if (!updated) throw new DesktopAgentError("Desktop agent không tồn tại.", 404, "AGENT_NOT_FOUND");
  return publicDevice(updated);
}

export async function setDesktopAgentPolicy(
  actor: ControlDeviceState,
  deviceId: string,
  value: unknown,
) {
  requireMutationRole(actor);
  const input = record(value);
  const entitlement: DesktopAgentEntitlement =
    input.entitlementState === "active" ||
    input.entitlementState === "trial" ||
    input.entitlementState === "disabled" ||
    input.entitlementState === "unknown"
      ? input.entitlementState
      : "unknown";
  const channel = releaseChannel(input.channel);
  const autoCheck = input.autoCheck !== false;
  const minimumVersion = text(input.minimumVersion);
  if (minimumVersion && (minimumVersion.length > 64 || !/^[0-9A-Za-z._+-]+$/.test(minimumVersion))) {
    throw new DesktopAgentError("minimumVersion không hợp lệ.", 400, "INVALID_UPDATE_POLICY");
  }
  const updatePolicy = {
    channel,
    autoCheck,
    ...(minimumVersion ? { minimumVersion } : {}),
  };
  const database = await getControlDatabase();
  const existing = await rowFor(deviceId);
  if (!existing) throw new DesktopAgentError("Desktop agent không tồn tại.", 404, "AGENT_NOT_FOUND");
  await database
    .prepare(
      "UPDATE desktop_agent_devices SET entitlement_state = ?, update_policy_json = ? WHERE device_id = ?",
    )
    .bind(entitlement, JSON.stringify(updatePolicy), deviceId)
    .run();
  await database
    .prepare(
      `INSERT INTO control_audit_log (actor, action, target, detail_json)
       VALUES (?, 'desktop-agent.policy', ?, ?)`,
    )
    .bind(actor.email, deviceId, JSON.stringify({ entitlementState: entitlement, updatePolicy }))
    .run();
  const updated = await rowFor(deviceId);
  if (!updated) throw new DesktopAgentError("Desktop agent không tồn tại.", 404, "AGENT_NOT_FOUND");
  return publicDevice(updated);
}

export async function queueDesktopAgentCommand(
  actor: ControlDeviceState,
  deviceId: string,
  commandTypeValue: unknown,
  payloadValue: unknown,
) {
  requireMutationRole(actor);
  const device = await rowFor(deviceId);
  if (!device) throw new DesktopAgentError("Desktop agent không tồn tại.", 404, "AGENT_NOT_FOUND");
  if (device.status !== "approved") {
    throw new DesktopAgentError("Chỉ thiết bị đã duyệt mới nhận remote command.", 409, "AGENT_NOT_APPROVED");
  }
  const type = commandType(commandTypeValue);
  const payload = commandPayload(type, payloadValue);
  const commandId = uuid();
  const database = await getControlDatabase();
  const statements = [
    database
      .prepare(
        `INSERT INTO desktop_agent_commands
          (command_id, device_id, command_type, payload_json, status, created_by)
         VALUES (?, ?, ?, ?, 'queued', ?)`,
      )
      .bind(commandId, deviceId, type, JSON.stringify(payload), actor.email),
    database
      .prepare(
        `INSERT INTO control_audit_log (actor, action, target, detail_json)
         VALUES (?, 'desktop-agent.command-queued', ?, ?)`,
      )
      .bind(actor.email, deviceId, JSON.stringify({ commandId, type })),
  ];
  if (type === "DISABLE_LICENSE") {
    statements.push(
      database
        .prepare(
          "UPDATE desktop_agent_devices SET entitlement_state = 'disabled' WHERE device_id = ?",
        )
        .bind(deviceId),
    );
  }
  await database.batch(statements);
  return { commandId, deviceId, type, payload, status: "queued" as const };
}

export function desktopAgentErrorResponse(error: unknown) {
  if (error instanceof DesktopAgentError) {
    return Response.json(
      { error: error.message, code: error.code },
      {
        status: error.status,
        headers: {
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        },
      },
    );
  }
  return Response.json(
    { error: "Desktop Agent Gateway đang tạm gián đoạn.", code: "DESKTOP_AGENT_GATEWAY_ERROR" },
    {
      status: 500,
      headers: {
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    },
  );
}
