import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { JSDOM } from "jsdom";
import { loadTs } from "./helpers/load-ts.mjs";

async function mount(t, busy = false) {
  const dom = new JSDOM("<button id='opener'>Policy</button><div id='root'></div>");
  const keys = ["window", "document", "HTMLElement", "IS_REACT_ACT_ENVIRONMENT"];
  const old = Object.fromEntries(keys.map(key => [key, globalThis[key]]));
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(document.getElementById("root"));
  t.after(async () => { await act(async () => root.unmount()); dom.window.close(); Object.assign(globalThis, old); });
  const opener = document.getElementById("opener"); opener.focus();
  const Dialog = loadTs("app/automatic-device-policies.tsx").default;
  act(() => root.render(React.createElement(Dialog, { apps: [], settings: undefined, verified: false, busy, close: () => root.render(null), sync: async () => {}, save: async () => null })));
  return { opener, dialog: document.querySelector('[role="dialog"]') };
}

test("automation dialog moves focus inside and restores the opener on close", async t => {
  const f = await mount(t);
  assert.equal(f.dialog.getAttribute("aria-modal"), "true");
  const close = f.dialog.querySelector('button[aria-label="Đóng"]');
  assert.ok(document.activeElement === close);
  act(() => close.click());
  assert.ok(document.activeElement === f.opener);
});

test("automation dialog supports Escape and traps keyboard focus", async t => {
  const f = await mount(t);
  const controls = [...f.dialog.querySelectorAll("button:not([disabled])")];
  const first = controls[0]; const last = controls.at(-1);
  act(() => { last.focus(); last.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true })); });
  assert.ok(document.activeElement === first);
  act(() => first.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true })));
  assert.ok(document.activeElement === last);
  act(() => f.dialog.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
  assert.equal(document.querySelector('[role="dialog"]'), null);
  assert.ok(document.activeElement === f.opener);
});
