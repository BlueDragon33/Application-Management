import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("V5: Owner V2 invitation, one approval, duration, policy and local test reset share enrolled 30m MFA gate",()=>{
 const worker=read("worker/production-auth.ts");
 const start=worker.indexOf('if(pathname==="/api/apps/boi-ech/account-entitlements"');
 const end=worker.indexOf("if (!state.enabled || stepUpFresh(identity)) return null;",start);
 assert.ok(start>0 && end>start,"Owner gate must precede legacy fallback");
 const gate=worker.slice(start,end);
 for(const action of ["issue-manager-invite","manager-review-first","manager-review-final",
  "manager-review-changes","set-account","set-policy","manager-delete-local"])
  assert.ok(gate.includes('"'+action+'"'),"missing enforced MFA action "+action);
 assert.match(gate,/!state\.enabled \|\| !stepUpFresh\(identity\)/);
 assert.match(worker,/const STEP_UP_TTL_SECONDS = 30 \* 60/);
 assert.match(worker,/UPDATE control_sessions SET step_up_at=\?2 WHERE session_id_hash=\?1/);
});
test("V5: Owner API rejects forged legacy second review before bridge mutation, and verifies BOI's live mode",()=>{
 const route=read("app/api/apps/boi-ech/account-entitlements/route.ts");
 assert.match(route,/BOI_REVIEW_SUPERSEDED/);
 assert.match(route,/BOI_SINGLE_REVIEW_BACKEND_UNVERIFIED/);
 assert.match(route,/accountSingleReview===true/);
 const forbidden=route.indexOf('if(action==="manager-review-final" || action==="manager-review-changes")');
 const bridge=route.indexOf("const bridge=await issueBoiBrowserBridge");
 assert.ok(forbidden>0&&forbidden<bridge,"legacy action should be blocked before obtaining bridge");
 assert.match(route,/if\(actor\.role!=="owner"\)/);
});
test("V5: Owner UI never offers a second review or treats failed queue as verified zero",()=>{
 const ui=read("app/apps/boi-ech/account-expiry-panel.tsx");
 const overview=read("app/apps/boi-ech/boi-owner-overview.tsx");
 assert.doesNotMatch(ui,/Duyệt vòng 2 — kích hoạt|Owner duyệt hai vòng/);
 assert.doesNotMatch(overview,/Mời, duyệt hai vòng/);
 assert.match(ui,/setManagerInbox\(null\);setManagerNext\(null\)/);
 assert.match(ui,/canChangeManagers = singleReview && managerReviewReady/);
 assert.match(ui,/disabled=\{!canChangeManagers\}/);
 assert.match(overview,/setSnapshot\(null\)/);
});

test("V5: manager device registry cannot duplicate Owner approval or delete Account-first identities",()=>{
 const center=read("app/apps/boi-ech/boi-ech-control-center.tsx");
 const route=read("app/api/apps/boi-ech/access/route.ts");
 assert.match(center,/canManage=\{false\}/);
 assert.match(center,/canDelete=\{false\}/);
 assert.match(route,/BOI_MANAGER_LEGACY_GRANT_SUPERSEDED/);
 assert.match(route,/operation==="manager-access" && process\.env\.NEXT_PUBLIC_BOI_ECH_SINGLE_REVIEW==="true"/);
});
