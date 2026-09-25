import { applicationRegistry } from "../../application-registry";
import { issueBaumanBrowserBridge } from "../../bauman.server";
import { issueBoiBrowserBridge } from "../../boi-ech.server";
import { verifyControlProof } from "../../control-device.server";
import { issueHealthBrowserBridge } from "../../health-care.server";
import { readAutoApprovalSettings, rememberAutoApproval } from "../../operations-settings.server";
import { issueRuLifeBrowserBridge } from "../../ru-life.server";
import { getManagedContract, listManagedContracts, managedContractRequest } from "../../managed-contract-registry.server";

export const dynamic = "force-dynamic";

const CANDIDATE_APP_IDS = ["boi-ech", "health-care", "ru-life", "bauman-master-ai"] as const;
const TIMEOUT_MS = 4_500;
type CandidateAppId = typeof CANDIDATE_APP_IDS[number];
type UnknownRecord = Record<string, unknown>;
type Bridge = { baseUrl: string; token: string };

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" } });
}

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

async function bridgeJson(bridge: Bridge, path: string, init?: { method?: "GET" | "POST"; body?: UnknownRecord }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${bridge.baseUrl}${path}`, {
      method: init?.method ?? "GET",
      headers: { authorization: `Bearer ${bridge.token}`, "content-type": "application/json" },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({})) as UnknownRecord;
    if (!response.ok) throw new Error(text(payload.error, `HTTP_${response.status}`));
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

async function setBoi(actor: { email: string; role: "viewer" | "reviewer" | "publisher" | "owner" }, enabled: boolean, defaultAccessDays: number, defaultDeviceLimit: number) {
  const bridge = await issueBoiBrowserBridge(actor.email, actor.role);
  await bridgeJson(bridge, "/api/control/overview", {
    method: "POST",
    body: { action: "update-automation", enabled, defaultAccessDays, defaultDeviceLimit },
  });
  const readback = await bridgeJson(bridge, "/api/control/overview?activityDays=0");
  const state = record(readback.automation);
  if (state.enabled !== enabled || state.defaultAccessDays !== defaultAccessDays || state.defaultDeviceLimit !== defaultDeviceLimit) {
    throw new Error("Bơi ếch chưa xác nhận quy tắc duyệt tự động và thời hạn sau cập nhật.");
  }
}

async function setHealth(actor: { email: string; role: "viewer" | "reviewer" | "publisher" | "owner"; deviceId: string }, enabled: boolean) {
  const bridge = await issueHealthBrowserBridge(actor.email, actor.role, actor.deviceId);
  const updated = await bridgeJson(bridge, "/api/control/automation", { method: "POST", body: { autoApproveDevices: enabled } });
  if (record(updated.automation).autoApproveDevices !== enabled) throw new Error("Sức khỏe Y tế chưa xác nhận quy tắc duyệt tự động sau cập nhật.");
}

async function setBauman(actor: { email: string; role: "viewer" | "reviewer" | "publisher" | "owner"; deviceId: string }, enabled: boolean) {
  const bridge = await issueBaumanBrowserBridge(actor.email, actor.role, actor.deviceId);
  const status = await bridgeJson(bridge, "/api/control/status");
  const endpoints = record(status.endpoints);
  const capabilities = record(status.capabilities);
  if (capabilities.deviceAutoApproval !== true || endpoints.automation !== "/api/control/automation") {
    throw new Error("Contract duyệt tự động Bauman chưa sẵn sàng.");
  }
  const updated = await bridgeJson(bridge, "/api/control/automation", { method: "POST", body: { autoApproveDevices: enabled } });
  if (record(updated.automation).autoApproveDevices !== enabled) throw new Error("Bauman chưa xác nhận quy tắc duyệt tự động sau cập nhật.");
}

async function setRuLife(actor: { email: string; role: "viewer" | "reviewer" | "publisher" | "owner"; deviceId: string }, enabled: boolean) {
  const bridge = await issueRuLifeBrowserBridge(actor.email, actor.role, actor.deviceId);
  const status = await bridgeJson(bridge, "/api/control/status");
  if (status.application !== "ru-life" || record(status.capabilities).deviceAutoApproval !== true
      || record(status.endpoints).automation !== "/api/control/automation") {
    throw new Error("Contract duyệt tự động Hòa nhập Nga chưa sẵn sàng.");
  }
  await bridgeJson(bridge, "/api/control/automation", { method: "POST", body: { autoApproveDevices: enabled } });
  const readback = await bridgeJson(bridge, "/api/control/automation");
  if (record(readback.automation).autoApproveDevices !== enabled) throw new Error("Hòa nhập Nga chưa xác nhận quy tắc duyệt tự động sau cập nhật.");
}

async function setManagedContractAutomation(appId: string, enabled: boolean) {
  const contract = await getManagedContract(appId);
  const automationPath = contract?.endpoints.automation || contract?.manifest?.endpoints.automation || "";
  if (!contract?.enabled || contract.capabilities.deviceAutoApproval !== true || !automationPath) {
    throw new Error(`Contract duyệt tự động của ${appId} chưa sẵn sàng.`);
  }
  const updated = await managedContractRequest(appId, automationPath, {
    method: "POST",
    body: { autoApproveDevices: enabled },
  });
  if (record(updated.automation).autoApproveDevices !== enabled) {
    const readback = await managedContractRequest(appId, automationPath);
    if (record(readback.automation).autoApproveDevices !== enabled) {
      throw new Error(`${appId} chưa xác nhận quy tắc duyệt tự động sau cập nhật.`);
    }
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as UnknownRecord;
    const previewRequest = ["terminal.local", "localhost"].includes(new URL(request.url).hostname);
    const actor = await verifyControlProof(payload, undefined, previewRequest);
    if (actor.role !== "owner") return json({ error: "Chỉ Chủ hệ thống được đổi quy tắc duyệt tự động.", code: "OWNER_REQUIRED" }, 403);
    if (payload.action !== "set-auto-approval") return json({ error: "Thao tác duyệt tự động không hợp lệ.", code: "INVALID_AUTO_APPROVAL_ACTION" }, 400);

    const requested = Array.isArray(payload.appIds)
      ? [...new Set(payload.appIds.filter((item): item is string => typeof item === "string"))]
      : [];
    const managed = await listManagedContracts();
    const known = new Set<string>([
      ...applicationRegistry.map((item) => item.id),
      ...managed.map((item) => item.applicationId),
    ]);
    if (requested.some((id) => !known.has(id))) return json({ error: "Danh sách ứng dụng không hợp lệ.", code: "INVALID_APPLICATIONS" }, 400);

    const current = await readAutoApprovalSettings(["boi-ech", "health-care"]);
    const enabledBefore = new Set(current.autoApproveAppIds);
    const liveSupported = new Set(current.autoApproveSupportedAppIds);
    const unsupportedRequested = requested.filter((id) => !liveSupported.has(id) && !enabledBefore.has(id));
    if (unsupportedRequested.length) {
      return json({ error: "Một số ứng dụng chưa công bố contract duyệt tự động đang hoạt động.", code: "AUTO_APPROVAL_CONTRACT_MISSING", appIds: unsupportedRequested }, 409);
    }
    const targets = Array.isArray(payload.targetAppIds)
      ? [...new Set(payload.targetAppIds.filter((item): item is string => typeof item === "string"))]
      : [...liveSupported];
    if (!targets.length || targets.some((id) => !known.has(id) || !liveSupported.has(id))) {
      return json({ error: "Danh sách ứng dụng cần sửa không hợp lệ hoặc contract chưa live.", code: "INVALID_AUTO_APPROVAL_TARGETS" }, 400);
    }
    const defaultAccessDays = payload.defaultAccessDays === undefined
      ? current.freeAccessDaysByApp?.["boi-ech"] ?? 60 : Number(payload.defaultAccessDays);
    const defaultDeviceLimit = payload.defaultDeviceLimit === undefined
      ? current.freeDeviceLimitByApp?.["boi-ech"] ?? 20 : Number(payload.defaultDeviceLimit);
    if (!Number.isInteger(defaultAccessDays) || defaultAccessDays < 1 || defaultAccessDays > 365
      || !Number.isInteger(defaultDeviceLimit) || defaultDeviceLimit < 1 || defaultDeviceLimit > 1_000) {
      return json({ error: "Thời hạn miễn phí phải từ 1–365 ngày và hạn mức từ 1–1.000 thiết bị.", code: "INVALID_BOI_FREE_POLICY" }, 400);
    }

    for (const appId of targets) {
      const desired = requested.includes(appId);
      const changed = enabledBefore.has(appId) !== desired || appId === "boi-ech" && desired &&
        (current.freeAccessDaysByApp?.[appId] !== defaultAccessDays || current.freeDeviceLimitByApp?.[appId] !== defaultDeviceLimit);
      if (!changed) continue;
      if (appId === "boi-ech") {
        // Explicit Free mode applies only to unassigned registrations; requests already
        // awaiting or proving payment remain pending until payment verification.
        if (desired && !liveSupported.has(appId)) {
          return json({ error: "Contract duyệt miễn phí của Bơi ếch chưa hoạt động.", code: "AUTO_APPROVAL_CONTRACT_NOT_LIVE", appId }, 409);
        }
        await setBoi(actor, desired, defaultAccessDays, defaultDeviceLimit);
        await rememberAutoApproval(actor.email, appId, desired);
        continue;
      }
      if (!liveSupported.has(appId)) {
        return json({ error: `Contract duyệt tự động của ${appId} chưa hoạt động.`, code: "AUTO_APPROVAL_CONTRACT_NOT_LIVE", appId }, 409);
      }
      if (appId === "health-care") await setHealth(actor, desired);
      else if (appId === "ru-life") await setRuLife(actor, desired);
      else if (appId === "bauman-master-ai") await setBauman(actor, desired);
      else await setManagedContractAutomation(appId, desired);
      await rememberAutoApproval(actor.email, appId, desired);
    }

    return json({ ok: true, settings: await readAutoApprovalSettings(["boi-ech", "health-care"]) });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Không thể cập nhật duyệt tự động.", code: "AUTO_APPROVAL_UPDATE_FAILED" }, 500);
  }
}
