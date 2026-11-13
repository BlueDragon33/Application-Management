import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const file=(name)=>fs.readFileSync(new URL("../app/"+name,import.meta.url),"utf8");

test("Owner counts existing D1 manager records, not falsely verified/approved profiles",()=>{
 const s=file("apps/boi-ech/account-expiry-panel.tsx");
 assert.match(s,/Hồ sơ đang tồn tại/);
 assert.doesNotMatch(s,/Hồ sơ đã xác minh/);
 assert.match(s,/managerInbox\.length/);
 assert.match(s,/m\.onboardingStage==="active"&&m\.status==="approved"\?"done"/);
 assert.match(s,/m\.onboardingStage==="active"\|\|m\.onboardingStage==="suspended"\?"done"/);
 assert.match(s,/managerAccessLabel\(m\)/);
});
test("Owner manager roster refreshes canonical BOI account state without manual click",()=>{
 const s=file("apps/boi-ech/account-expiry-panel.tsx");
 assert.match(s,/setInterval\(resync,20000\)/);
 assert.match(s,/document\.visibilityState==="visible"/);
 assert.match(s,/document\.addEventListener\("visibilitychange",resync\)/);
 assert.match(s,/document\.removeEventListener\("visibilitychange",resync\)/);
 assert.match(s,/await loadBoiManagerInbox\(after\)/);
});
test("Owner account dropdown is a modal portal with Escape/backdrop close, focus trap and unclip CSS",()=>{
 const ui=file("apps/boi-ech/boi-ech-control-center.tsx");
 const css=file("globals.css");
 assert.match(ui,/createPortal\(/);
 assert.match(ui,/className="boi-owner-account-modal-backdrop"/);
 assert.match(ui,/role="dialog" aria-modal="true"/);
 assert.match(ui,/onMouseDown=\{event=>\{if\(event\.target===event\.currentTarget\)/);
 assert.match(ui,/event\.key==="Escape"/);
 assert.match(ui,/event\.key!=="Tab"/);
 assert.match(ui,/document\.body\.style\.overflow="hidden"/);
 assert.match(ui,/document\.body\.style\.overflow=previousOverflow/);
 assert.match(ui,/accountTriggerRef\.current\.focus/);
 assert.match(css,/\.boi-owner-account-modal-backdrop\{\s*position:fixed;inset:0;z-index:9999/);
 assert.match(css,/max-height:calc\(100dvh - 32px\)/);
});
