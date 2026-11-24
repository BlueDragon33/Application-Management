"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { scheduleClientInitialization } from "../../client-initialization";
import AudioStudy from "./audio-study";
import { timeLessons, type Bilingual, type TimeLesson } from "./content";
import {
  emptyProgress,
  exerciseCount,
  practiceDirections,
  practiceKey,
  readTrainingProgress,
  recordTrainingAnswer,
  type PracticeDirection,
} from "./progress";
import { PronunciationStatus, useRussianAudio } from "./pronunciation";
import TrainerHelp from "./trainer-help";
import { StudyWords, useContextTranslation } from "./translation";
import styles from "./trainer.module.css";

const views = {
  audio: { en: "Audio practice", ru: "Аудиотренировка" },
  daily: { en: "14-day plan", ru: "План на 14 дней" },
  learn: { en: "Learn", ru: "Уроки" },
  practice: { en: "Practice", ru: "Практика" },
  progress: { en: "Progress", ru: "Прогресс" },
} satisfies Record<string, Bilingual>;
type View = keyof typeof views;
const compactViews: Record<View, Bilingual> = {
  audio: { en: "Studio", ru: "Аудио" }, daily: { en: "Plan", ru: "План" },
  learn: views.learn, practice: views.practice, progress: views.progress,
};

const directionLabels: Record<PracticeDirection, Bilingual> = {
  "en-ru": { en: "English to Russian", ru: "С английского на русский" },
  "ru-en": { en: "Russian to English", ru: "С русского на английский" },
};

function Pair({ text }: { text: Bilingual }) {
  return <>{text.en} <span lang="ru">{text.ru}</span></>;
}

function StudyPair({ text }: { text: Bilingual }) {
  return <>
    <p><StudyWords text={text.en} language="en" /></p>
    <p><StudyWords text={text.ru} language="ru" /></p>
  </>;
}

function Clock({ clock }: { clock: string }) {
  const [hour, minute] = clock.split(":").map(Number);
  return <div className={styles.clock} aria-hidden="true">
    <span className={styles.hourHand} style={{ transform: "rotate(" + (hour * 30 + minute / 2) + "deg)" }} />
    <span className={styles.minuteHand} style={{ transform: "rotate(" + (minute * 6) + "deg)" }} />
    <span className={styles.pin} />
  </div>;
}

function firstExercise(lesson: TimeLesson, direction: PracticeDirection, solved: readonly string[]) {
  const remaining = lesson.examples.findIndex(example => !solved.includes(practiceKey(direction, example.id)));
  return remaining < 0 ? 0 : remaining;
}

