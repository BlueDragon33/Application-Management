import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../app/management-dashboard-v2.tsx", import.meta.url), "utf8");
const root = source.split("export default function ManagementDashboardV2")[1]?.split("\nfunction AccountSecurityDialog")[0] ?? "";
const clock = source.split("function OverviewClock(")[1]?.split("\nfunction Gate(")[0] ?? "";

test("normal dashboard does not receive one-second clock state renders", () => {
  assert.ok(root && clock, "dashboard and local clock components are required");
  assert.doesNotMatch(root, /setClock\(|\[clock,\s*setClock\]/);
  assert.match(clock, /window\.setInterval\(update, 1000\)/);
  assert.match(clock, /window\.clearInterval\(timer\)/);
  assert.match(root, /view === "overview" \? <OverviewClock offline=\{offline\} unavailableCount=\{unavailableCount\}\/>/);
  assert.match(clock, /"Chưa xác minh online"/);
  assert.match(clock, /"Cần kiểm tra"/);
});

test("snapshot freshness ticks only during policy editing and is checked again on save", () => {
  assert.match(root, /if \(!autoPolicyOpen\) return;\s*const timer = window\.setInterval\(\(\) => setSnapshotNow\(Date\.now\(\)\), 1000\);/);
  assert.match(root, /window\.clearInterval\(timer\);\s*\}, \[autoPolicyOpen\]\);/);
  assert.match(root, /function openAutomationPolicies\(\) \{\s*setSnapshotNow\(Date\.now\(\)\)/);
  assert.match(root, /const automationSnapshotVerified = hasVerifiedAutomationSnapshot\(operationsVerified, operations\?\.generatedAt, snapshotNow\)/);
  assert.match(root, /async function saveAutomation[\s\S]*?if \(!hasVerifiedAutomationSnapshot\(operationsVerified, operations\?\.generatedAt\)\)/);
  assert.doesNotMatch(root, /setInterval\(\(\) => setClock/);
});

test("LIVE policy authorization rejects stale, future, malformed and unverified timestamps", () => {
  const match = source.match(/function hasVerifiedAutomationSnapshot\([\s\S]*?\n\}/);
  assert.ok(match, "freshness predicate must exist");
  const js = ts.transpileModule(match[0], {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const ctx = {};
  vm.runInNewContext(js + "\nthis.isFresh = hasVerifiedAutomationSnapshot;", ctx);
  const isFresh = ctx.isFresh;
  const now = 2_000_000;
  const time = age => new Date(now - age).toISOString();
  assert.equal(isFresh(true, time(0), now), true);
  assert.equal(isFresh(true, time(120_000), now), true);
  assert.equal(isFresh(true, time(120_001), now), false);
  assert.equal(isFresh(true, time(-1), now), false);
  assert.equal(isFresh(false, time(0), now), false);
  assert.equal(isFresh(true, undefined, now), false);
  assert.equal(isFresh(true, "invalid-date", now), false);
});
