// Local-only Windows companion for the Application Management UI.
// NO arbitrary command API, NO LAN listener, NO production bridge or authentication bypass.
import { randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Socket } from "node:net";
import { readSourceSnapshot, exactSourceMatch } from "./local-ops-source-identity.mjs";
import { assertManagedControlAdmission } from "./local-ops-managed-startup-policy.mjs";
import { webSupported, webSupportedIds, webRuntimeSpec } from "./local-ops-web-launcher.mjs";
import { SHUTDOWN_PROTOCOL, validateStopPreflight, requestChildReply, childExited, newStopRequestId } from "./local-ops-shutdown-contract.mjs";
import { captureWindowsTree, verifyWindowsTreeGone } from "./local-ops-windows-process-tree.mjs";
import { execFile } from "node:child_process";
import { spawn } from "node:child_process";
import { closeSync, existsSync, lstatSync, openSync, readFileSync, readdirSync } from "node:fs";
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
// Git remotes are configuration, not trusted commands. Do not fetch arbitrary hosts,
// local files, ext helpers or credential-bearing URLs from a managed workspace.
const TRUSTED_ORIGIN = /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)BlueDragon33\/[a-z0-9_.-]+(?:\.git)?\/?$/i;
function trustedRemote(url) {
  return TRUSTED_ORIGIN.test(url.trim()) && !url.includes("..");
}
export function requiresRestart(runtime, results) {
  return runtime === "running" && results.some(item => item.state === "updated");
}
const state = { busy: "", pull: null, runtime: "stopped", runtimePid: null, lastError: "", runtimeStartedAt: null, restartRequired: false, sourceSnapshot: null, sourceVerified: false, runtimeEvidence: null, runtimeNonce: null, restartControl: null,
  centerRuntime: "stopped", centerPid: null, centerError: null };
let runtimeChild = null;
let centerChild = null;
const webChildren = new Map();
const webErrors = new Map();
let webAll = null;

