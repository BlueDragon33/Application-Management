import { controlErrorResponse, verifyControlProof } from "../../../../control-device.server";
import { issueGrowUpBrowserBridge } from "../../../../growup.server";

export const dynamic = "force-dynamic";

const TIMEOUT_MS = 4_500;
type UnknownRecord = Record<string, unknown>;

type Bridge = Awaited<ReturnType<typeof issueGrowUpBrowserBridge>>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizedStatus(value: unknown) {
  return value === "pending" || value === "approved" || value === "blocked" ? value : "unknown";
}

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" } });
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
    const payload = record(await response.json().catch(() => ({})));
    if (!response.ok) return { ok: false as const, status: response.status, payload };
    return { ok: true as const, status: response.status, payload };
  } catch (error) {
    if (controller.signal.aborted) return { ok: false as const, status: 504, payload: { error: `GrowUP Control không phản hồi trong ${TIMEOUT_MS / 1_000} giây.` } };
    return { ok: false as const, status: 502, payload: { error: error instanceof Error ? error.message : "Không kết nối được GrowUP Control." } };
  } finally {
    clearTimeout(timeout);
  }
}

async function bootstrap(bridge: Bridge) {
  const [devicesResult, auditResult] = await Promise.all([
    bridgeJson(bridge, "/api/control/devices"),
    bridgeJson(bridge, "/api/control/audit"),
  ]);
  if (!devicesResult.ok) return json(devicesResult.payload, devicesResult.status);
  if (!auditResult.ok) return json(auditResult.payload, auditResult.status);
  const devices = Array.isArray(devicesResult.payload.devices) ? devicesResult.payload.devices : [];
  const audit = Array.isArray(auditResult.payload.audit) ? auditResult.payload.audit : [];
  return json({
    ok: true,
    application: "growup-mychildren",
    transport: bridge.transport,
    registryInstanceId: bridge.registryInstanceId,
    devices,
    audit,
    generatedAt: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const actor = await verifyControlProof(payload);
    const bridge = await issueGrowUpBrowserBridge();
    const action = text(payload.action) || "bootstrap";

    if (action === "bootstrap") return await bootstrap(bridge);

    if (action === "manage-device") {
      if (actor.role !== "publisher" && actor.role !== "owner") return json({ error: "Vai trò hiện tại không được thay đổi thiết bị GrowUP.", code: "PUBLISHER_REQUIRED" }, 403);
      const deviceId = text(payload.deviceId).toLowerCase();
      const operation = text(payload.operation);
      if (!/^[a-f0-9]{64}$/.test(deviceId)) return json({ error: "Mã thiết bị GrowUP không hợp lệ.", code: "INVALID_DEVICE_ID" }, 400);
      if (operation !== "approve" && operation !== "block") return json({ error: "Thao tác GrowUP không hợp lệ.", code: "INVALID_OPERATION" }, 400);
      const suppliedRegistry = text(payload.registryInstanceId);
      if (suppliedRegistry && bridge.registryInstanceId && suppliedRegistry !== bridge.registryInstanceId) {
        return json({ error: "Registry GrowUP đã thay đổi. Hãy đồng bộ lại trước khi thao tác.", code: "GROWUP_REGISTRY_INSTANCE_MISMATCH", registryInstanceId: bridge.registryInstanceId }, 409);
      }

      const before = await bridgeJson(bridge, "/api/control/devices");
      if (!before.ok) return json(before.payload, before.status);
      const rows = Array.isArray(before.payload.devices) ? before.payload.devices.map(record) : [];
      const current = rows.find((row) => text(row.deviceId).toLowerCase() === deviceId);
      if (!current) return json({ error: "Thiết bị GrowUP không còn trong registry.", code: "DEVICE_NOT_FOUND" }, 404);
      const liveStatus = normalizedStatus(current.status);
      const suppliedExpected = normalizedStatus(payload.expectedStatus);
      const expectedStatus = suppliedExpected === "unknown" ? liveStatus : suppliedExpected;
      if (liveStatus !== expectedStatus) return json({ error: `Snapshot GrowUP đã thay đổi: expected ${expectedStatus}, hiện tại ${liveStatus}.`, code: "DEVICE_STATE_CONFLICT" }, 409);
      if (operation === "approve" && expectedStatus !== "pending") return json({ error: "Thiết bị GrowUP không còn ở trạng thái chờ duyệt.", code: "DEVICE_STATE_CONFLICT" }, 409);
      if (operation === "block" && expectedStatus !== "pending" && expectedStatus !== "approved") return json({ error: "Thiết bị GrowUP đã bị khóa hoặc trạng thái không xác định.", code: "DEVICE_STATE_CONFLICT" }, 409);

      const commandId = crypto.randomUUID();
      const command = await bridgeJson(bridge, bridge.deviceCommandsTarget, {
        method: "POST",
        body: { commandId, deviceId, operation, expectedStatus },
      });
      if (!command.ok) return json(command.payload, command.status);
      const expectedResult = operation === "approve" ? "approved" : "blocked";
      if (text(command.payload.commandId).toLowerCase() !== commandId || normalizedStatus(command.payload.status) !== expectedResult) {
        return json({ error: "GrowUP chưa xác nhận commandId hoặc trạng thái kết quả.", code: "DEVICE_COMMAND_READBACK_MISMATCH" }, 502);
      }

      const after = await bridgeJson(bridge, "/api/control/devices");
      if (!after.ok) return json(after.payload, after.status);
      const updatedRows = Array.isArray(after.payload.devices) ? after.payload.devices.map(record) : [];
      const updated = updatedRows.find((row) => text(row.deviceId).toLowerCase() === deviceId);
      if (!updated || normalizedStatus(updated.status) !== expectedResult) {
        return json({ error: "GrowUP chưa xác nhận trạng thái sau thao tác.", code: "DEVICE_COMMAND_READBACK_MISMATCH" }, 502);
      }
      return json({ ok: true, commandId, verified: true, verifiedStatus: expectedResult, registryInstanceId: bridge.registryInstanceId });
    }

    return json({ error: "Thao tác GrowUP không hợp lệ.", code: "INVALID_GROWUP_ACTION" }, 400);
  } catch (error) {
    return controlErrorResponse(error);
  }
}
