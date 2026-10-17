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
export function sourceTargets(apps) {
  return [{ id: "application-management", directory: "Application-Management" },
    ...apps.filter(a => Number.isInteger(a.port)).map(a => ({ id: a.id, directory: a.directory }))];
}
export async function readSourceSnapshot(workspace, apps, runner = realGit) {
  const root = realpathSync(workspace);
  const targets = sourceTargets(apps);
  if (new Set(targets.map(a => a.id)).size !== targets.length) throw Error("SOURCE_DUPLICATE_APP_ID");
  const pairs = await Promise.all(targets.map(async ({ id, directory }) => {
    const target = realpathSync(resolve(root, directory));
    if (target === root || !target.startsWith(root + sep)) throw Error("SOURCE_OUTSIDE_BAUMANWEB: " + id);
    const top = realpathSync(resolve(await runner(target, ["rev-parse", "--show-toplevel"])));
    if (top !== target) throw Error("SOURCE_WRONG_GIT_ROOT: " + id);
    const branch = await runner(target, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
    if (branch !== "main") throw Error("SOURCE_NOT_MAIN: " + id);
    const sha = await runner(target, ["rev-parse", "HEAD"]);
    if (!SHA.test(sha)) throw Error("SOURCE_INVALID_SHA: " + id);
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
