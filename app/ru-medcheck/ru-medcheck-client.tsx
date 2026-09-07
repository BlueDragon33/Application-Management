"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- full reload keeps the supervised HTTP preview stable. */

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { MedicineAccess } from "../medicine-access.server";

type Level = 1 | 2 | 3 | 4 | 5;
type Rule = { id: string; name: string; synonyms: string[]; level: Level; category: string; basis: string; sourceIds: string[]; reviewRequired: boolean; condition?: string | null };
type Ruleset = { version: string; updatedAt: string; verifiedAt?: string; disclaimer: string; levels: Record<string, { label: string; action: string }>; sources: { id: string; title: string; edition?: string; url: string }[]; rules: Rule[] };
type ReviewState = { id: string; status: string; proposedLevel: number; adminNote?: string | null; decision?: string | null; updatedAt?: string | null };
type ReviewAccess = { id: string; token: string };
type TesseractResult = { data: { text: string; confidence: number } };
type TesseractWindow = Window & { Tesseract?: { recognize: (image: File | string, languages: string, options?: { logger?: (message: { status?: string; progress?: number }) => void }) => Promise<TesseractResult> } };

function normalize(value: string) { return value.normalize("NFKC").toLocaleLowerCase().replaceAll("ё", "е").replace(/\s+/g, " ").trim(); }
function escapeRegExp(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function containsTerm(text: string, term: string) {
  const clean = normalize(term);
  if (!clean) return false;
  const pattern = new RegExp(`(^|[^a-zа-я0-9])${escapeRegExp(clean).replace(/\\ /g, "\\s+")}($|[^a-zа-я0-9])`, "iu");
  return pattern.test(text);
}
function statusLabel(status: string) {
  return ({ pending: "Đang chờ Trung tâm", approved: "Đã duyệt", needs_documents: "Cần bổ sung hồ sơ", rejected: "Không khuyến nghị" } as Record<string, string>)[status] ?? status;
}
function storedReviewAccess(): ReviewAccess | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem("ru-medcheck-review-access");
    if (!saved) return null;
    const access = JSON.parse(saved) as ReviewAccess;
    return access.id && access.token ? access : null;
  } catch {
    localStorage.removeItem("ru-medcheck-review-access");
    return null;
  }
}
async function fetchReviewState(access: ReviewAccess) {
  const response = await fetch(`/api/medicine/reviews/${encodeURIComponent(access.id)}?token=${encodeURIComponent(access.token)}`, { cache: "no-store" });
  const data = await response.json() as ReviewState & { error?: string };
  if (!response.ok) throw new Error(data.error || "Không thể đọc trạng thái.");
  return data;
}

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getOnlineSnapshot() {
  return navigator.onLine;
}

function getServerOnlineSnapshot() {
  return true;
}

