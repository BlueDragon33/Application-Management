import { applicationRegistry } from "../../application-registry";
import { issueBaumanBrowserBridge } from "../../bauman.server";
import { issueBoiBrowserBridge } from "../../boi-ech.server";
import { verifyControlProof } from "../../control-device.server";
import { issueHealthBrowserBridge } from "../../health-care.server";
import { readAutoApprovalSettings, rememberAutoApproval } from "../../operations-settings.server";

export const dynamic = "force-dynamic";

const CANDIDATE_APP_IDS = ["boi-ech", "health-care", "bauman-master-ai"] as const;
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

async function setBoi(actor: { email: string; role: "viewer" | "reviewer" | "publisher" | "owner" }, enabled: boolean) {
  const bridge = await issueBoiBrowserBridge(actor.email, actor.role);
  await bridgeJson(bridge, "/api/control/overview", {
    method: "POST",
    body: { action: "update-automation", enabled, defaultAccessDays: 60, defaultDeviceLimit: 100 },
  });
  const readback = await bridgeJson(bridge, "/api/control/overview?activityDays=0");
  if (record(readback.automation).enabled !== enabled) throw new Error("Bơi ếch chưa xác nhận quy tắc duyệt tự động sau cập nhật.");
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
    const known = new Set(applicationRegistry.map((item) => item.id));
    if (requested.some((id) => !known.has(id))) return json({ error: "Danh sách ứng dụng không hợp lệ.", code: "INVALID_APPLICATIONS" }, 400);
    const unsupportedRequested = requested.filter((id) => !CANDIDATE_APP_IDS.includes(id as CandidateAppId));
    if (unsupportedRequested.length) {
      return json({ error: "Một số ứng dụng chưa công bố contract duyệt tự động.", code: "AUTO_APPROVAL_CONTRACT_MISSING", appIds: unsupportedRequested }, 409);
    }
    if (requested.includes("boi-ech")) {
      return json({
        error: "Bơi ếch đang dùng phân loại quyền Miễn phí/Trả phí nên không được bật duyệt tự động từ Trung tâm.",
        code: "BOI_AUTO_APPROVAL_DISABLED_FOR_ACCESS_CLASSIFICATION",
      }, 409);
    }

    const current = await readAutoApprovalSettings(["boi-ech", "health-care"]);
    const enabledBefore = new Set(current.autoApproveAppIds);
    const liveSupported = new Set(current.autoApproveSupportedAppIds);

    for (const appId of CANDIDATE_APP_IDS) {
      const desired = requested.includes(appId);
      const changed = enabledBefore.has(appId) !== desired;
      if (!changed) continue;
      if (appId === "boi-ech") {
        // Bơi ếch may still have legacy auto-approval enabled. New requests can only turn it off,
        // because access must now be classified explicitly as free or paid.
        await setBoi(actor, false);
        await rememberAutoApproval(actor.email, appId, false);
        continue;
      }
      if (!liveSupported.has(appId)) {
        return json({ error: `Contract duyệt tự động của ${appId} chưa hoạt động.`, code: "AUTO_APPROVAL_CONTRACT_NOT_LIVE", appId }, 409);
      }
      if (appId === "health-care") await setHealth(actor, desired);
      else await setBauman(actor, desired);
      await rememberAutoApproval(actor.email, appId, desired);
    }

    return json({ ok: true, settings: await readAutoApprovalSettings(["boi-ech", "health-care"]) });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Không thể cập nhật duyệt tự động.", code: "AUTO_APPROVAL_UPDATE_FAILED" }, 500);
  }
}
