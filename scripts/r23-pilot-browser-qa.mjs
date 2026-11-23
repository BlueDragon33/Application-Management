// R2.3: real Chromium evidence for the two pilot presentation shells.
// This is local-only / synthetic identity QA; it cannot authorize G04/G05 or release.
import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "qa-artifacts", "r23-pilot-browser");
mkdirSync(output, { recursive: true });
const port = 5191;
const origin = "http://127.0.0.1:" + port;
const ownerEmail = "r23-isolated-owner@example.test";
const pendingEmail = "r23-isolated-pending@example.test";
const sizes = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 800, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];
const apps = [
  { name: "bauman", route: "/apps/bauman-master-ai", appId: "bauman-master-ai" },
  { name: "price-report", route: "/apps/price-report-tunggiabao", appId: "price-report-tunggiabao" },
];
const report = {
  schema: "application-management.r23-browser-evidence/v1",
  recordedAt: new Date().toISOString(),
  commit: null,
  platform: process.platform,
  nodeVersion: process.version,
  viewportEvidence: [],
  roleEvidence: [],
  timings: [],
  sourceReadback: {
    bauman: "NOT_VERIFIED_BY_THIS_RUNNER",
    priceReport: "NOT_VERIFIED_BY_THIS_RUNNER",
    note: "Client-owned BM-/KT- D1 readback and authorized mutations require separate real-source probes",
  },
  g04: "UNVERIFIED_HUMAN_ROLE_SOURCE_REQUIRED",
  g05: "UNVERIFIED_BASELINE_CAPACITY_REQUIRED",
  errors: [],
};
let server = null;
let browser = null;
let failed = false;

