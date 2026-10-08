# STUDY PLAN TOOL — IU5 SURVIVAL / PRE-MASTER INTEGRATION
## Canonical expansion prompt · Audit-first · Evidence-first · No duplicate learning platform

**Owner repository:** BlueDragon33/Application-Management
**Target app:** Phân tích lịch học Bauman (Tool · Bauman Hub)
**Actual runtime owner:** app/tools/study-plan/
**Route:** /tools/study-plan
**Target academic plan:** BMSTU IU5, 09.04.01/11, start year 2026, full-time Master's
**This prompt is for the Study Plan Tool only. It is NOT a task to rebuild BlueDragon33/Bauman-master-ai-system.**
**State:** IMPLEMENTATION SPECIFICATION — NOT AN IMPLEMENTATION/PASS CLAIM

## 0. Mission and boundaries

Enhance the **existing** Bauman Study Plan Analyzer into an honest, useful IU5 Survival / Pre-Master preparation and academic-risk-management tool. Preserve its present analytical UI, bilingual vi/en, program explorer, semester/week/month/year projections, export/print, source labels, 12-week preparation roadmap, Bauman subject-manifest links and current user data.

Deliver two planning modes and one coherent progression model:
1. **12-week compact** — preserve the currently implemented roadmap and user checkboxes.
2. **24-week standard** — a deeper weekly foundation plan with verifiable practical checkpoints.
3. **4-semester official-plan support** — 17/17/17/11 teaching weeks (62 teaching weeks), plus distinct sessions/exams/practice/research/holidays **only where documented**. The phrase “86 weeks” means 24 preparation planning weeks + 62 semester teaching weeks, NOT 86 continuous calendar weeks or official university scheduling.

Prioritize a real user's need: identify which foundation skill is missing, which official subjects it affects, what to study next, and whether there is reproducible evidence of competence. **Do not label users “likely to fail” without meaningful evidence; risk flags are workload/action priorities, not grade or failure predictions.**

### Ownership

- **Study Plan Tool** owns visualization, imported official-plan projection, user-defined planning, survival checklists, evidence references, self-reported availability, and guidance. It is not the canonical Bauman subject-learning engine.
- **Bauman Hub** owns its own subject manifests, academic material, quizzes/runtime, module progression and research content. Do not duplicate its engines, registries or teaching datasets.
- **Application Management** remains the control-plane host; don't turn Study Plan into a second control plane or access private subject data.
- Respect Bauman contract and manifest detection in app/tools/study-plan/bauman-module-registry.ts. Fail closed if registry or direct-launch capability is unavailable.
- No mandatory paid AI API, scraping service, paid automation, central learner database, or cross-app secret sharing.
- Keep the existing auth gate at /tools/study-plan.

## 1. Required forensic baseline BEFORE ANY runtime changes

Get current main HEAD and relevant diff; do not assume this prompt's inspection remains current. Read only:
- app/tools/study-plan/page.tsx
- app/tools/study-plan/study-plan.tsx
- app/tools/study-plan/study-plan-data.ts
- app/tools/study-plan/bauman-module-registry.ts
- app/tools/study-plan/study-plan.module.css
- adjacent route/data tests and app integration registry
- .blueprint/constitution-adoption.json, dependency budget and directly relevant shared policies.

Review actual app UI/browser behavior when available. Classify every proposed behavior **KEEP / EXTEND / CONNECT / FIX / ADD / DEFER**. Distinguish “defined in TS” from “passed browser E2E”. Do not scan Bauman subject internals or all Application Management features by default.

