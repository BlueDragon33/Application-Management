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

test("Thesis valid JSON restoration updates the UI and persists the recovered record", async () => {
  window.localStorage.clear();
  window.confirm = () => true;
  const saved = {
    topic: "Reproducible RAG baseline", department: "ИУ-5", advisor: "",
    targetDate: "", problem: "", hypothesis: "", metrics: "", policy: "",
    steps: { scope: { progress: "evidence", evidence: "advisor-review.pdf", note: "" } },
  };
  const backup = thesisDomain.createThesisBackup(saved);
  const serialized = JSON.stringify(backup);
  const cleanup = await mount(ThesisPlanner);
  try {
    const upload = document.querySelector('input[type="file"]');
    assert.ok(upload, "Thesis import input exists");
    Object.defineProperty(upload, "files", {
      configurable: true,
      value: [{ size: serialized.length, text: async () => serialized }],
    });
    await act(async () => upload.dispatchEvent(new window.Event("change", { bubbles: true })));
    const expectedKey = "application-management:thesis-planner:v1:qa%40example.test";
    const result = JSON.parse(window.localStorage.getItem(expectedKey));
    assert.equal(result.topic, "Reproducible RAG baseline");
    assert.equal(result.steps.scope.progress, "evidence");
    assert.ok([...document.querySelectorAll("input")].some(el => el.value === "Reproducible RAG baseline"));
  } finally { await cleanup(); }
});

test("Switching account does not render previous account's coursework in a new account", async () => {
  window.localStorage.clear();
  const a = "application-management:coursework-workbench:v1:qa%40example.test";
  const b = "application-management:coursework-workbench:v1:second%40example.test";
  window.localStorage.setItem(a, JSON.stringify([{
    id: "only-a", title: "Owner-A private coursework", subject: "Algorithms",
    kind: "coursework", teacher: "", dueDate: "", requirements: "", notes: "", stages: {},
  }]));
  const host = document.getElementById("root");
  const root = createRoot(host);
  try {
    await act(async () => root.render(React.createElement(CourseworkWorkbench, { user: account })));
    assert.match(document.body.textContent, /Owner-A private coursework/);
    await act(async () => root.render(React.createElement(CourseworkWorkbench, {
      user: { email: "second@example.test", displayName: "Second" }
    })));
    assert.doesNotMatch(document.body.textContent, /Owner-A private coursework/);
    assert.equal(JSON.parse(window.localStorage.getItem(a))[0].id, "only-a");
    const secondValue = window.localStorage.getItem(b);
    assert.ok(secondValue === null || JSON.parse(secondValue).length === 0);
  } finally {
    await act(async () => root.unmount());
    host.replaceChildren();
  }
});

test("External storage event fail-closes subsequent writes in Coursework", async () => {
  window.localStorage.clear();
  const key = "application-management:coursework-workbench:v1:qa%40example.test";
  const cleanup = await mount(CourseworkWorkbench);
  try {
    const before = window.localStorage.getItem(key);
    await act(async () => window.dispatchEvent(new window.StorageEvent("storage", {
      key, storageArea: window.localStorage, oldValue: before, newValue: '[{"external":true}]',
    })));
    assert.match(document.body.textContent, /Đã khóa ghi/);
    assert.equal(window.localStorage.getItem(key), before);
  } finally { await cleanup(); }
});

