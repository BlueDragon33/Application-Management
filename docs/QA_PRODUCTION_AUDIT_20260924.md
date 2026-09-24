# Production QA / UX / Report Audit — 2026-09-24

## Scope

Audit after Cloudflare Production bootstrap, focused on real user experience rather than CI-only success.

Areas:
- Production auth/session and static assets
- dashboard bootstrap and control-plane requests
- Production Owner access boundary
- application/client connectivity
- device approval, blocking, bulk actions and automation
- account/security flows
- responsive UX and failure states
- PriceReport professional quotation/report output

## Severity scale

- P0: unusable / data or security critical
- P1: major workflow failure or misleading output
- P2: quality / resilience / professional polish

## Findings and remediation

### P0 — Production could be healthy while client assets were missing

Observed symptom: authenticated browser rendered a blank/dark page while Worker/D1/auth health remained green.

Root cause class:
- Cloudflare secret/version updates can produce a live Worker version whose static bundle is not the intended generated artifact.
- A Worker-only read-back did not prove CSS/JS assets were present.

Permanent remediation:
- deploy workflow performs a second generated-artifact deploy after Worker secrets;
- Worker serves authenticated Cloudflare client bundles through `ASSETS`;
- add `public/application-management-asset-health.txt`;
- `/__deployment` reports `assetsReady` by reading the sentinel through the live ASSETS binding;
- Production and Preview read-back fail unless `assetsReady=true`;
- generated artifact validators require CSS, JS and the sentinel.

### P0 — Production Owner was forced through duplicate device verification

Observed symptom: after successful account login, the dashboard stayed at “Đang xác minh thiết bị quản trị…”.

Remediation already in main:
- authenticated Cloudflare Production Owner session is accepted as server-side control access;
- browser checks Production session before IndexedDB / ECDSA device registration;
- Preview/local/ChatGPT Sites retain the cryptographic device path.

### P1 — dashboard could remain in loading state indefinitely

Cause:
- browser calls to control-plane endpoints and client bridges had no request timeout.

Remediation:
- 15 second AbortController timeout for central control API calls;
- same bounded policy for upstream client browser bridge calls;
- timeout becomes a visible retryable error instead of an infinite spinner.

### P1 — professional Excel report omitted quotation business sections

PriceReport audit found that the Excel “Bảng báo giá” export contained header and products but omitted or under-represented:
- customer detail;
- subtotal / discount / VAT / fees / total;
- payment and bank information;
- commercial terms;
- report metadata and page settings.

Remediation is tracked in `BlueDragon33/PriceReport_Tunggiabao`:
- pure quotation workbook model;
- preflight before report export;
- complete quotation sections;
- merged headings, money formats, product autofilter, print margins/page setup;
- raw product-data sheet remains separate;
- visibility flags such as totals/payment/terms are respected.

## Existing logic guards reviewed

### Device management
- direct mutations remain capability-gated;
- Bơi ếch delete semantics remain destructive and require explicit confirmation;
- bulk pending handling is bounded to 24 records per pass;
- PriceReport remote device mutation remains fail-closed until its live control contract reports readiness;
- optimistic concurrency and idempotent command ids remain enforced where supported.

### Automatic policies
- per-app explicit manual/automatic modes;
- payment-backed approval stays specific to apps with a verified payment contract;
- pending auto-block rules are contract-gated;
- disconnected app settings are preserved rather than silently discarded.

### Production authentication
- PBKDF2-SHA-256 pinned to the Cloudflare Workers production ceiling of 100,000 iterations;
- random salt, HttpOnly + Secure + SameSite=Strict session cookie;
- repeated-login lockout;
- Production account role stored in D1;
- email/password/profile changes are separated from ChatGPT Sites identity.

## Release gates for this audit

Application Management:
1. normal CI
2. Cloudflare Production CI
3. Cloudflare Preview CI when preview/deployment boundary changes
4. local offline smoke
5. Production generated artifact validation
6. live `/__deployment` read-back with `databaseReady=true` and `assetsReady=true`
7. authenticated browser verification after deploy

PriceReport:
1. syntax/core/import/export tests
2. DOM regression
3. service worker tests
4. smoke tests
5. production build
6. professional workbook model regression

## Remaining non-blocking follow-up

- keep browser-level E2E for authenticated Production root/navigation as a permanent test once a non-human test account or dedicated ephemeral test-session mechanism is available;
- continue visual comparison of PriceReport A4/PDF against representative long-address, long-terms and multi-page quotation fixtures.
