"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { connectAdminCenter, roleLabels, type AdminAccess } from "../../admin-device-client";
import styles from "../../application-admin.module.css";

type View = "overview" | "privacy" | "contract";

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

const readiness = [
  ["Runtime local-first", "available", "Ứng dụng/PWA đang tồn tại trên main."],
  ["Privacy local-first", "available", "Dữ liệu nhạy cảm được giữ cục bộ theo thiết kế."],
  ["PWA / offline", "available", "App shell và offline flow đã có."],
  ["Local audit", "available", "Có audit explorer và metadata allowlist cục bộ."],
  ["Device registry GU-", "missing", "Chưa có registry thiết bị quản trị từ xa."],
  ["P-256 device gateway", "missing", "Chưa có register/challenge/authorize backend."],
  ["Admin API", "missing", "Chưa có API app-scoped cho Application Management."],
  ["Remote audit API", "missing", "Chưa có endpoint chỉ trả metadata an toàn."],
  ["Configuration review API", "missing", "Chưa có luồng gửi cấu hình/bản sửa lên duyệt."],
] as const;

function Gate({ access, busy, error, retry }: { access: AdminAccess | null; busy: boolean; error: string; retry: () => void }) {
  return <main className={styles.workspaceGate}><section><span className={styles.workspaceGateMark}>GU</span><small>GROWUP · ADMIN GATE</small><h1>{access?.status === "pending" ? "Thiết bị quản trị đang chờ cấp quyền." : access?.status === "blocked" ? "Thiết bị quản trị đã bị khóa." : "Đang xác thực khu quản trị GrowUP…"}</h1><p>{error || "Control surface GrowUP chỉ mở trên thiết bị quản trị đã được Application Management duyệt."}</p>{access?.deviceCode ? <div className={styles.workspaceGateCode}><span>Mã thiết bị quản trị</span><strong>{access.deviceCode}</strong></div> : null}<button onClick={retry} disabled={busy}>{busy ? "Đang kiểm tra…" : "Kiểm tra lại"}</button></section></main>;
}

