import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("compact table stylesheet is mounted after final dashboard styles", () => {
  const page = source("app/page.tsx");
  const final = page.indexOf('management-dashboard-v2-final.css');
  const compact = page.indexOf('management-dashboard-v2-compact-tables.css');
  assert.ok(final >= 0 && compact > final);
});

test("application table uses compact visible labels and no horizontal scrolling", () => {
  const css = source("app/management-dashboard-v2-compact-tables.css");
  assert.match(css, /content:\s*"Phân loại"/);
  assert.match(css, /content:\s*"Chờ xử lý"/);
  assert.match(css, /content:\s*"Online"/);
  assert.match(css, /\.amv2-app-table,[\s\S]*overflow-x:\s*hidden\s*!important/);
  assert.match(css, /\.amv2-app-head,[\s\S]*min-width:\s*0\s*!important/);
});

test("Website and Quản Trị controls stay centered under their headings", () => {
  const css = source("app/management-dashboard-v2-compact-tables.css");
  assert.match(css, /\.amv2-app-head > span:nth-child\(6\)/);
  assert.match(css, /\.amv2-app-head > span:nth-child\(7\)/);
  assert.match(css, /\.amv2-web-action,[\s\S]*justify-self:\s*center/);
});

test("priority and device tables also resolve inside their panels", () => {
  const css = source("app/management-dashboard-v2-compact-tables.css");
  assert.match(css, /\.amv2-priority-head,[\s\S]*width:\s*100%\s*!important/);
  assert.match(css, /\.amv2-device-head,[\s\S]*width:\s*100%\s*!important/);
  assert.match(css, /content:\s*"Thiết bị mới"/);
});
