import { issueBoiBrowserBridge } from "./boi-ech.server";
import { issueHealthBrowserBridge, probeHealthManagementContract } from "./health-care.server";
import { issueBaumanBrowserBridge } from "./bauman.server";

const AUTOMATION_READ_ACTOR = "automation-state@application-management.local";
const AUTOMATION_READ_DEVICE_ID = "0".repeat(64);
const AUTOMATION_READ_TIMEOUT_MS = 4_500;

type UnknownRecord = Record<string, unknown>;
type Bridge = { baseUrl: string; token: string };

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
    if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : `HTTP_${response.status}`);
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

async function readBoiAutomation() {
  const bridge = await issueBoiBrowserBridge(AUTOMATION_READ_ACTOR, "viewer");
  const payload = await automationJson(bridge, "/api/control/overview?activityDays=0");
  return {
    autoApproveEnabled: record(payload.automation).enabled === true,
    autoRejectSupported: false,
    autoRejectEnabled: false,
    autoBlockSupported: false,
    autoBlockEnabled: false,
    pendingBlockAfterHours: null as number | null,
  };
}

async function readHealthAutomation() {
  const [bridge, contract] = await Promise.all([
    issueHealthBrowserBridge(AUTOMATION_READ_ACTOR, "viewer", AUTOMATION_READ_DEVICE_ID),
    probeHealthManagementContract(),
  ]);
  const payload = await automationJson(bridge, "/api/control/automation");
  const automation = record(payload.automation);
  const rawHours = Math.round(Number(automation.pendingBlockAfterHours));
  return {
    autoApproveEnabled: automation.autoApproveDevices === true,
    autoRejectSupported: false,
    autoRejectEnabled: false,
    autoBlockSupported: contract.capabilities.includes("device-auto-block-pending"),
    autoBlockEnabled: automation.autoBlockPendingDevices === true,
    pendingBlockAfterHours: [24, 168, 720].includes(rawHours) ? rawHours : 168,
  };
}

async function readBaumanAutomation() {
  const bridge = await issueBaumanBrowserBridge(AUTOMATION_READ_ACTOR, "viewer", AUTOMATION_READ_DEVICE_ID);
  const status = await automationJson(bridge, "/api/control/status");
  const capabilities = record(status.capabilities);
  const endpoints = record(status.endpoints);
  if (capabilities.deviceAutoApproval !== true || endpoints.automation !== "/api/control/automation") {
    throw new Error("BAUMAN_AUTO_APPROVAL_CONTRACT_NOT_LIVE");
  }
  const payload = await automationJson(bridge, "/api/control/automation");
  const automation = record(payload.automation);
  return {
    autoApproveEnabled: automation.autoApproveDevices === true,
    autoRejectSupported: capabilities.deviceAutoReject === true,
    autoRejectEnabled: automation.autoRejectDevices === true,
    autoBlockSupported: false,
    autoBlockEnabled: false,
    pendingBlockAfterHours: null as number | null,
  };
}

/** Read-only policy probes. No registration/device mutation is performed here. */
export async function readClientAutoApprovalStates(supportedAppIds: readonly string[]) {
  return Promise.allSettled(supportedAppIds.map(async (appId) => {
    if (appId === "boi-ech") {
      const state = await readBoiAutomation();
      return { appId, ...state, enabled: state.autoApproveEnabled };
    }
    if (appId === "health-care") {
      const state = await readHealthAutomation();
      return { appId, ...state, enabled: state.autoApproveEnabled };
    }
    if (appId === "bauman-master-ai") {
      const state = await readBaumanAutomation();
      return { appId, ...state, enabled: state.autoApproveEnabled };
    }
    throw new Error(`AUTO_APPROVAL_READER_MISSING_${appId}`);
  }));
}
