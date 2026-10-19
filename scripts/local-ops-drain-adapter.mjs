// Adapter foundation for an app-owned shutdown channel. Importing the module
// does NOT instrument Vite/Wrangler or attest their D1. App owners must bind
// every mutating request and transaction and verify durable commit themselves.
export function createLocalDrainAdapter({ verifyDurable, onStopAccepting, onClose,
  identity, timeoutMs=15000 }={}) {
  if (typeof identity!=="string" || !identity.trim()) throw Error("DRAIN_IDENTITY_REQUIRED");
  let accepting=true, requests=0, transactions=0, drained=false;
  const wake=new Set();
  function notify() { for(const callback of wake)callback(); }
  function beginRequest() {
    if(!accepting) throw Error("DRAIN_NEW_REQUEST_REFUSED");
    requests++;
    let released=false;
    return ()=>{
      if(released)throw Error("DRAIN_DUPLICATE_RELEASE");
      released=true; requests--; notify();
    };
  }
  async function transaction(work) {
    if(!accepting)throw Error("DRAIN_NEW_TRANSACTION_REFUSED");
    if(typeof work!=="function")throw Error("DRAIN_TRANSACTION_INVALID");
    transactions++;
    try { return await work(); }
    finally { transactions--; notify(); }
  }
  async function waitIdle(ms) {
    if(requests===0&&transactions===0)return;
    await new Promise((resolve,reject)=>{
      let settled=false;
      const finish=(error)=>{if(settled)return;settled=true;clearTimeout(timer);wake.delete(check);error?reject(error):resolve();};
      const check=()=>{if(requests===0&&transactions===0)finish();};
      const timer=setTimeout(()=>finish(Error("DRAIN_IN_FLIGHT_TIMEOUT")),ms);
      wake.add(check);check();
    });
  }
  async function drain() {
    accepting=false;
    if(typeof onStopAccepting!=="function" || typeof onClose!=="function" ||
       typeof verifyDurable!=="function")
      throw Error("DRAIN_ADAPTER_NOT_WIRED_TO_RUNTIME_AND_D1");
    await onStopAccepting();
    await waitIdle(timeoutMs);
    const durable=await verifyDurable();
    if(durable!==true)throw Error("DRAIN_DURABILITY_UNVERIFIED");
    await onClose();
    drained=true;
    return { identity, drained:true, pendingRequests:0,pendingTransactions:0, exitObserved:false,
      // Actual child exit must be observed by parent, not self-asserted here.
      readyForExternalExitVerification:true };
  }
  return { beginRequest, transaction, drain,
    status:()=>({identity, accepting, requests, transactions, drained,
      actualRuntimeBound:typeof onStopAccepting==="function"&&typeof onClose==="function"&&typeof verifyDurable==="function"}) };
}
