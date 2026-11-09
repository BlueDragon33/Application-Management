import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const view = fs.readFileSync(new URL("../app/boi-access-view.tsx", import.meta.url), "utf8");
const client = fs.readFileSync(new URL("../app/boi-access-client.ts", import.meta.url), "utf8");
const route = fs.readFileSync(new URL("../app/api/apps/boi-ech/access/route.ts", import.meta.url), "utf8");

test("V2 account summary uses an isolated verified aggregate display without device/payment actions", () => {
  assert.match(view, /if \(data\.contract === "boi-account-summary\.v2"\)/);
  assert.match(view, /data\.verified !== true \|\| !data\.summary/);
  assert.match(view, /Tổng tài khoản/);
  assert.match(view, /Chưa xác minh đầy đủ/);
  assert.match(view, /Chế độ Account-first V2: không hỗ trợ thao tác thiết bị\/thanh toán cũ/);
  assert.ok(view.indexOf('if (data.contract === "boi-account-summary.v2")') < view.indexOf("const rowBusy ="));
  assert.match(route, /counts: null/);
  assert.match(client, /contract\?: "boi-account-summary\.v2"/);
});

test("a failed server readback discards stale snapshot and never renders false-zero counters", () => {
  assert.match(view, /setData\(null\); \/\/ Never retain a stale verified snapshot/);
  assert.match(view, /if \(!data\)/);
  assert.match(view, /Chưa có số liệu đáng tin cậy/);
  assert.doesNotMatch(view, /data\?\.counts\.\w+\s*\?\?\s*0/);
  assert.doesNotMatch(route, /const devices = rows\(result\.payload\)\.map\(accessDevice\);\s*return json\(/);
});
