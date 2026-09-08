import { getControlDatabase } from "./control-device.server";
import {
  listManagedAppDevices,
  type ManagedAppDevice,
  type ManagedAppDeviceStatus,
  type ManagedAppId,
  updateManagedAppDevice,
} from "./managed-app-device.server";

export type ManagedAppDeviceAudit = {
  id: number;
  actor: string;
  action: string;
  target: string;
  detail: Record<string, unknown>;
  createdAt: string;
};

export async function listManagedAppDeviceAudit(appId: ManagedAppId, limit = 150) {
  const database = await getControlDatabase();
  const safeLimit = Math.max(1, Math.min(300, Math.round(limit)));
  const result = await database.prepare(
    `SELECT id, actor, action, target, detail_json, created_at
       FROM control_audit_log
      WHERE action LIKE 'managed_app_device.%' AND target LIKE ?
      ORDER BY id DESC LIMIT ?`,
  ).bind(`${appId}:%`, safeLimit).all<Record<string, unknown>>();

  return result.results.map((row) => {
    let detail: Record<string, unknown> = {};
    try {
      detail = JSON.parse(String(row.detail_json || "{}")) as Record<string, unknown>;
    } catch {
      detail = {};
    }
    return {
      id: Number(row.id),
      actor: String(row.actor || ""),
      action: String(row.action || ""),
      target: String(row.target || ""),
      detail,
      createdAt: String(row.created_at || ""),
    } satisfies ManagedAppDeviceAudit;
  });
}

export async function bulkUpdateManagedAppDevices(input: {
  appId: ManagedAppId;
  deviceIds: unknown;
  status: ManagedAppDeviceStatus;
  actor: string;
}) {
  const raw = Array.isArray(input.deviceIds) ? input.deviceIds : [];
  const deviceIds = [...new Set(raw.filter((value): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value)))].slice(0, 50);
  if (!deviceIds.length) return { updated: [] as ManagedAppDevice[], devices: await listManagedAppDevices(input.appId) };

  const updated: ManagedAppDevice[] = [];
  for (const deviceId of deviceIds) {
    updated.push(await updateManagedAppDevice({
      appId: input.appId,
      deviceId,
      status: input.status,
      actor: input.actor,
    }));
  }

  return { updated, devices: await listManagedAppDevices(input.appId) };
}
