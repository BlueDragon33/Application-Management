"use client";

import { useEffect, useRef, useState } from "react";
import { nativeAudio } from "./native-audio";
import styles from "./trainer.module.css";

type AudioState = { id: string; partial?: boolean; status: "loading" | "speaking" | "pause" | "complete" | "unavailable" | "error" };
export type AudioClip = { id: string; ru: string };
export type AudioSettings = { rate: 0.5 | 0.75 | 1; repeats: 1 | 3 | 5 | "continuous"; pause: 2 | 3 | 4 | 5 };
const defaults: AudioSettings = { rate: 1, repeats: 1, pause: 2 };

type Playback = {
  timer?: number;
  media?: HTMLAudioElement;
  utterance?: SpeechSynthesisUtterance;
  watchdog?: number;
};

export function useRussianAudio() {
  const [audio, setAudio] = useState<AudioState | null>(null);
  const active = useRef<Playback | null>(null);

  function cancel() {
    const session = active.current;
    if (!session) return;
    active.current = null;
    window.clearTimeout(session.timer);
    window.clearTimeout(session.watchdog);
    session.media?.pause();
    if (session.utterance) window.speechSynthesis?.cancel();
  }

  useEffect(() => {
    window.speechSynthesis?.getVoices();
    return cancel;
  }, []);

  function stop() {
    cancel();
    setAudio(null);
  }

  function play(id: string, clips: readonly AudioClip[], settings: AudioSettings = defaults, onPlaying?: () => void) {
    if (!clips.length) return;
    cancel();
    const engine = window.speechSynthesis;
    const localVoices = engine?.getVoices().filter(voice => voice.localService && /^ru(?:-|$)/i.test(voice.lang)) ?? [];
    const voice = localVoices.find(item => item.lang.toLowerCase() === "ru-ru") ?? localVoices[0];
    const hasLocalVoice = Boolean(voice && window.SpeechSynthesisUtterance);
    const playable = hasLocalVoice || clips.length === 1 ? clips :
      clips.filter(clip => nativeAudio[clip.id]?.ru === clip.ru);
    if (!playable.length) {
      setAudio({ id, status: "unavailable" });
      return;
    }
    const session: Playback = {};
    active.current = session;
    let position = 0;
    let rounds = 0;

    function update(status: AudioState["status"]) {
      if (active.current !== session) return;
      setAudio({ id, status, partial: playable.length < clips.length });
      if (status === "speaking") onPlaying?.();
    }

    function finish(status: AudioState["status"]) {
      if (active.current !== session) return;
      update(status);
      cancel();
    }

    function next() {
      if (active.current !== session) return;
      window.clearTimeout(session.watchdog);
      session.utterance = undefined;
      position += 1;
      if (position === playable.length) {
        position = 0;
        rounds += 1;
      }
      if (settings.repeats !== "continuous" && rounds >= settings.repeats) {
        finish("complete");
        return;
      }
      update("pause");
      session.timer = window.setTimeout(playClip, settings.pause * 1000);
    }

    function speakLocal(text: string) {
      if (!engine || !voice || !window.SpeechSynthesisUtterance) {
        finish("unavailable");
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = settings.rate;
      utterance.pitch = 1;
      utterance.onstart = () => update("speaking");
      utterance.onend = next;
      utterance.onerror = () => finish("error");
      session.utterance = utterance;
      try {
        engine.speak(utterance);
      } catch {
        finish("error");
      }
    }

    function playClip() {
      if (active.current !== session) return;
      const clip = playable[position];
      update("loading");
      session.watchdog = window.setTimeout(() => finish("error"), 30000);
      const recording = nativeAudio[clip.id];
      if (!recording || recording.ru !== clip.ru) {
        speakLocal(clip.ru);
        return;
      }
      const media = session.media ?? new Audio();
      session.media = media;
      let fallbackStarted = false;
      const fallback = () => {
        if (active.current !== session || fallbackStarted) return;
        fallbackStarted = true;
        media.onplaying = null;
        media.onended = null;
        media.onerror = null;
        media.pause();
        speakLocal(clip.ru);
      };
      media.onplaying = () => update("speaking");
      media.onended = next;
      media.onerror = fallback;
      if (media.getAttribute("src") !== recording.src) media.src = recording.src;
      else media.currentTime = 0;
      media.playbackRate = settings.rate;
      media.preservesPitch = true;
      void media.play().catch(fallback);
    }

    playClip();
  }

  function speak(id: string, ru: string) {
    play(id, [{ id, ru }]);
  }

  return { audio, speak, play, stop };
}

const messages = {
  loading: { en: "Starting audio.", ru: "Запуск звука." },
  speaking: { en: "Playing Russian audio.", ru: "Воспроизводится русская фраза." },
  pause: { en: "Pause for repetition.", ru: "Пауза для повтора." },
  complete: { en: "Playback finished.", ru: "Воспроизведение завершено." },
  unavailable: { en: "No Russian device voice is available. Use the marked stress.", ru: "Русский голос недоступен. Ориентируйтесь на знаки ударения." },
  error: { en: "Audio could not play. Use the marked stress.", ru: "Не удалось включить звук. Ориентируйтесь на знаки ударения." },
};

export function PronunciationStatus({ audio, id }: { audio: AudioState | null; id: string }) {
  return audio?.id === id
    ? <p className={styles.audioStatus} role="status">
      {messages[audio.status].en} <span lang="ru">{messages[audio.status].ru}</span>
      {audio.partial && <> Some clips need a Russian device voice. <span lang="ru">Для части фраз нужен русский голос на устройстве.</span></>}
    </p>
    : null;
}
