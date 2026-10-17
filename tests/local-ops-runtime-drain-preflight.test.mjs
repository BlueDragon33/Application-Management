import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { RUNTIME_DRAIN_PROTOCOL,validateRuntimeDrainEvidence,probeRuntimeDrain } from "../scripts/local-ops-runtime-drain-preflight.mjs";
const expected={id:"BAUMAN-CONTROL",sourceSha:"a".repeat(40),pid:4321,nonce:"q".repeat(30)};
const receipt={
  protocol:RUNTIME_DRAIN_PROTOCOL,id:expected.id,bootNonce:expected.nonce,
  sourceSha:expected.sourceSha,processPid:4321,ownershipVerified:true,
  requests:{acceptingNew:false,activeCount:0,instrumentedAll:true},
  d1:{acceptingWrites:false,activeTransactions:0,commitBarrierVerified:true,
    storageReadbackVerified:true,instrumentedAllBindings:true},
  gracefulExit:{supported:true,forcedKill:false}
};
test("preflight verifier rejects spoofed PID, SHA, nonce, unflushed D1, or partial instrumentation",()=>{
  assert.equal(validateRuntimeDrainEvidence(expected,receipt).verified,true);
  for(const [path,value] of [
    ["bootNonce","wrong"],["sourceSha","f".repeat(40)],["processPid",3],
    ["ownershipVerified",false],["protocol","unsupported"],["requests.activeCount",1],
    ["requests.acceptingNew",true],["requests.instrumentedAll",false],
    ["d1.acceptingWrites",true],["d1.activeTransactions",2],
    ["d1.commitBarrierVerified",false],["d1.storageReadbackVerified",false],
    ["d1.instrumentedAllBindings",false],["gracefulExit.supported",false],
    ["gracefulExit.forcedKill",true]
  ]){
    const changed=structuredClone(receipt);
    const parts=path.split(".");
    if(parts.length===2)changed[parts[0]][parts[1]]=value;
    else changed[path]=value;
    assert.equal(validateRuntimeDrainEvidence(expected,changed).verified,false,path);
  }
});
test("live localhost HTTP probe rejects non-JSON, redirects, absent endpoint and forged evidence",async()=>{
  let responseBody=structuredClone(receipt),code=200,ctype="application/json";
  const server=createServer((req,res)=>{
    assert.equal(req.method,"POST");
    assert.equal(req.url,"/_local/ops/drain-preflight");
    res.writeHead(code,{"content-type":ctype,...(code===302?{location:"https://example.com/"}:{})});
    res.end(JSON.stringify(responseBody));
  });
  await new Promise(done=>server.listen(0,"127.0.0.1",done));
  const port=server.address().port;
  // A real assigned ephemeral port is normally >= 1024.
  const call=()=>probeRuntimeDrain({...expected,port,token:"t".repeat(40)});
  try {
    const good=await call();
    assert.equal(good.verified,true);
    assert.equal(good.exitObserved,false);
    assert.equal(good.autoRestartAllowed,false);
    responseBody={...receipt,d1:{...receipt.d1,storageReadbackVerified:false}};
    assert.match((await call()).reason,/D1/);
    responseBody=receipt;code=302;
    assert.equal((await call()).verified,false);
    code=200;ctype="text/html";
    assert.equal((await call()).verified,false);
    assert.equal((await probeRuntimeDrain({...expected,port,token:"x"})).verified,false);
    assert.equal((await probeRuntimeDrain({...expected,port:80,token:"x".repeat(40)})).verified,false);
  } finally {await new Promise(done=>server.close(done));}
});
