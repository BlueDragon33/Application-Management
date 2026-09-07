"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- full reload keeps the supervised HTTP preview stable. */

import { useEffect, useState } from "react";
import { signedControlPost, type ControlAccess } from "../control-device.client";
type MedicalBootstrap = {
  actor: ControlAccess;
  stats: { total: number; pending: number; needsDocuments: number; resolved: number };
  rules: { id: string; enabled: boolean; level: number }[];
  reviews: { id: string; status: string; createdAt: string }[];
  meta: { version: string; updatedAt: string; jurisdiction: string };
  auditLog: { id: number; action: string; actor: string; createdAt: string }[];
  error?: string;
};

type MedicineAccessBridge = { url: string; expiresAt: number; actor: ControlAccess };

const roleLabel = {
  viewer: "Chỉ xem",
  reviewer: "Kiểm duyệt viên",
  publisher: "Người xuất bản",
  owner: "Chủ hệ thống",
} as const;

export default function MedicalControlClient({ user }: { user: { displayName: string; email: string } }) {
  const [data, setData] = useState<MedicalBootstrap | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [accessUrl, setAccessUrl] = useState("");

  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const next = await signedControlPost<MedicalBootstrap>("/api/medicine/control", { action: "bootstrap" });
      setData(next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tải mảng Y tế.");
    } finally {
      setBusy(false);
    }
  }

  async function issueWebAppAccess() {
    setBusy(true);
    setError("");
    try {
      const next = await signedControlPost<MedicineAccessBridge>("/api/medicine/access", { action: "issue-access" });
      setAccessUrl(next.url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể cấp phiên Hòa nhập Nga.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!data) return <main className="medical-loading"><div><span>Y TẾ</span><h1>{error || "Đang xác thực mảng Y tế…"}</h1><a href="/">← QUẢN TRỊ ỨNG DỤNG</a></div></main>;

  const enabledRules = data.rules.filter((rule) => rule.enabled).length;
  const highRiskRules = data.rules.filter((rule) => rule.enabled && rule.level >= 4).length;

  return <main className="medical-shell">
    <header className="medical-topbar">
      <a className="medical-brand" href="/"><span>YT</span><div><small>QUẢN TRỊ ỨNG DỤNG</small><strong>Y tế</strong></div></a>
      <div className="medical-user"><div><strong>{user.displayName}</strong><small>{roleLabel[data.actor.role]}</small></div><button onClick={() => void refresh()} disabled={busy}>{busy ? "Đang cập nhật…" : "Cập nhật"}</button><a href="/system-control">Hệ thống</a></div>
    </header>

    <section className="medical-hero">
      <div><span>MEDICAL DOMAIN · MODULAR</span><h1>Mảng Y tế của QUẢN TRỊ ỨNG DỤNG.</h1><p>RU MedCheck là module đầu tiên. Các công cụ y tế khác có thể bổ sung độc lập sau này mà không trộn dữ liệu với Học tập.</p></div>
      <aside><small>Bộ dữ liệu hiện tại</small><strong>{data.meta.version}</strong><span>{data.meta.jurisdiction} · cập nhật {data.meta.updatedAt}</span></aside>
    </section>

    {error ? <div className="medical-alert">{error}</div> : null}

    <section className="medical-metrics">
      <article><span>Ca kiểm duyệt</span><strong>{data.stats.total}</strong><small>{data.stats.pending} đang chờ</small></article>
      <article><span>Cần hồ sơ</span><strong>{data.stats.needsDocuments}</strong><small>Chưa thể kết luận tự động</small></article>
      <article><span>Quy tắc đang bật</span><strong>{enabledRules}</strong><small>{highRiskRules} quy tắc cấp 4–5</small></article>
      <article><span>Đã xử lý</span><strong>{data.stats.resolved}</strong><small>Qua Trung tâm kiểm duyệt</small></article>
    </section>

    <section className="medical-modules">
      <article className="primary"><header><span>01</span><b>ĐANG HOẠT ĐỘNG</b></header><h2>Hòa nhập Nga</h2><p>Web App người dùng: OCR nhãn thuốc, đối chiếu hoạt chất và phân cấp 1–5 theo quy định Liên bang Nga.</p><div><button onClick={() => void issueWebAppAccess()} disabled={busy}>{busy ? "Đang cấp phiên…" : "Cấp quyền & mở Web App"}</button><a href="/medicine-control">Vào kiểm duyệt</a></div>{accessUrl ? <p className="medical-access-note"><strong>Phiên đã cấp.</strong> Mở trong 5 phút: <a href={accessUrl} target="_blank" rel="noreferrer">Mở Hòa nhập Nga ↗</a></p> : null}</article>
      <article className="future"><header><span>+</span><b>SẴN SÀNG MỞ RỘNG</b></header><h2>Module Y tế mới</h2><p>Kiến trúc đã chừa sẵn cho các module y tế khác; mỗi module sẽ có dữ liệu, quy tắc và hàng chờ riêng.</p><div className="medical-placeholder">Chưa gắn module</div></article>
    </section>

    <section className="medical-boundary"><strong>Ranh giới dữ liệu</strong><p>Mảng Y tế chỉ dùng cơ chế xác thực/quyền của Trung tâm. Dữ liệu thuốc và kiểm duyệt không được nhập chung vào tiến độ học tập.</p><a href="/">← Quay lại QUẢN TRỊ ỨNG DỤNG</a></section>
  </main>;
}
