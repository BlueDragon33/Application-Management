import { getClientNetworkSpec, type ManagedClientId } from "./client-network-registry";

export type { ManagedClientId } from "./client-network-registry";

export type ControlPlaneNetworkMode = "production" | "local" | "hybrid";
export type ClientOriginSource = "production" | "local";

export type ClientOriginResolution = {
  applicationId: ManagedClientId;
  baseUrl: string;
  source: ClientOriginSource;
  mode: ControlPlaneNetworkMode;
};

const PROBE_TIMEOUT_MS = 850;

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  if (parts[0] === 10 || parts[0] === 127) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  return parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31;
}

function isPrivateHostname(hostname: string) {
  const normalized = hostname.toLowerCase();
  return normalized === "localhost" || normalized === "::1" || isPrivateIpv4(normalized);
}

export function normalizeClientOrigin(value: unknown, allowPrivateHttp: boolean) {
  const raw = text(value).replace(/\/$/, "");
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return "";
    if (url.protocol === "https:") return url.origin;
    if (allowPrivateHttp && url.protocol === "http:" && isPrivateHostname(url.hostname)) return url.origin;
    return "";
  } catch {
    return "";
  }
}

async function environment() {
  try {
    const workers = await import("cloudflare:workers");
    return workers.env as unknown as Record<string, unknown>;
  } catch {
    return process.env as unknown as Record<string, unknown>;
  }
}

function networkMode(values: Record<string, unknown>): ControlPlaneNetworkMode {
  const normalized = text(values.CONTROL_PLANE_NETWORK_MODE).toLowerCase();
  if (normalized === "production" || normalized === "local" || normalized === "hybrid") return normalized;
  return values.LOCAL_DEV_AUTH === "1" ? "hybrid" : "production";
}

async function reachable(baseUrl: string, path: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    await fetch(`${baseUrl}${path}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      redirect: "manual",
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function currentControlPlaneNetworkMode() {
  return networkMode(await environment());
}

export async function resolveClientOrigin(applicationId: ManagedClientId): Promise<ClientOriginResolution> {
  const values = await environment();
  const mode = networkMode(values);
  const spec = getClientNetworkSpec(applicationId);
  const productionOverride = spec.productionOverrideEnv ? normalizeClientOrigin(values[spec.productionOverrideEnv], false) : "";
  const production = productionOverride || normalizeClientOrigin(values[spec.productionEnv], false);
  const explicitLocal = normalizeClientOrigin(values[spec.localEnv], true);
  const legacyLocal = normalizeClientOrigin(values[spec.productionEnv], true);
  const local = explicitLocal || (legacyLocal && !production ? legacyLocal : "") || spec.localDefault;

  if (mode === "production") {
    if (!production) throw new Error(`${spec.productionOverrideEnv ?? spec.productionEnv}/${spec.productionEnv} chưa được cấu hình HTTPS.`);
    return { applicationId, baseUrl: production, source: "production", mode };
  }

  if (mode === "local") {
    if (!normalizeClientOrigin(local, true)) throw new Error(`${spec.localEnv} không phải origin local/LAN hợp lệ.`);
    return { applicationId, baseUrl: local, source: "local", mode };
  }

  if (normalizeClientOrigin(local, true) && await reachable(local, spec.probePath)) {
    return { applicationId, baseUrl: local, source: "local", mode };
  }
  if (production) {
    return { applicationId, baseUrl: production, source: "production", mode };
  }
  throw new Error(`Không tìm thấy origin local đang hoạt động và ${spec.productionOverrideEnv ?? spec.productionEnv}/${spec.productionEnv} chưa được cấu hình HTTPS.`);
}

export type ClientBridgeResolution = ClientOriginResolution & {
  secret: string;
  secretEnv: string | null;
};

export async function resolveClientBridge(applicationId: ManagedClientId): Promise<ClientBridgeResolution> {
  const origin = await resolveClientOrigin(applicationId);
  const values = await environment();
  const spec = getClientNetworkSpec(applicationId);
  const secretEnv = origin.source === "local"
    ? (spec.localBridgeSecretEnv ?? spec.bridgeSecretEnv ?? null)
    : (spec.bridgeSecretEnv ?? null);
  const secret = secretEnv ? text(values[secretEnv]) : "";
  return { ...origin, secret, secretEnv };
}
