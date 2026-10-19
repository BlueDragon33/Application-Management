import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const dashboard=readFileSync("app/management-dashboard-v2.tsx","utf8");
const worker=readFileSync("public/sw.js","utf8");
const fallback=readFileSync("public/offline.html","utf8");

test("development and QA do not register service worker to mask Vite failures",()=>{
  const effect=dashboard.slice(dashboard.indexOf('// Development and disposable Chromium QA'));
  assert.match(effect,/if \(process\.env\.NODE_ENV !== "production"\) return;/);
  const guarded=effect.indexOf('if (process.env.NODE_ENV !== "production") return;');
  const registered=effect.indexOf('navigator.serviceWorker.register("/sw.js")');
  assert.ok(registered>guarded);
});
test("PWA offline fallback remains available in real production",()=>{
  assert.match(worker,/CACHE_NAME = "application-management-webapp-v2"/);
  assert.match(worker,/request\.mode === "navigate"/);
  assert.match(worker,/fetch\(request\)\.catch\(\(\) => caches\.match\("\/offline\.html"\)\)/);
});
test("offline fallback accurately describes Application-Management status",()=>{
  assert.match(fallback,/Không tải được Trung tâm quản trị/);
  assert.match(fallback,/tiến trình Vite và cổng QA/);
  assert.match(fallback,/không xác nhận tình trạng dữ liệu hoặc quyền quản trị/);
  assert.doesNotMatch(fallback,/hồ sơ học viên/);
  assert.doesNotMatch(fallback,/danh sách trên máy chủ vẫn được giữ nguyên/);
});
test("fallback does not claim a successful Local, Online or Hybrid runtime",()=>{
  assert.doesNotMatch(fallback,/HYBRID_PASS|OFFLINE_QA_PASS|ONLINE_VERIFIED/);
  assert.match(fallback,/location\.reload\(\)/);
});
