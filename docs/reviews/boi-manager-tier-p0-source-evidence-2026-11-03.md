# Blueprint OS 1.3.0 — P0 Manager-tier source-only reviewer packet
Date: 2026-11-03. Evidence class: GitHub SOURCE ONLY (read inspection), not QA execution or approval.

## Governance / authority
- **REVIEW_BLOCKED; CI_PENDING; global D1 10/10 BLOCKED.** No approval, merge, ratification, publish, Production, GitHub-hosted Actions, CMD, Work/Codex or rerun of a previously PASS pilot.
- Candidate under review: Application-Management `candidate/boi-manager-tier-20261102` at immutable source SHA **be52b0b202276962e54f807a0d70cd94d9de761a**. BOIECH_AI `candidate/manager-tier-device-approval-20261102` at immutable source SHA **5f0be9e053d92644c96b66af9cee2742ae6087b0**.
- These two candidate branches have **no matching open GitHub pull requests** at packet preparation. Do not label either candidate PR “Draft PASS”; any later PR must be Draft and comply with separate authorization.
- Packet is authored on the App-Manager candidate as review documentation only. Reviewer remains independent; this packet neither selects a reviewer nor submits review.

## Evidence links, immutable source
1. Owner UI render gate: https://github.com/BlueDragon33/Application-Management/blob/be52b0b202276962e54f807a0d70cd94d9de761a/app/management-dashboard-v2.tsx#L1323-L1326
2. Owner UI response validation and operation with lock/reload: https://github.com/BlueDragon33/Application-Management/blob/be52b0b202276962e54f807a0d70cd94d9de761a/app/boi-manager-tier-view.tsx#L15-L84 and controls https://github.com/BlueDragon33/Application-Management/blob/be52b0b202276962e54f807a0d70cd94d9de761a/app/boi-manager-tier-view.tsx#L115-L125
3. App-Manager signed/admin API call and session: https://github.com/BlueDragon33/Application-Management/blob/be52b0b202276962e54f807a0d70cd94d9de761a/app/admin-device-client.ts#L391-L409 and https://github.com/BlueDragon33/Application-Management/blob/be52b0b202276962e54f807a0d70cd94d9de761a/app/admin-device-client.ts#L491-L505
4. App-Manager Owner server gate, bridge, list, CAS, approval and post-write read: https://github.com/BlueDragon33/Application-Management/blob/be52b0b202276962e54f807a0d70cd94d9de761a/app/api/operations/route.ts#L985-L1086
5. App-Manager 5-minute HMAC bridge issue: https://github.com/BlueDragon33/Application-Management/blob/be52b0b202276962e54f807a0d70cd94d9de761a/app/boi-ech.server.ts#L93-L121
6. BOIECH service ticket HMAC, issuer/audience/expiration and Owner auth: https://github.com/BlueDragon33/BOIECH_AI/blob/5f0be9e053d92644c96b66af9cee2742ae6087b0/boi-ech/app/control-auth.server.ts#L85-L120 and https://github.com/BlueDragon33/BOIECH_AI/blob/5f0be9e053d92644c96b66af9cee2742ae6087b0/boi-ech/app/api/control/management-access/route.ts#L13-L17
7. BOIECH D1 owner SQL writes, auditing, CAS and D1 read queries: https://github.com/BlueDragon33/BOIECH_AI/blob/5f0be9e053d92644c96b66af9cee2742ae6087b0/boi-ech/app/api/control/management-access/route.ts#L17-L121
8. Distinction between persisted grant and effective grant: https://github.com/BlueDragon33/BOIECH_AI/blob/5f0be9e053d92644c96b66af9cee2742ae6087b0/boi-ech/app/api/control/overview/route.ts#L225-L231
9. One manager-tier quota row seeded 50 learners / 5 teachers, capacity guards: https://github.com/BlueDragon33/BOIECH_AI/blob/5f0be9e053d92644c96b66af9cee2742ae6087b0/boi-ech/drizzle/0017_manager_approval_quota.sql#L1-L80
10. Demo fixture read-only and guarded mutation: https://github.com/BlueDragon33/BOIECH_AI/blob/5f0be9e053d92644c96b66af9cee2742ae6087b0/boi-ech/app/manager-approval-panel.tsx#L17-L74
11. Source-pattern test suites (NOT executed): https://github.com/BlueDragon33/Application-Management/blob/be52b0b202276962e54f807a0d70cd94d9de761a/tests/boi-manager-tier-bridge-contract.test.mjs and https://github.com/BlueDragon33/BOIECH_AI/blob/5f0be9e053d92644c96b66af9cee2742ae6087b0/boi-ech/tests/manager-tier-shared-quota-preview-contract.test.mjs

