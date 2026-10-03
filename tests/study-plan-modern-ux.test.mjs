import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
}

test("Study Plan exposes a browse-first quick search workspace", () => {
  const ui = source("app/tools/study-plan/study-plan.tsx");
  const css = source("app/tools/study-plan/study-plan.module.css");

  assert.match(ui, /quickFind: "Tìm nhanh môn học"/);
  assert.match(ui, /className=\{styles\.commandBar\}/);
  assert.match(ui, /className=\{styles\.commandSearch\}/);
  assert.match(ui, /if \(event\.key === "Enter"\) jumpToCourseExplorer\(\)/);
  assert.match(ui, /setActiveWorkspace\("courses"\)/);
  assert.match(css, /\.commandBar\s*\{/);
  assert.match(css, /\.commandSearch\s*\{/);
});

test("Study Plan uses app-style workspace buttons instead of a long anchor-only page", () => {
  const ui = source("app/tools/study-plan/study-plan.tsx");
  const css = source("app/tools/study-plan/study-plan.module.css");

  assert.match(ui, /type WorkspaceSection = "schedule" \| "courses" \| "skills" \| "analysis" \| "roadmap"/);
  assert.match(ui, /const \[activeWorkspace, setActiveWorkspace\]/);
  assert.match(ui, /className=\{styles\.workspaceLauncher\}/);
  assert.match(ui, /<WorkspaceIcon section=\{item\.id\}\/>/);
  assert.match(ui, /aria-pressed=\{activeWorkspace === item\.id\}/);
  assert.match(ui, /onClick=\{\(\) => switchWorkspace\(item\.id\)\}/);
  assert.match(ui, /data-workspace=\{activeWorkspace\}/);
  assert.match(css, /\.studySections button\s*\{/);
  assert.match(css, /\.workspaceIcon svg\s*\{/);
  assert.match(css, /\.shell\[data-workspace="schedule"\] \.contentGrid/);
  assert.match(css, /\.shell\[data-workspace="courses"\] \.courseExplorer/);
  assert.match(css, /\.shell\[data-workspace="skills"\] \.skillsDirection/);
  assert.match(css, /\.shell\[data-workspace="analysis"\] \.overall/);
  assert.match(css, /\.shell\[data-workspace="roadmap"\] \.preBaumanRoadmap/);
});

test("Study Plan raises reading size to ChatGPT-like accessible typography", () => {
  const css = source("app/tools/study-plan/study-plan.module.css");

  assert.match(css, /App-style workspace navigation \+ readable ChatGPT-scale type/);
  assert.match(css, /\.shell\s*\{[\s\S]*font-size:16px/);
  assert.match(css, /\.commandSearch input\s*\{[\s\S]*font-size:16px/);
  assert.match(css, /\.studySections button strong\s*\{[\s\S]*font-size:16px/);
  assert.match(css, /\.courseName strong,[\s\S]*font-size:15px/);
  assert.match(css, /@media screen and \(max-width:760px\)/);
  assert.match(css, /\.contentGrid\s*\{[\s\S]*grid-template-columns:1fr/);
});
