import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const server=fs.readFileSync("app/api/apps/boi-ech/account-entitlements/route.ts","utf8");
const client=fs.readFileSync("app/boi-access-client.ts","utf8");
const panel=fs.readFileSync("app/apps/boi-ech/account-expiry-panel.tsx","utf8");
const center=fs.readFileSync("app/apps/boi-ech/boi-ech-control-center.tsx","utf8");
const auth=fs.readFileSync("worker/production-auth.ts","utf8");

test("account-entitlement actions require verified Owner and signed Boi control bridge",()=>{
 assert.match(server,/verifyControlProof/);
 assert.match(server,/actor\.role!=="owner"/);
 assert.match(server,/issueBoiAccountBridge/);
 assert.match(server,/\/api\/control\/accounts/);
 assert.match(server,/accountId:input\.accountId/);
 assert.doesNotMatch(server,/CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID/);
});
test("Owner mutations require independent readback and session MFA step-up",()=>{
 assert.match(server,/ACCOUNT_READBACK_MISMATCH/);
 assert.match(server,/ACCOUNT_READBACK_UNVERIFIED/);
 assert.match(server,/verified:true/);
 assert.match(auth,/account-entitlements/);
 assert.match(auth,/set-account/);
 assert.match(auth,/set-policy/);
 assert.match(auth,/STEP_UP_TTL_SECONDS = 30 \* 60/);
});
test("account UI is distinct from device expiry and never tells Owner false success",()=>{
 assert.match(panel,/Account First V2/);
 assert.match(panel,/30 ngày từ lúc hoàn tất hồ sơ và kích hoạt/);
 assert.match(panel,/changeBoiDefaultAccountDays/);
 assert.match(panel,/changeBoiAccountDuration/);
 assert.match(panel,/Tạm khóa/);
 assert.match(panel,/Europe\/Moscow/);
 assert.match(center,/tab==="policies" && access\.role==="owner"/);
 assert.match(center,/<AccountExpiryPanel section="policies"/);
 assert.match(client,/if\(response\.verified!==true\)/);
 assert.doesNotMatch(panel,/cloudflare-preview\.server|Cloudflare token hết hạn/);
});
