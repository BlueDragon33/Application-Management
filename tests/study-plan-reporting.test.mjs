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


test("study-plan derives the 120-credit structure from course kinds instead of hard-coded percentages", () => {
  const ui = source("app/tools/study-plan/study-plan.tsx");

  assert.match(ui, /programKindOrder: readonly CourseKind\[\] = \["course", "research", "practice", "elective", "thesis"\]/);
  assert.match(ui, /courses\.filter\(\(course\) => course\.kind === kind\)/);
  assert.match(ui, /items\.reduce\(\(sum, course\) => sum \+ course\.credits, 0\)/);
  assert.match(ui, /items\.reduce\(\(sum, course\) => sum \+ course\.hours, 0\)/);
  assert.match(ui, /credits \/ program\.credits/);
  assert.match(ui, /creditStructureTitle: "Cơ cấu 120 tín chỉ"/);
  assert.match(ui, /aria-labelledby="study-plan-credit-structure-title"/);

  const css = source("app/tools/study-plan/study-plan.module.css");
  assert.match(css, /\.creditStack\s*\{/);
  assert.match(css, /data-kind="research"/);
  assert.match(css, /\.creditStructureGrid\s*\{/);
});


test("study-plan final completion adds searchable course explorer and skills direction", () => {
  const ui = source("app/tools/study-plan/study-plan.tsx");

  assert.match(ui, /explorerTitle: "Danh sách & tra cứu môn học"/);
  assert.match(ui, /type ExplorerSemester = "all" \| "1" \| "2" \| "3" \| "4"/);
  assert.match(ui, /course\.ru,[\s\S]*course\.title\.vi,[\s\S]*course\.title\.en/);
  assert.match(ui, /courseKindFilter === "all" \|\| course\.kind === courseKindFilter/);
  assert.match(ui, /courseReadinessFilter === "all" \|\| readiness === courseReadinessFilter/);
  assert.match(ui, /courseSort === "readiness"/);
  assert.match(ui, /id="course-explorer"/);
  assert.match(ui, /id="skills-direction"/);
  assert.match(ui, /skillClusterDefinitions/);
  assert.match(ui, /counts\.red > 0 \? "red" : counts\.yellow > 0 \? "yellow" : "green"/);
  assert.match(ui, /readinessWeight\[readinessByCourse\[a\.id\]\.level\]/);
});

test("study-plan final UI exposes selectable app-style sections and responsive explorer/skills layout", () => {
  const ui = source("app/tools/study-plan/study-plan.tsx");
  const css = source("app/tools/study-plan/study-plan.module.css");

  assert.match(ui, /className=\{styles\.studySections\}/);
  for (const id of ["schedule", "courses", "skills", "analysis", "roadmap"]) {
    assert.match(ui, new RegExp(`id: "${id}"`));
  }
  assert.match(ui, /switchWorkspace\(item\.id\)/);
  assert.match(css, /\.studySections\s*\{/);
  assert.match(css, /\.courseExplorerFilters\s*\{/);
  assert.match(css, /\.skillGrid\s*\{/);
  assert.match(css, /@media\(max-width:1100px\)/);
});


test("skills direction covers every displayed curriculum entry exactly once", () => {
  const data = source("app/tools/study-plan/study-plan-data.ts");
  const ui = source("app/tools/study-plan/study-plan.tsx");

  const courseBlock = data.slice(data.indexOf("export const courses"), data.indexOf("export const readinessByCourse"));
  const courseIds = [...courseBlock.matchAll(/\bid:\s*"([^"]+)"/g)].map((match) => match[1]);
  const clusterBlock = ui.slice(ui.indexOf("const skillClusterDefinitions"), ui.indexOf("type GapAction"));
  const clusterIds = [...clusterBlock.matchAll(/courseIds:\s*\[([^\]]*)\]/g)]
    .flatMap((match) => [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]));

  assert.equal(courseIds.length, 33);
  assert.equal(clusterIds.length, 33);
  assert.deepEqual([...new Set(clusterIds)].sort(), [...courseIds].sort());
});
