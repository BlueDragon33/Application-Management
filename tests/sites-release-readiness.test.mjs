import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("ChatGPT Sites hosting linkage remains explicit and secret-free", () => {
  const raw = source(".openai/hosting.json");
  const hosting = JSON.parse(raw);
  assert.equal(hosting.d1, "DB");
  assert.match(hosting.project_id, /^appgprj_[a-z0-9]+$/);
  assert.equal(hosting.r2, null);
  assert.deepEqual(Object.keys(hosting).sort(), ["d1", "project_id", "r2"]);
  assert.doesNotMatch(raw, /secret|token|password|api[_-]?key/i);
});

test("root route remains the authenticated management entry", () => {
  const page = source("app/page.tsx");
  assert.match(page, /requireChatGPTUser\("\/"\)/);
  assert.match(page, /<ManagementEntry/);
  assert.doesNotMatch(page, /notFound\(|redirect\([^)]*\/apps\//);
});

test("release documentation names every current first-level client", () => {
  const readme = source("README.md");
  for (const name of [
    "Bơi ếch",
    "Sức khỏe Y tế",
    "Hòa nhập Nga",
    "Bauman Hub",
    "GrowUP MyChildren",
    "PriceReport Tùng Gia Bảo",
    "CAD CAM 3D",
  ]) assert.ok(readme.includes(name), `README missing ${name}`);
});
