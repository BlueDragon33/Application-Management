// Math PWA QA-only contract. The temporary HTTP fixture is NOT user Windows acceptance.
import assert from "node:assert/strict";
import { mkdtempSync,mkdirSync,writeFileSync,rmSync,realpathSync } from "node:fs";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { serveMathQA,validateQaSource } from "../scripts/local-ops-math-qa-static.mjs";
import { sourceTargets,readSourceSnapshot,exactSourceMatch } from "../scripts/local-ops-source-identity.mjs";
import { webSupported,webRuntimeSpec } from "../scripts/local-ops-web-launcher.mjs";
import appsCatalog from "../control/local-ops-apps.json" with { type:"json" };

const sha="2d96583f034ff3c61456d52a0ef550d2c371d248";
const app=appsCatalog.apps.find(x=>x.id==="math-bauman");
test("Math QA only: exact pinned identity, isolated port and denied arbitrary manifest",()=>{
 assert.equal(app.qaSha,sha);
 assert.equal(app.port,3022);
 assert.equal(app.qaWorktree,"_qa/Math_Bauman_PR72");
 assert.equal(webSupported(app),true);
 for(const invalid of [
   {...app,port:3005},{...app,qaSha:"361d597334eb2511f68abb5df41d3236e137d457"},
   {...app,qaWorktree:"Math_Bauman"},{...app,path:"/../README.md"}
 ])assert.equal(webSupported(invalid),false);
 const global=sourceTargets(appsCatalog.apps);
 assert.equal(global.some(x=>x.id==="math-bauman"),false,"managed stack must not require QA worktree");
 const isolated=sourceTargets([app]);
 assert.equal(isolated.length,2);
 assert.equal(isolated[1].directory,"_qa/Math_Bauman_PR72");
 assert.equal(isolated[1].qaSha,sha);
});
test("QA detached source admits only clean matching SHA, main policy unchanged",async()=>{
 const tmp=mkdtempSync(join(tmpdir(),"am-math-id-"));
 try{
   const root=join(tmp,"BaumanWeb");
   mkdirSync(join(root,"Application-Management"),{recursive:true});
   mkdirSync(join(root,"_qa","Math_Bauman_PR72"),{recursive:true});
   const fake = (dirty="",head=sha,branch="HEAD")=>async(dir,args)=>{
     if(args[0]==="rev-parse"&&args[1]==="--show-prefix")return "";
     if(args[0]==="rev-parse"&&args[1]==="--abbrev-ref")return branch;
     if(args[0]==="symbolic-ref")return "main";
     if(args[0]==="status")return dirty;
     if(args[0]==="rev-parse"&&args[1]==="HEAD")return dir.endsWith("Application-Management")?"1".repeat(40):head;
     throw Error("Unexpected git command "+args.join(" "));
   };
   const good=await readSourceSnapshot(root,[app],fake());
   assert.equal(good["math-bauman"],sha);
   assert.equal(exactSourceMatch(good,await readSourceSnapshot(root,[app],fake())),true);
   await assert.rejects(readSourceSnapshot(root,[app],fake(" M bad-file")),/DIRTY/);
   await assert.rejects(readSourceSnapshot(root,[app],fake("", "f".repeat(40))),/EXACT_SHA/);
   await assert.rejects(readSourceSnapshot(root,[app],fake("",sha,"migration/full-webapp-v2"))),/DETACHED/);
 }finally{rmSync(tmp,{recursive:true,force:true});}
});
test("Math QA disposable loopback static server: GET/HEAD/404/403/no POST and exact SHA HTTP header",async()=>{
 const top=mkdtempSync(join(tmpdir(),"am-math-http-"));
 const root=join(top,"BaumanWeb","_qa","Math_Bauman_PR72");
 const manager=join(top,"BaumanWeb","Application-Management");
 mkdirSync(join(root,"assets"),{recursive:true});
 mkdirSync(join(manager,"scripts"),{recursive:true});
 writeFileSync(join(root,"index.html"),"<!doctype html><title>Math QA</title>");
 writeFileSync(join(root,"service-worker.js"),"// QA SW fixture");
 writeFileSync(join(root,"assets","app.css"),"body{color:#fff}");
 writeFileSync(join(root,".secret"),"never serve this");
 const verifySource = x => realpathSync(x); // only in this test's disposable fixture
 let server;
 try{
   assert.throws(()=>serveMathQA({root,port:3005,sha,managerRoot:manager,verifySource}),/PORT/);
   assert.throws(()=>serveMathQA({root,port:3022,sha:"f".repeat(40),managerRoot:manager,verifySource}),/SHA/);
   server=serveMathQA({root,port:3022,sha,managerRoot:manager,verifySource});
   if(!server.listening)await once(server,"listening");
   const url="http://127.0.0.1:3022";
   const home=await fetch(url+"/index.html");
   assert.equal(home.status,200);
   assert.equal(home.headers.get("x-math-qa-sha"),sha);
   assert.match(await home.text(),/Math QA/);
   assert.equal((await fetch(url+"/assets/app.css")).status,200);
   assert.equal((await fetch(url+"/service-worker.js",{method:"HEAD"})).status,200);
   assert.equal((await fetch(url+"/.secret")).status,403);
   assert.equal((await fetch(url+"/missing")).status,404);
   assert.equal((await fetch(url+"/index.html",{method:"POST"})).status,405);
   assert.equal((await fetch(url+"/index.html",{headers:{host:"evil.example"}})).status,403);
 }finally{
   if(server)await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
   rmSync(top,{recursive:true,force:true});
 }
});
test("launcher uses QA worktree and static server, never current migration branch",()=>{
 const top=mkdtempSync(join(tmpdir(),"am-math-spec-"));
 try{
   const manager=join(top,"Application-Management");
   const root=join(top,"_qa","Math_Bauman_PR72");
   mkdirSync(join(root),{recursive:true});
   mkdirSync(join(manager,"scripts"),{recursive:true});
   writeFileSync(join(root,"index.html"),"QA");
   writeFileSync(join(root,"service-worker.js"),"QA");
   writeFileSync(join(manager,"scripts","local-ops-math-qa-static.mjs"),"QA");
   const spec=webRuntimeSpec({app,workspace:top,managerRoot:manager});
   assert.equal(spec.cwd,root);
   assert.equal(spec.port,3022);
   assert.equal(spec.args.at(-1),sha);
   assert.equal(spec.file,process.execPath);
   assert.equal(spec.env.CONTROL_PLANE_NETWORK_MODE,"local");
 }finally{rmSync(top,{recursive:true,force:true});}
});
