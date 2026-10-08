import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const productionWorkflow = read(".github/workflows/deploy-application-management-production.yml");

test("Blueprint OS is a managed metadata-only core app", () => {
  const registry = read("app/application-registry.ts");
  const start = registry.indexOf('id: "software-blueprint-hub"');
  const end = registry.indexOf("\n  },", start);
  const block = registry.slice(start, end);

  assert.ok(start >= 0);
  assert.match(block, /href: "\/apps\/software-blueprint-hub"/);
  assert.match(block, /BlueDragon33\/Software-Blueprint-Hub/);
  assert.match(block, /category: "Kỹ thuật"/);
  assert.match(block, /metadata-only/);
  assert.match(block, /Không mutate canonical Blueprint\/Constitution/);
  assert.match(block, /Không PASS Quality Gate/);
  assert.match(block, /Không authorize Production release/);
  assert.match(block, /publicUrl: "https:\/\/software-blueprint-hub\.vercel\.app\/"/);
  assert.match(block, /contractSource: "repository"/);
  assert.match(block, /PASS P9-019 và P9-020/);
  assert.doesNotMatch(block, /localUrl:/);
});

test("Blueprint OS launch does not turn its repository metadata into a live control origin", () => {
  const catalog = read("app/api/managed-apps/route.ts");
  assert.match(catalog, /application\.contractSource === "repository"/);
  assert.match(catalog, /repositoryCatalogCandidate\(application\)/);
  assert.match(catalog, /repository-bootstrap-website-updated/);
  assert.match(catalog, /publicUrl: application\.publicUrl \?\? ""/);
});

test("Blueprint OS management page uses the generic truthful workspace", () => {
  const page = read("app/apps/software-blueprint-hub/page.tsx");
  assert.match(page, /getApplicationConfig\("software-blueprint-hub"\)/);
  assert.match(page, /<ApplicationWorkspace/);
  assert.match(page, /requireChatGPTUser\("\/apps\/software-blueprint-hub"\)/);
});

test("repository contract discovery supports Blueprint OS without app-specific branching", () => {
  const discovery = read("app/managed-contract-discovery.server.ts");
  assert.match(discovery, /control\/application-management\.contract\.json/);
  assert.match(discovery, /discoverManagedRepositoryContract/);
  assert.doesNotMatch(discovery, /software-blueprint-hub/);
});

test("Production reconciliation enrolls Blueprint OS in Dynamic Catalog before probing", () => {
  assert.match(productionWorkflow, /"action":"sync-existing"/);
  assert.match(productionWorkflow, /software-blueprint-hub/);
  assert.ok(productionWorkflow.includes('requireEnrolled("software-blueprint-hub", "Software Blueprint Hub")'));
  assert.match(productionWorkflow, /is missing from Production Dynamic Catalog reconciliation/);
  assert.match(productionWorkflow, /blueprint\.metadataVerified/);
  assert.match(productionWorkflow, /blueprint\.managementMode !== "metadata-only"/);
  assert.match(productionWorkflow, /!blueprint\.contractConnected \|\| blueprint\.runtimeConnected \|\| blueprint\.remoteAdminReady/);
  assert.match(productionWorkflow, /repository metadata must have a verified contract without live runtime or remote-admin readiness/);
  assert.ok(
    productionWorkflow.indexOf("Reconcile managed app catalog before Production probe")
      < productionWorkflow.indexOf("Probe managed app contracts after Production deploy"),
  );
});
