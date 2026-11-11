# APP Owner Console integrated candidate (2026-11-11)

- Base APP main: aa60c4426c36ac1a786e5bc4e7fc514d00d26111
- Security candidate V5 PR #389: 868e275e605c6145a44bfc57480243b9a276a3bb (901/901 Node CI, Auth 45/45, Constitution PASS at source SHA)
- Visual candidate offline R5: 7209f2a7f16aeacbac5b2b20f9781054b2b30294 (local-only synthetic evidence; real Preview/browser not accepted)
- Combined from V5: signed Owner API/readback/BOI runtime attestation, strict server MFA30, blocked legacy grants, security tests.
- Combined from R5: Owner blue/violet UI, read-only device drawer, stale metrics, inline Authenticator with retry only when explicitly NOT applied, write lock, responsive Owner UX.
- Owner requested sidebar fix: fixed desktop left rail, only central nav scrolls, footer and brand anchored; mobile existing nav preserved.
- R5 offline Windows harness deliberately remains on its original branch; no synthetic transport or local development tooling is part of deployed APP build in this candidate.
- Required remaining gates: CI on exact integrated commit, real authenticated Owner browser QA and Cloudflare readback, then separate Cloudflare deployment authorization. No D1/secret/deploy performed by this source merge.
- Preserve single-review only after real BOI runtime `GET /api/accounts` reports `enabled/accountV2/accountSingleReview`; never fabricate approval state.
