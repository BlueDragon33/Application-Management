import { readClientAutoApprovalStates } from "./automation-policy-read.server";
import { getControlDatabase } from "./control-device.server";

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
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
 * Client-owned automation is the source of truth. A client is advertised as
 * supporting auto approval only after its live policy endpoint answers.
 * Bauman is included as a candidate even while the legacy operations route
 * keeps its older static candidate list, so support can be promoted solely
 * by a live Bauman capability probe. Historic central audit never fabricates support.
 */
export async function readAutoApprovalSettings(supportedAppIds: readonly string[]) {
  const effectiveAppIds = [...new Set([...supportedAppIds, "bauman-master-ai"])] as string[];
  const fallback = await auditAutoApprovalFallback(effectiveAppIds);
  const autoApproveSupported = new Set<string>();
  const autoApproveEnabled = new Set<string>();
  const autoBlockSupported = new Set<string>();
  const autoBlockEnabled = new Set<string>();
  const pendingBlockAfterHoursByApp: Record<string, number> = {};
  const probes = await readClientAutoApprovalStates(effectiveAppIds);

  probes.forEach((probe, index) => {
    const appId = effectiveAppIds[index];
    if (probe.status === "fulfilled") {
      autoApproveSupported.add(appId);
      if (probe.value.enabled) autoApproveEnabled.add(appId);
      if (probe.value.autoBlockSupported) {
        autoBlockSupported.add(appId);
        if (probe.value.autoBlockEnabled) autoBlockEnabled.add(appId);
        pendingBlockAfterHoursByApp[appId] = probe.value.pendingBlockAfterHours ?? 168;
      }
    } else if (fallback.has(appId)) {
      autoApproveEnabled.add(appId);
    }
  });

  return {
    autoApproveAppIds: effectiveAppIds.filter((id) => autoApproveEnabled.has(id)),
    autoApproveSupportedAppIds: effectiveAppIds.filter((id) => autoApproveSupported.has(id)),
    autoBlockPendingAppIds: effectiveAppIds.filter((id) => autoBlockEnabled.has(id)),
    autoBlockPendingSupportedAppIds: effectiveAppIds.filter((id) => autoBlockSupported.has(id)),
    pendingBlockAfterHoursByApp,
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

export async function rememberAutoBlockPending(actor: string, appId: string, enabled: boolean, pendingBlockAfterHours: number) {
  await writeAudit(actor, "application_auto_block_pending_updated", appId, { enabled, pendingBlockAfterHours });
}
