import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
}

test("study-plan exposes localized PDF export and official workload analysis", () => {
  const ui = source("app/tools/study-plan/study-plan.tsx");

  assert.match(ui, /exportPdf: "Xuất PDF"/);
  assert.match(ui, /exportPdf: "Export PDF"/);
  assert.match(ui, /const printStudyPlan = \(\) => window\.print\(\)/);
  assert.match(ui, /className=\{styles\.printButton\}/);
  assert.match(ui, /workloadTitle: "Phân tích tải học theo học kỳ"/);
  assert.match(ui, /const workloadBySemester = useMemo/);
  assert.match(ui, /items\.reduce\(\(sum, course\) => sum \+ course\.hours, 0\)/);
  assert.match(ui, /items\.reduce\(\(sum, course\) => sum \+ course\.contactHours, 0\)/);
  assert.match(ui, /selfStudyHours: Math\.max\(0, totalHours - contactHours\)/);
  assert.match(ui, /aria-labelledby="study-plan-workload-title"/);
});

test("study-plan print stylesheet is A4-safe and hides interactive navigation", () => {
  const css = source("app/tools/study-plan/study-plan.module.css");

  assert.match(css, /@media print/);
  assert.match(css, /@page\s*\{[\s\S]*size:A4;/);
  assert.match(css, /\.topbar,[\s\S]*\.controls,[\s\S]*\.preBaumanRoadmap\s*\{[\s\S]*display:none !important;/);
  assert.match(css, /\.workloadGrid\s*\{/);
  assert.match(css, /\.workloadContactBar\s*\{/);
  assert.match(css, /\.workloadSelfBar\s*\{/);
});
