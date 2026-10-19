// Process-bound Git source identity. This is NOT an attestation by individual app HTTP runtimes.
import { execFile } from "node:child_process";
import { realpathSync } from "node:fs";
import { resolve, sep } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const SHA = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i;

async function realGit(dir, args) {
  const result = await run("git", args, { cwd: dir, windowsHide: true, timeout: 8000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never" } });
  return result.stdout.trim();
}
const MATH_QA = Object.freeze({ id:"math-bauman", directory:"_qa/Math_Bauman_PR72",
  sha:"2d96583f034ff3c61456d52a0ef550d2c371d248" });
export function sourceTargets(apps) {
  return [{ id: "application-management", directory: "Application-Management" },
    // Candidate QA is an independent frontend, never a required managed-stack unit.
    // Global stacks retain their existing source-gate scope when QA worktree is absent.
    ...apps.filter(a => Number.isInteger(a.port) &&
      (a.id!=="math-bauman" || apps.length===1)).map(a => {
      if(a.id!=="math-bauman")return {id:a.id,directory:a.directory};
      // Exception is restricted to this single exact-SHA detached QA worktree.
      // Never weaken main-branch admission for other clients or Manager itself.
      if(a.directory!=="Math_Bauman" || a.qaWorktree!==MATH_QA.directory ||
         a.qaSha!==MATH_QA.sha || a.port!==3022)
        throw Error("MATH_QA_SOURCE_CONTRACT_MISMATCH");
      return {id:MATH_QA.id,directory:MATH_QA.directory,qaSha:MATH_QA.sha};
    })];
}
export async function readSourceSnapshot(workspace, apps, runner = realGit) {
  const root = realpathSync(workspace);
  const targets = sourceTargets(apps);
  if (new Set(targets.map(a => a.id)).size !== targets.length) throw Error("SOURCE_DUPLICATE_APP_ID");
  const pairs = await Promise.all(targets.map(async ({ id, directory, qaSha }) => {
    const target = realpathSync(resolve(root, directory));
    if (target === root || !target.startsWith(root + sep)) throw Error("SOURCE_OUTSIDE_BAUMANWEB: " + id);
    // Git for Windows may print a short/aliased DOS root while Node realpath
    // reports a long path. Git's own --show-prefix is empty only at the worktree
    // root, avoiding a false negative without relaxing the workspace boundary.
    const prefix = await runner(target, ["rev-parse", "--show-prefix"]);
    if (prefix !== "") throw Error("SOURCE_WRONG_GIT_ROOT: " + id);
    if(qaSha) {
      const branch=await runner(target,["rev-parse","--abbrev-ref","HEAD"]);
      if(branch!=="HEAD")throw Error("MATH_QA_MUST_BE_DETACHED: "+id);
    }else{
      const branch=await runner(target,["symbolic-ref","--quiet","--short","HEAD"]);
      if(branch!=="main")throw Error("SOURCE_NOT_MAIN: "+id);
    }
    // HEAD alone is not the executable source identity when tracked files
    // differ from that commit. Ignore untracked build/output artifacts only.
    const dirty = await runner(target, ["status", "--porcelain", "--untracked-files=no"]);
    if (dirty) throw Error("SOURCE_TRACKED_WORKTREE_DIRTY: " + id);
    const sha = await runner(target, ["rev-parse", "HEAD"]);
    if (!SHA.test(sha)) throw Error("SOURCE_INVALID_SHA: " + id);
    if(qaSha && sha.toLowerCase()!==qaSha)throw Error("MATH_QA_EXACT_SHA_MISMATCH: "+id);
    return [id, sha.toLowerCase()];
  }));
  return Object.fromEntries(pairs);
}
export function exactSourceMatch(expected, actual) {
  const left = Object.keys(expected || {}).sort();
  const right = Object.keys(actual || {}).sort();
  return left.length > 0 && left.length === right.length &&
    left.every((id, i) => id === right[i] && SHA.test(expected[id]) &&
      expected[id].toLowerCase() === actual[id]?.toLowerCase());
}
