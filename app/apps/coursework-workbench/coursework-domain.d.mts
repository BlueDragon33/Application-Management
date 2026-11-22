export type CourseworkStatus = "todo" | "doing" | "evidence";
export type CourseworkStage = { status: CourseworkStatus; evidence: string };
export type Coursework = {
  id: string; title: string; subject: string; kind: string; teacher: string;
  dueDate: string; requirements: string; notes: string; stages: Record<string, CourseworkStage>;
};
export const COURSEWORK_BACKUP_SCHEMA: "coursework-workbench/v1";
export function validCourseworkDay(value: unknown): boolean;
export function daysUntilDeadline(iso: string, today?: Date): number | null;
export function validateCourseworkProjects(value: unknown): Coursework[] | null;
export function createCourseworkBackup(value: unknown): { schema: "coursework-workbench/v1"; projects: Coursework[] };
export function parseCourseworkBackup(value: unknown): Coursework[] | null;
