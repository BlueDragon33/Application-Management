import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

const { parseBoiDeviceRegistry } = loadTs("app/boi-device-registry.ts");
const bindingId = "e".repeat(64);
const accountId = "acc_" + "a".repeat(64);
const owner = { ok: true, application: "boi-ech", contract: "boi-device-registry-owner.v1",
  readOnly: true, devices: [{ deviceId: bindingId, status: "approved",
    account: { accountId, name: "Test learner", role: "learner" },
    browserLabel: "Điện thoại · Safari", clientClass: "phone", progress: {completed:2,total:8} }], counts: { total: 1 } };

test("Owner-linked browser credentials render with verified account identity and mobile type", () => {
  const out = parseBoiDeviceRegistry(owner);
  assert.ok(out);
  assert.equal(out.contract, "boi-device-registry-owner.v1");
  assert.deepEqual(out.devices[0].account, owner.devices[0].account);
  assert.equal(out.devices[0].clientClass, "phone");
  assert.equal(out.devices[0].browserLabel, "Điện thoại · Safari");
  assert.deepEqual(out.devices[0].progress,{completed:2,total:8});
});

test("legacy v2 remains readable for older backend during compatible upgrade", () => {
  const v2 = { ...owner, contract: "boi-device-registry.v2",
    devices: [{ deviceId: bindingId, status: "approved" }] };
  assert.deepEqual(parseBoiDeviceRegistry(v2)?.devices,[{ deviceId: bindingId, status: "approved" }]);
});

test("no account impersonation, fake role, hardware classification or unexpected payload keys", () => {
  const invalid = [
    { ...owner, devices: [{ ...owner.devices[0], deviceId: "bad" }] },
    { ...owner, devices: [{ ...owner.devices[0], account: { ...owner.devices[0].account, accountId: "wrong" } }] },
    { ...owner, devices: [{ ...owner.devices[0], account: { ...owner.devices[0].account, role: "owner" } }] },
    { ...owner, devices: [{ ...owner.devices[0], clientClass: "physical-verified" }] },
    { ...owner, devices: [{ ...owner.devices[0], browserLabel: "x".repeat(81) }] },
    { ...owner, devices: [{ ...owner.devices[0], progress: {completed:9,total:8} }] },
    { ...owner, devices: [{ ...owner.devices[0], progress: {completed:1.5,total:8} }] },
    { ...owner, devices: [{ ...owner.devices[0], progress: undefined }] },
    { ...owner, devices: [{ ...owner.devices[0], privateKeyJwk: "secret" }] },
    { ...owner, counts: { total: 0 } },
    { ...owner, verified: true },
    { ...owner, devices: [{ ...owner.devices[0], account: { name: "Test learner", role: "learner" } }] },
  ];
  for (const candidate of invalid) assert.equal(parseBoiDeviceRegistry(candidate),null);
});

test("Owner UI names account, role and browser label before opening a destructive detail", async () => {
  const ui = (await import("node:fs")).readFileSync("app/apps/boi-ech/boi-ech-control-center.tsx", "utf8");
  assert.match(ui,/device\.account\?\.name/);
  assert.match(ui,/device\.browserLabel/);
  assert.match(ui,/device\.clientClass/);
  assert.match(ui,/onClick=\{\(\)=>void inspectBinding\(device\.deviceId\)\}/);
  assert.match(ui,/không phải mã định danh phần cứng/);
});
