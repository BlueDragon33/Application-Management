import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { loadTs } from "./helpers/load-ts.mjs";

const pending = { appId: "boi-ech", appName: "Bơi Ếch", href: "/apps/boi-ech", deviceId: "a".repeat(64), deviceCode: "BE-AAAA", userLabel: "Teacher A", deviceType: "phone", status: "pending", canApprove: true, canRemove: true, canManageAccess: true };
const approved = { ...pending, appId: "test-app", appName: "Test App", deviceId: "device-2", deviceCode: "TEST-BBBB", status: "approved", canApprove: false, canEditPermission: true, canManageAccess: false };
const blocked = { ...approved, deviceId: "device-3", deviceCode: "TEST-CCCC", status: "blocked", canRemove: false, canEditPermission: false, canUnblock: true };
function mount(t, component, props) {
  const dom = new JSDOM("<div id='root'></div>", { url: "https://management.test" });
  const old = Object.fromEntries(["window", "document", "HTMLElement", "IS_REACT_ACT_ENVIRONMENT"].map(key => [key, globalThis[key]]));
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
  window.confirm = () => true;
  const root = createRoot(document.getElementById("root"));
  act(() => root.render(React.createElement(component, props)));
  t.after(() => { act(() => root.unmount()); dom.window.close(); Object.assign(globalThis, old); });
  return { root, text: () => document.body.textContent, button: label => [...document.querySelectorAll("button")].find(b => b.textContent.trim() === label),
    async click(button) { assert.ok(button, "expected action button"); await act(async () => { button.click(); }); } };
}
function inventory() {
  assert.ok(fs.existsSync("app/central-device-inventory.tsx"), "central inventory with status filters is missing");
  return loadTs("app/central-device-inventory.tsx", { "next/link": { __esModule: true, default: ({ href, children }) => React.createElement("a", { href }, children) } }).default;
}

test("shared inventory defaults to pending and can show approved and blocked without leaving the page", async t => {
  const ui = mount(t, inventory(), { devices: [pending, approved, blocked], actionBusy: "", manageDevice: async () => {}, openBoiAccess: () => {}, bulkRemovePendingDevices: async () => {}, openAutomation: () => {} });
  assert.match(ui.text(), /BE-AAAA/); assert.doesNotMatch(ui.text(), /TEST-BBBB|TEST-CCCC/);
  await ui.click(ui.button("Đã duyệt")); assert.match(ui.text(), /TEST-BBBB/); assert.doesNotMatch(ui.text(), /BE-AAAA|TEST-CCCC/);
  await ui.click(ui.button("Đã khóa")); assert.match(ui.text(), /TEST-CCCC/); assert.doesNotMatch(ui.text(), /TEST-BBBB/);
});

test("shared inventory opens exact Boi access inline and offers only supported common actions", async t => {
  let target; const actions = [];
  const ui = mount(t, inventory(), { devices: [pending, approved, blocked], actionBusy: "", manageDevice: async (device, op) => actions.push([device.deviceId, op]), openBoiAccess: device => { target = device; }, bulkRemovePendingDevices: async () => {}, openAutomation: () => {} });
  await ui.click(ui.button("Phân quyền")); assert.equal(target.deviceId, "a".repeat(64));
  await ui.click(ui.button("Đã duyệt"));
  await ui.click(ui.button("Khóa")); await ui.click(ui.button("Bật quyền sửa"));
  assert.deepEqual(actions, [["device-2", "remove"], ["device-2", "set-edit-permission"]]);
  await ui.click(ui.button("Đã khóa")); await ui.click(ui.button("Mở khóa"));
  assert.deepEqual(actions.at(-1), ["device-3", "unblock"]);
  assert.equal(ui.button("Khóa"), undefined); assert.equal(ui.button("Bật quyền sửa"), undefined);
});

function accessDevice(id, overrides = {}) {
  return { deviceId: id, deviceCode: `BE-${id[0].toUpperCase().repeat(4)}`, learnerName: `Teacher ${id[0]}`, personCode: `SQ-${id[0]}`, registrationComplete: true, status: "pending", accessGroup: "unassigned", paymentStatus: "unassigned", paymentAmount: 0, paymentProofAvailable: false, accessExpired: false, accessDaysRemaining: null, active: false, ...overrides };
}
function accessView(client) {
  return loadTs("app/boi-access-view.tsx", { "./boi-access-client": client }).default;
}
async function settle() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); }); }

test("inline access uses immutable device id and one in-flight command then refreshes shared inventory", async t => {
  let release; let calls = 0; let changes = 0;
  const devices = [accessDevice("a".repeat(64)), accessDevice("b".repeat(64))];
  const View = accessView({ connectBoiAccessManagement: async () => ({ role: "owner", devices, counts: {} }),
    manageBoiAccess: async () => { calls++; await new Promise(resolve => { release = resolve; }); return { verified: true }; } });
  const ui = mount(t, View, { deviceId: "a".repeat(64), onChanged: async () => { changes++; } }); await settle();
  assert.match(ui.text(), /Teacher a/); assert.doesNotMatch(ui.text(), /Teacher b/);
  const button = ui.button("Miễn phí");
  act(() => { button.click(); button.click(); });
  await act(async () => { await Promise.resolve(); }); assert.equal(calls, 1);
  await act(async () => { release(); }); assert.equal(changes, 1);
});

test("blocked access shows unblock and never exposes grant or renewal as a way around a block", async t => {
  const devices = [accessDevice("a".repeat(64), { status: "blocked", accessGroup: "paid", paymentStatus: "paid_verified", accessExpired: true })];
  const ui = mount(t, accessView({ connectBoiAccessManagement: async () => ({ role: "owner", devices, counts: {} }) }), { deviceId: "a".repeat(64) }); await settle();
  assert.ok(ui.button("Mở khóa")); assert.equal(ui.button("Miễn phí"), undefined); assert.equal(ui.button("Gia hạn"), undefined);
});
