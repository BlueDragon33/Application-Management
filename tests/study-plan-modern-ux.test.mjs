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
  assert.match(ui, /onKeyDown=\{\(event\) =>/);
  assert.match(ui, /if \(event\.key === "Enter"\) jumpToCourseExplorer\(\)/);
  assert.match(ui, /href="#learning-coverage"/);
  assert.match(ui, /href="#skills-direction"/);
  assert.match(css, /\.commandBar\s*\{/);
  assert.match(css, /\.commandSearch\s*\{/);
  assert.match(css, /\.commandShortcuts\s*\{/);
});

test("Study Plan modern refresh keeps navigation sticky and responsive", () => {
  const css = source("app/tools/study-plan/study-plan.module.css");

  assert.match(css, /\/\* === Study Plan 2026 modern workspace refresh === \*\//);
  assert.match(css, /\.studySections\s*\{[\s\S]*position:sticky/);
  assert.match(css, /\.detailPanel\s*\{[\s\S]*position:sticky/);
  assert.match(css, /@media screen and \(max-width:760px\)/);
  assert.match(css, /\.contentGrid\s*\{[\s\S]*grid-template-columns:1fr/);
});
