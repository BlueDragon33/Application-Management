import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
}

test("Bauman readiness is driven by live runtime, topology, review and policy fields", () => {
  const admin = source("app/apps/bauman-master-ai/bauman-admin.tsx");
  assert.match(admin, /summary\?\.runtimeConnected \? "available" : "implemented"/);
  assert.match(admin, /summary\?\.subclientInventoryLive === true/);
  assert.match(admin, /summary\?\.contentReviewReady \? "available" : "implemented"/);
  assert.match(admin, /summary\?\.webAccessPolicy === "allow"/);
  assert.match(admin, /child\.controlState \|\|/);
  assert.match(admin, /Topology đang đọc live/);
});

test("Bauman UI does not hard-code direct runtime policy text", () => {
  const admin = source("app/apps/bauman-master-ai/bauman-admin.tsx");
  assert.match(admin, /directRuntimeOpenAllowed \?/);
  assert.match(admin, /Policy hiện cho phép mở learning runtime trực tiếp/);
  assert.match(admin, /Policy hiện chặn mở learning runtime trực tiếp từ Application Management/);
});
