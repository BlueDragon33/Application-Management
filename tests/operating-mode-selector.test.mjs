import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const dashboard=readFileSync("app/management-dashboard-v2.tsx","utf8");
const modal=readFileSync("app/operating-mode-dialog.tsx","utf8");
const css=readFileSync("app/operating-mode-dialog.module.css","utf8");

test("one central dialog contains Local, Online and Hybrid choices",()=>{
  assert.match(modal,/id:"local",title:"Cục bộ · Offline"/);
  assert.match(modal,/id:"online",title:"Trực tuyến · Online"/);
  assert.match(modal,/id:"hybrid",title:"Kết hợp · Tự chuyển nguồn"/);
  assert.match(modal,/role="dialog" aria-modal="true"/);
  assert.match(modal,/aria-pressed=\{item.id===mode\}/);
  assert.match(modal,/onSelect\(item.id\)/);
});
test("popup is reachable through topbar, Settings and gate without bypassing Production",()=>{
  assert.match(dashboard,/className="amv2-access-mode" data-operating-mode=\{operatingMode\}/);
  assert.match(dashboard,/onClick=\{\(\) => setModeDialogOpen\(true\)\}/);
  assert.match(dashboard,/openModes=\{\(\) => setModeDialogOpen\(true\)\}/);
  assert.match(dashboard,/function SettingsView\(/);
  assert.match(dashboard,/Chế độ vận hành/);
  assert.match(modal,/authIsProduction/);
  assert.match(modal,/href="\/__account"/);
});
test("Local is disabled when Production or managed access does not permit Standalone",()=>{
  assert.match(dashboard,/const standaloneModeAvailable = !defaultApprovalGate && authMode !== "cloudflare-production"/);
  assert.match(modal,/return mode !== "local" \|\| localAllowed/);
  assert.match(modal,/disabled=\{!allowed\}/);
  assert.match(dashboard,/if \(!availableOperatingMode\(next, standaloneModeAvailable\)\)/);
});
test("verified live actor is mandatory for all protected management writes",()=>{
  assert.match(modal,/return mode !== "local" && verifiedLiveActor === true/);
  assert.match(dashboard,/hasProtectedOperationAccess\(operatingMode, managedAccessVerified\)/);
  assert.match(dashboard,/access\?\.status === "approved"/);
  assert.match(dashboard,/setManagedAccessVerified\(false\)/);
  assert.match(dashboard,/setManagedAccessVerified\(verified\)/);
});
test("Hybrid failure is read-only and never claims global DB synchronization",()=>{
  assert.match(dashboard,/operatingMode === "hybrid"/);
  assert.match(dashboard,/mọi thao tác quản trị bị khóa/);
  assert.match(dashboard,/Chỉ hiển thị bản lưu; Duyệt và Lưu vẫn bị khóa/);
  assert.match(dashboard,/Kết hợp: không kết nối được máy chủ/);
  assert.match(modal,/không phải sao chép hoặc hợp nhất D1/);
});
test("Local cannot trigger a forced sync or launch remote URL or managed SSO",()=>{
  assert.match(dashboard,/if \(operatingMode === "local"\) \{/);
  assert.match(dashboard,/Chế độ Cục bộ không gửi yêu cầu kết nối/);
  assert.match(dashboard,/operatingMode === "local"\s*\? \(localRuntime \? app\?\.localUrl : undefined\)/);
  assert.match(dashboard,/operatingMode === "local"\s*\? fallback/);
  assert.match(dashboard,/summary\?\.managedWebLaunch && hasProtectedOperationAccess/);
});
test("changing mode resets permissions and rejects old async bootstrap responses",()=>{
  assert.match(dashboard,/modeEpochRef\.current\+\+/);
  assert.match(dashboard,/if \(epoch !== modeEpochRef\.current\) return/);
  assert.match(dashboard,/setAccess\(null\)/);
  assert.match(dashboard,/setCenter\(null\)/);
  assert.match(dashboard,/setManagedAccessVerified\(false\)/);
  assert.match(dashboard,/setOperationsVerified\(false\)/);
});
test("mode preference uses a dedicated key, not old approval-gate bypass key",()=>{
  assert.match(dashboard,/application-management:operating-mode:v1/);
  assert.match(dashboard,/localStorage\.getItem\(operatingModeStorageKey\)/);
  assert.match(dashboard,/localStorage\.setItem\(operatingModeStorageKey, next\)/);
  assert.doesNotMatch(dashboard,/application-management:approval-gate:v1/);
});
test("mode selector has focus recovery, Escape, keyboard trap and readable text",()=>{
  assert.match(modal,/prev\?\.focus\(\)/);
  assert.match(modal,/event.key==="Escape"/);
  assert.match(modal,/event.key!=="Tab"/);
  assert.match(css,/:focus-visible/);
  assert.match(css,/\.option\[data-current="true"\]/);
});
test("no claim of live write persistence is introduced by mode switching",()=>{
  assert.match(dashboard,/if \(failedFields.length\) return null;/);
  assert.match(dashboard,/Lưu vẫn bị khóa/);
  assert.match(modal,/không ghi mù/);
  assert.match(dashboard,/if \(!readback\) return null;|if \(failedFields.length\) return null;/);
});
