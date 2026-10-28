# Central Device Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline; one final independent whole-branch review. Steps use checkbox syntax.

**Goal:** Common device administration in App Management changes and verifies the owning apps directly.

**Architecture:** Existing signed central adapters remain the only writers; no duplicate registry. A filtered central inventory exposes live capabilities, with Boi classification and common access controls inline.

**Tech Stack:** TypeScript, React 19, Vinext, Workers/D1, Node tests, existing JSDOM.

**Spec:** docs/superpowers/specs/2026-10-28-central-device-management-design.md

## Global Constraints
- Cloudflare is the selected official runtime; preserve dormant App Management publication gates.
- Preserve P-256 authentication, actor roles, paid classification, expiry, app-owned data and unrelated device identities.
- Never report command success without independent owning-app readback.
- Use locked existing dependencies; no new runtime services or libraries.

## Review Focus
- A blocked paid/expired teacher must not become free or gain a fresh expiry through unblock.
- Stale snapshots, missing expected state or upstream failures must not report success.
- Device switches/refreshes must not retain another device's payment proof or grant controls.
- Pending defaults must coexist with approved/blocked filters and correct action capabilities.
- Failed readback must be distinguishable from a command that was never applied.

### Task 1: Common access command contract
**Files:** Boi `boi-ech/app/api/control/overview/route.ts`; management `app/api/apps/boi-ech/access/route.ts`, `app/boi-access-client.ts`, `app/open-contract.server.ts`, `app/api/operations/route.ts`; focused runtime tests in each owner.
**Interfaces:** Boi management access operations add block/unblock, require expectedStatus/paymentStatus/accessGroup, preserve classification/expiry; generic device commands add capability-gated unblock and set-edit-permission with verified readback.
- [x] Write behavioral tests exercising actual route functions at the HTTP/DB boundary: block/unblock preservation, stale/unauthorized/missing expectations, failed readback; run RED.
- [x] Implement the smallest route/client changes and owning-app compare-and-swap for block/unblock.
- [x] Run focused runtime tests GREEN and existing relevant contracts; commit.

### Task 2: Central inventory and inline administration
**Files:** `app/management-dashboard-v2.tsx`, `app/boi-access-view.tsx`, new focused central inventory component/CSS and behavioral UI tests; update superseded pending-only assertions.
**Interfaces:** All-status inventory has initial pending filter; exact Boi `deviceId` panel reuses BoiAccessView and invokes onChanged for shared refresh; generic actions consume existing canApprove/canRemove/canUnblock/canEditPermission.
- [x] Write real React/JSDOM tests for filters, exact-device isolation, inline Boi dispatch, capability buttons and duplicate-click protection; run RED.
- [x] Implement inline panel, all-status inventory and command refresh behavior. Keep irreversible Boi deletion separate and unchanged.
- [x] Run focused UI tests GREEN, full npm test and publication-hold checks; review whole branch independently and fix material findings.
- [ ] Publish reviewable GitHub candidate(s) with exact head/test evidence and remaining production acceptance. No silent publication reactivation.
