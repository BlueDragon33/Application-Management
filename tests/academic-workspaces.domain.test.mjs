import test from "node:test";
import assert from "node:assert/strict";
import { createThesisBackup, parseThesisBackup, validateThesisState, validIsoDay }
  from "../app/tools/thesis-planner/thesis-domain.mjs";
import { createCourseworkBackup, parseCourseworkBackup, validateCourseworkProjects, validCourseworkDay }
  from "../app/apps/coursework-workbench/coursework-domain.mjs";

const thesis = () => ({
  topic: "RAG với đối chứng", department: "ИУ-5", advisor: "",
  targetDate: "2028-06-21", problem: "", hypothesis: "", metrics: "", policy: "",
  steps: { scope: { progress: "evidence", evidence: "reviewed-topic.pdf", note: "" } }
});
const project = (id = "alpha") => ({
  id, title: "Исследование", subject: "Information systems", kind: "coursework",
  teacher: "", dueDate: "2027-03-22", requirements: "", notes: "",
  stages: { brief: { status: "evidence", evidence: "assignment-original.pdf" } }
});

test("thesis parser preserves legacy original P0 exports and roundtrips versioned backups", () => {
  const value = thesis();
  assert.deepEqual(parseThesisBackup(structuredClone(value)), value);
  assert.deepEqual(parseThesisBackup(createThesisBackup(value)), value);
  assert.equal(createThesisBackup(value).schema, "thesis-planner/v1");
  assert.equal(parseThesisBackup({ schema: "thesis-planner/v2", thesis: value }), null);
});

test("thesis rejects impossible dates, unknown milestones and fabricated done states", () => {
  const initial = thesis();
  for (const date of ["2027-02-29", "2027-13-01", "2027-04-31", "not-a-date"]) {
    assert.equal(validIsoDay(date), false);
    assert.equal(validateThesisState({ ...initial, targetDate: date }), null);
  }
  assert.equal(validIsoDay("2028-02-29"), true);
  assert.equal(validateThesisState({ ...initial, steps: { imaginary: {progress:"doing",evidence:"",note:""} } }), null);
  assert.equal(validateThesisState({ ...initial, steps: { scope: {progress:"evidence",evidence:" ",note:""} } }), null);
});

test("thesis normalizer drops non-contract fields instead of importing accidental secrets", () => {
  const initial = { ...thesis(), secretToken: "do-not-copy" };
  const normalized = validateThesisState(initial);
  assert.ok(normalized);
  assert.equal(Object.hasOwn(normalized, "secretToken"), false);
});

test("coursework validates multiple distinct assignments and versioned recovery", () => {
  const all = [project("one"), project("two")];
  assert.deepEqual(validateCourseworkProjects(all), all);
  assert.deepEqual(parseCourseworkBackup(createCourseworkBackup(all)), all);
  assert.equal(parseCourseworkBackup({ schema: "coursework-workbench/v2", projects: all }), null);
});

test("coursework blocks duplicate IDs, invalid semester deadline, unsupported assignment and missing evidence", () => {
  const p = project();
  assert.equal(validateCourseworkProjects([p,p]), null);
  assert.equal(validateCourseworkProjects([{...p,dueDate:"2027-02-29"}]), null);
  assert.equal(validCourseworkDay("2028-02-29"),true);
  assert.equal(validCourseworkDay("2028-02-30"),false);
  assert.equal(validateCourseworkProjects([{...p,kind:"remote-client"}]),null);
  assert.equal(validateCourseworkProjects([{...p,stages:{brief:{status:"evidence",evidence:""}}}]),null);
  assert.equal(validateCourseworkProjects([{...p,stages:{unexpected:{status:"doing",evidence:""}}}]),null);
  assert.equal(validateCourseworkProjects([{...p,id:"not a valid id"}]), null);
  assert.equal(validateCourseworkProjects([{...p,title:"X".repeat(301)}]), null);
  assert.ok(validateCourseworkProjects([{...p,title:"",subject:""}])); // In-progress edit does not corrupt storage.
  assert.equal(validateCourseworkProjects(Array.from({length:101},(_,i)=>project(String(i)))), null);
});

test("import validation preserves no original object identity (defensive normalization)", () => {
  const item = project();
  const list = validateCourseworkProjects([item]);
  assert.ok(list);
  assert.notStrictEqual(list[0],item);
  assert.notStrictEqual(list[0].stages,item.stages);
  const parsed = validateThesisState(thesis());
  assert.ok(parsed && parsed.steps.scope);
  assert.notStrictEqual(parsed.steps,thesis().steps);
});
