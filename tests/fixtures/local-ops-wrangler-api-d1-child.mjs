// QA only: owns a real programmatic Wrangler dev server and its D1 binding.
// IPC receipts describe this ONE owned instance, never all production isolates.
import { unstable_dev } from "wrangler";
import { createApiBackgroundD1Barrier } from "../../scripts/local-ops-api-background-d1-barrier.mjs";
const SHA=/^[0-9a-f]{40}$/;
const NONCE=/^[A-Za-z0-9_-]{24,}$/;
const MARKER=/^[0-9a-f]{32}$/;
let runtime=null,bootNonce=null,sourceSha=null,active=0,stopping=false;
let committedId=null,readbackId=null,backgroundMarker=null;
const background=createApiBackgroundD1Barrier();
const seen=new Set();
function respond(type,requestId,data={}){
  process.send?.({...data,type,requestId,bootNonce,sourceSha,processPid:process.pid});
}
process.on("message",async message=>{
  const id=message?.requestId;
  if(typeof id!=="string"||!/^[0-9a-f]{20}$/.test(id))return;
  if(seen.has(id)){respond("qa-denied",id,{reason:"DUPLICATE_REQUEST_ID"});return;}
  seen.add(id);
  try{
    if(message.type==="qa-boot"&&runtime===null&&
       message.processPid===process.pid&&SHA.test(message.sourceSha??"")&&
       NONCE.test(message.bootNonce??"")&&
       typeof message.scriptFile==="string"&&
       typeof message.configFile==="string"&&
       typeof message.persistDir==="string"){
      bootNonce=message.bootNonce;sourceSha=message.sourceSha;
      runtime=await unstable_dev(message.scriptFile,{
        config:message.configFile,local:true,ip:"127.0.0.1",port:0,
        persistTo:message.persistDir,logLevel:"error",
        experimental:{disableExperimentalWarning:true,disableDevRegistry:true}
      });
      respond("qa-ready",id,{port:runtime.port,scope:"programmatic-wrangler-dev-qa",
        realWranglerApi:true,allIsolateInventoryVerified:false});
      return;
    }
    if(!runtime||message.bootNonce!==bootNonce||
       message.sourceSha!==sourceSha||message.processPid!==process.pid){
      respond("qa-denied",id,{reason:"PROCESS_PID_SHA_NONCE_MISMATCH"});return;
    }
    if(message.type==="qa-preflight"){
      respond("qa-preflight",id,{active,stopping,
        completedWrite:committedId!==null,verifiedReadback:readbackId===committedId&&committedId!==null,
        backgroundPending:background.status().backgroundPending,
        declaredBackgroundD1ReadbackVerified:background.status().declaredBackgroundD1ReadbackVerified,
        allWaitUntilJobsInstrumented:false,
        allIsolateInventoryVerified:false,globalD1QuiescenceVerified:false,
        permitShutdownUserRuntime:false});
      return;
    }
    if(message.type==="qa-write"){
      if(stopping||active!==0||!MARKER.test(message.marker??"")){
        respond("qa-denied",id,{reason:"WRITE_NOT_ADMITTED"});return;
      }
      active++;
      try{
        const response=await runtime.fetch("http://example.com/write?id="+message.marker,
          {method:"POST"});
        const value=await response.json();
        if(response.status!==200||value.committed!==true||
           value.id!==message.marker)throw Error("WRANGLER_D1_WRITE_NOT_COMMITTED");
        committedId=message.marker;
        respond("qa-written",id,{committed:true,activeBeforeReply:active});
      }finally{active--;}
      return;
    }
    if(message.type==="qa-background-write"){
      if(stopping||active!==0||committedId===null||readbackId!==committedId||
         !background.start(message.marker)){
        respond("qa-denied",id,{reason:"BACKGROUND_WRITE_NOT_ADMITTED"});return;
      }
      backgroundMarker=message.marker;
      active++;
      try{
        const response=await runtime.fetch("http://example.com/background-write?id="+backgroundMarker,
          {method:"POST"});
        const value=await response.json();
        if(response.status!==202||value.accepted!==true||
           value.id!==backgroundMarker||value.backgroundWriteCompleted!==false)
          throw Error("WRANGLER_BACKGROUND_WAITUNTIL_NOT_ACCEPTED");
        respond("qa-background-accepted",id,{accepted:true,
          backgroundCommitVerified:false,allWaitUntilJobsInstrumented:false});
      }finally{active--;}
      return;
    }
    if(message.type==="qa-background-state"||message.type==="qa-background-release"){
      if(stopping||!MARKER.test(message.marker??"")||
         message.marker!==backgroundMarker||background.status().tainted){
        respond("qa-denied",id,{reason:"BACKGROUND_MARKER_UNVERIFIED"});return;
      }
      active++;
      try{
        if(message.type==="qa-background-state"){
          const response=await runtime.fetch("http://example.com/read?id="+backgroundMarker);
          const value=await response.json();
          if(response.status!==200||!["PENDING","RELEASED","BACKGROUND_COMMITTED"].includes(value.val))
            throw Error("BACKGROUND_D1_STATE_UNVERIFIED");
          respond("qa-background-state",id,{state:value.val,
            backgroundStillUnverified:!background.status().declaredBackgroundD1ReadbackVerified});
        }else{
          const response=await runtime.fetch("http://example.com/background-release?id="+backgroundMarker,
            {method:"POST"});
          const value=await response.json();
          if(response.status!==200||value.released!==true||value.id!==backgroundMarker)
            throw Error("BACKGROUND_D1_GATE_RELEASE_UNVERIFIED");
          respond("qa-background-released",id,{released:true,backgroundWriteCommitted:false});
        }
      }finally{active--;}
      return;
    }
    if(message.type==="qa-background-read"){
      if(stopping||active!==0||!MARKER.test(message.marker??"")||
         message.marker!==backgroundMarker||background.status().tainted){
        respond("qa-denied",id,{reason:"BACKGROUND_READBACK_NOT_ADMITTED"});return;
      }
      active++;
      try{
        let committed=false;
        for(let i=0;i<60;i++){
          const response=await runtime.fetch("http://example.com/read?id="+backgroundMarker);
          const value=await response.json();
          if(response.status===200&&value.val==="BACKGROUND_COMMITTED"){
            committed=background.complete(backgroundMarker,value.val);break;
          }
          if(response.status!==200||!["PENDING","RELEASED"].includes(value.val))
            throw Error("WRANGLER_BACKGROUND_D1_BAD_STATE");
          await new Promise(ok=>setTimeout(ok,100));
        }
        if(!committed)throw Error("WRANGLER_BACKGROUND_D1_READBACK_TIMEOUT");
        respond("qa-background-readback",id,{backgroundWriteCommitted:true,
          declaredBackgroundReadbackVerified:true,globalD1QuiescenceVerified:false});
      }finally{active--;}
      return;
    }
    if(message.type==="qa-read"){
      if(stopping||active!==0||committedId===null){
        respond("qa-denied",id,{reason:"NO_COMMITTED_WRITE"});return;
      }
      active++;
      try{
        const response=await runtime.fetch("http://example.com/read?id="+committedId);
        const value=await response.json();
        if(response.status!==200||value.val!=="COMMITTED")
          throw Error("WRANGLER_D1_READBACK_FAILED");
        readbackId=committedId;
        respond("qa-readback",id,{readback:true});
      }finally{active--;}
      return;
    }
    if(message.type==="qa-stop"){
      if(stopping||active!==0||committedId===null||readbackId!==committedId){
        respond("qa-denied",id,{reason:"D1_ACTIVE_OR_UNVERIFIED"});return;
      }
      if(!background.status().fixtureStopMayProceed){
        respond("qa-denied",id,{reason:"D1_BACKGROUND_UNVERIFIED"});return;
      }
      stopping=true;
      // This is the real Wrangler dev API stop, NOT child.kill or taskkill.
      await runtime.stop();
      runtime=null;
      respond("qa-stop-ack",id,{
        wranglerApiStopCompleted:true,activeAtStop:0,
        readbackBeforeStop:true,declaredBackgroundD1ReadbackBeforeStop:true,
        allWaitUntilJobsInstrumented:false,wholeIsolateInventoryVerified:false,
        globallyQuiescentD1Verified:false,authorizedApplicationStop:false,
        autoRestartApproved:false});
      setImmediate(()=>process.exit(0));
      return;
    }
    respond("qa-denied",id,{reason:"UNKNOWN_COMMAND"});
  }catch(error){
    respond("qa-denied",id,{reason:"WRANGLER_API_QA_FAILED"});
    process.stderr.write("WRANGLER_API_QA_FAILED: "+String(error).slice(0,400)+"\n");
  }
});
