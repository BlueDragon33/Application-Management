import { applicationRegistry } from "../../application-registry";
import { issueBaumanBrowserBridge } from "../../bauman.server";
import { issueBoiBrowserBridge } from "../../boi-ech.server";
import { verifyControlProof } from "../../control-device.server";
import { issueHealthBrowserBridge } from "../../health-care.server";
import { readAutoApprovalSettings, rememberAutoApproval } from "../../operations-settings.server";
import { executeUniversalAutomationCommand, probeDynamicManagedApplications } from "../../open-contract.server";
import { issueRuLifeBrowserBridge } from "../../ru-life.server";

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

const AUTOMATION_READBACK_DELAYS = [0, 120, 280, 600, 1_000] as const;

function automationState(value: unknown) {
  return record(record(value).automation);
}

function autoApproveMatches(value: unknown, enabled: boolean) {
  return automationState(value).autoApproveDevices === enabled;
}

function boiAutomationMatches(value: unknown, enabled: boolean, defaultAccessDays: number, defaultDeviceLimit: number) {
  const state = automationState(value);
  return state.enabled === enabled
    && Number(state.defaultAccessDays) === defaultAccessDays
    && Number(state.defaultDeviceLimit) === defaultDeviceLimit;
}

async function waitForBridgeAutomationReadback(
  bridge: Bridge,
  path: string,
  matches: (value: UnknownRecord) => boolean,
  label: string,
) {
  let observed: UnknownRecord = {};
  for (const delay of AUTOMATION_READBACK_DELAYS) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    const readback = await bridgeJson(bridge, path);
    observed = automationState(readback);
    if (matches(readback)) return observed;
  }
  throw new Error(label + " đã nhận lệnh nhưng readback độc lập chưa hội tụ.");
}

async function setBoi(actor: { email: string; role: "viewer" | "reviewer" | "publisher" | "owner" }, enabled: boolean, defaultAccessDays: number, defaultDeviceLimit: number) {
  const bridge = await issueBoiBrowserBridge(actor.email, actor.role);
  const updated = await bridgeJson(bridge, "/api/control/overview", {
    method: "POST",
    body: { action: "update-automation", enabled, defaultAccessDays, defaultDeviceLimit },
  });
  if (!boiAutomationMatches(updated, enabled, defaultAccessDays, defaultDeviceLimit)) {
    throw new Error("Bơi ếch không trả lại đúng cấu hình vừa ghi.");
  }
  await waitForBridgeAutomationReadback(
    bridge,
    "/api/control/overview?activityDays=0",
    (value) => boiAutomationMatches(value, enabled, defaultAccessDays, defaultDeviceLimit),
    "Bơi ếch",
  );
}

async function setHealth(actor: { email: string; role: "viewer" | "reviewer" | "publisher" | "owner"; deviceId: string }, enabled: boolean) {
  const bridge = await issueHealthBrowserBridge(actor.email, actor.role, actor.deviceId);
  const updated = await bridgeJson(bridge, "/api/control/automation", { method: "POST", body: { autoApproveDevices: enabled } });
  if (!autoApproveMatches(updated, enabled)) throw new Error("Sức khỏe Y tế không trả lại đúng quy tắc vừa ghi.");
  await waitForBridgeAutomationReadback(bridge, "/api/control/automation", (value) => autoApproveMatches(value, enabled), "Sức khỏe Y tế");
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
  if (!autoApproveMatches(updated, enabled)) throw new Error("Bauman không trả lại đúng quy tắc vừa ghi.");
  await waitForBridgeAutomationReadback(bridge, "/api/control/automation", (value) => autoApproveMatches(value, enabled), "Bauman");
}

