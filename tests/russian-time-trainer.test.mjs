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
