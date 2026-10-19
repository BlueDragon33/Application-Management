// Read-only Windows descendant evidence. A captured PID is NOT a D1 drain ACK.
// Never terminate a PID. Unknown/missing process observations fail closed.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execute = promisify(execFile);
const validPid = value => Number.isSafeInteger(value) && value > 0;
export function treeDescendants(root, records) {
  if (!validPid(root) || !Array.isArray(records)) throw Error("PROCESS_TREE_INPUT_INVALID");
  const processes = new Map();
  for (const r of records) {
    const pid = Number(r.ProcessId ?? r.pid);
    const ppid = Number(r.ParentProcessId ?? r.ppid);
    if (pid === 0) continue; // Windows System Idle Process is a valid OS entry, not a managed child.
    if (!validPid(pid) || !Number.isSafeInteger(ppid) || ppid < 0 || processes.has(pid))
      throw Error("PROCESS_TREE_RECORD_INVALID");
    processes.set(pid, ppid);
  }
  if (!processes.has(root)) throw Error("MANAGED_ROOT_PID_NOT_RUNNING");
  const owned = new Set([root]);
  for (let remaining = processes.size; remaining > 0; remaining--) {
    let changed = false;
    for (const [pid, ppid] of processes) {
      if (!owned.has(pid) && owned.has(ppid)) { owned.add(pid); changed = true; }
    }
    if (!changed) break;
  }
  return [...owned].sort((a,b)=>a-b);
}
export function verifyGone(snapshot, rows) {
  if (!Array.isArray(snapshot) || snapshot.length === 0 || !Array.isArray(rows))
    throw Error("PROCESS_SNAPSHOT_MISSING");
  const alive = new Set(rows.map(x=>Number(x.ProcessId ?? x.pid)));
  const present = snapshot.filter(pid => alive.has(pid));
  return { stopped:present.length===0, survivingPids:present };
}
export async function listWindowsProcesses(exec=execute) {
  if (process.platform!=="win32") throw Error("WINDOWS_PROCESS_TABLE_ONLY");
  // Fixed command, no attacker-controlled input and no shell interpolation.
  const {stdout} = await exec("powershell.exe",
    ["-NoProfile","-NonInteractive","-Command",
      "$ErrorActionPreference='Stop'; Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId | ConvertTo-Json -Compress"],
    {timeout:15000,windowsHide:true,maxBuffer:2*1024*1024,env:{...process.env,POWERSHELL_TELEMETRY_OPTOUT:"1"}});
  const result=JSON.parse(stdout);
  if (!result) throw Error("PROCESS_TABLE_EMPTY");
  return Array.isArray(result)?result:[result];
}
export async function captureWindowsTree(root, table=listWindowsProcesses) {
  const rows=await table();
  const pids=treeDescendants(root,rows);
  return {root,pids,platform:"win32",verified:true};
}
export async function verifyWindowsTreeGone(snapshot,table=listWindowsProcesses) {
  if (!snapshot?.verified || snapshot.platform!=="win32" || !validPid(snapshot.root))
    throw Error("UNVERIFIED_PROCESS_TREE_SNAPSHOT");
  return verifyGone(snapshot.pids,await table());
}
