import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const script=fileURLToPath(new URL("../scripts/assert-preview-d1-inventory.mjs",import.meta.url));
const preview="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",production="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const example=[{uuid:production,name:"application-management-production-db"},{uuid:preview,name:"application-management-preview-db"}];
function check(inventory,env={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"app-d1-inventory-")),file=path.join(dir,"list.json");
 try {
  fs.writeFileSync(file,JSON.stringify(inventory));
  const p=spawnSync(process.execPath,[script,file],{encoding:"utf8",timeout:8_000,
   env:{PATH:process.env.PATH??"",APPLICATION_MANAGEMENT_PREVIEW_D1_DATABASE_ID:preview,
    APPLICATION_MANAGEMENT_PRODUCTION_D1_DATABASE_ID:production,...env}});
  assert.equal(p.error,undefined);
  return p;
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
test("remote inventory gate accepts only one exact Preview D1 name+ID distinct from Production",()=>{
 const p=check(example);assert.equal(p.status,0,p.stderr);assert.match(p.stdout,/Remote read-only D1 inventory PASS/);
});
test("remote inventory gate blocks absent Preview, full FREE account, collisions, wrong UUID and wrong account",()=>{
 const cases=[
  [{uuid:production,name:"application-management-production-db"}],
  Array.from({length:10},(_,i)=>({uuid:i===0?production:String(i+1).padStart(8,"0")+"-1111-4111-8111-111111111111",name:"another-db-"+i})),
  [{uuid:production,name:"application-management-production-db"},{uuid:preview,name:"wrong-name"}],
  [{uuid:production,name:"application-management-production-db"},{uuid:preview,name:"application-management-preview-db"},{uuid:preview,name:"application-management-preview-db"}],
  [{uuid:production,name:"application-management-preview-db"}],
  [{uuid:preview,name:"application-management-preview-db"}],
 ];
 for(const inventory of cases)assert.notEqual(check(inventory).status,0,JSON.stringify(inventory));
 assert.notEqual(check(example,{APPLICATION_MANAGEMENT_PREVIEW_D1_DATABASE_ID:production}).status,0);
});
