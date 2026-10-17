// Real workerd (Miniflare) D1 + process-bound IPC graceful QA.
// This proves ONE manager-owned instance, not the global Wrangler dev runtime.
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {randomBytes} from "node:crypto";
import {createServer as createTcp} from "node:net";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {setTimeout as delay} from "node:timers/promises";
import {Miniflare} from "miniflare";
import {captureWindowsTree,verifyWindowsTreeGone} from "./local-ops-windows-process-tree.mjs";

const DBID="00000000-0000-0000-0000-000000008801";
const dir=await mkdtemp(join(tmpdir(),"am-real-workerd-stop-"));
const nonce=randomBytes(32).toString("base64url"),sha="f".repeat(40);
const marker=randomBytes(16).toString("hex");
const child=spawn(process.execPath,[fileURLToPath(new URL("../tests/fixtures/local-ops-real-workerd-d1-child.mjs",import.meta.url))],{
 cwd:process.cwd(),stdio:["ignore","pipe","pipe","ipc"],windowsHide:true,
 env:{...process.env,CI:"1",WRANGLER_SEND_METRICS:"false"}});
let logs="",port=null,tree=null;
for(const stream of [child.stdout,child.stderr])
 stream.on("data",x=>logs=(logs+String(x)).slice(-5000));
function ask(type,overrides={}){
 const requestId=randomBytes(10).toString("hex");
 return new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>{clean();reject(Error("REAL_WORKERD_IPC_ACK_TIMEOUT:"+type));},10000);
   const msg=(reply)=>{
     if(reply?.requestId!==requestId)return;
     clean();
     if(reply.processPid!==child.pid||reply.sourceSha!==sha||reply.bootNonce!==nonce)
       reject(Error("REAL_WORKERD_IPC_IDENTITY_MISMATCH"));
     else resolve(reply);
   };
   const exited=()=>{clean();reject(Error("REAL_WORKERD_EXIT_BEFORE_ACK"));};
   function clean(){clearTimeout(timeout);child.off("message",msg);child.off("exit",exited);}
   child.on("message",msg);child.once("exit",exited);
   child.send({type,requestId,processPid:child.pid,sourceSha:sha,bootNonce:nonce,...overrides});
 });
}
async function free(port){
 const server=createTcp();
 try{await new Promise((ok,fail)=>server.once("error",fail).listen(port,"127.0.0.1",ok));}
 finally{if(server.listening)await new Promise(ok=>server.close(ok));}
}
try{
 const boot=await ask("qa-boot",{persistDir:dir});
 assert.equal(boot.type,"qa-ready");
 assert.equal(boot.realWorkerd,true);
 port=boot.port;
 if(process.platform==="win32")tree=await captureWindowsTree(child.pid);
 const writing=fetch("http://127.0.0.1:"+port+"/write?id="+marker,{method:"POST",signal:AbortSignal.timeout(12000)});
 let blocked;
 for(let i=0;i<80;i++){
   blocked=await ask("qa-preflight");
   if(blocked.activeRequests>0)break;
   await delay(15);
 }
 assert.equal(blocked.activeRequests,1);
 const noStop=await ask("qa-stop");
 assert.equal(noStop.type,"qa-denied");
 assert.equal(noStop.code,"ACTIVE_REQUEST_OR_ALREADY_STOPPING");
 for(const wrong of [{bootNonce:"wrong"},{sourceSha:"e".repeat(40)},{processPid:child.pid+1}]){
   const res=await ask("qa-preflight",wrong);
   assert.equal(res.type,"qa-denied");
   assert.equal(res.code,"PROCESS_IDENTITY_MISMATCH");
 }
 const response=await writing;
 assert.equal(response.status,200);
 assert.equal(await response.text(),"COMMITTED");
 for(let i=0;i<30;i++){
   blocked=await ask("qa-preflight");
   if(blocked.activeRequests===0)break;
   await delay(15);
 }
 assert.equal(blocked.activeRequests,0);
 const stop=await ask("qa-stop");
 assert.equal(stop.type,"qa-stop-ack");
 assert.equal(stop.httpClosed,true);
 assert.equal(stop.workerdDisposed,true);
 assert.equal(stop.globalD1DrainVerified,false);
 assert.equal(stop.authorizedApplicationStop,false);
 await Promise.race([
   new Promise((ok,fail)=>{if(child.exitCode!==null)return ok();
     child.once("exit",ok);child.once("error",fail);}),
   delay(12000).then(()=>{throw Error("REAL_WORKERD_QA_EXIT_TIMEOUT")})
 ]);
 await free(port);
 if(tree) {
   const result=await verifyWindowsTreeGone(tree);
   assert.equal(result.stopped,true);
 }
 // New Miniflare/workerd runtime after owned child completely exited.
 const second=new Miniflare({modules:true,script:"export default {}",
   compatibilityDate:"2026-05-22",d1Databases:{DB:DBID},d1Persist:dir});
 try {
   const db=await second.getD1Database("DB");
   const value=await db.prepare("SELECT val FROM workerd_ack_qa WHERE id=?").bind(marker).first();
   assert.equal(value?.val,"COMMITTED");
 } finally {await second.dispose();}
 console.log(JSON.stringify({result:"REAL_WORKERD_D1_PROCESS_BOUND_GRACEFUL_QA_PASS",
   platform:process.platform,ownedNodePid:child.pid,realWorkerdD1:true,
   inFlightRequestDeniedStop:true,wrongPidShaNonceDenied:true,
   stopAckAfterMiniflareDispose:true,processExitObserved:true,
   windowsDescendantsGone:tree?true:"not-windows",loopbackPortReleased:true,
   independentRuntimeD1Readback:true,allCloudflareIsolatesEnumerated:false,
   realWranglerDevGracefulStopVerified:false,fullStackAutoRestartApproved:false}));
}catch(error){
 console.error("WORKERD_QA_FAIL",String(error),logs.slice(-850));throw error;
}finally{
 if(child.exitCode===null&&child.signalCode===null) {
   child.kill("SIGTERM"); // QA failure-only cleanup, never user runtime.
   await delay(250);
 }
 await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:350});
}
