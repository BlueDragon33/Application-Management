import type { ControlDeviceState } from "./control-device.server";

export const DESKTOP_AGENT_PROTOCOL = "pc-manager-agent/v1" as const;
export const DESKTOP_AGENT_APP_ID = "pc-manager" as const;

export type DesktopAgentStatus = "pending" | "approved" | "blocked";
export type DesktopAgentCommandType =
  | "CHECK_UPDATE"
  | "RUN_HEALTH_SCAN"
  | "REFRESH_DEVICE_STATUS"
  | "DISABLE_LICENSE";

type DesktopAgentCommandOutcome = "completed" | "failed" | "unsupported";

type DeviceRow = {
  device_id: string;
  device_code: string;
  app_id: string;
  public_key_jwk: string;
  status: DesktopAgentStatus;
  device_type: string;
  app_version: string;
  release_channel: string;
  entitlement_state: string;
  update_policy: string;
  created_at: string;
  approved_at: string | null;
  blocked_at: string | null;
  last_seen_at: string | null;
};

type CommandRow = {
  command_id: string;
  command_type: DesktopAgentCommandType;
  state: string;
  issued_at: string;
  expires_at: number;
};

const encoder = new TextEncoder();
const DEVICE_ID = /^[a-f0-9]{64}$/;
const COMMAND_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_COMMANDS = new Set<DesktopAgentCommandType>([
  "CHECK_UPDATE",
  "RUN_HEALTH_SCAN",
  "REFRESH_DEVICE_STATUS",
  "DISABLE_LICENSE",
]);

export class DesktopAgentGatewayError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function text(value: unknown, max = 160) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
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
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  if (!/^[A-Za-z0-9_-]{80,104}$/.test(value)) {
    throw new DesktopAgentGatewayError("Chữ ký thiết bị không hợp lệ.", 400, "INVALID_AGENT_SIGNATURE");
  }
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  try {
    return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  } catch {
    throw new DesktopAgentGatewayError("Chữ ký thiết bị không hợp lệ.", 400, "INVALID_AGENT_SIGNATURE");
  }
}

function normalizeP256Signature(signature: Uint8Array) {
  if (signature.length === 64) return signature;
  if (signature.length < 68 || signature.length > 72 || signature[0] !== 0x30) {
    throw new DesktopAgentGatewayError("Định dạng chữ ký ECDSA không hợp lệ.", 400, "INVALID_AGENT_SIGNATURE");
  }

  let offset = 2;
  if (signature[1] & 0x80) {
    const lengthBytes = signature[1] & 0x7f;
    if (lengthBytes !== 1) throw new DesktopAgentGatewayError("Định dạng chữ ký ECDSA không hợp lệ.", 400, "INVALID_AGENT_SIGNATURE");
    offset = 3;
  }
  if (signature[offset] !== 0x02) throw new DesktopAgentGatewayError("Định dạng chữ ký ECDSA không hợp lệ.", 400, "INVALID_AGENT_SIGNATURE");
  const rLength = signature[offset + 1];
  const rStart = offset + 2;
  const rEnd = rStart + rLength;
  if (signature[rEnd] !== 0x02) throw new DesktopAgentGatewayError("Định dạng chữ ký ECDSA không hợp lệ.", 400, "INVALID_AGENT_SIGNATURE");
  const sLength = signature[rEnd + 1];
  const sStart = rEnd + 2;
  const sEnd = sStart + sLength;
  if (sEnd !== signature.length) throw new DesktopAgentGatewayError("Định dạng chữ ký ECDSA không hợp lệ.", 400, "INVALID_AGENT_SIGNATURE");

  const trimInteger = (bytes: Uint8Array) => {
    let start = 0;
    while (start < bytes.length - 1 && bytes[start] === 0) start += 1;
    const value = bytes.slice(start);
    if (value.length > 32) throw new DesktopAgentGatewayError("Chữ ký ECDSA vượt kích thước P-256.", 400, "INVALID_AGENT_SIGNATURE");
    const padded = new Uint8Array(32);
    padded.set(value, 32 - value.length);
    return padded;
  };

  const output = new Uint8Array(64);
  output.set(trimInteger(signature.slice(rStart, rEnd)), 0);
  output.set(trimInteger(signature.slice(sStart, sEnd)), 32);
  return output;
}