function command(name, args, env = process.env, pipe = false) {
  const onWindows = process.platform === "win32";
  const executable = onWindows && ["npm", "npx"].includes(name) ? name + ".cmd" : name;
  const file = onWindows && executable.endsWith(".cmd") ? (process.env.ComSpec || "cmd.exe") : executable;
  const argv = file === executable ? args : ["/d", "/s", "/c", executable, ...args];
  const result = spawnSync(file, argv, {
    cwd: root, env, shell: false, encoding: "utf8",
    stdio: pipe ? "pipe" : "inherit", timeout: 120000,
  });
  if (result.error || result.status !== 0) {
    throw new Error(name + " failed: " + String(result.error?.message || result.stderr || result.status));
  }
  return result.stdout || "";
}
function preflight() {
  if (existsSync(path.join(root, ".dev.vars"))) throw new Error("Existing .dev.vars: refusal to touch developer state");
  for (const name of [
    "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH",
    "APPLICATION_MANAGEMENT_PRODUCTION_ORIGIN", "APPLICATION_MANAGEMENT_PRODUCTION_D1_DATABASE_ID",
    "APPLICATION_MANAGEMENT_PRODUCTION_READBACK_SECRET",
  ]) if (process.env[name]) throw new Error("Forbidden remote/Production configuration: " + name);
  if (["cloudflare-preview", "cloudflare-production"].includes(process.env.APPLICATION_MANAGEMENT_DEPLOYMENT_CHANNEL)) {
    throw new Error("Forbidden deployment channel");
  }
  const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error("Invalid source SHA");
  if (process.env.R23_EXPECTED_SHA && sha !== process.env.R23_EXPECTED_SHA) {
    throw new Error("Candidate source SHA mismatch: " + sha);
  }
  if (process.env.GITHUB_ACTIONS === "true" && process.env.GITHUB_EVENT_NAME !== "pull_request") {
    throw new Error("GitHub Actions pilot must come from pull_request");
  }
  report.commit = sha;
}
function envFor(email) {
  return {
    ...process.env, LOCAL_DEV_AUTH: "1", LOCAL_DEV_USER_ID: "isolated:" + email,
    LOCAL_DEV_USER_EMAIL: email, LOCAL_DEV_USER_NAME: "R2.3 QA (NOT PRODUCTION)",
    CONTROL_OWNER_EMAILS: ownerEmail, APPLICATION_MANAGEMENT_ACCESS_MODE: "standalone",
    CONTROL_PLANE_NETWORK_MODE: "local", WRANGLER_SEND_METRICS: "false",
    WRANGLER_WRITE_LOGS: "false",
  };
}
async function start(email) {
  const test = await fetch(origin, { signal: AbortSignal.timeout(1800) }).then(() => true).catch(() => false);
  if (test) throw new Error("QA port occupied; refusing to reuse an unrelated process on " + origin);
  const onWindows = process.platform === "win32";
  const exe = onWindows ? process.env.ComSpec || "cmd.exe" : "npm";
  const args = onWindows
    ? ["/d", "/s", "/c", "npm.cmd", "run", "dev", "--", "--host", "127.0.0.1", "--port", String(port), "--strictPort"]
    : ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(port), "--strictPort"];
  server = spawn(exe, args, { cwd: root, env: envFor(email), shell: false, stdio: ["ignore", "pipe", "pipe"] });
  const logs = [];
  server.stdout?.on("data", value => logs.push(String(value)));
  server.stderr?.on("data", value => logs.push(String(value)));
  const until = Date.now() + 90000;
  while (Date.now() < until) {
    if (server.exitCode !== null) throw new Error("Vite stopped: " + logs.join("").slice(-2500));
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(2500) });
      if (response.status === 200) return;
    } catch { /* wait for owned listener only */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error("Vite readiness HTTP 200 timeout: " + logs.join("").slice(-2500));
}
async function stop() {
  if (!server) return;
  const child = server;
  server = null;
  if (process.platform === "win32" && child.pid) {
    spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else child.kill("SIGTERM");
  const until = Date.now() + 10000;
  while (Date.now() < until) {
    const busy = await fetch(origin, { signal: AbortSignal.timeout(1000) }).then(() => true).catch(() => false);
    if (!busy) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
}
function percentile(values, fraction) {
  const ordered = [...values].sort((a,b) => a-b);
  return ordered[Math.max(0, Math.ceil(ordered.length * fraction) - 1)];
}
function rgb(value) {
  const m = String(value).match(/rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
function lightness(parts) {
  const c = parts.map(v => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return c[0]*0.2126 + c[1]*0.7152 + c[2]*0.0722;
}
function contrast(a,b) {
  const l1 = lightness(a), l2 = lightness(b);
  return (Math.max(l1,l2) + 0.05)/(Math.min(l1,l2)+0.05);
}
async function probe(page, app, size) {
  const started = performance.now();
  const response = await page.goto(origin + app.route, { waitUntil: "domcontentloaded", timeout: 60000 });
  assert.equal(response?.status(), 200, app.name + " page response not 200");
  await page.locator('[data-admin-shell="' + "boi-owner-shared-v1" + '"]').waitFor({ timeout: 60000 });
  const elapsedMs = Math.round(performance.now() - started);
  const shell = page.locator('[data-admin-shell="boi-owner-shared-v1"]');
  assert.equal(await shell.getAttribute("data-app-id"), app.appId);
  const geometry = await page.evaluate(() => {
    const el = document.documentElement;
    return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, innerWidth: window.innerWidth };
  });
  assert.ok(geometry.scrollWidth <= geometry.innerWidth + 2, app.name + " horizontal overflow: " + JSON.stringify(geometry));
  const specialist = page.getByRole("button", { name: /Công cụ chuyên biệt/ }).first();
  assert.equal(await specialist.count(), 1);
  await specialist.click();
  assert.equal(await specialist.getAttribute("aria-expanded"), "true");
  const nav = page.locator('nav[aria-label^="Công cụ chuyên biệt"]').first();
  const firstItem = nav.getByRole("button").first();
  await firstItem.focus();
  await page.keyboard.press("Escape");
  assert.equal(await specialist.getAttribute("aria-expanded"), "false");
  assert.equal(await specialist.evaluate(el => document.activeElement === el), true, "Escape focus restore");
  const visual = await page.evaluate(() => {
    const selectors = ["header h1", "aside nav button", "aside [role=status] strong"];
    return selectors.map(selector => {
      const el = document.querySelector(selector);
      if (!el) return { selector, missing: true };
      const color = getComputedStyle(el).color;
      let node = el;
      let background = "rgb(255, 255, 255)";
      while (node) {
        const css = getComputedStyle(node).backgroundColor;
        if (css && !css.includes("0)")) { background = css; break; }
        node = node.parentElement;
      }
      return { selector, color, background };
    });
  });
  const samples = visual.map(item => {
    const fore=rgb(item.color), back=rgb(item.background);
    return { ...item, ratio: fore && back ? Math.round(contrast(fore, back)*100)/100 : null };
  });
  const picture = app.name + "-" + size.name + ".png";
  await page.screenshot({ path: path.join(output, picture), fullPage: true });
  return { app: app.name, viewport: size.name, screenshot: picture, elapsedMs, geometry, keyboardEscape: "PASS", contrastSamples: samples };
}
async function recordOwner(browser) {
  for (const size of sizes) {
    const context = await browser.newContext({ viewport: { width:size.width, height:size.height }, reducedMotion:"reduce" });
    try {
      const page = await context.newPage();
      for (const app of apps) {
        const data = await probe(page, app, size);
        report.viewportEvidence.push(data);
        report.timings.push({ app:app.name, viewport:size.name, sampleMs:data.elapsedMs });
      }
    } finally { await context.close(); }
  }
  for (const app of apps) {
    const series = report.timings.filter(v=>v.app===app.name).map(v=>v.sampleMs);
    report.timings.push({ app: app.name, statistic: "pilot_nav_only", n: series.length, p50Ms: percentile(series,0.5), p95Ms: percentile(series,0.95) });
  }
  report.roleEvidence.push({ role: "local fixture owner", result: "UI_SURFACE_PASS_IF_NO_ERRORS", releaseAuthority: "NONE" });
}
async function recordPendingAndBlocked(browser) {
  const context = await browser.newContext({ viewport:{width:1440,height:900} });
  try {
    const page = await context.newPage();
    for (const app of apps) {
      const response = await page.goto(origin+app.route, { waitUntil:"domcontentloaded", timeout:60000 });
      assert.equal(response?.status(), 200);
      await page.getByText("Thiết bị quản trị đang chờ cấp quyền.").waitFor({timeout:30000});
      assert.equal(await page.locator('[data-admin-shell="boi-owner-shared-v1"]').count(),0);
      report.roleEvidence.push({ app:app.name, role:"pending fixture", result:"DENIED_BEFORE_ADMIN_SHELL" });
      await page.screenshot({ path:path.join(output,app.name+"-pending.png"),fullPage:true });
    }
    // UPDATE is confined to a disposable local QA D1 in this worktree.
    command("npx", [
      "wrangler","d1","execute","learning-management-db","--local",
      "--config","wrangler.local.jsonc","--command",
      "UPDATE control_devices SET status='blocked',blocked_at=CURRENT_TIMESTAMP WHERE email='" + pendingEmail + "'"
    ],envFor(pendingEmail));
    for (const app of apps) {
      await page.goto(origin+app.route,{waitUntil:"domcontentloaded",timeout:60000});
      await page.getByText("Thiết bị quản trị đã bị khóa.").waitFor({timeout:30000});
      assert.equal(await page.locator('[data-admin-shell="boi-owner-shared-v1"]').count(),0);
      report.roleEvidence.push({ app:app.name, role:"blocked fixture", result:"DENIED_BEFORE_ADMIN_SHELL" });
      await page.screenshot({ path:path.join(output,app.name+"-blocked.png"),fullPage:true });
    }
  } finally { await context.close(); }
}
function save() {
  writeFileSync(path.join(output,"report.json"),JSON.stringify(report,null,2)+"\n");
}
try {
  preflight();
  const { chromium } = await import("playwright");
  command("npx",["wrangler","d1","migrations","apply","learning-management-db","--local","--config","wrangler.local.jsonc"],envFor(ownerEmail));
  browser = await chromium.launch({ headless:true });
  await start(ownerEmail);
  await recordOwner(browser);
  await stop();
  await start(pendingEmail);
  await recordPendingAndBlocked(browser);
  report.browserEvidence = "LOCAL_CHROMIUM_OWNER_PENDING_BLOCKED_RESPONSIVE_KEYBOARD_COLLECTED";
} catch (error) {
  failed = true;
  report.errors.push(error instanceof Error ? error.stack || error.message : String(error));
  console.error("[R2.3 QA BLOCKED]",report.errors.at(-1));
} finally {
  await stop().catch(error=>report.errors.push("Cleanup: " + String(error)));
  if (browser) await browser.close().catch(error=>report.errors.push("Browser cleanup: " + String(error)));
  save();
}
console.log(JSON.stringify({candidate:report.commit,viewportCount:report.viewportEvidence.length,roles:report.roleEvidence.length,g04:report.g04,g05:report.g05,errors:report.errors.length}));
if (failed || report.errors.length) process.exitCode=1;
