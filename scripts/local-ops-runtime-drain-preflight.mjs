// Opt-in localhost adapter verifier. NEVER sends a stop command: inspecting a
// service's fixture response cannot itself authorize production D1 shutdown.
export const RUNTIME_DRAIN_PROTOCOL="local-ops-runtime-drain/v1";
const SHA=/^[0-9a-f]{40}$/i;
export function validateRuntimeDrainEvidence(expected, payload) {
  if (!expected || !payload || !SHA.test(expected.sourceSha||"") ||
      !Number.isSafeInteger(expected.pid) || expected.pid<=0 ||
      !/^[a-z0-9-]+$/i.test(expected.id||"") ||
      !/^[A-Za-z0-9_-]{20,}$/i.test(expected.nonce||""))
    return {verified:false,reason:"RUNTIME_EXPECTATION_INVALID"};
  if (payload.protocol!==RUNTIME_DRAIN_PROTOCOL ||
      payload.id!==expected.id ||
      payload.bootNonce!==expected.nonce ||
      payload.sourceSha!==expected.sourceSha ||
      payload.processPid!==expected.pid ||
      payload.ownershipVerified!==true)
    return {verified:false,reason:"RUNTIME_PROCESS_IDENTITY_MISMATCH"};
  if (!payload.requests || payload.requests.acceptingNew!==false ||
      payload.requests.activeCount!==0 || payload.requests.instrumentedAll!==true)
    return {verified:false,reason:"REQUEST_DRAIN_ACK_MISSING"};
  if (!payload.d1 || payload.d1.acceptingWrites!==false ||
      payload.d1.activeTransactions!==0 ||
      payload.d1.commitBarrierVerified!==true ||
      payload.d1.storageReadbackVerified!==true ||
      payload.d1.instrumentedAllBindings!==true)
    return {verified:false,reason:"D1_DRAIN_OR_PERSISTENCE_UNVERIFIED"};
  if (payload.gracefulExit?.supported!==true || payload.gracefulExit?.forcedKill===true)
    return {verified:false,reason:"GRACEFUL_EXIT_ACK_MISSING"};
  // Still not proof of child exit: supervisor must separately capture process
  // termination, absence of surviving descendants and closed TCP listeners.
  return {verified:true,reason:"PRE_STOP_EVIDENCE_ONLY",exitObserved:false,
    fullStackReady:false,autoRestartAllowed:false};
}
export async function probeRuntimeDrain({
  id,port,sourceSha,pid,nonce,token,fetchImpl=fetch,timeoutMs=1500
}={}) {
  if (!Number.isInteger(port)||port<1024||port>65535 ||
      typeof token!=="string"||token.length<24)
    return {verified:false,reason:"LOCAL_RUNTIME_CREDENTIAL_OR_PORT_INVALID"};
  const expected={id,sourceSha,pid,nonce};
  // Prevent SSRF: URL is constructed from numeric loopback port only. No caller host.
  const url="http://127.0.0.1:"+port+"/_local/ops/drain-preflight";
  try {
    const response=await fetchImpl(url,{method:"POST",redirect:"manual",cache:"no-store",
      headers:{"authorization":"Bearer "+token,"content-type":"application/json"},
      body:JSON.stringify({protocol:RUNTIME_DRAIN_PROTOCOL,id,bootNonce:nonce,sourceSha}),
      signal:AbortSignal.timeout(timeoutMs)});
    if (response.status!==200 || !(response.headers.get("content-type")||"").includes("application/json"))
      return {verified:false,reason:"LOCAL_RUNTIME_DRAIN_ENDPOINT_NOT_READY"};
    return validateRuntimeDrainEvidence(expected,await response.json());
  } catch {
    return {verified:false,reason:"LOCAL_RUNTIME_DRAIN_PROBE_FAILED"};
  }
}
