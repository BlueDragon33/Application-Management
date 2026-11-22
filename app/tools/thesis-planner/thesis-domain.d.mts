export type ThesisProgress = "todo" | "doing" | "evidence";
export type ThesisStep = { progress: ThesisProgress; evidence: string; note: string };
export type ThesisState = {
  topic: string; department: string; advisor: string; targetDate: string;
  problem: string; hypothesis: string; metrics: string; policy: string;
  steps: Record<string, ThesisStep>;
};
export const THESIS_BACKUP_SCHEMA: "thesis-planner/v1";
export function validIsoDay(value: unknown): boolean;
export function validateThesisState(value: unknown): ThesisState | null;
export function createThesisBackup(value: unknown): { schema: "thesis-planner/v1"; thesis: ThesisState };
export function parseThesisBackup(value: unknown): ThesisState | null;
