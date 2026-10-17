// Blueprint OS 1.3.0: never start a managed D1 worker with secrets in
// argv, or with unreviewed child source. Fail BEFORE D1 migration/spawning.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const SOURCE_WORKERS = Object.freeze([
  { id:"BAUMAN-CONTROL", relative:"Bauman-master-ai-system/control-service/src/automation-contract.ts" },
  { id:"PRICE-CONTROL", relative:"PriceReport_Tunggiabao/control-service/src/index.ts" },
]);
const GUARD_MARKERS = [
  'verifyManagedIngress(request, incomingEnv',
  'localD1Observer.blockedPreflight()',
];
export function inspectManagedWorkerSource(appsRoot,workerId) {
  const definition=SOURCE_WORKERS.find(x=>x.id===workerId);
  if(!definition)throw Error("MANAGED_WORKER_ID_UNKNOWN");
  const path=join(resolve(appsRoot),...definition.relative.split("/"));
  let source="";
  try { source=readFileSync(path,"utf8"); } catch {
    return {id:workerId,sourceGuardPresent:false,reason:"WORKER_SOURCE_NOT_INSTALLED"};
  }
  const guarded=GUARD_MARKERS.every(marker=>source.includes(marker));
  return {id:workerId,sourceGuardPresent:guarded,
    reason:guarded?"DRAFT_SOURCE_GUARD_PRESENT_ONLY":"WORKER_SOURCE_MISSING_MANAGED_GUARD"};
}
export function assertNoManagedArgvSecrets({ managed, args=[], command="" }={}) {
  if(!managed)return {legacy:true,secureManaged:false};
  if(!Array.isArray(args))throw Error("MANAGED_ARGV_INVALID");
  // No --var at all in managed mode: even non-secret values can be used to
  // mask future secret regressions. No --yes npm/npx download either.
  if(args.some((arg,i)=>arg==="--var" || String(arg).startsWith("--var=") ||
       arg==="--yes" || /_SECRET[:=]/i.test(String(arg)) ||
       (i>0 && args[i-1]==="--var")))
    throw Error("MANAGED_ARGV_SECRET_OR_WRAPPER_BLOCKED");
  if(/npx(?:\.cmd)?$/i.test(String(command)))
    throw Error("MANAGED_NPX_WRAPPER_BLOCKED");
  return {legacy:false,secureManaged:true};
}
export function assertManagedControlAdmission({managed,appsRoot,authority=null}={}) {
  if(!managed)return {mode:"legacy-manual",allowed:true};
  if(typeof appsRoot!=="string"||!appsRoot.trim())throw Error("MANAGED_WORKSPACE_INVALID");
  const inspected=SOURCE_WORKERS.map(s=>inspectManagedWorkerSource(appsRoot,s.id));
  if(inspected.some(x=>!x.sourceGuardPresent))
    throw Error("MANAGED_CONTROL_SOURCE_GUARD_MISSING: "+
      inspected.filter(x=>!x.sourceGuardPresent).map(x=>x.id).join(","));
  // The source files are NOT the release authority. Until external Blueprint
  // review, exact SHA readback, and child process/port acceptance are wired,
  // even a valid guarded checkout cannot authorize automatic startup.
  // A caller-provided boolean, JSON receipt or pre-filled permission is NOT
  // authenticated authority. Reject it explicitly, even if every flag is true.
  // Independent Git audit is available separately and is always non-authorizing.
  if(authority !== null)throw Error("MANAGED_CALLER_SUPPLIED_AUTHORITY_REJECTED");
  throw Error("MANAGED_CONTROL_REVIEW_AND_SHA_BLOCKED");
}