export default function RussianTimeTrainer({ storagePrefix }: { storagePrefix: string }) {
  const content = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const focusPending = useRef(false);
  const translation = useContextTranslation(content);
  const speech = useRussianAudio();
  const [view, setView] = useState<View>("audio");
  const [focusMode, setFocusMode] = useState(false);
  const [sessionEpoch, setSessionEpoch] = useState(0);
  const [lessonId, setLessonId] = useState(timeLessons[0].id);
  const [direction, setDirection] = useState<PracticeDirection>("en-ru");
  const [question, setQuestion] = useState(0);
  const [answer, setAnswer] = useState<string | null>(null);
  const [progress, setProgress] = useState(emptyProgress);
  const [saveState, setSaveState] = useState<"loading" | "saved" | "session">("loading");

  useEffect(() => {
    const documentRoot = document.documentElement;
    const originalLanguage = documentRoot.lang;
    documentRoot.lang = "en";
    return () => { documentRoot.lang = originalLanguage; };
  }, []);

  useEffect(() => {
    if (focusPending.current) {
      heading.current?.focus();
      focusPending.current = false;
    }
  }, [view]);

  useEffect(() => {
    const restore = () => {
      try {
        const state = readTrainingProgress(window.localStorage, storagePrefix);
        setProgress(state);
        setSaveState("saved");
        return state;
      } catch {
        setSaveState("session");
        return null;
      }
    };
    const cancelInitialization = scheduleClientInitialization(() => {
      const state = restore();
      if (state?.lessonId) setLessonId(state.lessonId);
    });
    const sync = (event: StorageEvent) => {
      if (event.key?.startsWith(storagePrefix)) restore();
    };
    window.addEventListener("storage", sync);
    return () => {
      cancelInitialization();
      window.removeEventListener("storage", sync);
    };
  }, [storagePrefix]);

  const lesson = timeLessons.find(item => item.id === lessonId) ?? timeLessons[0];
  const example = lesson.examples[question];
  const correct = answer === example.id;
  const sourceLanguage = direction === "en-ru" ? "en" : "ru";
  const answerLanguage = direction === "en-ru" ? "ru" : "en";
  const exampleOffset = (question * 2 + timeLessons.indexOf(lesson) + (direction === "en-ru" ? 1 : 2)) % lesson.examples.length;
  const choices = [...lesson.examples.slice(exampleOffset), ...lesson.examples.slice(0, exampleOffset)];
  const featured = timeLessons[2].examples[1];

  function resetExercise(nextLesson: TimeLesson, nextDirection: PracticeDirection) {
    setAnswer(null);
    setQuestion(firstExercise(nextLesson, nextDirection, progress.solved));
    translation.dismiss();
    speech.stop();
  }

  function moveTo(nextView: View, focusContent = false) {
    if (nextView === view) return;
    focusPending.current = focusContent;
    resetExercise(lesson, direction);
    if (nextView !== "audio") setFocusMode(false);
    setSessionEpoch(value => value + 1);
    setView(nextView);
  }

  function selectLesson(next: TimeLesson) {
    if (next.id !== lesson.id) {
      setLessonId(next.id);
      resetExercise(next, direction);
      try {
        window.localStorage.setItem(storagePrefix + "lesson", next.id);
      } catch {
        setSaveState("session");
      }
    }
    if (view === "progress") {
      setSessionEpoch(value => value + 1);
      setView("learn");
    }
  }

  function answerExercise(choice: string) {
    if (answer !== null) return;
    setAnswer(choice);
    const key = practiceKey(direction, example.id);
    const isCorrect = choice === example.id;
    setProgress(previous => ({
      ...previous,
      attempted: previous.attempted.includes(key) ? previous.attempted : [...previous.attempted, key],
      solved: !isCorrect || previous.solved.includes(key) ? previous.solved : [...previous.solved, key],
    }));
    try {
      recordTrainingAnswer(window.localStorage, storagePrefix, key, isCorrect);
    } catch {
      setSaveState("session");
    }
  }

  function advance(next: number) {
    setQuestion(next);
    setAnswer(null);
    translation.dismiss();
    speech.stop();
    heading.current?.focus();
  }

  return <main lang="en" className={styles.shell} data-focus={focusMode ? "true" : undefined}>
    <header className={styles.topbar}>
      <div className={styles.topbarInner}>
        <Link href="/?view=applications" className={styles.back}>
          <span aria-hidden="true">←</span>
          <span>Application Management <small lang="ru">К инструментам</small></span>
        </Link>
        <div className={styles.actions}>
          {translation.trigger}
          <TrainerHelp lesson={lesson.title.en} view={views[view].en} onOpen={translation.dismiss} />
        </div>
      </div>
    </header>

    <div className={styles.container} ref={content} {...translation.interaction}>
      <section className={view === "learn" ? styles.hero : styles.hero + " " + styles.heroCompact} aria-labelledby="rtt-title">
        <div>
          <h1 id="rtt-title">Russian Time Trainer</h1>
          <p lang="ru" className={styles.heroTitleRu}>Время по-русски</p>
        </div>
        {view === "audio" && <button type="button" className={styles.focusToggle} aria-pressed={focusMode} onClick={() => setFocusMode(value => !value)}>
          <Pair text={focusMode ? { en: "Exit focus", ru: "Выйти из фокуса" } : { en: "Focus mode", ru: "Режим фокуса" }} />
        </button>}
        {view === "learn" && featured.clock && <div className={styles.heroClock}>
          <Clock clock={featured.clock} />
          <div><time dateTime={featured.clock}>{featured.clock}</time><p><StudyWords text={featured.phrase.ru} language="ru" /></p></div>
        </div>}
      </section>

      <nav className={styles.views} aria-label="Trainer sections" hidden={focusMode}>
        {(Object.keys(views) as View[]).map(item => <button key={item} type="button" className={styles.tab}
          aria-label={views[item].en + " " + views[item].ru} aria-pressed={view === item} onClick={() => moveTo(item)}>
          <span className={styles.tabFull}><Pair text={views[item]} /></span>
          <span className={styles.tabShort}><Pair text={compactViews[item]} /></span>
        </button>)}
      </nav>

      <div className={view === "audio" || view === "daily" ? styles.singleWorkspace : styles.workspace}>
        {view !== "audio" && view !== "daily" && <aside className={styles.sidebar} aria-label="Lessons">
          <h2><Pair text={{ en: "Lessons", ru: "Уроки" }} /></h2>
          <ol>
            {timeLessons.map(item => <li key={item.id}>
              <button type="button" className={styles.lessonButton} aria-current={lesson.id === item.id ? "step" : undefined}
                onClick={() => selectLesson(item)}><Pair text={item.title} /></button>
            </li>)}
          </ol>
        </aside>}

        <article className={styles.study}>
          <h2 ref={heading} tabIndex={-1}><Pair text={view === "learn" || view === "practice" ? lesson.title : views[view]} /></h2>
          <AudioStudy storagePrefix={storagePrefix} speech={speech} display={view} sessionEpoch={sessionEpoch} openAudio={() => moveTo("audio", true)} />
          {view === "learn" && <>
            <div className={styles.studyCopy}><StudyPair text={lesson.objective} /></div>
            <section className={styles.rule}>
              <h3><Pair text={{ en: "How it works", ru: "Правило" }} /></h3>
              <div className={styles.studyCopy}><StudyPair text={lesson.rule} /></div>
            </section>
            <section className={styles.examples} aria-labelledby="rtt-examples">
              <h3 id="rtt-examples"><Pair text={{ en: "Worked examples", ru: "Примеры" }} /></h3>
              {lesson.examples.map(item => <div className={styles.example} key={item.id}>
                {item.clock && <time dateTime={item.clock} className={styles.exampleClock}>{item.clock}</time>}
                <div className={styles.exampleText}>
                  <p className={styles.phrase}><StudyWords text={item.phrase.ru} language="ru" /></p>
                  <p><StudyWords text={item.phrase.en} language="en" /></p>
                  <p className={styles.stress}>Stress <span lang="ru">Ударение</span> <StudyWords text={item.stressed} language="ru" /></p>
                  <PronunciationStatus audio={speech.audio} id={item.id} />
                </div>
                <button type="button" className={styles.control} onClick={() => speech.speak(item.id, item.phrase.ru)}
                  aria-label={"Listen: " + item.phrase.ru}>Listen <span lang="ru">Слушать</span></button>
              </div>)}
            </section>
            <button type="button" className={styles.primary} onClick={() => moveTo("practice", true)}>
              Practice this lesson <span lang="ru">К упражнениям</span>
            </button>
          </>}

          {view === "practice" && <>
            <div className={styles.directions} role="group" aria-label="Practice direction">
              {practiceDirections.map(item => <button key={item} type="button" className={styles.control}
                aria-pressed={direction === item} onClick={() => {
                  if (direction === item) return;
                  setDirection(item);
                  resetExercise(lesson, item);
                }}><Pair text={directionLabels[item]} /></button>)}
            </div>
            <p className={styles.questionCount}>Question {question + 1} of {lesson.examples.length} <span lang="ru">
              Вопрос {question + 1} из {lesson.examples.length}
            </span></p>
            <p className={styles.question}><StudyWords text={example.phrase[sourceLanguage]} language={sourceLanguage} /></p>
            {sourceLanguage === "ru" && <div className={styles.practiceAudio}>
              <button className={styles.control} type="button" onClick={() => speech.speak(example.id, example.phrase.ru)}>
                Listen <span lang="ru">Слушать</span>
              </button>
              <PronunciationStatus audio={speech.audio} id={example.id} />
              {speech.audio?.id === example.id && speech.audio.status !== "speaking" &&
                <StudyWords text={example.stressed} language="ru" />}
            </div>}
            <p><Pair text={{ en: "Choose the matching phrase.", ru: "Выберите подходящую фразу." }} /></p>
            <div className={styles.choices} role="group" aria-label="Answer choices">
              {choices.map(item => <button type="button" key={item.id} className={styles.choice}
                aria-disabled={answer !== null} data-result={answer === item.id ? (correct ? "correct" : "incorrect") : undefined}
                onClick={() => answerExercise(item.id)} lang={answerLanguage}>{item.phrase[answerLanguage]}</button>)}
            </div>
            {answer !== null && <div className={styles.feedback} role="status" data-result={correct ? "correct" : "incorrect"}>
              <strong><Pair text={correct ? { en: "Correct", ru: "Верно" } : { en: "Review the matching phrase", ru: "Проверьте нужную фразу" }} /></strong>
              <div className={styles.studyCopy}><StudyPair text={example.phrase} /></div>
            </div>}
            {answer !== null && <div className={styles.actions}>
              {!correct && <button type="button" className={styles.control} onClick={() => advance(question)}>
                Try again <span lang="ru">Повторить</span>
              </button>}
              {question + 1 < lesson.examples.length
                ? <button type="button" className={styles.primary} onClick={() => advance(question + 1)}>
                  Next question <span lang="ru">Следующий вопрос</span>
                </button>
                : <button type="button" className={styles.primary} onClick={() => moveTo("progress", true)}>
                  View progress <span lang="ru">Посмотреть прогресс</span>
                </button>}
            </div>}
          </>}

          {view === "progress" && <>
            <div className={styles.totals}>
              <div><strong>{progress.solved.length}/{exerciseCount}</strong><Pair text={{ en: "Solved", ru: "Решено" }} /></div>
              <div><strong>{progress.attempted.length}/{exerciseCount}</strong><Pair text={{ en: "Attempted", ru: "С попыткой ответа" }} /></div>
            </div>
            <p className={styles.saveNote} role="status"><Pair text={{
              loading: { en: "Loading progress", ru: "Загрузка прогресса" },
              saved: { en: "Saved on this device", ru: "Сохранено на этом устройстве" },
              session: { en: "Progress is available for this visit only", ru: "Прогресс доступен только в этом сеансе" },
            }[saveState]} /></p>
            <ul className={styles.progressList}>
              {timeLessons.map(item => {
                const keys = practiceDirections.flatMap(practice => item.examples.map(entry => practiceKey(practice, entry.id)));
                const solved = keys.filter(key => progress.solved.includes(key)).length;
                return <li key={item.id}>
                  <span><Pair text={item.title} /></span>
                  <progress max={keys.length} value={solved} aria-label={item.title.en} />
                  <strong>{solved}/{keys.length}</strong>
                </li>;
              })}
            </ul>
          </>}
        </article>
      </div>
    </div>
    {translation.overlays}
  </main>;
}
