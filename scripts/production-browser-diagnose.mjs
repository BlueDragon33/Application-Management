import fs from "node:fs";
import { chromium } from "playwright";

const origin = String(process.env.APPLICATION_MANAGEMENT_PRODUCTION_ORIGIN || "").replace(/\/$/, "");
const token = String(process.env.QA_SESSION_TOKEN || "");
if (!/^https:\/\//.test(origin)) throw new Error("APPLICATION_MANAGEMENT_PRODUCTION_ORIGIN must be HTTPS.");
if (token.length < 32) throw new Error("QA_SESSION_TOKEN missing.");

const url = new URL(origin);
const diagnostics = [];
const push = (kind, value) => {
  const line = `[${kind}] ${value}`;
  diagnostics.push(line);
  console.log(line);
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  locale: "vi-VN",
});
await context.addCookies([{
  name: "__Host-am_prod_session",
  value: token,
  domain: url.hostname,
  path: "/",
  httpOnly: true,
  secure: true,
  sameSite: "Strict",
}]);

const page = await context.newPage();
page.on("console", (message) => {
  if (["error", "warning"].includes(message.type())) push(`console:${message.type()}`, message.text());
});
page.on("pageerror", (error) => push("pageerror", error.stack || error.message));
page.on("requestfailed", (request) => push("requestfailed", `${request.method()} ${request.url()} :: ${request.failure()?.errorText || "unknown"}`));
page.on("response", (response) => {
  if (response.status() >= 400) push("http", `${response.status()} ${response.request().method()} ${response.url()}`);
});

let navigationStatus = 0;
let repairResponse = null;
try {
  const repairPromise = page.waitForResponse((candidate) => {
    try { return new URL(candidate.url()).pathname === "/__repair-cache"; }
    catch { return false; }
  }, { timeout: 45_000 });
  const [response, repair] = await Promise.all([
    page.goto(origin + "/__repair-cache", { waitUntil: "domcontentloaded", timeout: 45_000 }),
    repairPromise,
  ]);
  const repairHeaders = await repair.allHeaders();
  repairResponse = {
    status: repair.status(),
    clearSiteData: repairHeaders["clear-site-data"] ?? "",
    cacheControl: repairHeaders["cache-control"] ?? "",
    location: repairHeaders.location ?? "",
  };
  push("repair", JSON.stringify(repairResponse));
  navigationStatus = response?.status() ?? 0;
  push("navigation", `status=${navigationStatus} url=${page.url()}`);
  await page.waitForTimeout(8_000);

  const snapshot = await page.evaluate(() => ({
    url: location.href,
    title: document.title,
    readyState: document.readyState,
    bodyText: document.body?.innerText ?? "",
    bodyHtmlLength: document.body?.innerHTML.length ?? 0,
    shell: Boolean(document.querySelector(".amv2-shell")),
    gate: Boolean(document.querySelector(".amv2-gate")),
    gateText: document.querySelector(".amv2-gate")?.textContent ?? "",
    scripts: Array.from(document.scripts).map((node) => node.src).filter(Boolean),
    stylesheets: Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map((node) => node.href).filter(Boolean),
  }));

  console.log("=== PRODUCTION_BROWSER_SNAPSHOT ===");
  console.log(JSON.stringify(snapshot, null, 2));
  fs.writeFileSync("/tmp/application-management-production-browser.json", JSON.stringify({ snapshot, repairResponse, diagnostics }, null, 2));
  await page.screenshot({ path: "/tmp/application-management-production-browser.png", fullPage: true });

  if (navigationStatus !== 200) throw new Error(`Authenticated repaired root returned HTTP ${navigationStatus}.`);
  if (!repairResponse || repairResponse.status !== 303) throw new Error("Cache repair route did not return HTTP 303 before redirect.");
  if (!repairResponse.clearSiteData.includes('"cache"')) throw new Error("Cache repair route did not request browser cache clearing.");
  if (repairResponse.clearSiteData.includes('"cookies"') || repairResponse.clearSiteData.includes('"storage"')) {
    throw new Error("Cache repair route must not clear login cookies or local storage.");
  }
  if (!snapshot.url.includes("?fresh=")) throw new Error("Cache repair did not redirect to a revision-busted root.");
  if (snapshot.url.includes("/__login")) throw new Error("QA session was redirected to login.");
  if (!snapshot.bodyText.toLocaleUpperCase("vi-VN").includes("QUẢN TRỊ ỨNG DỤNG")) {
    throw new Error("Production body does not contain the management shell/gate text.");
  }
  if (!snapshot.shell && !snapshot.gate) throw new Error("Neither .amv2-shell nor .amv2-gate rendered.");
  if (diagnostics.some((line) => line.startsWith("[pageerror]"))) throw new Error("Browser pageerror detected.");
  push("result", `PASS shell=${snapshot.shell} gate=${snapshot.gate} bodyChars=${snapshot.bodyText.length}`);
} finally {
  await browser.close();
}
