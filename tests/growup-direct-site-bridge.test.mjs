import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const bridge = fs.readFileSync("app/growup.server.ts", "utf8");
const operations = fs.readFileSync("app/api/operations/route.ts", "utf8");
const registry = fs.readFileSync("app/application-registry.ts", "utf8");
const hub = fs.readFileSync("app/application-hub.tsx", "utf8");
const admin = fs.readFileSync("app/apps/growup-mychildren/growup-admin.tsx", "utf8");
const page = fs.readFileSync("app/apps/growup-mychildren/page.tsx", "utf8");
const appControl = fs.readFileSync("app/api/apps/growup-mychildren/control/route.ts", "utf8");
const env = fs.readFileSync("cloudflare-env.d.ts", "utf8");

function mustContain(source, snippets) {
  for (const snippet of snippets) assert.ok(source.includes(snippet), `Missing: ${snippet}`);
}

test("GrowUP direct-site bridge verifies the live privacy contract", () => {
  mustContain(bridge, [
    'GROWUP_BASE_URL',
    '/control/application-management.contract.json',
    'application.id === APPLICATION_ID',
    'application.repository === REPOSITORY',
    'boundary.independentRuntime === true',
    'boundary.embeddedInApplicationManagement === false',
    'boundary.childRecordsInControlPlane === false',
    'boundary.healthRecordsInControlPlane === false',
    'requiredDeviceContract.namespace === "GU-"',
    'requiredDeviceContract.accessAndEditSeparated === true',
    'policy.applicationManagementMayInventOperationsWithoutBackend === false',
    'policy.applicationManagementMayReadChildData === false',
    'policy.applicationManagementMayReadHealthData === false',
  ]);
  assert.ok(env.includes('GROWUP_BASE_URL?: string'));
});

test("global operations uses the real GrowUP local registry without promoting production readiness", () => {
  mustContain(operations, [
    'probeGrowUpManagementContract',
    'issueGrowUpBrowserBridge',
    'async function loadGrowUp(actor: ControlDeviceState)',
    '{ id: "growup-mychildren", run: () => loadGrowUp(actor) }',
    'bridgeJson(bridge, "/api/control/devices")',
    'registryInstanceId: bridge.registryInstanceId',
    'webHref: `${contract.baseUrl}/`',
    'Direct site contract và registry GU- đã xác minh; Trung tâm chỉ đồng bộ metadata thiết bị, dữ liệu trẻ em/sức khỏe vẫn ở phía GrowUP.',
    'if (appId === "growup-mychildren")',
    'GROWUP_REGISTRY_INSTANCE_MISMATCH',
  ]);
  mustContain(registry, [
    'id: "growup-mychildren"',
    'contractState: "pending"',
  ]);
  mustContain(bridge, [
    'remoteAdminReady',
    'childRecordsExposed === false',
    'healthRecordsExposed === false',
  ]);
  assert.equal(operations.includes('devices: [] as ClientDevice[]'), false, "GrowUP local registry must no longer be hidden from central operations");
});

test("central table opens the verified client URL while admin remains internal", () => {
  mustContain(hub, [
    'const canOpenWeb = Boolean(summary?.directWebAccess && summary.webHref)',
    '<a href={summary?.webHref ?? "#"} target="_blank" rel="noopener noreferrer" className={styles.directAccess}>Truy cập web ↗</a>',
    '<Link href={application.href} className={styles.manageButton}>Vào quản trị →</Link>',
  ]);
  assert.equal(hub.includes('<a href={application.href} target="_blank"'), false);
});

test("GrowUP admin exposes local E2E control while keeping production readiness separate", () => {
  mustContain(page, [
    'probeGrowUpManagementContract',
    'site={{ url: siteUrl, error: siteError, remoteAdminReady }}',
  ]);
  mustContain(admin, [
    'Mở Site GrowUP ↗',
    'Local control đã kết nối',
    'Production remote admin',
    'Không đánh dấu xanh từ local test',
  ]);
  mustContain(appControl, [
    'verifyControlProof(payload)',
    'GROWUP_REGISTRY_INSTANCE_MISMATCH',
    'DEVICE_COMMAND_READBACK_MISMATCH',
  ]);
});
