import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

const owner = { email: "owner@example.test", role: "owner", deviceId: "central-owner" };
const commandId = "00000000-0000-4000-8000-000000000001";
async function fixture({ capability = true, ignoreWrite = false, wrongReceipt = false, omitPermissionAfterWrite = false, failReadback = false, failTransport = false } = {}) {
  const rawKey = new Uint8Array(32).fill(7);
  const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["encrypt"]);
  const iv = new Uint8Array(12).fill(3);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode("test-service-secret"));
  const row = { id: "test-app", name: "Test", short_name: "Test", category: "Kỹ thuật", origin: "https://client.test", public_url: "https://client.test", contract_path: "/api/application-management/contract", enabled: 1,
    credential_ciphertext: Buffer.from(encrypted).toString("base64url"), credential_iv: Buffer.from(iv).toString("base64url") };
  let device = { deviceId: "device-1", deviceCode: "TEST-1", status: "blocked", deviceType: "phone", editEnabled: false };
  const commands = [];
  const receipts = new Map();
  let appliedWrites = 0;
  const loaded = loadTs("app/open-contract.server.ts", {
    "./control-device.server": { getControlDatabase: async () => ({ prepare: () => ({ all: async () => ({ results: [row] }) }) }) },
    "cloudflare:workers": { env: { MANAGED_APP_CREDENTIAL_ENCRYPTION_KEY: Buffer.from(rawKey).toString("base64url") } },
  }, { fetch: async (url, init) => {
    if (url.endsWith("/api/application-management/contract")) return Response.json({ schema: "application-management.contract/v1", application: { id: "test-app", name: "Test", category: "Kỹ thuật" },
      capabilities: { deviceRegistry: true, deviceApproval: true, deviceBlock: true, deviceUnblock: capability, deviceEditPermission: capability, deviceIdempotentCommands: true, optimisticConcurrency: true },
      endpoints: { devices: "/api/control/devices", deviceCommands: "/api/control/device-commands" } });
    assert.equal(init.headers.authorization, "Bearer test-service-secret");
    if (url.endsWith("/api/control/devices")) {
      if (failReadback && appliedWrites) return Response.json({ error: "Temporary read outage" }, { status: 503 });
      const result = { ...device };
      if (omitPermissionAfterWrite && appliedWrites) delete result.editEnabled;
      return Response.json({ devices: [result] });
    }
    assert.equal(url, "https://client.test/api/control/device-commands");
    const body = JSON.parse(init.body); commands.push(body);
    if (failTransport) throw new TypeError("Connection lost before receipt");
    const previous = receipts.get(body.commandId);
    if (previous) return previous.body === JSON.stringify(body)
      ? Response.json({ ...previous.receipt, replayed: true })
      : Response.json({ error: "COMMAND_ID_CONFLICT" }, { status: 409 });
    if (device.status !== body.expectedStatus) return Response.json({ error: "DEVICE_STATE_CONFLICT" }, { status: 409 });
    appliedWrites++;
    if (!ignoreWrite) device = { ...device, status: body.operation === "block" ? "blocked" : "approved", ...(body.operation === "set_edit_permission" ? { editEnabled: body.editEnabled } : {}) };
    const receipt = { commandId: wrongReceipt ? "wrong-command" : body.commandId, status: device.status };
    receipts.set(body.commandId, { body: JSON.stringify(body), receipt });
    return Response.json(receipt);
  } });
  const unusedModules = ["../../automation-policy-changes.server", "../../health-care.server", "../../ru-life.server", "../../bauman.server", "../../growup.server", "../../price-report.server", "../../client-origin.server", "../../operations-settings.server"];
  const route = loadTs(process.env.CENTRAL_OPERATIONS_TEST_ROUTE || "app/api/operations/route.ts", {
    ...Object.fromEntries(unusedModules.map(name => [name, {}])),
    "../../application-registry": { applicationRegistry: [] },
    "../../control-device.server": { verifyControlProof: async () => owner },
    "../../boi-ech.server": { UpstreamError: class extends Error {} },
    "../../open-contract.server": loaded,
  });
  return { commands, get appliedWrites() { return appliedWrites; }, setApproved() { device.status = "approved"; },
    async post() {
      const response = await route.POST(new Request("https://management.test/api/operations", { method: "POST", body: JSON.stringify({ action: "manage-client-device", operation: "unblock", appId: "test-app", deviceId: "device-1", expectedStatus: "blocked", commandId }) }));
      return { status: response.status, ...await response.json() };
    },
    execute: input => loaded.executeUniversalDeviceCommand({ appId: "test-app", deviceId: "device-1", commandId, expectedStatus: "blocked", ...input }, owner) };
}

