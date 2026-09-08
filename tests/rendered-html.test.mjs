import assert from "node:assert/strict";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;
const sessionSecret = "application-management-test-session-secret-2026";
const ownerEmail = "owner@example.com";

async function loadWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  return (await import(workerUrl.href)).default;
}

const environment = {
  ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  ADMIN_SESSION_SECRET: sessionSecret,
  CONTROL_OWNER_EMAILS: ownerEmail,
};

const executionContext = {
  waitUntil() {},
  passThroughOnException() {},
};

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}

async function adminSessionCookie() {
  const payload = base64Url(JSON.stringify({
    v: 1,
    email: ownerEmail,
    exp: Date.now() + 60 * 60 * 1000,
  }));
  const signedInput = `v1.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(sessionSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = base64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedInput))));
  return `__Host-boiech_admin_session=${signedInput}.${signature}`;
}

test("redirects unauthenticated visitors to the dedicated admin login", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" }, redirect: "manual" }),
    environment,
    executionContext,
  );

  assert.equal(response.status, 307);
  const location = new URL(response.headers.get("location"));
  assert.equal(location.pathname, "/login");
  assert.equal(location.searchParams.get("return_to"), "/");
});

test("renders the authenticated Application Management control plane", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: {
        accept: "text/html",
        cookie: await adminSessionCookie(),
      },
    }),
    environment,
    executionContext,
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, developmentPreviewMeta);
  assert.match(html, /Application Management|Trung tâm quản trị ứng dụng/i);
});
