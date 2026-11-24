"use client";

import { useEffect, useId, useRef, useState } from "react";
import { calendarForms, calendarGroups, categories, soundNotes } from "./calendar-content";
import type { Bilingual } from "./content";
import { dailyLessons } from "./daily";
import { memoryEntry, nextReview, readMemory, setMemory, skills, spellingDifference, type MemoryEntry, type Skill } from "./memory";
import { PronunciationStatus, type AudioSettings, type useRussianAudio } from "./pronunciation";
import { Recording } from "./recording";
import { StudyWords } from "./translation";
import styles from "./trainer.module.css";

const modes = {
  listen: { en: "Listening Only", ru: "Только слушать" },
  repeat: { en: "Listen & Repeat", ru: "Слушай и повторяй" },
  shadow: { en: "Shadowing & Recording", ru: "Повтор с записью" },
  meaning: { en: "Meaning Recognition", ru: "Узнавание смысла" },
  read: { en: "Reading", ru: "Чтение" },
  speak: { en: "Speaking", ru: "Говорение" },
  dictate: { en: "Dictation", ru: "Диктант" },
  review: { en: "Smart Review", ru: "Умное повторение" },
} satisfies Record<string, Bilingual>;

type Mode = keyof typeof modes;
type ExerciseMode = Exclude<Mode, "review">;
type Memory = Record<string, MemoryEntry>;
const reviewModes: Record<Skill, ExerciseMode> = {
  listening: "repeat", understanding: "meaning", speaking: "speak", reading: "read", spelling: "dictate",
};
const assessedSkills: Partial<Record<ExerciseMode, Skill>> = {
  repeat: "listening", meaning: "understanding", shadow: "speaking", speak: "speaking", read: "reading", dictate: "spelling",
};
const scripts = {
  upper: { en: "Uppercase", ru: "Заглавные" },
  lower: { en: "Lowercase", ru: "Строчные" },
  cursive: { en: "Cursive", ru: "Рукописный текст" },
} satisfies Record<string, Bilingual>;

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

