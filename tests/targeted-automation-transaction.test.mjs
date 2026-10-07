import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("auto-approval probes only requested targets on the mutation path", () => {
  const route = source("app/api/operations-auto-approval/route.ts");
  assert.match(route, /probeDynamicManagedApplications\(targets\)/);
  assert.match(route, /readAutoApprovalSettings\(\[\], targets, dynamicSnapshots, specializedTargets\)/);
  assert.match(route, /readAutoApprovalSettings\(\[\], targets, refreshedDynamic, specializedTargets\)/);
  assert.doesNotMatch(route, /const dynamicSnapshots = await probeDynamicManagedApplications\(\);/);
  assert.doesNotMatch(route, /readAutoApprovalSettings\(\["boi-ech", "health-care"\], allAppIds/);
});

test("dynamic catalog probe supports target filtering", () => {
  const universal = source("app/open-contract.server.ts");
  assert.match(universal, /probeDynamicManagedApplications\(appIds\?: readonly string\[\]\)/);
  assert.match(universal, /const allow = appIds\?\.length \? new Set\(appIds\) : null/);
  assert.match(universal, /!allow \|\| allow\.has\(row\.id\)/);
});

test("auto-block also reads and returns only the target policy", () => {
  const route = source("app/api/operations/route.ts");
  const start = route.indexOf('if (action === "set-auto-block-pending")');
  const end = route.indexOf('if (action === "manage-client-device")', start);
  const block = route.slice(start, end);
  assert.match(block, /probeDynamicManagedApplications\(\[appId\]\)/);
  assert.match(block, /readAutoApprovalSettings\(\[\], \[appId\], dynamicSnapshots, specializedTargets\)/);
  assert.match(block, /readAutoApprovalSettings\(\[\], \[appId\], refreshed, specializedTargets\)/);
});

test("targeted policy reader can skip unrelated specialized probes", () => {
  const settings = source("app/operations-settings.server.ts");
  assert.match(settings, /probeAppIds\?: readonly string\[\]/);
  assert.match(settings, /const effectiveAppIds = probeAppIds/);
  assert.match(settings, /\? \[\.\.\.new Set\(probeAppIds\)\]/);
});
