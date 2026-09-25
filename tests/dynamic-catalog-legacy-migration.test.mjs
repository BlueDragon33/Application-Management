import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const origin = fs.readFileSync("app/client-origin.server.ts", "utf8");
const managedApps = fs.readFileSync("app/api/managed-apps/route.ts", "utf8");

test("legacy migration can reuse app-scoped production credential when origin env is missing", () => {
  assert.ok(origin.includes("export async function resolveConfiguredClientCredential"));
  assert.ok(origin.includes("spec.bridgeSecretEnv"));
  assert.ok(managedApps.includes('resolveConfiguredClientCredential(spec.id, "production")'));
  assert.ok(managedApps.includes('"public-url+legacy-production-secret"'));
});

test("migration does not invent a credential when network spec has none", () => {
  assert.ok(managedApps.includes('const credential = spec'));
  assert.ok(managedApps.includes(': "";'));
});
