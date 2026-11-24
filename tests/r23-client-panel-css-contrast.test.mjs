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
