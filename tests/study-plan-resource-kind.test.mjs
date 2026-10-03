import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
}

test("study-plan registry preserves Bauman resource kinds", () => {
  const loader = source("app/tools/study-plan/bauman-module-registry.ts");
  assert.match(loader, /kind: "subject-site" \| "module" \| "workflow"/);
  assert.match(loader, /client\.kind === "subject-site"/);
  assert.match(loader, /client\.kind === "module"/);
  assert.match(loader, /client\.kind === "workflow"/);
  assert.match(loader, /kind: client\.kind as "subject-site" \| "module" \| "workflow"/);
});

test("practice coverage is presented as a workflow instead of a fake theory module", () => {
  const ui = source("app/tools/study-plan/study-plan.tsx");
  assert.match(ui, /relatedIsWorkflow = relatedModule\?\.kind === "workflow"/);
  assert.match(ui, /relatedWorkflow: "Có workflow thực hành liên quan"/);
  assert.match(ui, /workflowNote: "Nguồn này là workflow checklist\/nhật ký\/minh chứng/);
  assert.match(ui, /relatedIsWorkflow \? t\.openWorkflow : t\.openModule/);
  assert.match(ui, /Đã có học liệu\/workflow/);
});
