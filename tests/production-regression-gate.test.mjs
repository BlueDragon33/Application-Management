import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import yaml from "js-yaml";

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
  const steps = yaml.load(source(".github/workflows/deploy-application-management-preview.yml")).jobs["deploy-preview"].steps;
  const regression = steps.findIndex(step => step.run === "npm test");
  const build = steps.findIndex(step => step.run === "npm run build");
  const artifact = steps.findIndex(step => step.run === "npm run cloudflare:artifact:check");
  const migration = steps.findIndex(step => /wrangler d1 migrations apply application-management-preview-db --remote/.test(step.run ?? ""));
  const deploy = steps.findIndex(step => /wrangler deploy/.test(step.run ?? ""));

  for (const index of [regression, build, artifact, migration, deploy]) assert.ok(index >= 0, "required deployment command must exist");
  assert.ok(regression < build);
  assert.ok(build < artifact, "preview artifact must be verified after building");
  assert.ok(artifact < migration, "preview artifact must pass before remote D1 mutation");
  assert.ok(migration < deploy, "remote migration must occur before Preview publication");
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
