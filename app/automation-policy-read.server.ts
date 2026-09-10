import { issueBoiBrowserBridge } from "./boi-ech.server";
import { issueHealthBrowserBridge } from "./health-care.server";

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

async function readBoiAutoApproval() {
  const bridge = await issueBoiBrowserBridge(AUTOMATION_READ_ACTOR, "viewer");
  const payload = await automationJson(bridge, "/api/control/overview?activityDays=0");
  return record(payload.automation).enabled === true;
}

async function readHealthAutoApproval() {
  const bridge = await issueHealthBrowserBridge(AUTOMATION_READ_ACTOR, "viewer", AUTOMATION_READ_DEVICE_ID);
  const payload = await automationJson(bridge, "/api/control/automation");
  return record(payload.automation).autoApproveDevices === true;
}

/** Read-only policy probes. No registration/device mutation is performed here. */
export async function readClientAutoApprovalStates(supportedAppIds: readonly string[]) {
  return Promise.allSettled(supportedAppIds.map(async (appId) => {
    if (appId === "boi-ech") return { appId, enabled: await readBoiAutoApproval() };
    if (appId === "health-care") return { appId, enabled: await readHealthAutoApproval() };
    throw new Error(`AUTO_APPROVAL_READER_MISSING_${appId}`);
  }));
}
