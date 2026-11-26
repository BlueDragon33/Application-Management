import { timeLessons } from "./content";
import { calendarForms } from "./calendar-content";
import { adaptiveTasks } from "./adaptive-content";
import { readMemory, skills, type MemoryEntry, type ReviewSkill } from "./memory";
import { practiceDirections, practiceKey, readTrainingProgress } from "./progress";

const kind = "RUSSIAN_TIME_TRAINER_HISTORY_V1";
const sourceContract = "dc0389e2466db6dc37661dec814c265e92d8d2d2";
const maxBytes = 256000;
const targets: readonly {id: string; skill: ReviewSkill}[] = [
  ...calendarForms.flatMap(f => (Object.keys(skills) as (keyof typeof skills)[]).map(skill => ({id: f.id, skill}))),
  ...adaptiveTasks.map(t => ({id: t.id, skill: t.skill})),
];
const keys = practiceDirections.flatMap(dir => timeLessons.flatMap(l => l.examples.map(e => practiceKey(dir, e.id))));
const allowed = (v: object, names: readonly string[]) => Object.keys(v).every(k => names.includes(k));
function invalid(): never { throw new Error("INVALID_LEGACY_HISTORY"); }

// An explicit, read-only snapshot of known keys belonging to the mounted authenticated trainer.
// Never enumerate localStorage, expose its prefix, or include session/account data.
export function createDisplayMasterHistory(storage: Pick<Storage, "getItem">, prefix: string) {
  if (!/^application-management:russian-time-trainer:v1:[^:]{1,512}:$/.test(prefix)) invalid();
  const snapshot = new Map<string, string | null>();
  const get = (suffix: string) => {
    const key = prefix + suffix;
    const value = storage.getItem(key);
    snapshot.set(key, value);
    return value;
  };
  const lesson = get("lesson");
  if (lesson !== null && !timeLessons.some(l => l.id === lesson)) invalid();
  for (const key of keys) {
    for (const flag of ["attempted:", "solved:"]) {
      const value = get(flag + key);
      if (value !== null && value !== "1") invalid();
    }
  }
  for (const t of targets) {
    const value = get("memory:v1:" + t.id + ":" + t.skill);
    if (value !== null && value.length > 4096) invalid();
  }
  const frozen = { getItem: (key: string) => {
    if (!snapshot.has(key)) return invalid();
    return snapshot.get(key) ?? null;
  }, setItem: () => { throw new Error("READ_ONLY_EXPORT"); } };
  const progress = readTrainingProgress(frozen, prefix);
  const validated = readMemory(frozen, prefix);
  const memory: {id: string; skill: ReviewSkill; entry: MemoryEntry}[] = [];
  for (const t of targets) {
    const key = t.id + ":" + t.skill;
    const raw = frozen.getItem(prefix + "memory:v1:" + key);
    if (raw === null) continue;
    const entry = validated[key];
    // readMemory ignores damaged records for runtime resilience; an export must not
    // silently discard them. Reject extra fields rather than export unknown data.
    if (!entry || !allowed(entry, ["stage", "due", "attempts", "evidence"])) invalid();
    const task = adaptiveTasks.find(a => a.id === t.id);
    if (task) {
      if (!entry.evidence || !allowed(entry.evidence, ["choice", "correct", "wrongAttempts", "lastWrongChoice", "audioSource", "selfRecall"])) invalid();
    } else if (entry.evidence !== undefined) invalid();
    memory.push({...t, entry});
  }
  // Detect changes while reading from another tab. This is a bounded readback,
  // not a claim that browser localStorage provides a transactional snapshot.
  for (const [key, value] of snapshot) if (storage.getItem(key) !== value) throw new Error("HISTORY_CHANGED_RETRY");
  const packet = {kind, sourceContract, ...progress, memory};
  if (new TextEncoder().encode(JSON.stringify(packet)).length > maxBytes) invalid();
  return packet;
}
