import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("app/tools/secret-generator/page.tsx", "utf8");
const source = fs.readFileSync("app/tools/secret-generator/secret-generator.tsx", "utf8");
const css = fs.readFileSync("app/tools/secret-generator/secret-generator.module.css", "utf8");

test("secret generator is an authenticated Application Management utility", () => {
  assert.match(page, /requireChatGPTUser\("\/tools\/secret-generator"\)/);
  assert.match(page, /SecretGenerator/);
  assert.match(source, /APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET/);
  assert.match(source, /GitHub \/ Cloudflare Secret/);
  assert.match(source, /length:\s*64/);
});

test("secret generation uses Web Crypto without biased Math.random fallback", () => {
  assert.match(source, /crypto\.getRandomValues/);
  assert.match(source, /256 - \(256 % maxExclusive\)/);
  assert.match(source, /byte\[0\] >= limit/);
  assert.doesNotMatch(source, /Math\.random/);
  assert.match(source, /secureShuffle/);
});

test("secret values stay browser-local and are never persisted or transmitted", () => {
  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.doesNotMatch(source, /XMLHttpRequest/);
  assert.doesNotMatch(source, /localStorage/);
  assert.doesNotMatch(source, /sessionStorage/);
  assert.doesNotMatch(source, /URLSearchParams\s*\(/);
  assert.match(source, /navigator\.clipboard\.writeText\(secret\)/);
  assert.match(source, /Không gửi mạng/);
  assert.match(source, /Không lưu lịch sử/);
});

test("secret generator UI is responsive and exposes security state", () => {
  assert.match(css, /@media \(max-width: 680px\)/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /≈ \{entropy\} bit/);
  assert.match(source, /URL-safe/);
});
