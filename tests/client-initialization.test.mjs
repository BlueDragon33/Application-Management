import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

function scheduler() {
  return loadTs("app/client-initialization.ts").scheduleClientInitialization;
}

test("client initialization waits until the current effect turn finishes", async () => {
  const initialize = scheduler();
  const events = [];
  initialize(() => events.push("initialized"));
  events.push("subscribed");
  assert.deepEqual(events, ["subscribed"]);
  await Promise.resolve();
  assert.deepEqual(events, ["subscribed", "initialized"]);
});

test("effect cleanup cancels an initializer before it reads browser state", async () => {
  const initialize = scheduler();
  let initialized = 0;
  const cancel = initialize(() => { initialized++; });
  cancel();
  cancel();
  await Promise.resolve();
  assert.equal(initialized, 0);
});

test("a replaced effect runs only the latest initializer", async () => {
  const initialize = scheduler();
  const values = [];
  const cancel = initialize(() => values.push("previous account"));
  cancel();
  initialize(() => values.push("current account"));
  await Promise.resolve();
  assert.deepEqual(values, ["current account"]);
});
