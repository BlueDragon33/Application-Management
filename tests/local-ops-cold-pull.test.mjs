import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {coldPullAll} from "../scripts/local-ops-cold-pull.mjs";

test("cold updater refuses all operations when any runtime is active",async()=>{
  let updates=0;
  const result=await coldPullAll({
    preflight:async()=>({ok:false,reason:"COLD_PULL_RUNTIME_STILL_ACTIVE",ports:[3000,3011]}),
    discover:()=>["repo-one"],update:async()=>{updates++;return {state:"updated"};}
  });
  assert.equal(result.status,"BLOCKED");assert.equal(updates,0);
  assert.deepEqual(result.ports,[3000,3011]);
});
test("cold updater checks safety between repos and does not force a partial update",async()=>{
  let reads=0,updates=0;
  const result=await coldPullAll({
    preflight:async()=>++reads<3?{ok:true,ports:[]}:{ok:false,reason:"COLD_PULL_RUNTIME_STILL_ACTIVE",ports:[3004]},
    discover:()=>["repo-one","repo-two"],
    update:async()=>{updates++;return {name:"repo-one",state:"updated",sha:"a".repeat(40)};}
  });
  assert.equal(result.status,"BLOCKED");
  assert.equal(updates,1);assert.equal(result.results.length,1);
  assert.deepEqual(result.ports,[3004]);
});
test("cold updater uses the same strict clean-main Git ff-only implementation",async()=>{
  const updater=readFileSync(new URL("../scripts/local-ops-cold-pull.mjs",import.meta.url),"utf8");
  const vbs=readFileSync(new URL("../UPDATE_BAUMANWEB_MAIN.vbs",import.meta.url),"utf8");
  assert.match(updater,/import \{ portOccupied, gitRepositories, pullRepository \}/);
  assert.match(updater,/trackedPorts = Array\.from\(\{length:12\}/);
  assert.match(updater,/COLD_PULL_RUNTIME_STILL_ACTIVE/);
  assert.doesNotMatch(updater,/taskkill|Stop-Process|--force|git reset|git rebase/);
  assert.match(vbs,/local-ops-cold-pull\.mjs/);
  assert.doesNotMatch(vbs,/taskkill|Stop-Process|shutdown/);
});
