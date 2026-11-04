import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
test("AppManager V2 exposes Blueprint as one internal Tool, not an app launcher", () => {
  const ui=read("app/management-dashboard-v2.tsx");
  assert.match(ui,/id: "tool-blueprint-compass"/);
  assert.match(ui,/href: "\/tools\/blueprint-compass"/);
  assert.match(ui,/staticApps\.filter\(app => app\.id !== "software-blueprint-hub"\)/);
  assert.match(ui,/if \(dynamicApp\.id === "software-blueprint-hub"\) continue/);
});
test("Legacy UI does not render Blueprint twice", () => {
  const ui=read("app/application-hub.tsx");
  assert.match(ui,/const applicationRegistry = registeredApplications\.filter\(app => app\.id !== "software-blueprint-hub"\)/);
  assert.match(ui,/id: "tool-blueprint-compass"/);
});
test("Tool and read-only API are scoped to existing registry", () => {
  const page=read("app/tools/blueprint-compass/page.tsx");
  const api=read("app/api/tools/blueprint-compass/route.ts");
  assert.match(page,/requireChatGPTUser\("\/tools\/blueprint-compass"\)/);
  assert.match(api,/getChatGPTUser\(\)/);
  assert.match(api,/isAllowedRepository\(entry\.repository, registered\)/);
  assert.match(api,/method: "GET"/);
  assert.doesNotMatch(api,/(?:method|fetchMethod): "(?:POST|PUT|PATCH|DELETE)"/);
  assert.match(api,/compassAssessment\(\{ head: "" \}\)/);
});
test("legacy route redirects to Tool, and project directory uses Tool", () => {
  const page=read("app/apps/software-blueprint-hub/page.tsx");
  const registry=read("app/project-registry.ts");
  assert.match(page,/redirect\("\/tools\/blueprint-compass"\)/);
  assert.match(registry,/managementHref: "\/tools\/blueprint-compass"/);
});
test("No false QA or production authority in tool model", () => {
  const core=read("app/blueprint-compass-core.mjs");
  assert.match(core,/qaPassed: false, productionAuthorized: false/);
  const tool=read("app/tools/blueprint-compass/blueprint-compass.tsx");
  assert.match(tool,/GỢI Ý XỬ LÝ · KHÔNG PHẢI QA APPROVAL/);
  assert.match(tool,/Repository chưa được quản trị/);
});
