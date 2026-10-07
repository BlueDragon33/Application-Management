import { readClientAutoApprovalStates } from "./automation-policy-read.server";
import { getControlDatabase } from "./control-device.server";
import type { DynamicContractSnapshot } from "./open-contract.server";

type UnknownRecord = Record<string, unknown>;

type AutoApprovalFallback = {
  enabled: boolean;
  defaultAccessDays?: number;
  defaultDeviceLimit?: number;
  createdAt?: string;
};

type AutoBlockFallback = {
  enabled: boolean;
  pendingBlockAfterHours: number;
  createdAt?: string;
};

export type AppAutomationPolicySnapshot = {
  appId: string;
  support: {
    autoApprove: boolean;
    autoBlockPending: boolean;
    freeAccessPolicy: boolean;
  };
  current: {
    autoApprove?: boolean;
    autoBlockPending?: boolean;
    pendingBlockAfterHours?: number;
    freeAccessDays?: number;
    freeDeviceLimit?: number;
  };
  verification: {
    state: "live" | "fallback" | "unavailable" | "unsupported";
    source: string;
    lastVerifiedAt?: string;
    errorCode?: string;
  };
  mutation: {
    autoApprove: boolean;
    autoBlockPending: boolean;
    reason?: string;
  };
};

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function validDays(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 365 ? parsed : undefined;
}

function validLimit(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 1_000 ? parsed : undefined;
}

function validHours(value: unknown) {
  const parsed = Math.round(Number(value));
  return [24, 168, 720].includes(parsed) ? parsed : 168;
}

function errorCode(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message.trim().slice(0, 160);
  return "AUTOMATION_READ_UNAVAILABLE";
}

function liveSource(appId: string) {
  if (appId === "boi-ech") return "Bơi ếch /api/control/overview";
  if (appId === "health-care") return "Health_Care /api/control/automation";
  if (appId === "bauman-master-ai") return "Bauman /api/control/automation";
  if (appId === "ru-life") return "RU_LIFE /api/control/automation";
  return "client automation contract";
}

async function auditAutoApprovalFallback(supportedAppIds: readonly string[]) {
  const database = await getControlDatabase();
  const rows = await database.prepare(
    "SELECT target, detail_json, created_at FROM control_audit_log WHERE action = 'application_auto_approval_updated' ORDER BY id DESC LIMIT 200",
  ).all<{ target: string; detail_json: string; created_at: string }>();
  const values = new Map<string, AutoApprovalFallback>();
  for (const row of rows.results) {
    if (values.has(row.target) || !supportedAppIds.includes(row.target)) continue;
    try {
      const detail = record(JSON.parse(row.detail_json));
      if (typeof detail.enabled !== "boolean") continue;
      values.set(row.target, {
        enabled: detail.enabled,
        defaultAccessDays: validDays(detail.defaultAccessDays),
        defaultDeviceLimit: validLimit(detail.defaultDeviceLimit),
        createdAt: row.created_at,
      });
    } catch {
      // Historic audit metadata is resilience-only and never overrides a live client read.
    }
  }
  return values;
}

