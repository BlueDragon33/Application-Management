import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("user-facing management copy does not expose implementation version labels", () => {
  const visibleSources = [
    source("app/application-registry.ts"),
    source("app/apps/bauman-master-ai/bauman-admin.tsx"),
    source("app/management-dashboard-v2.tsx"),
  ].join("\n");

  for (const forbidden of [
    /Bauman Control v\d+/i,
    /Device Gate v\d+/i,
    /Device Contract v\d+/i,
    /Quản trị Ứng dụng Ver\d+/i,
    /Kiểm soát Ver\d+/i,
    /v2\.0/i,
  ]) {
    assert.doesNotMatch(visibleSources, forbidden);
  }
});
