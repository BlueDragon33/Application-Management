import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {validDeviceTimestamp,deviceTimePresentation,formatDeviceTime,deviceActivityPresentation,deviceUserPresentation} from "../app/device-row-presentation.mjs";

const device=(overrides={})=>({
  appId:"bauman-master-ai",appName:"Bauman Hub",href:"/device",
  deviceId:"example-1",deviceCode:"BM-TEST-0001",
  deviceType:"tablet",deviceTypeLabel:"Tablet",
  userLabel:"Bauman Master Hub · Trung tâm học tập",
  status:"pending",active:false,createdAt:null,lastSeenAt:null,
  attention:"new",canApprove:true,canRemove:true,...overrides
});
const dashboard=readFileSync("app/management-dashboard-v2.tsx","utf8");
const css=readFileSync("app/management-dashboard-v2-final.css","utf8");
const reference=Date.parse("2026-10-19T14:00:00.000Z");

test("registered and last-seen timestamps come from contract, never fabricated",()=>{
  const t=deviceTimePresentation(device());
  assert.equal(t.createdAt,null);
  assert.equal(t.lastSeenAt,null);
  assert.equal(t.registered,"Chưa có giờ yêu cầu");
  assert.equal(t.lastSeen,"Chưa có giờ ghi nhận");
  assert.equal(validDeviceTimestamp("n/a"),null);
  const withDate=deviceTimePresentation(device({
    createdAt:"2026-10-19T13:00:00.000Z",
    lastSeenAt:"2026-10-19T13:55:00.000Z"
  }));
  assert.equal(withDate.createdAt,Date.parse("2026-10-19T13:00:00Z"));
  assert.equal(withDate.lastSeenAt,Date.parse("2026-10-19T13:55:00Z"));
  assert.equal(withDate.registered,formatDeviceTime(withDate.createdAt));
});
test("time display uses browser locale and doesn't require a Vietnam timezone",()=>{
  const src=readFileSync("app/device-row-presentation.mjs","utf8");
  assert.doesNotMatch(src,/timeZone:\s*"Asia\/Ho_Chi_Minh"/);
  assert.match(formatDeviceTime(reference),/2026/);
});
test("multiple equal user labels remain the same label, with a differentiation notice",()=>{
  const u=deviceUserPresentation(device(),5);
  assert.equal(u.primary,"Bauman Master Hub · Trung tâm học tập");
  assert.equal(u.secondary,"Cùng nhãn trên 5 thiết bị");
  assert.equal(u.tone,"shared");
  assert.equal(deviceUserPresentation(device(),1).secondary,"Nhãn từ ứng dụng nguồn");
});
test("unknown user identity is never inferred from device code",()=>{
  for(const userLabel of ["","—","Thiết bị chưa gắn người dùng","BM-TEST-0001"]){
    const u=deviceUserPresentation(device({userLabel}));
    assert.equal(u.primary,"Chưa định danh người dùng");
    assert.equal(u.tone,"unidentified");
    assert.match(u.secondary,/chưa cung cấp/i);
  }
});
test("cached offline snapshot never turns active client flag into an online claim",()=>{
  const a=deviceActivityPresentation(device({active:true,lastSeenAt:"2026-10-19T13:59:00Z"}),false,reference);
  assert.equal(a.label,"Bản lưu");
  assert.equal(a.tone,"unverified");
  assert.equal(a.verified,false);
});
test("fresh active signal is only evidence from source client, not a live session",()=>{
  const a=deviceActivityPresentation(device({active:true,lastSeenAt:"2026-10-19T13:58:00Z"}),true,reference);
  assert.equal(a.tone,"recent");
  assert.equal(a.label,"Có tín hiệu gần đây");
  assert.equal(a.verified,false);
});
test("stale active signal, missing timestamp and inactive report are differentiated",()=>{
  assert.equal(deviceActivityPresentation(device({active:true,lastSeenAt:"2026-10-18T12:00:00Z"}),true,reference).tone,"stale");
  const missing=deviceActivityPresentation(device({active:true}),true,reference);
  assert.equal(missing.label,"Client báo hoạt động");
  assert.equal(missing.verified,false);
  assert.equal(deviceActivityPresentation(device({active:false}),true,reference).label,"Chưa có tín hiệu");
  assert.equal(deviceActivityPresentation(device({active:false,lastSeenAt:"2026-10-19T13:58:00Z"}),true,reference).label,"Chưa báo hoạt động");
});
test("future timestamp is flagged instead of fake verified online",()=>{
  const a=deviceActivityPresentation(device({active:true,lastSeenAt:"2026-10-20T12:00:00Z"}),true,reference);
  assert.equal(a.tone,"warning");
  assert.equal(a.verified,false);
});
test("device queue shows aligned seventh Time column and full user identity",()=>{
  assert.match(dashboard,/<span>Người dùng \/ định danh<\/span><span>Trạng thái<\/span><span>Thời gian<\/span><span>Hoạt động<\/span>/);
  assert.match(dashboard,/deviceTimePresentation\(device\)/);
  assert.match(dashboard,/deviceUserPresentation\(device, count\)/);
  assert.match(dashboard,/deviceActivityPresentation\(device, snapshotVerified, now\)/);
  assert.match(dashboard,/className="amv2-device-user"/);
  assert.match(dashboard,/dateTime=\{timestamps.createdAt/);
  assert.match(dashboard,/dateTime=\{timestamps.lastSeenAt/);
});
test("activity is only presented as live-source data when management is verified",()=>{
  assert.match(dashboard,/snapshotVerified=\{!offline && managedAccessVerified\}/);
  assert.match(dashboard,/Không có thời điểm xác minh|activity.detail/);
});
test("responsive seven-column styles preserve headers and contrast",()=>{
  assert.match(css,/\.amv2-view-table\.devices \.head,/);
  assert.match(css,/grid-template-columns: minmax\(140px,1fr\)/);
  assert.match(css,/\.amv2-device-user strong/);
  assert.match(css,/\.amv2-device-activity\[data-activity="recent"\]/);
  assert.match(css,/min-width: 1250px/);
});
