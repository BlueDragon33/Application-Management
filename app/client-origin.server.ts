export type ControlPlaneNetworkMode = "production" | "local" | "hybrid";
export type ManagedClientId = "health-care" | "ru-life" | "boi-ech" | "bauman-master-ai";
export type ClientOriginSource = "production" | "local";

export type ClientOriginResolution = {
  applicationId: ManagedClientId;
  baseUrl: string;
  source: ClientOriginSource;
  mode: ControlPlaneNetworkMode;
};

type ClientOriginSpec = {
  productionEnv: string;
  localEnv: string;
  localDefault: string;
  probePath: string;
};

const PROBE_TIMEOUT_MS = 850;

const CLIENTS: Record<ManagedClientId, ClientOriginSpec> = {
  "health-care": {
    productionEnv: "HEALTH_CARE_BASE_URL",
    localEnv: "HEALTH_CARE_LOCAL_BASE_URL",
    localDefault: "http://127.0.0.1:3001",
    probePath: "/api/control/contract",
  },
  "ru-life": {
    productionEnv: "RU_LIFE_BASE_URL",
    localEnv: "RU_LIFE_LOCAL_BASE_URL",
    localDefault: "http://127.0.0.1:3002",
    probePath: "/api/control/status",
  },
  "bauman-master-ai": {
    productionEnv: "BAUMAN_CONTROL_BASE_URL",
    localEnv: "BAUMAN_CONTROL_LOCAL_BASE_URL",
    localDefault: "http://127.0.0.1:3003",
    probePath: "/api/control/status",
  },
  "boi-ech": {
    productionEnv: "BOI_ECH_BASE_URL",
    localEnv: "BOI_ECH_LOCAL_BASE_URL",
    localDefault: "http://127.0.0.1:3004",
    probePath: "/api/control/overview?activityDays=0",
  },
};

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
  // Existing local-first launcher already uses LOCAL_DEV_AUTH=1. Preserve that
  // workflow and automatically make client bridges local-first while on loopback.
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
  const spec = CLIENTS[applicationId];
  const production = normalizeClientOrigin(values[spec.productionEnv], false);
  const explicitLocal = normalizeClientOrigin(values[spec.localEnv], true);
  // Backwards-compatible local-first development: .dev.vars historically put
  // loopback origins in *_BASE_URL. Treat them as local only when they are
  // actually private HTTP origins; production mode never accepts them.
  const legacyLocal = normalizeClientOrigin(values[spec.productionEnv], true);
  const local = explicitLocal || (legacyLocal && !production ? legacyLocal : "") || spec.localDefault;

  if (mode === "production") {
    if (!production) throw new Error(`${spec.productionEnv} chưa được cấu hình HTTPS.`);
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
  throw new Error(`Không tìm thấy origin local đang hoạt động và ${spec.productionEnv} chưa được cấu hình HTTPS.`);
}
