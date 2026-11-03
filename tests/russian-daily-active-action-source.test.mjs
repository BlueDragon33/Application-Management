import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const action=readFileSync(new URL("../app/apps/russian-daily/actions.ts",import.meta.url),"utf8");
const ui=readFileSync(new URL("../app/apps/russian-daily/next-action-controls.tsx",import.meta.url),"utf8");
test("one click runs bounded server evaluation, no fake navigation",()=>{
  assert.match(ui,/onClick=\{\(\) => void execute\(\)\}/);
  assert.match(ui,/runRussianDailyActiveNextAction\(\)/);
  assert.doesNotMatch(ui,/location.assign|window.open|setTimeout\(/);
  assert.match(action,/requireChatGPTUser\("\/apps\/russian-daily"\)/);
  assert.match(action,/getApplicationConfig\("russian-daily"\)/);
  assert.match(action,/steps\.push\(\{key:"deployment"/);
  assert.match(action,/result:"BLOCKED"/);
  assert.match(action,/grantedPrivileges:false/);
  assert.match(action,/hasDeployedSite:false/);
  assert.doesNotMatch(action,/fetch\(|vercel\.deploy|GITHUB_TOKEN|secrets|approvePullRequest/);
});
