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

test("PC Manager Windows handoff remains isolated from Overview admin navigation", () => {
  assert.match(dashboard, /app\.desktopLaunchUrl \|\| summary\?\.webHref/);
  assert.match(dashboard, /app\.id !== "pc-manager" \|\| app\.desktopLaunchUrl !== "pcmanager:\/\/open"/);
  assert.match(dashboard, /!\/Windows\/i\.test\(navigator\.userAgent\)/);
  assert.match(dashboard, /window\.open\(app\.desktopLaunchUrl, "_blank", "noopener,noreferrer"\)/);
  const overview = dashboard.slice(
    dashboard.indexOf('className="amv2-panel amv2-apps-panel amv2-overview-apps-launcher"'),
    dashboard.indexOf('className="amv2-panel amv2-devices-panel"'),
  );
  assert.match(overview, /item\.kind === "app" \? item\.manageHref : item\.href/);
  assert.doesNotMatch(overview, /void launchWeb\(item\.id\)|pcmanager:\/\/open/);
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
