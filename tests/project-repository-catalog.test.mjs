import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const registry = source("app/project-registry.ts");
const quickActions = source("app/quick-management-actions.tsx");
const projectsPage = source("app/projects/projects-catalog.tsx");

const repositories = [
  "BlueDragon33/Application-Management",
  "BlueDragon33/Bauman-master-ai-system",
  "BlueDragon33/Math_Bauman",
  "BlueDragon33/BOIECH_AI",
  "BlueDragon33/Health_Care",
  "BlueDragon33/RU_LIFE",
  "BlueDragon33/GrowUP_MyChildren",
  "BlueDragon33/ROS-1-2",
  "BlueDragon33/Hardware_Simulation",
  "BlueDragon33/MPC_PID_System",
  "BlueDragon33/CAD_CAM_3D",
];

test("project registry keeps every current BlueDragon33 project repository discoverable", () => {
  for (const repository of repositories) {
    assert.ok(registry.includes(repository), `missing repository: ${repository}`);
  }
  assert.match(registry, /projectRepositoryCount = projectRepositories\.length/);
});

test("technical repositories stay catalogued without fake management contracts", () => {
  for (const id of ["ros-1-2", "hardware-simulation", "mpc-pid-system", "cad-cam-3d"] ) {
    const block = registry.slice(registry.indexOf(`id: "${id}"`), registry.indexOf("},", registry.indexOf(`id: "${id}"`)) + 2);
    assert.ok(block.length > 2, `missing block for ${id}`);
    assert.doesNotMatch(block, /managementHref:/);
  }
});

test("central dashboard exposes the GitHub project catalog", () => {
  assert.match(quickActions, /window\.location\.assign\("\/projects"\)/);
  assert.match(quickActions, /Dự án GitHub/);
  assert.match(projectsPage, /projectRepositories/);
  assert.match(projectsPage, /Toàn bộ dự án GitHub/);
});
