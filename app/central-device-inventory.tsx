"use client";
import { useState } from "react";
import Link from "next/link";
import type { OperationsDevice } from "./admin-device-client";
import styles from "./central-device-inventory.module.css";

export type CentralDeviceOperation = "approve" | "remove" | "unblock" | "set-edit-permission";
const filters = [["pending", "Chờ duyệt"], ["approved", "Đã duyệt"], ["blocked", "Đã khóa"], ["all", "Tất cả"]] as const;
const statuses = { pending: "Chờ duyệt", approved: "Đã duyệt", blocked: "Đã khóa", unknown: "Chưa xác minh" };

export default function CentralDeviceInventory({ devices, actionBusy, manageDevice, openBoiAccess, bulkRemovePendingDevices, openAutomation }: {
  devices: OperationsDevice[];
  actionBusy: string;
  manageDevice: (device: OperationsDevice, operation: CentralDeviceOperation) => Promise<void>;
  openBoiAccess: (device: OperationsDevice) => void;
  bulkRemovePendingDevices: (devices: OperationsDevice[]) => Promise<void>;
  openAutomation: () => void;
}) {
  const [status, setStatus] = useState<(typeof filters)[number][0]>("pending");
  const visible = devices.filter(device => status === "all" || device.status === status);
  const bulkTargets = visible.filter(device => device.status === "pending" && device.canRemove && device.appId !== "boi-ech").slice(0, 24);
  const busy = Boolean(actionBusy);
  return <section className="amv2-page-panel">
    <div className="amv2-device-bulk-toolbar">
      <div><strong>Quản trị thiết bị chung</strong><small>Duyệt và thay đổi quyền ngay tại Trung tâm. Kết quả được ghi và xác minh ở app liên quan. Bơi ếch là xóa vĩnh viễn nên không được xử lý hàng loạt.</small></div>
      <div className="amv2-device-bulk-actions"><button disabled={busy} onClick={openAutomation}>⚙ Tự động</button><button data-danger="true" aria-label="Từ chối và khóa các thiết bị chờ kiểm duyệt đang hiển thị" disabled={busy || !bulkTargets.length} onClick={() => void bulkRemovePendingDevices(visible)}>Từ chối &amp; khóa ({bulkTargets.length})</button></div>
    </div>
    <div className={styles.filters} role="group" aria-label="Trạng thái thiết bị">{filters.map(([value, label]) => <button key={value} aria-pressed={status === value} onClick={() => setStatus(value)}>{label}</button>)}</div>
    <div className="amv2-view-table devices">
      <div className="head"><span>Ứng dụng</span><span>Thiết bị</span><span>Người dùng</span><span>Trạng thái</span><span>Hoạt động</span><span>Thao tác</span></div>
      {visible.map(device => <div className="row" key={`${device.appId}:${device.deviceId}`}>
        <strong>{device.appName}</strong><div><strong>{device.deviceTypeLabel || device.deviceType}</strong><small>{device.deviceCode}</small></div><span>{device.userLabel}</span><b>{statuses[device.status]}</b><span>{device.active ? "● Online" : "Offline"}</span>
        <div>
          {device.appId === "boi-ech" && (device.canManageAccess || device.canApprove) ? <button disabled={busy} onClick={() => openBoiAccess(device)}>{device.status === "pending" ? "Phân quyền" : "Quyền truy cập"}</button> : null}
          {device.appId !== "boi-ech" && device.status === "pending" && device.canApprove ? <button disabled={busy} onClick={() => void manageDevice(device, "approve")}>Duyệt</button> : null}
          {device.canRemove && (device.status === "pending" || device.status === "approved") ? <button data-danger="true" disabled={busy} onClick={() => void manageDevice(device, "remove")}>{device.appId === "boi-ech" ? "Xóa vĩnh viễn" : "Khóa"}</button> : null}
          {device.canUnblock && device.status === "blocked" ? <button disabled={busy} onClick={() => void manageDevice(device, "unblock")}>Mở khóa</button> : null}
          {device.canEditPermission && device.status === "approved" ? <button disabled={busy} onClick={() => void manageDevice(device, "set-edit-permission")}>{device.editEnabled ? "Tắt quyền sửa" : "Bật quyền sửa"}</button> : null}
          <Link href={device.href}>Quản trị chuyên sâu</Link>
        </div>
      </div>)}
      {!visible.length ? <div className="amv2-empty"><strong>Không có thiết bị phù hợp.</strong><small>Chọn trạng thái khác hoặc đồng bộ lại danh sách.</small></div> : null}
    </div>
  </section>;
}
