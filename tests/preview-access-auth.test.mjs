import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const gateSource = fs.readFileSync("worker/preview-access.ts", "utf8");
const worker = fs.readFileSync("worker/index.ts", "utf8");
const chatAuth = fs.readFileSync("app/chatgpt-auth.ts", "utf8");
const template = fs.readFileSync("wrangler.cloudflare.example.jsonc", "utf8");
const deploy = fs.readFileSync(".github/workflows/deploy-application-management-preview.yml", "utf8");

function loadGate() {
  const output = ts.transpileModule(gateSource, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

test("preview gate has no Zero Trust dependency and keeps secret out of Wrangler vars", () => {
  for (const marker of [
    "Authorization: Bearer <preview-secret>",
    "HMAC-SHA-256",
    "HttpOnly",
    "SameSite=Strict",
    "secretNeverInUrl",
    "oai-authenticated-user-email",
  ]) assert.ok(gateSource.includes(marker), `missing preview gate marker: ${marker}`);
  assert.equal(gateSource.includes("CF_ACCESS_"), false);
  assert.equal(template.includes("CF_ACCESS_TEAM_DOMAIN"), false);
  assert.equal(template.includes("CF_ACCESS_AUD"), false);
  assert.equal(template.includes("APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET"), false);
  assert.equal(chatAuth.includes("getCloudflareAccessUser"), false);
});

test("preview gate accepts bearer secret and rejects wrong or short secrets", async () => {
  const gate = await loadGate();
  const secret = "unit-test-preview-secret-0123456789abcdef";
  assert.equal(gate.previewAccessConfigured(secret), true);
  assert.equal(gate.previewAccessConfigured("short"), false);
  assert.equal(await gate.previewRequestAuthorized(new Request("https://preview.example/__deployment", { headers: { authorization: `Bearer ${secret}` } }), secret), true);
  assert.equal(await gate.previewRequestAuthorized(new Request("https://preview.example/__deployment", { headers: { authorization: "Bearer wrong-secret" } }), secret), false);
});

test("preview login exchanges the secret for an HttpOnly signed session cookie", async () => {
  const gate = await loadGate();
  const secret = "unit-test-preview-secret-0123456789abcdef";
  const body = new URLSearchParams({ secret });
  const response = await gate.handlePreviewLogin(new Request("https://preview.example/__preview-login", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  }), secret);
  assert.equal(response.status, 303);
  const setCookie = response.headers.get("set-cookie") ?? "";
  assert.match(setCookie, /am_preview_session=/);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/);
  assert.match(setCookie, /SameSite=Strict/);
  assert.equal(setCookie.includes(secret), false);
  const cookie = setCookie.split(";", 1)[0];
  const authorized = await gate.previewRequestAuthorized(new Request("https://preview.example/", { headers: { cookie } }), secret);
  assert.equal(authorized, true);
});

test("preview owner identity overwrites spoofed auth headers after the gate", async () => {
  const gate = await loadGate();
  const request = new Request("https://preview.example/", { headers: {
    "oai-authenticated-user-id": "spoofed",
    "oai-authenticated-user-email": "attacker@example.test",
  } });
  const bridged = gate.withPreviewOwnerIdentity(request, "owner@example.test,second@example.test");
  assert.ok(bridged);
  assert.equal(bridged.headers.get("oai-authenticated-user-id"), "preview-owner:owner@example.test");
  assert.equal(bridged.headers.get("oai-authenticated-user-email"), "owner@example.test");
});

test("preview deployment installs the Worker secret and requires anonymous 401 read-back", () => {
  assert.ok(worker.includes("APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET?: string"));
  assert.ok(worker.includes('isPreview ? "application-preview-secret"'));
  assert.ok(worker.includes("previewRequestAuthorized"));
  assert.ok(deploy.includes("APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET"));
  assert.ok(deploy.includes("wrangler secret put APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET"));
  assert.ok(deploy.includes('if [[ "$CODE" != "401" ]]'));
  assert.equal(deploy.includes("CF_ACCESS_CLIENT_ID"), false);
  assert.equal(deploy.includes("CF_ACCESS_CLIENT_SECRET"), false);
});
