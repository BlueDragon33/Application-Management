import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const React = require("react");
const { createRoot } = require("react-dom/client");
const { JSDOM } = require("jsdom");
const ts = require("typescript");
const source = fs.readFileSync(new URL("../app/tools/blueprint-compass/blueprint-neural-overview.tsx", import.meta.url), "utf8");

test("real neural node click updates selection without inventing graph telemetry", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/" });
  const originals = new Map();
  for (const [key, value] of Object.entries({
    window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }

  const exports = {};
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    reportDiagnostics: true,
  });
  assert.equal(transpiled.diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
  vm.runInNewContext(transpiled.outputText, {
    exports, require: name => name.endsWith(".css") ? { default: {} } : require(name),
  }, { filename: "blueprint-neural-overview.cjs" });
  const Component = exports.default;
  const projects = [
    { id: "hub", name: "Blueprint Hub", repository: "BlueDragon33/Software-Blueprint-Hub", group: "core", state: "developing", summary: "" },
    { id: "app", name: "App Management", repository: "BlueDragon33/Application-Management", group: "core", state: "operational", summary: "" },
  ];
  function Harness() {
    const [selected, setSelected] = React.useState("hub");
    return React.createElement(Component, { projects, selectedProjectId: selected, onSelectProject: setSelected });
  }
  const root = createRoot(dom.window.document.getElementById("root"));
  try {
    await React.act(async () => root.render(React.createElement(Harness)));
    const buttons = [...dom.window.document.querySelectorAll('button[aria-controls="compass-project-detail"]')];
    assert.equal(buttons.length, 2, "every real registry project must be selectable");
    assert.equal(buttons.filter(node => node.getAttribute("aria-pressed") === "true").length, 1);
    const app = buttons.find(node => node.textContent.trim() === "App Management");
    assert.ok(app);
    assert.equal(app.getAttribute("aria-pressed"), "false");
    assert.equal(app.tagName, "BUTTON", "native button supports keyboard activation in browsers");
    await React.act(async () => app.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })));
    assert.equal(app.getAttribute("aria-pressed"), "true", "graph click must update shared selection");
    assert.equal(buttons.filter(node => node.getAttribute("aria-pressed") === "true").length, 1);
    assert.match(dom.window.document.body.textContent, /không phải Graph Intelligence live của Hub/);
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of originals)
      descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key];
  }
});
