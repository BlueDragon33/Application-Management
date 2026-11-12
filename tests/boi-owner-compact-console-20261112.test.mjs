import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source=fs.readFileSync(new URL("../app/apps/boi-ech/boi-ech-control-center.tsx",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("../app/apps/boi-ech/boi-ech-shell.module.css",import.meta.url),"utf8");
const tree=ts.createSourceFile("boi-ech-control-center.tsx",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);

test("owner compact console retains existing task handlers but exposes only three persistent navigation buttons",()=>{
 const nav=source.slice(source.indexOf('<nav aria-label="Quản trị Bơi ếch — điều hướng chính">'),
   source.indexOf("</nav>",source.indexOf('<nav aria-label="Quản trị Bơi ếch — điều hướng chính">')));
 assert.equal((nav.match(/<button type="button"/g)||[]).length,3);
 for(const item of ["Tổng quan","Thiết bị & Tiến độ","Nghiệp vụ khác"])assert.ok(nav.includes(item),item);
 for(const lowUsage of ["Tài khoản & Duyệt cán bộ","Giám sát GV / học viên","Vai trò & Quyền",
   "Thời hạn & Chính sách","Báo cáo & Thống kê","Điều hành AI","Duyệt nội dung"])
   assert.ok(source.includes(lowUsage),"must retain "+lowUsage);
 assert.match(source,/role=\{utilityOpen\?"dialog":undefined\}/);
 assert.match(source,/aria-modal=\{utilityOpen\?true:undefined\}/);
 assert.match(source,/event\.key==="Escape"\)setTab\("overview"\)/);
 assert.match(source,/id=\{utilityOpen\?"boi-owner-task-dialog":undefined\}/);
});

test("owner profile is at top right, not in sidebar; boundary notice and sidebar security link removed",()=>{
 assert.match(source,/className="boi-top-account"/);
 assert.match(source,/className="boi-account-trigger"/);
 assert.match(source,/className="boi-account-popover"/);
 assert.match(source,/href="\/__account"/);
 assert.match(source,/Thiết lập \/ xác minh Authenticator/);
 assert.match(source,/className="boi-signout"/);
 assert.doesNotMatch(source,/Ranh giới Bơi ếch|client-boundary-note|className="signed-user"/);
 assert.doesNotMatch(source,/boi-nav-footer/);
 assert.match(css,/\.scope :global\(\.boi-account-popover\)/);
});

test("authentication switch polls read-only session state and never disables MFA, cookies or permissions",()=>{
 assert.match(source,/type="checkbox" checked=\{authAutoCheck\}/);
 assert.match(source,/fetch\("\/api\/center",\{credentials:"same-origin",cache:"no-store",redirect:"error"\}\)/);
 assert.match(source,/window\.setInterval\(\(\)=>\{void check\(\);\},120_000\)/);
 assert.match(source,/xác thực bắt buộc vẫn hoạt động/);
 assert.match(source,/if\(!authAutoCheck\)return/);
 assert.doesNotMatch(source,/BOI_ECH_ACCOUNT_FIRST\s*=|disableAuthentication\(|skipMfa\(|bypassAuthenticator/);
 assert.match(source,/AuthenticatorStepUp finish=\{finishManagementAuth\}/);
});

test("role-specific operations remain guarded, no learner or teacher approvals in Owner app",()=>{
 assert.match(source,/access\.role==="owner"\?<button type="button"/);
 assert.ok(source.includes('tab==="accounts" && access.role==="owner" ? <div className="boi-owner-workspace"><AccountExpiryPanel section="accounts"/>'));
 assert.match(source,/AccountExpiryPanel section="oversight"/);
 assert.match(source,/AccountExpiryPanel section="policies"/);
 assert.match(source,/tab === "devices"/);
 assert.match(source,/tab === "content"/);
 assert.match(source,/boiApi<AiControlData>/);
});

test("sidebar time and modal have mobile constraints and no misleading fabricated weather",()=>{
 assert.match(source,/className="boi-side-clock" aria-label="Đồng hồ tại thiết bị"/);
 assert.match(source,/new Date\(clockNow\)\.toLocaleTimeString/);
 assert.match(source,/window\.setInterval\(\(\)=>setClockNow\(Date\.now\(\)\),60_000\)/);
 assert.match(css,/@media\(max-width:820px\)/);
 assert.match(css,/max-height:calc\(100dvh - 32px\)/);
 assert.match(css,/\.boi-task-selector-grid\)\{grid-template-columns:1fr/);
 assert.doesNotMatch(source,/Nhiệt độ: \d+|Thời tiết: nắng đẹp/);
 assert.equal(tree.parseDiagnostics.length,0,"TSX must parse cleanly");
});
