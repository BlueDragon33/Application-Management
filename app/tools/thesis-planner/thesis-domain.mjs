// Thesis Planner domain policy. No browser APIs, remote I/O or shared academic core.
// Keep the parser independent so its recovery/evidence invariants run under Node.
export const THESIS_BACKUP_SCHEMA = "thesis-planner/v1";
const freeText = ["problem", "hypothesis", "metrics", "policy"];
const shortText = ["topic", "department", "advisor", "targetDate"];
const milestoneIds = new Set(["scope", "sources", "question", "method", "data", "prototype", "experiments", "analysis", "novelty", "writing", "normcontrol", "defense"]);
const statuses = new Set(["todo", "doing", "evidence"]);
const record = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const isString = (x, max) => typeof x === "string" && x.length <= max;
export function validIsoDay(value) {
  if (value === "") return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + "T00:00:00.000Z");
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
export function validateThesisState(value) {
  if (!record(value) || !record(value.steps)) return null;
  for (const name of shortText) if (!isString(value[name], 300)) return null;
  for (const name of freeText) if (!isString(value[name], 12000)) return null;
  if (!validIsoDay(value.targetDate)) return null;
  if (Object.keys(value.steps).some((key) => !milestoneIds.has(key))) return null;
  const steps = {};
  for (const id of milestoneIds) {
    const stage = value.steps[id];
    if (stage === undefined) continue;
    if (!record(stage) || !statuses.has(stage.progress) || !isString(stage.evidence, 8000) || !isString(stage.note, 8000)) return null;
    if (stage.progress === "evidence" && !stage.evidence.trim()) return null;
    steps[id] = { progress: stage.progress, evidence: stage.evidence, note: stage.note };
  }
  return { topic: value.topic, department: value.department, advisor: value.advisor,
    targetDate: value.targetDate, problem: value.problem, hypothesis: value.hypothesis,
    metrics: value.metrics, policy: value.policy, steps };
}
export function createThesisBackup(value) {
  const normalized = validateThesisState(value);
  if (!normalized) throw new Error("Invalid thesis state");
  return { schema: THESIS_BACKUP_SCHEMA, thesis: normalized };
}
export function parseThesisBackup(value) {
  // The original P0 export was a plain state. Accept it for lossless recovery.
  if (record(value) && value.schema === THESIS_BACKUP_SCHEMA) return validateThesisState(value.thesis);
  if (record(value) && typeof value.schema === "string") return null; // Unknown future schema: fail closed.
  return validateThesisState(value);
}
