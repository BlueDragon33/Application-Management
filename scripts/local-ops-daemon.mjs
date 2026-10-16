// Local-only Windows companion for the Application Management UI.
// NO arbitrary command API, NO LAN listener, NO production bridge or authentication bypass.
import { randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { spawn } from "node:child_process";
import { createReadStream, createWriteStream, existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { createServer } from "node:http";
import { basename, dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const exec = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WORKSPACE = resolve(ROOT, "..");
const MANIFEST = JSON.parse(readFileSync(join(ROOT, "control", "local-ops-apps.json"), "utf8"));
const PORT = MANIFEST.agentPort;
const TOKEN = randomBytes(32).toString("base64url");
const ORIGINS = new Set(["http://127.0.0.1:3000", "http://localhost:3000"]);
const AVOID = new Set(["node_modules", ".git", ".next", ".wrangler", ".cache", "dist", "build", "coverage"]);
const state = { busy: "", pull: null, runtime: "stopped", runtimePid: null, lastError: "" };
let runtimeChild = null;

function permittedOrigin(req) {
  const origin = req.headers.origin || "";
  const host = req.headers.host || "";
  return ORIGINS.has(origin) && (host === "127.0.0.1:" + PORT || host === "localhost:" + PORT);
}
function reply(res, status, data, origin = "") {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "access-control-allow-origin": origin,
    "vary": "Origin",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "Authorization, Content-Type",
  });
  res.end(JSON.stringify(data));
}
function validToken(req) {
  const header = req.headers.authorization || "";
  return header === "Bearer " + TOKEN;
}
async function git(cwd, args, timeout = 120000) {
  const { stdout } = await exec("git", args, {
    cwd, timeout, maxBuffer: 1048576, windowsHide: true,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never" },
  });
  return stdout.trim();
}
function gitRepositories(root = WORKSPACE, depth = 0) {
  const found = [];
  if (depth > 2) return found;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || AVOID.has(entry.name) || entry.name.startsWith(".")) continue;
    const full = join(root, entry.name);
    if (lstatSync(full).isSymbolicLink()) continue;
    if (existsSync(join(full, ".git"))) {
      found.push(full);
    } else if (depth < 1) {
      found.push(...gitRepositories(full, depth + 1));
    }
  }
  return found.sort((a,b) => a.localeCompare(b));
}
export async function pullRepository(dir, runner = git) {
  const name = dir.slice(WORKSPACE.length + 1);
  try {
    const branch = await runner(dir, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
    if (branch !== "main") return { name, state: "skipped", reason: "Không ở nhánh main (" + branch + ")" };
    if (await runner(dir, ["status", "--porcelain"])) return { name, state: "skipped", reason: "Có thay đổi chưa commit" };
    const before = await runner(dir, ["rev-parse", "HEAD"]);
    await runner(dir, ["fetch", "--no-tags", "origin", "main"]);
    const remote = await runner(dir, ["rev-parse", "FETCH_HEAD"]);
    if (before === remote) return { name, state: "current", sha: before.slice(0, 12) };
    // Only remote descendants of local HEAD can replace it. No reset, force or rebase.
    try {
      await runner(dir, ["merge-base", "--is-ancestor", before, remote]);
    } catch {
      return { name, state: "skipped", reason: "Local có commit riêng hoặc phân nhánh; cần xử lý thủ công" };
    }
    await runner(dir, ["merge", "--ff-only", remote]);
    const after = await runner(dir, ["rev-parse", "HEAD"]);
    return { name, state: "updated", from: before.slice(0, 12), sha: after.slice(0, 12) };
  } catch (error) {
    return { name, state: "error", reason: error instanceof Error ? error.message.slice(0, 280) : "Git failed" };
  }
}
async function pullAll() {
  state.busy = "pull-all";
  state.pull = { status: "running", startedAt: new Date().toISOString(), results: [] };
  try {
    const dirs = gitRepositories();
    for (const dir of dirs) {
      const result = await pullRepository(dir);
      state.pull.results.push(result);
    }
    state.pull.status = "finished";
  } catch (error) {
    state.pull.status = "error";
    state.pull.error = String(error).slice(0, 300);
  } finally {
    state.pull.finishedAt = new Date().toISOString();
    state.busy = "";
  }
}
async function probe(port, path = "/") {
  try {
    const response = await fetch("http://127.0.0.1:" + port + path, { signal: AbortSignal.timeout(900), cache: "no-store" });
    return response.status >= 200 && response.status < 400;
  } catch { return false; }
}
async function status() {
  const apps = await Promise.all(MANIFEST.apps.map(async app => ({
    id: app.id,
    url: app.port ? "http://127.0.0.1:" + app.port + (app.path || "/") : null,
    port: app.port,
    ready: app.port ? await probe(app.port, app.path || "/") : false,
    note: app.note || null,
  })));
  return { ok: true, workspace: basename(WORKSPACE), agent: "localhost", busy: state.busy, runtime: state.runtime,
    runtimePid: state.runtimePid, error: state.lastError || null, pull: state.pull, apps };
}
function startAll() {
  if (state.runtime === "starting" || state.runtime === "running") return state.runtime;
  const log = createWriteStream(join(ROOT, ".local-ops-runtime.log"), { flags: "a", mode: 0o600 });
  state.runtime = "starting";
  state.lastError = "";
  try {
    const child = spawn(process.execPath, [join(ROOT, "scripts", "run-all.mjs"), "--local", "--no-browser"], {
      cwd: ROOT, detached: true, windowsHide: true, shell: false,
      stdio: ["ignore", log, log], env: process.env,
    });
    runtimeChild = child;
    state.runtimePid = child.pid || null;
    child.on("error", error => { state.runtime = "error"; state.lastError = error.message; });
    child.on("exit", code => {
      if (runtimeChild !== child) return;
      state.runtime = code === 0 ? "stopped" : "error";
      state.lastError = code === 0 ? "" : "Runtime kết thúc, xem .local-ops-runtime.log (exit " + code + ")";
      state.runtimePid = null;
      runtimeChild = null;
    });
    child.unref();
    log.end();
    state.runtime = "running"; // process started; per-app 'ready' still requires actual HTTP probe
    return state.runtime;
  } catch (error) {
    state.runtime = "error";
    state.lastError = String(error);
    log.end();
    return state.runtime;
  }
}
async function waitAndOpenCenter() {
  for (let i = 0; i < 180; i += 1) {
    if (await probe(3000)) {
      if (process.platform === "win32") {
        spawn("cmd.exe", ["/d", "/c", "start", "", "http://127.0.0.1:3000"], {
          windowsHide: true, detached: true, stdio: "ignore", shell: false,
        }).unref();
      }
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
export function createLocalOpsServer() {
  return createServer(async (req, res) => {
    const origin = req.headers.origin || "";
    if (!permittedOrigin(req)) return reply(res, 403, { error: "LOCAL_ORIGIN_REQUIRED" });
    if (req.method === "OPTIONS") return reply(res, 204, null, origin);
    if (req.method === "GET" && req.url === "/session") return reply(res, 200, { token: TOKEN }, origin);
    if (!validToken(req)) return reply(res, 401, { error: "LOCAL_TOKEN_REQUIRED" }, origin);
    if (req.method === "GET" && req.url === "/status") return reply(res, 200, await status(), origin);
    if (req.method === "POST" && req.url === "/start") {
      if (state.busy) return reply(res, 409, { error: "LOCAL_OPERATION_BUSY" }, origin);
      return reply(res, 202, { ok: true, runtime: startAll() }, origin);
    }
    if (req.method === "POST" && req.url === "/pull-all") {
      if (state.busy) return reply(res, 409, { error: "LOCAL_OPERATION_BUSY" }, origin);
      void pullAll();
      return reply(res, 202, { ok: true, message: "Pull all đang chạy; xem trạng thái để biết kết quả từng repo." }, origin);
    }
    return reply(res, 404, { error: "NOT_FOUND" }, origin);
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (basename(WORKSPACE).toLowerCase() !== "baumanweb") {
    console.error("LOCAL_OPS_CANONICAL_BAUMANWEB_REQUIRED: " + WORKSPACE);
    process.exitCode = 2;
  } else {
    const server = createLocalOpsServer();
    server.listen(PORT, "127.0.0.1", () => {
      console.log("[Local Ops] 127.0.0.1:" + PORT + " | BaumanWeb only");
      if (process.argv.includes("--start")) {
        startAll();
        void waitAndOpenCenter();
      }
    });
  }
}
