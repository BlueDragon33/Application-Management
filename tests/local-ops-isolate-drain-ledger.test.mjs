import assert from "node:assert/strict";
import test from "node:test";
import {createHmac} from "node:crypto";
import {canonicalIsolateReceipt,createIsolateDrainLedger,ISOLATE_DRAIN_PROTOCOL} from "../scripts/local-ops-isolate-drain-ledger.mjs";
const secret="s".repeat(50);
const expected={serviceId:"BAUMAN-CONTROL",sourceSha:"a".repeat(40),
  processPid:31415,bootNonce:"n".repeat(48),expectedIsolates:["iso-A","iso-B"],secret};
let now=1770000000000;
const makeLedger=()=>createIsolateDrainLedger({...expected,time:()=>now,maxAgeMs:5000});
function frame(isolateId,override={}) {
  const payload={protocol:ISOLATE_DRAIN_PROTOCOL,serviceId:expected.serviceId,
    sourceSha:expected.sourceSha,processPid:expected.processPid,
    bootNonce:expected.bootNonce,isolateId,sequence:1,issuedAt:now,
    acceptingRequests:false,activeRequests:0,acceptingWrites:false,
    activeD1Transactions:0,allBindingsInstrumented:true,
    durableReadbackVerified:true,commitBarrierVerified:true,forceKillUsed:false,...override};
  return {receipt:payload,mac:createHmac("sha256",secret)
    .update(canonicalIsolateReceipt(payload)).digest("hex")};
}
test("signed two-isolate declared inventory NEVER proves all Worker isolates or shutdown",()=>{
 const ledger=makeLedger();
 assert.deepEqual(ledger.status().missingIsolates,["iso-A","iso-B"]);
 assert.equal(ledger.record(frame("iso-A")).accepted,true);
 assert.equal(ledger.status().declaredSetComplete,false);
 assert.equal(ledger.record(frame("iso-B")).accepted,true);
 const result=ledger.status();
 assert.equal(result.declaredSetComplete,true);
 assert.equal(result.receivedCount,2);
 for(const field of ["authoritativeRuntimeIsolateInventory","allWorkerIsolatesDrained",
   "processBoundGracefulExitObserved","windowsDescendantsGone","autoRestartAllowed",
   "permitShutdown","ready"])assert.equal(result[field],false,field);
 assert.equal(JSON.stringify(result).includes(secret),false);
});
test("nonce PID SHA MAC tamper replay unknown isolate and freshness fail closed",()=>{
 const ledger=makeLedger();
 for(const change of [{bootNonce:"z".repeat(48)},{sourceSha:"b".repeat(40)},
   {processPid:9999},{activeD1Transactions:1},{activeRequests:1},
   {allBindingsInstrumented:false},{durableReadbackVerified:false},
   {commitBarrierVerified:false},{forceKillUsed:true},
   {acceptingWrites:true},{acceptingRequests:true}]){
   const submitted=ledger.record(frame("iso-A",change));
   assert.equal(submitted.accepted,false,JSON.stringify(change));
 }
 const tamper=frame("iso-A");tamper.receipt.processPid=1;
 assert.equal(ledger.record(tamper).accepted,false,"tampering after signing");
 assert.equal(ledger.record(frame("rogue")).reason,"ISOLATE_NOT_IN_DECLARED_SET");
 const proper=frame("iso-A");
 assert.equal(ledger.record(proper).accepted,true);
 assert.equal(ledger.record(proper).reason,"ISOLATE_DUPLICATE_OR_REPLAY");
 assert.equal(ledger.record(frame("iso-A",{sequence:2})).accepted,true);
 now+=5001;
 assert.equal(ledger.status().declaredSetComplete,false);
 assert.deepEqual(ledger.status().staleIsolates,["iso-A"]);
 assert.equal(ledger.record(frame("iso-B",{issuedAt:now-6000})).reason,
   "ISOLATE_SEQUENCE_OR_FRESHNESS_INVALID");
 assert.equal(ledger.status().permitShutdown,false);
 assert.equal(ledger.status().receiptLedgerTainted,true);
 assert.equal(ledger.status().declaredSetComplete,false,
   "invalid/spoofed receipts permanently taint this boot attempt");
});
test("caller cannot forge declared inventory by empty or duplicated isolate IDs",()=>{
 for(const expectedIsolates of [[],["iso-A","iso-A"],[""],new Array(65).fill("a")])
   assert.throws(()=>createIsolateDrainLedger({...expected,expectedIsolates}),
     /ISOLATE_LEDGER_EXPECTATION_INVALID/);
 assert.throws(()=>createIsolateDrainLedger({...expected,secret:"weak"}),
   /ISOLATE_LEDGER_EXPECTATION_INVALID/);
});

test("caller mutation of declared isolate list cannot silently change authenticated scope",()=>{
 const ids=["iso-A","iso-B"];
 const ledger=createIsolateDrainLedger({...expected,expectedIsolates:ids,time:()=>now});
 ids.length=0;
 ids.push("rogue");
 assert.equal(ledger.status().declaredIsolateCount,2);
 assert.deepEqual(ledger.status().missingIsolates,["iso-A","iso-B"]);
 assert.equal(ledger.record(frame("rogue")).accepted,false);
 assert.equal(ledger.status().receiptLedgerTainted,true);
 assert.equal(ledger.status().permitShutdown,false);
});
test("any replay poisons declared-set completeness without asserting global isolate drain",()=>{
 const ledger=makeLedger();
 assert.equal(ledger.record(frame("iso-A")).accepted,true);
 assert.equal(ledger.record(frame("iso-B")).accepted,true);
 assert.equal(ledger.status().declaredSetComplete,true);
 assert.equal(ledger.status().allWorkerIsolatesDrained,false);
 assert.equal(ledger.record(frame("iso-A")).accepted,false);
 assert.equal(ledger.status().declaredSetComplete,false);
 assert.equal(ledger.status().permitShutdown,false);
});
