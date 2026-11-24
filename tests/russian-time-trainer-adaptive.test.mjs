import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";
const root = "app/tools/russian-time-trainer/";
const { adaptiveTasks, adaptiveTask } = loadTs(root + "adaptive-content.ts");
const { recordAdaptiveAnswer, recordAdaptiveSelfRecall, readMemory, memoryEntry, nextReview, nextAdaptiveTask, adaptiveEligible } = loadTs(root + "memory.ts");
const { trainerStoragePrefix } = loadTs(root + "progress.ts");
test("V6.1 supplemental tasks have stable IDs, valid answers and an acyclic prerequisite chain", () => {
  assert.equal(adaptiveTasks.length, 20);
  assert.equal(new Set(adaptiveTasks.map(task => task.id)).size, 20);
  for (const task of adaptiveTasks) {
    assert.ok(task.options[task.correct]);
    assert.equal(new Set(task.options.map(option => option.ru)).size, task.options.length);
    let parent = task.requires;
    const seen = new Set([task.id]);
    while (parent) {
      assert.ok(!seen.has(parent) && adaptiveTask(parent));
      seen.add(parent); parent = adaptiveTask(parent).requires;
    }
    if (task.skill === "sound") assert.ok(task.options.every(option => option.ipa) && !task.prompt);
  }
});
test("adaptive results use existing SRS namespace, prerequisites, evidence, and separate self-report", () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const prefix = trainerStoragePrefix("A");
  let entries = {};
  const now = 10000;
  const foundation = adaptiveTask("adaptive-meet-foundation");
  const first = adaptiveTask("adaptive-meet-first");
  const follow = adaptiveTask("adaptive-meet-follow");
  assert.equal(nextAdaptiveTask(entries, now, "context").id, foundation.id);
  assert.equal(recordAdaptiveAnswer(entries, first.id, first.correct, now), entries);
  entries = recordAdaptiveAnswer(entries, foundation.id, foundation.correct, now, undefined, storage, prefix);
  assert.ok(adaptiveEligible(first, entries));
  entries = recordAdaptiveAnswer(entries, first.id, 1, now, undefined, storage, prefix);
  assert.equal(memoryEntry(entries, first.id, "context").evidence.correct, false);
  assert.equal(adaptiveEligible(follow, entries), false);
  entries = recordAdaptiveAnswer(entries, first.id, first.correct, now, undefined, storage, prefix);
  assert.ok(adaptiveEligible(follow, entries));
  const before = memoryEntry(entries, first.id, "context");
  entries = recordAdaptiveSelfRecall(entries, first.id, false, storage, prefix);
  const after = memoryEntry(entries, first.id, "context");
  assert.equal(after.stage, before.stage);
  assert.equal(after.due, before.due);
  assert.equal(after.attempts, before.attempts);
  assert.equal(after.evidence.selfRecall, false);
  assert.equal(after.evidence.wrongAttempts, 1);
  assert.equal(after.evidence.lastWrongChoice, 1);
  assert.equal(after.evidence.correct, true);
  assert.deepEqual(readMemory(storage, prefix), entries);
  assert.deepEqual(readMemory(storage, trainerStoragePrefix("B")), {});
  const sound = adaptiveTasks.find(task => task.skill === "sound");
  assert.equal(recordAdaptiveAnswer(entries, sound.id, sound.correct, now), entries);
  entries = recordAdaptiveAnswer(entries, sound.id, sound.correct, now, "device", storage, prefix);
  assert.equal(memoryEntry(entries, sound.id, "sound").evidence.audioSource, "device");
  assert.ok(nextReview(entries, now));
  assert.equal(memoryEntry(entries, sound.id, "listening"), undefined);
});
