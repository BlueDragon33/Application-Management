import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Bauman operations adapter consumes the live control policy", () => {
  const operations = source("app/api/operations/route.ts");
  assert.match(operations, /const policy = record\(status\.policy\)/);
  assert.match(operations, /applicationManagementMayOpenLearningRuntimeDirectly/);
  assert.match(operations, /webHref: directRuntimeOpenAllowed \? bridge\.runtimeBaseUrl : null/);
  assert.match(operations, /webAccessPolicy: directRuntimeOpenAllowed \? "allow" as const : "deny" as const/);
  assert.match(operations, /contentReviewReady = bool\(capabilities\.contentReviewApi\)/);
});

test("main dashboard never falls back to a public URL when policy denies direct web access", () => {
  const dashboard = source("app/management-dashboard-v2.tsx");
  assert.match(dashboard, /summary\?\.webAccessPolicy === "deny"/);
  assert.match(dashboard, /function webAccessAvailable/);
  assert.match(dashboard, /return false/);
  assert.match(dashboard, /Contract ứng dụng không cho Application Management mở learning runtime trực tiếp/);
  assert.match(dashboard, /Không mở trực tiếp/);
});

test("Bauman admin reports content review from live capability instead of hardcoded missing", () => {
  const admin = source("app/apps/bauman-master-ai/bauman-admin.tsx");
  const client = source("app/admin-device-client.ts");
  assert.match(client, /contentReviewReady\?: boolean/);
  assert.match(client, /webAccessPolicy\?: "allow" \| "deny" \| "unknown"/);
  assert.match(admin, /summary\?\.contentReviewReady \? "available" : "implemented"/);
  assert.doesNotMatch(admin, /Content review API", state: "missing"/);
  assert.match(admin, /Learning runtime không được mở trực tiếp từ Application Management/);
});
