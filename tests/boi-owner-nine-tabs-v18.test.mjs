import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import {loadTs} from "./helpers/load-ts.mjs";

const root=new URL("../app/apps/boi-ech/",import.meta.url);
const src=name=>fs.readFileSync(new URL(name,root),"utf8");
const ui=src("boi-ech-control-center.tsx");
const shell=src("boi-ech-shell.module.css");
const device=src("boi-owner-device-insights.tsx");
const report=src("boi-owner-reports-v18.tsx");
const oversight=src("account-expiry-panel.tsx");
const pure=loadTs("app/apps/boi-ech/boi-owner-device-summary.ts");
const {classifyBinding,deviceSummary}=pure;
const account=(id,role="learner")=>({accountId:"acc_"+id.repeat(64),name:"Tài khoản "+id,role});
function entry(id,kind,status="approved",role="learner",done=2){
 return {deviceId:id.repeat(64),status,clientClass:kind,account:account(id,role),browserLabel:"Trình duyệt",progress:{completed:done,total:8}};
}

test("V18 Owner navigation exposes all nine full page destinations and their role gates",()=>{
 const heading=["Tổng quan","Thiết bị & Tiến độ","Tài khoản & Duyệt cán bộ",
 "Giảng viên & Học viên","Thời hạn & Chính sách","Điều hành AI","Vai trò & Quyền",
 "Báo cáo & Thống kê","Duyệt nội dung"];
 for(const title of heading)assert.ok(ui.includes(title),title);
 assert.match(ui,/CÔNG CỤ CHUYÊN BIỆT/);
 assert.match(ui,/access\.role==="owner"\?\[/);
 assert.match(ui,/canReviewContent\?<button/);
 assert.match(ui,/className="boi-main-contents" role="region"/);
 assert.doesNotMatch(ui,/boi-owner-task-dialog|const utilityOpen=/);
 assert.match(ui,/BoiOwnerOverview onNavigate=\{setTab\}/);
 assert.match(ui,/AccountExpiryPanel section="accounts"/);
 assert.match(ui,/AccountExpiryPanel section="oversight"/);
 assert.match(ui,/AccountExpiryPanel section="policies"/);
 assert.match(ui,/AiControlCenter role=\{access.role\}/);
 assert.match(ui,/ContentReviewCenter bridge=\{dashboard.boiBridge\}/);
 const tree=ts.createSourceFile("boi-ech-control-center.tsx",ui,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(tree.parseDiagnostics.length,0);
});

test("V18 icon-first controls classify phone, iPad/tablet, laptop browser and unknown honestly",()=>{
 const records=[
 entry("a","phone"),entry("b","tablet"),entry("c","desktop"),{deviceId:"d".repeat(64),status:"pending"}
 ];
 assert.deepEqual(records.map(classifyBinding),["phone","tablet","desktop","unknown"]);
 const summary=deviceSummary(records);
 assert.equal(summary.total,4);
 assert.equal(summary.approved,3);
 assert.equal(summary.pending,1);
 assert.equal(summary.unclassified,1);
 assert.deepEqual(summary.categories.map(c=>c.total),[1,1,1]);
 assert.match(device,/BoiClientDeviceIcon/);
 assert.match(device,/aria-pressed=\{filter===item.kind\}/);
 assert.match(ui,/registryKind==="all"\|\|device\.clientClass===registryKind/);
 assert.match(ui,/kind=\{device\.clientClass==="phone"/);
 assert.match(ui,/Chưa phân loại/);
 assert.match(device,/không khẳng định thiết bị vật lý/);
});

test("progress is de-duplicated per learner ACCOUNT, not per browser key",()=>{
 const first=entry("a","phone","approved","learner",2);
 const second={...entry("b","tablet","approved","learner",2),account:first.account};
 const third=entry("c","desktop","approved","learner",6);
 const teacher=entry("d","desktop","approved","teacher",8);
 const noProgress={...entry("e","phone"),progress:null};
 const s=deviceSummary([first,second,third,teacher,noProgress]);
 assert.ok(s.learning);
 assert.equal(s.learning.total,2);
 assert.equal(s.learning.average,50);
 assert.equal(s.learning.low,1);
 assert.equal(s.learning.high,1);
 assert.equal(s.learning.medium,0);
 assert.equal(deviceSummary([noProgress,teacher]).learning,null);
 assert.doesNotMatch(ui,/42,300|86,8% tổng liên kết|136 thiết bị/);
});

test("reports use only verified source readback, never pretend links equal accounts or hardware",()=>{
 assert.match(ui,/BoiOwnerReportsV18 registry=\{deviceRegistry\}/);
 assert.match(report,/verified&&!!registry/);
 assert.match(report,/new Set\(registry\.devices\.filter\(d=>d\.account\?\.role==="teacher"\)/);
 assert.match(report,/Số liên kết ≠ số tài khoản ≠ số thiết bị vật lý/);
 assert.match(report,/Không tự suy đoán điện thoại\/iPad\/laptop/);
 assert.match(report,/disabled=\{!verified\}/);
 assert.match(ui,/const devicesVerified = Boolean\(online && boiOnline && dashboard && !dashboard\.upstreamError\)/);
 assert.match(ui,/onExport=\{exportDevices\}/);
});

test("Owner oversight splits two real roles and retains read-only/data-source limits",()=>{
 assert.match(oversight,/className=\{design\.peopleGroup\} data-role=\{group\}/);
 assert.match(oversight,/\(\["learner","teacher"\] as const\)/);
 assert.match(oversight,/Giám sát chỉ đọc/);
 assert.match(oversight,/OwnerAccountCleanupPanel/);
 assert.match(oversight,/withOwnerAuthentication/);
 assert.match(ui,/role="note"/);
});

test("V18 vivid accessible shell is applied to actual app and does not replace backend",()=>{
 assert.match(ui,/data-admin-design="owner-v18"/);
 assert.match(shell,/linear-gradient\(103deg,#126ff4,#563eed/);
 assert.match(shell,/data-admin-design="owner-v18"/);
 assert.match(shell,/focus-visible/);
 assert.match(shell,/prefers-reduced-motion:reduce/);
 assert.match(shell,/@media\(max-width:450px\)/);
 assert.match(ui,/async function purgeRegistrySelection/);
 assert.match(ui,/expectedStatus:details\.status,expectedCreatedAt:details\.createdAt/);
 assert.match(ui,/STEP_UP_REQUIRED/);
 assert.match(ui,/AuthenticatorStepUp finish=\{finishManagementAuth\}/);
 assert.match(ui,/manualSync\(\)/);
 assert.doesNotMatch(ui,/document\.write\(|localStorage\.setItem\("owner-role"/);
});
