import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import ts from "typescript";

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
  "BlueDragon33/Bauman-Russian-iOS",
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
  assert.match(projectDocs, /Tổng: \*\*15 repo hiện hữu\*\*/);
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

test("Bauman Russian iOS is a developing project, never a fictitious installed or managed app", () => {
  const start = registry.indexOf('id: "bauman-russian-ios"');
  const end = registry.indexOf("\n  },", start);
  assert.ok(start >= 0, "iOS repo must appear in the project catalog");
  const block = registry.slice(start, end);
  assert.match(block, /BlueDragon33\/Bauman-Russian-iOS/);
  assert.match(block, /state: "developing"/);
  assert.match(block, /relatedTo: "Bauman Master AI"/);
  assert.doesNotMatch(block, /managementHref:|appLaunchUrl:|connected|state: "operational"/);
  assert.match(projectDocs, /Bauman-Russian-iOS/);
  assert.match(projectDocs, /chưa có bản cài iPhone/);
  assert.doesNotMatch(source("app/application-registry.ts"), /id: "bauman-russian-ios"/);
});

test("server-rendered projects catalog shows iOS developing without a fake open/manage control", () => {
  // Exercise the real React component rather than only checking registry strings.
  // No browser, device or authenticated runtime is simulated by this SSR check.
  const nativeRequire = createRequire(import.meta.url);
  const mockStyles = new Proxy({}, { get: (_value, key) => String(key) });
  function compile(file) {
    const js = ts.transpileModule(source(file), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
      fileName: file,
    }).outputText;
    const module = { exports: {} };
    const localRequire = (name) => {
      if (name === "../project-registry") return compile("app/project-registry.ts");
      if (name === "next/link") {
        return {
          __esModule: true,
          default: ({ href, children }) => React.createElement("a", { href }, children),
        };
      }
      if (name.endsWith(".module.css")) return { __esModule: true, default: mockStyles };
      return nativeRequire(name);
    };
    vm.runInNewContext(js, {
      exports: module.exports, module, require: localRequire,
    }, { filename: file });
    return module.exports;
  }

  const { default: ProjectsCatalog } = compile("app/projects/projects-catalog.tsx");
  const markup = renderToStaticMarkup(React.createElement(ProjectsCatalog));
  const document = new JSDOM(markup).window.document;
  const card = [...document.querySelectorAll("article.card")]
    .find((item) => item.querySelector("h2")?.textContent === "Bauman Russian iOS");

  assert.ok(card, "Native iOS entry must appear in the actual project UI");
  assert.equal(card.querySelector(".state")?.getAttribute("data-state"), "developing");
  assert.equal(card.querySelector(".state")?.textContent, "Đang phát triển");
  assert.match(card.querySelector(".meta")?.textContent ?? "", /Thuộc Bauman Master AI/);
  const actions = [...card.querySelectorAll(".actions a")];
  assert.deepEqual(actions.map((a) => a.textContent), ["Code ↗", "Issues ↗", "Actions ↗"]);
  assert.ok(actions.every((a) => a.getAttribute("href")?.startsWith(
    "https://github.com/BlueDragon33/Bauman-Russian-iOS"
  )));
  assert.doesNotMatch(card.outerHTML, /baumanrussian:\/\//i);
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


test("NC03 project catalog reflects runtime-gated AUTH plus read-only write readiness", () => {
  const start = registry.indexOf('id: "nc03-modem"');
  const end = registry.indexOf("\n  },", start);
  const block = registry.slice(start, end);
  assert.match(block, /v0\.7\.24/);
  assert.match(block, /runtime v4/i);
  assert.match(block, /write-readiness v1/i);
  assert.match(block, /real login local-only/i);
  assert.match(block, /session-expiry re-auth/i);
  assert.match(block, /Write Readiness Lab read-only/i);
  assert.match(block, /Long Life Charging/i);
  assert.match(block, /WRITE.*(?:khóa|fail-closed)/i);
  assert.match(projectDocs, /v0\.7\.24/);
});

test("PriceReport catalog reflects V6.14 standalone-first access", () => {
  const start = registry.indexOf('id: "price-report-tunggiabao"');
  const end = registry.indexOf("\n  },", start);
  const block = registry.slice(start, end);
  assert.match(block, /V6\.14/);
  assert.match(block, /Standalone Mode/);
  assert.match(block, /Device Gate OFF/);
  assert.match(projectDocs, /V6\.14 Standalone-first/);
});
