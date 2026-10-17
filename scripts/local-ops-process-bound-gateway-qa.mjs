// Real Windows/Linux IPC + HTTP Node child exit; NOT Wrangler graceful D1.
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {randomBytes} from "node:crypto";
import {createServer} from "node:net";
import {setTimeout as sleep} from "node:timers/promises";
import {fileURLToPath} from "node:url";
import {captureWindowsTree,verifyWindowsTreeGone} from "./local-ops-windows-process-tree.mjs";

const childPath=fileURLToPath(new URL("../tests/fixtures/local-ops-graceful-gateway-child.mjs",import.meta.url));
const child=spawn(process.execPath,[childPath],{
 cwd:process.cwd(),stdio:["ignore","pipe","pipe","ipc"],
 windowsHide:true,env:{...process.env,CI:"1"}
});
const nonce=randomBytes(32).toString("base64url"),sha="a".repeat(40);
const id=()=>randomBytes(12).toString("hex");
let port,tree,logs="";
for(const stream of [child.stdout,child.stderr])stream.on("data",b=>logs=(logs+String(b)).slice(-3000));
async function ask(type,extra={}) {
 const requestId=id();
 const reply=new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>{cleanup();reject(Error("QA_ACK_TIMEOUT: "+type));},8000);
  const onMessage=m=>{
   if(m?.requestId!==requestId)return;
   cleanup();
   if(m.bootNonce!==nonce||m.sourceSha!==sha||m.processPid!==child.pid)
     return reject(Error("PROCESS_BOUND_ACK_IDENTITY_MISMATCH"));
   resolve(m);
  };
  const onExit=()=>{cleanup();reject(Error("QA_PROCESS_EXIT_BEFORE_ACK"));};
  const cleanup=()=>{clearTimeout(timeout);child.off("message",onMessage);child.off("exit",onExit);};
  child.on("message",onMessage);child.once("exit",onExit);
 });
 if(!child.connected)throw Error("QA_IPC_NOT_CONNECTED");
 child.send({type,requestId,bootNonce:nonce,sourceSha:sha,...extra});
 return reply;
}
async function awaitExit() {
 if(child.exitCode!==null||child.signalCode!==null)return;
 await Promise.race([
  new Promise((resolve,reject)=>{
   child.once("exit",()=>resolve());
   child.once("error",reject);
  }),
  sleep(9000).then(()=>{throw Error("QA_GRACEFUL_EXIT_TIMEOUT");})
 ]);
}
async function portFreed() {
 const sock=createServer();
 try{
  await new Promise((ok,bad)=>{sock.once("error",bad);sock.listen(port,"127.0.0.1",ok);});
 }finally{if(sock.listening)await new Promise(ok=>sock.close(ok));}
}
try{
 const boot=await ask("qa-boot");
 assert.equal(boot.type,"qa-ready");
 assert.equal(boot.scope,"node-gateway-fixture-only");
 port=boot.port;assert.ok(Number.isInteger(port)&&port>=1024);
 if(process.platform==="win32")tree=await captureWindowsTree(child.pid);
 const request=fetch("http://127.0.0.1:"+port+"/hold",{signal:AbortSignal.timeout(8000)});
 let pending;
 for(let i=0;i<30;i++){
  pending=await ask("qa-preflight");
  if(pending.activeRequests===1)break;
  await sleep(40);
 }
 assert.equal(pending.activeRequests,1);
 assert.equal(pending.globalD1Verified,false);
 const blocked=await ask("qa-stop");
 assert.equal(blocked.type,"qa-refused");
 assert.equal(blocked.reason,"INFLIGHT_OR_DUPLICATE_STOP");
 const wrong=await ask("qa-preflight",{bootNonce:"wrong"});
 assert.equal(wrong.type,"qa-refused");
 assert.equal(wrong.reason,"IPC_PROCESS_IDENTITY_MISMATCH");
 const done=await ask("qa-release");
 assert.equal(done.type,"qa-released");
 assert.equal((await request).status,200);
 for(let i=0;i<40;i++) {
  pending=await ask("qa-preflight");
  if(pending.activeRequests===0)break;
  await sleep(20);
 }
 assert.equal(pending.activeRequests,0);
 const receipt=await ask("qa-stop");
 assert.equal(receipt.type,"qa-stop-ack");
 assert.equal(receipt.serverClosed,true);
 assert.equal(receipt.activeRequests,0);
 assert.equal(receipt.fullD1DrainVerified,false);
 assert.equal(receipt.authorizedRealAppShutdown,false);
 await awaitExit();
 await portFreed();
 let gone=null;
 if(tree){
   gone=await verifyWindowsTreeGone(tree);
   assert.equal(gone.stopped,true);
 }
 console.log(JSON.stringify({
   result:"PROCESS_BOUND_NODE_GATEWAY_GRACEFUL_QA_PASS",
   scope:"disposable Node IPC gateway, NOT Wrangler/Cloudflare Workers",
   platform:process.platform,pid:child.pid,
   realPortReleased:true,processExitObserved:true,
   capturedWindowsDescendantsGone:gone?.stopped??"not-windows",
   inflightRequestBlockedStop:true,wrongNonceRejected:true,
   ackVerifiedByParentIPC:true,workerD1TransactionsDrained:false,
   fullIsolateInventoryVerified:false,realApplicationShutdownApproved:false
 }));
}catch(e){
 console.error("QA_PROCESS_BOUND_FAILURE",String(e),logs.slice(-1000));
 throw e;
}finally{
 if(child.exitCode===null&&child.signalCode===null){
  child.kill("SIGTERM"); // disposable fixture cleanup only
  await sleep(350);
 }
}
