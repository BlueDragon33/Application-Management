"use client";

import { useEffect, useMemo, useState } from "react";
import { applicationRegistry } from "./application-registry";
import {
  connectBoiAccessManagement,
  loadBoiPaymentProof,
  manageBoiAccess,
  type BoiAccessBootstrap,
  type BoiAccessDevice,
  type BoiAccessOperation,
} from "./boi-access-client";
import styles from "./boi-access-view.module.css";

const paymentLabels: Record<BoiAccessDevice["paymentStatus"], string> = {
  unassigned: "Chưa thanh toán",
  awaiting_payment: "Chờ thanh toán",
  proof_submitted: "Chờ xác minh",
  free_approved: "Miễn phí",
  paid_verified: "Đã xác minh",
};

const accessLabels: Record<BoiAccessDevice["accessGroup"], string> = {
  unassigned: "Chưa phân quyền",
  free: "Miễn phí",
  paid: "Trả phí",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value || 0);
}

function paymentTone(status: BoiAccessDevice["paymentStatus"]) {
  if (status === "paid_verified" || status === "free_approved") return "ok";
  if (status === "proof_submitted") return "review";
  if (status === "awaiting_payment") return "waiting";
  return "muted";
}

function accessTone(device: BoiAccessDevice) {
  if (device.accessExpired) return "danger";
  if (device.accessExpiringSoon) return "review";
  if (device.accessGroup !== "unassigned") return "ok";
  return "muted";
}

type ProofState = { device: BoiAccessDevice; url: string };

