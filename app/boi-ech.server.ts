import { resolveClientBridge } from "./client-origin.server";
import { parseBoiDeviceRegistry } from "./boi-device-registry";
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

export async function issueBoiBrowserBridge(actor: string, role: ControlRole, scope?: "account-owner") {
  const { baseUrl, secret, source } = await configuration();
  const expiresAt = Date.now() + 5 * 60 * 1000;
  const payload = base64Url(new TextEncoder().encode(JSON.stringify({
    iss: "quan-ly-hoc-tap",
    aud: "boi-ech-control",
    actor: actor.trim().toLowerCase().slice(0, 160),
    role,
    ...(scope ? { scope } : {}),
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

export async function readBoiDeviceRegistry(bridge: Awaited<ReturnType<typeof issueBoiBrowserBridge>>) {
  let response: Response;
  try {
    response = await fetch(`${bridge.baseUrl}/api/control/v2/device-registry?view=owner`, {
      method: "GET",
      headers: { authorization: `Bearer ${bridge.token}` },
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(4_500),
    });
  } catch {
    throw new UpstreamError("Chưa kết nối được danh sách thiết bị Bơi Ếch.", 503, { code: "BOI_DEVICE_REGISTRY_UNAVAILABLE" });
  }
  const data = await response.json().catch(() => null);
  if (response.status === 409 && data && typeof data === "object" && "code" in data && data.code === "ACCOUNT_V2_REQUIRED") {
    throw new UpstreamError("Bơi Ếch chưa bật Account-first V2.", 409, { code: "ACCOUNT_V2_REQUIRED" });
  }
  if (response.status === 404) {
    throw new UpstreamError("Bơi Ếch chưa cung cấp danh sách liên kết V2.", 404, { code: "BOI_DEVICE_REGISTRY_NOT_IMPLEMENTED" });
  }
  if (response.status !== 200) {
    throw new UpstreamError("Bơi Ếch từ chối hoặc chưa trả được danh sách thiết bị.", 502, {
      code: "BOI_DEVICE_REGISTRY_UPSTREAM_FAILED",
      upstreamStatus: response.status,
    });
  }
  const registry = parseBoiDeviceRegistry(data);
  if (!registry) throw new UpstreamError("Danh sách thiết bị Bơi Ếch sai hợp đồng.", 502, { code: "BOI_DEVICE_REGISTRY_CONTRACT_MISMATCH" });
  return registry;
}
