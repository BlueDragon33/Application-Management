// R2.3 integrated browser -> central P-256 auth -> real child Control Worker -> independent D1.
// QA-only pinned checkouts. Fail closed. Never read or mutate Production.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const artifact=path.join(root,"qa-artifacts","r23-integrated-owner");
mkdirSync(artifact,{recursive:true});
const origin="http://127.0.0.1:5191";
const owner="r23-integrated-owner@example.test";
const clients=[
 {key:"bauman",id:"bauman-master-ai",prefix:"BM-",code:"BM-R23-QA-001",port:3003,
  directory:path.join(root,"r23-clients","bauman","control-service"),db:"bauman-control-local",
  table:"bm_devices",secretEnv:"BAUMAN_CONTROL_SERVICE_SECRET",status:"/api/control/status",
  page:"/apps/bauman-master-ai",expected:"16d8f7a963e27a12520d510f29b161374b5c5df3"},
 {key:"price",id:"price-report-tunggiabao",prefix:"KT-",code:"KT-R23-QA-001",port:3009,
  directory:path.join(root,"r23-clients","price","control-service"),db:"price-report-control-local-db",
  table:"kt_devices",secretEnv:"PRICE_REPORT_CONTROL_SERVICE_SECRET",status:"/api/control/status",
  page:"/apps/price-report-tunggiabao",expected:"9e8df71f2839989b067af79ef22c389f541664e5"}
];
const report={
 schema:"application-management.r23-integrated-owner/v1",date:new Date().toISOString(),
 candidate:null,sourceCommits:{},rows:[],errors:[],environment:"DISPOSABLE_LOOPBACK_ONLY",
 centralAuth:"REQUIRED",productionWrites:false,g04:"UNVERIFIED_HUMAN_COMPLETE_ROLE_MATRIX",
 g05:"UNVERIFIED_REPRODUCIBLE_COMPARATIVE_CAPACITY"
};
const children=[];
let browser=null,staticServer=null;
const secrets={};
function preflight(){
 assert.equal(process.env.GITHUB_ACTIONS,"true","run in GitHub-hosted isolated runner");
 assert.equal(process.env.GITHUB_EVENT_NAME,"pull_request");
 for(const key of ["CLOUDFLARE_API_TOKEN","CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH",
   "APPLICATION_MANAGEMENT_PRODUCTION_ORIGIN","APPLICATION_MANAGEMENT_PRODUCTION_D1_DATABASE_ID"]){
   if(process.env[key])throw Error("Forbidden Production configuration "+key);
 }
 if(existsSync(path.join(root,".dev.vars")))throw Error("Refusing nonisolated .dev.vars");
 const sha=execFileSync("git",["rev-parse","HEAD"],{cwd:root,encoding:"utf8"}).trim();
 assert.equal(sha,process.env.R23_EXPECTED_SHA,"unrecognized central source SHA");
 report.candidate=sha;
 for(const item of clients){
   const gitRoot=path.dirname(item.directory);
   const actual=execFileSync("git",["rev-parse","HEAD"],{cwd:gitRoot,encoding:"utf8"}).trim();
   assert.equal(actual,item.expected,item.key+" source drift");
   report.sourceCommits[item.key]=actual;
 }
}
function childBin(item){
 const value=item.key==="price" ? process.env.R23_PRICE_WRANGLER_PATH
   : path.join(item.directory,"node_modules","wrangler","bin","wrangler.js");
 if(!value||!existsSync(value))throw Error("Missing real QA Wrangler for "+item.key);
 return value;
}
function cli(item,args){
 const stdout=execFileSync(process.execPath,[childBin(item),...args],{
  cwd:item.directory,encoding:"utf8",timeout:120000,stdio:["ignore","pipe","pipe"],
  env:{...process.env,WRANGLER_SEND_METRICS:"false"}});
 return stdout;
}
function d1(item,sql){
 const raw=cli(item,["d1","execute",item.db,"--local","--config","wrangler.local.jsonc","--json","--command",sql]);
 const parsed=JSON.parse(raw.slice(raw.indexOf("[")));
 assert.ok(Array.isArray(parsed[0]?.results),"CLI independent D1 result missing");
 return parsed[0].results;
}
function stopGroup(proc){
 if(!proc?.pid)return;
 if(process.platform==="win32"){
   try{execFileSync("taskkill.exe",["/PID",String(proc.pid),"/T","/F"],{stdio:"ignore",timeout:5000});}catch{}
 }else{
   try{process.kill(-proc.pid,"SIGTERM");}catch{}
   try{process.kill(-proc.pid,"SIGKILL");}catch{}
 }
 proc.stdout?.destroy();proc.stderr?.destroy();
}
async function listenReady(url,label,proc){
 const until=Date.now()+90000;
 while(Date.now()<until){
   if(proc && proc.exitCode!==null)throw Error(label+" exited before HTTP readiness");
   try{
     const res=await fetch(url,{signal:AbortSignal.timeout(2000)});
     if(res.status===200)return;
   }catch{}
   await new Promise(resolve=>setTimeout(resolve,350));
 }
 throw Error(label+" HTTP 200 timeout");
}
async function startWorker(item){
 const secret=randomBytes(32).toString("hex");
 secrets[item.key]=secret;
 const args=[childBin(item),"dev","--local","--config","wrangler.local.jsonc",
  "--ip","127.0.0.1","--port",String(item.port),
  "--inspector-port",String(item.port+6000),
  "--var",item.secretEnv+":"+secret];
 if(item.key==="bauman")args.push("--var","APPLICATION_MANAGEMENT_ORIGIN:"+origin,
  "--var","BAUMAN_APP_ORIGIN:"+origin);
 const p=spawn(process.execPath,args,{cwd:item.directory,detached:process.platform!=="win32",
  stdio:["ignore","pipe","pipe"],env:{...process.env,WRANGLER_SEND_METRICS:"false"}});
 children.push(p);
 const logs=[];
 for(const stream of [p.stdout,p.stderr])stream.on("data",c=>{
  logs.push(String(c).replaceAll(secret,"[REDACTED]"));if(logs.length>60)logs.shift();
 });
 try{await listenReady("http://127.0.0.1:"+item.port+"/health",item.key,p);}
 catch(e){throw Error(String(e)+" sanitized logs: "+logs.join("").slice(-2100));}
 const snap=await fetch("http://127.0.0.1:"+item.port+"/health").then(r=>r.json());
 assert.equal(snap.databaseReady,true,item.key+" source D1 unavailable");
}
function serveContract(){
 const contract=readFileSync(path.join(root,"r23-clients","price","public","management-contract.json"));
 const server=createServer((req,res)=>{
  if(req.url==="/management-contract.json"){
   res.writeHead(200,{"Content-Type":"application/json","Cache-Control":"no-store"});res.end(contract);
  }else{res.writeHead(404);res.end();}
 });
 return new Promise((resolve,reject)=>{server.once("error",reject);server.listen(3011,"127.0.0.1",()=>resolve(server));});
}
async function central(){
 const wrangler=path.join(root,"node_modules","wrangler","bin","wrangler.js");
 assert.ok(existsSync(wrangler),"Root Wrangler missing");
 const out=execFileSync(process.execPath,[wrangler,"d1","migrations","apply",
  "learning-management-db","--local","--config","wrangler.local.jsonc"],{
   cwd:root,encoding:"utf8",timeout:120000,env:{...process.env,WRANGLER_SEND_METRICS:"false"}});
 assert.ok(out.includes("learning-management-db")||out.includes("successfully")||out.includes("migrations"),"central local D1 migration not attested");
 const vars={
  ...process.env,LOCAL_DEV_AUTH:"1",
  LOCAL_DEV_USER_ID:"qa-r23-integrated-owner",LOCAL_DEV_USER_EMAIL:owner,
  LOCAL_DEV_USER_NAME:"R23 INTEGRATED QA OWNER (LOCAL)",CONTROL_OWNER_EMAILS:owner,
  APPLICATION_MANAGEMENT_ACCESS_MODE:"standalone",CONTROL_PLANE_NETWORK_MODE:"local",
  LOCAL_ACTIVE_APPLICATIONS:"bauman-master-ai,price-report-tunggiabao",
  BAUMAN_CONTROL_LOCAL_BASE_URL:"http://127.0.0.1:3003",
  BAUMAN_CONTROL_SERVICE_LOCAL_SECRET:secrets.bauman,
  PRICE_REPORT_CONTROL_LOCAL_BASE_URL:"http://127.0.0.1:3009",
  PRICE_REPORT_CONTROL_SERVICE_LOCAL_SECRET:secrets.price,
  PRICE_REPORT_CONTROL_SERVICE_SECRET:secrets.price,
  PRICE_REPORT_BASE_URL:"http://127.0.0.1:3011",
  WRANGLER_SEND_METRICS:"false"
 };
 const vite=path.join(root,"node_modules","vite","bin","vite.js");
 assert.ok(existsSync(vite),"Root pinned Vite missing");
 const p=spawn(process.execPath,[vite,"--host","127.0.0.1","--port","5191","--strictPort"],{
  cwd:root,env:vars,detached:process.platform!=="win32",stdio:["ignore","pipe","pipe"]
 });
 const logs=[];
 for(const stream of [p.stdout,p.stderr])stream.on("data",c=>{
  const text=String(c).replaceAll(secrets.bauman,"[REDACTED]").replaceAll(secrets.price,"[REDACTED]");
  logs.push(text);if(logs.length>80)logs.shift();
 });
 children.push(p);
 try{await listenReady(origin,"central App Manager",p);}
 catch(e){throw Error(String(e)+" sanitized logs: "+logs.join("").slice(-1700));}
}
async function probeClient(page,item){
 const record={application:item.id,sourceSha:item.expected,deviceCode:item.code,uiStatus:"STARTED"};
 report.rows.push(record);
 const start=performance.now();
 const res=await page.goto(origin+item.page,{waitUntil:"domcontentloaded",timeout:90000});
 assert.equal(res?.status(),200,item.key+" central page HTTP");
 await page.locator('aside[data-admin-shell="boi-owner-shared-v1"]').waitFor({timeout:90000});
 record.shellReadyMs=Math.round(performance.now()-start);
 assert.equal(await page.locator('aside[data-app-id="'+item.id+'"]').count(),1);
 const nav=page.locator('nav[aria-label^="Quản trị"]').first();
 await nav.getByRole("button",{name:/Thiết bị/}).first().click();
 const row=page.locator("article").filter({has:page.getByText(item.code,{exact:true})}).first();
 try{await row.waitFor({timeout:45000});}
 catch(e){await page.screenshot({path:path.join(artifact,item.key+"-missing-source.png"),fullPage:true});throw Error(item.key+" code absent from Central Owner UI despite source D1");}
 record.liveChildDeviceVisible=true;
 const button=row.locator('button[data-action="block"]');
 assert.equal(await button.count(),1,item.key+" missing block action");
 assert.equal(await button.isEnabled(),true,item.key+" block action is capability-locked");
 page.once("dialog",dialog=>void dialog.accept());
 const reply=page.waitForResponse(response=>{
   if(!response.url().includes("/api/"))return false;
   const req=response.request();
   if(req.method()!=="POST")return false;
   try{return req.postDataJSON()?.action==="manage-client-device";}catch{return false;}
 },{timeout:120000});
 await button.click();
 const result=await reply;
 record.centralMutationHttp=result.status();
 assert.equal(result.status(),200,item.key+" central-to-client mutation failed");
 const deadline=Date.now()+60000;
 let observed=null;
 while(Date.now()<deadline){
  const rows=d1(item,"SELECT status FROM "+item.table+" WHERE device_id='"+(item.key==="bauman"?"a":"b").repeat(64)+"'");
  observed=rows[0]?.status;
  if(observed==="blocked")break;
  await new Promise(resolve=>setTimeout(resolve,600));
 }
 assert.equal(observed,"blocked",item.key+" independent child D1 did not converge");
 record.independentChildD1="BLOCKED_CONFIRMED";
 // Do not mistake accepted API/D1 for a fully re-rendered Owner screen.
 const blockedRow=page.locator('article[data-status="blocked"]').filter({has:page.getByText(item.code,{exact:true})}).first();
 try{await blockedRow.waitFor({timeout:45000});}
 catch {
  await page.screenshot({path:path.join(artifact,item.key+"-ui-readback-stuck.png"),fullPage:true});
  throw Error(item.key+" D1 is blocked but Owner UI did not converge after readback");
 }
 record.ownerUiIndependentReadback="BLOCKED_RENDERED";
 record.responsiveReadback=[];
 for(const v of [{name:"desktop",width:1440,height:900},{name:"tablet",width:800,height:900},{name:"mobile",width:390,height:844}]){
  await page.setViewportSize({width:v.width,height:v.height});
  const presentation=await page.evaluate(()=>{
   const geom={width:document.documentElement.scrollWidth,viewport:window.innerWidth};
   const colors=[];
   const sample=Array.from(document.querySelectorAll("h1,h2,h3,button,strong,small,dt,dd,p")).filter(el=>{
     const cs=getComputedStyle(el);
     return cs.display!=="none"&&cs.visibility!=="hidden"&&el.getBoundingClientRect().width>0&&el.textContent?.trim();
   }).slice(0,240);
   for(const el of sample){
     let node=el,background=null;
     while(node){
       const css=getComputedStyle(node).backgroundColor;
       if(css&&css!=="transparent"&&css!=="rgba(0, 0, 0, 0)"){background=css;break;}
       node=node.parentElement;
     }
     colors.push({tag:el.tagName,text:el.textContent.trim().slice(0,55),
       foreground:getComputedStyle(el).color,background:background??"unknown"});
   }
   return {geometry:geom,computedTextSamples:colors};
  });
  assert.ok(presentation.geometry.width<=v.width+2,item.key+" horizontal overflow at "+v.name);
  record.responsiveReadback.push({viewport:v.name,overflowPx:Math.max(0,presentation.geometry.width-v.width),
    screenshot:item.key+"-integrated-"+v.name+".png",contrastInputs:presentation.computedTextSamples});
  await page.screenshot({path:path.join(artifact,item.key+"-integrated-"+v.name+".png"),fullPage:true});
 }
 record.uiStatus="PASS_LOCAL_E2E_AND_UI_READBACK";
}
let failed=false;
try{
 preflight();
 staticServer=await serveContract();
 for(const item of clients)await startWorker(item);
 await central();
 const {chromium}=await import("playwright");
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:"reduce"});
 const page=await context.newPage();
 for(const item of clients)await probeClient(page,item);
 await context.close();
}catch(error){
 failed=true;report.errors.push(error instanceof Error?error.stack||error.message:String(error));
 console.error("[R2.3 INTEGRATION BLOCKED]",report.errors.at(-1));
}finally{
 if(browser)await browser.close().catch(e=>report.errors.push("Browser cleanup: "+String(e)));
 for(const p of children.reverse())stopGroup(p);
 if(staticServer)await new Promise(resolve=>staticServer.close(()=>resolve()));
 writeFileSync(path.join(artifact,"report.json"),JSON.stringify(report,null,2)+"\n");
}
console.log(JSON.stringify({candidate:report.candidate,integrated:report.rows.map(x=>({app:x.application,status:x.uiStatus})),errors:report.errors.length,g04:report.g04,g05:report.g05}));
if(failed||report.errors.length)process.exitCode=1;
