import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("HN approval preflight requires healthy RU_LIFE, identified user and resolved device class", async () => {
  const preflight = await source("../app/managed-app-preflight.server.ts");
  const route = await source("../app/api/apps/hoa-nhap-nga/control/route.ts");

  assert.match(preflight, /integration\.overall === "healthy"/);
  assert.match(preflight, /integration\.secretHandshake === "ok"/);
  assert.match(preflight, /integration\.originMatches/);
  assert.match(preflight, /profile\?\.personName/);
  assert.match(preflight, /classificationConfidence >= HN_CLASSIFICATION_REVIEW_THRESHOLD/);
  assert.match(preflight, /recent-heartbeat/);
  assert.match(route, /requireHealthyIntegrationBeforeApprove: true/);
  assert.match(route, /RU_LIFE_PREFLIGHT_FAILED/);
  assert.match(route, /action === "preflight"/);
});

test("HN access-token issuance is recorded and revoke or block closes active ledger sessions", async () => {
  const sessions = await source("../app/managed-app-session.server.ts");
  const deviceRoute = await source("../app/api/apps/hoa-nhap-nga/device/route.ts");
  const controlRoute = await source("../app/api/apps/hoa-nhap-nga/control/route.ts");

  assert.match(sessions, /CREATE TABLE IF NOT EXISTS managed_app_sessions/);
  assert.match(sessions, /recordManagedAppSession/);
  assert.match(sessions, /revokeManagedAppDeviceSessions/);
  assert.match(deviceRoute, /recordManagedAppSession/);
  assert.match(deviceRoute, /accessToken: authorization\.accessToken/);
  assert.match(deviceRoute, /authorization\.expiresAt/);
  assert.match(controlRoute, /revokeManagedAppDeviceSessions/);
  assert.match(controlRoute, /revokeManagedAppSessionsBulk/);
  assert.match(controlRoute, /device-blocked/);
  assert.match(controlRoute, /access-revoked/);
});

test("HN session introspection binds the exact access token to the central revocation ledger", async () => {
  const sessions = await source("../app/managed-app-session.server.ts");
  const route = await source("../app/api/apps/hoa-nhap-nga/session/route.ts");

  assert.match(sessions, /token_hash TEXT/);
  assert.match(sessions, /PRAGMA table_info\(managed_app_sessions\)/);
  assert.match(sessions, /SHA-256/);
  assert.match(sessions, /introspectManagedAppSession/);
  assert.match(sessions, /SESSION_NOT_TRACKED/);
  assert.match(sessions, /SESSION_REVOKED/);
  assert.match(sessions, /SESSION_DEVICE_REVOKED/);
  assert.match(sessions, /SELECT status FROM managed_app_devices/);
  assert.match(route, /introspectManagedAppSession\("hoa-nhap-nga", body\.accessToken\)/);
  assert.doesNotMatch(route, /verifyControlProof|MEDICINE_SERVICE_SECRET/);
});

test("RU_LIFE connectivity incidents are persisted as open, repeated and resolved events", async () => {
  const incidents = await source("../app/ru-life-integration-incident.server.ts");
  const healthRoute = await source("../app/api/apps/hoa-nhap-nga/health/route.ts");

  assert.match(incidents, /CREATE TABLE IF NOT EXISTS ru_life_integration_incidents/);
  assert.match(incidents, /occurrences = occurrences \+ 1/);
  assert.match(incidents, /resolved_at = CURRENT_TIMESTAMP/);
  assert.match(healthRoute, /recordRuLifeIntegrationHealth/);
  assert.match(healthRoute, /listRuLifeIntegrationIncidents/);
  assert.match(healthRoute, /listManagedAppSessions/);
  assert.match(healthRoute, /activeSessions/);
});

test("operations UI exposes preflight, session ledger and incident history", async () => {
  const page = await source("../app/medical-control/page.tsx");
  const preflight = await source("../app/medical-control/access-preflight/access-preflight-client.tsx");
  const health = await source("../app/medical-control/integration-health/integration-health-client.tsx");

  assert.match(page, /\/medical-control\/access-preflight/);
  assert.match(preflight, /Kiểm tra trước khi cấp quyền/);
  assert.match(preflight, /SẴN SÀNG/);
  assert.match(preflight, /CHƯA ĐƯỢC DUYỆT/);
  assert.match(preflight, /action: "approve"/);
  assert.match(health, /PHIÊN QUYỀN RU_LIFE/);
  assert.match(health, /LỊCH SỬ SỰ CỐ KẾT NỐI/);
  assert.match(health, /activeSessions/);
});
