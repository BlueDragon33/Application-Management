# D07 — Bauman-Russian-iOS Windows localhost/offline acceptance (scoped)

**Acceptance date:** 2026-10-17 (user-reported local observation)  
**Authority:** Project owner/user personally confirmed local observation in conversation, not a GitHub APPROVED review or Production approval.  
**Status:** **PASS — LOCAL CATALOG UI + OFFLINE FILTERING ONLY**  
**Constitution:** Blueprint OS 1.3.0 R15–R20; preserve product goal and authority boundaries.

## What was actually observed

The user supplied screenshots from their Windows Cốc Cốc browser with the address
`127.0.0.1:3000/projects?utm_source=chatgpt.com`, showing:

- A loaded `Toàn bộ dự án GitHub` page, filtered to `Bauman Russian iOS`.
- One `Bauman Russian iOS` project card for `BlueDragon33/Bauman-Russian-iOS`.
- The `Đang phát triển` label and `Thuộc Bauman Master AI` relation.
- `Code`, `Issues`, `Actions` links, **without** a fake `Quản trị`/native launcher on the iOS card.
- The user explicitly attested that at capture time Windows Internet access
  was disconnected, App-manager continued running at localhost, and the
  search field still returned the iOS project **without reloading the page**.

Evidence source: user-provided image(s) and explicit owner confirmation in
the Bauman-Russian-iOS conversation on 2026-10-17. Images were inspected in
conversation and have **not** been committed as GitHub evidence; this record
is a qualified manual observation, not a reproduced user-device test.
The actual checked-out commit on the owner's Windows PC was **not independently
read back**; the user had been guided to branch
`feature/bauman-russian-ios-developing-catalog`.
Do not assert that a PR SHA was proven on the user's PC.

## Independent engineering regression

- Draft PR: https://github.com/BlueDragon33/Application-Management/pull/362
- Engineering source SHA (not user PC readback):
  `6a2416213acb92987c81ad8522f4597d4282e075`.
- GitHub Windows Edge localhost local-dev browser:
  https://github.com/BlueDragon33/Application-Management/actions/runs/39005318909
- Development Fast CI:
  https://github.com/BlueDragon33/Application-Management/actions/runs/39005318890
- Constitution:
  https://github.com/BlueDragon33/Application-Management/actions/runs/39005319119
- These runs passed on the listed SHA. They are independent technical evidence
  and do **not** impersonate the human's Windows/Apple authority.

## Scope and explicit non-claims

**PASS:** Windows user-visible project directory and client-side search while
Internet is disconnected, with an existing running localhost server; truthful
metadata-only iOS entry in the viewed local development application.

**NOT ESTABLISHED / NOT TESTED:**
- GitHub `main` adoption, formal App-manager Dynamic Catalog enrollment,
  a native iOS launcher, remote administration or device management.
- Rebooting Windows and relaunching an entirely offline development server.
- Native app installed on iPhone or iPad; signed entitlements or App Group
  on physical Apple devices; lock-screen Widget hourly rotation in reality.
- RU03 content review, production signing, app distribution or release.
- Authentication as a Production Owner or release authority.

**Previous intermittent errors:** screenshot(s) showed offline HTML and
`ERR_CONNECTION_REFUSED`; later localhost page loaded successfully. This
manual acceptance covers the recovered view, not a proof that startup/port
reliability is fixed for every Windows environment. Do not silently erase
those earlier symptoms.

## Blueprint OS next dependency

Proceed with a narrowly scoped **unsigned iphoneos device-target compilation
and artifact provenance preflight** on authorized GitHub macOS CI: app +
WidgetKit extension, bundle IDs, arm64 and zero embedded RU03/release keys.
Mark this artifact explicitly **NOT SIGNED / NOT INSTALLABLE** and never
request Apple Account passwords, signing private keys or production secrets
for CI. Evaluate actual free Personal Team provisioning and App Group
eligibility before proposing a phone-install path. Personal Team signing
ordinarily uses Xcode; Windows and iPad alone do not prove a full WidgetKit
installation path. Keep device scenarios D01–D06 **BLOCKED** until an
authorized genuine device test is possible.

**Release gates remain locked:** no self-review/ratification, merge, publish,
RU03 approval or device acceptance implied by this manual D07 checkpoint.
