import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import * as neuralGraph from "../app/blueprint-neural-registry-graph.mjs";

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
    exports, require: name => name.endsWith(".css") ? { default: {} }
      : name === "../../blueprint-neural-registry-graph.mjs" ? neuralGraph : require(name),
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
    const titles = [...dom.window.document.querySelectorAll("svg title")];
    assert.equal(titles.length, projects.length);
    for (const title of titles) {
      assert.equal(title.childNodes.length, 1, "SVG title must have one text node for server/client hydration");
      assert.equal(title.firstChild.nodeType, 3);
      assert.match(title.textContent, /Nguồn: project-registry\.ts$/);
    }
    assert.equal(buttons.filter(node => node.getAttribute("aria-pressed") === "true").length, 1);
    const app = buttons.find(node => node.textContent.trim() === "App Management");
    assert.ok(app);
    assert.equal(app.getAttribute("aria-pressed"), "false");
    assert.equal(app.tagName, "BUTTON", "native button supports keyboard activation in browsers");
    await React.act(async () => app.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })));
    assert.equal(app.getAttribute("aria-pressed"), "true", "graph click must update shared selection");
    assert.equal(buttons.filter(node => node.getAttribute("aria-pressed") === "true").length, 1);
    assert.match(dom.window.document.body.textContent, /không phải Graph Intelligence live của Hub/);
    // JSDOM has no layout engine: provide explicit geometry and observe real component
    // scroll/focus calls. Browser acceptance remains a separate test.
    const track = dom.window.document.querySelector('[role="region"][tabindex="0"]');
    const locator = [...dom.window.document.querySelectorAll("button")].find(node =>
      node.textContent.includes("Đến node dự án"));
    assert.ok(track && locator);
    Object.defineProperties(track, {
      scrollWidth: { value: 1660 }, scrollHeight: { value: 2550 },
      clientWidth: { value: 390 }, clientHeight: { value: 320 },
    });
    Object.defineProperties(app, {
      offsetLeft: { value: 601 }, offsetTop: { value: 1285 },
      offsetWidth: { value: 290 }, offsetHeight: { value: 30 },
    });
    const scrolls = [];
    track.scrollTo = options => scrolls.push(options);
    await React.act(async () => locator.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })));
    assert.equal(scrolls.length, 1);
    assert.equal(scrolls[0].left, 551);
    assert.equal(scrolls[0].top, 1140);
    assert.equal(scrolls[0].behavior, "auto");
    assert.equal(dom.window.document.activeElement, app);
    assert.equal(app.getAttribute("aria-pressed"), "true");
    const zoomIn = dom.window.document.querySelector('button[aria-label="Phóng to mạng"]');
    const reset = dom.window.document.querySelector('button[aria-label="Khôi phục tỷ lệ mạng"]');
    const zoomOut = dom.window.document.querySelector('button[aria-label="Thu nhỏ mạng"]');
    await React.act(async () => zoomIn.click());
    assert.equal(reset.textContent, "125%");
    await React.act(async () => zoomIn.click());
    assert.equal(reset.textContent, "150%");
    assert.equal(zoomIn.disabled, true);
    await React.act(async () => reset.click());
    assert.equal(reset.textContent, "100%");
    await React.act(async () => zoomOut.click());
    assert.equal(reset.textContent, "75%");
    assert.equal(zoomOut.disabled, true);
    assert.equal(app.getAttribute("aria-pressed"), "true");
    assert.equal(dom.window.document.querySelectorAll('button[aria-controls="compass-project-detail"]').length, 2);
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of originals)
      descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key];
  }
});
