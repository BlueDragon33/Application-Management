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


test("preview deploy runs full regression and validates build before remote migration", () => {
  const workflow = source(".github/workflows/deploy-application-management-preview.yml");

  const regression = workflow.indexOf("- name: Preview regression gate");
  const build = workflow.indexOf("- name: Build preview");
  const migration = workflow.indexOf("- name: Apply preview migrations");
  const deploy = workflow.indexOf("- name: Deploy preview artifact");

  assert.ok(regression >= 0);
  assert.match(workflow.slice(regression, build), /run: npm test/);
  assert.ok(regression < build);
  assert.ok(build < migration, "preview build must complete before remote migration");
  assert.ok(migration < deploy);
});

test("manual production deploy does not hide tests and builds before remote migration", () => {
  const workflow = source(".github/workflows/deploy-application-management-production.yml");

  const regression = workflow.indexOf("- name: Production regression gate");
  const materialize = workflow.indexOf("- name: Materialize isolated production config");
  const build = workflow.indexOf("- name: Build with Cloudflare production bindings");
  const artifact = workflow.indexOf("- name: Verify generated production artifact");
  const migration = workflow.indexOf("- name: Apply migrations to production D1 only");
  const deploy = workflow.indexOf("- name: Deploy Application Management production Worker");

  assert.ok(regression >= 0);
  assert.match(workflow.slice(regression, materialize), /run: npm test/);
  assert.doesNotMatch(workflow, /! -name '.*\.test\.mjs'/);
  assert.doesNotMatch(workflow, /known-production-regressions/);
  assert.ok(build < artifact);
  assert.ok(artifact < migration, "production artifact must be built and verified before remote migration");
  assert.ok(migration < deploy);
});

test("live deployment builds the production-shaped artifact before remote migration", () => {
  const workflow = source(".github/workflows/live-development-deploy.yml");
  const build = workflow.indexOf("- name: Build live web-app");
  const migration = workflow.indexOf("- name: Apply D1 migrations");
  const deploy = workflow.indexOf("- name: Deploy current main to live Worker");

  assert.ok(build >= 0);
  assert.ok(build < migration);
  assert.ok(migration < deploy);
});
