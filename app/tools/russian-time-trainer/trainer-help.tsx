"use client";

import { useRef, useState } from "react";
import styles from "./trainer.module.css";

function buildPrompt(lesson: string, view: string, requirements: string) {
  return [
    "Continue the Russian Time Trainer in BlueDragon33/Application-Management.",
    "Open /tools/russian-time-trainer. Verify live GitHub HEAD and Blueprint OS ACTIVE 1.3.0 before editing.",
    "Review the " + view.toLowerCase() + " view for the lesson “" + lesson + "”. Use its real current behavior to select one small improvement.",
    "Keep lessons, practice, feedback, navigation and progress in English and Russian. Reveal Vietnamese only when the learner requests a contextual translation.",
    "Verify hover, long-press, selected-text Translate, the keyboard lookup, Russian audio, and progress after reload. Keep the Help and prompt-review controls accessible.",
    "Use the existing tool entry and local QA. Show the exact revision and observed desktop/mobile results. ZERO-SPEND. Keep changes in a Draft PR for human review.",
    ...(requirements.trim() ? ["User requirements\n" + requirements.trim()] : []),
  ].join("\n\n");
}

export default function TrainerHelp({ lesson, view, onOpen }: { lesson: string; view: string; onOpen: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const preview = useRef<HTMLTextAreaElement>(null);
  const [requirements, setRequirements] = useState("");
  const [reviewed, setReviewed] = useState("");
  const [copy, setCopy] = useState<"copied" | "manual" | null>(null);
  const draft = buildPrompt(lesson, view, requirements);
  const ready = reviewed === draft;

  async function copyPrompt() {
    if (!ready) return;
    try {
      await navigator.clipboard.writeText(draft);
      setCopy("copied");
    } catch {
      preview.current?.focus();
      preview.current?.select();
      setCopy("manual");
    }
  }

  return <>
    <button type="button" ref={trigger} className={styles.help} onClick={() => {
      onOpen();
      setReviewed("");
      setCopy(null);
      trigger.current?.focus({ preventScroll: true });
      dialog.current?.showModal();
    }}><span aria-hidden="true">❔</span> Help <span lang="ru">Помощь</span></button>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="rtt-help-title">
      <header className={styles.dialogHeader}>
        <h2 id="rtt-help-title">Help <span lang="ru">Помощь</span></h2>
        <button type="button" className={styles.dismiss} onClick={() => dialog.current?.close()} aria-label="Close help">×</button>
      </header>
      <section className={styles.dialogBody}>
        <div className={styles.helpInstructions}>
          <p>Hover or press and hold a word. To look up a phrase, select it and choose Translate. With a keyboard, open Translate and enter the text.</p>
          <p lang="ru">Наведите указатель на слово или нажмите и удерживайте его. Выделите фразу и выберите «Перевести». С клавиатуры откройте перевод и введите текст.</p>
        </div>
        <h3>Developer assistance <span lang="ru">Помощь разработчику</span></h3>
        <p>Review and copy a prompt for the current lesson. <span lang="ru">Проверьте и скопируйте промпт для текущего урока.</span></p>
        <label htmlFor="rtt-requirements">Additional requirements <span lang="ru">Дополнительные требования</span></label>
        <textarea id="rtt-requirements" rows={2} maxLength={1200} value={requirements} onChange={event => {
          setRequirements(event.target.value);
          setReviewed("");
          setCopy(null);
        }} />
        <label htmlFor="rtt-developer-prompt">Prompt preview <span lang="ru">Предпросмотр промпта</span></label>
        <textarea id="rtt-developer-prompt" rows={8} value={draft} ref={preview} readOnly />
        <div className={styles.actions}>
          <button className={styles.control} type="button" aria-pressed={ready} onClick={() => setReviewed(draft)}>
            Mark reviewed <span lang="ru">Подтвердить проверку</span>
          </button>
          <button className={styles.primary} type="button" disabled={!ready} onClick={() => void copyPrompt()}>
            Copy reviewed prompt <span lang="ru">Скопировать проверенный промпт</span>
          </button>
        </div>
        <p role="status">
          {copy === "copied" && <>Prompt copied. <span lang="ru">Промпт скопирован.</span></>}
          {copy === "manual" && <>Prompt selected for copying. <span lang="ru">Промпт выделен для копирования.</span></>}
          {!copy && ready && <>Prompt reviewed and ready to copy. <span lang="ru">Промпт проверен и готов к копированию.</span></>}
        </p>
        <a href="https://github.com/BlueDragon33/Software-Blueprint-Hub/blob/main/docs/UNIVERSAL-CONSTITUTION.md" target="_blank" rel="noreferrer">
          Blueprint OS Constitution <span lang="ru">Конституция Blueprint OS</span>
        </a>
      </section>
    </dialog>
  </>;
}
