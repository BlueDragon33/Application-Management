import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";
const root="app/tools/russian-time-trainer/";
const {createDisplayMasterHistory}=loadTs(root+"display-master-history.ts");
const {trainerStoragePrefix}=loadTs(root+"progress.ts");
const prefix=trainerStoragePrefix("fixture:user");
const data={"lesson":"asking","solved:en-ru/what-time":"1","memory:v1:today-1:reading":JSON.stringify({stage:2,due:123,attempts:3})};
function store(extra={}){const values={...data,...extra},calls=[];return {calls,getItem(key){calls.push(key);assert.ok(key.startsWith(prefix));return values[key.slice(prefix.length)]??null}}}
test("history export uses only current user known keys, preserves history and omits identity",()=>{const s=store(),p=createDisplayMasterHistory(s,prefix);assert.equal(p.kind,"RUSSIAN_TIME_TRAINER_HISTORY_V1");assert.equal(p.sourceContract,"dc0389e2466db6dc37661dec814c265e92d8d2d2");assert.equal(p.lessonId,"asking");assert.deepEqual(Array.from(p.attempted),["en-ru/what-time"]);assert.deepEqual(Array.from(p.solved),["en-ru/what-time"]);assert.equal(p.memory.length,1);assert.equal(p.memory[0].entry.due,123);assert.ok(!JSON.stringify(p).includes("fixture"));assert.ok(s.calls.length>0)});
test("invalid flag, unknown lesson, corrupt or extra-field memory fail closed",()=>{for(const extra of [{"lesson":"unknown"},{"solved:en-ru/what-time":"2"},{"memory:v1:today-1:reading":"bad"},{"memory:v1:today-1:reading":JSON.stringify({stage:2,due:123,attempts:3,unknown:"x"})}])assert.throws(()=>createDisplayMasterHistory(store(extra),prefix));assert.throws(()=>createDisplayMasterHistory(store(),"wrong:"))});
test("mid-snapshot storage change is rejected",()=>{const s=store();let seen=0;assert.throws(()=>createDisplayMasterHistory({getItem(k){if(k===prefix+"lesson"&&++seen>1)return "hours";return s.getItem(k)}},prefix),/HISTORY_CHANGED_RETRY/)});
