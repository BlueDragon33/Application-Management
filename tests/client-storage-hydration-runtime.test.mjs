import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { loadTs } from "./helpers/load-ts.mjs";

function mount(t, Component, props, saved, url = "https://management.test") {
  const dom = new JSDOM("<div id='root'></div>", { url });
  const keys = ["window", "document", "HTMLElement", "IS_REACT_ACT_ENVIRONMENT"];
  const previous = Object.fromEntries(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
  const memory = new Map(Object.entries(saved));
  const writes = [];
  Object.defineProperty(window, "localStorage", { value: {
    getItem: key => memory.get(key) ?? null,
    setItem: (key, value) => { memory.set(key, value); writes.push([key, value]); },
  } });
  const root = createRoot(document.getElementById("root"));
  const render = next => root.render(React.createElement(React.StrictMode, null, React.createElement(Component, next)));
  act(() => render(props));
  t.after(() => {
    act(() => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  return { memory, writes, render, element: selector => document.querySelector(selector),
    async settle() { await act(async () => { await Promise.resolve(); }); },
    async click(selector) { const element = document.querySelector(selector); assert.ok(element); await act(async () => element.click()); },
  };
}

const link = { __esModule: true, default: ({ href, children }) => React.createElement("a", { href }, children) };
const fontKey = "application-management:study-plan-font-scale:v1";
const survivalKey = "application-management:study-plan-survival:v2";
const user = { displayName: "Teacher", email: "teacher@example.test" };

function studyPlan() {
  return loadTs("app/tools/study-plan/study-plan.tsx", { "next/link": link }).default;
}

test("study preferences restore before persistence can overwrite the stored font size", async t => {
  const ui = mount(t, studyPlan(), { user, baumanModules: [], baumanRegistryStatus: "unavailable", mayOpenLearningRuntimeDirectly: false }, { [fontKey]: "large" });
  assert.ok(ui.writes.filter(([key]) => key === fontKey).every(([, value]) => value === "large"));
  await ui.settle();
  assert.equal(ui.element("main").dataset.fontScale, "large");
  assert.equal(ui.memory.get(fontKey), "large");
  await ui.click('[aria-label="Cỡ chữ rất lớn"]');
  assert.equal(ui.memory.get(fontKey), "xlarge");
});

test("switching study-plan accounts preserves both stored progress snapshots", async t => {
  const firstKey = `${survivalKey}:${encodeURIComponent(user.email)}`;
  const secondUser = { ...user, email: "second@example.test" };
  const secondKey = `${survivalKey}:${encodeURIComponent(secondUser.email)}`;
  const first = { version: 2, variant: "compact12", selectedWeek: 1, availableHoursPerWeek: 8, exerciseDone: { "iu5-pre24-w01": true }, evidence: { "iu5-pre24-w01": { state: "self_reported", note: "first account" } }, assessmentPlans: {} };
  const second = { version: 2, variant: "full24", selectedWeek: 2, availableHoursPerWeek: 10, exerciseDone: { "iu5-pre24-w02": true }, evidence: { "iu5-pre24-w02": { state: "submitted", note: "second account" } }, assessmentPlans: {} };
  const ui = mount(t, studyPlan(), { user, baumanModules: [], baumanRegistryStatus: "unavailable", mayOpenLearningRuntimeDirectly: false }, {
    [firstKey]: JSON.stringify(first), [secondKey]: JSON.stringify(second),
  });
  await ui.settle();
  const firstStored = ui.memory.get(firstKey);
  await act(async () => ui.render({ user: secondUser, baumanModules: [], baumanRegistryStatus: "unavailable", mayOpenLearningRuntimeDirectly: false }));
  await ui.settle();
  assert.equal(ui.memory.get(firstKey), firstStored);
  assert.equal(JSON.parse(ui.memory.get(secondKey)).evidence["iu5-pre24-w02"].note, "second account");
  assert.equal(JSON.parse(ui.memory.get(secondKey)).evidence["iu5-pre24-w01"], undefined);
});

test("visa-tool hydration retains saved applicants and persists companion updates", async t => {
  const key = "application-management:kd-mid-visa:v1";
  const Tool = loadTs("app/tools/kd-mid-visa/kd-mid-visa.tsx", { "next/link": link }).default;
  const applicant = { id: "saved-applicant", surname: "NGUYEN", givenNames: "AN", birthDate: "01/01/1990", passportNo: "P1234567", applicationId: "" };
  const ui = mount(t, Tool, { user }, { [key]: JSON.stringify({ version: 1, common: {}, applicants: [applicant], records: [], selectedId: applicant.id }) });
  await ui.settle();
  assert.ok(ui.writes.filter(([storageKey]) => storageKey === key).every(([, value]) => JSON.parse(value).applicants.length === 1));
  await act(async () => window.dispatchEvent(new window.MessageEvent("message", {
    origin: window.location.origin,
    data: { type: "KD_MID_RECORD", applicationId: "CONFIRMED-ID", surname5: "NGUYE", birthYear: "1990", password: "test-password", applicantName: "NGUYEN AN" },
  })));
  const stored = JSON.parse(ui.memory.get(key));
  assert.equal(stored.applicants[0].surname, "NGUYEN");
  assert.equal(stored.applicants[0].applicationId, "CONFIRMED-ID");
  assert.equal(stored.records[0].applicationId, "CONFIRMED-ID");
});

test("public visa hydration persists the restored draft while its online defaults are pending", async t => {
  let finishRequest;
  const Page = loadTs("app/visa-intake/page.tsx", {}, { fetch: () => new Promise(resolve => { finishRequest = resolve; }) }).default;
  const key = "visa-intake:draft:batch:test-batch";
  const ui = mount(t, Page, {}, { [key]: JSON.stringify({ applicant: { surname: "NGUYEN", passportNo: "P1234567" }, receipt: null }) }, "https://management.test/visa-intake?batch=test-batch");
  await ui.settle();
  assert.equal(JSON.parse(ui.memory.get(key)).applicant.surname, "NGUYEN");
  assert.ok(ui.writes.filter(([storageKey]) => storageKey === key).every(([, value]) => JSON.parse(value).applicant.passportNo === "P1234567"));
  await act(async () => finishRequest({ ok: true, status: 200, json: async () => ({ ok: true, link: { label: "Test batch", formType: "general" }, defaults: {} }) }));
  assert.ok([...document.querySelectorAll("input")].some(input => input.value === "NGUYEN"));
  assert.equal(JSON.parse(ui.memory.get(key)).applicant.passportNo, "P1234567");
});