async function auditAutoBlockFallback(supportedAppIds: readonly string[]) {
  const database = await getControlDatabase();
  const rows = await database.prepare(
    "SELECT target, detail_json, created_at FROM control_audit_log WHERE action = 'application_auto_block_pending_updated' ORDER BY id DESC LIMIT 200",
  ).all<{ target: string; detail_json: string; created_at: string }>();
  const values = new Map<string, AutoBlockFallback>();
  for (const row of rows.results) {
    if (values.has(row.target) || !supportedAppIds.includes(row.target)) continue;
    try {
      const detail = record(JSON.parse(row.detail_json));
      if (typeof detail.enabled !== "boolean") continue;
      values.set(row.target, {
        enabled: detail.enabled,
        pendingBlockAfterHours: validHours(detail.pendingBlockAfterHours),
        createdAt: row.created_at,
      });
    } catch {
      // Historic audit metadata is resilience-only and never overrides a live client read.
    }
  }
  return values;
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
 * Client-owned automation is the source of truth.
 * A live client response always wins. Audit state is display resilience only
 * and is explicitly labeled fallback; unsupported apps are never presented
 * as writable merely because they exist in the management inventory.
 */
export async function readAutoApprovalSettings(
  supportedAppIds: readonly string[],
  allAppIds: readonly string[] = supportedAppIds,
  dynamicSnapshots: readonly DynamicContractSnapshot[] = [],
) {
  const effectiveAppIds = [...new Set([...supportedAppIds, "bauman-master-ai", "ru-life"])] as string[];
  const inventoryAppIds = [...new Set([...allAppIds, ...effectiveAppIds])];
  const [approvalFallback, blockFallback, probes] = await Promise.all([
    auditAutoApprovalFallback(effectiveAppIds),
    auditAutoBlockFallback(effectiveAppIds),
    readClientAutoApprovalStates(effectiveAppIds),
  ]);
  const verifiedAt = new Date().toISOString();
  const policies = new Map<string, AppAutomationPolicySnapshot>();

  probes.forEach((probe, index) => {
    const appId = effectiveAppIds[index];
    const savedApproval = approvalFallback.get(appId);
    const savedBlock = blockFallback.get(appId);
    if (probe.status === "fulfilled") {
      const value = probe.value;
      policies.set(appId, {
        appId,
        support: {
          autoApprove: true,
          autoBlockPending: value.autoBlockSupported,
          freeAccessPolicy: appId === "boi-ech",
        },
        current: {
          autoApprove: value.enabled,
          autoBlockPending: value.autoBlockSupported ? value.autoBlockEnabled : undefined,
          pendingBlockAfterHours: value.autoBlockSupported ? value.pendingBlockAfterHours ?? 168 : undefined,
          freeAccessDays: appId === "boi-ech" ? validDays(value.defaultAccessDays) : undefined,
          freeDeviceLimit: appId === "boi-ech" ? validLimit(value.defaultDeviceLimit) : undefined,
        },
        verification: {
          state: "live",
          source: liveSource(appId),
          lastVerifiedAt: verifiedAt,
        },
        mutation: {
          autoApprove: true,
          autoBlockPending: value.autoBlockSupported,
        },
      });
      return;
    }

    const hasFallback = Boolean(savedApproval || savedBlock);
    policies.set(appId, {
      appId,
      support: {
        autoApprove: true,
        autoBlockPending: appId === "health-care" || Boolean(savedBlock),
        freeAccessPolicy: appId === "boi-ech",
      },
      current: {
        autoApprove: savedApproval?.enabled,
        autoBlockPending: savedBlock?.enabled,
        pendingBlockAfterHours: savedBlock?.pendingBlockAfterHours,
        freeAccessDays: appId === "boi-ech" ? savedApproval?.defaultAccessDays : undefined,
        freeDeviceLimit: appId === "boi-ech" ? savedApproval?.defaultDeviceLimit : undefined,
      },
      verification: {
        state: hasFallback ? "fallback" : "unavailable",
        source: hasFallback ? "control_audit_log · last known" : liveSource(appId),
        lastVerifiedAt: savedApproval?.createdAt ?? savedBlock?.createdAt,
        errorCode: errorCode(probe.reason),
      },
      mutation: {
        autoApprove: false,
        autoBlockPending: false,
        reason: "Không đọc được contract automation live; giữ nguyên cấu hình client cho tới khi kết nối được xác minh.",
      },
    });
  });

  for (const snapshot of dynamicSnapshots) {
    const appId = snapshot.config.id;
    // Bơi ếch has domain-specific Free/Paid state that generic automation
    // intentionally does not model.
    if (appId === "boi-ech") continue;
    const manifest = snapshot.manifest;
    if (!manifest?.endpoints.automation) continue;
    const autoApprove = manifest.capabilities.deviceAutoApproval === true;
    const autoBlockPending = manifest.capabilities.deviceAutoBlockPending === true;
    if (!autoApprove && !autoBlockPending) continue;

    const mutationFoundation = Boolean(
      snapshot.credentialConfigured
      && manifest.policy?.remoteAdminReady !== false
      && manifest.capabilities.automationIdempotentCommands === true
      && manifest.capabilities.automationOptimisticConcurrency === true,
    );

    if (snapshot.automation) {
      policies.set(appId, {
        appId,
        support: {
          autoApprove,
          autoBlockPending,
          freeAccessPolicy: false,
        },
        current: {
          autoApprove: autoApprove ? snapshot.automation.autoApproveDevices : undefined,
          autoBlockPending: autoBlockPending ? snapshot.automation.autoBlockPendingDevices : undefined,
          pendingBlockAfterHours: autoBlockPending ? snapshot.automation.pendingBlockAfterHours : undefined,
        },
        verification: {
          state: "live",
          source: `Universal Contract ${manifest.endpoints.automation}`,
          lastVerifiedAt: verifiedAt,
        },
        mutation: {
          autoApprove: autoApprove && mutationFoundation,
          autoBlockPending: autoBlockPending && mutationFoundation,
          ...(!mutationFoundation ? {
            reason: "Automation endpoint đọc được nhưng contract chưa xác nhận credential + idempotency + optimistic concurrency để ghi.",
          } : {}),
        },
      });
      continue;
    }

    if (!policies.has(appId)) {
      const savedApproval = approvalFallback.get(appId);
      const savedBlock = blockFallback.get(appId);
      const hasFallback = Boolean(savedApproval || savedBlock);
      policies.set(appId, {
        appId,
        support: { autoApprove, autoBlockPending, freeAccessPolicy: false },
        current: {
          autoApprove: savedApproval?.enabled,
          autoBlockPending: savedBlock?.enabled,
          pendingBlockAfterHours: savedBlock?.pendingBlockAfterHours,
        },
        verification: {
          state: hasFallback ? "fallback" : "unavailable",
          source: hasFallback ? "control_audit_log · last known" : `Universal Contract ${manifest.endpoints.automation}`,
          lastVerifiedAt: savedApproval?.createdAt ?? savedBlock?.createdAt,
          errorCode: snapshot.automationError ?? "AUTOMATION_CONTRACT_READBACK_UNAVAILABLE",
        },
        mutation: {
          autoApprove: false,
          autoBlockPending: false,
          reason: "Automation contract đã công bố nhưng chưa đọc được trạng thái live; không cho phép ghi mù.",
        },
      });
    }
  }

  for (const appId of inventoryAppIds) {
    if (policies.has(appId)) continue;
    policies.set(appId, {
      appId,
      support: { autoApprove: false, autoBlockPending: false, freeAccessPolicy: false },
      current: {},
      verification: {
        state: "unsupported",
        source: "managed-app inventory",
        errorCode: "AUTOMATION_CONTRACT_NOT_PUBLISHED",
      },
      mutation: {
        autoApprove: false,
        autoBlockPending: false,
        reason: "Ứng dụng chưa công bố contract automation có readback; Trung tâm chỉ hiển thị read-only.",
      },
    });
  }

  const automationPolicies = inventoryAppIds.map((appId) => policies.get(appId)!).filter(Boolean);
  const autoApproveAppIds = automationPolicies.filter((policy) => policy.current.autoApprove === true).map((policy) => policy.appId);
  const autoApproveSupportedAppIds = automationPolicies
    .filter((policy) => policy.verification.state === "live" && policy.support.autoApprove)
    .map((policy) => policy.appId);
  const autoBlockPendingAppIds = automationPolicies.filter((policy) => policy.current.autoBlockPending === true).map((policy) => policy.appId);
  const autoBlockPendingSupportedAppIds = automationPolicies
    .filter((policy) => policy.verification.state === "live" && policy.support.autoBlockPending)
    .map((policy) => policy.appId);
  const pendingBlockAfterHoursByApp = Object.fromEntries(automationPolicies
    .filter((policy) => typeof policy.current.pendingBlockAfterHours === "number")
    .map((policy) => [policy.appId, policy.current.pendingBlockAfterHours!]));
  const freeAccessDaysByApp = Object.fromEntries(automationPolicies
    .filter((policy) => typeof policy.current.freeAccessDays === "number")
    .map((policy) => [policy.appId, policy.current.freeAccessDays!]));
  const freeDeviceLimitByApp = Object.fromEntries(automationPolicies
    .filter((policy) => typeof policy.current.freeDeviceLimit === "number")
    .map((policy) => [policy.appId, policy.current.freeDeviceLimit!]));

  return {
    autoApproveAppIds,
    autoApproveSupportedAppIds,
    autoBlockPendingAppIds,
    autoBlockPendingSupportedAppIds,
    pendingBlockAfterHoursByApp,
    freeAccessDaysByApp,
    freeDeviceLimitByApp,
    automationPolicies,
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

export async function rememberAutoApproval(
  actor: string,
  appId: string,
  enabled: boolean,
  policy?: { defaultAccessDays?: number; defaultDeviceLimit?: number },
) {
  await writeAudit(actor, "application_auto_approval_updated", appId, {
    enabled,
    ...(policy?.defaultAccessDays !== undefined ? { defaultAccessDays: policy.defaultAccessDays } : {}),
    ...(policy?.defaultDeviceLimit !== undefined ? { defaultDeviceLimit: policy.defaultDeviceLimit } : {}),
  });
}

export async function rememberAutoBlockPending(actor: string, appId: string, enabled: boolean, pendingBlockAfterHours: number) {
  await writeAudit(actor, "application_auto_block_pending_updated", appId, { enabled, pendingBlockAfterHours });
}
