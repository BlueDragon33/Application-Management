import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync("app/tools/deploy-ops/page.tsx", "utf8");
const source = fs.readFileSync("app/tools/deploy-ops/deploy-ops.tsx", "utf8");
const css = fs.readFileSync("app/tools/deploy-ops/deploy-ops.module.css", "utf8");
const dashboard = fs.readFileSync("app/management-dashboard-v2.tsx", "utf8");

test("Deploy & Ops is an authenticated canonical Tool", () => {
  assert.match(page, /requireChatGPTUser\("\/tools\/deploy-ops"\)/);
  assert.match(dashboard, /id: "tool-deploy-ops"/);
  assert.match(dashboard, /href: "\/tools\/deploy-ops"/);
  assert.match(source, /VERCEL · NEON · TINYFISH/);
});

test("prototype never performs vendor network calls or accepts secrets", () => {
  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.doesNotMatch(source, /XMLHttpRequest/);
  assert.match(source, /Không gọi API Vercel\/Neon\/TinyFish từ website/);
  assert.match(source, /looksSensitive/);
  assert.match(source, /DATABASE_URL/);
  assert.match(source, /không phải nút phát hành thật/);
});

test("Safe Publish is evidence based and requires human production authority", () => {
  assert.match(source, /Source bất biến/);
  assert.match(source, /Preview evidence/);
  assert.match(source, /DB evidence/);
  assert.match(source, /Browser evidence/);
  assert.match(source, /Production authority/);
  assert.match(source, /productionAuthority/);
  assert.match(source, /gates\.every/);
  assert.match(source, /không tự phát hành Production/);
});

test("Deploy & Ops UI is responsive", () => {
  assert.match(css, /@media \(max-width: 920px\)/);
  assert.match(css, /@media \(max-width: 680px\)/);
});
