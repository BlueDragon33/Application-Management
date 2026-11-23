// R2.3: genuine child-owned local D1 -> signed Control API -> independent CLI readback.
// All rows and secrets are disposable QA data in pinned child checkouts. Never Production.
import assert from "node:assert/strict";
import { createHmac, randomBytes, randomUUID, webcrypto } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "qa-artifacts", "r23-client-source");
mkdirSync(out, {recursive:true});
const clients=[
  {
    label:"bauman",dir:path.join(root,"r23-clients","bauman","control-service"),
    gitRoot:path.join(root,"r23-clients","bauman"),
    expected:"16d8f7a963e27a12520d510f29b161374b5c5df3",
    port:3003,db:"bauman-control-local",table:"bm_devices",commandTable:"bm_control_commands",
    prefix:"BM-", id:"a".repeat(64),app:"bauman-master-ai",aud:"bauman-control",
    secretKey:"BAUMAN_CONTROL_SERVICE_SECRET",extraKey:"BAUMAN_APP_ORIGIN",
  },
  {
    label:"price-report",dir:path.join(root,"r23-clients","price","control-service"),
    gitRoot:path.join(root,"r23-clients","price"),
    expected:"9e8df71f2839989b067af79ef22c389f541664e5",
    port:3009,db:"price-report-control-local-db",table:"kt_devices",commandTable:"kt_control_commands",
    prefix:"KT-", id:"b".repeat(64),app:"price-report-tunggiabao",aud:"price-report-control",
    secretKey:"PRICE_REPORT_CONTROL_SERVICE_SECRET",extraKey:"PRICE_REPORT_APP_ORIGIN",
  },
];
const report={
  schema:"application-management.r23-client-owned-readback/v1",
  timestamp:new Date().toISOString(), candidate:null, sourceCommits:{},
  isolation:"GITHUB_RUNNER_LOCAL_D1_ONLY", checks:[], error:null,
  productionWrites:false, g04:"UNVERIFIED_OWNER_UX_AND_PRODUCTION_MATRIX",
  g05:"UNVERIFIED_BASELINE_CAPACITY",
};
const processes=[];
function preflight() {
  if(process.env.GITHUB_ACTIONS!=="true"||process.env.GITHUB_EVENT_NAME!=="pull_request") throw Error("Only isolated PR runner permitted");
  for(const key of [
    "CLOUDFLARE_API_TOKEN","CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH",
    "APPLICATION_MANAGEMENT_PRODUCTION_ORIGIN","APPLICATION_MANAGEMENT_PRODUCTION_D1_DATABASE_ID",
  ]) if(process.env[key]) throw Error("Unexpected Production binding: "+key);
  for(const item of clients) {
    if(!existsSync(item.dir)||existsSync(path.join(item.dir,".dev.vars"))) throw Error("Missing or nonisolated client "+item.label);
    const sha=execFileSync("git",["rev-parse","HEAD"],{cwd:item.gitRoot,encoding:"utf8"}).trim();
    if(sha!==item.expected) throw Error("Source identity mismatch "+item.label+" "+sha);
    report.sourceCommits[item.label]=sha;
  }
  const sha=execFileSync("git",["rev-parse","HEAD"],{cwd:root,encoding:"utf8"}).trim();
  if(process.env.R23_EXPECTED_SHA!==sha) throw Error("App candidate SHA mismatch");
  report.candidate=sha;
}
const sqlQuote = value => "'"+String(value).replaceAll("'","''")+"'";
function cli(item, args) {
  const bin=path.join(item.dir,"node_modules","wrangler","bin","wrangler.js");
  if(!existsSync(bin)) throw Error("Missing locked Wrangler "+item.label);
  return execFileSync(process.execPath,[bin,...args],{
    cwd:item.dir,env:{...process.env,WRANGLER_SEND_METRICS:"false"},encoding:"utf8",timeout:120000,
    stdio:["ignore","pipe","pipe"],
  });
}
function d1(item,sql) {
  const text=cli(item,["d1","execute",item.db,"--local","--config","wrangler.local.jsonc","--json","--command",sql]);
  const decoded=JSON.parse(text.slice(text.indexOf("[")));
  const rows=decoded[0]?.results;
  assert.ok(Array.isArray(rows),item.label+" D1 CLI readback must return results");
  return rows;
}
function ticket(item,role,secret) {
  const claims={
    iss:"application-management",aud:item.aud,app:item.app,role,
    actor:"r23-qa@example.test",controlDeviceId:"c".repeat(64),jti:randomBytes(16).toString("base64url"),
    exp:Date.now()+120000,
  };
  const input="v1."+Buffer.from(JSON.stringify(claims)).toString("base64url");
  return input+"."+createHmac("sha256",secret).update(input).digest("base64url");
}
async function request(item,secret,role,pathname,body) {
  const res=await fetch("http://127.0.0.1:"+item.port+pathname,{
    method:body?"POST":"GET",
    headers:{
      Authorization:"Bearer "+ticket(item,role,secret),
      ...(body?{"Content-Type":"application/json"}:{}),
    },
    body:body?JSON.stringify(body):undefined,
    signal:AbortSignal.timeout(20000),
  });
  return {status:res.status,body:await res.json().catch(()=>({}))};
}
async function start(item,secret) {
  const url="http://127.0.0.1:"+item.port+"/health";
  if(await fetch(url,{signal:AbortSignal.timeout(1000)}).then(()=>true).catch(()=>false)) throw Error("Port already active; abort "+item.port);
  const bin=path.join(item.dir,"node_modules","wrangler","bin","wrangler.js");
  const args=[bin,"dev","--local","--config","wrangler.local.jsonc",
    "--ip","127.0.0.1","--port",String(item.port),
    "--var",item.secretKey+":"+secret,
    "--var","APPLICATION_MANAGEMENT_ORIGIN:http://127.0.0.1:5191",
    "--var",item.extraKey+":http://127.0.0.1:5191"];
  const proc=spawn(process.execPath,args,{cwd:item.dir,stdio:"ignore",env:{...process.env,WRANGLER_SEND_METRICS:"false"}});
  processes.push(proc);
  const deadline=Date.now()+60000;
  while(Date.now()<deadline) {
    if(proc.exitCode!==null) throw Error(item.label+" worker exited before readiness");
    try {
      const response=await fetch(url,{signal:AbortSignal.timeout(1800)});
      if(response.status===200) {
        const health=await response.json();
        assert.equal(health.databaseReady,true,item.label+" local D1 not ready");
        return;
      }
    } catch {}
    await new Promise(resolve=>setTimeout(resolve,350));
  }
  throw Error(item.label+" local worker /health timeout");
}
async function seed(item) {
  const {subtle}=webcrypto;
  const keys=await subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
  const jwk=JSON.stringify(await subtle.exportKey("jwk",keys.publicKey));
  const before=d1(item,"SELECT COUNT(*) AS count FROM "+item.table)[0];
  assert.equal(Number(before.count),0,item.label+" fixture DB must start empty");
  const sql="INSERT INTO "+item.table+
    " (device_id,display_code,public_jwk_json,device_type,display_name,status,last_seen_at) VALUES ("+
    [sqlQuote(item.id),sqlQuote(item.prefix+"R23-QA-001"),sqlQuote(jwk),"'desktop'","'R23 LOCAL TEST'","'pending'",String(Date.now())].join(",")+
    ")";
  d1(item,sql);
  const rows=d1(item,"SELECT device_id AS deviceId,status,display_code AS deviceCode FROM "+item.table);
  assert.equal(rows.length,1);
  assert.equal(rows[0].deviceId,item.id);
  assert.equal(rows[0].status,"pending");
}
async function verify(item) {
  const secret=randomBytes(32).toString("hex");
  await start(item,secret);
  await seed(item);
  const status=await request(item,secret,"owner","/api/control/status");
  assert.equal(status.status,200,item.label+" source status HTTP");
  assert.equal(status.body.application,item.app);
  const pending=await request(item,secret,"owner","/api/control/devices");
  assert.equal(pending.status,200);
  const row=pending.body.devices.find(d=>d.deviceId===item.id);
  assert.ok(row,item.label+" signed API lacks independent D1 device");
  assert.equal(row.deviceCode,item.prefix+"R23-QA-001");
  assert.equal(row.status,"pending");
  const payload={commandId:randomUUID(),deviceId:item.id,expectedStatus:"pending",operation:"approve"};
  const viewer=await request(item,secret,"viewer","/api/control/device-commands",payload);
  assert.equal(viewer.status,403,item.label+" viewer must be denied");
  assert.equal(d1(item,"SELECT status FROM "+item.table+" WHERE device_id="+sqlQuote(item.id))[0].status,"pending");
  const approved=await request(item,secret,"owner","/api/control/device-commands",payload);
  assert.equal(approved.status,200,item.label+" owner command denied");
  const reread=await request(item,secret,"owner","/api/control/devices");
  assert.equal(reread.status,200);
  assert.equal(reread.body.devices.find(d=>d.deviceId===item.id)?.status,"approved");
  assert.equal(d1(item,"SELECT status FROM "+item.table+" WHERE device_id="+sqlQuote(item.id))[0].status,"approved");
  const replay=await request(item,secret,"owner","/api/control/device-commands",payload);
  assert.equal(replay.status,200,item.label+" idempotent replay");
  assert.equal(replay.body.replayed,true,item.label+" idempotent replay flag");
  const ledger=d1(item,"SELECT COUNT(*) AS count FROM "+item.commandTable+" WHERE command_id="+sqlQuote(payload.commandId))[0];
  assert.equal(Number(ledger.count),1,item.label+" duplicate command");
  const stale=await request(item,secret,"owner","/api/control/device-commands",{...payload,commandId:randomUUID()});
  assert.equal(stale.status,409,item.label+" stale CAS command must be rejected");
  const invalid=await fetch("http://127.0.0.1:"+item.port+"/api/control/devices",{headers:{Authorization:"Bearer invalid"},signal:AbortSignal.timeout(5000)});
  assert.ok([401,403].includes(invalid.status),item.label+" forged ticket must fail");
  report.checks.push({
    application:item.app,namespace:item.prefix,sourceCommit:item.expected,
    realControlWorker:"LOCAL_WRANGLER",signedDeviceApi:"PASS",sourceD1IndependentCli:"PASS",
    initial:"pending",viewerWriteDenied:true,ownerCASApproved:true,
    independentApiAndCliApproved:true,commandIdReplaySingleLedger:true,
    staleCASDenied:true,forgedTicketDenied:true,production:false,
  });
}
let failed=false;
try {
  preflight();
  for(const item of clients) cli(item,["d1","migrations","apply",item.db,"--local","--config","wrangler.local.jsonc"]);
  for(const item of clients) await verify(item);
} catch(error) {
  failed=true;
  report.error=error instanceof Error?error.stack||error.message:String(error);
  console.error("[R23 SOURCE BLOCKED]",report.error);
} finally {
  for(const child of processes.reverse()) {
    if(child.exitCode===null) child.kill("SIGTERM");
    if(child.exitCode===null) child.kill("SIGKILL");
  }
  writeFileSync(path.join(out,"report.json"),JSON.stringify(report,null,2)+"\n");
}
console.log(JSON.stringify({candidate:report.candidate,clients:report.checks.length,error:!!report.error,
  g04:report.g04,g05:report.g05,sourceReadback:report.checks.map(c=>c.application)}));
if(failed) process.exitCode=1;
