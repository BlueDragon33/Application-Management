import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dashboard = fs.readFileSync("app/management-dashboard-v2.tsx", "utf8");

test("localRuntime is explicitly threaded into child views that use it", () => {
  assert.match(
    dashboard,
    /<Overview[\s\S]*?refreshOperations=\{refreshOperations\}[\s\S]*?localRuntime=\{localRuntime\}[\s\S]*?\/>/,
  );
  assert.match(
    dashboard,
    /function Overview\(\{[\s\S]*?localRuntime[\s\S]*?\}: \{[\s\S]*?localRuntime: boolean;[\s\S]*?\}\)/,
  );
  assert.match(
    dashboard,
    /<ApplicationsView[^>]*localRuntime=\{localRuntime\}[^>]*\/>/,
  );
  assert.match(
    dashboard,
    /function ApplicationsView\(\{[^}]*localRuntime[^}]*\}: \{[^}]*localRuntime: boolean[^}]*\}\)/,
  );
});

test("runtime URL fallbacks stay guarded by the explicit localRuntime prop", () => {
  const overviewStart = dashboard.indexOf("function Overview(");
  const applicationsStart = dashboard.indexOf("function ApplicationsView(");
  const devicesStart = dashboard.indexOf("function DevicesView(", applicationsStart);
  assert.ok(overviewStart >= 0 && applicationsStart > overviewStart && devicesStart > applicationsStart);

  const overview = dashboard.slice(overviewStart, applicationsStart);
  const applications = dashboard.slice(applicationsStart, devicesStart);
  assert.match(overview, /localRuntime && app\.localUrl/);
  assert.match(applications, /localRuntime && app\.localUrl/);
});
