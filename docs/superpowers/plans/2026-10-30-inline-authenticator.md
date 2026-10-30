# Inline Authenticator policy save implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline; one independent whole-branch review before release.

**Goal:** Show a confirmation pop-up in the current policy-editing session when the server requires Authenticator, then resume the pending Save after a correct code.

**Architecture:** Reuse the authenticated, same-origin `/__account/mfa/step-up` handler with an explicit JSON response mode. The policy dialog retains its draft and owns a smaller accessible Authenticator pop-up. The dashboard shares one verification promise across its policy tasks and retries only explicit `STEP_UP_REQUIRED` rejections once, using the original intended payload. Existing readback remains the success condition.

**Tech Stack:** Existing React/TypeScript, Worker/TOTP/D1, node:test and JSDOM. No dependencies or migrations.

**Spec:** User requests in this conversation: confirmation pop-up in the same editing session; correct code applies changes; no account-page navigation or repeated manual Save.

## Global constraints

- Preserve Owner/session/same-origin/TOTP protections and the existing 15-minute step-up scope. Never store or log entered codes.
- Wrong/expired codes, cancellation, transport failure, or repeated authorization rejection must preserve the draft and permit recovery without a reload.
- Hold the editing/Save lock through authentication and retry. Do not replay uncertain transport failures or already successful tasks.
- No production policy, paid state, device grant, schema, secret, origin or unrelated app change.

## Review focus

- Concurrent tasks requiring verification: exactly one prompt; each rejected task resumes at most once.
- Cancel, wrong code and timeout: no owning mutation; draft and retry controls remain available.
- Expired or revoked session and non-JSON responses: no false authentication success or navigation.
- Keyboard/mobile use: six-digit numeric field, focus containment, Escape cancellation, background inert, readable controls.
- Authentication followed by failed readback: keep the draft; do not report Save success.

### Task 1: Same-session authentication and policy save

Files: `worker/production-auth.ts`, new `app/authenticator-step-up.tsx` and CSS, `app/automatic-device-policies.tsx`, `app/management-dashboard-v2.tsx`, corresponding runtime tests.

Interfaces: `authenticate: () => Promise<boolean>` passed by the modal to `save(selection, authenticate?)`; the callback resolves true only after a successful JSON verification of the current session. The endpoint accepts the existing form `code` with `Accept: application/json`; HTML form behavior is preserved.

- [x] Add failing real-handler tests: JSON success updates only the current session, bad/expired codes and cross-origin requests cannot elevate, HTML still works.
- [x] Add failing dashboard tests: concurrent gate rejections share authentication, correct code resumes once, cancel and repeated rejection do not loop, network errors are never replayed.
- [x] Add failing real React tests: pop-up appears on Save, code validation/error/retry/cancel, exact edited draft saved automatically, focus/Enter/Escape and no navigation.
- [x] Implement minimal endpoint response mode, modal and scoped retry; run targeted regressions until green.
- [ ] Run full `npm test`, changed-file lint/baseline comparison and whitespace check; commit, independently review and resolve material findings.
- [ ] Publish exact tested tree, require exact-head CI, merge and use the existing protected manual Cloudflare release; verify revision/protection/readback. Human Owner code entry remains user acceptance, not a machine claim.

Local verification: full `npm test` PASS (typecheck, verified build, 802 tests). Targeted inline flow tests 16/16 and real dialog accessibility tests 2/2 PASS. Changed small files/tests lint clean. Dashboard diagnostics retain the base 6 errors/5 warnings with identical rule/severity/message summaries; source excerpts shift with added lines. Old source-shape accessibility assertions were replaced by real rendered focus/Escape/Tab tests. No production policy values changed.
