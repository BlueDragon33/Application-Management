import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const builder=read("app/components/client-developer-support.tsx");
const shell=read("app/components/client-admin-shell.tsx");
const css=read("app/components/client-admin-shell.module.css");
const bauman=read("app/apps/bauman-master-ai/bauman-admin.tsx");
const price=read("app/apps/price-report-tunggiabao/price-report-admin.tsx");
test("builder support is opt-in for the two approved-workspace pilots only",()=>{
 assert.match(shell,/builderSupport \? <ClientDeveloperSupport/);
 assert.match(builder,/data-client-developer-support="prompt-review-v2"/);
 assert.match(builder,/Hỗ trợ lập trình PRO/);
 assert.match(bauman,/if \(!access \|\| access.status !== "approved"\)/);
 assert.match(price,/if \(!access \|\| access.status !== "approved"\)/);
});
test("owner prompt workflow has generation, preview, editable requirements, approval and clipboard/export",()=>{
 assert.match(builder,/function show\(\)\{regenerate\(\);setOpen\(true\);\}/);
 assert.match(builder,/aria-expanded=\{open\}/);
 assert.match(builder,/role="dialog"/);
 assert.match(builder,/readOnly\/>/);
 assert.match(builder,/maxLength=\{2000\}/);
 assert.match(builder,/if\(role!=="owner"\)/);
 assert.match(builder,/sourceKey!==latestKey/);
 assert.match(builder,/approvedPrompt===prompt/);
 assert.match(builder,/navigator.clipboard.writeText\(prompt\)/);
 assert.match(builder,/URL.revokeObjectURL/);
 assert.match(builder,/e.key==="Escape"/);
 assert.match(css,/\.developerSupportBackdrop/);
 assert.match(css,/:focus-visible/);
});
test("bounded prompt UI cannot approve devices, run Actions, access secrets or self-deploy",()=>{
 assert.doesNotMatch(builder,/fetch\s*\(|operationsAction|secureApi|manage-client-device|localStorage|sessionStorage|document\.cookie|setInterval/);
 assert.doesNotMatch(builder,/deviceCode|accessToken|apiKey|user\.email|git push|deployProduction/);
 assert.match(builder,/KHÔNG phải duyệt reviewer/);
});

test("Windows TS/owner Escape regressions keep DOM append types and global modal close",()=>{
 assert.match(builder,/document\.body\.appendChild\(a\)/);
 assert.doesNotMatch(builder,/document\.body\.append\(a\)/);
 assert.match(builder,/document\.addEventListener\("keydown",onDocumentKeyDown,true\)/);
 assert.match(builder,/document\.removeEventListener\("keydown",onDocumentKeyDown,true\)/);
 assert.match(builder,/event\.stopPropagation\(\)/);
 assert.match(builder,/triggerRef\.current\?\.focus\(\)/);
});
