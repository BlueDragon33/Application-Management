import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { JSDOM } from "jsdom";
import ts from "typescript";

const require = createRequire(import.meta.url);
const thesisDomain = await import("../app/tools/thesis-planner/thesis-domain.mjs");
const courseworkDomain = await import("../app/apps/coursework-workbench/coursework-domain.mjs");

// Integration-level DOM exercise of the *actual* TSX components. Unlike text
// contract tests, this renders React and clicks the real event handlers.
// This is jsdom, NOT a Chromium, Safari, iPhone or WCAG computed-contrast PASS.
const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
  url: "https://academic-qa.invalid/",
  pretendToBeVisual: true,
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.StorageEvent = dom.window.StorageEvent;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = await import("react");
const { createRoot } = await import("react-dom/client");
const { act } = React;
const scrollHistory = [];
dom.window.HTMLElement.prototype.scrollIntoView = function () { scrollHistory.push(this.id); };
const Link = (props) => React.createElement("a", { href: props.href }, props.children);
const css = new Proxy({}, { get: (_target, key) => String(key) });

function loadComponent(relative, domain, domainImport) {
  const source = readFileSync(new URL("../" + relative, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    fileName: relative,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    reportDiagnostics: true,
  });
  const errors = (compiled.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, "TSX transpile errors");
  const module = { exports: {} };
  const fakeRequire = (name) => {
    if (name === "react") return require("react");
    if (name === "react/jsx-runtime") return require("react/jsx-runtime");
    if (name === "next/link") return { __esModule: true, default: Link };
    if (name.endsWith(".module.css")) return { __esModule: true, default: css };
    if (name === domainImport) return domain;
    throw new Error("Unexpected dependency in DOM QA: " + name);
  };
  const evaluate = new Function("require", "module", "exports", compiled.outputText);
  evaluate(fakeRequire, module, module.exports);
  assert.equal(typeof module.exports.default, "function");
  return module.exports.default;
}

const ThesisPlanner = loadComponent(
  "app/tools/thesis-planner/thesis-planner.tsx", thesisDomain, "./thesis-domain.mjs"
);
const CourseworkWorkbench = loadComponent(
  "app/apps/coursework-workbench/coursework-workbench.tsx", courseworkDomain, "./coursework-domain.mjs"
);
const account = { email: "qa@example.test", displayName: "QA" };

async function mount(Component) {
  const host = document.getElementById("root");
  const root = createRoot(host);
  await act(async () => root.render(React.createElement(Component, { user: account })));
  return async () => {
    await act(async () => root.unmount());
    host.replaceChildren();
  };
}
async function clickGuide() {
  const button = [...document.querySelectorAll("button")].find(el => el.textContent.includes("HƯỚNG DẪN / MỞ VIỆC TIẾP THEO"));
  assert.ok(button, "Guidance must be a real button, not inert text");
  assert.equal(button.getAttribute("aria-expanded"), "false");
  await act(async () => button.click());
  assert.equal(button.getAttribute("aria-expanded"), "true");
  return button;
}

test("Thesis Next Action button navigates to first unverified milestone with focus", async () => {
  window.localStorage.clear();
  scrollHistory.length = 0;
  const cleanup = await mount(ThesisPlanner);
  try {
    await clickGuide();
    assert.equal(scrollHistory.at(-1), "thesis-task-scope");
    assert.equal(document.activeElement?.id, "thesis-task-scope");
    assert.match(document.body.textContent, /Đối chiếu yêu cầu của giảng viên/);
    assert.ok(window.localStorage.getItem("application-management:thesis-planner:v1:qa%40example.test"));
  } finally { await cleanup(); }
});

test("Coursework Next Action button opens creation form if project list is empty", async () => {
  window.localStorage.clear();
  scrollHistory.length = 0;
  const cleanup = await mount(CourseworkWorkbench);
  try {
    await clickGuide();
    assert.equal(scrollHistory.at(-1), "coursework-create");
    assert.equal(document.activeElement?.id, "coursework-create");
    assert.match(document.body.textContent, /tạo hồ sơ theo môn học/);
  } finally { await cleanup(); }
});

test("Coursework Next Action honors saved assignment and focuses its next stage", async () => {
  window.localStorage.clear();
  scrollHistory.length = 0;
  window.localStorage.setItem("application-management:coursework-workbench:v1:qa%40example.test", JSON.stringify([{
    id: "course-1", title: "Project", subject: "IU-5", kind: "coursework",
    teacher: "", dueDate: "2027-06-12", requirements: "", notes: "",
    stages: { brief: { status: "evidence", evidence: "original-brief.pdf" } },
  }]));
  const cleanup = await mount(CourseworkWorkbench);
  try {
    await clickGuide();
    assert.equal(scrollHistory.at(-1), "coursework-stage-scope");
    assert.equal(document.activeElement?.id, "coursework-stage-scope");
    assert.match(document.body.textContent, /Phân tích yêu cầu và xác nhận phạm vi/);
  } finally { await cleanup(); }
});

test("Invalid stored assignments are not overwritten during mount", async () => {
  window.localStorage.clear();
  const key = "application-management:coursework-workbench:v1:qa%40example.test";
  window.localStorage.setItem(key, "not-json:\\garbled");
  const cleanup = await mount(CourseworkWorkbench);
  try {
    assert.equal(window.localStorage.getItem(key), "not-json:\\garbled");
    assert.match(document.body.textContent, /Đã khóa ghi/);
  } finally { await cleanup(); }
});
