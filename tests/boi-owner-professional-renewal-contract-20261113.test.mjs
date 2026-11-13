import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read=p=>fs.readFileSync(new URL("../app/"+p,import.meta.url),"utf8");

test("Owner manager renewal exposes six absolute choices and remaining years/months",()=>{
 const ui=read("apps/boi-ech/account-expiry-panel.tsx");
 const client=read("boi-access-client.ts");
 for(const period of ["7d","30d","6m","1y","4y","forever"])
  assert.match(ui,new RegExp('option value="'+period+'"'));
 assert.match(ui,/commitAccount\("set-preset"\)/);
 assert.match(ui,/period:preset/);
 assert.match(ui,/remainingLabel/);
 assert.match(ui,/operation:"set-expiry"\|"set-preset"/);
 assert.match(client,/operation:"set-expiry"\|"set-preset"/);
});
test("Owner proxy forwards chosen period to BOI instead of stripping it",()=>{
 const proxy=read("api/apps/boi-ech/account-entitlements/route.ts");
 assert.match(proxy,/period:input\.period/);
 assert.match(proxy,/action:"set-entitlement"/);
});
test("One-time deletion protects exact THREE and cannot execute with only two",()=>{
 const p=read("apps/boi-ech/owner-once-roster-reset-panel.tsx");
 const api=read("api/apps/boi-ech/once-roster-reset/route.ts");
 const client=read("boi-access-client.ts");
 assert.match(p,/protectQuynh:current\.protectedPeople\[2\]\.deviceId/);
 assert.match(p,/next\.protectedCount!==3/);
 assert.match(api,/typeof input\.protectQuynh!=="string"/);
 assert.match(api,/data\.protectedPeople\.length!==3/);
 assert.match(client,/protectSon:string;protectNghi:string;protectQuynh:string/);
});
