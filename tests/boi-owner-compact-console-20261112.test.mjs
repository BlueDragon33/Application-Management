import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source=fs.readFileSync(new URL("../app/apps/boi-ech/boi-ech-control-center.tsx",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("../app/apps/boi-ech/boi-ech-shell.module.css",import.meta.url),"utf8");
const tree=ts.createSourceFile("boi-ech-control-center.tsx",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);

test("Owner V18 shows all nine destinations, specialist tools are full-page, not unsafe modal overlays",()=>{
 const nav=source.slice(source.indexOf('<nav aria-label="Quản trị Bơi Ếch — điều hướng chính">'),
    source.indexOf('</nav>',source.indexOf('<nav aria-label="Quản trị Bơi Ếch — điều hướng chính">')));
 const tools=source.slice(source.indexOf('<nav aria-label="Công cụ chuyên biệt Bơi Ếch">'),
    source.indexOf('</nav>',source.indexOf('<nav aria-label="Công cụ chuyên biệt Bơi Ếch">')));
 for(const title of ["Tổng quan","Thiết bị & Tiến độ","Tài khoản & Duyệt cán bộ",
    "Giảng viên & Học viên","Thời hạn & Chính sách","Điều hành AI"]) assert.ok(nav.includes(title),title);
 for(const title of ["Báo cáo & Thống kê","Vai trò & Quyền","Duyệt nội dung"]) assert.ok(tools.includes(title),title);
 assert.match(source,/canReviewContent\?<button/);
 assert.match(source,/access\.role==="owner"\?\[/);
 assert.match(source,/className="boi-main-contents" role="region"/);
 assert.doesNotMatch(source,/boi-owner-task-dialog|boi-task-scrim|const utilityOpen=/);
 const account=source.slice(source.indexOf('<nav className="boi-owner-account-modal-actions"'),
   source.indexOf("</nav>",source.indexOf('<nav className="boi-owner-account-modal-actions"')));
 for(const title of ["Cloudflare Preview","Hồ sơ · Đổi mật khẩu","Vai trò & Quyền"])
  assert.ok(account.includes(title),title);
 assert.doesNotMatch(source,/toolsMenuOpen|boi-owner-task-selector/);
 assert.match(source,/event\.key!=="Tab"/);
 assert.match(source,/event\.shiftKey/);
});

test("owner profile is at top right, not in sidebar; boundary notice and sidebar security link removed",()=>{
 assert.match(source,/className="boi-top-account"/);
 assert.match(source,/className="boi-account-trigger"/);
 assert.match(source,/className="boi-owner-account-modal"/);
 assert.match(source,/role="dialog" aria-modal="true"/);
 assert.match(source,/createPortal\(/);
 assert.match(source,/href="\/__account"/);
 assert.match(source,/Thiết lập \/ xác minh Authenticator/);
 assert.match(source,/className="boi-owner-account-modal-signout"/);
 assert.doesNotMatch(source,/Ranh giới Bơi ếch|client-boundary-note|className="signed-user"/);
 assert.doesNotMatch(source,/boi-nav-footer/);
 assert.match(fs.readFileSync(new URL("../app/globals.css",import.meta.url),"utf8"),/\.boi-owner-account-modal-backdrop/);
});

test("authentication switch refreshes only on real resume/online events and preserves MFA and cookies",()=>{
 assert.match(source,/type="checkbox" checked=\{authAutoCheck\}/);
 assert.match(source,/fetch\("\/api\/center",\{credentials:"same-origin",cache:"no-store",redirect:"error"\}\)/);
 assert.doesNotMatch(source,/window\.setInterval\(\(\)=>\{void check\(\);\},120_000\)/);
 assert.match(source,/window\.addEventListener\("focus",onResume\)/);
 assert.match(source,/window\.addEventListener\("online",onResume\)/);
 assert.match(source,/xác thực bắt buộc vẫn hoạt động/);
 assert.match(source,/if\(!authAutoCheck\)return/);
 assert.doesNotMatch(source,/BOI_ECH_ACCOUNT_FIRST\s*=|disableAuthentication\(|skipMfa\(|bypassAuthenticator/);
 assert.match(source,/AuthenticatorStepUp finish=\{finishManagementAuth\}/);
});

test("role-specific operations remain guarded, no learner or teacher approvals in Owner app",()=>{
 assert.match(source,/access\.role==="owner"\?\[/);
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
 assert.match(css,/\.boi-policy-manager-grid\)\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.doesNotMatch(source,/Nhiệt độ: \d+|Thời tiết: nắng đẹp/);
 assert.equal(tree.parseDiagnostics.length,0,"TSX must parse cleanly");
});
