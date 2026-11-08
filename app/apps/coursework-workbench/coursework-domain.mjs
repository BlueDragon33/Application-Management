// Coursework domain contract: isolated from Thesis Planner until an approved core migration.
export const COURSEWORK_BACKUP_SCHEMA = "coursework-workbench/v1";
const workTypes = new Set(["coursework", "course-project", "rgr", "homework", "research"]);
const statuses = new Set(["todo", "doing", "evidence"]);
const stages = new Set(["brief", "scope", "references", "design", "implementation", "tests", "report", "submit"]);
const record = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const isString = (x, max) => typeof x === "string" && x.length <= max;
export function validCourseworkDay(value) {
  if (value === "") return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + "T00:00:00.000Z");
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0,10) === value;
}
// Compare civil dates rather than 23:59 timestamps; remains correct across DST.
export function daysUntilDeadline(iso, today = new Date()) {
  if (!iso || !validCourseworkDay(iso) || !(today instanceof Date) || Number.isNaN(today.getTime())) return null;
  const [year, month, day] = iso.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day);
  const current = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target - current) / 86_400_000);
}
export function validateCourseworkProjects(value) {
  if (!Array.isArray(value) || value.length > 100) return null;
  const result = [], ids = new Set();
  for (const item of value) {
    if (!record(item) || !record(item.stages) || !isString(item.id, 100) || !/^[\w-]{1,100}$/.test(item.id) || ids.has(item.id)) return null;
    // A blank title/subject can be a transient draft while the user edits an existing task.
    if (!isString(item.title, 300) || !isString(item.subject, 300)) return null;
    if (!workTypes.has(item.kind) || !isString(item.teacher, 300) || !isString(item.dueDate, 10) || !validCourseworkDay(item.dueDate)) return null;
    if (!isString(item.requirements, 12000) || !isString(item.notes, 12000)) return null;
    if (Object.keys(item.stages).some((key) => !stages.has(key))) return null;
    ids.add(item.id);
    const savedStages = {};
    for (const id of stages) {
      const stage = item.stages[id];
      if (stage === undefined) continue;
      if (!record(stage) || !statuses.has(stage.status) || !isString(stage.evidence, 8000) || (stage.status === "evidence" && !stage.evidence.trim())) return null;
      savedStages[id] = { status: stage.status, evidence: stage.evidence };
    }
    result.push({ id: item.id, title: item.title, subject: item.subject,
      kind: item.kind, teacher: item.teacher, dueDate: item.dueDate,
      requirements: item.requirements, notes: item.notes, stages: savedStages });
  }
  return result;
}
export function createCourseworkBackup(projects) {
  const validated = validateCourseworkProjects(projects);
  if (!validated) throw new Error("Invalid coursework data");
  return { schema: COURSEWORK_BACKUP_SCHEMA, projects: validated };
}
export function parseCourseworkBackup(value) {
  if (!record(value) || value.schema !== COURSEWORK_BACKUP_SCHEMA) return null;
  return validateCourseworkProjects(value.projects);
}
