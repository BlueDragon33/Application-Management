import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {loadTs} from "./helpers/load-ts.mjs";
const id="acc_"+"a".repeat(64);
function routeFixture({role="owner",archiveVerified=true,readbackStatus="blocked",readbackRevision=8}={}){
 const sent=[];
 const route=loadTs("app/api/apps/boi-ech/account-entitlements/route.ts",{
  "../../../../control-device.server":{
    verifyControlProof:async()=>({role,email:"owner@fixture.invalid"}),
    controlErrorResponse:e=>Response.json({error:e.message},{status:500})
  },
  "../../../../boi-ech.server":{
    issueBoiBrowserBridge:async()=>({baseUrl:"https://boi.fixture.invalid",token:"fixture-owner-token"})
  }
 },{fetch:async(url,init)=>{
  const payload=JSON.parse(init.body);sent.push(payload);
  if(payload.action==="archive-manager")
   return Response.json({verified:archiveVerified,accountId:id,status:"blocked",retainedHistory:true});
  if(payload.action==="read")
   return Response.json({accountId:id,role:"manager",status:readbackStatus,
    revision:readbackRevision,permissions:[{scope:"manager.manage.assigned",configured:false}]});
  return Response.json({});
 }});
 return {sent,post:async(payload)=>{const response=await route.POST(new Request(
   "https://app.fixture.invalid/api/apps/boi-ech/account-entitlements",{
   method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)}));
  return {status:response.status,body:await response.json()};
 },role};
}
const request={action:"manager-archive",accountId:id,confirmation:id,
 expectedRevision:7,reason:"Owner confirmed old unused manager account"};
test("Owner archival uses signed server and independent readback; rejects unverified mutation",async()=>{
 const f=routeFixture();
 const result=await f.post(request);
 assert.equal(result.status,200);assert.equal(result.body.verified,true);
 assert.equal(result.body.retainedHistory,true);
 assert.deepEqual(f.sent.map(x=>x.action),["archive-manager","read"]);
 assert.equal(f.sent[0].confirmation,id);
 const mismatch=routeFixture({readbackRevision:7});
 assert.equal((await mismatch.post(request)).status,502);
 const denied=routeFixture({archiveVerified:false});
 assert.equal((await denied.post(request)).status,502);
});
test("Archive rejects invalid confirmation/reason BEFORE touching BOI",async()=>{
 const f=routeFixture();
 assert.equal((await f.post({...request,confirmation:"wrong"})).status,400);
 assert.equal((await f.post({...request,reason:"short"})).status,400);
 assert.equal(f.sent.length,0);
});
test("Manager roster is date-aware, V2 cards restore icons and no false online claims",()=>{
 const ui=readFileSync("app/apps/boi-ech/account-expiry-panel.tsx","utf8");
 const device=readFileSync("app/apps/boi-ech/boi-ech-control-center.tsx","utf8");
 const css=readFileSync("app/apps/boi-ech/boi-ech-shell.module.css","utf8");
 const api=readFileSync("app/api/apps/boi-ech/account-entitlements/route.ts","utf8");
 const client=readFileSync("app/boi-access-client.ts","utf8");
 for(const part of ["FOUR_DAYS_MS","m.activeSessions===0","managerFilter","archiveBoiManagerAccount",
    "boi-manager-facts","boi-manager-archive-dialog","LUU TRU","managerSearch"])assert.ok(ui.includes(part),part);
 for(const part of ["boi-registry-grid","boi-registry-metrics","boi-registry-toolbar",
    "<Laptop active={false} status={device.status}","registryFilter","visibleRegistryDevices"])assert.ok(device.includes(part),part);
 assert.match(css,/boi-manager-archive-dialog/);assert.match(css,/boi-registry-grid/);
 assert.match(api,/createdAt:a.createdAt,lastSeenAt:a.lastSeenAt/);
 assert.match(client,/activeSessions:number/);
});
