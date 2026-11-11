import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("R5 Owner visual retains V5 one-review fail-closed guards",()=>{
 const ui=read("app/apps/boi-ech/account-expiry-panel.tsx");
 const client=read("app/boi-access-client.ts");
 const api=read("app/api/apps/boi-ech/account-entitlements/route.ts");
 assert.match(ui,/setManagerInbox\(null\);setManagerNext\(null\)/);
 assert.match(ui,/managerInbox===null\|\|m.status!=="pending"/);
 assert.match(ui,/data\.applied!==false/);
 assert.match(ui,/AuthenticatorStepUp/);
 assert.match(client,/action:"manager-review-first",accountId:string/);
 assert.doesNotMatch(ui,/manager-review-final|manager-review-changes|Duyệt vòng 2/);
 assert.match(api,/BOI_SINGLE_REVIEW_BACKEND_UNVERIFIED/);
 assert.match(api,/BOI_REVIEW_SUPERSEDED/);
});
test("Owner navigation is independently scrollable and no legacy device grants",()=>{
 const css=read("app/apps/boi-ech/boi-ech-shell.module.css");
 const ui=read("app/apps/boi-ech/boi-ech-control-center.tsx");
 assert.match(css,/max-height:100dvh;overflow:hidden!important/);
 assert.match(css,/flex:1 1 auto;min-height:0;overflow-y:auto/);
 assert.match(ui,/canManage=\{false\}/);
 assert.match(ui,/canDelete=\{false\}/);
});

test("MFA-denied mutations are explicitly unapplied; an unknown outcome cannot be replayed",()=>{
 const gate=read("worker/production-auth.ts");
 const ui=read("app/apps/boi-ech/account-expiry-panel.tsx");
 assert.match(gate,/code: "STEP_UP_REQUIRED",[\\s\\S]*?applied: false/);
 assert.match(ui,/data\\.applied!==false/);
 assert.match(ui,/return operation\\(\\)/);
});
