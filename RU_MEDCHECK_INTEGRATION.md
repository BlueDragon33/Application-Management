# Trung tâm quản trị — RU MedCheck / Y tế integration

## Kiến trúc Trung tâm

Root `/` là **Trung tâm quản trị** đa lĩnh vực. Ba lĩnh vực đang hoạt động được tách theo ranh giới chức năng và dữ liệu:

- `/learning-control` — **Học tập**: thiết bị học, tiến độ, thanh toán, AI và duyệt chỉnh sửa nội dung.
- `/medical-control` — **Y tế**: dashboard chung của các module Y tế; RU MedCheck là module đầu tiên.
- `/system-control` — **Hệ thống**: tài khoản, thiết bị quản trị, phân quyền và nhật ký dùng chung.

Các lĩnh vực dùng chung danh tính ChatGPT và bằng chứng thiết bị quản trị ECDSA, nhưng API nghiệp vụ được tách riêng. Hệ thống không cần vé/bridge của Bơi ếch và Y tế không nhập dữ liệu thuốc vào tiến độ học tập.

`app/control-device.client.ts` là lớp xác thực client dùng chung cho các module mới. Nó tái sử dụng thiết bị quản trị đã cấp quyền và chuỗi ký hiện hành `learning-control:<deviceId>:<challenge>`.

## Routes RU MedCheck / Y tế

- `/medical-control` — protected medical-domain dashboard.
- `/ru-medcheck` — public installable Web App for Russia-only medicine screening.
- `/medicine-control` — protected RU MedCheck review/rule workspace under the Y tế domain.
- `/api/medicine/rules` — public enabled rule set.
- `/api/medicine/reviews` — submit OCR text for central review.
- `/api/medicine/reviews/[id]?token=...` — read one public review decision with its separate secret lookup token.
- `/api/medicine/control` — protected medical administration API using signed control-device proof.

## Route Hệ thống

- `/system-control` — protected system administration workspace.
- `/api/system/control` — dedicated system control API for bootstrap, control-device/account management and central audit.

The system API deliberately does **not** import `issueBoiBrowserBridge` or any Bơi ếch dependency. The older `/api/dashboard` remains available to the existing Learning ControlCenter for compatibility while the large legacy component is gradually cleaned up.

## Trust model

The medicine/system administrators do not have separate passwords. They reuse the existing ChatGPT identity, approved management device, ECDSA challenge/proof, and `viewer` / `reviewer` / `publisher` / `owner` roles.

- viewer: read permitted management workspaces.
- reviewer: decide review cases where a module grants reviewer capability.
- publisher: reviewer capabilities plus publishing/configuration and audit capabilities where applicable.
- owner: central account/device administration and full module capabilities.

The public scanner keeps medicine images in the browser. OCR uses Tesseract.js locally. Only extracted text is sent to the control center after an explicit `Gửi Trung tâm kiểm duyệt` action.

The server does **not** trust the risk level or matched ingredients calculated by the browser. Every submitted OCR text is analyzed again against the current enabled D1 rule set before a review record is stored.

Public review lookup uses two independent values:

1. a random review UUID;
2. a separate 256-bit random lookup token.

Only the SHA-256 hash of that lookup token is stored in D1. A UUID by itself cannot retrieve the decision.

Public review submission is bounded by payload size and an hourly rate limit. The rate-limit key is derived from a SHA-256 hash of the Cloudflare client IP plus the current time bucket; the raw IP is not stored in the RU MedCheck tables.

## Five levels

1. No special-control ingredient recognized from a known rule.
2. Attention / unknown match; central review is recommended when the ingredient cannot be identified.
3. Concentration, dose, form, or combination needs checking.
4. Strict control; documentation and Russia-specific conditions need verification.
5. Special control; do not treat the automated result as permission to import/use without official/document verification.

The result is a legal/regulatory screening aid for the Russian Federation only. It is not medical prescribing advice and not an absolute customs clearance decision.

## Data and rule lifecycle

The D1 tables are self-initialized with `CREATE TABLE IF NOT EXISTS` and are also described in `drizzle/0002_ru_medcheck.sql` and `db/schema.ts`.

- `medicine_rules` — centrally managed ingredient rules.
- `medicine_reviews` — review queue and decisions.
- `medicine_audit_log` — RU MedCheck administrative audit log.
- `medicine_settings` — seed/data version state.
- `medicine_rate_limits` — short-lived anti-abuse counters.

The current seed version is `RU-MED-2026.09.05-v4`. A new seed version refreshes only system-owned seed rules. A rule edited by a Publisher/Owner is preserved and is not overwritten by a later seed refresh.

Russian source metadata is centrally versioned. Current source metadata covers Federal Law 61-FZ Article 50, Government Decree 681 Lists II/III/IV, Ministry of Health Order 459n, and Government Decree 964.

## PWA and offline behavior

`/ru-medcheck` has its own Web App manifest and reuses the central service worker. After a successful online visit, the RU MedCheck navigation shell and same-origin static assets can be reused offline. The last successfully downloaded rule set is also cached in browser storage.

Offline mode supports reading previously cached rule data and manual ingredient text analysis. Sending a new central review or refreshing a review decision still requires a network connection. OCR image recognition also requires a network connection the first time Tesseract.js/language data are loaded.

## Quality gate

`.github/workflows/ci.yml` runs on `main` and `work/**` branches and on pull requests to `main`:

1. locked dependency install;
2. ESLint;
3. full `npm test` build-and-test gate.

Contract tests protect both feature and architecture boundaries:

- `tests/ru-medcheck-contract.test.mjs` — server-side risk recomputation, private lookup token, no-image-upload contract, authorization, Russian source identifiers, and PWA/offline behavior.
- `tests/admin-hub-contract.test.mjs` — cross-domain hub and independent entry routes.
- `tests/domain-boundary-contract.test.mjs` — dedicated System API, Y tế API boundary, shared ECDSA client proof, and Learning-domain navigation separation.
