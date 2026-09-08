"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { connectAdminCenter, roleLabels, type AdminAccess } from "../../admin-device-client";
import type { ApplicationConfig } from "../../application-registry";
import styles from "../../application-admin.module.css";

type View = "overview" | "subclients" | "contract";

type Readiness = {
  label: string;
  state: "available" | "missing";
  note: string;
};

const readiness: readonly Readiness[] = [
  { label: "Runtime Bauman", state: "available", note: "Main có runtime/source học tập và cây subjects." },
  { label: "Inventory sub-client", state: "available", note: "Math_Bauman + các module môn học đã được định danh." },
  { label: "Device registry BM-", state: "missing", note: "Chưa có backend registry thiết bị riêng của Bauman." },
  { label: "P-256 device gateway", state: "missing", note: "Chưa có API register/challenge/authorize." },
  { label: "Admin API", state: "missing", note: "Chưa có endpoint app-scoped cho Application Management." },
  { label: "Audit API", state: "missing", note: "Chưa có nhật ký quản trị Bauman để đọc từ xa." },
  { label: "Content review API", state: "missing", note: "Chưa có contract gửi bản sửa lên để duyệt/xuất bản." },
];

function Gate({ access, busy, error, retry }: { access: AdminAccess | null; busy: boolean; error: string; retry: () => void }) {
  return <main className={styles.workspaceGate}><section>
    <span className={styles.workspaceGateMark}>BM</span>
    <small>BAUMAN HUB · ADMIN GATE</small>
    <h1>{access?.status === "pending" ? "Thiết bị quản trị đang chờ cấp quyền." : access?.status === "blocked" ? "Thiết bị quản trị đã bị khóa." : "Đang xác thực khu quản trị Bauman Hub…"}</h1>
    <p>{error || "Bauman Hub chỉ hiển thị trên thiết bị quản trị đã được Application Management duyệt."}</p>
    {access?.deviceCode ? <div className={styles.workspaceGateCode}><span>Mã thiết bị quản trị</span><strong>{access.deviceCode}</strong></div> : null}
    <button onClick={retry} disabled={busy}>{busy ? "Đang kiểm tra…" : "Kiểm tra lại"}</button>
  </section></main>;
}

