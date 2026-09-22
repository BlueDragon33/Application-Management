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

test('operations dashboard probes PriceReport contract without inventing remote devices', () => {
  assert.match(operations, /probePriceReportManagementContract/);
  assert.match(operations, /id: "price-report-tunggiabao", run: \(\) => loadPriceReport\(\)/);
  assert.match(operations, /group: config\.category/);
  assert.match(operations, /devices: \[\] as ClientDevice\[\]/);
  assert.match(operations, /hasOperationalData: contract\.remoteAdminReady/);
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

test('accounting admin workspace follows Bauman hierarchy but locks fake device mutations', () => {
  assert.match(page, /getApplicationConfig\("price-report-tunggiabao"\)/);
  assert.match(admin, /type View = "overview" \| "devices" \| "experience" \| "contract"/);
  assert.match(admin, /Thiết bị & quyền/);
  assert.match(admin, /Giao diện thiết bị/);
  assert.match(admin, /Remote registry KT-/);
  assert.match(admin, /Duyệt \/ Khóa thiết bị/);
  assert.doesNotMatch(admin, /operationsAction\(/);
});

test('main dashboard exposes the Kế toán group and PriceReport boundary', () => {
  assert.match(hub, /application\.id === "price-report-tunggiabao"/);
  assert.match(hub, /Báo giá · Excel\/PDF\/OCR · thiết bị KT-/);
  assert.match(hub, /group: application\.category/);
});
