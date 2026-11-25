import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = file => fs.readFileSync(new URL("../" + file, import.meta.url), "utf8");
const ui = read("app/tools/blueprint-compass/blueprint-compass.tsx");
const graph = read("app/tools/blueprint-compass/blueprint-neural-overview.tsx");
const css = read("app/tools/blueprint-compass/blueprint-compass.module.css");
const api = read("app/api/tools/blueprint-compass/route.ts");
const dashboard = read("app/management-dashboard-v2.tsx");
const legacy = read("app/application-hub.tsx");

test("Hướng dẫn remains a visible, functional constitutional action on every Tool view", () => {
  assert.match(ui, /const \[guideOpen, setGuideOpen\] = useState\(false\)/);
  assert.match(ui, /className=\{styles\.guideButton\} aria-expanded=\{guideOpen\}/);
  assert.match(ui, /aria-controls="blueprint-tool-guide"/);
  assert.match(ui, /onClick=\{\(\) => setGuideOpen\(open => !open\)\}/);
  assert.match(ui, /"❔ Hướng dẫn"/);
  assert.match(ui, /hidden=\{!guideOpen\} role="region" aria-labelledby="blueprint-tool-guide-heading"/);
  assert.match(ui, /Hướng dẫn theo Hiến pháp Blueprint OS/);
  assert.match(ui, /Đọc Hiến pháp ACTIVE tại nguồn chính GitHub/);
  assert.match(css, /\.header\{position:sticky/);
  assert.match(css, /\.guideButton:focus-visible/);
});

test("Guide is truthful about read-only status and does not add a fake executor", () => {
  for (const required of [
    "không tự chạy Agent", "QualityGate", "human gates",
    "UNVERIFIED", "WorkPackage",
  ]) assert.ok(ui.includes(required), "missing guidance text: " + required);
  assert.doesNotMatch(ui, /onClick=\{[^}]*merge_pull_request|onClick=\{[^}]*deployProduction/);
  assert.match(api, /evidenceClass: "UNSIGNED_GITHUB_METADATA_ONLY"/);
  assert.match(api, /canonicalGateVerified: false, humanReviewVerified: false/);
});

test("Neural diagram is a semantic registry projection, never fabricated operational telemetry", () => {
  assert.match(ui, /<BlueprintNeuralOverview projects=\{projects\} selectedProjectId=\{selected\} onSelectProject=\{setSelected\}/);
  assert.match(graph, /onClick=\{\(\) => onSelectProject\(project\.id\)\}/);
  assert.match(graph, /aria-pressed=\{project\.id === selectedProjectId\}/);
  assert.match(graph, /aria-controls="compass-project-detail"/);
  assert.match(css, /\.neuralNodeButton:focus-visible/);
  assert.match(ui, /<HubGraphContractAdmission\/>/);
  assert.match(ui, /entry\?\.id === "software-blueprint-hub"/);
  assert.match(graph, /project\.group/);
  assert.match(graph, /project\.state/);
  assert.match(graph, /đường cong biểu diễn/i);
  assert.match(graph, /không phải Graph Intelligence live/i);
  assert.doesNotMatch(graph, /Math\.random\(|requestAnimationFrame\(|setInterval\(/);
  assert.doesNotMatch(graph, /fetch\(/);
  assert.match(graph, /diagram\.links\.length/);
  assert.match(graph, /buildRegistryNeuralGraph\(projects, selectedProjectId\)/);
  assert.match(graph, /diagram\.projects\.map/);
  assert.match(css, /\.neuralLayerLegends text/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
});

test("one Tool launcher and no duplicate standalone Blueprint in the visible app grid", () => {
  assert.equal((dashboard.match(/id: "tool-blueprint-compass"/g) || []).length, 1);
  assert.equal((legacy.match(/id: "tool-blueprint-compass"/g) || []).length, 1);
  assert.match(dashboard, /staticApps\.filter\(app => app\.id !== "software-blueprint-hub"\)/);
  assert.match(dashboard, /if \(dynamicApp\.id === "software-blueprint-hub"\) continue/);
  assert.match(legacy, /registeredApplications\.filter\(app => app\.id !== "software-blueprint-hub"\)/);
  assert.match(read("app/apps/software-blueprint-hub/page.tsx"), /redirect\("\/tools\/blueprint-compass"\)/);
});

test("Tool opens with Blueprint Hub selected and links to canonical GitHub without requiring hosted Preview", () => {
  assert.match(ui, /projects\.find\(project => project\.id === "software-blueprint-hub"\)/);
  assert.match(ui, /href="https:\/\/github\.com\/BlueDragon33\/Software-Blueprint-Hub" target="_blank" rel="noopener noreferrer"/);
  assert.match(ui, /Mở nguồn Blueprint Hub/);
  assert.doesNotMatch(ui, /vercel\.app/);
  assert.match(ui, /href=\{`https:\/\/github\.com\/\$\{repo\.repository\}`\}/);
});
