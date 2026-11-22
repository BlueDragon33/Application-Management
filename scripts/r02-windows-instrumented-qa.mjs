// R0.2 Windows instrumented QA. Disposable, fail-closed, no Production or Reviewer A/B access.
// Bounded evidence collector, NOT a G05 attestation and never a release authorization.
// Run only via a local, explicitly authorized E:\BaumanWeb\_qa workspace.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const APP = "BlueDragon33/Application-Management";
const MAIN = "89a89ce2d3d8ed634ee9562c52744a99223a2b2a";
const CANDIDATE = "92f7fbf6e3b1664d2431694fc5aeaef5b27df5c6";
const FOCUSED = process.env.R02_FOCUSED === "1";
const ROOT = path.resolve(process.env.R02_QA_ROOT || "E:\\BaumanWeb\\_qa");
const SOURCE = path.resolve(process.env.R02_APP_REPO || "E:\\BaumanWeb\\Application-Management");
const id = "am-r02-" + new Date().toISOString().replace(/[:.]/g, "-") + "-" + randomUUID().slice(0, 8);
const sessionDir = path.join(ROOT, id);
const reportsDir = path.join(ROOT, "_r02_reports", id);
const reportFile = path.join(reportsDir, "r02-evidence.json");
const state = {
  schema: "application-management.r02.instrumented-qa/v1",
  status: "BLOCKED",
  measurementMode: FOCUSED ? "FOCUSED_API_FRONTEND_CPU_INTERACTION" : "ORIGINAL_10_50_200",
  policy: "blueprint-os:universal-century-grade@1.3.0",
  gate: "G05_UNVERIFIED",
  repo: APP,
  pinned: { main: MAIN, candidate: CANDIDATE },
  session: id,
  startTime: new Date().toISOString(),
  environment: { platform: process.platform, node: process.version, host: os.hostname(), qaRoot: ROOT },
  preflight: null,
  measurements: [],
  errors: [],
  cleanup: [],
  stage: "NOT_STARTED",
  commands: [],
  recoveredFailures: [],
  npmDiagnostics: [],
};
let browser;
let upstream;
let currentApp;
let playwright;
const checkouts = [];
const selfOwnedPaths = [];
const listenPorts = [];