### Baseline known from inspected source on 2026-10-08 (reverify latest HEAD)
- Route exists and renders StudyPlanTool with Auth + Bauman registry.
- Four views week/month/semester/year are present; week/month are *derived workload allocation*, not official day/period timetables.
- Course explorer, six skill clusters, Russian/VI/EN names and assessment labels exist.
- Official-style IU5 aggregates 120 credits, 4,320 academic hours; semesters 17/17/17/11 weeks, exam counts 4/4/3/3, coursework counts 3/1/2/1.
- An existing **12-week / seven-phase** preBaumanRoadmap exists with tasks, checkpoints and targetCourseIds.
- Existing completed checkboxes use localStorage key application-management:study-plan-progress:v1, and font preferences use a separate key.
- readinessByCourse is currently a static authored green/yellow/red mapping, NOT the result of validated learner diagnostic assessment; do not call it personal mastery.
- Bauman module coverage comes from control/application-management.contract.json and subject-manifest.json, subject to explicit direct-launch policy.
- Current Assessment union has exam, credit, graded-credit, coursework, exam-coursework, credit-coursework, defense; audit whether it loses official РЭкз and other composite semantics.
- Current tool uses user-friendly vi/en localization. Keep both languages in new UI.
- Export PDF currently uses browser print; preserve behavior instead of creating an unnecessary separate PDF renderer.
- Check browser storage/user scoping: old local progress is device/browser-local and not reliable cross-device or official assessment evidence.

Output a succinct inventory with *feature, existing owner/path, implementation truth, gaps, plan, test*. Stop conflicting work with another in-flight package when the same files/authority would be touched.

## 2. Academic-source integrity and assessment language

Official source is user-supplied Учебный план IU5, code 09.04.01/11, start year 2026. The repository's existing normalized course data must be **reconciled against the original PDF** before making corrections. If PDF bytes are not available to this execution session, retain existing figures as provisional and clearly list source-reverification blocker; never invent what the source says.

Expected primary totals to verify:
- two years, four terms, 30 core credits each, 120 total, 4,320 academic hours;
- teaching weeks 17 / 17 / 17 / 11;
- exams 4 / 4 / 3 / 3, 14 total;
- Курсовая работа counts 3 / 1 / 2 / 1, 7 total;
- research/practice and 9-credit ВКР in appropriate semesters;
- optional facultative courses EXCLUDED from core 120 credits;
- multi-term foreign language, software engineering, НИР and practice offerings must not be doubled without proper academic-unit/term distinction.

Preserve distinct official codes and Vietnamese explanations:
- Экз — final examination, graded;
- РЭкз — rating-form examination; exact local grading semantics require regulation verification, never silently flatten its source code to plain Экз;
- Зчт — pass/fail credit;
- ДЗчт — differentiated/graded credit;
- КуР — independent coursework / term paper, frequently a separate submission/defense assessment;
- КуП — course project;
- НИР — research activity;
- ГЭК — state final assessment commission / thesis defense.

Represent **Зчт + КуР** and **Экз + КуР** as multi-part assessments. Mark official code, explanation, graded/pass-fail distinction, independent deliverables, and optional time/deadline placeholders separately.

Do not infer an official examination calendar, room, instructor, deadline, marking rubric or exact course syllabus from the two-page study plan. “Иностранный язык” means Foreign Language; a separate Russian-technical-learning track is not an official substitution.

### Academic-semester mapping

S1 priority: Foreign Language; Methodology; Analytical Models (Зчт + КуР); Multivariate Data Analysis (Экз + КуР); Object-Oriented Design (Экз + КуР); Database Optimization (Экз); Software Development Technologies, term-1 (Экз); research as listed in the PDF.

S2 priority: Machine Learning (РЭкз); Reliability Models (Экз); Post-relational Databases (Экз); Neural Network Systems (Экз); Software Development coursework continuation (КуР); associated practice/NIR.

S3 priority: Time Series (Экз); AI in Business Analytics (Экз); Information Systems Design Management (Зчт); Data Processing/Analysis-specific НИР with coursework; Ergonomics/HCI (Экз + КуР); first elective, other practice/NIR.

S4 priority: Mivar Logical AI (Экз + КуР); lifecycle process course (Экз); second elective (Экз); NIR, prediploma practice, thesis (ГЭК).

All placements, credits, totals and assessment codes MUST be validated against actual canonical course data/PDF. Descriptive subject-preparation advice is **pedagogical guidance**, not official prerequisite policy or syllabus.

## 3. Standard 24-week pre-master plan (additive, data-driven)

