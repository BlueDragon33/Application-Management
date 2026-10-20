import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createServer} from "node:http";
import {once} from "node:events";
import {webcrypto,randomBytes,randomUUID} from "node:crypto";
import {stripTypeScriptTypes} from "node:module";
import test from "node:test";

const source=readFileSync(new URL("../app/open-contract.server.ts",import.meta.url),"utf8");
const compiled=stripTypeScriptTypes(source)
  .replace(/^import .*;$/gm,"")
  .replace(/^export /gm,"");
const entry=new Function("getControlDatabase","contractCategoryProfiles",
  "dynamicApplicationConfig","fetch","crypto","process",
  compiled+"\nreturn {upsertManagedCatalog,probeDynamicManagedApplications,executeUniversalAutomationCommand};");

function memoryCatalog(){
  const rows=new Map();
  return {rows,async getControlDatabase(){
    return {prepare(sql){
      return {bind(...args){
        return {
          async first(){const row=rows.get(args[0]);return row
            ? {credential_ciphertext:row.credential_ciphertext,credential_iv:row.credential_iv}:null;},
          async run(){
            if(!/INSERT INTO managed_app_catalog/.test(sql))throw Error("UNEXPECTED_DB_WRITE");
            const [id,name,short_name,category,origin,public_url,repository,
              contract_path,credential_ciphertext,credential_iv,created_by]=args;
            rows.set(id,{id,name,short_name,category,origin,public_url,repository,
              contract_path,credential_ciphertext,credential_iv,created_by,enabled:1,
              created_at:new Date().toISOString(),updated_at:new Date().toISOString()});
            return {success:true};
          },
          async all(){assert.match(sql,/FROM managed_app_catalog/);return {results:[...rows.values()]};},
        };
      }};
    }};
  }};
}

function priceReportLoopback(secret){
  const server=createServer(async (req,res)=>{
    const path=new URL(req.url,"http://127.0.0.1").pathname;
    const reply=(status,payload)=>{
      res.writeHead(status,{"content-type":"application/json","cache-control":"no-store"});
      res.end(JSON.stringify(payload));
    };
    counts.all++;
    if(req.headers.authorization!=="Bearer "+secret){counts.denied++;return reply(403,{code:"CONTROL_TICKET_FORBIDDEN"});}
    if(req.method==="GET" && path==="/api/control/status"){
      counts.status++;
      return reply(200,{
        application:"price-report-tunggiabao",protocol:"price-report-control-v1",
        readiness:{deviceRegistry:"available",mutationAdminApi:"available"},
        capabilities:{
          deviceRegistry:true,deviceApproval:true,deviceIdempotentCommands:true,
          optimisticConcurrency:true,deviceAutoApproval:true,deviceAutoBlockPending:true,
          automationIdempotentCommands:true,automationOptimisticConcurrency:true,
        },
        endpoints:{devices:"/api/control/devices",
          deviceCommands:"/api/control/device-commands",automation:"/api/control/automation"},
      });
    }
    if(req.method==="GET" && path==="/api/control/devices"){
      counts.devices++;return reply(503,{code:"SIMULATED_DEVICE_REGISTRY_OUTAGE"});
    }
    if(req.method==="GET" && path==="/api/control/automation"){
      counts.policyGet++;
      if(behavior.failAllPolicyReads)
        return reply(503,{code:"SIMULATED_PREWRITE_GET_FAILURE"});
      if(behavior.failReadback && policy.revision>1)
        return reply(503,{code:"SIMULATED_INDEPENDENT_POLICY_READBACK_FAILURE"});
      return reply(200,{ok:true,automation:{...policy}});
    }
    if(req.method==="POST" && path==="/api/control/automation"){
      counts.policyPost++;
      if(behavior.redirectWrite){
        res.writeHead(307,{location:"/api/control/automation"});
        res.end();return;
      }
      if(req.headers["x-control-role"]!=="owner")
        return reply(403,{code:"OWNER_REQUIRED"});
      let body="";
      for await(const chunk of req)body+=chunk;
      const data=JSON.parse(body);
      if(data.operation!=="set-device-automation"||typeof data.commandId!=="string")
        return reply(400,{code:"INVALID_COMMAND"});
      const fingerprint=JSON.stringify({expected:data.expected,desired:data.desired});
      if(replays.has(data.commandId)){
        if(replays.get(data.commandId)!==fingerprint)return reply(409,{code:"COMMAND_ID_PAYLOAD_MISMATCH"});
        return reply(200,{ok:true,replayed:true,automation:{...policy}});
      }
      if(Object.entries(data.expected).some(([key,val])=>policy[key]!==val))
        return reply(409,{code:"AUTOMATION_STATE_CONFLICT"});
      for(const [key,val] of Object.entries(data.desired)){
        if(!["autoApproveDevices","autoBlockPendingDevices","pendingBlockAfterHours"].includes(key))
          return reply(400,{code:"UNSUPPORTED_FIELD"});
        if(key==="pendingBlockAfterHours" && ![24,168,720].includes(val))
          return reply(400,{code:"INVALID_THRESHOLD"});
      }
      Object.assign(policy,data.desired);policy.revision++;
      replays.set(data.commandId,fingerprint);
      return reply(200,{ok:true,replayed:false,automation:{...policy}});
    }
    return reply(404,{code:"NOT_FOUND"});
  });
  const policy={autoApproveDevices:false,autoBlockPendingDevices:false,pendingBlockAfterHours:168,revision:1};
  const counts={all:0,denied:0,status:0,devices:0,policyGet:0,policyPost:0};
  const behavior={failReadback:false,failAllPolicyReads:false,redirectWrite:false};
  const replays=new Map();
  return {server,policy,counts,behavior};
}

