import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {loadTs} from "./helpers/load-ts.mjs";

const id="acc_"+"a".repeat(64),snapshot="b".repeat(64);
const records=[
 {accountId:id,name:"Former Manager",role:"manager",category:"manager",
  createdAt:"2026-11-10 00:00:00",lastSeenAt:"2026-11-10 00:00:00",
  latestLoginAt:null,inactiveDays:4,stage:"requested",eligible:true,blockers:[],snapshot},
 {accountId:"acc_"+"c".repeat(64),name:"Manager on duty",role:"manager",category:"manager",
  createdAt:"2026-11-10 00:00:00",lastSeenAt:"2026-11-14 00:00:00",
  latestLoginAt:"2026-11-14T00:00:00.000Z",inactiveDays:0,stage:"active",
  eligible:false,blockers:[],snapshot:"d".repeat(64)}
];
const preview={ok:true,verified:true,contract:"boi-owner-manager-purge.v1",
 days:0,mode:"manager",records,scanned:2,eligible:1,protected:1,hasMore:false,nextCursor:null};
function fixture({role="owner",corrupt=false,readback=true}={}){
 const sent=[];let deleted=false;
 const module=loadTs("app/api/apps/boi-ech/manager-purge/route.ts",{
  "../../../../control-device.server":{
   verifyControlProof:async()=>({role,email:"owner@fixture.invalid"}),
   controlErrorResponse:e=>Response.json({error:e.message},{status:500})
  },
  "../../../../boi-ech.server":{
   issueBoiBrowserBridge:async (_,__,scope)=>{
    assert.equal(scope,"account-owner");return {baseUrl:"https://boi.fixture.invalid",token:"signed-owner"};
   }
  }
 },{fetch:async(_,init)=>{
  const body=JSON.parse(init.body);sent.push(body);
  assert.equal(init.headers.authorization,"Bearer signed-owner");
  if(body.action==="preview")return Response.json(corrupt?{...preview,records:[{...records[0],role:"learner"}]}:preview);
  if(body.action==="purge"){deleted=true;return Response.json({ok:true,verified:true,
   contract:"boi-owner-manager-purge.v1",action:"purge",deleted:true,
   auditPreserved:true,accountHash:"e".repeat(64)});}
  if(body.action==="inspect")return Response.json({verified:true,contract:"boi-owner-manager-purge.v1",
   exists:!deleted||!readback});
  return Response.json({code:"INVALID"},{status:400});
 }});
 async function post(body){
  const response=await module.POST(new Request("https://app.fixture.invalid/api/apps/boi-ech/manager-purge",{
   method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)
  }));
  return{status:response.status,value:await response.json()};
 }
 return {sent,post};
}
test("Manager purge preview reports eligible and protected account-specific records",async()=>{
 const f=fixture(),r=await f.post({action:"preview"});
 assert.equal(r.status,200);
 assert.equal(r.value.eligible,1);
 assert.equal(r.value.protected,1);
 assert.deepEqual(f.sent.map(x=>x.action),["preview"]);
});
test("Reject forged manager purge preview roles without enabling delete",async()=>{
 const f=fixture({corrupt:true});
 assert.equal((await f.post({action:"preview"})).status,502);
});
test("One manager purge requires confirmation and independent D1 absence readback",async()=>{
 const f=fixture();
 const input={action:"purge",accountId:id,snapshot,reason:"Owner confirms unused former manager",confirmation:"XOA VINH VIEN CAN BO"};
 for(const bad of [{confirmation:"NO"},{accountId:"acc_invalid"},{snapshot:"fake"},{reason:"short"}]){
  assert.equal((await f.post({...input,...bad})).status,400);
 }
 assert.equal(f.sent.length,0);
 const done=await f.post(input);
 assert.equal(done.status,200);
 assert.equal(done.value.deleted,true);
 assert.deepEqual(f.sent.map(x=>x.action),["purge","inspect"]);
 assert.equal(f.sent[0].confirmation,"XOA TAI KHOAN");
});
test("Non-Owner cannot preview or purge",async()=>{
 const f=fixture({role:"manager"});
 assert.equal((await f.post({action:"preview"})).status,403);
 assert.equal((await f.post({action:"purge",accountId:id,snapshot,
  confirmation:"XOA VINH VIEN CAN BO",reason:"Former Manager account cleanup"})).status,403);
 assert.deepEqual(f.sent,[]);
});
test("Unconfirmed readback stops with uncertain status and never retries delete",async()=>{
 const f=fixture({readback:false});
 const r=await f.post({action:"purge",accountId:id,snapshot,
  confirmation:"XOA VINH VIEN CAN BO",reason:"Former manager is no longer using service"});
 assert.equal(r.status,502);
 assert.equal(r.value.applied,"unknown");
 assert.deepEqual(f.sent.map(x=>x.action),["purge","inspect"]);
});
test("Cloudflare Production Owner fresh TOTP and Bơi Ếch scoped server required",()=>{
 const worker=readFileSync("worker/production-auth.ts","utf8");
 const route=readFileSync("app/api/apps/boi-ech/manager-purge/route.ts","utf8");
 const client=readFileSync("app/boi-access-client.ts","utf8");
 const panel=readFileSync("app/apps/boi-ech/owner-manager-purge-panel.tsx","utf8");
 const expiry=readFileSync("app/apps/boi-ech/account-expiry-panel.tsx","utf8");
 assert.match(worker,/pathname === "\/api\/apps\/boi-ech\/manager-purge" && action === "purge"/);
 assert.match(worker,/pathname==="\/api\/apps\/boi-ech\/manager-purge"\s*&& text\(payload\.action\)==="purge"&&\(!state\.enabled\|\|!stepUpFresh\(identity\)\)/);
 assert.match(route,/verifyControlProof\(/);
 assert.match(route,/owner\.role!=="owner"/);
 assert.match(route,/issueBoiBrowserBridge\(owner\.email,owner\.role,"account-owner"\)/);
 assert.match(route,/check\.data\.exists!==false/);
 assert.match(client,/approvedSession\(\)/);
 assert.match(client,/purgeOwnerManagerAccount/);
 assert.match(panel,/MAX=10/);
 assert.match(panel,/confirmation!=="XOA VINH VIEN CAN BO"/);
 assert.match(panel,/if\(d\?\.code!=="STEP_UP_REQUIRED"\|\|d\.applied!==false/);
 assert.match(panel,/window\.confirm\(/);
 assert.match(expiry,/OwnerManagerPurgePanel/);
});