## Source-only trace / observed properties (not execution PASS)
- UI view is present only for role=owner, verified managed access and non-offline state; server separately enforces actor.role owner; BOIECH separately enforces role owner after authenticated ticket.
- UI list response is checked structurally at runtime (integer quota ranges, manager-record fields) instead of unsafe double-cast; on invalid response UI raises failure.
- Client operationsAction sends to App-Manager protected operations API; bridge issues an HMAC ticket with issuer/audience/role and 5-minute expiration; Bơi Ếch verifies ticket. The direct shared service-secret path is a separate trust boundary requiring QA scrutiny.
- BOIECH overview emits `managementConfigured = management_enabled===1` (raw D1 grant) separately from `managementEnabled = raw && manager && approved && !accessExpired` (effective grant). App-Manager list and CAS compare now use **managementConfigured**, enabling attempted revoke of blocked/expired manager while avoiding the pre-fix stale-effective-CAS mismatch. Revoke success is not established by this source review.
- Shared quota uses one `manager-tier` row with defaults 50/5, never multiplied by number of managers. SQL triggers constrain assignments/re-activation. Owner writes use compare-and-swap, D1 batches with audit and separate SELECT/read requests.
- BOIECH demo panel has literal fixtures and read-only gates; this review has not tested a rendered browser to prove the boundary.

## P0 source contradictions / unresolved review blockers
**P0-S1 — deterministic test assertion drift (source confirmed).** App-Manager `tests/boi-manager-tier-bridge-contract.test.mjs` line 36 still asserts that the old string `expectedManagementEnabled!==bool(row.managementEnabled)` is present. It is absent in actual `app/api/operations/route.ts` lines 1072–1075, deliberately replaced by `expectedManagementEnabled!==row.managementConfigured`. A later source-pattern test on this HEAD will fail at the stale assertion. The newer test at lines 53–59 explicitly prohibits the old expression. Do not mark test PASS. Minimal remedy belongs to App-Manager test owner after scope review.

**P0-S2 — revoke of inactive manager cannot be independently proven from effective readback (source confirmed).** BOIECH `get-manager-grant` returns `row.management_enabled===1 && active`. When the manager is blocked or expired, this readback is false both before and after persisting raw `management_enabled=0`. App-Manager presently verifies only this effective false at `operations/route.ts` lines 1080–1085. Thus its independent read cannot discriminate successful persisted revocation from pre-existing inactive state. The mutation CAS/change count is separate evidence but does not replace independent raw D1 readback. Reviewer should require an authenticated fresh owner-scoped D1 raw grant read, e.g. a separate BOIECH overview read of `managementConfigured` filtered by exact identity after write, or equivalent dedicated raw-flag endpoint. Do not call this runtime scenario PASS.

## Evidence still REQUIRED before QA PASS
- **Build/type:** reproducible locked-dependency App-Manager TypeScript typecheck and production-shaped build on pinned SHA; BOIECH build/type coverage on pinned SHA; exact log artifacts with exit codes and SHA. None collected in this task.
- **Node tests:** run the pinned App-Manager and BOIECH source/contract suites and relevant integration tests in authorized QA, not GitHub-hosted Actions. Fix P0-S1 first and capture test names/counts/exits. None executed in this task.
- **Signed Owner/Viewer runtime:** authorized QA identity proof, Owner action allowed, Viewer/forged/replayed/expired/wrong issuer/audience tickets denied, server-side Owner gate; capture request-to-response correlation and no secrets.
- **D1 runtime:** source mutation -> authenticated separate GET/read action -> independent D1 SELECT/read-after-reopen showing actual persisted raw permission and quota, with device ID/person code/nonce/SHA and database identity. Verify revoke while blocked/expired, successful grant, CAS stale-write rejection, atomic audit, concurrent quota 50/5 and rejected 51st learner/6th teacher across different managers. No live D1 evidence collected.
- **Demo/routing:** actual browser demo read-only with no D1 mutation, protected real mode, malformed response fail closed, async UI reload and double-submit lock.
- **Independent reviewer:** designated external authorized reviewer, scope/identity confirmation, review decision and recorded blockers; no self-approval and no signature invented.

## Handoff interpretation
**SOURCE_EVIDENCE_PREPARED / P0 BLOCKERS OPEN / REVIEW_BLOCKED / CI_PENDING / D1 10/10 BLOCKED.**
This is source inspection only. It does not represent passing typecheck, Node, browser, authenticated live QA, D1 persist, pilot, external review, release or Constitution ratification. No source code was changed as part of this packet.

## Exactly one suggested Next Action (not authorized automatically)
Have an independent authorized reviewer inspect this immutable source packet, explicitly acknowledge P0-S1 and P0-S2 and issue a scoped non-approval technical disposition. Only a subsequent separately approved owner-scoped patch may address those blockers. **Fallback:** if independent reviewer/QA is unavailable, retain Draft-only intent, CI_PENDING, REVIEW_BLOCKED, D1 10/10 BLOCKED and preserve source evidence without inventing PASS.
