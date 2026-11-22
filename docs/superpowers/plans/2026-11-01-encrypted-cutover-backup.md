# Encrypted cutover backup implementation plan

> For agentic workers: use superpowers:executing-plans inline and one whole-branch review.

**Goal:** Produce and verify an owner-recoverable encrypted backup of the two existing Cloudflare targets without changing production data.
**Architecture:** Existing protected inspection workflow; verified binding allowlist; full SQL export and local integrity restore; referenced Boi R2 objects; authenticated encrypted archive. Source Sites backup remains blocked until its complete private export is available.
**Tech Stack:** Existing Node, Wrangler and SQLite; Node crypto/streams, tar. No new dependency.
**Spec:** docs/superpowers/specs/2026-11-01-encrypted-cutover-backup.md

## Global constraints

Constitution1.3.0; existing origins, databases, secrets and protections; no mutations, grants, deploys or legacy retirement. Public output contains only ciphertext and aggregate status. Private recovery key never enters Git or Actions.

## Review focus

- A wrong Worker binding or unexpected credential cannot export an unrelated database.
- Wrong/private/weak public-key input and damaged envelopes fail before disclosure or successful restoration.
- SQL, object download and encryption failure leave no plaintext artifact or false complete-backup result.
- Referenced storage keys cannot escape the intended bucket or local temporary directory.
- Uploaded encrypted output must be recoverable with the retained private key; local SQL integrity and object byte hashes must verify.

### Task1: Private backup runner and protected optional inspection path

Files: scripts/encrypted-cutover-backup.mjs, tests/encrypted-cutover-backup.test.mjs, .github/workflows/deploy-application-management-production.yml.
Interfaces: sealBackup/openBackup for authenticated file envelopes; runCutoverBackup with injectable provider/CLI boundaries, fixed two-app allowlist and sanitized result. Workflow consumes explicit EXPORT_ENCRYPTED_BACKUP and a public recipient key, never a private key.
- [x] Write real encryption/restore and fake-provider boundary regressions; observe RED for missing implementation.
- [x] Implement strict read-only runner, private cleanup and authenticated envelope; focused tests GREEN.
- [x] Run full npm test, changed-file lint and diff checks; commit and one independent whole-branch review; reproduce/fix material findings once.
- [ ] Save private recovery key to Owner before dispatch, run the protected inspection/backup on its exact verified operations branch, download ciphertext and validate actual decryption/integrity. Record precise source/target limitations; no cutover claim.

Verification: baseline806/806; initial focused6/6 and full812/812. One independent review found two Important findings. Encoded/backslash/query/fragment R2 paths and persistent Wrangler logs were reproduced RED, fixed GREEN; focused8/8 and full npm test/typecheck/build814/814 PASS. Changed files ESLint and diff check PASS. No new runtime route, dependency, database write or production release.
