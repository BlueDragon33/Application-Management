"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { connectAdminCenter, connectOperationsDashboard, roleLabels, type AdminAccess } from "../../admin-device-client";
import styles from "../../application-admin.module.css";

type View = "overview" | "privacy" | "contract";
type SiteState = { url: string; error: string; remoteAdminReady: boolean };

const allowlist = [
  "Mã thiết bị và lớp thiết bị",
  "Trạng thái truy cập",
  "Quyền chỉnh sửa",
  "Phiên bản ứng dụng và trạng thái dịch vụ",
  "Audit metadata đã lọc",
  "Cấu hình/bản sửa chủ động gửi lên duyệt",
] as const;

const denylist = [
  "Hồ sơ trẻ em",
  "Nhật ký sức khỏe và dinh dưỡng",
  "Ghi chú riêng tư dạng free-text",
  "Portfolio và minh chứng",
  "Nội dung backup cục bộ",
] as const;

const baseReadiness = [
  ["Runtime local-first", "available", "Ứng dụng/PWA đang tồn tại trên main."],
  ["Privacy local-first", "available", "Dữ liệu nhạy cảm được giữ cục bộ theo thiết kế."],
  ["PWA / offline", "available", "App shell và offline flow đã có."],
  ["Local audit", "available", "Có audit explorer và metadata allowlist cục bộ."],
  ["Production device registry GU-", "missing", "Local Control Service đã có registry GU-; production contract chưa công bố readiness tương ứng."],
  ["P-256 device gateway", "missing", "Chưa có register/challenge/authorize backend."],
  ["Production Admin API", "missing", "Local device-control API đã hoạt động; production vẫn fail-closed cho tới khi deploy/contract live được xác minh."],
  ["Production remote audit", "missing", "Local Control Service đã có privacy-safe audit; production remote audit chưa được nâng trạng thái."],
  ["Configuration review API", "missing", "Chưa có luồng gửi cấu hình/bản sửa lên duyệt."],
] as const;

function Gate({ access, busy, error, retry }: { access: AdminAccess | null; busy: boolean; error: string; retry: () => void }) {
  return <main className={styles.workspaceGate}><section><span className={styles.workspaceGateMark}>GU</span><small>GROWUP · ADMIN GATE</small><h1>{access?.status === "pending" ? "Thiết bị quản trị đang chờ cấp quyền." : access?.status === "blocked" ? "Thiết bị quản trị đã bị khóa." : "Đang xác thực khu quản trị GrowUP…"}</h1><p>{error || "Control surface GrowUP chỉ mở trên thiết bị quản trị đã được Application Management duyệt."}</p>{access?.deviceCode ? <div className={styles.workspaceGateCode}><span>Mã thiết bị quản trị</span><strong>{access.deviceCode}</strong></div> : null}<button onClick={retry} disabled={busy}>{busy ? "Đang kiểm tra…" : "Kiểm tra lại"}</button></section></main>;
}

