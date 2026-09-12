import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const script = await readFile(new URL("../scripts/verify-preview-stack.mjs", import.meta.url), "utf8");
const workflow = await readFile(new URL("../.github/workflows/verify-preview-stack.yml", import.meta.url), "utf8");

test("preview stack verifier remains read-only", () => {
  assert.match(script, /"phase-a"/);
  assert.match(script, /"full-stack"/);
  assert.match(script, /method:\s*"OPTIONS"/);
  assert.doesNotMatch(script, /method:\s*"(?:POST|PUT|PATCH|DELETE)"/);
  assert.match(script, /must not use a chatgpt\.site fallback/);
  assert.match(script, /anonymous\.status === 401/);
  assert.match(script, /APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET/);
  assert.match(script, /previewAccessConfigured === true/);
  assert.match(script, /accessMode === "application-preview-secret"/);
  assert.match(script, /databaseReady === true/);
  assert.match(script, /GrowUP must remain unconfigured/);
  assert.doesNotMatch(script, /CF_ACCESS_CLIENT_ID|CF_ACCESS_CLIENT_SECRET/);
});

test("manual workflow uses the preview environment and never deploys", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /environment:\s*application-management-preview/);
  assert.match(workflow, /APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET/);
  assert.match(workflow, /npm run preview:verify/);
  assert.doesNotMatch(workflow, /CF_ACCESS_CLIENT_ID|CF_ACCESS_CLIENT_SECRET/);
  assert.doesNotMatch(workflow, /wrangler\s+deploy/);
  assert.doesNotMatch(workflow, /d1\s+migrations\s+apply/);
  assert.doesNotMatch(workflow, /method:\s*(?:POST|PUT|PATCH|DELETE)/);
});
