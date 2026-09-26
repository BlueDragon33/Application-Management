import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Blueprint OS is a managed metadata-only core app", () => {
  const registry = read("app/application-registry.ts");
  const start = registry.indexOf('id: "software-blueprint-hub"');
  const end = registry.indexOf("\n  },", start);
  const block = registry.slice(start, end);

  assert.ok(start >= 0);
  assert.match(block, /href: "\/apps\/software-blueprint-hub"/);
  assert.match(block, /BlueDragon33\/Software-Blueprint-Hub/);
  assert.match(block, /category: "Kỹ thuật"/);
  assert.match(block, /metadata-only/);
  assert.match(block, /Không mutate canonical Blueprint\/Constitution/);
  assert.match(block, /Không PASS Quality Gate/);
  assert.match(block, /Không authorize Production release/);
  assert.doesNotMatch(block, /publicUrl:/);
  assert.doesNotMatch(block, /localUrl:/);
});

test("Blueprint OS management page uses the generic truthful workspace", () => {
  const page = read("app/apps/software-blueprint-hub/page.tsx");
  assert.match(page, /getApplicationConfig\("software-blueprint-hub"\)/);
  assert.match(page, /<ApplicationWorkspace/);
  assert.match(page, /requireChatGPTUser\("\/apps\/software-blueprint-hub"\)/);
});

test("repository contract discovery supports Blueprint OS without app-specific branching", () => {
  const discovery = read("app/managed-contract-discovery.server.ts");
  assert.match(discovery, /control\/application-management\.contract\.json/);
  assert.match(discovery, /discoverManagedRepositoryContract/);
  assert.doesNotMatch(discovery, /software-blueprint-hub/);
});
