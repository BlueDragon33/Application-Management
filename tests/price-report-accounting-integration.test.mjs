import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const registry = fs.readFileSync('app/application-registry.ts','utf8');
const operations = fs.readFileSync('app/api/operations/route.ts','utf8');
const server = fs.readFileSync('app/price-report.server.ts','utf8');
const hub = fs.readFileSync('app/application-hub.tsx','utf8');
const admin = fs.readFileSync('app/apps/price-report-tunggiabao/price-report-admin.tsx','utf8');
const page = fs.readFileSync('app/apps/price-report-tunggiabao/page.tsx','utf8');

test('PriceReport is a first-class Kế toán client in the registry', () => {
  assert.match(registry, /id: "price-report-tunggiabao"/);
  assert.match(registry, /category: "Kế toán"/);
  assert.match(registry, /repository: "BlueDragon33\/PriceReport_Tunggiabao"/);
  assert.match(registry, /Namespace KT-|Namespace KT-|namespace KT-/i);
  assert.match(registry, /deviceExperiences: standardDeviceExperiences/);
});

test('operations dashboard probes PriceReport Web contract and live KT control capabilities', () => {
  assert.match(operations, /probePriceReportManagementContract/);
  assert.match(operations, /issuePriceReportBrowserBridge/);
  assert.match(operations, /id: "price-report-tunggiabao", run: \(\) => loadPriceReport\(actor\)/);
  assert.match(operations, /capabilities\.deviceRegistry/);
  assert.match(operations, /capabilities\.deviceApproval/);
  assert.match(operations, /capabilities\.deviceIdempotentCommands/);
  assert.match(operations, /capabilities\.optimisticConcurrency/);
  assert.match(operations, /capabilities\.p256ChallengeProof/);
  assert.match(operations, /capabilities\.revocableDeviceSessions/);
  assert.match(operations, /await bridgeJson\(bridge, devicesPath\)/);
  assert.match(operations, /group: config\.category/);
});

test('PriceReport contract probe enforces accounting boundary and KT device taxonomy', () => {
  assert.match(server, /application\.category === "Kế toán"/);
  assert.match(server, /device\.namespace === "KT-"/);
  assert.match(server, /classes\.includes\("desktop"\)/);
  assert.match(server, /classes\.includes\("tablet"\)/);
  assert.match(server, /classes\.includes\("phone"\)/);
  assert.match(server, /policy\.applicationManagementMayInventOperationsWithoutBackend === false/);
  assert.match(server, /readiness\.deviceRegistry === "available"/);
  assert.match(server, /readiness\.deviceGateway === "available"/);
});

test('accounting admin workspace follows Bauman hierarchy and capability-gates real KT mutations', () => {
  assert.match(page, /getApplicationConfig\("price-report-tunggiabao"\)/);
  assert.match(admin, /type View = "overview" \| "devices" \| "experience" \| "contract"/);
  assert.match(admin, /Thiết bị & quyền/);
  assert.match(admin, /Giao diện thiết bị/);
  assert.match(admin, /Remote registry KT-/);
  assert.match(admin, /operationsAction\(/);
  assert.match(admin, /expectedStatus: device\.status/);
  assert.match(admin, /commandId: crypto\.randomUUID\(\)/);
  assert.match(admin, /!remoteAdminReady/);
});

test('main dashboard exposes the Kế toán group and PriceReport boundary', () => {
  assert.match(hub, /application\.id === "price-report-tunggiabao"/);
  assert.match(hub, /Báo giá · Excel\/PDF\/OCR · thiết bị KT-/);
  assert.match(hub, /group: application\.category/);
});


test('PriceReport bridge issues short-lived HMAC admin tickets for the KT control service', () => {
  assert.match(server, /resolveClientOrigin\("price-report-control"\)/);
  assert.match(server, /PRICE_REPORT_CONTROL_SERVICE_SECRET/);
  assert.match(server, /CONTROL_TOKEN_AUDIENCE = "price-report-control"/);
  assert.match(server, /CONTROL_TOKEN_APP = "price-report-tunggiabao"/);
  assert.match(server, /issuePriceReportBrowserBridge/);
  assert.match(server, /expiresAt = Date\.now\(\) \+ 5 \* 60 \* 1000/);
  assert.match(server, /mode: "capability-gated"/);
});


test('PriceReport device mutations use optimistic concurrency, idempotent command and verified read-back', () => {
  assert.match(operations, /if \(appId === "price-report-tunggiabao"\)/);
  assert.match(operations, /PRICE_REPORT_DEVICE_COMMAND_CONTRACT_NOT_LIVE/);
  assert.match(operations, /expectedStatus !== liveStatus/);
  assert.match(operations, /const commandId = suppliedCommandId \|\| crypto\.randomUUID\(\)/);
  assert.match(operations, /operation: operation === "approve" \? "approve" : "block"/);
  assert.match(operations, /DEVICE_COMMAND_READBACK_MISMATCH/);
  assert.match(operations, /await verifyDeviceStatus\(bridge, devicesPath, deviceId, expected\)/);
});


test('registry copy distinguishes local KT control from production readiness', () => {
  assert.match(registry, /KT Control đã có registry\/device-control thật trong local stack/);
  assert.match(registry, /Production vẫn giữ trạng thái migrating/);
  assert.match(admin, /KT Control live đã xác minh/);
  assert.match(admin, /mọi mutation bị khóa fail-closed/);
});


test('all legacy and Universal Contract device mutations reject missing optimistic-concurrency snapshots', () => {
  const occurrences = operations.match(/code: "INVALID_EXPECTED_STATUS"/g) ?? [];
  assert.ok(occurrences.length >= 6, `expected guards for legacy + Universal paths, got ${occurrences.length}`);
  assert.match(operations, /expectedStatus hợp lệ là bắt buộc cho Universal Contract/);
  assert.match(operations, /dynamicMutationReady/);
  assert.match(operations, /suppliedExpected === "unknown"/);
  assert.doesNotMatch(operations, /suppliedExpected === "unknown" \? liveStatus : suppliedExpected/);
});