**Retain the existing 12-week compact plan** with stable task IDs and saved checkboxes; never replace it blindly with 24-week data. Introduce an explicit user-selected plan variant (compact12 / standard24), with stable versioned IDs and a migration strategy for prior v1 progress. If mapping cannot be proven, keep old entries intact rather than marking new tasks completed.

Suggested standard phases:
- W01–04: Python foundations; functions, collections, files, exceptions, packages, JSON/CSV, unit tests and basic Git.
- W05–08: object orientation; abstraction, classes, composition, inheritance, interfaces, modular design, tests.
- W09–12: SQL/PostgreSQL; keys, JOIN, GROUP BY, CTE, normalization, indexing, transactions and EXPLAIN.
- W13–16: mathematics and data; vectors, matrices, probability/statistics, NumPy, Pandas, plotting, EDA and dimensionality reduction.
- W17–20: ML foundations; train/validation/test, regression, classification, clustering, baseline models, metrics, leakage and error analysis.
- W21–24: integration, Linux/Git research practices, academic reporting, Russian technical terminology and mock coursework defense.

Every week must have structured:
- learning objectives (VI/EN), suggested technical Russian words where needed;
- prerequisites (stable competency IDs);
- expected effort and user-configurable real hours;
- required tasks plus optional enrichment;
- real practice exercise or project artifact;
- measurable checkpoint with assessment method, grading rubric or pass conditions;
- evidence type (test result, reproducible program, SQL output, notebook, report, presentation), evidence status/provenance;
- links to existing Bauman subject-module capabilities only where manifest/API explicitly permits;
- impacted IU5 semester and course IDs;
- suggested remediation after failed checkpoint.

Never claim “mastered” after a checkbox, playback, reading, AI-generated score or completion percentage alone. Avoid artificially fixed passing thresholds presented as Bauman policy. Self-study gate thresholds must be marked as learner-plan recommendations.

### Resource allocation

Allow 1h/day, 2h/day, 3h/day, and custom availability; accommodate a low-intensity maintenance mode for Russian preparatory study. Planner must respect user-entered dates, time zones, non-study days and actual available hours; no hard-coded presumed Bauman start clock/date. Reduce scope before silently exceeding the user's availability.

If 24 weeks cannot fit before official study, expose prioritized core weeks, sustainable compressed/extended options, and realistic unresolved prerequisites; never auto-certify all 24 weeks.

## 4. True entry assessment and learner evidence

Build upon existing checklist/readiness labels with a **separate diagnostic evidence model**; do not simply recolor hard-coded readinessByCourse.

Test domains: Python, OOP, SQL/DB, linear algebra, probability and statistics, data handling, ML basics, technical Russian reading/defense.

Prefer capability-based practical tasks over multiple-choice-only scoring:
- Python function/script, explanation, tests and debugging;
- OOP structure with at least one independent modification;
- SQL joins, grouping, index plan under a local/sample dataset;
- numerical/statistical interpretation with reasoning;
- reproducible ML train/evaluate pipeline with contamination checks;
- short Russian subject explanation as self-practice or reviewed evidence.

Mark evidence status explicitly: NOT_ASSESSED / SELF_REPORTED / SUBMITTED / VERIFIED / NEEDS_REVIEW / STALE. Separate:
(1) task completion, (2) assessed performance, (3) subject mastery, (4) study-plan readiness.
A module unavailable for trustworthy execution must show UNAVAILABLE, not fabricated success.

Require deterministic fixtures where possible, no hidden paid API; AI assistance cannot issue canonical mastery or official grades.

## 5. Cross-course prerequisite and “domino gap” analysis

Re-use existing course IDs, preparation targetCourseIds, readinessByCourse as labeled recommendations, and any openly published Bauman competencies; do not read private subject storage or fork another mastery engine.

Build a versioned projection graph with typed edges:
- official prerequisite (only when supported by a source);
- recommended pedagogical prerequisite (authored analysis);
- useful supporting competency (informational only).