export default function BoiAccessView({ query = "" }: { query?: string }) {
  const [data, setData] = useState<BoiAccessBootstrap | null>(null);
  const [busy, setBusy] = useState(true);
  const [actionBusy, setActionBusy] = useState("");
  const [proofBusy, setProofBusy] = useState("");
  const [proof, setProof] = useState<ProofState | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const canManage = data?.role === "publisher" || data?.role === "owner";
  const unsupportedApps = applicationRegistry.filter((app) => app.id !== "boi-ech");

  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const next = await connectBoiAccessManagement();
      setData(next);
      return next;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể tải Thanh toán & Quyền Bơi ếch.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const url = proof?.url;
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [proof?.url]);

  const normalizedQuery = query.trim().toLowerCase();
  const devices = useMemo(() => (data?.devices ?? []).filter((device) => {
    if (!normalizedQuery) return true;
    return [
      device.learnerName,
      device.personCode ?? "",
      device.deviceCode,
      paymentLabels[device.paymentStatus],
      accessLabels[device.accessGroup],
    ].join(" ").toLowerCase().includes(normalizedQuery);
  }), [data?.devices, normalizedQuery]);

  async function manage(device: BoiAccessDevice, operation: Extract<BoiAccessOperation, "grant-free" | "require-payment" | "renew-access">) {
    const label = operation === "grant-free" ? "cấp quyền miễn phí" : operation === "require-payment" ? "chuyển sang luồng trả phí" : "gia hạn quyền";
    if (!window.confirm(`Xác nhận ${label} cho ${device.learnerName || device.deviceCode}?`)) return;
    setActionBusy(device.deviceId);
    setError("");
    setNotice("");
    try {
      await manageBoiAccess(device, operation);
      const synced = await refresh();
      setNotice(synced ? `Đã ${label} và đọc lại trạng thái từ Bơi ếch.` : `Backend đã ${label}, nhưng chưa đọc lại được trạng thái.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể cập nhật thanh toán/quyền.");
      await refresh();
    } finally {
      setActionBusy("");
    }
  }

  async function openProof(device: BoiAccessDevice) {
    if (!canManage) {
      setError("Chỉ Publisher/Owner mới được xem chứng từ thanh toán.");
      return;
    }
    setProofBusy(device.deviceId);
    setError("");
    setNotice("");
    try {
      const blob = await loadBoiPaymentProof(device);
      const url = URL.createObjectURL(blob);
      setRejectNote("");
      setProof((current) => {
        if (current?.url) URL.revokeObjectURL(current.url);
        return { device, url };
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể tải chứng từ thanh toán.");
      await refresh();
    } finally {
      setProofBusy("");
    }
  }

  function closeProof() {
    setProof((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return null;
    });
    setRejectNote("");
  }

  async function reviewProof(operation: "verify-payment" | "reject-payment") {
    if (!proof) return;
    if (operation === "reject-payment" && rejectNote.trim().length < 5) {
      setError("Lý do từ chối cần ít nhất 5 ký tự.");
      return;
    }
    const device = proof.device;
    setActionBusy(device.deviceId);
    setError("");
    setNotice("");
    try {
      await manageBoiAccess(device, operation, rejectNote);
      closeProof();
      const synced = await refresh();
      setNotice(synced
        ? operation === "verify-payment" ? "Đã xác minh thanh toán và đọc lại quyền truy cập." : "Đã từ chối chứng từ và đọc lại trạng thái."
        : "Backend đã xử lý chứng từ nhưng Trung tâm chưa đọc lại được trạng thái.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể xử lý chứng từ.");
      await refresh();
    } finally {
      setActionBusy("");
    }
  }

  return <section className={styles.root}>
    <section className={styles.mainPanel}>
      <header className={styles.panelHeader}>
        <div>
          <span className={styles.eyebrow}>BƠI ẾCH · CONTRACT THẬT</span>
          <h2>Thanh toán & Quyền truy cập</h2>
          <p>Trạng thái lấy trực tiếp từ registry Bơi ếch. Mọi thay đổi đều được xác minh lại sau khi ghi.</p>
        </div>
        <button className={styles.refresh} disabled={busy} onClick={() => void refresh()}>{busy ? "Đang đồng bộ…" : "↻ Đồng bộ"}</button>
      </header>

      {error ? <div className={styles.error}><strong>Lỗi:</strong> {error}</div> : null}
      {notice ? <div className={styles.notice}>{notice}</div> : null}

      <div className={styles.metrics}>
        <article><small>Tổng thiết bị</small><strong>{data?.counts.total ?? 0}</strong></article>
        <article><small>Miễn phí</small><strong>{data?.counts.free ?? 0}</strong></article>
        <article><small>Đã trả phí</small><strong>{data?.counts.paid ?? 0}</strong></article>
        <article><small>Chờ thanh toán</small><strong>{data?.counts.awaitingPayment ?? 0}</strong></article>
        <article data-attention={(data?.counts.proofSubmitted ?? 0) > 0}><small>Chờ xác minh</small><strong>{data?.counts.proofSubmitted ?? 0}</strong></article>
        <article data-attention={(data?.counts.expired ?? 0) > 0}><small>Hết hạn</small><strong>{data?.counts.expired ?? 0}</strong></article>
      </div>

      <div className={styles.tableWrap}>
        <div className={styles.tableHead}>
          <span>Người học</span><span>Thiết bị</span><span>Quyền</span><span>Thanh toán</span><span>Hạn truy cập</span><span>Hoạt động</span><span>Thao tác</span>
        </div>
        {devices.map((device) => {
          const rowBusy = actionBusy === device.deviceId;
          const proofLoading = proofBusy === device.deviceId;
          const canStartFlow = canManage && device.registrationComplete && device.accessGroup === "unassigned" && device.paymentStatus === "unassigned";
          const canRenew = canManage && device.registrationComplete && device.accessGroup !== "unassigned";
          return <article className={styles.row} key={device.deviceId}>
            <div><strong>{device.learnerName}</strong><small>{device.personCode || (device.registrationComplete ? "Đã hoàn tất hồ sơ" : "Hồ sơ chưa hoàn tất")}</small></div>
            <div><code>{device.deviceCode}</code><small>{device.active ? "● Online" : "Offline"}</small></div>
            <span className={styles.badge} data-tone={accessTone(device)}>{accessLabels[device.accessGroup]}</span>
            <div><span className={styles.badge} data-tone={paymentTone(device.paymentStatus)}>{paymentLabels[device.paymentStatus]}</span><small>{device.paymentAmount > 0 ? formatMoney(device.paymentAmount) : "—"}</small></div>
            <div><strong>{formatDate(device.accessExpiresAt)}</strong><small>{device.accessExpired ? "Đã hết hạn" : device.accessDaysRemaining !== null ? `Còn ${device.accessDaysRemaining} ngày` : "—"}</small></div>
            <span>{device.lastSeenAt ? formatDate(device.lastSeenAt) : "—"}</span>
            <div className={styles.actions}>
              {canStartFlow ? <button disabled={rowBusy} onClick={() => void manage(device, "grant-free")}>Miễn phí</button> : null}
              {canStartFlow ? <button disabled={rowBusy} onClick={() => void manage(device, "require-payment")}>Yêu cầu trả phí</button> : null}
              {canRenew ? <button disabled={rowBusy} onClick={() => void manage(device, "renew-access")}>Gia hạn</button> : null}
              {canManage && device.paymentProofAvailable && device.paymentStatus === "proof_submitted"
                ? <button className={styles.reviewButton} disabled={proofLoading || rowBusy} onClick={() => void openProof(device)}>{proofLoading ? "Đang tải…" : "Xem chứng từ"}</button>
                : null}
              {!canManage ? <em>Chỉ xem</em> : null}
              {!device.registrationComplete ? <em>Chờ hồ sơ</em> : null}
            </div>
          </article>;
        })}
        {!busy && !devices.length ? <div className={styles.empty}>Không có thiết bị Bơi ếch phù hợp bộ lọc hiện tại.</div> : null}
        {busy && !data ? <div className={styles.empty}>Đang tải registry thanh toán/quyền…</div> : null}
      </div>
    </section>

    <aside className={styles.contractPanel}>
      <header><span>PHẠM VI QUẢN TRỊ</span><h3>Contract theo từng ứng dụng</h3><p>Chỉ Bơi ếch hiện công bố luồng payment/access cho Trung tâm. Các app khác không bị dựng nút giả.</p></header>
      <article className={styles.supported}><i>✓</i><div><strong>Bơi ếch</strong><small>Miễn phí · Trả phí · Chứng từ · Gia hạn · Readback</small></div><b>Đã hỗ trợ</b></article>
      {unsupportedApps.map((app) => <article key={app.id}><i>—</i><div><strong>{app.shortName}</strong><small>Chưa công bố payment/access contract cho Trung tâm</small></div><b>Không tạo thao tác</b></article>)}
    </aside>

    {proof ? <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeProof(); }}>
      <section className={styles.modal} role="dialog" aria-modal="true" aria-label="Xác minh chứng từ thanh toán">
        <header><div><span>CHỨNG TỪ BƠI ẾCH</span><h3>{proof.device.learnerName}</h3><p>{proof.device.deviceCode} · {formatMoney(proof.device.paymentAmount)}</p></div><button onClick={closeProof} aria-label="Đóng">×</button></header>
        <div className={styles.proofImage}><img src={proof.url} alt="Chứng từ thanh toán Bơi ếch"/></div>
        <label><span>Lý do từ chối</span><textarea value={rejectNote} onChange={(event) => setRejectNote(event.target.value)} placeholder="Chỉ cần nhập khi từ chối chứng từ…" maxLength={500}/></label>
        <footer><button onClick={closeProof}>Đóng</button><button className={styles.reject} disabled={actionBusy === proof.device.deviceId} onClick={() => void reviewProof("reject-payment")}>Từ chối</button><button className={styles.approve} disabled={actionBusy === proof.device.deviceId} onClick={() => void reviewProof("verify-payment")}>Xác minh thanh toán</button></footer>
      </section>
    </div> : null}
  </section>;
}
