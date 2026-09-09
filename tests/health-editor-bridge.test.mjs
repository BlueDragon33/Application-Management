import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Health admin launches editing inside the independent Health_Care site", () => {
  const client = source("app/apps/health-care/health-care-admin.tsx");
  assert.match(client, /Mở trình biên tập Health_Care/);
  assert.match(client, /\/editor-bridge#ticket=/);
  assert.match(client, /freshBridge\(\)/);
  assert.match(client, /popup\.opener = null/);
  assert.doesNotMatch(client, /\/api\/editor\/session\?ticket=/);
  assert.doesNotMatch(client, /learning-management\.boiech-ai\.workers\.dev/);
});

test("Health editor launch remains gated by reviewer-or-higher role", () => {
  const client = source("app/apps/health-care/health-care-admin.tsx");
  assert.match(client, /if \(!canReview\) return;/);
  assert.match(client, /role === "reviewer" \|\| canManage/);
});
