// Fail-closed managed spawn resolver: avoid cmd.exe/npx.cmd process trees when
// a LOCAL_OPS supervisor owns the runtime. Never npm install during bootstrap.
import { existsSync, realpathSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";

const BINS = Object.freeze({
  vite: ["vite", "bin", "vite.js"],
  wrangler: ["wrangler", "bin", "wrangler.js"],
});
export function managedRuntimePlan({command, args, cwd, managed = false,
  platform = process.platform, node = process.execPath} = {}) {
  if (!managed) return { mode: "legacy-manual", command, args, verifiedDirectChild: false };
  if (!Array.isArray(args) || !cwd || typeof command !== "string")
    throw Error("MANAGED_RUNTIME_PLAN_INVALID");
  const tool = args[0];
  if (!/^(?:npx(?:\.cmd)?|npm(?:\.cmd)?)$/i.test(command))
    return { mode: "direct", command, args, verifiedDirectChild: false };
  // A managed npm/npx wrapper can own a different PID than its service,
  // especially Windows cmd.exe -> npm -> Node. Reject unknown wrappers.
  if (!Object.hasOwn(BINS, tool))
    return { mode: "wrapper-unverified", command, args,
      verifiedDirectChild: false, blocker: "MANAGED_WRAPPER_UNSUPPORTED: " + tool };
  const dir = realpathSync(resolve(cwd));
  const bin = resolve(dir, "node_modules", ...BINS[tool]);
  if (!existsSync(bin)) throw Error("MANAGED_LOCAL_BIN_MISSING: " + tool);
  const actual = realpathSync(bin);
  const localNodeModules = resolve(dir, "node_modules");
  const suffix = relative(localNodeModules, actual);
  if (suffix.startsWith("..") || isAbsolute(suffix))
    throw Error("MANAGED_BIN_OUTSIDE_WORKSPACE: " + tool);
  return { mode: "local-bin-direct", command: node,
    args: [actual, ...args.slice(1)], verifiedDirectChild: true,
    tool, platform, originalWrapper: command };
}
export function childOwnershipEvidence(plan, child) {
  return { directChild: plan?.verifiedDirectChild === true &&
    Number.isSafeInteger(child?.pid) && child.pid > 0,
    mode: plan?.mode ?? "unknown", pid: Number.isSafeInteger(child?.pid) ? child.pid : null,
    // Direct PID proof still does not attest D1 flush or descendants.
    drainedD1: false, verifiedGrandchildrenExited: false };
}
