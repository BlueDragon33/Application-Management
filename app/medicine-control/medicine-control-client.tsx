"use client";

import { useEffect, useMemo, useState } from "react";
import { signedControlPost } from "../control-device.client";
type Role = "viewer" | "reviewer" | "publisher" | "owner";
type Review = { id: string; createdAt: string; updatedAt: string; status: string; medicineName?: string | null; ocrText: string; matchedRuleIds: string[]; proposedLevel: number; confidence: number; note?: string | null; adminNote?: string | null; decision?: string | null; reviewedBy?: string | null; reviewedAt?: string | null };
type Rule = { id: string; name: string; synonyms: string[]; level: number; category: string; basis: string; sourceIds: string[]; reviewRequired: boolean; condition?: string | null; enabled: boolean };
type Payload = { actor: { email: string; displayName: string; role: Role }; reviews: Review[]; rules: Rule[]; stats: { total: number; pending: number; needsDocuments: number; resolved: number }; auditLog: { id: number; actor: string; action: string; target: string; detail: Record<string, unknown>; createdAt: string }[]; error?: string };
type ApiResult = Partial<Payload> & { ok?: boolean; error?: string };
type RuleDraft = { id: string; name: string; synonymsText: string; level: number; category: string; basis: string; sourceIdsText: string; reviewRequired: boolean; condition: string; enabled: boolean };

async function api(body: Record<string, unknown>) {
  return signedControlPost<ApiResult>("/api/medicine/control", body);
}

function draftFor(rule?: Rule | null): RuleDraft {
  return rule ? {
    id: rule.id, name: rule.name, synonymsText: rule.synonyms.join("\n"), level: rule.level, category: rule.category,
    basis: rule.basis, sourceIdsText: rule.sourceIds.join("\n"), reviewRequired: rule.reviewRequired,
    condition: rule.condition || "", enabled: rule.enabled,
  } : { id: "", name: "", synonymsText: "", level: 2, category: "other", basis: "", sourceIdsText: "", reviewRequired: true, condition: "", enabled: true };
}

