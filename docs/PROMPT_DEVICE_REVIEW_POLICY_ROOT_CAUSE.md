# MASTER PROMPT — Device Review & Automation Root-Cause Repair

> Status: execution prompt, not an implementation patch.
>
> Baseline when this prompt was created: `8680a6030733bac3ebb883cd866923b8334ff261`.
>
> Scope: **Kiểm duyệt thiết bị → Tự động / policy configuration / persistence / contract coverage across all managed apps**.

## 1. Mission

Fix the device-review configuration system **correctly and permanently**, not by adding more local UI patches.

The current user-visible defects are:

1. Saved configuration can be **misaligned with what the user selected**.
2. Pressing **Lưu** can appear successful while the selected configuration is not reliably persisted or is not shown again when reopening.
3. The UI does not clearly distinguish:
   - the configuration **currently applied at the owning client**;
   - the **local draft** being edited;
   - a configuration that is only a **fallback / last known value**;
   - an app whose policy cannot currently be read or changed.
4. Many managed apps appear in Application Management but **cannot be configured** from the policy editor.
5. We must stop the cycle of fixing individual buttons without proving the complete data path.

The final result must make this invariant true:

> **What the UI says is currently applied must be exactly what the owning client confirms by live readback. What the user edits must remain an isolated draft until Save. Save must affect only the intended app/policy fields. Reopening the panel must reproduce the verified saved state.**

## 2. Mandatory working rules

### 2.1 Do not patch before root-cause audit

Do **not** change implementation code until the full state flow has been traced:

`UI current state → draft state → save payload → server route → client contract → client persistence → readback → operations bootstrap → UI current state`.

For every defect, record the first layer where actual state diverges from expected state.

### 2.2 Token / repository discipline

Do not scan the whole repository blindly.

Start only from:

- `app/automatic-device-policies.tsx`
- `app/management-dashboard-v2.tsx`
- `app/admin-device-client.ts`
- `app/api/operations/route.ts`
- `app/api/operations-auto-approval/route.ts`
- `app/operations-settings.server.ts`
- `app/automation-policy-read.server.ts`
- `app/open-contract.server.ts`
- `app/application-registry.ts`
- related tests in `tests/*device*automation*`, `tests/*device*`, `tests/*contract*`

Read additional files only when an exact import, route, contract or failing test requires them.

Use HEAD/diff/log and targeted file reads. Do not perform broad speculative rewrites.

### 2.3 Existing constitutional rules remain binding

Read and preserve:

- `.blueprint/constitution-adoption.json`
- `docs/AUTOMATION_SOURCE_OF_TRUTH.md`
- `docs/UNIVERSAL_MANAGEMENT_CONTRACT_V1.md`
- `docs/CLIENT_DEVICE_CONTROL_FIX.md`
- `docs/MANAGED_APP_CONNECTION_AUDIT_20260925.md`

The owning client remains the source of truth for its device registry and automation policy.

A central audit log may help recovery/display resilience, but it must **never override a successful live client read**.

No app may inherit another app's policy, credential, registry or authority.

### 2.4 No fake capability

If an app cannot safely support a policy mutation, do not enable the control just to make the UI look complete.

Instead show the exact state:

- supported + live + editable;
- supported but temporarily unreachable;
- contract connected but read-only;
- local-first / metadata-only;
- capability missing;
- credential missing;
- backend not production-ready.

"Cannot intervene" is acceptable only when the reason is truthful and visible.

### 2.5 Production safety

Do not publish Production merely because code/tests pass.

Production release remains a separate explicit gate.

No destructive device mutation is part of this task. This task is policy configuration and readback correctness.

## 3. Known architectural suspects that MUST be proven or disproven

Do not assume these are the only causes, but explicitly investigate each one.

### Suspect A — Static registry drives the editor

`AutomaticDevicePolicies` currently iterates `applicationRegistry`.

