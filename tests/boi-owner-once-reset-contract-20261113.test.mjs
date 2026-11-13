import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read=p=>fs.readFileSync(new URL("../app/"+p,import.meta.url),"utf8");

test("one-time Owner reset uses existing account panel and requires three protected identities",()=>{
 const ui=read("apps/boi-ech/owner-once-roster-reset-panel.tsx");
 const parent=read("apps/boi-ech/account-expiry-panel.tsx");
 assert.match(parent,/OwnerOnceRosterResetPanel/);
 assert.match(ui,/Thiên Sơn/);
 assert.match(ui,/Đông Nghi/);
 assert.match(ui,/Ngô Tuyết Quỳnh/);
 assert.match(ui,/protectedPeople\.map/);
 assert.match(ui,/current\.protectedPeople\[0\]\.deviceId/);
 assert.match(ui,/current\.protectedPeople\[1\]\.deviceId/);
 assert.match(ui,/current\.protectedPeople\[2\]\.deviceId/);
 assert.match(ui,/XOA TAT CA TRU NGO TUYET QUYNH, THIEN SON VA DONG NGHI/);
 assert.match(ui,/BOOKMARK\.test\(bookmark\.trim\(\)\)/);
 assert.match(ui,/window\.confirm\(/);
 assert.match(ui,/if\(current\.state==="completed"\|\|current\.state==="retention_review"\)break/);
 assert.match(ui,/lock\.current=true/);
});
test("App proxy enforces Owner device proof and MFA before any signed BOI deletion",()=>{
 const route=read("api/apps/boi-ech/once-roster-reset/route.ts");
 assert.match(route,/verifyControlProof/);
 assert.match(route,/actor\.role!=="owner"/);
 assert.match(route,/issueBoiBrowserBridge\(actor\.email,actor\.role,"account-owner"\)/);
 assert.match(route,/\/api\/control\/v2\/once-roster-reset/);
 assert.match(route,/redirect:"manual"/);
 assert.match(route,/data\.protectedPeople\.length!==3/);
 assert.match(route,/check\.data\.eligible!==data\.remaining/);
 assert.match(route,/check\.data\.removedInSession!==data\.totalDeleted/);
 assert.match(route,/applied:"unknown"/);
});
test("Owner UI never automatically fires destructive one-time reset on mount, nor on new registrations",()=>{
 const ui=read("apps/boi-ech/owner-once-roster-reset-panel.tsx");
 assert.match(ui,/onClick=\{\(\)=>void purge\(\)\}/);
 const effectBodies=[...ui.matchAll(/useEffect\(\(\)=>\{([\s\S]*?)\},\[\]\);/g)].map(m=>m[1]);
 assert.ok(effectBodies.every(body=>!body.includes("executeOwnerOnceRosterBatch")));
 assert.match(ui,/Hồ sơ có chứng chỉ, lịch học, thanh toán/);
});
