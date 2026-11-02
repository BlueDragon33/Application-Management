import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const get=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const api=get("app/api/operations/route.ts");
const page=get("app/apps/boi-ech/boi-ech-control-center.tsx");
const ui=get("app/apps/boi-ech/boi-manager-grants.tsx");
test("central Owner proof and role gate protect every manager-tier action",()=>{
 assert.match(api,/if \(action === "boi-manager-access"\)/);
 assert.match(api,/if \(actor\.role !== "owner"\)/);
 assert.match(api,/\["get-tier-limits","set-tier-limits","grant-manager","get-manager-grant"\]/);
 assert.match(api,/issueBoiBrowserBridge\(actor\.email,actor\.role\)/);
 assert.match(api,/bridgeJson\(bridge,"\/api\/control\/management-access"/);
});
test("Owner UI writes global 50\/5 limits only after independent GET",()=>{
 assert.match(ui,/useState\("50"\)/);
 assert.match(ui,/useState\("5"\)/);
 assert.match(ui,/action:"set-tier-limits"/);
 assert.match(ui,/await invoke\(\{action:"get-tier-limits"\}\)/);
 assert.match(ui,/verified\.learnerLimit!==l\|\|verified\.teacherLimit!==t/);
});
test("manager grant and revocation require separate D1 verification",()=>{
 assert.match(ui,/action:"grant-manager"/);
 assert.match(ui,/action:"get-manager-grant"/);
 assert.match(ui,/read\.managementEnabled!==enabled/);
 assert.match(ui,/lock\.current=true/);
 assert.match(page,/access\.role === "owner" \? <BoiManagerGrants/);
 assert.match(page,/onUpdated=\{async\(\)=>\{await refresh/);
});
