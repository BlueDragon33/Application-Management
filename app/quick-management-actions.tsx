"use client";

import { clearCachedOperations } from "./admin-device-client";
import { legacyProjectSourceCount, projectRepositoryCount } from "./project-registry";

function openView(view?: string) {
  const target = view ? `/?view=${encodeURIComponent(view)}` : "/";
  window.location.assign(target);
}

function openProjects() {
  window.location.assign("/projects");
}

function syncAll() {
  clearCachedOperations();
  window.location.reload();
}

export default function QuickManagementActions() {
  return <aside className="management-quick-actions" aria-label="Thao tác quản trị nhanh">
    <span className="management-quick-actions__label">Thao tác nhanh</span>
    <button type="button" onClick={() => openView("applications")} title="Mở danh sách ứng dụng">▦ <span>Ứng dụng</span></button>
    <button type="button" onClick={openProjects} title={`${projectRepositoryCount} repo · ${legacyProjectSourceCount} source/module cũ đã xác minh`}>
      ◆ <span>Dự án GitHub</span><b className="management-quick-actions__count">{projectRepositoryCount}</b>
    </button>
    <button type="button" onClick={() => openView("devices")} title="Mở quản trị thiết bị">▣ <span>Thiết bị</span></button>
    <button type="button" onClick={() => openView("approvals")} title="Mở hàng đợi chờ duyệt">✓ <span>Chờ duyệt</span></button>
    <button type="button" onClick={syncAll} title="Xóa cache trạng thái và đọc lại toàn bộ dữ liệu">↻ <span>Đồng bộ tất cả</span></button>
  </aside>;
}
