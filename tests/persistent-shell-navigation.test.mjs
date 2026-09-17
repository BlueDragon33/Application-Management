import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("management entry keeps one persistent dashboard shell", () => {
  const entry = source("app/management-entry.tsx");
  assert.match(entry, /return <ManagementDashboard user=\{user\} \/>/);
  assert.doesNotMatch(entry, /ManagementModernOverview/);
});

test("management tabs use history state instead of page navigation", () => {
  const dashboard = source("app/management-dashboard.tsx");
  assert.match(dashboard, /window\.history\.pushState/);
  assert.match(dashboard, /function switchView\(next: View\)/);
});
