import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const file = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("academic routes inherit existing Application Management login gate", () => {
  const thesis = file("app/tools/thesis-planner/page.tsx");
  const coursework = file("app/apps/coursework-workbench/page.tsx");
  assert.match(thesis, /requireChatGPTUser\("\/tools\/thesis-planner"\)/);
  assert.match(coursework, /requireChatGPTUser\("\/apps\/coursework-workbench"\)/);
});

test("launcher lists both academic workspaces without connected client claim", () => {
  const launcher = file("app/management-dashboard-v2.tsx");
  assert.match(launcher, /id: "tool-thesis-planner"/);
  assert.match(launcher, /href: "\/tools\/thesis-planner"/);
  assert.match(launcher, /id: "tool-coursework-workbench"/);
  assert.match(launcher, /href: "\/apps\/coursework-workbench"/);
});

test("two independent local stores, scoped by account, with a backup path", () => {
  const thesis = file("app/tools/thesis-planner/thesis-planner.tsx");
  const coursework = file("app/apps/coursework-workbench/coursework-workbench.tsx");
  assert.match(thesis, /application-management:thesis-planner:v1:/);
  assert.match(coursework, /application-management:coursework-workbench:v1:/);
  for (const source of [thesis, coursework]) {
    assert.match(source, /encodeURIComponent\(user\.email/);
    assert.match(source, /localStorage\.setItem/);
    assert.match(source, /JSON\.parse\(await file\.text\(\)\)/);
    assert.match(source, /URL\.createObjectURL/);
    assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|navigator\.sendBeacon/);
  }
});

test("evidence state requires a nonempty user-entered evidence reference", () => {
  const thesis = file("app/tools/thesis-planner/thesis-planner.tsx");
  const coursework = file("app/apps/coursework-workbench/coursework-workbench.tsx");
  assert.match(thesis, /value === "evidence" && !current\.evidence\.trim\(\)/);
  assert.match(coursework, /value === "evidence" && !prior\.evidence\.trim\(\)/);
});
