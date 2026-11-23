"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./trainer.module.css";

type AudioState = { id: string; status: "speaking" | "unavailable" | "error" };

export function useRussianAudio() {
  const [audio, setAudio] = useState<AudioState | null>(null);
  const playing = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    window.speechSynthesis?.getVoices();
    return () => {
      if (playing.current) window.speechSynthesis?.cancel();
      playing.current = null;
    };
  }, []);

  function stop() {
    if (playing.current) {
      playing.current = null;
      window.speechSynthesis.cancel();
    }
    setAudio(null);
  }

  function speak(id: string, text: string) {
    stop();
    const engine = window.speechSynthesis;
    const voice = engine?.getVoices().find(item => item.localService && /^ru(?:-|$)/i.test(item.lang));
    if (!voice || !window.SpeechSynthesisUtterance) {
      setAudio({ id, status: "unavailable" });
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = 0.85;
    utterance.onstart = () => { if (playing.current === utterance) setAudio({ id, status: "speaking" }); };
    utterance.onend = () => {
      if (playing.current === utterance) {
        playing.current = null;
        setAudio(null);
      }
    };
    const onError = () => {
      if (playing.current === utterance) {
        playing.current = null;
        setAudio({ id, status: "error" });
      }
    };
    playing.current = utterance;
    utterance.onerror = onError;
    try {
      engine.speak(utterance);
    } catch {
      onError();
    }
  }
  return { audio, speak, stop };
}

const messages = {
  speaking: { en: "Playing Russian audio.", ru: "Воспроизводится русская фраза." },
  unavailable: { en: "No Russian device voice is available. Use the marked stress.", ru: "Русский голос недоступен. Ориентируйтесь на знаки ударения." },
  error: { en: "Audio could not play. Use the marked stress.", ru: "Не удалось включить звук. Ориентируйтесь на знаки ударения." },
};

export function PronunciationStatus({ audio, id }: { audio: AudioState | null; id: string }) {
  return audio?.id === id
    ? <p className={styles.audioStatus} role="status">{messages[audio.status].en} <span lang="ru">{messages[audio.status].ru}</span></p>
    : null;
}
