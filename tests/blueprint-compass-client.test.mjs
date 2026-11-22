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
const source = fs.readFileSync(new URL("../app/tools/blueprint-compass/blueprint-compass.tsx", import.meta.url), "utf8");

test("selection never displays another project's evidence, including pending and late responses", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/" });
  const originals = new Map();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }
  const projects = [
    { id: "hub", name: "Hub", repository: "BlueDragon33/Software-Blueprint-Hub", group: "core", state: "developing", summary: "Hub" },
    { id: "manager", name: "Manager", repository: "BlueDragon33/Application-Management", group: "core", state: "developing", summary: "Manager" },
  ];
  const reads = [];
  const exports = {};
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(compiled, {
    exports, AbortController, Date, Error,
    require: name => name === "next/link" ? { default: ({ children, ...props }) => React.createElement("a", props, children) }
      : name.endsWith(".css") ? { default: {} } : require(name),
    fetch: (url, options) => url === "/api/projects/repositories"
      ? Promise.resolve({ ok: true, json: async () => ({ ok: true, unmanaged: [] }) })
      : new Promise(resolve => reads.push({ id: new URL(url, "http://localhost/").searchParams.get("id"), signal: options.signal, resolve })),
  });
  const container = document.getElementById("root");
  const root = createRoot(container);
  const commits = [];
  const capture = () => commits.push({ project: container.querySelector("h2")?.textContent, text: container.textContent });
  const snapshot = id => ({ ok: true, repository: projects.find(project => project.id === id).repository,
    head: (id === "hub" ? "a" : "b").repeat(40), pullRequests: [], issues: [],
    verdict: { status: "DRAFT_REVIEW", title: `${id}-evidence`, description: `${id}-description`, nextStep: `${id}-next`, qaPassed: false, productionAuthorized: false } });
  const complete = async read => React.act(async () => read.resolve({ json: async () => snapshot(read.id) }));
  const select = async name => React.act(async () => [...container.querySelectorAll("aside button")]
    .find(button => button.querySelector("strong")?.textContent === name)
    .dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })));
  try {
    await React.act(async () => root.render(React.createElement(React.Profiler, { id: "compass", onRender: capture }, React.createElement(exports.default, { projects }))));
    await complete(reads[0]);
    assert.match(container.textContent, /hub-evidence/);
    await select("Manager");
    assert.ok(!commits.some(commit => commit.project === "Manager" && commit.text.includes("hub-evidence")), "new selection must hide the prior project's snapshot in every commit");
    assert.doesNotMatch(container.textContent, /hub-evidence/);
    await complete(reads.at(-1));
    assert.match(container.textContent, /manager-evidence/);
    await select("Hub");
    const delayedHub = reads.at(-1);
    await select("Manager");
    assert.equal(delayedHub.signal.aborted, true);
    await complete(reads.at(-1));
    await complete(delayedHub);
    assert.match(container.textContent, /manager-evidence/);
    assert.doesNotMatch(container.textContent, /hub-evidence/);
    assert.ok(!commits.some(commit => commit.project === "Hub" && commit.text.includes("manager-evidence")));
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of originals) descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key];
  }
});
