import assert from "node:assert/strict";
import test from "node:test";
import { productionAuthFixture } from "./helpers/production-auth-fixture.mjs";
import { loadTs } from "./helpers/load-ts.mjs";

test("Google sign-in issues a revocable persistent server session and secure browser cookie", async () => {
  const f = productionAuthFixture();
  try {
    const session = await f.issue();
    assert.equal(f.row(session).expires_at, 0);
    assert.equal(f.row(session).auth_method, "google");
    assert.match(session.cookie, /Max-Age=31536000;/);
    assert.match(session.cookie, /Path=\/; HttpOnly; Secure; SameSite=Lax/);
    assert.doesNotMatch(session.cookie, /Domain=/);
    assert.equal((await f.identity(session)).email, f.email);
    f.advance(13 * 60 * 60);
    assert.equal((await f.identity(session)).email, f.email);
  } finally { f.close(); }
});

test("password recovery remains bounded to twelve hours", async () => {
  const f = productionAuthFixture();
  try {
    const session = await f.issue("password");
    assert.equal(f.row(session).expires_at, f.now() + 43200);
    assert.match(session.cookie, /Max-Age=43200;.*SameSite=Strict/);
    f.advance(43200);
    assert.equal(await f.identity(session), null);
    assert.equal(f.row(session), undefined);
  } finally { f.close(); }
});

test("session cleanup preserves persistent Google sessions while removing expired credentials", async () => {
  const f = productionAuthFixture();
  try {
    const google = await f.issue();
    f.sqlite.prepare("UPDATE control_sessions SET expires_at=0 WHERE session_id_hash=?").run(google.sessionHash);
    const expired = await f.issue("password");
    f.sqlite.prepare("UPDATE control_sessions SET expires_at=? WHERE session_id_hash=?").run(f.now() - 1, expired.sessionHash);
    await f.issue("password");
    assert.ok(f.row(google));
    assert.equal(f.row(expired), undefined);
  } finally { f.close(); }
});

test("a still-valid legacy Google session becomes persistent without another sign-in", async () => {
  const f = productionAuthFixture();
  try {
    const session = await f.issue();
    f.sqlite.prepare("UPDATE control_sessions SET expires_at=?,last_seen_at=? WHERE session_id_hash=?").run(f.now() + 60, f.now(), session.sessionHash);
    assert.equal((await f.identity(session)).email, f.email);
    assert.equal(f.row(session).expires_at, 0);
    f.advance(43201);
    assert.equal((await f.identity(session)).email, f.email);
  } finally { f.close(); }
});

test("expired legacy credentials and non-Google marker zero are never revived", async () => {
  const f = productionAuthFixture();
  try {
    const expired = await f.issue();
    f.sqlite.prepare("UPDATE control_sessions SET expires_at=? WHERE session_id_hash=?").run(f.now() - 1, expired.sessionHash);
    assert.equal(await f.identity(expired), null);
    assert.equal(f.row(expired), undefined);
    const password = await f.issue("password");
    f.sqlite.prepare("UPDATE control_sessions SET expires_at=0 WHERE session_id_hash=?").run(password.sessionHash);
    assert.equal(await f.identity(password), null);
  } finally { f.close(); }
});

test("inactive accounts and explicit logout revoke a persistent Google session", async () => {
  const f = productionAuthFixture();
  try {
    const disabled = await f.issue();
    f.sqlite.prepare("UPDATE control_accounts SET status='suspended'").run();
    assert.equal(await f.identity(disabled), null);
    assert.equal(f.row(disabled), undefined);
    f.sqlite.prepare("UPDATE control_accounts SET status='active'").run();
    const loggedOut = await f.issue();
    const response = await f.auth.handleProductionLogout(f.request(loggedOut, "/__logout", { method: "POST", headers: { origin: "https://management.test", "sec-fetch-site": "same-origin" } }), f.env);
    assert.equal(response.status, 303);
    assert.match(response.headers.get("set-cookie"), /Max-Age=0/);
    assert.equal(await f.identity(loggedOut), null);
  } finally { f.close(); }
});

test("authenticated HTML navigation renews the Google cookie privately and preserves unrelated cookies", async () => {
  const f = productionAuthFixture();
  try {
    const session = await f.issue();
    const identity = await f.identity(session);
    const request = f.request(session, "/apps/boi-ech", { headers: { accept: "text/html" } });
    const original = new Response("<main>private</main>", { headers: { "content-type": "text/html", "cache-control": "public,max-age=3600", "set-cookie": "language=vi; Path=/" } });
    const response = f.auth.withProductionSessionCookie(request, identity, original);
    assert.match(response.headers.get("set-cookie"), /language=vi/);
    assert.match(response.headers.get("set-cookie"), /__Host-am_prod_session=.*Max-Age=31536000/);
    assert.match(response.headers.get("cache-control"), /no-store.*private/);
    assert.equal(response.headers.get("cloudflare-cdn-cache-control"), "no-store");
    assert.equal(await response.text(), "<main>private</main>");
    assert.equal(f.row(session).step_up_at, null);
  } finally { f.close(); }
});

