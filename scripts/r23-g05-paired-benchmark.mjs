// R2.3 G05 exact revision, independent local D1 matched browser-load measurement.
// This is evidence collection only: never release or treat CI as G04/G05 approval.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createServer } from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const out=path.join(root,"qa-artifacts","r23-g05-paired");
fs.mkdirSync(out,{recursive:true});
const sources=[
 {name:"baseline",cwd:path.join(root,"r23-g05-baseline"),port:5196,sha:process.env.G05_BASE_SHA},
 {name:"candidate",cwd:path.join(root,"r23-g05-candidate"),port:5197,sha:process.env.G05_CANDIDATE_SHA}
];
const counts=[10,50,200];
const viewports=[{name:"desktop",width:1440,height:900},{name:"tablet",width:800,height:900},{name:"mobile",width:390,height:844}];
const repeats=20; // p95 nearest-rank 19th sample; still a local QA estimate.
const report={
 schema:"application-management.r23.g05-paired-qa/v1",recordedAt:new Date().toISOString(),
 source:Object.fromEntries(sources.map(x=>[x.name,x.sha])),
 probe:"GitHub-hosted real Chromium, two exact Git checkouts, independent local D1, AB/BA alternation",
 environment:{node:process.version,platform:process.platform,cpuLogical:os.cpus().length,ramGB:Math.round(os.totalmem()/1024**3)},
 cohorts:counts,viewports:viewports.map(x=>x.width+"x"+x.height),repeats,
 measurements:{
  bootstrapMs:"browser navigation to parsed /api/operations JSON; not full paint",
  paintedGridProxyMs:"navigation to synthetic fixture cards in DOM and two animation frames; not physical input-to-photon",
  apiNetworkMs:"Playwright request.timing().responseEnd relative to request start",
  cpuSeconds:"Linux /proc CPU ticks of runner and descendant Chromium/Vite/Worker processes, sampled during navigation; includes QA harness, not isolated production CPU",
  ownedRssMB:"sum of owned process RSS after render (shared pages may count repeatedly), not unique host memory",
  jsHeapMB:"Chromium CDP JSHeapUsedSize at ready",
  rendererTaskMs:"Chromium Performance.getMetrics TaskDuration delta during navigation",
  p95:"nearest-rank over 20 samples per variant/cohort/viewport; exploratory, not an SLA attestation",
 },
 samples:[],summaries:[],errors:[],status:"BLOCKED",stage:"PRECHECK",
 g04:"UNVERIFIED_HUMAN_ACCEPTANCE",g05:"UNVERIFIED_UNTIL_INDEPENDENT_REVIEW",productionWrites:false
};
let fixture=null,browser=null;const owned=[];
const ticks=Number(execFileSync("getconf",["CLK_TCK"],{encoding:"utf8"}).trim())||100;
const pageBytes=Number(execFileSync("getconf",["PAGESIZE"],{encoding:"utf8"}).trim())||4096;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function log(step,detail=""){report.stage=step;console.log("[R23_G05]",step,detail);}
function gitSha(dir){return execFileSync("git",["rev-parse","HEAD"],{cwd:dir,encoding:"utf8"}).trim();}
function precheck(){
 assert.equal(process.platform,"linux","Github Linux runner required");
 assert.equal(process.env.GITHUB_ACTIONS,"true");assert.equal(process.env.GITHUB_EVENT_NAME,"pull_request");
 assert.equal(process.env.G05_PR,"414");assert.equal(process.env.G05_TARGET_PR,"419");
 for(const a of sources){
  assert.match(a.sha||"",/^[0-9a-f]{40}$/);assert.equal(gitSha(a.cwd),a.sha,a.name+" checkout mismatch");
  assert.ok(!fs.existsSync(path.join(a.cwd,".dev.vars")),"Secrets in QA checkout");
  assert.ok(fs.existsSync(path.join(a.cwd,"node_modules","vite","bin","vite.js")),"Missing pinned Vite");
 }
 for(const key of ["CLOUDFLARE_API_TOKEN","CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH",
  "APPLICATION_MANAGEMENT_PRODUCTION_ORIGIN","APPLICATION_MANAGEMENT_PRODUCTION_D1_DATABASE_ID"]){
  if(process.env[key])throw Error("Forbidden production binding: "+key);
 }
}
async function startFixture(){
 const server=createServer((req,res)=>{
  const m=/^\/api\/r23\/(qa-r23-\d+)\/(contract|status|devices|automation)$/.exec(new URL(req.url||"/","http://127.0.0.1").pathname);
  let body={error:"QA_FIXTURE_NOT_FOUND"};
  if(m&&req.method==="GET"){
   const [_,id,kind]=m,stem="/api/r23/"+id+"/";
   if(kind==="contract")body={schema:"application-management.contract/v1",
    application:{id,name:id,category:"Kỹ thuật"},
    capabilities:{deviceRegistry:true,deviceAutoApproval:true},
    policy:{credentialRequired:true,remoteAdminReady:true},
    endpoints:{status:stem+"status",devices:stem+"devices",automation:stem+"automation"}};
   else if(kind==="status")body={online:true};
   else if(kind==="devices")body={devices:[]};
   else body={automation:{autoApproveDevices:false}};
  }
  res.writeHead(m?200:404,{"content-type":"application/json","cache-control":"no-store"});
  res.end(JSON.stringify(body));
 });
 await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});
 return {server,port:server.address().port};
}
function envFor(port){
 const keys=["PATH","HOME","TMPDIR","LANG","USER","SHELL"].filter(key=>process.env[key]);
 const clean=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 const fixtureUrl="http://127.0.0.1:"+port;
 return {...clean,CI:"true",APP_RUNTIME:"local",LOCAL_DEV_AUTH:"1",LOCAL_DEV_USER_ID:"qa-r23-owner",
  LOCAL_DEV_USER_EMAIL:"qa.r23@example.test",LOCAL_DEV_USER_NAME:"R23 LOCAL OWNER QA",
  CONTROL_OWNER_EMAILS:"qa.r23@example.test",APPLICATION_MANAGEMENT_ACCESS_MODE:"standalone",
  CONTROL_PLANE_NETWORK_MODE:"local",WRANGLER_SEND_METRICS:"false",WRANGLER_WRITE_LOGS:"false",
  BOI_ECH_LOCAL_BASE_URL:fixtureUrl,HEALTH_CARE_LOCAL_BASE_URL:fixtureUrl,
  RU_LIFE_LOCAL_BASE_URL:fixtureUrl,BAUMAN_CONTROL_LOCAL_BASE_URL:fixtureUrl,
  BAUMAN_APP_LOCAL_ORIGIN:fixtureUrl,GROWUP_CONTROL_LOCAL_BASE_URL:fixtureUrl,
  PRICE_REPORT_CONTROL_LOCAL_BASE_URL:fixtureUrl};
}
function wrangler(app,args){
 const bin=path.join(app.cwd,"node_modules","wrangler","bin","wrangler.js");
 return execFileSync(process.execPath,[bin,...args],{
  cwd:app.cwd,env:app.env,encoding:"utf8",timeout:120000,stdio:["ignore","pipe","pipe"]});
}
function seed(app,count){
 const sql=["DELETE FROM managed_app_catalog WHERE id LIKE 'qa-r23-%';"];
 for(let n=1;n<=count;n++){
  const id="qa-r23-"+String(n).padStart(4,"0");
  const origin="http://127.0.0.1:"+app.fixturePort;
  sql.push("INSERT INTO managed_app_catalog(id,name,short_name,category,origin,contract_path,enabled,created_by) VALUES ('"+
   id+"','"+id+"','"+id+"','Kỹ thuật','"+origin+"','/api/r23/"+id+"/contract',1,'qa.r23@example.test');");
 }
 const pathSql=path.join(out,app.name+"-fixture-"+count+".sql");
 fs.writeFileSync(pathSql,sql.join("\n")+"\n");
 wrangler(app,["d1","execute","learning-management-db","--local","--config","wrangler.local.jsonc","--file",pathSql]);
 const output=wrangler(app,["d1","execute","learning-management-db","--local","--config","wrangler.local.jsonc","--json","--command",
  "SELECT COUNT(*) AS count FROM managed_app_catalog WHERE id LIKE 'qa-r23-%';"]);
 const at=output.indexOf("[");
 assert.ok(at>=0,"No Wrangler JSON");
 const records=JSON.parse(output.slice(at));
 assert.equal(Number(records[0]?.results?.[0]?.count),count,"D1 independent seed mismatch "+app.name);
 report.samples.push({kind:"d1-readback",variant:app.name,cohort:count,confirmed:count,sha:app.sha});
}
function procSnapshot(){
 const lines=execFileSync("ps",["-eo","pid=,ppid="],{encoding:"utf8",timeout:5000}).trim().split("\n");
 const links=new Map();
 for(const line of lines){
  const m=line.trim().match(/^(\d+)\s+(\d+)$/);if(!m)continue;
  const pid=Number(m[1]),ppid=Number(m[2]);
  if(!links.has(ppid))links.set(ppid,[]);
  links.get(ppid).push(pid);
 }
 const queue=[process.pid],set=new Set(queue);
 while(queue.length){
  const parent=queue.pop();
  for(const child of links.get(parent)||[])if(!set.has(child)){set.add(child);queue.push(child);}
 }
 let cpu=0,rss=0,n=0;
 for(const pid of set){
  try{
   const raw=fs.readFileSync("/proc/"+pid+"/stat","utf8");
   const values=raw.slice(raw.lastIndexOf(")")+2).trim().split(/\s+/);
   const count=Number(values[11])+Number(values[12]),pages=Number(values[21]);
   if(!Number.isFinite(count)||!Number.isFinite(pages))continue;
   cpu+=count/ticks;rss+=pages*pageBytes;n++;
  }catch{}
 }
 return {cpuSeconds:cpu,rssMB:rss/(1024**2),processes:n};
}
async function startVite(app){
 const url="http://127.0.0.1:"+app.port;
 if(await fetch(url,{signal:AbortSignal.timeout(1000)}).then(()=>true).catch(()=>false))
  throw Error("Occupied port "+url);
 const bin=path.join(app.cwd,"node_modules","vite","bin","vite.js");
 const cmd=spawn(process.execPath,[bin,"--host","127.0.0.1","--port",String(app.port),"--strictPort"],{
  cwd:app.cwd,env:app.env,detached:true,stdio:["ignore","pipe","pipe"]});
 owned.push(cmd);app.proc=cmd;app.logs=[];
 for(const s of [cmd.stdout,cmd.stderr])s.on("data",c=>{
  app.logs.push(String(c));if(app.logs.length>60)app.logs.shift();
 });
 const deadline=Date.now()+100000;
 while(Date.now()<deadline){
  if(cmd.exitCode!==null)throw Error("Vite "+app.name+" exited: "+app.logs.join("").slice(-2000));
  try{if((await fetch(url,{signal:AbortSignal.timeout(2500)})).status===200)return;}catch{}
  await pause(450);
 }
 throw Error("Vite "+app.name+" HTTP 200 timeout: "+app.logs.join("").slice(-1800));
}
function cdpm(metrics,key){return metrics.find(v=>v.name===key)?.value??null;}
const round=value=>Number.isFinite(value)?Math.round(value*100)/100:null;
async function measure(app,cohort,viewport,repeat){
 const ctx=await browser.newContext({viewport,locale:"vi-VN",serviceWorkers:"block"});
 const page=await ctx.newPage();
 let requests=0,failedRequests=0;const pageErrors=[];
 page.on("request",()=>requests++);
 page.on("requestfailed",()=>failedRequests++);
 page.on("pageerror",e=>pageErrors.push(e.message.slice(0,150)));
 const cdp=await ctx.newCDPSession(page);
 await cdp.send("Performance.enable");
 const beforeCdp=await cdp.send("Performance.getMetrics");
 const before=procSnapshot();
 const started=performance.now();
 try{
  const apiPromise=page.waitForResponse(response=>
    new URL(response.url()).pathname==="/api/operations"&&response.request().method()==="POST",
    {timeout:100000});
  const pageResponse=await page.goto("http://127.0.0.1:"+app.port+"/?view=applications",
    {waitUntil:"domcontentloaded",timeout:80000});
  assert.equal(pageResponse?.status(),200,"Main page not HTTP 200");
  await page.locator(".amv2-content[data-view='applications']").waitFor({timeout:60000});
  const gate=page.locator(".amv2-access-mode");
  await gate.waitFor({timeout:60000});
  if((await gate.getAttribute("data-enabled"))==="false")await gate.click();
  const res=await apiPromise;
  assert.equal(res.status(),200,"Bootstrap /api/operations status");
  const data=await res.json(),bootstrapMs=performance.now()-started;
  const synthetic=(data.managedApps||[]).filter(x=>/^qa-r23-\d+$/.test(x.id));
  assert.equal(synthetic.length,cohort,"Central readback disagrees with D1");
  await page.waitForFunction(n=>
    document.querySelectorAll("[data-testid='app-launcher-grid'] .amv2-launcher-card").length>=n,
    cohort,{timeout:40000});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const paintMs=performance.now()-started;
  const cards=await page.locator("[data-testid='app-launcher-grid'] .amv2-launcher-card").count();
  const after=procSnapshot(),afterCdp=await cdp.send("Performance.getMetrics");
  const timing=res.request().timing();
  assert.equal(failedRequests,0,"Browser failed requests");
  assert.equal(pageErrors.length,0,"JS errors: "+pageErrors.join("|"));
  if(repeat===1)await page.screenshot({path:path.join(out,
    app.name+"-"+cohort+"-"+viewport.width+"x"+viewport.height+".png"),fullPage:false,timeout:15000});
  return {kind:"sample",variant:app.name,sha:app.sha,cohort,viewport:viewport.width+"x"+viewport.height,repeat,
   http:200,apiApps:synthetic.length,renderedCards:cards,
   bootstrapMs:round(bootstrapMs),paintedGridProxyMs:round(paintMs),
   apiNetworkMs:round(timing.responseEnd),apiTtfbMs:round(timing.responseStart),
   apiBytes:Buffer.byteLength(JSON.stringify(data),"utf8"),
   requestCount:requests,failedRequests,pageErrors,
   cpuSeconds:round(after.cpuSeconds>=before.cpuSeconds?after.cpuSeconds-before.cpuSeconds:null),
   ownedRssMB:round(after.rssMB),ownedRssBeforeMB:round(before.rssMB),ownedProcesses:after.processes,
   jsHeapMB:round(cdpm(afterCdp.metrics,"JSHeapUsedSize")/(1024**2)),
   rendererTaskMs:round((cdpm(afterCdp.metrics,"TaskDuration")-cdpm(beforeCdp.metrics,"TaskDuration"))*1000)};
 }catch(e){
  try{await page.screenshot({path:path.join(out,"failure-"+app.name+"-"+cohort+"-"+repeat+".png"),fullPage:true,timeout:10000});}catch{}
  throw e;
 }finally{await ctx.close();}
}
function pRank(xs,p){
 const list=xs.filter(x=>typeof x==="number"&&Number.isFinite(x)).sort((a,b)=>a-b);
 return list.length?round(list[Math.max(0,Math.ceil(p*list.length)-1)]):null;
}
function summarize(){
 const metrics=["bootstrapMs","paintedGridProxyMs","apiNetworkMs","apiTtfbMs","requestCount",
  "cpuSeconds","ownedRssMB","jsHeapMB","rendererTaskMs","apiBytes"];
 for(const cohort of counts)for(const viewport of viewports){
  const key=viewport.width+"x"+viewport.height,group={cohort,viewport:key,variants:{}};
  for(const app of sources){
   const samples=report.samples.filter(s=>s.kind==="sample"&&s.variant===app.name&&s.cohort===cohort&&s.viewport===key);
   const entry={n:samples.length};
   for(const name of metrics){
    const values=samples.map(s=>s[name]);
    entry[name]={n:values.filter(x=>typeof x==="number"&&Number.isFinite(x)).length,p50:pRank(values,.5),p95:pRank(values,.95)};
   }
   group.variants[app.name]=entry;
  }
  group.deltaP50Pct={};
  for(const name of metrics){
   const a=group.variants.baseline[name].p50,b=group.variants.candidate[name].p50;
   group.deltaP50Pct[name]=a>0&&b!==null?round((b/a-1)*100):null;
  }
  report.summaries.push(group);
 }
}
function stop(p){
 if(!p?.pid)return;
 try{process.kill(-p.pid,"SIGTERM");}catch{}
 try{process.kill(-p.pid,"SIGKILL");}catch{}
 p.stdout?.destroy();p.stderr?.destroy();
}
try{
 precheck();
 log("LOCAL_FIXTURE_START");
 fixture=await startFixture();
 for(const app of sources)app.fixturePort=fixture.port,app.env=envFor(fixture.port);
 for(const app of sources){
  log("D1_MIGRATE_"+app.name);
  wrangler(app,["d1","migrations","apply","learning-management-db","--local","--config","wrangler.local.jsonc"]);
  await startVite(app);
 }
 const {chromium}=await import("playwright");
 browser=await chromium.launch({headless:true});
 report.environment.browser=browser.version();
 let done=0;
 for(const count of counts){
  log("INDEPENDENT_D1_SEED_"+count);
  for(const app of sources)seed(app,count);
  for(const viewport of viewports){
   for(let rep=1;rep<=repeats;rep++){
    for(const app of (rep%2?sources:[...sources].reverse())){
     report.samples.push(await measure(app,count,viewport,rep));
     done++;
     if(done%20===0)log("BROWSER_SAMPLES",done+"/360");
    }
   }
  }
 }
 summarize();
 assert.equal(report.samples.filter(s=>s.kind==="sample").length,360);
 report.status="MEASURED_NOT_ACCEPTED";report.g05="PAIRED_SOURCE_MEASURED_REVIEW_REQUIRED";
}catch(e){
 report.errors.push(String(e?.stack||e).slice(0,5000));
 report.status="BLOCKED";
 console.error("[R23_G05_BLOCKED]",report.errors.at(-1));
}finally{
 try{await browser?.close();}catch(e){report.errors.push("Browser cleanup "+String(e));}
 for(const p of owned.reverse())stop(p);
 if(fixture)await new Promise(resolve=>fixture.server.close(()=>resolve()));
 report.completedAt=new Date().toISOString();
 fs.writeFileSync(path.join(out,"report.json"),JSON.stringify(report,null,2)+"\n");
 console.log("R23_G05_STATUS="+report.status);
 console.log("R23_G05_BROWSER_SAMPLES="+report.samples.filter(s=>s.kind==="sample").length);
 console.log("R23_G05_SUMMARY_GROUPS="+report.summaries.length);
}
if(report.status!=="MEASURED_NOT_ACCEPTED"||report.errors.length)process.exitCode=1;