test("JSON import remains reachable by keyboard and exposes a visible focus affordance", async () => {
  for (const [Component, stylePath] of [
    [ThesisPlanner, "app/tools/thesis-planner/thesis-planner.module.css"],
    [CourseworkWorkbench, "app/apps/coursework-workbench/coursework-workbench.module.css"]
  ]) {
    window.localStorage.clear();
    const cleanup = await mount(Component);
    try {
      const picker = document.querySelector('input[type="file"]');
      assert.ok(picker, "Import picker exists");
      assert.equal(picker.hidden, false, "Keyboard input must not use HTML hidden");
      assert.equal(picker.hasAttribute("disabled"), false);
      assert.equal(picker.getAttribute("tabindex"), null, "Input retains natural tab order");
      assert.match(picker.getAttribute("aria-label") ?? "", /khôi phục/);
      await act(async () => picker.focus());
      assert.equal(document.activeElement, picker, "Native file input must receive keyboard focus");
      assert.ok(picker.closest("label"), "Focused input is associated with visible import label");
      const cssText = readFileSync(new URL("../" + stylePath, import.meta.url), "utf8");
      assert.match(cssText, /\.uploadLabel:focus-within\s*\{/);
      assert.match(cssText, /\.uploadInput\s*\{[^}]*clip-path:inset\(50%\)/);
    } finally { await cleanup(); }
  }
});

test("Coursework JSON import restores the selected project and remains intact after remount", async () => {
  window.localStorage.clear();
  window.confirm = () => true;
  const key = "application-management:coursework-workbench:v1:qa%40example.test";
  const item = {
    id: "restore-1", title: "Recovered assignment", subject: "Алгоритмы", kind: "course-project",
    teacher: "", dueDate: "2027-06-02", requirements: "Original rubric", notes: "",
    stages: { brief: { status: "evidence", evidence: "brief.pdf" } },
  };
  const content = JSON.stringify(courseworkDomain.createCourseworkBackup([item]));
  let cleanup = await mount(CourseworkWorkbench);
  try {
    const picker = document.querySelector('input[type="file"]');
    assert.ok(picker);
    Object.defineProperty(picker, "files", {
      configurable: true, value: [{size: content.length, text: async () => content}]
    });
    await act(async () => picker.dispatchEvent(new window.Event("change", { bubbles: true })));
    const record = JSON.parse(window.localStorage.getItem(key));
    assert.equal(record.length, 1);
    assert.equal(record[0].id, item.id);
    assert.match(document.body.textContent, /Recovered assignment/);
  } finally { await cleanup(); }
  cleanup = await mount(CourseworkWorkbench);
  try {
    assert.match(document.body.textContent, /Recovered assignment/);
    assert.match(document.body.textContent, /Original rubric/);
  } finally { await cleanup(); }
});

test("Importing invalid Coursework JSON preserves previously saved assignments", async () => {
  window.localStorage.clear();
  window.confirm = () => true;
  const key = "application-management:coursework-workbench:v1:qa%40example.test";
  const original = [{
    id: "safe", title: "Do not lose this", subject: "Research", kind: "research",
    teacher: "", dueDate: "", requirements: "", notes: "", stages: {},
  }];
  window.localStorage.setItem(key, JSON.stringify(original));
  const cleanup = await mount(CourseworkWorkbench);
  try {
    const picker = document.querySelector('input[type="file"]');
    assert.ok(picker);
    Object.defineProperty(picker, "files", {
      configurable: true, value: [{size: 26, text: async () => '{"schema":"invalid/backup"}'}]
    });
    await act(async () => picker.dispatchEvent(new window.Event("change", { bubbles: true })));
    assert.equal(JSON.parse(window.localStorage.getItem(key))[0].id, "safe");
    assert.match(document.body.textContent, /File JSON không đúng cấu trúc/);
  } finally { await cleanup(); }
});

function luminanceFromCssRgb(value) {
  const channels = (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
  assert.equal(channels.length, 3, "Color must resolve to RGB in DOM");
  const [red, green, blue] = channels.map((num) => {
    const channel = num / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}
function contrastFromComputed(a, b) {
  const values = [luminanceFromCssRgb(a), luminanceFromCssRgb(b)].sort((x, y) => x - y);
  return (values[1] + 0.05) / (values[0] + 0.05);
}

test("authored academic CSS computed contrast: inputs, project boundaries and guide buttons", async () => {
  // jsdom computes declared CSS values but cannot prove final browser compositing
  // (gradient overlays, themes, media query/device viewport). Those remain UNVERIFIED.
  for (const [stylePath, selectors] of [
    ["app/tools/thesis-planner/thesis-planner.module.css", [
      {markup: '<input class="input" />', selector: ".input", kind: "border", min: 3},
      {markup: '<button class="guideButton">Next</button>', selector: ".guideButton", kind: "text", min: 4.5},
      {markup: '<button class="btn">Export</button>', selector: ".btn", kind: "text", min: 4.5},
    ]],
    ["app/apps/coursework-workbench/coursework-workbench.module.css", [
      {markup: '<input class="field" />', selector: ".field", kind: "border", min: 3},
      {markup: '<button class="project">Assignment</button>', selector: ".project", kind: "border", min: 3},
      {markup: '<button class="guideButton">Next</button>', selector: ".guideButton", kind: "text", min: 4.5},
      {markup: '<button class="button">Export</button>', selector: ".button", kind: "text", min: 4.5},
    ]]
  ]) {
    const style = document.createElement("style");
    style.textContent = readFileSync(new URL("../" + stylePath, import.meta.url), "utf8");
    const host = document.createElement("div");
    document.head.appendChild(style);
    document.body.appendChild(host);
    try {
      for (const row of selectors) {
        host.innerHTML = row.markup;
        const element = host.querySelector(row.selector);
        assert.ok(element);
        const computed = window.getComputedStyle(element);
        const fg = row.kind === "border" ? computed.borderTopColor : computed.color;
        const bg = computed.backgroundColor;
        const result = contrastFromComputed(fg, bg);
        assert.ok(result >= row.min,
          stylePath + " " + row.selector + " authored " + row.kind +
          " contrast " + result.toFixed(2) + " is below " + row.min);
      }
    } finally {
      host.remove();
      style.remove();
    }
  }
});

test("Thesis guide precedes long milestone checklist in DOM reading and mobile visual order", async () => {
  window.localStorage.clear();
  const cleanup = await mount(ThesisPlanner);
  try {
    const guide = document.querySelector('[aria-label="Hướng dẫn bước tiếp theo"]');
    const first = document.getElementById("thesis-task-scope");
    const grid = guide?.parentElement?.parentElement;
    assert.ok(guide && first && grid);
    assert.ok(guide.compareDocumentPosition(first) & window.Node.DOCUMENT_POSITION_FOLLOWING,
      "Guide must precede all 12 milestones in keyboard/screen-reader reading order");
    assert.equal(grid.firstElementChild?.tagName, "ASIDE",
      "First grid child must be the guidance aside");
    const stylesheet = readFileSync(new URL("../app/tools/thesis-planner/thesis-planner.module.css", import.meta.url), "utf8");
    assert.match(stylesheet, /\.grid>aside\{grid-column:2;grid-row:1\}/,
      "Desktop must preserve guidance as right sidebar");
    assert.match(stylesheet, /@media\(max-width:780px\)[^{]*\{[^}]*\}\.grid>aside\{grid-column:1;grid-row:1\}\.grid>div\{grid-column:1;grid-row:2\}/,
      "At narrow widths guidance must precede the very long form and milestones");
    await clickGuide();
    assert.equal(document.activeElement, first, "Guide still takes user directly to next milestone");
  } finally { await cleanup(); }
});
