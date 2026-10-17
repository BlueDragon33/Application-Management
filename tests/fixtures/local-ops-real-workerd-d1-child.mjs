// Disposable Node wrapper owns a REAL Miniflare/workerd D1 runtime.
// It never claims exhaustive Cloudflare Worker isolate enumeration.
import { Miniflare } from "miniflare";
import { createServer } from "node:http";
const ID=/^[A-Za-z0-9_-]{24,}$/;
const SHA=/^[0-9a-f]{40}$/;
const DBID="00000000-0000-0000-0000-000000008801";
let mf=null,server=null,nonce=null,sha=null,active=0,stopping=false;
const source=String.raw`export default {
 async fetch(request,env) {
  const url=new URL(request.url);
  if(url.pathname==="/write"){
   const id=url.searchParams.get("id");
   if(!/^[0-9a-f]{32}$/.test(id||""))return new Response("bad",{status:400});
   await new Promise(ok=>setTimeout(ok,850));
   await env.DB.prepare("INSERT INTO workerd_ack_qa(id,val) VALUES(?,?)").bind(id,"COMMITTED").run();
   return new Response("COMMITTED");
  }
  return new Response("not found",{status:404});
 }
};`;
function send(type,requestId,data={}) {
 process.send?.({type,requestId,processPid:process.pid,sourceSha:sha,bootNonce:nonce,...data});
}
process.on("message",async message=>{
  const id=message?.requestId??null;
  try{
    if(message?.type==="qa-boot"&&mf===null&&ID.test(message.bootNonce??"")&&
      SHA.test(message.sourceSha??"")&&message.processPid===process.pid&&
      typeof message.persistDir==="string") {
      nonce=message.bootNonce;sha=message.sourceSha;
      mf=new Miniflare({modules:true,script:source,
        compatibilityDate:"2026-05-22",d1Databases:{DB:DBID},
        d1Persist:message.persistDir});
      const db=await mf.getD1Database("DB");
      await db.exec("CREATE TABLE workerd_ack_qa(id TEXT PRIMARY KEY,val TEXT NOT NULL)");
      server=createServer(async(req,res)=>{
        if(stopping){res.writeHead(503);res.end("blocked");return;}
        active++;
        try {
          const response=await mf.dispatchFetch("http://localhost"+(req.url??"/"),{
            method:req.method});
          res.writeHead(response.status,{"cache-control":"no-store"});
          res.end(await response.text());
        }catch{res.writeHead(502);res.end("worker failure");}
        finally{active--;}
      });
      await new Promise((ok,fail)=>server.once("error",fail).listen(0,"127.0.0.1",ok));
      send("qa-ready",id,{port:server.address().port,realWorkerd:true});
      return;
    }
    if(!mf||message.bootNonce!==nonce||message.sourceSha!==sha||
       message.processPid!==process.pid) {
      send("qa-denied",id,{code:"PROCESS_IDENTITY_MISMATCH"});return;
    }
    if(message.type==="qa-preflight"){
      send("qa-preflight",id,{activeRequests:active,allWorkersEnumerated:false,
        globalDrainVerified:false});return;
    }
    if(message.type==="qa-stop"){
      if(stopping||active>0){
        send("qa-denied",id,{code:"ACTIVE_REQUEST_OR_ALREADY_STOPPING"});return;
      }
      stopping=true;
      await new Promise((ok,fail)=>server.close(error=>error?fail(error):ok()));
      await mf.dispose(); // actual workerd shutdown, not Wrangler CLI exit.
      send("qa-stop-ack",id,{httpClosed:true,workerdDisposed:true,
        activeRequests:0,globalD1DrainVerified:false,allIsolatesEnumerated:false,
        authorizedApplicationStop:false});
      setImmediate(()=>process.exit(0));
      return;
    }
    send("qa-denied",id,{code:"UNKNOWN_COMMAND"});
  }catch(error){
    send("qa-denied",id,{code:"QA_RUNTIME_FAILURE"});
    process.stderr.write(String(error).slice(0,500));
  }
});
