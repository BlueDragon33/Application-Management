# Device Automation Source-of-Truth Audit · 2026-10-07

Baseline: `731e80ff92bc74a69de7bd3b33217205301793ca`

This audit is the mandatory pre-change matrix for `docs/PROMPT_DEVICE_REVIEW_POLICY_ROOT_CAUSE.md`.

## Root causes confirmed before implementation

1. **Inventory split**: the dashboard already merges static `applicationRegistry` with `operations.managedApps`, but `AutomaticDevicePolicies` still iterates only `applicationRegistry`. Dynamic Catalog is therefore not the canonical inventory for the policy editor.
2. **Automation reader split**: `readClientAutoApprovalStates` has explicit readers only for Bơi ếch, Health_Care, Bauman and RU_LIFE. Other managed apps have no automation policy read path.
3. **Aggregate settings hide provenance**: `OperationsSettings` exposes arrays/maps but no per-app live/fallback/unavailable/unsupported state. The UI cannot truthfully distinguish "currently verified" from "last known".
4. **Fallback loses Bơi ếch parameters**: `rememberAutoApproval` records hard-coded `defaultAccessDays: 60` and `defaultDeviceLimit: 100`, while the editor can save other values. On live-read failure the fallback cannot reproduce the saved configuration exactly.
5. **Partial save reporting is app-level, not field-level**: current multi-policy save groups auto-approval and auto-block under one app promise. If one write succeeds and the next fails, the app is marked failed and readback verification is skipped for the successful field. That makes the reported result diverge from real persisted state.
6. **Generic contract does not currently define automation endpoints**: Universal Contract v1 supports generic device registry/commands but the current manifest type does not expose a generic automation endpoint. Apps without legacy automation adapters must remain read-only/unsupported until they publish a real automation contract; the UI must explain this instead of looking broken.

## Current capability / source-of-truth matrix

| App | Inventory | Management mode / readiness | Auto-approve source | Auto-block source | Persistence owner | Current intervention status |
|---|---|---|---|---|---|---|
| Software Blueprint Hub | static + may be cataloged | metadata/control-plane observation | none | none | Blueprint OS | Unsupported for device automation; must be shown read-only with reason |
| Bơi ếch | static + Dynamic Catalog compatible | legacy special workflow + contract observation | `/api/control/overview?activityDays=0` / `update-automation` | no safe auto-block contract | Bơi ếch | Auto-approve/free policy writable only when live; paid flow remains separate |
| Health_Care | static + Dynamic Catalog compatible | legacy adapter; production readiness dependent | `/api/control/automation` | same endpoint when `device-auto-block-pending` capability is live | Health_Care | Auto-approve and auto-block writable only after live read/capability |
| RU_LIFE | static + Dynamic Catalog compatible | client-owned registry/session | `/api/control/status` → `/api/control/automation` | not published in current adapter | RU_LIFE | Auto-approve writable only when live; auto-block unsupported |
| Bauman Master AI | static + Dynamic Catalog compatible | owner/control-service guarded | `/api/control/status` → `/api/control/automation` | not published in current adapter | Bauman | Auto-approve writable only when live; auto-block unsupported |
| PriceReport Tùng Gia Bảo | static + Dynamic Catalog compatible | local-first / managed only when Control live | no automation contract in Application Management | none | PriceReport | Read-only/unsupported until client publishes automation contract |
| PC Manager | static | Desktop Agent gateway; separate lifecycle | no automation policy contract in current center | none | PC Manager | Read-only/unsupported for this editor |
| NC03 Modem | static + metadata/local-first | local-first, modem credentials stay local | none | none | NC03 local runtime | Intentionally unsupported; must not expose fake remote policy controls |
| CAD CAM 3D | static + metadata | remote backend not production-ready | none | none | CAD client | Unsupported until backend/contract exists |
| GrowUP MyChildren | static + Dynamic Catalog compatible | privacy-first; remote readiness guarded | no automation policy reader/writer in center | none | GrowUP | Unsupported until real automation capability is published |
| Any Dynamic Catalog app | dynamic | derived from live contract | **not generically defined yet** | **not generically defined yet** | owning client | Must appear in editor inventory, but policy controls remain disabled with precise contract reason until generic automation capability exists |