The system already has Dynamic Catalog / Universal Contract as the canonical onboarding path.

Determine whether the policy editor is therefore missing dynamic managed apps or showing static apps whose policy contract is not actually available.

The final design must use one canonical managed-app inventory. Do not maintain another UI-only allow-list.

### Suspect B — Automation read path is hard-coded to a small subset

`readClientAutoApprovalStates` currently has explicit readers for:

- `boi-ech`
- `health-care`
- `bauman-master-ai`
- `ru-life`

Audit every managed app and explain whether automation is:

- truly supported;
- intentionally unsupported;
- supported by a legacy adapter only;
- available through a Universal/Dynamic contract;
- missing because the generic contract has no automation capability/endpoints yet.

Do not solve future apps by adding endless `if (appId === ...)` branches unless the legacy fallback is explicitly justified.

### Suspect C — Fallback metadata can misrepresent the real policy

Inspect `rememberAutoApproval` and every audit/fallback path.

At the prompt baseline it records fixed metadata values for free policy defaults rather than necessarily recording the actual selected values.

Verify whether fallback state can become inconsistent with live client state or with the last successful write.

Fallback must carry provenance and must never be displayed as live verified state.

### Suspect D — UI lacks per-app verification metadata

Current `OperationsSettings` is primarily aggregate arrays/maps.

Determine whether this is insufficient to represent, per app:

- effective current value;
- support/capability;
- read source;
- read status;
- last verified timestamp;
- stale/fallback status;
- mutation readiness;
- mutation error;
- policy-specific parameters.

If insufficient, introduce a canonical per-app policy snapshot without breaking backward compatibility unnecessarily.

### Suspect E — Save success and UI state are too loosely coupled

Audit whether a successful action can be reported before the exact intended state has been read back.

A write is not considered saved until readback confirms the intended values for that app.

If readback fails, the UI must not silently promote the draft to "Đang áp dụng".

### Suspect F — Partial saves are not represented clearly

One Save may contain changes for multiple apps.

Each app must be an independent transaction boundary from the user's perspective:

- app A may succeed;
- app B may fail;
- app C may be unchanged.

The UI must show the result per app and a concise combined summary.

A failure in one app must not rewrite or reset another app.

## 4. Phase 1 — Build the source-of-truth matrix BEFORE coding

Create a temporary audit table in the work notes or test output with one row per managed app.

At minimum audit:

- Software Blueprint Hub
- Bơi ếch
- Health_Care
- RU_LIFE
- Bauman Master AI
- PriceReport Tùng Gia Bảo
- PC Manager
- NC03 Modem
- CAD CAM 3D
- GrowUP MyChildren
- every Dynamic Catalog app discovered at runtime

Required columns:

| Field | Required |
|---|---|
| appId | yes |
| inventory source | static / dynamic / merged |
| managementMode | yes |
| contractConnected | yes |
| remoteAdminReady | yes |
| autoApprove supported | yes |
| autoApprove read endpoint/source | exact |
| autoApprove write endpoint/source | exact |
| autoBlockPending supported | yes |
| autoBlock read/write source | exact |
| special policy parameters | e.g. Bơi ếch free days/device limit |
| credential requirement | yes |
| current live value readable | yes/no + reason |
| mutation currently possible | yes/no + reason |
| persistence owner | exact client/backend |
| readback after write | exact |
| fallback source | if any |
| last verified semantics | exact |

Do not code until this matrix makes it obvious why each app is editable, read-only or unavailable.

## 5. Phase 2 — Reproduce the persistence mismatch

Create deterministic tests that reproduce all of these sequences.

### Scenario A — single app

1. Open policy editor.
2. Capture "Đang áp dụng".
3. Change one field for one app.
4. Confirm no network mutation occurs before Save.
5. Press Save.
6. Confirm exactly the intended app/field is sent.
7. Confirm client persistence changes.
8. Confirm live readback matches.
9. Close/reopen editor.
10. Confirm the same value is shown as "Đang áp dụng".

