import { applicationRegistry } from "../../application-registry";
import { verifyControlProof } from "../../control-device.server";
import { issueBoiBrowserBridge } from "../../boi-ech.server";
import { issueHealthBrowserBridge } from "../../health-care.server";
import { issueRuLifeBrowserBridge } from "../../ru-life.server";
import { issueBaumanBrowserBridge } from "../../bauman.server";

export const dynamic = "force-dynamic";

const UPSTREAM_TIMEOUT_MS = 6_000;
const RECENT_DEVICE_MS = 7 * 24 * 60 * 60 * 1000;

type Bridge = { baseUrl: string; token: string; expiresAt: number };
type UnknownRecord = Record<string, unknown>;

type ClientDevice = {
  appId: string;
  appName: string;
  href: string;
  deviceId: string;
  deviceCode: string;
  deviceType: "desktop" | "phone" | "tablet" | "unknown";
  deviceTypeLabel: string;
  userLabel: string;
  status: "pending" | "approved" | "blocked" | "unknown";
  active: boolean;
  createdAt: string | null;
  lastSeenAt: string | null;
  attention: "new" | "environment" | "none";
};

type ClientSummary = {
  appId: string;
  appName: string;
  href: string;
  group: string;
  connection: "connected" | "warning" | "pending" | "unavailable";
  onlineCount: number | null;
  pendingCount: number | null;
  attentionCount: number | null;
  note: string;
};

type WorkItem = {
  id: string;
  appId: string;
  appName: string;
  href: string;
  kind: "device" | "environment" | "connection";
  title: string;
  detail: string;
  deviceType: string;
  occurredAt: string | null;
  priority: "high" | "normal" | "info";
};

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store, private",
      "x-content-type-options": "nosniff",
    },
  });
}

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function bool(value: unknown) {
  return value === true;
}

function normalizedStatus(value: unknown): ClientDevice["status"] {
  return value === "pending" || value === "approved" || value === "blocked" ? value : "unknown";
}

function normalizedType(value: unknown): ClientDevice["deviceType"] {
  if (value === "desktop" || value === "computer") return "desktop";
  if (value === "phone") return "phone";
  if (value === "tablet") return "tablet";
  return "unknown";
}

function typeLabel(type: ClientDevice["deviceType"]) {
  return type === "desktop" ? "Máy tính" : type === "phone" ? "Điện thoại" : type === "tablet" ? "Tablet / iPad" : "Chưa phân loại";
}