export default function BaumanAdmin({ application, user }: { application: ApplicationConfig; user: { displayName: string; email: string } }) {
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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể xác thực khu quản trị Bauman Hub.");
    } finally { setBusy(false); }
  }

  useEffect(() => { void load(); }, []);

  const children = application.childClients ?? [];
  const independent = children.filter((item) => item.state === "independent").length;
  const modules = children.filter((item) => item.state === "module").length;
  const ready = readiness.filter((item) => item.state === "available").length;
  const title = useMemo(() => view === "subclients"
    ? { eyebrow: "LEVEL 2 · SUB-CLIENTS", title: "Môn học & site con", description: "Quản trị cấu trúc Bauman mà không biến từng môn học thành client cấp 1." }
    : view === "contract"
      ? { eyebrow: "ADMIN CONTRACT", title: "Độ sẵn sàng quản trị", description: "Chỉ backend đã tồn tại mới được đánh dấu sẵn sàng; không dựng thao tác giả." }
      : { eyebrow: "BAUMAN HUB · CLIENT CONTROL", title: "Quản trị Bauman Hub", description: "Bauman là client cha. Trung tâm quản trị topology, policy và readiness; runtime học tập vẫn độc lập." }, [view]);

  if (!access || access.status !== "approved") return <Gate access={access} busy={busy} error={error} retry={() => void load()} />;

  return <main className={styles.workspaceShell}>
    <aside className={styles.clientSidebar}>
      <Link href="/" className={styles.serverBack}><span>←</span><div><small>SERVER</small><strong>Application Management</strong></div></Link>
      <div className={styles.clientBrand}><span>BM</span><div><small>CLIENT CẤP 1</small><strong>Bauman Hub</strong></div></div>
      <div className={styles.clientStatus}><i data-status="warning"/><div><strong>Đang hoàn thiện contract</strong><small>Không bật thao tác giả</small></div></div>
      <nav className={styles.clientNav}>
        <span className={styles.navGroup}>QUẢN TRỊ BAUMAN</span>
        <button data-active={view === "overview"} onClick={() => setView("overview")}><span>01</span><div><strong>Tổng quan</strong><small>Topology & boundary</small></div></button>
        <button data-active={view === "subclients"} onClick={() => setView("subclients")}><span>02</span><div><strong>Sub-client</strong><small>{children.length} site/module</small></div></button>
        <button data-active={view === "contract"} onClick={() => setView("contract")}><span>03</span><div><strong>Contract</strong><small>{ready}/{readiness.length} sẵn sàng</small></div></button>
      </nav>
      <div className={styles.clientBoundary}><span>RANH GIỚI</span><strong>Đây là khu quản trị, không phải nút mở site Bauman.</strong><p>Không iframe, không mở runtime học tập thay cho quản trị, không dùng DB/queue của Bơi ếch.</p></div>
      <div className={styles.clientUser}><span>{user.displayName.slice(0,1).toUpperCase()}</span><div><strong>{user.displayName}</strong><small>{roleLabels[access.role]}</small><small>{access.deviceCode}</small></div></div>
    </aside>

    <section className={styles.workspaceMain}>
      <header className={styles.workspaceTopbar}><div><span>{title.eyebrow}</span><h1>{title.title}</h1><p>{title.description}</p></div><div className={styles.topbarActions}><Link href="/">Hệ thống</Link><button onClick={() => void load()} disabled={busy}>{busy ? "Đang cập nhật…" : "Cập nhật"}</button></div></header>
      {error ? <div className={styles.workspaceError}>{error}</div> : null}

      {view === "overview" ? <>
        <section className={styles.clientMetrics}>
          <article><span>Vai trò</span><strong>Client cha</strong><small>LEVEL 1 · Bauman Hub</small></article>
          <article><span>Sub-client</span><strong>{children.length}</strong><small>{independent} độc lập · {modules} module</small></article>
          <article data-state="pending"><span>Admin contract</span><strong>{ready}/{readiness.length}</strong><small>Chưa đủ để bật thao tác</small></article>
          <article><span>Repository</span><strong>main</strong><small>{application.repository}</small></article>
        </section>
        <section className={styles.clientPanel}><div className={styles.panelHeader}><div><span>CONTROL TOPOLOGY</span><h2>Một client cha → nhiều sub-client</h2></div><p>Math_Bauman đã là repo độc lập; các môn còn lại vẫn nằm trong cây subjects và thuộc Bauman Hub.</p></div><div className={styles.controlFlow}><div data-level="server"><small>LEVEL 0</small><strong>Application Management</strong><span>Policy · admin device · security audit</span></div><b>→</b><div data-level="client"><small>LEVEL 1</small><strong>Bauman Hub</strong><span>Runtime · lộ trình · subject topology</span></div><b>→</b><div data-level="subclient"><small>LEVEL 2</small><strong>{children.length} sub-client</strong><span>Math + subject modules</span></div></div></section>
        <section className={styles.boundaryNotice}><span>!</span><div><strong>Chưa có backend quản trị Bauman.</strong><p>Vì vậy không có nút cấp quyền, publish, sửa bài hay mở site giả. Machine-readable contract đã được tạo tại repo Bauman để triển khai từng capability có kiểm chứng.</p></div></section>
      </> : null}

      {view === "subclients" ? <section className={styles.clientPanel}><div className={styles.panelHeader}><div><span>SUB-CLIENT INVENTORY</span><h2>Cấu trúc học tập dưới Bauman</h2></div><p>Thông tin dưới đây là inventory quản trị; không điều hướng người quản trị sang runtime học tập.</p></div><div className={styles.subClientList}>{children.map((child) => <article key={child.id}><span className={styles.subClientMark}>{child.initials}</span><div><strong>{child.name}</strong><small>{child.repository ?? child.sourcePath ?? "Chưa gán nguồn"}</small></div><div><span>Loại</span><strong>{child.kind === "subject-site" ? "Site môn học" : "Module"}</strong></div><div><span>Trạng thái</span><strong>{child.state === "independent" ? "Độc lập" : "Trong Bauman"}</strong></div><div><span>Admin contract</span><strong>Chưa nối</strong></div></article>)}</div></section> : null}

      {view === "contract" ? <section className={styles.clientPanel}><div className={styles.panelHeader}><div><span>READINESS GATE</span><h2>Điều kiện để bật quản trị thật</h2></div><p>Contract machine-readable nằm trong `control/application-management.contract.json` của Bauman main.</p></div><div className={styles.capabilityList}>{readiness.map((item, index) => <article key={item.label}><span>{String(index+1).padStart(2,"0")}</span><div><strong>{item.label}</strong><small>{item.note}</small></div><i data-contract={item.state === "available" ? "connected" : "pending"}/></article>)}</div><div className={styles.guardrailBlock}><span>GATE</span><p>• Device registry phải dùng namespace BM- riêng.</p><p>• Access và edit permission phải tách biệt.</p><p>• Admin API và audit phải thuộc Bauman, không dùng Bơi ếch/Health/RU.</p><p>• Chỉ sau khi backend + test xanh mới bật thao tác ở khu này.</p></div></section> : null}
    </section>
  </main>;
}