async function setRuLife(actor: { email: string; role: "viewer" | "reviewer" | "publisher" | "owner"; deviceId: string }, enabled: boolean) {
  const bridge = await issueRuLifeBrowserBridge(actor.email, actor.role, actor.deviceId);
  const status = await bridgeJson(bridge, "/api/control/status");
  if (status.application !== "ru-life" || record(status.capabilities).deviceAutoApproval !== true
      || record(status.endpoints).automation !== "/api/control/automation") {
    throw new Error("Contract duyệt tự động Hòa nhập Nga chưa sẵn sàng.");
  }
  const updated = await bridgeJson(bridge, "/api/control/automation", { method: "POST", body: { autoApproveDevices: enabled } });
  const returned = automationState(updated);
  if (Object.keys(returned).length > 0 && returned.autoApproveDevices !== enabled) {
    throw new Error("Hòa nhập Nga không trả lại đúng quy tắc vừa ghi.");
  }
  await waitForBridgeAutomationReadback(bridge, "/api/control/automation", (value) => autoApproveMatches(value, enabled), "Hòa nhập Nga");
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
    const targets = Array.isArray(payload.targetAppIds)
      ? [...new Set(payload.targetAppIds.filter((item): item is string => typeof item === "string"))]
      : [...CANDIDATE_APP_IDS];
    if (!targets.length) {
      return json({ error: "Danh sách ứng dụng cần sửa không hợp lệ.", code: "INVALID_AUTO_APPROVAL_TARGETS" }, 400);
    }

    const specializedTargets = targets.filter((appId): appId is CandidateAppId =>
      CANDIDATE_APP_IDS.includes(appId as CandidateAppId),
    );
    const needsDynamicProbe = specializedTargets.length !== targets.length;
    const dynamicSnapshots = needsDynamicProbe ? await probeDynamicManagedApplications(targets) : [];
    const known = new Set([
      ...applicationRegistry.map((item) => item.id),
      ...CANDIDATE_APP_IDS,
      ...dynamicSnapshots.map((item) => item.config.id),
    ]);
    if (requested.some((id) => !known.has(id))) {
      return json({ error: "Danh sách ứng dụng không hợp lệ.", code: "INVALID_APPLICATIONS" }, 400);
    }
    if (targets.some((id) => !known.has(id))) {
      return json({ error: "Danh sách ứng dụng cần sửa không hợp lệ.", code: "INVALID_AUTO_APPROVAL_TARGETS" }, 400);
    }

    // Mutation is a single-app transaction in normal UI usage. Read only the
    // requested targets so a slow unrelated client cannot block this save.
    const current = await readAutoApprovalSettings([], targets, dynamicSnapshots, specializedTargets);
    const policyMap = new Map(current.automationPolicies.map((policy) => [policy.appId, policy]));
    const blockedTarget = targets.find((appId) => {
      const policy = policyMap.get(appId);
      return !policy?.support.autoApprove || !policy.mutation.autoApprove || policy.verification.state !== "live";
    });
    if (blockedTarget) {
      return json({
        error: "Cần đọc được automation contract live và mutation capability của ứng dụng trước khi sửa.",
        code: "AUTO_APPROVAL_CONTRACT_NOT_LIVE",
        appId: blockedTarget,
      }, 409);
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
      const policy = policyMap.get(appId)!;
      const changed = policy.current.autoApprove !== desired || appId === "boi-ech" && desired && (
        current.freeAccessDaysByApp?.[appId] !== defaultAccessDays
        || current.freeDeviceLimitByApp?.[appId] !== defaultDeviceLimit
      );
      if (!changed) continue;

      const dynamicSnapshot = dynamicSnapshots.find((item) => item.config.id === appId);
      const manifest = dynamicSnapshot?.manifest;
      const genericReady = appId !== "boi-ech" && Boolean(
        dynamicSnapshot?.automation
        && manifest?.endpoints.automation
        && manifest.capabilities.deviceAutoApproval === true
        && manifest.capabilities.automationIdempotentCommands === true
        && manifest.capabilities.automationOptimisticConcurrency === true
      );

      if (genericReady) {
        await executeUniversalAutomationCommand({
          appId,
          commandId: crypto.randomUUID(),
          expected: { autoApproveDevices: policy.current.autoApprove },
          desired: { autoApproveDevices: desired },
        }, actor);
        await rememberAutoApproval(actor.email, appId, desired);
        continue;
      }

      if (appId === "boi-ech") {
        await setBoi(actor, desired, defaultAccessDays, defaultDeviceLimit);
        await rememberAutoApproval(actor.email, appId, desired, { defaultAccessDays, defaultDeviceLimit });
        continue;
      }
      if (appId === "health-care") await setHealth(actor, desired);
      else if (appId === "ru-life") await setRuLife(actor, desired);
      else if (appId === "bauman-master-ai") await setBauman(actor, desired);
      else {
        return json({
          error: `Ứng dụng ${appId} chưa có Universal automation mutation contract hoàn chỉnh.`,
          code: "AUTO_APPROVAL_CONTRACT_MISSING",
          appId,
        }, 409);
      }
      await rememberAutoApproval(actor.email, appId, desired);
    }

    const refreshedDynamic = needsDynamicProbe ? await probeDynamicManagedApplications(targets) : [];
    const settings = await readAutoApprovalSettings([], targets, refreshedDynamic, specializedTargets);
    return json({ ok: true, settings });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Không thể cập nhật duyệt tự động.", code: "AUTO_APPROVAL_UPDATE_FAILED" }, 500);
  }
}
