import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../app/management-dashboard-v2.tsx", import.meta.url), "utf8");

function accountBlock() {
  const start = source.indexOf("function AccountSecurityDialog");
  assert.ok(start >= 0);
  return source.slice(start);
}

test("account dialog moves focus inside and restores the opener", () => {
  const block = accountBlock();
  assert.match(block, /const dialogRef = useRef<HTMLElement \| null>\(null\)/);
  assert.match(block, /const closeButtonRef = useRef<HTMLButtonElement \| null>\(null\)/);
  assert.match(block, /openerRef\.current = document\.activeElement instanceof HTMLElement/);
  assert.match(block, /closeButtonRef\.current\?\.focus\(\)/);
  assert.match(block, /openerRef\.current\?\.focus\(\)/);
});

test("account dialog supports Escape and keeps Tab focus inside", () => {
  const block = accountBlock();
  assert.match(block, /if \(event\.key === "Escape"\)/);
  assert.match(block, /if \(event\.key !== "Tab"\) return/);
  assert.match(block, /querySelectorAll<HTMLElement>/);
  assert.match(block, /event\.shiftKey && document\.activeElement === first/);
  assert.match(block, /!event\.shiftKey && document\.activeElement === last/);
  assert.match(block, /aria-modal="true"[\s\S]{0,220}onKeyDown=\{handleKeyDown\}/);
});
