import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("approved dashboard v2 presentation layers are mounted in deterministic order", () => {
  const page = source("app/page.tsx");
  const base = page.indexOf("management-dashboard-v2.css");
  const reference = page.indexOf("management-dashboard-v2-reference.css");
  const final = page.indexOf("management-dashboard-v2-final.css");
  const typography = page.indexOf("management-dashboard-v2-typography.css");
  assert.ok(base >= 0 && reference > base && final > reference && typography > final);
});

test("desktop overview uses the requested applications-first two-column composition", () => {
  const css = source("app/management-dashboard-v2-final.css");
  assert.match(css, /\.amv2-apps-panel[\s\S]*grid-column:\s*1 !important;[\s\S]*grid-row:\s*1 \/ span 2 !important/);
  assert.match(css, /\.amv2-priority-panel[\s\S]*grid-column:\s*1 !important;[\s\S]*grid-row:\s*3 !important/);
  assert.match(css, /\.amv2-alert-panel[\s\S]*grid-column:\s*2 !important;[\s\S]*grid-row:\s*1 !important/);
  assert.match(css, /\.amv2-quick-panel[\s\S]*grid-column:\s*2 !important;[\s\S]*grid-row:\s*2 !important/);
  assert.match(css, /\.amv2-devices-panel[\s\S]*grid-column:\s*2 !important;[\s\S]*grid-row:\s*3 !important/);
});

test("desktop overview stays viewport-bound and scrolls inside data panels", () => {
  const css = source("app/management-dashboard-v2-final.css");
  assert.match(css, /\.amv2-shell[\s\S]*height:\s*100dvh/);
  assert.match(css, /\.amv2-overview-grid[\s\S]*overflow:\s*hidden !important/);
  assert.match(css, /\.amv2-app-table[\s\S]*overflow:\s*auto/);
});
