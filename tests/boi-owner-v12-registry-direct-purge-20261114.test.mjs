import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const app=fs.readFileSync("app/apps/boi-ech/boi-ech-control-center.tsx","utf8");
const css=fs.readFileSync("app/apps/boi-ech/owner-binding-bulk.module.css","utf8");
const boiPreview=fs.readFileSync("app/api/apps/boi-ech/manager-purge/route.ts","utf8");
test("Owner device registry has inline pending/revoked checkbox actions without opening details",()=>{
 for(const label of ["Chờ xác nhận","Đã thu hồi","Xóa đã chọn","Xóa đã thu hồi","Xóa liên kết"])
  assert.ok(app.includes(label),label);
 assert.match(app,/registrySelected/);
 assert.match(app,/className=\{bindingUi.card\}/);
 assert.match(app,/type="checkbox" aria-label=\{\x60Chọn xóa liên kết/);
 assert.match(app,/device.status==="approved"/);
 assert.match(app,/registrySelected.length>=10/);
 assert.match(css,/\.cardCheck input/);
 assert.match(css,/@media\(max-width:720px\)/);
});
test("Every direct/bulk delete re-inspects actual Owner binding and enforces protected status and CAS",()=>{
 assert.match(app,/async function purgeRegistrySelection\(ids:string\[\]\)/);
 assert.match(app,/action:"inspect",bindingId:id/);
 assert.match(app,/details.purgeAllowed/);
 assert.match(app,/details.status!=="blocked"&&details.status!=="pending"/);
 assert.match(app,/expectedStatus:details.status,expectedCreatedAt:details.createdAt/);
 assert.match(app,/typedSuffix:id.slice\(-6\)/);
 assert.match(app,/reply.deleted!==true\|\|reply.bindingId!==id/);
 assert.match(app,/STEP_UP_REQUIRED/);
 assert.match(app,/e.data.applied!==false/);
 assert.match(app,/await refresh\(credential,access,\{discoverNew:true\}\)/);
 assert.doesNotMatch(app,/DELETE FROM account_devices/);
});
test("Batch is bounded, manual-confirmed, and stops after first uncertain write",()=>{
 assert.match(app,/\.slice\(0,10\)/);
 assert.match(app,/window.prompt\("Xóa vĩnh viễn "/);
 assert.match(app,/XOA LIEN KET/);
 assert.match(app,/window.confirm\("Xác nhận xóa "/);
 assert.match(app,/Đã dừng tại lỗi tiếp theo/);
 assert.match(boiPreview,/r.accessStatus==="pending"/);
});
test("Owner registry and modern dashboard JSX parse cleanly",()=>{
 const parsed=ts.createSourceFile("boi-ech-control-center.tsx",app,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(parsed.parseDiagnostics.length,0,parsed.parseDiagnostics.map(z=>z.messageText).join("; "));
});
