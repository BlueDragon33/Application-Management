import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Bauman child inventory mirrors all current contract subclients", () => {
  const registry = source("app/application-registry.ts");
  for (const id of [
    "math",
    "programming",
    "ai",
    "signal",
    "systems",
    "foundation",
    "entrepreneurship",
    "ergonomics",
    "mivar",
    "research",
    "russian",
    "foreign-language",
    "security-elective",
    "specialization-elective",
    "practice-workflow",
  ]) {
    assert.match(registry, new RegExp(`id: "${id}"`), `missing Bauman child ${id}`);
  }
  assert.match(registry, /kind: "workflow"/);
  assert.match(registry, /state: "workflow"/);
});

test("study-plan registry obeys the Bauman contract before exposing direct learning links", () => {
  const loader = source("app/tools/study-plan/bauman-module-registry.ts");
  const page = source("app/tools/study-plan/page.tsx");
  const ui = source("app/tools/study-plan/study-plan.tsx");

  assert.match(loader, /applicationManagementMayOpenLearningRuntimeDirectly/);
  assert.match(loader, /=== true/);
  assert.match(loader, /const runtimeOrigin = mayOpenLearningRuntimeDirectly \? cleanRuntimeOrigin\(\) : ""/);
  assert.match(page, /mayOpenLearningRuntimeDirectly=\{baumanRegistry\.mayOpenLearningRuntimeDirectly\}/);
  assert.match(ui, /mayOpenLearningRuntimeDirectly && relatedModule\.href/);
  assert.match(ui, /directOpenBlocked/);
});

test("study-plan discovery remains fail-closed when Bauman registry is unavailable", () => {
  const loader = source("app/tools/study-plan/bauman-module-registry.ts");
  assert.match(loader, /status: "unavailable", modules: \[\], mayOpenLearningRuntimeDirectly: false/);
});
