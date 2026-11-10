import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=new URL("../",import.meta.url);
const read=p=>readFileSync(new URL(p,root),"utf8");

test("R2 Owner manager approval is singular under the matched BOI gate",()=>{
 const panel=read("app/apps/boi-ech/account-expiry-panel.tsx");
 const route=read("app/api/apps/boi-ech/account-entitlements/route.ts");
 assert.match(panel,/NEXT_PUBLIC_BOI_ECH_SINGLE_REVIEW/);
 assert.match(panel,/!singleReview\|\|Boolean\(managerError\)/);
 assert.doesNotMatch(panel,/Duyệt vòng 2 — kích hoạt/);
 assert.match(panel,/Duyệt một lần · Chờ hoàn thiện hồ sơ/);
 assert.match(panel,/30 ngày từ lúc hoàn tất hồ sơ và kích hoạt/);
 assert.match(route,/if\(actor.role!=="owner"\)/);
 assert.match(route,/BOI_REVIEW_SUPERSEDED/);
 assert.match(route,/BOI_SINGLE_REVIEW_UNVERIFIED/);
 assert.match(route,/action==="manager-review-final" \|\| action==="manager-review-changes"/);
 assert.ok(route.indexOf("if(actor.role!==\"owner\")")<route.indexOf('BOI_REVIEW_SUPERSEDED'));
});
test("R2 Owner UI retains MFA, readback and scoped learner-manager separation",()=>{
 const panel=read("app/apps/boi-ech/account-expiry-panel.tsx");
 const route=read("app/api/apps/boi-ech/account-entitlements/route.ts");
 assert.match(panel,/Authenticator trong 30 phút/);
 assert.match(panel,/giảng viên và học viên do cán bộ quản lý xử lý/);
 assert.match(route,/ACCOUNT_READBACK_MISMATCH/);
 assert.match(route,/verifyControlProof/);
 assert.match(route,/expectedRevision/);
});


test("R2: Windows offline APP forwards matched one-review flag only into local serve Worker",()=>{
 const vite=read("vite.config.ts");
 assert.match(vite,/"NEXT_PUBLIC_BOI_ECH_SINGLE_REVIEW"/);
 assert.match(vite,/if \(command !== "serve"\) return undefined/);
 assert.match(vite,/const vars = localRuntimeVars\(command\)/);
});