export default function RuMedCheckClient({ access }: { access: MedicineAccess }) {
  const [ruleset, setRuleset] = useState<Ruleset | null>(null);
  const [text, setText] = useState("");
  const [medicineName, setMedicineName] = useState("");
  const [confidence, setConfidence] = useState(100);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [error, setError] = useState("");
  const [review, setReview] = useState<ReviewState | null>(null);
  const [reviewAccess, setReviewAccess] = useState<ReviewAccess | null>(storedReviewAccess);
  const [sending, setSending] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const online = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getServerOnlineSnapshot);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/medicine/rules", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("Không thể tải cơ sở quy tắc Nga.");
      const data = await response.json() as Ruleset;
      setRuleset(data);
      localStorage.setItem("ru-medcheck-rules", JSON.stringify(data));
    }).catch((reason) => {
      try {
        const cached = localStorage.getItem("ru-medcheck-rules");
        if (cached) setRuleset(JSON.parse(cached) as Ruleset);
        else setError(String(reason.message || reason));
      } catch { setError("Không thể tải cơ sở quy tắc Nga."); }
    });
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const beforeInstall = (event: Event) => { event.preventDefault(); setInstallPrompt(event); };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
    };
  }, []);

  useEffect(() => {
    if (!reviewAccess) return;
    let cancelled = false;
    void fetchReviewState(reviewAccess).then((next) => {
      if (!cancelled) setReview(next);
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Không thể đọc trạng thái kiểm duyệt.");
    });
    return () => { cancelled = true; };
  }, [reviewAccess]);

  const analysis = useMemo(() => {
    if (!ruleset || !text.trim()) return null;
    const source = normalize(text);
    const matched = ruleset.rules.filter((rule) => [rule.name, ...rule.synonyms].some((term) => containsTerm(source, term)));
    const level = (matched.length ? Math.max(...matched.map((rule) => rule.level)) : 2) as Level;
    return { matched, level, reviewRequired: matched.length === 0 || matched.some((rule) => rule.reviewRequired) || level >= 3 || confidence < 70 };
  }, [ruleset, text, confidence]);

  async function loadTesseract() {
    const current = window as TesseractWindow;
    if (current.Tesseract) return current.Tesseract;
    if (!navigator.onLine) throw new Error("OCR ảnh cần mạng ở lần tải đầu tiên. Bạn vẫn có thể dán thành phần để kiểm tra bằng dữ liệu đã lưu.");
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
      script.async = true;
      script.crossOrigin = "anonymous";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Không tải được bộ OCR."));
      document.head.appendChild(script);
    });
    if (!current.Tesseract) throw new Error("OCR chưa sẵn sàng.");
    return current.Tesseract;
  }

  async function readImage(file: File) {
    setError(""); setOcrBusy(true); setOcrProgress(0);
    try {
      const tesseract = await loadTesseract();
      const result = await tesseract.recognize(file, "eng+rus", { logger: (message) => { if (typeof message.progress === "number") setOcrProgress(Math.round(message.progress * 100)); } });
      setText(result.data.text.trim()); setConfidence(Math.round(result.data.confidence || 0));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể đọc ảnh."); }
    finally { setOcrBusy(false); }
  }

  async function sendReview() {
    if (!analysis || !text.trim()) return;
    if (!navigator.onLine) { setError("Cần có mạng để gửi Trung tâm kiểm duyệt."); return; }
    setSending(true); setError("");
    try {
      const response = await fetch("/api/medicine/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ medicineName, ocrText: text, confidence }),
      });
      const data = await response.json() as { id?: string; token?: string; error?: string; status?: string; proposedLevel?: number };
      if (!response.ok || !data.id || !data.token) throw new Error(data.error || "Không thể gửi kiểm duyệt.");
      const access = { id: data.id, token: data.token } satisfies ReviewAccess;
      localStorage.setItem("ru-medcheck-review-access", JSON.stringify(access));
      setReviewAccess(access);
      setReview({ id: data.id, status: data.status || "pending", proposedLevel: data.proposedLevel || analysis.level });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể gửi kiểm duyệt."); }
    finally { setSending(false); }
  }

  async function refreshReview() {
    if (!reviewAccess) return;
    try { setReview(await fetchReviewState(reviewAccess)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể đọc trạng thái kiểm duyệt."); }
  }

  async function installApp() {
    const event = installPrompt as Event & { prompt?: () => Promise<void> };
    if (event?.prompt) { await event.prompt(); setInstallPrompt(null); }
  }

  return <main className="ru-app">
    <header className="ru-topbar">
      <a className="ru-brand" href="/"><span>HN</span><div><strong>Hòa nhập Nga</strong><small>RU MedCheck · thuốc và quy định Nga</small></div></a>
      <div className="ru-actions"><span className={online ? "ru-net online" : "ru-net offline"}>{online ? "Online" : "Offline"}</span><span className="ru-access">Đã duyệt · {access.displayName}</span>{installPrompt ? <button onClick={() => void installApp()}>Cài Web App</button> : null}<a href="#sources">Nguồn Nga</a></div>
    </header>

    <section className="ru-hero">
      <div><span className="ru-kicker">HÒA NHẬP NGA · TRÍCH HOẠT CHẤT · ĐỐI CHIẾU 5 CẤP</span><h1>Chụp thuốc trước khi mang hoặc sử dụng tại Nga.</h1><p>Ảnh được OCR ngay trong trình duyệt. Hệ thống chỉ gửi phần chữ đã trích xuất khi bạn chủ động yêu cầu kiểm duyệt; máy chủ sẽ tự đối chiếu lại hoạt chất và cấp cảnh báo.</p></div>
      <div className="ru-version"><b>{ruleset?.version || "Đang tải dữ liệu…"}</b><span>{ruleset ? `Kiểm chứng ${ruleset.verifiedAt || ruleset.updatedAt}` : "Cơ sở quy tắc Liên bang Nga"}</span></div>
    </section>

    {error ? <div className="ru-alert">{error}</div> : null}

    <section className="ru-grid">
      <div className="ru-card ru-input-card">
        <div className="ru-card-head"><div><span>BƯỚC 1</span><h2>Đọc nhãn thuốc</h2></div><span className="ru-local">Ảnh không tải lên server</span></div>
        <label className="ru-label">Tên thuốc <small>(không bắt buộc)</small><input value={medicineName} onChange={(event) => setMedicineName(event.target.value)} placeholder="Ví dụ: Decolgen Forte" /></label>
        <input ref={inputRef} type="file" accept="image/*" capture="environment" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void readImage(file); }} />
        <button className="ru-upload" onClick={() => inputRef.current?.click()} disabled={ocrBusy}>{ocrBusy ? `Đang OCR… ${ocrProgress}%` : "Chụp / chọn ảnh hộp, vỉ hoặc tờ hướng dẫn"}</button>
        <div className="ru-separator"><span>hoặc nhập thủ công</span></div>
        <textarea value={text} onChange={(event) => { setText(event.target.value); setConfidence(100); }} placeholder="Dán phần Composition / Ingredients / Состав / Thành phần vào đây…" rows={11} />
        <div className="ru-input-meta"><span>Độ tin cậy OCR: <b>{confidence}%</b></span><button onClick={() => { setText(""); setMedicineName(""); setConfidence(100); }}>Xóa nội dung</button></div>
      </div>

      <div className="ru-card ru-result-card">
        <div className="ru-card-head"><div><span>BƯỚC 2</span><h2>Kết quả theo Nga</h2></div></div>
        {!analysis ? <div className="ru-empty"><b>Chưa có dữ liệu để phân tích</b><span>Chụp ảnh hoặc nhập thành phần thuốc ở khung bên trái.</span></div> : <>
          <div className={`ru-level ru-level-${analysis.level}`}><div><small>CẤP {analysis.level}/5</small><strong>{ruleset?.levels[String(analysis.level)]?.label}</strong></div><b>{analysis.level}</b></div>
          <p className="ru-action-text">{ruleset?.levels[String(analysis.level)]?.action}</p>
          <div className="ru-match-list">{analysis.matched.length ? analysis.matched.map((rule) => <article key={rule.id}><div><strong>{rule.name}</strong><span>Cấp {rule.level} · {rule.category}</span></div><p>{rule.basis}</p>{rule.condition ? <small>Cần kiểm tra thêm: {rule.condition.replaceAll("_", " ")}</small> : null}</article>) : <article><strong>Chưa nhận diện được hoạt chất trong bộ quy tắc</strong><p>Hệ thống xếp Cấp 2 thay vì coi là an toàn. Hãy kiểm tra lại chữ OCR hoặc gửi Trung tâm kiểm duyệt.</p></article>}</div>
          {analysis.reviewRequired ? <div className="ru-review-box"><b>Nên kiểm duyệt bởi Trung tâm</b><span>{analysis.matched.length === 0 ? "Chưa nhận diện được hoạt chất trong bộ quy tắc Nga." : analysis.level >= 3 ? "Có thành phần cần kiểm tra điều kiện/hồ sơ tại Nga." : "Độ tin cậy OCR thấp."}</span><button onClick={() => void sendReview()} disabled={sending || !online}>{sending ? "Đang gửi…" : online ? "Gửi Trung tâm kiểm duyệt" : "Cần mạng để gửi kiểm duyệt"}</button></div> : null}
        </>}

        {review ? <div className="ru-review-status"><div><span>Ca kiểm duyệt</span><b>{statusLabel(review.status)}</b><code>{review.id}</code></div><button onClick={() => void refreshReview()} disabled={!online}>Cập nhật</button>{review.decision ? <p><strong>Kết luận:</strong> {review.decision}</p> : null}{review.adminNote ? <p><strong>Ghi chú:</strong> {review.adminNote}</p> : null}</div> : null}
      </div>
    </section>

    <section className="ru-levels"><div className="ru-section-title"><span>THANG KIỂM SOÁT</span><h2>5 cấp dùng thống nhất</h2></div><div className="ru-level-grid">{[1,2,3,4,5].map((level) => <article key={level} className={`ru-level-card ru-level-${level}`}><b>{level}</b><strong>{ruleset?.levels[String(level)]?.label || `Cấp ${level}`}</strong><p>{ruleset?.levels[String(level)]?.action}</p></article>)}</div></section>

    <section className="ru-sources" id="sources"><div className="ru-section-title"><span>CHỈ LIÊN BANG NGA</span><h2>Nguồn quy định</h2></div>{ruleset?.sources.map((source) => <a key={source.id} href={source.url} target="_blank" rel="noreferrer"><code>{source.id}</code><span>{source.title}{source.edition ? <small>{source.edition}</small> : null}</span><b>↗</b></a>)}</section>

    <footer><p>{ruleset?.disclaimer || "Công cụ sàng lọc quy định, không thay thế tư vấn chuyên môn."}</p><span>Hòa nhập Nga · RU MedCheck</span></footer>
  </main>;
}
