import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(path,"utf8");
const json = path => JSON.parse(read(path));

test("Constitution 1.2 sovereignty adoption and dependency budget stay explicit", () => {
  const adoption=json(".blueprint/constitution-adoption.json");
  const budget=json("docs/DEPENDENCY_BUDGET.json");
  const standard=read("docs/LOCAL_FIRST_RELEASE_STANDARD.md");

  assert.equal(adoption.policyId,"blueprint-os:universal-century-grade");
  assert.equal(adoption.policyVersion,"1.2.0");
  assert.ok(
    adoption.inheritedPillars.includes("operational-sovereignty-dependency-minimization")
  );
  assert.deepEqual(adoption.disabledPillars,[]);
  assert.deepEqual(adoption.constitutionalWaivers,[]);

  assert.equal(
    budget.constitutionPolicy,
    "blueprint-os:universal-century-grade@1.2.0"
  );
  assert.equal(
    budget.defaultPrinciple,
    "LOCAL_FIRST_OFFLINE_CAPABLE_PROVIDER_REPLACEABLE"
  );

  const byId=new Map(budget.dependencies.map(item=>[item.id,item]));
  assert.equal(byId.get("local-runtime")?.runtimeClass,"LOCAL_CORE");
  assert.equal(byId.get("chatgpt-sites")?.runtimeClass,"OPTIONAL_PUBLISH");
  assert.equal(byId.get("cloudflare-workers-d1")?.runtimeClass,"OPTIONAL_PUBLISH");
  assert.equal(byId.get("google-drive")?.runtimeClass,"OPTIONAL_SYNC");
  assert.equal(byId.get("google-sheets")?.runtimeClass,"OPTIONAL_SYNC");
  assert.equal(byId.get("google-apps-script")?.runtimeClass,"OPTIONAL_SYNC");

  assert.match(byId.get("google-drive")?.canonicalState ?? "",/forbidden as sole/i);
  assert.match(byId.get("google-sheets")?.canonicalState ?? "",/forbidden/i);
  assert.match(byId.get("google-apps-script")?.canonicalState ?? "",/forbidden/i);

  for (const required of [
    "private keys",
    "bearer/session tokens",
    "raw bridge secrets",
    "health records from Health_Care",
    "child records from GrowUP_MyChildren",
    "raw passport/visa intake data in Sheets"
  ]) {
    assert.ok(budget.forbiddenRemoteData.includes(required),required);
  }

  assert.match(standard,/Constitution 1\.2 · Operational Sovereignty/);
  assert.match(standard,/docs\/DEPENDENCY_BUDGET\.json/);
  assert.match(standard,/private keys, bearer\/session tokens, raw bridge secrets/);
  assert.match(standard,/Google Drive may be used only for optional sanitized\/encrypted backup/);
  assert.match(standard,/Google Sheets may be used only for low-risk reporting/);
  assert.match(standard,/Google Apps Script may be used only as a replaceable lightweight coordination bridge/);
});
