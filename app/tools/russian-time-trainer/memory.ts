import { calendarForms } from "./calendar-content";
import type { Bilingual } from "./content";
import { adaptiveTask, adaptiveTasks, type AdaptiveSkill, type AdaptiveTask } from "./adaptive-content";
import type { AudioSource } from "./audio-assets";

export const skills = {
  listening: { en: "Listening", ru: "Аудирование" },
  understanding: { en: "Understanding", ru: "Понимание" },
  speaking: { en: "Speaking", ru: "Говорение" },
  reading: { en: "Reading", ru: "Чтение" },
  spelling: { en: "Spelling", ru: "Правописание" },
} satisfies Record<string, Bilingual>;

export type Skill = keyof typeof skills;
export type ReviewSkill = Skill | AdaptiveSkill;
export type AdaptiveEvidence = { choice: number; correct: boolean; wrongAttempts: number; lastWrongChoice?: number; audioSource?: AudioSource; selfRecall?: boolean };
export type MemoryEntry = { stage: number; due: number; attempts: number; evidence?: AdaptiveEvidence };
const validAudioSources = new Set<AudioSource>(["recording", "prepared", "device"]);
export const intervals = [0, 1, 3, 7, 14, 30] as const;
const day = 86400000;
const validIds = new Set(calendarForms.map(form => form.id));
const prefixVersion = "memory:v1:";

function skillKey(id: string, skill: ReviewSkill) {
  return id + ":" + skill;
}

export function scheduleReview(previous: MemoryEntry | undefined, recalled: boolean, now: number): MemoryEntry {
  const stage = !recalled ? 0 : previous && now >= previous.due ? Math.min(5, previous.stage + 1) : previous?.stage ?? 0;
  const due = recalled && previous && now < previous.due ? previous.due : now + intervals[stage] * day;
  return { stage, due, attempts: (previous?.attempts ?? 0) + 1 };
}

export function readMemory(storage: Pick<Storage, "getItem">, prefix: string) {
  const entries: Record<string, MemoryEntry> = {};
  for (const { id, skill } of reviewTargets()) {
      const key = skillKey(id, skill);
      const raw = storage.getItem(prefix + prefixVersion + key);
      if (!raw) continue;
      try {
        const value = JSON.parse(raw);
        if (value && Number.isInteger(value.stage) && intervals[value.stage] !== undefined &&
          Number.isSafeInteger(value.due) && value.due >= 0 && Number.isSafeInteger(value.attempts) && value.attempts > 0) {
          const task = adaptiveTask(id);
          if (!task || validEvidence(task, value)) entries[key] = value;
        }
      } catch {
        // A damaged entry should not hide progress for other forms or skills.
      }
  }
  return entries;
}

export function memoryEntry(entries: Record<string, MemoryEntry>, id: string, skill: ReviewSkill) {
  return entries[skillKey(id, skill)];
}

export function setMemory(
  entries: Record<string, MemoryEntry>, id: string, skill: Skill, recalled: boolean,
  now: number, storage?: Pick<Storage, "setItem">, prefix = "",
) {
  if (!validIds.has(id) || !Object.hasOwn(skills, skill)) return entries;
  const key = skillKey(id, skill);
  const entry = scheduleReview(entries[key], recalled, now);
  storage?.setItem(prefix + prefixVersion + key, JSON.stringify(entry));
  return { ...entries, [key]: entry };
}

