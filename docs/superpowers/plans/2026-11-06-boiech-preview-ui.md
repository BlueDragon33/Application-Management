# Bơi ếch Preview UI implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline. Steps use checkbox syntax.

**Goal:** Manage both Cloudflare Preview connection/token lifetime and manager entitlement through authenticated App-Management UI.

**Architecture:** Dedicated Preview page/API uses the existing encrypted vault and Owner verification. Cloudflare adapter fixes account/Worker/scope and changes only the expiry or revokes the exact Preview token with independent readback. Existing manager date/grant controls are reused.

**Tech Stack:** Node 22, TypeScript, React/Vinext, existing D1/AES-GCM vault, Cloudflare API.

**Spec:** `docs/superpowers/specs/2026-11-06-boiech-preview-ui-design.md`.

## Global constraints

No schema, authority, Production, paid resource, merge or hosted Actions changes. No secret in browser responses or audit. Missing backend authority is BLOCKED. Default term is 30 days; manager does not gain admin rights.

## Review focus

Wrong resource/policies must fail before writes; expired or missing credentials must fail closed; stale expiry and failed readback must not report verified; signed Owner and MFA must remain enforced; duplicate UI submits must not duplicate provider mutations.

### Task 1: Scoped adapter, vault and API

Files: new `app/cloudflare-preview.server.ts`, `app/api/apps/boi-ech/cloudflare-preview/route.ts`; export reusable encryption helpers in `app/deploy-ops-credentials.server.ts`; add the route to existing MFA sensitive mutations in `worker/production-auth.ts`. Test `tests/cloudflare-preview-lifecycle-runtime.test.mjs`.

Interfaces: `cloudflarePreviewAction(payload, actor)` returns only safe status metadata or a typed error. It consumes existing `getControlDatabase`, AES-GCM helpers and Owner role; accepts status, connect, connect-lifecycle, update-expiry and revoke actions.

- [x] Write runtime tests asserting forbidden roles/resources, missing credentials, stale state and failed readback prevent verified writes.
- [x] Run tests and observe missing-module failure, then implement the adapter/API and watch all targeted tests pass.
- [x] Run existing manager and MFA regressions; commit tested backend.

### Task 2: UI and acceptance evidence

Files: new `app/apps/boi-ech/cloudflare-preview/{page.tsx,connection.tsx,connection.module.css}`, signed action helper in `app/admin-device-client.ts`, navigation in existing Bơi ếch control screen. Test `tests/cloudflare-preview-ui-runtime.test.mjs`.

Interfaces: UI consumes safe `cloudflarePreviewAction` responses through signed `cloudflarePreviewAdminAction`; backend never returns credentials. Date editor defaults to now +30 days and shows actual provider expiry separately.

- [x] Write UI tests for BLOCKED state, 30-day default, password clearing, response errors and duplicate submission.
- [x] Run red, implement existing product style and make tests green; no redesign.
- [x] Run guarded Node 22.16 full npm test, lint and artifact validation. Browser acceptance of the deployed candidate is still BLOCKED; DOM fixtures are not signed HTTPS acceptance.
- [x] Obtain independent review and fix both Important findings with red/green regressions.
- [ ] Synchronize candidate on the separate feature branch with a fresh remote lease, without creating a PR that triggers hosted Actions. Record actual credential/infrastructure/release blockers and exact SHA.

### Publish-gate follow-up requested by Owner

- [x] Clear 23 baseline lint errors with tested cancelable initialization, storage hydration guards, accurate event-handler names, and a narrowly scoped third-party QRCode.js exclusion. No auth/schema/business-rule changes.
- [x] Repair the stale whitespace-sensitive Preview source gate, missing exact manual confirmation, and missing CI dry-run. Preserve the dormant deployment job and never run hosted Actions.
- [x] Independent review of the newly necessary lint and workflow deltas; guarded Node 22 verification.
- [ ] Deploy and verify the actual UI when scoped Cloudflare credentials are available. This is the remaining visibility gate; source synchronization alone does not update the website.
