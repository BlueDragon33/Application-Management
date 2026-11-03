import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../"+path,import.meta.url),"utf8");
const route=read("app/apps/russian-daily/page.tsx");
const client=read("app/apps/russian-daily/next-action-controls.tsx");
const server=read("app/apps/russian-daily/actions.ts");
test("single primary NEXT ACTION, operable guidance and contextual CMD",()=>{
  assert.equal((client.match(/NEXT ACTION — TỰ LẬP KẾ HOẠCH & XỬ LÝ/g)||[]).length,1);
  assert.match(client,/aria-expanded=\{guide\}/);
  assert.match(client,/aria-controls="russian-daily-next-guide"/);
  assert.match(client,/onClick=\{\(\) => void runNextAction\(\)\}/);
  assert.match(client,/aria-expanded=\{showCmd\}/);
  assert.match(client,/id="russian-daily-cmd-output"/);
  assert.match(route,/<RussianDailyNextAction \/>/);
});
test("server reauth, stale registry guards and read-only navigation",()=>{
  assert.match(server,/"use server"/);
  assert.match(server,/await requireChatGPTUser\("\/apps\/russian-daily"\)/);
  assert.match(server,/application\.publicUrl \|\| application\.contractState === "connected"/);
  assert.match(server,/SAFE_NAVIGATION_ONLY/);
  assert.match(server,/UNVERIFIED/);
  assert.match(client,/window\.location\.assign\(next\.providerUrl\)/);
  assert.doesNotMatch(server,/merge_pull_request|workflow_dispatch|issueNewTurn|approve|createDeployment/);
});
