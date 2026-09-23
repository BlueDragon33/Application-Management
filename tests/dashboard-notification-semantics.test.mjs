import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("notification badges count dismissible work items instead of double-counting pending devices", () => {
  const ui = source("app/management-dashboard-v2.tsx");
  assert.match(ui, /const notificationCount = workItems\.length/);
  assert.match(ui, /const approvalCount = approvalDevices\.length/);
  assert.match(ui, /const highAlerts = workItems\.filter\(\(item\) => item\.priority === "high"\)\.length/);
  assert.doesNotMatch(ui, /pendingDevices\.length \+ workItems\.length/);
  assert.doesNotMatch(ui, /workItems\.filter\(\(item\) => item\.priority === "high"\)\.length \+ unavailableCount/);
});

test("approval queue renders actionable devices once and keeps connection alerts in alerts", () => {
  const ui = source("app/management-dashboard-v2.tsx");
  assert.match(ui, /const filteredApprovalDevices = filteredDevices\.filter/);
  assert.match(ui, /<ApprovalView devices=\{filteredApprovalDevices\}/);
  assert.doesNotMatch(ui, /<ApprovalView[^>]*workItems=/);
  assert.match(ui, /workItems\.filter\(\(item\) => item\.kind === "connection"\)/);
});

test("Boi device actions are labeled as classification or permanent deletion", () => {
  const ui = source("app/management-dashboard-v2.tsx");
  assert.match(ui, /device\.appId === "boi-ech" \? "Phân quyền" : "Duyệt"/);
  assert.match(ui, /device\.appId === "boi-ech" \? "Xóa" : "Khóa"/);
  assert.doesNotMatch(ui, /device\.appId === "boi-ech" \? "Từ chối" : "Khóa"/);
  assert.doesNotMatch(ui, /device\.appId === "boi-ech" \? "Loại bỏ" : "Khóa"/);
});
