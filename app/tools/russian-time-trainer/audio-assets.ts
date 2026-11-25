import { nativeAudio } from "./native-audio";
import { preparedAudioText } from "./prepared-audio";

export type AudioClip = { id: string; ru: string };
export type AudioSource = "recording" | "prepared" | "device";

export const preparedVoice = {
  name: "RHVoice Aleksandr-HQ",
  speaker: "Aleksander Karlov",
  contributors: "Artem Plaksin, Sergey Parshakov, Beka Gozalishvili and Zvonimir Stanecic",
  source: "https://github.com/RHVoice/aleksandr-hq-rus",
  license: "https://creativecommons.org/licenses/by-sa/4.0/",
} as const;

export function bundledAudio(clip: AudioClip): { src: string; source: Exclude<AudioSource, "device"> } | undefined {
  const recording = nativeAudio[clip.id];
  if (recording?.ru === clip.ru) return { src: recording.src, source: "recording" };
  if (preparedAudioText[clip.id] === clip.ru) {
    return { src: "/russian-time-trainer/prepared/" + clip.id + ".mp3", source: "prepared" };
  }
}

/** Reuse existing local media only when the complete spoken text matches exactly.
 * Stress marks in the study display are not part of the recorded script.
 * No approximate, case-insensitive, substring, or external URL matching. */
export function resolveAudioClip(ru: string, preferredId: string): AudioClip {
  const text = ru.replaceAll("\u0301", "");
  const preferred = { id: preferredId, ru: text };
  if (bundledAudio(preferred)) return preferred;
  const recording = Object.entries(nativeAudio).find(([, item]) => item.ru === text);
  if (recording) return { id: recording[0], ru: text };
  const prepared = Object.entries(preparedAudioText).find(([, value]) => value === text);
  return prepared ? { id: prepared[0], ru: text } : preferred;
}
