import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { JSDOM } from "jsdom";
import { loadTs } from "./helpers/load-ts.mjs";

test("a failed policy save keeps the edited duration and displays authentication recovery inside the dialog", async t => {
  const dom = new JSDOM("<div id='root'></div>", { url: "https://management.test" });
  const keys = ["window", "document", "HTMLElement", "IS_REACT_ACT_ENVIRONMENT"];
  const old = Object.fromEntries(keys.map(key => [key, globalThis[key]]));
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(document.getElementById("root"));
  t.after(async () => { await act(async () => root.unmount()); dom.window.close(); Object.assign(globalThis, old); });
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
  assert.ok(dialog.querySelector('[role="status"]').closest("footer"));
});


async function inlineDialog(t, fetch) {
  const dom = new JSDOM("<div id='root'></div>", { url: "https://management.test" });
  const keys = ["window", "document", "HTMLElement", "IS_REACT_ACT_ENVIRONMENT"];
  const old = Object.fromEntries(keys.map(key => [key, globalThis[key]]));
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(document.getElementById("root"));
  t.after(async () => { await act(async () => root.unmount()); dom.window.close(); Object.assign(globalThis, old); });
  const Dialog = loadTs("app/automatic-device-policies.tsx", {}, { fetch }).default;
  let settings = { autoApproveAppIds: ["boi-ech"], autoApproveSupportedAppIds: ["boi-ech"], freeAccessDaysByApp: { "boi-ech": 30 }, freeDeviceLimitByApp: { "boi-ech": 25 } };
  let prompts = 0; let written = null;
  const save = async (selection, authenticate) => {
    prompts++;
    if (!authenticate || !await authenticate()) return null;
    written = selection;
    settings = { ...settings, freeAccessDaysByApp: { "boi-ech": selection.defaultAccessDays }, freeDeviceLimitByApp: { "boi-ech": selection.defaultDeviceLimit } };
    render(); return settings;
  };
  function render() { root.render(React.createElement(Dialog, { apps: [{ id: "boi-ech", shortName: "Bơi Ếch" }], settings, verified: true, busy: false, close: () => {}, sync: async () => {}, save })); }
  act(render);
  const days = [...document.querySelectorAll("label")].find(label => label.textContent.startsWith("Thời hạn miễn phí")).querySelector("select");
  act(() => { days.value = "90"; days.dispatchEvent(new window.Event("change", { bubbles: true })); });
  const button = [...document.querySelectorAll("button")].find(item => item.textContent === "Lưu thay đổi");
  const prompt = () => [...document.querySelectorAll('[role="dialog"]')].find(item => /Xác minh Authenticator/.test(item.getAttribute("aria-label") ?? ""));
  const submit = async code => {
    await act(async () => {
      const input = prompt().querySelector("input");
      input.value = code; input.dispatchEvent(new window.Event("input", { bubbles: true }));
    });
    await act(async () => { prompt().querySelector('button[type="submit"]').focus(); prompt().querySelector("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
  };
  return { days, button, prompt, submit, get prompts() { return prompts; }, get written() { return written; } };
}

test("Authenticator pop-up verifies in place and automatically saves the retained draft after error recovery", async t => {
  let attempts = 0;
  const f = await inlineDialog(t, async (url, init) => {
    assert.equal(url, "/__account/mfa/step-up");
    assert.equal(init.method, "POST"); assert.equal(init.credentials, "same-origin");
    assert.equal(init.redirect, "error"); assert.equal(init.headers.Accept, "application/json");
    assert.match(init.body.toString(), /^code=\d{6}$/);
    attempts++;
    if (attempts === 1) return Response.json({ ok: false, error: "Mã không đúng hoặc hết hạn" }, { status: 401 });
    if (attempts === 2) return new Response("<html>Login</html>", { headers: { "content-type": "text/html" } });
    if (attempts === 3) throw new DOMException("Timeout", "TimeoutError");
    return Response.json({ ok: true });
  });
  await act(async () => { f.button.click(); f.button.click(); });
  assert.ok(f.prompt(), "Save must request a confirmation pop-up in the same editing session");
  assert.equal(f.prompts, 1);
  assert.equal(document.activeElement, f.prompt().querySelector("input"));
  assert.equal(f.prompt().querySelector("input").inputMode, "numeric");
  assert.equal(f.prompt().querySelector("input").autocomplete, "one-time-code");
  assert.ok(document.querySelector('[role="dialog"][inert]'));
  assert.equal(document.querySelector('a[href="/__account"]'), null);
  await f.submit("12"); assert.equal(attempts, 0);
  for (let index = 0; index < 3; index++) {
    await f.submit("123456");
    assert.ok(f.prompt().querySelector('[role="alert"]'));
    assert.equal(f.written, null); assert.equal(f.days.value, "90");
    assert.ok(document.activeElement === f.prompt().querySelector("input"), "failed verification must restore code entry focus");
  }
  const buttons = f.prompt().querySelectorAll("button");
  act(() => { buttons[buttons.length - 1].focus(); buttons[buttons.length - 1].dispatchEvent(new window.KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true })); });
  assert.equal(document.activeElement, f.prompt().querySelector("input"));
  await f.submit("654321");
  assert.equal(f.prompt(), undefined); assert.equal(f.written.defaultAccessDays, 90);
  assert.equal(f.prompts, 1); assert.equal(f.days.value, "90");
  assert.equal(f.button.disabled, true, "verified saved values now match the owning readback");
});

test("Escape cancels only authentication and unlocks the original edited policy", async t => {
  const f = await inlineDialog(t, async () => { throw new Error("Cancellation must not send a verification code"); });
  await act(async () => { f.button.click(); });
  assert.ok(f.prompt());
  await act(async () => { f.prompt().dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); });
  assert.equal(f.prompt(), undefined); assert.equal(f.written, null);
  assert.equal(f.days.value, "90"); assert.equal(f.button.disabled, false);
  assert.equal(document.querySelector('[role="dialog"][inert]'), null);
});

test("a verification timeout unlocks code retry without changing the policy", async t => {
  let aborted = false;
  const f = await inlineDialog(t, async (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => { aborted = true; reject(new DOMException("Aborted", "AbortError")); }, { once: true });
  }));
  const realTimer = window.setTimeout.bind(window);
  window.setTimeout = (callback, delay, ...args) => realTimer(callback, delay === 15000 ? 0 : delay, ...args);
  await act(async () => { f.button.click(); });
  await f.submit("123456");
  await act(async () => { await new Promise(resolve => realTimer(resolve, 10)); });
  assert.equal(aborted, true);
  assert.match(f.prompt().querySelector('[role="alert"]').textContent, /quá thời gian/);
  assert.equal(f.prompt().querySelector('button[type="submit"]').disabled, false);
  assert.equal(f.written, null); assert.equal(f.days.value, "90");
  await act(async () => { f.prompt().querySelector('button[type="button"]').click(); });
  assert.equal(f.button.disabled, false);
});
