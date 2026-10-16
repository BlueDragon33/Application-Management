import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const registry = fs.readFileSync("app/application-registry.ts", "utf8");
const dashboard = fs.readFileSync("app/management-dashboard-v2.tsx", "utf8");
const workspace = fs.readFileSync("app/application-workspace.tsx", "utf8");

test("PC Manager has an exact allowlisted offline Windows launch, no online web URL", () => {
  const entry = registry.match(/id: "pc-manager", name: "PC Manager Desktop"[\s\S]*?\n  },/);
  assert.ok(entry, "static PC Manager registry entry required");
  assert.match(entry[0], /desktopLaunchUrl: "pcmanager:\/\/open"/);
  assert.doesNotMatch(entry[0], /publicUrl:\s*"https?:\/\//);
  assert.doesNotMatch(entry[0], /localUrl:\s*"http:/);
  assert.match(entry[0], /contractState: "migrating"/);
});

test("Main application icon launches through Windows only, never local HTTP or remote shell", () => {
  assert.match(dashboard, /hasOfflineWeb\(app\.id\) \|\| Boolean\(app\.desktopLaunchUrl\)/);
  assert.match(dashboard, /app\.id !== "pc-manager" \|\| app\.desktopLaunchUrl !== "pcmanager:\/\/open"/);
  assert.match(dashboard, /!\/Windows\/i\.test\(navigator\.userAgent\)/);
  assert.match(dashboard, /window\.open\(app\.desktopLaunchUrl, "_blank", "noopener,noreferrer"\)/);
  assert.match(dashboard, /Mở ứng dụng cục bộ/);
  assert.match(dashboard, /chưa xác nhận ứng dụng đã chạy/);
  assert.match(dashboard, /tự đăng ký pcmanager/);
});

test("Denied web policy is checked before any desktop handoff", () => {
  const start = dashboard.indexOf("async function launchWeb(appId: string)");
  const policy = dashboard.indexOf('summary?.webAccessPolicy === "deny"', start);
  const desktop = dashboard.indexOf("if (app?.desktopLaunchUrl)", start);
  assert.ok(start >= 0 && policy > start && desktop > policy);
});

test("Managed workspace provides a clearly labeled local offline link", () => {
  assert.match(workspace, /href=\{application\.desktopLaunchUrl\}/);
  assert.match(workspace, /Mở PC Manager cục bộ/);
});
