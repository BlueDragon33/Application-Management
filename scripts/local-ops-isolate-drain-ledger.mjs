// Blueprint OS 1.3.0 — per-isolate drain evidence intake, never a global
// Cloudflare isolate inventory. A complete *declared* set is NOT all isolates.
import { createHmac, timingSafeEqual } from "node:crypto";

const SHA=/^[0-9a-f]{40}$/i;
const TOKEN=/^[A-Za-z0-9_-]{20,}$/;
const ID=/^[A-Za-z0-9_-]{1,80}$/;
export const ISOLATE_DRAIN_PROTOCOL="local-ops-isolate-drain/v1";
export function canonicalIsolateReceipt(payload) {
  const fields=["protocol","serviceId","sourceSha","processPid","bootNonce",
    "isolateId","sequence","issuedAt","acceptingRequests","activeRequests",
    "acceptingWrites","activeD1Transactions","allBindingsInstrumented",
    "durableReadbackVerified","commitBarrierVerified","forceKillUsed"];
  return JSON.stringify(fields.map(k=>[k,payload?.[k]]));
}
const H=(secret,receipt)=>createHmac("sha256",secret).update(canonicalIsolateReceipt(receipt)).digest("hex");

export function createIsolateDrainLedger({
  serviceId,sourceSha,processPid,bootNonce,expectedIsolates,secret,
  time=()=>Date.now(),maxAgeMs=20000
}={}) {
  if(!ID.test(serviceId??"")||!SHA.test(sourceSha??"")||
     !Number.isSafeInteger(processPid)||processPid<=0||!TOKEN.test(bootNonce??"")||
     !Array.isArray(expectedIsolates)||expectedIsolates.length<1||
     expectedIsolates.length>64||expectedIsolates.some(x=>!ID.test(x))||
     new Set(expectedIsolates).size!==expectedIsolates.length||
     typeof secret!=="string"||secret.length<32||
     !Number.isInteger(maxAgeMs)||maxAgeMs<1000||maxAgeMs>120000)
     throw Error("ISOLATE_LEDGER_EXPECTATION_INVALID");
  const received=new Map();
  let invalidReceipts=0,unknownIsolates=0,replays=0;
  function record({receipt,mac}={}) {
    if(!receipt||typeof receipt!=="object"||typeof mac!=="string"||
       !/^[0-9a-f]{64}$/.test(mac)) {
      invalidReceipts++;return {accepted:false,reason:"ISOLATE_RECEIPT_FORMAT_INVALID"};
    }
    const digest=H(secret,receipt);
    if(!timingSafeEqual(Buffer.from(digest,"hex"),Buffer.from(mac,"hex"))) {
      invalidReceipts++;return {accepted:false,reason:"ISOLATE_RECEIPT_MAC_INVALID"};
    }
    if(receipt.protocol!==ISOLATE_DRAIN_PROTOCOL||
       receipt.serviceId!==serviceId||receipt.sourceSha!==sourceSha||
       receipt.processPid!==processPid||receipt.bootNonce!==bootNonce){
      invalidReceipts++;return {accepted:false,reason:"ISOLATE_PROCESS_NONCE_SHA_MISMATCH"};
    }
    if(!expectedIsolates.includes(receipt.isolateId)){
      unknownIsolates++;return {accepted:false,reason:"ISOLATE_NOT_IN_DECLARED_SET"};
    }
    if(!Number.isSafeInteger(receipt.sequence)||receipt.sequence<=0||
       !Number.isFinite(receipt.issuedAt)||Math.abs(time()-receipt.issuedAt)>maxAgeMs){
      invalidReceipts++;return {accepted:false,reason:"ISOLATE_SEQUENCE_OR_FRESHNESS_INVALID"};
    }
    if(received.has(receipt.isolateId)&&
       received.get(receipt.isolateId).sequence>=receipt.sequence){
      replays++;return {accepted:false,reason:"ISOLATE_DUPLICATE_OR_REPLAY"};
    }
    if(receipt.acceptingRequests!==false||receipt.acceptingWrites!==false||
       receipt.activeRequests!==0||receipt.activeD1Transactions!==0||
       receipt.allBindingsInstrumented!==true||
       receipt.durableReadbackVerified!==true||
       receipt.commitBarrierVerified!==true||receipt.forceKillUsed!==false){
      invalidReceipts++;return {accepted:false,reason:"ISOLATE_DRAIN_D1_BARRIER_MISSING"};
    }
    received.set(receipt.isolateId,{sequence:receipt.sequence,issuedAt:receipt.issuedAt});
    return {accepted:true,scope:"declared-isolate-only",globalVerified:false};
  }
  function status() {
    const missing=expectedIsolates.filter(id=>!received.has(id));
    const stale=expectedIsolates.filter(id=>received.has(id)&&
      Math.abs(time()-received.get(id).issuedAt)>maxAgeMs);
    return {protocol:ISOLATE_DRAIN_PROTOCOL,serviceId,sourceSha,processPid,
      declaredIsolateCount:expectedIsolates.length,receivedCount:received.size,
      missingIsolates:missing,staleIsolates:stale,invalidReceipts,
      unknownIsolates,replays,declaredSetComplete:missing.length===0&&stale.length===0,
      authoritativeRuntimeIsolateInventory:false,allWorkerIsolatesDrained:false,
      processBoundGracefulExitObserved:false,windowsDescendantsGone:false,
      autoRestartAllowed:false,permitShutdown:false,ready:false};
  }
  return {record,status};
}
