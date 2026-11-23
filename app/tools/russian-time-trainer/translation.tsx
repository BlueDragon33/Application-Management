"use client";

import { useEffect, useRef, useState, type MouseEvent, type PointerEvent, type RefObject } from "react";
import { translatedWord, translateStudyText, type Translation } from "./content";
import styles from "./trainer.module.css";

function languageOf(text: string) {
  return /\p{Script=Cyrillic}/u.test(text) ? "ru" : "en";
}

export function StudyWords({ text, language }: { text: string; language: "en" | "ru" }) {
  return <span lang={language} data-study-text>
    {text.split(/([\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*)/u).map((part, index) =>
      index % 2 === 1
        ? <span key={index} data-study-word={part} lang={language === "en" && languageOf(part) === "ru" ? "ru" : undefined}>{part}</span>
        : part,
    )}
  </span>;
}

function wordAt(target: EventTarget | null) {
  return target instanceof Element ? target.closest<HTMLElement>("[data-study-word]") : null;
}

function selectedStudyText(root: HTMLElement | null) {
  const selection = window.getSelection();
  if (!root || !selection || selection.isCollapsed || !selection.rangeCount) return "";
  const range = selection.getRangeAt(0);
  const studyNode = (node: Node) => {
    const element = node instanceof Element ? node : node.parentElement;
    const scope = element?.closest("[data-study-text]");
    return scope && root.contains(scope);
  };
  return studyNode(range.startContainer) && studyNode(range.endContainer)
    ? selection.toString().trim().slice(0, 600)
    : "";
}

type Press = { x: number; y: number; id: number; timer: number };
type WordPreview = { word: string; meaning: string };

export function useContextTranslation(root: RefObject<HTMLElement | null>) {
  const [word, setWord] = useState<WordPreview | null>(null);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<Translation | null>(null);
  const press = useRef<Press | null>(null);
  const hovered = useRef<HTMLElement | null>(null);
  const preservedSelection = useRef("");
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  function clearHold() {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
  }

  function dismiss() {
    clearHold();
    setWord(null);
  }

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      clearHold();
      window.removeEventListener("keydown", handleKey);
    };
  }, []);

  function reveal(target: HTMLElement) {
    const term = target.dataset.studyWord;
    const meaning = term && translatedWord(term);
    setWord(term && meaning ? { word: term, meaning } : null);
  }

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    dismiss();
    if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
    const target = wordAt(event.target);
    if (!target) return;
    press.current = {
      x: event.clientX,
      y: event.clientY,
      id: event.pointerId,
      timer: window.setTimeout(() => reveal(target), 450),
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    const active = press.current;
    if (active?.id === event.pointerId && Math.hypot(event.clientX - active.x, event.clientY - active.y) > 10) {
      clearHold();
    }
    if (event.pointerType !== "mouse" || event.buttons || selectedStudyText(root.current)) return;
    const target = wordAt(event.target);
    if (target !== hovered.current) {
      hovered.current = target;
      if (target) reveal(target);
    }
  }

  function handleContextMenu(event: MouseEvent<HTMLElement>) {
    // Native touch selection remains available for choosing a longer phrase.
    const native = event.nativeEvent;
    const target = wordAt(event.target);
    if (target && (press.current || ("pointerType" in native && native.pointerType === "touch"))) reveal(target);
  }

  function open() {
    const selection = selectedStudyText(root.current) || preservedSelection.current;
    preservedSelection.current = "";
    dismiss();
    setQuery(selection);
    setResult(selection ? translateStudyText(selection) : null);
    dialog.current?.showModal();
    input.current?.focus();
  }

  return {
    dismiss,
    interaction: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: clearHold,
      onPointerCancel: clearHold,
      onPointerLeave: () => {
        clearHold();
        hovered.current = null;
      },
      onContextMenu: handleContextMenu,
    },
    trigger: <button ref={trigger} type="button" className={styles.control} onClick={open}
      onPointerDown={() => { preservedSelection.current = selectedStudyText(root.current); }}
      onPointerCancel={() => { preservedSelection.current = ""; }}>
      Translate <span lang="ru">Перевести</span>
    </button>,
    overlays: <>
      {word && <aside className={styles.wordPreview} aria-label="Word translation">
        <div role="status">
          <strong lang={languageOf(word.word)}>{word.word}</strong>
          <p lang="vi">{word.meaning}</p>
        </div>
        <button type="button" className={styles.dismiss} aria-label="Dismiss translation" onClick={dismiss}>×</button>
      </aside>}
      <dialog ref={dialog} className={styles.dialog} aria-labelledby="rtt-translate-title" onClose={() => {
        setResult(null);
        setQuery("");
        trigger.current?.focus();
      }}>
        <header className={styles.dialogHeader}>
          <h2 id="rtt-translate-title">Translation <span lang="ru">Перевод</span></h2>
          <button type="button" className={styles.dismiss} onClick={() => dialog.current?.close()} aria-label="Close translation">×</button>
        </header>
        <form className={styles.dialogBody} onSubmit={event => {
          event.preventDefault();
          setResult(translateStudyText(query));
        }}>
          <label htmlFor="rtt-lookup">Word or phrase <span lang="ru">Слово или фраза</span></label>
          <input id="rtt-lookup" ref={input} value={query} maxLength={600} onChange={event => {
            setQuery(event.target.value);
            setResult(null);
          }} />
          <button type="submit" className={styles.primary} disabled={!query.trim()}>Translate <span lang="ru">Перевести</span></button>
          <div className={styles.translationResult} role="status">
            {result?.kind === "exact" && <p lang="vi">{result.meaning}</p>}
            {result?.kind === "words" && <>
              <p>Word meanings <span lang="ru">Значения слов</span></p>
              <dl>{result.words.map(item => <div key={item.text}>
                <dt lang={languageOf(item.text)}>{item.text}</dt>
                <dd lang="vi">{item.meaning}</dd>
              </div>)}</dl>
            </>}
            {result?.kind === "missing" && <p>
              No translation in this course glossary. <span lang="ru">В словаре курса такого перевода нет.</span>
            </p>}
          </div>
        </form>
      </dialog>
    </>,
  };
}
