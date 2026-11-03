import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const get=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const route=get("app/api/operations/route.ts");
const start=route.indexOf('if (action === "boi-manager-tier")');
const end=route.indexOf('if (action === "read-automation")',start);
const api=route.slice(start,end);
const ui=get("app/boi-manager-tier-view.tsx");
const dashboard=get("app/management-dashboard-v2.tsx");

test("Owner role and authenticated Boi bridge protect every manager-tier operation",()=>{
  assert.ok(start>0 && end>start);
  assert.match(api,/actor\.role !== "owner"/);
  assert.match(api,/issueBoiBrowserBridge\(actor\.email,actor\.role\)/);
  assert.match(api,/bridgeJson\(bridge,"\/api\/control\/management-access"/);
  assert.match(dashboard,/<BoiManagerTierView\/>/);
});
test("shared 50\/5 limits carry CAS version and independently read D1",()=>{
  assert.match(ui,/expectedLearnerLimit:data\?\.learnerLimit/);
  assert.match(ui,/expectedTeacherLimit:data\?\.teacherLimit/);
  assert.match(api,/validLimit\(expectedLearnerLimit,5000\)/);
  assert.match(api,/validLimit\(expectedTeacherLimit,500\)/);
  assert.match(api,/expectedLearnerLimit,expectedTeacherLimit/);
  assert.match(api,/action:"get-tier-limits"/);
  assert.match(api,/confirmed.scope!=="manager-tier"/);
});
test("manager approval uses owner-only atomic endpoint, never legacy grant-free",()=>{
  assert.match(api,/action:"approve-manager",deviceId,expectedPersonCode,expectedStatus:"pending"/);
  assert.doesNotMatch(api,/action:"grant-free"/);
  assert.match(api,/approvedReadback\.managementEnabled!==true/);
  assert.match(ui,/Duyệt tài khoản và cấp quyền Cán bộ quản lý/);
});
test("manager grant or revoke carries expected permission and separate authority readback",()=>{
  assert.match(ui,/expectedManagementEnabled:device\.managementEnabled/);
  assert.match(api,/expectedManagementEnabled!==bool\(row\.managementEnabled\)/);
  assert.match(api,/expectedPersonCode,enabled:operation==="grant-manager",expectedManagementEnabled/);
  assert.match(api,/action:"get-manager-grant",deviceId,expectedPersonCode/);
  assert.match(api,/verified\.deviceId!==deviceId\|\|typeof verified\.managementEnabled!=="boolean"/);
  assert.match(ui,/const lock=useRef\(false\)/);
});
