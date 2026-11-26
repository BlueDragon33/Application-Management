"use client";

import { lazy, Suspense, useEffect, useId, useMemo, useRef, useState } from "react";
import { calendarForms, calendarGroups, categories, soundNotes } from "./calendar-content";
import type { Bilingual } from "./content";
import { dailyLessons } from "./daily";
import { adaptiveEligible, adaptiveRecommendation, type LearningPriority, memoryEntry, nextAdaptiveTask, nextReview, readMemory, recordAdaptiveAnswer, recordAdaptiveSelfRecall, setMemory, skills, spellingDifference, type MemoryEntry, type ReviewSkill, type Skill } from "./memory";
import { PronunciationStatus, type AudioSettings, type useRussianAudio } from "./pronunciation";
import { Recording } from "./recording";
import { adaptiveTask, adaptiveTasks, type AdaptiveSkill } from "./adaptive-content";
import { resolveAudioClip, type AudioSource } from "./audio-assets";
import { chatterboxCandidateAssets, saveChatterboxOffline } from "./chatterbox-audio";
import { knowledgeLinks, type KnowledgeRelation } from "./knowledge-links";
import { StudyWords } from "./translation";
import styles from "./trainer.module.css";

const AdaptivePractice = lazy(() => import("./adaptive-practice"));

const modes = {
  listen: { en: "Listening Only", ru: "Только слушать" },
  repeat: { en: "Listen & Repeat", ru: "Слушай и повторяй" },
  shadow: { en: "Shadowing & Recording", ru: "Повтор с записью" },
  meaning: { en: "Meaning Recognition", ru: "Узнавание смысла" },
  read: { en: "Reading", ru: "Чтение" },
  speak: { en: "Speaking", ru: "Говорение" },
  dictate: { en: "Dictation", ru: "Диктант" },
  sound: { en: "Sound Lab", ru: "Различение звуков" },
  context: { en: "Conversation Lab", ru: "Диалоги и контекст" },
  review: { en: "Smart Review", ru: "Умное повторение" },
} satisfies Record<string, Bilingual>;

type Mode = keyof typeof modes;
type ExerciseMode = Exclude<Mode, "review" | AdaptiveSkill>;
type Memory = Record<string, MemoryEntry>;
const reviewModes: Record<ReviewSkill, ExerciseMode | AdaptiveSkill> = {
  listening: "repeat", understanding: "meaning", speaking: "speak", reading: "read", spelling: "dictate", sound: "sound", context: "context",
};
const assessedSkills: Partial<Record<ExerciseMode, Skill>> = {
  repeat: "listening", meaning: "understanding", shadow: "speaking", speak: "speaking", read: "reading", dictate: "spelling",
};
const scripts = {
  upper: { en: "Uppercase", ru: "Заглавные" },
  lower: { en: "Lowercase", ru: "Строчные" },
  cursive: { en: "Cursive", ru: "Рукописный текст" },
} satisfies Record<string, Bilingual>;

const immersionSteps = [{ en: "Observe", ru: "Наблюдай" }, { en: "Listen", ru: "Слушай" }, { en: "Imitate", ru: "Повторяй" }, { en: "Recall", ru: "Вспоминай" }] as const;

function Pair({ text }: { text: Bilingual }) {
  return <>{text.en} <span lang="ru">{text.ru}</span></>;
}

function AudioControls({ settings, change }: { settings: AudioSettings; change: (settings: AudioSettings) => void }) {
  return <div className={styles.audioControls}>
    <label><Pair text={{ en: "Speed", ru: "Скорость" }} />
      <select value={settings.rate} onChange={event => change({ ...settings, rate: Number(event.target.value) as AudioSettings["rate"] })}>
        <option value="0.5">0.5×</option><option value="0.75">0.75×</option><option value="1">1×</option>
      </select>
    </label>
    <label><Pair text={{ en: "Repeat", ru: "Повторы" }} />
      <select value={settings.repeats} onChange={event => change({
        ...settings, repeats: event.target.value === "continuous" ? "continuous" : Number(event.target.value) as 1 | 3 | 5,
      })}>
        <option value="1">1</option><option value="3">3</option><option value="5">5</option><option value="continuous">Continuous / Непрерывно</option>
      </select>
    </label>
    <label><Pair text={{ en: "Pause (seconds)", ru: "Пауза (секунды)" }} />
      <select value={settings.pause} onChange={event => change({ ...settings, pause: Number(event.target.value) as AudioSettings["pause"] })}>
        {[2, 3, 4, 5].map(value => <option key={value}>{value}</option>)}
      </select>
    </label>
  </div>;
}

const relationLabels: Record<KnowledgeRelation, Bilingual> = {
  form: { en: "Related form", ru: "Другая форма" },
  previous: { en: "Previous", ru: "Предыдущее" },
  next: { en: "Next", ru: "Следующее" },
  context: { en: "Related context", ru: "Связанный контекст" },
};

