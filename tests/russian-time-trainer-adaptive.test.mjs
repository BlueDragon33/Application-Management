import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { loadTs } from "./helpers/load-ts.mjs";
const root = "app/tools/russian-time-trainer/";
const { adaptiveTasks, adaptiveTask, adaptiveTexts } = loadTs(root + "adaptive-content.ts");
const { resolveAudioClip, bundledAudio } = loadTs(root + "audio-assets.ts");
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
  assert.equal(recordAdaptiveAnswer(entries, sound.id, sound.correct, now, "device", storage, prefix), entries);
  assert.equal(memoryEntry(entries, sound.id, "sound"), undefined);
  // State-layer contract only; the real audio source is supplied by the completed playback event.
  entries = recordAdaptiveAnswer(entries, sound.id, sound.correct, now, "prepared", storage, prefix);
  assert.equal(memoryEntry(entries, sound.id, "sound").evidence.audioSource, "prepared");
  assert.ok(nextReview(entries, now));
  assert.equal(memoryEntry(entries, sound.id, "listening"), undefined);
});

test("exact-text adaptive audio reuse preserves 17 existing local assets and never substitutes a near match", () => {
  const texts = [...new Set(adaptiveTexts.map(t => t.ru))];
  const matches = texts.map(ru => resolveAudioClip(ru, "unmatched")).filter(clip => bundledAudio(clip));
  assert.ok(matches.length >= 17);
  assert.equal(resolveAudioClip("Кото́рый ча́с?", "invalid").id, "what-time");
  assert.equal(resolveAudioClip("У́тром я пью чай.", "invalid").id, "morning-example");
  assert.equal(bundledAudio(resolveAudioClip("Утром я пью чай!", "invalid")), undefined);
  assert.equal(bundledAudio(resolveAudioClip("сегодня", "tomorrow-1")).source, "recording");
});
test("device-only sound preview cannot promote or overwrite real SRS evidence", () => {
  const sound = adaptiveTasks.find(task => task.skill === "sound");
  const now = 10000;
  const empty = {};
  let writes = 0;
  const storage = { setItem: () => { writes++; } };
  for (let i = 0; i < 5; i++) {
    assert.equal(recordAdaptiveAnswer(empty, sound.id, sound.correct, now, "device", storage), empty);
  }
  assert.equal(writes, 0);
  const recorded = recordAdaptiveAnswer(empty, sound.id, sound.correct, now, "prepared");
  assert.equal(recordAdaptiveAnswer(recorded, sound.id, 1 - sound.correct, now, "device", storage), recorded);
  assert.equal(writes, 0);
  const legacy = { [sound.id + ":sound"]: { stage: 0, due: now, attempts: 1,
    evidence: { choice: sound.correct, correct: true, wrongAttempts: 0, audioSource: "device" } } };
  assert.equal(nextReview(legacy, now), undefined);
});

test("exact eight candidate bytes are provenance-bound and cannot create assessment evidence", () => {
  const manifest = JSON.parse(readFileSync("public/russian-time-trainer/sound-candidate/manifest.json", "utf8"));
  assert.equal(manifest.admission, "CANDIDATE_ONLY");
  assert.equal(manifest.humanAudioQuality, "UNVERIFIED");
  assert.equal(manifest.assets.length, 8);
  for (const asset of manifest.assets) {
    const task = adaptiveTask(asset.id);
    const clip = resolveAudioClip(task.options[task.correct].ru, task.id);
    const bundled = bundledAudio(clip);
    assert.equal(clip.ru, asset.word);
    assert.equal(bundled.source, "candidate");
    assert.equal(bundledAudio({ id: task.id, ru: "другое слово" }), undefined);
    const file = readFileSync("public" + bundled.src);
    assert.equal(file.length, asset.bytes);
    assert.equal(createHash("sha256").update(file).digest("hex"), asset.sha256);
    const empty = {};
    assert.equal(recordAdaptiveAnswer(empty, task.id, task.correct, 10000, "candidate"), empty);
  }
});
