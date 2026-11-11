import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {loadTs} from "./helpers/load-ts.mjs";
const id="acc_"+'a'.repeat(64);
function fixture(responses,{role="owner",singleReview=true,backendReview=true}={}){
 const calls=[],gateReads=[];
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
   if(init?.method==="GET"){
    gateReads.push(url);
    return Response.json({enabled:true,accountV2:true,accountSingleReview:backendReview});
   }
   calls.push({url,body:JSON.parse(init.body)});
   const response=responses[calls.length-1]??{status:503,data:{code:"UPSTREAM_UNAVAILABLE"}};
   return Response.json(response.data,{status:response.status});
  }
 });
 return {calls,gateReads,async run(action,extras={}){
  const previous=process.env.NEXT_PUBLIC_BOI_ECH_SINGLE_REVIEW;
  process.env.NEXT_PUBLIC_BOI_ECH_SINGLE_REVIEW=singleReview?"true":"false";
  try{
   const response=await api.POST(new Request("https://app.example.invalid/api/apps/boi-ech/account-entitlements",{
    method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,...extras})
   }));
   return {status:response.status,body:await response.json()};
  }finally{
   if(previous===undefined)delete process.env.NEXT_PUBLIC_BOI_ECH_SINGLE_REVIEW;
   else process.env.NEXT_PUBLIC_BOI_ECH_SINGLE_REVIEW=previous;
  }
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
test("Owner first review is the only approval; forged final/changes actions never contact BOI",async()=>{
 const first=fixture([
  {status:200,data:{onboarding:{stage:"profile_required"}}},
  {status:200,data:{accountId:id,role:"manager",status:"pending",onboardingStage:"profile_required",onboardingRevision:2,revision:0}}
 ]);
 const result=await first.run("manager-review-first",{accountId:id,expectedRevision:1});
 assert.equal(result.status,200);assert.equal(result.body.verified,true);
 assert.deepEqual(first.calls.map(x=>x.body.action),["review-first","read"]);
 assert.equal(first.gateReads.length,1,"Only read BOI V2 policy once before Owner mutation");
 for(const action of ["manager-review-final","manager-review-changes"]){
  const forged=fixture([]),denied=await forged.run(action,{accountId:id,expectedRevision:0});
  assert.equal(denied.status,409);assert.equal(denied.body.code,"BOI_REVIEW_SUPERSEDED");
  assert.equal(forged.calls.length,0);
 }
 const misconfigured=fixture([],{singleReview:false});
 const blocked=await misconfigured.run("manager-review-first",{accountId:id,expectedRevision:1});
 assert.equal(blocked.status,409);assert.equal(blocked.body.code,"BOI_SINGLE_REVIEW_UNVERIFIED");
 assert.equal(misconfigured.calls.length,0);
});
test("unmatched BOI runtime single-review flag fails closed before any invitation/approval write",async()=>{
 for(const action of ["issue-manager-invite","manager-review-first"]){
  const f=fixture([],{backendReview:false});
  const r=await f.run(action,{accountId:id,expectedRevision:1});
  assert.equal(r.status,409);assert.equal(r.body.code,"BOI_SINGLE_REVIEW_BACKEND_UNVERIFIED");
  assert.equal(f.calls.length,0,"No BOI mutation before policy readback");
  assert.equal(f.gateReads.length,1);
 }
});
test("verified inbox exposes readiness only with matching APP and BOI one-review modes",async()=>{
 const snapshot={status:200,data:{contract:"boi-manager-intake.v2",verified:true,managers:[],nextCursor:null}};
 for(const [singleReview,backendReview,ready] of [[true,true,true],[true,false,false],[false,true,false]]){
  const f=fixture([snapshot],{singleReview,backendReview});
  const r=await f.run("manager-inbox");
  assert.equal(r.status,200);assert.equal(r.body.verified,true);
  assert.equal(r.body.singleReviewReady,ready);
  assert.equal(f.gateReads.length,singleReview?1:0);
 }
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
 assert.doesNotMatch(ui,/Duyệt vòng 2/);
 assert.match(ui,/Owner duyệt một lần/);
 assert.match(ui,/Tải thêm hồ sơ/);
});

test("direct duration changes require a verified manager target before any BOI write",async()=>{
 for(const [target,expected] of [[{status:200,data:{accountId:id,role:"teacher"}},403],
   [{status:200,data:{accountId:id,role:"learner"}},403],
   [{status:503,data:{}},502]]){
  const f=fixture([target]);
  const r=await f.run("set-account",{accountId:id,operation:"suspend",expectedRevision:4,reason:"Kiểm tra phạm vi"});
  assert.equal(r.status,expected);
  assert.deepEqual(f.calls.map(x=>x.body.action),["read"]);
 }
 const entitlement={accountId:id,revision:5,expiresAt:"2026-12-09T10:00:00Z",state:"suspended"};
 const f=fixture([{status:200,data:{accountId:id,role:"manager"}},
  {status:200,data:{entitlement}},{status:200,data:{entitlement}}]);
 const r=await f.run("set-account",{accountId:id,operation:"suspend",expectedRevision:4,reason:"Kiểm tra phạm vi"});
 assert.equal(r.status,200);assert.equal(r.body.verified,true);
 assert.deepEqual(f.calls.map(x=>x.body.action),["read","set-entitlement","read-entitlement"]);
 assert.equal(f.calls[1].body.expectedRevision,4);
});
