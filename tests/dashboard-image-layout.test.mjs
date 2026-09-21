import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("root mounts the current v2 presentation stack in deterministic order", () => {
  const page = source("app/page.tsx");
  const files = [
    "management-dashboard-v2.css",
    "management-dashboard-v2-reference.css",
    "management-dashboard-v2-views.css",
    "management-dashboard-v2-final.css",
    "management-dashboard-v2-compact-tables.css",
    "management-dashboard-v2-typography.css",
  ];
  let previous = -1;
  for (const file of files) {
    const index = page.indexOf(file);
    assert.ok(index > previous, `${file} must load after the previous layer`);
    previous = index;
  }
});

test("current final layout owns desktop overview placement", () => {
  const css = source("app/management-dashboard-v2-final.css");
  assert.match(css, /\.amv2-apps-panel/);
  assert.match(css, /\.amv2-priority-panel/);
  assert.match(css, /\.amv2-alert-panel/);
  assert.match(css, /\.amv2-devices-panel/);
});

test("dashboard shell is constrained to one desktop viewport", () => {
  const css = source("app/management-dashboard-v2-final.css");
  assert.match(css, /\.amv2-shell[\s\S]*height:\s*100dvh/);
  assert.match(css, /overflow:\s*hidden/);
});
