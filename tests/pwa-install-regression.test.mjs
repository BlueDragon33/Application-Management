import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const dashboard = source("app/management-dashboard-v2.tsx");
const css = source("app/management-dashboard-v2.css");
const manifest = JSON.parse(source("public/manifest.webmanifest"));
const sw = source("public/sw.js");

test("dashboard keeps PWA runtime without surfacing install prompts", () => {
  assert.match(dashboard, /navigator\.serviceWorker\.register\("\/sw\.js"\)/);
  assert.doesNotMatch(dashboard, /type InstallPromptEvent/);
  assert.doesNotMatch(dashboard, /beforeinstallprompt/);
  assert.doesNotMatch(dashboard, /appinstalled/);
  assert.doesNotMatch(dashboard, /installWebApp/);
  assert.doesNotMatch(dashboard, /Cài Web-App/);
  assert.doesNotMatch(dashboard, /amv2-install-fab/);
  assert.doesNotMatch(dashboard, /installHelpOpen/);
});

test("manifest exposes installable PNG sizes plus scalable identity", () => {
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.id, "/");
  assert.equal(manifest.prefer_related_applications, false);
  const icons = new Map(manifest.icons.map((icon) => [icon.sizes, icon]));
  assert.equal(icons.get("192x192")?.src, "/icon-192.png");
  assert.equal(icons.get("512x512")?.src, "/icon-512.png");
  assert.ok(manifest.icons.some((icon) => icon.src === "/favicon.svg"));
});

test("service worker keeps an offline fetch handler and has the current cache identity", () => {
  assert.match(sw, /application-management-webapp-v2/);
  assert.match(sw, /addEventListener\("fetch"/);
  assert.match(sw, /offline\.html/);
});

test("legacy install styles cannot re-enable an install control without dashboard markup", () => {
  assert.equal(dashboard.includes("amv2-install-fab"), false);
  assert.equal(dashboard.includes("amv2-install-dialog"), false);
  assert.equal(dashboard.includes("amv2-installed-note"), false);
  assert.ok(css.length > 0);
});