function publicKeyShape(value: unknown): JsonWebKey {
  const source = record(value);
  const x = text(source.x, 64);
  const y = text(source.y, 64);
  if (
    source.kty !== "EC"
    || source.crv !== "P-256"
    || !/^[A-Za-z0-9_-]{42,44}$/.test(x)
    || !/^[A-Za-z0-9_-]{42,44}$/.test(y)
  ) {
    throw new DesktopAgentGatewayError("Khóa P-256 của PC Manager không hợp lệ.", 400, "INVALID_AGENT_KEY");
  }
  return { kty: "EC", crv: "P-256", x, y, ext: true, key_ops: ["verify"] };
}

function canonicalKey(key: JsonWebKey) {
  return JSON.stringify({ kty: key.kty, crv: key.crv, x: key.x, y: key.y });
}

async function sha256Hex(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
  return [...digest].map((item) => item.toString(16).padStart(2, "0")).join("");
}

function displayCodeFor(deviceId: string) {
  return `PC-${deviceId.slice(0, 4)}-${deviceId.slice(4, 8)}-${deviceId.slice(8, 12)}`.toUpperCase();
}

async function database() {
  const workers = await import("cloudflare:workers");
  if (!workers.env.DB) {
    throw new DesktopAgentGatewayError("Desktop Agent Gateway database chưa sẵn sàng.", 503, "AGENT_DATABASE_UNAVAILABLE");
  }
  return workers.env.DB;
}

function requireProtocol(payload: Record<string, unknown>) {
  if (payload.protocol !== DESKTOP_AGENT_PROTOCOL || payload.appId !== DESKTOP_AGENT_APP_ID) {
    throw new DesktopAgentGatewayError("PC Manager Agent protocol không tương thích.", 400, "AGENT_PROTOCOL_MISMATCH");
  }
}

async function deviceRow(deviceId: string) {
  if (!DEVICE_ID.test(deviceId)) {
    throw new DesktopAgentGatewayError("Mã thiết bị PC Manager không hợp lệ.", 400, "INVALID_AGENT_DEVICE");
  }
  const db = await database();
  return db
    .prepare(
      `SELECT device_id,device_code,app_id,public_key_jwk,status,device_type,app_version,
              release_channel,entitlement_state,update_policy,created_at,approved_at,
              blocked_at,last_seen_at
         FROM desktop_agent_devices WHERE device_id=?1 LIMIT 1`,
    )
    .bind(deviceId)
    .first<DeviceRow>();
}

function publicDevice(row: DeviceRow) {
  return {
    deviceId: row.device_id,
    deviceCode: row.device_code,
    appId: row.app_id,
    status: row.status,
    deviceType: row.device_type,
    appVersion: row.app_version,
    releaseChannel: row.release_channel,
    entitlementState: row.entitlement_state,
    updatePolicy: row.update_policy,
    createdAt: row.created_at,
    approvedAt: row.approved_at,
    blockedAt: row.blocked_at,
    lastSeenAt: row.last_seen_at,
  };
}

function policyFor(row: DeviceRow) {
  return {
    releaseChannel: row.release_channel,
    entitlementState: row.entitlement_state,
    updatePolicy: row.update_policy,
    commandTypes: [...ALLOWED_COMMANDS],
  };
}

async function audit(actor: string, action: string, target: string, detail: Record<string, unknown>) {
  const db = await database();
  await db
    .prepare(
      "INSERT INTO desktop_agent_audit (actor,action,target,detail_json) VALUES (?1,?2,?3,?4)",
    )
    .bind(actor.slice(0, 160), action.slice(0, 80), target.slice(0, 160), JSON.stringify(detail).slice(0, 4000))
    .run();
}

export function desktopAgentContract() {
  return {
    schema: "application-management.desktop-agent/v1",
    protocol: DESKTOP_AGENT_PROTOCOL,
    application: {
      id: DESKTOP_AGENT_APP_ID,
      name: "PC Manager Desktop",
      platform: "windows",
      deviceType: "desktop-native",
    },
    transport: {
      direction: "client-outbound",
      authentication: "p256-one-time-challenge",
      heartbeatSeconds: 60,
      noInboundPortRequired: true,
    },
    capabilities: {
      registration: true,
      approvalState: true,
      heartbeat: true,
      releaseChannel: true,
      entitlement: true,
      updatePolicy: true,
      typedRemoteCommands: true,
    },
    commandAllowList: [...ALLOWED_COMMANDS],
    prohibited: [
      "ARBITRARY_SHELL",
      "ARBITRARY_POWERSHELL",
      "ARBITRARY_PROCESS_EXECUTION",
      "ARBITRARY_REGISTRY_MUTATION",
      "ARBITRARY_DOWNLOAD_AND_RUN",
    ],
  };
}

