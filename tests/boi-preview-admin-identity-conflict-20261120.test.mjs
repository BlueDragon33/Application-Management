import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const code = readFileSync(new URL("../app/apps/boi-ech/boi-ech-control-center.tsx", import.meta.url), "utf8");

test("Preview identity recovery is available only for explicit DEVICE_BOUND_TO_OTHER_USER", () => {
  assert.match(code, /caught instanceof ApiError && caught\.data\.code === "DEVICE_BOUND_TO_OTHER_USER"/);
  assert.match(code, /identityConflict && isPreviewAdminHost\(\)/);
  assert.match(code, /if \(checking \|\| !identityConflict \|\| !isPreviewAdminHost\(\)\) return/);
  assert.match(code, /window\.confirm\(/);
});
test("Preview identity recovery only removes local P-256 credential, not D1/accounts", () => {
  const block=code.split("async function forgetPreviewAdminCredential() {")[1]?.split("async function credentialForDevice()")[0] ?? "";
  assert.ok(block);
  assert.match(code, /window\.location\.hostname === PREVIEW_ADMIN_HOST/);
  assert.match(block, /objectStore\("credential"\)\.delete\("primary"\)/);
  assert.doesNotMatch(block, /fetch\(|deleteDatabase\(|localStorage\.clear|indexedDB\.deleteDatabase/);
  assert.match(code, /await forgetPreviewAdminCredential\(\);\s*window\.location\.reload\(\)/);
});
