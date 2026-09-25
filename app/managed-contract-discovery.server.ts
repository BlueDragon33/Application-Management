import { contractCategoryProfiles } from "./contract-category-profiles";
import { normalizeManagedOrigin } from "./open-contract.server";
import type { ApplicationCategory } from "./application-registry";

const CONTRACT_SCHEMA = "application-management.contract/v1";
const DISCOVERY_TIMEOUT_MS = 5_000;
const DEFAULT_CANDIDATES = [
  "/api/application-management/contract",
  "/api/control/contract",
  "/management-contract.json",
  "/control/application-management.contract.json",
  "/api/control/status",
] as const;

export type ManagedContractDiscovery = {
  id: string;
  name: string;
  shortName: string;
  category: ApplicationCategory | null;
  categoryRequired: boolean;
  origin: string;
  publicUrl: string;
  repository: string | null;
  contractPath: string;
  protocol: string;
  version: string | null;
  discoveredVia: string;
  credentialRequired: boolean;
  capabilities: string[];
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function validAppId(value: string) {
  return /^[a-z0-9][a-z0-9-]{1,62}$/.test(value);
}

function validContractPath(value: string) {
  return /^\/[a-z0-9._/-]+$/i.test(value)
    && !value.includes("..")
    && !value.includes("//")
    && !value.includes("?")
    && !value.includes("#");
}

function supportedCategory(value: unknown): ApplicationCategory | null {
  const candidate = text(value) as ApplicationCategory;
  return candidate && candidate in contractCategoryProfiles ? candidate : null;
}

function join(basePath: string, path: string) {
  if (!basePath) return path;
  const joined = `${basePath}${path.startsWith("/") ? path : `/${path}`}`;
  return validContractPath(joined) ? joined : "";
}

async function normalizeTarget(value: unknown) {
  const raw = text(value);
  if (!raw) throw new Error("Cần URL control/runtime hoặc URL manifest để khám phá contract.");
  let url: URL;
  try { url = new URL(raw); }
  catch { throw new Error("URL khám phá contract không hợp lệ."); }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("URL khám phá không được chứa credential, query hoặc fragment.");
  }
  const origin = await normalizeManagedOrigin(url.origin);
  const pathname = url.pathname.replace(/\/+$/, "");
  if (!pathname || pathname === "/") {
    return { origin, publicUrl: `${origin}/`, basePath: "", directPath: "" };
  }
  if (!validContractPath(pathname)) throw new Error("Path khám phá contract không hợp lệ.");
  const looksDirect = pathname.endsWith(".json") || pathname.includes("/api/");
  return {
    origin,
    publicUrl: looksDirect ? `${origin}/` : `${origin}${pathname}/`,
    basePath: looksDirect ? "" : pathname,
    directPath: looksDirect ? pathname : "",
  };
}

async function fetchCandidate(origin: string, path: string, credential: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DISCOVERY_TIMEOUT_MS);
  try {
    const response = await fetch(`${origin}${path}`, {
      method: "GET",
      cache: "no-store",
      redirect: "manual",
      headers: credential
        ? { accept: "application/json", authorization: `Bearer ${credential}` }
        : { accept: "application/json" },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("JSON contract không hợp lệ");
    return payload as Record<string, unknown>;
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`timeout_${DISCOVERY_TIMEOUT_MS / 1000}s`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function enabledCapabilities(raw: Record<string, unknown>) {
  const caps = raw.capabilities;
  if (Array.isArray(caps)) {
    return [...new Set(caps.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))];
  }
  const objectCaps = record(caps);
  return Object.entries(objectCaps)
    .filter(([, value]) => value === true)
    .map(([key]) => key);
}

function identityFromContract(raw: Record<string, unknown>) {
  const applicationRaw = raw.application;
  const application = record(applicationRaw);
  const id = (
    typeof applicationRaw === "string"
      ? text(applicationRaw)
      : text(application.id)
  ) || text(raw.canonicalApplication) || text(raw.appId);
  if (!validAppId(id)) throw new Error("Contract chưa công bố application.id hợp lệ.");

  const name = text(application.name) || text(raw.displayName) || id;
  const shortName = text(application.shortName) || text(raw.shortName) || name;
  const rawCategory = text(application.category) || text(raw.category);
  const category = supportedCategory(rawCategory);
  if (rawCategory && !category) {
    throw new Error(`Contract công bố category chưa được Trung tâm hỗ trợ: ${rawCategory}.`);
  }

  const controlService = record(raw.controlService);
  const protocol = text(raw.protocol)
    || text(controlService.protocol)
    || (text(raw.schema) === CONTRACT_SCHEMA
      ? CONTRACT_SCHEMA
      : `legacy-contract-v${text(raw.contractVersion) || text(raw.schemaVersion) || "1"}`);

  return {
    id,
    name,
    shortName,
    category,
    repository: text(application.repository) || text(raw.repository) || null,
    version: text(application.version) || text(raw.contractVersion) || text(raw.schemaVersion) || null,
    protocol,
    capabilities: enabledCapabilities(raw),
  };
}

export async function discoverManagedContractOrigin(input: {
  target: unknown;
  credential?: unknown;
}): Promise<ManagedContractDiscovery> {
  const target = await normalizeTarget(input.target);
  const credential = text(input.credential);
  if (credential.length > 4_096) throw new Error("Credential khám phá vượt quá giới hạn 4096 ký tự.");

  const candidates: Array<{ path: string; credential: string }> = [];
  const add = (path: string, suppliedCredential = "") => {
    if (!path || !validContractPath(path)) return;
    if (!candidates.some((candidate) => candidate.path === path && candidate.credential === suppliedCredential)) {
      candidates.push({ path, credential: suppliedCredential });
    }
  };

  if (target.directPath) {
    add(target.directPath);
    if (credential) add(target.directPath, credential);
  }
  for (const path of DEFAULT_CANDIDATES) {
    add(join(target.basePath, path));
    if (credential) add(join(target.basePath, path), credential);
  }

  const failures: string[] = [];
  for (const candidate of candidates) {
    try {
      const raw = await fetchCandidate(target.origin, candidate.path, candidate.credential);
      const identity = identityFromContract(raw);
      return {
        ...identity,
        categoryRequired: !identity.category,
        origin: target.origin,
        publicUrl: target.publicUrl,
        contractPath: candidate.path,
        discoveredVia: candidate.path,
        credentialRequired: Boolean(candidate.credential),
      };
    } catch (error) {
      failures.push(`${candidate.path}${candidate.credential ? " + credential" : ""}: ${error instanceof Error ? error.message : "không đọc được"}`);
    }
  }

  throw new Error(`Không phát hiện contract tương thích từ URL này. ${failures.join(" · ").slice(0, 1_000)}`);
}