export default function GrowUpAdmin({ user }: { user: { displayName: string; email: string } }) {
  const [access, setAccess] = useState<AdminAccess | null>(null);
  const [view, setView] = useState<View>("overview");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setBusy(true); setError("");
    try {
      const result = await connectAdminCenter();
      setAccess(result.access);
      if (result.access.status === "approved" && !result.bootstrap) setError("Không thể xác nhận control-plane của thiết bị quản trị.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể xác thực khu quản trị GrowUP."); }
    finally { setBusy(false); }
  }

  useEffect(() => { void load(); }, []);
  const available = readiness.filter((item) => item[1] === "available").length;
  if (!access || access.status !== "approved") return <Gate access={access} busy={busy} error={error} retry={() => void load()} />;

  const title = view === "privacy" ? ["PRIVACY BOUNDARY", "Ranh giới dữ liệu trẻ em", "Control-plane chỉ nhận metadata quản trị tối thiểu; không nhận hồ sơ/sức khỏe trẻ."] : view === "contract" ? ["REMOTE ADMIN CONTRACT", "Độ sẵn sàng quản trị từ xa", "Chỉ capability có backend thật mới được bật thành thao tác."] : ["GROWUP · CLIENT CONTROL", "Quản trị GrowUP MyChildren", "Quản trị trạng thái, privacy boundary và readiness mà không kéo dữ liệu trẻ về Trung tâm."];

  return <main className={styles.workspaceShell}>
    <aside className={styles.clientSidebar}>
      <Link href="/" className={styles.serverBack}><span>←</span><div><small>SERVER</small><strong>Application Management</strong></div></Link>
      <div className={styles.clientBrand}><span>GU</span><div><small>CLIENT CẤP 1</small><strong>GrowUP MyChildren</strong></div></div>
      <div className={styles.clientStatus}><i data-status="warning"/><div><strong>Runtime sẵn sàng</strong><small>Remote admin chưa nối</small></div></div>
      <nav className={styles.clientNav}><span className={styles.navGroup}>QUẢN TRỊ GROWUP</span><button data-active={view === "overview"} onClick={() => setView("overview")}><span>01</span><div><strong>Tổng quan</strong><small>Runtime & readiness</small></div></button><button data-active={view === "privacy"} onClick={() => setView("privacy")}><span>02</span><div><strong>Ranh giới dữ liệu</strong><small>Allowlist / denylist</small></div></button><button data-active={view === "contract"} onClick={() => setView("contract")}><span>03</span><div><strong>Contract</strong><small>{available}/{readiness.length} sẵn sàng</small></div></button></nav>
      <div className={styles.clientBoundary}><span>RANH GIỚI</span><strong>Không đưa hồ sơ trẻ em vào Application Management.</strong><p>GrowUP là local-first; control-plane chỉ quản lý metadata/permission tối thiểu.</p></div>
      <div className={styles.clientUser}><span>{user.displayName.slice(0,1).toUpperCase()}</span><div><strong>{user.displayName}</strong><small>{roleLabels[access.role]}</small><small>{access.deviceCode}</small></div></div>
    </aside>

    <section className={styles.workspaceMain}>
      <header className={styles.workspaceTopbar}><div><span>{title[0]}</span><h1>{title[1]}</h1><p>{title[2]}</p></div><div className={styles.topbarActions}><Link href="/">Hệ thống</Link><button onClick={() => void load()} disabled={busy}>{busy ? "Đang cập nhật…" : "Cập nhật"}</button></div></header>
      {error ? <div className={styles.workspaceError}>{error}</div> : null}

      {view === "overview" ? <><section className={styles.clientMetrics}><article><span>Runtime</span><strong>Local-first</strong><small>PWA · offline</small></article><article><span>Privacy</span><strong>Giữ cục bộ</strong><small>Không gửi dữ liệu trẻ lên Trung tâm</small></article><article data-state="pending"><span>Remote admin</span><strong>{available}/{readiness.length}</strong><small>Chưa bật thao tác</small></article><article><span>Device namespace</span><strong>GU-</strong><small>Chưa triển khai backend</small></article></section><section className={styles.clientPanel}><div className={styles.panelHeader}><div><span>CONTROL SCOPE</span><h2>Quản trị tối thiểu, không gom dữ liệu</h2></div><p>Application Management chỉ cần biết thiết bị, quyền, phiên bản dịch vụ và audit metadata an toàn.</p></div><div className={styles.contractSummary}><div><span>Runtime</span><strong>GrowUP sở hữu</strong></div><div><span>Child data</span><strong>Không đưa lên control-plane</strong></div><div><span>Health data</span><strong>Không đưa lên control-plane</strong></div><div><span>Admin operations</span><strong>Chờ backend thật</strong></div></div></section><section className={styles.boundaryNotice}><span>!</span><div><strong>Không bật các nút quản trị giả.</strong><p>Machine-readable contract đã được thêm vào GrowUP main. Khi registry GU-/admin API/audit API tồn tại và test xanh, thao tác thật mới xuất hiện ở đây.</p></div></section></> : null}

      {view === "privacy" ? <><section className={styles.clientPanel}><div className={styles.panelHeader}><div><span>CONTROL-PLANE ALLOWLIST</span><h2>Được phép trao đổi</h2></div><p>Chỉ metadata cần thiết cho quyền và vận hành.</p></div><div className={styles.capabilityList}>{allowlist.map((item,index) => <article key={item}><span>{String(index+1).padStart(2,"0")}</span><div><strong>{item}</strong><small>Metadata quản trị tối thiểu</small></div><i data-contract="connected"/></article>)}</div></section><section className={styles.clientPanel}><div className={styles.panelHeader}><div><span>DENYLIST</span><h2>Không được đưa vào Trung tâm</h2></div><p>Các nhóm này phải ở lại GrowUP/local storage.</p></div><div className={styles.capabilityList}>{denylist.map((item,index) => <article key={item}><span>{String(index+1).padStart(2,"0")}</span><div><strong>{item}</strong><small>Local only · không đồng bộ control-plane</small></div><i data-contract="pending"/></article>)}</div></section></> : null}

      {view === "contract" ? <section className={styles.clientPanel}><div className={styles.panelHeader}><div><span>READINESS</span><h2>Điều kiện để bật quản trị thật</h2></div><p>Nguồn contract: `control/application-management.contract.json` trong GrowUP main.</p></div><div className={styles.capabilityList}>{readiness.map((item,index) => <article key={item[0]}><span>{String(index+1).padStart(2,"0")}</span><div><strong>{item[0]}</strong><small>{item[2]}</small></div><i data-contract={item[1] === "available" ? "connected" : "pending"}/></article>)}</div><div className={styles.guardrailBlock}><span>GATE</span><p>• Registry phải dùng namespace GU- riêng.</p><p>• Access và edit permission phải tách biệt.</p><p>• Remote audit chỉ được trả metadata allowlist.</p><p>• Không có API nào được phép trả child profile/health/nutrition/private notes.</p></div></section> : null}
    </section>
  </main>;
}