## Required state after repair

For every managed app the bootstrap must provide a per-app automation snapshot containing:

- support by policy field;
- current value if known;
- verification state: `live | fallback | unavailable | unsupported`;
- read source/provenance;
- last verified/fallback timestamp when available;
- mutation readiness and reason;
- Bơi ếch typed free-policy parameters where applicable.

The editor must render the merged managed-app inventory from the dashboard, not import its own static inventory.

A saved field is successful only after fresh bootstrap readback matches the intended value. Transport result alone is not authoritative.

Partial success is verified **per policy field**. An app-level error cannot hide a field that actually persisted and read back successfully.


## Phase 2 · Universal automation contract

Sau root-cause repair, Universal Contract v1 được mở rộng theo hướng zero-code onboarding:

- manifest có `endpoints.automation`;
- capability chuẩn: `deviceAutoApproval`, `deviceAutoBlockPending`, `automationIdempotentCommands`, `automationOptimisticConcurrency`;
- Dynamic Catalog đọc policy live trực tiếp từ owning client;
- automation read failure không hạ toàn bộ app contract;
- mutation generic chỉ được bật khi credential + endpoint + capability + idempotency + concurrency đều live;
- mọi POST bắt buộc GET readback và so sánh `desired`;
- adapter Bơi ếch/Health/RU/Bauman tiếp tục làm fallback trong giai đoạn chuyển đổi;
- app chưa công bố automation capability vẫn hiển thị READ-ONLY, không có nút giả.


## Rollout status after Universal automation wiring · 2026-10-07

The control plane code now supports Universal automation, but **code readiness is not deployment readiness**.

### PriceReport

- Client repository already owns a real KT Control Service with D1-backed automation policy, idempotent commands, optimistic concurrency and readback.
- Application Management now has a dedicated `price-report-control` network spec and deployment wiring for `PRICE_REPORT_CONTROL_BASE_URL` + `PRICE_REPORT_CONTROL_SERVICE_SECRET`.
- Live Development verification showed the PriceReport bridge-install step was **skipped**, which means `PRICE_REPORT_CONTROL_PRODUCTION_ORIGIN` is not currently configured in the `application-management-production` environment.
- Until the client Control Service is actually deployed and the matching origin/secret are supplied, PriceReport must stay READ-ONLY for automation. A successful Pages/CI run is not evidence of a live Control Service.

### GrowUP

- GrowUP local Control Service already implements the Universal automation protocol, but the checked-in production contract deliberately advertises automation as local-control-only and `remoteAdminReady=false`.
- Application Management now keeps GrowUP site origin and GrowUP control origin separate through `growup-control`, with `GROWUP_CONTROL_BASE_URL` + `GROWUP_CONTROL_SERVICE_SECRET`.
- Live Development verification showed the GrowUP bridge-install step was **skipped**, which means `GROWUP_CONTROL_PRODUCTION_ORIGIN` is not currently configured.
- GrowUP must therefore remain READ-ONLY remotely until a real Production Control Service is deployed and verified. Local capability must never be promoted to Production capability by inference.

### Activation gate

A client may leave READ-ONLY automation only when all of the following are true:

1. a real HTTPS Control Origin is configured;
2. the matching Worker secret is installed;
3. Dynamic Catalog resolves the client to that control origin;
4. the live manifest advertises automation + idempotency + optimistic concurrency;
5. GET automation succeeds;
6. POST mutation succeeds with expected-state protection;
7. fresh GET readback matches the requested value.

Missing any one gate keeps the client read-only.
