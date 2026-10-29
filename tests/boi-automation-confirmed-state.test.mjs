import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const source = fs.readFileSync(new URL("../app/apps/boi-ech/boi-ech-control-center.tsx", import.meta.url), "utf8");
const compile = (code, names, values) => new Function(...names,
  `${stripTypeScriptTypes(`function factory() {\n${code}\n}`)}\nreturn factory();`)(...values);

// Execute the component's real hook/handler code without its JSX or a live admin session.
function switchView(automation, save) {
  const start = source.indexOf("function AutomationCenter(");
  const end = source.indexOf("\n  return (", start);
  assert.ok(start >= 0 && end > start);
  const slots = [];
  let cursor = 0;
  const useState = (initial) => {
    const index = cursor++;
    if (!(index in slots)) slots[index] = initial;
    return [slots[index], (next) => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }];
  };
  const useRef = (initial) => {
    const index = cursor++;
    return slots[index] ??= { current: initial };
  };
  const component = compile(`${source.slice(start, end)}\nreturn { enabled, toggleAutomation };\n}\nreturn AutomationCenter;`,
    ["useState", "useRef"], [useState, useRef]);
  return () => {
    cursor = 0;
    return component({ automation, canManage: true, save });
  };
}

const policy = () => ({ enabled: false, defaultAccessDays: 60, defaultDeviceLimit: 100 });

test("a pending or failed save never displays automatic approval as enabled", async () => {
  let resolve;
  const pending = new Promise((done) => { resolve = done; });
  const render = switchView(policy(), () => pending);
  const saving = render().toggleAutomation();
  assert.equal(render().enabled, false, "a local click is not a persisted approval policy");
  resolve(false);
  await saving;
  assert.equal(render().enabled, false);
});

test("a confirmed parent readback is required before showing the switch as enabled", async () => {
  const automation = policy();
  const render = switchView(automation, async () => true);
  await render().toggleAutomation();
  assert.equal(render().enabled, false, "transport success alone cannot change the visible policy");
  automation.enabled = true;
  assert.equal(render().enabled, true);
});

test("repeated clicks while a policy write is pending do not submit competing changes", async () => {
  let resolve;
  let writes = 0;
  const pending = new Promise((done) => { resolve = done; });
  const render = switchView(policy(), () => { writes++; return pending; });
  const view = render();
  const first = view.toggleAutomation();
  const second = view.toggleAutomation();
  assert.equal(writes, 1);
  resolve(false);
  await Promise.all([first, second]);
  await render().toggleAutomation();
  assert.equal(writes, 2, "a failed write must release the click lock");
});

function dashboardWriter(reply) {
  const start = source.indexOf("  async function dashboardAction(");
  const end = source.indexOf("\n  async function locateManualCode", start);
  assert.ok(start >= 0 && end > start);
  const dashboard = { boiBridge: {}, learningDevices: [] };
  const dashboardRef = { current: dashboard };
  const notices = [];
  const requests = [];
  const write = compile(`${source.slice(start, end)}\nreturn dashboardAction;`,
    ["dashboard", "dashboardRef", "automationWriteRef", "setNotice", "boiApi", "commitDashboard", "setSelected", "mergeLearningDevices"],
    [dashboard, dashboardRef, { current: false }, (value) => notices.push(value), async (...args) => {
      requests.push(args);
      return typeof reply === "function" ? await reply() : reply;
    },
      (value) => { dashboardRef.current = value; }, () => {}, () => []]);
  return { write, notices, dashboardRef, requests };
}

const request = { action: "manage-learning-device", operation: "update-automation", enabled: true, defaultAccessDays: 60, defaultDeviceLimit: 100 };

test("remounting the content tab cannot submit a second pending policy write", async () => {
  let resolve;
  const pending = new Promise((done) => { resolve = done; });
  const { write, requests } = dashboardWriter(() => pending);
  const save = () => write(request, "saved");
  const first = switchView(policy(), save)().toggleAutomation();
  const second = switchView(policy(), save)().toggleAutomation();
  assert.equal(requests.length, 1, "the dashboard must retain the lock across child remounts");
  resolve({ automation: { enabled: true, defaultAccessDays: 60, defaultDeviceLimit: 100 } });
  assert.equal(await first, true);
  assert.equal(await second, false);
});

for (const [name, automation] of [
  ["missing", undefined],
  ["disabled", { enabled: false, defaultAccessDays: 60, defaultDeviceLimit: 100 }],
  ["wrong duration", { enabled: true, defaultAccessDays: 30, defaultDeviceLimit: 100 }],
  ["wrong device limit", { enabled: true, defaultAccessDays: 60, defaultDeviceLimit: 20 }],
]) {
  test(`a ${name} write response cannot report policy-save success`, async () => {
    const { write, notices, dashboardRef } = dashboardWriter({ automation });
    assert.equal(await write(request, "saved"), false);
    assert.notEqual(notices.at(-1), "saved");
    assert.equal(dashboardRef.current.automation, undefined);
  });
}

test("a matching write response commits the confirmed policy", async () => {
  const automation = { enabled: true, defaultAccessDays: 60, defaultDeviceLimit: 100 };
  const { write, notices, dashboardRef } = dashboardWriter({ automation });
  assert.equal(await write(request, "saved"), true);
  assert.deepEqual(dashboardRef.current.automation, automation);
  assert.equal(notices.at(-1), "saved");
});
