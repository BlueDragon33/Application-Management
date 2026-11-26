"use client";
import { useState } from "react";
import type { AdaptiveTask } from "./adaptive-content";
import { previewAudio, resolveAudioClip, type AudioSource } from "./audio-assets";
import { PronunciationStatus, type AudioSettings, type useRussianAudio } from "./pronunciation";
import { Recording } from "./recording";
import { StudyWords } from "./translation";
import type { Bilingual } from "./content";
import styles from "./trainer.module.css";

function Pair({ text }: { text: Bilingual }) { return <>{text.en} <span lang="ru">{text.ru}</span></>; }
export default function AdaptivePractice({ task, speech, settings, seed, onAnswer, onSelfRecall, onAdvance, onRetry }: {
  task: AdaptiveTask; speech: ReturnType<typeof useRussianAudio>; settings: AudioSettings; seed: number;
  onAnswer: (choice: number, time: number, source?: AudioSource) => boolean;
  onSelfRecall: (recalled: boolean) => boolean;
  onAdvance: (time: number, correct: boolean) => void; onRetry: () => void;
}) {
  const [choice, setChoice] = useState<number | null>(null);
  const [heard, setHeard] = useState<AudioSource>();
  const [answeredSource, setAnsweredSource] = useState<AudioSource>();
  const [reveal, setReveal] = useState(task.stage === "sound" || task.stage === "foundation");
  const [self, setSelf] = useState<boolean>();
  const sound = task.skill === "sound";
  const conversation = task.stage === "dialogue" || task.stage === "followup";
  const correct = choice === task.correct;
  const options = task.options.map((option, index) => ({ option, index }));
  const offset = seed % options.length;
  const ordered = [...options.slice(offset), ...options.slice(0, offset)];
  const audioId = "practice-" + task.id;
  return <section className={styles.adaptiveTask} aria-label="Adaptive practice / Адаптивная практика">
    <p className={styles.saveNote}>Supplemental practice · Linguistic review pending <span lang="ru">Дополнительная практика · Лингвистическая проверка ожидается</span></p>
    <h3><Pair text={task.title} /></h3>
    <p><Pair text={task.goal} /></p>
    {sound ? <section className={styles.player} aria-label="Sound challenge / Звуковое задание">
      <p className={styles.playerMode}>Listen first <span lang="ru">Сначала слушайте</span></p>
      <button type="button" className={styles.primary} disabled={choice !== null} onClick={() => {
        setHeard(undefined);
        speech.play(audioId, [resolveAudioClip(task.options[task.correct].ru, task.id)], { ...settings, repeats: 1 }, setHeard);
      }}>Play sound <span lang="ru">Слушать звук</span></button>
      <button type="button" className={styles.control} onClick={speech.stop}>Stop audio <span lang="ru">Остановить звук</span></button>
      <PronunciationStatus audio={speech.audio} id={audioId} />
      <p className={styles.playerHint}>Candidate audio and device voice are preview only; answers are not added to spaced review. <span lang="ru">Проверочные образцы синтеза и голос устройства — только тренировка, без интервального повторения.</span></p>
    </section> : task.prompt && <section className={styles.rule}>
      <p className={styles.phrase}><StudyWords text={task.prompt.ru} language="ru" /></p>
      <button type="button" className={styles.control} onClick={() => {
        const prompt = task.prompt!;
        speech.play(audioId, [resolveAudioClip(prompt.ru, task.promptAudioId ?? audioId)], settings);
      }}>Play question <span lang="ru">Слушать вопрос</span></button>
      <PronunciationStatus audio={speech.audio} id={audioId} />
    </section>}
    {conversation && <>
      <p>Say your answer aloud before revealing choices. The selected answer measures contextual choice only. <span lang="ru">Ответьте вслух до открытия вариантов. Выбор ответа оценивает только понимание контекста.</span></p>
      <Recording stopModel={speech.stop} />
    </>}
    {!reveal ? <button type="button" className={styles.primary} onClick={() => setReveal(true)}>Reveal response choices <span lang="ru">Показать варианты ответа</span></button> :
      <div className={styles.choices} role="group" aria-label="Adaptive answer choices">
        {ordered.map(({ option, index }) => <button type="button" lang="ru" key={index} className={styles.choice}
          disabled={choice !== null || (sound && !heard)}
          data-result={choice === index ? correct ? "correct" : "incorrect" : undefined}
          onClick={() => {
            if (choice === null && (!sound || heard) && ((sound && previewAudio(heard)) || onAnswer(index, Date.now(), sound ? heard : undefined))) {
              setAnsweredSource(sound ? heard : undefined);
              setChoice(index);
            }
          }}>
          {option.ru}
        </button>)}
      </div>}
    {choice !== null && <section className={styles.feedback} data-result={correct ? "correct" : "incorrect"} role="status">
      <strong>{correct ? "Correct choice · Верно" : "Review this choice · Проверьте ответ"}</strong>
      <p>Your answer <span lang="ru">Ваш ответ</span>: <StudyWords text={task.options[choice].ru} language="ru" /></p>
      <p>Model answer <span lang="ru">Образец ответа</span>: <StudyWords text={task.options[task.correct].ru} language="ru" /></p>
      <p><StudyWords text={task.options[task.correct].en} language="en" /> {task.options[task.correct].ipa && "[" + task.options[task.correct].ipa + "]"}</p>
      <p><Pair text={task.rule} /></p>
      {sound && <>
        <p>Playback source: {answeredSource === "candidate" ? "Offline synthetic candidate / Синтез на проверке" : answeredSource === "device" ? "Device preview / Голос устройства" : answeredSource === "prepared" ? "Prepared synthetic voice / Синтез" : "Recording / Запись"}</p>
        {previewAudio(answeredSource) && <p>Preview feedback only. No memory interval or assessment result was saved. <span lang="ru">Только учебная обратная связь. Результат проверки и интервал не сохранены.</span></p>}
        <div className={styles.actions}>{task.options.map((option, index) => <button type="button" key={index} className={styles.control}
          onClick={() => speech.play(task.id + "-compare-" + index, [resolveAudioClip(option.ru, task.id.replace(/-\d+$/, "-" + index))], { ...settings, repeats: 1 })}>
          Listen: <span lang="ru">{option.ru}</span>
        </button>)}</div>
        {task.options.map((_, index) => <PronunciationStatus key={index} audio={speech.audio} id={task.id + "-compare-" + index} />)}
      </>}
      {!sound && <>
        <button type="button" className={styles.control} onClick={() => speech.play(audioId + "-model", [resolveAudioClip(task.options[task.correct].ru, audioId + "-model")], settings)}>Listen to model answer <span lang="ru">Слушать образец ответа</span></button>
        <PronunciationStatus audio={speech.audio} id={audioId + "-model"} />
      </>}
    </section>}
    {conversation && choice !== null && <section className={styles.rule}>
      <p>Self-report only · Самооценка</p>
      <div className={styles.actions}>
        <button type="button" className={styles.control} disabled={self !== undefined} onClick={() => { if (onSelfRecall(true)) setSelf(true); }}>I recalled it before seeing choices <span lang="ru">Вспомнил(а) до подсказки</span></button>
        <button type="button" className={styles.control} disabled={self !== undefined} onClick={() => { if (onSelfRecall(false)) setSelf(false); }}>I needed help <span lang="ru">Понадобилась подсказка</span></button>
      </div>
      {self !== undefined && <p role="status">Self-report saved separately from choice and pronunciation. <span lang="ru">Самооценка сохранена отдельно от выбора и произношения.</span></p>}
    </section>}
    <div className={styles.actions}>
      {choice !== null && !correct && <button type="button" className={styles.control} onClick={onRetry}>Try again <span lang="ru">Повторить</span></button>}
      <button type="button" className={choice !== null ? styles.primary : styles.control} onClick={() => onAdvance(Date.now(), correct)}>
        {choice === null ? "Skip for now / Пока пропустить" : "Next task / Следующее задание"}
      </button>
    </div>
  </section>;
}
