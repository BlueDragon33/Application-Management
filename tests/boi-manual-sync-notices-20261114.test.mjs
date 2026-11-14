import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const owner=readFileSync(new URL("../app/apps/boi-ech/boi-ech-control-center.tsx",import.meta.url),"utf8");
const overview=readFileSync(new URL("../app/apps/boi-ech/boi-owner-overview.tsx",import.meta.url),"utf8");
const inbox=readFileSync(new URL("../app/apps/boi-ech/manual-sync-notices.ts",import.meta.url),"utf8");
const api=readFileSync(new URL("../app/boi-access-client.ts",import.meta.url),"utf8");
const skin=readFileSync(new URL("../app/apps/boi-ech/boi-ech-shell.module.css",import.meta.url),"utf8");

test("owner dashboard never polls every minute for updated records",()=>{
 assert.doesNotMatch(owner,/window.setInterval\(\(\) => void refresh/);
 assert.doesNotMatch(owner,/window.setInterval\(\) => \{void check/);
 assert.match(owner,/Approved devices never poll the owner dashboard/);
 assert.match(owner,/const verified=await refresh\(credential,access,\{discoverNew:true\}\)/);
 assert.match(owner,/if\(verified\)ackManualSync\(observed\)/);
});
test("both Owner manual sync controls show numeric, not fabricated server counts",()=>{
 assert.match(owner,/useBoiSyncNotices\("owner"\)/);
 assert.match(owner,/boi-manual-sync-badge/);
 assert.match(owner,/manualSyncCount>0/);
 assert.match(owner,/onClick=\{\(\)=>void manualSync\(\)\}/);
 assert.match(overview,/useBoiSyncNotices\("owner"\)/);
 assert.match(overview,/unread>0\?<span className="boi-manual-sync-badge"/);
 assert.match(overview,/awaitingManualAck.current=\[\.\.\.unreadIds\]/);
 assert.match(overview,/acknowledge\(awaitingManualAck.current\)/);
 assert.match(overview,/awaitingManualAck.current=null; \/\/ keep the badge/);
});
test("single badge represents only received deduplicated events in this browser",()=>{
 assert.match(inbox,/sessionStorage.getItem\(storageKey\(scope\)\)/);
 assert.match(inbox,/existing.some\(row=>row.id===item.id\)/);
 assert.match(inbox,/scopeValid\(scope\)/);
 assert.match(inbox,/BroadcastChannel\(channelName\)/);
 assert.match(inbox,/window.addEventListener\("storage",onStorage\)/);
 assert.match(inbox,/boi:manual-sync:acknowledged/);
 assert.doesNotMatch(inbox,/setInterval|fetch\(/);
});
test("Owner mutations only notify other tabs AFTER server confirms verified write",()=>{
 assert.match(api,/if\(result.verified===true && typeof body.action==="string"/);
 assert.match(api,/broadcastBoiChange\("owner"\)/);
 assert.match(api,/!\\["list","policy","capacity","manager-inbox","manager-policy"\\].includes\(body.action\)/);
 assert.match(owner,/if\(access\?\.role==="owner"\)broadcastBoiChange\("owner"\)/);
});
test("all Owner sync buttons are accessible, contrasted, and never auto-submit a queue",()=>{
 assert.match(skin,/boi-manual-sync-control/);
 assert.match(skin,/boi-manual-sync-badge/);
 assert.match(skin,/:focus-visible/);
 assert.match(skin,/background:#b91c43/);
 assert.match(owner,/disabled=\{checking\|\|!online\}/);
 assert.match(overview,/disabled=\{loading\}/);
});
test("pending manager device approval uses event-based checks and never a 60-second polling loop",()=>{
 assert.doesNotMatch(owner,/const timer = window.setInterval\(\(\) => \{\s*register\(credential\)/);
 assert.match(owner,/const validate=\(\)=>\{/);
 assert.match(owner,/navigator.serviceWorker\?\.addEventListener\("message",onMessage\)/);
 assert.match(owner,/window.addEventListener\("online",validate\)/);
});