### Scenario B — multiple apps in one Save

Change at least 3 apps in one draft.

Verify:

- independent payloads / transaction boundaries;
- no cross-app overwrite;
- one app failure does not corrupt successful apps;
- successful apps reopen with their verified state;
- failed app still shows its previous verified state plus the failed draft/result.

### Scenario C — app unavailable during Save

Verify:

- no fake success;
- last verified value remains visible;
- draft is not mislabeled as applied;
- retry does not affect another app.

### Scenario D — refresh/reopen

After a successful save, force a new bootstrap/read.

The UI must reconstruct state from the client-owned source of truth, not from stale React state and not from a success toast.

### Scenario E — fallback only

Simulate live policy read failure with a central audit fallback available.

UI must visibly label it as **last known / chưa xác minh live**.

It must not look identical to a verified live configuration.

## 6. Canonical state model required

The implementation should converge on a per-app model similar in semantics to:

```ts
type AppAutomationPolicySnapshot = {
  appId: string;

  support: {
    autoApprove: boolean;
    autoBlockPending: boolean;
    freeAccessPolicy: boolean;
  };

  current: {
    autoApprove?: boolean;
    autoBlockPending?: boolean;
    pendingBlockAfterHours?: number;
    freeAccessDays?: number;
    freeDeviceLimit?: number;
  };

  verification: {
    state: "live" | "fallback" | "unavailable" | "unsupported";
    source: string;
    lastVerifiedAt?: string;
    errorCode?: string;
  };

  mutation: {
    ready: boolean;
    reason?: string;
  };
};
```

This is a semantic requirement, not a command to copy this type verbatim.

The important part is: **support, current value, verification/provenance and write readiness must not be conflated.**

## 7. UI behavior — fixed and predictable

The editor must no longer behave like a collection of toggles that indirectly change each other.

For every app show two explicit layers:

### Đang áp dụng

Read-only presentation of the last verified client-owned policy:

- Duyệt thủ công / Tự động duyệt
- quá hạn: giữ chờ / tự động từ chối & khóa
- timeout if supported
- Bơi ếch free policy parameters if applicable
- verification badge:
  - Live
  - Last known
  - Read-only
  - Unsupported
  - Unavailable

### Thay đổi

Editable draft controls only when the exact capability is writable.

Rules:

- changing a draft must never mutate server state;
- changing app A must never change app B's draft;
- layout height/position should remain stable;
- do not hide/show controls in a way that makes neighboring controls jump;
- unsupported fields remain visible when useful but disabled with a concrete reason;
- dynamic apps must appear from the canonical managed-app inventory, not require a dashboard code edit.

### Save

There is one primary **Lưu thay đổi** action.

On click:

1. compute an exact diff against verified current state;
2. if no diff: close or report "Không có thay đổi";
3. show exactly one confirmation summarizing all intended changes;
4. after confirmation, persist each changed app independently;
5. read back each app;
6. show one combined result summary;
7. preserve per-app success/failure details in the panel or a reopenable result area.

Do not ask extra confirmations for ordinary non-destructive policy changes.

## 8. Generic contract direction

Prefer a generic automation-policy capability through Dynamic/Universal Contract rather than continuing to add app-specific UI/server branches.

Evaluate a backward-compatible extension such as capabilities/endpoints for:

- automation policy read;
- automation policy write;
- auto approve;
- auto block pending;
- optional typed policy parameters.

Requirements:

- backward compatible with existing `application-management.contract/v1` consumers;
- legacy adapters remain fallback until parity is proven;
- capability defaults false;
- no inferred permission from category/name;
- read endpoint and write endpoint must be explicitly validated;
- write requires suitable guardrails/credential;
- live readback remains mandatory.

If the current v1 schema cannot safely express this, document the minimal extension instead of hacking around it.

