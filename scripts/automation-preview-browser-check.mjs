import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium, expect } from "playwright/test";

// Read-only acceptance of the already deployed Preview. Credentials remain in
// the protected Actions job; no secret, cookie, or authorization header is saved.
const origin = process.env.APPLICATION_MANAGEMENT_PREVIEW_ORIGIN
  || "https://application-management-preview.boiech-ai.workers.dev";
const expectedRevision = process.env.AUTOMATION_PREVIEW_REVISION;
const secret = process.env.APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET;
const parsed = new URL(origin);
assert.equal(parsed.protocol, "https:");
assert.equal(parsed.hostname, "application-management-preview.boiech-ai.workers.dev",
  "Browser QA may only target the isolated Preview Worker.");
assert.equal(parsed.pathname, "/");
assert.ok(/^[a-f0-9]{40}$/.test(expectedRevision || ""), "Expected deployed SHA is required.");
assert.ok(secret && secret.length >= 32, "Protected Preview credential is unavailable.");

fs.mkdirSync("qa-artifacts", { recursive: true });
const checks = [];
const requests = [];
const pageErrors = [];
const requestStarts = new WeakMap();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "vi-VN" });
const page = await context.newPage();
page.on("pageerror", error => pageErrors.push(error.message));
page.on("request", request => requestStarts.set(request, Date.now()));
page.on("response", response => {
  const request = response.request();
  const path = new URL(response.url()).pathname;
  if (path.startsWith("/api/")) requests.push({
    path, method: request.method(), status: response.status(),
    elapsedMs: Date.now() - (requestStarts.get(request) || Date.now()),
  });
});

// Fail rather than allowing a UI regression to mutate client settings/devices.
// Preview's own ephemeral P-256 registration/challenge is part of normal login.
await context.route("**/api/**", async route => {
  const request = route.request();
  const url = new URL(request.url());
  if (url.origin !== parsed.origin) return route.abort("blockedbyclient");
  if (request.method() !== "POST") return route.continue();
  const body = request.postDataJSON();
  const allowed = url.pathname === "/api/device"
    ? ["session", "register", "challenge", "bootstrap"].includes(body?.action)
    : url.pathname === "/api/operations" && body?.action === "bootstrap";
  if (!allowed) {
    checks.push({ name: "read-only request boundary", pass: false, path: url.pathname, action: body?.action });
    return route.abort("blockedbyclient");
  }
  return route.continue();
});