export default function MedicineControlClient({ user }: { user: { displayName: string; email: string } }) {
  const [data, setData] = useState<Payload | null>(null);
  const [tab, setTab] = useState<"reviews" | "rules" | "audit">("reviews");
  const [selected, setSelected] = useState<Review | null>(null);
  const [filter, setFilter] = useState("pending");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ruleDraft, setRuleDraft] = useState<RuleDraft | null>(null);

  async function refresh() {
    setBusy(true); setError("");
    try {
      const next = await api({ action: "bootstrap" });
      if (!next.actor || !next.reviews || !next.rules || !next.stats || !next.auditLog) throw new Error("Dữ liệu Trung tâm chưa đầy đủ.");
      const full = next as Payload;
      setData(full);
      if (selected) setSelected(full.reviews.find((item) => item.id === selected.id) || null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể tải dữ liệu."); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBusy(true);
      setError("");
      void api({ action: "bootstrap" }).then((next) => {
        if (!next.actor || !next.reviews || !next.rules || !next.stats || !next.auditLog) throw new Error("Dữ liệu Trung tâm chưa đầy đủ.");
        setData(next as Payload);
      }).catch((reason) => {
        setError(reason instanceof Error ? reason.message : "Không thể tải dữ liệu.");
      }).finally(() => setBusy(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const reviews = useMemo(() => data?.reviews.filter((item) => filter === "all" || item.status === filter) || [], [data, filter]);
  const role = data?.actor.role;
  const canReview = role ? ["reviewer", "publisher", "owner"].includes(role) : false;
  const canPublish = role ? ["publisher", "owner"].includes(role) : false;

  async function decide(status: string, decision: string, adminNote: string) {
    if (!selected) return; setBusy(true); setError("");
    try {
      const next = await api({ action: "update-review", id: selected.id, status, decision, adminNote });
      const rows = next.reviews || [];
      setData((current) => current ? { ...current, reviews: rows, stats: { ...current.stats, pending: rows.filter((item) => item.status === "pending").length, needsDocuments: rows.filter((item) => item.status === "needs_documents").length, resolved: rows.filter((item) => ["approved", "rejected"].includes(item.status)).length } } : current);
      setSelected(rows.find((item) => item.id === selected.id) || null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể cập nhật ca."); }
    finally { setBusy(false); }
  }

  async function toggleRule(rule: Rule) {
    setBusy(true); setError("");
    try {
      const next = await api({ action: "toggle-rule", id: rule.id, enabled: !rule.enabled });
      if (next.rules) setData((current) => current ? { ...current, rules: next.rules! } : current);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể cập nhật quy tắc."); }
    finally { setBusy(false); }
  }

  async function saveRule() {
    if (!ruleDraft) return;
    setBusy(true); setError("");
    try {
      const next = await api({
        action: "update-rule", id: ruleDraft.id, name: ruleDraft.name, level: ruleDraft.level, category: ruleDraft.category,
        basis: ruleDraft.basis, synonyms: ruleDraft.synonymsText.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean),
        sourceIds: ruleDraft.sourceIdsText.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean),
        reviewRequired: ruleDraft.reviewRequired, condition: ruleDraft.condition, enabled: ruleDraft.enabled,
      });
      if (next.rules) setData((current) => current ? { ...current, rules: next.rules! } : current);
      setRuleDraft(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể lưu quy tắc."); }
    finally { setBusy(false); }
  }

  if (!data) return <main className="med-admin-loading"><div><b>{error || "Đang kết nối QUẢN TRỊ ỨNG DỤNG · Y tế…"}</b>{error ? <a href="/medical-control">Quay lại Y tế</a> : null}</div></main>;

  return <main className="med-admin">
    <aside><a className="med-admin-brand" href="/medical-control"><span>YT</span><div><strong>QUẢN TRỊ ỨNG DỤNG · Y tế</strong><small>Kiểm duyệt Hòa nhập Nga</small></div></a><nav><button className={tab === "reviews" ? "active" : ""} onClick={() => setTab("reviews")}>Kiểm duyệt thuốc <b>{data.stats.pending}</b></button><button className={tab === "rules" ? "active" : ""} onClick={() => setTab("rules")}>Bộ quy tắc Nga</button>{canPublish ? <button className={tab === "audit" ? "active" : ""} onClick={() => setTab("audit")}>Nhật ký Hòa nhập Nga</button> : null}</nav><div className="med-admin-links"><a href="/medical-control">← Dashboard Y tế</a><a href="/medical-control">Cấp quyền Web App ↗</a></div><div className="med-admin-user"><strong>{user.displayName}</strong><span>{role}</span><small>{user.email}</small></div></aside>
    <section className="med-admin-main">
      <header><div><span>RUSSIA MEDICINE CONTROL</span><h1>{tab === "reviews" ? "Hàng chờ kiểm duyệt" : tab === "rules" ? "Bộ quy tắc hoạt chất" : "Nhật ký RU MedCheck"}</h1></div><button onClick={() => void refresh()} disabled={busy}>{busy ? "Đang cập nhật…" : "Cập nhật"}</button></header>
      {error ? <div className="med-admin-error">{error}</div> : null}
      <div className="med-stat-grid"><article><span>Tổng ca</span><b>{data.stats.total}</b></article><article><span>Chờ duyệt</span><b>{data.stats.pending}</b></article><article><span>Cần hồ sơ</span><b>{data.stats.needsDocuments}</b></article><article><span>Đã xử lý</span><b>{data.stats.resolved}</b></article></div>

      {tab === "reviews" ? <div className="med-review-layout"><div className="med-review-list"><div className="med-filter"><button className={filter === "pending" ? "active" : ""} onClick={() => setFilter("pending")}>Chờ</button><button className={filter === "needs_documents" ? "active" : ""} onClick={() => setFilter("needs_documents")}>Cần hồ sơ</button><button className={filter === "approved" ? "active" : ""} onClick={() => setFilter("approved")}>Đã duyệt</button><button className={filter === "rejected" ? "active" : ""} onClick={() => setFilter("rejected")}>Không khuyến nghị</button><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Tất cả</button></div>{reviews.map((item) => <button key={item.id} className={selected?.id === item.id ? "selected" : ""} onClick={() => setSelected(item)}><div><strong>{item.medicineName || "Không có tên thuốc"}</strong><span>Cấp {item.proposedLevel}/5 · OCR {item.confidence}%</span></div><small>{new Date(item.createdAt).toLocaleString("vi-VN")}</small><p>{item.ocrText.slice(0, 150)}{item.ocrText.length > 150 ? "…" : ""}</p></button>)}</div><ReviewPanel key={`${selected?.id ?? "empty"}:${selected?.updatedAt ?? ""}`} review={selected} canReview={canReview} busy={busy} onDecide={decide} /></div> : null}

      {tab === "rules" ? <div className="med-rules"><div className="med-rule-note">{canPublish ? <><span>Publisher/Owner có thể sửa nội dung, mức cảnh báo, từ đồng nghĩa, nguồn và trạng thái quy tắc.</span><button onClick={() => setRuleDraft(draftFor())}>+ Thêm quy tắc</button></> : <span>Bạn đang ở quyền xem; không thể sửa quy tắc.</span>}</div>{data.rules.map((rule) => <article key={rule.id} className={!rule.enabled ? "disabled" : ""}><b className={`lv-${rule.level}`}>{rule.level}</b><div><strong>{rule.name}</strong><small>{rule.id} · {rule.category}</small><p>{rule.basis}</p><code>{[rule.name, ...rule.synonyms].join(" · ")}</code></div>{canPublish ? <div className="med-rule-buttons"><button onClick={() => setRuleDraft(draftFor(rule))}>Sửa</button><button onClick={() => void toggleRule(rule)} disabled={busy}>{rule.enabled ? "Đang bật" : "Đã tắt"}</button></div> : <span>{rule.enabled ? "Bật" : "Tắt"}</span>}</article>)}</div> : null}

      {tab === "audit" ? <div className="med-audit">{data.auditLog.map((item) => <article key={item.id}><time>{new Date(item.createdAt).toLocaleString("vi-VN")}</time><strong>{item.action}</strong><span>{item.actor}</span><code>{item.target}</code></article>)}</div> : null}
    </section>
    {ruleDraft ? <RuleEditor draft={ruleDraft} setDraft={setRuleDraft} busy={busy} onSave={saveRule} /> : null}
  </main>;
}

function ReviewPanel({ review, canReview, busy, onDecide }: { review: Review | null; canReview: boolean; busy: boolean; onDecide: (status: string, decision: string, adminNote: string) => Promise<void> }) {
  const [decision, setDecision] = useState(review?.decision || "");
  const [note, setNote] = useState(review?.adminNote || "");
  if (!review) return <aside className="med-review-detail empty">Chọn một ca để xem đầy đủ.</aside>;
  return <aside className="med-review-detail"><div className={`med-risk lv-${review.proposedLevel}`}><span>Cấp đề xuất</span><b>{review.proposedLevel}/5</b></div><h2>{review.medicineName || "Không có tên thuốc"}</h2><div className="med-detail-meta"><span>OCR {review.confidence}%</span><span>{review.status}</span></div><label>Nội dung OCR<textarea value={review.ocrText} readOnly rows={10} /></label><label>Quy tắc khớp<div className="med-rule-chips">{review.matchedRuleIds.length ? review.matchedRuleIds.map((id) => <code key={id}>{id}</code>) : <span>Không có</span>}</div></label><label>Kết luận<textarea value={decision} onChange={(event) => setDecision(event.target.value)} rows={3} disabled={!canReview} placeholder="Kết luận tập trung vào quy định Nga…" /></label><label>Ghi chú quản trị<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} disabled={!canReview} /></label>{canReview ? <div className="med-review-actions"><button onClick={() => void onDecide("approved", decision, note)} disabled={busy}>Duyệt</button><button onClick={() => void onDecide("needs_documents", decision, note)} disabled={busy}>Cần hồ sơ</button><button onClick={() => void onDecide("rejected", decision, note)} disabled={busy}>Không khuyến nghị</button></div> : null}</aside>;
}

function RuleEditor({ draft, setDraft, busy, onSave }: { draft: RuleDraft; setDraft: (value: RuleDraft | null) => void; busy: boolean; onSave: () => Promise<void> }) {
  const patch = (next: Partial<RuleDraft>) => setDraft({ ...draft, ...next });
  return <div className="med-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDraft(null); }}><section className="med-rule-editor" role="dialog" aria-modal="true" aria-label="Sửa quy tắc thuốc"><header><div><span>BỘ QUY TẮC NGA</span><h2>{draft.id ? `Sửa ${draft.name || draft.id}` : "Thêm quy tắc"}</h2></div><button onClick={() => setDraft(null)} aria-label="Đóng">×</button></header><div className="med-rule-form"><label>ID quy tắc<input value={draft.id} onChange={(event) => patch({ id: event.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })} placeholder="vi-du-hoat-chat" /></label><label>Tên hoạt chất<input value={draft.name} onChange={(event) => patch({ name: event.target.value })} /></label><div className="med-rule-form-row"><label>Cấp<select value={draft.level} onChange={(event) => patch({ level: Number(event.target.value) })}>{[1,2,3,4,5].map((level) => <option key={level} value={level}>Cấp {level}</option>)}</select></label><label>Nhóm<input value={draft.category} onChange={(event) => patch({ category: event.target.value })} placeholder="precursor / narcotic_control…" /></label></div><label>Tên đồng nghĩa <small>mỗi dòng hoặc phân cách bằng dấu phẩy</small><textarea rows={5} value={draft.synonymsText} onChange={(event) => patch({ synonymsText: event.target.value })} /></label><label>Căn cứ / giải thích<textarea rows={5} value={draft.basis} onChange={(event) => patch({ basis: event.target.value })} /></label><label>Mã nguồn <small>RU-681-II, RU-459N…</small><textarea rows={3} value={draft.sourceIdsText} onChange={(event) => patch({ sourceIdsText: event.target.value })} /></label><label>Điều kiện cần kiểm tra<input value={draft.condition} onChange={(event) => patch({ condition: event.target.value })} placeholder="concentration / dose_or_combination…" /></label><div className="med-check-row"><label><input type="checkbox" checked={draft.reviewRequired} onChange={(event) => patch({ reviewRequired: event.target.checked })} /> Bắt buộc/khuyến nghị kiểm duyệt</label><label><input type="checkbox" checked={draft.enabled} onChange={(event) => patch({ enabled: event.target.checked })} /> Đang bật</label></div></div><footer><button onClick={() => setDraft(null)}>Hủy</button><button className="primary" onClick={() => void onSave()} disabled={busy || !draft.id || !draft.name}>{busy ? "Đang lưu…" : "Lưu quy tắc"}</button></footer></section></div>;
}