test("real App-Manager catalog AES credential + PriceReport legacy contract HTTP + write/GET/reopen",async t=>{
  const secret=randomBytes(48).toString("base64url");
  const masterKey=randomBytes(32).toString("base64url");
  const database=memoryCatalog();
  const target=priceReportLoopback(secret);
  target.server.listen(0,"127.0.0.1");
  await once(target.server,"listening");
  t.after(()=>new Promise(resolve=>target.server.close(resolve)));
  const address=target.server.address();
  const origin="http://127.0.0.1:"+address.port;
  const env={...process.env,LOCAL_DEV_AUTH:"1",CONTROL_PLANE_NETWORK_MODE:"local",
    MANAGED_APP_CREDENTIAL_ENCRYPTION_KEY:masterKey};
  function createAppManager(){
    return entry(database.getControlDatabase,{"Báo cáo":{}},
      input=>({...input}),fetch,webcrypto,{env});
  }
  const owner={email:"qa-owner@example.invalid",role:"owner",deviceId:"0".repeat(64)};
  const manager=createAppManager();
  await manager.upsertManagedCatalog({
    id:"price-report-tunggiabao",name:"PriceReport",shortName:"PriceReport",
    category:"Báo cáo",origin,contractPath:"/api/control/status",credential:secret,
  },owner);
  const saved=database.rows.get("price-report-tunggiabao");
  assert.ok(saved.credential_ciphertext && saved.credential_iv);
  assert.ok(!JSON.stringify(saved).includes(secret),"encrypted catalog must never store plaintext");
  assert.equal(target.counts.devices,0);

  const ids=["price-report-tunggiabao"];
  const [snapshot]=await manager.probeDynamicManagedApplications(ids,{automationOnly:true});
  assert.equal(snapshot.manifest.application.id,ids[0]);
  assert.equal(snapshot.manifest.protocol,"price-report-control-v1");
  assert.equal(snapshot.manifest.capabilities.automationIdempotentCommands,true);
  assert.equal(snapshot.credentialConfigured,true);
  assert.equal(snapshot.automation.autoApproveDevices,false);
  assert.equal(target.counts.devices,0,"policy-only probe cannot call failing device endpoint");

  const commandId=randomUUID();
  const expected={autoApproveDevices:false,autoBlockPendingDevices:false,pendingBlockAfterHours:168};
  const desired={autoApproveDevices:true,autoBlockPendingDevices:true,pendingBlockAfterHours:24};
  const mutation=await manager.executeUniversalAutomationCommand({
    appId:ids[0],commandId,expected,desired,
  },owner);
  assert.equal(mutation.ok,true);
  for(const [key,val] of Object.entries(desired))assert.equal(mutation.automation[key],val);
  assert.ok(target.counts.policyGet>=3,"actual App-Manager must independently GET after POST");
  assert.equal(target.counts.devices,0);

  const recreatedManager=createAppManager();
  const [afterReload]=await recreatedManager.probeDynamicManagedApplications(ids,{automationOnly:true});
  for(const [key,val] of Object.entries(desired))assert.equal(afterReload.automation[key],val);
  assert.equal(target.counts.devices,0,"reopened policy read cannot regress to inventory dependency");
  assert.equal(target.policy.revision,2);

  await assert.rejects(manager.executeUniversalAutomationCommand({
    appId:ids[0],commandId:randomUUID(),expected,desired:{autoApproveDevices:false},
  },owner),/HTTP_409|AUTOMATION_STATE_CONFLICT/);
  await assert.rejects(manager.executeUniversalAutomationCommand({
    appId:ids[0],commandId:randomUUID(),expected:{autoApproveDevices:true},desired:{autoApproveDevices:false},
  },{...owner,role:"viewer"}),/Chỉ Chủ hệ thống/);
  assert.equal(target.policy.autoApproveDevices,true);

  // Existing inventory mode preserves fail-closed behavior during device outage.
  const [inventory]=await manager.probeDynamicManagedApplications(ids);
  assert.equal(inventory.connection,"pending");
  assert.equal(inventory.automation,null);
  assert.ok(target.counts.devices>=1);
});

