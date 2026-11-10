import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const main=fs.readFileSync("app/apps/boi-ech/boi-ech-control-center.tsx","utf8");
const overview=fs.readFileSync("app/apps/boi-ech/boi-owner-overview.tsx","utf8");
const panel=fs.readFileSync("app/apps/boi-ech/account-expiry-panel.tsx","utf8");
const css=fs.readFileSync("app/apps/boi-ech/boi-ech-shell.module.css","utf8");

test("Owner approves managers exclusively, monitors teacher and learner as read-only",()=>{
  assert.match(main,/tab==="accounts" && access\.role==="owner"/);
  assert.match(main,/tab==="oversight" && access\.role==="owner"/);
  assert.match(main,/<AccountExpiryPanel section="accounts"/);
  assert.match(main,/<AccountExpiryPanel section="oversight"/);
  assert.match(panel,/section==="oversight"&&accountsVerified/);
  assert.match(panel,/\["teacher","learner"\]\.includes\(a\.role\)/);
  assert.match(panel,/current\.role!=="manager"/);
  assert.match(panel,/section==="accounts"\?<>/);
  assert.match(panel,/Giám sát chỉ đọc/);
  assert.match(overview,/pendingLearners/);
  assert.match(overview,/Owner duyệt/);
  assert.doesNotMatch(overview,/reviewBoiManagerAccount|changeBoiAccountDuration|changeBoiDefaultAccountDays/);
});

test("Manager one-review approval is sole Owner action, separate from account expiry",()=>{
  assert.match(panel,/reviewBoiManagerAccount\("manager-review-first",m\.accountId,m\.onboardingRevision\)/);
  assert.match(panel,/manager-review-first/);
  assert.doesNotMatch(panel,/Duyệt vòng 2 — kích hoạt|decideManager\(m,"manager-review-final"\)/);
  assert.match(panel,/Chưa xác minh cấu hình duyệt một lần/);
  assert.match(panel,/section==="accounts"\?<>/);
  assert.match(panel,/section==="policies"&&accountsVerified/);
  assert.match(panel,/section==="policies"&&policies\.length/);
  assert.match(main,/<AccountExpiryPanel section="policies"/);
});

test("Owner KPIs and queues never use hardcoded examples or false zero when backend fails",()=>{
  assert.match(overview,/Promise\.all\(\[loadBoiAccountDurations\(\),loadBoiManagerInbox\(\)\]\)/);
  assert.match(overview,/setSnapshot\(null\)/);
  assert.match(overview,/stats\?Number\(value\)\.toLocaleString\("vi-VN"\):"—"/);
  assert.match(overview,/Hàng chờ chưa được xác minh/);
  assert.doesNotMatch(overview,/Nguyễn Văn Thành|Trần Thị Lan|Phạm Văn Dũng|\b142\b/);
  assert.match(main,/const devicesVerified = Boolean\(boiOnline && dashboard && !dashboard\.upstreamError\)/);
  assert.match(main,/devicesVerified \? n\.toLocaleString\("vi-VN"\) : "—"/);
});

test("Approved dashboard preserves existing distinct device, AI, content and export controls",()=>{
  assert.match(main,/tab === "devices"/);
  assert.match(main,/tab === "ai"/);
  assert.match(main,/tab === "content"/);
  assert.match(main,/tab==="reports"/);
  assert.match(main,/exportDevices/);
  assert.match(main,/DeviceDrawer/);
  assert.match(main,/canManage=\{access\.role === "owner" && selected\.personRole === "manager" && process\.env\.NEXT_PUBLIC_BOI_ECH_SINGLE_REVIEW !== "true"\}/);
  assert.match(main,/canDelete=\{access\.role === "owner" && selected\.personRole === "manager" && process\.env\.NEXT_PUBLIC_BOI_ECH_SINGLE_REVIEW !== "true"\}/);
  assert.match(main,/readOnly=\{!canManage\}/);
  assert.match(main,/Chỉ giám sát · Giảng viên và học viên/);
  assert.match(main,/AiControlCenter/);
  assert.match(main,/ContentReviewCenter/);
  assert.match(main,/Control API đã xác minh/);
});

test("Responsive layout supports narrow screens and keyboard focus, avoids page-wide table overflow",()=>{
  assert.match(css,/@media \(max-width:1350px\)/);
  assert.match(css,/@media \(max-width:1050px\)/);
  assert.match(css,/@media \(max-width:820px\)/);
  assert.match(css,/@media \(max-width:560px\)/);
  assert.match(css,/overflow-x:auto/);
  assert.match(css,/:focus-visible/);
  assert.match(css,/prefers-reduced-motion/);
  assert.match(overview,/<table className="boi-owner-table"/);
});

test("Empty BE device registry never fabricates online/zero without Control API readback",()=>{
  assert.match(main,/discoverNew \|\| currentDevices\.length === 0/);
  assert.match(main,/boiApi\(currentDashboard\.boiBridge, "\/api\/control\/overview"/);
  assert.match(main,/if \(!Array\.isArray\(upstream\.devices\)\)/);
  assert.match(main,/throw new Error\("Control API chưa trả về danh sách thiết bị được xác minh\."\)/);
  assert.doesNotMatch(main,/if \(!discoverNew && currentDevices\.length === 0\) \{\s*setBoiOnline\(true\)/);
});