Examples to validate:
- Python → OOP → Software Engineering;
- SQL → Database Optimization → Post-relational Databases → possible Big Data elective;
- Linear Algebra + Statistics + Python → Multivariate Analysis → ML → Neural Networks;
- Probability/Statistics + Python → Time Series;
- basic research practice → NIR → thesis preparation.

On an actual diagnostic gap, show affected courses and actionable next lesson/practice; do not assert certain examination failure. Preserve unknown and missing evidence as separate from fail.

## 6. Study-plan scheduler and assessment survival

Extend the Tool's existing schedule views; do not create a second canonical timetable or alter unrelated Application Management workflows.

Distinct date provenance:
- OFFICIAL_VERIFIED (source and date recorded);
- USER_ENTERED (manual expected timetable/deadline);
- SUGGESTED_PERSONAL (recommended planning checkpoint);
- UNKNOWN.

The original program PDF is a curriculum, NOT exact lecture/room/time timetable. Derived week/month views cannot be marketed as official schedules.

Track independent activities:
- theoretical review, practical exercises;
- preparation for Экз/РЭкз;
- Зчт/ДЗчт practice and reporting;
- КуР and КуП milestones;
- research, internships, NIR, ВКР.

Coursework stages:
assignment captured → requirements → bibliography → outline/design → implementation → verification/results → written report → mock defense → submitted → assessed.
Only mark officially assessed when user supplies result or authoritative evidence.

With four exams and three courseworks in S1, show conflicts, competing deadlines, preparation dependencies and available hours; schedule revision must preserve logs/evidence and prevent duplicate writes.

Suggested risk alerts are priority to intervene, not predicted academic outcomes:
- prerequisite gap with evidence;
- repeated failed diagnostics;
- conflicting deadlines or overloaded plan;
- abandoned coursework milestones;
- examination near a confirmed date with no preparation evidence.
States: NORMAL / ACTION_NEEDED / URGENT / INSUFFICIENT_DATA.
No invented official exam date or course grade.

## 7. One cumulative integration project

Use a safe civilian engineering simulation:
simulated sensor measurements → Python/OOP ingestion → relational storage → cleaning/visualization → baseline ML → report/defense.
Reuse existing Bauman learning modules through a declared, approved public contract. The Tool may own project planning, checkpoints and references but not duplicate Python/SQL/ML execution kernels.

Suggested deliverables evolve progressively:
W04 CLI/CSV script;
W08 modular OOP implementation + tests;
W12 relational schema + reproducible queries;
W16 EDA notebook + mathematical notes;
W20 baseline ML model + metric/error analysis;
W24 README, 2–4-page report, Russian glossary and 5–7-minute mock defense.

This is personal practice; never label it as an officially approved Bauman Курсовая, НИР or ВКР.

## 8. UI/UX integration INSIDE the existing Study Plan Tool

Do not add a Level-1 client, a new application card, or a sixth Hub section.
Keep the existing Study Plan Tool workspaces and Bauman Parent tag.

Existing workspaces: schedule, courses, skills, analysis, roadmap. Reuse them:
- **Roadmap:** 12-week compact / 24-week standard, current week, real gate/evidence status and impacted courses.
- **Schedule:** study availability, planning weeks, exams, homework and coursework milestone collisions; preserve current semester/week/month/year projections and print/PDF.
- **Courses:** assessment chips (original Russian + VI/EN explanation), accurate multipart Курсовая badges, prerequisites, personalized verified gaps and module coverage.
- **Skills:** static recommendations clearly separated from diagnostic evidence, cross-subject priority map.
- **Analysis:** semester workload, 14 exams / 7 Курсовая, 120-credit official structure and explicit what-is-official legend.

Keep calm, restrained UI and existing styles/components. Accessible focus/keyboard/touch; mobile responsive with no overflow, min touch targets where applicable. Avoid giant all-screen forms. Loading must terminate with result/error; disable/reconcile duplicate rapid clicks without losing user actions.

Labels should be VI-first and EN alternate; Russian academic source terms preserved. All numeric progress must be computed from honest evidence, not sample seed values.

## 9. Storage, migration, sync and security

