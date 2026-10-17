// Standalone disposable Node IPC child — NOT Wrangler and not a D1 runtime.
import {createServer} from "node:http";
let nonce=null,sha=null,server=null,active=0,hold=null,stopping=false;
function reply(type,requestId,data={}) {
 process.send?.({type,requestId,bootNonce:nonce,sourceSha:sha,
   processPid:process.pid,...data});
}
process.on("message",async msg=>{
 try {
  if(msg?.type==="qa-boot"&&server===null&&
     /^[a-zA-Z0-9_-]{24,}$/.test(msg.bootNonce||"")&&
     /^[a-f0-9]{40}$/i.test(msg.sourceSha||"")) {
    nonce=msg.bootNonce;sha=msg.sourceSha;
    server=createServer((req,res)=>{
      if(stopping){res.writeHead(503);res.end("draining");return;}
      active++;res.on("close",()=>{active--;});
      if(req.url==="/hold")hold=res;
      else res.end("ok");
    });
    await new Promise((ok,bad)=>server.once("error",bad).listen(0,"127.0.0.1",ok));
    reply("qa-ready",msg.requestId,{port:server.address().port,scope:"node-gateway-fixture-only"});
    return;
  }
  if(!server||msg?.bootNonce!==nonce||msg?.sourceSha!==sha) {
    reply("qa-refused",msg?.requestId??null,{reason:"IPC_PROCESS_IDENTITY_MISMATCH"});
    return;
  }
  if(msg.type==="qa-preflight") {
    reply("qa-preflight",msg.requestId,{activeRequests:active,
      acceptingNew:!stopping,globalD1Verified:false,
      authorizedRealAppShutdown:false});return;
  }
  if(msg.type==="qa-release") {
    if(hold&&!hold.writableEnded) {hold.end("done");hold=null;}
    reply("qa-released",msg.requestId);return;
  }
  if(msg.type==="qa-stop") {
    if(stopping||active>0){reply("qa-refused",msg.requestId,{reason:"INFLIGHT_OR_DUPLICATE_STOP"});return;}
    stopping=true;
    await new Promise((ok,bad)=>server.close(e=>e?bad(e):ok()));
    reply("qa-stop-ack",msg.requestId,{serverClosed:true,activeRequests:active,
      fullD1DrainVerified:false,authorizedRealAppShutdown:false});
    setImmediate(()=>process.exit(0));return;
  }
  reply("qa-refused",msg.requestId,{reason:"UNKNOWN_COMMAND"});
 }catch(error){reply("qa-refused",msg?.requestId??null,{reason:"QA_IPC_ERROR"});}
});
