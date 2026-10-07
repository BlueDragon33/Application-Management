import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("every PR and main revision receives a mandatory full regression gate", () => {
  const workflow = source(".github/workflows/application-management-ci.yml");

  assert.match(workflow, /regression-check:/);
  assert.match(workflow, /- name: Mandatory full regression suite\s+run: npm test/);
  assert.doesNotMatch(
    workflow,
    /regression-check:\s*\n\s*if:\s*\$\{\{[^\n]*release\//,
    "full regression must not be limited to release/* branches",
  );
});

test("live production deploy runs full regression before any remote mutation", () => {
  const workflow = source(".github/workflows/live-development-deploy.yml");

  const regression = workflow.indexOf("- name: Production regression gate");
  const migration = workflow.indexOf("- name: Apply D1 migrations");
  const deploy = workflow.indexOf("- name: Deploy current main to live Worker");

  assert.ok(regression >= 0, "production regression gate must exist");
  assert.match(
    workflow.slice(regression, migration),
    /run: npm test/,
    "production regression gate must execute npm test",
  );
  assert.ok(regression < migration, "regression must run before D1 migrations");
  assert.ok(regression < deploy, "regression must run before live deploy");
});
