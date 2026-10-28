# Central device administration

Owner request: App Management is the shared administration surface. Preliminary device review and common permissions must work here, with effective changes in the owning applications. App-specific administration remains for specialized work. Cloudflare is the selected official runtime. The owner previously opted out of repeated design questionnaires.

## Design
Use the existing authenticated adapters and Universal Management Contract, not another device database. Show pending, approved and blocked devices with an explicit status filter. Keep pending as the initial queue. Enable commands only for the actor and live capability; show source-confirmed results. Preserve each app's permissions and payment rules.

Boi classification opens an inline, exact-device access panel within the device review page. Reuse its real Free/Paid, payment evidence and renewal controls. Add non-destructive block/unblock there; do not conflate blocking with permanent deletion. A blocked record must be explicitly unblocked before a grant/renewal. The original expiry and paid classification survive unblock. Refresh both the access panel and shared device list after commands. Ordinary supported apps can be blocked after approval, unblocked or have edit permission changed where their live contract allows it.

Common automation continues to use the existing per-app policy writer and independent readback. Shared scope means one administration surface and effective writes to selected app owners; do not merge unrelated origin-bound P-256 identities or copy personal/domain data across apps. Do not invent permissions for an app without a working contract.

## Approaches
1. Duplicate all records centrally: rejected because it creates competing authority and requires unsafe identity/data migration.
2. Only add links to app administration: rejected because the owner explicitly needs common operations without entering each app.
3. Extend the existing central adapters and inline controls: chosen implementation judgment; preserves working authentication, app sovereignty and readback.

## Release boundary
Keep current production/preview/bootstrap publication holds. A reviewed, verified code candidate is required before any separately authorized reactivation of App Management's dormant production workflow. No native Sites deployment, migration or mass grants in this feature. Record all unverified live acceptance explicitly.
