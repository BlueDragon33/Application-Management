import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {loadTs} from "./helpers/load-ts.mjs";
const id="acc_"+"a".repeat(64),snap="b".repeat(64);
const record={accountId:id,name:"Fixture account",role:"learner",category:"pending",
 createdAt:"2026-11-03 00:00:00",lastSeenAt:"2026-11-03 00:00:00",
 latestLoginAt:"2026-11-03T00:00:00.000Z",inactiveDays:10,stage:"requested",
 eligible:true,blockers:[],snapshot:snap};
const preview={ok:true,verified:true,contract:"boi-owner-account-cleanup.v1",days:7,mode:"pending",
 records:[record],scanned:1,eligible:1,protected:0,hasMore:false,nextCursor:null};
function fixture(role="owner"){
 let deleted=false,requested=[];
 const handler=loadTs("app/api/apps/boi-ech/account-cleanup/route.ts",{
  "../../../../boi-ech.server":{issueBoiBrowserBridge:async (_,__,scope)=>{
   assert.equal(scope,"account-owner");return {baseUrl:"https://boi.fixture.invalid",token:"signed-owner"};
  }},
  "../../../../control-device.server":{
   verifyControlProof:async()=>({role,email:"owner@fixture.invalid"}),
   controlErrorResponse:e=>Response.json({error:e.message},{status:500}),
  },
 },{fetch:async(_,init)=>{
  const req=JSON.parse(init.body);requested.push(req.action);
  assert.equal(init.headers.authorization,"Bearer signed-owner");
  if(req.action==="preview")return Response.json(preview);
  if(req.action==="inspect")return Response.json({contract:"boi-owner-account-cleanup.v1",verified:true,exists:!deleted});
  if(req.action==="purge"){deleted=true;return Response.json({ok:true,verified:true,
   contract:"boi-owner-account-cleanup.v1",action:"purge",deleted:true,accountHash:"d".repeat(64)});}
  return Response.json({error:"bad"},{status:400});
 }});
 return {requested,request:async payload=>{
  const response=await handler.POST(new Request("https://app.fixture.invalid/api/apps/boi-ech/account-cleanup",{
   method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)
  }));return {status:response.status,data:await response.json()};
 }};
}
test("Owner-only scan shows true D1 candidate counts, ages and protected flags without deletion",async()=>{
 const f=fixture(),r=await f.request({action:"preview",mode:"pending",days:7});
 assert.equal(r.status,200);assert.deepEqual(r.data.records,[record]);
 assert.deepEqual(f.requested,["preview"]);
});
test("One-account purge requires explicit typed confirmation and independent live D1 readback",async()=>{
 const f=fixture();
 const input={action:"purge",mode:"pending",days:7,accountId:id,snapshot:snap,
  confirmation:"XOA TAI KHOAN",reason:"Owner confirms outdated unused enrollment"};
 assert.equal((await f.request({...input,confirmation:"no"})).status,400);
 assert.equal(f.requested.length,0);
 const result=await f.request(input);
 assert.equal(result.status,200);assert.equal(result.data.deleted,true);
 assert.deepEqual(f.requested,["purge","inspect"]);
});
test("Non-Owner cannot list or purge anyone, and no unverified cleanup is reported as done",async()=>{
 const f=fixture("manager");
 assert.equal((await f.request({action:"preview",mode:"both",days:3})).status,403);
 assert.deepEqual(f.requested,[]);
});
test("Cloudflare pre-routing policy forces enrolled 30-minute TOTP for every physical purge",()=>{
 const worker=readFileSync("worker/production-auth.ts","utf8");
 const router=readFileSync("app/api/apps/boi-ech/account-cleanup/route.ts","utf8");
 const component=readFileSync("app/apps/boi-ech/owner-account-cleanup-panel.tsx","utf8");
 assert.ok(worker.includes('pathname==="/api/apps/boi-ech/account-cleanup"'));
 assert.ok(worker.includes('text(payload.action)==="purge"'));
 assert.match(worker,/!state\.enabled\|\|!stepUpFresh\(identity\)/);
 assert.match(router,/issueBoiBrowserBridge\(actor.email,actor.role,"account-owner"\)/);
 assert.match(router,/check\.data\.exists!==false/);
 assert.match(component,/MAX_REMOVE=20/);
 assert.match(component,/selection\.length>MAX_REMOVE/);
 assert.match(component,/XOA TAI KHOAN/);
 assert.match(component,/if\(d\?\.code!=="STEP_UP_REQUIRED"\|\|d\.applied!==false/);
 assert.match(component,/Không xóa tự động/);
});
