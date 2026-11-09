import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

const client = fs.readFileSync(new URL("../app/apps/boi-ech/boi-ech-control-center.tsx", import.meta.url), "utf8");
const server = fs.readFileSync(new URL("../app/control-device.server.ts", import.meta.url), "utf8");
const senderSource = stripTypeScriptTypes(client.slice(client.indexOf("async function proof("), client.indexOf("async function boiApi<")));
const verifierSource = stripTypeScriptTypes(server.slice(server.indexOf("export async function verifyControlProof("), server.indexOf("export function controlErrorResponse("))).replace(/^export /gm, "");
const adminId = "a".repeat(64);
const managerId = "b".repeat(64);

async function fixture() {
  const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const publicKey = await crypto.subtle.exportKey("jwk", keys.publicKey);
  const actor = { deviceId: adminId, email: "owner@example.test", status: "approved", role: "owner" };
  const row = { ...actor, member_status: "active", public_key_jwk: JSON.stringify(publicKey) };
  const nonces = new Map();
  const writes = [];
  let configured = false;
  let sequence = 0;
  class ApiError extends Error { constructor(message, data) { super(message); this.data = data; } }
  class AccessError extends Error { constructor(message, status, code) { super(message); this.status = status; this.code = code; } }
  const db = { prepare(sql) { return { bind(...args) { return {
    async first() { return nonces.get(args[0] + ":" + args[1]) ?? null; },
    async run() { if (sql.startsWith("DELETE")) nonces.delete(args[0] + ":" + args[1]); },
  }; } }; } };
  const verify = new Function("getChatGPTUser", "productionSessionState", "rowFor", "isOwnerEmail", "state", "getControlDatabase", "ControlAccessError", "publicKeyShape", "fromBase64Url", verifierSource + "\nreturn verifyControlProof;")(
    async () => actor, async () => null, async id => id === adminId ? row : null,
    async () => true, () => actor, async () => db, AccessError,
    value => value, value => Buffer.from(value, "base64url"),
  );
  const manager = () => ({ deviceId: managerId, deviceCode: "BE-BBBB-BBBB-BBBB-BBBB", personRole: "manager", personCode: "SQ101",
    registrationComplete: true, status: "approved", accessExpired: false, accessGroup: "free", paymentStatus: "free_approved",
    accessExpiresAt: "2030-01-01T00:00:00Z", managementConfigured: configured, managementEnabled: configured });
  const route = loadTs("app/api/apps/boi-ech/access/route.ts", {
    "../../../../control-device.server": { verifyControlProof: verify, controlErrorResponse: error => Response.json({ error: error.message, code: error.code }, { status: error.status ?? 500 }) },
    "../../../../boi-ech.server": { issueBoiBrowserBridge: async () => ({ baseUrl: "https://boi.example.test", token: "fixture-only" }) },
  }, { fetch: async (url, init) => {
    if (init.method === "POST") {
      assert.equal(url, "https://boi.example.test/api/control/management-access");
      const body = JSON.parse(init.body);
      writes.push(body);
      if (body.deviceId !== managerId) return Response.json({ error: "Wrong target" }, { status: 404 });
      configured = body.enabled;
      return Response.json({ managementEnabled: configured });
    }
    assert.equal(url, "https://boi.example.test/api/control/overview?activityDays=0");
    return Response.json({ devices: [manager()] });
  } });
  const http = async (path, body) => {
    if (path === "/api/device") {
      assert.equal(body.action, "challenge");
      assert.equal(body.deviceId, adminId);
      const challenge = "N".repeat(43) + (++sequence);
      nonces.set(challenge + ":" + adminId, { expires_at: Date.now() + 60_000 });
      return { challenge };
    }
    if (path === "/api/dashboard") return { actor: await verify(body) };
    const response = await route.POST(new Request("https://management.example.test/api/apps/boi-ech/access", { method: "POST", body: JSON.stringify(body) }));
    const data = await response.json();
    if (!response.ok) throw new ApiError(data.error, data);
    return data;
  };
  const send = new Function("api", "base64Url", "ApiError", senderSource + "\nreturn secureApi;")(http, bytes => Buffer.from(bytes).toString("base64url"), ApiError);
  return { actor, writes, send, credential: { privateKey: keys.privateKey } };
}

test("Boi control center signs the administrator while granting and revoking the selected manager", async () => {
  const f = await fixture();
  const body = { action: "manage-access", operation: "manager-access", deviceId: managerId, expectedPersonCode: "SQ101",
    expectedStatus: "approved", expectedPaymentStatus: "free_approved", expectedAccessGroup: "free" };
  const granted = await f.send("/api/apps/boi-ech/access", f.credential, f.actor, { ...body, enabled: true });
  assert.equal(granted.verified, true);
  assert.equal(granted.device.deviceId, managerId);
  assert.equal(granted.device.managementConfigured, true);
  assert.equal(granted.device.paymentStatus, "free_approved");
  assert.equal(granted.device.accessExpiresAt, "2030-01-01T00:00:00Z");
  const revoked = await f.send("/api/apps/boi-ech/access", f.credential, f.actor, { ...body, enabled: false });
  assert.equal(revoked.verified, true);
  assert.equal(revoked.device.managementConfigured, false);
  assert.deepEqual(f.writes.map(value => value.deviceId), [managerId, managerId]);
});

test("Boi dashboard bootstrap still verifies its signed administrator without a mutation target", async () => {
  const f = await fixture();
  const result = await f.send("/api/dashboard", f.credential, f.actor, { action: "bootstrap" });
  assert.equal(result.actor.deviceId, adminId);
  assert.equal(f.writes.length, 0);
});
