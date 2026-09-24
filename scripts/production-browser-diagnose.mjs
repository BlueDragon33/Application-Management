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
try {
  const response = await page.goto(origin + "/", { waitUntil: "domcontentloaded", timeout: 45_000 });
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
  fs.writeFileSync("/tmp/application-management-production-browser.json", JSON.stringify({ snapshot, diagnostics }, null, 2));
  await page.screenshot({ path: "/tmp/application-management-production-browser.png", fullPage: true });

  if (navigationStatus !== 200) throw new Error(`Authenticated root returned HTTP ${navigationStatus}.`);
  if (snapshot.url.includes("/__login")) throw new Error("QA session was redirected to login.");
  if (!snapshot.bodyText.includes("Quản trị Ứng dụng")) throw new Error("Production body does not contain the management shell/gate text.");
  if (!snapshot.shell && !snapshot.gate) throw new Error("Neither .amv2-shell nor .amv2-gate rendered.");
  if (diagnostics.some((line) => line.startsWith("[pageerror]"))) throw new Error("Browser pageerror detected.");
  push("result", `PASS shell=${snapshot.shell} gate=${snapshot.gate} bodyChars=${snapshot.bodyText.length}`);
} finally {
  await browser.close();
}
