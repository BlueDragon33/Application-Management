import { issueBoiBrowserBridge } from "./boi-ech.server";
import { getControlDatabase } from "./control-device.server";
import { issueHealthBrowserBridge } from "./health-care.server";

type UnknownRecord = Record<string, unknown>;
type Bridge = { baseUrl: string; token: string };

const AUTOMATION_READ_ACTOR = "automation-state@application-management.local";
const AUTOMATION_READ_DEVICE_ID = "0".repeat(64);
const AUTOMATION_READ_TIMEOUT_MS = 4_500;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

async function automationJson(bridge: Bridge, path: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AUTOMATION_READ_TIMEOUT_MS);
  try {
    const response = await fetch(`${bridge.baseUrl}${path}`, {
      method: "GET",
      headers: { authorization: `Bearer ${bridge.token}`, "content-type": "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({})) as UnknownRecord;
    if (!response.ok) {
      throw new Error(typeof payload.error === "string" ? payload.error : `HTTP_${response.status}`);
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

async function readBoiAutoApproval() {
  const bridge = await issueBoiBrowserBridge(AUTOMATION_READ_ACTOR, "viewer");
  const payload = await automationJson(bridge, "/api/control/overview?activityDays=0");
  return record(payload.automation).enabled === true;
}

async function readHealthAutoApproval() {
  const bridge = await issueHealthBrowserBridge(AUTOMATION_READ_ACTOR, "viewer", AUTOMATION_READ_DEVICE_ID);
  const payload = await automationJson(bridge, "/api/control/automation");
  return record(payload.automation).autoApproveDevices === true;
}

async function auditAutoApprovalFallback(supportedAppIds: readonly string[]) {
  const database = await getControlDatabase();
  const rows = await database.prepare(
    "SELECT target, detail_json FROM control_audit_log WHERE action = 'application_auto_approval_updated' ORDER BY id DESC LIMIT 100",
  ).all<{ target: string; detail_json: string }>();
  const decided = new Set<string>();
  const enabled = new Set<string>();
  for (const row of rows.results) {
    if (decided.has(row.target) || !supportedAppIds.includes(row.target)) continue;
    decided.add(row.target);
    try { if (record(JSON.parse(row.detail_json)).enabled === true) enabled.add(row.target); } catch { /* Historic audit metadata is only a resilience fallback. */ }
  }
  return enabled;
}

export async function hashWorkItem(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, "0")).join("");
}

export async function dismissedNotificationHashes(actor: string) {
  const database = await getControlDatabase();
  const row = await database.prepare(
    "SELECT detail_json FROM control_audit_log WHERE actor = ? AND action = 'operations_notifications_cleared' ORDER BY id DESC LIMIT 1",
  ).bind(actor).first<{ detail_json: string }>();
  if (!row) return new Set<string>();
  try {
    const detail = record(JSON.parse(row.detail_json));
    const hashes = Array.isArray(detail.hashes)
      ? detail.hashes.filter((item): item is string => typeof item === "string" && /^[a-f0-9]{64}$/.test(item))
      : [];
    return new Set(hashes);
  } catch {
    return new Set<string>();
  }
}

/**
 * Client-owned automation is the source of truth. The central audit log is
 * consulted only if a client is temporarily unreachable, so a stale audit
 * entry can never override a live policy returned by Bơi ếch or Health_Care.
 */
export async function readAutoApprovalSettings(supportedAppIds: readonly string[]) {
  const fallback = await auditAutoApprovalFallback(supportedAppIds);
  const enabled = new Set<string>();
  const probes = await Promise.allSettled(supportedAppIds.map(async (appId) => {
    if (appId === "boi-ech") return { appId, enabled: await readBoiAutoApproval() };
    if (appId === "health-care") return { appId, enabled: await readHealthAutoApproval() };
    return { appId, enabled: fallback.has(appId) };
  }));

  probes.forEach((probe, index) => {
    const appId = supportedAppIds[index];
    if (probe.status === "fulfilled") {
      if (probe.value.enabled) enabled.add(appId);
    } else if (fallback.has(appId)) {
      enabled.add(appId);
    }
  });

  return {
    autoApproveAppIds: supportedAppIds.filter((id) => enabled.has(id)),
    autoApproveSupportedAppIds: [...supportedAppIds],
  };
}

async function writeAudit(actor: string, action: string, target: string, detail: UnknownRecord) {
  const database = await getControlDatabase();
  await database.prepare(
    "INSERT INTO control_audit_log (actor, action, target, detail_json) VALUES (?, ?, ?, ?)",
  ).bind(actor, action, target, JSON.stringify(detail)).run();
}

export async function rememberDismissedNotifications(actor: string, workItemIds: string[]) {
  const existing = await dismissedNotificationHashes(actor);
  const incoming = await Promise.all(workItemIds.map(hashWorkItem));
  const hashes = [...new Set([...existing, ...incoming])].slice(-240);
  await writeAudit(actor, "operations_notifications_cleared", actor, { hashes, count: hashes.length });
}

export async function rememberAutoApproval(actor: string, appId: string, enabled: boolean) {
  await writeAudit(actor, "application_auto_approval_updated", appId, { enabled, defaultAccessDays: 60, defaultDeviceLimit: 100 });
}
