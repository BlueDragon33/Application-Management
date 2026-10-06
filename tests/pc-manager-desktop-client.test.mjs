import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = (path) =>
  fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("PC Manager is a first-level native client with an outbound gateway", () => {
  const registry = source("app/application-registry.ts");
  const readme = source("README.md");

  assert.match(registry, /id: "pc-manager"/);
  assert.match(registry, /repository: "BlueDragon33\/pc-manager-desktop"/);
  assert.match(registry, /outbound-only/);
  assert.match(registry, /namespace PC-/i);
  assert.match(readme, /PC Manager Desktop/);
  assert.match(readme, /Desktop Agent Gateway outbound-only/);
});

test("PC Manager admin page uses the central signed admin-device proof", () => {
  const client = source("app/admin-device-client.ts");
  const page = source("app/apps/pc-manager/pc-manager-admin.tsx");

  assert.match(client, /desktopAgentAdminAction/);
  assert.match(client, /secureApi\(\s*"\/api\/desktop-agent\/admin"/);
  assert.match(page, /Duyệt thiết bị/);
  assert.match(page, /RUN_HEALTH_SCAN/);
  assert.match(page, /DISABLE_LICENSE/);
});

test("PC Manager console never exposes arbitrary execution controls", () => {
  const page = source("app/apps/pc-manager/pc-manager-admin.tsx");
  assert.doesNotMatch(page, /RUN_COMMAND|EXECUTE_SHELL|RUN_POWERSHELL|download-and-run/i);
});
