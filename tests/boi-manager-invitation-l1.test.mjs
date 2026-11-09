import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {loadTs} from "./helpers/load-ts.mjs";
const id="acc_"+'a'.repeat(64);
function fixture(responses,{role="owner"}={}){
 const calls=[];
 const api=loadTs("app/api/apps/boi-ech/account-entitlements/route.ts",{
  "../../../../control-device.server":{
    verifyControlProof:async()=>({role,email:"owner@example.invalid"}),
    controlErrorResponse:e=>Response.json({error:e.message},{status:500})
  },
  "../../../../boi-ech.server":{
    issueBoiBrowserBridge:async()=>({baseUrl:"https://boi.example.invalid",token:"signed-owner-ticket"})
  }
 },{
  fetch:async(url,init)=>{
   calls.push({url,body:JSON.parse(init.body)});
   const response=responses[calls.length-1]??{status:503,data:{code:"UPSTREAM_UNAVAILABLE"}};
   return Response.json(response.data,{status:response.status});
  }
 });
 return {calls,async run(action,extras={}){
  const response=await api.POST(new Request("https://app.example.invalid/api/apps/boi-ech/account-entitlements",{
   method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,...extras})
  }));
  return {status:response.status,body:await response.json()}
 }};
}
test("Owner manager policy reads configured 5 seats and a CAS revision",async()=>{
 const f=fixture([{status:200,data:{limits:[{role:"manager",accountLimit:5,used:1,revision:7}]}}]);
 const r=await f.run("manager-policy");
 assert.equal(r.status,200);
 assert.deepEqual(r.body.policy,{revision:7,accountLimit:5,used:1});
 assert.deepEqual(f.calls[0].body,{action:"capacity"});
});
test("Owner invitation output is verified once, no secret in URL query, signed bridge",async()=>{
 const token='f'.repeat(64);
 const f=fixture([{status:200,data:{inviteToken:token,expiresAt:"2026-11-10T18:00:00.000Z",verified:true}}]);
 const r=await f.run("issue-manager-invite",{expectedRevision:1});
 assert.equal(r.status,200);assert.equal(r.body.verified,true);
 assert.equal(new URL(r.body.inviteUrl).hash,"#manager-invite="+token);
 assert.equal(new URL(r.body.inviteUrl).search,"");
 assert.deepEqual(f.calls[0].body,{action:"create-manager-invite",expectedRevision:1});
 assert.equal(f.calls[0].url,"https://boi.example.invalid/api/control/accounts");
});
test("manager first review and final approval are separate Owner actions with full D1 readback",async()=>{
 const first=fixture([
  {status:200,data:{onboarding:{stage:"profile_required"}}},
  {status:200,data:{accountId:id,role:"manager",status:"pending",onboardingStage:"profile_required",onboardingRevision:2,revision:0}}
 ]);
 const a=await first.run("manager-review-first",{accountId:id,expectedRevision:1});
 assert.equal(a.status,200);assert.equal(a.body.verified,true);
 assert.deepEqual(first.calls.map(x=>x.body.action),["review-first","read"]);
 const final=fixture([
  {status:200,data:{status:"approved"}},
  {status:200,data:{accountId:id,role:"manager",status:"approved",onboardingStage:"active",onboardingRevision:4,revision:1,
    entitlement:{active:true,expiresAt:"2026-12-09T10:00:00Z"}}}
 ]);
 const b=await final.run("manager-review-final",{accountId:id,expectedRevision:0});
 assert.equal(b.status,200);assert.equal(b.body.verified,true);
 assert.equal(final.calls[0].body.operation,"approve-manager");
 assert.deepEqual(final.calls.map(x=>x.body.action),["command","read"]);
});
test("readback mismatch or upstream 409 never produces fake approval",async()=>{
 const f=fixture([
  {status:200,data:{onboarding:{stage:"profile_required"}}},
  {status:200,data:{accountId:id,role:"manager",status:"pending",onboardingStage:"requested",onboardingRevision:1,revision:0}}
 ]);
 const r=await f.run("manager-review-first",{accountId:id,expectedRevision:1});
 assert.equal(r.status,502);assert.equal(r.body.verified,false);
 const fail=fixture([{status:409,data:{code:"ACCOUNT_CAS_CONFLICT"}}]);
 const conflict=await fail.run("manager-review-final",{accountId:id,expectedRevision:0});
 assert.equal(conflict.status,409);assert.equal(conflict.body.ok,undefined);
});
test("Owner manager mutations require enrolled fresh MFA (no un-enrolled fallback)",()=>{
 const auth=fs.readFileSync("worker/production-auth.ts","utf8");
 assert.match(auth,/issue-manager-invite/);
 assert.match(auth,/manager-review-final/);
 assert.match(auth,/!state.enabled \|\| !stepUpFresh\(identity\)/);
 const client=fs.readFileSync("app/boi-access-client.ts","utf8");
 const ui=fs.readFileSync("app/apps/boi-ech/account-expiry-panel.tsx","utf8");
 assert.match(client,/issueBoiManagerInvitation/);
 assert.match(ui,/Tạo lời mời Cán bộ quản lý/);
 assert.match(ui,/Duyệt vòng 2/);
 assert.match(ui,/Tải thêm hồ sơ/);
});
