import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workflow = fs.readFileSync(
  new URL("../.github/workflows/deploy-application-management-production.yml", import.meta.url),
  "utf8",
);

test("Production deploy keeps the explicit manual confirmation path", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /confirm:/);
  assert.match(workflow, /DEPLOY_PRODUCTION/);
});

test("Production deploy accepts only the repository owner's exact PR comment command", () => {
  assert.match(workflow, /issue_comment:/);
  assert.match(workflow, /types: \[created\]/);
  assert.match(workflow, /github\.actor == 'BlueDragon33'/);
  assert.match(workflow, /github\.event\.issue\.pull_request != null/);
  assert.match(workflow, /github\.event\.comment\.body == '\/deploy-production'/);
  assert.match(workflow, /Only the repository owner exact \/deploy-production command may deploy Production/);
});

test("arbitrary issue comments cannot enter the Production environment job", () => {
  const jobStart = workflow.indexOf("  deploy-production:");
  const runner = workflow.indexOf("    runs-on:", jobStart);
  const guard = workflow.slice(jobStart, runner);
  assert.match(guard, /github\.event_name == 'workflow_dispatch'/);
  assert.match(guard, /github\.event_name == 'issue_comment'/);
  assert.match(guard, /github\.actor == 'BlueDragon33'/);
  assert.match(guard, /github\.event\.comment\.body == '\/deploy-production'/);
});
