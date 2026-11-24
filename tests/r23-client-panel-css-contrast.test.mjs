import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const bm = read("app/apps/bauman-master-ai/bauman-admin.module.css");
const kt = read("app/apps/price-report-tunggiabao/price-report-admin.module.css");

test("BM Owner shared shell uses accessible light device surfaces, not legacy dark alpha overlay", () => {
  assert.match(bm, /\.deviceAdminList > article \{[^}]*background: #fff;/s);
  assert.match(bm, /\.deviceAdminSummary \{[^}]*background: #f8fbfd;/s);
  assert.match(bm, /\.deviceAdminList dl > div \{[^}]*background: #f4f8fc;/s);
  assert.match(bm, /\.deviceAdminList dt \{[^}]*font-size: 11px;/s);
  assert.match(bm, /\.deviceAdminList dd \{[^}]*font-size: 12px;/s);
  assert.match(bm, /\.deviceAdminIdentity strong \{[^}]*font-size: 13px;/s);
  assert.match(bm, /\.deviceAdminActions button \{[^}]*font-size: 12px;/s);
  assert.doesNotMatch(bm, /\.deviceAdminList > article\[data-status="blocked"\]\s*\{[^}]*opacity/s);
  assert.doesNotMatch(bm, /\.deviceAdminSummary \{[^}]*rgba\(18, 31, 27/s);
});

test("KT blocked rows remain legible, without whole-card opacity", () => {
  assert.match(kt, /\.deviceList>article\[data-status="blocked"\]\{[^}]*background:#fff9f8/);
  assert.doesNotMatch(kt, /\.deviceList>article\[data-status="blocked"\]\{[^}]*opacity/);
});


function channelLuminance(value) {
  const normalized = value / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}
function contrastRatio(foreground, background) {
  const lum = (hex) => {
    const values = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
    const [r, g, b] = values.map(channelLuminance);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const a = lum(foreground), b = lum(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test("actual shell/KT caption foreground palettes clear WCAG 4.5:1 against sampled backgrounds", () => {
  const base = read("app/application-admin.module.css");
  const label = "#47586f";
  for (const background of ["#ffffff", "#edf4fc", "#f7f9fc", "#fff9f8", "#f8fafc"]) {
    assert.ok(contrastRatio(label, background) >= 4.5, background);
  }
  for (const old of ["#74849a", "#718197", "#6c7a8d", "#708096", "#7a8899", "#738196", "#7b8999"]) {
    assert.ok(!base.includes(old), "Legacy low-contrast shared label: " + old);
  }
  assert.match(base, /\.clientNav small\{color:#47586f/);
  assert.match(base, /\.clientUser small\{color:#47586f/);
  assert.match(kt, /\.deviceList dt\{color:#47586f/);
  assert.match(kt, /\.deviceIdentity small\{[^}]*color:#47586f/);
});


test("shared Owner topbar descriptions meet opaque/background-composited 4.5:1 target", () => {
  const base = read("app/application-admin.module.css");
  assert.match(base, /\.workspaceTopbar p\{[^}]*color:#47586f/);
  // Topbar background is rgba(243,246,250,.96) over a light page.
  assert.ok(contrastRatio("#47586f","#f3f6fa") >= 4.5);
  assert.ok(contrastRatio("#47586f","#ffffff") >= 4.5);
});
