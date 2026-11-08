import assert from "node:assert/strict";
import test from "node:test";
import { productionAuthFixture } from "./helpers/production-auth-fixture.mjs";

async function setup() {
  const f = productionAuthFixture();
  await f.enableTotp();
  const session = await f.issue();
  // Resolve the actual identity before calling the real account handler.
  const confirm = async (accept = "application/json") => f.auth.handleProductionAccount(f.request(session, "/__account/mfa/step-up", {
    method: "POST", headers: { origin: "https://management.test", accept }, body: new URLSearchParams({ code: f.totpCode() }),
  }), f.env, await f.identity(session));
  const gate = async (target = session, action = "connect-lifecycle") => f.auth.productionStepUpGate(f.request(target, "/api/apps/boi-ech/cloudflare-preview", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }),
  }), f.env, await f.identity(target));
  return { ...f, session, confirm, gate };
}

test("Authenticator confirmation is reused at sixteen minutes and 29:59, then expires exactly at thirty minutes", async () => {
  const f = await setup();
  try {
    assert.equal((await f.confirm()).status, 200);
    const verifiedAt = f.row(f.session).step_up_at;
    f.advance(960);
    assert.equal(await f.gate(), null);
    f.advance(839);
    assert.equal(await f.gate(), null);
    assert.equal(f.row(f.session).step_up_at, verifiedAt);
    f.advance(1);
    const denied = await f.gate();
    assert.equal(denied.status, 403);
    assert.equal((await denied.json()).stepUpTtlSeconds, 1800);
    assert.equal((await f.identity(f.session)).email, f.email);
    assert.equal(await f.gate(f.session, "status"), null);
  } finally { f.close(); }
});

test("future confirmations do not unlock sensitive changes", async () => {
  const f = await setup();
  try {
    f.sqlite.prepare("UPDATE control_sessions SET step_up_at=? WHERE session_id_hash=?").run(f.now() + 1, f.session.sessionHash);
    const denied = await f.gate();
    assert.notEqual(denied, null, "a future timestamp cannot be a fresh confirmation");
    assert.equal(denied.status, 403);
    const page = await f.auth.handleProductionAccount(f.request(f.session, "/__account"), f.env, await f.identity(f.session));
    assert.ok((await page.text()).includes("Chưa có xác minh tăng cường gần đây."));
  } finally { f.close(); }
});

test("confirmation stays in the current session and Google-cookie renewal does not extend it", async () => {
  const f = await setup();
  try {
    const other = await f.issue();
    assert.equal((await f.confirm()).status, 200);
    const verifiedAt = f.row(f.session).step_up_at;
    assert.equal((await f.gate(other)).status, 403);
    f.advance(1200);
    const renewed = f.auth.withProductionSessionCookie(f.request(f.session, "/", { headers: { accept: "text/html" } }), await f.identity(f.session), new Response("html", { headers: { "content-type": "text/html" } }));
    assert.match(renewed.headers.get("set-cookie"), /Max-Age=31536000/);
    assert.equal(f.row(f.session).step_up_at, verifiedAt);
    assert.equal(await f.gate(), null);
  } finally { f.close(); }
});

test("account form reports the actual thirty-minute confirmation window", async () => {
  const f = await setup();
  try {
    const response = await f.confirm("text/html");
    assert.equal(response.status, 200);
    assert.match(await response.text(), /30 phút/);
  } finally { f.close(); }
});
