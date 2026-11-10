// Opt-in, local-only browser acceptance for the two academic workspaces.
// Requires an owner-started local app on 127.0.0.1:3000 and an installed Playwright Chromium.
// This script must NEVER publish, log in to Cloudflare, or accept a public Preview/Production URL.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
assert.equal(args[0], "--sha", "Usage: node scripts/academic-workspaces-browser-qa.mjs --sha <exact-40-character-HEAD>");
const expected = args[1] || "";
assert.match(expected, /^[0-9a-f]{40}$/, "A full exact source SHA is required");
assert.equal(args.length, 2, "Only --sha is supported; URL overrides are forbidden");
const actual = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
assert.equal(actual, expected, "STOP: checkout does not match requested exact QA SHA");
const changed = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" }).trim();
assert.equal(changed, "", "STOP: tracked source changes are present; QA would not represent the exact SHA");

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  throw new Error("Playwright not found. For local-only QA, install with npm install --no-save --package-lock=false --ignore-scripts playwright@1.55.1, then npx playwright install chromium.");
}
const origin = "http://127.0.0.1:3000";
const outputDir = mkdtempSync(path.join(tmpdir(), "academic-browser-qa-"));
const checks = [];
const failures = [];
const pageErrors = [];
function record(name, value, detail = "") {
  checks.push({ name, pass: value, detail });
  if (!value) failures.push({ name, detail });
  console.log((value ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : ""));
}
function rgb(text) {
  const match = String(text).match(/^rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)/);
  assert.ok(match, "Expected an opaque computed RGB color, got: " + text);
  return match.slice(1, 4).map(Number);
}
function lum(color) {
  const linear = rgb(color).map(value => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}
function contrast(a, b) {
  const l = [lum(a), lum(b)].sort((x, y) => x - y);
  return (l[1] + 0.05) / (l[0] + 0.05);
}
async function computedContrast(locator, kind) {
  const pairs = await locator.evaluate(element => {
    const style = getComputedStyle(element);
    return {
      foreground: style.color,
      border: style.borderTopColor,
      background: style.backgroundColor,
      backgroundImage: style.backgroundImage,
    };
  });
  assert.equal(pairs.backgroundImage, "none", "Gradient requires separate rendered-pixel inspection");
  assert.match(pairs.background, /^rgb\(/, "Opaque background required for single-pair contrast");
  const ratio = contrast(kind === "border" ? pairs.border : pairs.foreground, pairs.background);
  return { ratio: Math.round(ratio * 100) / 100, ...pairs };
}
function fileBytes(filePath) { return readFileSync(filePath); }
async function clickGuide(page, expectedTarget) {
  const action = page.getByRole("button", { name: "HƯỚNG DẪN / MỞ VIỆC TIẾP THEO" });
  assert.equal(await action.count(), 1);
  await action.click();
  await page.waitForFunction(id => document.activeElement?.id === id, expectedTarget);
  record("Next Action focuses " + expectedTarget, true);
}
async function setJsonImport(page, value, expectConfirm = true) {
  if (expectConfirm) page.once("dialog", dialog => dialog.accept());
  await page.locator('input[type="file"]').setInputFiles({
    name: "qa-restore.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(value), "utf8"),
  });
}
async function visualSizes(page, label) {
  for (const width of [320, 375, 430, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: path.join(outputDir, label + "-" + width + ".png"), fullPage: true });
    const data = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    const ok = data.scrollWidth <= data.clientWidth + 1;
    record(label + " horizontal overflow " + width + "px", ok,
      "scrollWidth=" + data.scrollWidth + ", viewport=" + data.clientWidth);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
}
async function verifyImportKeyboard(page, label) {
  const input = page.locator('input[type="file"]');
  await input.focus();
  const styles = await input.evaluate(element => {
    const parent = element.closest("label");
    return {
      focused: document.activeElement === element,
      visibleParent: Boolean(parent),
      outline: parent ? getComputedStyle(parent).outlineStyle : "none",
    };
  });
  record(label + " keyboard import focus", styles.focused && styles.visibleParent && styles.outline !== "none",
    "outline=" + styles.outline);
}
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "vi-VN", acceptDownloads: true });
  // Block any external network request. Browser state is a fresh disposable profile.
  await context.route("**/*", async route => {
    const u = new URL(route.request().url());
    if (u.origin !== origin) return route.abort("blockedbyclient");
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", error => pageErrors.push(error.message));
  const thesisRoute = origin + "/tools/thesis-planner";
  const courseworkRoute = origin + "/apps/coursework-workbench";
  let response = await page.goto(thesisRoute, { waitUntil: "domcontentloaded", timeout: 45000 });
  assert.equal(response?.status(), 200, "Local Thesis route is inaccessible or redirected to login");
  await page.getByRole("heading", { name: /Thesis Planner/ }).waitFor({ state: "visible" });
  record("real Chromium local Thesis route", true);
  await clickGuide(page, "thesis-task-scope");
  await verifyImportKeyboard(page, "Thesis");
  const thesisCta = await computedContrast(page.getByRole("button", { name: "HƯỚNG DẪN / MỞ VIỆC TIẾP THEO" }), "text");
  record("Thesis CTA rendered solid-surface contrast", thesisCta.ratio >= 4.5, "ratio=" + thesisCta.ratio);
  const thesisInput = await computedContrast(page.locator('input[type="text"]').first(), "border");
  record("Thesis text input border contrast", thesisInput.ratio >= 3, "ratio=" + thesisInput.ratio);
  const topic = page.locator('input[type="text"]').first();
  await topic.fill("Local Chromium QA thesis sample");
  await page.reload({ waitUntil: "domcontentloaded" });
  assert.equal(await topic.inputValue(), "Local Chromium QA thesis sample");
  record("Thesis saved text survives reload", true);
  const thesisDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất JSON" }).click();
  const thesisFile = await thesisDownload;
  const thesisBackup = JSON.parse(fileBytes(await thesisFile.path()).toString("utf8"));
  assert.equal(thesisBackup.schema, "thesis-planner/v1");
  record("Thesis export generates schema-versioned JSON", true);
  await setJsonImport(page, thesisBackup);
  await page.getByRole("status").filter({ hasText: "Đã nhập bản sao lưu" }).waitFor();
  record("Thesis JSON import accepted by browser", true);
  await visualSizes(page, "thesis");

  response = await page.goto(courseworkRoute, { waitUntil: "domcontentloaded", timeout: 45000 });
  assert.equal(response?.status(), 200, "Local Coursework route is inaccessible or redirected to login");
  await page.getByRole("heading", { name: /Coursework Workbench/ }).waitFor({ state: "visible" });
  record("real Chromium local Coursework route", true);
  await clickGuide(page, "coursework-create");
  await verifyImportKeyboard(page, "Coursework");
  const courseworkCta = await computedContrast(page.getByRole("button", { name: "HƯỚNG DẪN / MỞ VIỆC TIẾP THEO" }), "text");
  record("Coursework CTA rendered solid-surface contrast", courseworkCta.ratio >= 4.5, "ratio=" + courseworkCta.ratio);
  const courseworkInput = await computedContrast(page.locator('form input[type="text"]').first(), "border");
  record("Coursework input border contrast", courseworkInput.ratio >= 3, "ratio=" + courseworkInput.ratio);
  await page.locator('form input[type="text"]').nth(0).fill("Local QA coursework A");
  await page.locator('form input[type="text"]').nth(1).fill("Algorithms");
  await page.getByRole("button", { name: /Tạo bài tập/ }).click();
  await clickGuide(page, "coursework-stage-brief");
  await page.locator('form input[type="text"]').nth(0).fill("Local QA coursework B");
  await page.locator('form input[type="text"]').nth(1).fill("Databases");
  await page.getByRole("button", { name: /Tạo bài tập/ }).click();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Local QA coursework A/ }).waitFor();
  await page.getByRole("button", { name: /Local QA coursework B/ }).waitFor();
  record("Coursework two independent tasks survive reload", true);
  const courseDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất JSON" }).click();
  const courseFile = await courseDownload;
  const courseBackup = JSON.parse(fileBytes(await courseFile.path()).toString("utf8"));
  assert.equal(courseBackup.schema, "coursework-workbench/v1");
  assert.equal(courseBackup.projects.length, 2);
  await setJsonImport(page, courseBackup);
  await page.getByRole("status").filter({ hasText: "Đã khôi phục dữ liệu cục bộ" }).waitFor();
  record("Coursework JSON export/import retains 2 projects", true);
  await visualSizes(page, "coursework");
  record("Browser page errors absent", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 500));
  await context.close();
} catch (error) {
  failures.push({ name: "browser-runner", detail: String(error?.stack ?? error) });
  console.error("BROWSER QA FAIL: " + String(error?.stack ?? error));
} finally {
  if (browser) await browser.close();
}
const report = {
  sourceRevision: expected,
  origin,
  runtime: "owner-controlled local Chromium; disposable browser profile; loopback-only",
  status: failures.length ? "FAIL" : "PASS_LOCAL_CHROMIUM_ONLY",
  checks,
  failures,
  browserErrors: pageErrors,
  pending: [
    "Physical iPhone Safari",
    "Real assistive technology (VoiceOver/screen reader)",
    "Gradient composited color and all state permutations",
    "Independent human UX review",
    "Offline installed cold-start",
    "Production/merge authority",
  ],
};
const reportFile = path.join(outputDir, "qa-report.json");
writeFileSync(reportFile, JSON.stringify(report, null, 2));
console.log("QA report/screenshot directory: " + outputDir);
console.log("Status: " + report.status);
if (failures.length) process.exitCode = 1;