## 9. Special app semantics that must be preserved

### Bơi ếch

Do not collapse Miễn phí / Trả phí semantics into generic approval.

Paid access still requires payment verification.

Free automation parameters belong to Bơi ếch and must round-trip exactly.

### Health_Care

Do not bring health/business data into Application Management.

Only policy/registry metadata necessary for management may cross the boundary.

### RU_LIFE

Preserve client-owned registry/session/user-binding semantics.

### Bauman

Preserve owner/capability and production-readiness guards.

### PriceReport / GrowUP / CAD / PC Manager / NC03 / metadata-only apps

Do not claim mutation readiness until their actual production contract/backend supports it.

If they are intentionally read-only/local-first, make the UI say so instead of showing a broken-looking control.

## 10. Persistence invariants

Every write must satisfy all applicable invariants:

1. exact appId;
2. exact policy field(s);
3. no unrelated app included in target set;
4. owner/role verified;
5. contract capability verified;
6. credential/readiness verified;
7. write sent to owning client;
8. owning client persists;
9. readback is performed;
10. readback equals desired value;
11. only then mark as saved/live;
12. audit records actual values, not hard-coded approximations;
13. fallback includes provenance and does not masquerade as live.

## 11. Required automated tests

At minimum add/update tests for:

- policy editor uses canonical merged managed-app inventory;
- static-only and dynamic apps are not accidentally duplicated;
- drafts are independent per app;
- no mutation before Save;
- exact diff generation;
- exactly one user confirmation per Save;
- per-app isolated writes;
- partial success handling;
- readback mismatch = failure;
- reopen after save reproduces live verified values;
- fallback is visibly distinct from live;
- unsupported/read-only reasons are rendered;
- Bơi ếch parameters round-trip exactly;
- audit stores actual values;
- dynamic contract automation capability discovery;
- legacy fallback parity;
- app A cannot mutate app B;
- bootstrap/focus refresh remains read-only;
- no approved/blocked device mutation is reintroduced into central pending-device review.

Prefer behavioral tests over source-string tests where practical.

## 12. End-to-end acceptance gate

Do not declare this task complete until the following table can be filled with evidence:

| Gate | PASS requirement |
|---|---|
| Inventory | every managed app accounted for |
| Current state | panel shows verified applied policy or explicit unavailable/unsupported |
| Draft isolation | changing one app cannot move/change another |
| Save | one confirmation, exact diff |
| Persistence | owning client stores intended values |
| Readback | exact values returned |
| Reopen | saved values reappear correctly |
| Partial failure | successful apps remain successful |
| Dynamic apps | no central source edit required merely to appear |
| Unsupported apps | clear reason, no fake controls |
| Security | no cross-app authority/credential leakage |
| CI | all relevant tests green |
| Production | NOT published without explicit release approval |

## 13. Required final report

When implementation is complete, report only evidence-backed results:

1. root causes found;
2. files changed;
3. policy state architecture before → after;
4. app-by-app capability matrix;
5. tests added/changed and results;
6. any app still not editable and the exact legitimate reason;
7. commit SHA;
8. CI status;
9. explicitly state whether Production was published.

Do not report "fixed" merely because the UI compiles.

## 14. Stop conditions

Stop and surface the exact blocker instead of inventing behavior when:

- client contract is missing;
- Production origin is unknown;
- credential is missing;
- mutation capability is not published;
- readback cannot verify the write;
- a change would violate client data sovereignty;
- a generic contract change requires migration beyond this repository.

The correct result can be **read-only with a precise reason**. A fake editable control is a failure.

---

## Execution command

**Execute this prompt as a single root-cause repair program. First produce the app capability/source-of-truth matrix and failing tests. Only then modify implementation. Continue through tests and CI until the acceptance gate is satisfied or a real external client/backend blocker is proven. Do not perform unrelated refactors and do not publish Production without explicit authorization.**
