import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const ui = readFileSync("app/apps/russian-daily/next-action-controls.tsx", "utf8");
const server = readFileSync("app/apps/russian-daily/actions.ts", "utf8");

test("one-click execution is wired to a real authenticated server action", () => {
  assert.match(ui, /onClick=\{\(\) => void executeEntireAuthorizedChain\(\)\}/);
  assert.match(ui, /await runRussianDailyNextAction\(\)/);
  assert.match(server, /await requireChatGPTUser\("\/apps\/russian-daily"\)/);
  assert.doesNotMatch(ui, /window\.location\.assign/);
});
test("server-side continuous pilot stops at required external authority", () => {
  for(const step of ["session","catalog","policy","source","provider","preview","review","production"])
    assert.ok(server.includes('id: "'+step+'"') || server.includes('["'+step+'"'),step);
  assert.match(server, /state:"BLOCKED_EXTERNAL_GATE"/);
  assert.match(server, /projectAuthority:"UNVERIFIED"/);
  assert.match(server, /workPackageExecution:false/);
  assert.match(server, /privilegedExecution:false/);
});
test("no paid/production/hidden-executor actions in the pilot", () => {
  assert.doesNotMatch(server, /fetch\(/);
  assert.doesNotMatch(server, /merge_pull_request|approve|deploy\(|workflow_dispatch|gh workflow run/);
  assert.doesNotMatch(ui, /setTimeout|setInterval|window\.location\.assign/);
});
