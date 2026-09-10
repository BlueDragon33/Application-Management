import { resolveClientOrigin } from "./client-origin.server";
import { getControlDatabase, type ControlRole } from "./control-device.server";

const BRIDGE_TTL_MS = 5 * 60 * 1000;
const BRIDGE_PREFIX = "v1.rulb_";

export class RuLifeBridgeError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "RuLifeBridgeError";
    this.status = status;
    this.payload = payload;
  }
}

type BridgeRow = {
  token_hash: string;
  actor: string;
  role: ControlRole;
  control_device_id: string;
  expires_at: number;
};

async function controlOrigin() {
  try {
    return await resolveClientOrigin("ru-life");
  } catch (error) {
    throw new RuLifeBridgeError(
      error instanceof Error ? error.message : "Origin Hòa nhập Nga chưa được cấu hình.",
      503,
      { code: "RU_LIFE_ORIGIN_INVALID" },
    );
  }
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, "0")).join("");
}

async function ensureBridgeTable() {
  const database = await getControlDatabase();
  await database.prepare(
    `CREATE TABLE IF NOT EXISTS ru_life_bridge_tickets (
      token_hash TEXT PRIMARY KEY,
      actor TEXT NOT NULL,
      role TEXT NOT NULL,
      control_device_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )`,
  ).run();
  await database.prepare(
    "CREATE INDEX IF NOT EXISTS ru_life_bridge_tickets_expiry_idx ON ru_life_bridge_tickets(expires_at)",
  ).run();
  return database;
}

function validRole(value: unknown): value is ControlRole {
  return value === "viewer" || value === "reviewer" || value === "publisher" || value === "owner";
}

export async function issueRuLifeBrowserBridge(actor: string, role: ControlRole, controlDeviceId: string) {
  const [database, origin] = await Promise.all([ensureBridgeTable(), controlOrigin()]);
  const expiresAt = Date.now() + BRIDGE_TTL_MS;
  const token = `${BRIDGE_PREFIX}${base64Url(crypto.getRandomValues(new Uint8Array(32)))}`;
  const tokenHash = await sha256(token);
  await database.batch([
    database.prepare("DELETE FROM ru_life_bridge_tickets WHERE expires_at <= ?").bind(Date.now()),
    database.prepare(
      `INSERT INTO ru_life_bridge_tickets
        (token_hash, actor, role, control_device_id, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(
      tokenHash,
      actor.trim().toLowerCase().slice(0, 160),
      role,
      controlDeviceId,
      expiresAt,
      Date.now(),
    ),
  ]);

  return {
    baseUrl: origin.baseUrl,
    token,
    expiresAt,
    application: "ru-life" as const,
    protocol: "ru-life-control-opaque-v1" as const,
    originSource: origin.source,
  };
}

export async function introspectRuLifeBridgeToken(token: unknown) {
  if (typeof token !== "string" || !/^v1\.rulb_[A-Za-z0-9_-]{43}$/.test(token)) {
    throw new RuLifeBridgeError("Vé quản trị Hòa nhập Nga không hợp lệ.", 401, { code: "RU_LIFE_BRIDGE_INVALID" });
  }
  const database = await ensureBridgeTable();
  const tokenHash = await sha256(token);
  const row = await database.prepare(
    `SELECT token_hash, actor, role, control_device_id, expires_at
       FROM ru_life_bridge_tickets
      WHERE token_hash = ?`,
  ).bind(tokenHash).first<BridgeRow>();

  if (!row || row.expires_at <= Date.now() || !validRole(row.role)) {
    if (row) await database.prepare("DELETE FROM ru_life_bridge_tickets WHERE token_hash = ?").bind(tokenHash).run();
    throw new RuLifeBridgeError("Vé quản trị Hòa nhập Nga đã hết hạn hoặc không còn hợp lệ.", 401, { code: "RU_LIFE_BRIDGE_EXPIRED" });
  }

  return {
    ok: true,
    application: "ru-life" as const,
    protocol: "ru-life-control-opaque-v1" as const,
    actor: row.actor,
    role: row.role,
    controlDeviceId: row.control_device_id,
    ticketId: `rulb_${tokenHash.slice(0, 24)}`,
    expiresAt: row.expires_at,
  };
}
