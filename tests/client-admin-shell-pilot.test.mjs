import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const shell = read("app/components/client-admin-shell.tsx");
const css = read("app/components/client-admin-shell.module.css");
const bauman = read("app/apps/bauman-master-ai/bauman-admin.tsx");
const price = read("app/apps/price-report-tunggiabao/price-report-admin.tsx");
const boi = read("app/apps/boi-ech/boi-ech-control-center.tsx");

test("shared shell extracts Bơi Ếch Owner's primary/specialist pattern without copying business code", () => {
  assert.match(boi, /Công cụ chuyên biệt/);
  assert.match(boi, /aria-current=/);
  assert.match(shell, /function ClientAdminSidebar/);
  assert.match(shell, /function ClientAdminTopbar/);
  assert.match(shell, /Công cụ chuyên biệt/);
  assert.match(shell, /aria-current=/);
  assert.match(shell, /aria-expanded=/);
  assert.match(shell, /aria-controls=/);
  assert.match(shell, /aria-label=/);
  assert.match(css, /\.specialistNav\[hidden\]/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
});

test("Bauman pilot uses shared navigation/header without changing device contract or source ownership", () => {
  assert.match(bauman, /<ClientAdminSidebar<View>/);
  assert.match(bauman, /<ClientAdminTopbar/);
  assert.doesNotMatch(bauman, /<aside className=/);
  for (const title of ["Tổng quan", "Thiết bị & truy cập", "Sub-client", "Contract"]) {
    assert.ok(bauman.includes(title));
  }
  assert.match(bauman, /onSelect=\{setView\}/);
  assert.match(bauman, /action: "manage-client-device"/);
  assert.match(bauman, /expectedStatus: device\.status/);
  assert.match(bauman, /appId=\{BAUMAN_APP_ID\}/);
  assert.match(bauman, /if \(!access \|\| access\.status !== "approved"\)/);
});

test("PriceReport pilot shares shell but preserves KT authorization, contract and own registry", () => {
  assert.match(price, /<ClientAdminSidebar<View>/);
  assert.match(price, /<ClientAdminTopbar/);
  assert.doesNotMatch(price, /<aside className=/);
  for (const title of ["Tổng quan", "Thiết bị & quyền", "Giao diện thiết bị", "Contract"]) {
    assert.ok(price.includes(title));
  }
  assert.match(price, /appId=\{APP_ID\}/);
  assert.match(price, /price-report-tunggiabao/);
  assert.match(price, /remoteAdminReady/);
  assert.match(price, /connectOperationsDashboard/);
  assert.match(price, /if \(!access \|\| access\.status !== "approved"\)/);
});

test("shared presentation has no backend writes, unbounded timers or role bypass", () => {
  assert.doesNotMatch(shell, /fetch\s*\(|operationsAction|secureApi|manage-client-device|window\.location/);
  assert.doesNotMatch(shell, /localStorage|sessionStorage|document\.cookie|setInterval/);
  assert.match(shell, /onSelect: \(view: T\) => void/);
  assert.match(shell, /boundary: \{ title: string; description: string \}/);
  assert.match(shell, /data-status=\{connection\.state\}/);
});

test("Escape from an open specialist submenu restores focus before hiding the focused subtree", () => {
  assert.match(shell, /useRef<HTMLButtonElement>\(null\)/);
  assert.match(shell, /ref=\{specialistTriggerRef\}/);
  const handler = shell.match(/if \(event\.key === "Escape"\) \{([\s\S]*?)\n\s*\}/)?.[1] ?? "";
  assert.match(handler, /specialistTriggerRef\.current\?\.focus\(\)/);
  assert.match(handler, /setSpecialistOpen\(false\)/);
  assert.ok(
    handler.indexOf("specialistTriggerRef.current?.focus()") <
    handler.indexOf("setSpecialistOpen(false)"),
    "Focus must move to the visible trigger before the specialist nav becomes hidden",
  );
});
