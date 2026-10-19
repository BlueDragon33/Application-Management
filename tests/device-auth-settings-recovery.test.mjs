import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
const dashboard=fs.readFileSync('app/management-dashboard-v2.tsx','utf8');
const policy=fs.readFileSync('app/automatic-device-policies.tsx','utf8');
const account=fs.readFileSync('worker/production-auth.ts','utf8');
const css=fs.readFileSync('app/management-dashboard-v2-final.css','utf8');
const policyCss=fs.readFileSync('app/automatic-device-policies.module.css','utf8');

test('Production 2FA required response points to a real account step-up route',()=>{
  assert.match(account,/code: "STEP_UP_REQUIRED"/);
  assert.match(account,/stepUpPath: ACCOUNT_PATH/);
  assert.ok(account.includes('action="${ACCOUNT_PATH}/mfa/step-up"'));
  assert.match(account,/Mã Authenticator/);
});
test('Device approval surfaces a discoverable real Authenticator link',()=>{
  assert.match(dashboard,/className="amv2-security-link" href="\/__account"/);
  assert.match(dashboard,/view === "devices" \|\| view === "approvals"/);
  assert.match(dashboard,/Xác minh 2FA/);
  assert.match(css,/amv2-security-link:focus-visible/);
});
test('Step-up error notification gives visible next-step instead of dead-end',()=>{
  assert.match(dashboard,/notice\.includes\("Authenticator"\)/);
  assert.match(dashboard,/Xác minh ngay ↗/);
  assert.match(dashboard,/target="_blank" rel="noopener noreferrer"/);
});
test('Automation modal has independent authentication entry while editing',()=>{
  assert.match(policy,/verifyAuthenticatorHref\?: string/);
  assert.match(policy,/Mở xác minh Authenticator/);
  assert.match(dashboard,/verifyAuthenticatorHref=\{authMode === "cloudflare-production"/);
  assert.match(policyCss,/\.authHelp a:focus-visible/);
});
test('Managed/Production server gate cannot be bypassed by browser preference',()=>{
  assert.match(dashboard,/const standaloneModeAvailable = !defaultApprovalGate && authMode !== "cloudflare-production"/);
  assert.match(dashboard,/availableOperatingMode\(next, standaloneModeAvailable\)/);
  assert.match(dashboard,/hasProtectedOperationAccess\(operatingMode, managedAccessVerified\)/);
  assert.match(dashboard,/setManagedAccessVerified\(false\)/);
  assert.match(dashboard,/không thể bỏ qua xác thực Production/);
  assert.doesNotMatch(dashboard,/TẮT · Vào thẳng/);
});
test('Partial failed target readback does not discard unsaved policy edits',()=>{
  assert.match(dashboard,/if \(failedFields\.length\) return null;/);
  assert.match(policy,/if \(!readback\) return;/);
  assert.match(policy,/draftEditedRef\.current = false;\s*setDrafts\(initialDrafts\(apps, readback\)\)/);
  assert.match(dashboard,/Chưa khớp readback/);
});
test('Dashboard only promises saved state after readback verification',()=>{
  const successAt=dashboard.indexOf('setNotice("Đã lưu và readback chính xác "');
  const partialAt=dashboard.indexOf('if (failedFields.length) return null;');
  assert.ok(successAt!==-1&&partialAt>successAt);
  assert.match(policy,/Có thay đổi chưa lưu; chưa công nhận đã ghi/);
});

test('Gate always offers central mode selector without bypassing authorization',()=>{
  assert.match(dashboard,/openModes: \(\) => void/);
  assert.match(dashboard,/onClick=\{openModes\}/);
  assert.match(dashboard,/modeDialogOpen \? <OperatingModeDialog/);
  assert.match(dashboard,/authMode !== "cloudflare-production"/);
  assert.match(dashboard,/Chế độ vận hành · Chọn nguồn dữ liệu/);
});