function currentStage(name) {
  state.stage = name;
  state.stageAt = new Date().toISOString();
  console.log("R02_STAGE=" + name);
}
function sanitize(value) {
  return String(value ?? "").replace(/(\/\/[^\s\/]+\/[^\s:@]+):[^\s@]+@/g, "$1:[REDACTED]@")
    .replace(/((?:_authToken|authorization|password|secret|credential|api[_-]?key)\s*[=:]\s*)[^\s"']+/gi, "$1[REDACTED]")
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/-]+/gi, "$1[REDACTED]");
}
function run(file, args, cwd = SOURCE, env = process.env, timeout = 240000) {
  const windowsCmd = process.platform === "win32" && /\.cmd$/i.test(file);
  const cmd = windowsCmd ? (process.env.ComSpec || "cmd.exe") : file;
  const argv = windowsCmd ? ["/d", "/s", "/c", file, ...args] : args;
  const startedAt = new Date().toISOString();
  const result = spawnSync(cmd, argv, { cwd, env, encoding: "utf8", windowsHide: true,
    timeout, maxBuffer: 16 * 1024 * 1024 });
  const stdout = sanitize(result.stdout || "");
  const stderr = sanitize(result.stderr || "");
  const detail = { stage: state.stage, tool: path.basename(file), args: args.map(x =>
    /^(?:--(token|password|secret|key)=)/i.test(x) ? "[REDACTED]" : x),
    cwd: path.basename(cwd), startedAt, exit: result.status,
    durationMs: Date.now() - Date.parse(startedAt) };
  state.commands.push(detail);
  if (result.error || result.status !== 0) {
    const logPath = path.join(reportsDir, "command-" + String(state.commands.length).padStart(3, "0") + ".log");
    fs.mkdirSync(reportsDir, { recursive: true });
    fs.writeFileSync(logPath, [
      "stage: " + state.stage, "tool: " + path.basename(file), "exit: " + result.status,
      "error: " + sanitize(result.error?.message || ""), "--- STDOUT ---", stdout,
      "--- STDERR ---", stderr ].join("\n").slice(-3_000_000));
    detail.failureLog = logPath;
    const entries = (stdout + "\n" + stderr).split(/\r?\n/).filter(Boolean);
    const interesting = entries.filter(line =>
      /npm (?:error|ERR)|(^|\s)(?:EACCES|EPERM|ENOTEMPTY|EBUSY|EUSAGE|ECONNRESET|ETIMEDOUT|ENOSPC|CERT_|ERR_PNPM)|(?:ERR!|error:)/i.test(line));
    const reason = interesting.slice(-8).join(" | ") || entries.slice(-5).join(" | ");
    const message = path.basename(file) + " failed (" + String(result.status) + ") at " + state.stage +
      "; FULL_LOG=" + logPath + "; " + sanitize(result.error?.message || reason).slice(0, 1800);
    const error = new Error(message);
    error.code = result.status;
    error.failureLog = logPath;
    error.diagnostic = (stdout + "\n" + stderr).slice(-10000);
    throw error;
  }
  return stdout.trim();
}
function git(args, cwd = SOURCE) { return run("git.exe", args, cwd); }
function node(args, cwd = SOURCE, env = process.env, timeout) { return run(process.execPath, args, cwd, env, timeout); }
function npm(args, cwd = SOURCE) {
  const cacheDir = path.join(sessionDir, "_npm_cache");
  fs.mkdirSync(cacheDir, { recursive: true });
  const env = { ...process.env, npm_config_cache: cacheDir, npm_config_audit: "false",
    npm_config_fund: "false", npm_config_update_notifier: "false" };
  const preserveNpmDebug = (error) => {
    const logsDir = path.join(cacheDir, "_logs");
    let latest = "";
    try {
      const files = fs.readdirSync(logsDir).filter(name => name.endsWith("-debug-0.log")).sort();
      if (files.length) {
        const source = path.join(logsDir, files[files.length - 1]);
        latest = path.join(reportsDir, "npm-debug-" + String(state.commands.length).padStart(3, "0") + ".log");
        fs.mkdirSync(reportsDir, { recursive: true });
        fs.writeFileSync(latest, sanitize(fs.readFileSync(source, "utf8")).slice(-500_000));
      }
    } catch (readError) {
      state.npmDiagnostics.push({stage: state.stage, debugLogCapture: "UNAVAILABLE",
        reason: String(readError?.message || readError).slice(0, 180)});
    }
    state.npmDiagnostics.push({stage: state.stage, commandLog: error.failureLog, npmDebugLog: latest || null});
    return latest;
  };
  try {
    return run("npm.cmd", args, cwd, env, 600000);
  } catch (error) {
    const debugFile = preserveNpmDebug(error);
    const debug = debugFile && fs.existsSync(debugFile) ? fs.readFileSync(debugFile, "utf8").slice(-10_000) : "";
    const diag = String(error.diagnostic || "") + "\n" + debug;
    const recoverable = /\b(?:EINTEGRITY|ECONNRESET|ETIMEDOUT|EAI_AGAIN|EBUSY|ENOTEMPTY|EPERM|EACCES)\b/i.test(diag);
    if (!recoverable) throw error;
    state.recoveredFailures.push({ stage: state.stage, reason: "TRANSIENT_NPM_RETRY", previousLog: error.failureLog });
    currentStage(state.stage + "_ONE_BOUNDED_NPM_RETRY");
    // Exactly one retry; never disable TLS verification or use npm install as a silent substitute for npm ci.
    try { return run("npm.cmd", args, cwd, env, 600000); }
    catch (retryError) { preserveNpmDebug(retryError); throw retryError; }
  }
}
function verifyDir() {
  assert.equal(process.platform, "win32", "WINDOWS_REQUIRED");
  assert.equal(ROOT.toLowerCase(), path.resolve("E:\\BaumanWeb\\_qa").toLowerCase(), "QA_ROOT_MUST_BE_E_BAUMANWEB_QA");
  assert.equal(SOURCE.toLowerCase(), path.resolve("E:\\BaumanWeb\\Application-Management").toLowerCase(), "APP_SOURCE_ROOT_NOT_ALLOWED");
  assert.ok(fs.existsSync(path.join(SOURCE, ".git")), "APP_GIT_CHECKOUT_MISSING");
  if (fs.existsSync(ROOT)) assert.ok(!fs.lstatSync(ROOT).isSymbolicLink(), "QA_ROOT_SYMLINK_NOT_ALLOWED");
  fs.mkdirSync(reportsDir, { recursive: true });
  fs.mkdirSync(sessionDir, { recursive: false });
  fs.writeFileSync(path.join(sessionDir, "QA_OWNERSHIP.json"), JSON.stringify({
    owner: "Application-Management R0.2 local instrumented QA", jobId: id,
    allowCleanupOnlyWithinThisDir: true, startedAt: state.startTime
  }, null, 2));
  selfOwnedPaths.push(sessionDir);
}
async function listen(handler) {
  const server = createServer(handler);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const addr = server.address();
  listenPorts.push(addr.port);
  return { server, port: addr.port };
}
async function closeServer(server) {
  if (!server) return;
  server.closeAllConnections();
  await new Promise(resolve => server.close(() => resolve()));
}
async function freePort() {
  const own = await listen((_req, res) => res.end("reserved"));
  await closeServer(own.server);
  return own.port;
}
function browserExecutable() {
  const v = process.env;
  const locations = [
    v.R02_CHROMIUM_EXE,
    path.join(v.PROGRAMFILES || "C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(v.PROGRAMFILES || "C:\\Program Files", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(v["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(v.LOCALAPPDATA || "C:\\Users\\Public", "Google", "Chrome", "Application", "chrome.exe")
  ].filter(Boolean);
  return locations.find(p => fs.existsSync(p)) || null;
}
function ensurePlaywright() {
  currentStage("PREFLIGHT_PLAYWRIGHT_DEPENDENCY");
  // Only install the small Playwright protocol library in our owned, disposable QA workspace.
  const packageDir = path.join(sessionDir, "instrumentation");
  fs.mkdirSync(packageDir);
  npm(["install", "--prefix", packageDir, "--no-save", "--no-package-lock",
    "--ignore-scripts", "--no-audit", "--no-fund", "--prefer-offline", "playwright-core@1.56.1"], SOURCE);
  const localRequire = createRequire(path.join(packageDir, "package.json"));
  const pw = localRequire("playwright-core");
  assert.ok(pw.chromium, "PLAYWRIGHT_CORE_CHROMIUM_MISSING");
  return pw;
}
async function preflight() {
  currentStage("PREFLIGHT_BROWSER_LOOPBACK_200");
  const executor = browserExecutable();
  assert.ok(executor, "NO_EXISTING_CHROMIUM_EDGE_OR_CHROME");
  playwright = ensurePlaywright();
  browser = await playwright.chromium.launch({ executablePath: executor, headless: true,
    args: ["--no-first-run", "--disable-extensions"] });
  const own = await listen((req, res) => {
    res.writeHead(200, { "content-type": "text/plain", "cache-control": "no-store" });
    res.end("R02_OWNED_HTTP_200");
  });
  try {
    const page = await browser.newPage();
    const response = await page.goto("http://127.0.0.1:" + own.port, { waitUntil: "domcontentloaded", timeout: 15000 });
    assert.equal(response?.status(), 200, "PREFLIGHT_NOT_HTTP_200");
    assert.equal(await page.textContent("body"), "R02_OWNED_HTTP_200", "PREFLIGHT_WRONG_BODY");
    state.preflight = { status: "PASS", host: "127.0.0.1", port: own.port,
      browser: browser.version(), executable: executor, httpStatus: 200, at: new Date().toISOString() };
    await page.close();
  } finally { await closeServer(own.server); }
}
function checkLive() {
  currentStage("REMOTE_SHA_LOCAL_READBACK");
  // The PowerShell launcher verifies all three remote heads in ONE bounded
  // git ls-remote call and fetches only missing commit objects. Reusing that
  // same short-lived attestation avoids a second TLS handshake (prior failure).
  // Never replace it with unverified local origin/main or cached assumptions.
  const issued = Date.parse(process.env.R02_ATTESTED_AT || "");
  assert.ok(Number.isFinite(issued) && issued <= Date.now() + 5000 &&
    Date.now() - issued <= 20 * 60_000, "R02_REMOTE_ATTESTATION_MISSING_OR_EXPIRED");
  const refs = {
    main: process.env.R02_ATTEST_MAIN || "",
    pr414: process.env.R02_ATTEST_PR414 || "",
    pr417: process.env.R02_ATTEST_PR417 || ""
  };
  for (const value of Object.values(refs)) {
    assert.match(value, /^[0-9a-f]{40}$/, "R02_ATTESTED_REF_INVALID");
  }
  assert.equal(refs.main, MAIN, "MAIN_HEAD_CHANGED_STOP");
  assert.equal(refs.pr417, CANDIDATE, "PR417_HEAD_CHANGED_STOP");
  const harnessSha = process.env.R02_HARNESS_SHA || "";
  assert.match(harnessSha, /^[0-9a-f]{40}$/, "HARNESS_SHA_MISSING");
  assert.equal(refs.pr414, harnessSha, "PR414_HARNESS_CHANGED_STOP");
  const remote = git(["remote", "get-url", "origin"]).trim();
  assert.match(remote, /^(?:https:\/\/github\.com\/BlueDragon33\/Application-Management(?:\.git)?|git@github\.com:BlueDragon33\/Application-Management(?:\.git)?)$/i,
    "R02_SOURCE_REMOTE_NOT_CANONICAL");
  state.pinned.harness = harnessSha;
  state.sourceAttestation = { method: "LAUNCHER_GIT_LS_REMOTE_PINNED_ONCE", issuedAt: new Date(issued).toISOString(), refs, remote };
  for (const sha of [MAIN, CANDIDATE]) {
    assert.equal(git(["rev-parse", "--verify", sha + "^{commit}"]), sha,
      "R02_MISSING_VERIFIED_COMMIT_OBJECT_" + sha.slice(0, 12));
  }
}
function makeCheckout(label, sha) {
  currentStage("QA_CHECKOUT_" + label.toUpperCase());
  const folder = path.join(sessionDir, label);
  assert.ok(!fs.existsSync(folder), "QA_CHECKOUT_ALREADY_EXISTS");
  git(["worktree", "add", "--detach", folder, sha]);
  checkouts.push(folder);
  assert.equal(git(["rev-parse", "HEAD"], folder), sha);
  assert.ok(!fs.existsSync(path.join(folder, ".dev.vars")), "EXISTING_DEV_SECRETS_IN_QA");
  state.environment[label + "Sha"] = sha;
  return folder;
}
function fixtureResponse(req, res) {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  const found = /^\/api\/r02\/(qa-r02-\d+)\/(contract|status|devices|automation)$/.exec(url.pathname);
  const id = found?.[1] || "";
  const kind = found?.[2] || "";
  const stem = "/api/r02/" + id + "/";
  let body = { error: "QA_FIXTURE_ROUTE_NOT_FOUND" };
  let code = 404;
  if (found && req.method === "GET") {
    code = 200;
    if (kind === "contract") body = {
      schema: "application-management.contract/v1",
      application: { id, name: id, category: "Kỹ thuật" },
      capabilities: { deviceRegistry: true, deviceAutoApproval: true },
      policy: { credentialRequired: true, remoteAdminReady: true },
      endpoints: { status: stem + "status", devices: stem + "devices", automation: stem + "automation" }
    };
    if (kind === "status") body = { online: true };
    if (kind === "devices") body = { devices: [] };
    if (kind === "automation") body = { automation: { autoApproveDevices: false } };
  }
  res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}
function qaEnv(upstreamPort) {
  // Explicit allowlist: never propagate Production secrets, Cloudflare tokens or paid provider keys.
  const names = ["PATH", "PATHEXT", "SystemRoot", "WINDIR", "ComSpec", "TEMP", "TMP", "USERPROFILE",
    "APPDATA", "LOCALAPPDATA", "PROGRAMFILES", "PROGRAMFILES(X86)", "PROCESSOR_ARCHITECTURE"];
  const env = Object.fromEntries(names.filter(x => process.env[x]).map(x => [x, process.env[x]]));
  const fixture = "http://127.0.0.1:" + upstreamPort;
  return { ...env, CI: "true", APP_RUNTIME: "local", LOCAL_DEV_AUTH: "1",
    LOCAL_DEV_USER_ID: "qa-r02-owner", LOCAL_DEV_USER_EMAIL: "qa.r02@example.test",
    LOCAL_DEV_USER_NAME: "R02 QA Fixture Owner", CONTROL_OWNER_EMAILS: "qa.r02@example.test",
    APPLICATION_MANAGEMENT_ACCESS_MODE: "standalone", CONTROL_PLANE_NETWORK_MODE: "local",
    WRANGLER_SEND_METRICS: "false", WRANGLER_WRITE_LOGS: "false",
    BOI_ECH_LOCAL_BASE_URL: fixture, HEALTH_CARE_LOCAL_BASE_URL: fixture,
    RU_LIFE_LOCAL_BASE_URL: fixture, BAUMAN_CONTROL_LOCAL_BASE_URL: fixture,
    BAUMAN_APP_LOCAL_ORIGIN: fixture, GROWUP_CONTROL_LOCAL_BASE_URL: fixture,
    PRICE_REPORT_CONTROL_LOCAL_BASE_URL: fixture };
}
function wrangler(folder, args, env) {
  const cli = path.join(folder, "node_modules", "wrangler", "bin", "wrangler.js");
  assert.ok(fs.existsSync(cli), "WRANGLER_NOT_INSTALLED");
  return node([cli, ...args], folder, env, 240000);
}
function seedD1(folder, amount, env, label) {
  const ids = Array.from({ length: amount }, (_v, i) => "qa-r02-" + String(i + 1).padStart(4, "0"));
  const sql = ["DELETE FROM managed_app_catalog WHERE id LIKE 'qa-r02-%';"];
  for (const id of ids) {
    const origin = "http://127.0.0.1:" + upstream.port;
    const contract = "/api/r02/" + id + "/contract";
    sql.push("INSERT INTO managed_app_catalog(id,name,short_name,category,origin,contract_path,enabled,created_by)" +
      " VALUES ('" + id + "','" + id + "','" + id + "','Kỹ thuật','" + origin + "','" + contract + "',1,'qa.r02@example.test');");
  }
  const sqlFile = path.join(sessionDir, "fixture-" + label + "-" + amount + ".sql");
  fs.writeFileSync(sqlFile, sql.join("\n"));
  wrangler(folder, ["d1", "execute", "learning-management-db", "--local", "--config", "wrangler.local.jsonc", "--file", sqlFile], env);
  const readback = wrangler(folder, ["d1", "execute", "learning-management-db", "--local", "--config",
    "wrangler.local.jsonc", "--command", "SELECT COUNT(*) AS r02_count FROM managed_app_catalog WHERE id LIKE 'qa-r02-%';"], env);
  return { seedCount: amount, queryOutput: readback.slice(-1200), readbackCountConfirmed: false };
}
async function waitForLocal(url, proc) {
  const until = Date.now() + 90000;
  while (Date.now() < until) {
    if (proc.exitCode !== null) throw new Error("QA_SERVER_EXIT_" + proc.exitCode);
    try { const r = await fetch(url, { signal: AbortSignal.timeout(2000) }); if (r.status === 200) return; }
    catch {}
    await new Promise(resolve => setTimeout(resolve, 350));
  }
  throw new Error("QA_SERVER_HTTP_200_TIMEOUT");
}
function attestedListenerPid(port, expectedPid) {
  const cmd = "(Get-NetTCPConnection -LocalPort " + port +
    " -State Listen -ErrorAction Stop | Where-Object {$_.LocalAddress -eq '127.0.0.1'} " +
    "| Select-Object -First 1 -ExpandProperty OwningProcess)";
  const value = run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", cmd]);
  assert.equal(Number(value.trim()), expectedPid, "QA_LISTENER_PID_NOT_OWNED");
  return Number(value.trim());
}
async function beginApp(folder, env) {
  const port = await freePort();
  const out = fs.openSync(path.join(reportsDir, path.basename(folder) + "-vite.log"), "w");
  const bin = path.join(folder, "node_modules", "vite", "bin", "vite.js");
  assert.ok(fs.existsSync(bin), "VITE_MISSING");
  const proc = spawn(process.execPath, [bin, "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    { cwd: folder, env, stdio: ["ignore", out, out], windowsHide: true });
  fs.closeSync(out);
  currentApp = proc;
  const url = "http://127.0.0.1:" + port;
  await waitForLocal(url, proc);
  attestedListenerPid(port, proc.pid);
  return { port, url, pid: proc.pid };
}
function stopApp() {
  if (!currentApp) return;
  const pid = currentApp.pid;
  if (pid) {
    try { run("taskkill.exe", ["/PID", String(pid), "/T", "/F"], SOURCE, process.env, 20000); }
    catch (e) { state.cleanup.push("App process stop: " + String(e.message).slice(0,120)); }
  }
  currentApp = null;
}
function metricValue(metrics, key) {
  return metrics.find(x => x.name === key)?.value ?? null;
}
function difference(a, b) {
  return typeof a === "number" && typeof b === "number" && Number.isFinite(a) && Number.isFinite(b) ? b - a : null;
}
function serverProcessCpuSeconds(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return null;
  try {
    const cmd = "(Get-Process -Id " + pid + " -ErrorAction Stop).CPU";
    const output = run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", cmd], SOURCE, process.env, 10000);
    const value = Number(output.replace(",", "."));
    return Number.isFinite(value) ? value : null;
  } catch { return null; }
}
async function sample(browser, origin, fixtureCount, label, viewport, repeat, appPid) {
  const context = await browser.newContext({ viewport, locale: "vi-VN", serviceWorkers: "block" });
  const page = await context.newPage();
  let requests = 0;
  let failedRequests = 0;
  let errors = [];
  page.on("request", () => requests++);
  page.on("requestfailed", () => failedRequests++);
  page.on("pageerror", error => errors.push(error.message.slice(0, 180)));
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  const preNavigationMetrics = FOCUSED ? await cdp.send("Performance.getMetrics") : null;
  const cpuBefore = FOCUSED ? serverProcessCpuSeconds(appPid) : null;
  let cssCoverageStarted = false;
  try { await page.coverage.startCSSCoverage(); cssCoverageStarted = true; } catch {}
  await page.addInitScript((focused) => {
    window.__r02long = 0;
    window.__r02dom = 0;
    if (focused && window.__REACT_DEVTOOLS_GLOBAL_HOOK__ === undefined) {
      window.__r02ReactCommitCount = 0;
      const renderers = new Map();
      let nextRendererId = 0;
      Object.defineProperty(window, "__REACT_DEVTOOLS_GLOBAL_HOOK__", { configurable: true, value: {
        supportsFiber: true,
        renderers,
        inject(renderer) { const id = ++nextRendererId; renderers.set(id, renderer); return id; },
        onCommitFiberRoot() { window.__r02ReactCommitCount += 1; },
        onCommitFiberUnmount() {},
        onScheduleFiberRoot() {},
        onPostCommitFiberRoot() {},
        getFiberRoots() { return new Set(); },
        checkDCE() {}
      }});
    }
    try {
      new PerformanceObserver(list => { window.__r02long += list.getEntries().length; })
        .observe({ type: "longtask", buffered: true });
    } catch {}
    new MutationObserver(records => { window.__r02dom += records.length; })
      .observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  }, FOCUSED);
  try {
    const start = performance.now();
    const pageResponse = await page.goto(origin + "/?view=applications", { waitUntil: "domcontentloaded", timeout: 60000 });
    assert.equal(pageResponse?.status(), 200, "APP_PAGE_HTTP_NOT_200");
    await page.locator(".amv2-content[data-view='applications']").waitFor({ state: "visible", timeout: 45000 });
    const gate = page.locator(".amv2-access-mode");
    await gate.waitFor({ timeout: 45000 });
    const responsePromise = page.waitForResponse(res =>
      new URL(res.url()).pathname === "/api/operations" && res.request().method() === "POST", { timeout: 90000 });
    if ((await gate.getAttribute("data-enabled")) === "false") await gate.click();
    const response = await responsePromise;
    assert.equal(response.status(), 200, "OPERATIONS_BOOTSTRAP_FAILED_" + response.status());
    const payload = await response.json();
    const apiTiming = FOCUSED ? response.request().timing() : null;
    const apiNetworkMs = apiTiming && apiTiming.responseEnd >= 0 ? apiTiming.responseEnd : null;
    const synthetic = (payload.managedApps || []).filter(x => /^qa-r02-\d+$/.test(x.id));
    assert.equal(synthetic.length, fixtureCount, "D1_CATALOG_LIVE_READBACK_COUNT_MISMATCH");
    await page.locator(".amv2-content[data-view='applications']").waitFor({ state: "visible", timeout: 45000 });
    const readyMs = Math.round(performance.now() - start);
    const readyMetrics = FOCUSED ? await cdp.send("Performance.getMetrics") : null;
    const cpuAtReady = FOCUSED ? serverProcessCpuSeconds(appPid) : null;
    const before = await cdp.send("Performance.getMetrics");
    await page.waitForTimeout(3000); // Measured steady-state observation period, not a gate-passing sleep.
    const after = await cdp.send("Performance.getMetrics");
    let cssCoverage = { status: "UNVERIFIED_UNSUPPORTED" };
    if (cssCoverageStarted) {
      try {
        const entries = await page.coverage.stopCSSCoverage();
        const totalBytes = entries.reduce((sum, entry) => sum + entry.text.length, 0);
        const usedBytes = entries.reduce((sum, entry) => sum + entry.ranges.reduce((a, b) => a + b.end - b.start, 0), 0);
        cssCoverage = { status: "CHROMIUM_OBSERVED", totalBytes, usedBytes };
      } catch { cssCoverage = { status: "UNVERIFIED_COVERAGE_READ_ERROR" }; }
    }
    let interaction = { status: "UNVERIFIED_NOT_MEASURED" };
    if (FOCUSED) {
      try {
        const filter = page.locator(".amv2-launcher-search input");
        await filter.waitFor({ state: "visible", timeout: 10000 });
        await page.evaluate(() => {
          window.__r02FilterStart = null;
          window.__r02FilterPaint = null;
          const target = document.querySelector(".amv2-launcher-search input");
          const grid = document.querySelector("[data-testid='app-launcher-grid']");
          if (!target || !grid) return;
          target.addEventListener("input", () => { window.__r02FilterStart = performance.now(); }, { once: true });
          const observer = new MutationObserver(() => {
            if (window.__r02FilterPaint != null || window.__r02FilterStart == null) return;
            const cards = grid.querySelectorAll(".amv2-launcher-card");
            if (cards.length === 1) {
              requestAnimationFrame(() => requestAnimationFrame(() => {
                window.__r02FilterPaint = performance.now();
                observer.disconnect();
              }));
            }
          });
          observer.observe(grid, { childList: true, subtree: true });
        });
        await filter.fill("qa-r02-0001");
        await page.waitForFunction(() => window.__r02FilterPaint !== null, null, { timeout: 7500 });
        interaction = await page.evaluate(() => ({
          status: "BROWSER_FILTER_INPUT_TO_TWO_RAF",
          milliseconds: window.__r02FilterPaint - window.__r02FilterStart,
          matches: document.querySelectorAll(".amv2-launcher-card").length,
          note: "Browser input event to two animation frames after filtered card DOM update; not OS-to-display latency"
        }));
      } catch (error) {
        interaction = { status: "UNVERIFIED_INPUT_PROBE_FAILED", reason: String(error?.message || error).slice(0, 180) };
      }
    }
    const display = await page.evaluate(() => ({
      domMutations: window.__r02dom ?? null, longTasks: window.__r02long ?? null,
      reactCommits: window.__r02ReactCommitCount ?? null,
      textContrast: (() => {
        const h = document.querySelector(".amv2-page-title h1");
        if (!h) return { status: "UNVERIFIED_NO_TITLE" };
        const s = getComputedStyle(h);
        const stack = [];
        for (let node = h, depth = 0; node && depth < 12; node = node.parentElement, depth++) {
          const style = getComputedStyle(node);
          stack.push({ tag: node.tagName.toLowerCase(), backgroundColor: style.backgroundColor,
            backgroundImage: style.backgroundImage, opacity: style.opacity });
        }
        return { status: "UNVERIFIED_COMPOSITED_BACKGROUND", foreground: s.color,
          background: s.backgroundColor, ancestorBackgroundStack: stack };
      })()
    }));
    return { label, fixtureCount, viewport: viewport.width + "x" + viewport.height, repeat,
      http: 200, managedAppsReadback: synthetic.length, readyMs, requests, failedRequests, pageErrors: errors,
      longTasksObserved: display.longTasks, domMutationsObserved: display.domMutations,
      taskDurationDeltaSeconds: metricValue(after.metrics, "TaskDuration") - metricValue(before.metrics, "TaskDuration"),
      jsHeapUsedBytes: metricValue(after.metrics, "JSHeapUsedSize"),
      contrast: display.textContrast, cssCoverage,
      reactCommits: typeof display.reactCommits === "number" && display.reactCommits > 0
        ? { status: "BROWSER_DEVTOOLS_HOOK_OBSERVED", count: display.reactCommits, scope: "ENTIRE_PAGE_NOT_EXCLUSIVE_DASHBOARD" }
        : "UNVERIFIED_DEVTOOLS_HOOK_UNAVAILABLE",
      ...(FOCUSED ? { apiNetworkMs,
        browserRendererTaskStartupMs: difference(metricValue(preNavigationMetrics?.metrics, "TaskDuration"), metricValue(readyMetrics?.metrics, "TaskDuration")) === null
          ? null : difference(metricValue(preNavigationMetrics.metrics, "TaskDuration"), metricValue(readyMetrics.metrics, "TaskDuration")) * 1000,
        serverMainPidCpuSecondsDelta: difference(cpuBefore, cpuAtReady),
        serverCpuScope: "VITE_NODE_PID_ONLY_NOT_WORKER_DESCENDANTS_OR_BROWSER",
        apiTimingSource: "PLAYWRIGHT_REQUEST_TIMING_RESPONSE_END",
        interaction, processCpuTotal: "UNVERIFIED_NOT_CAPTURED" } : {}) };
  } catch (error) {
    const shot = path.join(reportsDir, "failure-" + label + "-" + fixtureCount + "-" +
      viewport.width + "x" + viewport.height + "-" + repeat + ".png");
    try {
      await page.screenshot({ path: shot, fullPage: true, timeout: 10_000 });
      state.failureScreenshot = shot;
    } catch { state.failureScreenshot = "UNAVAILABLE"; }
    throw error;
  } finally { await context.close(); }
}
function percentile(values, p) {
  const a = [...values].sort((x, y) => x - y);
  return a.length ? a[Math.min(a.length - 1, Math.ceil(p / 100 * a.length) - 1)] : null;
}
function summarize() {
  const groups = {};
  for (const m of state.measurements) {
    if (typeof m.readyMs !== "number" || !Number.isFinite(m.readyMs)) continue;
    const key = m.label + "/" + m.fixtureCount + "/" + m.viewport;
    (groups[key] ||= []).push(m.readyMs);
  }
  state.summaries = Object.fromEntries(Object.entries(groups).map(([name, samples]) =>
    [name, { count: samples.length, p50_ms: percentile(samples, 50), p95_ms: percentile(samples, 95),
      confidence: "EXPLORATORY_SMALL_SAMPLE_NOT_RELEASE_PROOF" }]));
}
async function main() {
  verifyDir();
  assert.ok(fs.existsSync(SOURCE), "APP_SOURCE_MISSING");
  // FIRST QA gate: a real owned HTTP server plus fresh Chromium Playwright 200 response.
  await preflight();
  checkLive();
  upstream = await listen(fixtureResponse);
  state.fixtureHost = "127.0.0.1:" + upstream.port;
  for (const entry of [["baseline", MAIN], ["candidate", CANDIDATE]]) {
    const [label, sha] = entry;
    const folder = makeCheckout(label, sha);
    currentStage("NPM_CI_" + label.toUpperCase());
    npm(["ci", "--no-audit", "--no-fund", "--prefer-offline"], folder);
    const env = qaEnv(upstream.port);
    currentStage("D1_MIGRATE_" + label.toUpperCase());
    wrangler(folder, ["d1", "migrations", "apply", "learning-management-db", "--local", "--config", "wrangler.local.jsonc"], env);
    currentStage("APP_START_" + label.toUpperCase());
    const started = await beginApp(folder, env);
    state.environment[label + "Runtime"] = { ...started, sha };
    try {
      for (const count of (FOCUSED ? [50, 200] : [10, 50, 200])) {
        currentStage("D1_SEED_" + label.toUpperCase() + "_" + count);
        const seeded = seedD1(folder, count, env, label);
        const entry = { label, fixtureCount: count, commandReadback: seeded.queryOutput,
          d1CommandCompleted: true, appPid: started.pid };
        state.measurements.push(entry);
        for (const viewport of (FOCUSED && count === 50
          ? [{ width: 390, height: 844 }]
          : [{ width: 1440, height: 900 }, { width: 800, height: 900 }, { width: 390, height: 844 }])) {
          for (let repeat = 0; repeat < (FOCUSED ? 5 : 3); repeat++) {
            currentStage("CHROMIUM_" + label.toUpperCase() + "_" + count + "_" + viewport.width + "_" + (repeat + 1));
            state.measurements.push(await sample(browser, started.url, count, label, viewport, repeat + 1, started.pid));
          }
        }
      }
    } finally { stopApp(); }
  }
  summarize();
  state.status = "MEASURED_NOT_ACCEPTED";
  state.endTime = new Date().toISOString();
}
try {
  await main();
} catch (error) {
  state.errors.push(String(error?.stack || error).slice(0, 4000));
  state.status = "BLOCKED";
} finally {
  stopApp();
  try { await closeServer(upstream?.server); } catch (error) { state.cleanup.push("upstream close: " + error.message); }
  try { await browser?.close(); } catch (error) { state.cleanup.push("browser close: " + error.message); }
  // Cleanup only self-generated UUID paths. Keep the evidence in _r02_reports.
  for (const folder of [...checkouts].reverse()) {
    try { git(["worktree", "remove", "--force", "--", folder]); state.cleanup.push("removed " + folder); }
    catch (error) { state.cleanup.push("WORKTREE_CLEANUP_FAILED " + folder + " " + String(error.message).slice(0, 200)); }
  }
  try {
    if (selfOwnedPaths.includes(sessionDir) && fs.existsSync(path.join(sessionDir, "QA_OWNERSHIP.json")) &&
        !checkouts.some(folder => fs.existsSync(folder))) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
      state.cleanup.push("removed session-owned npm/fixture files");
    }
  } catch (error) { state.cleanup.push("SESSION_CLEANUP_FAILED " + String(error.message).slice(0, 200)); }
  if (state.cleanup.some(item => item.includes("CLEANUP_FAILED") || item.includes("WORKTREE_CLEANUP_FAILED"))) {
    state.errors.push("QA_CLEANUP_INCOMPLETE_USE_OWNERSHIP_MARKER");
    state.status = "BLOCKED";
  }
  state.endTime ||= new Date().toISOString();
  try {
    fs.mkdirSync(reportsDir, { recursive: true });
    fs.writeFileSync(reportFile, JSON.stringify(state, null, 2));
    console.log("R02_EVIDENCE=" + reportFile);
    console.log("R02_RESULT=" + state.status);
    if (state.errors.length) console.log("R02_BLOCKER=" + state.errors[0].split("\n")[0]);
  } catch (error) { console.error("R02_REPORT_WRITE_FAILED " + error.message); process.exitCode = 1; }
  if (state.status !== "MEASURED_NOT_ACCEPTED") process.exitCode = 1;
}
