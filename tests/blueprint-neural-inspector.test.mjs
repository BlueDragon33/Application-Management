import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildRegistryNeuralGraph } from "../app/blueprint-neural-registry-graph.mjs";

const read = path => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const tsx = read("app/tools/blueprint-compass/blueprint-neural-overview.tsx");
const css = read("app/tools/blueprint-compass/blueprint-compass.module.css");
const app = read("app/tools/blueprint-compass/blueprint-compass.tsx");

const projects = [
  { id: "software-blueprint-hub", name: "Software Blueprint Hub", repository: "BlueDragon33/Software-Blueprint-Hub", group: "core", state: "developing", summary: "" },
  { id: "application-management", name: "Application Management", repository: "BlueDragon33/Application-Management", group: "core", state: "operational", summary: "" },
];

test("selected inspector uses the four real source edges, never fabricated telemetry", () => {
  const graph = buildRegistryNeuralGraph(projects, "software-blueprint-hub");
  const selected = graph.links.filter(link => link.selected);
  assert.equal(selected.length, 4);
  assert.deepEqual(selected.map(link => link.kind).sort(),
    ["group-project", "project-repository", "registry-group", "repository-state"]);
  assert.ok(selected.every(link => link.source === "project-registry.ts"));
  assert.equal(graph.telemetry, "NOT_CONNECTED");
  assert.equal(graph.qaPassed, false);
  assert.match(tsx, /const selectedLinks = diagram\.links\.filter\(link => link\.selected\)/);
  assert.match(tsx, /selectedLinks\.map\(link => <li key=\{link\.id\}>/);
  assert.match(tsx, /relationLabels\[link\.kind\]/);
  assert.match(tsx, /Không suy diễn QA, Agent hay dependency/);
});

test("one actual selected node state drives the graph and the Inspector", () => {
  const graph = buildRegistryNeuralGraph(projects, "application-management");
  assert.equal(graph.projects.filter(project => project.selected).length, 1);
  assert.equal(graph.links.filter(link => link.selected).length, 4);
  assert.match(tsx, /const focusedProject = diagram\.projects\.find\(project => project\.selected\)/);
  assert.match(tsx, /aria-live="polite"/);
  assert.match(tsx, /onClick=\{\(\) => onSelectProject\(project\.id\)\}/);
  assert.match(css, /\.neuralReadback\{/);
});

test("mobile locator can navigate horizontally without initiating an AI run", () => {
  assert.match(tsx, /useRef<HTMLDivElement \| null>\(null\)/);
  assert.match(tsx, /ref=\{trackRef\}/);
  assert.match(tsx, /const node = track\?\.querySelector<HTMLButtonElement>\('button\[aria-pressed="true"\]'\)/);
  assert.match(tsx, /const target = centerNeuralViewport\(/);
  assert.match(tsx, /node\.offsetLeft \+ node\.offsetWidth \/ 2/);
  assert.match(tsx, /node\.offsetTop \+ node\.offsetHeight \/ 2/);
  assert.match(tsx, /if \(!target\) return;/);
  assert.match(tsx, /track\.scrollTo\(\{ \.\.\.target, behavior: "auto" \}\)/);
  assert.match(tsx, /node\.focus\(\{ preventScroll: true \}\)/);
  assert.match(tsx, /Đến node dự án/);
  assert.match(css, /\.neuralToolbar button:focus-visible/);
  assert.doesNotMatch(tsx, /startAgent\(|deployProduction\(|runWorkflow\(/);
});

test("mandatory permanent Hướng dẫn keeps its wired button after neural upgrade", () => {
  assert.match(app, /className=\{styles\.guideButton\} aria-expanded=\{guideOpen\}/);
  assert.match(app, /onClick=\{\(\) => setGuideOpen\(open => !open\)\}/);
  assert.match(app, /aria-controls="blueprint-tool-guide"/);
  assert.match(app, /hidden=\{!guideOpen\}/);
  assert.match(css, /\.header\{position:sticky/);
  assert.match(css, /\.header \.guideButton\{min-width:120px;min-height:44px\}/);
});
