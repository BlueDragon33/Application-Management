import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const manager=fs.readFileSync("app/apps/boi-ech/owner-manager-purge-panel.tsx","utf8");
const expiry=fs.readFileSync("app/apps/boi-ech/account-expiry-panel.tsx","utf8");
const route=fs.readFileSync("app/api/apps/boi-ech/manager-purge/route.ts","utf8");
const client=fs.readFileSync("app/boi-access-client.ts","utf8");
const managerCss=fs.readFileSync("app/apps/boi-ech/owner-manager-purge.module.css","utf8");
const oversightCss=fs.readFileSync("app/apps/boi-ech/owner-directory-v12.module.css","utf8");

test("Owner V12 selection and quick actions live on manager cards, never require opening a profile",()=>{
 assert.match(manager,/surface\?:"launch"\|"cards"/);
 assert.match(manager,/surface==="cards"\?<section/);
 assert.match(manager,/className=\{styles.directCard\}/);
 assert.match(manager,/type="checkbox" aria-label=\{\x60Chọn xóa/);
 assert.match(manager,/onChange=\{e=>toggle\(r.accountId,e.target.checked\)\}/);
 assert.match(manager,/Chờ xác nhận/);
 assert.match(manager,/Đã thu hồi/);
 assert.match(manager,/Xóa đã chọn/);
 assert.match(manager,/Xóa tất cả đã thu hồi/);
 assert.match(manager,/setSelected\(\[r.accountId\]\)/);
 assert.match(manager,/window.confirm/);
 assert.match(manager,/confirmation!=="XOA VINH VIEN CAN BO"/);
 assert.match(manager,/MAX=10/);
});
test("Owner V12 retains Owner MFA, CAS, independent D1 readback and protected account states",()=>{
 assert.match(manager,/purgeOwnerManagerAccount/);
 assert.match(manager,/STEP_UP_REQUIRED/);
 assert.match(manager,/d\?\.applied!==false/);
 assert.match(route,/verifyControlProof/);
 assert.match(route,/owner.role!=="owner"/);
 assert.match(route,/Number.isSafeInteger\(r.activeSessions\)/);
 assert.match(route,/r.accessStatus==="approved"/);
 assert.match(route,/r.eligible===true/);
 assert.match(route,/check.data.exists!==false/);
 assert.match(client,/snapshot:string/);
 assert.match(manager,/disabled=\{busy\|\|!r.eligible/);
});
test("Owner policy and manager account tabs render new direct dashboard; legacy operations remain accessible but collapsed",()=>{
 assert.match(expiry,/section==="accounts"\?<></);
 assert.match(expiry,/OwnerManagerPurgePanel surface="cards"/);
 assert.match(expiry,/onManage=\{accountId=>/);
 assert.match(expiry,/boi-manager-inbox/);
 assert.match(expiry,/Quy trình bảo trì nâng cao/);
 assert.match(expiry,/Tác vụ chuyên sâu/);
 assert.match(expiry,/moscow\(a.entitlement\?\.expiresAt\)/);
 assert.match(expiry,/if\(value==="9999-12-31T23:59:59.000Z"\)return "Không giới hạn"/);
});
test("Teacher and learner oversight is responsive, rich and never directly unlocks protected deletion",()=>{
 assert.match(expiry,/design.peopleStats/);
 assert.match(expiry,/design.peopleGrid/);
 assert.match(expiry,/oversightRole/);
 assert.match(expiry,/oversightState/);
 assert.match(expiry,/OwnerAccountCleanupPanel/);
 assert.match(expiry,/Giám sát chỉ đọc/);
 assert.match(oversightCss,/@media\(max-width:650px\)/);
 assert.match(managerCss,/@media\(max-width:620px\)/);
 assert.match(managerCss,/\.cardCheck input:disabled/);
});
test("New JSX and server route parse with the project TypeScript version",()=>{
 for(const [name,source,kind] of [
  ["manager",manager,ts.ScriptKind.TSX],
  ["expiry",expiry,ts.ScriptKind.TSX],
  ["route",route,ts.ScriptKind.TS]
 ]){
  const parsed=ts.createSourceFile(name,source,ts.ScriptTarget.Latest,true,kind);
  assert.equal(parsed.parseDiagnostics.length,0,name+" "+parsed.parseDiagnostics.map(x=>x.messageText).join("; "));
 }
});
