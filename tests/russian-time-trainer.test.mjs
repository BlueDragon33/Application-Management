import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTs } from "./helpers/load-ts.mjs";

const root = "app/tools/russian-time-trainer/";
const { timeLessons, translatedWord, translateStudyText } = loadTs(root + "content.ts");
const {
  emptyProgress, exerciseCount, practiceKey, readTrainingProgress, recordTrainingAnswer, trainerStoragePrefix,
} = loadTs(root + "progress.ts");

test("the EN/RU course has unique exercises and contextual Vietnamese glosses", () => {
  const ids = timeLessons.flatMap(lesson => lesson.examples.map(item => item.id));
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(exerciseCount, ids.length * 2);
  for (const lesson of timeLessons) {
    assert.ok(lesson.title.en && lesson.title.ru);
    for (const text of [lesson.objective, lesson.rule, ...lesson.examples.map(item => item.phrase)]) {
      assert.equal(translateStudyText(text.en).meaning, text.vi);
      assert.equal(translateStudyText(text.ru).meaning, text.vi);
      for (const line of [text.en, text.ru]) {
        const words = line.match(/[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*/gu) ?? [];
        for (const word of words) assert.ok(translatedWord(word), "Missing word gloss: " + word);
      }
    }
  }
  assert.deepEqual(translateStudyText("ПОЛОВИ́НА девя́того."), { kind: "exact", meaning: "tám giờ rưỡi" });
  assert.deepEqual(translateStudyText("  AT HALF PAST EIGHT  "), { kind: "exact", meaning: "lúc tám giờ rưỡi" });
  assert.equal(translateStudyText("quarter").kind, "exact");
  assert.equal(translateStudyText("quarter xyzword").kind, "words");
  assert.equal(translateStudyText("xyzword").kind, "missing");
});

test("browser progress is scoped by identity and later retries preserve a solved result", () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const prefix = trainerStoragePrefix("learner A");
  const first = practiceKey("en-ru", "what-time");
  const reverse = practiceKey("ru-en", "what-time");
  storage.setItem(prefix + "lesson", "hours");
  recordTrainingAnswer(storage, prefix, first, true);
  recordTrainingAnswer(storage, prefix, first, false);
  recordTrainingAnswer(storage, prefix, reverse, false);
  recordTrainingAnswer(storage, prefix, "invalid", true);
  assert.deepEqual(readTrainingProgress(storage, prefix), { lessonId: "hours", attempted: [first, reverse], solved: [first] });
  assert.deepEqual(readTrainingProgress(storage, trainerStoragePrefix("learner B")), emptyProgress);
  storage.setItem(prefix + "lesson", "removed-lesson");
  assert.equal(readTrainingProgress(storage, prefix).lessonId, null);
});

test("initial trainer markup has language boundaries and no Vietnamese translation", () => {
  const Trainer = loadTs(root + "trainer.tsx", {
    "next/link": { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) },
  }).default;
  const html = renderToStaticMarkup(React.createElement(Trainer, { storagePrefix: trainerStoragePrefix("qa") }));
  assert.match(html, /<main lang="en"/);
  assert.match(html, /lang="ru"/);
  assert.doesNotMatch(html, /lang="vi"|Bây giờ|Tiết học|tám giờ/u);
  assert.match(html, /Help.*?Помощь/);
  assert.match(html, /disabled=""[^>]*>Copy reviewed prompt/);
});

test("both dashboard variants share one authenticated trainer tool entry", () => {
  const { russianTimeTrainerTool } = loadTs(root + "tool-entry.ts");
  assert.equal(russianTimeTrainerTool.href, "/tools/russian-time-trainer");
  for (const path of ["app/management-dashboard-v2.tsx", "app/application-hub.tsx"]) {
    const source = fs.readFileSync(path, "utf8");
    assert.match(source, /const systemTools(?:: readonly SystemTool\[\])? = \[[\s\S]*?russianTimeTrainerTool/);
    assert.doesNotMatch(source, /id: "tool-russian-time-trainer"/);
  }
  assert.match(fs.readFileSync(root + "page.tsx", "utf8"), /requireChatGPTUser\(russianTimeTrainerTool\.href\)/);
});

test("calendar course provides 35 groups and 62 distinct Russian forms with stress, IPA and contextual glosses", () => {
  const { calendarForms, calendarGroups } = loadTs(root + "calendar-content.ts");
  const { dailyLessons } = loadTs(root + "daily.ts");
  assert.deepEqual(Object.fromEntries(Object.entries(Object.groupBy(calendarGroups, item => item.category))
    .map(([category, groups]) => [category, groups.length])), { relative: 8, day: 4, week: 7, season: 4, month: 12 });
  assert.equal(calendarForms.length, 62);
  assert.equal(new Set(calendarForms.map(form => form.id)).size, 62);
  assert.equal(dailyLessons.length, 14);
  for (const form of calendarForms) {
    assert.match(form.stressed, /[\u0301ё]/u);
    assert.ok(form.ipa && form.en && form.vi);
    assert.equal(translatedWord(form.stressed), form.vi);
  }
  assert.ok(dailyLessons.every(day => day.groups.every(id => calendarGroups.some(group => group.id === id))));
  assert.deepEqual(translateStudyText("в сре́ду"), { kind: "exact", meaning: "vào thứ Tư" });
});

test("recall dates advance independently and retain existing course progress", () => {
  const { readMemory, setMemory, memoryEntry, intervals, nextReview, spellingDifference } = loadTs(root + "memory.ts");
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const prefix = trainerStoragePrefix("learner A");
  const prior = practiceKey("en-ru", "what-time");
  recordTrainingAnswer(storage, prefix, prior, true);
  let now = 1000;
  let entries = {};
  for (const gap of intervals) {
    entries = setMemory(entries, "today-1", "spelling", true, now, storage, prefix);
    const entry = memoryEntry(readMemory(storage, prefix), "today-1", "spelling");
    assert.equal(entry.due, now + gap * 86400000);
    assert.equal(memoryEntry(entries, "today-1", "speaking"), undefined);
    now = entry.due;
  }
  assert.equal(nextReview(entries, now - 1), undefined);
  assert.equal(nextReview(entries, now).skill, "spelling");
  entries = setMemory(entries, "today-1", "spelling", false, now, storage, prefix);
  assert.equal(memoryEntry(entries, "today-1", "spelling").stage, 0);
  assert.deepEqual(readTrainingProgress(storage, prefix).solved, [prior]);
  assert.deepEqual(readMemory(storage, trainerStoragePrefix("learner B")), {});
  assert.deepEqual(spellingDifference("сиводня", "сего́дня"), { correct: false, typed: "ив", expected: "ег" });
  assert.equal(spellingDifference("ДНЕМ", "днём").correct, false);
});
