import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const src = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const admin = src("app/apps/boi-ech/boi-ech-control-center.tsx");
const scopedCss = src("app/apps/boi-ech/boi-ech-shell.module.css");
const entry = src("app/apps/boi-ech/page.tsx");

test("Bơi Ếch admin shell adopts prepublish manager home cards, never the public learner interface", () => {
  assert.match(admin,/className="boi-manager-welcome"/);
  assert.match(admin,/Mọi việc trong tầm tay/);
  assert.match(admin,/className="boi-manager-quick"/);
  assert.match(admin,/className="boi-manager-dock"/);
  assert.match(entry,/BoiEchControlCenter/);
  assert.doesNotMatch(admin,/import .*manager-workspace/);
});
test("Prepublish manager-inspired navigation keeps existing authorized actions and original server contract", () => {
  assert.match(admin,/onClick=\{\(\) => setTab\("devices"\)\}/);
  assert.match(admin,/onClick=\{\(\) => setTab\("ai"\)\}/);
  assert.match(admin,/\["reviewer","publisher","owner"\]\.includes\(access\.role\) \? <button/);
  assert.match(admin,/getProof|secureApi\("/);
  assert.match(admin,/\bboiApi\(/);
  assert.match(admin,/const visibleDevices = useMemo/);
  assert.doesNotMatch(admin,/window\.location\.assign\("/);
});
test("Manager visual tokens stay within the Bơi Ếch CSS module and are phone-usable", () => {
  assert.match(scopedCss,/prepublish Cán bộ quản lý/);
  assert.match(scopedCss,/\.scope :global\(\.boi-manager-quick\)/);
  assert.match(scopedCss,/\.scope :global\(\.boi-manager-dock\)/);
  assert.match(scopedCss,/@media \(max-width: 820px\)/);
  assert.match(scopedCss,/safe-area-inset-bottom/);
  assert.match(scopedCss,/:focus-visible/);
  assert.doesNotMatch(scopedCss,/^body\s*\{|^:root\s*\{/m);
});
