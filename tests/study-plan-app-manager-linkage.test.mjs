import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
}

test("App Manager models Study Plan as a Bauman-owned internal tool", () => {
  const dashboard = source("app/management-dashboard-v2.tsx");

  assert.match(dashboard, /id: "tool-study-plan"/);
  assert.match(dashboard, /parentAppId: "bauman-master-ai"/);
  assert.match(dashboard, /parentLabel: "Bauman Hub"/);
  assert.match(dashboard, /manageHref: "\/apps\/bauman-master-ai"/);
  assert.match(dashboard, /data-parent-app=\{tool\.parentAppId \?\? ""\}/);
  assert.match(dashboard, /parentSummary=\{tool\.parentAppId \? summaryMap\.get\(tool\.parentAppId\) : undefined\}/);
  assert.match(dashboard, /Bauman Admin/);
});

test("Bauman management exposes a direct Study Plan bridge", () => {
  const admin = source("app/apps/bauman-master-ai/bauman-admin.tsx");
  const css = source("app/apps/bauman-master-ai/bauman-admin.module.css");
  const registry = source("app/application-registry.ts");

  assert.match(admin, /href="\/tools\/study-plan"/);
  assert.match(admin, /STUDY PLAN BRIDGE · APPLICATION MANAGEMENT/);
  assert.match(admin, /Study Plan là Tool nội bộ của Application Management nhưng dùng Bauman Hub làm ứng dụng cha/);
  assert.match(admin, /Registry-aware/);
  assert.match(css, /\.studyPlanBridge\s*\{/);
  assert.match(css, /\.studyPlanFacts\s*\{/);
  assert.match(registry, /"Study Plan 09\.04\.01\/11"/);
  assert.match(registry, /Study Plan chỉ đọc contract\/manifest Bauman và fail-closed khi registry không khả dụng/);
});

test("Study Plan links back to both App Manager and Bauman Admin and surfaces registry coverage", () => {
  const ui = source("app/tools/study-plan/study-plan.tsx");
  const css = source("app/tools/study-plan/study-plan.module.css");

  assert.match(ui, /href="\/" className=\{styles\.back\}/);
  assert.match(ui, /href="\/apps\/bauman-master-ai" className=\{styles\.baumanAdminLink\}/);
  assert.match(ui, /integrationTitle: "Liên kết Application Management ↔ Bauman Hub"/);
  assert.match(ui, /baumanRegistryStatus === "live" \? t\.registryLive : t\.registryFallback/);
  assert.match(ui, /\{moduleCoverage\.covered\.length\}\/\{courses\.length\}/);
  assert.match(ui, /\{moduleCoverage\.percent\}%/);
  assert.match(css, /\.integrationBridge\s*\{/);
  assert.match(css, /\.integrationFacts\s*\{/);
  assert.match(css, /\.baumanAdminLink\s*\{/);
});
