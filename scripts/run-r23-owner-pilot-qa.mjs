// R2.3 owner pilot: explicit, isolated LOCAL-only identity. Never authorizes Production.
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";
const email = "r23-local-owner@example.test";
const port = 5191; // Different origin from the pre-existing 5188 credential.
const environment = {
  ...process.env,
  LOCAL_DEV_AUTH: "1",
  LOCAL_DEV_USER_ID: "r23-local-owner-qa",
  LOCAL_DEV_USER_EMAIL: email,
  LOCAL_DEV_USER_NAME: "R2.3 LOCAL QA OWNER (NOT PRODUCTION)",
  CONTROL_OWNER_EMAILS: email,
  APPLICATION_MANAGEMENT_ACCESS_MODE: "standalone",
  CONTROL_PLANE_NETWORK_MODE: "local",
  WRANGLER_SEND_METRICS: "false",
};

function block(message) {
  throw new Error("R2.3 LOCAL QA BLOCKED: " + message);
}

function command(name, args) {
  if (!isWindows) return { file: name, args };
  return {
    file: process.env.ComSpec || "cmd.exe",
    args: ["/d", "/s", "/c", name + ".cmd", ...args],
  };
}

function runSync(name, args) {
  const spec = command(name, args);
  const result = spawnSync(spec.file, spec.args, { cwd: root, env: environment, stdio: "inherit", shell: false });
  if (result.error || result.status !== 0) block(name + " exited non-zero: " + (result.error?.message ?? result.status));
}

function preflight() {
  for (const key of [
    "CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH",
    "CLOUDFLARE_API_TOKEN",
    "APPLICATION_MANAGEMENT_PRODUCTION_ORIGIN",
    "APPLICATION_MANAGEMENT_PRODUCTION_D1_DATABASE_ID",
    "APPLICATION_MANAGEMENT_PRODUCTION_READBACK_SECRET",
  ]) {
    if (process.env[key]) block("Production/remote configuration present: " + key);
  }
  if (["cloudflare-production", "cloudflare-preview"].includes(process.env.APPLICATION_MANAGEMENT_DEPLOYMENT_CHANNEL ?? "")) {
    block("Production/preview deployment channel is not allowed");
  }
  if (fs.existsSync(path.join(root, ".dev.vars"))) {
    block("Existing .dev.vars is present. Use a disposable checkout without developer/Production secrets.");
  }
  if (!fs.existsSync(path.join(root, "wrangler.local.jsonc"))) block("Missing local-only D1 configuration");
  const gitBranch = execFileSync("git", ["branch", "--show-current"], { cwd: root, encoding: "utf8" }).trim();
  const gitSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  if (gitBranch) block("Use a detached, isolated QA worktree; current branch: " + gitBranch);
  if (!/^[0-9a-f]{40}$/.test(gitSha)) block("Unable to pin exact QA commit");
  if (environment.LOCAL_DEV_USER_EMAIL !== environment.CONTROL_OWNER_EMAILS) block("QA Owner email mismatch");
  return gitSha;
}

try {
  const sha = preflight();
  console.log("[R2.3] LOCAL TEST FIXTURE ONLY, NOT PRODUCTION AUTHORIZATION");
  console.log("[R2.3] candidate SHA=" + sha);
  console.log("[R2.3] LOCAL_DEV_USER_EMAIL and CONTROL_OWNER_EMAILS match; new device can register as QA Owner in isolated local D1.");
  console.log("[R2.3] Pending/blocked tests still require separate independent non-owner fixtures.");
  console.log("[R2.3] Browser 5191 origin avoids reusing 5188 IndexedDB P-256 device credentials.");
  if (process.argv.includes("--check-only")) process.exit(0);
  runSync("npx", ["wrangler", "d1", "migrations", "apply", "learning-management-db", "--local", "--config", "wrangler.local.jsonc"]);
  const spec = command("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(port), "--strictPort"]);
  console.log("[R2.3] Bauman: http://127.0.0.1:" + port + "/apps/bauman-master-ai");
  console.log("[R2.3] PriceReport: http://127.0.0.1:" + port + "/apps/price-report-tunggiabao");
  const server = spawn(spec.file, spec.args, { cwd: root, env: environment, stdio: "inherit", shell: false });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));
  server.once("error", (error) => block("Vite launch failed: " + error.message));
  server.once("exit", (code) => { process.exitCode = code || 0; });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