async function bridgeJson(bridge: Bridge, path: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch(`${bridge.baseUrl}${path}`, {
      method: "GET",
      headers: { authorization: `Bearer ${bridge.token}`, "content-type": "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({})) as UnknownRecord;
    if (!response.ok) throw new Error(text(data.error, `HTTP_${response.status}`));
    return data;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`Client phản hồi quá thời hạn ${UPSTREAM_TIMEOUT_MS / 1_000} giây.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function app(id: string) {
  const item = applicationRegistry.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`UNKNOWN_APPLICATION_${id}`);
  return item;
}

function deviceFrom(
  appId: string,
  appName: string,
  href: string,
  raw: unknown,
  options: { typeKey: string; userKeys: string[]; environmentKey?: string },
): ClientDevice {
  const row = record(raw);
  const deviceType = normalizedType(row[options.typeKey]);
  const createdAt = text(row.createdAt) || null;
  const userLabel = options.userKeys.map((key) => text(row[key])).find(Boolean)
    || text(row.label)
    || text(row.autoLabel)
    || text(row.deviceCode)
    || "Thiết bị chưa gắn người dùng";
  const environmentChanged = options.environmentKey ? bool(row[options.environmentKey]) : false;
  const recent = createdAt ? Date.now() - Date.parse(createdAt) <= RECENT_DEVICE_MS : false;
  return {
    appId,
    appName,
    href,
    deviceId: text(row.deviceId),
    deviceCode: text(row.deviceCode, "—"),
    deviceType,
    deviceTypeLabel: typeLabel(deviceType),
    userLabel,
    status: normalizedStatus(row.status),
    active: bool(row.active),
    createdAt,
    lastSeenAt: text(row.lastSeenAt) || text(row.lastActivityAt) || null,
    attention: environmentChanged ? "environment" : recent && normalizedStatus(row.status) === "pending" ? "new" : "none",
  };
}

function workFromDevice(device: ClientDevice): WorkItem | null {
  if (device.attention === "environment") {
    return {
      id: `${device.appId}:environment:${device.deviceId}`,
      appId: device.appId,
      appName: device.appName,
      href: device.href,
      kind: "environment",
      title: "Môi trường thiết bị thay đổi",
      detail: `${device.deviceCode} · ${device.userLabel}`,
      deviceType: device.deviceTypeLabel,
      occurredAt: device.lastSeenAt,
      priority: "high",
    };
  }
  if (device.status === "pending") {
    return {
      id: `${device.appId}:device:${device.deviceId}`,
      appId: device.appId,
      appName: device.appName,
      href: device.href,
      kind: "device",
      title: "Thiết bị mới chờ duyệt",
      detail: `${device.deviceCode} · ${device.userLabel}`,
      deviceType: device.deviceTypeLabel,
      occurredAt: device.createdAt,
      priority: "normal",
    };
  }
  return null;
}

async function loadBoi(actor: { email: string; role: Parameters<typeof issueBoiBrowserBridge>[1] }) {
  const config = app("boi-ech");
  const bridge = await issueBoiBrowserBridge(actor.email, actor.role);
  const data = await bridgeJson(bridge, "/api/control/overview?activityDays=0");
  const devices = Array.isArray(data.devices)
    ? data.devices.map((row) => deviceFrom(config.id, config.shortName, config.href, row, {
      typeKey: "deviceType",
      userKeys: ["learnerName", "personCode"],
    }))
    : [];
  return { config, devices };
}

async function loadHealth(actor: { email: string; role: Parameters<typeof issueHealthBrowserBridge>[1]; deviceId: string }) {
  const config = app("health-care");
  const bridge = await issueHealthBrowserBridge(actor.email, actor.role, actor.deviceId);
  const data = await bridgeJson(bridge, "/api/control/devices");
  const devices = Array.isArray(data.devices)
    ? data.devices.map((row) => deviceFrom(config.id, config.shortName, config.href, row, {
      typeKey: "deviceType",
      userKeys: ["label", "autoLabel"],
      environmentKey: "environmentChanged",
    }))
    : [];
  return { config, devices };
}

async function loadRu(actor: { email: string; role: Parameters<typeof issueRuLifeBrowserBridge>[1]; deviceId: string }) {
  const config = app("ru-life");
  const bridge = await issueRuLifeBrowserBridge(actor.email, actor.role, actor.deviceId);
  const data = await bridgeJson(bridge, "/api/control/devices");
  const devices = Array.isArray(data.devices)
    ? data.devices.map((row) => deviceFrom(config.id, config.shortName, config.href, row, {
      typeKey: "deviceClass",
      userKeys: ["userName", "userCode", "label"],
    }))
    : [];
  return { config, devices };
}

async function loadBauman(actor: { email: string; role: Parameters<typeof issueBaumanBrowserBridge>[1]; deviceId: string }) {
  const config = app("bauman-master-ai");
  const bridge = await issueBaumanBrowserBridge(actor.email, actor.role, actor.deviceId);
  await bridgeJson(bridge, "/api/control/status");
  return { config, devices: [] as ClientDevice[] };
}

function summary(config: ReturnType<typeof app>, devices: ClientDevice[], connection: ClientSummary["connection"], note: string): ClientSummary {
  const hasOperationalData = connection === "connected";
  return {
    appId: config.id,
    appName: config.shortName,
    href: config.href,
    group: config.id === "health-care" ? "Y tế" : config.id === "ru-life" ? "Nga" : config.id === "boi-ech" ? "Học tập" : config.id === "bauman-master-ai" ? "Học thuật" : "Gia đình",
    connection,
    onlineCount: hasOperationalData ? devices.filter((device) => device.active).length : null,
    pendingCount: hasOperationalData ? devices.filter((device) => device.status === "pending").length : null,
    attentionCount: hasOperationalData ? devices.filter((device) => device.attention !== "none").length : null,
    note,
  };
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const previewRequest = ["terminal.local", "localhost"].includes(new URL(request.url).hostname);
    const actor = await verifyControlProof(payload, undefined, previewRequest);
    const action = typeof payload.action === "string" ? payload.action : "bootstrap";
    if (action !== "bootstrap") return json({ error: "Thao tác điều phối không hợp lệ.", code: "INVALID_OPERATIONS_ACTION" }, 400);

    const loaders = [
      { id: "boi-ech", run: () => loadBoi(actor) },
      { id: "health-care", run: () => loadHealth(actor) },
      { id: "ru-life", run: () => loadRu(actor) },
      { id: "bauman-master-ai", run: () => loadBauman(actor) },
    ] as const;

    const settled = await Promise.all(loaders.map(async (loader) => {
      try {
        return { id: loader.id, ok: true as const, value: await loader.run() };
      } catch (error) {
        return { id: loader.id, ok: false as const, error: error instanceof Error ? error.message : "Không thể kết nối client." };
      }
    }));

    const devices: ClientDevice[] = [];
    const summaries: ClientSummary[] = [];
    const workItems: WorkItem[] = [];

    for (const result of settled) {
      const config = app(result.id);
      if (!result.ok) {
        if (config.contractState !== "connected") {
          const connection = config.contractState === "pending" ? "pending" : "warning";
          summaries.push(summary(config, [], connection, `${config.contractNote} Trạng thái production: ${result.error}`));
          continue;
        }
        summaries.push(summary(config, [], "unavailable", result.error));
        workItems.push({
          id: `${config.id}:connection`, appId: config.id, appName: config.shortName, href: config.href,
          kind: "connection", title: "Không đọc được trạng thái client", detail: result.error,
          deviceType: "—", occurredAt: null, priority: "high",
        });
        continue;
      }
      devices.push(...result.value.devices);
      summaries.push(summary(config, result.value.devices, "connected", config.contractNote));
      for (const device of result.value.devices) {
        const item = workFromDevice(device);
        if (item) workItems.push(item);
      }
    }

    const growup = app("growup-mychildren");
    summaries.push(summary(growup, [], "pending", growup.contractNote));

    workItems.sort((a, b) => {
      const priority = { high: 0, normal: 1, info: 2 } as const;
      if (priority[a.priority] !== priority[b.priority]) return priority[a.priority] - priority[b.priority];
      return (b.occurredAt ? Date.parse(b.occurredAt) : 0) - (a.occurredAt ? Date.parse(a.occurredAt) : 0);
    });
    devices.sort((a, b) => (b.createdAt ? Date.parse(b.createdAt) : 0) - (a.createdAt ? Date.parse(a.createdAt) : 0));

    return json({
      actor: { deviceCode: actor.deviceCode, role: actor.role },
      generatedAt: new Date().toISOString(),
      summaries,
      devices,
      workItems: workItems.slice(0, 60),
      metrics: {
        applications: applicationRegistry.length,
        pendingDevices: devices.filter((device) => device.status === "pending").length,
        alerts: workItems.filter((item) => item.priority === "high").length,
        workItems: workItems.length,
      },
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Không thể tải bảng điều phối.", code: "OPERATIONS_UNAVAILABLE" }, 500);
  }
}