Read the current storage contract. Existing progress key:
application-management:study-plan-progress:v1.
Do not reset, reuse ambiguously, or overwrite it during a new 24-week plan. Preserve 12-week original task-completion semantics as legacy. Introduce versioned, scoped storage for new plans, settings, evidence and journals; migrate by stable identity with backup/rollback and idempotence, ideally using approved browser-safe local persistence.

Do not call local device-only progress synchronized across devices. Do not leak exam evidence, files, personal profile or secret into central application registry. Export/import must keep plan variant, mapping version, learner evidence provenance and schedule source status. Optional Google Drive bridge is a backup only if user later enables it.

Subject modules must remain behind explicit public manifests/capabilities and direct-launch permission; unavailable means unavailable rather than an invented endpoint.

## 10. Engineering phases

A — Audit actual tool runtime, data and tests. Produce KEEP/EXTEND/CONNECT/FIX/ADD/DEFER inventory.
B — Reconcile academic source, assess assessment-code fidelity, truth/provenance, and ownership map.
C — Implement variant-aware roadmap data with safe 12→24 coexistence, week criteria, no evidence spoofing.
D — Implement deterministic diagnostics/evidence model and prerequisites projection, with accurate unknown states.
E — Integrate exams/coursework personal scheduling with the existing UI, source labels and conflict logic.
F — Integrate cumulative practice artifact, deep links only when Bauman contract allows.
G — UI/a11y/localization/responsive polish, migration, offline and export/restore behavior.
H — E2E regression, exact-HEAD evidence, PR and release proposal.

On every phase:
inspect → adapt smallest canonical owner → test → reproduce defects → fix root cause → rerun impacted tests → check user flow → record evidence/state.

Do not prematurely execute other project prompts, launch whole-platform rewrites, or claim PASS based on source inspection alone. Separate documentation-only prompt addition from runtime implementation state.

## 11. Acceptance criteria

1. Previous 12-week roadmap remains available, and existing saved checked items survive refresh/upgrade.
2. A new 24-week roadmap is actionable and accurately maps to official course/semester identifiers.
3. Existing week/month/semester/year, course search/filter, VI/EN, module registry, coverage and print still work.
4. Official totals validated: 120 / 4,320 / 17-17-17-11 / exam 4-4-3-3 / КуР 3-1-2-1.
5. Exact Экз, РЭкз, Зчт, ДЗчт, КуР, КуП and ГЭК semantics are preserved or transparently marked as source-verification blockers.
6. Checklist completion is not presented as mastery; diagnostics cannot fake scores.
7. Cross-course graph and gap recommendations are traceable and never declare student failure as fact.
8. Deadline/timetable provenance is clear; no university dates are invented.
9. Scheduler respects availability, handles rapid duplicate clicks, persists/reloads and warns about conflicts.
10. Local backup/export/restore and data migration do not corrupt existing progress.
11. Direct Bauman content opening follows contract/manifest and fail-closed status.
12. Language, mobile, keyboard, performance, offline handling and accessible design pass targeted browser tests.
13. Relevant existing Application Management security/control-plane and Bauman integration regression tests pass.
14. PR documents files, source-of-truth, migration, rollback, tests, head SHA, blockers and follow-up owners.
15. **No production publish/deployment unless separate explicit release authorization is provided.**

## 12. Required deliverables

- Audited inventory with exact source paths and runtime/evidence status.
- “Already exists vs extended vs genuinely added” report.
- Official academic mapping and list of unresolved/source-confirmation differences.
- 12-week compatibility + 24-week detailed weekly schema/content.
- Cross-domain prerequisite/evidence/risk model with source labels.
- Practical gate rubric and cumulative project milestones.
- Existing UI integration and test evidence.
- Data migration/backward compatibility/rollback documentation if storage changes.
- Changed paths, PR, CI results on exact head and production deployment status.
- Concise learner usage instructions in Vietnamese.

**Start with Phase A in app/tools/study-plan. Keep implementation scoped to this Tool in Application-Management; do not edit Bauman-master-ai-system or Application Management's unrelated control-plane features.**
