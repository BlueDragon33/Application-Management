import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const visibleSources = [
  "app/page.tsx",
  "app/management-dashboard-v2.tsx",
  "app/application-registry.ts",
  "app/access-management.tsx",
  "app/projects/projects-catalog.tsx",
  "app/api/operations/route.ts",
  "scripts/run-local-system.mjs",
  "scripts/run-all.mjs",
];

const forbiddenVisibleLabels = [
  "Quản trị Ứng dụng Ver2",
  "Kiểm soát Ver2",
  "v2.0",
  "device control v4",
  "Bauman Control v4",
  "Device Gate v4",
];

test("user-visible management sources do not expose release/version labels", () => {
  for (const path of visibleSources) {
    const text = source(path);
    for (const label of forbiddenVisibleLabels) {
      assert.equal(text.includes(label), false, `${path} must not expose ${JSON.stringify(label)}`);
    }
  }
});

test("release-label DOM mutator is no longer part of the application", () => {
  const page = source("app/page.tsx");
  assert.doesNotMatch(page, /release-label-cleanup|ReleaseLabelCleanup/);
  assert.equal(fs.existsSync(new URL("../app/release-label-cleanup.tsx", import.meta.url)), false);
});