export async function registerDesktopAgent(payload: Record<string, unknown>) {
  requireProtocol(payload);
  if (payload.platform !== "windows" || payload.deviceType !== "desktop-native") {
    throw new DesktopAgentGatewayError("P8 chỉ nhận PC Manager Windows desktop-native.", 400, "AGENT_PLATFORM_MISMATCH");
  }

  const key = publicKeyShape(payload.publicKey);
  const serialized = canonicalKey(key);
  const deviceId = await sha256Hex(serialized);
  const appVersion = text(payload.appVersion, 40) || "unknown";
  const requestedChannel = text(payload.releaseChannel, 24).toLowerCase();
  const releaseChannel = new Set(["stable", "preview", "development"]).has(requestedChannel)
    ? requestedChannel
    : "stable";
  const db = await database();
  const existing = await deviceRow(deviceId);

  if (!existing) {
    await db
      .prepare(
        `INSERT INTO desktop_agent_devices
          (device_id,device_code,app_id,public_key_jwk,status,device_type,app_version,
           release_channel,entitlement_state,update_policy,last_seen_at)
         VALUES (?1,?2,?3,?4,'pending','desktop-native',?5,?6,'pending','notify',CURRENT_TIMESTAMP)`,
      )
      .bind(deviceId, displayCodeFor(deviceId), DESKTOP_AGENT_APP_ID, serialized, appVersion, releaseChannel)
      .run();
    await audit("desktop-agent", "agent_registered", deviceId, { appVersion, releaseChannel });
  } else if (existing.public_key_jwk !== serialized || existing.app_id !== DESKTOP_AGENT_APP_ID) {
    throw new DesktopAgentGatewayError("Danh tính thiết bị không khớp registry.", 409, "AGENT_IDENTITY_CONFLICT");
  } else {
    await db
      .prepare(
        "UPDATE desktop_agent_devices SET app_version=?2,last_seen_at=CURRENT_TIMESTAMP WHERE device_id=?1",
      )
      .bind(deviceId, appVersion)
      .run();
  }

  const row = await deviceRow(deviceId);
  if (!row) throw new DesktopAgentGatewayError("Không thể tạo hồ sơ PC Manager.", 500, "AGENT_REGISTER_FAILED");
  return { device: publicDevice(row), policy: policyFor(row) };
}

export async function createDesktopAgentChallenge(payload: Record<string, unknown>) {
  requireProtocol(payload);
  const deviceId = text(payload.deviceId, 80).toLowerCase();
  const row = await deviceRow(deviceId);
  if (!row) throw new DesktopAgentGatewayError("Thiết bị PC Manager chưa đăng ký.", 404, "AGENT_NOT_REGISTERED");
  if (row.status === "blocked") {
    throw new DesktopAgentGatewayError("Thiết bị PC Manager đã bị khóa.", 403, "AGENT_BLOCKED");
  }

  const challenge = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const expiresAt = Date.now() + 2 * 60 * 1000;
  const db = await database();
  await db.batch([
    db.prepare("DELETE FROM desktop_agent_challenges WHERE expires_at<?1").bind(Date.now()),
    db
      .prepare(
        "INSERT INTO desktop_agent_challenges (nonce,device_id,expires_at) VALUES (?1,?2,?3)",
      )
      .bind(challenge, deviceId, expiresAt),
    db
      .prepare(
        `DELETE FROM desktop_agent_challenges
          WHERE device_id=?1
            AND nonce NOT IN (
              SELECT nonce FROM desktop_agent_challenges
               WHERE device_id=?1 ORDER BY rowid DESC LIMIT 8
            )`,
      )
      .bind(deviceId),
  ]);

  return { challenge, expiresAt, device: publicDevice(row) };
}

