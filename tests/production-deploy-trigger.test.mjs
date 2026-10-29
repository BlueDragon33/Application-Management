import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workflow = fs.readFileSync(
  new URL("../.github/workflows/deploy-application-management-production.yml", import.meta.url),
  "utf8",
);

const events=workflow.slice(workflow.indexOf("\non:"),workflow.indexOf("\npermissions:"));
const guard=workflow.slice(workflow.indexOf("  deploy-production:"),workflow.indexOf("    runs-on:",workflow.indexOf("  deploy-production:")));

test("Production requires manual owner confirmation of the exact immutable revision", () => {
  assert.match(events, /workflow_dispatch:/);
  assert.match(workflow, /confirm:/);
  assert.match(workflow, /DEPLOY_PRODUCTION/);
  assert.match(workflow, /environment: application-management-production/);
  assert.match(workflow, /release_revision:/);
  assert.match(guard, /github\.event_name == 'workflow_dispatch'/);
  assert.match(guard, /github\.actor == 'BlueDragon33'/);
  assert.match(guard, /inputs\.confirm == 'DEPLOY_PRODUCTION'/);
  assert.match(guard, /inputs\.release_revision == github\.sha/);
});

test("offline policy removes all Production comment and push entry points", () => {
  assert.doesNotMatch(events, /\bissue_comment:|\bpush:|\bworkflow_run:/);
  assert.doesNotMatch(workflow, /github\.event\.comment|\/deploy-production/);
});

test("Production checks the checkout and fresh rollback readiness before provider mutation", () => {
  const deploy = workflow.slice(workflow.indexOf("  deploy-production:"));
  const check = deploy.indexOf("node scripts/production-release-control.mjs check");
  const preflight = deploy.indexOf("node scripts/inspect-production-readiness.mjs");
  const mutate = deploy.indexOf("npx wrangler d1 migrations apply");
  assert.ok(check > 0 && check < preflight && preflight < mutate);
  assert.match(deploy, /RELEASE_CONFIRM: \$\{\{ inputs\.confirm \}\}/);
  assert.match(deploy, /RELEASE_REVISION: \$\{\{ inputs\.release_revision \}\}/);
  assert.match(deploy, /node scripts\/production-release-control\.mjs normalize-account/);
  assert.match(deploy, /node scripts\/production-release-control\.mjs readback/);
  assert.match(deploy, /production-release-readiness/);
  assert.doesNotMatch(deploy, /cat \/tmp\/application-management-production\.json/);
});
