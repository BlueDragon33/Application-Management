import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { loadTs } from "./helpers/load-ts.mjs";

test("a failed policy save keeps the edited duration and displays authentication recovery inside the dialog", async t => {
  const dom = new JSDOM("<div id='root'></div>", { url: "https://management.test" });
  const keys = ["window", "document", "HTMLElement", "IS_REACT_ACT_ENVIRONMENT"];
  const old = Object.fromEntries(keys.map(key => [key, globalThis[key]]));
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
  const root = createRoot(document.getElementById("root"));
  t.after(() => { act(() => root.unmount()); dom.window.close(); Object.assign(globalThis, old); });
  const Dialog = loadTs("app/automatic-device-policies.tsx").default;
  const settings = { autoApproveAppIds: ["boi-ech"], autoApproveSupportedAppIds: ["boi-ech"],
    freeAccessDaysByApp: { "boi-ech": 30 }, freeDeviceLimitByApp: { "boi-ech": 25 },
    automationPolicies: [{ appId: "boi-ech", support: { autoApprove: true, autoBlockPending: false, freeAccessPolicy: true },
      current: { autoApprove: true, freeAccessDays: 30, freeDeviceLimit: 25 }, verification: { state: "live", source: "Boi policy" }, mutation: { autoApprove: true, autoBlockPending: false } }] };
  let submitted;
  act(() => root.render(React.createElement(Dialog, { apps: [{ id: "boi-ech", shortName: "Bơi Ếch" }], settings,
    verified: true, busy: false, close: () => {}, sync: async () => {},
    notice: "Hãy xác minh Google Authenticator trước khi lưu", stepUpRequired: true,
    save: async selection => { submitted = selection; return null; } })));
  const days = [...document.querySelectorAll("label")].find(label => label.textContent.startsWith("Thời hạn miễn phí")).querySelector("select");
  act(() => { days.value = "90"; days.dispatchEvent(new window.Event("change", { bubbles: true })); });
  const button = [...document.querySelectorAll("button")].find(item => item.textContent === "Lưu thay đổi");
  await act(async () => { button.click(); });
  assert.equal(submitted.defaultAccessDays, 90); assert.equal(days.value, "90"); assert.equal(button.disabled, false);
  const dialog = document.querySelector('[role="dialog"]');
  assert.match(dialog.textContent, /Hãy xác minh Google Authenticator trước khi lưu/);
  const recovery = dialog.querySelector('a[href="/__account"]');
  assert.ok(recovery, "authentication recovery must be visible without discarding the pending policy draft");
  assert.equal(recovery.target, "_blank");
  assert.ok(recovery.closest("footer"), "save recovery must stay in the visible sticky action area");
});
