import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {loadTs} from "./helpers/load-ts.mjs";
const ID="a".repeat(64),AID="acc_"+"b".repeat(64);
const base={contract:"boi-owner-device-binding.v1",verified:true,bindingId:ID,
 status:"pending",createdAt:"2026-11-13 03:00:00",
 account:{accountId:AID,name:"Synthetic Learner",login:"synthetic",role:"learner",
  status:"pending",onboardingStage:"requested",createdAt:"2026-11-11 01:00:00",revision:1},
 dependencies:{sessions:1,activeSessions:1,syncGrants:0,syncEvents:0,otherTrustedDevices:1},
 purgeAllowed:false,preservesAccount:true,preservesLearning:true,preservesAudit:true};
function fixture({role="owner",broken=false}={}){
 let status="pending",exists=true,called=[];
 const api=loadTs("app/api/apps/boi-ech/device-bindings/route.ts",{
  "../../../../control-device.server":{
   verifyControlProof:async()=>({role,email:"owner@fixture.invalid"}),
   controlErrorResponse:e=>Response.json({error:e.message},{status:500}),
  },
  "../../../../boi-ech.server":{
   issueBoiBrowserBridge:async(_email,_role,scope)=>{
    assert.equal(scope,"account-owner");
    return {baseUrl:"https://boi.fixture.invalid",token:"signed-owner-ticket"};
   },
  },
 },{fetch:async (_url,init)=>{
  let v=JSON.parse(init.body);called.push(v.action);
  assert.match(init.headers.authorization,/^Bearer signed-owner-ticket$/);
  if(v.action==="inspect"){
   if(!exists)return Response.json({code:"DEVICE_BINDING_NOT_FOUND"},{status:404});
   return Response.json({...base,status,dependencies:{...base.dependencies,activeSessions:status==="blocked"?0:1}});
  }
  if(v.action==="revoke"){status="blocked";return Response.json({...base,status,ok:!broken,
   verified:!broken,action:"revoke",dependencies:{...base.dependencies,activeSessions:0}});}
  if(v.action==="purge"){exists=false;return Response.json({ok:!broken,verified:!broken,
   contract:"boi-owner-device-binding.v1",deleted:true,bindingId:ID,preservesAccount:true,preservesLearning:true,preservesAudit:true});}
  return Response.json({code:"INVALID"},{status:400});
 }});
 return {called,post:async action=>{
  const response=await api.POST(new Request("https://app.fixture.invalid/api/apps/boi-ech/device-bindings",{
   method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(action)
  }));
  return {status:response.status,body:await response.json()};
 }};
}
const op={bindingId:ID,confirmation:ID,typedSuffix:ID.slice(-6),reason:"Owner removes unneeded old binding",
 expectedCreatedAt:base.createdAt,expectedStatus:"pending"};
test("Owner opens device and can inspect source-backed dates, role and dependencies",async()=>{
 const f=fixture(),res=await f.post({action:"inspect",bindingId:ID});
 assert.equal(res.status,200);assert.equal(res.body.account.accountId,AID);
 assert.deepEqual(f.called,["inspect"]);
});
test("Revoke then purge require separate confirmed owner actions and independent server readback",async()=>{
 const f=fixture();
 assert.equal((await f.post({action:"purge",...op})).status,409);
 const revoked=await f.post({action:"revoke",...op});
 assert.equal(revoked.status,200);
 assert.equal(revoked.body.detail.status,"blocked");
 const purged=await f.post({action:"purge",...op,expectedStatus:"blocked"});
 assert.equal(purged.status,200);
 assert.equal(purged.body.deleted,true);
 assert.deepEqual(f.called,["inspect","revoke","inspect","inspect","purge","inspect"]);
});
test("Owner role and typed suffix are enforced before upstream access",async()=>{
 const other=fixture({role:"publisher"});
 assert.equal((await other.post({action:"inspect",bindingId:ID})).status,403);
 assert.equal(other.called.length,0);
 const f=fixture();
 assert.equal((await f.post({action:"revoke",...op,typedSuffix:"wrong"})).status,400);
 assert.equal((await f.post({action:"revoke",...op,reason:"bad"})).status,400);
 assert.equal(f.called.length,0);
 const broken=fixture({broken:true});
 assert.equal((await broken.post({action:"revoke",...op})).status,502);
});
test("Revoke and purge require recent enrolled 30-minute TOTP; inspection remains read only",()=>{
 const worker=readFileSync("worker/production-auth.ts","utf8");
 assert.ok(worker.includes('pathname==="/api/apps/boi-ech/device-bindings"'));
 assert.match(worker,/\["revoke","purge"\]\.includes\(text\(payload\.action\)\)/);
 assert.match(worker,/!state\.enabled \|\| !stepUpFresh\(identity\)/);
 assert.match(worker,/stepUpRequiredResponse\(state\.configured && !state\.enabled\)/);
});
test("Device cards are keyboard-accessible and owner delete dialog carries clear consent and error state",()=>{
 const ui=readFileSync("app/apps/boi-ech/boi-ech-control-center.tsx","utf8");
 const css=readFileSync("app/apps/boi-ech/boi-ech-shell.module.css","utf8");
 const api=readFileSync("app/api/apps/boi-ech/device-bindings/route.ts","utf8");
 assert.match(ui,/visibleRegistryDevices\.map\(\(device,index\)=><button type="button"/);
 assert.match(ui,/onClick=\{\(\)=>void inspectBinding\(device.deviceId\)\}/);
 assert.match(ui,/role="dialog" aria-modal="true"/);
 assert.match(ui,/bindingConfirm!==bindingDetail\.bindingId\.slice\(-6\)/);
 assert.match(ui,/Đóng|Xóa vĩnh viễn liên kết khỏi D1/);
 assert.match(css,/boi-binding-backdrop/);
 assert.match(css,/focus-visible/);
 assert.match(api,/issueBoiBrowserBridge\(actor.email,actor.role,"account-owner"\)/);
 assert.match(api,/DEVICE_BINDING_READBACK_FAILED/);
});
