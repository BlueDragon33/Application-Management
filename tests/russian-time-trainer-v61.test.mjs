import assert from "node:assert/strict";
import test from "node:test";
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
