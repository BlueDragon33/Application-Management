import { timeLessons } from "./content";

export const practiceDirections = ["en-ru", "ru-en"] as const;
export type PracticeDirection = typeof practiceDirections[number];

export function practiceKey(direction: PracticeDirection, exampleId: string) {
  return direction + "/" + exampleId;
}

const practiceKeys = practiceDirections.flatMap(direction =>
  timeLessons.flatMap(lesson => lesson.examples.map(example => practiceKey(direction, example.id))),
);
export const exerciseCount = practiceKeys.length;

type TrainingStorage = Pick<Storage, "getItem" | "setItem">;
export type TrainingProgress = { lessonId: string | null; attempted: string[]; solved: string[] };
export const emptyProgress: TrainingProgress = { lessonId: null, attempted: [], solved: [] };

export function trainerStoragePrefix(userId: string) {
  return "application-management:russian-time-trainer:v1:" + encodeURIComponent(userId) + ":";
}

export function readTrainingProgress(storage: TrainingStorage, prefix: string): TrainingProgress {
  const lessonId = storage.getItem(prefix + "lesson");
  const solved = practiceKeys.filter(key => storage.getItem(prefix + "solved:" + key) === "1");
  const attempted = practiceKeys.filter(key => solved.includes(key) || storage.getItem(prefix + "attempted:" + key) === "1");
  return { lessonId: timeLessons.some(lesson => lesson.id === lessonId) ? lessonId : null, attempted, solved };
}

export function recordTrainingAnswer(storage: TrainingStorage, prefix: string, key: string, correct: boolean) {
  if (!practiceKeys.includes(key)) return;
  storage.setItem(prefix + "attempted:" + key, "1");
  // A later incorrect attempt cannot erase a correct answer from another tab.
  if (correct) storage.setItem(prefix + "solved:" + key, "1");
}
