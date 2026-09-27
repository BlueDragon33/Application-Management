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

test("dashboard v2 owns the PWA install lifecycle natively", () => {
  assert.match(dashboard, /type InstallPromptEvent/);
  assert.match(dashboard, /navigator\.serviceWorker\.register\("\/sw\.js"\)/);
  assert.match(dashboard, /beforeinstallprompt/);
  assert.match(dashboard, /appinstalled/);
  assert.match(dashboard, /installWebApp/);
  assert.match(dashboard, /Cài Web-App/);
  assert.match(dashboard, /amv2-install-fab/);
});

test("install action remains visible even when Chromium has not emitted beforeinstallprompt", () => {
  assert.match(dashboard, /!appInstalled \? <button className="amv2-install-fab"/);
  assert.match(dashboard, /appInstalled \? <span className="amv2-installed-note">✓ Đã cài Web-App<\/span> : <button onClick=\{\(\) => void installWebApp\(\)\}>⇩ Cài Web-App<\/button>/);
  assert.match(dashboard, /if \(!installPrompt\) \{\s*setInstallHelpOpen\(true\)/);
  assert.match(dashboard, /Chrome chưa phát hộp thoại cài tự động/);
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

test("install controls are styled above the dashboard without changing page geometry", () => {
  assert.match(css, /\.amv2-install-fab/);
  assert.match(css, /position: fixed/);
  assert.match(css, /\.amv2-installed-note/);
  assert.match(css, /\.amv2-install-dialog/);
});
