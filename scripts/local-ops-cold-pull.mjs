// Explicit cold-time updater. Run only after all BaumanWeb runtimes have
// already stopped naturally; never request shutdown, elevate, or force kill.
import { portOccupied, gitRepositories, pullRepository } from "./local-ops-daemon.mjs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspace = resolve(root, "..");
const trackedPorts = Array.from({length:12},(_,i)=>3000+i);
export async function coldPullPreflight(checkPort = portOccupied){
  if(basename(workspace).toLowerCase()!=="baumanweb")return {ok:false,reason:"COLD_PULL_CANONICAL_WORKSPACE_REQUIRED"};
  const occupied = (await Promise.all(trackedPorts.map(async port=>await checkPort(port)?port:null))).filter(x=>x!==null);
  return occupied.length ? {ok:false,reason:"COLD_PULL_RUNTIME_STILL_ACTIVE",ports:occupied} : {ok:true,ports:[]};
}
export async function coldPullAll({ preflight = coldPullPreflight,
  discover=()=>gitRepositories(), update=pullRepository }={}) {
  const first=await preflight();
  if(!first.ok)return {status:"BLOCKED",reason:first.reason,ports:first.ports||[],results:[]};
  const results=[];
  const dirs=discover();
  for(const dir of dirs){
    // Recheck ports before EACH ff-only merge so an operator cannot launch the
    // manager while a long origin fetch is still in progress. This remains
    // best effort, not an atomic cross-process barrier.
    const gate=await preflight();
    if(!gate.ok)return {status:"BLOCKED",reason:gate.reason,ports:gate.ports||[],results};
    results.push(await update(dir));
  }
  return {status:results.some(x=>x.state==="error"||x.state==="skipped")?"PARTIAL":"FINISHED",results};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const report=await coldPullAll();
  console.log(JSON.stringify({protocol:"BAUMANWEB_COLD_PULL_MAIN_V1",...report},null,2));
  if(report.status!=="FINISHED")process.exitCode=2;
}