test("renewal cannot replace explicit logout/login cookies or add session cookies to API/static responses", async () => {
  const f = productionAuthFixture();
  try {
    const session = await f.issue();
    const identity = await f.identity(session);
    const nav = f.request(session, "/__account", { headers: { accept: "text/html" } });
    for (const cookie of ["__Host-am_prod_session=; Max-Age=0; Path=/", "__Host-am_prod_session=new-session; Max-Age=43200; Path=/"]) {
      const response = f.auth.withProductionSessionCookie(nav, identity, new Response("", { headers: { "content-type": "text/html", "set-cookie": cookie } }));
      assert.equal(response.headers.get("set-cookie"), cookie);
    }
    for (const headers of [{ accept: "application/json" }, { accept: "*/*", "sec-fetch-dest": "script" }]) {
      const response = f.auth.withProductionSessionCookie(f.request(session, "/api/test", { headers }), identity, new Response("ok"));
      assert.equal(response.headers.get("set-cookie"), null);
    }
    const apiHtml = f.auth.withProductionSessionCookie(f.request(session, "/api/test", { headers: { accept: "text/html" } }), identity, new Response("API error HTML", { headers: { "content-type": "text/html" } }));
    assert.equal(apiHtml.headers.get("set-cookie"), null);
    assert.equal(f.auth.withProductionSessionCookie(nav, null, new Response("ok")).headers.get("set-cookie"), null);
    const password = await f.issue("password");
    assert.equal(f.auth.withProductionSessionCookie(f.request(password, "/", { headers: { accept: "text/html" } }), await f.identity(password), new Response("ok")).headers.get("set-cookie"), null);
  } finally { f.close(); }
});

test("the Production Worker renews authenticated navigation while preserving API, asset and unauthenticated boundaries", async () => {
  const f = productionAuthFixture();
  try {
    const session = await f.issue();
    const worker = loadTs("worker/index.ts", {
      "./production-auth": f.auth,
      "vinext/server/app-router-entry": { __esModule: true, default: { fetch: async () => new Response("<main>app fixture</main>", { headers: { "content-type": "text/html" } }) } },
    }).default;
    const env = { ...f.env, APPLICATION_MANAGEMENT_DEPLOYMENT_CHANNEL: "cloudflare-production", ASSETS: { fetch: async () => new Response("// fixture asset", { headers: { "content-type": "text/javascript" } }) } };
    const ctx = { waitUntil() {}, passThroughOnException() {} };
    const navigation = await worker.fetch(f.request(session, "/", { headers: { accept: "text/html" } }), env, ctx);
    assert.equal(navigation.status, 200);
    assert.match(navigation.headers.get("set-cookie") ?? "", /Max-Age=31536000/);
    for (const [path, accept] of [["/api/test", "application/json"], ["/assets/test.js", "*/*"]]) {
      const response = await worker.fetch(f.request(session, path, { headers: { accept } }), env, ctx);
      assert.equal(response.headers.get("set-cookie"), null);
      if (path.startsWith("/api/")) assert.match(response.headers.get("cache-control"), /no-store.*private/);
    }
    const unauthenticated = await worker.fetch(new Request("https://management.test/", { headers: { accept: "text/html" } }), env, ctx);
    assert.equal(unauthenticated.status, 303);
    assert.equal(unauthenticated.headers.get("set-cookie"), null);
  } finally { f.close(); }
});

test("document-style Accept never renews API, static or canonical-asset redirect responses", async () => {
  const f = productionAuthFixture();
  try {
    const session = await f.issue();
    const worker = loadTs("worker/index.ts", {
      "./production-auth": f.auth,
      "vinext/server/app-router-entry": { __esModule: true, default: { fetch: async () => Response.json({ ok: true }) } },
    }).default;
    const env = { ...f.env, APPLICATION_MANAGEMENT_DEPLOYMENT_CHANNEL: "cloudflare-production", ASSETS: { fetch: async request => new URL(request.url).pathname.endsWith("canonical.js")
      ? Response.redirect("https://management.test/assets/test.js", 308)
      : new Response("// fixture asset", { headers: { "content-type": "text/javascript" } }) } };
    for (const [path, status] of [["/api/test", 200], ["/assets/test.js", 200], ["/assets/canonical.js", 308]]) {
      const response = await worker.fetch(f.request(session, path, { headers: { accept: "text/html" } }), env, { waitUntil() {}, passThroughOnException() {} });
      assert.equal(response.status, status);
      assert.ok(!response.headers.has("set-cookie"), `no renewal cookie for ${path}`);
    }
  } finally { f.close(); }
});
