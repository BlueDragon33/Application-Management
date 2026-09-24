import { resolveClientBridge } from "./client-origin.server";
import type { ControlRole } from "./control-device.server";

export class UpstreamError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

const BOI_RUNTIME_IDENTITY = {
  applicationId: "boi-ech",
  repository: "BlueDragon33/BOIECH_AI",
  runtime: "boi-ech",
  controlContract: "application-management",
  controlGeneration: 2,
  sourceTrack: "main",
} as const;

const BOI_RUNTIME_PROBE_TIMEOUT_MS = 2_000;

async function verifyBoiRuntimeIdentity(baseUrl: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BOI_RUNTIME_PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}/api/control/runtime`, {
      method: "GET",
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
    });
    const identity = await response.json().catch(() => null) as Record<string, unknown> | null;
    const valid = response.ok
      && identity?.applicationId === BOI_RUNTIME_IDENTITY.applicationId
      && identity?.repository === BOI_RUNTIME_IDENTITY.repository
      && identity?.runtime === BOI_RUNTIME_IDENTITY.runtime
      && identity?.controlContract === BOI_RUNTIME_IDENTITY.controlContract
      && identity?.controlGeneration === BOI_RUNTIME_IDENTITY.controlGeneration
      && identity?.sourceTrack === BOI_RUNTIME_IDENTITY.sourceTrack;
    if (!valid) {
      throw new UpstreamError(
        "Site Bơi ếch đang publish bản cũ hoặc sai nguồn. Application Management đã ngừng quản trị bản này.",
        409,
        { code: "BOI_ECH_STALE_PUBLISH", expected: BOI_RUNTIME_IDENTITY },
      );
    }
  } catch (error) {
    if (error instanceof UpstreamError) throw error;
    throw new UpstreamError(
      controller.signal.aborted
        ? "Không xác minh được phiên bản publish Bơi ếch trong thời gian cho phép."
        : "Site Bơi ếch chưa công bố runtime identity hiện hành.",
      503,
      { code: "BOI_ECH_RUNTIME_IDENTITY_UNAVAILABLE" },
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function configuration() {
  let origin;
  try {
    origin = await resolveClientBridge("boi-ech");
  } catch (error) {
    throw new UpstreamError(
      error instanceof Error ? error.message : "Kết nối Bơi ếch chưa được cấu hình.",
      503,
      { code: "BOI_ECH_NOT_CONFIGURED" },
    );
  }
  if (origin.secret.length < 32) {
    throw new UpstreamError(
      "Khóa kết nối Bơi ếch chưa được cấu hình phù hợp với đường truyền hiện tại.",
      503,
      { code: "BOI_ECH_SECRET_NOT_CONFIGURED", originSource: origin.source, secretEnv: origin.secretEnv },
    );
  }
  await verifyBoiRuntimeIdentity(origin.baseUrl);
  return origin;
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function signature(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64Url(new Uint8Array(signed));
}

export async function issueBoiBrowserBridge(actor: string, role: ControlRole) {
  const { baseUrl, secret, source } = await configuration();
  const expiresAt = Date.now() + 5 * 60 * 1000;
  const payload = base64Url(new TextEncoder().encode(JSON.stringify({
    iss: "quan-ly-hoc-tap",
    aud: "boi-ech-control",
    actor: actor.trim().toLowerCase().slice(0, 160),
    role,
    exp: expiresAt,
  })));
  const signedInput = `v1.${payload}`;
  return {
    baseUrl,
    token: `${signedInput}.${await signature(secret, signedInput)}`,
    expiresAt,
    originSource: source,
  };
}
