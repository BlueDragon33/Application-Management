import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const contract = fs.readFileSync("app/open-contract.server.ts", "utf8");
const operations = fs.readFileSync("app/api/operations/route.ts", "utf8");
const catalogApi = fs.readFileSync("app/api/managed-apps/route.ts", "utf8");
const catalogUi = fs.readFileSync("app/tools/managed-apps/page.tsx", "utf8");
const migration = fs.readFileSync("drizzle/0006_managed_app_runtime_state.sql", "utf8");

test("managed catalog persists contract handshake history", () => {
  for (const column of ["last_contract_connected_at", "last_probe_at", "last_probe_error"]) {
    assert.ok(migration.includes(column), `missing runtime state column ${column}`);
    assert.ok(contract.includes(column), `runtime state column not consumed: ${column}`);
  }
  assert.ok(contract.includes("rememberManagedProbe"));
});

test("contract connection state is independent from remote admin readiness", () => {
  assert.ok(contract.includes('issueCode: previouslyConnected ? "OPEN_CONTRACT_UNAVAILABLE" : "OPEN_CONTRACT_PENDING"'));
  assert.ok(contract.includes('"OPEN_CONTRACT_REMOTE_ADMIN_UNAVAILABLE"'));
  assert.ok(contract.includes("contractConnected: true"));
  assert.ok(contract.includes('connection: remoteAdminReady ? "connected" : "warning"'));
  assert.ok(contract.includes("remoteAdminError"));
  assert.ok(contract.includes("Universal Contract từng kết nối thành công"));
  assert.ok(contract.includes("Chưa phát hiện Universal Contract chuẩn"));
});

test("Universal Contract web launch is generic and origin constrained", () => {
  assert.ok(contract.includes("export async function resolveUniversalWebLaunch"));
  assert.ok(contract.includes("manifest.capabilities.webLaunch !== true"));
  assert.ok(contract.includes("allowedOrigins"));
  assert.ok(contract.includes("Web launch endpoint trả URL ngoài origin đã đăng ký."));
  assert.ok(operations.includes("await resolveUniversalWebLaunch(appId, actor)"));
  assert.ok(operations.includes('source: "universal-contract"'));

  const universalIndex = operations.indexOf("await resolveUniversalWebLaunch(appId, actor)");
  const legacyHealthIndex = operations.indexOf('if (appId === "health-care")');
  assert.ok(universalIndex >= 0 && legacyHealthIndex > universalIndex, "Universal launch must run before legacy Health fallback");
});

test("dynamic dashboard can show web access when contract is live but remote admin is read-only", () => {
  assert.ok(operations.includes("webHref,"));
  assert.ok(operations.includes("directWebAccess: Boolean(webHref)"));
  assert.ok(operations.includes("snapshot.manifest?.capabilities.webLaunch"));
});

test("Catalog API and UI expose persisted runtime history", () => {
  for (const token of ["lastConnectedAt", "lastProbeAt", "lastProbeError"]) {
    assert.ok(catalogApi.includes(token), `Catalog API missing ${token}`);
    assert.ok(catalogUi.includes(token), `Catalog UI missing ${token}`);
  }
  assert.ok(catalogUi.includes("Chưa từng bắt tay thành công"));
  assert.ok(catalogUi.includes("Từng kết nối · hiện cần kiểm tra"));
});
