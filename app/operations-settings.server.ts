import { getControlDatabase } from "./control-device.server";

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
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

export async function readAutoApprovalSettings(supportedAppIds: readonly string[]) {
  const database = await getControlDatabase();
  const rows = await database.prepare(
    "SELECT target, detail_json FROM control_audit_log WHERE action = 'application_auto_approval_updated' ORDER BY id DESC LIMIT 100",
  ).all<{ target: string; detail_json: string }>();
  const decided = new Set<string>();
  const enabled = new Set<string>();
  for (const row of rows.results) {
    if (decided.has(row.target) || !supportedAppIds.includes(row.target)) continue;
    decided.add(row.target);
    try { if (record(JSON.parse(row.detail_json)).enabled === true) enabled.add(row.target); } catch { /* Ignore malformed historic metadata. */ }
  }
  return { autoApproveAppIds: [...enabled], autoApproveSupportedAppIds: [...supportedAppIds] };
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