try {
  const anonymous = await context.request.get(`${parsed.origin}/__deployment`);
  assert.equal(anonymous.status(), 401, "Preview must remain protected.");
  checks.push({ name: "anonymous access denied", pass: true });

  // Use the real login endpoint and its signed HttpOnly session. Do not inject
  // identity headers, forge cookies, relax auth, or expose a credential to chat.
  const login = await context.request.post(`${parsed.origin}/__preview-login`, {
    form: { secret }, maxRedirects: 0,
  });
  assert.equal(login.status(), 303, "Real Preview login must succeed.");
  const deployed = await context.request.get(`${parsed.origin}/__deployment`);
  assert.equal(deployed.status(), 200);
  const runtime = await deployed.json();
  assert.equal(runtime.channel, "cloudflare-preview");
  assert.equal(runtime.revision, expectedRevision, "Refuse a stale or different Preview artifact.");
  assert.equal(runtime.previewAccessConfigured, true);
  checks.push({ name: "authenticated exact Preview revision", pass: true, revision: runtime.revision });

  const navigation = await page.goto(parsed.origin, { waitUntil: "domcontentloaded", timeout: 45_000 });
  assert.equal(navigation.status(), 200);
  const bootstrapPromise = page.waitForResponse(response => {
    const request = response.request();
    return new URL(response.url()).pathname === "/api/operations"
      && request.method() === "POST" && request.postDataJSON()?.action === "bootstrap";
  }, { timeout: 45_000 });
  await page.getByRole("button", { name: "⚙ Duyệt tự động", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Quy tắc theo từng ứng dụng", exact: true });
  await dialog.waitFor({ state: "visible", timeout: 45_000 });
  const bootstrap = await bootstrapPromise;
  assert.equal(bootstrap.status(), 200);
  const payload = await bootstrap.json();
  const policies = payload.settings?.automationPolicies;
  assert.ok(Array.isArray(policies) && policies.length > 0, "Automation policies must come from App Manager bootstrap.");
  const save = dialog.getByRole("button", { name: "Lưu thay đổi", exact: true });
  await expect(save).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Đồng bộ LIVE", exact: true })).toBeEnabled({ timeout: 45_000 });
  const badges = dialog.locator("b[data-state]");
  await expect(badges).toHaveCount(policies.length);
  for (const policy of policies) {
    if (policy.verification.state !== "live") {
      assert.equal(policy.mutation.autoApprove, false, `${policy.appId} must not allow unverified writes.`);
      assert.equal(policy.mutation.autoBlockPending, false, `${policy.appId} must not allow unverified writes.`);
    }
  }
  const live = policies.filter(policy => policy.verification.state === "live").length;
  await expect(badges.filter({ hasText: /^LIVE$/ })).toHaveCount(live);
  checks.push({ name: "all-app modal reflects independent App Manager read", pass: true, apps: policies.length, live });
  checks.push({ name: "unverified app cannot be written", pass: true });
  await page.screenshot({ path: "qa-artifacts/automation-preview.png", fullPage: true });

  const initialSettings = policies.map(policy => ({
    appId: policy.appId, state: policy.verification.state, current: policy.current,
  }));
  await page.reload({ waitUntil: "domcontentloaded" });
  assert.equal(new URL(page.url()).pathname, "/", "Authenticated session must survive refresh.");
  const reloadBootstrapPromise = page.waitForResponse(response => {
    const request = response.request();
    return new URL(response.url()).pathname === "/api/operations"
      && request.method() === "POST" && request.postDataJSON()?.action === "bootstrap";
  }, { timeout: 45_000 });
  await page.getByRole("button", { name: "⚙ Duyệt tự động", exact: true }).click();
  const reloadResponse = await reloadBootstrapPromise;
  assert.equal(reloadResponse.status(), 200);
  const refreshed = await reloadResponse.json();
  assert.deepEqual(refreshed.settings.automationPolicies.map(policy => ({
    appId: policy.appId, state: policy.verification.state, current: policy.current,
  })), initialSettings, "Read-only policy values must remain consistent after refresh.");
  await expect(save).toBeDisabled();
  await page.screenshot({ path: "qa-artifacts/automation-preview-refresh.png", fullPage: true });
  checks.push({ name: "authenticated refresh and consistent policy state", pass: true });
  assert.deepEqual(pageErrors, [], "App UI must not have browser runtime errors.");
  assert.equal(checks.some(check => check.pass === false), false, "Unexpected mutation request was blocked.");

  const writableApps = policies.filter(policy => policy.verification.state === "live"
    && (policy.mutation.autoApprove || policy.mutation.autoBlockPending)).map(policy => policy.appId);
  fs.writeFileSync("qa-artifacts/automation-preview-check.json", JSON.stringify({
    scope: "authenticated read-only Preview UI; mutation acceptance remains separate",
    revision: runtime.revision, checks, requests, writableApps,
    pending: ["fixture Save/write/readback", "repeated Save", "eligible bulk mutation", "Production acceptance"],
  }, null, 2));
  console.log(`Authenticated read-only Preview browser PASS: ${checks.length} checks, ${policies.length} apps, ${live} LIVE.`);
  console.log(`Writable Preview clients: ${writableApps.join(", ") || "none; safe mutation fixture is still required"}.`);
} catch (error) {
  await page.screenshot({ path: "qa-artifacts/automation-preview-failure.png", fullPage: true }).catch(() => {});
  fs.writeFileSync("qa-artifacts/automation-preview-failure.json", JSON.stringify({
    error: error.message, checks, requests, pageErrors,
  }, null, 2));
  throw error;
} finally {
  await browser.close();
}