test("generic central unblock uses the live contract and verifies the app result", async () => {
  const f = await fixture(); const result = await f.execute({ operation: "unblock" });
  assert.equal(result.device.status, "approved");
  assert.deepEqual(f.commands, [{ commandId, operation: "unblock", deviceId: "device-1", expectedStatus: "blocked" }]);
});

test("generic edit permission sends the explicit boolean and verifies it", async () => {
  const f = await fixture(); f.setApproved();
  const result = await f.execute({ operation: "set-edit-permission", expectedStatus: "approved", editEnabled: true });
  assert.equal(result.device.editEnabled, true); assert.equal(f.commands[0].operation, "set_edit_permission");
  assert.equal(f.commands[0].editEnabled, true);
});

test("generic command refuses missing capability or a stale target snapshot", async () => {
  const noCapability = await fixture({ capability: false });
  await assert.rejects(noCapability.execute({ operation: "unblock" })); assert.equal(noCapability.commands.length, 0);
  const stale = await fixture();
  await assert.rejects(stale.execute({ operation: "unblock", expectedStatus: "pending" })); assert.equal(stale.appliedWrites, 0);
});

test("generic command cannot report success from unchanged readback or mismatched receipt", async () => {
  await assert.rejects((await fixture({ ignoreWrite: true })).execute({ operation: "unblock" }));
  await assert.rejects((await fixture({ wrongReceipt: true })).execute({ operation: "unblock" }));
});


test("missing permission readback cannot confirm a disable operation", async () => {
  const f = await fixture({ omitPermissionAfterWrite: true }); f.setApproved();
  await assert.rejects(f.execute({ operation: "set-edit-permission", expectedStatus: "approved", editEnabled: false }));
});

test("confirmed write and failed readback carries applied-unverified state and original command id", async () => {
  const f = await fixture({ failReadback: true });
  await assert.rejects(f.execute({ operation: "unblock" }), error => {
    assert.equal(error.applied, true); assert.equal(error.verified, false);
    assert.equal(error.commandId, commandId); assert.equal(error.code, "DEVICE_COMMAND_READBACK_UNAVAILABLE");
    return true;
  });
});

test("lost transport response is uncertain instead of claiming the write failed or applied", async () => {
  const f = await fixture({ failTransport: true });
  await assert.rejects(f.execute({ operation: "unblock" }), error => {
    assert.equal(error.applied, null); assert.equal(error.verified, false);
    assert.equal(error.commandId, commandId); assert.equal(error.code, "DEVICE_COMMAND_OUTCOME_UNKNOWN");
    return true;
  });
});

test("same-id retry reaches owning app receipt recovery after status has already changed", async () => {
  const f = await fixture();
  const first = await f.execute({ operation: "unblock" });
  assert.equal(first.device.status, "approved");
  const retry = await f.execute({ operation: "unblock" });
  assert.equal(retry.commandReplayed, true); assert.equal(retry.device.status, "approved");
  assert.equal(f.appliedWrites, 1);
});

test("shared HTTP route preserves confirmed-write and uncertain-transport outcomes for the UI", async () => {
  const confirmed = await (await fixture({ failReadback: true })).post();
  assert.equal(confirmed.status, 502); assert.equal(confirmed.applied, true); assert.equal(confirmed.verified, false);
  assert.equal(confirmed.commandId, commandId); assert.equal(confirmed.code, "DEVICE_COMMAND_READBACK_UNAVAILABLE");
  const uncertain = await (await fixture({ failTransport: true })).post();
  assert.equal(uncertain.status, 502); assert.equal(uncertain.applied, null); assert.equal(uncertain.verified, false);
  assert.equal(uncertain.commandId, commandId); assert.equal(uncertain.code, "DEVICE_COMMAND_OUTCOME_UNKNOWN");
});
