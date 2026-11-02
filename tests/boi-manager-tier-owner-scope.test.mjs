import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const route=readFileSync(new URL("../app/api/operations/route.ts",import.meta.url),"utf8");
const source=route.slice(route.indexOf("async function loadBoi("),route.indexOf("async function loadHealth(",route.indexOf("async function loadBoi(")));

test("App-Manager queues only Bơi Ếch manager accounts",()=>{
  assert.match(source,/\.filter\(\(row\) => text\(row\.personRole\) === "manager"\)/);
  assert.match(source,/approve: actor\.role === "owner", remove: false/);
  assert.doesNotMatch(source,/approve: actor\.role === "publisher" \|\| actor\.role === "owner"/);
});
test("Bơi Ếch queue reads the signed client overview, not local guessed state",()=>{
  assert.match(source,/bridgeReadJson\(bridge, "\/api\/control\/overview\?activityDays=0"\)/);
  assert.match(source,/const devices = rows\(data\)/);
  assert.match(source,/Missing\/unknown roles are fail-closed/);
});

test("Bơi Ếch specialist admin also displays only manager accounts",()=>{
  const control=readFileSync(new URL("../app/apps/boi-ech/boi-ech-control-center.tsx",import.meta.url),"utf8");
  assert.match(control,/if \(device\.personRole !== "manager"\) return false/);
  assert.match(control,/const managerDevices = dashboard\?\.learningDevices\.filter\(\(device\) => device\.personRole === "manager"\)/);
  assert.match(control,/Chỉ xét duyệt cấp quản lý/);
});
