"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./trainer.module.css";

type RecordingStatus = "ready" | "requesting" | "recording" | "complete" | "unavailable" | "failed";
const messages = {
  ready: { en: "Record up to 30 seconds. Replay and compare with the model.", ru: "Запишите до 30 секунд и сравните с образцом." },
  requesting: { en: "Waiting for microphone permission.", ru: "Ожидание доступа к микрофону." },
  recording: { en: "Recording locally.", ru: "Идёт локальная запись." },
  complete: { en: "Recording is available for this exercise.", ru: "Запись доступна в этом упражнении." },
  unavailable: { en: "Microphone recording is unavailable here.", ru: "Запись с микрофона здесь недоступна." },
  failed: { en: "Microphone access or recording failed.", ru: "Не удалось получить доступ к микрофону или записать звук." },
};

export function Recording({ stopModel }: { stopModel: () => void }) {
  const [status, setStatus] = useState<RecordingStatus>("ready");
  const [url, setUrl] = useState<string>();
  const current = useRef<{ recorder?: MediaRecorder; stream?: MediaStream; timeout?: number; url?: string }>({});

  useEffect(() => {
    const session = current.current;
    return () => {
      current.current = {};
      window.clearTimeout(session.timeout);
      session.stream?.getTracks().forEach(track => track.stop());
      if (session.url) URL.revokeObjectURL(session.url);
    };
  }, []);

  function stopRecording() {
    const { recorder, timeout } = current.current;
    window.clearTimeout(timeout);
    if (recorder?.state === "recording") recorder.stop();
  }

  async function record() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setStatus("unavailable");
      return;
    }
    stopModel();
    const session = current.current;
    if (session.url) URL.revokeObjectURL(session.url);
    session.url = undefined;
    setUrl(undefined);
    setStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (current.current !== session) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      session.stream = stream;
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      session.recorder = recorder;
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => {
        stream.getTracks().forEach(track => track.stop());
        window.clearTimeout(session.timeout);
        if (current.current === session) setStatus("failed");
      };
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        window.clearTimeout(session.timeout);
        if (current.current !== session) return;
        if (!chunks.length) {
          setStatus("failed");
          return;
        }
        session.url = URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType }));
        setUrl(session.url);
        setStatus("complete");
      };
      recorder.start();
      session.timeout = window.setTimeout(stopRecording, 30000);
      setStatus("recording");
    } catch {
      session.stream?.getTracks().forEach(track => track.stop());
      if (current.current === session) setStatus("failed");
    }
  }

  return <div className={styles.rule}>
    <p role="status">{messages[status].en} <span lang="ru">{messages[status].ru}</span></p>
    <div className={styles.actions}>
      <button type="button" className={styles.control} disabled={status === "requesting" || status === "recording"} onClick={() => void record()}>
        Record <span lang="ru">Записать</span>
      </button>
      <button type="button" className={styles.control} disabled={status !== "recording"} onClick={stopRecording}>
        Stop recording <span lang="ru">Остановить запись</span>
      </button>
    </div>
    {url && <audio className={styles.recording} controls src={url} onPlay={stopModel} aria-label="Your recording / Ваша запись" />}
  </div>;
}
