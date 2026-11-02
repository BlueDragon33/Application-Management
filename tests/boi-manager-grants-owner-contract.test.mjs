import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const get=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const api=get("app/api/operations/route.ts");
const page=get("app/apps/boi-ech/boi-ech-control-center.tsx");
const ui=get("app/apps/boi-ech/boi-manager-grants.tsx");
test("central Owner proof and role gate protect every manager-tier action",()=>{
 assert.match(api,/if \(action === "boi-manager-access"\)/);
 assert.match(api,/if \(actor\.role !== "owner"\)/);
 assert.match(api,/\["get-tier-limits","set-tier-limits","grant-manager","get-manager-grant","approve-manager"\]/);
 assert.match(api,/issueBoiBrowserBridge\(actor\.email,actor\.role\)/);
 assert.match(api,/bridgeJson\(bridge,"\/api\/control\/management-access"/);
});
test("Owner UI writes global 50\/5 limits only after independent GET",()=>{
 assert.match(ui,/useState\("50"\)/);
 assert.match(ui,/useState\("5"\)/);
 assert.match(ui,/action:"set-tier-limits"/);
 assert.match(ui,/await invoke\(\{action:"get-tier-limits"\}\)/);
 assert.match(ui,/verified\.learnerLimit!==l\|\|verified\.teacherLimit!==t/);
});
test("manager grant and revocation require separate D1 verification",()=>{
 assert.match(ui,/action:"grant-manager"/);
 assert.match(ui,/action:"get-manager-grant"/);
 assert.match(ui,/read\.managementEnabled!==enabled/);
 assert.match(ui,/lock\.current=true/);
 assert.match(page,/access\.role === "owner" \? <BoiManagerGrants/);
 assert.match(page,/onUpdated=\{async\(\)=>\{await refresh/);
});

test("Owner can approve only pending Boi managers with independent permission readback",()=>{
 assert.match(api,/command==="approve-manager"/);
 assert.match(ui,/async function approve\(manager:Manager\)/);
 assert.match(ui,/manager\.status!=="pending"/);
 assert.match(ui,/action:"approve-manager"/);
 assert.match(ui,/read\.accountApproved!==true\|\|read\.managementEnabled!==true/);
});
test("Owner quota and manager grants use CAS and production 2FA",()=>{
 assert.match(ui,/expectedLearnerLimit:limits\.learnerLimit,expectedTeacherLimit:limits\.teacherLimit/);
 assert.match(ui,/expectedManagementEnabled:before\.managementEnabled/);
 assert.match(api,/MANAGER_LIMIT_CAS_REQUIRED/);
 assert.match(api,/MANAGER_GRANT_CAS_REQUIRED/);
 const security=get("worker/production-auth.ts");
 assert.match(security,/action === "boi-manager-access"/);
 assert.match(security,/\["get-tier-limits", "get-manager-grant"\]\.includes\(operation\)/);
});
