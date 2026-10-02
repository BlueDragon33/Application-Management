import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Bauman operations reads the live subclient endpoint and normalizes inventory", () => {
  const operations = source("app/api/operations/route.ts");
  assert.match(operations, /const subclientsPath = text\(endpoints\.subclients\)/);
  assert.match(operations, /subclientsPath === "\/api\/control\/subclients"/);
  assert.match(operations, /bridgeReadJson\(bridge, subclientsPath\)/);
  assert.match(operations, /function baumanSubclient/);
  assert.match(operations, /kind === "workflow"/);
  assert.match(operations, /subclientInventoryLive/);
  assert.match(operations, /currentSummary\.subclients = result\.value\.subclients/);
});

test("Bauman admin prefers live topology and only uses static children as fallback", () => {
  const admin = source("app/apps/bauman-master-ai/bauman-admin.tsx");
  assert.match(admin, /const fallbackChildren = useMemo<OperationsSubclient\[\]>/);
  assert.match(admin, /summary\?\.subclientInventoryLive === true/);
  assert.match(admin, /const children = liveInventory \? summary\?\.subclients \?\? \[\] : fallbackChildren/);
  assert.match(admin, /SUB-CLIENT INVENTORY · \{liveInventory \? "LIVE" : "FALLBACK"\}/);
  assert.match(admin, /Đang đọc trực tiếp \$\{children\.length\} sub-client từ Bauman Control/);
});

test("operations client carries the normalized live topology shape", () => {
  const client = source("app/admin-device-client.ts");
  assert.match(client, /export type OperationsSubclient/);
  assert.match(client, /kind: "subject-site" \| "module" \| "workflow"/);
  assert.match(client, /subclients\?: OperationsSubclient\[\]/);
  assert.match(client, /subclientInventoryLive\?: boolean/);
});
