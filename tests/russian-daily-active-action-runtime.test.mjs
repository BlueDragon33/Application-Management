import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const source=readFileSync(new URL("../app/apps/russian-daily/actions.ts",import.meta.url),"utf8");
const latestSource="1909ef964d4b518c8e8d9d319775f64744ab5b46";
const transformed=source
 .replace(/^"use server";\s*/,"")
 .replace(/import \{ requireChatGPTUser \} from [^\n]+;\s*/,"")
 .replace(/import \{ getApplicationConfig \} from [^\n]+;\s*/,"")
 .replace(/export type ActiveNextActionStep = \{[\s\S]*?\n\};\s*/,"")
 .replace(/export type RussianDailyActiveRunReceipt = \{[\s\S]*?\n\};\s*/,"")
 .replace(/const steps: ActiveNextActionStep\[\]/,"const steps")
 .replace(/export async function runRussianDailyActiveNextAction\(\): Promise<RussianDailyActiveRunReceipt>/,
  "async function runRussianDailyActiveNextAction()");
assert.doesNotMatch(transformed,/\bimport\b|\bexport\b|: ActiveNextActionStep/);
assert.doesNotMatch(transformed,/\bfetch\s*\(|\beval\s*\(|\bglobalThis\b|GITHUB_TOKEN|VERCEL_TOKEN/);
const good={id:"russian-daily",tier:"client",repository:"BlueDragon33/Bauman-Russian-iOS",contractState:"pending"};
function instantiate(app=good,authorized=true){
 let authenticated=0;
 const ctx={
  requireChatGPTUser:async path=>{
   if(!authorized)throw new Error("AUTH_REQUIRED");
   assert.equal(path,"/apps/russian-daily");authenticated++;
  },
  getApplicationConfig:()=>app
 };
 const run=vm.runInNewContext(transformed+"\nrunRussianDailyActiveNextAction;",ctx,{timeout:1500});
 return {run,authCount:()=>authenticated};
}
test("one call reads all six bounded stages and returns exact source receipt",async()=>{
 const task=instantiate(),r=await task.run();
 assert.equal(task.authCount(),1);
 assert.equal(r.status,"BLOCKED_PROVIDER_AUTH");
 assert.equal(r.sourceRevision,latestSource);
 assert.equal(r.steps.length,6);
 assert.equal(r.steps[3].result,"NOT_VERIFIED");
 assert.equal(r.steps[4].result,"BLOCKED");
 assert.equal(r.steps[5].result,"BLOCKED");
 assert.equal(r.hasDeployedSite,false);
 assert.equal(r.developerApproval,false);
 assert.equal(r.grantedPrivileges,false);
});
test("unexpected production URL or already connected application fail closed",async()=>{
 for(const x of [{...good,publicUrl:"https://example.invalid/"},{...good,contractState:"connected"}]){
  const r=await instantiate(x).run();
  assert.equal(r.status,"BLOCKED_SOURCE_MISMATCH");
  assert.equal(r.steps[2].result,"BLOCKED");
 }
});
test("wrong or missing app identity never grants execution",async()=>{
 for(const x of [{...good,repository:"unknown/repo"},undefined]){
  const r=await instantiate(x).run();
  assert.equal(r.status,"BLOCKED_SOURCE_MISMATCH");
  assert.equal(r.hasDeployedSite,false);
 }
});
test("failed authentication propagates without fake receipt",async()=>{
 await assert.rejects(instantiate(good,false).run(),/AUTH_REQUIRED/);
});
