# Google Session and MFA30 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Keep Google sessions signed in until logout and require Authenticator again after 30 minutes for important changes.

**Architecture:** Retain server-side D1 sessions and the existing secure opaque cookie. Use a Google-only persistent marker and response-cookie renewal; retain the existing step-up gate with a 1800-second window.

**Tech Stack:** TypeScript, Cloudflare Workers/D1, Node test runner and real in-memory SQLite.

**Spec:** `docs/superpowers/specs/2026-11-08-google-session-mfa30-design.md`

## Global Constraints

- Google remains primary; password recovery remains 12 hours; lockout remains 15 minutes.
- No schema/role/scope/slug/binding/plan/service/dependency change or hosted Actions.
- Preserve expired/revoked/inactive rejection, OIDC verification and CSRF boundaries.
- Persistent Google server marker0; rolling browser cookie365 days; step-up strictly less than1800 seconds.
- PR378 is already released; this package has a separate exact-artifact Production gate.

## Review Focus

- Legacy expired credentials must not become persistent: test expiry rejection and deletion.
- Persistent sessions must survive cleanup while non-Google marker0 fails closed: test real SQL.
- Cookie renewal must not undo logout or leak into cached API/assets: test response headers and routing.
- Confirmation must not spread to another session or accept a future time: test real session rows and gate responses.
- Losing step-up must preserve Google sign-in: advance the fixture clock beyond1800 seconds and check both outcomes.

## Task 1: Google session lifecycle and renewal

**Files:** modify `worker/production-auth.ts`, `worker/index.ts`; create `tests/google-session-persistence-runtime.test.mjs` and a test-only fixture as needed.

**Interfaces:** `productionIdentity(request,env)` continues returning the existing identity; produce `withProductionSessionCookie(request,identity,response):Response`. No secret is added to the identity object. Tests may expose private session issuance only inside their loader.

- [x] Write real-SQL tests for Google marker/cookie, cleanup, legacy promotion, expired/inactive rejection, password lifetime, logout and response-cookie renewal.
- [x] Run the new tests and record expected failures against current12-hour behavior.
- [x] Implement Google-only persistence and HTML-navigation renewal; wire every relevant authenticated Worker return without repeating identity queries.
- [x] Run runtime and linked auth/SSO/security tests; compare cookie and revocation outcomes.
- [ ] Commit source/tests with `[skip ci]` (next; source/test validation complete).

## Task 2: 30-minute confirmation and final validation

**Files:** modify `worker/production-auth.ts`, existing TTL assertions and `tests/inline-authenticator-runtime.test.mjs` or a dedicated runtime test.

**Interfaces:** retain `productionStepUpGate(request,env,identity)` and current-session `step_up_at`; change the confirmation window and user-facing account messages to30 minutes.

- [x] Write and run failing tests at16min,29:59,30:00, future time, other-session and persistent-login-with-expired-confirmation.
- [x] Set the server window to1800 seconds with nonnegative age and strict upper boundary; update related messages.
- [x] Run meaningful focused tests, full `npm test`, lint and fresh source/artifact checks. Keep logs and distinguish local from live QA.
- [ ] Independent whole-branch review complete with no findings; prepare Draft PR without hosted Actions (next).
- [x] Record exact source/evidence and the remaining Owner/live/Production gates; do not apply the new auth policy under PR378's old approval.
