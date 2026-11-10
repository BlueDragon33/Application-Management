import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import {loadTs} from "./helpers/load-ts.mjs";

const manager={accountId:"acc_"+'a'.repeat(64),name:null,role:"manager",
 status:"pending",accountRevision:0,onboardingStage:"requested",onboardingRevision:1,
 passwordVerifier:"FORBIDDEN",phone:"FORBIDDEN",publicKeyJwk:"FORBIDDEN"};

function fixture({role="owner",upstreamStatus=200,upstream={contract:"boi-manager-intake.v2",verified:true,managers:[manager],nextCursor:null}}={}){
 const calls=[];
 const api=loadTs("app/api/apps/boi-ech/account-entitlements/route.ts",{
  "../../../../control-device.server":{
   verifyControlProof:async()=>({role,email:"owner@example.invalid"}),
   controlErrorResponse:e=>Response.json({error:e.message},{status:500})
  },
  "../../../../boi-ech.server":{
   issueBoiBrowserBridge:async()=>({baseUrl:"https://boi.example.invalid",token:"signed-test-ticket"})
  }
 },{
  fetch:async(url,init)=>{
   calls.push({url,init});
   return Response.json(upstream,{status:upstreamStatus});
  }
 });
 return {calls,async run(action="manager-inbox"){
  const res=await api.POST(new Request("https://app.example.invalid/api/apps/boi-ech/account-entitlements",{
   method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action})
  }));
  return {status:res.status,json:await res.json()}
 }};
}

test("Owner manager inbox is read-only and uses canonical BOI accounts with no leaked internals",async()=>{
 const f=fixture(),r=await f.run();
 assert.equal(r.status,200);assert.equal(r.json.ok,true);assert.equal(r.json.verified,true);
 assert.equal(r.json.managers.length,1);
 assert.deepEqual(Object.keys(r.json.managers[0]).sort(),["accountId","name","status","accountRevision","onboardingStage","onboardingRevision"].sort());
 assert.doesNotMatch(JSON.stringify(r.json),/FORBIDDEN|passwordVerifier|phone|publicKeyJwk/);
 assert.equal(f.calls.length,1);
 assert.equal(f.calls[0].url,"https://boi.example.invalid/api/control/accounts");
 assert.equal(f.calls[0].init.method,"POST");
 assert.equal(f.calls[0].init.redirect,"manual");
 assert.deepEqual(JSON.parse(f.calls[0].init.body),{action:"manager-inbox-v2",after:"",limit:40});
});
test("non-owner roles cannot read or even contact canonical Manager inbox",async()=>{
 for(const role of ["reviewer","publisher","viewer"]){
  const f=fixture({role}),r=await f.run();
  assert.equal(r.status,403);assert.equal(r.json.code,"OWNER_REQUIRED");
  assert.equal(f.calls.length,0);
 }
});
test("upstream 401/403/409 propagate with no fake empty success",async()=>{
 for(const status of [401,403,409]){
  const f=fixture({upstreamStatus:status,upstream:{error:"No canonical inbox",code:"UPSTREAM_DENIED"}}),r=await f.run();
  assert.equal(r.status,status);
  assert.equal(r.json.managers,undefined);
  assert.equal(f.calls.length,1);
 }
});
test("malformed non-manager and oversized cross-account rows fail closed",async()=>{
 for(const rowset of [
  {contract:"boi-manager-intake.v2",verified:true,managers:[{...manager,role:"learner"}],nextCursor:null},
  {contract:"boi-manager-intake.v2",verified:true,managers:Array.from({length:41},(_,i)=>({...manager,accountId:"acc_"+String(i).padStart(64,"0")})),nextCursor:null},
  {contract:"boi-manager-intake.v2",verified:true,managers:[{...manager,onboardingStage:undefined}],nextCursor:null},
  {contract:"boi-manager-intake.v2",verified:true,managers:{notAnArray:true},nextCursor:null},
 ]){
  const f=fixture({upstream:rowset}),r=await f.run();
  assert.equal(r.status,502);
  assert.equal(r.json.code,"BOI_MANAGER_INBOX_UNVERIFIED");
  assert.equal(r.json.managers,undefined);
 }
});
test("upstream redirection is never followed to unexpected origin",async()=>{
 const f=fixture({upstreamStatus:302,upstream:{contract:"boi-manager-intake.v2",verified:true,managers:[manager],nextCursor:null}}),r=await f.run();
 assert.equal(r.status,502);assert.equal(r.json.managers,undefined);
 assert.equal(f.calls[0].init.redirect,"manual");
});
test("Owner panel shows manager requests inside existing account expiry panel, not separate app",()=>{
 const source=fs.readFileSync("app/apps/boi-ech/account-expiry-panel.tsx","utf8");
 const base=fs.readFileSync("app/apps/boi-ech/boi-ech-control-center.tsx","utf8");
 assert.match(source,/loadBoiManagerInbox/);
 assert.match(source,/Owner duyệt hai vòng/);
 assert.match(base,/access.role === "owner" \? <AccountExpiryPanel/);
});

test("malformed duration account payloads fail closed instead of implying zero accounts",async()=>{
 const invalid=[
  ["list",{}],
  ["list",{accounts:null}],
  ["list",{verified:false,accounts:[]}],
  ["policy",{verified:false,policies:["manager","teacher","learner"].map(role=>({role,defaultDays:30,revision:1,updatedAt:"2026-11-10"}))}],
  ["list",{accounts:[{accountId:"invalid",role:"manager",name:null,deviceStatus:"pending",onboardingStage:"requested",entitlement:null}]}],
  ["policy",{policies:[]}],
  ["policy",{policies:[{role:"manager",defaultDays:30,revision:1,updatedAt:"2026-11-10"}]}]
 ];
 for(const [action,upstream] of invalid){
  const f=fixture({upstream}),res=await f.run(action);
  assert.equal(res.status,502,action+" must reject malformed 200 payload");
  assert.equal(res.json.verified,false);
  assert.equal(res.json.code,"BOI_ACCOUNT_DURATION_UNVERIFIED");
  assert.equal(res.json.accounts,undefined);
  assert.equal(res.json.policies,undefined);
 }
 const empty=await fixture({upstream:{accounts:[]}}).run("list");
 assert.equal(empty.status,200);
 assert.equal(empty.json.verified,true);
 assert.deepEqual(empty.json.accounts,[]);
 const valid=await fixture({upstream:{policies:["manager","teacher","learner"].map(role=>({
  role,defaultDays:30,revision:1,updatedAt:"2026-11-10T00:00:00Z"
 }))}}).run("policy");
 assert.equal(valid.status,200);
 assert.equal(valid.json.verified,true);
 assert.equal(valid.json.policies.length,3);
});
test("Owner duration UI distinguishes verified zero from unavailable account service",()=>{
 const client=fs.readFileSync("app/boi-access-client.ts","utf8");
 const ui=fs.readFileSync("app/apps/boi-ech/account-expiry-panel.tsx","utf8");
 assert.doesNotMatch(client,/accounts:accounts\.accounts\?\?\[\]/);
 assert.match(client,/accounts\.verified!==true/);
 assert.match(client,/policies\.verified!==true/);
 assert.ok(ui.includes('setAccounts([]);setPolicies([]);setSelected("");setAccountsVerified(false);'));
 assert.match(ui,/Chưa có danh sách tài khoản được xác minh/);
});
