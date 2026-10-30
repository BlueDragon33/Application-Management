import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createHmac } from "node:crypto";
import { loadTs } from "./helpers/load-ts.mjs";

// Fixed test-only secret/key; real encryption, TOTP verification and session SQL.
const secret = "JBSWY3DPEHPK3PXP";
function codeAt(counter) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...secret].map(char => alphabet.indexOf(char).toString(2).padStart(5, "0")).join("");
  const key = Buffer.from(bits.match(/.{8}/g).map(byte => parseInt(byte, 2)));
  const bytes = Buffer.alloc(8); bytes.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", key).update(bytes).digest();
  const offset = digest.at(-1) & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, "0");
}

async function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("CREATE TABLE control_mfa_factors(account_email TEXT,factor_type TEXT,secret_ciphertext TEXT,secret_iv TEXT,enabled INTEGER,verified_at INTEGER); CREATE TABLE control_accounts(email TEXT,phone TEXT); CREATE TABLE control_auth_identities(provider TEXT,account_email TEXT,provider_email TEXT); CREATE TABLE control_sessions(session_id_hash TEXT,step_up_at INTEGER); INSERT INTO control_sessions VALUES ('current',NULL),('other',NULL)");
  const key = await crypto.subtle.importKey("raw", new Uint8Array(32), "AES-GCM", false, ["encrypt"]);
  const iv = new Uint8Array(12);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(secret));
  sqlite.prepare("INSERT INTO control_mfa_factors VALUES (?,'totp',?,?,1,1)").run("owner@example.test", Buffer.from(ciphertext).toString("base64url"), Buffer.from(iv).toString("base64url"));
  const env = { APPLICATION_MANAGEMENT_MFA_ENCRYPTION_KEY: "A".repeat(43), DB: { prepare(sql) {
    return { bind(...values) { const statement = sqlite.prepare(sql); return { first: async () => statement.get(...values) ?? null, run: async () => statement.run(...values) }; } };
  } } };
  const identity = { email: "owner@example.test", displayName: "Owner", sessionHash: "current", authMethod: "google", mustChangePassword: false, stepUpAt: null };
  const auth = loadTs("worker/production-auth.ts");
  return { sqlite, env, identity, auth, current: () => sqlite.prepare("SELECT step_up_at FROM control_sessions WHERE session_id_hash='current'").get().step_up_at,
    verify: (code, origin = "https://management.test", accept = "application/json") => auth.handleProductionAccount(new Request("https://management.test/__account/mfa/step-up", { method: "POST", headers: { origin, accept }, body: new URLSearchParams({ code }) }), env, identity) };
}

test("inline verification returns JSON and elevates only the authenticated current session", async () => {
  const f = await fixture();
  try {
    const response = await f.verify(codeAt(Math.floor(Date.now() / 30000)));
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /application\/json/);
    assert.match(response.headers.get("cache-control"), /no-store/);
    assert.equal((await response.json()).ok, true);
    assert.ok(f.current() > 0);
    assert.equal(f.sqlite.prepare("SELECT step_up_at FROM control_sessions WHERE session_id_hash='other'").get().step_up_at, null);
    const gate = await f.auth.productionStepUpGate(new Request("https://management.test/api/operations-auto-approval", { method: "POST", headers: { "content-type": "application/json" }, body: '{"action":"set-auto-approval"}' }), f.env, { ...f.identity, stepUpAt: f.current() });
    assert.equal(gate, null);
  } finally { f.sqlite.close(); }
});

test("incorrect or expired codes and cross-origin requests cannot elevate a session", async () => {
  const f = await fixture();
  try {
    for (const code of ["bad", codeAt(Math.floor(Date.now() / 30000) - 5)]) {
      const response = await f.verify(code);
      assert.equal(response.status, 401);
      assert.equal((await response.json()).ok, false);
      assert.equal(f.current(), null);
    }
    assert.equal((await f.verify(codeAt(Math.floor(Date.now() / 30000)), "https://other.test")).status, 405);
    assert.equal(f.current(), null);
  } finally { f.sqlite.close(); }
});

test("a pending enrollment cannot be used as an enabled inline authentication factor", async () => {
  const f = await fixture();
  try {
    f.sqlite.exec("UPDATE control_mfa_factors SET enabled=0");
    assert.equal((await f.verify(codeAt(Math.floor(Date.now() / 30000)))).status, 401);
    assert.equal(f.current(), null);
  } finally { f.sqlite.close(); }
});

test("existing account-page form verification still returns HTML", async () => {
  const f = await fixture();
  try {
    const response = await f.verify(codeAt(Math.floor(Date.now() / 30000)), "https://management.test", "text/html");
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/html/);
    assert.match(await response.text(), /Đã xác minh tăng cường/);
  } finally { f.sqlite.close(); }
});
