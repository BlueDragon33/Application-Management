"use client";

import { useEffect, useRef, useState } from "react";
import { bundledAudio, type AudioClip, type AudioSource } from "./audio-assets";
import { chatterboxAsset, chatterboxBlob } from "./chatterbox-audio";
import styles from "./trainer.module.css";

type AudioState = { id: string; source?: AudioSource; partial?: boolean; status: "loading" | "speaking" | "pause" | "complete" | "unavailable" | "error" };
export type AudioSettings = { rate: 0.5 | 0.75 | 1; repeats: 1 | 3 | 5 | "continuous"; pause: 2 | 3 | 4 | 5 };
const defaults: AudioSettings = { rate: 1, repeats: 1, pause: 2 };

type Playback = {
  timer?: number;
  media?: HTMLAudioElement;
  objectUrl?: string;
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
    if (session.objectUrl) URL.revokeObjectURL(session.objectUrl);
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

  function play(id: string, clips: readonly AudioClip[], settings: AudioSettings = defaults, onClipCompleted?: (source: AudioSource) => void) {
    if (!clips.length) return;
    cancel();
    const engine = window.speechSynthesis;
    const localVoices = engine?.getVoices().filter(voice => voice.localService && /^ru(?:-|$)/i.test(voice.lang)) ?? [];
    const voice = localVoices.find(item => item.lang.toLowerCase() === "ru-ru")
      ?? localVoices.find(item => item.lang.toLowerCase() === "ru")
      ?? localVoices[0];
    const hasLocalVoice = Boolean(voice && window.SpeechSynthesisUtterance);
    const playable = hasLocalVoice || clips.length === 1 ? clips :
      clips.filter(clip => bundledAudio(clip));
    if (!playable.length) {
      setAudio({ id, status: "unavailable" });
      return;
    }
    const session: Playback = {};
    active.current = session;
    let position = 0;
    let rounds = 0;
    let clipStarted = false;
    let completedOnce = false;
    let lastSource: AudioSource | undefined;

    function update(status: AudioState["status"], source?: AudioSource) {
      if (active.current !== session) return;
      setAudio({ id, status, source, partial: playable.length < clips.length });
      if (status === "speaking") {
        clipStarted = true;
        lastSource = source;
      }
    }

    function finish(status: AudioState["status"]) {
      if (active.current !== session) return;
      update(status, status === "complete" ? lastSource : undefined);
      cancel();
    }

    function next() {
      if (active.current !== session) return;
      // An ended event alone is not playback evidence. Require a matching start.
      if (!clipStarted || !lastSource) {
        finish("error");
        return;
      }
      clipStarted = false;
      if (!completedOnce) {
        completedOnce = true;
        onClipCompleted?.(lastSource);
      }
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
      update("pause", lastSource);
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
      utterance.onstart = () => update("speaking", "device");
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
      clipStarted = false;
      update("loading");
      session.watchdog = window.setTimeout(() => finish("error"), 30000);
      const recording = bundledAudio(clip);
      if (!recording) {
        speakLocal(clip.ru);
        return;
      }
      if (session.objectUrl) {
        URL.revokeObjectURL(session.objectUrl);
        session.objectUrl = undefined;
      }
      function startMedia(src: string, strictCandidate: boolean) {
      if (active.current !== session) return;
      const media = session.media ?? new Audio();
      session.media = media;
      let fallbackStarted = false;
      const fallback = () => {
        if (active.current !== session || fallbackStarted) return;
        fallbackStarted = true;
        clipStarted = false;
        media.onplaying = null;
        media.onended = null;
        media.onerror = null;
        media.pause();
        if (strictCandidate) finish("error");
        else speakLocal(clip.ru);
      };
      media.onplaying = () => update("speaking", recording!.source);
      media.onended = next;
      media.onerror = fallback;
      if (media.getAttribute("src") !== src) media.src = src;
      else media.currentTime = 0;
      media.playbackRate = settings.rate;
      media.preservesPitch = true;
      void media.play().catch(fallback);
      }
      const candidate = chatterboxAsset(clip);
      if (candidate) {
        void chatterboxBlob(candidate).then(blob => {
          if (active.current !== session) return;
          session.objectUrl = URL.createObjectURL(blob);
          startMedia(session.objectUrl, true);
        }).catch(() => finish("error"));
      } else startMedia(recording.src, false);
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

const sources = {
  recording: { en: "Speaker recording", ru: "Запись диктора" },
  prepared: { en: "Prepared synthetic voice", ru: "Подготовленный синтез" },
  device: { en: "Device voice", ru: "Голос устройства" },
  candidate: { en: "Offline synthetic candidate", ru: "Синтез на проверке" },
};

export function PronunciationStatus({ audio, id }: { audio: AudioState | null; id: string }) {
  return audio?.id === id
    ? <p className={styles.audioStatus} role="status">
      {messages[audio.status].en} <span lang="ru">{messages[audio.status].ru}</span>
      {audio.source && <> · {sources[audio.source].en} <span lang="ru">{sources[audio.source].ru}</span></>}
      {audio.partial && <> Some clips need a Russian device voice. <span lang="ru">Для части фраз нужен русский голос на устройстве.</span></>}
    </p>
    : null;
}