function permittedOrigin(req) {
  const origin = req.headers.origin || "";
  const host = req.headers.host || "";
  const boundPort = req.socket.localPort;
  return ORIGINS.has(origin) && (host === "127.0.0.1:" + boundPort || host === "localhost:" + boundPort);
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
    "access-control-allow-private-network": "true",
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
export function gitRepositories(root = WORKSPACE, depth = 0) {
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
// A running Node/Vite/Cloudflare Worker must never have tracked source files
// replaced underneath it. The pull queue may update inactive repositories only.
// This guard is intentionally independent of whether Git itself supports ff-only.
export function pullSkipReason(directoryName, { centerActive = false, managedStackActive = false,
  frontendActive = false, portBusy = false } = {}) {
  if (directoryName === "Application-Management" && centerActive)
    return "APP_MANAGER_ACTIVE: dừng trung tâm đúng cách trước khi Pull repo của chính nó";
  if (managedStackActive)
    return "MANAGED_STACK_ACTIVE: không ghi đè mã khi tiến trình/D1 còn chạy";
  if (frontendActive)
    return "APP_FRONTEND_ACTIVE: dừng runtime đang chạy đúng cách trước khi Pull";
  if (portBusy)
    return "LOCAL_PORT_OCCUPIED: không xác minh được chủ cổng; từ chối ghi đè mã đang có thể được sử dụng";
  return null;
}

export async function pullRepository(dir, runner = git) {
  const name = dir.slice(WORKSPACE.length + 1);
  try {
    const branch = await runner(dir, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
    if (branch !== "main") return { name, state: "skipped", reason: "Không ở nhánh main (" + branch + ")" };
    if (await runner(dir, ["status", "--porcelain", "--untracked-files=all"]))
      return { name, state: "skipped", reason: "Có thay đổi chưa commit" };

    const configured = await runner(dir, ["config", "--get", "remote.origin.url"]);
    const resolved = await runner(dir, ["remote", "get-url", "origin"]);
    if (!trustedRemote(configured) || !trustedRemote(resolved))
      return { name, state: "skipped", reason: "Origin không thuộc GitHub BlueDragon33 hoặc bị viết lại; từ chối fetch" };

    const before = await runner(dir, ["rev-parse", "HEAD"]);
    // No git://, file://, ext::, nor other helper protocols via a config rewrite.
    await runner(dir, ["-c", "protocol.file.allow=never", "-c", "protocol.ext.allow=never",
      "fetch", "--no-tags", "origin", "main"]);
    const remote = await runner(dir, ["rev-parse", "FETCH_HEAD"]);
    // Recheck mutable local state after network I/O to avoid racing user edits.
    if (await runner(dir, ["symbolic-ref", "--quiet", "--short", "HEAD"]) !== "main"
        || await runner(dir, ["rev-parse", "HEAD"]) !== before
        || await runner(dir, ["status", "--porcelain", "--untracked-files=all"])) {
      return { name, state: "skipped", reason: "Repo thay đổi trong khi fetch; không cập nhật" };
    }
    if (before === remote) return { name, state: "current", sha: before };
    try {
      await runner(dir, ["merge-base", "--is-ancestor", before, remote]);
    } catch {
      return { name, state: "skipped", reason: "Local có commit riêng hoặc phân nhánh; không tự ghi đè" };
    }
    await runner(dir, ["merge", "--ff-only", remote]);
    const after = await runner(dir, ["rev-parse", "HEAD"]);
    if (after !== remote) {
      return { name, state: "error", reason: "SHA HEAD sau Pull không khớp FETCH_HEAD; kiểm tra repo", from: before, sha: after };
    }
    if (await runner(dir, ["status", "--porcelain", "--untracked-files=all"])) {
      return { name, state: "error", reason: "Working tree không sạch sau Pull; kiểm tra repo", from: before, sha: after };
    }
    return { name, state: "updated", from: before, sha: after, restartRequired: true };
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
      const name = basename(dir);
      const app = MANIFEST.apps.find(item => item.directory === name);
      const frontendActive = [...webChildren.keys()].some(id =>
        MANIFEST.apps.some(item => item.id === id && item.directory === name));
      const portBusy = app?.port ? await portOccupied(app.port)
        : name === "Application-Management" ? await portOccupied(3000) : false;
      const reason = pullSkipReason(name, {
        centerActive: name === "Application-Management" &&
          (Boolean(centerChild) || state.centerRuntime !== "stopped" || portBusy),
        managedStackActive: Boolean(runtimeChild) || state.runtime === "running" || state.runtime === "starting",
        frontendActive, portBusy,
      });
      if (reason) {
        state.pull.results.push({ name, state: "skipped", reason });
        continue;
      }
      const result = await pullRepository(dir);
      state.pull.results.push(result);
    }
    state.pull.status = "finished";
    // A running stack cannot adopt fetched source without a verified cold restart.
    if (requiresRestart(state.runtime, state.pull.results) ||
        (state.pull.results.some(item => item.state === "updated") &&
          (webChildren.size > 0 || state.centerRuntime === "running"))) {
      state.restartRequired = true;
      state.sourceVerified = false;
    }
  } catch (error) {
    state.pull.status = "error";
    state.pull.error = String(error).slice(0, 300);
  } finally {
    state.pull.finishedAt = new Date().toISOString();
    state.busy = "";
  }
}
export async function probe(port, path = "/") {
  try {
    const response = await fetch("http://127.0.0.1:" + port + path, {
      signal: AbortSignal.timeout(900), cache: "no-store", redirect: "manual",
    });
    // 30x may point to a published site; a redirect never proves local readiness.
    return response.status >= 200 && response.status < 300;
  } catch { return false; }
}
export function portOccupied(port, timeout = 700) {
  return new Promise(resolvePort => {
    const socket = new Socket();
    let finished = false;
    const finish = found => {
      if (finished) return;
      finished = true;
      socket.destroy();
      resolvePort(found);
    };
    socket.setTimeout(timeout);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", error => finish(error?.code === "ECONNREFUSED" ? false : true));
    socket.connect(port, "127.0.0.1");
  });
}
const STACK_PORTS = Array.from({ length: 11 }, (_, i) => 3000 + i);
async function freeStackPorts() {
  const occupied = (await Promise.all(STACK_PORTS.map(async port => await portOccupied(port) ? port : null)))
    .filter(port => port !== null);
  if (occupied.length) throw Error("LOCAL_PORTS_BUSY: " + occupied.join(", ") +
    "; dừng stack cũ bằng cơ chế an toàn rồi thử lại. Không taskkill cưỡng bức.");
}
async function checkSourceDrift() {
  if (!state.sourceSnapshot || state.runtime !== "running" || state.restartRequired) return;
  try {
    const current = await readSourceSnapshot(WORKSPACE, MANIFEST.apps);
    if (!exactSourceMatch(state.sourceSnapshot, current)) {
      state.restartRequired = true;
      state.sourceVerified = false;
      state.lastError = "SOURCE_SHA_CHANGED: mã nguồn khác phiên bản đã khởi động; cần restart.";
    }
  } catch (error) {
    state.restartRequired = true;
    state.sourceVerified = false;
    state.lastError = "SOURCE_READBACK_BLOCKED: " + String(error).slice(0, 200);
  }
}
async function status() {
  await checkSourceDrift();
  const verified = state.runtime === "running" && state.sourceVerified && !state.restartRequired && !state.busy;
  const apps = await Promise.all(MANIFEST.apps.map(async app => {
    const frontend = webChildren.get(app.id);
    let singleReady = false, sourceSha = null;
    if (frontend && frontend.phase === "running" && !state.restartRequired &&
      frontend.child.exitCode === null && frontend.child.signalCode === null && state.busy !== "pull-all") {
      try {
        const now = await readSourceSnapshot(WORKSPACE, [app]);
        if (exactSourceMatch(frontend.sources, now)) {
          singleReady = Boolean(await probe(app.port, app.path || "/"));
          sourceSha = now[app.id] || null;
        } else {
          state.restartRequired = true;
          webErrors.set(app.id, "WEB_SOURCE_SHA_DRIFT: safe manual restart required");
        }
      } catch (error) {
        state.restartRequired = true;
        webErrors.set(app.id, "WEB_SOURCE_READBACK_BLOCKED: " + String(error).slice(0, 160));
      }
    }
    const globalReady = Boolean(verified && app.port && await probe(app.port, app.path || "/"));
    return {
      id: app.id, port: app.port,
      url: app.port ? "http://127.0.0.1:" + app.port + (app.path || "/") : null,
      ready: !state.restartRequired && (globalReady || singleReady),
      note: app.note || null,
      sourceSha: globalReady ? (state.sourceSnapshot?.[app.id] ?? null) : sourceSha,
      phase: frontend?.phase || "stopped", pid: frontend?.child.pid || null,
      error: webErrors.get(app.id) || null,
      evidence: singleReady ? "owned PID + Git main SHA + localhost HTTP (not signed app build)" : null,
    };
  }));
  return { ok: true, workspace: basename(WORKSPACE), agent: "localhost", busy: state.busy, runtime: state.runtime,
    runtimePid: state.runtimePid, runtimeStartedAt: state.runtimeStartedAt,
    restartRequired: state.restartRequired, sourceVerified: verified,
    sourceSnapshot: verified ? state.sourceSnapshot : null, runtimeEvidence: verified ? state.runtimeEvidence : null,
    error: state.lastError || null, pull: state.pull, restartControl: state.restartControl,
    centerRuntime: state.centerRuntime, centerPid: state.centerPid, centerError: state.centerError,
    webAll, apps };
}

// Independent web frontends only. Never spawn BAUMAN-CONTROL, PRICE-CONTROL,
// or stop an active D1 process forcibly. Do not claim verified app build SHA.
async function startWebFrontend(id) {
  const app = MANIFEST.apps.find(item => item.id === id);
  if (!webSupported(app)) throw Error("WEB_FRONTEND_NOT_SUPPORTED: " + id);
  if (state.restartRequired) throw Error("RUNTIME_STALE_RESTART_REQUIRED");
  if (webChildren.has(id)) throw Error("WEB_FRONTEND_ALREADY_OWNED: " + id);
  if (await portOccupied(app.port)) throw Error("WEB_PORT_BUSY_UNOWNED: " + app.port);
  const before = await readSourceSnapshot(WORKSPACE, [app]);
  const spec = webRuntimeSpec({ app, workspace: WORKSPACE, managerRoot: ROOT });
  const fd = openSync(join(ROOT, ".local-ops-web-" + id + ".log"), "a", 0o600);
  webErrors.delete(id);
  let entry;
  try {
    const child = spawn(spec.file, spec.args, {cwd: spec.cwd, shell: false,
      detached: false, windowsHide: true, stdio: ["ignore", fd, fd],
      env: { ...process.env, ...spec.env }});
    entry = { child, phase:"starting", sources:before };
    webChildren.set(id, entry);
    child.once("error",error=>{
      if (webChildren.get(id) === entry) {
        entry.phase="blocked";
        webErrors.set(id,"WEB_PROCESS_SPAWN_ERROR: "+String(error).slice(0,160));
      }
    });
    child.once("exit",(code,signal)=>{
      if (webChildren.get(id) !== entry) return;
      webChildren.delete(id);
      webErrors.set(id,"WEB_PROCESS_EXIT: "+(code ?? signal ?? "unknown"));
    });
    for(let i=0;i<45;i+=1){
      if (entry.phase==="blocked" || child.exitCode !== null || child.signalCode !== null)
        throw Error(webErrors.get(id) || "WEB_EXIT_BEFORE_READY");
      if (await probe(app.port,app.path||"/")) {
        const after = await readSourceSnapshot(WORKSPACE,[app]);
        if (!exactSourceMatch(before,after)) {
          state.restartRequired=true;
          throw Error("WEB_SOURCE_SHA_CHANGED_DURING_BOOT");
        }
        if (webChildren.get(id)!==entry || child.exitCode!==null) throw Error("WEB_CHILD_OWNERSHIP_LOST");
        entry.phase="running";
        return {id,port:app.port,pid:child.pid};
      }
      await delay(1000);
    }
    throw Error("WEB_HTTP_READINESS_TIMEOUT: see .local-ops-web-"+id+".log");
  } catch(error) {
    const reason=String(error.message||error).slice(0,220);
    webErrors.set(id,reason);
    if(entry && webChildren.get(id)===entry) entry.phase="blocked";
    throw Error(reason);
  } finally { closeSync(fd); }
}
async function startWebFrontendsAll() {
  webAll={ status:"running", startedAt:new Date().toISOString(), results:[] };
  try{
    for(const id of webSupportedIds(MANIFEST.apps)) {
      if(state.restartRequired){
        webAll.results.push({id,status:"blocked",reason:"SOURCE_RESTART_REQUIRED"});continue;
      }
      if(webChildren.has(id)){
        const current = webChildren.get(id);
        if (current?.phase === "running" && current.child.exitCode === null && current.child.signalCode === null) {
          webAll.results.push({id,status:"already-running-or-owned"});
        } else {
          webAll.results.push({id,status:"blocked",reason:webErrors.get(id) || "WEB_CHILD_ALREADY_OWNED_BUT_NOT_READY"});
        }
        continue;
      }
      try{
        const answer=await startWebFrontend(id);
        webAll.results.push({id,status:"ready",port:answer.port});
      }catch(error){
        webAll.results.push({id,status:"blocked",reason:String(error.message||error).slice(0,180)});
      }
    }
    webAll.status="finished";
  }catch(error){
    webAll.status="blocked";webAll.error=String(error).slice(0,180);
  }finally{webAll.finishedAt=new Date().toISOString();state.busy="";}
}

// Lightweight standalone front-end bootstrap: no BAUMAN-CONTROL/PRICE-CONTROL,
// no migrations, no downloaded dependencies, no remote ports or elevated privileges.
// This is not source approval or attestation of the 7 managed child runtimes.
export async function startStandaloneCenter({ root = ROOT, onReady = waitAndOpenCenter } = {}) {
  if (centerChild) throw Error("CENTER_ALREADY_OWNED_BY_HELPER");
  if (await portOccupied(3000)) throw Error("CENTER_PORT_3000_BUSY: existing process is not owned; will not reuse or kill it");
  const viteEntry = join(root, "node_modules", "vite", "bin", "vite.js");
  if (!existsSync(viteEntry)) throw Error("CENTER_OFFLINE_DEPENDENCIES_MISSING: run npm ci once in Application-Management before disconnecting the network");
  if (Number(process.versions.node.split(".")[0]) < 22) throw Error("CENTER_NODE_22_REQUIRED");
  const logFd = openSync(join(root, ".local-ops-center.log"), "a", 0o600);
  state.centerRuntime = "starting";
  state.centerError = null;
  try {
    const child = spawn(process.execPath, [viteEntry, "--host", "127.0.0.1", "--port", "3000", "--strictPort"], {
      cwd: root, shell: false, detached: false, windowsHide: true, stdio: ["ignore", logFd, logFd],
      env: { ...process.env, APPLICATION_MANAGEMENT_ACCESS_MODE: "standalone",
        LOCAL_DEV_AUTH: "1", LOCAL_CONTROL_PLANE: "1", CONTROL_PLANE_NETWORK_MODE: "local" },
    });
    centerChild = child;
    state.centerPid = child.pid || null;
    child.once("exit", (code, signal) => {
      if (centerChild !== child) return;
      centerChild = null;
      state.centerPid = null;
      state.centerRuntime = "stopped";
      state.centerError = "CENTER_PROCESS_EXIT: " + (code ?? signal ?? "unknown");
    });
    for (let i = 0; i < 75; i += 1) {
      if (child.exitCode !== null || child.signalCode !== null) throw Error("CENTER_EXIT_BEFORE_READY");
      if (await probe(3000)) {
        if (centerChild !== child) throw Error("CENTER_OWNER_CHANGED_DURING_BOOT");
        state.centerRuntime = "running";
        // HTTP availability is not cryptographic source identity; keep this separate
        // from the managed Run All readiness flag.
        void onReady().catch(error => { state.centerError = String(error).slice(0, 220); });
        return {status: "running", pid: child.pid, sourceVerified: false};
      }
      await delay(850);
    }
    throw Error("CENTER_HTTP_READINESS_TIMEOUT: inspect .local-ops-center.log");
  } catch (error) {
    state.centerRuntime = centerChild ? "blocked" : "error";
    state.centerError = error instanceof Error ? error.message.slice(0, 240) : String(error);
    // Unknown managed processes are never force-killed from this helper.
    throw error;
  } finally { closeSync(logFd); }
}

async function startAll() {
  state.busy = "starting";
  state.runtime = "starting";
  state.sourceVerified = false;
  state.lastError = "";
  let logFd = null;
  try {
    if (runtimeChild) throw Error("MANAGED_STACK_STILL_ALIVE: không tự kết thúc tiến trình hoặc cưỡng bức D1");
    // Reject unreviewed BAUMAN/PRICE source BEFORE touching ports, D1 or spawning children.
    assertManagedControlAdmission({ managed: true, appsRoot: WORKSPACE });
    await freeStackPorts();
    const before = await readSourceSnapshot(WORKSPACE, MANIFEST.apps);
    const nonce = randomBytes(32).toString("base64url");
    logFd = openSync(join(ROOT, ".local-ops-runtime.log"), "a", 0o600);
    const child = spawn(process.execPath, [join(ROOT, "scripts", "run-all.mjs"), "--local", "--no-browser"], {
      cwd: ROOT, detached: false, windowsHide: true, shell: false,
      stdio: ["ignore", logFd, logFd, "ipc"],
      env: { ...process.env, LOCAL_OPS_BOOT_NONCE: nonce },
    });
    runtimeChild = child;
    state.runtimeNonce = nonce;
    state.runtimePid = child.pid || null;
    child.on("exit", (code, signal) => {
      if (runtimeChild !== child) return;
      runtimeChild = null;
      state.runtimeNonce = null;
      state.runtimePid = null;
      state.runtimeStartedAt = null;
      state.sourceVerified = false;
      state.runtime = state.restartRequired ? "stopped" : "error";
      state.lastError ||= "Managed run-all exited (" + (code ?? signal ?? "unknown") + ")";
    });
    const attestation = await new Promise((resolveBoot, rejectBoot) => {
      const timeout = setTimeout(() => rejectBoot(Error("STACK_ATTESTATION_TIMEOUT")), 180_000);
      const done = (fn, value) => { clearTimeout(timeout); fn(value); };
      child.on("message", message => {
        if (message?.type !== "local-ops-stack-ready") return;
        if (message.protocol !== "local-ops-source/v1" || message.nonce !== nonce)
          return done(rejectBoot, Error("STACK_ATTESTATION_INVALID"));
        done(resolveBoot, message.sources);
      });
      child.once("exit", (code, signal) => done(rejectBoot, Error("STACK_EXIT_BEFORE_ATTESTATION: " + (code ?? signal))));
      child.once("error", error => done(rejectBoot, error));
    });
    const after = await readSourceSnapshot(WORKSPACE, MANIFEST.apps);
    if (!exactSourceMatch(before, attestation) || !exactSourceMatch(before, after))
      throw Error("SOURCE_SHA_ATTESTATION_MISMATCH");
    const probes = await Promise.all(MANIFEST.apps.filter(app => app.port).map(async app => ({
      id: app.id, ready: await probe(app.port, app.path || "/"),
    })));
    if (probes.some(row => !row.ready))
      throw Error("STACK_HTTP_READINESS_FAILED: " + probes.filter(row => !row.ready).map(row => row.id).join(","));
    if (runtimeChild !== child || child.exitCode !== null || child.signalCode !== null)
      throw Error("STACK_EXITED_DURING_VERIFY");
    state.sourceSnapshot = before;
    state.sourceVerified = true;
    state.runtimeStartedAt = new Date().toISOString();
    state.runtimeEvidence = "process-bound Git SHA + run-all contract/health readiness; individual HTTP SHA unverified";
    state.runtime = "running";
    state.restartRequired = false;
  } catch (error) {
    state.sourceVerified = false;
    state.runtime = runtimeChild ? "blocked" : "error";
    state.restartRequired = true;
    state.lastError = error instanceof Error ? error.message.slice(0, 280) : String(error);
    // Never force-stop an unknown or still-active Windows process tree: D1 writes may be active.
  } finally {
    if (logFd !== null) closeSync(logFd);
    state.busy = "";
  }
}


export async function attemptGracefulAutoRestart({
  child, nonce, workspacePortsFree = freeStackPorts,
  afterStopped = startAll, processWait = childExited,
} = {}) {
  // User-directed opt-in, no shell commands or OS process termination.
  if (!child || !nonce || !child.connected)
    return { status: "blocked", reason: "AUTO_RESTART_NO_MANAGED_IPC_CHILD" };
  const requestId = newStopRequestId();
  try {
    const answer = await requestChildReply(child, "local-ops-shutdown-preflight",
      requestId, nonce, "local-ops-shutdown-preflight-result");
    if (!validateStopPreflight(answer)) {
      const missing = Array.isArray(answer?.missingUnits) ? answer.missingUnits.join(",") : "unknown";
      return { status: "blocked",
        reason: "GRACEFUL_DRAIN_UNVERIFIED: " + (answer?.reason || missing).slice(0, 240),
        missingUnits: answer?.missingUnits || [] };
    }
    // Snapshot the actual Windows process ancestry BEFORE permitting shutdown.
    // Unknown ancestry is a blocker, never a license to force kill descendants.
    const windowsSnapshot = process.platform === "win32"
      ? await captureWindowsTree(child.pid) : null;
    // A false preflight may not proceed to ANY child stop.
    const complete = await requestChildReply(child, "local-ops-shutdown-commit",
      requestId, nonce, "local-ops-shutdown-complete", 45_000);
    if (complete?.shutdownCompleted !== true || !validateStopPreflight(complete))
      return { status: "blocked", reason: "GRACEFUL_DRAIN_FINAL_ACK_MISSING" };
    await processWait(child, 30_000);
    if (windowsSnapshot) {
      const treeResult = await verifyWindowsTreeGone(windowsSnapshot);
      if (!treeResult.stopped)
        throw Error("WINDOWS_ORPHANED_PROCESSES: " + treeResult.survivingPids.join(","));
    }
    // Wait for every managed loopback socket. An orphaned grandchild blocks restart.
    await workspacePortsFree();
    await afterStopped();
    return { status: "finished" };
  } catch (error) {
    return { status: "blocked",
      reason: error instanceof Error ? error.message.slice(0, 240) : "UNVERIFIED_SHUTDOWN" };
  }
}
async function autoRestart() {
  const child = runtimeChild;
  const nonce = state.runtimeNonce;
  state.busy = "shutdown-preflight";
  state.restartControl = { status: "running", startedAt: new Date().toISOString() };
  try {
    const result = await attemptGracefulAutoRestart({ child, nonce,
      afterStopped: async () => {
        // Only reset/readiness from startAll AFTER child exit and zero listening ports.
        state.busy = "starting";
        await startAll();
        if (state.runtime !== "running" || !state.sourceVerified)
          throw Error("RESTART_NEW_RUNTIME_UNVERIFIED: " + (state.lastError || state.runtime));
      },
    });
    state.restartControl = { ...result, finishedAt: new Date().toISOString() };
    if (result.status !== "finished") {
      state.lastError = result.reason;
      // Preserve previous runtime state when preflight refused without stopping anything.
    }
  } finally { state.busy = ""; }
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
    const peer = req.socket.remoteAddress || "";
    if (peer !== "127.0.0.1" && peer !== "::ffff:127.0.0.1")
      return reply(res, 403, { error: "LOCAL_PEER_REQUIRED" });
    if (!permittedOrigin(req)) return reply(res, 403, { error: "LOCAL_ORIGIN_REQUIRED" });
    if (req.method === "OPTIONS") return reply(res, 204, null, origin);
    if (req.method === "GET" && req.url === "/session") return reply(res, 200, { token: TOKEN }, origin);
    if (!validToken(req)) return reply(res, 401, { error: "LOCAL_TOKEN_REQUIRED" }, origin);
    if (req.method === "GET" && req.url === "/status") return reply(res, 200, await status(), origin);
    const single = req.method === "POST" ? /^\/start-app\/([a-z0-9-]+)$/.exec(req.url || "") : null;
    if (single) {
      const id=single[1],app=MANIFEST.apps.find(row=>row.id===id);
      if(!webSupported(app))return reply(res,404,{error:"WEB_FRONTEND_NOT_REGISTERED"},origin);
      if(state.busy)return reply(res,409,{error:"LOCAL_OPERATION_BUSY"},origin);
      if(state.restartRequired)return reply(res,409,{error:"RUNTIME_STALE_RESTART_REQUIRED"},origin);
      if(webChildren.has(id))return reply(res,409,{error:"WEB_FRONTEND_ALREADY_OWNED"},origin);
      webErrors.delete(id);
      state.busy="start-app:"+id;
      void startWebFrontend(id).catch(error=>webErrors.set(id,String(error.message||error).slice(0,200)))
        .finally(()=>{state.busy="";});
      return reply(res,202,{ok:true,id,state:"starting"},origin);
    }
    if(req.method==="POST"&&req.url==="/start-web-all"){
      if(state.busy)return reply(res,409,{error:"LOCAL_OPERATION_BUSY"},origin);
      if(state.restartRequired)return reply(res,409,{error:"RUNTIME_STALE_RESTART_REQUIRED"},origin);
      state.busy="start-web-all";
      void startWebFrontendsAll();
      return reply(res,202,{ok:true,state:"starting",mode:"standalone-frontend-only"},origin);
    }
    if (req.method === "POST" && req.url === "/start") {
      if (state.busy) return reply(res, 409, { error: "LOCAL_OPERATION_BUSY" }, origin);
      if (state.restartRequired && (state.runtime === "running" || state.runtime === "starting"))
        return reply(res, 409, { error: "RUNTIME_STALE_RESTART_REQUIRED" }, origin);
      if (runtimeChild) return reply(res, 409, { error: "MANAGED_STACK_STILL_ALIVE" }, origin);
      try { assertManagedControlAdmission({ managed: true, appsRoot: WORKSPACE }); }
      catch (error) { return reply(res, 409, { error: "RUN_ALL_BLOCKED: " + String(error.message || error).slice(0, 220) }, origin); }
      state.busy = "starting";
      void startAll();
      return reply(res, 202, { ok: true, runtime: "starting" }, origin);
    }
    if (req.method === "POST" && req.url === "/restart") {
      if (state.busy) return reply(res, 409, { error: "LOCAL_OPERATION_BUSY" }, origin);
      if (runtimeChild) return reply(res, 409, { error: "MANUAL_SAFE_STOP_REQUIRED: stack vẫn đang chạy; không cưỡng bức kết thúc D1" }, origin);
      try { assertManagedControlAdmission({ managed: true, appsRoot: WORKSPACE }); }
      catch (error) { return reply(res, 409, { error: "RESTART_BLOCKED: " + String(error.message || error).slice(0, 220) }, origin); }
      state.busy = "starting";
      void startAll();
      return reply(res, 202, { ok: true, message: "Chỉ khởi động lại sau khi stack cũ đã dừng và các cổng được giải phóng." }, origin);
    }
    if (req.method === "POST" && req.url === "/restart-auto") {
      if (state.busy) return reply(res, 409, { error: "LOCAL_OPERATION_BUSY" }, origin);
      if (!runtimeChild || !state.runtimeNonce) return reply(res, 409, { error: "AUTO_RESTART_NO_MANAGED_STACK" }, origin);
      state.busy = "shutdown-preflight";
      void autoRestart();
      return reply(res, 202, { ok: true, message: "Đang kiểm tra điều kiện shutdown. Không tắt tiến trình nếu chưa có bằng chứng drain tất cả dịch vụ." }, origin);
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
      if (process.argv.includes("--center")) {
        void startStandaloneCenter().catch(error => {
          console.error("[Local Ops] Standalone Center startup blocked: " + (error?.message || error));
        });
      } else if (process.argv.includes("--start")) {
        state.busy = "starting";
        void startAll().then(() => { if (state.runtime === "running") void waitAndOpenCenter(); });
      }
    });
  }
}