function Exercise({ form, mode, speech, hidden, heard, choiceSeed, onResult, onSelect, guidedStage, onRevealWithoutAssessment }: {
  form: typeof calendarForms[number]; mode: ExerciseMode; speech: ReturnType<typeof useRussianAudio>;
  hidden: boolean; heard: boolean; choiceSeed: number; guidedStage?: number;
  onResult: (skill: Skill, result: boolean, time: number) => void;
  onSelect: (id: string) => void;
  onRevealWithoutAssessment: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [script, setScript] = useState<keyof typeof scripts>("lower");
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<boolean>();
  const itemSelect = useId();
  const listening = mode === "listen" || mode === "repeat" || mode === "shadow";
  const recognition = mode === "meaning" || mode === "read";
  const recording = mode === "shadow" || mode === "speak";
  const showPrompt = mode === "read" || (listening && !hidden);
  const guidedRecall = guidedStage === 3;
  const showAnswer = (guidedStage === undefined || guidedRecall) && (revealed || result !== undefined);
  const display = script === "upper" ? form.ru.toUpperCase() : script === "lower" ? form.ru.toLowerCase() : form.ru;
  const choices = [form, ...calendarForms.filter(item => item.group.category === form.group.category &&
    item.id !== form.id && item.en !== form.en && item.id.endsWith(form.id.slice(form.id.lastIndexOf("-")))).slice(0, 2)];
  const sortedChoices = choices.sort((a, b) => a.en.localeCompare(b.en));
  const offset = choiceSeed % sortedChoices.length;
  const orderedChoices = [...sortedChoices.slice(offset), ...sortedChoices.slice(0, offset)];

  function assess(correct: boolean) {
    const skill = assessedSkills[mode];
    if (!skill || result !== undefined) return;
    setResult(correct);
    onResult(skill, correct, Date.now());
  }

  return <>
    {mode === "speak" && <p className={styles.phrase}><StudyWords text={form.en} language="en" /></p>}
    {guidedRecall && <p className={styles.saveNote}>Say the Russian phrase before checking. Your self-report is not a pronunciation score. <span lang="ru">Произнесите фразу до проверки. Самооценка не является оценкой произношения.</span></p>}
    {mode === "read" && <label htmlFor={itemSelect} className={styles.field}><Pair text={{ en: "Script", ru: "Начертание" }} />
      <select id={itemSelect} value={script} onChange={event => setScript(event.target.value as keyof typeof scripts)}>
        {Object.entries(scripts).map(([key, label]) => <option key={key} value={key}>{label.en} / {label.ru}</option>)}
      </select>
    </label>}
    {showPrompt && <p className={script === "cursive" ? styles.cursive : styles.phrase} lang="ru">
      <StudyWords text={display} language="ru" />
    </p>}
    {recognition && <>
      <p><Pair text={{ en: "Choose the meaning.", ru: "Выберите значение." }} /></p>
      <div className={styles.actions}>
        {orderedChoices.map(item => <button type="button" className={styles.control} key={item.id}
          disabled={result !== undefined || (mode === "meaning" && !heard)}
          onClick={() => assess(item.id === form.id)}>{item.en}</button>)}
      </div>
    </>}
    {mode === "dictate" && <form className={styles.actions} onSubmit={event => {
      event.preventDefault();
      if (heard && answer.trim()) assess(spellingDifference(answer, form.ru).correct);
    }}>
      <label className={styles.field}><Pair text={{ en: "Type what you hear", ru: "Напишите, что слышите" }} />
        <input lang="ru" value={answer} disabled={result !== undefined} onChange={event => setAnswer(event.target.value)} maxLength={100} autoComplete="off" spellCheck={false} />
      </label>
      <button type="submit" className={styles.control} disabled={!heard || !answer.trim() || result !== undefined}>
        Check spelling <span lang="ru">Проверить написание</span>
      </button>
    </form>}
    {recording && <Recording stopModel={speech.stop} />}
    {(mode === "repeat" || recording) && <>
      {recording && !guidedRecall && <p><Pair text={{ en: "Listen to both recordings and rate your own recall.", ru: "Прослушайте обе записи и оцените, удалось ли вспомнить фразу." }} /></p>}
      <div className={styles.actions}>
        <button type="button" className={styles.control} disabled={(!heard && !guidedRecall) || result !== undefined || (guidedRecall && revealed)} onClick={() => assess(true)}>
          {recording ? <Pair text={{ en: "I recalled it", ru: "Я вспомнил(а)" }} /> : <Pair text={{ en: "I heard and repeated it", ru: "Я услышал(а) и повторил(а)" }} />}
        </button>
        <button type="button" className={styles.control} disabled={(!heard && !guidedRecall) || result !== undefined} onClick={() => assess(false)}>
          Review again <span lang="ru">Повторить ещё</span>
        </button>
      </div>
    </>}
    {result !== undefined && <div role="status" className={styles.feedback} data-result={result ? "correct" : "incorrect"}>
      <Pair text={result ? { en: "Recalled", ru: "Вспомнили" } : { en: "Review this again", ru: "Повторите ещё раз" }} />
      {mode === "dictate" && !result && <p>
        <Pair text={{ en: "Typed → expected", ru: "Введено → должно быть" }} />
        {" "}<span lang="ru">{spellingDifference(answer, form.ru).typed || "∅"} → {spellingDifference(answer, form.ru).expected || "∅"}</span>
      </p>}
    </div>}
    {(guidedStage === undefined || guidedRecall) && !showAnswer && !recognition && mode !== "dictate" && <button type="button" className={styles.control} onClick={() => { setRevealed(true); if (guidedRecall) onRevealWithoutAssessment(); }}>
      {guidedRecall ? <Pair text={{ en: "Reveal without assessment", ru: "Показать без оценки" }} /> : <Pair text={{ en: "Reveal text", ru: "Показать текст" }} />}
    </button>}
    {showAnswer && <section className={styles.rule}>
      <p className={styles.phrase}><StudyWords text={form.stressed} language="ru" /></p>
      <p><span aria-label="International Phonetic Alphabet">{form.ipa && "[" + form.ipa + "]"}</span> · <StudyWords text={form.en} language="en" /></p>
      <p><Pair text={soundNotes[form.group.sound]} /></p>
      <p><StudyWords text={form.group.example.ru} language="ru" /></p>
      <p><StudyWords text={form.group.example.en} language="en" /></p>
      <details className={styles.knowledge}>
        <summary>Knowledge connections <span lang="ru">Связи знаний</span></summary>
        <div className={styles.knowledgeRoot}><strong lang="ru">{form.stressed}</strong><small>{form.en}</small></div>
        <ul className={styles.knowledgeLinks}>
          {knowledgeLinks(form.id).map(link => {
            const target = calendarForms.find(item => item.id === link.id);
            if (!target) return null;
            return <li key={link.id} data-relation={link.relation}><button type="button" className={styles.control} onClick={() => onSelect(target.id)}>
              <span lang="ru">{target.stressed}</span><small><Pair text={relationLabels[link.relation]} /></small>
            </button></li>;
          })}
        </ul>
      </details>
    </section>}
  </>;
}

const dailyKey = "calendar:days:v1:";
const modeKey = "calendar:form:v1";
const repeatKey = "calendar:settings:v1";
const priorityKey = "calendar:priority:v1";

function readSettings(raw: string | null): AudioSettings | undefined {
  if (!raw) return;
  const value = JSON.parse(raw) as AudioSettings;
  if (value && [0.5, 0.75, 1].includes(value.rate) && [1, 3, 5, "continuous"].includes(value.repeats) &&
    [2, 3, 4, 5].includes(value.pause)) return value;
}

export default function AudioStudy({ storagePrefix, speech, display, openAudio, sessionEpoch }: {
  storagePrefix: string; speech: ReturnType<typeof useRussianAudio>; display: "audio" | "daily" | "progress" | "learn" | "practice"; openAudio: () => void; sessionEpoch: number;
}) {
  const [entries, setEntries] = useState<Memory>({});
  const latest = useRef(entries);
  const [saveFailed, setSaveFailed] = useState(false);
  const [mode, setMode] = useState<Mode>("listen");
  const [candidateId, setCandidateId] = useState<string>(chatterboxCandidateAssets[0].id);
  const [candidateCache, setCandidateCache] = useState<"idle" | "saving" | "ready" | "error">("idle");
  const [hidden, setHidden] = useState(true);
  const [priority, setPriority] = useState<LearningPriority>("immersion");
  const [settings, setSettings] = useState<AudioSettings>({ rate: 0.75, repeats: 1, pause: 2 });
  const [id, setId] = useState("today-1");
  const [review, setReview] = useState<{ id: string; skill: ReviewSkill }>();
  const [labId, setLabId] = useState<string>();
  const [round, setRound] = useState(0);
  const [guide, setGuide] = useState<{ stage: number; epoch: number }>();
  const [guideRecallDone, setGuideRecallDone] = useState(false);
  const playButton = useRef<HTMLButtonElement>(null);
  const [heardEpoch, setHeardEpoch] = useState<number | null>(null);
  const heard = heardEpoch === sessionEpoch;
  const [days, setDays] = useState<number[]>([]);
  const [day, setDay] = useState(0);
  const [dailySession, setDailySession] = useState<number>();
  const [dialogueShown, setDialogueShown] = useState(false);
  const [now, setNow] = useState(0);
  const statusId = useId();

  useEffect(() => {
    function restore() {
      try {
        const storage = window.localStorage;
        latest.current = readMemory(storage, storagePrefix);
        setEntries(latest.current);
        const completed = dailyLessons.flatMap((_, index) => storage.getItem(storagePrefix + dailyKey + index) === "1" ? [index] : []);
        setDays(completed);
        return completed;
      } catch {
        setSaveFailed(true);
        return [];
      }
    }
    const completed = restore();
    const next = dailyLessons.findIndex((_, index) => !completed.includes(index));
    setDay(next === -1 ? dailyLessons.length - 1 : next);
    setNow(Date.now());
    try {
      const saved = localStorage.getItem(storagePrefix + modeKey);
      if (calendarForms.some(form => form.id === saved)) setId(saved!);
      const oldSettings = readSettings(localStorage.getItem(storagePrefix + repeatKey));
      if (oldSettings) setSettings(oldSettings);
      const savedPriority = localStorage.getItem(storagePrefix + priorityKey);
      if (savedPriority === "immersion" || savedPriority === "context") setPriority(savedPriority);
    } catch {
      // Invalid preferences do not affect saved recall.
    }
    const sync = (event: StorageEvent) => {
      if (event.key?.startsWith(storagePrefix + "memory:") || event.key?.startsWith(storagePrefix + dailyKey)) restore();
    };
    const tick = window.setInterval(() => setNow(Date.now()), 60000);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.clearInterval(tick);
    };
  }, [storagePrefix]);

  const form = calendarForms.find(item => item.id === (mode === "review" ? review?.id : id)) ?? calendarForms[0];
  const group = form.group;
  const selectedMode = mode === "review" ? review && reviewModes[review.skill] : mode;
  const labMode = selectedMode === "sound" || selectedMode === "context";
  const exerciseMode: ExerciseMode | undefined = selectedMode === "sound" || selectedMode === "context" ? undefined : selectedMode;
  const activeLab = labMode ? adaptiveTask(mode === "review" ? review?.id : labId) : undefined;
  const category = categories[group.category];
  const categoryGroups = calendarGroups.filter(item => item.category === group.category);
  const selectedDay = dailyLessons[day];
  const recommendation = useMemo(() => adaptiveRecommendation(entries, now, priority), [entries, now, priority]);
  const due = recommendation.kind === "review";
  const canPlayExample = exerciseMode === "listen" || exerciseMode === "repeat" || exerciseMode === "shadow";
  const hideForAssessment = exerciseMode === "meaning" || exerciseMode === "dictate" || mode === "review";
  const guidedStage = guide?.epoch === sessionEpoch && mode !== "review" && !labMode ? guide.stage : undefined;
  const effectiveHidden = hidden || hideForAssessment || guidedStage !== undefined;
  const sceneMode = mode === "listen" || mode === "repeat" || mode === "shadow";
  const dailyGroups: readonly string[] = dailySession === undefined ? [] : dailyLessons[dailySession].groups;

  function savePreference(key: string, value: string) {
    try { localStorage.setItem(storagePrefix + key, value); } catch { setSaveFailed(true); }
  }

  function resetExercise() {
    speech.stop();
    setHeardEpoch(null);
    setGuide(undefined);
    setGuideRecallDone(false);
    setRound(value => value + 1);
  }

  function startGuide(stage: number) {
    resetExercise();
    setMode(stage === 2 ? "repeat" : stage === 3 ? "speak" : "listen");
    setGuide({ stage, epoch: sessionEpoch });
  }

  function select(id: string) {
    if (!calendarForms.some(item => item.id === id)) return;
    resetExercise();
    setId(id);
    savePreference(modeKey, id);
  }

  function continuePath() {
    const next = adaptiveRecommendation(latest.current, now, priority);
    if (next.kind === "review") {
      setMode("review");
      setReview({ id: next.id, skill: next.skill });
      resetExercise();
    } else if (next.kind === "context") {
      setMode("context");
      setLabId(next.id);
      resetExercise();
    } else startGuide(0);
  }

  function selectReview(time: number, skipCurrent = false) {
    setNow(time);
    setReview(nextReview(latest.current, time, review && review.id + ":" + review.skill, skipCurrent));
    resetExercise();
  }

  function persistMemory(transform: (base: Memory, storage?: Storage) => Memory) {
    let next: Memory;
    try {
      const base = { ...latest.current, ...readMemory(localStorage, storagePrefix) };
      next = transform(base, localStorage);
      if (next === base) return false;
    } catch {
      next = transform(latest.current);
      if (next === latest.current) return false;
      setSaveFailed(true);
    }
    latest.current = next;
    setEntries(next);
    return true;
  }

  function update(skill: Skill, result: boolean, time: number) {
    setNow(time);
    persistMemory((base, storage) => setMemory(base, form.id, skill, result, time, storage, storagePrefix));
    if (guidedStage === 3 && skill === "speaking") setGuideRecallDone(true);
  }

  function selectLab(skill: AdaptiveSkill, time: number, exclude?: string) {
    setNow(time);
    setLabId(nextAdaptiveTask(latest.current, time, skill, exclude)?.id);
    resetExercise();
  }

  function updateLab(choice: number, time: number, source?: AudioSource) {
    if (!activeLab) return false;
    setNow(time);
    return persistMemory((base, storage) => recordAdaptiveAnswer(base, activeLab.id, choice, time, source, storage, storagePrefix));
  }

  function updateSelfRecall(recalled: boolean) {
    return !!activeLab && persistMemory((base, storage) => recordAdaptiveSelfRecall(base, activeLab.id, recalled, storage, storagePrefix));
  }

  function advanceLab(time: number, correct: boolean) {
    if (!activeLab) return;
    if (mode === "review") { selectReview(time, true); return; }
    const continuation = correct && adaptiveTasks.find(task => task.requires === activeLab.id && adaptiveEligible(task, latest.current));
    if (continuation) {
      setLabId(continuation.id);
      resetExercise();
    } else selectLab(activeLab.skill, time, activeLab.id);
  }

  const saveNotice = saveFailed && <p role="status"><Pair text={{
    en: "Some progress could only be kept for this visit.", ru: "Часть прогресса доступна только в этом сеансе.",
  }} /></p>;

  if (display === "learn" || display === "practice") return null;

  if (display === "progress") return <>
    {saveNotice}
    <h3><Pair text={{ en: "Calendar skills", ru: "Навыки по теме «Время»" }} /></h3>
    <p className={styles.saveNote}><Pair text={{ en: "Counts show attempted forms, not proficiency. Listening repetition and speaking ratings are self-reported.", ru: "Числа показывают изученные формы, а не уровень владения. Повторение на слух и говорение оцениваются самостоятельно." }} /></p>
    <ul className={styles.progressList}>{(Object.keys(skills) as Skill[]).map(skill => {
      const attempted = calendarForms.filter(item => memoryEntry(entries, item.id, skill));
      const dueCount = attempted.filter(item => memoryEntry(entries, item.id, skill).due <= now).length;
      return <li key={skill}>
        <span><Pair text={skills[skill]} /></span>
        <progress max={calendarForms.length} value={attempted.length} aria-label={skills[skill].en} />
        <span>{attempted.length}/{calendarForms.length} · {dueCount} due <span lang="ru">к повторению</span></span></li>;
    })}</ul>
    <h3>Adaptive evidence <span lang="ru">Результаты адаптивной практики</span></h3>
    <p className={styles.saveNote}>Choice outcomes and self-reports are separate; neither proves pronunciation. Device-voice and candidate-audio previews do not count as assessment results. <span lang="ru">Выбор ответов и самооценка не доказывают правильность произношения. Тренировка с голосом устройства и непроверенным синтезом не считается проверкой.</span></p>
    <ul className={styles.progressList}>{(["sound", "context"] as const).map(skill => {
      const attempted = adaptiveTasks.filter(task => {
        const evidence = memoryEntry(entries, task.id, skill)?.evidence;
        return task.skill === skill && evidence && evidence.audioSource !== "device";
      });
      return <li key={skill}><span><Pair text={modes[skill]} /></span><progress max={adaptiveTasks.filter(task => task.skill === skill).length} value={attempted.length} aria-label={modes[skill].en} /><span>{attempted.length} attempted</span></li>;
    })}</ul>
    <details className={styles.knowledge}><summary>Personal errors <span lang="ru">Личные ошибки</span></summary>
      <ul className={styles.progressList}>{adaptiveTasks.filter(task => (memoryEntry(entries, task.id, task.skill)?.evidence?.wrongAttempts ?? 0) > 0 && memoryEntry(entries, task.id, task.skill)?.evidence?.audioSource !== "device").map(task => {
        const evidence = memoryEntry(entries, task.id, task.skill)!.evidence!;
        return <li key={task.id}><div><Pair text={task.title} /><small>{evidence.correct ? "Corrected / Исправлено" : "Review needed / Нужно повторить"}</small>
          {evidence.lastWrongChoice !== undefined && <details className={styles.knowledge}><summary>Error detail <span lang="ru">Ошибка</span></summary>
            <p>Previous choice <span lang="ru">Предыдущий выбор</span>: <StudyWords text={task.options[evidence.lastWrongChoice].ru} language="ru" /></p>
            <p>Model <span lang="ru">Образец</span>: <StudyWords text={task.options[task.correct].ru} language="ru" /></p>
            <p><Pair text={task.rule} /></p>
          </details>}</div>
          <span>{evidence.wrongAttempts} <span lang="ru">ошибок</span></span>
          <button type="button" className={styles.control} disabled={!adaptiveEligible(task, entries)} onClick={() => { setMode(task.skill); setLabId(task.id); resetExercise(); openAudio(); }}>Practice <span lang="ru">Повторить</span></button></li>;
      })}</ul>
    </details>
    <p>Review intervals <span lang="ru">Интервалы повторения</span> · 0 / 1 / 3 / 7 / 14 / 30 <span lang="ru">дней</span> (days)</p>
  </>;

  if (display === "daily") return <>
    {saveNotice}
    <label className={styles.field}><Pair text={{ en: "Day", ru: "День" }} />
      <select value={day} onChange={event => {
        speech.stop();
        setDay(Number(event.target.value));
        setDialogueShown(false);
      }}>
        {dailyLessons.map((_, index) => <option key={index} value={index}>{index + 1} / 14{days.includes(index) ? " ✓" : ""}</option>)}
      </select>
    </label>
    <p>20–30 minutes <span lang="ru">20–30 минут</span></p>
    <ol className={styles.dailySteps}>
      <li>5 min · Listen to the dialogue. <span lang="ru">5 мин · Прослушайте диалог.</span></li>
      <li>5–10 min · Repeat the assigned words. <span lang="ru">5–10 мин · Повторяйте слова из задания.</span></li>
      <li>5 min · Read aloud or record yourself. <span lang="ru">5 мин · Читайте вслух или запишите себя.</span></li>
      <li>5–10 min · Dictate and review due words. <span lang="ru">5–10 мин · Выполните диктант и повторите слова.</span></li>
    </ol>
    <div className={styles.actions}>
      <button type="button" className={styles.primary} onClick={() => speech.play(statusId, [{ id: "daily-" + day, ru: selectedDay.ru }], settings)}>
        Play dialogue <span lang="ru">Слушать диалог</span>
      </button>
      <button type="button" className={styles.control} onClick={speech.stop}>Stop audio <span lang="ru">Остановить звук</span></button>
      <button type="button" className={styles.control} aria-expanded={dialogueShown} onClick={() => setDialogueShown(value => !value)}>
        Dialogue text <span lang="ru">Текст диалога</span>
      </button>
    </div>
    <PronunciationStatus audio={speech.audio} id={statusId} />
    {dialogueShown && <div className={styles.rule}><p><StudyWords text={selectedDay.ru} language="ru" /></p>
      <p><StudyWords text={selectedDay.en} language="en" /></p></div>}
    <p>{due ? <Pair text={{ en: "Start with due reviews before learning new words.", ru: "Перед новыми словами повторите слова на сегодня." }} /> :
      <Pair text={{ en: "Practice today’s words and use them in your own answer.", ru: "Потренируйте слова дня и используйте их в своём ответе." }} />}</p>
    <div className={styles.actions}>
      <button type="button" className={styles.primary} onClick={() => {
        const first = calendarGroups.find(item => selectedDay.groups.some(key => item.id === key));
        if (!first) return;
        setDailySession(day);
        if (due) {
          setMode("review");
          selectReview(now);
        } else {
          setMode("listen");
          select(first.forms[0].id);
        }
        openAudio();
      }}>Practice this day <span lang="ru">К заданию дня</span></button>
      <button type="button" className={styles.control} disabled={days.includes(day)} onClick={() => {
        savePreference(dailyKey + day, "1");
        setDays(previous => [...previous, day]);
        if (day < dailyLessons.length - 1) {
          speech.stop();
          setDialogueShown(false);
          setDay(day + 1);
        }
      }}>Mark day complete <span lang="ru">Отметить день завершённым</span></button>
    </div>
  </>;

  const topicTimeline = <ol className={styles.timeline} aria-label={category.en}>
        {categoryGroups.map((item, index) => <li key={item.id}><button type="button" aria-pressed={item.id === group.id}
          className={styles.control} onClick={() => {
            select(item.forms[0].id);
            if (guidedStage !== undefined) startGuide(0);
          }}
          aria-label={guidedStage === 0 ? item.forms[0].en : effectiveHidden ? category.en + " " + (index + 1) : item.forms[0].en}>
          <span aria-hidden="true">{item.cue}</span>{guidedStage === 0 ? <span>{item.forms[0].en}</span> : !effectiveHidden && <StudyWords text={item.forms[0].ru} language="ru" />}
        </button></li>)}
      </ol>;
  const playbackSettings = <details className={styles.audioSettings}>
      <summary>Playback settings <span lang="ru">Настройки звука</span></summary>
      <AudioControls settings={settings} change={value => {
        speech.stop();
        setSettings(value);
        savePreference(repeatKey, JSON.stringify(value));
      }} />
    </details>;

  const player = exerciseMode && <div className={styles.studioLayout} data-context-library={guidedStage === 0 ? "true" : undefined}><section className={styles.player} aria-label="Audio player / Аудиоплеер">
      <p className={styles.playerMode}><Pair text={guidedStage === undefined ? modes[exerciseMode] : immersionSteps[guidedStage]} /></p>
      {guidedStage === 0 && <div className={styles.guideCue}><span aria-hidden="true">{group.cue}</span><div><strong>{form.en}</strong><p><StudyWords text={group.example.en} language="en"/></p></div></div>}
      {sceneMode && guidedStage === undefined && <div className={styles.scene} aria-label="Context cue">
        <div className={styles.sceneHeader}><Pair text={category} /><span>{categoryGroups.findIndex(item => item.id === group.id) + 1} / {categoryGroups.length}</span></div>
        {topicTimeline}
      </div>}
      <p className={styles.playerHint}><Pair text={exerciseMode === "dictate" ? { en: "Listen, then type what you hear.", ru: "Прослушайте, затем напишите услышанное." } :
        exerciseMode === "meaning" ? { en: "Listen, then choose the meaning.", ru: "Прослушайте, затем выберите значение." } :
        exerciseMode === "speak" ? { en: "Say the phrase before listening to the model.", ru: "Произнесите фразу до прослушивания образца." } :
        exerciseMode === "read" ? { en: "Read the phrase, then compare with the audio.", ru: "Прочитайте фразу и сравните со звуком." } :
        guidedStage === 0 ? { en: "Connect the scene to meaning.", ru: "Свяжите ситуацию со значением." } : guidedStage === 1 ? { en: "Listen without reading.", ru: "Слушайте без текста." } : guidedStage === 2 ? { en: "Repeat aloud after the model.", ru: "Повторяйте вслух за образцом." } : { en: "Listen first. Reveal the text when you need it.", ru: "Сначала слушайте. Откройте текст при необходимости." }} /></p>
      <div className={styles.actions}>
        <button ref={playButton} type="button" className={styles.primary} disabled={guidedStage === 0 || (guidedStage === 3 && !guideRecallDone)} onClick={() => {
          setHeardEpoch(null);
          speech.play(form.id, [form], settings, () => setHeardEpoch(sessionEpoch));
        }}>
          Play word or phrase <span lang="ru">Слушать слово или фразу</span>
        </button>
        <button type="button" className={styles.control} onClick={speech.stop}>Stop audio <span lang="ru">Остановить звук</span></button>
        {canPlayExample && guidedStage === undefined && <button type="button" className={styles.control} onClick={() => speech.play(form.group.example.id, [form.group.example], settings)}>
          Play example <span lang="ru">Слушать пример</span>
        </button>}
      </div>
      <PronunciationStatus audio={speech.audio} id={form.id} />
      <PronunciationStatus audio={speech.audio} id={form.group.example.id} />
      <p className={styles.playerHint}>{settings.rate}× · {settings.repeats === "continuous" ? "∞" : settings.repeats} · {settings.pause}s <span lang="ru">пауза</span></p>
      {playbackSettings}
    </section>
    {guidedStage === 0 && <section className={styles.contextLibrary} aria-label="Context library / Библиотека контекстов">
      <h3>Context library <span lang="ru">Библиотека контекстов</span></h3>
      <p><Pair text={category} /></p>
      {topicTimeline}
      <p className={styles.saveNote}>Choose a scene to start observing it. <span lang="ru">Выберите ситуацию для наблюдения.</span></p>
    </section>}
    </div>;
  const exercise = exerciseMode && <Exercise key={form.id + mode + round + ":" + sessionEpoch} form={form}
      mode={exerciseMode} speech={speech} hidden={effectiveHidden} heard={heard} choiceSeed={round + sessionEpoch} guidedStage={guidedStage}
      onResult={update} onRevealWithoutAssessment={() => setGuideRecallDone(true)} onSelect={next => {
        if (mode === "review") setMode("listen");
        select(next);
        playButton.current?.focus();
      }} />;

  return <section className={styles.audioStudy} aria-label="Audio practice / Звуковая практика">
    {saveNotice}
    {exerciseMode && mode !== "review" && guidedStage === undefined && <section className={styles.nextTask} aria-label="Adaptive Path / Маршрут обучения">
      <div className={styles.pathCopy}>
        <small>Adaptive Path <span lang="ru">Маршрут обучения</span></small>
        <strong><Pair text={recommendation.kind === "review" ? { en: "Review is due", ru: "Пора повторить" } : recommendation.kind === "context" ? { en: "Conversation practice", ru: "Практика диалога" } : { en: "Learn through context", ru: "Учитесь в контексте" }} /></strong>
        <p><Pair text={recommendation.kind === "review" ? { en: "An existing review is due. No new assessment is needed to continue.", ru: "Наступил срок повторения. Дополнительная оценка не требуется." } : recommendation.kind === "context" ? { en: "Continue with an eligible contextual task.", ru: "Продолжите доступное задание в контексте." } : { en: "Observe, listen, imitate, recall.", ru: "Наблюдайте, слушайте, повторяйте, вспоминайте." }} /></p>
        <details className={styles.pathPreference}><summary>Learning priority <span lang="ru">Приоритет обучения</span></summary>
          <label className={styles.field}><Pair text={{ en: "Prefer when no review is due", ru: "Если нет повторений" }} />
            <select value={priority} onChange={event => {
              const next = event.target.value as LearningPriority;
              setPriority(next);
              savePreference(priorityKey, next);
            }}>
              <option value="immersion">Listen and speak / Слушать и говорить</option>
              <option value="context">Context and dialogue / Контекст и диалог</option>
            </select>
          </label>
        </details>
      </div>
      {recommendation.kind !== "immersion" && <button type="button" className={styles.primary} onClick={continuePath}>
        {recommendation.kind === "review" ? <Pair text={{ en: "Start review", ru: "Начать повторение" }} /> : <Pair text={{ en: "Continue", ru: "Продолжить" }} />}
      </button>}
    </section>}
    {exerciseMode && mode !== "review" && <section className={styles.guided} data-active={guidedStage !== undefined ? "true" : undefined} aria-label="Natural Immersion / Естественное погружение">
      {guidedStage === undefined ? <button type="button" className={recommendation.kind === "immersion" ? styles.primary : styles.control} onClick={() => startGuide(0)}>Start Natural Immersion <span lang="ru">Естественное погружение</span></button> : <>
        <div className={styles.guideHeader}><strong>Natural Immersion <span lang="ru">Естественное погружение</span></strong><button type="button" className={styles.control} onClick={resetExercise}>Exit guided practice <span lang="ru">Выйти</span></button></div>
        <ol className={styles.guideSteps}>{immersionSteps.map((step,index) => <li key={step.en} aria-current={guidedStage === index ? "step" : undefined}><small>{index + 1}</small><Pair text={step}/></li>)}</ol>
        {player}
        {exercise}
        <div className={styles.guideFooter}>
        {guidedStage < 3 && <button type="button" className={styles.primary} disabled={guidedStage > 0 && !heard} onClick={() => startGuide(guidedStage + 1)}>Next stage <span lang="ru">Следующий этап</span></button>}
        {guidedStage === 3 && guideRecallDone && <button type="button" className={styles.primary} onClick={() => { const next = categoryGroups[(categoryGroups.findIndex(item => item.id === group.id) + 1) % categoryGroups.length]; select(next.forms[0].id); startGuide(0); }}>Next word <span lang="ru">Следующее слово</span></button>}
        </div>
      </>}
    </section>}
    {guidedStage === undefined && player}
    {mode === "listen" && guidedStage === undefined && <details className={`${styles.rule} ${styles.audioSettings}`} data-chatterbox-preview>
      <summary>Chatterbox V3 · Voice preview <span lang="ru">Пробный голос</span></summary>
      <p className={styles.saveNote}>11 synthetic samples for listening only. Not yet linguistically verified; no assessment credit. <span lang="ru">11 пробных записей синтеза. Без языковой проверки и оценок.</span></p>
      <label className={styles.field}>Voice sample <span lang="ru">Фраза</span>
        <select value={candidateId} onChange={event => { speech.stop(); setCandidateId(event.target.value); }}>
          {chatterboxCandidateAssets.map(asset => <option lang="ru" value={asset.id} key={asset.id}>{asset.ru}</option>)}
        </select>
      </label>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={() => {
          const asset = chatterboxCandidateAssets.find(item => item.id === candidateId);
          if (asset) speech.play("chatterbox-voice-preview", [resolveAudioClip(asset.ru, asset.id)], settings);
        }}>Play voice sample <span lang="ru">Слушать образец</span></button>
        <button type="button" className={styles.control} onClick={speech.stop}>Stop sample <span lang="ru">Стоп</span></button>
        <button type="button" className={styles.control} disabled={candidateCache === "saving"} onClick={() => {
          setCandidateCache("saving");
          void saveChatterboxOffline().then(() => setCandidateCache("ready"), () => setCandidateCache("error"));
        }}>Keep samples offline <span lang="ru">Сохранить звук офлайн</span></button>
      </div>
      <PronunciationStatus audio={speech.audio} id="chatterbox-voice-preview" />
      <p className={styles.saveNote}>Uses the current speed and repeat options. Offline audio works while this page is open; keep the page open. <span lang="ru">Действуют настройки плеера. Для офлайн-звука оставьте страницу открытой.</span></p>
      <p role="status" className={styles.saveNote}>{candidateCache === "saving" ? "Saving samples / Сохранение" : candidateCache === "ready" ? "11/11 samples saved offline / 11/11 сохранено" : candidateCache === "error" ? "Offline storage failed. Retry online. / Ошибка сохранения. Повторите в сети." : ""}</p>
    </details>}
    {dailySession !== undefined && !labMode && <div className={styles.rule}>
      <p>Day {dailySession + 1} <span lang="ru">День {dailySession + 1}</span></p>
      <div className={styles.actions}>
        {calendarGroups.filter(item => dailyGroups.includes(item.id)).map(item =>
          <button type="button" key={item.id} className={styles.control} aria-pressed={group.id === item.id && mode !== "review"} onClick={() => {
            if (mode === "review") setMode("listen");
            select(item.forms[0].id);
          }}>{item.forms[0].en}</button>)}
        <button type="button" className={styles.control} onClick={() => setDailySession(undefined)}>All topics <span lang="ru">Все темы</span></button>
      </div>
    </div>}
    <div className={styles.audioControls}>
      <label><Pair text={{ en: "Training mode", ru: "Режим тренировки" }} />
        <select value={mode} onChange={event => {
          const next = event.target.value as Mode;
          setMode(next);
          if (next === "review") selectReview(now);
          else if (next === "sound" || next === "context") selectLab(next, now);
          else resetExercise();
        }}>
          {Object.entries(modes).map(([key, label]) => <option key={key} value={key}>{label.en} / {label.ru}</option>)}
        </select>
      </label>
      {mode !== "review" && !labMode && <label><Pair text={{ en: "Topic", ru: "Тема" }} />
        <select value={group.category} onChange={event => {
          const next = calendarGroups.find(item => item.category === event.target.value);
          if (next) select(next.forms[0].id);
        }}>
          {Object.entries(categories).map(([key, label]) => <option key={key} value={key}>{label.en} / {label.ru}</option>)}
        </select>
      </label>}
    </div>
    {mode !== "review" && !labMode && <>
      <label className={styles.check}><input type="checkbox" checked={effectiveHidden} disabled={hideForAssessment || guidedStage !== undefined} onChange={event => setHidden(event.target.checked)} />
        <Pair text={{ en: "Hide words while listening", ru: "Скрывать слова при прослушивании" }} />
      </label>
      {!sceneMode && guidedStage === undefined && topicTimeline}
      <div className={styles.actions}>
        <button type="button" className={styles.control} disabled={guidedStage !== undefined} onClick={() => speech.play("topic", calendarForms.filter(item => item.group.category === group.category), settings)}>
          Play topic <span lang="ru">Слушать тему</span>
        </button>
        {group.forms.length > 1 && <label className={styles.field}><Pair text={{ en: "Form", ru: "Форма" }} />
          <select value={form.id} onChange={event => select(event.target.value)}>
            {group.forms.map((item, index) => <option key={item.id} value={item.id}>{effectiveHidden ? (index + 1) + " / " + group.forms.length : item.ru}</option>)}
          </select>
        </label>}
      </div>
      <PronunciationStatus audio={speech.audio} id="topic" />
    </>}
    {mode === "review" && !review && <p role="status"><Pair text={due ?
      { en: "A review remains due. Select Smart Review again later or choose another mode.", ru: "Есть отложенное повторение. Вернитесь к умному повторению позже или выберите другой режим." } :
      { en: "Nothing is due. Practice a topic to add words to review.", ru: "Повторений пока нет. Потренируйте слова, чтобы добавить их на повторение." }} /></p>}
    {labMode && activeLab && <Suspense fallback={<p role="status">Loading practice <span lang="ru">Загрузка упражнения</span></p>}><AdaptivePractice key={activeLab.id + ":" + round + ":" + sessionEpoch}
      task={activeLab} speech={speech} settings={settings} seed={round + sessionEpoch}
      onAnswer={updateLab} onSelfRecall={updateSelfRecall} onAdvance={advanceLab} onRetry={resetExercise} /></Suspense>}
    {labMode && !activeLab && <p role="status">No other eligible task. Choose another mode. <span lang="ru">Других доступных заданий нет. Выберите другой режим.</span></p>}
    {guidedStage === undefined && exercise}
    {!exerciseMode && playbackSettings}
    {mode === "review" && review && !labMode && <button type="button" className={styles.control} onClick={() => selectReview(now)}>
      Next review <span lang="ru">Следующее повторение</span>
    </button>}
  </section>;
}
