import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {loadTs} from "./helpers/load-ts.mjs";
const id="acc_"+"a".repeat(64);
const path=p=>readFileSync(p,"utf8");

test("R4: manager Owner inbox is polished responsive UI with real backend-state badges",()=>{
 const ui=path("app/apps/boi-ech/account-expiry-panel.tsx");
 const css=path("app/apps/boi-ech/boi-ech-shell.module.css");
 for(const klass of ["boi-manager-inbox","boi-manager-summary","boi-manager-case","boi-manager-progress","boi-manager-test-tools"]){
  assert.ok(ui.includes(klass),"UI missing "+klass);
  assert.ok(css.includes(klass),"CSS missing "+klass);
 }
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/@media\(max-width:460px\)/);
 assert.match(ui,/managerInbox\.filter\(m=>m\.status==="pending"/);
 assert.match(ui,/Hủy hồ sơ thử nghiệm · Chỉ Offline/);
});
function fixture({role="owner",origin="http://127.0.0.1:3000",bridge="http://127.0.0.1:3004",reply={verified:true,deletedAccountId:id,auditId:74}}={}){
 const calls=[];
 const api=loadTs("app/api/apps/boi-ech/account-entitlements/route.ts",{
  "../../../../control-device.server":{
    verifyControlProof:async()=>({role,email:"owner@fixture.invalid"}),
    controlErrorResponse:e=>Response.json({error:e.message},{status:500})
  },
  "../../../../boi-ech.server":{
    issueBoiAccountBridge:async()=>({baseUrl:bridge,token:"fixture-only-owner-token"})
  }
 },{fetch:async(url,init)=>{calls.push({url,payload:JSON.parse(init.body)});return Response.json(reply);}});
 return {calls,async run(){
  const res=await api.POST(new Request(origin+"/api/apps/boi-ech/account-entitlements",{
   method:"POST",headers:{"content-type":"application/json"},
   body:JSON.stringify({action:"manager-delete-local",accountId:id,confirmation:id,expectedRevision:2})
  }));
  return {status:res.status,payload:await res.json()};
 }};
}
test("R4: cancellation is blocked without BOTH loopback origin and local-flag",async()=>{
 const prevA=process.env.LOCAL_DEV_AUTH,prevB=process.env.NEXT_PUBLIC_BOI_ECH_SINGLE_REVIEW;
 try{
  process.env.LOCAL_DEV_AUTH="0";process.env.NEXT_PUBLIC_BOI_ECH_SINGLE_REVIEW="true";
  const disabled=fixture();assert.equal((await disabled.run()).status,403);assert.equal(disabled.calls.length,0);
  process.env.LOCAL_DEV_AUTH="1";
  const remote=fixture({origin:"https://app.example.invalid"});
  assert.equal((await remote.run()).status,403);assert.equal(remote.calls.length,0);
  const wrongBridge=fixture({bridge:"https://boi.example.invalid"});
  assert.equal((await wrongBridge.run()).status,403);assert.equal(wrongBridge.calls.length,0);
 }finally{
  if(prevA===undefined)delete process.env.LOCAL_DEV_AUTH;else process.env.LOCAL_DEV_AUTH=prevA;
  if(prevB===undefined)delete process.env.NEXT_PUBLIC_BOI_ECH_SINGLE_REVIEW;else process.env.NEXT_PUBLIC_BOI_ECH_SINGLE_REVIEW=prevB;
 }
});
test("R4: authenticated local Owner deletion uses exact ID+CAS and verifies upstream audit",async()=>{
 const prevA=process.env.LOCAL_DEV_AUTH,prevB=process.env.NEXT_PUBLIC_BOI_ECH_SINGLE_REVIEW;
 try{
  process.env.LOCAL_DEV_AUTH="1";process.env.NEXT_PUBLIC_BOI_ECH_SINGLE_REVIEW="true";
  const f=fixture();const response=await f.run();
  assert.equal(response.status,200);assert.equal(response.payload.verified,true);
  assert.deepEqual(f.calls[0].payload,{action:"cancel-pending-manager-local",accountId:id,confirmation:id,expectedRevision:2});
  const bad=fixture({reply:{verified:false,deletedAccountId:id,auditId:74}});
  assert.equal((await bad.run()).status,502);
  const denied=fixture({role:"viewer"});
  assert.equal((await denied.run()).status,403);assert.equal(denied.calls.length,0);
 }finally{
  if(prevA===undefined)delete process.env.LOCAL_DEV_AUTH;else process.env.LOCAL_DEV_AUTH=prevA;
  if(prevB===undefined)delete process.env.NEXT_PUBLIC_BOI_ECH_SINGLE_REVIEW;else process.env.NEXT_PUBLIC_BOI_ECH_SINGLE_REVIEW=prevB;
 }
});
