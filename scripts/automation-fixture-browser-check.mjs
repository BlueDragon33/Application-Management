import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium, expect } from "playwright/test";

// Real App Manager routes + P-256 device proof + isolated local D1. Only the
// upstream clients are fixtures. Every mutation goes to a loopback server;
// fixtures read their persisted file afresh for each independent readback.
assert.equal(process.env.CI, "true", "This fixture runner only runs in a disposable CI checkout.");
assert.equal(fs.existsSync(".dev.vars"), false, "Never overwrite an existing developer environment.");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "am-automation-fixture-"));
const secret = randomBytes(32).toString("hex");
const encryptionKey = randomBytes(32);
const statePath = path.join(temporary, "client-state.json");
const checks = [];
const traffic = [];
const clients = [];
const flags = { unavailable: false, mismatch: false, delayWrite: 0, readDelay: 0 };
const device = (digit, status) => ({
  deviceId: digit.repeat(64), deviceCode: "FIX-" + digit.repeat(6), status,
  deviceType: "desktop", label: "Disposable QA device", learnerName: "QA fixture",
  registrationComplete: true, active: true, lastSeenAt: new Date().toISOString(),
});
fs.writeFileSync(statePath, JSON.stringify({
  boi: { enabled: true, defaultAccessDays: 30, defaultDeviceLimit: 25 },
  health: { autoApproveDevices: false, autoBlockPendingDevices: false, pendingBlockAfterHours: 168 },
  boiDevices: [device("a", "pending")],
  healthDevices: [device("b", "pending"), device("c", "pending"), device("d", "approved")],
}));
const read = () => JSON.parse(fs.readFileSync(statePath, "utf8"));
const persist = value => fs.writeFileSync(statePath, JSON.stringify(value));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const json = (response, value, status = 200) => {
  response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  response.end(JSON.stringify(value));
};
function ticket(token, audience, write) {
  const [version, encoded, signed] = String(token || "").replace(/^Bearer /, "").split(".");
  if (version !== "v1" || !encoded || !signed) return "INVALID_TICKET";
  const expected = createHmac("sha256", secret).update(version + "." + encoded).digest("base64url");
  if (signed.length !== expected.length || !timingSafeEqual(Buffer.from(signed), Buffer.from(expected))) return "INVALID_SIGNATURE";
  const claims = JSON.parse(Buffer.from(encoded, "base64url").toString());
  if (claims.exp <= Date.now()) return "TICKET_EXPIRED";
  if (claims.aud !== audience) return "INVALID_AUDIENCE";
  if (write && !["owner", "publisher"].includes(claims.role)) return "WRITE_FORBIDDEN";
  return null;
}
function healthContract() {
  return {
    application: "health-care", canonicalApplication: "health-care",
    controlProtocol: "application-management-health-control-v1", contractVersion: 3,
    siteOrigin: "http://127.0.0.1:3001",
    auth: { issuer: "application-management", audience: "health-care-control", app: "health-care", secretEnv: "HEALTH_CONTROL_SERVICE_SECRET", webLaunchTtlSeconds: 60 },
    endpoints: { status: "/api/control/status", devices: "/api/control/devices", deviceCommands: "/api/control/device-commands", sessions: "/api/control/sessions", policy: "/api/control/policy", automation: "/api/control/automation", contentReview: "/api/control/health-content", audit: "/api/control/audit", webLaunchTarget: "/suc-khoe-tre" },
    capabilities: ["device-idempotent-commands", "device-auto-approval", "device-auto-block-pending", "control-web-launch"],
    boundary: { healthDataInControlPlane: false, profileDataInControlPlane: false, independentRuntime: true },
    deviceRegistry: { owner: "Health_Care", namespace: "SK-" },
  };
}
async function serve(port, handler) {
  const server = createServer(async (request, response) => {
    try { await handler(request, response); }
    catch (error) { json(response, { error: error.message }, 500); }
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", resolve); });
  clients.push(server);
}
async function clientHandler(kind, request, response) {
  const pathname = new URL(request.url, "http://127.0.0.1").pathname;
  const write = request.method === "POST";
  traffic.push({ client: kind, path: pathname, method: request.method, at: Date.now() });
  if (kind === "boi" && pathname === "/api/control/runtime") return json(response, {
    applicationId: "boi-ech", repository: "BlueDragon33/BOIECH_AI", runtime: "boi-ech", controlContract: "application-management", controlGeneration: 2, sourceTrack: "main",
  });
  if (kind === "health" && pathname === "/api/control/contract") return json(response, healthContract());
  const authError = ticket(request.headers.authorization, kind === "boi" ? "boi-ech-control" : "health-care-control", write);
  if (authError) return json(response, { error: authError, code: authError }, 401);
  if (kind === "boi" && flags.unavailable) return json(response, { error: "FIXTURE_CLIENT_OFFLINE" }, 503);
  const state = read();
  if (!write) {
    if (kind === "boi" && flags.readDelay && ["/api/control/overview", "/api/control/automation"].includes(pathname)) await delay(flags.readDelay);
    if (pathname === "/api/control/devices") return json(response, { devices: state[kind + "Devices"] });
    if (pathname === "/api/control/overview" || pathname === "/api/control/automation") return json(response, { automation: state[kind], devices: state[kind + "Devices"] });
    return json(response, { error: "FIXTURE_ROUTE_MISSING" }, 404);
  }
  let raw = "";
  for await (const part of request) raw += part;
  const body = JSON.parse(raw);
  if (flags.delayWrite) await delay(flags.delayWrite);
  if (pathname === "/api/control/device-commands" && kind === "health") {
    const current = state.healthDevices.find(item => item.deviceId === body.deviceId);
    if (!current || current.status !== body.expectedStatus) return json(response, { error: "DEVICE_STATE_CONFLICT" }, 409);
    current.status = body.operation === "block" ? "blocked" : "approved";
    persist(state);
    return json(response, { commandId: body.commandId, status: current.status });
  }
  if (pathname === "/api/control/overview" && kind === "boi") {
    assert.equal(body.action, "update-automation");
    state.boi = { enabled: body.enabled, defaultAccessDays: body.defaultAccessDays, defaultDeviceLimit: body.defaultDeviceLimit };
  } else if (pathname === "/api/control/automation" && kind === "health") {
    state.health = { ...state.health, ...body };
  } else return json(response, { error: "FIXTURE_ROUTE_MISSING" }, 404);
  if (!flags.mismatch) persist(state);
  return json(response, { automation: state[kind] });
}

const localVars = {
  LOCAL_DEV_AUTH: "1", LOCAL_DEV_USER_ID: "qa-fixture-owner",
  LOCAL_DEV_USER_EMAIL: "qa.owner@example.test", LOCAL_DEV_USER_NAME: "QA Fixture Owner",
  CONTROL_OWNER_EMAILS: "qa.owner@example.test", CONTROL_PLANE_NETWORK_MODE: "local",
  APPLICATION_MANAGEMENT_ACCESS_MODE: "standalone",
  MANAGED_APP_CREDENTIAL_ENCRYPTION_KEY: encryptionKey.toString("base64url"),
  BOI_ECH_LOCAL_BASE_URL: "http://127.0.0.1:3004", CONTROL_SERVICE_LOCAL_SECRET: secret,
  HEALTH_CARE_LOCAL_BASE_URL: "http://127.0.0.1:3001", HEALTH_CONTROL_SERVICE_LOCAL_SECRET: secret,
  RU_LIFE_LOCAL_BASE_URL: "http://127.0.0.1:3099", BAUMAN_CONTROL_LOCAL_BASE_URL: "http://127.0.0.1:3099",
  BAUMAN_APP_LOCAL_ORIGIN: "http://127.0.0.1:3099", GROWUP_CONTROL_LOCAL_BASE_URL: "http://127.0.0.1:3099",
  PRICE_REPORT_CONTROL_LOCAL_BASE_URL: "http://127.0.0.1:3099",
};
const runtimeEnv = {
  PATH: process.env.PATH, HOME: process.env.HOME, CI: "1", WRANGLER_SEND_METRICS: "false",
  ...localVars,
};
let dev;
let browser;
let page;
const evidence = path.resolve("qa-artifacts");
fs.mkdirSync(evidence, { recursive: true });
try {
  await serve(3004, (request, response) => clientHandler("boi", request, response));
  await serve(3001, (request, response) => clientHandler("health", request, response));
  await serve(3050, (request, response) => {
    const parts = new URL(request.url, "http://127.0.0.1").pathname.split("/");
    const id = parts[3];
    if (!/^qa-contract-[1-9]$/.test(id || "")) return json(response, { error: "NOT_FOUND" }, 404);
    traffic.push({ client: id, path: parts[4], method: request.method, at: Date.now() });
    if (parts[4] === "contract") return json(response, {
      schema: "application-management.contract/v1", application: { id, name: id, category: "Kỹ thuật" },
      capabilities: { deviceRegistry: true, deviceAutoApproval: true },
      policy: { credentialRequired: true, remoteAdminReady: true },
      endpoints: { status: "/api/fixture/" + id + "/status", devices: "/api/fixture/" + id + "/devices", automation: "/api/fixture/" + id + "/automation" },
    });
    if (request.headers.authorization !== "Bearer " + secret) return json(response, { error: "FIXTURE_CREDENTIAL_REQUIRED" }, 403);
    if (parts[4] === "automation") return json(response, { automation: { autoApproveDevices: false } });
    if (parts[4] === "devices") return json(response, { devices: [] });
    if (parts[4] === "status") return json(response, { online: true });
    return json(response, { error: "NOT_FOUND" }, 404);
  });
  fs.writeFileSync(".dev.vars", Object.entries(localVars).map(([key, value]) => key + "=" + value).join("\n"));
  execFileSync("npx", ["wrangler", "d1", "migrations", "apply", "learning-management-db", "--local", "--config", "wrangler.local.jsonc"], { env: runtimeEnv, stdio: "pipe" });
  let sql = "UPDATE managed_app_catalog SET enabled=0;\n";
  const aesKey = await crypto.subtle.importKey("raw", encryptionKey, { name: "AES-GCM" }, false, ["encrypt"]);
  for (let index = 1; index <= 9; index++) {
    const id = "qa-contract-" + index;
    const iv = randomBytes(12);
    const ciphertext = Buffer.from(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, Buffer.from(secret))).toString("base64url");
    sql += "INSERT INTO managed_app_catalog(id,name,short_name,category,origin,contract_path,enabled,credential_ciphertext,credential_iv,created_by) VALUES ('" + id + "','" + id + "','" + id + "','Kỹ thuật','http://127.0.0.1:3050','/api/fixture/" + id + "/contract',1,'" + ciphertext + "','" + iv.toString("base64url") + "','qa.owner@example.test');\n";
  }
  const sqlPath = path.join(temporary, "seed.sql");
  fs.writeFileSync(sqlPath, sql);
  execFileSync("npx", ["wrangler", "d1", "execute", "learning-management-db", "--local", "--config", "wrangler.local.jsonc", "--file", sqlPath], { env: runtimeEnv, stdio: "pipe" });
  const log = fs.openSync(path.join(evidence, "fixture-server.log"), "w");
  dev = spawn("npx", ["vite", "--host", "127.0.0.1", "--port", "3000", "--strictPort"], { env: runtimeEnv, stdio: ["ignore", log, log] });
  const origin = "http://127.0.0.1:3000";
  const deadline = Date.now() + 90_000;
  let ready = false;
  while (Date.now() < deadline) {
    if (dev.exitCode !== null) throw new Error("Local App Manager exited before becoming ready.");
    try { if ((await fetch(origin, { signal: AbortSignal.timeout(2_000) })).status === 200) { ready = true; break; } } catch { /* bounded local readiness */ }
    await delay(500);
  }
  assert.ok(ready, "Local Worker must start within 90 seconds.");
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: "vi-VN" });
  page.on("dialog", dialog => dialog.type() === "confirm" ? dialog.accept() : dialog.dismiss());
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  const modal = () => page.getByRole("dialog", { name: "Quy tắc theo từng ứng dụng", exact: true });
  const row = name => modal().locator("article").filter({ has: page.getByText(name, { exact: true }) });
  const saveButton = () => modal().getByRole("button", { name: "Lưu thay đổi", exact: true });
  async function bootstrap(action) {
    const promise = page.waitForResponse(response => new URL(response.url()).pathname === "/api/operations" && response.request().postDataJSON()?.action === "bootstrap", { timeout: 45_000 });
    await action();
    const response = await promise;
    assert.equal(response.status(), 200);
    const value = await response.json();
    await expect(modal().getByRole("button", { name: "Đồng bộ LIVE", exact: true })).toBeEnabled({ timeout: 45_000 });
    return value;
  }
  const initial = await bootstrap(() => page.getByRole("button", { name: "⚙ Duyệt tự động", exact: true }).click());
  const policies = initial.settings.automationPolicies;
  for (const id of ["boi-ech", "health-care"]) assert.equal(policies.find(item => item.appId === id).verification.state, "live");
  for (let index = 1; index <= 9; index++) {
    const id = "qa-contract-" + index;
    assert.equal(policies.find(item => item.appId === id).verification.state, "live", id + " must read policy with its encrypted catalog credential.");
    assert.equal(traffic.filter(item => item.client === id && item.path === "contract").length, 1, "A valid preferred contract must not fan out fallback probes.");
    assert.ok(traffic.some(item => item.client === id && item.path === "automation"), id + " must independently read automation.");
  }
  await expect(row("Blueprint OS").locator("b[data-state]")).toHaveText("READ-ONLY");
  await expect(row("Bơi ếch").getByRole("combobox").first()).toBeEnabled();
  checks.push("Boi + Health LIVE; Blueprint READ-ONLY and unavailable apps do not block valid apps; nine shared contracts bootstrap");
  const limit = row("Bơi ếch").getByRole("spinbutton");
  await limit.fill("26");
  flags.delayWrite = 350;
  const writePromise = page.waitForResponse(response => new URL(response.url()).pathname === "/api/operations-auto-approval");
  await saveButton().click();
  await saveButton().click({ force: true, timeout: 2_000 }).catch(() => {});
  await saveButton().click({ force: true, timeout: 2_000 }).catch(() => {});
  const written = await writePromise;
  assert.equal(written.status(), 200);
  await expect(saveButton()).toBeDisabled({ timeout: 30_000 });
  assert.equal(read().boi.defaultDeviceLimit, 26);
  assert.equal(traffic.filter(item => item.client === "boi" && item.method === "POST").length, 1, "Repeated Save must not create duplicate writes.");
  const persisted = traffic.findIndex(item => item.client === "boi" && item.method === "POST");
  assert.ok(traffic.slice(persisted + 1).some(item => item.client === "boi" && item.method === "GET" && item.path === "/api/control/overview"), "Independent readback must follow write.");
  checks.push("Save writes fixture server, independently reads persisted result, duplicate Save blocked");
  await page.reload({ waitUntil: "domcontentloaded" });
  await bootstrap(() => page.getByRole("button", { name: "⚙ Duyệt tự động", exact: true }).click());
  await expect(limit).toHaveValue("26");
  checks.push("persisted policy survives browser refresh");
  await page.screenshot({ path: path.join(evidence, "fixture-automation-saved.png"), fullPage: true });

  flags.mismatch = true;
  flags.delayWrite = 0;
  await limit.fill("27");
  const mismatchPromise = page.waitForResponse(response => new URL(response.url()).pathname === "/api/operations-auto-approval");
  await saveButton().click();
  const mismatchResponse = await mismatchPromise;
  assert.equal(mismatchResponse.status(), 500, "The existing route must reject a write without persistent readback.");
  const mismatchBody = await mismatchResponse.json();
  assert.equal(mismatchBody.code, "AUTO_APPROVAL_UPDATE_FAILED");
  assert.equal(mismatchBody.error, "Bơi ếch đã nhận lệnh nhưng readback độc lập chưa hội tụ.");
  assert.equal(read().boi.defaultDeviceLimit, 26);
  await expect(limit).toHaveValue("26", { timeout: 30_000 });
  await expect(saveButton()).toBeDisabled();
  await expect(modal().getByRole("button", { name: "Đồng bộ LIVE", exact: true })).toBeEnabled();
  await expect(page.getByText(/Chưa khớp readback:/)).toBeVisible();
  checks.push("readback mismatch returns exact failure, restores persisted draft and unlocks sync without false success");
  flags.mismatch = false;
  flags.unavailable = true;
  await bootstrap(() => modal().getByRole("button", { name: "Đồng bộ LIVE", exact: true }).click());
  await expect(row("Bơi ếch").locator("b[data-state]")).toHaveText("LAST KNOWN");
  await expect(row("Bơi ếch").getByRole("combobox").first()).toBeDisabled();
  await expect(row("Sức khỏe Y tế").getByRole("combobox").first()).toBeEnabled();
  checks.push("cached policy remains LAST KNOWN after disconnected read; other client stays writable; UI unlocks");
  flags.unavailable = false;
  flags.readDelay = 6000;
  const timeoutStart = Date.now();
  await bootstrap(() => modal().getByRole("button", { name: "Đồng bộ LIVE", exact: true }).click());
  assert.ok(Date.now() - timeoutStart < 20_000, "Slow client must not freeze the modal.");
  await expect(row("Bơi ếch").locator("b[data-state]")).toHaveText("LAST KNOWN");
  await expect(row("Sức khỏe Y tế").getByRole("combobox").first()).toBeEnabled();
  checks.push("actual upstream timeout is bounded and does not freeze other clients");
  flags.readDelay = 0;
  await bootstrap(() => modal().getByRole("button", { name: "Đồng bộ LIVE", exact: true }).click());
  await expect(row("Bơi ếch").locator("b[data-state]")).toHaveText("LIVE");
  await modal().getByText("Đóng", { exact: true }).click();
  await page.getByRole("button", { name: "▣ Kiểm duyệt thiết bị", exact: true }).first().click();
  const bulk = page.getByRole("button", { name: "Từ chối và khóa các thiết bị chờ kiểm duyệt đang hiển thị", exact: true });
  await expect(bulk).toBeEnabled();
  await bulk.click();
  await expect(page.getByText("Từ chối hàng loạt thiết bị cần quyền quản trị online. Bật “Kiểm duyệt truy cập” khi cần thao tác quyền/thiết bị.", { exact: true })).toBeVisible();
  assert.deepEqual(read().healthDevices.map(item => item.status), ["pending", "pending", "approved"]);
  checks.push("Standalone device action gate denies bulk without changing fixture devices");
  // Exercise the normal permission gate in the disposable fixture environment.
  // No Production settings or real device role/status is changed.
  const managedBootstrap = page.waitForResponse(response => new URL(response.url()).pathname === "/api/operations" && response.request().postDataJSON()?.action === "bootstrap", { timeout: 45_000 });
  await page.getByRole("button", { name: /Kiểm duyệt truy cập/ }).click();
  assert.equal((await managedBootstrap).status(), 200);
  await expect(page.getByRole("button", { name: /Kiểm duyệt truy cập/ })).toContainText("BẬT", { timeout: 45_000 });
  await expect(bulk).toBeEnabled();
  const bulkDone = page.waitForResponse(response => new URL(response.url()).pathname === "/api/operations" && response.request().postDataJSON()?.action === "bootstrap", { timeout: 45_000 });
  await bulk.click();
  await bulkDone;
  assert.deepEqual(read().healthDevices.map(item => item.status), ["blocked", "blocked", "approved"]);
  assert.equal(read().boiDevices[0].status, "pending", "Boi pending delete must be excluded from bulk.");
  checks.push("bulk changes only two eligible pending devices; approved and Boi devices remain unchanged");

  const expiredClaims = Buffer.from(JSON.stringify({ aud: "boi-ech-control", role: "viewer", exp: Date.now() - 1000 })).toString("base64url");
  const signed = "v1." + expiredClaims;
  const expired = signed + "." + createHmac("sha256", secret).update(signed).digest("base64url");
  const expiredResponse = await fetch("http://127.0.0.1:3004/api/control/automation", { headers: { authorization: "Bearer " + expired } });
  assert.equal(expiredResponse.status, 401);
  assert.equal((await expiredResponse.json()).code, "TICKET_EXPIRED");
  const wrong = await fetch("http://127.0.0.1:3004/api/control/automation", { headers: { authorization: "Bearer v1.invalid.signature" } });
  assert.equal(wrong.status, 401);
  checks.push("expired and wrongly signed tickets fail closed");
  fs.writeFileSync(path.join(evidence, "fixture-browser-check.json"), JSON.stringify({ checks, traffic, persistedState: read(), scope: "real local App Manager backend + D1 + authenticated UI; fixture clients only" }, null, 2));
  console.log("Authenticated safe fixture browser PASS: " + checks.length + " checks.");
} catch (error) {
  if (page) await page.screenshot({ path: path.join(evidence, "fixture-browser-failure.png"), fullPage: true }).catch(() => {});
  fs.writeFileSync(path.join(evidence, "fixture-browser-failure.json"), JSON.stringify({ error: error.message, checks, traffic }, null, 2));
  throw error;
} finally {
  if (browser) await browser.close();
  if (dev && dev.exitCode === null) dev.kill("SIGTERM");
  for (const server of clients) { server.closeAllConnections(); server.close(); }
  fs.rmSync(".dev.vars", { force: true });
  fs.rmSync(temporary, { recursive: true, force: true });
}
