import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workflow = fs.readFileSync(new URL("../.github/workflows/live-development-deploy.yml", import.meta.url), "utf8");

test("live main deployment requires readback evidence inputs", () => {
  assert.match(workflow, /APPLICATION_MANAGEMENT_PRODUCTION_READBACK_SECRET:/);
  assert.match(workflow, /APPLICATION_MANAGEMENT_PRODUCTION_ORIGIN APPLICATION_MANAGEMENT_PRODUCTION_READBACK_SECRET/);
});

test("live main deployment verifies exact deployed revision and readiness", () => {
  assert.match(workflow, /Read back live deployment revision/);
  assert.match(workflow, /\/__deployment/);
  assert.match(workflow, /value\.revision !== expected/);
  assert.match(workflow, /value\.channel !== "cloudflare-production"/);
  assert.match(workflow, /value\.databaseReady !== true/);
  assert.match(workflow, /value\.assetsReady !== true/);
});

test("live readback does not reuse stdin for both Node source and JSON payload", () => {
  assert.doesNotMatch(workflow, /node --input-type=module - "\$GITHUB_SHA" < \/tmp\/application-management-live\.json/);
  assert.match(workflow, /node --input-type=module - "\$GITHUB_SHA" \/tmp\/application-management-live\.json <<'NODE'/);
  assert.match(workflow, /const payloadPath = process\.argv\[3\]/);
  assert.match(workflow, /fs\.readFileSync\(payloadPath, "utf8"\)/);
});