test("missing catalog credential cannot be interpreted as live writable automation",async t=>{
  const database=memoryCatalog();
  const secret=randomBytes(48).toString("base64url");
  const target=priceReportLoopback(secret);
  target.server.listen(0,"127.0.0.1");await once(target.server,"listening");
  t.after(()=>new Promise(resolve=>target.server.close(resolve)));
  const api=entry(database.getControlDatabase,{"Báo cáo":{}},input=>({...input}),
    fetch,webcrypto,{env:{...process.env,LOCAL_DEV_AUTH:"1",CONTROL_PLANE_NETWORK_MODE:"local"}});
  await api.upsertManagedCatalog({
    id:"price-report-tunggiabao",name:"PriceReport",category:"Báo cáo",
    origin:"http://127.0.0.1:"+target.server.address().port,
    contractPath:"/api/control/status",
  },{role:"owner",email:"qa-owner@example.invalid"});
  const [snapshot]=await api.probeDynamicManagedApplications(["price-report-tunggiabao"],{automationOnly:true});
  assert.equal(snapshot.automation,null);
  assert.equal(snapshot.remoteAdminReady,false);
  await assert.rejects(api.executeUniversalAutomationCommand({
    appId:"price-report-tunggiabao",commandId:randomUUID(),
    expected:{autoApproveDevices:false},desired:{autoApproveDevices:true},
  },{role:"owner",email:"qa-owner@example.invalid"}),/Universal automation contract chưa sẵn sàng|Credential quản trị/);
});

test("App-Manager refuses applied receipt if owning client POST persisted but independent GET fails",async t=>{
  const secret=randomBytes(48).toString("base64url");
  const database=memoryCatalog(),target=priceReportLoopback(secret);
  target.server.listen(0,"127.0.0.1");await once(target.server,"listening");
  t.after(()=>new Promise(resolve=>target.server.close(resolve)));
  const manager=entry(database.getControlDatabase,{"Báo cáo":{}},i=>({...i}),
    fetch,webcrypto,{env:{...process.env,LOCAL_DEV_AUTH:"1",
      CONTROL_PLANE_NETWORK_MODE:"local",
      MANAGED_APP_CREDENTIAL_ENCRYPTION_KEY:randomBytes(32).toString("base64url")}});
  const owner={email:"qa-owner@example.invalid",role:"owner",deviceId:"0".repeat(64)};
  await manager.upsertManagedCatalog({id:"price-report-tunggiabao",
    name:"PriceReport",category:"Báo cáo",
    origin:"http://127.0.0.1:"+target.server.address().port,
    contractPath:"/api/control/status",credential:secret},owner);
  target.behavior.failReadback=true;
  await assert.rejects(manager.executeUniversalAutomationCommand({
    appId:"price-report-tunggiabao",commandId:randomUUID(),
    expected:{autoApproveDevices:false},desired:{autoApproveDevices:true},
  },owner),/HTTP_503|SIMULATED_INDEPENDENT_POLICY_READBACK_FAILURE/);
  assert.equal(target.policy.autoApproveDevices,true,
    "source mutation persisted, but App-Manager must still refuse a false applied receipt");
  assert.ok(target.counts.policyPost===1 && target.counts.policyGet>=2);
  assert.equal(target.counts.devices,0);
});

test("P0: absent pre-write source GET blocks POST; redirects cannot replay credentialed POST",async t=>{
  const secret=randomBytes(48).toString("base64url");
  const database=memoryCatalog(),target=priceReportLoopback(secret);
  target.server.listen(0,"127.0.0.1");await once(target.server,"listening");
  t.after(()=>new Promise(resolve=>target.server.close(resolve)));
  const manager=entry(database.getControlDatabase,{"Báo cáo":{}},i=>({...i}),
    fetch,webcrypto,{env:{...process.env,LOCAL_DEV_AUTH:"1",
      CONTROL_PLANE_NETWORK_MODE:"local",
      MANAGED_APP_CREDENTIAL_ENCRYPTION_KEY:randomBytes(32).toString("base64url")}});
  const owner={email:"qa-owner@example.invalid",role:"owner",deviceId:"0".repeat(64)};
  const appId="price-report-tunggiabao";
  await manager.upsertManagedCatalog({id:appId,name:"PriceReport",category:"Báo cáo",
    origin:"http://127.0.0.1:"+target.server.address().port,
    contractPath:"/api/control/status",credential:secret},owner);
  const command=()=>({appId,commandId:randomUUID(),
    expected:{autoApproveDevices:false},desired:{autoApproveDevices:true}});
  target.behavior.failAllPolicyReads=true;
  await assert.rejects(manager.executeUniversalAutomationCommand(command(),owner),
    /AUTOMATION_PREWRITE_READBACK_UNAVAILABLE/);
  assert.equal(target.counts.policyPost,0,"never write when the owning GET is unavailable");
  assert.equal(target.policy.revision,1);

  target.behavior.failAllPolicyReads=false;
  target.behavior.redirectWrite=true;
  await assert.rejects(manager.executeUniversalAutomationCommand(command(),owner),
    /HTTP_307/);
  assert.equal(target.counts.policyPost,1,"manual redirect must not follow/replay POST");
  assert.equal(target.policy.revision,1);
});
