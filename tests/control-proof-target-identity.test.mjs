import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const client = fs.readFileSync(new URL("../app/admin-device-client.ts", import.meta.url), "utf8");
const server = fs.readFileSync(new URL("../app/control-device.server.ts", import.meta.url), "utf8");
const senderSource = stripTypeScriptTypes(client.slice(client.indexOf("async function proof("), client.indexOf("async function productionSessionAccess(")));
const verifierSource = stripTypeScriptTypes(server.slice(server.indexOf("export async function verifyControlProof("), server.indexOf("export function controlErrorResponse("))).replace(/^export /gm, "");
const adminId = "a".repeat(64);
const targetId = "b".repeat(64);

async function fixture() {
  const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const publicKey = await crypto.subtle.exportKey("jwk", keys.publicKey);
  const actor = { deviceId: adminId, email: "qa@example.test", status: "approved", role: "owner" };
  const row = { ...actor, member_status: "active", public_key_jwk: JSON.stringify(publicKey) };
  const nonces = new Map();
  const seen = [];
  let sequence = 0;
  const http = async (path, body) => {
    if (path === "/api/device") {
      assert.equal(body.action, "challenge");
      assert.equal(body.deviceId, adminId);
      const challenge = "N".repeat(43) + (++sequence);
      nonces.set(challenge + ":" + adminId, { expires_at: Date.now() + 60_000 });
      return { challenge };
    }
    return body;
  };
  class ApiError extends Error { constructor(message, data) { super(message); this.data = data; } }
  class AccessError extends Error { constructor(message, status, code) { super(message); this.status = status; this.code = code; } }
  const send = new Function("jsonApi", "base64Url", "AdminApiError", senderSource + "\nreturn secureApi;")(http, bytes => Buffer.from(bytes).toString("base64url"), ApiError);
  const db = { prepare(sql) { return { bind(...args) { return {
    async first() { return nonces.get(args[0] + ":" + args[1]) ?? null; },
    async run() {
      if (sql.startsWith("DELETE")) nonces.delete(args[0] + ":" + args[1]);
      if (sql.startsWith("UPDATE")) seen.push(args[0]);
    },
  }; } }; } };
  const verify = new Function("getChatGPTUser", "productionSessionState", "rowFor", "isOwnerEmail", "state", "getControlDatabase", "ControlAccessError", "publicKeyShape", "fromBase64Url", verifierSource + "\nreturn verifyControlProof;")(
    async () => actor, async () => null, async id => id === adminId ? row : null,
    async () => true, () => actor, async () => db, AccessError,
    value => value, value => Buffer.from(value, "base64url"),
  );
  return { actor, row, seen, send, verify, credential: { privateKey: keys.privateKey } };
}

test("real signed requests preserve the target while proving the separate administrator identity", async () => {
  const f = await fixture();
  const body = await f.send("/api/operations", f.credential, f.actor, { action: "manage-client-device", appId: "health-care", deviceId: targetId, expectedStatus: "pending" });
  assert.equal(body.deviceId, targetId);
  assert.equal(body.proofDeviceId, adminId);
  assert.equal((await f.verify(body)).deviceId, adminId);
  assert.deepEqual(f.seen, [adminId]);
});

test("Universal device identifiers survive the same shared secure request path", async () => {
  const f = await fixture();
  const body = await f.send("/api/operations", f.credential, f.actor, { action: "manage-client-device", deviceId: "client-device-42" });
  assert.equal(body.deviceId, "client-device-42");
  assert.equal((await f.verify(body)).deviceId, adminId);
});

test("bootstrap without a mutation target still verifies its signed actor", async () => {
  const f = await fixture();
  const body = await f.send("/api/operations", f.credential, f.actor, { action: "bootstrap" });
  assert.equal((await f.verify(body)).deviceId, adminId);
});

test("legacy flat proof identity remains compatible with cached clients", async () => {
  const f = await fixture();
  const body = await f.send("/api/operations", f.credential, f.actor, { action: "bootstrap" });
  const legacy = { ...body, deviceId: adminId };
  delete legacy.proofDeviceId;
  assert.equal((await f.verify(legacy)).deviceId, adminId);
});

test("a forged proof identity cannot fall back to the mutation target", async () => {
  const f = await fixture();
  const body = await f.send("/api/operations", f.credential, f.actor, { deviceId: adminId });
  await assert.rejects(() => f.verify({ ...body, proofDeviceId: targetId }), error => error.code === "DEVICE_USER_MISMATCH");
  await assert.rejects(() => f.verify({ ...body, proofDeviceId: 42 }), error => error.code === "INVALID_DEVICE_PROOF");
});

test("signature validation and single-use challenge expiry remain enforced", async () => {
  const f = await fixture();
  const bad = await f.send("/api/operations", f.credential, f.actor, { deviceId: targetId });
  await assert.rejects(() => f.verify({ ...bad, signature: "A".repeat(86) }), error => error.code === "DEVICE_MISMATCH");
  const body = await f.send("/api/operations", f.credential, f.actor, { deviceId: targetId });
  await f.verify(body);
  await assert.rejects(() => f.verify(body), error => error.code === "DEVICE_PROOF_EXPIRED");
});

test("Production session requests retain their existing target and avoid device proof calls", async () => {
  const f = await fixture();
  const body = await f.send("/api/operations", f.credential, { ...f.actor, deviceId: "production-session:qa" }, { deviceId: targetId });
  assert.deepEqual(body, { deviceId: targetId });
});
