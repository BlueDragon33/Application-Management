import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { runInNewContext } from "node:vm";
import { loadTs } from "./helpers/load-ts.mjs";

const root = "app/tools/russian-time-trainer/";

test("V6.1 uses the canonical review policy; immediate retries never reach long intervals", () => {
  const { scheduleReview } = loadTs(root + "memory.ts");
  const now = 10000;
  let entry;
  for (let i = 0; i < 5; i++) entry = scheduleReview(entry, true, now);
  assert.equal(entry.stage, 1);
  assert.equal(entry.due, now + 86400000);
  const later = scheduleReview(entry, true, entry.due);
  assert.equal(later.stage, 2);
  assert.equal(scheduleReview(later, false, later.due).stage, 0);
});

test("knowledge connections reference canonical forms without duplicate or self links", () => {
  const { knowledgeLinks } = loadTs(root + "knowledge-links.ts");
  const { calendarForms } = loadTs(root + "calendar-content.ts");
  const ids = new Set(calendarForms.map(form => form.id));
  for (const { id } of calendarForms) {
    const links = knowledgeLinks(id);
    assert.equal(new Set(links.map(link => link.id)).size, links.length);
    assert.ok(links.every(link => ids.has(link.id) && link.id !== id));
  }
  assert.ok(knowledgeLinks("tomorrow-1").some(link => link.id === "morning-1" && link.relation === "context"));
  assert.ok(knowledgeLinks("wednesday-1").some(link => link.id === "wednesday-2" && link.relation === "form"));
  assert.ok(knowledgeLinks("dec-1").some(link => link.id === "jan-1" && link.relation === "next"));
  assert.deepEqual(knowledgeLinks("invalid"), []);
});

test("playback evidence requires start then end, and cancellation rejects stale completion", () => {
  const instances = [];
  class FakeAudio {
    constructor() { instances.push(this); }
    getAttribute() { return null; }
    play() { return Promise.resolve(); }
    pause() {}
  }
  const window = { setTimeout: () => 1, clearTimeout: () => {} };
  const { useRussianAudio } = loadTs(root + "pronunciation.tsx", {
    react: { useEffect: () => {}, useRef: value => ({ current: value }), useState: value => [value, () => {}] },
    "./audio-assets": { bundledAudio: () => ({ src: "/sample.mp3", source: "recording" }) },
  }, { window, Audio: FakeAudio });
  const speech = useRussianAudio();
  let complete = 0;
  const play = () => speech.play("test", [{ id: "test", ru: "тест" }], undefined, () => { complete++; });
  play();
  instances.at(-1).onended();
  assert.equal(complete, 0);
  play();
  instances.at(-1).onplaying();
  assert.equal(complete, 0);
  instances.at(-1).onended();
  assert.equal(complete, 1);
  play();
  instances.at(-1).onplaying();
  const stale = instances.at(-1).onended;
  speech.stop();
  stale();
  assert.equal(complete, 1);
});


test("Chatterbox pilot exact media is candidate-only and cannot shadow legacy audio or score", () => {
  const { chatterboxCandidateAssets } = loadTs(root + "chatterbox-audio.ts");
  const { bundledAudio, resolveAudioClip, previewAudio } = loadTs(root + "audio-assets.ts");
  const { recordAdaptiveAnswer } = loadTs(root + "memory.ts");
  const { adaptiveTasks } = loadTs(root + "adaptive-content.ts");
  const manifest = JSON.parse(readFileSync("public/russian-time-trainer/chatterbox-candidate/manifest.json","utf8"));
  assert.equal(manifest.admission,"CANDIDATE_ONLY");
  assert.equal(manifest.assets.length,11);
  assert.equal(chatterboxCandidateAssets.length,11);
  for (const a of chatterboxCandidateAssets) {
    const clip = resolveAudioClip(a.ru,a.id);
    const bundled = bundledAudio(clip);
    assert.equal(clip.id,a.id);
    assert.equal(bundled.source,"candidate");
    assert.ok(previewAudio(bundled.source));
    assert.equal(bundledAudio({id:a.id,ru:a.ru+"!"}),undefined);
    const raw = readFileSync("public"+bundled.src);
    assert.equal(raw.length,a.bytes);
    assert.equal(createHash("sha256").update(raw).digest("hex"),a.sha256);
    assert.equal(manifest.assets.find(x=>x.id===a.id).sha256,a.sha256);
  }
  assert.equal(bundledAudio(resolveAudioClip("Который час?","what-time")).source,"prepared");
  assert.equal(bundledAudio(resolveAudioClip("понедельник","monday-1")).source,"recording");
  const sound=adaptiveTasks.find(task=>task.skill==="sound"), entries={};
  assert.equal(recordAdaptiveAnswer(entries,sound.id,sound.correct,10000,"candidate"),entries);
});

test("Service Worker activation preserves the exact public Chatterbox cache while cleaning stale caches", async () => {
  const { chatterboxCacheName } = loadTs(root + "chatterbox-audio.ts");
  const listeners = new Map(), deleted = [];
  let claimed = false, pending;
  runInNewContext(readFileSync("public/sw.js", "utf8"), {
    self: { addEventListener: (name, fn) => listeners.set(name, fn), clients: { claim: async () => { claimed = true; } } },
    caches: { keys: async () => ["application-management-webapp-v2", "application-management-webapp-v1", chatterboxCacheName, "other-old-cache"], delete: async key => { deleted.push(key); return true; } },
  });
  listeners.get("activate")({ waitUntil: promise => { pending = promise; } });
  await pending;
  assert.deepEqual(deleted, ["application-management-webapp-v1", "other-old-cache"]);
  assert.equal(claimed, true);
});
