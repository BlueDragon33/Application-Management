import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workflow = fs.readFileSync(
  new URL("../.github/workflows/deploy-application-management-production.yml", import.meta.url),
  "utf8",
);

const events=workflow.slice(workflow.indexOf("\non:"),workflow.indexOf("\npermissions:"));
const guard=workflow.slice(workflow.indexOf("  deploy-production:"),workflow.indexOf("    runs-on:",workflow.indexOf("  deploy-production:")));

test("Production retains a future manual release contract, without granting dispatch authority now", () => {
  assert.match(events, /workflow_dispatch:/);
  assert.match(workflow, /confirm:/);
  assert.match(workflow, /DEPLOY_PRODUCTION/);
  assert.match(workflow, /environment: application-management-production/);
  assert.match(guard, /if: \$\{\{ false \}\}/);
});

test("offline policy removes all Production comment and push entry points", () => {
  assert.doesNotMatch(events, /\bissue_comment:|\bpush:|\bworkflow_run:/);
  assert.match(guard, /if: \$\{\{ false \}\}/);
  assert.match(workflow, /Only the repository owner exact \/deploy-production command may deploy Production/);
});

test("no actor, including the owner, can enter dormant Production job", () => {
  assert.match(guard, /if: \$\{\{ false \}\}/);
  assert.doesNotMatch(guard, /github\.event_name|github\.actor|github\.event\.comment/);
});
