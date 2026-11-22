# Academic Workspaces P0 — Thesis Planner & Coursework Workbench

**Owner scope:** `BlueDragon33/Application-Management`, existing Cloudflare host only; no new origin, repository, provider, Worker, D1, credential, OAuth client or paid quota. **Branch:** `feat/academic-thesis-coursework-p0-20261108`. **Issue:** #382. **Status:** DRAFT / NO RELEASE.

## Product boundaries
| Product | Route | Kind | State ownership |
|---|---|---|---|
| Thesis Planner | `/tools/thesis-planner` | Control-plane academic tool | account-scoped localStorage, JSON backup |
| Coursework Workbench | `/apps/coursework-workbench` | independent academic app/workspace (same deploy, no remote client contract) | separate account-scoped localStorage, JSON backup |
| Study Plan | `/tools/study-plan` | existing curriculum analysis | unchanged |

Coursework is independent at **functional UI/data level**, not yet an independently deployed client. The launcher intentionally presents it as a local system tool until an actual client control contract exists. Neither route can claim server sync, external reference verification, scientific approval, live university data, or independent device registry. Existing `requireChatGPTUser` handles current authenticated/stadalone-dev access. No auth changes.

## Academic method & milestones
**Thesis (illustrative planning timeline, subject to кафедра/advisor):**
- Semester 1: topic, scope, verified references, question/hypothesis.
- Semester 2: experiment design, baseline, legal data use, prototype and tests.
- Semester 3: instrumented experiment, numerical comparison, reproducibility, scientific contribution.
- Semester 4: authored dissertation, citation audits, confirmed normcontrol/AI policy, rehearsal and defense.

**Coursework (per module):** original brief → scope/rubric → verified sources → model/algorithm → own implementation → tests/benchmark → written report → submitted evidence. Each coursework record stores subject, assignment kind (курсовая работа, курсовой проект, РГР, homework, НИР), due date, advisor, requirements, notes, stage and evidence references.

**Evidence gate:** A stage may be marked `evidence` only after a nonempty evidence reference is recorded. That means *recorded by user*, not independently verified or accepted by faculty. "Done" must never infer PASS, normcontrol or University approval.

**AI collaboration:** literature search aids and language review may be used **only to the extent permitted** by the actual course/department's rules. User-owned research, experiment, citations, code and results remain human-verified. AI consensus does not count as evidence. Do not extrapolate rules of a Bauman conference to a master's thesis without the relevant faculty policy.

## Storage & UX
- Thesis key: `application-management:thesis-planner:v1:<encoded-account-email>`.
- Coursework key: `application-management:coursework-workbench:v1:<encoded-account-email>`.
- Separate JSON backups; import schema validation; no file uploads, OCR or hidden AI provider calls.
- iPhone-first responsive layouts, compact summaries and one concrete Next Action per active workspace. Existing Study Plan route provides curricular context.
- The same account on a different browser/device has **no automatic sync**. Export/import a JSON backup before clearing storage, changing device or deploying migration.

## Staged next steps
- **P0 candidate:** secure route gate, launcher discovery, local drafts, milestone evidence, per-course project management, backup restore; TypeScript + lint/build + existing test suites before review.
- **P1 after owner acceptance:** verified bibliography records, customizable кафедра rubrics/semester plan, rubric templates, evidence repository metadata, weekly calendar export, restore validation, versioned backups. Avoid fake deadline push notifications.
- **P2:** experimental design/baselines, DOI/BibTeX/Zotero interchange, reviewer comments, plagiarism-caution workflow, reproducibility manifest, Word export using approved university template, local migration proof. Add only after checking library/source policies.
- **P3 CORE — explicitly deferred:** jointly define portable academic domain contract **after** real Thesis + Coursework workflows and backup records have passed owner acceptance. Extract common schema, state transitions, reference model and migration adapters; do not prematurely build a core.

## Release / human gates
1. Check React/TSX: `npm ci`, `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, targeted tests. Record exact SHA, logs and failures. No source-only claim of QA PASS.
2. Preview route + local smoke checks: ensure auth boundary, project isolation, persistence across reload, corrupt import rejection, iPhone safe-area/keyboard, accessible navigation, no cross-account leakage. Use actual devices/Browser where available.
3. Review with owner: academic interpretation, Russian terminology and rubric templates; no false status.
4. Only after required Blueprint OS reviews, approve merge. Production deployment is a separate explicit human release gate with real authenticated readback; neither this plan nor PR authorizes it.
