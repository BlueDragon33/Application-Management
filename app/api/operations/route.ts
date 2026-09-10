import { applicationRegistry } from "../../application-registry";
import { verifyControlProof, type ControlDeviceState } from "../../control-device.server";
import { issueBoiBrowserBridge } from "../../boi-ech.server";
import { issueHealthBrowserBridge, issueHealthWebLaunch } from "../../health-care.server";
import { issueRuLifeBrowserBridge } from "../../ru-life.server";
import { issueBaumanBrowserBridge } from "../../bauman.server";
import { probeGrowUpManagementContract } from "../../growup.server";
import {
  dismissedNotificationHashes,
  hashWorkItem,
  readAutoApprovalSettings,
  rememberAutoApproval,
  rememberAutoBlockPending,
  rememberDismissedNotifications,
} from "../../operations-settings.server";

export const dynamic = "force-dynamic";

const UPSTREAM_TIMEOUT_MS = 4_500;
const RECENT_DEVICE_MS = 7 * 24 * 60 * 60 * 1000;
const AUTO_APPROVE_SUPPORTED_APP_IDS = ["boi-ech", "health-care"] as const;

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
  canApprove: boolean;
  canRemove: boolean;
};

type ClientSummary = {
  appId: string;
  appName: string;
  href: string;
  webHref: string | null;
  managedWebLaunch: boolean;
  group: string;
  connection: "connected" | "warning" | "pending" | "unavailable";
  onlineCount: number | null;
  pendingCount: number | null;
  attentionCount: number | null;
  note: string;
  directWebAccess: boolean;
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
  return Response.json(data, { status, headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" } });
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

async function bridgeJson(bridge: Bridge, path: string, init?: { method?: "GET" | "POST"; body?: UnknownRecord }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch(`${bridge.baseUrl}${path}`, {
      method: init?.method ?? "GET",
      headers: { authorization: `Bearer ${bridge.token}`, "content-type": "application/json" },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({})) as UnknownRecord;
    if (!response.ok) throw new Error(text(data.error, `HTTP_${response.status}`));
    return data;
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`Client phản hồi quá thời hạn ${UPSTREAM_TIMEOUT_MS / 1_000} giây.`);
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

function rows(data: UnknownRecord) {
  return Array.isArray(data.devices) ? data.devices.map(record) : [];
}

function rowByDeviceId(data: UnknownRecord, deviceId: string) {
  return rows(data).find((item) => text(item.deviceId) === deviceId) ?? null;
}

async function verifyDeviceStatus(bridge: Bridge, path: string, deviceId: string, expected: "approved" | "blocked") {
  const state = await bridgeJson(bridge, path);
  const device = rowByDeviceId(state, deviceId);
  if (!device || normalizedStatus(device.status) !== expected) {
    throw new Error(`Client chưa xác nhận trạng thái ${expected} cho thiết bị sau thao tác.`);
  }
  return device;
}

async function verifyDeviceRemoved(bridge: Bridge, path: string, deviceId: string) {
  const state = await bridgeJson(bridge, path);
  if (rowByDeviceId(state, deviceId)) throw new Error("Client chưa xác nhận thiết bị đã được xóa.");
}

function deviceFrom(
  appId: string,
  appName: string,
  href: string,
  raw: unknown,
  options: {
    typeKey: string;
    userKeys: string[];
    environmentKey?: string;
    approve?: boolean;
    remove?: boolean;
    approvalRequiresRegistrationComplete?: boolean;
    requiredApprovalKeys?: string[];
    defaultType?: ClientDevice["deviceType"];
  },
): ClientDevice {
  const row = record(raw);
  const detectedType = normalizedType(row[options.typeKey]);
  const deviceType = detectedType === "unknown" && options.defaultType ? options.defaultType : detectedType;
  const createdAt = text(row.createdAt) || null;
  const status = normalizedStatus(row.status);
  const userLabel = options.userKeys.map((key) => text(row[key])).find(Boolean)
    || text(row.label) || text(row.autoLabel) || text(row.deviceCode) || "Thiết bị chưa gắn người dùng";
  const environmentChanged = options.environmentKey ? bool(row[options.environmentKey]) : false;
  const recent = createdAt ? Date.now() - Date.parse(createdAt) <= RECENT_DEVICE_MS : false;
  const requiredKeysReady = options.requiredApprovalKeys?.length
    ? options.requiredApprovalKeys.every((key) => Boolean(text(row[key])))
    : null;
  const approvalReady = requiredKeysReady ?? (options.approvalRequiresRegistrationComplete === false || bool(row.registrationComplete));
  return {
    appId, appName, href, deviceId: text(row.deviceId), deviceCode: text(row.deviceCode, "—"), deviceType,
    deviceTypeLabel: typeLabel(deviceType), userLabel, status, active: bool(row.active), createdAt,
    lastSeenAt: text(row.lastSeenAt) || text(row.lastActivityAt) || null,
    attention: environmentChanged ? "environment" : recent && status === "pending" ? "new" : "none",
    canApprove: options.approve === true && status === "pending" && approvalReady,
    canRemove: options.remove === true && status !== "blocked",
  };
}

function workFromDevice(device: ClientDevice): WorkItem | null {
  if (device.attention === "environment") {
    return {
      id: `${device.appId}:environment:${device.deviceId}`, appId: device.appId, appName: device.appName, href: device.href,
      kind: "environment", title: "Môi trường thiết bị thay đổi", detail: `${device.deviceCode} · ${device.userLabel}`,
      deviceType: device.deviceTypeLabel, occurredAt: device.lastSeenAt, priority: "high",
    };
  }
  if (device.status === "pending") {
    return {
      id: `${device.appId}:device:${device.deviceId}`, appId: device.appId, appName: device.appName, href: device.href,
      kind: "device", title: "Thiết bị mới chờ duyệt", detail: `${device.deviceCode} · ${device.userLabel}`,
      deviceType: device.deviceTypeLabel, occurredAt: device.createdAt, priority: "normal",
    };
  }
  return null;
}

async function loadBoi(actor: ControlDeviceState) {
  const config = app("boi-ech");
  const bridge = await issueBoiBrowserBridge(actor.email, actor.role);
  const data = await bridgeJson(bridge, "/api/control/overview?activityDays=0");
  const devices = rows(data).map((row) => deviceFrom(config.id, config.shortName, config.href, row, {
    typeKey: "deviceType", userKeys: ["learnerName", "personCode"],
    approve: actor.role === "publisher" || actor.role === "owner", remove: actor.role === "owner",
  }));
  return { config, devices, webHref: bridge.baseUrl, managedWebLaunch: false, hasOperationalData: true };
}

async function loadHealth(actor: ControlDeviceState) {
  const config = app("health-care");
  const bridge = await issueHealthBrowserBridge(actor.email, actor.role, actor.deviceId);
  const data = await bridgeJson(bridge, "/api/control/devices");
  const canManage = actor.role === "publisher" || actor.role === "owner";
  const devices = rows(data).map((row) => deviceFrom(config.id, config.shortName, config.href, row, {
    typeKey: "deviceType",
    userKeys: ["label", "autoLabel"],
    environmentKey: "environmentChanged",
    approve: canManage,
    remove: canManage,
    approvalRequiresRegistrationComplete: false,
  }));
  return { config, devices, webHref: bridge.baseUrl, managedWebLaunch: true, hasOperationalData: true };
}

async function loadRu(actor: ControlDeviceState) {
  const config = app("ru-life");
  const bridge = await issueRuLifeBrowserBridge(actor.email, actor.role, actor.deviceId);
  const data = await bridgeJson(bridge, "/api/control/devices");
  const canManage = actor.role === "publisher" || actor.role === "owner";
  const devices = rows(data).map((row) => deviceFrom(config.id, config.shortName, config.href, row, {
    typeKey: "deviceClass",
    userKeys: ["userName", "userCode", "label"],
    approve: canManage,
    remove: canManage,
    requiredApprovalKeys: ["userName", "userCode"],
  }));
  return { config, devices, webHref: bridge.baseUrl, managedWebLaunch: false, hasOperationalData: true };
}

async function loadBauman(actor: ControlDeviceState) {
  const config = app("bauman-master-ai");
  const bridge = await issueBaumanBrowserBridge(actor.email, actor.role, actor.deviceId);
  await bridgeJson(bridge, "/api/control/status");
  const data = await bridgeJson(bridge, "/api/control/devices");
  const canManage = actor.role === "owner";
  const devices = rows(data).map((row) => deviceFrom(config.id, config.shortName, config.href, row, {
    typeKey: "deviceType",
    userKeys: ["displayName", "label", "platform", "browser"],
    approve: canManage,
    remove: canManage,
    approvalRequiresRegistrationComplete: false,
    defaultType: "desktop",
  }));
  return { config, devices, webHref: bridge.baseUrl, managedWebLaunch: false, hasOperationalData: true };
}

async function loadGrowUp() {
  const config = app("growup-mychildren");
  const contract = await probeGrowUpManagementContract();
  return {
    config,
    devices: [] as ClientDevice[],
    webHref: `${contract.baseUrl}/`,
    managedWebLaunch: false,
    hasOperationalData: contract.remoteAdminReady,
  };
}

function summary(
  config: ReturnType<typeof app>,
  devices: ClientDevice[],
  connection: ClientSummary["connection"],
  note: string,
  webHref: string | null = null,
  managedWebLaunch = false,
  hasOperationalDataOverride?: boolean,
): ClientSummary {
  const connected = connection === "connected";
  const hasOperationalData = hasOperationalDataOverride ?? connected;
  return {
    appId: config.id, appName: config.shortName, href: config.href,
    webHref: connected ? webHref : null,
    managedWebLaunch: connected && managedWebLaunch,
    group: config.id === "health-care" ? "Y tế" : config.id === "ru-life" ? "Nga" : config.id === "boi-ech" ? "Học tập" : config.id === "bauman-master-ai" ? "Học thuật" : "Gia đình",
    connection, onlineCount: hasOperationalData ? devices.filter((device) => device.active).length : null,
    pendingCount: hasOperationalData ? devices.filter((device) => device.status === "pending").length : null,
    attentionCount: hasOperationalData ? devices.filter((device) => device.attention !== "none").length : null,
    note, directWebAccess: connected && Boolean(webHref),
  };
}

async function buildBootstrap(actor: ControlDeviceState) {
  const loaders = [
    { id: "boi-ech", run: () => loadBoi(actor) },
    { id: "health-care", run: () => loadHealth(actor) },
    { id: "ru-life", run: () => loadRu(actor) },
    { id: "bauman-master-ai", run: () => loadBauman(actor) },
    { id: "growup-mychildren", run: () => loadGrowUp() },
  ] as const;
  const settled = await Promise.all(loaders.map(async (loader) => {
    try { return { id: loader.id, ok: true as const, value: await loader.run() }; }
    catch (error) { return { id: loader.id, ok: false as const, error: error instanceof Error ? error.message : "Không thể kết nối client." }; }
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
      workItems.push({ id: `${config.id}:connection`, appId: config.id, appName: config.shortName, href: config.href, kind: "connection", title: "Không đọc được trạng thái client", detail: result.error, deviceType: "—", occurredAt: null, priority: "high" });
      continue;
    }
    devices.push(...result.value.devices);
    const note = result.id === "growup-mychildren"
      ? `${config.contractNote} Direct site contract đã xác minh; dữ liệu trẻ em vẫn ở phía GrowUP.`
      : config.contractNote;
    summaries.push(summary(
      config,
      result.value.devices,
      "connected",
      note,
      result.value.webHref,
      result.value.managedWebLaunch,
      result.value.hasOperationalData,
    ));
    for (const device of result.value.devices) {
      const item = workFromDevice(device);
      if (item) workItems.push(item);
    }
  }

  workItems.sort((a, b) => {
    const priority = { high: 0, normal: 1, info: 2 } as const;
    if (priority[a.priority] !== priority[b.priority]) return priority[a.priority] - priority[b.priority];
    return (b.occurredAt ? Date.parse(b.occurredAt) : 0) - (a.occurredAt ? Date.parse(a.occurredAt) : 0);
  });
  devices.sort((a, b) => (b.createdAt ? Date.parse(b.createdAt) : 0) - (a.createdAt ? Date.parse(a.createdAt) : 0));

  const hidden = await dismissedNotificationHashes(actor.email);
  const visibleWorkItems = (await Promise.all(workItems.slice(0, 60).map(async (item) => ({ item, hash: await hashWorkItem(item.id) }))))
    .filter(({ hash }) => !hidden.has(hash)).map(({ item }) => item);
  return {
    actor: { deviceCode: actor.deviceCode, role: actor.role }, generatedAt: new Date().toISOString(), summaries, devices,
    workItems: visibleWorkItems, settings: await readAutoApprovalSettings(AUTO_APPROVE_SUPPORTED_APP_IDS),
    metrics: {
      applications: applicationRegistry.length,
      pendingDevices: devices.filter((device) => device.status === "pending").length,
      alerts: visibleWorkItems.filter((item) => item.priority === "high").length,
      workItems: visibleWorkItems.length,
    },
  };
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const previewRequest = ["terminal.local", "localhost"].includes(new URL(request.url).hostname);
    const actor = await verifyControlProof(payload, undefined, previewRequest);
    const action = typeof payload.action === "string" ? payload.action : "bootstrap";
    if (action === "bootstrap") return json(await buildBootstrap(actor));

    if (action === "launch-client-web") {
      const appId = text(payload.appId);
      if (appId !== "health-care") return json({ error: "Client này chưa công bố direct web launch do control-plane quản lý.", code: "WEB_LAUNCH_CONTRACT_MISSING" }, 409);
      const launch = await issueHealthWebLaunch(actor.email, actor.role, actor.deviceId);
      return json({ ok: true, ...launch });
    }

    if (action === "dismiss-notifications") {
      const workItemIds = Array.isArray(payload.workItemIds)
        ? payload.workItemIds.filter((item): item is string => typeof item === "string" && item.length > 0 && item.length <= 300).slice(0, 60) : [];
      if (!workItemIds.length) return json({ ok: true, dismissedIds: [] });
      await rememberDismissedNotifications(actor.email, workItemIds);
      return json({ ok: true, dismissedIds: workItemIds });
    }

    if (action === "set-auto-approval") {
      if (actor.role !== "owner") return json({ error: "Chỉ Chủ hệ thống được đổi quy tắc duyệt tự động.", code: "OWNER_REQUIRED" }, 403);
      const appIds = Array.isArray(payload.appIds) ? [...new Set(payload.appIds.filter((item): item is string => typeof item === "string"))] : [];
      const known = new Set<string>(applicationRegistry.map((item) => item.id));
      if (appIds.some((id) => !known.has(id))) return json({ error: "Danh sách ứng dụng không hợp lệ.", code: "INVALID_APPLICATIONS" }, 400);
      const unsupported = appIds.filter((id) => !AUTO_APPROVE_SUPPORTED_APP_IDS.includes(id as typeof AUTO_APPROVE_SUPPORTED_APP_IDS[number]));
      if (unsupported.length) return json({ error: "Một số ứng dụng chưa công bố contract duyệt tự động.", code: "AUTO_APPROVAL_CONTRACT_MISSING" }, 409);

      const current = await readAutoApprovalSettings(AUTO_APPROVE_SUPPORTED_APP_IDS);
      const enabledBefore = new Set(current.autoApproveAppIds);
      const boiEnabled = appIds.includes("boi-ech");
      const healthEnabled = appIds.includes("health-care");

      if (enabledBefore.has("boi-ech") !== boiEnabled) {
        const bridge = await issueBoiBrowserBridge(actor.email, actor.role);
        await bridgeJson(bridge, "/api/control/overview", {
          method: "POST",
          body: { action: "update-automation", enabled: boiEnabled, defaultAccessDays: 60, defaultDeviceLimit: 100 },
        });
        await rememberAutoApproval(actor.email, "boi-ech", boiEnabled);
      }

      if (enabledBefore.has("health-care") !== healthEnabled) {
        const bridge = await issueHealthBrowserBridge(actor.email, actor.role, actor.deviceId);
        await bridgeJson(bridge, "/api/control/automation", {
          method: "POST",
          body: { autoApproveDevices: healthEnabled },
        });
        await rememberAutoApproval(actor.email, "health-care", healthEnabled);
      }

      return json({ ok: true, settings: await readAutoApprovalSettings(AUTO_APPROVE_SUPPORTED_APP_IDS) });
    }

    if (action === "set-auto-block-pending") {
      if (actor.role !== "owner") return json({ error: "Chỉ Chủ hệ thống được đổi quy tắc tự động khóa thiết bị.", code: "OWNER_REQUIRED" }, 403);
      const appId = text(payload.appId);
      if (appId !== "health-care") return json({ error: "Ứng dụng chưa công bố contract tự động khóa pending an toàn.", code: "AUTO_BLOCK_CONTRACT_MISSING" }, 409);
      if (typeof payload.enabled !== "boolean") return json({ error: "Trạng thái tự động khóa không hợp lệ.", code: "INVALID_AUTO_BLOCK_STATE" }, 400);
      const pendingBlockAfterHours = Math.round(Number(payload.pendingBlockAfterHours));
      if (![24, 168, 720].includes(pendingBlockAfterHours)) return json({ error: "Ngưỡng tự động khóa phải là 24 giờ, 7 ngày hoặc 30 ngày.", code: "INVALID_AUTO_BLOCK_THRESHOLD" }, 400);

      const current = await readAutoApprovalSettings(AUTO_APPROVE_SUPPORTED_APP_IDS);
      if (!current.autoBlockPendingSupportedAppIds.includes(appId)) {
        return json({ error: "Contract production của Sức khỏe Y tế chưa xác nhận tự động khóa pending.", code: "AUTO_BLOCK_CONTRACT_NOT_LIVE" }, 409);
      }

      const bridge = await issueHealthBrowserBridge(actor.email, actor.role, actor.deviceId);
      const updated = await bridgeJson(bridge, "/api/control/automation", {
        method: "POST",
        body: { autoBlockPendingDevices: payload.enabled, pendingBlockAfterHours },
      });
      const automation = record(updated.automation);
      if (automation.autoBlockPendingDevices !== payload.enabled || Number(automation.pendingBlockAfterHours) !== pendingBlockAfterHours) {
        return json({ error: "Client chưa xác nhận quy tắc tự động khóa sau khi cập nhật.", code: "AUTO_BLOCK_READBACK_MISMATCH" }, 502);
      }
      await rememberAutoBlockPending(actor.email, appId, payload.enabled, pendingBlockAfterHours);
      return json({ ok: true, settings: await readAutoApprovalSettings(AUTO_APPROVE_SUPPORTED_APP_IDS) });
    }

    if (action === "manage-client-device") {
      const operation = payload.operation;
      const appId = text(payload.appId);
      const deviceId = text(payload.deviceId);
      const deviceCode = text(payload.deviceCode).toUpperCase();
      if (operation !== "approve" && operation !== "remove") return json({ error: "Thao tác thiết bị không hợp lệ.", code: "INVALID_DEVICE_OPERATION" }, 400);
      if (!/^[a-f0-9]{64}$/.test(deviceId)) return json({ error: "Mã thiết bị không hợp lệ.", code: "INVALID_DEVICE_ID" }, 400);

      if (appId === "health-care") {
        if (actor.role !== "publisher" && actor.role !== "owner") return json({ error: "Vai trò hiện tại không được thay đổi thiết bị Health_Care.", code: "PUBLISHER_REQUIRED" }, 403);
        const bridge = await issueHealthBrowserBridge(actor.email, actor.role, actor.deviceId);
        const expected = operation === "approve" ? "approved" as const : "blocked" as const;
        await bridgeJson(bridge, "/api/control/devices", { method: "POST", body: { action: operation === "approve" ? "approve" : "block", deviceId } });
        await verifyDeviceStatus(bridge, "/api/control/devices", deviceId, expected);
        return json({ ok: true, verified: true, verifiedStatus: expected, ...(operation === "approve" ? { approvedDeviceId: deviceId } : { removedDeviceId: deviceId }) });
      }

      if (appId === "ru-life") {
        if (actor.role !== "publisher" && actor.role !== "owner") return json({ error: "Vai trò hiện tại không được thay đổi thiết bị Hòa nhập Nga.", code: "PUBLISHER_REQUIRED" }, 403);
        const bridge = await issueRuLifeBrowserBridge(actor.email, actor.role, actor.deviceId);
        const before = await bridgeJson(bridge, "/api/control/devices");
        const current = rowByDeviceId(before, deviceId);
        if (!current) return json({ error: "Thiết bị Hòa nhập Nga không còn trong registry.", code: "DEVICE_NOT_FOUND" }, 404);
        if (operation === "approve") {
          const userName = text(current.userName);
          const userCode = text(current.userCode);
          if (!userName || !userCode) return json({ error: "Cần gắn Họ tên và Mã người dùng trong quản trị Hòa nhập Nga trước khi duyệt.", code: "USER_BINDING_REQUIRED" }, 409);
          await bridgeJson(bridge, "/api/control/devices", { method: "POST", body: { targetDeviceId: deviceId, operation: "approve", userName, userCode } });
          await verifyDeviceStatus(bridge, "/api/control/devices", deviceId, "approved");
          return json({ ok: true, verified: true, verifiedStatus: "approved", approvedDeviceId: deviceId });
        }
        await bridgeJson(bridge, "/api/control/devices", { method: "POST", body: { targetDeviceId: deviceId, operation: "block" } });
        await verifyDeviceStatus(bridge, "/api/control/devices", deviceId, "blocked");
        return json({ ok: true, verified: true, verifiedStatus: "blocked", removedDeviceId: deviceId });
      }

      if (appId === "bauman-master-ai") {
        if (actor.role !== "owner") return json({ error: "Bauman yêu cầu quyền Chủ hệ thống để thay đổi thiết bị.", code: "OWNER_REQUIRED" }, 403);
        const bridge = await issueBaumanBrowserBridge(actor.email, actor.role, actor.deviceId);
        const expected = operation === "approve" ? "approved" as const : "blocked" as const;
        await bridgeJson(bridge, "/api/control/devices", { method: "POST", body: { action: operation === "approve" ? "approve" : "block", deviceId } });
        await verifyDeviceStatus(bridge, "/api/control/devices", deviceId, expected);
        return json({ ok: true, verified: true, verifiedStatus: expected, ...(operation === "approve" ? { approvedDeviceId: deviceId } : { removedDeviceId: deviceId }) });
      }

      if (appId !== "boi-ech") return json({ error: "Client chưa hỗ trợ thao tác này.", code: "CLIENT_ACTION_UNAVAILABLE" }, 409);
      const bridge = await issueBoiBrowserBridge(actor.email, actor.role);
      if (operation === "approve") {
        if (actor.role !== "publisher" && actor.role !== "owner") return json({ error: "Vai trò hiện tại không được duyệt thiết bị.", code: "PUBLISHER_REQUIRED" }, 403);
        await bridgeJson(bridge, "/api/control/overview", { method: "POST", body: { action: "grant-free", deviceId } });
        const state = await bridgeJson(bridge, "/api/control/overview?activityDays=0");
        const updated = rowByDeviceId(state, deviceId);
        if (!updated || normalizedStatus(updated.status) === "pending") throw new Error("Bơi ếch chưa xác nhận quyền truy cập sau thao tác duyệt.");
        return json({ ok: true, verified: true, approvedDeviceId: deviceId });
      }
      if (actor.role !== "owner") return json({ error: "Chỉ Chủ hệ thống được xóa thiết bị Bơi ếch.", code: "OWNER_REQUIRED" }, 403);
      if (!/^BE-[A-Z0-9-]{8,60}$/.test(deviceCode)) return json({ error: "Mã xác nhận thiết bị Bơi ếch không hợp lệ.", code: "INVALID_DEVICE_CODE" }, 400);
      await bridgeJson(bridge, "/api/control/overview", { method: "POST", body: { action: "delete-spam-device", deviceId, confirmDeviceCode: deviceCode, deleteReason: "spam" } });
      await verifyDeviceRemoved(bridge, "/api/control/overview?activityDays=0", deviceId);
      return json({ ok: true, verified: true, verifiedStatus: "deleted", removedDeviceId: deviceId });
    }
    return json({ error: "Thao tác điều phối không hợp lệ.", code: "INVALID_OPERATIONS_ACTION" }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Không thể tải bảng điều phối.", code: "OPERATIONS_UNAVAILABLE" }, 500);
  }
}
