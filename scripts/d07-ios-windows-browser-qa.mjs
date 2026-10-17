/**
 * Windows real-browser D07 development smoke. The only allowed identity is
 * a localhost-scoped local-dev fixture already supported by chatgpt-auth.ts.
 *
 * This is NOT authenticated Owner/Editor production acceptance, does not
 * simulate a physical iPhone, and does not change a real client registry.
 * Browser outbound requests are blocked except explicit loopback.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = 3377;
const origin = `http://127.0.0.1:${port}`;
const artifacts = path.join(root, "qa-artifacts", "d07-ios-windows");
let server;
let browser;
const serverLog = [];

function report(stage, details = {}) {
  console.log(JSON.stringify({
    stage,
    project: "Bauman-Russian-iOS",
    acceptance: "D07_DEVELOPMENT_BROWSER_ONLY",
    realOwnerAuthenticated: false,
    physicalDeviceAccepted: false,
    appRuntimeEnrolled: false,
    nativeLauncherVerified: false,
    ...details,
  }));
}

async function waitForServer(maxMs = 120_000) {
  const endAt = Date.now() + maxMs;
  while (Date.now() < endAt) {
    if (server.exitCode !== null) {
      throw new Error("Local Vite server exited before D07: " + serverLog.slice(-16).join("\n"));
    }
    try {
      const response = await fetch(origin + "/projects", { redirect: "manual" });
      if (response.status >= 200 && response.status < 500) return;
    } catch { /* Vite startup is not finished */ }
    await sleep(1_500);
  }
  throw new Error("Local Vite server timed out: " + serverLog.slice(-16).join("\n"));
}

async function run() {
  assert.equal(process.platform, "win32", "This probe must execute on a real Windows runner");
  await mkdir(artifacts, { recursive: true });

  // Never bind to a public interface or use a real account/production secret.
  server = spawn(process.execPath,
    [path.join(root, "node_modules", "vite", "bin", "vite.js"),
      "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    {
      cwd: root,
      env: {
        ...process.env,
        CI: "1",
        APP_RUNTIME: "local",
        APPLICATION_MANAGEMENT_ACCESS_MODE: "standalone",
        LOCAL_DEV_AUTH: "1",
        LOCAL_DEV_USER_ID: "local:d07-ci-fixture",
        LOCAL_DEV_USER_EMAIL: "d07-fixture@local.invalid",
        LOCAL_DEV_USER_NAME: "D07 Local Fixture",
        CONTROL_PLANE_NETWORK_MODE: "local-only",
        WRANGLER_SEND_METRICS: "false",
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
  server.stdout.on("data", chunk => {
    serverLog.push(...String(chunk).split("\n").filter(Boolean));
    if (serverLog.length > 200) serverLog.splice(0, serverLog.length - 200);
  });
  server.stderr.on("data", chunk => {
    serverLog.push(...String(chunk).split("\n").filter(Boolean));
    if (serverLog.length > 200) serverLog.splice(0, serverLog.length - 200);
  });

  await waitForServer();
  browser = await chromium.launch({ headless: true, channel: "msedge" });
  const context = await browser.newContext({ viewport: { width: 1365, height: 920 } });
  const deniedOrigins = [];
  await context.route("**/*", route => {
    const requestUrl = route.request().url();
    if (requestUrl.startsWith(origin + "/")) return route.continue();
    deniedOrigins.push(new URL(requestUrl).origin);
    return route.abort();
  });

  const page = await context.newPage();
  const response = await page.goto(origin + "/projects", {
    waitUntil: "domcontentloaded", timeout: 90_000,
  });
  assert.equal(response?.status(), 200, "Expected localhost development identity to pass");
  await page.getByRole("heading", { name: "Toàn bộ dự án GitHub" }).waitFor();

  const card = page.locator("article.card")
    .filter({ has: page.getByRole("heading", { name: "Bauman Russian iOS", exact: true }) });
  assert.equal(await card.count(), 1);
  assert.equal(await card.locator('[data-state="developing"]').innerText(), "Đang phát triển");
  assert.match(await card.innerText(), /Thuộc Bauman Master AI/);
  const actions = card.locator(".actions a");
  assert.deepEqual(await actions.allTextContents(), ["Code ↗", "Issues ↗", "Actions ↗"]);
  const urls = await actions.evaluateAll(els => els.map(el => el.getAttribute("href")));
  assert.deepEqual(urls, [
    "https://github.com/BlueDragon33/Bauman-Russian-iOS",
    "https://github.com/BlueDragon33/Bauman-Russian-iOS/issues",
    "https://github.com/BlueDragon33/Bauman-Russian-iOS/actions",
  ]);
  assert.equal(await card.getByRole("link", { name: "Quản trị" }).count(), 0);
  assert.doesNotMatch(await card.innerHTML(), /baumanrussian:\/\//i);
  assert.equal(await page.locator('a[href*="baumanrussian://"]').count(), 0);
  await page.screenshot({
    path: path.join(artifacts, "d07-developing-catalog-local-dev.png"),
    fullPage: true,
  });

  const search = page.getByPlaceholder("Tìm repo, dự án, module cũ, lĩnh vực…");
  await search.fill("Bauman-Russian-iOS");
  assert.equal(await card.count(), 1, "Search must find the exact repository");
  await context.setOffline(true);
  await search.fill("no-such-nonexistent-repository");
  assert.equal(await card.count(), 0, "Client-side filtering must work with network disabled");
  await search.fill("Bauman Russian iOS");
  assert.equal(await card.count(), 1, "Offline filtering must recover without backend");
  await context.setOffline(false);

  assert.equal(deniedOrigins.length, 0,
    "Page required external navigation/resource: " + deniedOrigins.join(", "));
  report("WINDOWS_BROWSER_COMPONENT_AND_LOCAL_DEV_ROUTE_PASS", {
    mode: "localhost + explicitly scoped local-dev fixture",
    checks: ["Vite localhost route", "actual browser DOM", "developing badge",
      "Bauman relation", "correct repository action URLs", "no fake native launcher",
      "search", "client-only offline search"],
    note: "No real Owner/Editor session, authenticated user acceptance or Windows PC readback.",
  });
  await context.close();
}

try {
  await run();
} catch (error) {
  report("WINDOWS_LOCAL_BROWSER_BLOCKED", {
    error: error instanceof Error ? error.message : String(error),
    serverTail: serverLog.slice(-12),
  });
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) {
    if (process.platform === "win32" && server.pid) {
      await new Promise(resolve => {
        const killer = spawn("taskkill", ["/T", "/F", "/PID", String(server.pid)],
          { windowsHide: true, stdio: "ignore" });
        killer.once("exit", resolve);
        killer.once("error", resolve);
      });
    } else if (!server.killed) server.kill();
  }
}
