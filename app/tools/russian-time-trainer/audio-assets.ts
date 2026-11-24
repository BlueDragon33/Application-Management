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
