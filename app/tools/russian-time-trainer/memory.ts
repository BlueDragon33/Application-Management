import { calendarForms } from "./calendar-content";
import type { Bilingual } from "./content";

export const skills = {
  listening: { en: "Listening", ru: "Аудирование" },
  understanding: { en: "Understanding", ru: "Понимание" },
  speaking: { en: "Speaking", ru: "Говорение" },
  reading: { en: "Reading", ru: "Чтение" },
  spelling: { en: "Spelling", ru: "Правописание" },
} satisfies Record<string, Bilingual>;

export type Skill = keyof typeof skills;
export type MemoryEntry = { stage: number; due: number; attempts: number };
export const intervals = [0, 1, 3, 7, 14, 30] as const;
const day = 86400000;
const validIds = new Set(calendarForms.map(form => form.id));
const prefixVersion = "memory:v1:";

function skillKey(id: string, skill: Skill) {
  return id + ":" + skill;
}

export function scheduleReview(previous: MemoryEntry | undefined, recalled: boolean, now: number): MemoryEntry {
  const stage = !recalled ? 0 : previous && now >= previous.due ? Math.min(5, previous.stage + 1) : previous?.stage ?? 0;
  const due = recalled && previous && now < previous.due ? previous.due : now + intervals[stage] * day;
  return { stage, due, attempts: (previous?.attempts ?? 0) + 1 };
}

export function readMemory(storage: Pick<Storage, "getItem">, prefix: string) {
  const entries: Record<string, MemoryEntry> = {};
  for (const id of validIds) {
    for (const skill of Object.keys(skills) as Skill[]) {
      const key = skillKey(id, skill);
      const raw = storage.getItem(prefix + prefixVersion + key);
      if (!raw) continue;
      try {
        const value = JSON.parse(raw);
        if (value && Number.isInteger(value.stage) && intervals[value.stage] !== undefined &&
          Number.isSafeInteger(value.due) && value.due >= 0 && Number.isSafeInteger(value.attempts) && value.attempts > 0) {
          entries[key] = value;
        }
      } catch {
        // A damaged entry should not hide progress for other forms or skills.
      }
    }
  }
  return entries;
}

export function memoryEntry(entries: Record<string, MemoryEntry>, id: string, skill: Skill) {
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

export function nextReview(entries: Record<string, MemoryEntry>, now: number, current?: string) {
  const due = calendarForms.flatMap(form => (Object.keys(skills) as Skill[]).map(skill => ({
    id: form.id, skill, entry: memoryEntry(entries, form.id, skill),
  }))).filter(item => item.entry && item.entry.due <= now);
  due.sort((a, b) => a.entry!.due - b.entry!.due || a.entry!.stage - b.entry!.stage);
  const different = due.find(item => skillKey(item.id, item.skill) !== current);
  return different ?? due[0];
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