export default function GrowUpAdmin({ user, site }: { user: { displayName: string; email: string }; site: SiteState }) {
  const [access, setAccess] = useState<AdminAccess | null>(null);
  const [view, setView] = useState<View>("overview");
  const [siteState, setSiteState] = useState<SiteState>(site);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setBusy(true); setError("");
    try {
      const result = await connectAdminCenter();
      setAccess(result.access);
      if (result.access.status === "approved" && !result.bootstrap) {
        setError("Không thể xác nhận control-plane của thiết bị quản trị.");
        return;
      }
      if (result.access.status === "approved") {
        const operations = await connectOperationsDashboard();
        const summary = operations.bootstrap?.summaries.find((item) => item.appId === "growup-mychildren");
        if (summary) {
          setSiteState({
            url: summary.webHref ?? "",
            error: summary.connection === "unavailable" ? summary.note : "",
            remoteAdminReady: summary.remoteAdminReady === true,
          });
        }
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể xác thực khu quản trị GrowUP."); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    const onFocus = () => { if (access?.status === "approved") void load(); };
    const onVisibility = () => { if (document.visibilityState === "visible" && access?.status === "approved") void load(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access?.status]);

  const readiness = [
    ...baseReadiness.slice(0, 4),
    ["Direct site contract", siteState.url ? "available" : "missing", siteState.url ? "Đã xác minh contract runtime của Site GrowUP và cho phép mở trực tiếp." : siteState.error || "Chưa cấu hình URL Site GrowUP."],
    ...baseReadiness.slice(4),
  ] as const;
  const available = readiness.filter((item) => item[1] === "available").length;

  if (!access || access.status !== "approved") return <Gate access={access} busy={busy} error={error} retry={() => void load()} />;

  const title = view === "privacy"
    ? ["PRIVACY BOUNDARY", "Ranh giới dữ liệu trẻ em", "Control-plane chỉ nhận metadata quản trị tối thiểu; không nhận hồ sơ/sức khỏe trẻ."]
    : view === "contract"
      ? ["REMOTE ADMIN CONTRACT", "Độ sẵn sàng quản trị từ xa", "Direct web launch đã tách khỏi các API quản trị sâu; chỉ capability có backend thật mới được bật thành thao tác."]
      : ["GROWUP · CLIENT CONTROL", "Quản trị GrowUP MyChildren", "Mở Site GrowUP đã xác minh contract và quản trị ranh giới mà không kéo dữ liệu trẻ về Trung tâm."];

  return <main className={styles.workspaceShell}>
    <aside className={styles.clientSidebar}>
      <Link href="/" className={styles.serverBack}><span>←</span><div><small>SERVER</small><strong>Application Management</strong></div></Link>
      <div className={styles.clientBrand}><span>GU</span><div><small>CLIENT CẤP 1</small><strong>GrowUP MyChildren</strong></div></div>
      <div className={styles.clientStatus}><i data-status={siteState.url ? "online" : "warning"}/><div><strong>{siteState.url ? "Web contract đã kết nối" : "Runtime sẵn sàng"}</strong><small>{siteState.url ? "Có thể mở Site GrowUP" : "Chờ URL deployment"}</small></div></div>
      <nav className={styles.clientNav}><span className={styles.navGroup}>QUẢN TRỊ GROWUP</span><button data-active={view === "overview"} onClick={() => setView("overview")}><span>01</span><div><strong>Tổng quan</strong><small>Runtime & kết nối</small></div></button><button data-active={view === "privacy"} onClick={() => setView("privacy")}><span>02</span><div><strong>Ranh giới dữ liệu</strong><small>Allowlist / denylist</small></div></button><button data-active={view === "contract"} onClick={() => setView("contract")}><span>03</span><div><strong>Contract</strong><small>{available}/{readiness.length} sẵn sàng</small></div></button></nav>
      <div className={styles.clientBoundary}><span>RANH GIỚI</span><strong>Không đưa hồ sơ trẻ em vào Application Management.</strong><p>GrowUP là local-first; control-plane chỉ quản lý metadata/permission tối thiểu.</p></div>
      <div className={styles.clientUser}><span>{user.displayName.slice(0,1).toUpperCase()}</span><div><strong>{user.displayName}</strong><small>{roleLabels[access.role]}</small><small>{access.deviceCode}</small></div></div>
    </aside>

    <section className={styles.workspaceMain}>
      <header className={styles.workspaceTopbar}><div><span>{title[0]}</span><h1>{title[1]}</h1><p>{title[2]}</p></div><div className={styles.topbarActions}>{siteState.url ? <a href={siteState.url} target="_blank" rel="noreferrer">Mở Site GrowUP ↗</a> : null}<Link href="/">Hệ thống</Link><button onClick={() => void load()} disabled={busy}>{busy ? "Đang cập nhật…" : "Cập nhật"}</button></div></header>
      {error ? <div className={styles.workspaceError}>{error}</div> : null}
      {siteState.error ? <div className={styles.workspaceError}>{siteState.error}</div> : null}

      {view === "overview" ? <>
        <section className={styles.clientMetrics}>
          <article><span>Runtime</span><strong>Local-first</strong><small>PWA · offline</small></article>
          <article><span>Privacy</span><strong>Giữ cục bộ</strong><small>Không gửi dữ liệu trẻ lên Trung tâm</small></article>
          <article data-state={siteState.url ? "ready" : "pending"}><span>Kết nối web</span><strong>{siteState.url ? "Đã nối" : "Chờ URL"}</strong><small>{siteState.url ? "Contract đã xác minh" : "Chưa có deployment URL"}</small></article>
          <article data-state={siteState.remoteAdminReady ? "ready" : "pending"}><span>Remote admin</span><strong>{siteState.remoteAdminReady ? "Sẵn sàng" : "Chưa bật"}</strong><small>Registry/API GU- vẫn tách riêng</small></article>
        </section>

        <section className={styles.clientPanel}><div className={styles.panelHeader}><div><span>DIRECT SITE ACCESS</span><h2>Mở web-app GrowUP từ Trung tâm quản trị</h2></div><p>Trung tâm xác minh `control/application-management.contract.json` trước khi công nhận kết nối web.</p></div><div className={styles.contractSummary}><div><span>Site</span><strong>{siteState.url ? "Đã xác minh" : "Chưa cấu hình"}</strong></div><div><span>Runtime</span><strong>GrowUP sở hữu</strong></div><div><span>Child / Health data</span><strong>Không đưa lên control-plane</strong></div><div><span>Remote operations</span><strong>{siteState.remoteAdminReady ? "Backend sẵn sàng" : "Tiếp tục khóa"}</strong></div></div>{siteState.url ? <p><a href={siteState.url} target="_blank" rel="noreferrer" className={styles.primaryLink}>Mở GrowUP MyChildren ↗</a></p> : null}</section>

        <section className={styles.clientPanel}><div className={styles.panelHeader}><div><span>CONTROL SCOPE</span><h2>Quản trị tối thiểu, không gom dữ liệu</h2></div><p>Application Management chỉ cần biết thiết bị, quyền, phiên bản dịch vụ và audit metadata an toàn khi các API tương ứng tồn tại.</p></div><div className={styles.contractSummary}><div><span>Runtime</span><strong>GrowUP sở hữu</strong></div><div><span>Child data</span><strong>Không đưa lên control-plane</strong></div><div><span>Health data</span><strong>Không đưa lên control-plane</strong></div><div><span>Admin operations</span><strong>{siteState.remoteAdminReady ? "Production ready" : "Local control · production gated"}</strong></div></div></section>
        <section className={styles.boundaryNotice}><span>!</span><div><strong>Direct web launch không đồng nghĩa với quyền đọc dữ liệu trẻ em.</strong><p>Không bật các nút quản trị giả. Local Control Service chỉ trao đổi registry/audit metadata an toàn; production registry, remote audit và kiểm duyệt cấu hình vẫn fail-closed cho tới khi contract live xác nhận.</p></div></section>
      </> : null}

      {view === "privacy" ? <><section className={styles.clientPanel}><div className={styles.panelHeader}><div><span>CONTROL-PLANE ALLOWLIST</span><h2>Được phép trao đổi</h2></div><p>Chỉ metadata cần thiết cho quyền và vận hành.</p></div><div className={styles.capabilityList}>{allowlist.map((item,index) => <article key={item}><span>{String(index+1).padStart(2,"0")}</span><div><strong>{item}</strong><small>Metadata quản trị tối thiểu</small></div><i data-contract="connected"/></article>)}</div></section><section className={styles.clientPanel}><div className={styles.panelHeader}><div><span>DENYLIST</span><h2>Không được đưa vào Trung tâm</h2></div><p>Các nhóm này phải ở lại GrowUP/local storage.</p></div><div className={styles.capabilityList}>{denylist.map((item,index) => <article key={item}><span>{String(index+1).padStart(2,"0")}</span><div><strong>{item}</strong><small>Local only · không đồng bộ control-plane</small></div><i data-contract="pending"/></article>)}</div></section></> : null}

      {view === "contract" ? <section className={styles.clientPanel}><div className={styles.panelHeader}><div><span>READINESS</span><h2>Điều kiện để bật quản trị thật</h2></div><p>Nguồn contract: `control/application-management.contract.json` trong GrowUP main.</p></div><div className={styles.capabilityList}>{readiness.map((item,index) => <article key={item[0]}><span>{String(index+1).padStart(2,"0")}</span><div><strong>{item[0]}</strong><small>{item[2]}</small></div><i data-contract={item[1] === "available" ? "connected" : "pending"}/></article>)}</div><div className={styles.guardrailBlock}><span>GATE</span><p>• Direct launch chỉ mở origin đã qua contract probe.</p><p>• Registry phải dùng namespace GU- riêng.</p><p>• Access và edit permission phải tách biệt.</p><p>• Remote audit chỉ được trả metadata allowlist.</p><p>• Không có API nào được phép trả child profile/health/nutrition/private notes.</p></div></section> : null}
    </section>
  </main>;
}
