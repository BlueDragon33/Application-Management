// Read-only inventory: no repo mutation, process signal, D1 write, or release action.
import { readFileSync, existsSync, realpathSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve, join, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { REQUIRED_SHUTDOWN_UNITS } from "./local-ops-shutdown-contract.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(ROOT, "control/local-ops-shutdown-evidence.json");
const SHA = /^[0-9a-f]{40}$/i;
export function validateEvidence(input) {
  if (input?.schemaVersion !== 1 || input?.publicationAuthority !== false ||
      input.fullStackAutoRestartReady !== false || !Array.isArray(input.units) ||
      input.units.length !== REQUIRED_SHUTDOWN_UNITS.length) throw Error("SHUTDOWN_MATRIX_SCHEMA_INVALID");
  const expected = new Set(REQUIRED_SHUTDOWN_UNITS);
  for (const row of input.units) {
    if (!expected.delete(row.id)) throw Error("SHUTDOWN_MATRIX_MISSING_OR_DUPLICATE: " + row.id);
    if (!/^BlueDragon33\/[A-Za-z0-9_.-]+$/.test(row.repository) ||
        !SHA.test(row.sourceBlobSha) || !SHA.test(row.repoMainAtAudit) ||
        row.sourcePath.startsWith("/") || row.sourcePath.includes("..") ||
        row.workspaceDirectory.startsWith("/") || row.workspaceDirectory.includes(".."))
      throw Error("SHUTDOWN_MATRIX_SOURCE_INVALID: " + row.id);
    if (!["BLOCKED","CANDIDATE_ONLY"].includes(row.assessment) ||
        row.actualDrainAttested !== false || row.actualExitAttested !== false ||
        row.autoRestartApproved !== false ||
        !row.d1DrainEvidence || !row.ipcOrHttpShutdownEvidence ||
        !row.exitEvidence || !row.windowsEvidence)
      throw Error("SHUTDOWN_MATRIX_FAKE_APPROVAL: " + row.id);
  }
  if (expected.size) throw Error("SHUTDOWN_MATRIX_MISSING_UNITS: " + [...expected].join(","));
  return true;
}
export function loadEvidence() {
  const input = JSON.parse(readFileSync(FILE,"utf8"));
  validateEvidence(input);
  return input;
}
export function summary(input) {
  validateEvidence(input);
  return { schemaVersion: input.schemaVersion, total: input.units.length,
    blocked: input.units.filter(x=>x.assessment==="BLOCKED").length,
    candidateOnly: input.units.filter(x=>x.assessment==="CANDIDATE_ONLY").length,
    trulyReady: 0, fullStackAutoRestartReady: false,
    warning: "Candidate is NOT approval; no production child drain/exit attestation" };
}
function inspected(workspace, unit) {
  const directory = resolve(workspace, unit.workspaceDirectory);
  const file = resolve(directory, unit.sourcePath);
  if (relative(workspace, file).startsWith("..") || isAbsolute(relative(workspace, file)))
    return { id: unit.id, state: "INVALID_PATH", ready: false };
  if (!existsSync(file)) return { id: unit.id, state: "SOURCE_NOT_PRESENT", ready: false };
  // Reject a symlinked repo or source file escaping the physical workspace.
  try {
    const physicalRoot = realpathSync(workspace);
    const physicalDir = realpathSync(directory);
    const physicalFile = realpathSync(file);
    if (!physicalDir.startsWith(physicalRoot + (process.platform === "win32" ? "\\\\" : "/")) ||
        !physicalFile.startsWith(physicalDir + (process.platform === "win32" ? "\\\\" : "/")))
      return { id:unit.id, state:"SYMLINK_ESCAPE_DENIED", ready:false };
  } catch { return { id:unit.id, state:"REALPATH_UNVERIFIED", ready:false }; }
  let head = null, clean = false;
  try {
    head = execFileSync("git", ["rev-parse","HEAD"], { cwd: directory,
      windowsHide: true, timeout: 5000, encoding:"utf8", env:{...process.env,GIT_OPTIONAL_LOCKS:"0",GIT_TERMINAL_PROMPT:"0"} }).trim();
    clean = !execFileSync("git", ["status","--porcelain","--untracked-files=no"], {
      cwd: directory, windowsHide: true, timeout: 5000, encoding:"utf8", env:{...process.env,GIT_OPTIONAL_LOCKS:"0",GIT_TERMINAL_PROMPT:"0"} }).trim();
  } catch { return { id: unit.id, state:"GIT_READBACK_UNAVAILABLE", ready:false }; }
  return { id: unit.id, state: head===unit.repoMainAtAudit && clean ?
    "SOURCE_PRESENT_AT_AUDIT_SHA_BUT_DRAIN_UNPROVEN":"SOURCE_SHA_OR_TREE_DIFFERS",
    sourceHead: head, trackedClean:clean, ready:false };
}
if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const data = loadEvidence();
  const rootArg = process.argv.indexOf("--workspace");
  const workspace = rootArg>=0 ? resolve(process.argv[rootArg+1]||"") : null;
  const result = { ...summary(data),
    kind: workspace ? "read-only-local-source-check" : "matrix-only",
    units: data.units.map(row=>workspace ? inspected(workspace,row) : {
      id:row.id,repository:row.repository,assessment:row.assessment,ready:false
    }) };
  console.log(JSON.stringify(result,null,2));
}