function Exercise({ form, mode, speech, hidden, heard, onResult }: {
  form: typeof calendarForms[number]; mode: ExerciseMode; speech: ReturnType<typeof useRussianAudio>;
  hidden: boolean; heard: boolean; onResult: (skill: Skill, result: boolean, time: number) => void;
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
  const showAnswer = revealed || result !== undefined;
  const display = script === "upper" ? form.ru.toUpperCase() : script === "lower" ? form.ru.toLowerCase() : form.ru;
  const choices = [form, ...calendarForms.filter(item => item.group.category === form.group.category &&
    item.id !== form.id && item.en !== form.en && item.id.endsWith(form.id.slice(form.id.lastIndexOf("-")))).slice(0, 2)];
  const orderedChoices = choices.sort((a, b) => a.en.localeCompare(b.en));

  function assess(correct: boolean) {
    const skill = assessedSkills[mode];
    if (!skill || result !== undefined) return;
    setResult(correct);
    onResult(skill, correct, Date.now());
  }

  return <>
    {mode === "speak" && <p className={styles.phrase}><StudyWords text={form.en} language="en" /></p>}
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
      {recording && <p><Pair text={{ en: "Listen to both recordings and rate your own recall.", ru: "Прослушайте обе записи и оцените, удалось ли вспомнить фразу." }} /></p>}
      <div className={styles.actions}>
        <button type="button" className={styles.control} disabled={!heard || result !== undefined} onClick={() => assess(true)}>
          {recording ? <Pair text={{ en: "I recalled it", ru: "Я вспомнил(а)" }} /> : <Pair text={{ en: "I heard and repeated it", ru: "Я услышал(а) и повторил(а)" }} />}
        </button>
        <button type="button" className={styles.control} disabled={!heard || result !== undefined} onClick={() => assess(false)}>
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
    {!showAnswer && !recognition && mode !== "dictate" && <button type="button" className={styles.control} onClick={() => setRevealed(true)}>
      Reveal text <span lang="ru">Показать текст</span>
    </button>}
    {showAnswer && <section className={styles.rule}>
      <p className={styles.phrase}><StudyWords text={form.stressed} language="ru" /></p>
      <p><span aria-label="International Phonetic Alphabet">{form.ipa && "[" + form.ipa + "]"}</span> · <StudyWords text={form.en} language="en" /></p>
      <p><Pair text={soundNotes[form.group.sound]} /></p>
      <p><StudyWords text={form.group.example.ru} language="ru" /></p>
      <p><StudyWords text={form.group.example.en} language="en" /></p>
    </section>}
  </>;
}

const dailyKey = "calendar:days:v1:";
const modeKey = "calendar:form:v1";
const repeatKey = "calendar:settings:v1";

function readSettings(raw: string | null): AudioSettings | undefined {
  if (!raw) return;
  const value = JSON.parse(raw) as AudioSettings;
  if (value && [0.5, 0.75, 1].includes(value.rate) && [1, 3, 5, "continuous"].includes(value.repeats) &&
    [2, 3, 4, 5].includes(value.pause)) return value;
}

export default function AudioStudy({ storagePrefix, speech, display, openAudio }: {
  storagePrefix: string; speech: ReturnType<typeof useRussianAudio>; display: "audio" | "daily" | "progress" | "learn" | "practice"; openAudio: () => void;
}) {
  const [entries, setEntries] = useState<Memory>({});
  const latest = useRef(entries);
  const [saveFailed, setSaveFailed] = useState(false);
  const [mode, setMode] = useState<Mode>("listen");
  const [hidden, setHidden] = useState(true);
  const [settings, setSettings] = useState<AudioSettings>({ rate: 0.75, repeats: 1, pause: 2 });
  const [id, setId] = useState("today-1");
  const [review, setReview] = useState<{ id: string; skill: Skill }>();
  const [round, setRound] = useState(0);
  const [heard, setHeard] = useState(false);
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
  const exerciseMode = mode === "review" ? review && reviewModes[review.skill] : mode;
  const category = categories[group.category];
  const categoryGroups = calendarGroups.filter(item => item.category === group.category);
  const selectedDay = dailyLessons[day];
  const due = nextReview(entries, now);
  const canPlayExample = exerciseMode === "listen" || exerciseMode === "repeat" || exerciseMode === "shadow";
  const dailyGroups: readonly string[] = dailySession === undefined ? [] : dailyLessons[dailySession].groups;

  function savePreference(key: string, value: string) {
    try { localStorage.setItem(storagePrefix + key, value); } catch { setSaveFailed(true); }
  }

  function resetExercise() {
    speech.stop();
    setHeard(false);
    setRound(value => value + 1);
  }

  function select(id: string) {
    if (!calendarForms.some(item => item.id === id)) return;
    resetExercise();
    setId(id);
    savePreference(modeKey, id);
  }

  function selectReview() {
    const time = Date.now();
    setNow(time);
    setReview(nextReview(latest.current, time, review && review.id + ":" + review.skill));
    resetExercise();
  }

  function update(skill: Skill, result: boolean, time: number) {
    setNow(time);
    try {
      const saved = readMemory(localStorage, storagePrefix);
      latest.current = setMemory({ ...latest.current, ...saved }, form.id, skill, result, time, localStorage, storagePrefix);
    } catch {
      latest.current = setMemory(latest.current, form.id, skill, result, time);
      setSaveFailed(true);
    }
    setEntries(latest.current);
  }

  const saveNotice = saveFailed && <p role="status"><Pair text={{
    en: "Some progress could only be kept for this visit.", ru: "Часть прогресса доступна только в этом сеансе.",
  }} /></p>;

  if (display === "learn" || display === "practice") return null;

  if (display === "progress") return <>
    {saveNotice}
    <h3><Pair text={{ en: "Calendar skills", ru: "Навыки по теме «Время»" }} /></h3>
    <ul className={styles.progressList}>{(Object.keys(skills) as Skill[]).map(skill => {
      const attempted = calendarForms.filter(item => memoryEntry(entries, item.id, skill));
      const dueCount = attempted.filter(item => memoryEntry(entries, item.id, skill).due <= now).length;
      return <li key={skill}>
        <span><Pair text={skills[skill]} /></span>
        <progress max={calendarForms.length} value={attempted.length} aria-label={skills[skill].en} />
        <span>{attempted.length}/{calendarForms.length} · {dueCount} due <span lang="ru">к повторению</span></span></li>;
    })}</ul>
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
          selectReview();
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

  return <section className={styles.audioStudy} aria-label="Audio practice / Звуковая практика">
    {saveNotice}
    {exerciseMode && <>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={() => speech.play(form.id, [form], settings, () => setHeard(true))}>
          Play word or phrase <span lang="ru">Слушать слово или фразу</span>
        </button>
        <button type="button" className={styles.control} onClick={speech.stop}>Stop audio <span lang="ru">Остановить звук</span></button>
        {canPlayExample && <button type="button" className={styles.control} onClick={() => speech.play(form.group.example.id, [form.group.example], settings)}>
          Play example <span lang="ru">Слушать пример</span>
        </button>}
      </div>
      <PronunciationStatus audio={speech.audio} id={form.id} />
      <PronunciationStatus audio={speech.audio} id={form.group.example.id} />

    </>}
    {dailySession !== undefined && <div className={styles.rule}>
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
          if (next === "review") selectReview();
          else resetExercise();
        }}>
          {Object.entries(modes).map(([key, label]) => <option key={key} value={key}>{label.en} / {label.ru}</option>)}
        </select>
      </label>
      {mode !== "review" && <label><Pair text={{ en: "Topic", ru: "Тема" }} />
        <select value={group.category} onChange={event => {
          const next = calendarGroups.find(item => item.category === event.target.value);
          if (next) select(next.forms[0].id);
        }}>
          {Object.entries(categories).map(([key, label]) => <option key={key} value={key}>{label.en} / {label.ru}</option>)}
        </select>
      </label>}
    </div>
    {mode !== "review" && <>
      <label className={styles.check}><input type="checkbox" checked={hidden} onChange={event => setHidden(event.target.checked)} />
        <Pair text={{ en: "Hide words while listening", ru: "Скрывать слова при прослушивании" }} />
      </label>
      <ol className={styles.timeline} aria-label={category.en}>
        {categoryGroups.map((item, index) => <li key={item.id}><button type="button" aria-pressed={item.id === group.id}
          className={styles.control} onClick={() => select(item.forms[0].id)}
          aria-label={hidden ? category.en + " " + (index + 1) : item.forms[0].en}>
          <span aria-hidden="true">{item.cue}</span>{!hidden && <StudyWords text={item.forms[0].ru} language="ru" />}
        </button></li>)}
      </ol>
      <div className={styles.actions}>
        <button type="button" className={styles.control} onClick={() => speech.play("topic", calendarForms.filter(item => item.group.category === group.category), settings)}>
          Play topic <span lang="ru">Слушать тему</span>
        </button>
        {group.forms.length > 1 && <label className={styles.field}><Pair text={{ en: "Form", ru: "Форма" }} />
          <select value={form.id} onChange={event => select(event.target.value)}>
            {group.forms.map((item, index) => <option key={item.id} value={item.id}>{hidden ? (index + 1) + " / " + group.forms.length : item.ru}</option>)}
          </select>
        </label>}
      </div>
      <PronunciationStatus audio={speech.audio} id="topic" />
    </>}
    {mode === "review" && !review && <p role="status"><Pair text={{ en: "Nothing is due. Practice a topic to add words to review.", ru: "Повторений пока нет. Потренируйте слова, чтобы добавить их на повторение." }} /></p>}
    {exerciseMode && <Exercise key={form.id + mode + round} form={form}
      mode={exerciseMode} speech={speech} hidden={hidden} heard={heard} onResult={update} />}
    <details className={styles.audioSettings}>
      <summary>Playback settings <span lang="ru">Настройки звука</span></summary>
      <AudioControls settings={settings} change={value => {
        speech.stop();
        setSettings(value);
        savePreference(repeatKey, JSON.stringify(value));
      }} />
    </details>
    {mode === "review" && review && <button type="button" className={styles.control} onClick={selectReview}>
      Next review <span lang="ru">Следующее повторение</span>
    </button>}
  </section>;
}
