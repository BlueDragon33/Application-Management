import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const root = new URL("../app/tools/study-plan/", import.meta.url);
const moduleSource = readFileSync(new URL("study-plan-survival-data.ts", root), "utf8");
const {outputText, diagnostics} = ts.transpileModule(moduleSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  reportDiagnostics: true,
});
assert.equal(diagnostics?.length ?? 0, 0, "survival module transpiles");
const survival = await import("data:text/javascript;base64," + Buffer.from(outputText).toString("base64"));
const uiSource = readFileSync(new URL("study-plan.tsx", root), "utf8");
const dataSource = readFileSync(new URL("study-plan-data.ts", root), "utf8");

test("24 weeks are complete, ordered and link to real IU5 course IDs", () => {
  const weeks = survival.survivalWeeks;
  assert.equal(weeks.length, 24);
  assert.deepEqual(weeks.map(w => w.number), Array.from({length: 24}, (_, i) => i+1));
  assert.equal(new Set(weeks.map(w => w.id)).size, 24);
  const phases = ["python", "oop", "database", "data", "ml", "integration"];
  for(const phase of phases){
    assert.equal(weeks.filter(w => w.phase === phase).length, 4);
  }
  const ids = new Set([...dataSource.matchAll(/\bid:\s*"([^"]+)"/g)].map(m => m[1]));
  for (const week of weeks) {
    assert.ok(week.title.vi && week.title.en && week.exercise.vi && week.exercise.en);
    assert.ok(week.checkpoint.vi && week.checkpoint.en && week.artifact.vi && week.artifact.en);
    assert.ok(week.russianTerms.length > 0);
    assert.ok(week.recommendedHours >= 1);
    assert.ok(week.targetCourseIds.length > 0);
    for (const id of week.targetCourseIds) assert.ok(ids.has(id), week.id + " invalid course " + id);
  }
});
test("v2 defaults preserve legacy compact mode without completion or manufactured mastery", () => {
  const state = survival.defaultSurvivalState();
  assert.equal(state.variant, "compact12");
  assert.equal(state.version, 2);
  assert.deepEqual(state.exerciseDone, {});
  assert.deepEqual(state.evidence, {});
  assert.equal(survival.weekEvidenceSummary(state).verified, 0);
  assert.notEqual(survival.survivalStorageKey, "application-management:study-plan-progress:v1");
  assert.match(uiSource, /application-management:study-plan-progress:v1/);
});
test("malformed progress and unsupported verified evidence cannot pass", () => {
  const empty = survival.parseSurvivalState("{bad json");
  assert.deepEqual(empty, survival.defaultSurvivalState());
  const valid = survival.survivalWeeks[0].id;
  const dirty = JSON.stringify({
    version: 2,
    variant: "standard24",
    selectedWeek: 999,
    availableHoursPerWeek: 9999,
    exerciseDone: {[valid]: true, arbitrary: true},
    evidence: {[valid]: {state: "VERIFIED", note: "fake"}, arbitrary: {state: "submitted", note:"fake"}},
  });
  const clean = survival.parseSurvivalState(dirty);
  assert.equal(clean.selectedWeek, 24);
  assert.equal(clean.availableHoursPerWeek, 40);
  assert.deepEqual(clean.exerciseDone, {[valid]: true});
  assert.deepEqual(clean.evidence, {});
  assert.equal(survival.weekEvidenceSummary(clean).verified, 0);
});
test("evidence submission is separate from practice and does not award mastery", () => {
  const valid = survival.survivalWeeks[3].id;
  const progress = survival.parseSurvivalState(JSON.stringify({
    version: 2, variant: "standard24", selectedWeek: 4, availableHoursPerWeek: 8,
    exerciseDone: {[valid]: true},
    evidence: {[valid]: {state: "submitted", note:"Test log attached"}},
  }));
  assert.equal(survival.weekEvidenceSummary(progress).practiced, 1);
  assert.equal(survival.weekEvidenceSummary(progress).evidenceSubmitted, 1);
  assert.equal(survival.weekEvidenceSummary(progress).verified, 0);
  assert.ok(!Object.values(progress.evidence).some(e => e.state === "verified"));
});
test("planner keeps official counts separate and UI supports both roadmap modes", () => {
  assert.match(dataSource, /weeks: 17, credits: 30, weeklyLoad: 51\.4, weeklyContact: 18, coursework: 3, exams: 4/);
  assert.match(dataSource, /weeks: 11, credits: 30, weeklyLoad: 54, weeklyContact: 10, coursework: 1, exams: 3/);
  assert.match(dataSource, /\|\s*"rating-exam"/);
  assert.match(dataSource, /id: "ml",[\s\S]*?assessment: "rating-exam"/);
  assert.match(uiSource, /StandardSurvivalRoadmap/);
  assert.match(uiSource, /compact12/);
  assert.match(uiSource, /standard24/);
  assert.match(uiSource, /survivalOwner !== user.email/);
  assert.match(uiSource, /No authorized external assessor/);
});


test("composite coursework and examination remain distinct personal tasks", () => {
  assert.deepEqual(survival.courseAssessmentParts({id:"oop", assessment:"exam-coursework"}), ["exam", "coursework"]);
  assert.deepEqual(survival.courseAssessmentParts({id:"analytical-models", assessment:"credit-coursework"}), ["credit", "coursework"]);
  assert.deepEqual(survival.courseAssessmentParts({id:"ml", assessment:"rating-exam"}), ["rating-exam"]);
  assert.deepEqual(survival.courseAssessmentParts({id:"nir-1", assessment:"graded-credit"}), ["graded-credit"]);
  assert.deepEqual(survival.courseAssessmentParts({id:"thesis", assessment:"defense"}), ["defense"]);
  assert.deepEqual(survival.courseAssessmentParts({id:"unknown", assessment:"none"}), []);
});

test("dates remain user-entered and collisions ignore completed or empty tasks", () => {
  const plans = {
    "oop:exam": {dueDate:"2027-12-10", status:"planned",note:""},
    "oop:coursework": {dueDate:"2027-12-10", status:"working",note:""},
    "ml:rating-exam": {dueDate:"2027-12-12", status:"planned",note:""},
    "thesis:defense": {dueDate:"2027-12-10", status:"self_done",note:""},
  };
  assert.deepEqual(survival.personalDeadlineCollisions(plans), ["2027-12-10"]);
  assert.deepEqual(survival.personalDeadlineCollisions({}), []);
  const parsed = survival.parseSurvivalState(JSON.stringify({...survival.defaultSurvivalState(),assessmentPlans:plans}));
  assert.equal(parsed.assessmentPlans["oop:exam"].dueDate,"2027-12-10");
  assert.equal(parsed.assessmentPlans["thesis:defense"].status,"self_done");
  assert.equal(parsed.assessmentPlans["thesis:defense"].note,"");
  assert.match(uiSource,/PersonalAssessmentPlanner/);
  assert.match(uiSource,/user supplied, not an official Bauman timetable/);
});


test("cross-phase recommendations report missing evidence, never failure or confirmed mastery", () => {
  const defaultState = survival.defaultSurvivalState();
  assert.deepEqual(survival.prerequisiteEvidenceGaps("oop", defaultState), ["python"]);
  assert.deepEqual(survival.prerequisiteEvidenceGaps("integration", defaultState), ["oop","database","ml"]);
  const phaseEnd = survival.survivalWeeks.find(w => w.number === 4);
  const withEvidence = survival.parseSurvivalState(JSON.stringify({
    ...defaultState,
    evidence: {[phaseEnd.id]: {state:"submitted",note:"Python test record"}},
  }));
  assert.deepEqual(survival.prerequisiteEvidenceGaps("oop", withEvidence), []);
  assert.equal(survival.weekEvidenceSummary(withEvidence).verified, 0);
});
