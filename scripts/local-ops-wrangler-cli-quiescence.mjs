// Blueprint OS 1.3.0 — real Wrangler CLI shutdown evidence gate, Draft only.
// This module validates observations; it NEVER signals/kills a runtime or
// grants Windows/full-stack restart permission. Caller flags are not runtime attestations.
const SHA=/^[0-9a-f]{40}$/;
const NONCE=/^[A-Za-z0-9_-]{24,}$/;
const ID=/^[a-zA-Z0-9-]{1,80}$/;
const pid=p=>Number.isSafeInteger(p)&&p>0;
const port=p=>Number.isInteger(p)&&p>=1024&&p<=65535;
export const WRANGLER_CLI_QUIESCENCE_PROTOCOL='local-ops-wrangler-cli-quiescence/v1';

export function createWranglerCliQuiescenceGate({
  serviceId,sourceSha,bootNonce,supervisorPid,wranglerPid,
  gatewayPort,backendPort,expectedD1Bindings
}={}) {
  if(!ID.test(serviceId??'')||!SHA.test(sourceSha??'')||
     !NONCE.test(bootNonce??'')||!pid(supervisorPid)||!pid(wranglerPid)||
     supervisorPid===wranglerPid||!port(gatewayPort)||!port(backendPort)||
     gatewayPort===backendPort||!Array.isArray(expectedD1Bindings)||
     !expectedD1Bindings.length||expectedD1Bindings.some(b=>!ID.test(b))||
     new Set(expectedD1Bindings).size!==expectedD1Bindings.length)
    throw Error('WRANGLER_CLI_EXPECTATION_INVALID');
  const bindings=Object.freeze([...expectedD1Bindings]);
  let ingress=null,worker=null,storage=null,exit=null,tainted=false;
  const originMatches=r=>r?.protocol===WRANGLER_CLI_QUIESCENCE_PROTOCOL&&
    r.serviceId===serviceId&&r.sourceSha===sourceSha&&
    r.bootNonce===bootNonce&&r.supervisorPid===supervisorPid&&
    r.wranglerPid===wranglerPid;
  function ingest(type,receipt) {
    if(!originMatches(receipt)) {
      tainted=true;
      return {accepted:false,reason:'WRANGLER_CLI_NONCE_PID_SHA_MISMATCH'};
    }
    if(type==='ingress') {
      if(ingress)return {accepted:false,reason:'INGRESS_RECEIPT_REPLAY'};
      ingress=Object.freeze({closed:receipt.closed===true,pending:receipt.pending,
        uncertain:receipt.uncertain===true,bypassUnexcluded:receipt.bypassUnexcluded!==false});
    } else if(type==='worker') {
      if(worker)return {accepted:false,reason:'WORKER_RECEIPT_REPLAY'};
      worker=Object.freeze({activeD1:receipt.activeD1,
        backgroundD1:receipt.backgroundD1,
        waitUntilInstrumented:receipt.waitUntilInstrumented===true,
        allBindingsInstrumented:receipt.allBindingsInstrumented===true,
        unknownAsyncWork:receipt.unknownAsyncWork!==false,
        runtimeIsolateCensusVerified:receipt.runtimeIsolateCensusVerified===true});
    } else if(type==='storage') {
      if(storage)return {accepted:false,reason:'D1_RECEIPT_REPLAY'};
      storage=Object.freeze({
        independentCliReadback:receipt.independentCliReadback===true,
        commitBarrierVerified:receipt.commitBarrierVerified===true,
        bindings:Array.isArray(receipt.bindings)?Object.freeze([...receipt.bindings]):null,
        verifiedSha:receipt.verifiedSha===sourceSha
      });
    } else if(type==='exit') {
      if(exit)return {accepted:false,reason:'EXIT_RECEIPT_REPLAY'};
      exit=Object.freeze({
        cliExited:receipt.cliExited===true,exitCode:receipt.exitCode,
        forcedTermination:receipt.forcedTermination!==false,
        cliNativeGracefulAck:receipt.cliNativeGracefulAck===true,
        descendantsGone:receipt.descendantsGone===true,
        gatewayPortReleased:receipt.gatewayPortReleased===true,
        backendPortReleased:receipt.backendPortReleased===true,
        platform:receipt.platform
      });
    } else return {accepted:false,reason:'UNKNOWN_RECEIPT_TYPE'};
    return {accepted:true,scope:'structural-source-bound-observation',
      authenticatedRuntimeEvidence:false,permitShutdown:false};
  }
  function status() {
    const missing=[];
    if(tainted)missing.push('RECEIPT_IDENTITY_TAINTED');
    if(!ingress?.closed||ingress.pending!==0||ingress.uncertain)
      missing.push('LOCAL_INGRESS_DRAIN_UNVERIFIED');
    if(!ingress||ingress.bypassUnexcluded)
      missing.push('DIRECT_BACKEND_BYPASS_UNEXCLUDED');
    if(!worker||worker.activeD1!==0||worker.backgroundD1!==0||
       !worker.waitUntilInstrumented||!worker.allBindingsInstrumented||worker.unknownAsyncWork)
      missing.push('INFLIGHT_OR_BACKGROUND_D1_UNVERIFIED');
    if(!worker?.runtimeIsolateCensusVerified)
      missing.push('ALL_ISOLATES_UNVERIFIED');
    if(!storage?.independentCliReadback||!storage.commitBarrierVerified||
       !storage.verifiedSha||!storage.bindings||
       storage.bindings.length!==bindings.length||
       bindings.some(b=>!storage.bindings.includes(b)))
      missing.push('D1_INDEPENDENT_DURABILITY_UNVERIFIED');
    if(!exit?.cliExited||exit.exitCode!==0||exit.forcedTermination||
       !exit.cliNativeGracefulAck)
      missing.push('WRANGLER_CLI_NATIVE_GRACEFUL_ACK_UNVERIFIED');
    if(!exit?.descendantsGone||!exit.gatewayPortReleased||
       !exit.backendPortReleased||exit.platform!=='win32')
      missing.push('WINDOWS_PID_TREE_AND_PORTS_UNVERIFIED');
    // Hard safety boundary: reported flags are NOT independent provider evidence.
    // Even a syntactically perfect green receipt never unlocks stop or restart.
    missing.push('AUTHORITATIVE_RUNTIME_BARRIER_NOT_IMPLEMENTED');
    return Object.freeze({protocol:WRANGLER_CLI_QUIESCENCE_PROTOCOL,
      serviceId,sourceSha,wranglerPid,supervisorPid,
      receiptIntegrity:'STRUCTURAL_ONLY_NOT_AUTHENTICATED',
      observedIngressClosed:ingress?.closed===true&&ingress.pending===0&&!ingress.uncertain,
      observedD1Idle:worker?.activeD1===0&&worker.backgroundD1===0,
      observedIndependentReadback:storage?.independentCliReadback===true,
      observedWindowsExit:exit?.cliExited===true&&exit.descendantsGone===true,
      missingEvidence:missing,runtimeGlobalQuiescenceVerified:false,
      gracefulCliShutdownVerified:false,stopAuthorized:false,
      autoRestartAllowed:false,productionApproved:false,ready:false});
  }
  return Object.freeze({ingest,status});
}
