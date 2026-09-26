import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const registry = source("app/project-registry.ts");
const quickActions = source("app/management-quick-actions.tsx");
const projectsPage = source("app/projects/projects-catalog.tsx");
const liveRoute = source("app/api/projects/repositories/route.ts");
const repositoryWatch = source("scripts/check-project-repositories.mjs");
const repositoryWatchWorkflow = source(".github/workflows/project-repository-watch.yml");
const projectDocs = source("docs/PROJECT_REPOSITORY_CATALOG.md");
const pkg = JSON.parse(source("package.json"));

const repositories = [
  "BlueDragon33/Application-Management",
  "BlueDragon33/Software-Blueprint-Hub",
  "BlueDragon33/Bauman-master-ai-system",
  "BlueDragon33/Math_Bauman",
  "BlueDragon33/BOIECH_AI",
  "BlueDragon33/Health_Care",
  "BlueDragon33/RU_LIFE",
  "BlueDragon33/GrowUP_MyChildren",
  "BlueDragon33/PriceReport_Tunggiabao",
  "BlueDragon33/NC03_Modem",
  "BlueDragon33/ROS-1-2",
  "BlueDragon33/Hardware_Simulation",
  "BlueDragon33/MPC_PID_System",
  "BlueDragon33/CAD_CAM_3D",
];

test("project registry tracks the current owned project set", () => {
  for (const repository of repositories) assert.ok(registry.includes(repository), `missing repository: ${repository}`);
  assert.match(registry, /projectRepositoryCount = projectRepositories\.length/);
  assert.match(registry, /group: "accounting"/);
  assert.match(projectDocs, /BlueDragon33\/NC03_Modem/);
  assert.match(projectDocs, /Tổng: \*\*14 repo hiện hữu\*\*/);
});

test("current dashboard exposes the GitHub project catalog", () => {
  assert.match(quickActions, /window\.location\.assign\("\/projects"\)/);
  assert.match(quickActions, /Dự án GitHub/);
  assert.match(projectsPage, /Toàn bộ dự án GitHub/);
  assert.match(projectsPage, /accounting: "Kế toán"/);
});

test("catalog reconciliation is read-only and detects drift", () => {
  assert.match(liveRoute, /api\.github\.com\/users\/\$\{GITHUB_OWNER\}\/repos\?per_page=100&sort=updated/);
  assert.match(liveRoute, /const unmanaged = repositories\.filter/);
  assert.match(liveRoute, /notVisiblePublicly/);
  assert.match(repositoryWatch, /process\.exitCode = 1/);
  assert.match(repositoryWatchWorkflow, /cron: "0 2 \* \* \*"/);
  assert.match(repositoryWatchWorkflow, /push:/);
  assert.match(repositoryWatchWorkflow, /app\/project-registry\.ts/);
  assert.equal(pkg.scripts["projects:check"], "node scripts/check-project-repositories.mjs");
});

test("technical repositories do not invent remote controls", () => {
  for (const id of ["ros-1-2", "hardware-simulation", "mpc-pid-system"]) {
    const start = registry.indexOf(`id: "${id}"`);
    const end = registry.indexOf("\n  },", start);
    const block = registry.slice(start, end);
    assert.doesNotMatch(block, /managementHref:/);
  }
  const cadStart = registry.indexOf('id: "cad-cam-3d"');
  const cadEnd = registry.indexOf("\n  },", cadStart);
  const cadBlock = registry.slice(cadStart, cadEnd);
  assert.match(cadBlock, /managementHref: "\/apps\/cad-cam-3d"/);
  const nc03Start = registry.indexOf('id: "nc03-modem"');
  const nc03End = registry.indexOf("\n  },", nc03Start);
  const nc03Block = registry.slice(nc03Start, nc03End);
  assert.match(nc03Block, /managementHref: "\/apps\/nc03-modem"/);
});


test("Software Blueprint Hub is tracked as active core compass with a metadata-only management surface", () => {
  const start = registry.indexOf('id: "software-blueprint-hub"');
  const end = registry.indexOf("\n  },", start);
  const block = registry.slice(start, end);
  assert.ok(start >= 0);
  assert.match(block, /BlueDragon33\/Software-Blueprint-Hub/);
  assert.match(block, /state: "developing"/);
  assert.match(block, /Phase 9 Compass Construction/);
  assert.match(block, /managementHref: "\/apps\/software-blueprint-hub"/);
  assert.match(projectDocs, /metadata-only/);
});


test("NC03 project catalog reflects the professional QA reporting release", () => {
  const start = registry.indexOf('id: "nc03-modem"');
  const end = registry.indexOf("\n  },", start);
  const block = registry.slice(start, end);
  assert.match(block, /v0\.7\.1/);
  assert.match(block, /báo cáo chẩn đoán A4/);
  assert.match(block, /dữ liệu thiếu không bị biến thành 0/);
  assert.match(projectDocs, /v0\.7\.1 professional QA/);
});
