import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const server = fs.readFileSync("app/control-device.server.ts", "utf8");
const client = fs.readFileSync("app/admin-device-client.ts", "utf8");
const deviceRoute = fs.readFileSync("app/api/device/route.ts", "utf8");

test("Production owner session bypasses duplicate device proof only in cloudflare-production", () => {
  assert.ok(server.includes('applicationAuthMode() !== "cloudflare-production"'));
  assert.ok(server.includes("productionSessionState"));
  assert.ok(server.includes("productionSessionControlAccess"));
  assert.ok(server.includes('role: "owner"'));
  assert.ok(server.includes('status: "approved"'));
  assert.ok(server.includes('deviceId: `production-session:'));
  assert.ok(server.includes("const productionSession = await productionSessionState(identity);"));
  assert.ok(server.includes("if (productionSession) return productionSession;"));
});

test("device bootstrap exposes session access before cryptographic device registration", () => {
  assert.ok(deviceRoute.includes('action === "session"'));
  assert.ok(deviceRoute.includes("productionSessionControlAccess(user)"));
  assert.ok(deviceRoute.includes('"PRODUCTION_SESSION_UNAVAILABLE"'));

  const sessionIndex = client.indexOf("const productionAccess = await productionSessionAccess()");
  const credentialIndex = client.indexOf("const credential = await credentialForDevice()");
  assert.ok(sessionIndex >= 0 && credentialIndex >= 0 && sessionIndex < credentialIndex);
  assert.ok(client.includes('data.device.deviceId?.startsWith("production-session:")'));
});

test("Production session access skips challenge signing while legacy environments keep ECDSA proof", () => {
  assert.ok(client.includes("isProductionSessionAccess(access)"));
  assert.ok(client.includes("if (isProductionSessionAccess(access)) return await jsonApi(path, body);"));
  assert.ok(client.includes("...await proof(credential, access)"));
  assert.ok(client.includes("credentialForDevice()"));
  assert.ok(client.includes("crypto.subtle.generateKey"));
});
