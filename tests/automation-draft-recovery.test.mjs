import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {AUTOMATION_DRAFT_KEY,validateAutomationDraft,readAutomationDraft,
 writeAutomationDraft,clearAutomationDraft} from "../app/device-automation-draft.mjs";

const modal=readFileSync("app/automatic-device-policies.tsx","utf8");
const dashboard=readFileSync("app/management-dashboard-v2.tsx","utf8");
const css=readFileSync("app/automatic-device-policies.module.css","utf8");
const input={drafts:{"bauman-master-ai":{autoApprove:true,autoBlock:true,pendingBlockAfterHours:168},
  "health-care":{autoApprove:false,autoBlock:false,pendingBlockAfterHours:24}},days:90,limit:2};
function memoryStorage(){
 const values=new Map();
 return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),
   removeItem:key=>values.delete(key),values};
}
test("local desired policy persists and reads back exactly; NEVER applied to client",()=>{
 const st=memoryStorage();const r=writeAutomationDraft(st,input);
 assert.equal(r.saved,true);assert.equal(r.appliedToClient,false);
 assert.equal(r.source,"browser-local-only");
 assert.equal(st.values.has(AUTOMATION_DRAFT_KEY),true);
 assert.equal(readAutomationDraft(st).drafts["bauman-master-ai"].autoBlock,true);
});
test("storage denial or readback mismatch never claims persisted",()=>{
 assert.equal(writeAutomationDraft({setItem(){throw Error("quota");}},input).saved,false);
 const fake={setItem(){},getItem(){return null;}};
 assert.equal(writeAutomationDraft(fake,input).reason,"DRAFT_READBACK_MISMATCH");
});
test("malformed, future-schema, invalid policy values fail closed",()=>{
 const st=memoryStorage();assert.equal(validateAutomationDraft({...input,days:-1}),null);
 assert.equal(validateAutomationDraft({...input,drafts:{"app/evil":input.drafts["health-care"]}}),null);
 st.setItem(AUTOMATION_DRAFT_KEY,JSON.stringify({...input,schema:99}));
 assert.equal(readAutomationDraft(st),null);
});
test("clearing pending draft removes local intent, not server data",()=>{
 const st=memoryStorage();writeAutomationDraft(st,input);
 assert.equal(clearAutomationDraft(st),true);
 assert.equal(readAutomationDraft(st),null);
});
test("modal restores saved pending value without replacing server readback",()=>{
 assert.match(modal,/readAutomationDraft\(window\.localStorage\)/);
 assert.match(modal,/draftEditedRef\.current = true/);
 assert.match(modal,/Đã khôi phục bản nháp trình duyệt/);
 assert.match(modal,/Đang áp dụng/);
});
test("unverified policies remain locally editable, never directly applied",()=>{
 assert.match(modal,/disabled=\{locked\}/);
 assert.match(modal,/Lưu bản nháp/);
 assert.match(modal,/disabled=\{!canSave\}/);
 assert.match(modal,/Boolean\(settings\) && verified/);
 assert.match(modal,/Áp dụng & kiểm tra/);
});
test("cancel and failed apply keep edits and avoid falsely claiming success",()=>{
 assert.match(dashboard,/if \(!window\.confirm\(confirmation\)\) return null;/);
 assert.match(modal,/if \(!readback\) \{/);
 assert.match(modal,/Chưa xác minh áp dụng\. Bản chỉnh sửa đã giữ trên trình duyệt/);
 assert.match(dashboard,/if \(failedFields\.length \|\| !independentSettings\) return null;/);
});
test("step-up code has explicit user verification route before retry",()=>{
 assert.match(dashboard,/code === "STEP_UP_REQUIRED"/);
 assert.match(dashboard,/setStepUpRequired\(true\)/);
 assert.match(dashboard,/stepUpRequired \|\| notice\.includes\("Authenticator"\)/);
 assert.match(dashboard,/href="\/__account"/);
});
test("save UI is high contrast, explicit about browser-only pending and readback",()=>{
 assert.match(css,/\.draftNotice/);
 assert.match(modal,/CHƯA áp dụng vào client/);
 assert.match(modal,/Client đã readback|Đã xác minh phần ghi LIVE/);
});

test("unsupported target keeps selectable desired values in a local-only draft",()=>{
 assert.match(modal,/const approvalValue = draft\.autoApprove \? "auto" : "manual"/);
 assert.match(modal,/const blockValue = draft\.autoBlock \? "block" : "keep"/);
 assert.match(modal,/const timeValue = draft\.autoBlock \? draft\.pendingBlockAfterHours : 0/);
 assert.match(modal,/Chỉ lưu bản nháp; client chưa cho phép ghi LIVE/);
 assert.doesNotMatch(modal,/value="unsupported"/);
});

test("unsupported disabled field does not cause phantom pending after valid supported write",()=>{
 assert.match(modal,/proposed\.autoApprove && !policy\.support\.autoApprove/);
 assert.match(modal,/proposed\.autoBlock && !policy\.support\.autoBlockPending/);
 assert.match(modal,/policy\.support\.autoApprove && policy\.current\.autoApprove !== proposed\.autoApprove/);
 assert.match(modal,/policy\.support\.autoBlockPending && policy\.current\.autoBlockPending !== proposed\.autoBlock/);
 assert.match(modal,/policy\.current\.freeAccessDays !== days/);
 assert.match(modal,/policy\.current\.freeDeviceLimit !== limit/);
});

test("Apply stages exact intended draft before remote write and refuses mutation on store failure",()=>{
  const staging=modal.indexOf("persisted = writeAutomationDraft(window.localStorage");
  const mutation=modal.indexOf("const readback = await save(");
  assert.ok(staging>=0 && mutation>staging);
  assert.match(modal,/if \(!persisted\.saved\) \{/);
  assert.match(modal,/Chưa gửi lệnh tới ứng dụng/);
  assert.match(modal,/drafts: \{ \.\.\.previous\?\.drafts, \.\.\.localIntent \}/);
  assert.match(modal,/Chưa xác minh áp dụng\. Bản chỉnh sửa đã giữ trên trình duyệt/);
});

test("saving one app's local draft does not erase other pending app intents",()=>{
  assert.match(modal,/drafts: \{ \.\.\.previous\?\.drafts, \.\.\.pendingDrafts \}, days, limit/);
  assert.match(modal,/drafts: \{ \.\.\.previous\?\.drafts, \.\.\.localIntent \}, days, limit/);
});
