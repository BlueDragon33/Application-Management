"use client";

import Link from "next/link";
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
import proofStyles from "./access-management.module.css";
import styles from "./management-dashboard.module.css";

const paymentLabels: Record<BoiAccessDevice["paymentStatus"], string> = {
  unassigned: "Chưa thanh toán",
  awaiting_payment: "Đang chờ thanh toán",
  proof_submitted: "Có ảnh chờ xác minh",
  free_approved: "Miễn phí",
  paid_verified: "Đã trả phí",
};

const accessLabels: Record<BoiAccessDevice["accessGroup"], string> = {
  unassigned: "Chưa phân quyền",
  free: "Miễn phí",
  paid: "Trả phí",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date) : "—";
}

function tone(device: BoiAccessDevice) {
  if (device.paymentStatus === "proof_submitted" || device.accessExpired) return "pending";
  if (device.paymentStatus === "paid_verified" || device.paymentStatus === "free_approved") return "approved";
  return device.status;
}

type ProofViewer = { device: BoiAccessDevice; url: string };

export default function AccessManagement({ query = "" }: { query?: string }) {
  const [data, setData] = useState<BoiAccessBootstrap | null>(null);
  const [busy, setBusy] = useState(true);
  const [actionBusy, setActionBusy] = useState("");
  const [proofBusy, setProofBusy] = useState("");
  const [proof, setProof] = useState<ProofViewer | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const canReviewPayment = data?.role === "publisher" || data?.role === "owner";

  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const result = await connectBoiAccessManagement();
      setData(result);
      return result;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể tải thanh toán và quyền Bơi ếch.");
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

  const normalized = query.trim().toLowerCase();
  const devices = useMemo(() => (data?.devices ?? []).filter((device) => {
    if (!normalized) return true;
    return `${device.learnerName} ${device.personCode ?? ""} ${device.deviceCode} ${paymentLabels[device.paymentStatus]} ${accessLabels[device.accessGroup]}`.toLowerCase().includes(normalized);
  }), [data?.devices, normalized]);

  async function manage(device: BoiAccessDevice, operation: Extract<BoiAccessOperation, "grant-free" | "require-payment" | "renew-access">) {
    const description = operation === "grant-free" ? "mở tài khoản miễn phí" : operation === "require-payment" ? "gửi yêu cầu thanh toán" : "gia hạn quyền truy cập";
    if (!window.confirm(`Xác nhận ${description} cho ${device.learnerName || device.deviceCode}?`)) return;
    setActionBusy(device.deviceId);
    setNotice("");
    setError("");
    try {
      await manageBoiAccess(device, operation);
      const synced = await refresh();
      setNotice(synced ? `Đã ${description} và đọc lại trạng thái từ Bơi ếch.` : `Backend đã ${description}, nhưng Trung tâm chưa đọc lại được trạng thái.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể cập nhật thanh toán/quyền.");
      await refresh();
    } finally {
      setActionBusy("");
    }
  }

  async function openProof(device: BoiAccessDevice) {
    if (!canReviewPayment) {
      setError("Chỉ Publisher/Owner mới được xem và xử lý chứng từ thanh toán.");
      return;
    }
    setProofBusy(device.deviceId);
    setNotice("");
    setError("");
    try {
      const blob = await loadBoiPaymentProof(device);
      setRejectNote("");
      setProof({ device, url: URL.createObjectURL(blob) });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể tải chứng từ thanh toán.");
      await refresh();
    } finally {
      setProofBusy("");
    }
  }

  async function reviewProof(operation: "verify-payment" | "reject-payment") {
    if (!proof) return;
    const device = proof.device;
    const note = rejectNote.trim();
    if (operation === "reject-payment" && note.length < 5) {
      setError("Hãy nhập lý do từ chối ít nhất 5 ký tự để người học biết cần sửa gì.");
      return;
    }
    const message = operation === "verify-payment"
      ? `Xác nhận chứng từ của ${device.learnerName || device.deviceCode} là hợp lệ và cấp quyền trả phí?`
      : `Từ chối chứng từ của ${device.learnerName || device.deviceCode}? Ảnh hiện tại sẽ bị xóa khỏi kho và người học phải gửi lại.`;
    if (!window.confirm(message)) return;
    setActionBusy(device.deviceId);
    setError("");
    setNotice("");
    try {
      await manageBoiAccess(device, operation, note);
      setProof(null);
      setRejectNote("");
      const synced = await refresh();
      const description = operation === "verify-payment" ? "xác minh thanh toán" : "từ chối chứng từ";
      setNotice(synced ? `Đã ${description} và đọc lại trạng thái từ Bơi ếch.` : `Backend đã ${description}, nhưng Trung tâm chưa đọc lại được trạng thái.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể xử lý chứng từ thanh toán.");
      await refresh();
    } finally {
      setActionBusy("");
    }
  }

  const otherApps = applicationRegistry.filter((application) => application.id !== "boi-ech" && (!normalized || `${application.name} ${application.shortName} ${application.scope} ${application.capabilities.join(" ")}`.toLowerCase().includes(normalized)));
  const counts = data?.counts;

  return <section className={styles.fullPanel}>
    <header className={styles.sectionTitle}>
      <div><h2>Thanh toán & Quyền thực tế</h2><p className={styles.muted}>Bơi ếch dùng trạng thái backend thật. Các ứng dụng khác chỉ hiển thị quyền mà backend của chính ứng dụng đã công bố; Trung tâm không tự tạo trạng thái thanh toán.</p></div>
      <button disabled={busy} onClick={() => void refresh()}>{busy ? "Đang tải…" : "↻ Đồng bộ quyền"}</button>
    </header>

    {error ? <div className={styles.warning}><strong>Cảnh báo:</strong> {error}</div> : null}
    {notice ? <div className={styles.notice}>{notice}</div> : null}

    <div className={styles.accessGrid}>
      <article className={styles.accessCard}><h4>Tài khoản trả phí</h4><strong>{counts?.paid ?? "—"}</strong><p>Thuộc nhóm trả phí; trạng thái xác minh được đọc trực tiếp từ Bơi ếch.</p></article>
      <article className={styles.accessCard}><h4>Tài khoản miễn phí</h4><strong>{counts?.free ?? "—"}</strong><p>Được quản trị viên cấp quyền miễn phí.</p></article>
      <article className={styles.accessCard}><h4>Ảnh chờ xác minh</h4><strong>{counts?.proofSubmitted ?? "—"}</strong><p>Publisher/Owner có thể xem ảnh tạm thời và xử lý ngay tại Trung tâm.</p></article>
      <article className={styles.accessCard}><h4>Sắp/đã hết hạn</h4><strong>{counts ? counts.expired + counts.expiringSoon : "—"}</strong><p>{counts ? `${counts.expired} đã hết hạn · ${counts.expiringSoon} sắp hết hạn` : "Chưa có dữ liệu"}</p></article>
    </div>

    <p className={styles.boundaryNote}>Chứng từ chỉ được tải theo yêu cầu qua kết nối đã ký, không lưu vào dữ liệu Trung tâm và không cache. Nút xác minh/từ chối chỉ xuất hiện sau khi ảnh đã được mở; từ chối sẽ xóa ảnh cũ ở Bơi ếch và yêu cầu người học gửi lại.</p>

    <div className={styles.deviceTable}>
      <div className={styles.tableHead}><span>Thiết bị</span><span>Người học</span><span>Thanh toán</span><span>Quyền</span><span>Thời hạn</span><span>Thao tác</span></div>
      {devices.map((device) => {
        const rowBusy = actionBusy === device.deviceId || proofBusy === device.deviceId;
        const canGrantFree = device.registrationComplete && device.paymentStatus !== "paid_verified" && device.paymentStatus !== "proof_submitted" && device.accessGroup !== "free";
        const canRequirePayment = device.registrationComplete && device.accessGroup === "unassigned" && device.paymentStatus === "unassigned";
        const canRenew = device.registrationComplete && device.status !== "blocked" && device.accessGroup !== "unassigned" && (device.accessExpired || device.accessExpiringSoon || Boolean(device.accessExpiresAt));
        return <div className={styles.tableRow} key={device.deviceId}>
          <div><strong>{device.deviceCode}</strong><small>{device.active ? "● Online" : `Seen ${formatDate(device.lastSeenAt)}`}</small></div>
          <div><strong>{device.learnerName}</strong><small>{device.personCode ?? (device.registrationComplete ? "Đã đủ hồ sơ" : "Chưa đủ hồ sơ")}</small></div>
          <div><span className={styles.deviceState} data-state={tone(device)}>{paymentLabels[device.paymentStatus]}</span><small>{device.paymentAmount > 0 ? `${device.paymentAmount.toLocaleString("vi-VN")}đ` : ""}</small></div>
          <div><strong>{accessLabels[device.accessGroup]}</strong><small>{device.status === "blocked" ? "Thiết bị đã khóa" : device.status === "pending" ? "Chờ duyệt thiết bị" : "Đang có quyền thiết bị"}</small></div>
          <div><strong>{device.accessExpired ? "Đã hết hạn" : device.accessExpiringSoon ? `Còn ${device.accessDaysRemaining ?? 0} ngày` : device.accessExpiresAt ? "Còn hiệu lực" : "Chưa có hạn"}</strong><small>{formatDate(device.accessExpiresAt)}</small></div>
          <div className={styles.rowActions}>
            {canGrantFree ? <button disabled={rowBusy} onClick={() => void manage(device, "grant-free")}>Miễn phí</button> : null}
            {canRequirePayment ? <button disabled={rowBusy} onClick={() => void manage(device, "require-payment")}>Yêu cầu trả phí</button> : null}
            {canRenew ? <button disabled={rowBusy} onClick={() => void manage(device, "renew-access")}>Gia hạn</button> : null}
            {device.paymentStatus === "proof_submitted" && canReviewPayment ? <button disabled={rowBusy} onClick={() => void openProof(device)}>{proofBusy === device.deviceId ? "Đang tải ảnh…" : "Xem chứng từ"}</button> : null}
            {device.paymentStatus === "proof_submitted" && !canReviewPayment ? <span className={styles.protected}>Cần Publisher/Owner</span> : null}
            <Link href="/apps/boi-ech">Quản trị</Link>
          </div>
        </div>;
      })}
      {!busy && devices.length === 0 ? <div className={styles.empty}>Chưa có tài khoản Bơi ếch phù hợp.</div> : null}
    </div>

    <header className={styles.sectionTitle}><h2>Quyền của các ứng dụng còn lại</h2></header>
    <div className={styles.accessGrid}>
      {otherApps.map((application) => <article key={application.id} className={styles.accessCard}>
        <div><div><h3>{application.shortName}</h3><p>{application.scope}</p></div></div>
        <h4>Backend đã công bố</h4>
        <ul>{application.capabilities.map((capability) => <li key={capability}>✓ {capability}</li>)}</ul>
        <p className={styles.muted}>Không có mô hình thanh toán chung được Trung tâm tự suy diễn cho ứng dụng này.</p>
        <div className={styles.cardActions}><Link href={application.href} className={styles.primaryAction}>Quản trị</Link>{application.publicUrl ? <a href={application.publicUrl} target="_blank" rel="noreferrer">Truy cập web ↗</a> : null}</div>
      </article>)}
    </div>

    {proof ? <div className={proofStyles.proofBackdrop} role="presentation" onMouseDown={() => setProof(null)}>
      <section className={proofStyles.proofDialog} role="dialog" aria-modal="true" aria-labelledby="payment-proof-title" onMouseDown={(event) => event.stopPropagation()}>
        <header><div><h2 id="payment-proof-title">Chứng từ thanh toán</h2><p>{proof.device.learnerName} · {proof.device.deviceCode}</p></div><button type="button" onClick={() => setProof(null)} aria-label="Đóng">×</button></header>
        <div className={proofStyles.proofMeta}><span>Số tiền <strong>{proof.device.paymentAmount.toLocaleString("vi-VN")}đ</strong></span><span>Gửi lúc <strong>{formatDate(proof.device.paymentSubmittedAt)}</strong></span></div>
        <div className={proofStyles.proofImageWrap}><img src={proof.url} alt={`Chứng từ thanh toán của ${proof.device.learnerName}`} /></div>
        <p className={styles.boundaryNote}>Ảnh này chỉ là Blob URL tạm thời trong trình duyệt và sẽ được thu hồi khi đóng cửa sổ. Hãy đối chiếu nội dung ảnh/giao dịch trước khi xác minh.</p>
        <label className={proofStyles.proofRejectNote}>Lý do nếu từ chối<textarea value={rejectNote} onChange={(event) => setRejectNote(event.target.value.slice(0, 500))} placeholder="Ví dụ: Số tiền/nội dung chuyển khoản chưa đúng hoặc ảnh chưa đủ thông tin." maxLength={500}/><small>{rejectNote.trim().length}/500 · tối thiểu 5 ký tự khi từ chối</small></label>
        <footer><Link href="/apps/boi-ech">Mở quản trị Bơi ếch</Link><button type="button" className={proofStyles.rejectProofButton} disabled={actionBusy === proof.device.deviceId || rejectNote.trim().length < 5} onClick={() => void reviewProof("reject-payment")}>Từ chối chứng từ</button><button type="button" className={proofStyles.verifyProofButton} disabled={actionBusy === proof.device.deviceId} onClick={() => void reviewProof("verify-payment")}>{actionBusy === proof.device.deviceId ? "Đang xử lý…" : "Xác minh thanh toán"}</button></footer>
      </section>
    </div> : null}
  </section>;
}
