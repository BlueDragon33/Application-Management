import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dashboard = fs.readFileSync("app/management-dashboard-v2.tsx", "utf8");

test("localRuntime is explicitly threaded into child views that use it", () => {
  assert.match(
    dashboard,
    /<Overview[\s\S]*?syncOperations=\{syncOperationsNow\}[\s\S]*?localRuntime=\{localRuntime\}[\s\S]*?\/>/,
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
  const helperStart = dashboard.indexOf("function webAccessAvailable(");
  const helperEnd = dashboard.indexOf("function intentionalNonRemoteMode(", helperStart);
  assert.ok(helperStart >= 0 && helperEnd > helperStart);

  const helper = dashboard.slice(helperStart, helperEnd);
  assert.match(helper, /summary\?\.webAccessPolicy === "deny"/);
  assert.match(helper, /localRuntime && app\.localUrl/);

  assert.match(dashboard, /const hasWeb = webAccessAvailable\(app, summary, localRuntime\)/);
});