function reviewTargets(): { id: string; skill: ReviewSkill }[] {
  return [
    ...calendarForms.flatMap(form => (Object.keys(skills) as Skill[]).map(skill => ({ id: form.id, skill }))),
    ...adaptiveTasks.map(task => ({ id: task.id, skill: task.skill })),
  ];
}
function validEvidence(task: AdaptiveTask, entry: MemoryEntry) {
  const e = entry.evidence;
  return !!e && Number.isInteger(e.choice) && e.choice >= 0 && e.choice < task.options.length &&
    e.correct === (e.choice === task.correct) && Number.isInteger(e.wrongAttempts) && e.wrongAttempts >= 0 && e.wrongAttempts <= entry.attempts &&
    (e.wrongAttempts === 0 ? e.lastWrongChoice === undefined : Number.isInteger(e.lastWrongChoice) && e.lastWrongChoice! >= 0 && e.lastWrongChoice! < task.options.length && e.lastWrongChoice !== task.correct) &&
    (task.skill === "sound" ? e.audioSource !== undefined && validAudioSources.has(e.audioSource) : e.audioSource === undefined) &&
    (e.selfRecall === undefined || ((task.stage === "dialogue" || task.stage === "followup") && typeof e.selfRecall === "boolean"));
}
export function adaptiveEligible(task: AdaptiveTask, entries: Record<string, MemoryEntry>) {
  return !task.requires || memoryEntry(entries, task.requires, "context")?.evidence?.correct === true;
}
export function recordAdaptiveAnswer(entries: Record<string, MemoryEntry>, id: string, choice: number, now: number,
  audioSource?: AudioSource, storage?: Pick<Storage, "setItem">, prefix = "") {
  const task = adaptiveTask(id);
  if (!task || !adaptiveEligible(task, entries) || !Number.isInteger(choice) || choice < 0 || choice >= task.options.length ||
    (task.skill === "sound" ? !audioSource || !validAudioSources.has(audioSource) : audioSource !== undefined)) return entries;
  const key = skillKey(id, task.skill);
  const previous = entries[key];
  const correct = choice === task.correct;
  const next = scheduleReview(previous, correct, now);
  next.evidence = {
    choice, correct, wrongAttempts: (previous?.evidence?.wrongAttempts ?? 0) + Number(!correct),
    lastWrongChoice: correct ? previous?.evidence?.lastWrongChoice : choice,
    ...(audioSource ? { audioSource } : {}),
  };
  storage?.setItem(prefix + prefixVersion + key, JSON.stringify(next));
  return { ...entries, [key]: next };
}
export function recordAdaptiveSelfRecall(entries: Record<string, MemoryEntry>, id: string, recalled: boolean,
  storage?: Pick<Storage, "setItem">, prefix = "") {
  const task = adaptiveTask(id);
  if (!task || (task.stage !== "dialogue" && task.stage !== "followup")) return entries;
  const key = skillKey(id, task.skill);
  const previous = entries[key];
  if (!previous?.evidence) return entries;
  const next = { ...previous, evidence: { ...previous.evidence, selfRecall: recalled } };
  storage?.setItem(prefix + prefixVersion + key, JSON.stringify(next));
  return { ...entries, [key]: next };
}
export function nextAdaptiveTask(entries: Record<string, MemoryEntry>, now: number, skill: AdaptiveSkill, exclude?: string) {
  const eligible = adaptiveTasks.filter(task => task.skill === skill && task.id !== exclude && adaptiveEligible(task, entries));
  const due = eligible.filter(task => (memoryEntry(entries, task.id, skill)?.due ?? Infinity) <= now)
    .sort((a, b) => memoryEntry(entries, a.id, skill)!.due - memoryEntry(entries, b.id, skill)!.due);
  const unseen = eligible.filter(task => !memoryEntry(entries, task.id, skill));
  return due[0] ?? unseen[skill === "sound" ? now % Math.max(1, unseen.length) : 0] ?? eligible[0];
}
export function nextReview(entries: Record<string, MemoryEntry>, now: number, current?: string, skipCurrent = false) {
  const due = reviewTargets().map(target => ({ ...target, entry: memoryEntry(entries, target.id, target.skill) }))
    .filter(item => {
      const task = adaptiveTask(item.id);
      return item.entry && item.entry.due <= now && (!task || adaptiveEligible(task, entries));
    });
  due.sort((a, b) => a.entry!.due - b.entry!.due || a.entry!.stage - b.entry!.stage);
  const different = due.find(item => skillKey(item.id, item.skill) !== current);
  return different ?? (skipCurrent ? undefined : due[0]);
}

export function canonicalSpelling(value: string) {
  return value.normalize("NFC").toLowerCase().replaceAll("\u0301", "").trim().replace(/\s+/gu, " ");
}

export function spellingDifference(input: string, expected: string) {
  const typed = canonicalSpelling(input);
  const target = canonicalSpelling(expected);
  let start = 0;
  while (start < typed.length && start < target.length && typed[start] === target[start]) start += 1;
  let end = 0;
  while (end < typed.length - start && end < target.length - start && typed.at(-1 - end) === target.at(-1 - end)) end += 1;
  return { correct: typed === target, typed: typed.slice(start, typed.length - end), expected: target.slice(start, target.length - end) };
}