async function verifyAgentProof(payload: Record<string, unknown>, action: "heartbeat" | "ack") {
  requireProtocol(payload);
  const deviceId = text(payload.deviceId, 80).toLowerCase();
  const challenge = text(payload.challenge, 128);
  const signature = text(payload.signature, 160);
  const row = await deviceRow(deviceId);
  if (!row) throw new DesktopAgentGatewayError("Thiết bị PC Manager chưa đăng ký.", 404, "AGENT_NOT_REGISTERED");
  if (row.status === "blocked") throw new DesktopAgentGatewayError("Thiết bị PC Manager đã bị khóa.", 403, "AGENT_BLOCKED");
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(challenge)) {
    throw new DesktopAgentGatewayError("Challenge PC Manager không hợp lệ.", 400, "INVALID_AGENT_CHALLENGE");
  }

  const db = await database();
  const stored = await db
    .prepare("SELECT expires_at FROM desktop_agent_challenges WHERE nonce=?1 AND device_id=?2 LIMIT 1")
    .bind(challenge, deviceId)
    .first<{ expires_at: number }>();
  await db
    .prepare("DELETE FROM desktop_agent_challenges WHERE nonce=?1 AND device_id=?2")
    .bind(challenge, deviceId)
    .run();

  if (!stored || stored.expires_at < Date.now()) {
    throw new DesktopAgentGatewayError("Challenge đã hết hạn hoặc đã được dùng.", 401, "AGENT_CHALLENGE_EXPIRED");
  }

  const key = await crypto.subtle.importKey(
    "jwk",
    publicKeyShape(JSON.parse(row.public_key_jwk)),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
  const message = encoder.encode(`${DESKTOP_AGENT_PROTOCOL}:${action}:${deviceId}:${challenge}`);
  const valid = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    normalizeP256Signature(fromBase64Url(signature)),
    message,
  );
  if (!valid) {
    throw new DesktopAgentGatewayError("Chữ ký PC Manager không khớp thiết bị.", 403, "AGENT_SIGNATURE_MISMATCH");
  }

  return row;
}

export async function heartbeatDesktopAgent(payload: Record<string, unknown>) {
  const row = await verifyAgentProof(payload, "heartbeat");
  const appVersion = text(payload.appVersion, 40) || row.app_version;
  const db = await database();
  await db
    .prepare(
      "UPDATE desktop_agent_devices SET app_version=?2,last_seen_at=CURRENT_TIMESTAMP WHERE device_id=?1",
    )
    .bind(row.device_id, appVersion)
    .run();

  const now = Date.now();
  await db
    .prepare(
      "UPDATE desktop_agent_commands SET state='expired' WHERE device_id=?1 AND state IN ('queued','delivered') AND expires_at<?2",
    )
    .bind(row.device_id, now)
    .run();

  let commands: CommandRow[] = [];
  if (row.status === "approved") {
    const result = await db
      .prepare(
        `SELECT command_id,command_type,state,issued_at,expires_at
           FROM desktop_agent_commands
          WHERE device_id=?1 AND state='queued' AND expires_at>=?2
          ORDER BY issued_at ASC LIMIT 16`,
      )
      .bind(row.device_id, now)
      .all<CommandRow>();
    commands = result.results ?? [];
    if (commands.length > 0) {
      await db.batch(
        commands.map((command) =>
          db
            .prepare(
              "UPDATE desktop_agent_commands SET state='delivered',delivered_at=CURRENT_TIMESTAMP WHERE command_id=?1 AND state='queued'",
            )
            .bind(command.command_id),
        ),
      );
    }
  }

  const refreshed = await deviceRow(row.device_id);
  if (!refreshed) throw new DesktopAgentGatewayError("Thiết bị PC Manager không còn tồn tại.", 404, "AGENT_NOT_REGISTERED");

  return {
    device: publicDevice(refreshed),
    policy: policyFor(refreshed),
    heartbeatIntervalSeconds: 60,
    commands: commands.map((command) => ({
      schema: "pc-manager-command/v1",
      commandId: command.command_id,
      type: command.command_type,
      issuedAt: command.issued_at,
      expiresAt: command.expires_at,
    })),
    serverTime: Date.now(),
  };
}

