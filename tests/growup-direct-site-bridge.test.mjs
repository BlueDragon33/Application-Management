import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const bridge = fs.readFileSync("app/growup.server.ts", "utf8");
const operations = fs.readFileSync("app/api/operations/route.ts", "utf8");
const hub = fs.readFileSync("app/application-hub.tsx", "utf8");
const admin = fs.readFileSync("app/apps/growup-mychildren/growup-admin.tsx", "utf8");
const page = fs.readFileSync("app/apps/growup-mychildren/page.tsx", "utf8");
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

test("operations use the verified GrowUP local control service without promoting production readiness", () => {
  mustContain(operations, [
    'probeGrowUpManagementContract',
    'issueGrowUpBrowserBridge',
    'async function loadGrowUp(actor: ControlDeviceState)',
    '{ id: "growup-mychildren", run: () => loadGrowUp(actor) }',
    'registryInstanceId: bridge.registryInstanceId',
    'remoteAdminReady: contract.remoteAdminReady',
    'if (appId === "growup-mychildren")',
    'GROWUP_REGISTRY_INSTANCE_MISMATCH',
    'await verifyDeviceStatus(bridge, "/api/control/devices", deviceId, expected)',
  ]);
  assert.match(bridge, /childRecordsExposed/);
  assert.match(bridge, /healthRecordsExposed/);
  assert.match(bridge, /GROWUP_CONTROL_LOCAL_BASE_URL/);
  assert.match(bridge, /GROWUP_CONTROL_SERVICE_SECRET/);
});

test("central table opens the verified client URL while admin remains internal", () => {
  mustContain(hub, [
    'const canOpenWeb = Boolean(summary?.directWebAccess && summary.webHref)',
    '<a href={summary?.webHref ?? "#"} target="_blank" rel="noopener noreferrer" className={styles.directAccess}>Truy cập web ↗</a>',
    '<Link href={application.href} className={styles.manageButton}>Vào quản trị →</Link>',
  ]);
  assert.equal(hub.includes('<a href={application.href} target="_blank"'), false);
});

test("GrowUP admin exposes verified direct launch without claiming deep admin readiness", () => {
  mustContain(page, [
    'probeGrowUpManagementContract',
    'site={{ url: siteUrl, error: siteError, remoteAdminReady }}',
  ]);
  mustContain(admin, [
    'Mở Site GrowUP ↗',
    'Mở GrowUP MyChildren ↗',
    'Direct web launch không đồng nghĩa với quyền đọc dữ liệu trẻ em.',
    'siteState.remoteAdminReady ? "Backend sẵn sàng" : "Tiếp tục khóa"',
    'connectOperationsDashboard',
    'remoteAdminReady: summary.remoteAdminReady === true',
  ]);
});
