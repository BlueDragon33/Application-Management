import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) { return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8"); }

const visibleSources = [
  "app/application-registry.ts",
  "app/management-modern-overview.tsx",
  "app/management-quick-actions.tsx",
  "app/apps/bauman-master-ai/bauman-admin.tsx",
  "app/apps/boi-ech/boi-ech-control-center.tsx",
  "app/apps/growup-mychildren/growup-admin.tsx",
  "app/apps/health-care/health-care-admin.tsx",
  "app/apps/ru-life/ru-life-admin.tsx",
  "app/apps/cad-cam-3d/cad-admin.tsx",
];

const forbidden = ["Quản trị Ứng dụng Ver2","Kiểm soát Ver2","Ver 2","Management contract V1","Bauman Control v4","Device Gate v4"];

test("user-visible management copy does not expose release labels", () => {
  for (const path of visibleSources) {
    const text = source(path);
    for (const label of forbidden) assert.equal(text.includes(label), false, `${path} must not expose ${label}`);
  }
});
