import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("Application-Management is an app catalog, not ChatGPT Project task executor",()=>{
 const route=read("app/apps/russian-daily/page.tsx");
 assert.match(route,/requireChatGPTUser/);
 assert.match(route,/getApplicationConfig\("russian-daily"\)/);
 assert.doesNotMatch(route,/RussianDailyNextAction|next-action-controls|<button[^>]*ACTIVE NEXT ACTION/);
 assert.doesNotMatch(route,/createDeployment|workflow_dispatch|window\.location/);
 assert.equal(existsSync(new URL("../app/apps/russian-daily/actions.ts",import.meta.url)),false);
 assert.equal(existsSync(new URL("../app/apps/russian-daily/next-action-controls.tsx",import.meta.url)),false);
});
test("Russian Daily remains pending without invented public URL",()=>{
 const registry=read("app/application-registry.ts");
 const start=registry.indexOf('id: "russian-daily"');
 assert.ok(start>0);
 const block=registry.slice(start,registry.indexOf("\n  },",start));
 assert.match(block,/status: "planned"/);
 assert.match(block,/contractState: "pending"/);
 assert.doesNotMatch(block,/publicUrl:/);
});
