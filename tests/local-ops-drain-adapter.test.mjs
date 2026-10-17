import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { mkdtempSync, rmSync, openSync, writeSync, fsyncSync, closeSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { createLocalDrainAdapter } from "../scripts/local-ops-drain-adapter.mjs";

test("drain refuses to claim persistence when runtime/D1 hooks are not actually installed",async()=>{
  const tracker=createLocalDrainAdapter({identity:"unwired-worker"});
  const active=tracker.beginRequest();
  await assert.rejects(tracker.drain(),/NOT_WIRED/);
  assert.throws(()=>tracker.beginRequest(),/NEW_REQUEST_REFUSED/);
  active();
  assert.equal(tracker.status().actualRuntimeBound,false);
  assert.equal(tracker.status().drained,false);
});
test("synthetic Node D1-like write must finish and be durable before close/exit contract",async t=>{
  const tmp=mkdtempSync(join(tmpdir(),"am-drain-"));
  t.after(()=>rmSync(tmp,{recursive:true,force:true}));
  const target=join(tmp,"commit.fixture");
  let completeTransaction;
  let acceptStopped=false,closed=false,validated=false;
  const server=createServer((_req,res)=>res.end("fixture"));
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const tracker=createLocalDrainAdapter({
    identity:"QA-only",timeoutMs:4000,
    onStopAccepting:async()=>{acceptStopped=true;},
    verifyDurable:async()=>{
      assert.equal(acceptStopped,true);
      validated=readFileSync(target,"utf8")==="COMMITTED";
      return validated;
    },
    onClose:async()=>{await new Promise(resolve=>server.close(resolve));closed=true;}
  });
  const requestDone=tracker.beginRequest();
  const txn=tracker.transaction(async()=>{await new Promise(resolve=>{completeTransaction=resolve;});
    const fd=openSync(target,"w");try{writeSync(fd,"COMMITTED");fsyncSync(fd);}finally{closeSync(fd);}
  });
  const draining=tracker.drain();
  await delay(50);
  assert.equal(closed,false,"must not close HTTP before request+transaction drain");
  assert.throws(()=>tracker.beginRequest(),/NEW_REQUEST_REFUSED/);
  await assert.rejects(tracker.transaction(async()=>{}),/NEW_TRANSACTION_REFUSED/);
  requestDone();
  completeTransaction();
  await txn;
  const receipt=await draining;
  assert.equal(receipt.drained,true);
  assert.equal(receipt.exitObserved,false,"child exit must be checked by supervisor");
  assert.equal(validated,true);
  assert.equal(closed,true);
  assert.equal(tracker.status().requests,0);
  assert.equal(tracker.status().transactions,0);
});
test("in-flight timeout or unverified durability must fail closed, even when request count is zero",async()=>{
  let release;
  const stalled=createLocalDrainAdapter({identity:"stalled",timeoutMs:40,
    onStopAccepting:async()=>{},verifyDurable:async()=>true,onClose:async()=>{}});
  const active=stalled.beginRequest();
  await assert.rejects(stalled.drain(),/TIMEOUT/);
  active();
  assert.equal(stalled.status().drained,false);
  const durable=createLocalDrainAdapter({identity:"unverified",
    onStopAccepting:async()=>{},verifyDurable:async()=>false,onClose:async()=>{release=true;}});
  await assert.rejects(durable.drain(),/DURABILITY_UNVERIFIED/);
  assert.equal(durable.status().drained,false);
  assert.equal(release,undefined);
});
