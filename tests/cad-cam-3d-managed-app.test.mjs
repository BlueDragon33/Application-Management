import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const registry = fs.readFileSync(new URL("../app/application-registry.ts", import.meta.url), "utf8");
const production = fs.readFileSync(new URL("../.github/workflows/deploy-application-management-production.yml", import.meta.url), "utf8");
const contract = fs.readFileSync(new URL("../app/open-contract.server.ts", import.meta.url), "utf8");

test("CAD CAM 3D registry points to the live v1 Production runtime", () => {
  assert.match(registry, /id: "cad-cam-3d"/);
  assert.match(registry, /publicUrl: "https:\/\/bluedragon33\.github\.io\/CAD_CAM_3D\/"/);
  assert.match(registry, /status: "online", contractState: "migrating"/);
  assert.match(registry, /Universal Contract v1/);
  assert.match(registry, /Remote Admin, registry CAD-, approve\/block, session\/revoke and audit mutation still fail-closed|Remote Admin, registry CAD-, approve\/block, session\/revoke và audit mutation vẫn fail-closed/);
});

test("generic public-subpath discovery can resolve the CAD GitHub Pages manifest", () => {
  assert.match(contract, /function publicBasePath/);
  assert.match(contract, /joinContractPath\(basePath, "\/control\/application-management\.contract\.json"\)/);
  assert.match(contract, /manifest\.policy\?\.localFirst === true/);
  assert.match(contract, /const runtimeConnected = !repositoryMetadataOnly && manifest\.policy\?\.productionRuntimeReady !== false/);
});

test("Production deploy cannot pass unless CAD is live local-first and remote admin stays closed", () => {
  assert.match(production, /requireEnrolled\("cad-cam-3d", "CAD CAM 3D"\)/);
  assert.match(production, /CAD CAM 3D must have both a live Universal Contract handshake and live Production runtime/);
  assert.match(production, /CAD CAM 3D must remain local-first/);
  assert.match(production, /CAD CAM 3D must remain observe\/launch-only until a real app-scoped Remote Admin backend exists/);
  assert.match(production, /cad\.protocol !== "application-management\.contract\/v1"/);
});
