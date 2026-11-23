import assert from "node:assert/strict";
import test from "node:test";
import {composePrompt,hasSecret,promptKey,validatePrompt} from "../app/components/client-developer-prompt.mjs";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const sample={
 appId:"bauman-master-ai",appName:"Bauman Hub",role:"owner",activeView:"contract",
 connectionState:"warning",observation:"Device registry chưa xác minh",
 workTitle:"Xác minh registry BM- theo control-plane snapshot",
 sourceNote:"OperationsBootstrap UI projection",extraRequirements:"Kiểm thử 390px và không tạo site mới"
};
test("creates a real one-task scoped next prompt from visible source, not a generic 'Next Action' label",()=>{
 const prompt=composePrompt(sample);
 assert.match(prompt,/Xác minh registry BM-/);
 assert.match(prompt,/Kiểm thử 390px và không tạo site mới/);
 assert.match(prompt,/HEAD GitHub live|GitHub HEAD live/);
 assert.match(prompt,/UNVERIFIED/);
 assert.match(prompt,/ZERO-SPEND/);
 assert.match(prompt,/Không GitHub-hosted Actions/);
 assert.match(prompt,/KHÔNG cấp quyền thực thi/);
 assert.equal((prompt.match(/MỘT ĐẦU VIỆC TIẾP THEO/g)||[]).length,1);
});
test("different client and source observation yield different actual task text",()=>{
 const price={...sample,appId:"price-report-tunggiabao",appName:"PriceReport",connectionState:"online",
  observation:"KT registry verified but source QA pending",workTitle:"Kiểm tra keyboard/focus của PriceReport"};
 const b=composePrompt(price);
 assert.match(b,/PriceReport/);
 assert.match(b,/Kiểm tra keyboard\/focus/);
 assert.doesNotMatch(b,/Xác minh registry BM-/);
 assert.notEqual(promptKey(price),promptKey(sample));
});
test("fail closed on wrong app/role/connection, secret, excessive length, missing task",()=>{
 assert.match(validatePrompt({...sample,appId:"unknown"}),/thí điểm/);
 assert.match(validatePrompt({...sample,role:"root"}),/Vai trò/);
 assert.match(validatePrompt({...sample,connectionState:"unknown"}),/kết nối/);
 assert.match(validatePrompt({...sample,workTitle:""}),/đầu việc/);
 assert.match(validatePrompt({...sample,extraRequirements:"x".repeat(2001)}),/vượt giới hạn/);
 assert.ok(hasSecret("ghp_abcdefgh12345678abcdefgh12345678"));
 assert.match(validatePrompt({...sample,extraRequirements:"ghp_abcdefgh12345678abcdefgh12345678"}),/khóa bí mật/);
 assert.equal(validatePrompt(sample),"");
});
test("shared shell only opts in Bauman and PriceReport; auth is upstream and approval is owner-only",()=>{
 const shell=read("app/components/client-admin-shell.tsx");
 const bauman=read("app/apps/bauman-master-ai/bauman-admin.tsx");
 const price=read("app/apps/price-report-tunggiabao/price-report-admin.tsx");
 const builder=read("app/components/client-developer-support.tsx");
 assert.match(shell,/builderSupport \? <ClientDeveloperSupport/);
 assert.match(bauman,/builderSupport=\{\{/);
 assert.match(price,/builderSupport=\{\{/);
 assert.match(bauman,/role: access.role/);
 assert.match(price,/role: access.role/);
 assert.match(bauman,/if \(!access \|\| access.status !== "approved"\)/);
 assert.match(price,/if \(!access \|\| access.status !== "approved"\)/);
 assert.match(builder,/if\(role!=="owner"\)/);
 assert.match(builder,/disabled=\{role!=="owner"\|\|stale/);
 assert.match(builder,/approvedPrompt===prompt/);
 assert.match(builder,/sourceKey!==latestKey/);
 assert.match(builder,/onClick=\{open\?close:show\}/);
 assert.match(builder,/function show\(\)\{regenerate\(\);setOpen\(true\);\}/);
 assert.match(builder,/onChange=\{e=>edit\("extraRequirements"/);
 assert.match(builder,/navigator.clipboard.writeText\(prompt\)/);
 assert.match(builder,/URL.createObjectURL/);
 assert.doesNotMatch(builder,/fetch\s*\(|operationsAction|manage-client-device|localStorage|sessionStorage|document\.cookie/);
});