export async function acknowledgeDesktopAgentCommand(payload: Record<string, unknown>) {
  const row = await verifyAgentProof(payload, "ack");
  const commandId = text(payload.commandId, 64).toLowerCase();
  const outcome = text(payload.outcome, 32) as DesktopAgentCommandOutcome;
  if (!COMMAND_ID.test(commandId) || !new Set<DesktopAgentCommandOutcome>(["completed", "failed", "unsupported"]).has(outcome)) {
    throw new DesktopAgentGatewayError("Kết quả command PC Manager không hợp lệ.", 400, "INVALID_AGENT_COMMAND_ACK");
  }

  const db = await database();
  const command = await db
    .prepare(
      "SELECT command_id,command_type,state,issued_at,expires_at FROM desktop_agent_commands WHERE command_id=?1 AND device_id=?2 LIMIT 1",
    )
    .bind(commandId, row.device_id)
    .first<CommandRow>();
  if (!command) throw new DesktopAgentGatewayError("Command không thuộc thiết bị này.", 404, "AGENT_COMMAND_NOT_FOUND");
  if (!ALLOWED_COMMANDS.has(command.command_type)) {
    throw new DesktopAgentGatewayError("Command nằm ngoài allow-list P8.", 409, "AGENT_COMMAND_NOT_ALLOWED");
  }

  const result = record(payload.result);
  const state = outcome === "completed" ? "completed" : outcome;
  await db
    .prepare(
      `UPDATE desktop_agent_commands
          SET state=?2,completed_at=CURRENT_TIMESTAMP,result_json=?3
        WHERE command_id=?1 AND device_id=?4`,
    )
    .bind(commandId, state, JSON.stringify(result).slice(0, 4000), row.device_id)
    .run();

  if (command.command_type === "DISABLE_LICENSE" && outcome === "completed") {
    await db
      .prepare(
        "UPDATE desktop_agent_devices SET entitlement_state='disabled' WHERE device_id=?1",
      )
      .bind(row.device_id)
      .run();
  }

  await audit("desktop-agent", "agent_command_ack", row.device_id, {
    commandId,
    commandType: command.command_type,
    outcome,
  });
  return { ok: true, commandId, outcome };
}

function requireOwner(actor: ControlDeviceState) {
  if (actor.role !== "owner") {
    throw new DesktopAgentGatewayError("Chỉ Chủ hệ thống được quản trị PC Manager agent.", 403, "OWNER_REQUIRED");
  }
}

export async function listDesktopAgents(actor: ControlDeviceState) {
  requireOwner(actor);
  const db = await database();
  const result = await db
    .prepare(
      `SELECT device_id,device_code,app_id,public_key_jwk,status,device_type,app_version,
              release_channel,entitlement_state,update_policy,created_at,approved_at,
              blocked_at,last_seen_at
         FROM desktop_agent_devices ORDER BY created_at DESC LIMIT 500`,
    )
    .all<DeviceRow>();
  return { devices: (result.results ?? []).map(publicDevice) };
}

