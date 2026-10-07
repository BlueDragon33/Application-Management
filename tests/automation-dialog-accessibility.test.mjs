import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../app/automatic-device-policies.tsx", import.meta.url), "utf8");

test("automation dialog moves focus inside and restores the opener on close", () => {
  assert.match(source, /const dialogRef = useRef<HTMLElement \| null>\(null\)/);
  assert.match(source, /const closeButtonRef = useRef<HTMLButtonElement \| null>\(null\)/);
  assert.match(source, /openerRef\.current = document\.activeElement instanceof HTMLElement/);
  assert.match(source, /closeButtonRef\.current\?\.focus\(\)/);
  assert.match(source, /return \(\) => \{\s*openerRef\.current\?\.focus\(\);\s*\}/);
});

test("automation dialog supports Escape and traps keyboard focus", () => {
  assert.match(source, /if \(event\.key === "Escape"\)/);
  assert.match(source, /if \(!locked\) close\(\)/);
  assert.match(source, /if \(event\.key !== "Tab"\) return/);
  assert.match(source, /querySelectorAll<HTMLElement>/);
  assert.match(source, /event\.shiftKey && document\.activeElement === first/);
  assert.match(source, /!event\.shiftKey && document\.activeElement === last/);
  assert.match(source, /aria-modal="true"[\s\S]{0,180}onKeyDown=\{handleDialogKeyDown\}/);
});
