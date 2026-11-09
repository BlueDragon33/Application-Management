# Bơi ếch Preview connection and manager terms

Owner requires both Cloudflare token and manager access to start at 30 days, with subsequent operations available through Application Management UI instead of AI prompts or code. Existing manager permission remains separate from application admin.

## Approach

Use the existing authenticated control plane and encrypted D1 vault, with a dedicated Bơi ếch Cloudflare Preview page. Existing Deploy & Ops stays Vercel/Neon only. Reuse the existing manager detail screen and its date control; do not add a new grant model or schema. A Cloudflare-only dashboard link would not satisfy in-app controls. Giving the deployment token account-wide token-management rights would unnecessarily expand that token; keep an optional, separate lifecycle credential behind Owner authentication.

Only account `f88a42260814230aa4a151abbfe5659d`, Worker `boi-ech-preview`, script resource `277ab3dcacd540a0bd7a510788bdef8c`, and permission group `7e79ec33834341f28dd431ab73884400` are supported. These non-secret identifiers came from the actual Cloudflare token review JSON. Token management is BLOCKED unless the provider-authorized lifecycle credential can read the exact deployment token and confirm its sole Worker Editor policy. No automatic permission grant or credential creation.

Connect the separately approved lifecycle credential first; its only accepted permission ID is `5bc3f8b21c554832afc660159ab75fa4` (Account API Tokens Write), observed in the real 2026-11-07 Cloudflare review JSON. The provider's optional permission display name is not used as authority. An unverified deployment credential is never staged in the vault. This lifecycle credential can manage tokens at account scope at the provider; the App-Management adapter further restricts its operations to the exact Preview token. This broader credential still requires explicit confirmation before creation.

## Behavior and boundaries

- Password fields connect/replace deployment and lifecycle credentials through UI; server encrypts with the existing vault key, never returns plaintext, and audits metadata only.
- Read token status and actual expiration from Cloudflare. Owner can choose 30 days or another future expiration up to 365 days, with expected-expiration concurrency check and independent readback. Never change token policies, resource or name.
- Owner can revoke only the verified Preview deployment token after entering its exact token name. A successful DELETE without verified absence is not PASS. No generic cloud API proxy, deploy/publish, schema changes, SQL grants or Production operations.
- Lost or malformed write responses are reconciled with independent provider readback. Unresolved application is `applied: null`, never falsely reported as not applied. An unreadable encrypted vault still returns safe recovery metadata and leaves authenticated disconnect available.
- Signed device/session verification and the existing MFA step-up gate cover new credential/expiry/revocation mutations. No localhost signature bypass.
- Manager dates and grants use existing Bơi ếch controls and backend authority. Preview manager acceptance remains blocked until isolated infrastructure exists; never write a Production manager grant to compensate.
- ZERO-SPEND: no Actions, subscriptions, resource deletion or merge. Existing D1 quota and R2 subscription blockers remain.

## Acceptance

Runtime tests must cover non-Owner denial, wrong scope/resource, missing lifecycle authority, expired credentials, stale state, failed readback, revoke confirmation, encryption and absence of secret values from responses/audit. UI tests cover initial 30-day control, password handling, disabled BLOCKED actions, duplicate submissions and responsive layout. Run Node 22 full tests, typecheck, lint and build; obtain a fresh independent review. The source candidate is not a deployed UI acceptance.