export async function manageDesktopAgent(payload: Record<string, unknown>, actor: ControlDeviceState) {
  requireOwner(actor);
  const deviceId = text(payload.deviceId, 80).toLowerCase();
  const operation = text(payload.operation, 40);
  const row = await deviceRow(deviceId);
  if (!row) throw new DesktopAgentGatewayError("Thiết bị PC Manager không tồn tại.", 404, "AGENT_NOT_REGISTERED");
  const db = await database();

  if (operation === "approve") {
    if (row.status !== "pending" && row.status !== "approved") {
      throw new DesktopAgentGatewayError("Thiết bị bị khóa phải được mở khóa rõ ràng.", 409, "AGENT_STATE_CONFLICT");
    }
    await db
      .prepare(
        `UPDATE desktop_agent_devices
            SET status='approved',entitlement_state=CASE WHEN entitlement_state='pending' THEN 'active' ELSE entitlement_state END,
                approved_at=COALESCE(approved_at,CURRENT_TIMESTAMP),blocked_at=NULL
          WHERE device_id=?1`,
      )
      .bind(deviceId)
      .run();
  } else if (operation === "block") {
    await db
      .prepare("UPDATE desktop_agent_devices SET status='blocked',blocked_at=CURRENT_TIMESTAMP WHERE device_id=?1")
      .bind(deviceId)
      .run();
  } else if (operation === "unblock") {
    await db
      .prepare("UPDATE desktop_agent_devices SET status='approved',blocked_at=NULL WHERE device_id=?1")
      .bind(deviceId)
      .run();
  } else if (operation === "enable-license") {
    await db
      .prepare("UPDATE desktop_agent_devices SET entitlement_state='active' WHERE device_id=?1")
      .bind(deviceId)
      .run();
  } else if (operation === "disable-license") {
    await db
      .prepare("UPDATE desktop_agent_devices SET entitlement_state='disabled' WHERE device_id=?1")
      .bind(deviceId)
      .run();
  } else if (operation === "set-channel") {
    const channel = text(payload.releaseChannel, 24).toLowerCase();
    if (!new Set(["stable", "preview", "development"]).has(channel)) {
      throw new DesktopAgentGatewayError("Release channel không hợp lệ.", 400, "INVALID_RELEASE_CHANNEL");
    }
    await db
      .prepare("UPDATE desktop_agent_devices SET release_channel=?2 WHERE device_id=?1")
      .bind(deviceId, channel)
      .run();
  } else if (operation === "set-update-policy") {
    const policy = text(payload.updatePolicy, 24).toLowerCase();
    if (!new Set(["manual", "notify", "automatic"]).has(policy)) {
      throw new DesktopAgentGatewayError("Update policy không hợp lệ.", 400, "INVALID_UPDATE_POLICY");
    }
    await db
      .prepare("UPDATE desktop_agent_devices SET update_policy=?2 WHERE device_id=?1")
      .bind(deviceId, policy)
      .run();
  } else {
    throw new DesktopAgentGatewayError("Thao tác quản trị PC Manager không hợp lệ.", 400, "INVALID_AGENT_ADMIN_OPERATION");
  }

  await audit(actor.email, `agent_${operation}`, deviceId, {});
  const updated = await deviceRow(deviceId);
  if (!updated) throw new DesktopAgentGatewayError("Thiết bị PC Manager không còn tồn tại.", 404, "AGENT_NOT_REGISTERED");
  return { device: publicDevice(updated), policy: policyFor(updated) };
}

export async function queueDesktopAgentCommand(payload: Record<string, unknown>, actor: ControlDeviceState) {
  requireOwner(actor);
  const deviceId = text(payload.deviceId, 80).toLowerCase();
  const commandType = text(payload.commandType, 64) as DesktopAgentCommandType;
  if (!ALLOWED_COMMANDS.has(commandType)) {
    throw new DesktopAgentGatewayError("Remote command nằm ngoài allow-list P8.", 400, "AGENT_COMMAND_NOT_ALLOWED");
  }

  const row = await deviceRow(deviceId);
  if (!row) throw new DesktopAgentGatewayError("Thiết bị PC Manager không tồn tại.", 404, "AGENT_NOT_REGISTERED");
  if (row.status !== "approved") {
    throw new DesktopAgentGatewayError("Chỉ thiết bị đã duyệt mới nhận remote command.", 409, "AGENT_NOT_APPROVED");
  }

  const commandId = crypto.randomUUID();
  const expiresAt = Date.now() + 15 * 60 * 1000;
  const db = await database();
  await db
    .prepare(
      `INSERT INTO desktop_agent_commands
        (command_id,device_id,command_type,state,issued_by,expires_at)
       VALUES (?1,?2,?3,'queued',?4,?5)`,
    )
    .bind(commandId, deviceId, commandType, actor.email, expiresAt)
    .run();
  await audit(actor.email, "agent_command_queued", deviceId, { commandId, commandType });

  return {
    command: {
      schema: "pc-manager-command/v1",
      commandId,
      type: commandType,
      expiresAt,
      state: "queued",
    },
  };
}

export function desktopAgentErrorResponse(error: unknown) {
  if (error instanceof DesktopAgentGatewayError) {
    return Response.json(
      { ok: false, error: error.message, code: error.code },
      {
        status: error.status,
        headers: {
          "cache-control": "no-store, private",
          "x-content-type-options": "nosniff",
        },
      },
    );
  }
  return Response.json(
    { ok: false, error: "Desktop Agent Gateway tạm thời không khả dụng.", code: "AGENT_GATEWAY_ERROR" },
    {
      status: 500,
      headers: {
        "cache-control": "no-store, private",
        "x-content-type-options": "nosniff",
      },
    },
  );
}
