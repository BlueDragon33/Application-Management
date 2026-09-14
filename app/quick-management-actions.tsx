"use client";

function openView(view?: string) {
  const target = view ? `/?view=${encodeURIComponent(view)}` : "/";
  window.location.assign(target);
}

function syncAll() {
  try {
    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith("application-management:operations:")) {
        window.sessionStorage.removeItem(key);
      }
    }
  } catch {
    // Cache is optional; a reload still forces the dashboard to request fresh data.
  }
  window.location.reload();
}

export default function QuickManagementActions() {
  return <aside className="management-quick-actions" aria-label="Thao tác quản trị nhanh">
    <span className="management-quick-actions__label">Thao tác nhanh</span>
    <button type="button" onClick={() => openView("applications")} title="Mở danh sách ứng dụng">▦ <span>Ứng dụng</span></button>
    <button type="button" onClick={() => openView("devices")} title="Mở quản trị thiết bị">▣ <span>Thiết bị</span></button>
    <button type="button" onClick={() => openView("approvals")} title="Mở hàng đợi chờ duyệt">✓ <span>Chờ duyệt</span></button>
    <button type="button" onClick={syncAll} title="Xóa cache trạng thái và đọc lại toàn bộ dữ liệu">↻ <span>Đồng bộ tất cả</span></button>
  </aside>;
}
